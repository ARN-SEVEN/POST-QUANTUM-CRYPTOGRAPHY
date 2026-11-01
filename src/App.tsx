import { useCallback, useState } from 'react'
import { ChatWindow } from './components/ChatWindow'
import { LoginScreen } from './components/LoginScreen'
import type { AuthSession } from './types/auth'
import type { Message } from './types/message'

const initialMessages: Message[] = [
  { id: '1', senderId: 'alice', senderName: 'Alice', content: 'Hi Bob!', sentAt: '2026-11-01T10:18:00Z' },
  { id: '2', senderId: 'bob', senderName: 'Bob', content: 'Hello Alice!', sentAt: '2026-11-01T10:19:00Z' },
  { id: '3', senderId: 'bob', senderName: 'Bob', content: 'How are you today?', sentAt: '2026-11-01T10:20:00Z' },
  { id: '4', senderId: 'alice', senderName: 'Alice', content: "I'm good! Just testing our messaging prototype.", sentAt: '2026-11-01T10:22:00Z' },
  { id: '5', senderId: 'bob', senderName: 'Bob', content: "Great! It's working well.", sentAt: '2026-11-01T10:23:00Z' },
  { id: '6', senderId: 'alice', senderName: 'Alice', content: 'See you soon!', sentAt: '2026-11-01T10:24:00Z' },
]

export default function App() {
  const [session, setSession] = useState<AuthSession | null>(null)
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [loadError, setLoadError] = useState<string | null>(null)

  const signIn = useCallback((nextSession: AuthSession) => {
    setSession(nextSession)
    setLoadError(null)
    loadMessages(nextSession.access_token)
      .then((loaded) => setMessages(loaded))
      .catch((error) => setLoadError(error instanceof Error ? error.message : 'Could not load messages.'))
  }, [])

  const loadMessages = useCallback(async (token: string): Promise<Message[]> => {
    const response = await fetch(`${import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'}/messages`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      const body = await response.json().catch(() => null)
      const detail = body?.detail
      throw new Error(typeof detail === 'string' ? detail : `Login failed (HTTP ${response.status}).`)
    }

    return (await response.json()) as Message[]
  }, [])

  const sendMessage = useCallback(async (content: string) => {
    if (!session) return

    const message: Message = {
      id: crypto.randomUUID(),
      senderId: session.user.id,
      senderName: session.user.display_name ?? 'You',
      content,
      sentAt: new Date().toISOString(),
    }

    setMessages((current) => [...current, message])
  }, [session])

  if (!session) {
    return <LoginScreen onSignIn={signIn} />
  }

  return <ChatWindow session={{ accessToken: session.access_token, user: { id: session.user.id, displayName: session.user.display_name } }} onMessageError={setLoadError} />
}
