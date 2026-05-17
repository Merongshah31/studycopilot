const express = require('express')
const { v4: uuidv4 } = require('uuid')
const authMiddleware = require('../middleware/auth')
const { getSupabaseServerClient } = require('../supabase')

const router = express.Router()
router.use(authMiddleware)

function mapTask(row) {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title || 'Untitled task',
    deadline: row.deadline || null,
    priority: row.priority || 'low',
    completed: !!row.completed,
    createdAt: row.created_at || null,
  }
}

router.get('/', async (req, res) => {
  const supabase = getSupabaseServerClient()
  if (!supabase) return res.status(500).json({ message: 'Supabase is not configured on backend' })
  const { data, error } = await supabase.from('tasks').select('*').eq('user_id', req.user.id).order('created_at', { ascending: false })
  if (error) return res.status(500).json({ message: `Failed to load tasks: ${error.message}` })
  res.json((data || []).map(mapTask))
})

router.post('/', async (req, res) => {
  const supabase = getSupabaseServerClient()
  if (!supabase) return res.status(500).json({ message: 'Supabase is not configured on backend' })
  const { title, deadline, priority } = req.body || {}
  const id = uuidv4()
  const createdAt = new Date().toISOString()
  const payload = {
    id,
    user_id: req.user.id,
    title: title || 'Untitled task',
    deadline: deadline || null,
    priority: priority || 'low',
    completed: false,
    created_at: createdAt,
  }
  const { error } = await supabase.from('tasks').insert(payload)
  if (error) return res.status(500).json({ message: `Failed to create task: ${error.message}` })
  res.status(201).json(mapTask(payload))
})

router.put('/:id', async (req, res) => {
  const supabase = getSupabaseServerClient()
  if (!supabase) return res.status(500).json({ message: 'Supabase is not configured on backend' })
  const { data: existingRaw, error: existingError } = await supabase.from('tasks').select('*').eq('id', req.params.id).eq('user_id', req.user.id).maybeSingle()
  if (existingError) return res.status(500).json({ message: `Failed to load task: ${existingError.message}` })
  const existing = existingRaw
  if (!existing) return res.status(404).json({ message: 'Not found' })
  const updated = {
    title: req.body?.title ?? existing.title,
    deadline: req.body?.deadline ?? existing.deadline,
    priority: req.body?.priority ?? existing.priority,
    completed: typeof req.body?.completed === 'boolean' ? req.body.completed : !!existing.completed,
  }
  const { data, error } = await supabase
    .from('tasks')
    .update(updated)
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .select('*')
    .maybeSingle()
  if (error) return res.status(500).json({ message: `Failed to update task: ${error.message}` })
  res.json(mapTask(data))
})

router.delete('/:id', async (req, res) => {
  const supabase = getSupabaseServerClient()
  if (!supabase) return res.status(500).json({ message: 'Supabase is not configured on backend' })
  const { error } = await supabase.from('tasks').delete().eq('id', req.params.id).eq('user_id', req.user.id)
  if (error) return res.status(500).json({ message: `Failed to delete task: ${error.message}` })
  res.status(204).end()
})

module.exports = router
