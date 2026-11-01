import type { Message } from '../types/message'

interface MessageBubbleProps {
  message: Message
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isOutgoing = message.sender === 'alice'

  return (
    <article
      className={`message-row ${isOutgoing ? 'message-row--outgoing' : ''}`}
      aria-label={`${isOutgoing ? 'You' : 'Bob'} at ${message.timestamp}`}
    >
      <div className={`message-bubble ${isOutgoing ? 'message-bubble--outgoing' : ''}`}>
        <p>{message.content}</p>
        <time>{message.timestamp}</time>
      </div>
    </article>
  )
}
