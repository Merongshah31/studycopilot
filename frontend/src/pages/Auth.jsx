import React, { useState } from 'react'
import { login, loginAsGuest, register } from '../lib/authClient'
import { signInWithGoogle } from '../lib/supabaseClient'
import { apiFetch } from '../lib/api'

const MAX_EMAIL_LENGTH = 254
const VALID_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const VALID_DOMAIN_RE = /^[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)+$/

function Rule({ ok, text }) {
  return <p className={`text-xs ${ok ? 'text-emerald-700' : 'text-gray-500'}`}>{ok ? '✓' : '✗'} {text}</p>
}

export default function Auth() {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [course, setCourse] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [checkingEmail, setCheckingEmail] = useState(false)
  const [emailExists, setEmailExists] = useState(false)

  const emailTrim = email.trim()
  const hasAt = emailTrim.includes('@')
  const hasNoSpaces = !/\s/.test(emailTrim)
  const maxLenOk = emailTrim.length <= MAX_EMAIL_LENGTH
  const domainPart = hasAt ? emailTrim.split('@')[1] || '' : ''
  const domainOk = VALID_DOMAIN_RE.test(domainPart)
  const emailFormatOk = VALID_EMAIL_RE.test(emailTrim)
  const emailRulesOk = hasAt && hasNoSpaces && maxLenOk && domainOk && emailFormatOk

  const passLen = password.length >= 8
  const passUpper = /[A-Z]/.test(password)
  const passNum = /\d/.test(password)
  const passSpecial = /[^A-Za-z0-9]/.test(password)
  const passRulesOk = passLen && passUpper && passNum && passSpecial

  async function checkEmailExists(nextEmail) {
    const candidate = String(nextEmail || '').trim().toLowerCase()
    if (!candidate || !VALID_EMAIL_RE.test(candidate)) {
      setEmailExists(false)
      return
    }
    setCheckingEmail(true)
    try {
      const data = await apiFetch(`/auth/check-email?email=${encodeURIComponent(candidate)}`)
      setEmailExists(!!data?.exists)
    } catch {
      setEmailExists(false)
    } finally {
      setCheckingEmail(false)
    }
  }

  async function submit(e) {
    e.preventDefault()
    const normalizedEmail = emailTrim.toLowerCase()
    if (mode === 'register') {
      if (!emailRulesOk) return setErr('Please fix email requirements before continuing.')
      if (emailExists) return setErr('Email already registered.')
      if (!passRulesOk) return setErr('Password does not meet policy requirements.')
    }
    setErr('')
    setLoading(true)
    try {
      if (mode === 'login') await login({ email: normalizedEmail, password })
      else await register({ name, email: normalizedEmail, password, course, subjects: [] })
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
              <input className="w-full p-2 rounded-md border" placeholder="University (optional)" value={course} onChange={(e) => setCourse(e.target.value)} />
            </>
          )}
          <input
            className="w-full p-2 rounded-md border"
            placeholder="Email"
            value={email}
            onChange={(e) => {
              const next = e.target.value
              setEmail(next)
              if (mode === 'register') checkEmailExists(next)
            }}
            required
          />
          {mode === 'register' && (
            <div className="rounded-lg border bg-gray-50 p-3 space-y-1">
              <p className="text-xs font-medium text-gray-700">Email requirements:</p>
              <Rule ok={hasAt} text="Must contain @ symbol" />
              <Rule ok={domainOk} text="Must contain a valid domain (example.com)" />
              <Rule ok={hasNoSpaces} text="No spaces allowed" />
              <Rule ok={emailFormatOk} text="Must be in valid email format" />
              <Rule ok={maxLenOk} text="Maximum 254 characters" />
              <Rule ok={!emailExists && emailTrim.length > 0} text="Email not already registered" />
              {checkingEmail && <p className="text-xs text-gray-500">Checking email availability...</p>}
            </div>
          )}
          <input className="w-full p-2 rounded-md border" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          {mode === 'register' && (
            <div className="rounded-lg border bg-gray-50 p-3 space-y-1">
              <p className="text-xs font-medium text-gray-700">Password must contain:</p>
              <Rule ok={passLen} text="At least 8 characters" />
              <Rule ok={passUpper} text="One uppercase letter" />
              <Rule ok={passNum} text="One number" />
              <Rule ok={passSpecial} text="One special character" />
            </div>
          )}
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
