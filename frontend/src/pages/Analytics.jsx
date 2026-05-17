import React, { useEffect, useState } from 'react'
import Card from '../components/Card'
import { apiFetch } from '../lib/api'

function HorizontalBar({ label, value, max, color }) {
  const percent = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-700">{label}</span>
        <span className="font-medium">{value}</span>
      </div>
      <div className="h-2 rounded bg-gray-100 overflow-hidden">
        <div className={`h-2 ${color}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}

function Pill({ label, tone }) {
  return <span className={`px-2 py-1 text-xs rounded-full ${tone}`}>{label}</span>
}

export default function Analytics() {
  const [data, setData] = useState(null)
  async function loadAnalytics() {
    const d = await apiFetch('/analytics/overview')
    setData(d)
  }
  useEffect(() => { loadAnalytics().catch(() => {}) }, [])
  useEffect(() => {
    const onAgentEvents = (event) => {
      const events = Array.isArray(event?.detail?.events) ? event.detail.events : []
      if (events.includes('ANALYTICS_UPDATED') || events.includes('TASKS_UPDATED')) {
        loadAnalytics().catch(() => {})
      }
    }
    window.addEventListener('studypilot:agent-ui-events', onAgentEvents)
    return () => window.removeEventListener('studypilot:agent-ui-events', onAgentEvents)
  }, [])
  const priority = data?.charts?.priorityBreakdown || { high: 0, medium: 0, low: 0 }
  const status = data?.charts?.statusBreakdown || { completed: 0, open: 0, overdue: 0 }
  const weekly = data?.charts?.weeklyTrend || []
  const timeline = data?.charts?.timeline || { morning: 0, afternoon: 0, night: 0 }
  const maxPriority = Math.max(priority.high, priority.medium, priority.low, 1)
  const maxStatus = Math.max(status.completed, status.open, status.overdue, 1)
  const maxWeek = Math.max(...weekly.map((d) => Math.max(d.done || 0, d.created || 0)), 1)
  const maxTimeline = Math.max(timeline.morning || 0, timeline.afternoon || 0, timeline.night || 0, 1)

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Analytics</h2>
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="p-4"><p className="text-sm text-gray-500">Completed Tasks</p><p className="text-2xl font-semibold">{data?.totals?.completedTasks ?? 0}</p></Card>
        <Card className="p-4"><p className="text-sm text-gray-500">Completion Rate</p><p className="text-2xl font-semibold">{data?.totals?.completionRate ?? 0}%</p></Card>
        <Card className="p-4"><p className="text-sm text-gray-500">Productivity</p><p className="text-2xl font-semibold">{data?.totals?.productivityScore ?? 0}%</p></Card>
        <Card className="p-4"><p className="text-sm text-gray-500">Overdue</p><p className="text-2xl font-semibold">{data?.totals?.overdueOpenTasks ?? 0}</p></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-4 space-y-3">
          <h3 className="font-semibold">Tasks by Priority</h3>
          <HorizontalBar label="High" value={priority.high} max={maxPriority} color="bg-rose-500" />
          <HorizontalBar label="Medium" value={priority.medium} max={maxPriority} color="bg-amber-500" />
          <HorizontalBar label="Low" value={priority.low} max={maxPriority} color="bg-emerald-500" />
        </Card>

        <Card className="p-4 space-y-3">
          <h3 className="font-semibold">Task Status</h3>
          <HorizontalBar label="Completed" value={status.completed} max={maxStatus} color="bg-indigo-500" />
          <HorizontalBar label="Open" value={status.open} max={maxStatus} color="bg-sky-500" />
          <HorizontalBar label="Overdue" value={status.overdue} max={maxStatus} color="bg-rose-600" />
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-4">
          <h3 className="font-semibold mb-3">7-Day Trend</h3>
          <div className="grid grid-cols-7 gap-2 items-end h-40">
            {weekly.map((d, idx) => {
              const createdH = Math.max(8, Math.round(((d.created || 0) / maxWeek) * 120))
              const doneH = Math.max(8, Math.round(((d.done || 0) / maxWeek) * 120))
              return (
                <div key={`${d.day}-${idx}`} className="flex flex-col items-center gap-1">
                  <div className="w-full flex items-end justify-center gap-1 h-32">
                    <div className="w-3 rounded bg-cyan-300" style={{ height: `${createdH}px` }} title={`Created: ${d.created || 0}`} />
                    <div className="w-3 rounded bg-indigo-500" style={{ height: `${doneH}px` }} title={`Done: ${d.done || 0}`} />
                  </div>
                  <p className="text-xs text-gray-500">{d.day}</p>
                </div>
              )
            })}
          </div>
          <div className="mt-2 flex gap-3 text-xs text-gray-500">
            <span><span className="inline-block w-2 h-2 rounded bg-cyan-300 mr-1" />Created</span>
            <span><span className="inline-block w-2 h-2 rounded bg-indigo-500 mr-1" />Completed</span>
          </div>
        </Card>

        <Card className="p-4 space-y-3">
          <h3 className="font-semibold">Daily Load Split</h3>
          <HorizontalBar label="Morning" value={timeline.morning || 0} max={maxTimeline} color="bg-blue-400" />
          <HorizontalBar label="Afternoon" value={timeline.afternoon || 0} max={maxTimeline} color="bg-violet-500" />
          <HorizontalBar label="Night" value={timeline.night || 0} max={maxTimeline} color="bg-slate-500" />
        </Card>
      </div>

      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Analysis Summary</h3>
          <Pill
            label={data?.insights?.productivityBand || 'No data'}
            tone={
              (data?.insights?.productivityBand || '') === 'High'
                ? 'bg-emerald-100 text-emerald-700'
                : (data?.insights?.productivityBand || '') === 'Moderate'
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-rose-100 text-rose-700'
            }
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-lg border p-3"><p className="text-xs text-gray-500">Due Soon</p><p className="text-xl font-semibold">{data?.totals?.dueSoonTasks ?? 0}</p></div>
          <div className="rounded-lg border p-3"><p className="text-xs text-gray-500">Created (7 days)</p><p className="text-xl font-semibold">{data?.totals?.createdThisWeek ?? 0}</p></div>
          <div className="rounded-lg border p-3"><p className="text-xs text-gray-500">Peak Daily Load</p><p className="text-xl font-semibold">{data?.totals?.maxLoad ?? 0}</p></div>
        </div>
        <ul className="list-disc pl-5 text-sm text-gray-700 space-y-1">
          {(data?.insights?.recommendations || []).map((line, idx) => <li key={idx}>{line}</li>)}
        </ul>
      </Card>
    </div>
  )
}
