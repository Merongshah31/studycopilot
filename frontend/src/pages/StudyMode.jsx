import React, { useEffect, useState } from 'react'
import Card from '../components/Card'
import { apiFetch } from '../lib/api'

const FOCUS = 25 * 60
const BREAK = 5 * 60

function format(seconds) {
  const m = String(Math.floor(seconds / 60)).padStart(2, '0')
  const s = String(seconds % 60).padStart(2, '0')
  return `${m}:${s}`
}

export default function StudyMode() {
  const [mode, setMode] = useState('focus')
  const [running, setRunning] = useState(false)
  const [remaining, setRemaining] = useState(FOCUS)
  const [sessions, setSessions] = useState([])

  useEffect(() => { apiFetch('/study/sessions').then((rows) => setSessions(Array.isArray(rows) ? rows : [])).catch(() => {}) }, [])

  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setRemaining((v) => (v <= 1 ? 0 : v - 1)), 1000)
    return () => clearInterval(id)
  }, [running])

  useEffect(() => {
    if (remaining > 0) return
    if (mode === 'focus') {
      apiFetch('/study/sessions', { method: 'POST', body: JSON.stringify({ mode: 'focus', duration: 25 }) })
        .then((row) => setSessions((prev) => [row, ...prev]))
        .catch(() => {})
      setMode('break')
      setRemaining(BREAK)
      setRunning(false)
      return
    }
    setMode('focus')
    setRemaining(FOCUS)
    setRunning(false)
  }, [remaining, mode])

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Study Mode</h2>
      <Card className="p-6">
        <p className="text-sm text-gray-500 mb-2">{mode === 'focus' ? 'Focus Block' : 'Break Block'}</p>
        <p className="text-5xl font-semibold mb-4">{format(remaining)}</p>
        <div className="flex gap-2">
          <button className="btn-primary bg-gradient-primary" onClick={() => setRunning((v) => !v)}>{running ? 'Pause' : 'Start'}</button>
          <button className="rounded-lg border px-4 py-2" onClick={() => { setRunning(false); setRemaining(mode === 'focus' ? FOCUS : BREAK) }}>Reset</button>
        </div>
      </Card>
      <Card className="p-4">
        <h3 className="font-semibold mb-2">Completed Sessions</h3>
        <ul className="space-y-2">
          {sessions.map((s) => <li key={s.id} className="text-sm">{s.duration} min {s.mode} · {new Date(s.completedAt).toLocaleString()}</li>)}
        </ul>
      </Card>
    </div>
  )
}

