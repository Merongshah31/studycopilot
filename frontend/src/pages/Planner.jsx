import React, { useEffect, useState } from 'react'
import Card from '../components/Card'
import { apiFetch } from '../lib/api'

export default function Planner() {
  const [timeline, setTimeline] = useState({ morning: [], afternoon: [], night: [] })
  useEffect(() => {
    apiFetch('/planner/daily').then((data) => setTimeline(data?.timeline || { morning: [], afternoon: [], night: [] })).catch(() => {})
  }, [])

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">AI Daily Planner</h2>
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
    </div>
  )
}

