const DEBUG_FLAG_KEY = 'sp_debug_mode'
const DEBUG_EVENT = 'sp-debug-event'

export function isDebugEnabled() {
  return localStorage.getItem(DEBUG_FLAG_KEY) === '1'
}

export function setDebugEnabled(value) {
  localStorage.setItem(DEBUG_FLAG_KEY, value ? '1' : '0')
  window.dispatchEvent(new CustomEvent(DEBUG_EVENT, { detail: { type: 'debug-toggle', value } }))
}

export function pushDebugEvent(type, payload = {}) {
  const event = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: new Date().toISOString(),
    type,
    payload,
  }
  window.dispatchEvent(new CustomEvent(DEBUG_EVENT, { detail: event }))
}

export function onDebugEvent(handler) {
  const listener = (event) => handler(event.detail)
  window.addEventListener(DEBUG_EVENT, listener)
  return () => window.removeEventListener(DEBUG_EVENT, listener)
}

export function getDebugSnapshot() {
  const token = localStorage.getItem('sp_token') || ''
  const supabaseToken = localStorage.getItem('sp_supabase_access_token') || ''
  return {
    hasAppToken: !!token,
    appTokenPreview: token ? `${token.slice(0, 12)}...` : '',
    hasSupabaseToken: !!supabaseToken,
    supabaseTokenPreview: supabaseToken ? `${supabaseToken.slice(0, 12)}...` : '',
    apiBase: import.meta.env.VITE_API_URL || '/api',
    hasSupabaseUrl: !!import.meta.env.VITE_SUPABASE_URL,
    hasSupabaseAnonKey: !!import.meta.env.VITE_SUPABASE_ANON_KEY,
  }
}

