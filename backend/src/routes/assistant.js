const express = require('express')
const { v4: uuidv4 } = require('uuid')
const authMiddleware = require('../middleware/auth')
const { getSupabaseServerClient } = require('../supabase')

const router = express.Router()
router.use(authMiddleware)

function nowIso() {
  return new Date().toISOString()
}

function extractText(data) {
  const text = data?.choices?.[0]?.message?.content
  if (typeof text === 'string' && text.trim()) return text
  if (Array.isArray(data?.content)) {
    const joined = data.content.filter((x) => x?.type === 'text').map((x) => x.text || '').join('\n').trim()
    if (joined) return joined
  }
  if (typeof data?.output_text === 'string' && data.output_text.trim()) return data.output_text
  return ''
}

async function aiReply(messages) {
  const url = process.env.DEEPSEEK_API_URL
  const key = process.env.DEEPSEEK_API_KEY
  if (!url || !key) return 'AI provider is not configured yet.'
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: process.env.DEEPSEEK_MODEL || 'deepseek-chat', messages }),
    })
    const raw = await res.text()
    let data = {}
    try { data = raw ? JSON.parse(raw) : {} } catch {}
    if (!res.ok || data?.error) return `AI provider is currently unavailable: ${data?.error?.message || raw || `Provider request failed (${res.status})`}.`
    return extractText(data) || 'I could not generate a response right now.'
  } catch (error) {
    return `AI request failed: ${error.message}`
  }
}

router.get('/suggestions', (req, res) => {
  ;(async () => {
    const supabase = getSupabaseServerClient()
    if (!supabase) return res.status(500).json({ message: 'Supabase is not configured on backend' })
    const { data: tasks, error } = await supabase.from('tasks').select('*').eq('user_id', req.user.id).order('created_at', { ascending: false })
    if (error) return res.status(500).json({ message: `Failed to load suggestions: ${error.message}` })
    const active = (tasks || []).filter((task) => !task.completed)
    const high = active.filter((task) => task.priority === 'high')
    const suggestions = []
    if (high.length > 0) suggestions.push(`Start with ${high[0].title} this morning.`)
    if (active.length > 0) suggestions.push(`Try 2 Pomodoro sessions to clear ${Math.min(active.length, 2)} tasks.`)
    if (suggestions.length === 0) suggestions.push('Great pace today. Add a fresh task and keep momentum.')
    res.json({ suggestions })
  })().catch((error) => res.status(500).json({ message: `Failed to load suggestions: ${error.message}` }))
})

router.get('/chats', async (req, res) => {
  const supabase = getSupabaseServerClient()
  if (!supabase) return res.status(500).json({ message: 'Supabase is not configured on backend' })
  const { data: chats, error } = await supabase
    .from('assistant_chats')
    .select('*')
    .eq('user_id', req.user.id)
    .order('updated_at', { ascending: false })
  if (error) return res.status(500).json({ message: `Failed to load chats: ${error.message}` })
  const chatIds = (chats || []).map((c) => c.id)
  let byChatId = {}
  if (chatIds.length > 0) {
    const { data: messages, error: msgError } = await supabase
      .from('assistant_messages')
      .select('*')
      .in('chat_id', chatIds)
      .order('created_at', { ascending: false })
    if (msgError) return res.status(500).json({ message: `Failed to load chat previews: ${msgError.message}` })
    byChatId = (messages || []).reduce((acc, m) => {
      if (!acc[m.chat_id]) acc[m.chat_id] = m
      return acc
    }, {})
  }
  res.json((chats || []).map((chat) => ({
    id: chat.id,
    userId: chat.user_id,
    title: chat.title,
    createdAt: chat.created_at,
    updatedAt: chat.updated_at,
    lastMessagePreview: byChatId[chat.id] ? String(byChatId[chat.id].content || '').slice(0, 80) : '',
  })))
})

router.post('/chats', async (req, res) => {
  const supabase = getSupabaseServerClient()
  if (!supabase) return res.status(500).json({ message: 'Supabase is not configured on backend' })
  const now = nowIso()
  const chat = { id: uuidv4(), user_id: req.user.id, title: req.body?.title?.trim() || 'New Chat', created_at: now, updated_at: now }
  const { error } = await supabase.from('assistant_chats').insert(chat)
  if (error) return res.status(500).json({ message: `Failed to create chat: ${error.message}` })
  res.status(201).json({ id: chat.id, userId: chat.user_id, title: chat.title, createdAt: chat.created_at, updatedAt: chat.updated_at })
})

router.get('/chats/:chatId/messages', async (req, res) => {
  const supabase = getSupabaseServerClient()
  if (!supabase) return res.status(500).json({ message: 'Supabase is not configured on backend' })
  const { data: chat, error: chatError } = await supabase.from('assistant_chats').select('*').eq('id', req.params.chatId).eq('user_id', req.user.id).maybeSingle()
  if (chatError) return res.status(500).json({ message: `Failed to load chat: ${chatError.message}` })
  if (!chat) return res.status(404).json({ message: 'Chat not found' })
  const { data: messages, error } = await supabase.from('assistant_messages').select('*').eq('chat_id', chat.id).order('created_at', { ascending: true })
  if (error) return res.status(500).json({ message: `Failed to load messages: ${error.message}` })
  res.json({
    chat: { id: chat.id, userId: chat.user_id, title: chat.title, createdAt: chat.created_at, updatedAt: chat.updated_at },
    messages: (messages || []).map((m) => ({ id: m.id, chatId: m.chat_id, role: m.role, content: m.content, createdAt: m.created_at })),
  })
})

