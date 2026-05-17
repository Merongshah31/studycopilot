const express = require('express')
const authMiddleware = require('../middleware/auth')
const { getSupabaseServerClient } = require('../supabase')

const router = express.Router()
router.use(authMiddleware)

function mapUser(row) {
  return {
    id: row.id,
    name: row.name || '',
    email: row.email || '',
    course: row.course || '',
    subjects: Array.isArray(row.subjects) ? row.subjects : [],
  }
}

router.get('/profile', async (req, res) => {
  const supabase = getSupabaseServerClient()
  if (!supabase) return res.status(500).json({ message: 'Supabase is not configured on backend' })
  const { data: user, error } = await supabase.from('users').select('*').eq('id', req.user.id).maybeSingle()
  if (error) return res.status(500).json({ message: `Failed to load profile: ${error.message}` })
  if (!user) return res.status(404).json({ message: 'User not found' })
  res.json(mapUser(user))
})

router.put('/profile', async (req, res) => {
  const supabase = getSupabaseServerClient()
  if (!supabase) return res.status(500).json({ message: 'Supabase is not configured on backend' })
  const { data: user, error: getError } = await supabase.from('users').select('*').eq('id', req.user.id).maybeSingle()
  if (getError) return res.status(500).json({ message: `Failed to load profile: ${getError.message}` })
  if (!user) return res.status(404).json({ message: 'User not found' })

  const updated = {
    name: req.body.name ?? user.name ?? '',
    email: req.body.email ?? user.email ?? '',
    course: req.body.course ?? user.course ?? '',
    subjects: Array.isArray(req.body.subjects) ? req.body.subjects : (Array.isArray(user.subjects) ? user.subjects : []),
  }
  const { error: updateError } = await supabase
    .from('users')
    .update(updated)
    .eq('id', req.user.id)
  if (updateError) return res.status(500).json({ message: `Failed to update profile: ${updateError.message}` })
  res.json({ id: req.user.id, ...updated })
})

module.exports = router
