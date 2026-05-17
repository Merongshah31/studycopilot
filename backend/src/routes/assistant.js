const express = require('express')
const { v4: uuidv4 } = require('uuid')
const db = require('../db')
const authMiddleware = require('../middleware/auth')
const { readExtraStore, writeExtraStore } = require('../extraStore')

const router = express.Router()
router.use(authMiddleware)

function nowIso() {
  return new Date().toISOString()
}

function ownedChat(store, userId, chatId) {
  return store.chats.find((chat) => chat.userId === userId && chat.id === chatId)
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
  const tasks = db.prepare('SELECT * FROM tasks WHERE userId = ? ORDER BY createdAt DESC').all(req.user.id)
  const active = tasks.filter((task) => !task.completed)
  const high = active.filter((task) => task.priority === 'high')
  const suggestions = []
  if (high.length > 0) suggestions.push(`Start with ${high[0].title} this morning.`)
  if (active.length > 0) suggestions.push(`Try 2 Pomodoro sessions to clear ${Math.min(active.length, 2)} tasks.`)
  if (suggestions.length === 0) suggestions.push('Great pace today. Add a fresh task and keep momentum.')
  res.json({ suggestions })
})

router.get('/chats', (req, res) => {
  const store = readExtraStore()
  const chats = store.chats
    .filter((chat) => chat.userId === req.user.id)
    .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
    .map((chat) => {
      const last = store.chatMessages.filter((m) => m.chatId === chat.id).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))[0]
      return { ...chat, lastMessagePreview: last ? String(last.content || '').slice(0, 80) : '' }
    })
  res.json(chats)
})

router.post('/chats', (req, res) => {
  const store = readExtraStore()
  const now = nowIso()
  const chat = { id: uuidv4(), userId: req.user.id, title: req.body?.title?.trim() || 'New Chat', createdAt: now, updatedAt: now }
  store.chats.push(chat)
  writeExtraStore(store)
  res.status(201).json(chat)
})

router.get('/chats/:chatId/messages', (req, res) => {
  const store = readExtraStore()
  const chat = ownedChat(store, req.user.id, req.params.chatId)
  if (!chat) return res.status(404).json({ message: 'Chat not found' })
  const messages = store.chatMessages.filter((m) => m.chatId === chat.id).sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''))
  res.json({ chat, messages })
})

router.patch('/chats/:chatId', (req, res) => {
  const store = readExtraStore()
  const chat = ownedChat(store, req.user.id, req.params.chatId)
  if (!chat) return res.status(404).json({ message: 'Chat not found' })
  chat.title = (req.body?.title || chat.title).trim() || 'New Chat'
  chat.updatedAt = nowIso()
  writeExtraStore(store)
  res.json(chat)
})

router.delete('/chats/:chatId', (req, res) => {
  const store = readExtraStore()
  const chat = ownedChat(store, req.user.id, req.params.chatId)
  if (!chat) return res.status(404).json({ message: 'Chat not found' })
  store.chats = store.chats.filter((c) => c.id !== chat.id)
  store.chatMessages = store.chatMessages.filter((m) => m.chatId !== chat.id)
  writeExtraStore(store)
  res.status(204).end()
})

router.post('/chats/:chatId/respond', async (req, res) => {
  const content = String(req.body?.content || '').trim()
  if (!content) return res.status(400).json({ message: 'content required' })
  const store = readExtraStore()
  const chat = ownedChat(store, req.user.id, req.params.chatId)
  if (!chat) return res.status(404).json({ message: 'Chat not found' })

  const userMessage = { id: uuidv4(), chatId: chat.id, role: 'user', content, createdAt: nowIso() }
  store.chatMessages.push(userMessage)

  const history = store.chatMessages
    .filter((m) => m.chatId === chat.id)
    .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''))
    .map((m) => ({ role: m.role, content: m.content }))

  const answer = await aiReply(history)
  const assistantMessage = { id: uuidv4(), chatId: chat.id, role: 'assistant', content: answer, createdAt: nowIso() }
  store.chatMessages.push(assistantMessage)
  chat.updatedAt = assistantMessage.createdAt
  if (chat.title === 'New Chat') chat.title = content.slice(0, 40) || 'New Chat'
  writeExtraStore(store)
  res.status(201).json({ userMessage, assistantMessage, chat })
})

module.exports = router

