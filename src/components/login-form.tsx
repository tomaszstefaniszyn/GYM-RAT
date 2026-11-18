'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api-client'
import { ArrowIcon, EyeIcon, Logo } from './mark'

export function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  return (
    <div className="login">
      <div className="brand">
        <Logo size={72} />
        <div>
          <div className="brand-title">
            <b>GYM</b> RAT.
          </div>
          <div className="brand-sub">SPLINTER.</div>
        </div>
      </div>
      <form
        className="login-form"
        onSubmit={async (event) => {
          event.preventDefault()
          setBusy(true)
          setError(null)
          try {
            await api('/api/trainer/login', { method: 'POST', body: JSON.stringify({ email, password }) })
            router.push('/trener/klienci')
            router.refresh()
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Nie udało się zalogować.')
            setBusy(false)
          }
        }}
      >
        <label className="stack-field">
          E-mail
          <input
            className="control"
            id="trainer-email"
            type="email"
            inputMode="email"
            autoCapitalize="none"
            autoComplete="username"
            spellCheck={false}
            placeholder="twoj@email.pl"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
        <label className="stack-field">
          Hasło
          <span className="password-field">
            <input
              className="control"
              type={show ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            <button
              type="button"
              className="eye-btn"
              aria-label={show ? 'Ukryj hasło' : 'Pokaż hasło'}
              onClick={() => setShow((value) => !value)}
            >
              <EyeIcon off={show} />
            </button>
          </span>
        </label>
        <button className="btn-yellow" type="submit" disabled={busy}>
          {busy ? 'Logowanie…' : 'Zaloguj się'}
          <ArrowIcon />
        </button>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </form>
    </div>
  )
}
