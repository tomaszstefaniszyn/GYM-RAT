'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api-client'
import type { ClientListItem } from '@/lib/types'
import { usePoll } from '@/lib/use-poll'
import { Avatar } from './avatar'
import { BackIcon, ChevronIcon, PlusIcon } from './mark'

export function ClientScreen({ initial }: { initial: ClientListItem }) {
  const router = useRouter()
  const [client, setClient] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  usePoll(async () => {
    setClient(await api<ClientListItem>(`/api/trainer/clients/${client.id}`))
  }, 4000)

  const avatar = client.hasAvatar
    ? `/api/trainer/clients/${client.id}/avatar?v=${encodeURIComponent(client.updatedAt)}`
    : null

  return (
    <>
      <header className="topbar">
        <Link href="/trener/klienci" className="icon-btn" aria-label="Wróć">
          <BackIcon />
        </Link>
      </header>
      <Link href={`/trener/klienci/${client.id}/profil`} className="identity-link">
        <Avatar size={64} src={avatar} alt="" />
        <span>
          <span className="client-name">{client.name}</span>
          <span className="email">{client.email}</span>
        </span>
      </Link>
      <hr className="hairline" />
      {error && <p className="error">{error}</p>}
      <div className="add-row">
        <h2>Dodaj trening</h2>
        <button
          type="button"
          className="plus-btn"
          aria-label="Dodaj trening"
          disabled={busy}
          onClick={() => {
            setBusy(true)
            setError(null)
            void api<{ id: string }>(`/api/trainer/clients/${client.id}/workouts`, { method: 'POST', body: '{}' })
              .then((created) => {
                router.push(`/trener/klienci/${client.id}/trening/${created.id}`)
                router.refresh()
              })
              .catch((err: unknown) => {
                setError(err instanceof Error ? err.message : 'Nie dodano treningu.')
                setBusy(false)
              })
          }}
        >
          <PlusIcon />
        </button>
      </div>
      {client.workouts.length === 0 ? (
        <p className="empty">Brak treningów.</p>
      ) : (
        <div className="tiles">
          {client.workouts.map((workout) => (
            <Link key={workout.id} className="tile" href={`/trener/klienci/${client.id}/trening/${workout.id}`}>
              {workout.name}
              <ChevronIcon />
            </Link>
          ))}
        </div>
      )}
    </>
  )
}
