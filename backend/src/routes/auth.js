const express = require('express')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { v4: uuidv4 } = require('uuid')
const { createClient } = require('@supabase/supabase-js')
const db = require('../db')

const router = express.Router()

function getSupabaseServerClient() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

router.post('/register', async (req, res) => {
  const { name, email, password, course, subjects } = req.body || {}
  if (!email || !password) return res.status(400).json({ message: 'email and password required' })

  const hashed = await bcrypt.hash(password, 10)
  const id = uuidv4()
  const createdAt = new Date().toISOString()
  db.prepare('INSERT INTO users (id,name,email,password,course,subjects,createdAt) VALUES (?,?,?,?,?,?,?)')
    .run(id, name || '', email, hashed, course || '', JSON.stringify(subjects || []), createdAt)

  const token = jwt.sign({ id, email }, process.env.JWT_SECRET || 'dev_secret', { expiresIn: '7d' })
  res.status(201).json({ id, email, name, token })
})

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {}
  if (!email || !password) return res.status(400).json({ message: 'email and password required' })
  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email)
  if (!row) return res.status(401).json({ message: 'Invalid credentials' })
  const ok = await bcrypt.compare(password, row.password || '')
  if (!ok) return res.status(401).json({ message: 'Invalid credentials' })
  const token = jwt.sign({ id: row.id, email: row.email }, process.env.JWT_SECRET || 'dev_secret', { expiresIn: '7d' })
  res.json({ id: row.id, email: row.email, name: row.name, token })
})

router.post('/oauth', async (req, res) => {
  const { provider, providerId, email, name, accessToken } = req.body || {}
  if (!provider || !providerId || !email) return res.status(400).json({ message: 'provider, providerId and email required' })

  if (provider === 'supabase') {
    const supabase = getSupabaseServerClient()
    if (!supabase) return res.status(500).json({ message: 'Supabase verification not configured' })
    if (!accessToken) return res.status(401).json({ message: 'Missing Supabase access token' })
    const { data, error } = await supabase.auth.getUser(accessToken)
    if (error || !data?.user) return res.status(401).json({ message: 'Invalid Supabase token' })
    if (data.user.id !== providerId || data.user.email !== email) {
      return res.status(401).json({ message: 'Supabase token does not match user profile' })
    }
  }

  let row = db.prepare('SELECT * FROM users WHERE provider = ? AND providerId = ?').get(provider, providerId)
  if (!row) row = db.prepare('SELECT * FROM users WHERE email = ?').get(email)

  if (!row) {
    const id = uuidv4()
    const createdAt = new Date().toISOString()
    db.prepare('INSERT INTO users (id,name,email,password,course,subjects,provider,providerId,createdAt) VALUES (?,?,?,?,?,?,?,?,?)')
      .run(id, name || '', email, '', '', JSON.stringify([]), provider, providerId, createdAt)
    row = db.prepare('SELECT * FROM users WHERE id = ?').get(id)
  } else if ((!row.provider || !row.providerId) && provider && providerId) {
    db.prepare('UPDATE users SET provider = ?, providerId = ? WHERE id = ?').run(provider, providerId, row.id)
  }

  const token = jwt.sign({ id: row.id, email: row.email }, process.env.JWT_SECRET || 'dev_secret', { expiresIn: '7d' })
  res.json({ id: row.id, email: row.email, name: row.name, token })
})

router.post('/guest', (req, res) => {
  try {
    const id = uuidv4()
    const createdAt = new Date().toISOString()
    const suffix = id.slice(0, 8)
    const email = `guest-${suffix}@studypilot.local`
    const name = `Guest ${suffix}`
    db.prepare('INSERT INTO users (id,name,email,password,course,subjects,provider,providerId,createdAt) VALUES (?,?,?,?,?,?,?,?,?)')
      .run(id, name, email, '', '', JSON.stringify([]), 'guest', id, createdAt)
    const token = jwt.sign({ id, email, guest: true }, process.env.JWT_SECRET || 'dev_secret', { expiresIn: '7d' })
    res.status(201).json({ id, email, name, token, guest: true })
  } catch (error) {
    res.status(500).json({ message: `Guest login failed: ${error.message}` })
  }
})

module.exports = router
