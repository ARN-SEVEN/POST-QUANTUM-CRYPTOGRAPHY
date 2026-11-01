/** One selectable conversation: the shared room or a direct chat. */
export interface Chat {
  id: string
  name: string
  isGroup: boolean
  lastMessage: string | null
  lastMessageAt: string | null
}

/** Shape returned by GET /chats, before mapping to camelCase. */
export interface RawChat {
  id: string
  name: string
  is_group: boolean
  last_message: string | null
  last_message_at: string | null
}

export const GENERAL_CHAT_ID = 'general'
