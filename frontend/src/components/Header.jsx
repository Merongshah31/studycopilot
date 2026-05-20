import React, { useEffect, useState } from 'react'
import { getToken, logout } from '../lib/authClient'
import { apiFetch } from '../lib/api'
import { supabase } from '../lib/supabaseClient'
import { getTheme, setTheme } from '../lib/theme'
import { Moon, Sun } from 'lucide-react'

export default function Header() {
  const [name, setName] = useState('Student')
  const [theme, setThemeState] = useState(getTheme())
  const token = getToken()
  const supabaseToken = localStorage.getItem('sp_supabase_access_token')
  const isAuthed = !!token || !!supabaseToken

  useEffect(() => {
    if (!isAuthed) return
    apiFetch('/users/profile').then((data) => {
      if (data?.name) setName(data.name)
    }).catch(() => {})
  }, [isAuthed])

  return (
    <header className="mb-4 md:mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
      <div>
        <h1 className="text-xl md:text-2xl font-semibold">Welcome back, {name}</h1>
        <p className="text-sm text-gray-500">One focused session can change your whole day.</p>
      </div>
      <div className="flex items-center gap-2 md:gap-3 flex-wrap">
        <button
          className="rounded-lg border px-2.5 md:px-3 py-2 text-xs md:text-sm inline-flex items-center gap-1.5"
          onClick={() => {
            const next = theme === 'dark' ? 'light' : 'dark'
            setTheme(next)
            setThemeState(next)
          }}
        >
          {theme === 'dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          {theme === 'dark' ? 'Light' : 'Dark'}
        </button>
        <a href="#/tasks" className="btn-primary bg-gradient-primary text-xs md:text-sm">New Task</a>
        {!isAuthed && <a href="#/auth" className="rounded-lg border px-2.5 md:px-3 py-2 text-xs md:text-sm">Sign in</a>}
        {isAuthed && (
          <button
            className="rounded-lg border px-2.5 md:px-3 py-2 text-xs md:text-sm"
            onClick={async () => {
              logout()
              if (supabase) {
                try { await supabase.auth.signOut() } catch {}
              }
              window.location.hash = '#/'
            }}
          >
            Sign out
          </button>
        )}
      </div>
    </header>
  )
}
