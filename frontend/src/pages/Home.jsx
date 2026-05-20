import React from 'react'
import { getToken, loginAsGuest } from '../lib/authClient'
import { ArrowRight, Bot, CalendarDays, CheckCircle2, Sparkles } from 'lucide-react'

export default function Home() {
  const token = getToken()
  const [guestError, setGuestError] = React.useState('')

  return (
    <div className="min-h-screen bg-gradient-soft">
      <section
        className="relative overflow-hidden border-b border-white/10"
        style={{
          backgroundImage:
            "linear-gradient(rgba(7,10,24,0.82), rgba(7,10,24,0.86)), url('https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?auto=format&fit=crop&w=1800&q=80')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="app-root">
          <div className="py-16 md:py-24 lg:py-28 text-center">
            <p className="inline-flex items-center gap-2 text-sm font-medium text-indigo-200/95 border border-indigo-300/30 rounded-full px-3 py-1 mb-5">
              <Sparkles className="h-4 w-4" />
              StudyPilot
            </p>
            <h1 className="text-4xl md:text-6xl font-semibold leading-tight text-white max-w-4xl mx-auto">
              The AI Student Copilot That Plans, Prioritizes, and Executes
            </h1>
            <p className="text-slate-200/95 text-base md:text-xl max-w-3xl mx-auto mt-5">
              Manage deadlines, structure weekly study plans, and get actionable support from Nexa across tasks, planner, analytics, and calendar.
            </p>
            <div className="flex flex-wrap justify-center gap-3 mt-8">
              {!token && (
                <>
                  <a href="#/auth" className="btn-primary bg-gradient-primary inline-flex items-center gap-2">
                    Get Started
                    <ArrowRight className="h-4 w-4" />
                  </a>
                  <a href="#/auth" className="rounded-lg border border-white/25 bg-white/10 text-white px-4 py-2">Sign In</a>
                  <button
                    className="rounded-lg border border-white/25 bg-white/10 text-white px-4 py-2"
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
            {guestError && <p className="mt-3 text-sm text-red-300">{guestError}</p>}
          </div>
        </div>
      </section>

      <div className="app-root mt-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-xl bg-white p-5 shadow-soft border border-gray-100">
            <div className="inline-flex h-8 w-8 rounded-lg bg-indigo-50 items-center justify-center mb-2">
              <Bot className="h-4 w-4 text-indigo-600" />
            </div>
            <h3 className="font-semibold mb-1">Nexa Assistant</h3>
            <p className="text-sm text-gray-600">Ask naturally, get clear plans, and receive actionable next steps.</p>
          </div>
          <div className="rounded-xl bg-white p-5 shadow-soft border border-gray-100">
            <div className="inline-flex h-8 w-8 rounded-lg bg-indigo-50 items-center justify-center mb-2">
              <CheckCircle2 className="h-4 w-4 text-indigo-600" />
            </div>
            <h3 className="font-semibold mb-1">Smart Task Execution</h3>
            <p className="text-sm text-gray-600">Track, sort, and update tasks with clear priority and deadline control.</p>
          </div>
          <div className="rounded-xl bg-white p-5 shadow-soft border border-gray-100">
            <div className="inline-flex h-8 w-8 rounded-lg bg-indigo-50 items-center justify-center mb-2">
              <CalendarDays className="h-4 w-4 text-indigo-600" />
            </div>
            <h3 className="font-semibold mb-1">Planning + Calendar Sync</h3>
            <p className="text-sm text-gray-600">Build weekly plans and coordinate timeline decisions in one flow.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
