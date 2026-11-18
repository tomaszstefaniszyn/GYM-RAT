'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api-client'
import { formatIsoDatePl } from '@/lib/dates'
import type { ClientListItem } from '@/lib/types'
import { usePoll } from '@/lib/use-poll'
import { Avatar } from './avatar'
import { InviteDialog } from './dialogs'
import { ChevronIcon, DotsIcon, Logo, LogoutIcon, PlusIcon, TrashIcon } from './mark'

const REVEAL = 96

export function ClientsScreen({ initial }: { initial: ClientListItem[] }) {
  const [clients, setClients] = useState(initial)
  const [invite, setInvite] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [menuId, setMenuId] = useState<string | null>(null)
  const [dateEdit, setDateEdit] = useState<{ workoutId: string; date: string; name: string } | null>(null)
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
      if (target.closest('[data-swipe]') || target.closest('.row-menu') || target.closest('.menu')) return
      setOpenId(null)
      setMenuId(null)
    }
    window.addEventListener('pointerdown', close)
    return () => window.removeEventListener('pointerdown', close)
  }, [openId, menuId])

  async function saveDate() {
    if (!dateEdit) return
    setBusy(true)
    setError(null)
    try {
      const saved = await api<{ date: string }>(`/api/trainer/workouts/${dateEdit.workoutId}`, {
        method: 'PATCH',
        body: JSON.stringify({ planDate: dateEdit.date }),
      })
      setClients((prev) =>
        prev.map((client) => ({
          ...client,
          workouts: client.workouts.map((workout) =>
            workout.id === dateEdit.workoutId ? { ...workout, date: saved.date } : workout,
          ),
        })),
      )
      setDateEdit(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie zapisano daty.')
    } finally {
      setBusy(false)
    }
  }

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
              onDate={(workout) => {
                setOpenId(null)
                setMenuId(null)
                setError(null)
                setDateEdit({ workoutId: workout.id, date: workout.date, name: workout.name })
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
      {dateEdit && (
        <div className="backdrop" onMouseDown={() => setDateEdit(null)}>
          <div
            className="dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="date-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <h2 id="date-title">Data treningu</h2>
            <p className="hint" style={{ textAlign: 'center', marginBottom: 12 }}>
              {dateEdit.name}
            </p>
            <label className="stack-field">
              Data
              <input
                className="control"
                type="date"
                value={dateEdit.date}
                onChange={(event) => setDateEdit({ ...dateEdit, date: event.target.value })}
              />
            </label>
            {error && <p className="error">{error}</p>}
            <div className="crop-actions">
              <button type="button" className="btn-ghost" onClick={() => setDateEdit(null)}>
                Anuluj
              </button>
              <button type="button" className="btn-yellow" disabled={busy || !dateEdit.date} onClick={() => void saveDate()}>
                Zapisz
              </button>
            </div>
          </div>
        </div>
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
              Czy na pewno chcesz usunąć klienta {confirm.name} z panelu?
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

function ClientRow({
  client,
  open,
  menu,
  onOpen,
  onClose,
  onMenu,
  onDate,
  onAskRemove,
}: {
  client: ClientListItem
  open: boolean
  menu: boolean
  onOpen: () => void
  onClose: () => void
  onMenu: () => void
  onDate: (workout: ClientListItem['workouts'][number]) => void
  onAskRemove: () => void
}) {
  const [shift, setShift] = useState(0)
  const [dragging, setDragging] = useState(false)
  const start = useRef<{ x: number; y: number; axis: 'x' | 'y' | null; pointer: number } | null>(null)
  const suppress = useRef(false)

  useEffect(() => {
    if (!dragging) setShift(open ? -REVEAL : 0)
  }, [open, dragging])

  return (
    <li className="swipe-host" data-swipe="">
      <button type="button" className="swipe-reveal" onClick={onAskRemove}>
        <TrashIcon />
        Usuń
      </button>
      <div
        className={dragging ? 'swipe-face is-drag' : 'swipe-face'}
        style={{ transform: `translateX(${shift}px)` }}
        onPointerDown={(event) => {
          if (event.button !== 0) return
          start.current = { x: event.clientX, y: event.clientY, axis: null, pointer: event.pointerId }
          suppress.current = false
          setDragging(true)
          event.currentTarget.setPointerCapture(event.pointerId)
        }}
        onPointerMove={(event) => {
          const origin = start.current
          if (!origin || origin.pointer !== event.pointerId) return
          const dx = event.clientX - origin.x
          const dy = event.clientY - origin.y
          if (!origin.axis) {
            if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return
            origin.axis = Math.abs(dx) > Math.abs(dy) * 1.25 ? 'x' : 'y'
          }
          if (origin.axis !== 'x') return
          suppress.current = true
          const base = open ? -REVEAL : 0
          setShift(Math.min(0, Math.max(-REVEAL, base + dx)))
        }}
        onPointerUp={(event) => {
          const origin = start.current
          if (!origin || origin.pointer !== event.pointerId) return
          if (origin.axis === 'x') {
            const base = open ? -REVEAL : 0
            const next = Math.min(0, Math.max(-REVEAL, base + (event.clientX - origin.x)))
            if (next < -REVEAL / 2) onOpen()
            else onClose()
          }
          start.current = null
          setDragging(false)
        }}
        onPointerCancel={() => {
          start.current = null
          setDragging(false)
          setShift(open ? -REVEAL : 0)
        }}
      >
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
              <span className="client-name">{client.name}</span>
              <span className="client-meta">
                {client.workouts.length === 0 ? (
                  <span>Brak treningów</span>
                ) : (
                  client.workouts.map((workout) => (
                    <span key={workout.id} className="meta-line">
                      {workout.name} ·{' '}
                      <button
                        type="button"
                        className="date-hit"
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={(event) => {
                          event.preventDefault()
                          event.stopPropagation()
                          onDate(workout)
                        }}
                      >
                        {formatIsoDatePl(workout.date)}
                      </button>
                    </span>
                  ))
                )}
              </span>
            </span>
            <ChevronIcon />
          </Link>
          <div className="row-menu-wrap">
            <button type="button" className="row-more" aria-label={`Opcje: ${client.name}`} onClick={onMenu}>
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
