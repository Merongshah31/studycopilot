import React, { useEffect, useState } from 'react'
import { getDebugSnapshot, isDebugEnabled, onDebugEvent } from '../lib/debug'

export default function DebugPanel() {
  const [enabled, setEnabled] = useState(isDebugEnabled())
  const [snapshot, setSnapshot] = useState(getDebugSnapshot())
  const [events, setEvents] = useState([])

  useEffect(() => {
    return onDebugEvent((event) => {
      setEnabled(isDebugEnabled())
      setSnapshot(getDebugSnapshot())
      if (event?.type !== 'debug-toggle') setEvents((prev) => [event, ...prev].slice(0, 40))
    })
  }, [])

  if (!enabled) return null

  return (
    <aside className="fixed bottom-4 right-4 z-50 w-[420px] max-w-[95vw] rounded-xl border bg-white shadow-elevated">
      <div className="border-b px-3 py-2 text-sm font-semibold">Debug Mode</div>
      <div className="p-3 text-xs space-y-2">
        <p>API: {snapshot.apiBase}</p>
        <p>App token: {snapshot.hasAppToken ? 'ok' : 'missing'}</p>
        <p>Supabase URL: {snapshot.hasSupabaseUrl ? 'ok' : 'missing'}</p>
        <p>Supabase anon key: {snapshot.hasSupabaseAnonKey ? 'ok' : 'missing'}</p>
        <p>Supabase access token: {snapshot.hasSupabaseToken ? 'ok' : 'missing'}</p>
        <div className="max-h-56 overflow-y-auto rounded border p-2 bg-gray-50 space-y-1">
          {events.map((event) => (
            <div key={event.id} className="rounded border bg-white p-2">
              <p className="font-medium">{event.type}</p>
              <pre className="whitespace-pre-wrap break-words">{JSON.stringify(event.payload || {}, null, 2)}</pre>
            </div>
          ))}
        </div>
      </div>
    </aside>
  )
}

