'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ApiError, api } from '@/lib/api-client'
import type { ClientHomeDTO } from '@/lib/types'
import { usePoll } from '@/lib/use-poll'
import { Logo } from './mark'

const STORAGE_KEY = 'gr_client_token'

export function ClientHome({ token, initial }: { token: string; initial: ClientHomeDTO }) {
  const [home, setHome] = useState(initial)
  const [gone, setGone] = useState(false)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, token)
    let cancelled = false
    void fetch('/api/client/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    }).finally(() => {
      if (cancelled) return
      let link = document.querySelector<HTMLLinkElement>('link[data-client-manifest]')
      if (!link) {
        link = document.createElement('link')
        link.rel = 'manifest'
        link.dataset.clientManifest = '1'
        document.head.appendChild(link)
      }
      link.href = `/api/manifest-klient?v=${Date.now()}`
    })
    return () => {
      cancelled = true
    }
  }, [token])

  usePoll(async () => {
    try {
      setHome(await api<ClientHomeDTO>(`/api/client/${token}`))
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) setGone(true)
    }
  }, 3000)

  if (gone) {
    return (
      <div className="message-page">
        <Logo size={64} />
        <p>Ten link już nie działa.</p>
      </div>
    )
  }

  return (
    <>
      <header className="home-brand">
        <Logo size={62} />
        <div className="home-title">GYM RAT</div>
      </header>
      {home.workouts.length === 0 ? (
        <p className="empty">Trener nie dodał jeszcze treningów.</p>
      ) : (
        <div className="pills home-pills">
          {home.workouts.map((workout) => (
            <Link key={workout.id} className="pill" href={`/c/${token}/trening/${workout.id}`}>
              {workout.name}
            </Link>
          ))}
        </div>
      )}
    </>
  )
}

export function OpenInvite() {
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem(STORAGE_KEY)
    if (!token) {
      setChecking(false)
      return
    }
    void fetch('/api/client/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    }).then((res) => {
      if (res.ok) {
        window.location.replace(`/c/${token}`)
        return
      }
      localStorage.removeItem(STORAGE_KEY)
      setChecking(false)
    })
  }, [])

  return (
    <div className="message-page">
      <div className="home-brand">
        <Logo size={62} />
        <div className="home-title">GYM RAT</div>
      </div>
      <p>{checking ? 'Otwieram plan…' : 'Otwórz link z wiadomości e-mail, aby wejść do swojego planu.'}</p>
    </div>
  )
}

export function InvalidLink() {
  return (
    <div className="message-page">
      <div className="home-brand">
        <Logo size={62} />
        <div className="home-title">GYM RAT</div>
      </div>
      <p>Ten link nie pasuje do żadnego konta.</p>
    </div>
  )
}
