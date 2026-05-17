const express = require('express')
const db = require('../db')
const authMiddleware = require('../middleware/auth')

const router = express.Router()
router.use(authMiddleware)

function getSlot(priority) {
  if (priority === 'high') return 'morning'
  if (priority === 'medium') return 'afternoon'
  return 'night'
}

router.get('/daily', (req, res) => {
  const tasks = db.prepare('SELECT * FROM tasks WHERE userId = ? ORDER BY createdAt DESC').all(req.user.id)
  const active = tasks.filter((task) => !task.completed).slice(0, 9)
  const timeline = { morning: [], afternoon: [], night: [] }
  active.forEach((task) => {
    const slot = getSlot(task.priority || 'low')
    timeline[slot].push({
      id: task.id,
      title: task.title,
      deadline: task.deadline,
      priority: task.priority || 'low',
      suggestedMinutes: task.priority === 'high' ? 50 : task.priority === 'medium' ? 35 : 25,
    })
  })
  res.json({ date: new Date().toISOString().slice(0, 10), timeline })
})

module.exports = router

