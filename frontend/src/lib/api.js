import { pushDebugEvent } from './debug'
import { supabase } from './supabaseClient'

const API_BASE = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '/api'

async function resolveAuthToken() {
  const appToken = localStorage.getItem('sp_token')
  if (appToken) return { token: appToken, source: 'sp_token' }

  const cachedSupabaseToken = localStorage.getItem('sp_supabase_access_token')
  if (cachedSupabaseToken) return { token: cachedSupabaseToken, source: 'sp_supabase_access_token' }

  if (!supabase) return { token: '', source: 'none' }
  try {
    const { data } = await supabase.auth.getSession()
    const sessionToken = data?.session?.access_token || ''
    if (sessionToken) {
      localStorage.setItem('sp_supabase_access_token', sessionToken)
      return { token: sessionToken, source: 'supabase_session' }
    }
  } catch (error) {
    pushDebugEvent('supabase-session-read-error', { message: error.message })
  }
  return { token: '', source: 'none' }
}

export async function apiFetch(path, options = {}) {
  const { token, source } = await resolveAuthToken()
  const headers = options.headers || {}
  if (token) headers.Authorization = `Bearer ${token}`
  if (!headers['Content-Type'] && options.body) headers['Content-Type'] = 'application/json'

  const method = options.method || 'GET'
  const url = `${API_BASE}${path}`
  const start = Date.now()

  let res
  try {
    res = await fetch(url, { ...options, headers })
  } catch (error) {
    pushDebugEvent('api-network-error', { method, path, url, message: error.message, elapsedMs: Date.now() - start })
    throw error
  }

  pushDebugEvent('api-response', { method, path, url, status: res.status, ok: res.ok, elapsedMs: Date.now() - start, tokenSource: source })

  if (res.status === 401) {
    localStorage.removeItem('sp_token')
    pushDebugEvent('auth-401', { path, method })
    const fallback = localStorage.getItem('sp_supabase_access_token')
    if (!fallback && !window.location.hash.startsWith('#/auth')) window.location.hash = '#/auth'
    throw new Error('Unauthorized')
  }

  const text = await res.text()
  let data = text
  try {
    data = JSON.parse(text)
  } catch {}

  if (!res.ok) {
    const message = typeof data === 'object' && data?.message ? data.message : `Request failed: ${res.status}`
    pushDebugEvent('api-error', { path, method, message, status: res.status })
    throw new Error(message)
  }
  return data
}
