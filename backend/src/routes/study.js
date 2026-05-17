const express = require('express')
const { v4: uuidv4 } = require('uuid')
const authMiddleware = require('../middleware/auth')
const { readExtraStore, writeExtraStore } = require('../extraStore')

const router = express.Router()
router.use(authMiddleware)

router.get('/sessions', (req, res) => {
  const store = readExtraStore()
  const sessions = store.sessions
    .filter((session) => session.userId === req.user.id)
    .sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || ''))
  res.json(sessions)
})

router.post('/sessions', (req, res) => {
  const { mode = 'focus', duration = 25 } = req.body || {}
  const store = readExtraStore()
  const session = {
    id: uuidv4(),
    userId: req.user.id,
    mode,
    duration: Number(duration) || 25,
    completedAt: new Date().toISOString(),
  }
  store.sessions.push(session)
  writeExtraStore(store)
  res.status(201).json(session)
})

module.exports = router

