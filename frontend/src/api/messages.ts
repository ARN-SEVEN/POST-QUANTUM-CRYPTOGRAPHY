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

/** Row shape returned by the backend; snake_case, unlike the camelCase UI model. */
interface RawMessageOut {
  id: string
  sender_id: string
  sender_name: string | null
  content: string
  sent_at: string
}

function toMessageOut(row: RawMessageOut): MessageOut {
  return {
    id: row.id,
    senderId: row.sender_id,
    senderName: row.sender_name,
    content: row.content,
    sentAt: row.sent_at,
  }
}

export async function listMessages(token: string, chatId: string): Promise<MessageOut[]> {
  const rows = await request<RawMessageOut[]>(`/messages?chat=${encodeURIComponent(chatId)}`, token)
  return rows.map(toMessageOut)
}

export async function sendMessage(token: string, content: string, chatId: string): Promise<MessageOut> {
  const row = await request<RawMessageOut>('/messages', token, {
    method: 'POST',
    body: JSON.stringify({ content, chat_id: chatId }),
  })
  return toMessageOut(row)
}
export type { MessageOut } from '../types/message'
