import React, { useEffect, useMemo, useState } from 'react'
import Card from '../components/Card'
import { apiFetch } from '../lib/api'

export default function Assistant() {
  const [chats, setChats] = useState([])
  const [activeChatId, setActiveChatId] = useState('')
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

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
      const data = await apiFetch(`/assistant/chats/${chatId}/respond`, { method: 'POST', body: JSON.stringify({ content }) })
      setMessages((prev) => [...prev, data.userMessage, data.assistantMessage])
      setChats((prev) => prev.map((chat) => (chat.id === chatId ? { ...chat, title: data.chat?.title || chat.title, updatedAt: data.chat?.updatedAt || chat.updatedAt } : chat))
        .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">AI Assistant</h2>
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <Card className="p-3 lg:col-span-1">
          <button className="w-full rounded-lg border px-3 py-2 mb-3" onClick={createChat}>+ New Chat</button>
          <div className="space-y-2 max-h-[520px] overflow-y-auto">
            {chats.map((chat) => (
              <div key={chat.id} className={`rounded-lg border p-2 ${chat.id === activeChatId ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200'}`}>
                <button className="w-full text-left" onClick={() => setActiveChatId(chat.id)}>
                  <p className="font-medium text-sm">{chat.title}</p>
                  <p className="text-xs text-gray-500">{chat.lastMessagePreview || 'No messages'}</p>
                </button>
                {chat.id === activeChatId && <button className="mt-2 text-xs rounded border px-2 py-1 text-red-700" onClick={() => deleteChat(chat.id)}>Delete</button>}
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-0 overflow-hidden lg:col-span-3">
          <div className="h-[520px] overflow-y-auto p-4 space-y-3 bg-white">
            {!activeChat && <p className="text-sm text-gray-500">Create a chat to start.</p>}
            {messages.map((msg) => (
              <div key={msg.id} className={msg.role === 'assistant' ? 'mr-10' : 'ml-10'}>
                <div className={`rounded-xl px-3 py-2 text-sm ${msg.role === 'assistant' ? 'bg-gray-100' : 'bg-indigo-600 text-white'}`}>{msg.content}</div>
              </div>
            ))}
            {loading && <p className="text-sm text-gray-500">Thinking...</p>}
          </div>
          <form onSubmit={sendMessage} className="border-t p-3 flex gap-2">
            <input className="flex-1 rounded-lg border px-3 py-2" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask for a study plan..." />
            <button className="btn-primary bg-gradient-primary" type="submit" disabled={loading}>Send</button>
          </form>
        </Card>
      </div>
    </div>
  )
}

