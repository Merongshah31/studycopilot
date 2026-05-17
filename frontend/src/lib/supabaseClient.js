import { createClient } from '@supabase/supabase-js'
import { pushDebugEvent } from './debug'

const rawUrl = import.meta.env.VITE_SUPABASE_URL || ''
const rawKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
const url = String(rawUrl).trim().replace(/\/+$/, '')
const key = String(rawKey).trim()

export const supabase = url && key
  ? createClient(url, key, {
    auth: {
      flowType: 'pkce',
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  })
  : null

export async function signInWithGoogle() {
  if (!url || !key || !supabase) {
    pushDebugEvent('supabase-config-missing', { hasUrl: !!url, hasAnonKey: !!key })
    throw new Error('Supabase not configured')
  }
  pushDebugEvent('supabase-google-signin-start', { redirectTo: window.location.origin })
  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  })
}

export async function handleSupabaseAuth(sessionHandler) {
  if (!url || !key || !supabase) {
    pushDebugEvent('supabase-config-missing', { hasUrl: !!url, hasAnonKey: !!key })
    return
  }

  try {
    const fragment = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : ''
    const params = new URLSearchParams(fragment)
    const accessToken = params.get('access_token')
    const refreshToken = params.get('refresh_token')
    if (accessToken && refreshToken) {
      const { data, error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      })
      pushDebugEvent('supabase-session-from-fragment', {
        ok: !error,
        hasSession: !!data?.session,
        message: error?.message || '',
      })
      if (!error) {
        window.history.replaceState({}, document.title, `${window.location.origin}${window.location.pathname}${window.location.search}`)
      }
    }
  } catch (error) {
    pushDebugEvent('supabase-session-fragment-error', { message: error.message })
  }

  const { data } = await supabase.auth.getSession()
  if (data?.session) {
    pushDebugEvent('supabase-session-found', { userId: data.session.user?.id, email: data.session.user?.email })
    sessionHandler(data.session)
  }
  supabase.auth.onAuthStateChange((event, session) => {
    pushDebugEvent('supabase-auth-change', { event, hasSession: !!session, userId: session?.user?.id || '' })
    if (session) sessionHandler(session)
  })
}
