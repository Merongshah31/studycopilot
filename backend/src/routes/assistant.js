const express = require('express')
const { v4: uuidv4 } = require('uuid')
const authMiddleware = require('../middleware/auth')
const { getSupabaseServerClient } = require('../supabase')
const { listEvents, createEvent } = require('../googleCalendar')
const {
  checkUserInputSafety,
  refusalMessage,
  fallbackStudySupport,
  postProcessAssistantText,
  buildSystemGuardrailAppendix,
} = require('../assistantGuardrails')

const router = express.Router()
router.use(authMiddleware)

function nowIso() {
  return new Date().toISOString()
}

const DEFAULT_MEMORY = {
  preferredName: '',
  relationshipStyle: 'supportive',
  communicationStyle: 'clear-actionable',
  studyPreferences: { bestStudyTime: '', focusMethod: 'pomodoro', difficultyHandling: 'step-by-step' },
  goals: { shortTerm: [], longTerm: [] },
  notes: [],
}

function cloneDefaultMemory() {
  return JSON.parse(JSON.stringify(DEFAULT_MEMORY))
}

function normalizeMemory(raw) {
  const base = cloneDefaultMemory()
  if (!raw || typeof raw !== 'object') return base
  return {
    ...base,
    ...raw,
    studyPreferences: { ...base.studyPreferences, ...(raw.studyPreferences || {}) },
    goals: {
      shortTerm: Array.isArray(raw?.goals?.shortTerm) ? raw.goals.shortTerm.slice(0, 8) : [],
      longTerm: Array.isArray(raw?.goals?.longTerm) ? raw.goals.longTerm.slice(0, 8) : [],
    },
    notes: Array.isArray(raw.notes) ? raw.notes.slice(0, 20) : [],
  }
}

async function getUserMemory(supabase, userId) {
  try {
    const { data, error } = await supabase.from('assistant_memories').select('*').eq('user_id', userId).maybeSingle()
    if (error) throw error
    return { memory: normalizeMemory(data?.memory_json), available: true }
  } catch {
    return { memory: cloneDefaultMemory(), available: false }
  }
}

async function saveUserMemory(supabase, userId, memory) {
  const payload = { user_id: userId, memory_json: normalizeMemory(memory), updated_at: nowIso() }
  try {
    await supabase.from('assistant_memories').upsert(payload)
    return true
  } catch {
    return false
  }
}

async function getStoredCalendarTokens(supabase, userId) {
  const { data } = await supabase.from('google_calendar_tokens').select('*').eq('user_id', userId).maybeSingle()
  return data || null
}

