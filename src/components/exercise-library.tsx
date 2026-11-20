'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '@/lib/api-client'
import { compressImage } from '@/lib/image'
import type { LibraryExerciseDTO } from '@/lib/types'
import { DotsIcon, TrashIcon } from './mark'
import { useHorizontalSwipe } from './use-swipe'

export type LibraryPick = { name: string; image: Blob | null }

function blobToBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result || '')
      const comma = result.indexOf(',')
      resolve(comma >= 0 ? result.slice(comma + 1) : result)
    }
    reader.onerror = () => reject(new Error('file'))
    reader.readAsDataURL(blob)
  })
}

function fold(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
}

export function ExerciseLibrary({ onClose, onPick }: { onClose: () => void; onPick: (pick: LibraryPick) => void }) {
  const [items, setItems] = useState<LibraryExerciseDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState<string | null>(null)
  const [menuId, setMenuId] = useState<string | null>(null)
  const [manual, setManual] = useState(false)
  const [name, setName] = useState('')
  const [file, setFile] = useState<Blob | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [pickingId, setPickingId] = useState<string | null>(null)
  const saving = useRef(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void api<{ exercises: LibraryExerciseDTO[] }>('/api/trainer/library')
      .then((data) => {
        if (cancelled) return
        setItems(data.exercises)
        setError(null)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Nie udało się wczytać biblioteki.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const shown = useMemo(() => {
    const needle = fold(query.trim())
    if (!needle) return items
    return items.filter((item) => fold(item.name).includes(needle))
  }, [items, query])

  async function choose(item: LibraryExerciseDTO) {
    if (pickingId || saving.current) return
    setPickingId(item.id)
    let image: Blob | null = null
    if (item.imageUrl) {
      const controller = new AbortController()
      const timer = window.setTimeout(() => controller.abort(), 8000)
      try {
        const res = await fetch(item.imageUrl, { signal: controller.signal })
        if (res.ok) image = await res.blob()
      } catch {
        image = null
      } finally {
        window.clearTimeout(timer)
      }
    }
    onPick({ name: item.name, image })
    onClose()
  }

  async function addManual() {
    if (saving.current) return
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Podaj nazwę ćwiczenia.')
      return
    }
    saving.current = true
    setBusy(true)
    setError(null)
    try {
      let image: { data: string; mime: string } | undefined
      if (file) {
        image = { data: await blobToBase64(file), mime: file.type || 'image/jpeg' }
      }
      const created = await api<{ exercise: LibraryExerciseDTO }>('/api/trainer/library', {
        method: 'POST',
        body: JSON.stringify({ name: trimmed, image: image ?? null }),
      })
      await choose(created.exercise)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się dodać ćwiczenia.')
      saving.current = false
      setBusy(false)
    }
  }

  async function remove(id: string) {
    setError(null)
    try {
      await api(`/api/trainer/library/${id}`, { method: 'DELETE' })
      setItems((prev) => prev.filter((item) => item.id !== id))
      setOpenId(null)
      setMenuId(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się usunąć ćwiczenia.')
    }
  }

  return (
    <div className="backdrop is-sheet" onMouseDown={onClose}>
      <div
        className="sheet library-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="library-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="sheet-head">
          <h2 id="library-title">Biblioteka ćwiczeń</h2>
          <button type="button" className="text-btn" onClick={onClose}>
            Zamknij
          </button>
        </div>
        <button type="button" className="lib-manual" onClick={() => setManual(true)}>
          Dodaj ręcznie
        </button>
        {manual && (
          <form
            className="lib-form"
            onSubmit={(event) => {
              event.preventDefault()
              void addManual()
            }}
          >
            <label className="stack-field">
              Nazwa ćwiczenia
              <input
                className="control"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={120}
                required
                autoFocus
              />
            </label>
            <div className="lib-photo-row">
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="lib-photo" src={preview} alt="" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="lib-photo" src="/exercises/placeholder.svg" alt="" />
              )}
              <button type="button" className="text-btn" onClick={() => fileRef.current?.click()}>
                {file ? 'Zmień zdjęcie' : 'Dodaj zdjęcie'}
              </button>
              <input
                ref={fileRef}
                className="sr-only"
                type="file"
                accept="image/*"
                onChange={(event) => {
                  const picked = event.target.files?.[0]
                  event.target.value = ''
                  if (!picked) return
                  void compressImage(picked)
                    .then((blob) => {
                      if (preview) URL.revokeObjectURL(preview)
                      setFile(blob)
                      setPreview(URL.createObjectURL(blob))
                    })
                    .catch(() => setError('Nie udało się odczytać zdjęcia.'))
                }}
              />
            </div>
            <div className="crop-actions">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  setManual(false)
                  setName('')
                  setFile(null)
                  if (preview) URL.revokeObjectURL(preview)
                  setPreview(null)
                  setError(null)
                }}
              >
                Anuluj
              </button>
              <button type="submit" className="btn-yellow" disabled={busy || pickingId !== null}>
                Dodaj ćwiczenie
              </button>
            </div>
          </form>
        )}
        <div className="lib-search">
          <input
            className="control"
            type="text"
            inputMode="search"
            enterKeyHint="search"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder="Szukaj ćwiczenia"
            aria-label="Szukaj ćwiczenia"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {query && (
            <button type="button" className="lib-clear" aria-label="Wyczyść wyszukiwanie" onClick={() => setQuery('')}>
              ×
            </button>
          )}
        </div>
        {error && <p className="error lib-error">{error}</p>}
        <div className="lib-scroll">
          {loading ? (
            <p className="empty">Wczytuję bibliotekę…</p>
          ) : shown.length === 0 ? (
            <p className="empty">Brak wyników</p>
          ) : (
            <ul className="lib-list">
              {shown.map((item) => (
                <LibraryRow
                  key={item.id}
                  item={item}
                  open={openId === item.id}
                  menu={menuId === item.id}
                  picking={pickingId === item.id}
                  disabled={pickingId !== null && pickingId !== item.id}
                  onOpen={() => {
                    setMenuId(null)
                    setOpenId(item.id)
                  }}
                  onClose={() => setOpenId((current) => (current === item.id ? null : current))}
                  onMenu={() => {
                    setOpenId(null)
                    setMenuId((current) => (current === item.id ? null : item.id))
                  }}
                  onPick={() => void choose(item)}
                  onRemove={() => void remove(item.id)}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

function LibraryRow({
  item,
  open,
  menu,
  picking,
  disabled,
  onOpen,
  onClose,
  onMenu,
  onPick,
  onRemove,
}: {
  item: LibraryExerciseDTO
  open: boolean
  menu: boolean
  picking: boolean
  disabled: boolean
  onOpen: () => void
  onClose: () => void
  onMenu: () => void
  onPick: () => void
  onRemove: () => void
}) {
  const { shift, dragging, suppress, bind } = useHorizontalSwipe(open, onOpen, onClose, 88, false)
  const src = item.imageUrl || '/exercises/placeholder.svg'
  const revealed = open || dragging
  return (
    <li className={menu ? 'swipe-host is-menu' : revealed ? 'swipe-host is-open' : 'swipe-host'} data-swipe="">
      {revealed && (
        <button type="button" className="swipe-reveal" onClick={onRemove}>
          <TrashIcon />
          Usuń
        </button>
      )}
      <div
        className={dragging ? 'swipe-face on-card is-drag' : 'swipe-face on-card'}
        style={shift ? { transform: `translate3d(${shift}px, 0, 0)` } : undefined}
        {...bind}
      >
        <div className="lib-row">
          <button
            type="button"
            className="lib-pick"
            disabled={disabled || picking}
            onClick={() => {
              if (disabled || picking) return
              if (suppress.current || open) {
                suppress.current = false
                if (open) onClose()
                return
              }
              onPick()
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="lib-photo" src={src} alt="" loading="lazy" decoding="async" />
            <span className="lib-name">{picking ? 'Wybieram…' : item.name}</span>
          </button>
          <div className="row-menu-wrap">
            <button
              type="button"
              className="row-more"
              aria-label={`Opcje: ${item.name}`}
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
                <button type="button" className="danger" onClick={onRemove}>
                  Usuń
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </li>
  )
}
