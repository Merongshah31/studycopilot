import React, { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import Card from '../components/Card'
import Skeleton from '../components/Skeleton'
import { apiFetch } from '../lib/api'
import { pushDebugEvent } from '../lib/debug'

function startOfWeekMonday(date) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function addDays(date, amount) {
  const d = new Date(date)
  d.setDate(d.getDate() + amount)
  return d
}

function dayKey(date) {
  return date.toISOString().slice(0, 10)
}

function suggestedTimeRange(priority) {
  if (priority === 'high') return '8:00 AM - 11:00 AM'
  if (priority === 'medium') return '1:00 PM - 4:00 PM'
  return '7:00 PM - 9:00 PM'
}

export default function WeeklySchedule() {
  const [tasks, setTasks] = useState([])
  const [weekStart, setWeekStart] = useState(startOfWeekMonday(new Date()))
  const [runningAgent, setRunningAgent] = useState(false)
  const [agentMessage, setAgentMessage] = useState('')
  const [selectedTask, setSelectedTask] = useState(null)
  const [dragTask, setDragTask] = useState(null)
  const [dropDay, setDropDay] = useState('')
  const [editing, setEditing] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)
  const [loading, setLoading] = useState(true)
  const [editForm, setEditForm] = useState({
    title: '',
    deadline: '',
    priority: 'medium',
    completed: false,
  })

  useEffect(() => {
    setLoading(true)
    apiFetch('/tasks').then((data) => setTasks(Array.isArray(data) ? data : [])).catch(() => setTasks([])).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const onAgentEvents = (event) => {
      const events = Array.isArray(event?.detail?.events) ? event.detail.events : []
      if (events.includes('TASKS_UPDATED')) {
        setLoading(true)
        apiFetch('/tasks').then((data) => setTasks(Array.isArray(data) ? data : [])).catch(() => setTasks([])).finally(() => setLoading(false))
      }
    }
    window.addEventListener('studypilot:agent-ui-events', onAgentEvents)
    return () => window.removeEventListener('studypilot:agent-ui-events', onAgentEvents)
  }, [])

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, idx) => addDays(weekStart, idx)),
    [weekStart]
  )

  const grouped = useMemo(() => {
    const map = {}
    days.forEach((d) => { map[dayKey(d)] = [] })
    tasks.forEach((task) => {
      if (!task?.deadline) return
      const key = String(task.deadline).slice(0, 10)
      if (map[key]) map[key].push(task)
    })
    Object.values(map).forEach((list) => {
      list.sort((a, b) => {
        const prio = { high: 3, medium: 2, low: 1 }
        return (prio[b.priority] || 0) - (prio[a.priority] || 0)
      })
    })
    return map
  }, [tasks, days])

  const weekLabel = `${days[0].toLocaleDateString([], { month: 'short', day: 'numeric' })} - ${days[6].toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}`
  const now = new Date()

  async function runWeeklyRebalance() {
    setRunningAgent(true)
    setAgentMessage('')
    pushDebugEvent('weekly-rebalance-start', {})
    try {
      const run = await apiFetch('/agent/run', {
        method: 'POST',
        body: JSON.stringify({ request_text: 'susun jadual minggu ini' }),
      })
      setAgentMessage(run?.summary || 'Weekly schedule updated.')
      pushDebugEvent('weekly-rebalance-success', {
        intent: run?.intent || '',
        status: run?.status || '',
        summary: run?.summary || '',
      })
      const events = Array.isArray(run?.ui_events) ? run.ui_events : []
      if (events.length > 0) {
        window.dispatchEvent(new CustomEvent('studypilot:agent-ui-events', { detail: { events } }))
      }
      const data = await apiFetch('/tasks')
      setTasks(Array.isArray(data) ? data : [])
    } catch (error) {
      const msg = error?.message || 'Failed to rebalance weekly schedule.'
      setAgentMessage(msg)
      pushDebugEvent('weekly-rebalance-error', { message: msg })
    } finally {
      setRunningAgent(false)
    }
  }

  function beginEdit(task) {
    if (!task) return
    setEditForm({
      title: task.title || '',
      deadline: task.deadline || '',
      priority: task.priority || 'medium',
      completed: !!task.completed,
    })
    setEditing(true)
  }

  function cancelEdit() {
    setEditing(false)
  }

  async function saveTaskEdit() {
    if (!selectedTask) return
    setSavingEdit(true)
    setAgentMessage('')
    try {
      const updated = await apiFetch(`/tasks/${selectedTask.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          title: editForm.title.trim() || selectedTask.title,
          deadline: editForm.deadline || null,
          priority: editForm.priority || 'medium',
          completed: !!editForm.completed,
        }),
      })
      const list = tasks.map((t) => (t.id === updated.id ? updated : t))
      setTasks(list)
      setSelectedTask(updated)
      setEditing(false)
      setAgentMessage('Task updated successfully.')
      window.dispatchEvent(new CustomEvent('studypilot:agent-ui-events', {
        detail: { events: ['TASKS_UPDATED', 'PLANNER_UPDATED', 'ANALYTICS_UPDATED', 'DASHBOARD_UPDATED'] },
      }))
    } catch (error) {
      setAgentMessage(error?.message || 'Failed to update task.')
    } finally {
      setSavingEdit(false)
    }
  }

  async function moveTaskToDay(task, targetDate) {
    if (!task || !targetDate) return
    setRunningAgent(true)
    setAgentMessage('')
    pushDebugEvent('weekly-drag-reschedule-start', { title: task.title, targetDate })
    try {
      const run = await apiFetch('/agent/run', {
        method: 'POST',
        body: JSON.stringify({
          request_text: `reschedule task "${task.title}" to ${targetDate}`,
        }),
      })
      setAgentMessage(run?.summary || `Moved "${task.title}" to ${targetDate}.`)
      pushDebugEvent('weekly-drag-reschedule-success', {
        intent: run?.intent || '',
        status: run?.status || '',
        summary: run?.summary || '',
      })
      const events = Array.isArray(run?.ui_events) ? run.ui_events : []
      if (events.length > 0) {
        window.dispatchEvent(new CustomEvent('studypilot:agent-ui-events', { detail: { events } }))
      }
      const data = await apiFetch('/tasks')
      const list = Array.isArray(data) ? data : []
      setTasks(list)
      const updated = list.find((x) => x.id === task.id)
      if (updated) setSelectedTask(updated)
    } catch (error) {
      const msg = error?.message || 'Failed to move task.'
      setAgentMessage(msg)
      pushDebugEvent('weekly-drag-reschedule-error', { message: msg })
    } finally {
      setRunningAgent(false)
      setDragTask(null)
      setDropDay('')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Weekly Schedule</h2>
          <p className="text-sm text-gray-500">Your tasks from Monday to Sunday.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <button
            className="rounded-lg border px-3 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-60"
            onClick={runWeeklyRebalance}
            disabled={runningAgent}
          >
            {runningAgent ? 'AI Susun...' : 'AI Susun Week'}
          </button>
          <button className="rounded-lg border p-2" onClick={() => setWeekStart(addDays(weekStart, -7))} aria-label="Previous week">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="rounded-lg border px-3 py-2 text-sm font-medium">{weekLabel}</div>
          <button className="rounded-lg border p-2" onClick={() => setWeekStart(addDays(weekStart, 7))} aria-label="Next week">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      {agentMessage && <div className="rounded-lg border bg-white px-3 py-2 text-sm">{agentMessage}</div>}
      {loading && (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <Card className="p-3">
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {Array.from({ length: 7 }).map((_, idx) => (
                <div key={idx} className="rounded-xl border p-2">
                  <Skeleton className="h-4 w-10 mb-2" />
                  <Skeleton className="h-3 w-16 mb-3" />
                  <Skeleton className="h-14 w-full mb-2" />
                  <Skeleton className="h-14 w-full" />
                </div>
              ))}
            </div>
          </Card>
          <Card className="p-4">
            <Skeleton className="h-5 w-24 mb-3" />
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-5/6 mb-2" />
            <Skeleton className="h-4 w-4/6" />
          </Card>
        </div>
      )}
      {!loading && (
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="overflow-x-auto rounded-xl border bg-white p-3">
          <div className="grid min-w-[840px] lg:min-w-[980px] grid-cols-7 gap-3">
            {days.map((day) => {
              const key = dayKey(day)
              const items = grouped[key] || []
              return (
                <div key={key} className="rounded-xl border bg-gray-50/70 p-2 min-h-[360px] lg:min-h-[520px]">
                  <div
                    onDragOver={(e) => {
                      e.preventDefault()
                      if (dragTask) setDropDay(key)
                    }}
                    onDragLeave={() => {
                      if (dropDay === key) setDropDay('')
                    }}
                    onDrop={(e) => {
                      e.preventDefault()
                      const taskId = e.dataTransfer.getData('text/task-id')
                      const task = tasks.find((t) => t.id === taskId)
                      if (task && key !== String(task.deadline || '').slice(0, 10)) {
                        moveTaskToDay(task, key)
                      } else {
                        setDragTask(null)
                        setDropDay('')
                      }
                    }}
                    className={`rounded-lg p-1 transition ${dropDay === key ? 'bg-violet-100/70' : ''}`}
                  >
                  <p className="text-sm font-semibold">{day.toLocaleDateString([], { weekday: 'short' })}</p>
                  <p className="mb-2 text-xs text-gray-500">{day.toLocaleDateString([], { month: 'short', day: 'numeric' })}</p>
                  <div className="space-y-2">
                    {items.map((task) => {
                      const overdue = !task.completed && task.deadline && new Date(task.deadline) < now
                      const badgeClass = task.priority === 'high'
                        ? 'bg-red-50 text-red-700 border-red-200'
                        : task.priority === 'medium'
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      return (
                        <button
                          key={task.id}
                          type="button"
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData('text/task-id', task.id)
                            e.dataTransfer.effectAllowed = 'move'
                            setDragTask(task)
                          }}
                          onDragEnd={() => {
                            setDragTask(null)
                            setDropDay('')
                          }}
                          onClick={() => {
                            setSelectedTask(task)
                            setEditing(false)
                          }}
                          className={`w-full rounded-lg border bg-white p-2 text-left transition hover:shadow-sm ${
                            overdue ? 'border-red-300' : 'border-gray-200'
                          } ${selectedTask?.id === task.id ? 'ring-2 ring-violet-300' : ''} ${
                            dragTask?.id === task.id ? 'opacity-40 scale-[0.98]' : ''
                          }`}
                        >
                          <p className={`text-xs font-medium leading-5 ${task.completed ? 'line-through text-gray-500' : ''}`}>{task.title}</p>
                          <div className="mt-2 flex items-center justify-between gap-2">
                            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${badgeClass}`}>
                              {(task.priority || 'low').toUpperCase()}
                            </span>
                            {task.completed && <span className="text-[10px] text-gray-500">Done</span>}
                          </div>
                        </button>
                      )
                    })}
                    {dropDay === key && dragTask && (
                      <div className="rounded-lg border-2 border-dashed border-violet-400 bg-violet-50 p-2 text-center text-xs font-medium text-violet-700">
                        Drop here to move "{dragTask.title}"
                      </div>
                    )}
                    {items.length === 0 && (
                      <div className="rounded-lg border border-dashed p-2 text-center text-xs text-gray-400">No tasks</div>
                    )}
                  </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <Card className="p-4 h-fit">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-base font-semibold">Task Info</h3>
            {selectedTask && !editing && (
              <button
                type="button"
                className="rounded-md border px-2.5 py-1 text-xs font-medium hover:bg-gray-50"
                onClick={() => beginEdit(selectedTask)}
              >
                Edit
              </button>
            )}
          </div>
          {!selectedTask && <p className="mt-2 text-sm text-gray-500">Click a task card to see details.</p>}
          {selectedTask && !editing && (
            <div className="mt-3 space-y-3">
              <div>
                <p className="text-xs text-gray-500">Title</p>
                <p className="text-sm font-medium">{selectedTask.title}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-gray-500">Priority</p>
                  <p className="text-sm uppercase">{selectedTask.priority || 'low'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Status</p>
                  <p className="text-sm">{selectedTask.completed ? 'Completed' : 'Open'}</p>
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-500">Deadline</p>
                <p className="text-sm">{selectedTask.deadline || 'No deadline'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Suggested Time</p>
                <p className="text-sm">{suggestedTimeRange(selectedTask.priority || 'low')}</p>
              </div>
            </div>
          )}
          {selectedTask && editing && (
            <div className="mt-3 space-y-3">
              <div>
                <p className="text-xs text-gray-500">Title</p>
                <input
                  className="mt-1 w-full rounded-md border p-2 text-sm"
                  value={editForm.title}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, title: e.target.value }))}
                />
              </div>
              <div>
                <p className="text-xs text-gray-500">Deadline</p>
                <input
                  type="date"
                  className="mt-1 w-full rounded-md border p-2 text-sm"
                  value={editForm.deadline || ''}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, deadline: e.target.value }))}
                />
              </div>
              <div>
                <p className="text-xs text-gray-500">Priority</p>
                <select
                  className="mt-1 w-full rounded-md border p-2 text-sm"
                  value={editForm.priority}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, priority: e.target.value }))}
                >
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!editForm.completed}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, completed: e.target.checked }))}
                />
                Mark as completed
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50"
                  onClick={cancelEdit}
                  disabled={savingEdit}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-primary bg-gradient-primary disabled:opacity-60"
                  onClick={saveTaskEdit}
                  disabled={savingEdit}
                >
                  {savingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          )}
        </Card>
      </div>
      )}
    </div>
  )
}
