import { useState } from 'react'

interface MessageInputProps {
  isSending: boolean
  onSendMessage: (content: string) => Promise<void>
}

export function MessageInput({ isSending, onSendMessage }: MessageInputProps) {
  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  const canSend = value.trim().length > 0 && !isSending

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const content = value.trim()

    if (!content) return

    setError('')
    onSendMessage(content).finally(() => setValue(''))
  }

  return (
    <footer className="composer">
      <form onSubmit={handleSubmit} className="composer-form">
        <label htmlFor="message-input" className="sr-only">
          Type a message
        </label>
        <input
          id="message-input"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Type a message..."
          autoComplete="off"
          disabled={isSending}
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
      {error && <p className="message-error" role="alert">{error}</p>}
    </footer>
  )
}
