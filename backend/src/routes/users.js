const express = require('express')
const db = require('../db')
const authMiddleware = require('../middleware/auth')

const router = express.Router()
router.use(authMiddleware)

router.get('/profile', (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)
  if (!user) return res.status(404).json({ message: 'User not found' })
  res.json({
    id: user.id,
    name: user.name || '',
    email: user.email || '',
    course: user.course || '',
    subjects: Array.isArray(user.subjects) ? user.subjects : [],
  })
})

router.put('/profile', (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)
  if (!user) return res.status(404).json({ message: 'User not found' })

  const updated = {
    name: req.body.name ?? user.name ?? '',
    email: req.body.email ?? user.email ?? '',
    password: user.password ?? '',
    course: req.body.course ?? user.course ?? '',
    subjects: Array.isArray(req.body.subjects) ? req.body.subjects : (Array.isArray(user.subjects) ? user.subjects : []),
  }
  db.prepare('UPDATE users SET name = ?, email = ?, password = ?, course = ?, subjects = ? WHERE id = ?')
    .run(updated.name, updated.email, updated.password, updated.course, JSON.stringify(updated.subjects), req.user.id)
  res.json({ id: req.user.id, ...updated })
})

module.exports = router

