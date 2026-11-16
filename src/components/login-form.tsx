'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api-client'
import { ArrowIcon, Logo } from './mark'

export function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  return (
    <div className="login">
      <div className="brand">
        <Logo size={74} />
        <div>
          <div className="brand-title">GYM RAT.</div>
          <div className="brand-sub">SPLINTER.</div>
        </div>
      </div>
      <h1 className="login-title">LOG IN</h1>
      <form
        className="field login-field"
        onSubmit={async (event) => {
          event.preventDefault()
          setBusy(true)
          setError(null)
          try {
            await api('/api/trainer/login', { method: 'POST', body: JSON.stringify({ email }) })
            router.push('/trener/klienci')
            router.refresh()
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Nie udało się zalogować.')
            setBusy(false)
          }
        }}
      >
        <label className="sr-only" htmlFor="trainer-email">
          E-mail
        </label>
        <input
          id="trainer-email"
          type="email"
          inputMode="email"
          autoCapitalize="none"
          autoComplete="email"
          spellCheck={false}
          placeholder="E-MAIL"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
        <button type="submit" aria-label="Zaloguj" disabled={busy}>
          <ArrowIcon />
        </button>
      </form>
      {error && <p className="error">{error}</p>}
    </div>
  )
}
