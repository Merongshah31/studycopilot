import React, { useEffect, useMemo, useState } from 'react'
import { Bot, MessageSquarePlus, Send, Trash2, User2 } from 'lucide-react'
import Card from '../components/Card'
import { apiFetch } from '../lib/api'

export default function Assistant() {
  const [chats, setChats] = useState([])
  const [activeChatId, setActiveChatId] = useState('')
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [agentMode, setAgentMode] = useState(true)

  const activeChat = useMemo(() => chats.find((chat) => chat.id === activeChatId), [chats, activeChatId])

  async function loadChats() {
    const rows = await apiFetch('/assistant/chats')
    const list = Array.isArray(rows) ? rows : []
    setChats(list)
    if (!activeChatId && list[0]) setActiveChatId(list[0].id)
  }

  async function loadMessages(chatId) {
    if (!chatId) return setMessages([])
    const data = await apiFetch(`/assistant/chats/${chatId}/messages`)
    setMessages(Array.isArray(data?.messages) ? data.messages : [])
  }

  useEffect(() => { loadChats().catch(() => {}) }, [])
  useEffect(() => { loadMessages(activeChatId).catch(() => {}) }, [activeChatId])

  async function createChat() {
    const chat = await apiFetch('/assistant/chats', { method: 'POST', body: JSON.stringify({ title: 'New Chat' }) })
    setChats((prev) => [chat, ...prev])
    setActiveChatId(chat.id)
    setMessages([])
  }

  async function deleteChat(chatId) {
    await apiFetch(`/assistant/chats/${chatId}`, { method: 'DELETE' })
    const next = chats.filter((chat) => chat.id !== chatId)
    setChats(next)
    setActiveChatId(next[0]?.id || '')
  }

  async function sendMessage(e) {
    e.preventDefault()
    if (!input.trim() || loading) return
    setError('')
    let chatId = activeChatId
    if (!chatId) {
      const chat = await apiFetch('/assistant/chats', { method: 'POST', body: JSON.stringify({ title: 'New Chat' }) })
      setChats((prev) => [chat, ...prev])
      chatId = chat.id
      setActiveChatId(chatId)
    }
    setLoading(true)
    const content = input.trim()
    setInput('')
    try {
      if (agentMode) {
        const run = await apiFetch('/agent/run', { method: 'POST', body: JSON.stringify({ request_text: content }) })
        const plannedSteps = Array.isArray(run?.plan_steps) ? run.plan_steps : []
        const agentReply = {
          id: `agent-${Date.now()}`,
          role: 'assistant',
          content: [
            `Detected intent: ${run?.intent || 'unknown'} (${Math.round((run?.confidence || 0) * 100)}%)`,
            plannedSteps.length > 0
              ? `Planned steps:\n- ${plannedSteps.map((s) => `${s.agent}.${s.action}`).join('\n- ')}`
              : 'Planned steps: none',
            run?.summary || 'No summary.',
            Array.isArray(run?.tool_results) && run.tool_results.length > 0
              ? `\n\nTool results:\n- ${run.tool_results.map((r) => `${r.action}: ${r.message}`).join('\n- ')}`
              : '',
            Array.isArray(run?.errors) && run.errors.length > 0
              ? `\n\nErrors:\n- ${run.errors.join('\n- ')}`
              : '',
          ].join(''),
          createdAt: new Date().toISOString(),
        }

        // Save user+assistant in chat history for continuity
        const data = await apiFetch(`/assistant/chats/${chatId}/respond`, {
          method: 'POST',
          body: JSON.stringify({ content, skipAutoActions: true }),
        })
        setMessages((prev) => [...prev, data.userMessage, agentReply])
        setChats((prev) => prev.map((chat) => (
          chat.id === chatId
            ? { ...chat, title: data.chat?.title || chat.title, updatedAt: data.chat?.updatedAt || chat.updatedAt, lastMessagePreview: agentReply.content.slice(0, 80) }
            : chat
        )).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')))

        const events = Array.isArray(run?.ui_events) ? run.ui_events : []
        if (events.length > 0) {
          window.dispatchEvent(new CustomEvent('studypilot:agent-ui-events', { detail: { events } }))
          if (events.includes('NAVIGATE_SCHEDULE_IMPORT')) {
            window.location.hash = '#/schedule-import'
          }
        }
      } else {
        const data = await apiFetch(`/assistant/chats/${chatId}/respond`, { method: 'POST', body: JSON.stringify({ content }) })
        setMessages((prev) => [...prev, data.userMessage, data.assistantMessage])
        setChats((prev) => prev.map((chat) => (chat.id === chatId ? { ...chat, title: data.chat?.title || chat.title, updatedAt: data.chat?.updatedAt || chat.updatedAt } : chat))
          .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')))
      }
    } catch (err) {
      setError(err?.message || 'Failed to send message.')
    } finally {
      setLoading(false)
    }
  }

  const starterPrompts = [
    'Plan my study session for today',
    'Prioritize my deadlines this week',
    'Break down my hardest task into steps',
    'Add task "Revise chapter 5" by 2026-05-20 priority high',
    'Complete task "Revise chapter 5"',
    'Reschedule task "Prepare slides" to 2026-05-22',
    'Set priority for task "Physics lab report" to high',
    'Tambah tugas "Ulang kaji Bab 5" pada 2026-05-20 keutamaan tinggi',
    'Siap tugas "Ulang kaji Bab 5"',
    'Jadual semula tugas "Sediakan slaid" ke 2026-05-22',
    'Tetapkan keutamaan untuk tugas "Laporan makmal fizik" kepada tinggi',
    'Cipta acara kalendar "Ulang kaji Matematik" pada 2026-05-20 jam 8 pm',
  ]

  async function useStarterPrompt(prompt) {
    if (loading) return
    setInput(prompt)
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Nexa Assistant</h2>
        <p className="text-sm text-gray-500">Your calm study copilot with memory-aware planning.</p>
        <div className="mt-2">
          <button
            type="button"
            className={`rounded-full border px-3 py-1 text-xs ${agentMode ? 'bg-indigo-600 text-white border-indigo-600' : 'text-gray-700'}`}
            onClick={() => setAgentMode((v) => !v)}
          >
            {agentMode ? 'Agent Mode: ON' : 'Agent Mode: OFF'}
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <Card className="p-3 lg:col-span-1 rounded-xl">
          <button className="w-full rounded-lg border px-3 py-2 mb-3 inline-flex items-center justify-center gap-2 hover:bg-gray-50" onClick={createChat}>
            <MessageSquarePlus className="h-4 w-4" />
            New Chat
          </button>
          <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
            {chats.map((chat) => (
              <div key={chat.id} className={`rounded-lg border p-2 transition ${chat.id === activeChatId ? 'border-indigo-400 bg-indigo-50/70' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                <button className="w-full text-left space-y-1" onClick={() => setActiveChatId(chat.id)}>
                  <p className="font-medium text-sm truncate">{chat.title}</p>
                  <p className="text-xs text-gray-500 line-clamp-2">{chat.lastMessagePreview || 'No messages yet'}</p>
                </button>
                {chat.id === activeChatId && (
                  <button className="mt-2 text-xs rounded border px-2 py-1 text-red-700 inline-flex items-center gap-1 hover:bg-red-50" onClick={() => deleteChat(chat.id)}>
                    <Trash2 className="h-3 w-3" />
                    Delete
                  </button>
                )}
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-0 overflow-hidden lg:col-span-3 rounded-xl">
          <div className="h-[560px] overflow-y-auto p-5 space-y-4 bg-gradient-soft">
            {!activeChat && (
              <div className="h-full flex flex-col items-center justify-center text-center gap-4">
                <div className="h-12 w-12 rounded-full bg-gradient-primary text-white grid place-items-center shadow-elevated">
                  <Bot className="h-6 w-6" />
                </div>
                <div>
                  <p className="font-semibold text-lg">Where should we begin?</p>
                  <p className="text-sm text-gray-500">I am Nexa. I can plan your study day, prioritize deadlines, and break big tasks into easy steps.</p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {starterPrompts.map((prompt) => (
                    <button
                      key={prompt}
                      className="rounded-full border px-3 py-1.5 text-xs hover:bg-white"
                      onClick={() => useStarterPrompt(prompt)}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === 'assistant' ? 'justify-start' : 'justify-end'}`}>
                <div className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                  msg.role === 'assistant'
                    ? 'bg-white border border-gray-200 text-gray-800'
                    : 'text-white bg-gradient-primary'
                }`}>
                  <div className="mb-1 flex items-center gap-1.5 text-[11px] opacity-80">
                    {msg.role === 'assistant' ? <Bot className="h-3.5 w-3.5" /> : <User2 className="h-3.5 w-3.5" />}
                    <span>{msg.role === 'assistant' ? 'Nexa' : 'You'}</span>
                  </div>
                  <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                </div>
              </div>
            ))}
            {loading && <p className="text-sm text-gray-500">Thinking...</p>}
          </div>
          <form onSubmit={sendMessage} className="border-t bg-white p-3">
            {error && <p className="mb-2 text-xs text-red-600">{error}</p>}
            <div className="flex gap-2">
              <input
                className="flex-1 rounded-xl border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask Nexa for a study plan..."
              />
              <button className="btn-primary bg-gradient-primary inline-flex items-center gap-2 disabled:opacity-60" type="submit" disabled={loading || !input.trim()}>
                <Send className="h-4 w-4" />
                Send
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {starterPrompts.map((prompt) => (
                <button
                  type="button"
                  key={prompt}
                  className="rounded-full border px-3 py-1 text-xs text-gray-600 hover:bg-gray-50"
                  onClick={() => useStarterPrompt(prompt)}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </form>
        </Card>
      </div>
    </div>
  )
}
