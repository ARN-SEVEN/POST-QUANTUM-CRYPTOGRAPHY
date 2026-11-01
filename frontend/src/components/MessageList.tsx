import { useEffect, useRef } from 'react'
import type { Message } from '../types/message'
import { MessageBubble } from './MessageBubble'

interface MessageListProps {
  messages: Message[]
  isLoading: boolean
  loadError: string | null
  currentUserId: string
}

function formatDay(isoDate: string): string {
  const date = new Date(isoDate)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  if (date.getTime() === today.getTime()) return 'Today'

  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

export function MessageList({ messages, isLoading, loadError, currentUserId }: MessageListProps) {
  const endOfMessagesRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages])

  return (
    <div className="message-list" role="log" aria-live="polite" aria-label="Conversation">
      <div className="conversation-date">
        <span>{messages.length > 0 ? formatDay(messages[messages.length - 1].sentAt) : 'Today'}</span>
      </div>
      {isLoading && <div className="loading-placeholder" aria-hidden="true" />}
      {!isLoading && loadError && <p className="load-error" role="alert">{loadError}</p>}
      {!isLoading &&
        !loadError &&
        messages.map((message) => (
          <MessageBubble key={message.id} message={message} currentUserId={currentUserId} />
        ))}
      {!isLoading && !loadError && messages.length === 0 && <div className="empty-state-wrapper"></div>}
      <div ref={endOfMessagesRef} aria-hidden="true" />
    </div>
  )
}
