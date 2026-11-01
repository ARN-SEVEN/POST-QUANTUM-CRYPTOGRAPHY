import type { Message } from '../types/message'
import { Header } from './Header'
import { MessageInput } from './MessageInput'
import { MessageList } from './MessageList'

interface ChatWindowProps {
  messages: Message[]
  onSendMessage: (content: string) => void
  isLoading?: boolean
  errorMessage?: string | null
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="chat-empty" role="status">
      {message}
    </div>
  )
}

export function ChatWindow({
  messages,
  onSendMessage,
  isLoading = false,
  errorMessage = null,
}: ChatWindowProps) {
  if (isLoading) {
    return (
      <main className="chat-window">
        <Header />
        <EmptyState message="Loading messages…" />
      </main>
    )
  }

  if (errorMessage) {
    return (
      <main className="chat-window">
        <Header />
        <EmptyState className="chat-empty--error">{errorMessage}</EmptyState>
      </main>
    )
  }

  return (
    <main className="chat-window">
      <Header />
      {messages.length === 0 && <EmptyState message="Send a message to start the conversation." />}
      <MessageList messages={messages} />
      <MessageInput onSendMessage={onSendMessage} />
    </main>
  )
}
