/** Messages request helpers for the auth API.

All requests go to the backend at VITE_API_URL, or http://127.0.0.1:8000 by
default. Messages are scoped to the authenticated user: the token passed in the
Authorization header is the one returned by POST /auth/login.
*/

import type { MessageOut } from '../types/message'

async function readMessageError(response: Response): Promise<string> {
  try {
    const body = await response.json()

    if (typeof body?.detail === 'string') return body.detail
    if (Array.isArray(body?.detail) && typeof body.detail[0]?.msg === 'string') {
      return body.detail[0].msg
    }
  } catch {
    // Non-JSON error body; fall through to a generic message.
  }

  if (response.status === 503) return 'The auth server is not configured yet.'
  return `Request failed (HTTP ${response.status}).`
}

async function request<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    ...init,
  })

  if (!response.ok) {
    throw new Error(await readMessageError(response))
  }

  return (await response.json()) as T
}

export async function listMessages(token: string): Promise<MessageOut[]> {
  return request<MessageOut[]>('/messages', token)
}

export async function sendMessage(token: string, content: string): Promise<MessageOut> {
  return request<MessageOut>('/messages', token, {
    method: 'POST',
    body: JSON.stringify({ content }),
  })
}
export type { MessageOut } from '../types/message'
