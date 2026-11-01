import type { Message } from '../types/message'

interface MessageBubbleProps {
  message: Message
  currentUserId: string
}

export function MessageBubble({ message, currentUserId }: MessageBubbleProps) {
  const isOutgoing = message.senderId === currentUserId
  const displayName = isOutgoing ? 'You' : message.senderName ?? 'Someone'

  return (
    <article
      className={`message-row ${isOutgoing ? 'message-row--outgoing' : ''}`}
      aria-label={`${displayName} at ${new Date(message.sentAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`}
    >
      <div className={`message-bubble ${isOutgoing ? 'message-bubble--outgoing' : ''}`}>
        <p>{message.content}</p>
        <time>{new Date(message.sentAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</time>
      </div>
    </article>
  )
}
