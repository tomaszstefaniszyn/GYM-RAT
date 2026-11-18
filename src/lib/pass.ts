export const LEVELS = ['Początkujący', 'Średniozaawansowany', 'Zaawansowany'] as const
export type Level = (typeof LEVELS)[number]

export const PASS_TYPES = [
  { id: '4', label: '4 wejścia (550 zł)', slots: 4, days: 30 },
  { id: '8', label: '8 wejść (1\u00a0000 zł)', slots: 8, days: 40 },
  { id: '1', label: 'Jednorazowe wejście (150 zł)', slots: 1, days: null },
] as const

export type PassTypeId = (typeof PASS_TYPES)[number]['id']

export type YMD = { y: number; m: number; d: number }

export type PassStatus =
  | { kind: 'hidden' }
  | { kind: 'future'; startsOn: string; validUntil: string }
  | { kind: 'active'; remaining: number; validUntil: string }
  | { kind: 'expired'; remaining: 0; validUntil: string }

export function passTypeById(id: string | null | undefined) {
  return PASS_TYPES.find((item) => item.id === id) ?? null
}

export function warsawToday(now = new Date()): YMD {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Warsaw',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const pick = (type: string) => Number(parts.find((part) => part.type === type)?.value)
  return { y: pick('year'), m: pick('month'), d: pick('day') }
}

