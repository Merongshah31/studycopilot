const express = require('express')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { v4: uuidv4 } = require('uuid')
const { getSupabaseServerClient } = require('../supabase')

const router = express.Router()

function mapUserRow(row) {
  if (!row) return null
  return {
    id: row.id,
    name: row.name || '',
    email: row.email || '',
    password: row.password || '',
    course: row.course || '',
    subjects: Array.isArray(row.subjects) ? row.subjects : [],
    provider: row.provider || '',
    providerId: row.provider_id || '',
    createdAt: row.created_at || '',
  }
}

async function getUserByEmail(supabase, email) {
  const { data, error } = await supabase.from('users').select('*').eq('email', email).maybeSingle()
  if (error) throw error
  return mapUserRow(data)
}

async function getUserByProvider(supabase, provider, providerId) {
  const { data, error } = await supabase.from('users').select('*').eq('provider', provider).eq('provider_id', providerId).maybeSingle()
  if (error) throw error
  return mapUserRow(data)
}

async function getUserById(supabase, id) {
  const { data, error } = await supabase.from('users').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return mapUserRow(data)
}

router.post('/register', async (req, res) => {
  const supabase = getSupabaseServerClient()
  if (!supabase) return res.status(500).json({ message: 'Supabase is not configured on backend' })
  const { name, email, password, course, subjects } = req.body || {}
  if (!email || !password) return res.status(400).json({ message: 'email and password required' })
  try {
    const existing = await getUserByEmail(supabase, email)
    if (existing) return res.status(409).json({ message: 'Email already registered' })
  } catch (error) {
    return res.status(500).json({ message: `Failed to check existing user: ${error.message}` })
  }

  const hashed = await bcrypt.hash(password, 10)
  const id = uuidv4()
  const createdAt = new Date().toISOString()
  const { error } = await supabase.from('users').insert({
    id,
    name: name || '',
    email,
    password: hashed,
    course: course || '',
    subjects: Array.isArray(subjects) ? subjects : [],
    provider: '',
    provider_id: '',
    created_at: createdAt,
  })
  if (error) return res.status(500).json({ message: `Failed to create user: ${error.message}` })

  const token = jwt.sign({ id, email }, process.env.JWT_SECRET || 'dev_secret', { expiresIn: '7d' })
  res.status(201).json({ id, email, name, token })
})

router.post('/login', async (req, res) => {
  const supabase = getSupabaseServerClient()
  if (!supabase) return res.status(500).json({ message: 'Supabase is not configured on backend' })
  const { email, password } = req.body || {}
  if (!email || !password) return res.status(400).json({ message: 'email and password required' })
  let row
  try {
    row = await getUserByEmail(supabase, email)
  } catch (error) {
    return res.status(500).json({ message: `Failed to load user: ${error.message}` })
  }
  if (!row) return res.status(401).json({ message: 'Invalid credentials' })
  const ok = await bcrypt.compare(password, row.password || '')
  if (!ok) return res.status(401).json({ message: 'Invalid credentials' })
  const token = jwt.sign({ id: row.id, email: row.email }, process.env.JWT_SECRET || 'dev_secret', { expiresIn: '7d' })
  res.json({ id: row.id, email: row.email, name: row.name, token })
})

router.post('/oauth', async (req, res) => {
  const supabase = getSupabaseServerClient()
  if (!supabase) return res.status(500).json({ message: 'Supabase is not configured on backend' })
  const { provider, providerId, email, name, accessToken } = req.body || {}
  if (!provider || !providerId || !email) return res.status(400).json({ message: 'provider, providerId and email required' })

  if (provider === 'supabase') {
    if (!accessToken) return res.status(401).json({ message: 'Missing Supabase access token' })
    const { data, error } = await supabase.auth.getUser(accessToken)
    if (error || !data?.user) return res.status(401).json({ message: 'Invalid Supabase token' })
    if (data.user.id !== providerId || data.user.email !== email) {
      return res.status(401).json({ message: 'Supabase token does not match user profile' })
    }
  }

  let row
  try {
    row = await getUserByProvider(supabase, provider, providerId)
    if (!row) row = await getUserByEmail(supabase, email)
  } catch (error) {
    return res.status(500).json({ message: `Failed to query OAuth user: ${error.message}` })
  }

  if (!row) {
    const id = uuidv4()
    const createdAt = new Date().toISOString()
    const { error } = await supabase.from('users').insert({
      id,
      name: name || '',
      email,
      password: '',
      course: '',
      subjects: [],
      provider,
      provider_id: providerId,
      created_at: createdAt,
    })
    if (error) return res.status(500).json({ message: `Failed to create OAuth user: ${error.message}` })
    row = await getUserById(supabase, id)
  } else if ((!row.provider || !row.providerId) && provider && providerId) {
    const { error } = await supabase.from('users').update({ provider, provider_id: providerId }).eq('id', row.id)
    if (error) return res.status(500).json({ message: `Failed to link OAuth provider: ${error.message}` })
  }

  const token = jwt.sign({ id: row.id, email: row.email }, process.env.JWT_SECRET || 'dev_secret', { expiresIn: '7d' })
  res.json({ id: row.id, email: row.email, name: row.name, token })
})

router.post('/guest', (req, res) => {
  ;(async () => {
    const supabase = getSupabaseServerClient()
    if (!supabase) return res.status(500).json({ message: 'Supabase is not configured on backend' })
    const id = uuidv4()
    const createdAt = new Date().toISOString()
    const suffix = id.slice(0, 8)
    const email = `guest-${suffix}@studypilot.local`
    const name = `Guest ${suffix}`
    const { error } = await supabase.from('users').insert({
      id,
      name,
      email,
      password: '',
      course: '',
      subjects: [],
      provider: 'guest',
      provider_id: id,
      created_at: createdAt,
    })
    if (error) return res.status(500).json({ message: `Guest login failed: ${error.message}` })
    const token = jwt.sign({ id, email, guest: true }, process.env.JWT_SECRET || 'dev_secret', { expiresIn: '7d' })
    res.status(201).json({ id, email, name, token, guest: true })
  })().catch((error) => res.status(500).json({ message: `Guest login failed: ${error.message}` }))
})

module.exports = router
