import { useCallback, useEffect, useState } from 'react'
import type { MessageOut } from '../api/messages'
import { listMessages, sendMessage } from '../api/messages'
import { Header } from './Header'
import { MessageInput } from './MessageInput'
import { MessageList } from './MessageList'
import { MessageBubble } from './MessageBubble'

interface ChatWindowProps {
  session: {
    accessToken: string
    user: {
      id: string
      displayName: string | null
    }
  }
  onMessageError: (message: string) => void
}

export function ChatWindow({ session, onMessageError }: ChatWindowProps) {
  const [messages, setMessages] = useState<MessageOut[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const [isSending, setIsSending] = useState(false)

  const loadMessages = useCallback(async (silent = false) => {
    try {
      const loaded = await listMessages(session.accessToken)
      setMessages((current) =>
        current.length === loaded.length &&
          current.every((message, index) => message.id === loaded[index].id)
          ? current
          : loaded,
      )
    } catch (error) {
      if (!silent) onMessageError(error instanceof Error ? error.message : 'Could not load messages.')
    }
  }, [session.accessToken, onMessageError])

  // Initial load on mount.
  useEffect(() => {
    let cancelled = false
    loadMessages().finally(() => {
      if (!cancelled) {
        setIsLoading(false)
        setIsRefreshing(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [loadMessages])

  // Refresh every few seconds while the session is active.
  useEffect(() => {
    if (!session.accessToken) return
    const interval = setInterval(() => {
      setIsRefreshing(true)
      loadMessages(true).finally(() => setIsRefreshing(false))
    }, 4000)
    return () => clearInterval(interval)
  }, [session.accessToken, loadMessages])

  async function handleSendMessage(content: string) {
    setIsSending(true)
    try {
      const sent = await sendMessage(session.accessToken, content)
      setMessages((current) => (current.some((message) => message.id === sent.id) ? current : [...current, sent]))
    } catch (error) {
      onMessageError(error instanceof Error ? error.message : 'Could not send the message.')
    } finally {
      setIsSending(false)
    }
  }

  if (!session.accessToken) return null

  return (
    <main className="chat-window">
      <Header currentUser={session.user.displayName ?? 'Bob'} />
      {isLoading ? (
        <div className="message-list" aria-label="Loading conversation">
          <div className="conversation-date"><span>Loading messages…</span></div>
          <div className="loading-placeholder" />
        </div>
      ) : loadError ? (
        <div className="message-list" role="alert" aria-label="Error loading messages">
          <div className="conversation-date"><span>Today</span></div>
          <p className="load-error" role="alert">{loadError}</p>
        </div>
      ) : messages.length === 0 ? (
        <div className="message-list" aria-label="No messages yet">
          <div className="conversation-date"><span>Today</span></div>
          <p className="empty-state">No messages yet. Say hello.</p>
        </div>
      ) : (
        <MessageList messages={messages} isLoading={isRefreshing} loadError={loadError} />
      )}
      <MessageInput isSending={isSending} onSendMessage={handleSendMessage} />
    </main>
  )
}
