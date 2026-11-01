import { type FormEvent, useState } from 'react'

interface MessageInputProps {
  onSendMessage: (content: string) => void
}

export function MessageInput({ onSendMessage }: MessageInputProps) {
  const [value, setValue] = useState('')
  const canSend = value.trim().length > 0

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const content = value.trim()

    if (!content) return

    onSendMessage(content)
    setValue('')
  }

  return (
    <footer className="composer">
      <form onSubmit={handleSubmit} className="composer-form">
        <label htmlFor="message-input" className="sr-only">
          Type a message to Bob
        </label>
        <input
          id="message-input"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Type a message..."
          autoComplete="off"
        />
        <button type="submit" disabled={!canSend}>
          <span>Send</span>
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="m4 4 17 8-17 8 3-8-3-8Z"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path d="M7 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      </form>
    </footer>
  )
}
