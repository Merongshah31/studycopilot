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
    <header className="mb-6 flex items-center justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold">Welcome back, {name}</h1>
        <p className="text-sm text-gray-500">One focused session can change your whole day.</p>
      </div>
      <div className="flex items-center gap-3">
        <button
          className={`rounded-lg border px-3 py-2 text-sm ${debug ? 'bg-gray-900 text-white' : ''}`}
          onClick={() => {
            const next = !debug
            setDebug(next)
            setDebugEnabled(next)
          }}
        >
          Debug {debug ? 'On' : 'Off'}
        </button>
        <a href="#/tasks" className="btn-primary bg-gradient-primary">New Task</a>
        {!token && <a href="#/auth" className="rounded-lg border px-3 py-2 text-sm">Sign in</a>}
        {token && (
          <button className="rounded-lg border px-3 py-2 text-sm" onClick={() => { logout(); window.location.hash = '#/' }}>
            Sign out
          </button>
        )}
      </div>
    </header>
  )
}

