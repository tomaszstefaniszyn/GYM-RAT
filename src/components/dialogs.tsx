'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api-client'
import type { ClientListItem } from '@/lib/types'
import { ArrowIcon } from './mark'

function useDialogEffects(onClose: () => void) {
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])
}

export function InviteDialog({
  onClose,
  onCreated,
  onToast,
}: {
  onClose: () => void
  onCreated: (client: ClientListItem) => void
  onToast: (text: string) => void
}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [dev, setDev] = useState<{ url: string; text: string; error: string | null } | null>(null)
  const [copied, setCopied] = useState(false)
  useDialogEffects(onClose)

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const result = await api<{
        client: ClientListItem
        inviteUrl: string
        emailed: boolean
        emailError: string | null
        emailText: string
      }>('/api/trainer/clients', {
        method: 'POST',
        body: JSON.stringify({ name, email }),
      })
      onCreated(result.client)
      if (result.emailed) {
        onToast('Zaproszenie wysłane')
        onClose()
        return
      }
      setDev({ url: result.inviteUrl, text: result.emailText, error: result.emailError })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się wysłać zaproszenia.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="backdrop" onMouseDown={onClose}>
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="invite-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2 id="invite-title">WYŚLIJ ZAPROSZENIE:</h2>
        {dev ? (
          <div className="dev-link">
            {dev.error && <p className="error">{dev.error}</p>}
            <p>Tryb lokalny — e-mail nie został wysłany. Link jest też w logu serwera.</p>
            <p>{dev.text}</p>
            <button
              type="button"
              className="linkish"
              onClick={() => {
                void navigator.clipboard.writeText(dev.url).then(() => setCopied(true)).catch(() => setCopied(false))
              }}
            >
              {copied ? 'Skopiowano' : 'Kopiuj link'}
            </button>
            <button type="button" className="linkish" onClick={onClose}>
              Zamknij
            </button>
          </div>
        ) : (
          <form className="stack" onSubmit={onSubmit}>
            <label className="field">
              <span className="sr-only">Imię</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="IMIĘ"
                autoCapitalize="words"
                autoComplete="given-name"
                autoFocus
                required
                maxLength={80}
              />
            </label>
            <label className="field">
              <span className="sr-only">E-mail</span>
              <input
                type="email"
                inputMode="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="E-MAIL"
                autoCapitalize="none"
                autoComplete="email"
                spellCheck={false}
                required
              />
              <button type="submit" aria-label="Wyślij zaproszenie" disabled={busy}>
                <ArrowIcon />
              </button>
            </label>
            {error && <p className="error">{error}</p>}
          </form>
        )}
      </div>
    </div>
  )
}

