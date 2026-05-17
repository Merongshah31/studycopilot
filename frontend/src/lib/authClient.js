import { apiFetch } from './api'

export async function register(payload) {
  const res = await apiFetch('/auth/register', { method: 'POST', body: JSON.stringify(payload) })
  if (res?.token) localStorage.setItem('sp_token', res.token)
  return res
}

export async function login(payload) {
  const res = await apiFetch('/auth/login', { method: 'POST', body: JSON.stringify(payload) })
  if (res?.token) localStorage.setItem('sp_token', res.token)
  return res
}

export async function loginAsGuest() {
  const res = await apiFetch('/auth/guest', { method: 'POST' })
  if (res?.token) localStorage.setItem('sp_token', res.token)
  return res
}

export function logout() {
  localStorage.removeItem('sp_token')
}

export function getToken() {
  return localStorage.getItem('sp_token')
}

