'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ApiError, api } from '@/lib/api-client'
import { clientDaysTone, clientUsedTone, daysWord } from '@/lib/pass'
import type { ClientHomeDTO, PassSummary } from '@/lib/types'
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
      if (error instanceof ApiError && (error.status === 404 || error.status === 403)) setGone(true)
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
      <PassCard summary={home.passSummary} />
    </>
  )
}

function PassCard({ summary }: { summary: PassSummary }) {
  const days = summary.remainingDays
  const hasPass = summary.limit > 0
  const active = summary.status === 'active'
  const count = hasPass ? `${summary.used}/${summary.limit}` : '—'
  const daysText = days === null ? '—' : `${days} ${daysWord(days)}`
  const badge = !hasPass ? 'is-none' : active ? 'is-on' : 'is-off'
  const label = !hasPass ? 'Brak karnetu' : active ? 'Aktywny' : 'Nieaktywny'
  return (
    <section>
      <h2 className="section-title">Twój karnet</h2>
      <article className="karnet-card">
        <div className="karnet-row">
          <span className="dumbbell" aria-hidden="true">
            <DumbbellIcon />
          </span>
          <div className="karnet-cell">
            <div className={`karnet-figure ${hasPass ? clientUsedTone(summary.used, summary.limit) : 'tone-ink'}`}>{count}</div>
            <div className="karnet-caption">Treningi</div>
          </div>
          <div className="karnet-divider" aria-hidden="true" />
          <div className="karnet-cell">
            <div className={`karnet-figure ${days === null ? 'tone-ink' : clientDaysTone(days)}`}>{daysText}</div>
            <div className="karnet-caption">Pozostało</div>
          </div>
          <div className="karnet-divider" aria-hidden="true" />
          <div className="karnet-cell karnet-status-cell">
            <span className={`karnet-badge ${badge}`}>
              {hasPass && <span className="status-dot" aria-hidden="true" />}
              {label}
            </span>
            <div className="karnet-until">{summary.validUntil ? `Ważny do ${summary.validUntil}` : '\u00a0'}</div>
          </div>
        </div>
      </article>
    </section>
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
