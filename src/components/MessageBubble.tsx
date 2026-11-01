import type { Message } from '../types/message'

interface MessageBubbleProps {
  message: Message
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isOutgoing = message.senderId === 'alice'
  const displayName = isOutgoing ? 'You' : message.senderName ?? 'Bob'

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
