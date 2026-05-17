import React, { useEffect, useState } from 'react'
import { getToken, logout } from '../lib/authClient'
import { apiFetch } from '../lib/api'
import { isDebugEnabled, setDebugEnabled } from '../lib/debug'

export default function Header() {
  const [name, setName] = useState('Student')
  const [debug, setDebug] = useState(isDebugEnabled())
  const token = getToken()

  useEffect(() => {
    if (!token) return
    apiFetch('/users/profile').then((data) => {
      if (data?.name) setName(data.name)
    }).catch(() => {})
  }, [token])

  return (
    <header className="mb-4 md:mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
      <div>
        <h1 className="text-xl md:text-2xl font-semibold">Welcome back, {name}</h1>
        <p className="text-sm text-gray-500">One focused session can change your whole day.</p>
      </div>
      <div className="flex items-center gap-2 md:gap-3 flex-wrap">
        <button
          className={`rounded-lg border px-2.5 md:px-3 py-2 text-xs md:text-sm ${debug ? 'bg-gray-900 text-white' : ''}`}
          onClick={() => {
            const next = !debug
            setDebug(next)
            setDebugEnabled(next)
          }}
        >
          Debug {debug ? 'On' : 'Off'}
        </button>
        <a href="#/tasks" className="btn-primary bg-gradient-primary text-xs md:text-sm">New Task</a>
        {!token && <a href="#/auth" className="rounded-lg border px-2.5 md:px-3 py-2 text-xs md:text-sm">Sign in</a>}
        {token && (
          <button className="rounded-lg border px-2.5 md:px-3 py-2 text-xs md:text-sm" onClick={() => { logout(); window.location.hash = '#/' }}>
            Sign out
          </button>
        )}
      </div>
    </header>
  )
}
