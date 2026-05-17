import React, { useEffect, useState } from 'react'
import Card from '../components/Card'
import { apiFetch } from '../lib/api'

export default function Tasks() {
  const [tasks, setTasks] = useState([])
  const [title, setTitle] = useState('')
  const [deadline, setDeadline] = useState('')
  const [priority, setPriority] = useState('medium')

  async function load() {
    const data = await apiFetch('/tasks')
    setTasks(Array.isArray(data) ? data : [])
  }

  useEffect(() => { load().catch(() => setTasks([])) }, [])

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
      <ul className="space-y-2">
        {tasks.map((task) => (
          <li key={task.id} className="rounded-lg border p-3 flex items-center justify-between">
            <div>
              <p className={task.completed ? 'line-through text-gray-500' : ''}>{task.title}</p>
              <p className="text-xs text-gray-500">{task.deadline || 'No deadline'} · {task.priority}</p>
            </div>
            <div className="flex gap-2">
              <button className="rounded border px-2 py-1 text-sm" onClick={() => toggle(task)}>{task.completed ? 'Undo' : 'Done'}</button>
              <button className="rounded border px-2 py-1 text-sm text-red-700" onClick={() => del(task.id)}>Delete</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

