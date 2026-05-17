const jwt = require('jsonwebtoken')
const { getSupabaseServerClient } = require('../supabase')

async function authMiddleware(req, res, next) {
  const auth = req.headers.authorization
  if (!auth) return res.status(401).json({ message: 'Missing token' })
  const parts = auth.split(' ')
  if (parts.length !== 2) return res.status(401).json({ message: 'Invalid token format' })
  const token = parts[1]

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret')
    return next()
  } catch {
    const supabase = getSupabaseServerClient()
    if (!supabase) return res.status(401).json({ message: 'Invalid token' })
    try {
      const { data, error } = await supabase.auth.getUser(token)
      if (error || !data?.user) return res.status(401).json({ message: 'Invalid token' })
      const profileName = data.user.user_metadata?.full_name || data.user.user_metadata?.name || data.user.email || ''
      const userRow = {
        id: data.user.id,
        email: data.user.email || '',
        name: profileName,
        password: '',
        course: '',
        subjects: [],
        provider: 'supabase',
        provider_id: data.user.id,
        created_at: new Date().toISOString(),
      }
      await supabase.from('users').upsert(userRow)
      req.user = {
        id: data.user.id,
        email: data.user.email || '',
        provider: 'supabase',
      }
      return next()
    } catch {
      return res.status(401).json({ message: 'Invalid token' })
    }
  }
}

module.exports = authMiddleware
