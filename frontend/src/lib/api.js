import { pushDebugEvent } from './debug'

const API_BASE = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '/api'

export async function apiFetch(path, options = {}) {
  const token = localStorage.getItem('sp_token')
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

  pushDebugEvent('api-response', { method, path, url, status: res.status, ok: res.ok, elapsedMs: Date.now() - start })

  if (res.status === 401) {
    localStorage.removeItem('sp_token')
    pushDebugEvent('auth-401', { path, method })
    if (!window.location.hash.startsWith('#/auth')) window.location.hash = '#/auth'
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
