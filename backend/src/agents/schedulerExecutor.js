const { v4: uuidv4 } = require('uuid')
const { createEvent } = require('../googleCalendar')

const SCHEDULER_UI_EVENTS = ['PLANNER_UPDATED', 'DASHBOARD_UPDATED', 'ANALYTICS_UPDATED']
const CALENDAR_UI_EVENTS = ['CALENDAR_UPDATED', 'DASHBOARD_UPDATED']

function extractDate(text) {
  const m = String(text || '').match(/\b(20\d{2}-\d{2}-\d{2})\b/)
  return m?.[1] || new Date().toISOString().slice(0, 10)
}

function extractPriority(text) {
  const t = String(text || '').toLowerCase()
  if (/(high|urgent|tinggi)/.test(t)) return 'high'
  if (/(medium|sederhana)/.test(t)) return 'medium'
  return 'low'
}

function extractSubject(text) {
  const raw = String(text || '').trim()
  const q = raw.match(/["â€œâ€](.+?)["â€œâ€]/)
  if (q?.[1]) return q[1].trim()
  const m = raw.match(/(?:for|tentang|untuk)\s+([a-zA-Z0-9 _-]{3,60})/i)
  return (m?.[1] || 'your subject').trim()
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

function parseEventTitle(text) {
  const raw = String(text || '')
  const q = raw.match(/["â€œâ€](.+?)["â€œâ€]/)
  if (q?.[1]) return q[1].trim()
  const m = raw.match(/(?:(?:create|add)\s+(?:calendar\s+)?event|(?:cipta|tambah)\s+(?:acara\s+)?kalendar)\s+(.+?)(?:\s+(?:at|jam)\s+\d{1,2}(:\d{2})?\s*(am|pm)?|\s+(?:on|pada)\s+20\d{2}-\d{2}-\d{2}|$)/i)
  return (m?.[1] || 'Study session').trim()
}

async function getCalendarTokens(supabase, userId) {
  const { data, error } = await supabase.from('google_calendar_tokens').select('*').eq('user_id', userId).maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

async function generateExamPlanTasks(supabase, userId, rawText) {
  const subject = extractSubject(rawText)
  const dateIso = extractDate(rawText)
  const priority = extractPriority(rawText)
  const now = new Date().toISOString()
  const titles = [
    `Revise key concepts for ${subject}`,
    `Practice past questions for ${subject}`,
    `Summarize weak topics for ${subject}`,
  ]
  const rows = titles.map((title, idx) => ({
    id: uuidv4(),
    user_id: userId,
    title,
    deadline: dateIso,
    priority: idx === 0 ? 'high' : priority,
    completed: false,
    created_at: now,
  }))
  const { error } = await supabase.from('tasks').insert(rows)
  if (error) throw new Error(error.message)
  return {
    status: 'ok',
    action: 'generate_exam_plan',
    changed_count: rows.length,
    changed: rows.map((r) => ({ id: r.id, title: r.title, deadline: r.deadline, priority: r.priority, completed: false })),
    ui_events: SCHEDULER_UI_EVENTS,
    message: `Generated exam plan tasks for ${subject}.`,
  }
}

async function optimizeSchedule(supabase, userId) {
  const { data, error } = await supabase.from('tasks').select('id,title,priority,deadline,completed').eq('user_id', userId).eq('completed', false).order('created_at', { ascending: false }).limit(12)
  if (error) throw new Error(error.message)
  const list = data || []
  const top = list.slice(0, 3).map((t) => t.title)
  return {
    status: 'ok',
    action: 'optimize_schedule',
    changed_count: 0,
    changed: [],
    ui_events: SCHEDULER_UI_EVENTS,
    message: top.length > 0 ? `Suggested schedule focus: ${top.join(', ')}` : 'No open tasks yet to optimize schedule.',
  }
}

async function createCalendarEvent(supabase, userId, rawText) {
  const tokens = await getCalendarTokens(supabase, userId)
  if (!tokens?.access_token && !tokens?.refresh_token) {
    return {
      status: 'partial',
      action: 'create_event',
      changed_count: 0,
      changed: [],
      ui_events: [],
      message: 'Google Calendar is not connected yet.',
    }
  }
  const dateIso = extractDate(rawText)
  const time = parseTimeFromText(rawText)
  const title = parseEventTitle(rawText)
  const dateTime = buildEventDateTime(dateIso, time, 60)
  const event = await createEvent(tokens, {
    summary: title,
    start: { dateTime: dateTime.start },
    end: { dateTime: dateTime.end },
  })
  return {
    status: 'ok',
    action: 'create_event',
    changed_count: 1,
    changed: [{
      id: event?.id || '',
      title: event?.summary || title,
      start: event?.start?.dateTime || dateTime.start,
      end: event?.end?.dateTime || dateTime.end,
    }],
    ui_events: CALENDAR_UI_EVENTS,
    message: `Created Google Calendar event: ${event?.summary || title}`,
  }
}

async function executeSchedulerStep({ supabase, userId, step }) {
  const action = step?.action
  const rawText = step?.payload?.raw_text || ''
  if (action === 'generate_exam_plan') return generateExamPlanTasks(supabase, userId, rawText)
  if (action === 'optimize_schedule') return optimizeSchedule(supabase, userId)
  if (action === 'create_event') return createCalendarEvent(supabase, userId, rawText)
  return {
    status: 'partial',
    action: action || 'unknown',
    changed_count: 0,
    changed: [],
    ui_events: [],
    message: `Unsupported scheduler action: ${action || 'unknown'}`,
  }
}

module.exports = {
  executeSchedulerStep,
}
