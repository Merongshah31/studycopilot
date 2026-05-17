import React, { useEffect, useMemo, useState } from 'react'
import Card from '../components/Card'
import { apiFetch } from '../lib/api'

function Stat({ title, value }) {
  return (
    <Card className="p-4">
      <p className="text-sm text-gray-500">{title}</p>
      <p className="text-2xl font-semibold">{value}</p>
    </Card>
  )
}

export default function Dashboard() {
  const [tasks, setTasks] = useState([])
  const [analytics, setAnalytics] = useState(null)
  const [suggestions, setSuggestions] = useState([])

  async function loadDashboard() {
    const [t, a, s] = await Promise.all([
      apiFetch('/tasks').catch(() => []),
      apiFetch('/analytics/overview').catch(() => null),
      apiFetch('/assistant/suggestions').catch(() => ({ suggestions: [] })),
    ])
    setTasks(Array.isArray(t) ? t : [])
    setAnalytics(a)
    setSuggestions(Array.isArray(s?.suggestions) ? s.suggestions : [])
  }

  useEffect(() => {
    loadDashboard().catch(() => {})
  }, [])

  useEffect(() => {
    const onAgentEvents = (event) => {
      const events = Array.isArray(event?.detail?.events) ? event.detail.events : []
      if (events.some((e) => ['TASKS_UPDATED', 'PLANNER_UPDATED', 'ANALYTICS_UPDATED'].includes(e))) {
        loadDashboard().catch(() => {})
      }
    }
    window.addEventListener('studypilot:agent-ui-events', onAgentEvents)
    return () => window.removeEventListener('studypilot:agent-ui-events', onAgentEvents)
  }, [])

  const upcoming = useMemo(() => tasks.filter((t) => !t.completed && t.deadline).sort((a, b) => (a.deadline || '').localeCompare(b.deadline || '')).slice(0, 5), [tasks])

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Stat title="Today's tasks" value={tasks.filter((t) => !t.completed).length} />
        <Stat title="Completed tasks" value={analytics?.totals?.completedTasks ?? 0} />
        <Stat title="Productivity" value={`${analytics?.totals?.productivityScore ?? 0}%`} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h3 className="text-lg font-semibold mb-2">Upcoming deadlines</h3>
          <div className="space-y-2">
            {upcoming.length === 0 && <p className="text-sm text-gray-500">No upcoming deadlines right now.</p>}
            {upcoming.map((task) => <div key={task.id} className="rounded-lg border p-3"><p className="font-medium">{task.title}</p><p className="text-xs text-gray-500">{task.deadline}</p></div>)}
          </div>
        </Card>
        <Card>
          <h3 className="text-lg font-semibold mb-2">AI Suggestions</h3>
          <ul className="space-y-2 text-sm text-gray-600">
            {suggestions.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </Card>
      </div>
    </div>
  )
}
