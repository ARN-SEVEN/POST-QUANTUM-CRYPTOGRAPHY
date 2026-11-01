/** Chat list request helper. */

import type { Chat, RawChat } from '../types/chat'

const API_BASE_URL = (import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000').replace(/\/+$/, '')

function toChat(row: RawChat): Chat {
  return {
    id: row.id,
    name: row.name,
    isGroup: row.is_group,
    lastMessage: row.last_message,
    lastMessageAt: row.last_message_at,
  }
}

export async function listChats(token: string): Promise<Chat[]> {
  let response: Response

  try {
    response = await fetch(`${API_BASE_URL}/chats`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  } catch {
    throw new Error(`Could not reach the auth server at ${API_BASE_URL}. Is the backend running?`)
  }

  if (!response.ok) {
    const body = await response.json().catch(() => null)
    const detail = body?.detail
    throw new Error(typeof detail === 'string' ? detail : `Could not load chats (HTTP ${response.status}).`)
  }

  const rows = (await response.json()) as RawChat[]
  return rows.map(toChat)
}
