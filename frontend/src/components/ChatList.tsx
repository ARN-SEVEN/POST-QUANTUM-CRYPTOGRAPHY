import type { Chat } from '../types/chat'

interface ChatListProps {
  chats: Chat[]
  activeChatId: string
  isLoading: boolean
  onSelect: (chatId: string) => void
}

function ChatAvatar({ chat }: { chat: Chat }) {
  return (
    <span className={`chat-avatar${chat.isGroup ? ' chat-avatar--group' : ''}`} aria-hidden="true">
      {chat.isGroup ? '#' : chat.name.charAt(0).toUpperCase()}
    </span>
  )
}

function previewText(chat: Chat): string {
  if (!chat.lastMessage) return chat.isGroup ? 'Room for everyone' : 'No messages yet'
  return chat.lastMessage
}

export function ChatList({ chats, activeChatId, isLoading, onSelect }: ChatListProps) {
  return (
    <nav className="chat-list" aria-label="Chats">
      <div className="chat-list-title">
        <span>Chats</span>
        <span className="chat-list-count">{chats.length}</span>
      </div>

      {isLoading && chats.length === 0 ? (
        <p className="chat-list-empty">Loading chats…</p>
      ) : (
        <ul className="chat-list-items">
          {chats.map((chat) => {
            const isActive = chat.id === activeChatId

            return (
              <li key={chat.id}>
                <button
                  type="button"
                  className={`chat-list-item${isActive ? ' chat-list-item--active' : ''}`}
                  aria-current={isActive ? 'true' : undefined}
                  onClick={() => onSelect(chat.id)}
                >
                  <ChatAvatar chat={chat} />
                  <span className="chat-list-copy">
                    <strong>{chat.name}</strong>
                    <span>{previewText(chat)}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </nav>
  )
}
