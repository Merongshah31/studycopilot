import React, { useEffect, useMemo, useState } from 'react'
import Card from '../components/Card'
import Skeleton from '../components/Skeleton'
import { apiFetch } from '../lib/api'

const PRIORITY_ORDER = { high: 3, medium: 2, low: 1 }

function toDeadlineTime(deadline) {
  if (!deadline) return Number.POSITIVE_INFINITY
  const ts = new Date(deadline).getTime()
  return Number.isNaN(ts) ? Number.POSITIVE_INFINITY : ts
}

function priorityBadgeClass(priority) {
  if (priority === 'high') return 'bg-red-50 text-red-700 border-red-200'
  if (priority === 'medium') return 'bg-amber-50 text-amber-700 border-amber-200'
  return 'bg-emerald-50 text-emerald-700 border-emerald-200'
}

export default function Tasks() {
  const [tasks, setTasks] = useState([])
  const [title, setTitle] = useState('')
  const [deadline, setDeadline] = useState('')
  const [priority, setPriority] = useState('medium')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('open')
  const [sortBy, setSortBy] = useState('priority_due')
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState('')
  const [editTitle, setEditTitle] = useState('')
  const [editDeadline, setEditDeadline] = useState('')
  const [editPriority, setEditPriority] = useState('medium')

  async function load() {
    setLoading(true)
    const data = await apiFetch('/tasks')
    setTasks(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  useEffect(() => { load().catch(() => setTasks([])) }, [])

  useEffect(() => {
    const onAgentEvents = (event) => {
      const events = Array.isArray(event?.detail?.events) ? event.detail.events : []
      if (events.includes('TASKS_UPDATED')) {
        load().catch(() => setTasks([]))
      }
    }
    window.addEventListener('studypilot:agent-ui-events', onAgentEvents)
    return () => window.removeEventListener('studypilot:agent-ui-events', onAgentEvents)
  }, [])

  async function submit(e) {
    e.preventDefault()
    if (!title.trim()) return
    const row = await apiFetch('/tasks', { method: 'POST', body: JSON.stringify({ title, deadline, priority }) })
    setTasks((prev) => [row, ...prev])
    setTitle('')
    setDeadline('')
    setPriority('medium')
  }

  async function toggle(task) {
    const row = await apiFetch(`/tasks/${task.id}`, { method: 'PUT', body: JSON.stringify({ completed: !task.completed }) })
    setTasks((prev) => prev.map((x) => (x.id === row.id ? row : x)))
  }

  async function del(id) {
    await apiFetch(`/tasks/${id}`, { method: 'DELETE' })
    setTasks((prev) => prev.filter((x) => x.id !== id))
  }

  function startEdit(task) {
    setEditingId(task.id)
    setEditTitle(task.title || '')
    setEditDeadline(task.deadline || '')
    setEditPriority(task.priority || 'medium')
  }

  function cancelEdit() {
    setEditingId('')
    setEditTitle('')
    setEditDeadline('')
    setEditPriority('medium')
  }

  async function saveEdit(taskId) {
    const nextTitle = editTitle.trim()
    if (!nextTitle) return
    const row = await apiFetch(`/tasks/${taskId}`, {
      method: 'PUT',
      body: JSON.stringify({
        title: nextTitle,
        deadline: editDeadline || null,
        priority: editPriority || 'medium',
      }),
    })
    setTasks((prev) => prev.map((x) => (x.id === row.id ? row : x)))
    cancelEdit()
  }

  const visibleTasks = useMemo(() => {
    const filtered = tasks.filter((task) => {
      if (priorityFilter !== 'all' && (task.priority || 'low') !== priorityFilter) return false
      if (statusFilter === 'open' && task.completed) return false
      if (statusFilter === 'completed' && !task.completed) return false
      return true
    })

    const list = [...filtered]
    list.sort((a, b) => {
      const pa = PRIORITY_ORDER[a.priority || 'low'] || 0
      const pb = PRIORITY_ORDER[b.priority || 'low'] || 0
      const da = toDeadlineTime(a.deadline)
      const db = toDeadlineTime(b.deadline)

      if (sortBy === 'priority_due') {
        if (pb !== pa) return pb - pa
        if (da !== db) return da - db
        return String(a.title || '').localeCompare(String(b.title || ''))
      }
      if (sortBy === 'due_near') {
        if (da !== db) return da - db
        if (pb !== pa) return pb - pa
        return String(a.title || '').localeCompare(String(b.title || ''))
      }
      if (sortBy === 'priority_only') {
        if (pb !== pa) return pb - pa
        return String(a.title || '').localeCompare(String(b.title || ''))
      }
      return 0
    })
    return list
  }, [tasks, priorityFilter, statusFilter, sortBy])

  return (
    <div className="space-y-4">
      <Card>
        <form onSubmit={submit} className="grid gap-3 md:grid-cols-4">
          <input className="md:col-span-2 p-2 rounded-md border" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Task title" />
          <input className="p-2 rounded-md border" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          <select className="p-2 rounded-md border" value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
          <button className="btn-primary bg-gradient-primary md:col-span-4" type="submit">Add Task</button>
        </form>
      </Card>

      <Card className="p-3">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="flex flex-wrap gap-2">
            {['all', 'high', 'medium', 'low'].map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPriorityFilter(p)}
                className={`rounded-full border px-3 py-1 text-xs ${
                  priorityFilter === p ? 'bg-indigo-600 border-indigo-600 text-white' : 'hover:bg-gray-50'
                }`}
              >
                {p === 'all' ? 'All Priorities' : p[0].toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            {[
              { key: 'open', label: 'Open' },
              { key: 'completed', label: 'Completed' },
              { key: 'all', label: 'All Status' },
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setStatusFilter(item.key)}
                className={`rounded-full border px-3 py-1 text-xs ${
                  statusFilter === item.key ? 'bg-indigo-600 border-indigo-600 text-white' : 'hover:bg-gray-50'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div>
            <select className="w-full rounded-md border p-2 text-sm" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="priority_due">Sort: Priority then Due Date</option>
              <option value="due_near">Sort: Nearest Due Date</option>
              <option value="priority_only">Sort: Priority Only</option>
            </select>
          </div>
        </div>
      </Card>

      <ul className="space-y-2">
        {loading && Array.from({ length: 4 }).map((_, idx) => (
          <li key={`sk-${idx}`} className="rounded-lg border p-3">
            <Skeleton className="h-4 w-52 mb-2" />
            <Skeleton className="h-3 w-24" />
          </li>
        ))}
        {!loading && (
        <>
        {visibleTasks.map((task) => (
          <li key={task.id} className="rounded-lg border p-3 flex items-center justify-between">
            <div className="min-w-0 flex-1 pr-3">
              {editingId === task.id ? (
                <div className="space-y-2">
                  <input
                    className="w-full rounded-md border p-2 text-sm"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder="Task title"
                  />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <input
                      className="rounded-md border p-2 text-sm"
                      type="date"
                      value={editDeadline}
                      onChange={(e) => setEditDeadline(e.target.value)}
                    />
                    <select
                      className="rounded-md border p-2 text-sm"
                      value={editPriority}
                      onChange={(e) => setEditPriority(e.target.value)}
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                </div>
              ) : (
                <>
                  <p className={task.completed ? 'line-through text-gray-500' : ''}>{task.title}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-xs text-gray-500">{task.deadline || 'No deadline'}</span>
                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${priorityBadgeClass(task.priority || 'low')}`}>
                      {(task.priority || 'low').toUpperCase()}
                    </span>
                  </div>
                </>
              )}
            </div>
            <div className="flex gap-2">
              {editingId === task.id ? (
                <>
                  <button className="rounded border px-2 py-1 text-sm" onClick={() => saveEdit(task.id)}>Save</button>
                  <button className="rounded border px-2 py-1 text-sm" onClick={cancelEdit}>Cancel</button>
                </>
              ) : (
                <>
                  <button className="rounded border px-2 py-1 text-sm" onClick={() => startEdit(task)}>Edit</button>
                  <button className="rounded border px-2 py-1 text-sm" onClick={() => toggle(task)}>{task.completed ? 'Undo' : 'Done'}</button>
                  <button className="rounded border px-2 py-1 text-sm text-red-700" onClick={() => del(task.id)}>Delete</button>
                </>
              )}
            </div>
          </li>
        ))}
        {visibleTasks.length === 0 && (
          <li className="rounded-lg border p-4 text-sm text-gray-500">No tasks match current filters.</li>
        )}
        </>
        )}
      </ul>
    </div>
  )
}
