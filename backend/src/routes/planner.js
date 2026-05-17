const express = require('express')
const authMiddleware = require('../middleware/auth')
const { getSupabaseServerClient } = require('../supabase')

const router = express.Router()
router.use(authMiddleware)

function getSlot(priority) {
  if (priority === 'high') return 'morning'
  if (priority === 'medium') return 'afternoon'
  return 'night'
}

router.get('/daily', async (req, res) => {
  const supabase = getSupabaseServerClient()
  if (!supabase) return res.status(500).json({ message: 'Supabase is not configured on backend' })
  const { data: tasks, error } = await supabase.from('tasks').select('*').eq('user_id', req.user.id).order('created_at', { ascending: false })
  if (error) return res.status(500).json({ message: `Failed to build planner: ${error.message}` })
  const active = tasks.filter((task) => !task.completed).slice(0, 9)
  const timeline = { morning: [], afternoon: [], night: [] }
  active.forEach((task) => {
    const slot = getSlot(task.priority || 'low')
    timeline[slot].push({
      id: task.id,
      title: task.title,
      deadline: task.deadline || null,
      priority: task.priority || 'low',
      suggestedMinutes: task.priority === 'high' ? 50 : task.priority === 'medium' ? 35 : 25,
    })
  })
  res.json({ date: new Date().toISOString().slice(0, 10), timeline })
})

module.exports = router
