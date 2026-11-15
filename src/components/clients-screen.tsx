'use client'

import { useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api-client'
import { formatPlDate } from '@/lib/dates'
import type { ClientListItem } from '@/lib/types'
import { usePoll } from '@/lib/use-poll'
import { AvatarButton } from './avatar'
import { InviteDialog } from './dialogs'
import { Logo, PlusIcon } from './mark'

export function ClientsScreen({ initial }: { initial: ClientListItem[] }) {
  const [clients, setClients] = useState(initial)
  const [invite, setInvite] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function showToast(text: string) {
    setToast(text)
    window.setTimeout(() => setToast(null), 2400)
  }

  usePoll(async () => {
    const data = await api<{ clients: ClientListItem[] }>('/api/trainer/clients')
    setClients(data.clients)
  }, 4000)

  return (
    <>
      <header className="topbar">
        <Logo size={36} />
        <h1>Klienci</h1>
        <button type="button" className="icon-btn" aria-label="Wyślij zaproszenie" onClick={() => setInvite(true)}>
          <PlusIcon />
        </button>
      </header>
      {error && <p className="error">{error}</p>}
      {clients.length === 0 ? (
        <p className="empty">Brak klientów. Dotknij +, aby wysłać zaproszenie.</p>
      ) : (
        <ul className="client-list">
          {clients.map((client) => (
            <li key={client.id} className="client-row">
              <AvatarButton
                id={client.id}
                hasAvatar={client.hasAvatar}
                version={client.updatedAt}
                onUploaded={(updatedAt) => {
                  setClients((prev) =>
                    prev.map((item) => (item.id === client.id ? { ...item, hasAvatar: true, updatedAt } : item)),
                  )
                }}
                onError={setError}
              />
              <Link href={`/trener/klienci/${client.id}`} className="client-link">
                <div className="client-name">{client.name}</div>
                <div className="client-meta">
                  {client.workouts.length === 0 ? (
                    <div>Brak treningów</div>
                  ) : (
                    client.workouts.map((workout) => (
                      <div key={workout.id}>
                        {workout.name} - {formatPlDate(workout.createdAt)}
                      </div>
                    ))
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        className="logout"
        onClick={async () => {
          await api('/api/trainer/logout', { method: 'POST', body: '{}' })
          window.location.href = '/trener'
        }}
      >
        Wyloguj
      </button>
      {invite && (
        <InviteDialog
          onClose={() => setInvite(false)}
          onCreated={(client) => setClients((prev) => [...prev.filter((item) => item.id !== client.id), client])}
          onToast={showToast}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </>
  )
}
