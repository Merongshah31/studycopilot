import React, { useState } from 'react'
import { login, loginAsGuest, register } from '../lib/authClient'
import { signInWithGoogle } from '../lib/supabaseClient'

export default function Auth() {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [course, setCourse] = useState('')
  const [subjects, setSubjects] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  async function submit(e) {
    e.preventDefault()
    setErr('')
    setLoading(true)
    try {
      if (mode === 'login') await login({ email, password })
      else await register({ name, email, password, course, subjects: subjects.split(',').map((x) => x.trim()).filter(Boolean) })
      window.location.hash = '#/dashboard'
    } catch (error) {
      setErr(error.message || 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-soft flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-soft">
        <h2 className="text-2xl font-semibold mb-4">{mode === 'login' ? 'Sign in to StudyPilot' : 'Create your account'}</h2>
        <form onSubmit={submit} className="space-y-3">
          {mode === 'register' && (
            <>
              <input className="w-full p-2 rounded-md border" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} required />
              <input className="w-full p-2 rounded-md border" placeholder="Course (optional)" value={course} onChange={(e) => setCourse(e.target.value)} />
              <input className="w-full p-2 rounded-md border" placeholder="Subjects (comma separated)" value={subjects} onChange={(e) => setSubjects(e.target.value)} />
            </>
          )}
          <input className="w-full p-2 rounded-md border" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input className="w-full p-2 rounded-md border" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <button className="btn-primary bg-gradient-primary w-full" disabled={loading} type="submit">{loading ? 'Please wait...' : mode === 'login' ? 'Sign in' : 'Create account'}</button>
          <button type="button" className="w-full rounded-lg border px-4 py-2 text-sm" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
            {mode === 'login' ? 'Need an account?' : 'Have an account?'}
          </button>
          {err && <div className="text-red-700 text-sm">{err}</div>}
        </form>
        <div className="mt-4 space-y-2">
          <button className="w-full rounded-lg border px-4 py-2" onClick={async () => { try { await signInWithGoogle() } catch (e) { setErr(e.message || 'Google sign-in failed') } }}>
            Continue with Google
          </button>
          <button
            className="w-full rounded-lg border px-4 py-2"
            onClick={async () => {
              setErr('')
              setLoading(true)
              try {
                await loginAsGuest()
                window.location.hash = '#/dashboard'
              } catch (error) {
                setErr(error.message || 'Guest login failed. Check backend connection.')
              } finally {
                setLoading(false)
              }
            }}
          >
            Continue as Guest
          </button>
        </div>
      </div>
    </div>
  )
}
