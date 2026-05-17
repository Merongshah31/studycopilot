import { createClient } from '@supabase/supabase-js'
import { pushDebugEvent } from './debug'

const url = import.meta.env.VITE_SUPABASE_URL || ''
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const supabase = url && key ? createClient(url, key) : null

export async function signInWithGoogle() {
  if (!url || !key || !supabase) {
    pushDebugEvent('supabase-config-missing', { hasUrl: !!url, hasAnonKey: !!key })
    throw new Error('Supabase not configured')
  }
  pushDebugEvent('supabase-google-signin-start')
  return supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/#/dashboard` } })
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

