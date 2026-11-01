import { type FormEvent, useId, useState } from 'react'
import { login } from '../api/auth'
import type { AuthSession } from '../types/auth'

interface LoginScreenProps {
  onSignIn: (session: AuthSession) => void
}

export function LoginScreen({ onSignIn }: LoginScreenProps) {
  const emailId = useId()
  const passwordId = useId()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!email.trim() || !password) {
      setError('Enter your email and password to continue.')
      return
    }

    setError('')
    setIsSubmitting(true)

    try {
      onSignIn(await login(email.trim(), password))
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not sign in. Try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="login-screen">
      <section className="login-card" aria-labelledby="login-heading">
        <div className="brand login-brand" aria-label="QuantumChat">
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
        </div>

        <div className="login-intro">
          <h1 id="login-heading">Welcome back</h1>
          <p>Sign in to pick up your encrypted conversations.</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit} noValidate aria-busy={isSubmitting}>
          <div className="field">
            <label htmlFor={emailId}>Email</label>
            <input
              id={emailId}
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="alice@quantum.chat"
              autoComplete="email"
              autoFocus
              disabled={isSubmitting}
            />
          </div>

          <div className="field">
            <label htmlFor={passwordId}>Password</label>
            <div className="field-control">
              <input
                id={passwordId}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
                disabled={isSubmitting}
              />
              <button
                type="button"
                className="field-toggle"
                onClick={() => setShowPassword((current) => !current)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
                disabled={isSubmitting}
              >
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12S18 18.5 12 18.5 2.5 12 2.5 12Z"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinejoin="round"
                  />
                  <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.7" />
                  {!showPassword && (
                    <path d="M4 20 20 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                  )}
                </svg>
              </button>
            </div>
          </div>

          {error && (
            <p className="login-error" role="alert">
              {error}
            </p>
          )}

          <button type="submit" className="login-submit" disabled={isSubmitting}>
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </section>
    </main>
  )
}
