'use client'

import { useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api-client'
import { formatPlDate } from '@/lib/dates'
import type { ClientListItem } from '@/lib/types'
import { usePoll } from '@/lib/use-poll'
import { Avatar } from './avatar'
import { InviteDialog } from './dialogs'
import { ChevronIcon, Logo, LogoutIcon, PlusIcon } from './mark'

export function ClientsScreen({ initial }: { initial: ClientListItem[] }) {
  const [clients, setClients] = useState(initial)
  const [invite, setInvite] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

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
      <header className="topbar line">
        <Logo size={44} />
        <h1>Klienci</h1>
        <button type="button" className="plus-btn" aria-label="Dodaj klienta" onClick={() => setInvite(true)}>
          <PlusIcon />
        </button>
      </header>
      {clients.length === 0 ? (
        <p className="empty">Brak klientów. Dotknij +, aby wysłać zaproszenie.</p>
      ) : (
        <ul className="client-list">
          {clients.map((client) => (
            <li key={client.id}>
              <Link href={`/trener/klienci/${client.id}`} className="client-row client-link">
                <Avatar
                  size={52}
                  src={client.hasAvatar ? `/api/trainer/clients/${client.id}/avatar?v=${encodeURIComponent(client.updatedAt)}` : null}
                />
                <span className="client-copy">
                  <span className="client-name">{client.name}</span>
                  <span className="client-meta">
                    {client.workouts.length === 0 ? (
                      <span>Brak treningów</span>
                    ) : (
                      client.workouts.map((workout) => (
                        <span key={workout.id} style={{ display: 'block' }}>
                          {workout.name} · {formatPlDate(workout.createdAt)}
                        </span>
                      ))
                    )}
                  </span>
                </span>
                <ChevronIcon />
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
        <LogoutIcon />
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
