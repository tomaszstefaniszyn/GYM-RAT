'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api-client'
import type { WorkoutDTO } from '@/lib/types'
import { usePoll } from '@/lib/use-poll'
import { CropDialog } from './crop-dialog'
import { ExerciseLibrary, type LibraryPick } from './exercise-library'
import { BackIcon, CheckIcon, ChevronIcon, DotsIcon, Logo, TrashIcon } from './mark'

type DraftExercise = {
  key: string
  id?: string
  cwiczenie: string
  serie: string
  reps: string
  opis: string
  done: boolean
  hasImage: boolean
  updatedAt: string
  imageFile?: Blob | null
  previewUrl?: string
  opisOpen: boolean
}

type DraftBlock = {
  key: string
  id?: string
  name: string
  open: boolean
  exercises: DraftExercise[]
}

function fromWorkout(workout: WorkoutDTO, prev: DraftBlock[] = [], pending?: Set<string>): DraftBlock[] {
  return workout.blocks.map((block) => {
    const old = prev.find((item) => item.id === block.id)
    return {
      key: block.id,
      id: block.id,
      name: block.name,
      open: old?.open ?? false,
      exercises: block.exercises.map((exercise) => {
        const oldEx = old?.exercises.find((item) => item.id === exercise.id)
        const keepDone = pending?.has(exercise.id) && oldEx
        return {
          key: exercise.id,
          id: exercise.id,
          cwiczenie: exercise.cwiczenie,
          serie: exercise.serie,
          reps: exercise.reps,
          opis: exercise.opis,
          done: keepDone ? oldEx.done : exercise.done,
          hasImage: exercise.hasImage,
          updatedAt: exercise.updatedAt,
          opisOpen: oldEx?.opisOpen ?? false,
        }
      }),
    }
  })
}

function mergeDone(local: DraftBlock[], server: WorkoutDTO, pending: Set<string>) {
  const doneById = new Map<string, boolean>()
  for (const block of server.blocks) {
    for (const exercise of block.exercises) doneById.set(exercise.id, exercise.done)
  }
  return local.map((block) => ({
    ...block,
    exercises: block.exercises.map((exercise) => {
      if (!exercise.id || pending.has(exercise.id) || !doneById.has(exercise.id)) return exercise
      return { ...exercise, done: doneById.get(exercise.id) ?? exercise.done }
    }),
  }))
}

function NameField({
  value,
  onChange,
  label,
  placeholder,
}: {
  value: string
  onChange: (value: string) => void
  label: string
  placeholder: string
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [value])
  return (
    <textarea
      ref={ref}
      className="ex-name"
      aria-label={label}
      placeholder={placeholder}
      rows={1}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  )
}

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

