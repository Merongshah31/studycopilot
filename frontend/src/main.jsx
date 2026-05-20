import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import Auth from './pages/Auth'
import Home from './pages/Home'
import { getToken, loginAsGuest } from './lib/authClient'
import { handleSupabaseAuth } from './lib/supabaseClient'
import { pushDebugEvent } from './lib/debug'
import { initTheme } from './lib/theme'
import './index.css'

initTheme()

const root = createRoot(document.getElementById('root'))

function RouterApp() {
  const [hash, setHash] = useState(window.location.hash.replace('#', '') || '/')
  const [bootstrappingGuest, setBootstrappingGuest] = useState(false)

  useEffect(() => {
    const onHash = () => setHash(window.location.hash.replace('#', '') || '/')
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {
    const run = async () => {
      const forceGuest = String(import.meta.env.VITE_FORCE_GUEST_LOGIN || 'false').toLowerCase() === 'true'
      if (!forceGuest) return
      if (getToken() || localStorage.getItem('sp_supabase_access_token')) return
      setBootstrappingGuest(true)
      try {
        pushDebugEvent('force-guest-login-start')
        await loginAsGuest()
        pushDebugEvent('force-guest-login-success')
        window.location.hash = '#/dashboard'
      } catch (error) {
        pushDebugEvent('force-guest-login-error', { message: error.message })
      } finally {
        setBootstrappingGuest(false)
      }
    }
    run()
  }, [])

  const token = getToken()
  const hasSupabaseSessionToken = !!localStorage.getItem('sp_supabase_access_token')
  const isAuthed = !!token || hasSupabaseSessionToken
  const protectedRoutes = ['/dashboard', '/tasks', '/planner', '/analytics', '/assistant', '/schedule-import', '/weekly-schedule', '/profile']
  const requiresAuth = protectedRoutes.some((route) => hash.startsWith(route))
  if (bootstrappingGuest) return <div className="min-h-screen flex items-center justify-center text-slate-600">Signing you in...</div>
  if (!isAuthed && requiresAuth) {
    window.location.hash = '#/auth'
    return <Auth />
  }

  if (isAuthed && (hash === '/' || hash.startsWith('/auth'))) {
    window.location.hash = '#/dashboard'
    return <App />
  }

  let view = <App />
  if (hash.startsWith('/auth')) view = <Auth />
  if (hash === '/') view = <Home />

  return (
    <>
      {view}
    </>
  )
}

handleSupabaseAuth(async (session) => {
  try {
    const tokenKey = 'sp_supabase_access_token'
    const existingSupabaseAccessToken = localStorage.getItem(tokenKey)
    if (existingSupabaseAccessToken === session.access_token) return
    localStorage.setItem(tokenKey, session.access_token)
    localStorage.removeItem('sp_token')
    pushDebugEvent('supabase-oauth-session-ready', { userId: session.user.id, email: session.user.email || '' })
    window.location.hash = '#/dashboard'
  } catch (error) {
    pushDebugEvent('supabase-oauth-sync-error', { message: error.message })
  }
})

root.render(<RouterApp />)

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}
