'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ApiError, api } from '@/lib/api-client'
import type { ClientHomeDTO } from '@/lib/types'
import { usePoll } from '@/lib/use-poll'
import { ArrowIcon, DumbbellIcon, Logo, PersonIcon } from './mark'

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
      <header className="home-top">
        <div className="brand">
          <Logo size={56} />
          <div className="wordmark">
            <b>GYM</b> RAT
          </div>
        </div>
        <Link href={`/c/${token}/profil`} className="profile-link">
          <span className="profile-ico">
            <PersonIcon />
          </span>
          Mój profil
        </Link>
      </header>
      <p className="eyebrow">DOBRZE CIĘ WIDZIEĆ</p>
      <h1 className="hero">
        Czas na trening<span className="dot">.</span>
      </h1>
      <h2 className="section-title">Twój plan</h2>
      {home.workouts.length === 0 ? (
        <div className="empty-card">
          <strong>Brak treningu</strong>
          Gdy trener doda plan, zobaczysz go w tym miejscu.
        </div>
      ) : (
        <div className="plan-cards">
          {home.workouts.map((workout) => (
            <article key={workout.id} className="plan-card">
              <div className="plan-card-head">
                <span className="dumbbell">
                  <DumbbellIcon />
                </span>
                <div>
                  <div className="plan-name">{workout.name}</div>
                  <div className="plan-sub">Plan od Twojego trenera</div>
                </div>
              </div>
              <Link className="btn-black" href={`/c/${token}/trening/${workout.id}`}>
                Otwórz trening
                <ArrowIcon />
              </Link>
            </article>
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
      <div className="brand">
        <Logo size={56} />
        <div className="wordmark">
          <b>GYM</b> RAT
        </div>
      </div>
      <p>{checking ? 'Otwieram plan…' : 'Otwórz link z wiadomości e-mail, aby wejść do swojego planu.'}</p>
    </div>
  )
}

export function InvalidLink() {
  return (
    <div className="message-page">
      <div className="brand">
        <Logo size={56} />
        <div className="wordmark">
          <b>GYM</b> RAT
        </div>
      </div>
      <p>Ten link nie pasuje do żadnego konta.</p>
    </div>
  )
}
