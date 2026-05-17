import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import Auth from './pages/Auth'
import Home from './pages/Home'
import DebugPanel from './components/DebugPanel'
import { getToken } from './lib/authClient'
import { handleSupabaseAuth } from './lib/supabaseClient'
import { pushDebugEvent } from './lib/debug'
import './index.css'

const root = createRoot(document.getElementById('root'))

function RouterApp() {
  const [hash, setHash] = useState(window.location.hash.replace('#', '') || '/')

  useEffect(() => {
    const onHash = () => setHash(window.location.hash.replace('#', '') || '/')
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const token = getToken()
  const protectedRoutes = ['/dashboard', '/tasks', '/planner', '/analytics', '/assistant', '/schedule-import', '/weekly-schedule', '/profile']
  const requiresAuth = protectedRoutes.some((route) => hash.startsWith(route))
  if (!token && requiresAuth) {
    window.location.hash = '#/auth'
    return <Auth />
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
    if (localStorage.getItem(tokenKey) === session.access_token) return
    const body = {
      provider: 'supabase',
      providerId: session.user.id,
      email: session.user.email,
      name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || session.user.email,
      accessToken: session.access_token,
    }
    const endpoint = (import.meta.env.VITE_API_URL || '/api') + '/auth/oauth'
    pushDebugEvent('supabase-oauth-sync-start', { endpoint, email: body.email, providerId: body.providerId })
    const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data = await res.json()
    pushDebugEvent('supabase-oauth-sync-response', { status: res.status, ok: res.ok, hasToken: !!data?.token, message: data?.message || '' })
    if (data?.token) {
      localStorage.setItem('sp_token', data.token)
      localStorage.setItem(tokenKey, session.access_token)
      window.location.hash = '#/dashboard'
    }
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
