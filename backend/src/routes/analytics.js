const express = require('express')
const db = require('../db')
const authMiddleware = require('../middleware/auth')
const { readExtraStore } = require('../extraStore')

const router = express.Router()
router.use(authMiddleware)

router.get('/overview', (req, res) => {
  const tasks = db.prepare('SELECT * FROM tasks WHERE userId = ? ORDER BY createdAt DESC').all(req.user.id)
  const sessions = readExtraStore().sessions.filter((session) => session.userId === req.user.id)

  const completedTasks = tasks.filter((task) => !!task.completed).length
  const totalTasks = tasks.length
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0
  const totalStudyMinutes = sessions.reduce((sum, row) => sum + (Number(row.duration) || 0), 0)
  const productivityScore = Math.min(100, Math.round(completionRate * 0.7 + Math.min(totalStudyMinutes / 3, 30)))

  res.json({
    totals: {
      totalTasks,
      completedTasks,
      completionRate,
      totalStudyMinutes,
      sessionsCount: sessions.length,
      productivityScore,
    },
    charts: {
      tasksByPriority: {
        high: tasks.filter((task) => task.priority === 'high').length,
        medium: tasks.filter((task) => task.priority === 'medium').length,
        low: tasks.filter((task) => task.priority === 'low').length,
      },
      weeklySnapshot: [
        { day: 'Mon', done: Math.max(0, completedTasks - 4) },
        { day: 'Tue', done: Math.max(0, completedTasks - 3) },
        { day: 'Wed', done: Math.max(0, completedTasks - 2) },
        { day: 'Thu', done: Math.max(0, completedTasks - 1) },
        { day: 'Fri', done: completedTasks },
      ],
    },
  })
})

module.exports = router

