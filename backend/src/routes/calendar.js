const express = require('express')
const jwt = require('jsonwebtoken')
const authMiddleware = require('../middleware/auth')
const { getSupabaseServerClient } = require('../supabase')
const { buildOAuthUrl, exchangeCode, listEvents, createEvent } = require('../googleCalendar')

const router = express.Router()

function getFrontendUrl() {
  return process.env.FRONTEND_URL || 'http://localhost:5173'
}

function normalizeEvent(event) {
  return {
    id: event.id,
    source: 'google',
    title: event.summary || 'Untitled event',
    start: event.start?.dateTime || event.start?.date || null,
    end: event.end?.dateTime || event.end?.date || null,
    allDay: Boolean(event.start?.date && !event.start?.dateTime),
    location: event.location || '',
  }
}

async function generateDaySummary(items, dateLabel) {
  const url = process.env.DEEPSEEK_API_URL
  const key = process.env.DEEPSEEK_API_KEY
  const model = process.env.DEEPSEEK_MODEL || 'deepseek-chat'
  if (!url || !key) return 'AI summary is unavailable because DeepSeek is not configured yet.'

  const normalized = (Array.isArray(items) ? items : []).map((item) => ({
    title: item?.title || 'Untitled',
    source: item?.source || 'task',
    allDay: !!item?.allDay,
    start: item?.start || '',
    end: item?.end || '',
    location: item?.location || '',
    priority: item?.priority || '',
    completed: !!item?.completed,
  }))

  const messages = [
    {
      role: 'system',
      content: 'You are a helpful student assistant. Write a concise day plan summary in 3-5 lines. Mention birthdays or special events if present, and suggest what to focus on first.',
    },
    {
      role: 'user',
      content: `Date: ${dateLabel}\nItems JSON:\n${JSON.stringify(normalized, null, 2)}`,
    },
  ]

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, messages }),
  })
  const raw = await response.text()
  let data = {}
  try {
    data = raw ? JSON.parse(raw) : {}
  } catch {
    data = {}
  }
  if (!response.ok || data?.error) {
    const providerMessage = data?.error?.message || raw || `Provider request failed (${response.status})`
    throw new Error(providerMessage)
  }
  const text = data?.choices?.[0]?.message?.content
  if (typeof text === 'string' && text.trim()) return text.trim()
  return 'No summary generated for this day.'
}

async function getStoredTokens(userId) {
  const supabase = getSupabaseServerClient()
  if (!supabase) throw new Error('Supabase is not configured on backend')
  const { data, error } = await supabase
    .from('google_calendar_tokens')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return data
}

router.get('/callback', async (req, res) => {
  const { code, state } = req.query
  if (!code || !state) return res.status(400).send('Missing Google authorization response')

  let payload
  try {
    payload = jwt.verify(state, process.env.JWT_SECRET || 'dev_secret')
  } catch {
    return res.status(400).send('Invalid calendar authorization state')
  }

  try {
    const tokens = await exchangeCode(code)
    const supabase = getSupabaseServerClient()
    if (!supabase) return res.status(500).send('Supabase is not configured on backend')

    const existing = await getStoredTokens(payload.id)
    const row = {
      user_id: payload.id,
      access_token: tokens.access_token || existing?.access_token || null,
      refresh_token: tokens.refresh_token || existing?.refresh_token || null,
      scope: tokens.scope || existing?.scope || null,
      token_type: tokens.token_type || existing?.token_type || null,
      expiry_date: tokens.expiry_date || existing?.expiry_date || null,
      updated_at: new Date().toISOString(),
    }
    const { error } = await supabase.from('google_calendar_tokens').upsert(row)
    if (error) throw error
    return res.redirect(`${getFrontendUrl()}/#/calendar?google=connected`)
  } catch (error) {
    return res.redirect(`${getFrontendUrl()}/#/calendar?google=error`)
  }
})

router.use(authMiddleware)

router.get('/status', async (req, res) => {
  try {
    const tokens = await getStoredTokens(req.user.id)
    res.json({ connected: Boolean(tokens?.refresh_token || tokens?.access_token) })
  } catch (error) {
    res.status(500).json({ message: `Failed to load Google Calendar status: ${error.message}` })
  }
})

router.get('/auth-url', (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.status(500).json({ message: 'Google Calendar is not configured on backend' })
  }
  const state = jwt.sign({ id: req.user.id }, process.env.JWT_SECRET || 'dev_secret', { expiresIn: '10m' })
  res.json({ url: buildOAuthUrl(state) })
})

router.get('/events', async (req, res) => {
  try {
    const tokens = await getStoredTokens(req.user.id)
    if (!tokens) return res.status(409).json({ message: 'Google Calendar is not connected' })

    const now = new Date()
    const from = req.query.from ? new Date(req.query.from) : new Date(now.getFullYear(), now.getMonth(), 1)
    const to = req.query.to ? new Date(req.query.to) : new Date(now.getFullYear(), now.getMonth() + 1, 1)
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return res.status(400).json({ message: 'Invalid date range' })
    }

    const events = await listEvents(tokens, from.toISOString(), to.toISOString())
    res.json(events.map(normalizeEvent))
  } catch (error) {
    res.status(500).json({ message: `Failed to load Google Calendar events: ${error.message}` })
  }
})

router.post('/events', async (req, res) => {
  try {
    const tokens = await getStoredTokens(req.user.id)
    if (!tokens) return res.status(409).json({ message: 'Google Calendar is not connected' })
    const title = String(req.body?.title || '').trim()
    const start = String(req.body?.start || '').trim()
    const end = String(req.body?.end || '').trim()
    const location = String(req.body?.location || '').trim()
    const description = String(req.body?.description || '').trim()
    if (!title || !start || !end) {
      return res.status(400).json({ message: 'title, start, and end are required' })
    }
    const event = await createEvent(tokens, {
      summary: title,
      description: description || undefined,
      location: location || undefined,
      start: { dateTime: start },
      end: { dateTime: end },
    })
    res.status(201).json(normalizeEvent(event))
  } catch (error) {
    res.status(500).json({ message: `Failed to create Google Calendar event: ${error.message}` })
  }
})

router.post('/day-summary', async (req, res) => {
  try {
    const items = Array.isArray(req.body?.items) ? req.body.items : []
    const dateLabel = String(req.body?.dateLabel || '').trim() || new Date().toDateString()
    const summary = await generateDaySummary(items, dateLabel)
    res.json({ summary })
  } catch (error) {
    res.status(500).json({ message: `Failed to generate day summary: ${error.message}` })
  }
})

module.exports = router
