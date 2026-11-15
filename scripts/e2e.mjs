const base = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '')
const SENTENCE =
  'Cześć, zapraszam Cię do Twojego panelu treningowego w aplikacji Gym Rat. Kliknij w poniższy link, aby otworzyć swój plan treningowy'

const jar = new Map()

function fail(message) {
  console.error('FAIL:', message)
  process.exit(1)
}

function assert(condition, message) {
  if (!condition) fail(message)
}

function storeCookies(res) {
  const list = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : []
  for (const cookie of list) {
    const pair = cookie.split(';')[0]
    const index = pair.indexOf('=')
    if (index > 0) jar.set(pair.slice(0, index), pair.slice(index + 1))
  }
}

function cookieHeader() {
  return [...jar.entries()].map(([key, value]) => `${key}=${value}`).join('; ')
}

async function req(path, options = {}) {
  const headers = new Headers(options.headers || {})
  if (options.body && typeof options.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  const cookie = cookieHeader()
  if (cookie) headers.set('cookie', cookie)
  const res = await fetch(base + path, { ...options, headers })
  storeCookies(res)
  const text = await res.text()
  let data = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }
  }
  return { status: res.status, data, headers: res.headers }
}

const health = await req('/api/health')
assert(health.status === 200 && health.data.ok === true, 'health')

const bad = await req('/api/trainer/login', {
  method: 'POST',
  body: JSON.stringify({ email: 'ktoś@example.com' }),
})
assert(bad.status === 401, 'obcy e-mail odrzucony')

const good = await req('/api/trainer/login', {
  method: 'POST',
  body: JSON.stringify({ email: 'Czulosc.Joga@gmail.com' }),
})
assert(good.status === 200, 'drugi adres z allowlisty')

const created = await req('/api/trainer/clients', {
  method: 'POST',
  body: JSON.stringify({ name: 'E2E Ania', email: `e2e-${Date.now()}@example.com` }),
})
assert(created.status === 200, `tworzenie klienta: ${created.status} ${JSON.stringify(created.data)}`)
assert(created.data.emailed === false, 'bez RESEND link nie idzie mailem')
assert(created.data.emailText.startsWith(SENTENCE), 'dokładna treść zaproszenia')
assert(created.data.emailText.includes(created.data.inviteUrl), 'link w treści')
assert(!created.data.emailText.includes('abo otworzyć'), 'bez literówki abo')
const token = created.data.inviteUrl.split('/c/')[1]
const clientId = created.data.client.id

const home = await req(`/api/client/${token}`)
assert(home.status === 200 && home.data.workouts.length === 0, 'pusty panel klienta')

const plan = await req(`/api/trainer/clients/${clientId}/workouts`, {
  method: 'POST',
  body: JSON.stringify({ name: 'Trening A' }),
})
assert(plan.status === 200, 'nowy trening')

const exercise = await req(`/api/trainer/workouts/${plan.data.id}/exercises`, {
  method: 'POST',
  body: '{}',
})
assert(exercise.status === 200, 'nowe ćwiczenie')

const saved = await req(`/api/trainer/exercises/${exercise.data.id}`, {
  method: 'PATCH',
  body: JSON.stringify({ blok: 'Główne', cwiczenie: 'Przysiad\nwolno', serie: '4', reps: '8' }),
})
assert(saved.status === 200 && saved.data.cwiczenie.includes('wolno'), 'zapis pól')

const seen = await req(`/api/client/${token}/workouts/${plan.data.id}`)
assert(seen.status === 200 && seen.data.exercises[0].cwiczenie.includes('wolno'), 'klient widzi edycję trenera')

const toggled = await req(`/api/client/${token}/exercises/${exercise.data.id}`, {
  method: 'PATCH',
  body: JSON.stringify({ done: true, cwiczenie: 'HACKED' }),
})
assert(toggled.status === 200 && toggled.data.done === true, 'klient odhacza')
assert(toggled.data.cwiczenie.includes('wolno'), 'klient nie zmienia treści')

const trainerView = await req(`/api/trainer/workouts/${plan.data.id}`)
assert(trainerView.data.exercises[0].done === true, 'trener widzi wspólny checkbox')

const cleared = await req(`/api/trainer/exercises/${exercise.data.id}`, {
  method: 'PATCH',
  body: JSON.stringify({ done: false }),
})
assert(cleared.data.done === false, 'trener cofa checkbox')
const clientAgain = await req(`/api/client/${token}/workouts/${plan.data.id}`)
assert(clientAgain.data.exercises[0].done === false, 'klient widzi cofnięcie')

const other = await req('/api/trainer/clients', {
  method: 'POST',
  body: JSON.stringify({ name: 'E2E Beata', email: `e2e-b-${Date.now()}@example.com` }),
})
const otherToken = other.data.inviteUrl.split('/c/')[1]
const foreign = await req(`/api/client/${otherToken}/workouts/${plan.data.id}`)
assert(foreign.status === 404, 'cudzy trening jest niedostępny')

const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)
const form = new FormData()
form.append('file', new Blob([png], { type: 'image/png' }), 'a.png')
const uploaded = await fetch(`${base}/api/trainer/clients/${clientId}/avatar`, {
  method: 'POST',
  headers: { cookie: cookieHeader() },
  body: form,
})
assert(uploaded.status === 200, `avatar ${uploaded.status}`)
const image = await fetch(`${base}/api/trainer/clients/${clientId}/avatar`, { headers: { cookie: cookieHeader() } })
assert(image.status === 200 && (image.headers.get('content-type') || '').includes('image'), 'odczyt avatara')

const session = await fetch(`${base}/api/client/session`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ token }),
})
const setCookie = session.headers.get('set-cookie') || ''
assert(session.status === 200 && setCookie.includes('gr_client'), 'sesja klienta')
const me = await fetch(`${base}/api/client/me`, { headers: { cookie: setCookie.split(';')[0] } })
assert(me.status === 200, 'panel pamięta ciasteczko')

await req(`/api/trainer/exercises/${exercise.data.id}`, { method: 'DELETE' })
await req(`/api/trainer/workouts/${plan.data.id}`, { method: 'DELETE' })
const removed = await req(`/api/trainer/clients/${clientId}`, { method: 'DELETE' })
assert(removed.status === 200, 'usunięcie klienta')
await req(`/api/trainer/clients/${other.data.client.id}`, { method: 'DELETE' })

const loggedOut = await req('/api/trainer/logout', { method: 'POST', body: '{}' })
assert(loggedOut.status === 200, 'wylogowanie')
jar.delete('gr_trainer')
const locked = await req('/api/trainer/clients')
assert(locked.status === 401, 'API trenera wymaga sesji')

console.log('E2E OK')
