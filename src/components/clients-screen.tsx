'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api-client'
import { daysWord, trainerDaysTone, trainerUsedTone } from '@/lib/pass'
import type { ClientListItem, PassSummary } from '@/lib/types'
import { usePoll } from '@/lib/use-poll'
import { Avatar } from './avatar'
import { InviteDialog } from './dialogs'
import { ChevronIcon, DotsIcon, Logo, LogoutIcon, PlusIcon, TrashIcon } from './mark'
import { useHorizontalSwipe } from './use-swipe'

const REVEAL = 96

export function ClientsScreen({ initial }: { initial: ClientListItem[] }) {
  const [clients, setClients] = useState(initial)
  const [invite, setInvite] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [menuId, setMenuId] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<ClientListItem | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function showToast(text: string) {
    setToast(text)
    window.setTimeout(() => setToast(null), 2400)
  }

  usePoll(async () => {
    const data = await api<{ clients: ClientListItem[] }>('/api/trainer/clients')
    setClients(data.clients)
    setOpenId((current) => (current && data.clients.some((client) => client.id === current) ? current : null))
  }, 4000)

  useEffect(() => {
    if (!openId && !menuId) return
    const close = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Element)) return
      if (target.closest('[data-swipe]') || target.closest('.row-more') || target.closest('.menu')) return
      setOpenId(null)
      setMenuId(null)
    }
    window.addEventListener('pointerdown', close)
    return () => window.removeEventListener('pointerdown', close)
  }, [openId, menuId])

  async function removeClient() {
    if (!confirm) return
    setBusy(true)
    setError(null)
    try {
      await api(`/api/trainer/clients/${confirm.id}/archive`, { method: 'POST', body: '{}' })
      setClients((prev) => prev.filter((client) => client.id !== confirm.id))
      setOpenId(null)
      setMenuId(null)
      setConfirm(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie usunięto klienta.')
    } finally {
      setBusy(false)
    }
  }

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
            <ClientRow
              key={client.id}
              client={client}
              open={openId === client.id}
              menu={menuId === client.id}
              onOpen={() => {
                setMenuId(null)
                setOpenId(client.id)
              }}
              onClose={() => setOpenId((current) => (current === client.id ? null : current))}
              onMenu={() => {
                setOpenId(null)
                setMenuId((current) => (current === client.id ? null : client.id))
              }}
              onAskRemove={() => {
                setMenuId(null)
                setConfirm(client)
              }}
            />
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
      {confirm && (
        <div className="backdrop" onMouseDown={() => setConfirm(null)}>
          <div
            className="dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="remove-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <h2 id="remove-title">Usunąć klienta?</h2>
            <p style={{ textAlign: 'center', lineHeight: 1.45 }}>
              Czy na pewno chcesz usunąć tego klienta? Klient utraci dostęp do swojego panelu do czasu ponownego zaproszenia przez trenera.
            </p>
            {error && <p className="error">{error}</p>}
            <div className="crop-actions">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  setConfirm(null)
                  setOpenId(null)
                }}
              >
                Anuluj
              </button>
              <button type="button" className="btn-danger" disabled={busy} onClick={() => void removeClient()}>
                Usuń klienta
              </button>
            </div>
          </div>
        </div>
      )}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </>
  )
}

function remainCopy(days: number) {
  if (days === 1) return { lead: 'Pozostał', word: 'dzień' }
  return { lead: 'Pozostało', word: daysWord(days) }
}

function PassLines({ summary }: { summary: PassSummary }) {
  if (!summary.limit) return <span className="meta-line">Brak karnetu</span>
  const days = summary.remainingDays
  const remain = days === null ? null : remainCopy(days)
  return (
    <>
      <span className="meta-line">
        Wykorzystano <b className={trainerUsedTone(summary.used, summary.limit)}>{summary.used}/{summary.limit}</b>
        {remain && days !== null && (
          <>
            {' · '}
            <span className="nowrap">
              {remain.lead} <b className={trainerDaysTone(days)}>{days}</b> {remain.word}
            </span>
          </>
        )}
      </span>
      {summary.validUntil && (
        <span className="meta-line">
          Karnet ważny do <b>{summary.validUntil}</b>
        </span>
      )}
    </>
  )
}

function ClientRow({
  client,
  open,
  menu,
  onOpen,
  onClose,
  onMenu,
  onAskRemove,
}: {
  client: ClientListItem
  open: boolean
  menu: boolean
  onOpen: () => void
  onClose: () => void
  onMenu: () => void
  onAskRemove: () => void
}) {
  const { shift, dragging, suppress, bind } = useHorizontalSwipe(open, onOpen, onClose, REVEAL)
  const active = client.passSummary.status === 'active'

  return (
    <li className={menu ? 'swipe-host is-menu' : 'swipe-host'} data-swipe="">
      <button type="button" className="swipe-reveal" onClick={onAskRemove}>
        <TrashIcon />
        Usuń
      </button>
      <div className={dragging ? 'swipe-face is-drag' : 'swipe-face'} style={{ transform: `translateX(${shift}px)` }} {...bind}>
        <div className="client-row">
          <Link
            href={`/trener/klienci/${client.id}`}
            className="client-link"
            onClick={(event) => {
              if (suppress.current || open) {
                event.preventDefault()
                suppress.current = false
                if (open) onClose()
              }
            }}
          >
            <Avatar
              size={52}
              src={client.hasAvatar ? `/api/trainer/clients/${client.id}/avatar?v=${encodeURIComponent(client.updatedAt)}` : null}
            />
            <span className="client-copy">
              <span className="name-line">
                <span className="client-name">{client.name}</span>
                <span className={active ? 'status-pill is-on' : 'status-pill is-off'}>
                  <span className="status-dot" aria-hidden="true" />
                  {active ? 'Aktywny' : 'Nieaktywny'}
                </span>
              </span>
              <span className="client-meta">
                <PassLines summary={client.passSummary} />
              </span>
            </span>
            <ChevronIcon />
          </Link>
          <div className="row-menu-wrap">
            <button
              type="button"
              className="row-more"
              aria-label={`Opcje: ${client.name}`}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                onMenu()
              }}
            >
              <DotsIcon />
            </button>
            {menu && (
              <div className="menu" role="menu">
                <button type="button" className="danger" onClick={onAskRemove}>
                  Usuń klienta
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </li>
  )
}