export function toIso(date: YMD) {
  return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`
}

export function formatYmd(date: YMD) {
  return `${String(date.d).padStart(2, '0')}.${String(date.m).padStart(2, '0')}.${date.y}`
}

export function parsePlDate(value: string): YMD | null {
  const match = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(value.trim())
  if (!match) return null
  const d = Number(match[1])
  const m = Number(match[2])
  const y = Number(match[3])
  if (y < 1900 || y > 2200) return null
  const utc = new Date(Date.UTC(y, m - 1, d))
  if (utc.getUTCFullYear() !== y || utc.getUTCMonth() !== m - 1 || utc.getUTCDate() !== d) return null
  return { y, m, d }
}

export function parseIsoDate(value: string | null | undefined): YMD | null {
  if (!value) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim())
  if (!match) return parsePlDate(value)
  return parsePlDate(`${match[3]}.${match[2]}.${match[1]}`)
}

export function parseAnyDate(value: unknown): YMD | null | undefined {
  if (value === null || value === undefined || value === '') return null
  if (typeof value !== 'string') return undefined
  return parseIsoDate(value) ?? undefined
}

export function addDays(date: YMD, days: number): YMD {
  const utc = new Date(Date.UTC(date.y, date.m - 1, date.d + days))
  return { y: utc.getUTCFullYear(), m: utc.getUTCMonth() + 1, d: utc.getUTCDate() }
}

export function diffDays(from: YMD, to: YMD) {
  const a = Date.UTC(from.y, from.m - 1, from.d)
  const b = Date.UTC(to.y, to.m - 1, to.d)
  return Math.round((b - a) / 86_400_000)
}

export function ageYears(birth: YMD, today: YMD) {
  let age = today.y - birth.y
  if (today.m < birth.m || (today.m === birth.m && today.d < birth.d)) age -= 1
  return age
}

export function passStatus(passType: PassTypeId | null, start: YMD | null, today = warsawToday()): PassStatus {
  const spec = passTypeById(passType)
  if (!spec || spec.days === null || !start) return { kind: 'hidden' }
  const expiry = addDays(start, spec.days)
  const validUntil = formatYmd(expiry)
  if (diffDays(today, start) > 0) {
    return { kind: 'future', startsOn: formatYmd(start), validUntil }
  }
  const remaining = diffDays(today, expiry)
  if (remaining <= 0) return { kind: 'expired', remaining: 0, validUntil }
  return { kind: 'active', remaining, validUntil }
}

export function remainingLabel(days: number) {
  if (days === 1) return 'Pozostał 1 dzień'
  return `Pozostało ${days} dni`
}

export function normalizePassUsed(passType: PassTypeId | null, used: unknown) {
  const slots = passTypeById(passType)?.slots ?? 0
  const source = Array.isArray(used) ? used : []
  return Array.from({ length: slots }, (_, index) => source[index] === true)
}

export function formatMeasure(value: number | null) {
  if (value === null || Number.isNaN(value)) return ''
  const rounded = Math.round(value * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace('.', ',')
}

export type ProfileInput = {
  name: string
  birthDate: string | null
  weightKg: number | null
  heightCm: number | null
  level: Level | null
  passType: PassTypeId | null
  trainingStart: string | null
  passUsed: boolean[]
  goal: string
  injuries: string
}

function parseMeasure(value: unknown, label: string, max: number): { ok: true; value: number | null } | { ok: false; error: string } {
  if (value === null || value === undefined || value === '') return { ok: true, value: null }
  const raw = typeof value === 'number' ? String(value) : typeof value === 'string' ? value.trim().replace(',', '.') : ''
  if (!raw) return { ok: true, value: null }
  if (!/^\d+(\.\d+)?$/.test(raw)) return { ok: false, error: `${label} musi być dodatnią liczbą.` }
  const number = Number(raw)
  if (!Number.isFinite(number) || number <= 0 || number > max) {
    return { ok: false, error: `${label} musi być dodatnią liczbą.` }
  }
  return { ok: true, value: Math.round(number * 10) / 10 }
}

export function validateProfile(body: unknown, today = warsawToday()): { ok: true; value: ProfileInput } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Brak danych.' }
  const record = body as Record<string, unknown>
  const name = typeof record.name === 'string' ? record.name.trim() : ''
  if (!name) return { ok: false, error: 'Podaj imię.' }
  if (name.length > 80) return { ok: false, error: 'Imię jest za długie.' }

  const birth = parseAnyDate(record.birthDate)
  if (birth === undefined) return { ok: false, error: 'Podaj datę urodzenia w formacie DD.MM.RRRR.' }
  if (birth && diffDays(today, birth) > 0) return { ok: false, error: 'Data urodzenia nie może być w przyszłości.' }

  const start = parseAnyDate(record.trainingStart)
  if (start === undefined) return { ok: false, error: 'Podaj datę rozpoczęcia w formacie DD.MM.RRRR.' }

  const weight = parseMeasure(record.weightKg, 'Waga', 500)
  if (!weight.ok) return weight
  const height = parseMeasure(record.heightCm, 'Wzrost', 300)
  if (!height.ok) return height

  let level: Level | null = null
  if (record.level !== null && record.level !== undefined && record.level !== '') {
    if (typeof record.level !== 'string' || !LEVELS.includes(record.level as Level)) {
      return { ok: false, error: 'Wybierz poziom zaawansowania.' }
    }
    level = record.level as Level
  }

  let passType: PassTypeId | null = null
  if (record.passType !== null && record.passType !== undefined && record.passType !== '') {
    if (typeof record.passType !== 'string' || !passTypeById(record.passType)) {
      return { ok: false, error: 'Wybierz rodzaj karnetu.' }
    }
    passType = record.passType as PassTypeId
  }

  const goal = typeof record.goal === 'string' ? record.goal.slice(0, 4000) : ''
  const injuries = typeof record.injuries === 'string' ? record.injuries.slice(0, 4000) : ''
  if (record.goal !== undefined && typeof record.goal !== 'string') return { ok: false, error: 'Nieprawidłowy cel treningowy.' }
  if (record.injuries !== undefined && typeof record.injuries !== 'string') return { ok: false, error: 'Nieprawidłowe urazy.' }

  return {
    ok: true,
    value: {
      name,
      birthDate: birth ? toIso(birth) : null,
      weightKg: weight.value,
      heightCm: height.value,
      level,
      passType,
      trainingStart: start ? toIso(start) : null,
      passUsed: normalizePassUsed(passType, record.passUsed),
      goal,
      injuries,
    },
  }
}
