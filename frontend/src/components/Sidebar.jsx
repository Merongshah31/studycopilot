import React from 'react'
import { Home, List, Zap, BarChart2, CalendarDays, Upload, CalendarRange } from 'lucide-react'

function Item({ href, icon: Icon, active, children }) {
  return (
    <a href={href} className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${active ? 'bg-gradient-primary text-white' : 'text-gray-700 hover:bg-gray-100'}`}>
      <Icon className="h-4 w-4" />
      <span>{children}</span>
    </a>
  )
}

export default function Sidebar() {
  const hash = window.location.hash.replace('#', '') || '/'
  return (
    <aside className="w-56 lg:w-64 pr-4 lg:pr-6 hidden md:block shrink-0">
      <div className="mb-6">
        <div className="inline-flex items-center gap-3">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-primary text-white">SP</span>
          <div>
            <div className="text-lg font-semibold">StudyPilot</div>
            <div className="text-xs text-gray-500">Student Life Copilot</div>
          </div>
        </div>
      </div>
      <nav className="space-y-2">
        <Item href="#/dashboard" icon={Home} active={hash.startsWith('/dashboard')}>Dashboard</Item>
        <Item href="#/tasks" icon={List} active={hash.startsWith('/tasks')}>Tasks</Item>
        <Item href="#/calendar" icon={CalendarDays} active={hash.startsWith('/calendar')}>Calendar</Item>
        <Item href="#/weekly-schedule" icon={CalendarRange} active={hash.startsWith('/weekly-schedule')}>Weekly Schedule</Item>
        <Item href="#/assistant" icon={Zap} active={hash.startsWith('/assistant')}>AI Assistant</Item>
        <Item href="#/schedule-import" icon={Upload} active={hash.startsWith('/schedule-import')}>Schedule Import</Item>
        <Item href="#/planner" icon={Zap} active={hash.startsWith('/planner')}>Planner</Item>
        <Item href="#/analytics" icon={BarChart2} active={hash.startsWith('/analytics')}>Analytics</Item>
      </nav>
    </aside>
  )
}
