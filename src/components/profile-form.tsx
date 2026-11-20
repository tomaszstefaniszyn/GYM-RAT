'use client'

import dynamic from 'next/dynamic'
import { useRef, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api-client'
import {
  LEVELS,
  PASS_TYPES,
  ageYears,
  diffDays,
  formatMeasure,
  formatYmd,
  normalizePassUsed,
  parseIsoDate,
  parsePlDate,
  passStatus,
  passTypeById,
  remainingLabel,
  validateProfile,
  warsawToday,
  type PassTypeId,
  type ProfileInput,
} from '@/lib/pass'
import type { ProfileDTO } from '@/lib/types'
import { Avatar } from './avatar'

const CropDialog = dynamic(() => import('./crop-dialog').then((mod) => mod.CropDialog), { ssr: false })
import { BackIcon, CalendarIcon, CameraIcon, CheckIcon, ClockIcon, PersonGlyph } from './mark'

function isoToPl(value: string | null) {
  if (!value) return ''
  const parsed = parseIsoDate(value)
  return parsed ? formatYmd(parsed) : ''
}

function yearsWord(age: number) {
  const mod10 = age % 10
  const mod100 = age % 100
  if (age === 1) return 'rok'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'lata'
  return 'lat'
}

function maskDate(raw: string) {
  const digits = raw.replace(/\D/g, '').slice(0, 8)
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}.${digits.slice(2)}`
  return `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4)}`
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  const picker = useRef<HTMLInputElement>(null)
  const iso = parsePlDate(value)
  return (
    <label className="stack-field">
      {label}
      <span className="date-field">
        <input
          className="control"
          inputMode="numeric"
          autoComplete="off"
          placeholder="DD.MM.RRRR"
          value={value}
          onChange={(event) => onChange(maskDate(event.target.value))}
        />
        <button
          type="button"
          className="cal-btn"
          aria-label={`Wybierz datę: ${label}`}
          onClick={() => {
            const input = picker.current
            if (!input) return
            if (typeof input.showPicker === 'function') {
              try {
                input.showPicker()
                return
              } catch {
                /* fall through */
              }
            }
            input.click()
          }}
        >
          <CalendarIcon />
        </button>
        <input
          ref={picker}
          className="sr-only"
          type="date"
          tabIndex={-1}
          value={iso ? `${iso.y}-${String(iso.m).padStart(2, '0')}-${String(iso.d).padStart(2, '0')}` : ''}
          onChange={(event) => {
            const parsed = parseIsoDate(event.target.value)
            if (parsed) onChange(formatYmd(parsed))
          }}
        />
      </span>
    </label>
  )
}

export function ProfileForm({
  initial,
  backHref,
  saveUrl,
  avatarUrl,
  lockPass = false,
}: {
  initial: ProfileDTO
  backHref: string
  saveUrl: string
  avatarUrl: string
  lockPass?: boolean
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState(initial.name)
  const [birthDate, setBirthDate] = useState(isoToPl(initial.birthDate))
  const [weight, setWeight] = useState(formatMeasure(initial.weightKg))
  const [height, setHeight] = useState(formatMeasure(initial.heightCm))
  const [level, setLevel] = useState(initial.level ?? '')
  const [passType, setPassType] = useState<PassTypeId | ''>(initial.passType ?? '')
  const [trainingStart, setTrainingStart] = useState(isoToPl(initial.trainingStart))
  const [passUsed, setPassUsed] = useState(initial.passUsed)
  const [goal, setGoal] = useState(initial.goal)
  const [injuries, setInjuries] = useState(initial.injuries)
  const [version, setVersion] = useState(initial.updatedAt)
  const [hasAvatar, setHasAvatar] = useState(initial.hasAvatar)
  const [file, setFile] = useState<Blob | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [removePhoto, setRemovePhoto] = useState(false)
  const [cropSrc, setCropSrc] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const today = warsawToday()
  const birth = parsePlDate(birthDate)
  const age = birth && diffDays(today, birth) <= 0 ? ageYears(birth, today) : null
  const slots = passTypeById(passType || null)?.slots ?? 0
  const status = passStatus(passType || null, parsePlDate(trainingStart), today)
  const usedCount = passUsed.filter(Boolean).length
  const showPhoto = Boolean(preview) || (hasAvatar && !removePhoto)
  const photoSrc = preview || (showPhoto && !preview ? `${avatarUrl}?v=${encodeURIComponent(version)}` : null)

  function applySaved(profile: ProfileDTO) {
    setName(profile.name)
    setBirthDate(isoToPl(profile.birthDate))
    setWeight(formatMeasure(profile.weightKg))
    setHeight(formatMeasure(profile.heightCm))
    setLevel(profile.level ?? '')
    setPassType(profile.passType ?? '')
    setTrainingStart(isoToPl(profile.trainingStart))
    setPassUsed(profile.passUsed)
    setGoal(profile.goal)
    setInjuries(profile.injuries)
    setVersion(profile.updatedAt)
    setHasAvatar(profile.hasAvatar)
    setFile(null)
    setRemovePhoto(false)
    if (preview) URL.revokeObjectURL(preview)
    setPreview(null)
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    const payload: ProfileInput = {
      name,
      birthDate,
      weightKg: weight.trim() ? (Number(weight.replace(',', '.')) as unknown as number) : null,
      heightCm: height.trim() ? (Number(height.replace(',', '.')) as unknown as number) : null,
      level: (level || null) as ProfileInput['level'],
      passType: passType || null,
      trainingStart,
      passUsed,
      goal,
      injuries,
    }
    const parsed = validateProfile({ ...payload, weightKg: weight, heightCm: height })
    if (!parsed.ok) {
      setError(parsed.error)
      return
    }
    const outgoing: Record<string, unknown> = { ...parsed.value }
    if (lockPass) {
      delete outgoing.passType
      delete outgoing.trainingStart
      delete outgoing.passUsed
    }
    setBusy(true)
    setError(null)
    try {
      if (file) {
        const body = new FormData()
        body.append('file', file, 'photo.jpg')
        const uploaded = await fetch(avatarUrl, { method: 'POST', body, cache: 'no-store' })
        const uploadedData = (await uploaded.json().catch(() => ({}))) as { error?: string }
        if (!uploaded.ok) throw new Error(uploadedData.error || 'Nie udało się zapisać zdjęcia.')
      } else if (removePhoto) {
        const removed = await fetch(avatarUrl, { method: 'DELETE', cache: 'no-store' })
        const removedData = (await removed.json().catch(() => ({}))) as { error?: string }
        if (!removed.ok) throw new Error(removedData.error || 'Nie udało się usunąć zdjęcia.')
      }
      const saved = await api<ProfileDTO>(saveUrl, { method: 'PATCH', body: JSON.stringify(outgoing) })
      applySaved(saved)
      setToast('Zapisano zmiany')
      window.setTimeout(() => setToast(null), 2200)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie zapisano zmian.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <header className="topbar center">
        <Link href={backHref} className="icon-btn" aria-label="Wróć">
          <BackIcon />
        </Link>
        <h1>Mój profil</h1>
        <span className="icon-btn" aria-hidden="true" />
      </header>
      <form id="profile-form" onSubmit={(event) => void onSubmit(event)}>
        <div className="photo-block">
          <button type="button" className="avatar-btn" onClick={() => fileRef.current?.click()} aria-label="Zmień zdjęcie">
            {photoSrc ? (
              <Avatar size={96} src={photoSrc} alt="" />
            ) : (
              <span className="avatar" style={{ width: 96, height: 96 }}>
                <PersonGlyph />
              </span>
            )}
            <span className="cam-badge">
              <CameraIcon />
            </span>
          </button>
          <button type="button" className="photo-caption" onClick={() => fileRef.current?.click()}>
            {showPhoto ? 'Zmień zdjęcie' : 'Dodaj zdjęcie'}
          </button>
          {showPhoto && (
            <button
              type="button"
              className="text-btn danger"
              onClick={() => {
                if (preview) URL.revokeObjectURL(preview)
                setPreview(null)
                setFile(null)
                setRemovePhoto(true)
              }}
            >
              Usuń zdjęcie
            </button>
          )}
          <input
            ref={fileRef}
            className="sr-only"
            type="file"
            accept="image/*"
            onChange={(event) => {
              const picked = event.target.files?.[0]
              event.target.value = ''
              if (!picked) return
              setCropSrc(URL.createObjectURL(picked))
            }}
          />
        </div>

        <h2 className="section-label">Dane podstawowe</h2>
        <div className="stack">
          <label className="stack-field">
            Imię
            <input className="control" value={name} onChange={(event) => setName(event.target.value)} placeholder="Wpisz imię" maxLength={80} />
          </label>
          <div className="grid-2">
            <div>
              <DateField label="Data urodzenia" value={birthDate} onChange={setBirthDate} />
              {age !== null && (
                <p className="age-line">
                  Wiek: {age} {yearsWord(age)}
                </p>
              )}
            </div>
            <label className="stack-field">
              Waga
              <span className="unit-field">
                <input
                  className="control"
                  inputMode="decimal"
                  placeholder="np. 75"
                  value={weight}
                  onChange={(event) => setWeight(event.target.value)}
                />
                <span className="unit">kg</span>
              </span>
            </label>
          </div>
          <div className="grid-2">
            <label className="stack-field">
              Wzrost
              <span className="unit-field">
                <input
                  className="control"
                  inputMode="decimal"
                  placeholder="np. 180"
                  value={height}
                  onChange={(event) => setHeight(event.target.value)}
                />
                <span className="unit">cm</span>
              </span>
            </label>
            <label className="stack-field">
              Poziom zaawansowania
              <select className="select" value={level} onChange={(event) => setLevel(event.target.value)}>
                <option value="">Wybierz</option>
                {LEVELS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <h2 className="section-label">Trening i zdrowie</h2>
        <div className="stack">
          {lockPass ? (
            <div className="stack-field">
              <span>Rodzaj karnetu</span>
              <div className="readonly-value">
                <span className="mark-highlight">{passTypeById(passType || null)?.label || '—'}</span>
              </div>
            </div>
          ) : (
            <label className="stack-field">
              Rodzaj karnetu
              <select
                className="select"
                value={passType}
                onChange={(event) => {
                  const next = event.target.value as PassTypeId | ''
                  setPassType(next)
                  setPassUsed(normalizePassUsed(next || null, passUsed))
                }}
              >
                <option value="">Wybierz</option>
                {PASS_TYPES.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          {lockPass ? (
            <div className="stack-field">
              <span>Data rozpoczęcia treningu</span>
              <div className="readonly-value">
                <span className="mark-highlight">{trainingStart || '—'}</span>
              </div>
            </div>
          ) : (
            <DateField label="Data rozpoczęcia treningu" value={trainingStart} onChange={setTrainingStart} />
          )}
          {status.kind === 'future' && (
            <div className="pass-note">
              <p>Karnet rozpocznie się {status.startsOn}</p>
              <p>Karnet ważny do {status.validUntil}</p>
            </div>
          )}
          {status.kind === 'active' && (
            <div className="pass-note">
              <p className="pass-pill">
                <ClockIcon /> {remainingLabel(status.remaining)}
              </p>
              <p>Karnet ważny do {status.validUntil}</p>
            </div>
          )}
          {status.kind === 'expired' && (
            <div className="pass-note">
              <p className="pass-pill is-muted">
                <ClockIcon /> Pozostało 0 dni
              </p>
              <p>Karnet wygasł {status.validUntil}</p>
            </div>
          )}
          {slots > 0 && (
            <div>
              <div className="pass-head">
                <span className="field-label">Wykorzystane wejścia</span>
                <span className="pass-count">
                  {usedCount} z {slots}
                </span>
              </div>
              {lockPass ? (
                <div className="used-track" role="img" aria-label={`${usedCount} z ${slots}`}>
                  <span style={{ width: `${Math.round((usedCount / slots) * 100)}%` }} />
                </div>
              ) : (
                <div className="passes">
                  {passUsed.map((used, index) => (
                    <span key={index} className="pass-slot">
                      <button
                        type="button"
                        className={used ? 'pass-box is-on' : 'pass-box'}
                        aria-pressed={used}
                        aria-label={`Wejście ${index + 1}`}
                        onClick={() => setPassUsed((prev) => prev.map((item, itemIndex) => (itemIndex === index ? !item : item)))}
                      >
                        {used ? <CheckIcon /> : index + 1}
                      </button>
                      {used ? <span className="pass-num">{index + 1}</span> : <span className="pass-num">&nbsp;</span>}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
          <label className="stack-field">
            Cel treningowy
            <textarea className="area" value={goal} onChange={(event) => setGoal(event.target.value)} placeholder="Co chcesz osiągnąć?" maxLength={4000} />
          </label>
          <label className="stack-field">
            Urazy / kontuzje
            <textarea
              className="area"
              value={injuries}
              onChange={(event) => setInjuries(event.target.value)}
              placeholder={'Opis ograniczenia lub wpisz „brak”'}
              maxLength={4000}
            />
          </label>
          <p className="hint">Uwzględnij także przebyte urazy.</p>
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="save-bar">
          <button className="btn-black" type="submit" disabled={busy}>
            {busy ? 'Zapisywanie…' : 'Zapisz zmiany'}
            <CheckIcon color="#f5b400" />
          </button>
        </div>
      </form>
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
      {cropSrc && (
        <CropDialog
          src={cropSrc}
          shape="round"
          title="Kadruj zdjęcie"
          onCancel={() => {
            URL.revokeObjectURL(cropSrc)
            setCropSrc(null)
          }}
          onConfirm={(blob) => {
            URL.revokeObjectURL(cropSrc)
            setCropSrc(null)
            if (preview) URL.revokeObjectURL(preview)
            setPreview(URL.createObjectURL(blob))
            setFile(blob)
            setRemovePhoto(false)
          }}
        />
      )}
    </>
  )
}
