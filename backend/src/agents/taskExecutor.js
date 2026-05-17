const { v4: uuidv4 } = require('uuid')

const TASK_UI_EVENTS = ['TASKS_UPDATED', 'PLANNER_UPDATED', 'ANALYTICS_UPDATED', 'DASHBOARD_UPDATED']

function taskView(row) {
  return {
    id: row.id,
    title: row.title || 'Untitled task',
    deadline: row.deadline || null,
    priority: row.priority || 'low',
    completed: !!row.completed,
  }
}

function normalizePriority(priority) {
  const p = String(priority || '').trim().toLowerCase()
  if (['high', 'medium', 'low'].includes(p)) return p
  return 'medium'
}

function startOfWeekMonday(date) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function addDays(date, amount) {
  const d = new Date(date)
  d.setDate(d.getDate() + amount)
  return d
}

function isoDate(date) {
  return date.toISOString().slice(0, 10)
}

async function findTaskByTitle(supabase, userId, title, { openOnly = false } = {}) {
  let query = supabase.from('tasks').select('*').eq('user_id', userId).order('created_at', { ascending: false })
  if (openOnly) query = query.eq('completed', false)
  const { data, error } = await query.limit(100)
  if (error) throw new Error(error.message)
  const needle = String(title || '').trim().toLowerCase()
  if (!needle) return null
  const list = data || []
  return list.find((t) => String(t.title || '').trim().toLowerCase() === needle)
    || list.find((t) => String(t.title || '').toLowerCase().includes(needle))
    || null
}

async function createTask(supabase, userId, payload) {
  const now = new Date().toISOString()
  const row = {
    id: uuidv4(),
    user_id: userId,
    title: String(payload?.title || '').trim() || 'Untitled task',
    deadline: payload?.deadline || null,
    priority: normalizePriority(payload?.priority),
    completed: false,
    created_at: now,
  }
  const { error } = await supabase.from('tasks').insert(row)
  if (error) throw new Error(error.message)
  return {
    status: 'ok',
    action: 'create_task',
    changed_count: 1,
    changed: [taskView(row)],
    ui_events: TASK_UI_EVENTS,
    message: `Created task: ${row.title}`,
  }
}

async function completeByTitle(supabase, userId, payload) {
  const matched = await findTaskByTitle(supabase, userId, payload?.title, { openOnly: true })
  if (!matched) {
    return {
      status: 'partial',
      action: 'complete_by_title',
      changed_count: 0,
      changed: [],
      ui_events: [],
      message: `Task not found: ${payload?.title || 'Untitled task'}`,
    }
  }
  const { data, error } = await supabase
    .from('tasks')
    .update({ completed: true })
    .eq('id', matched.id)
    .eq('user_id', userId)
    .select('*')
    .maybeSingle()
  if (error) throw new Error(error.message)
  return {
    status: 'ok',
    action: 'complete_by_title',
    changed_count: 1,
    changed: [taskView(data || { ...matched, completed: true })],
    ui_events: TASK_UI_EVENTS,
    message: `Marked complete: ${matched.title}`,
  }
}

async function rescheduleByTitle(supabase, userId, payload) {
  const matched = await findTaskByTitle(supabase, userId, payload?.title)
  if (!matched) {
    return {
      status: 'partial',
      action: 'reschedule_by_title',
      changed_count: 0,
      changed: [],
      ui_events: [],
      message: `Task not found: ${payload?.title || 'Untitled task'}`,
    }
  }
  const { data, error } = await supabase
    .from('tasks')
    .update({ deadline: payload?.deadline || null })
    .eq('id', matched.id)
    .eq('user_id', userId)
    .select('*')
    .maybeSingle()
  if (error) throw new Error(error.message)
  return {
    status: 'ok',
    action: 'reschedule_by_title',
    changed_count: 1,
    changed: [taskView(data || { ...matched, deadline: payload?.deadline || null })],
    ui_events: TASK_UI_EVENTS,
    message: `Rescheduled: ${matched.title}`,
  }
}

async function setPriorityByTitle(supabase, userId, payload) {
  const matched = await findTaskByTitle(supabase, userId, payload?.title)
  if (!matched) {
    return {
      status: 'partial',
      action: 'set_priority_by_title',
      changed_count: 0,
      changed: [],
      ui_events: [],
      message: `Task not found: ${payload?.title || 'Untitled task'}`,
    }
  }
  const priority = normalizePriority(payload?.priority)
  const { data, error } = await supabase
    .from('tasks')
    .update({ priority })
    .eq('id', matched.id)
    .eq('user_id', userId)
    .select('*')
    .maybeSingle()
  if (error) throw new Error(error.message)
  return {
    status: 'ok',
    action: 'set_priority_by_title',
    changed_count: 1,
    changed: [taskView(data || { ...matched, priority })],
    ui_events: TASK_UI_EVENTS,
    message: `Updated priority: ${matched.title} -> ${priority}`,
  }
}

