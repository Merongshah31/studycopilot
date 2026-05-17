import React, { useEffect, useState } from 'react'
import Card from '../components/Card'
import Skeleton from '../components/Skeleton'
import { apiFetch } from '../lib/api'

export default function Planner() {
  const [timeline, setTimeline] = useState({ morning: [], afternoon: [], night: [] })
  const [loading, setLoading] = useState(true)

  async function loadPlanner() {
    setLoading(true)
    const data = await apiFetch('/planner/daily')
    setTimeline(data?.timeline || { morning: [], afternoon: [], night: [] })
    setLoading(false)
  }

  useEffect(() => {
    loadPlanner().catch(() => {})
  }, [])

  useEffect(() => {
    const onAgentEvents = (event) => {
      const events = Array.isArray(event?.detail?.events) ? event.detail.events : []
      if (events.includes('PLANNER_UPDATED') || events.includes('TASKS_UPDATED')) {
        loadPlanner().catch(() => {})
      }
    }
    window.addEventListener('studypilot:agent-ui-events', onAgentEvents)
    return () => window.removeEventListener('studypilot:agent-ui-events', onAgentEvents)
  }, [])

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">AI Daily Planner</h2>
      {loading && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {['a', 'b', 'c'].map((k) => (
            <Card key={k} className="p-4">
              <Skeleton className="h-5 w-24 mb-3" />
              <Skeleton className="h-16 w-full mb-2" />
              <Skeleton className="h-16 w-full" />
            </Card>
          ))}
        </div>
      )}
      {!loading && (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {['morning', 'afternoon', 'night'].map((slot) => (
          <Card key={slot} className="p-4">
            <h3 className="font-semibold mb-3 capitalize">{slot}</h3>
            <div className="space-y-2">
              {(timeline[slot] || []).map((item) => (
                <div key={item.id} className="rounded-lg border p-3">
                  <p className="font-medium">{item.title}</p>
                  <p className="text-xs text-gray-500">{item.priority} · {item.suggestedMinutes} min</p>
                </div>
              ))}
              {(timeline[slot] || []).length === 0 && <p className="text-sm text-gray-500">No items.</p>}
            </div>
          </Card>
        ))}
      </div>
      )}
    </div>
  )
}
