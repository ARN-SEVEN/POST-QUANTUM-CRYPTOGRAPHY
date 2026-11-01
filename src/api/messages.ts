import type { Message } from '../types/message'

const API_BASE_URL = (import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000').replace(/\/+$/, '')

async function fetchWithAuth(path: string, init?: RequestInit, auth: { token: string }) {
  return fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${auth.token}`,
    } as RequestInit['headers'],
  })
}

function messageFromRow(row: Record<string, unknown>): Message {
  const sentAt = new Date(row.sent_at as string)
  return {
    id: String(row.id),
    sender: (row.sender as { display_name?: string } | null)?.display_name ?? 'Unknown',
    content: String(row.content),
    timestamp: sentAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
  }
}

export async function fetchMessages(auth: { token: string }): Promise<Message[]> {
  const response = await fetchWithAuth('/messages', undefined, auth)
  if (!response.ok) {
    if (response.status === 503) throw new Error('Messages are not available yet.')
    throw new Error(`Could not load messages (HTTP ${response.status}).`)
  }
  const data = (await response.json()) as { messages: Array<Record<string, unknown>> }
  return data.messages.map(messageFromRow)
}

export async function sendMessage(content: string, auth: { token: string }): Promise<Message> {
  const response = await fetchWithAuth('/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  }, auth)
  if (!response.ok) {
    throw new Error(`Could not send the message (HTTP ${response.status}).`)
  }
  const row = (await response.json()) as Record<string, unknown>
  return messageFromRow(row)
}