async function loadUserContext(supabase, userId) {
  const [{ data: user }, { data: tasks }, calendarTokens] = await Promise.all([
    supabase.from('users').select('id,name,email,course,subjects').eq('id', userId).maybeSingle(),
    supabase.from('tasks').select('id,title,priority,deadline,completed').eq('user_id', userId).order('created_at', { ascending: false }).limit(30),
    getStoredCalendarTokens(supabase, userId),
  ])
  const list = Array.isArray(tasks) ? tasks : []
  const open = list.filter((t) => !t.completed)
  let calendarPreview = []
  try {
    if (calendarTokens?.access_token || calendarTokens?.refresh_token) {
      const now = new Date()
      const in3Days = new Date(now)
      in3Days.setDate(now.getDate() + 3)
      const events = await listEvents(calendarTokens, now.toISOString(), in3Days.toISOString())
      calendarPreview = (events || []).slice(0, 5).map((e) => ({
        title: e.summary || 'Untitled event',
        start: e.start?.dateTime || e.start?.date || '',
        location: e.location || '',
      }))
    }
  } catch {
    calendarPreview = []
  }
  return {
    user: user || {},
    taskStats: {
      total: list.length,
      open: open.length,
      highPriorityOpen: open.filter((t) => t.priority === 'high').length,
      dueSoon: open.filter((t) => {
        if (!t.deadline) return false
        const days = Math.ceil((new Date(t.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        return days >= 0 && days <= 3
      }).length,
    },
    topOpenTasks: open.slice(0, 5).map((t) => ({ title: t.title, priority: t.priority, deadline: t.deadline })),
    calendarPreview,
    dashboardSnapshot: {
      productivitySignal: open.length === 0 ? 'clear' : open.length <= 3 ? 'steady' : 'busy',
      headline: open.length === 0 ? 'All caught up' : `${open.length} open tasks, ${open.filter((t) => t.priority === 'high').length} high priority`,
    },
  }
}

function buildNexaSystemMessage(memory, context) {
  const profileName = memory.preferredName || context?.user?.name || 'Student'
  return {
    role: 'system',
    content: [
      'You are Nexa, StudyPilot AI Student Life Copilot.',
      'Core identity: supportive, calm, actionable, and concise.',
      'Guardrails: never shame user, do not fabricate facts/deadlines, mention uncertainty when needed, ask at most one short clarifying question when context is missing.',
      'Response style: brief summary then practical next steps.',
      `Address user as: ${profileName}.`,
      `Memory profile: ${JSON.stringify(memory)}`,
      `Live context: ${JSON.stringify(context)}`,
      buildSystemGuardrailAppendix(),
    ].join('\n'),
  }
}

function updateMemoryFromUserText(memory, text) {
  const next = normalizeMemory(memory)
  const content = String(text || '').trim()
  if (!content) return next
  const lower = content.toLowerCase()
  const nameMatch = content.match(/call me\s+([a-zA-Z][a-zA-Z0-9_-]{1,30})/i)
  if (nameMatch) next.preferredName = nameMatch[1]
  if (lower.includes('morning')) next.studyPreferences.bestStudyTime = 'morning'
  if (lower.includes('afternoon')) next.studyPreferences.bestStudyTime = 'afternoon'
  if (lower.includes('night') || lower.includes('evening')) next.studyPreferences.bestStudyTime = 'night'
  if (lower.includes('pomodoro')) next.studyPreferences.focusMethod = 'pomodoro'
  if (lower.includes('deep work')) next.studyPreferences.focusMethod = 'deep-work'
  if (lower.includes('step by step') || lower.includes('step-by-step')) next.studyPreferences.difficultyHandling = 'step-by-step'
  if (lower.includes('quick answer')) next.studyPreferences.difficultyHandling = 'quick-answer'
  if ((lower.startsWith('my goal is') || lower.startsWith('goal:')) && next.goals.shortTerm.length < 8) next.goals.shortTerm.push(content.slice(0, 120))
  if ((lower.includes('i feel stressed') || lower.includes('deadline panic')) && next.notes.length < 20) next.notes.push('User reported stress around deadlines.')
  return next
}

function parseDateFromText(text) {
  const match = String(text || '').match(/\b(20\d{2}-\d{2}-\d{2})\b/)
  return match ? match[1] : null
}

function parsePriorityFromText(text) {
  const t = String(text || '').toLowerCase()
  if (t.includes('high priority') || t.includes('priority high') || t.includes('urgent') || t.includes('keutamaan tinggi')) return 'high'
  if (t.includes('medium priority') || t.includes('priority medium') || t.includes('keutamaan sederhana')) return 'medium'
  if (t.includes('low priority') || t.includes('priority low') || t.includes('keutamaan rendah')) return 'low'
  return null
}

function extractQuoted(text) {
  const raw = String(text || '')
  const quoted = raw.match(/["“”](.+?)["“”]/)
  return quoted?.[1]?.trim() || ''
}

function extractTaskTitleForAdd(text) {
  const quoted = extractQuoted(text)
  if (quoted) return quoted
  const m = String(text || '').match(/(?:add task|tambah tugas)\s+(.+?)(?:\s+(?:by|sebelum|pada)\s+20\d{2}-\d{2}-\d{2}|\s+(?:priority|keutamaan)\s+\w+|$)/i)
  return (m?.[1] || '').trim()
}

function extractTaskTitleForComplete(text) {
  const quoted = extractQuoted(text)
  if (quoted) return quoted
  const m = String(text || '').match(/(?:(?:complete|finish|done)\s+task|(?:siap|selesai|tamatkan)\s+tugas)\s+(.+)/i)
  return (m?.[1] || '').trim()
}

function extractTaskTitleForReschedule(text) {
  const quoted = extractQuoted(text)
  if (quoted) return quoted
  const m = String(text || '').match(/(?:(?:reschedule|move)\s+task|(?:jadual semula|pindah)\s+tugas)\s+(.+?)\s+(?:to|by|ke|pada)\s+20\d{2}-\d{2}-\d{2}/i)
  return (m?.[1] || '').trim()
}

function extractTaskTitleForPriority(text) {
  const quoted = extractQuoted(text)
  if (quoted) return quoted
  const m = String(text || '').match(/(?:(?:set|change)\s+priority\s+for\s+task|(?:tetapkan|tukar)\s+keutamaan\s+untuk\s+tugas)\s+(.+?)\s+(?:to|kepada)?\s*(?:high|medium|low|tinggi|sederhana|rendah)/i)
  return (m?.[1] || '').trim()
}

function parseEventTitle(text) {
  const quoted = extractQuoted(text)
  if (quoted) return quoted
  const m = String(text || '').match(/(?:(?:create|add)\s+(?:calendar\s+)?event|(?:cipta|tambah)\s+(?:acara\s+)?kalendar)\s+(.+?)(?:\s+(?:at|jam)\s+\d{1,2}(:\d{2})?\s*(am|pm)?|\s+(?:on|pada)\s+20\d{2}-\d{2}-\d{2}|$)/i)
  return (m?.[1] || '').trim()
}

function parseTimeFromText(text) {
  const m = String(text || '').match(/\b(?:at|jam)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i)
  if (!m) return { hour: 9, minute: 0 }
  let hour = parseInt(m[1], 10)
  const minute = parseInt(m[2] || '0', 10)
  const mer = (m[3] || '').toLowerCase()
  if (mer === 'pm' && hour < 12) hour += 12
  if (mer === 'am' && hour === 12) hour = 0
  return { hour, minute }
}

function buildEventDateTime(dateIso, timeObj, durationMin = 60) {
  const base = new Date(`${dateIso}T00:00:00`)
  base.setHours(timeObj.hour, timeObj.minute, 0, 0)
  const end = new Date(base.getTime() + durationMin * 60000)
  return { start: base.toISOString(), end: end.toISOString() }
}

async function applyTaskAdjustmentsFromMessage(supabase, userId, content) {
  const text = String(content || '').trim()
  const lower = text.toLowerCase()
  const actions = []
  if (!text) return actions

  if (/(^|\s)(add task|tambah tugas)\b/i.test(lower)) {
    const title = extractTaskTitleForAdd(text)
    if (title) {
      const row = { id: uuidv4(), user_id: userId, title, deadline: parseDateFromText(text), priority: parsePriorityFromText(text) || 'medium', completed: false, created_at: nowIso() }
      const { error } = await supabase.from('tasks').insert(row)
      if (!error) actions.push(`Created task: "${row.title}"`)
    }
  }

  if (/((complete|finish|done)\s+task|(siap|selesai|tamatkan)\s+tugas)\b/i.test(lower)) {
    const target = extractTaskTitleForComplete(text)
    if (target) {
      const { data: tasks } = await supabase.from('tasks').select('*').eq('user_id', userId).eq('completed', false).order('created_at', { ascending: false })
      const matched = (Array.isArray(tasks) ? tasks : []).find((t) => String(t.title || '').toLowerCase().includes(target.toLowerCase()))
      if (matched) {
        const { error } = await supabase.from('tasks').update({ completed: true }).eq('id', matched.id).eq('user_id', userId)
        if (!error) actions.push(`Marked complete: "${matched.title}"`)
      }
    }
  }

  if (/((reschedule|move)\s+task|(jadual semula|pindah)\s+tugas)\b/i.test(lower)) {
    const target = extractTaskTitleForReschedule(text)
    const newDate = parseDateFromText(text)
    if (target && newDate) {
      const { data: tasks } = await supabase.from('tasks').select('*').eq('user_id', userId).order('created_at', { ascending: false })
      const matched = (Array.isArray(tasks) ? tasks : []).find((t) => String(t.title || '').toLowerCase().includes(target.toLowerCase()))
      if (matched) {
        const { error } = await supabase.from('tasks').update({ deadline: newDate }).eq('id', matched.id).eq('user_id', userId)
        if (!error) actions.push(`Rescheduled "${matched.title}" to ${newDate}`)
      }
    }
  }

  if (/((set|change)\s+priority|(tetapkan|tukar)\s+keutamaan)\b/i.test(lower)) {
    const target = extractTaskTitleForPriority(text)
    const pr = parsePriorityFromText(text)
    if (target && pr) {
      const { data: tasks } = await supabase.from('tasks').select('*').eq('user_id', userId).order('created_at', { ascending: false })
      const matched = (Array.isArray(tasks) ? tasks : []).find((t) => String(t.title || '').toLowerCase().includes(target.toLowerCase()))
      if (matched) {
        const { error } = await supabase.from('tasks').update({ priority: pr }).eq('id', matched.id).eq('user_id', userId)
        if (!error) actions.push(`Set priority for "${matched.title}" to ${pr}`)
      }
    }
  }

  return actions
}

async function applyCalendarAdjustmentsFromMessage(supabase, userId, content) {
  const text = String(content || '').trim()
  const lower = text.toLowerCase()
  const actions = []
  if (!/((create|add)\s+(calendar\s+)?event|(cipta|tambah)\s+(acara\s+)?kalendar)\b/i.test(lower)) return actions
  const tokens = await getStoredCalendarTokens(supabase, userId)
  if (!tokens) {
    actions.push('Calendar event not created: Google Calendar is not connected.')
    return actions
  }
  const title = parseEventTitle(text)
  const dateIso = parseDateFromText(text) || new Date().toISOString().slice(0, 10)
  const time = parseTimeFromText(text)
  if (!title) {
    actions.push('Calendar event not created: missing event title.')
    return actions
  }
  try {
    const dateTime = buildEventDateTime(dateIso, time, 60)
    const event = await createEvent(tokens, { summary: title, start: { dateTime: dateTime.start }, end: { dateTime: dateTime.end } })
    actions.push(`Created Google event: "${event?.summary || title}" on ${dateIso}`)
  } catch (error) {
    actions.push(`Calendar event not created: ${error.message}`)
  }
  return actions
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

router.get('/suggestions', async (req, res) => {
  try {
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
  } catch (error) {
    res.status(500).json({ message: `Failed to load suggestions: ${error.message}` })
  }
})

router.get('/chats', async (req, res) => {
  const supabase = getSupabaseServerClient()
  if (!supabase) return res.status(500).json({ message: 'Supabase is not configured on backend' })
  const { data: chats, error } = await supabase.from('assistant_chats').select('*').eq('user_id', req.user.id).order('updated_at', { ascending: false })
  if (error) return res.status(500).json({ message: `Failed to load chats: ${error.message}` })
  const chatIds = (chats || []).map((c) => c.id)
  let byChatId = {}
  if (chatIds.length > 0) {
    const { data: messages, error: msgError } = await supabase.from('assistant_messages').select('*').in('chat_id', chatIds).order('created_at', { ascending: false })
    if (msgError) return res.status(500).json({ message: `Failed to load chat previews: ${msgError.message}` })
    byChatId = (messages || []).reduce((acc, m) => { if (!acc[m.chat_id]) acc[m.chat_id] = m; return acc }, {})
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
  const safety = checkUserInputSafety(content)
  const { data: chat, error: chatError } = await supabase.from('assistant_chats').select('*').eq('id', req.params.chatId).eq('user_id', req.user.id).maybeSingle()
  if (chatError) return res.status(500).json({ message: `Failed to load chat: ${chatError.message}` })
  if (!chat) return res.status(404).json({ message: 'Chat not found' })

  const userMessage = { id: uuidv4(), chat_id: chat.id, role: 'user', content, created_at: nowIso() }
  const { error: userMsgError } = await supabase.from('assistant_messages').insert(userMessage)
  if (userMsgError) return res.status(500).json({ message: `Failed to save message: ${userMsgError.message}` })

  const { data: historyRows, error: historyError } = await supabase.from('assistant_messages').select('*').eq('chat_id', chat.id).order('created_at', { ascending: true })
  if (historyError) return res.status(500).json({ message: `Failed to load chat history: ${historyError.message}` })
  const history = (historyRows || []).map((m) => ({ role: m.role, content: m.content }))

  const [{ memory, available: memoryAvailable }, context] = await Promise.all([
    getUserMemory(supabase, req.user.id),
    loadUserContext(supabase, req.user.id),
  ])
  const updatedMemory = updateMemoryFromUserText(memory, content)
  if (memoryAvailable) await saveUserMemory(supabase, req.user.id, updatedMemory)

  const taskActions = await applyTaskAdjustmentsFromMessage(supabase, req.user.id, content)
  const calendarActions = await applyCalendarAdjustmentsFromMessage(supabase, req.user.id, content)
  const allActions = [...taskActions, ...calendarActions]

  const modelInput = [
    buildNexaSystemMessage(updatedMemory, context),
    ...(allActions.length ? [{ role: 'system', content: `Actions already applied from user request: ${allActions.join('; ')}` }] : []),
    ...history,
  ]

  let answer = ''
  if (safety.action === 'block') {
    answer = `${refusalMessage()}\n\n${fallbackStudySupport(content)}`
  } else {
    answer = await aiReply(modelInput)
    answer = postProcessAssistantText(answer, { mode: safety.action === 'review' ? 'review' : 'allow' })
    if (allActions.length) answer = `${answer}\n\nApplied changes:\n- ${allActions.join('\n- ')}`
  }

  const assistantMessage = { id: uuidv4(), chat_id: chat.id, role: 'assistant', content: answer, created_at: nowIso() }
  const { error: aiMsgError } = await supabase.from('assistant_messages').insert(assistantMessage)
  if (aiMsgError) return res.status(500).json({ message: `Failed to save assistant response: ${aiMsgError.message}` })
  const updatedTitle = chat.title === 'New Chat' ? (content.slice(0, 40) || 'New Chat') : chat.title
  const updatedAt = assistantMessage.created_at
  const { error: chatUpdateError } = await supabase.from('assistant_chats').update({ title: updatedTitle, updated_at: updatedAt }).eq('id', chat.id).eq('user_id', req.user.id)
  if (chatUpdateError) return res.status(500).json({ message: `Failed to update chat: ${chatUpdateError.message}` })
  res.status(201).json({
    userMessage: { id: userMessage.id, chatId: userMessage.chat_id, role: userMessage.role, content: userMessage.content, createdAt: userMessage.created_at },
    assistantMessage: { id: assistantMessage.id, chatId: assistantMessage.chat_id, role: assistantMessage.role, content: assistantMessage.content, createdAt: assistantMessage.created_at },
    chat: { id: chat.id, userId: chat.user_id, title: updatedTitle, createdAt: chat.created_at, updatedAt },
  })
})

router.get('/memory', async (req, res) => {
  const supabase = getSupabaseServerClient()
  if (!supabase) return res.status(500).json({ message: 'Supabase is not configured on backend' })
  const { memory, available } = await getUserMemory(supabase, req.user.id)
  res.json({ memory, persisted: available })
})

router.patch('/memory', async (req, res) => {
  const supabase = getSupabaseServerClient()
  if (!supabase) return res.status(500).json({ message: 'Supabase is not configured on backend' })
  const { memory, available } = await getUserMemory(supabase, req.user.id)
  if (!available) return res.status(409).json({ message: 'assistant_memories table is not ready yet' })
  const merged = normalizeMemory({ ...memory, ...(req.body || {}) })
  await saveUserMemory(supabase, req.user.id, merged)
  res.json({ memory: merged, persisted: true })
})

module.exports = router

