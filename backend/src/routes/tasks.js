const express = require('express')
const { v4: uuidv4 } = require('uuid')
const db = require('../db')
const authMiddleware = require('../middleware/auth')

const router = express.Router()
router.use(authMiddleware)

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM tasks WHERE userId = ? ORDER BY createdAt DESC').all(req.user.id)
  res.json(rows.map((row) => ({ ...row, completed: !!row.completed })))
})

router.post('/', (req, res) => {
  const { title, deadline, priority } = req.body || {}
  const id = uuidv4()
  const createdAt = new Date().toISOString()
  db.prepare('INSERT INTO tasks (id,userId,title,deadline,priority,completed,createdAt) VALUES (?,?,?,?,?,?,?)')
    .run(id, req.user.id, title || 'Untitled task', deadline || null, priority || 'low', 0, createdAt)
  const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id)
  res.status(201).json({ ...row, completed: !!row.completed })
})

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM tasks WHERE id = ? AND userId = ?').get(req.params.id, req.user.id)
  if (!existing) return res.status(404).json({ message: 'Not found' })
  const updated = { ...existing, ...req.body }
  db.prepare('UPDATE tasks SET title = ?, deadline = ?, priority = ?, completed = ? WHERE id = ?')
    .run(updated.title, updated.deadline, updated.priority, updated.completed ? 1 : 0, req.params.id)
  const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id)
  res.json({ ...row, completed: !!row.completed })
})

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM tasks WHERE id = ? AND userId = ?').run(req.params.id, req.user.id)
  res.status(204).end()
})

module.exports = router

