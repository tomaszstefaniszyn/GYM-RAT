'use client'

import { useEffect, useRef, useState } from 'react'
import { compressImage } from '@/lib/image'
import { PersonGlyph } from './mark'

export function AvatarButton({
  id,
  hasAvatar,
  version,
  size = 54,
  onUploaded,
  onError,
}: {
  id: string
  hasAvatar: boolean
  version: string
  size?: number
  onUploaded?: (updatedAt: string) => void
  onError?: (message: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [bust, setBust] = useState(version)
  const [present, setPresent] = useState(hasAvatar)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setPresent(hasAvatar)
    setBust(version)
  }, [hasAvatar, version])

  async function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setBusy(true)
    try {
      let blob: Blob = file
      try {
        blob = await compressImage(file)
      } catch {
        if (file.size > 4 * 1024 * 1024) {
          onError?.('Zdjęcie jest za duże.')
          return
        }
      }
      const body = new FormData()
      body.append('file', blob, 'avatar.jpg')
      const res = await fetch(`/api/trainer/clients/${id}/avatar`, { method: 'POST', body, cache: 'no-store' })
      const data = (await res.json().catch(() => ({}))) as { error?: string; updatedAt?: string }
      if (!res.ok) {
        onError?.(data.error || 'Nie udało się zapisać zdjęcia.')
        return
      }
      setPresent(true)
      setBust(data.updatedAt || String(Date.now()))
      if (data.updatedAt) onUploaded?.(data.updatedAt)
    } catch {
      onError?.('Nie udało się zapisać zdjęcia.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="avatar-wrap" style={{ width: size, height: size }}>
      <button
        type="button"
        className={`avatar${busy ? ' is-busy' : ''}`}
        style={{ width: size, height: size }}
        onClick={() => inputRef.current?.click()}
        aria-label="Wybierz zdjęcie z galerii"
      >
        {present ? (
          // Authenticated, cache-busted avatar from our own API.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api/trainer/clients/${id}/avatar?v=${encodeURIComponent(bust)}`} alt="" />
        ) : (
          <PersonGlyph />
        )}
      </button>
      <input
        ref={inputRef}
        className="sr-only"
        tabIndex={-1}
        type="file"
        accept="image/*"
        onChange={onChange}
      />
    </div>
  )
}
