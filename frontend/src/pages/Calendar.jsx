import React, { useEffect, useMemo, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Link2 } from 'lucide-react'
import Card from '../components/Card'
import { apiFetch } from '../lib/api'

function getMonthCells(month) {
  const firstWeekday = new Date(month.getFullYear(), month.getMonth(), 1).getDay()
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  return Array.from({ length: 42 }, (_, index) => {
    const day = index - firstWeekday + 1
    return day >= 1 && day <= daysInMonth ? new Date(month.getFullYear(), month.getMonth(), day) : null
  })
}

function dayKey(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

function formatTime(value, allDay) {
  if (!value || allDay) return 'All day'
  return new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function taskToCalendarItem(task) {
  if (!task.deadline) return null
  return {
    id: `task-${task.id}`,
    source: 'task',
    title: task.title,
    start: task.deadline,
    end: task.deadline,
    allDay: true,
    priority: task.priority,
    completed: task.completed,
  }
}

export default function Calendar() {
  const today = new Date()
  const [month, setMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [selectedDay, setSelectedDay] = useState(today)
  const [googleEvents, setGoogleEvents] = useState([])
  const [tasks, setTasks] = useState([])
  const [googleConnected, setGoogleConnected] = useState(false)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [daySummary, setDaySummary] = useState('')
  const [summaryLoading, setSummaryLoading] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.split('?')[1] || '')
    if (params.get('google') === 'connected') setMessage('Google Calendar connected.')
    if (params.get('google') === 'error') setMessage('Google Calendar connection failed.')
  }, [])

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const status = await apiFetch('/calendar/status')
        setGoogleConnected(Boolean(status.connected))
        const taskRows = await apiFetch('/tasks')
        setTasks(Array.isArray(taskRows) ? taskRows : [])

        if (status.connected) {
          const from = new Date(month.getFullYear(), month.getMonth(), 1).toISOString()
          const to = new Date(month.getFullYear(), month.getMonth() + 1, 1).toISOString()
          const events = await apiFetch(`/calendar/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
          setGoogleEvents(Array.isArray(events) ? events : [])
        } else {
          setGoogleEvents([])
        }
      } catch (error) {
        setMessage(error.message || 'Failed to load calendar.')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [month])

  const calendarItems = useMemo(() => {
    const taskItems = tasks.map(taskToCalendarItem).filter(Boolean)
    return [...googleEvents, ...taskItems]
  }, [googleEvents, tasks])

  const itemsByDay = useMemo(() => {
    const map = {}
    calendarItems.forEach((item) => {
      const key = dayKey(item.start)
      if (!key) return
      if (!map[key]) map[key] = []
      map[key].push(item)
    })
    Object.values(map).forEach((items) => {
      items.sort((a, b) => {
        if (a.allDay !== b.allDay) return a.allDay ? -1 : 1
        return new Date(a.start) - new Date(b.start)
      })
    })
    return map
  }, [calendarItems])

  const selectedItems = itemsByDay[dayKey(selectedDay)] || []
  const cells = getMonthCells(month)

  useEffect(() => {
    setDaySummary('')
  }, [selectedDay, selectedItems.length])

  async function connectGoogle() {
    try {
      const data = await apiFetch('/calendar/auth-url')
      if (data.url) window.location.href = data.url
    } catch (error) {
      setMessage(error.message || 'Unable to start Google Calendar connection.')
    }
  }

  async function generateSummary() {
    setSummaryLoading(true)
    try {
      const dateLabel = selectedDay.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
      const data = await apiFetch('/calendar/day-summary', {
        method: 'POST',
        body: JSON.stringify({ dateLabel, items: selectedItems }),
      })
      setDaySummary(data?.summary || 'No summary generated.')
    } catch (error) {
      setDaySummary(error.message || 'Failed to generate summary.')
    } finally {
      setSummaryLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Calendar</h2>
          <p className="text-sm text-gray-500">Google events and StudyPilot task deadlines in one view.</p>
        </div>
        {!googleConnected && (
          <button className="btn-primary bg-gradient-primary inline-flex items-center gap-2" onClick={connectGoogle}>
            <Link2 className="h-4 w-4" />
            Connect Google Calendar
          </button>
        )}
      </div>

      {message && <div className="rounded-lg border bg-white px-4 py-3 text-sm text-gray-700">{message}</div>}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5" />
              <h3 className="font-semibold">{month.toLocaleDateString([], { month: 'long', year: 'numeric' })}</h3>
            </div>
            <div className="flex items-center gap-2">
              <button className="rounded-lg border p-2" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label="Previous month">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                className="rounded-lg border px-3 py-2 text-sm"
                onClick={() => {
                  setMonth(new Date(today.getFullYear(), today.getMonth(), 1))
                  setSelectedDay(today)
                }}
              >
                Today
              </button>
              <button className="rounded-lg border p-2" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label="Next month">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="mb-2 grid grid-cols-7 gap-2 text-center text-xs font-medium text-gray-500">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <div key={day}>{day}</div>)}
          </div>

          <div className="grid grid-cols-7 gap-2">
            {cells.map((cell, index) => {
              const key = cell ? dayKey(cell) : `empty-${index}`
              const items = cell ? itemsByDay[key] || [] : []
              const isToday = cell && cell.toDateString() === today.toDateString()
              const isSelected = cell && selectedDay && cell.toDateString() === selectedDay.toDateString()

              return (
                <button
                  key={key}
                  className={[
                    'min-h-28 rounded-lg border p-2 text-left align-top transition',
                    cell ? 'bg-white hover:border-violet-300' : 'cursor-default border-transparent bg-transparent',
                    isToday ? 'bg-violet-50' : '',
                    isSelected ? 'border-violet-500 ring-1 ring-violet-300' : '',
                  ].join(' ')}
                  onClick={() => cell && setSelectedDay(cell)}
                  disabled={!cell}
                >
                  {cell && (
                    <>
                      <div className="mb-2 text-sm font-medium">{cell.getDate()}</div>
                      <div className="space-y-1">
                        {items.slice(0, 3).map((item) => (
                          <div
                            key={item.id}
                            className={[
                              'truncate rounded px-2 py-1 text-xs',
                              item.source === 'google' ? 'bg-blue-100 text-blue-800' : '',
                              item.source === 'task' && item.completed ? 'bg-gray-100 text-gray-500 line-through' : '',
                              item.source === 'task' && !item.completed ? 'bg-emerald-100 text-emerald-800' : '',
                            ].join(' ')}
                          >
                            {item.title}
                          </div>
                        ))}
                        {items.length > 3 && <div className="text-xs text-gray-500">+{items.length - 3} more</div>}
                      </div>
                    </>
                  )}
                </button>
              )
            })}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold">Day details</h3>
            <button
              className="rounded-lg border px-3 py-2 text-xs font-medium hover:bg-gray-50 disabled:opacity-50"
              onClick={generateSummary}
              disabled={summaryLoading || loading}
            >
              {summaryLoading ? 'Generating...' : 'AI Describe Day'}
            </button>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            {selectedDay.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </p>

          {daySummary && (
            <div className="mt-3 rounded-lg border border-violet-200 bg-violet-50 p-3">
              <p className="text-sm whitespace-pre-wrap text-violet-900">{daySummary}</p>
            </div>
          )}

          <div className="mt-4 space-y-3">
            {loading && <p className="text-sm text-gray-500">Loading calendar...</p>}
            {!loading && selectedItems.length === 0 && <p className="text-sm text-gray-500">Nothing scheduled.</p>}
            {!loading && selectedItems.map((item) => (
              <div key={item.id} className="rounded-lg border p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className={item.completed ? 'font-medium text-gray-500 line-through' : 'font-medium'}>{item.title}</p>
                  <span className={[
                    'rounded px-2 py-1 text-xs font-medium',
                    item.source === 'google' ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800',
                  ].join(' ')}>
                    {item.source === 'google' ? 'Google' : 'Task'}
                  </span>
                </div>
                <p className="text-sm text-gray-500">
                  {item.source === 'google'
                    ? `${formatTime(item.start, item.allDay)}${item.end && !item.allDay ? ` - ${formatTime(item.end, false)}` : ''}`
                    : `${item.priority || 'low'} priority`}
                </p>
                {item.location && <p className="mt-1 text-sm text-gray-500">{item.location}</p>}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
