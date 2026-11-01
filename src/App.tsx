import { useCallback, useEffect, useRef, useState } from 'react'
import { ChatWindow } from './components/ChatWindow'
import { LoginScreen } from './components/LoginScreen'
import { fetchMessages, sendMessage } from './api/messages'
import type { AuthSession } from './types/auth'
import type { Message } from './types/message'

export default function App() {
  const [messages, setMessages] = useState<Message[]>([])
  const [session, setSession] = useState<AuthSession | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const mountedRef = useRef(true)

  const signIn = useCallback((nextSession: AuthSession) => {
    setSession(nextSession)
    setErrorMessage(null)
  }, [])

  useEffect(() => {
    mountedRef.current = true
    if (!session) {
      setMessages([])
      return
    }

    setIsLoading(true)
    setErrorMessage(null)

    fetchMessages({ token: session.access_token })
      .then((next) => {
        if (mountedRef.current) setMessages(next)
      })
      .catch((error) => {
        if (mountedRef.current) setErrorMessage(error instanceof Error ? error.message : String(error))
      })
      .finally(() => {
        if (mountedRef.current) setIsLoading(false)
      })

    return () => {
      mountedRef.current = false
    }
  }, [session])

  const handleSendMessage = useCallback(
    async (content: string) => {
      if (!session) return

      setIsLoading(true)
      setErrorMessage(null)

      try {
        await sendMessage(content, { token: session.access_token })
        const next = await fetchMessages({ token: session.access_token })
        if (mountedRef.current) setMessages(next)
      } catch (error) {
        if (mountedRef.current)
          setErrorMessage(error instanceof Error ? error.message : String(error))
      } finally {
        if (mountedRef.current) setIsLoading(false)
      }
    },
    [session],
  )

  if (!session) {
    return <LoginScreen onSignIn={signIn} />
  }

  return (
    <ChatWindow
      messages={messages}
      onSendMessage={handleSendMessage}
      isLoading={isLoading}
      errorMessage={errorMessage}
    />
  )
}
