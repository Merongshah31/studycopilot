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
      detectSessionInUrl: true,
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
