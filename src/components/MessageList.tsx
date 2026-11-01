import { useEffect, useRef } from 'react'
import type { Message } from '../types/message'
import { MessageBubble } from './MessageBubble'

interface MessageListProps {
  messages: Message[]
}

export function MessageList({ messages }: MessageListProps) {
  const endOfMessagesRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages])

  return (
    <div className="message-list" role="log" aria-live="polite" aria-label="Conversation with Bob">
      <div className="conversation-date" aria-label="Messages from today">
        <span>Today</span>
      </div>
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}
      <div ref={endOfMessagesRef} aria-hidden="true" />
    </div>
  )
}
