import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import Auth from './pages/Auth'
import Home from './pages/Home'
import DebugPanel from './components/DebugPanel'
import { getToken, loginAsGuest } from './lib/authClient'
import { handleSupabaseAuth } from './lib/supabaseClient'
import { pushDebugEvent } from './lib/debug'
import './index.css'

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
      const forceGuest = String(import.meta.env.VITE_FORCE_GUEST_LOGIN || 'true').toLowerCase() === 'true'
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
      <DebugPanel />
    </>
  )
}

handleSupabaseAuth(async (session) => {
  try {
    const tokenKey = 'sp_supabase_access_token'
    const existingSupabaseAccessToken = localStorage.getItem(tokenKey)
    const existingBackendToken = localStorage.getItem('sp_token')
    if (existingBackendToken && existingSupabaseAccessToken === session.access_token) return
    const body = {
      provider: 'supabase',
      providerId: session.user.id,
      email: session.user.email,
      name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || session.user.email,
      accessToken: session.access_token,
    }
    const apiBase = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '/api'
    const endpoint = `${apiBase}/auth/oauth`
    pushDebugEvent('supabase-oauth-sync-start', { endpoint, email: body.email, providerId: body.providerId })
    const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const raw = await res.text()
    let data = {}
    try {
      data = raw ? JSON.parse(raw) : {}
    } catch {
      data = {}
    }
    pushDebugEvent('supabase-oauth-sync-response', { status: res.status, ok: res.ok, hasToken: !!data?.token, message: data?.message || '' })
    if (data?.token) {
      localStorage.setItem('sp_token', data.token)
      localStorage.setItem(tokenKey, session.access_token)
      window.location.hash = '#/dashboard'
      return
    }
    throw new Error(data?.message || `OAuth sync failed (${res.status})`)
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
