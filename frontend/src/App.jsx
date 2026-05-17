import React from 'react'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import Dashboard from './pages/Dashboard'
import Tasks from './pages/Tasks'
import Planner from './pages/Planner'
import Calendar from './pages/Calendar'
import Analytics from './pages/Analytics'
import Assistant from './pages/Assistant'
import ScheduleImport from './pages/ScheduleImport'

export default function App() {
  const hash = window.location.hash.replace('#', '') || '/dashboard'
  const routeMap = [
    { test: (v) => v.startsWith('/dashboard'), view: Dashboard },
    { test: (v) => v.startsWith('/tasks'), view: Tasks },
    { test: (v) => v.startsWith('/calendar'), view: Calendar },
    { test: (v) => v.startsWith('/planner'), view: Planner },
    { test: (v) => v.startsWith('/analytics'), view: Analytics },
    { test: (v) => v.startsWith('/assistant'), view: Assistant },
    { test: (v) => v.startsWith('/schedule-import'), view: ScheduleImport },
  ]
  const matched = routeMap.find((entry) => entry.test(hash))
  const View = matched ? matched.view : Dashboard

  return (
    <div className="min-h-screen bg-gradient-soft">
      <div className="app-root md:flex md:gap-6">
        <Sidebar />
        <main className="flex-1">
          <Header />
          <View />
        </main>
      </div>
    </div>
  )
}