export function WorkoutScreen({
  mode,
  initial,
  reloadUrl,
  backHref,
  saveUrl,
  deleteUrl,
  toggleBase,
  imageBase,
}: {
  mode: 'trainer' | 'client'
  initial: WorkoutDTO
  reloadUrl: string
  backHref: string
  saveUrl?: string
  deleteUrl?: string
  toggleBase: string
  imageBase: string
}) {
  const router = useRouter()
  const trainer = mode === 'trainer'
  const [name, setName] = useState(initial.name)
  const [blocks, setBlocks] = useState<DraftBlock[]>(() => fromWorkout(initial))
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [menuKey, setMenuKey] = useState<string | null>(null)
  const [confirmBlock, setConfirmBlock] = useState<string | null>(null)
  const [confirmWorkout, setConfirmWorkout] = useState(false)
  const [focusKey, setFocusKey] = useState<string | null>(null)
  const [crop, setCrop] = useState<{ src: string; key: string } | null>(null)
  const [lightbox, setLightbox] = useState<string | null>(null)
  const [libraryKey, setLibraryKey] = useState<string | null>(null)
  const dirty = useRef(false)
  const pending = useRef(new Set<string>())
  const fileRef = useRef<HTMLInputElement>(null)
  const pickKey = useRef<string | null>(null)

  useEffect(() => {
    const onLeave = (event: BeforeUnloadEvent) => {
      if (!dirty.current) return
      event.preventDefault()
    }
    window.addEventListener('beforeunload', onLeave)
    return () => window.removeEventListener('beforeunload', onLeave)
  }, [])

  useEffect(() => {
    if (!lightbox) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setLightbox(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightbox])

  usePoll(async () => {
    const data = await api<WorkoutDTO>(reloadUrl)
    if (dirty.current) {
      setBlocks((prev) => mergeDone(prev, data, pending.current))
      return
    }
    setName(data.name)
    setBlocks((prev) => fromWorkout(data, prev, pending.current))
  }, 2500)

  function touch() {
    dirty.current = true
  }

  function applyLibrary(pick: LibraryPick) {
    const key = libraryKey
    if (!key) return
    setBlocks((prev) =>
      prev.map((block) => ({
        ...block,
        exercises: block.exercises.map((exercise) => {
          if (exercise.key !== key) return exercise
          if (exercise.previewUrl) URL.revokeObjectURL(exercise.previewUrl)
          return {
            ...exercise,
            cwiczenie: pick.name,
            imageFile: pick.image,
            previewUrl: pick.image ? URL.createObjectURL(pick.image) : undefined,
            hasImage: Boolean(pick.image),
          }
        }),
      })),
    )
    touch()
    setLibraryKey(null)
  }

  function updateBlock(key: string, patch: Partial<DraftBlock>) {
    touch()
    setBlocks((prev) => prev.map((block) => (block.key === key ? { ...block, ...patch } : block)))
  }

  function updateExercise(blockKey: string, exerciseKey: string, patch: Partial<DraftExercise>) {
    touch()
    setBlocks((prev) =>
      prev.map((block) =>
        block.key === blockKey
          ? { ...block, exercises: block.exercises.map((exercise) => (exercise.key === exerciseKey ? { ...exercise, ...patch } : exercise)) }
          : block,
      ),
    )
  }

  async function toggle(blockKey: string, exercise: DraftExercise) {
    const next = !exercise.done
    setBlocks((prev) =>
      prev.map((block) =>
        block.key === blockKey
          ? { ...block, exercises: block.exercises.map((item) => (item.key === exercise.key ? { ...item, done: next } : item)) }
          : block,
      ),
    )
    if (!exercise.id) return
    pending.current.add(exercise.id)
    try {
      await api(`${toggleBase}/${exercise.id}`, { method: 'PATCH', body: JSON.stringify({ done: next }) })
    } catch (err) {
      setBlocks((prev) =>
        prev.map((block) =>
          block.key === blockKey
            ? { ...block, exercises: block.exercises.map((item) => (item.key === exercise.key ? { ...item, done: !next } : item)) }
            : block,
        ),
      )
      setError(err instanceof Error ? err.message : 'Nie zapisano.')
    } finally {
      pending.current.delete(exercise.id)
    }
  }

  async function save() {
    if (!saveUrl) return
    setBusy(true)
    setError(null)
    try {
      const payload = {
        name,
        blocks: await Promise.all(
          blocks.map(async (block) => ({
            id: block.id,
            name: block.name,
            exercises: await Promise.all(
              block.exercises.map(async (exercise) => {
                const item: Record<string, unknown> = {
                  id: exercise.id,
                  cwiczenie: exercise.cwiczenie,
                  serie: exercise.serie,
                  reps: exercise.reps,
                  opis: exercise.opis,
                }
                if (!exercise.id) item.done = exercise.done
                if (exercise.imageFile === null) item.image = null
                else if (exercise.imageFile) item.image = { data: await blobToBase64(exercise.imageFile), mime: 'image/jpeg' }
                return item
              }),
            ),
          })),
        ),
      }
      const saved = await api<WorkoutDTO>(saveUrl, { method: 'PUT', body: JSON.stringify(payload) })
      dirty.current = false
      setName(saved.name)
      setBlocks((prev) => fromWorkout(saved, prev))
      setToast('Plan zapisany')
      window.setTimeout(() => setToast(null), 2200)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie zapisano planu.')
    } finally {
      setBusy(false)
    }
  }

  async function removeWorkout() {
    if (!deleteUrl) return
    try {
      await api(deleteUrl, { method: 'DELETE' })
      dirty.current = false
      router.push(backHref)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie usunięto treningu.')
    }
  }

  return (
    <>
      <header className="topbar">
        <Link href={backHref} className="icon-btn" aria-label="Wróć">
          <BackIcon />
        </Link>
        {trainer ? (
          <input
            className="title-input"
            aria-label="Nazwa treningu"
            value={name}
            maxLength={80}
            onChange={(event) => {
              touch()
              setName(event.target.value)
            }}
          />
        ) : (
          <h1 className="title-input" style={{ textAlign: 'center' }}>
            {name}
          </h1>
        )}
        <Logo size={40} />
      </header>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="blocks">
        {blocks.map((block) => {
          const total = block.exercises.length
          const doneCount = block.exercises.filter((exercise) => exercise.done).length
          return (
            <section key={block.key} className="block-card">
              <div className="block-head">
                <span className="block-bar" />
                <div className="block-copy">
                  <div className="kicker">BLOK</div>
                  {trainer ? (
                    <input
                      className="block-name"
                      aria-label="Nazwa bloku"
                      placeholder="Nazwa bloku"
                      value={block.name}
                      maxLength={80}
                      autoFocus={focusKey === block.key}
                      onChange={(event) => updateBlock(block.key, { name: event.target.value })}
                    />
                  ) : (
                    <div className="block-title">{block.name || 'Blok'}</div>
                  )}
                  <div className={total > 0 && doneCount === total ? 'block-count is-full' : 'block-count'}>
                    {doneCount} z {total} wykonane
                  </div>
                </div>
                <div className="block-tools">
                  <button
                    type="button"
                    className="icon-btn"
                    aria-expanded={block.open}
                    aria-label={block.open ? 'Zwiń blok' : 'Rozwiń blok'}
                    onClick={() => setBlocks((prev) => prev.map((item) => (item.key === block.key ? { ...item, open: !item.open } : item)))}
                  >
                    <ChevronIcon dir={block.open ? 'up' : 'down'} />
                  </button>
                  {trainer ? (
                    <div className="menu-wrap">
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label="Menu bloku"
                        onClick={() => {
                          setMenuKey((current) => (current === block.key ? null : block.key))
                          setConfirmBlock(null)
                        }}
                      >
                        <DotsIcon />
                      </button>
                      {menuKey === block.key && (
                        <div className="menu" role="menu">
                          {confirmBlock === block.key ? (
                            <>
                              <button
                                type="button"
                                className="danger"
                                onClick={() => {
                                  touch()
                                  setBlocks((prev) => prev.filter((item) => item.key !== block.key))
                                  setMenuKey(null)
                                  setConfirmBlock(null)
                                }}
                              >
                                Usuń blok
                              </button>
                              <button type="button" onClick={() => setConfirmBlock(null)}>
                                Anuluj
                              </button>
                            </>
                          ) : (
                            <button type="button" className="danger" onClick={() => setConfirmBlock(block.key)}>
                              Usuń
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>
              {block.open && (
                <>
                  {block.exercises.map((exercise, index) => {
                    const removed = exercise.imageFile === null
                    const src =
                      exercise.previewUrl ||
                      (!removed && exercise.hasImage && exercise.id
                        ? `${imageBase}/${exercise.id}/image?v=${encodeURIComponent(exercise.updatedAt)}`
                        : null)
                    const photo = src ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={src} alt="" loading="lazy" decoding="async" />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src="/exercises/placeholder.svg" alt="" loading="lazy" decoding="async" />
                    )
                    return (
                      <article key={exercise.key} className={exercise.done ? 'ex-card is-done' : 'ex-card'}>
                        <div className="ex-top">
                          <span className="ex-badge">{String(index + 1).padStart(2, '0')}</span>
                          {trainer ? (
                            <div className="ex-name-row">
                              <NameField
                                value={exercise.cwiczenie}
                                label="Nazwa ćwiczenia"
                                placeholder="Nazwa ćwiczenia"
                                onChange={(value) => updateExercise(block.key, exercise.key, { cwiczenie: value })}
                              />
                              <button
                                type="button"
                                className="name-pick"
                                aria-label="Wybierz ćwiczenie z biblioteki"
                                onClick={() => setLibraryKey(exercise.key)}
                              >
                                <ChevronIcon dir="down" />
                              </button>
                            </div>
                          ) : (
                            <div className="ex-title">{exercise.cwiczenie}</div>
                          )}
                        </div>
                        <div className="ex-stats">
                          {trainer ? (
                            <button
                              type="button"
                              className="photo-btn"
                              aria-label={src ? 'Zmień zdjęcie ćwiczenia' : 'Dodaj zdjęcie ćwiczenia'}
                              onClick={() => {
                                pickKey.current = exercise.key
                                fileRef.current?.click()
                              }}
                            >
                              {photo}
                            </button>
                          ) : src ? (
                            <button
                              type="button"
                              className="photo-btn"
                              aria-label="Powiększ zdjęcie"
                              onClick={() => setLightbox(src)}
                            >
                              {photo}
                            </button>
                          ) : (
                            <span className="photo">{photo}</span>
                          )}
                          <label className="stat stat-serie">
                            <span className="stat-label">Serie</span>
                            {trainer ? (
                              <input
                                className="sq"
                                aria-label="Serie"
                                inputMode="numeric"
                                value={exercise.serie}
                                onChange={(event) => updateExercise(block.key, exercise.key, { serie: event.target.value })}
                              />
                            ) : (
                              <span className="sq-text">{exercise.serie}</span>
                            )}
                          </label>
                          <label className="stat stat-reps">
                            <span className="stat-label">Reps</span>
                            {trainer ? (
                              <input
                                className="sq sq-reps"
                                type="text"
                                inputMode="text"
                                autoComplete="off"
                                autoCapitalize="off"
                                spellCheck={false}
                                aria-label="Powtórzenia"
                                value={exercise.reps}
                                onChange={(event) => updateExercise(block.key, exercise.key, { reps: event.target.value })}
                              />
                            ) : (
                              <span className="sq-text sq-reps-text">{exercise.reps}</span>
                            )}
                          </label>
                          <div className="stat stat-done">
                            <span className="stat-label">Wykonane</span>
                            <button
                              type="button"
                              className={exercise.done ? 'sq check is-on' : 'sq check'}
                              aria-pressed={exercise.done}
                              aria-label={exercise.done ? 'Cofnij wykonanie' : 'Oznacz jako wykonane'}
                              onClick={() => void toggle(block.key, exercise)}
                            >
                              {exercise.done ? <CheckIcon color="#fff" /> : null}
                            </button>
                          </div>
                        </div>
                        <div className="ex-foot">
                          {(trainer || exercise.opis.trim()) && (
                            <button
                              type="button"
                              className="desc-toggle"
                              onClick={() =>
                                setBlocks((prev) =>
                                  prev.map((item) =>
                                    item.key === block.key
                                      ? {
                                          ...item,
                                          exercises: item.exercises.map((row) =>
                                            row.key === exercise.key ? { ...row, opisOpen: !row.opisOpen } : row,
                                          ),
                                        }
                                      : item,
                                  ),
                                )
                              }
                            >
                              <ChevronIcon dir={exercise.opisOpen ? 'up' : 'down'} />
                              {exercise.opisOpen ? 'Zwiń opis' : 'Pokaż opis'}
                            </button>
                          )}
                          {trainer && (
                            <button
                              type="button"
                              className="ex-remove"
                              onClick={() => {
                                touch()
                                setBlocks((prev) =>
                                  prev.map((item) =>
                                    item.key === block.key
                                      ? { ...item, exercises: item.exercises.filter((row) => row.key !== exercise.key) }
                                      : item,
                                  ),
                                )
                              }}
                            >
                              <TrashIcon /> Usuń
                            </button>
                          )}
                        </div>
                        {exercise.opisOpen && (
                          <div className="ex-desc">
                            {trainer ? (
                              <textarea
                                aria-label="Opis ćwiczenia"
                                placeholder="Dodaj opis ćwiczenia"
                                value={exercise.opis}
                                onChange={(event) => updateExercise(block.key, exercise.key, { opis: event.target.value })}
                              />
                            ) : (
                              exercise.opis
                            )}
                          </div>
                        )}
                      </article>
                    )
                  })}
                  {trainer && (
                    <button
                      type="button"
                      className="add-ex"
                      onClick={() => {
                        touch()
                        const key = `tmp-${crypto.randomUUID()}`
                        setBlocks((prev) =>
                          prev.map((item) =>
                            item.key === block.key
                              ? {
                                  ...item,
                                  open: true,
                                  exercises: [
                                    ...item.exercises,
                                    {
                                      key,
                                      cwiczenie: '',
                                      serie: '',
                                      reps: '',
                                      opis: '',
                                      done: false,
                                      hasImage: false,
                                      updatedAt: '',
                                      opisOpen: false,
                                    },
                                  ],
                                }
                              : item,
                          ),
                        )
                      }}
                    >
                      + Dodaj ćwiczenie
                    </button>
                  )}
                </>
              )}
            </section>
          )
        })}
      </div>
      {trainer && (
        <button
          type="button"
          className="add-block"
          onClick={() => {
            touch()
            const key = `tmp-${crypto.randomUUID()}`
            setFocusKey(key)
            setBlocks((prev) => [...prev, { key, name: '', open: true, exercises: [] }])
          }}
        >
          + Dodaj blok
        </button>
      )}
      {trainer && deleteUrl && (
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
      {trainer && (
        <div className="save-bar">
          <button type="button" className="btn-yellow" onClick={() => void save()} disabled={busy}>
            {busy ? 'Zapisywanie…' : 'Zapisz plan'}
          </button>
        </div>
      )}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
      <input
        ref={fileRef}
        className="sr-only"
        type="file"
        accept="image/*"
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          const key = pickKey.current
          if (!file || !key) return
          setCrop({ src: URL.createObjectURL(file), key })
        }}
      />
      {lightbox && (
        <div className="lightbox" role="dialog" aria-modal="true" aria-label="Zdjęcie ćwiczenia" onMouseDown={() => setLightbox(null)}>
          <button type="button" className="lightbox-close" aria-label="Zamknij" onMouseDown={(event) => event.stopPropagation()} onClick={() => setLightbox(null)}>
            ×
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox} alt="" onMouseDown={(event) => event.stopPropagation()} />
        </div>
      )}
      {libraryKey && <ExerciseLibrary onClose={() => setLibraryKey(null)} onPick={applyLibrary} />}
      {crop && (
        <CropDialog
          src={crop.src}
          shape="rect"
          title="Kadruj zdjęcie ćwiczenia"
          onCancel={() => {
            URL.revokeObjectURL(crop.src)
            setCrop(null)
          }}
          onConfirm={(blob) => {
            const previewUrl = URL.createObjectURL(blob)
            setBlocks((prev) =>
              prev.map((block) => ({
                ...block,
                exercises: block.exercises.map((exercise) => {
                  if (exercise.key !== crop.key) return exercise
                  if (exercise.previewUrl) URL.revokeObjectURL(exercise.previewUrl)
                  return { ...exercise, imageFile: blob, previewUrl, hasImage: true }
                }),
              })),
            )
            touch()
            URL.revokeObjectURL(crop.src)
            setCrop(null)
          }}
        />
      )}
    </>
  )
}
