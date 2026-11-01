import { useCallback, useEffect, useState } from 'react'
import { listChats } from '../api/chats'
import type { MessageOut } from '../api/messages'
import { listMessages, sendMessage } from '../api/messages'
import { GENERAL_CHAT_ID, type Chat } from '../types/chat'
import { ChatList } from './ChatList'
import { Header } from './Header'
import { MessageInput } from './MessageInput'
import { MessageList } from './MessageList'

/** How often the chat list and open conversation are refreshed. */
const REFRESH_MS = 4000

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
  const [chats, setChats] = useState<Chat[]>([])
  const [isLoadingChats, setIsLoadingChats] = useState(true)
  const [activeChatId, setActiveChatId] = useState<string>(GENERAL_CHAT_ID)

  const [messages, setMessages] = useState<MessageOut[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isSending, setIsSending] = useState(false)

  const loadChats = useCallback(async () => {
    try {
      setChats(await listChats(session.accessToken))
    } catch (error) {
      onMessageError(error instanceof Error ? error.message : 'Could not load chats.')
    } finally {
      setIsLoadingChats(false)
    }
  }, [session.accessToken, onMessageError])

  const loadMessages = useCallback(
    async (chatId: string, silent = false) => {
      try {
        const loaded = await listMessages(session.accessToken, chatId)
        setMessages((current) =>
          current.length === loaded.length &&
          current.every((message, index) => message.id === loaded[index].id)
            ? current
            : loaded,
        )
        setLoadError(null)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not load messages.'
        if (!silent) setLoadError(message)
      } finally {
        // Without this the loading placeholder never goes away, even on success.
        setIsLoading(false)
      }
    },
    [session.accessToken],
  )

  useEffect(() => {
    loadChats()
  }, [loadChats])

  useEffect(() => {
    loadMessages(activeChatId)
  }, [activeChatId, loadMessages])

  // Refresh the open conversation and its previews while the session is active.
  useEffect(() => {
    const interval = setInterval(() => {
      loadMessages(activeChatId, true)
      loadChats()
    }, REFRESH_MS)

    return () => clearInterval(interval)
  }, [activeChatId, loadChats, loadMessages])

  function selectChat(chatId: string) {
    if (chatId === activeChatId) return

    setActiveChatId(chatId)
    setMessages([])
    setLoadError(null)
    setIsLoading(true)
  }

  async function handleSendMessage(content: string) {
    setIsSending(true)
    try {
      const sent = await sendMessage(session.accessToken, content, activeChatId)
      setMessages((current) =>
        current.some((message) => message.id === sent.id) ? current : [...current, sent],
      )
      loadChats()
    } catch (error) {
      onMessageError(error instanceof Error ? error.message : 'Could not send the message.')
    } finally {
      setIsSending(false)
    }
  }

  const activeChat = chats.find((chat) => chat.id === activeChatId)
  const chatName = activeChat?.name ?? (activeChatId === GENERAL_CHAT_ID ? 'General' : 'Chat')

  if (!session.accessToken) return null

  return (
    <main className="chat-window">
      <Header currentUser={session.user.displayName ?? 'You'} />

      <div className="chat-body">
        <ChatList
          chats={chats}
          activeChatId={activeChatId}
          isLoading={isLoadingChats}
          onSelect={selectChat}
        />

        <section className="conversation" aria-label={chatName}>
          <div className="conversation-header">
            <strong>{chatName}</strong>
            <span>{activeChat?.isGroup ? 'Everyone in this room' : 'Direct message'}</span>
          </div>

          {isLoading ? (
            <div className="message-list" aria-label={`Loading ${chatName}`}>
              <div className="conversation-date">
                <span>Loading messages…</span>
              </div>
              <div className="loading-placeholder" />
            </div>
          ) : loadError ? (
            <div className="message-list" role="alert" aria-label="Error loading messages">
              <div className="conversation-date">
                <span>Today</span>
              </div>
              <p className="load-error" role="alert">
                {loadError}
              </p>
            </div>
          ) : messages.length === 0 ? (
            <div className="message-list" aria-label="No messages yet">
              <div className="conversation-date">
                <span>Today</span>
              </div>
              <p className="empty-state">No messages yet. Say hello.</p>
            </div>
          ) : (
            <MessageList
              messages={messages}
              isLoading={isLoading}
              loadError={loadError}
              currentUserId={session.user.id}
            />
          )}

          <MessageInput isSending={isSending} onSendMessage={handleSendMessage} />
        </section>
      </div>
    </main>
  )
}
