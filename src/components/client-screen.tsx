'use client'

import { useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api-client'
import { formatPlDate } from '@/lib/dates'
import type { ClientListItem } from '@/lib/types'
import { usePoll } from '@/lib/use-poll'
import { AvatarButton } from './avatar'
import { NameDialog } from './dialogs'
import { BackIcon, PlusIcon } from './mark'

export function ClientScreen({ initial }: { initial: ClientListItem }) {
  const [client, setClient] = useState(initial)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  usePoll(async () => {
    const fresh = await api<ClientListItem>(`/api/trainer/clients/${client.id}`)
    setClient(fresh)
  }, 4000)

  return (
    <>
      <header className="identity">
        <Link href="/trener/klienci" className="icon-btn" aria-label="Wróć">
          <BackIcon />
        </Link>
        <AvatarButton
          id={client.id}
          hasAvatar={client.hasAvatar}
          version={client.updatedAt}
          size={58}
          onUploaded={(updatedAt) => setClient((prev) => ({ ...prev, hasAvatar: true, updatedAt }))}
          onError={setError}
        />
        <div className="who">
          <div className="name-line">
            <div className="client-name">{client.name}</div>
            <div className="email">{client.email}</div>
          </div>
        </div>
      </header>
      <p className="since">Klient od {formatPlDate(client.createdAt)}</p>
      {error && <p className="error">{error}</p>}
      <div className="add-row">
        <span>Dodaj trening</span>
        <button type="button" className="icon-btn" aria-label="Dodaj trening" onClick={() => setAdding(true)}>
          <PlusIcon />
        </button>
      </div>
      {client.workouts.length === 0 ? (
        <p className="empty">Brak treningów.</p>
      ) : (
        <div className="pills">
          {client.workouts.map((workout) => (
            <Link key={workout.id} className="pill" href={`/trener/klienci/${client.id}/trening/${workout.id}`}>
              {workout.name}
            </Link>
          ))}
        </div>
      )}
      {adding && (
        <NameDialog
          title="DODAJ TRENING"
          placeholder="NAZWA"
          onClose={() => setAdding(false)}
          onSubmit={async (name) => {
            await api(`/api/trainer/clients/${client.id}/workouts`, {
              method: 'POST',
              body: JSON.stringify({ name }),
            })
            const fresh = await api<ClientListItem>(`/api/trainer/clients/${client.id}`)
            setClient(fresh)
            setAdding(false)
          }}
        />
      )}
    </>
  )
}
