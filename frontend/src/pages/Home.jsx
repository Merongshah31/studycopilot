import React from 'react'
import { getToken, loginAsGuest } from '../lib/authClient'
import { isDebugEnabled, setDebugEnabled } from '../lib/debug'

export default function Home() {
  const token = getToken()
  const [debug, setDebug] = React.useState(isDebugEnabled())
  const [guestError, setGuestError] = React.useState('')

  return (
    <div className="min-h-screen bg-gradient-soft">
      <div className="app-root">
        <div className="rounded-2xl bg-white p-8 shadow-soft">
          <p className="text-sm font-medium text-gray-500 mb-2">StudyPilot</p>
          <h1 className="text-4xl font-semibold mb-3">Smart Student Assistant</h1>
          <p className="text-gray-600 max-w-2xl mb-6">Manage tasks, AI plans, Pomodoro sessions, and productivity in one place.</p>
          <div className="flex flex-wrap gap-3">
            <button className={`rounded-lg border px-4 py-2 ${debug ? 'bg-gray-900 text-white' : ''}`} onClick={() => { const n = !debug; setDebug(n); setDebugEnabled(n) }}>
              Debug {debug ? 'On' : 'Off'}
            </button>
            {!token && (
              <>
                <a href="#/auth" className="btn-primary bg-gradient-primary">Get Started</a>
                <a href="#/auth" className="rounded-lg border px-4 py-2">Sign In</a>
                <button
                  className="rounded-lg border px-4 py-2"
                  onClick={async () => {
                    setGuestError('')
                    try {
                      await loginAsGuest()
                      window.location.hash = '#/dashboard'
                    } catch (error) {
                      setGuestError(error.message || 'Guest login failed. Check backend connection.')
                    }
                  }}
                >
                  Continue as Guest
                </button>
              </>
            )}
            {token && <a href="#/dashboard" className="btn-primary bg-gradient-primary">Open Dashboard</a>}
          </div>
          {guestError && <p className="mt-3 text-sm text-red-700">{guestError}</p>}
        </div>
      </div>
    </div>
  )
}
