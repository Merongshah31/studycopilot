import React from 'react'
import { Home, List, Zap, BarChart2, CalendarDays, Upload, CalendarRange, UserCircle2, HelpCircle, BookOpen } from 'lucide-react'

function Item({ href, icon: Icon, active, children }) {
  return (
    <a href={href} className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${active ? 'bg-gradient-primary text-white' : 'text-gray-700 hover:bg-gray-100'}`}>
      <Icon className="h-4 w-4" />
      <span>{children}</span>
    </a>
  )
}

function MobileItem({ href, icon: Icon, active, children }) {
  return (
    <a
      href={href}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium ${
        active ? 'bg-gradient-primary text-white border-transparent' : 'bg-white text-gray-700'
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      <span>{children}</span>
    </a>
  )
}

export default function Sidebar() {
  const hash = window.location.hash.replace('#', '') || '/'
  return (
    <>
      <div className="md:hidden mb-3 space-y-3">
        <div className="inline-flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-primary text-white text-sm">SP</span>
          <div>
            <div className="text-base font-semibold leading-tight">StudyPilot</div>
            <div className="text-[11px] text-gray-500">Student Life Copilot</div>
          </div>
        </div>
        <nav className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          <MobileItem href="#/dashboard" icon={Home} active={hash.startsWith('/dashboard')}>Dashboard</MobileItem>
          <MobileItem href="#/tasks" icon={List} active={hash.startsWith('/tasks')}>Tasks</MobileItem>
          <MobileItem href="#/calendar" icon={CalendarDays} active={hash.startsWith('/calendar')}>Calendar</MobileItem>
          <MobileItem href="#/weekly-schedule" icon={CalendarRange} active={hash.startsWith('/weekly-schedule')}>Weekly</MobileItem>
          <MobileItem href="#/assistant" icon={Zap} active={hash.startsWith('/assistant')}>Nexa</MobileItem>
          <MobileItem href="#/schedule-import" icon={Upload} active={hash.startsWith('/schedule-import')}>Import</MobileItem>
          <MobileItem href="#/planner" icon={Zap} active={hash.startsWith('/planner')}>Planner</MobileItem>
          <MobileItem href="#/analytics" icon={BarChart2} active={hash.startsWith('/analytics')}>Analytics</MobileItem>
          <MobileItem href="#/profile" icon={UserCircle2} active={hash.startsWith('/profile')}>Profile</MobileItem>
          <MobileItem href="#/guidelines" icon={BookOpen} active={hash.startsWith('/guidelines')}>Guidelines</MobileItem>
          <MobileItem href="#/faq" icon={HelpCircle} active={hash.startsWith('/faq')}>FAQ</MobileItem>
        </nav>
      </div>

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
        <Item href="#/profile" icon={UserCircle2} active={hash.startsWith('/profile')}>Profile Settings</Item>
        <Item href="#/guidelines" icon={BookOpen} active={hash.startsWith('/guidelines')}>Guidelines</Item>
        <Item href="#/faq" icon={HelpCircle} active={hash.startsWith('/faq')}>FAQ</Item>
      </nav>
      </aside>
    </>
  )
}
