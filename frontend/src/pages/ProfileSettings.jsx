import React, { useEffect, useState } from 'react'
import Card from '../components/Card'
import Skeleton from '../components/Skeleton'
import { apiFetch } from '../lib/api'

export default function ProfileSettings() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    name: '',
    email: '',
    course: '',
    subjectsText: '',
  })

  useEffect(() => {
    async function loadProfile() {
      setLoading(true)
      setError('')
      try {
        const data = await apiFetch('/users/profile')
        setForm({
          name: data?.name || '',
          email: data?.email || '',
          course: data?.course || '',
          subjectsText: Array.isArray(data?.subjects) ? data.subjects.join(', ') : '',
        })
      } catch (err) {
        setError(err?.message || 'Failed to load profile.')
      } finally {
        setLoading(false)
      }
    }
    loadProfile()
  }, [])

  async function saveProfile(e) {
    e.preventDefault()
    setSaving(true)
    setMessage('')
    setError('')
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        course: form.course.trim(),
        subjects: form.subjectsText.split(',').map((x) => x.trim()).filter(Boolean),
      }
      await apiFetch('/users/profile', { method: 'PUT', body: JSON.stringify(payload) })
      setMessage('Profile updated successfully.')
    } catch (err) {
      setError(err?.message || 'Failed to update profile.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Profile Settings</h2>
        <p className="text-sm text-gray-500">Update your personal profile and study context.</p>
      </div>

      <Card className="p-4 md:p-6">
        {loading && (
          <div className="space-y-3">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-20 w-full" />
          </div>
        )}

        {!loading && (
          <form onSubmit={saveProfile} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Full Name</label>
                <input
                  className="w-full rounded-md border p-2 text-sm"
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                <input
                  type="email"
                  className="w-full rounded-md border p-2 text-sm"
                  value={form.email}
                  onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Course</label>
              <input
                className="w-full rounded-md border p-2 text-sm"
                value={form.course}
                onChange={(e) => setForm((prev) => ({ ...prev, course: e.target.value }))}
                placeholder="Example: Software Engineering"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Subjects</label>
              <textarea
                rows={3}
                className="w-full rounded-md border p-2 text-sm"
                value={form.subjectsText}
                onChange={(e) => setForm((prev) => ({ ...prev, subjectsText: e.target.value }))}
                placeholder="Math, Data Structure, Software Architecture"
              />
            </div>

            {message && <p className="text-sm text-emerald-700">{message}</p>}
            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex justify-end">
              <button className="btn-primary bg-gradient-primary disabled:opacity-60" type="submit" disabled={saving}>
                {saving ? 'Saving...' : 'Save Profile'}
              </button>
            </div>
          </form>
        )}
      </Card>
    </div>
  )
}
