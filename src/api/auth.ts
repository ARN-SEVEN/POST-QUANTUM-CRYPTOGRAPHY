import type { AuthSession } from '../types/auth'
import type { MessageOut } from './messages'

const API_BASE_URL = (import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000').replace(/\/+$/, '')

async function readErrorMessage(response: Response) {
  try {
    const body = await response.json()

    if (typeof body?.detail === 'string') return body.detail
    // FastAPI validation errors arrive as a list of { loc, msg, type }.
    if (Array.isArray(body?.detail) && typeof body.detail[0]?.msg === 'string') {
      return body.detail[0].msg
    }
  } catch {
    // Non-JSON error body; fall through to a generic message.
  }

  if (response.status === 503) return 'The auth server is not configured yet.'
  return `Login failed (HTTP ${response.status}).`
}

export async function login(email: string, password: string): Promise<AuthSession> {
  let response: Response

  try {
    response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
  } catch {
    throw new Error(`Could not reach the auth server at ${API_BASE_URL}. Is the backend running?`)
  }

  if (!response.ok) {
    throw new Error(await readErrorMessage(response))
  }

  return (await response.json()) as AuthSession
}
