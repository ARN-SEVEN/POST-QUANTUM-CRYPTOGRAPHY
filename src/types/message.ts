export interface Message {
  id: string
  senderId: string
  senderName: string | null
  content: string
  sentAt: string
}

/** Shape returned by the backend `/messages` endpoints (an extension of `Message`). */
export interface MessageOut {
  id: string
  senderId: string
  senderName: string | null
  content: string
  sentAt: string
}