router.patch('/chats/:chatId', async (req, res) => {
  const supabase = getSupabaseServerClient()
  if (!supabase) return res.status(500).json({ message: 'Supabase is not configured on backend' })
  const { data: chat, error: chatError } = await supabase.from('assistant_chats').select('*').eq('id', req.params.chatId).eq('user_id', req.user.id).maybeSingle()
  if (chatError) return res.status(500).json({ message: `Failed to load chat: ${chatError.message}` })
  if (!chat) return res.status(404).json({ message: 'Chat not found' })
  const title = (req.body?.title || chat.title).trim() || 'New Chat'
  const updatedAt = nowIso()
  const { error } = await supabase.from('assistant_chats').update({ title, updated_at: updatedAt }).eq('id', chat.id).eq('user_id', req.user.id)
  if (error) return res.status(500).json({ message: `Failed to update chat: ${error.message}` })
  res.json({ id: chat.id, userId: chat.user_id, title, createdAt: chat.created_at, updatedAt })
})

router.delete('/chats/:chatId', async (req, res) => {
  const supabase = getSupabaseServerClient()
  if (!supabase) return res.status(500).json({ message: 'Supabase is not configured on backend' })
  const { data: chat, error: chatError } = await supabase.from('assistant_chats').select('*').eq('id', req.params.chatId).eq('user_id', req.user.id).maybeSingle()
  if (chatError) return res.status(500).json({ message: `Failed to load chat: ${chatError.message}` })
  if (!chat) return res.status(404).json({ message: 'Chat not found' })
  const { error: delMessagesError } = await supabase.from('assistant_messages').delete().eq('chat_id', chat.id)
  if (delMessagesError) return res.status(500).json({ message: `Failed to delete messages: ${delMessagesError.message}` })
  const { error: delChatError } = await supabase.from('assistant_chats').delete().eq('id', chat.id).eq('user_id', req.user.id)
  if (delChatError) return res.status(500).json({ message: `Failed to delete chat: ${delChatError.message}` })
  res.status(204).end()
})

router.post('/chats/:chatId/respond', async (req, res) => {
  const supabase = getSupabaseServerClient()
  if (!supabase) return res.status(500).json({ message: 'Supabase is not configured on backend' })
  const content = String(req.body?.content || '').trim()
  if (!content) return res.status(400).json({ message: 'content required' })
  const { data: chat, error: chatError } = await supabase.from('assistant_chats').select('*').eq('id', req.params.chatId).eq('user_id', req.user.id).maybeSingle()
  if (chatError) return res.status(500).json({ message: `Failed to load chat: ${chatError.message}` })
  if (!chat) return res.status(404).json({ message: 'Chat not found' })

  const userMessage = { id: uuidv4(), chat_id: chat.id, role: 'user', content, created_at: nowIso() }
  const { error: userMsgError } = await supabase.from('assistant_messages').insert(userMessage)
  if (userMsgError) return res.status(500).json({ message: `Failed to save message: ${userMsgError.message}` })

  const { data: historyRows, error: historyError } = await supabase
    .from('assistant_messages')
    .select('*')
    .eq('chat_id', chat.id)
    .order('created_at', { ascending: true })
  if (historyError) return res.status(500).json({ message: `Failed to load chat history: ${historyError.message}` })
  const history = (historyRows || []).map((m) => ({ role: m.role, content: m.content }))

  const answer = await aiReply(history)
  const assistantMessage = { id: uuidv4(), chat_id: chat.id, role: 'assistant', content: answer, created_at: nowIso() }
  const { error: aiMsgError } = await supabase.from('assistant_messages').insert(assistantMessage)
  if (aiMsgError) return res.status(500).json({ message: `Failed to save assistant response: ${aiMsgError.message}` })
  const updatedTitle = chat.title === 'New Chat' ? (content.slice(0, 40) || 'New Chat') : chat.title
  const updatedAt = assistantMessage.created_at
  const { error: chatUpdateError } = await supabase
    .from('assistant_chats')
    .update({ title: updatedTitle, updated_at: updatedAt })
    .eq('id', chat.id)
    .eq('user_id', req.user.id)
  if (chatUpdateError) return res.status(500).json({ message: `Failed to update chat: ${chatUpdateError.message}` })
  res.status(201).json({
    userMessage: { id: userMessage.id, chatId: userMessage.chat_id, role: userMessage.role, content: userMessage.content, createdAt: userMessage.created_at },
    assistantMessage: { id: assistantMessage.id, chatId: assistantMessage.chat_id, role: assistantMessage.role, content: assistantMessage.content, createdAt: assistantMessage.created_at },
    chat: { id: chat.id, userId: chat.user_id, title: updatedTitle, createdAt: chat.created_at, updatedAt },
  })
})

module.exports = router
