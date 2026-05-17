import React from 'react'
import { getToken, loginAsGuest } from '../lib/authClient'
import { ArrowRight, Bot, CalendarCheck2, Clock3, Sparkles } from 'lucide-react'

export default function Home() {
  const token = getToken()
  const [guestError, setGuestError] = React.useState('')

  return (
    <div className="min-h-screen bg-gradient-soft">
      <div className="app-root">
        <div className="rounded-2xl bg-white p-6 md:p-8 shadow-soft">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            <div>
              <p className="inline-flex items-center gap-2 text-sm font-medium text-indigo-700 bg-indigo-50 rounded-full px-3 py-1 mb-4">
                <Sparkles className="h-4 w-4" />
                StudyPilot
              </p>
              <h1 className="text-4xl md:text-5xl font-semibold leading-tight mb-4">Plan Better, Study Smarter, Finish Faster</h1>
              <p className="text-gray-600 max-w-xl mb-6">
                Your personal student copilot for tasks, AI planning, deadlines, focus sessions, and daily momentum.
              </p>
              <div className="flex flex-wrap gap-3">
                {!token && (
                  <>
                    <a href="#/auth" className="btn-primary bg-gradient-primary inline-flex items-center gap-2">
                      Get Started
                      <ArrowRight className="h-4 w-4" />
                    </a>
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

            <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white p-5 md:p-6">
              <p className="text-sm text-gray-500 mb-4">Today at a glance</p>
              <div className="space-y-3">
                <div className="rounded-xl bg-white border border-indigo-100 p-3 flex items-center justify-between">
                  <div className="inline-flex items-center gap-2 text-sm">
                    <CalendarCheck2 className="h-4 w-4 text-indigo-600" />
                    Task Priority
                  </div>
                  <p className="text-sm font-medium">Math Assignment</p>
                </div>
                <div className="rounded-xl bg-white border border-indigo-100 p-3 flex items-center justify-between">
                  <div className="inline-flex items-center gap-2 text-sm">
                    <Clock3 className="h-4 w-4 text-indigo-600" />
                    Focus Block
                  </div>
                  <p className="text-sm font-medium">25 min Focus Session</p>
                </div>
                <div className="rounded-xl bg-white border border-indigo-100 p-3 flex items-center justify-between">
                  <div className="inline-flex items-center gap-2 text-sm">
                    <Bot className="h-4 w-4 text-indigo-600" />
                    AI Suggestion
                  </div>
                  <p className="text-sm font-medium">Study Physics tonight</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-xl bg-white p-5 shadow-soft border border-gray-100">
            <h3 className="font-semibold mb-1">AI Daily Planner</h3>
            <p className="text-sm text-gray-600">Auto-build a practical day plan from your priorities and deadlines.</p>
          </div>
          <div className="rounded-xl bg-white p-5 shadow-soft border border-gray-100">
            <h3 className="font-semibold mb-1">Smart Task Flow</h3>
            <p className="text-sm text-gray-600">Track tasks with priority, completion, and deadline visibility.</p>
          </div>
          <div className="rounded-xl bg-white p-5 shadow-soft border border-gray-100">
            <h3 className="font-semibold mb-1">Study Momentum</h3>
            <p className="text-sm text-gray-600">Use focus sessions and analytics to stay consistent every day.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