async function executeTaskStep({ supabase, userId, step }) {
  const action = step?.action
  const payload = step?.payload || {}
  if (action === 'create_task') return createTask(supabase, userId, payload)
  if (action === 'complete_by_title') return completeByTitle(supabase, userId, payload)
  if (action === 'reschedule_by_title') return rescheduleByTitle(supabase, userId, payload)
  if (action === 'set_priority_by_title') return setPriorityByTitle(supabase, userId, payload)
  if (action === 'rebalance_weekly_schedule') return rebalanceWeeklySchedule(supabase, userId, payload)
  return {
    status: 'partial',
    action: action || 'unknown',
    changed_count: 0,
    changed: [],
    ui_events: [],
    message: `Unsupported task action: ${action || 'unknown'}`,
  }
}

async function rebalanceWeeklySchedule(supabase, userId, payload) {
  const now = new Date()
  const monday = startOfWeekMonday(now)
  const slots = Array.from({ length: 7 }, (_, idx) => isoDate(addDays(monday, idx)))
  const priorityWeight = { high: 3, medium: 2, low: 1 }

  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
    .eq('completed', false)
    .order('created_at', { ascending: true })
    .limit(200)
  if (error) throw new Error(error.message)

  const openTasks = Array.isArray(data) ? data : []
  if (openTasks.length === 0) {
    return {
      status: 'partial',
      action: 'rebalance_weekly_schedule',
      changed_count: 0,
      changed: [],
      ui_events: [],
      message: 'No open tasks available to rebalance this week.',
    }
  }

  openTasks.sort((a, b) => {
    const pa = priorityWeight[a.priority] || 1
    const pb = priorityWeight[b.priority] || 1
    if (pb !== pa) return pb - pa
    const da = a.deadline ? new Date(a.deadline).getTime() : Number.POSITIVE_INFINITY
    const db = b.deadline ? new Date(b.deadline).getTime() : Number.POSITIVE_INFINITY
    return da - db
  })

  const changed = []
  for (let idx = 0; idx < openTasks.length; idx += 1) {
    const task = openTasks[idx]
    const targetDate = slots[idx % slots.length]
    if (task.deadline === targetDate) continue
    const { data: updated, error: updateError } = await supabase
      .from('tasks')
      .update({ deadline: targetDate })
      .eq('id', task.id)
      .eq('user_id', userId)
      .select('*')
      .maybeSingle()
    if (updateError) throw new Error(updateError.message)
    changed.push(taskView(updated || { ...task, deadline: targetDate }))
  }

  return {
    status: 'ok',
    action: 'rebalance_weekly_schedule',
    changed_count: changed.length,
    changed,
    ui_events: TASK_UI_EVENTS,
    message: changed.length > 0
      ? `Weekly schedule rebalanced for ${changed.length} task(s).`
      : 'Weekly schedule is already balanced.',
  }
}

async function importTasksFromItems(supabase, userId, items) {
  const sourceItems = Array.isArray(items) ? items : []
  const { data: existing, error: existingError } = await supabase
    .from('tasks')
    .select('title')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1000)
  if (existingError) throw new Error(existingError.message)

  const titleSet = new Set((existing || []).map((x) => String(x.title || '').trim().toLowerCase()))
  const now = new Date().toISOString()
  const rows = []
  let skipped = 0

  for (const item of sourceItems) {
    const title = String(item?.title || '').trim()
    if (!title) continue
    const key = title.toLowerCase()
    if (titleSet.has(key)) {
      skipped += 1
      continue
    }
    titleSet.add(key)
    rows.push({
      id: uuidv4(),
      user_id: userId,
      title,
      deadline: item?.deadline || null,
      priority: normalizePriority(item?.priority),
      completed: false,
      created_at: now,
    })
  }

  if (rows.length > 0) {
    const { error } = await supabase.from('tasks').insert(rows)
    if (error) throw new Error(error.message)
  }

  return {
    status: 'ok',
    action: 'import_tasks_from_pdf',
    changed_count: rows.length,
    changed: rows.map(taskView),
    ui_events: TASK_UI_EVENTS,
    message: `Imported ${rows.length} tasks${skipped > 0 ? `, skipped ${skipped} duplicates` : ''}.`,
    inserted: rows.length,
    skipped,
  }
}

module.exports = {
  executeTaskStep,
  importTasksFromItems,
}
