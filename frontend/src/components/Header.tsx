interface HeaderProps {
  currentUser: string
}

export function Header({ currentUser }: HeaderProps) {
  return (
    <header className="app-header">
      <div className="brand" aria-label="QuantumChat">
        <span className="brand-mark" aria-hidden="true">
          <svg viewBox="0 0 32 32" fill="none">
            <path
              d="M7.25 6.5h17.5A3.75 3.75 0 0 1 28.5 10.25v9.5a3.75 3.75 0 0 1-3.75 3.75H15l-6.25 4v-4h-1.5a3.75 3.75 0 0 1-3.75-3.75v-9.5A3.75 3.75 0 0 1 7.25 6.5Z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinejoin="round"
            />
            <circle cx="10.5" cy="15" r="1.25" fill="currentColor" />
            <circle cx="16" cy="15" r="1.25" fill="currentColor" />
            <circle cx="21.5" cy="15" r="1.25" fill="currentColor" />
          </svg>
        </span>
        <span className="brand-name">
          Quantum<span>Chat</span>
        </span>
      </div>          <div className="contact" aria-label="Current user is online">
        <div className="avatar" aria-hidden="true">
          {currentUser.charAt(0)}
          <span className="online-dot" />
        </div>
        <div className="contact-copy">
          <strong>{currentUser}</strong>
          <span>
            <i aria-hidden="true" />
            Online
          </span>
        </div>
      </div>
    </header>
  )
}
