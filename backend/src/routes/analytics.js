const express = require('express')
const authMiddleware = require('../middleware/auth')
const { getSupabaseServerClient } = require('../supabase')

const router = express.Router()
router.use(authMiddleware)

function toDate(value) {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function toDayKey(date) {
  return date.toISOString().slice(0, 10)
}

router.get('/overview', async (req, res) => {
  const supabase = getSupabaseServerClient()
  if (!supabase) return res.status(500).json({ message: 'Supabase is not configured on backend' })
  const { data: tasks, error } = await supabase.from('tasks').select('*').eq('user_id', req.user.id).order('created_at', { ascending: false })
  if (error) return res.status(500).json({ message: `Failed to load analytics: ${error.message}` })
  const now = new Date()

  const completedTasks = tasks.filter((task) => !!task.completed).length
  const totalTasks = tasks.length
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0
  const overdueOpenTasks = tasks.filter((task) => {
    if (task.completed) return false
    const deadline = toDate(task.deadline)
    return deadline ? deadline < now : false
  }).length

  const dueSoonTasks = tasks.filter((task) => {
    if (task.completed) return false
    const deadline = toDate(task.deadline)
    if (!deadline) return false
    const diffMs = deadline.getTime() - now.getTime()
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
    return diffDays >= 0 && diffDays <= 3
  }).length

  const createdThisWeek = tasks.filter((task) => {
    const created = toDate(task.created_at || task.createdAt)
    if (!created) return false
    const diffMs = now.getTime() - created.getTime()
    const diffDays = diffMs / (1000 * 60 * 60 * 24)
    return diffDays <= 7
  }).length

  const completionHealth = Math.max(0, completionRate - overdueOpenTasks * 5)
  const productivityScore = Math.min(100, Math.round((completionHealth * 0.75) + (Math.min(100, createdThisWeek * 10) * 0.25)))

  const priorityBreakdown = {
    high: tasks.filter((task) => task.priority === 'high').length,
    medium: tasks.filter((task) => task.priority === 'medium').length,
    low: tasks.filter((task) => task.priority === 'low').length,
  }

  const statusBreakdown = {
    completed: completedTasks,
    open: tasks.filter((task) => !task.completed).length,
    overdue: overdueOpenTasks,
  }

  const sevenDayMap = {}
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date(now)
    d.setDate(now.getDate() - i)
    sevenDayMap[toDayKey(d)] = { done: 0, created: 0, day: d.toLocaleDateString('en-US', { weekday: 'short' }) }
  }

  tasks.forEach((task) => {
    const createdAt = toDate(task.created_at || task.createdAt)
    if (createdAt) {
      const key = toDayKey(createdAt)
      if (sevenDayMap[key]) sevenDayMap[key].created += 1
    }
    if (task.completed && createdAt) {
      const key = toDayKey(createdAt)
      if (sevenDayMap[key]) sevenDayMap[key].done += 1
    }
  })

  const weeklyTrend = Object.values(sevenDayMap)
  const maxLoad = weeklyTrend.reduce((max, item) => Math.max(max, item.created), 0)

  const timeline = {
    morning: tasks.filter((task, idx) => !task.completed && idx % 3 === 0).length,
    afternoon: tasks.filter((task, idx) => !task.completed && idx % 3 === 1).length,
    night: tasks.filter((task, idx) => !task.completed && idx % 3 === 2).length,
  }

  const focusRecommendations = []
  if (overdueOpenTasks > 0) focusRecommendations.push(`Clear ${overdueOpenTasks} overdue task(s) first.`)
  if (dueSoonTasks > 0) focusRecommendations.push(`${dueSoonTasks} task(s) are due in the next 3 days.`)
  if (priorityBreakdown.high > 0) focusRecommendations.push(`Prioritize ${priorityBreakdown.high} high-priority task(s).`)
  if (focusRecommendations.length === 0) focusRecommendations.push('Great pace. Keep consistent daily progress.')

  res.json({
    totals: {
      totalTasks,
      completedTasks,
      completionRate,
      productivityScore,
      overdueOpenTasks,
      dueSoonTasks,
      createdThisWeek,
      maxLoad,
    },
    charts: {
      priorityBreakdown,
      statusBreakdown,
      weeklyTrend,
      timeline,
    },
    insights: {
      productivityBand: productivityScore >= 75 ? 'High' : productivityScore >= 45 ? 'Moderate' : 'Needs attention',
      recommendations: focusRecommendations,
    },
  })
})

module.exports = router
