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
  return {
    status: 'partial',
    action: action || 'unknown',
    changed_count: 0,
    changed: [],
    ui_events: [],
    message: `Unsupported task action: ${action || 'unknown'}`,
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
