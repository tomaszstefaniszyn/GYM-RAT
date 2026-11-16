'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api-client'
import type { ExerciseDTO, WorkoutDTO } from '@/lib/types'
import { usePoll } from '@/lib/use-poll'
import { BackIcon, GreenX, Logo, PlusIcon } from './mark'

const FIELDS = ['blok', 'cwiczenie', 'serie', 'reps'] as const
type Field = (typeof FIELDS)[number]

const LABELS: Record<Field, string> = {
  blok: 'Blok',
  cwiczenie: 'Ćwiczenie',
  serie: 'Serie',
  reps: 'Reps',
}

function mergeRows(prev: ExerciseDTO[], next: ExerciseDTO[], focusedKey: string | null, pending: Set<string>) {
  return next.map((server) => {
    const local = prev.find((row) => row.id === server.id)
    if (!local) return server
    const merged = { ...server }
    if (pending.has(server.id)) merged.done = local.done
    for (const field of FIELDS) {
      if (focusedKey === `${server.id}:${field}`) merged[field] = local[field]
    }
    return merged
  })
}

function Cell({
  row,
  field,
  readOnly,
  onChange,
  onFocusKey,
  onBlur,
}: {
  row: ExerciseDTO
  field: Field
  readOnly: boolean
  onChange: (value: string) => void
  onFocusKey: () => void
  onBlur: (value: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const ref = useRef<HTMLTextAreaElement>(null)
  const value = row[field]
  const center = field === 'serie' || field === 'reps'

  useEffect(() => {
    if (!editing) return
    const el = ref.current
    if (!el) return
    el.focus()
    const length = el.value.length
    el.setSelectionRange(length, length)
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [editing])

  if (readOnly || !editing) {
    return (
      <div
        className={`cell-text${center ? ' center' : ''}`}
        role={readOnly ? undefined : 'textbox'}
        tabIndex={readOnly ? undefined : 0}
        aria-label={LABELS[field]}
        onClick={() => {
          if (readOnly) return
          onFocusKey()
          setEditing(true)
        }}
        onKeyDown={(event) => {
          if (readOnly) return
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            onFocusKey()
            setEditing(true)
          }
        }}
      >
        {value}
      </div>
    )
  }

  return (
    <textarea
      ref={ref}
      className={`cell-text${center ? ' center' : ''}`}
      aria-label={LABELS[field]}
      value={value}
      rows={1}
      onChange={(event) => {
        const next = event.target.value
        event.target.style.height = 'auto'
        event.target.style.height = `${event.target.scrollHeight}px`
        onChange(next)
      }}
      onBlur={(event) => {
        setEditing(false)
        onBlur(event.target.value)
      }}
    />
  )
}

export function WorkoutScreen({
  mode,
  initial,
  reloadUrl,
  backHref,
  exerciseBase,
  addUrl,
  deleteUrl,
}: {
  mode: 'trainer' | 'client'
  initial: WorkoutDTO
  reloadUrl: string
  backHref: string
  exerciseBase: string
  addUrl?: string
  deleteUrl?: string
}) {
  const router = useRouter()
  const [name, setName] = useState(initial.name)
  const [rows, setRows] = useState(initial.exercises)
  const [error, setError] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [confirmWorkout, setConfirmWorkout] = useState(false)
  const focused = useRef<string | null>(null)
  const pending = useRef(new Set<string>())
  const timers = useRef(new Map<string, number>())
  const revision = useRef(0)

  usePoll(async () => {
    const ticket = revision.current
    const data = await api<WorkoutDTO>(reloadUrl)
    if (ticket !== revision.current) return
    setName(data.name)
    setRows((prev) => mergeRows(prev, data.exercises, focused.current, pending.current))
  }, 2500)

  function schedule(id: string, field: Field, value: string) {
    const key = `${id}:${field}`
    const existing = timers.current.get(key)
    if (existing) window.clearTimeout(existing)
    timers.current.set(
      key,
      window.setTimeout(() => {
        void save(id, field, value)
      }, 450),
    )
  }

  async function save(id: string, field: Field, value: string) {
    if (mode !== 'trainer') return
    timers.current.delete(`${id}:${field}`)
    try {
      await api(`${exerciseBase}/${id}`, { method: 'PATCH', body: JSON.stringify({ [field]: value }) })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie zapisano.')
    }
  }

  async function toggle(row: ExerciseDTO) {
    const next = !row.done
    pending.current.add(row.id)
    setRows((prev) => prev.map((item) => (item.id === row.id ? { ...item, done: next } : item)))
    try {
      await api(`${exerciseBase}/${row.id}`, { method: 'PATCH', body: JSON.stringify({ done: next }) })
    } catch (err) {
      setRows((prev) => prev.map((item) => (item.id === row.id ? { ...item, done: !next } : item)))
      setError(err instanceof Error ? err.message : 'Nie zapisano.')
    } finally {
      pending.current.delete(row.id)
    }
  }

  async function addExercise() {
    if (!addUrl) return
    revision.current += 1
    try {
      const created = await api<ExerciseDTO>(addUrl, { method: 'POST', body: '{}' })
      setRows((prev) => (prev.some((row) => row.id === created.id) ? prev : [...prev, created]))
      window.setTimeout(() => {
        document.getElementById(`${created.id}-cwiczenie`)?.scrollIntoView({ block: 'nearest' })
      }, 30)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie dodano ćwiczenia.')
    }
  }

  async function removeRow(id: string) {
    if (mode !== 'trainer') return
    revision.current += 1
    try {
      await api(`${exerciseBase}/${id}`, { method: 'DELETE' })
      setRows((prev) => prev.filter((row) => row.id !== id))
      setConfirmId(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie usunięto wiersza.')
    }
  }

  async function removeWorkout() {
    if (!deleteUrl) return
    try {
      await api(deleteUrl, { method: 'DELETE' })
      router.push(backHref)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie usunięto treningu.')
    }
  }

  return (
    <>
      <header className="topbar center">
        <Link href={backHref} className="icon-btn" aria-label="Wróć">
          <BackIcon />
        </Link>
        <h1>{name}</h1>
        <Logo size={34} />
      </header>
      {mode === 'trainer' && (
        <div className="add-row">
          <span>Dodaj ćwiczenie</span>
          <button type="button" className="icon-btn" aria-label="Dodaj ćwiczenie" onClick={() => void addExercise()}>
            <PlusIcon />
          </button>
        </div>
      )}
      {error && <p className="error">{error}</p>}
      <div className="table-wrap">
        <table className="plan">
          <colgroup>
            <col className="c-blok" />
            <col className="c-ex" />
            <col className="c-serie" />
            <col className="c-reps" />
            <col className="c-o" />
          </colgroup>
          <thead>
            <tr>
              <th className="c-blok">BLOK</th>
              <th>ĆWICZENIE</th>
              <th className="c-serie">SERIE</th>
              <th className="c-reps">REPS</th>
              <th className="c-o">O</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className={row.done ? 'is-done' : undefined}>
                <td>
                  <Cell
                    row={row}
                    field="blok"
                    readOnly={mode !== 'trainer'}
                    onFocusKey={() => {
                      focused.current = `${row.id}:blok`
                    }}
                    onChange={(value) => {
                      setRows((prev) => prev.map((item) => (item.id === row.id ? { ...item, blok: value } : item)))
                      schedule(row.id, 'blok', value)
                    }}
                    onBlur={(value) => {
                      focused.current = null
                      const key = `${row.id}:blok`
                      const existing = timers.current.get(key)
                      if (existing) window.clearTimeout(existing)
                      void save(row.id, 'blok', value)
                    }}
                  />
                </td>
                <td className="ex" id={`${row.id}-cwiczenie`}>
                  <Cell
                    row={row}
                    field="cwiczenie"
                    readOnly={mode !== 'trainer'}
                    onFocusKey={() => {
                      focused.current = `${row.id}:cwiczenie`
                    }}
                    onChange={(value) => {
                      setRows((prev) => prev.map((item) => (item.id === row.id ? { ...item, cwiczenie: value } : item)))
                      schedule(row.id, 'cwiczenie', value)
                    }}
                    onBlur={(value) => {
                      focused.current = null
                      const key = `${row.id}:cwiczenie`
                      const existing = timers.current.get(key)
                      if (existing) window.clearTimeout(existing)
                      void save(row.id, 'cwiczenie', value)
                    }}
                  />
                </td>
                <td>
                  <Cell
                    row={row}
                    field="serie"
                    readOnly={mode !== 'trainer'}
                    onFocusKey={() => {
                      focused.current = `${row.id}:serie`
                    }}
                    onChange={(value) => {
                      setRows((prev) => prev.map((item) => (item.id === row.id ? { ...item, serie: value } : item)))
                      schedule(row.id, 'serie', value)
                    }}
                    onBlur={(value) => {
                      focused.current = null
                      const key = `${row.id}:serie`
                      const existing = timers.current.get(key)
                      if (existing) window.clearTimeout(existing)
                      void save(row.id, 'serie', value)
                    }}
                  />
                </td>
                <td>
                  <Cell
                    row={row}
                    field="reps"
                    readOnly={mode !== 'trainer'}
                    onFocusKey={() => {
                      focused.current = `${row.id}:reps`
                    }}
                    onChange={(value) => {
                      setRows((prev) => prev.map((item) => (item.id === row.id ? { ...item, reps: value } : item)))
                      schedule(row.id, 'reps', value)
                    }}
                    onBlur={(value) => {
                      focused.current = null
                      const key = `${row.id}:reps`
                      const existing = timers.current.get(key)
                      if (existing) window.clearTimeout(existing)
                      void save(row.id, 'reps', value)
                    }}
                  />
                </td>
                <td className="col-o">
                  <button
                    type="button"
                    className={row.done ? 'check is-on' : 'check'}
                    aria-pressed={row.done}
                    aria-label={row.done ? 'Odznacz ćwiczenie' : 'Oznacz jako zrobione'}
                    onClick={() => void toggle(row)}
                  >
                    <span className="box">{row.done ? <GreenX /> : null}</span>
                  </button>
                  {mode === 'trainer' &&
                    (confirmId === row.id ? (
                      <button type="button" className="row-del is-hot" onClick={() => void removeRow(row.id)}>
                        Usuń
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="row-del"
                        aria-label="Usuń ćwiczenie"
                        onPointerDown={(event) => event.preventDefault()}
                        onClick={() => setConfirmId(row.id)}
                      >
                        ×
                      </button>
                    ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {mode === 'trainer' && (
        <div className="danger-zone">
          {confirmWorkout ? (
            <div className="confirm-line">
              <span>Usunąć trening?</span>
              <button type="button" className="text-btn danger" onClick={() => void removeWorkout()}>
                Usuń
              </button>
              <button type="button" className="text-btn" onClick={() => setConfirmWorkout(false)}>
                Anuluj
              </button>
            </div>
          ) : (
            <button type="button" className="text-btn danger" onClick={() => setConfirmWorkout(true)}>
              Usuń trening
            </button>
          )}
        </div>
      )}
    </>
  )
}
