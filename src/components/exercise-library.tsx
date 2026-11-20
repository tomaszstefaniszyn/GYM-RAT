'use client'

import { useEffect, useRef, useState } from 'react'
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

export function ExerciseLibrary({ onClose, onPick }: { onClose: () => void; onPick: (pick: LibraryPick) => void }) {
  const [items, setItems] = useState<LibraryExerciseDTO[]>([])
  const [openId, setOpenId] = useState<string | null>(null)
  const [menuId, setMenuId] = useState<string | null>(null)
  const [manual, setManual] = useState(false)
  const [name, setName] = useState('')
  const [file, setFile] = useState<Blob | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const saving = useRef(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false
    void api<{ exercises: LibraryExerciseDTO[] }>('/api/trainer/library')
      .then((data) => {
        if (!cancelled) setItems(data.exercises)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Nie udało się wczytać biblioteki.')
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

  async function choose(item: LibraryExerciseDTO) {
    let image: Blob | null = null
    if (item.imageUrl) {
      try {
        const res = await fetch(item.imageUrl)
        if (res.ok) image = await res.blob()
      } catch {
        image = null
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
    <div className="backdrop" onMouseDown={onClose}>
      <div
        className="sheet"
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
              <button type="submit" className="btn-yellow" disabled={busy}>
                Dodaj ćwiczenie
              </button>
            </div>
          </form>
        )}
        {error && <p className="error">{error}</p>}
        <ul className="lib-list">
          {items.map((item) => (
            <LibraryRow
              key={item.id}
              item={item}
              open={openId === item.id}
              menu={menuId === item.id}
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
      </div>
    </div>
  )
}

function LibraryRow({
  item,
  open,
  menu,
  onOpen,
  onClose,
  onMenu,
  onPick,
  onRemove,
}: {
  item: LibraryExerciseDTO
  open: boolean
  menu: boolean
  onOpen: () => void
  onClose: () => void
  onMenu: () => void
  onPick: () => void
  onRemove: () => void
}) {
  const { shift, dragging, suppress, bind } = useHorizontalSwipe(open, onOpen, onClose, 88)
  const src = item.imageUrl || '/exercises/placeholder.svg'
  return (
    <li className={menu ? 'swipe-host is-menu' : 'swipe-host'} data-swipe="">
      <button type="button" className="swipe-reveal" onClick={onRemove}>
        <TrashIcon />
        Usuń
      </button>
      <div className={dragging ? 'swipe-face on-card is-drag' : 'swipe-face on-card'} style={{ transform: `translateX(${shift}px)` }} {...bind}>
        <div className="lib-row">
          <button
            type="button"
            className="lib-pick"
            onClick={() => {
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
            <span className="lib-name">{item.name}</span>
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
