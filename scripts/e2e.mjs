const base = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '')
const SENTENCE =
  'Cześć, zapraszam Cię do Twojego panelu treningowego w aplikacji Gym Rat. Kliknij w poniższy link, aby otworzyć swój plan treningowy'
const GENERIC = 'Nieprawidłowy e-mail lub hasło.'

const jar = new Map()

function trainerUsedClass(summary) {
  return summary.used === 7 && summary.limit === 8
}

function fail(message) {
  console.error('FAIL:', message)
  process.exit(1)
}

function assert(condition, message) {
  if (!condition) fail(message)
}

function warsawToday() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Warsaw',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const pick = (type) => parts.find((part) => part.type === type).value
  return `${pick('year')}-${pick('month')}-${pick('day')}`
}

function addDays(iso, days) {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d + days))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}

function formatPl(iso) {
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}

function ageOn(birth, today) {
  const [ty, tm, td] = today.split('-').map(Number)
  const [y, m, d] = birth.split('-').map(Number)
  let years = ty - y
  if (tm < m || (tm === m && td < d)) years -= 1
  return years
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

const malformed = await req('/api/trainer/login', {
  method: 'POST',
  body: JSON.stringify({ email: 'nie-email', password: 'MasterSplinter' }),
})
assert(malformed.status === 400, 'zły format e-mail')

const missingPassword = await req('/api/trainer/login', {
  method: 'POST',
  body: JSON.stringify({ email: 'tomaszstefaniszyn9@gmail.com' }),
})
assert(missingPassword.status === 400, 'brak hasła')

const badPassword = await req('/api/trainer/login', {
  method: 'POST',
  body: JSON.stringify({ email: 'tomaszstefaniszyn9@gmail.com', password: 'zle-haslo' }),
})
assert(badPassword.status === 401 && badPassword.data.error === GENERIC, 'złe hasło, ogólny komunikat')

const badEmail = await req('/api/trainer/login', {
  method: 'POST',
  body: JSON.stringify({ email: 'ktoś@example.com', password: 'MasterSplinter' }),
})
assert(badEmail.status === 401 && badEmail.data.error === GENERIC, 'obcy e-mail, ten sam komunikat')

const good = await req('/api/trainer/login', {
  method: 'POST',
  body: JSON.stringify({ email: 'Czulosc.Joga@gmail.com', password: 'MasterSplinter' }),
})
assert(good.status === 200, 'drugi adres z allowlisty i hasło')

const created = await req('/api/trainer/clients', {
  method: 'POST',
  body: JSON.stringify({ name: 'E2E Ania', email: `e2e-${Date.now()}@example.com` }),
})
assert(created.status === 200, `tworzenie klienta: ${created.status} ${JSON.stringify(created.data)}`)
assert(created.data.emailed === false, 'bez Gmaila i Resend link nie idzie mailem')
assert(created.data.emailError == null, 'tryb lokalny nie udaje błędu Gmaila')
assert(created.data.emailText.startsWith(SENTENCE), 'dokładna treść zaproszenia')
assert(created.data.emailText.includes(created.data.inviteUrl), 'link w treści')
assert(!created.data.emailText.includes('abo otworzyć'), 'bez literówki abo')
const token = created.data.inviteUrl.split('/c/')[1]
const clientId = created.data.client.id

const home = await req(`/api/client/${token}`)
assert(home.status === 200 && home.data.workouts.length === 0, 'pusty panel klienta')

const plan = await req(`/api/trainer/clients/${clientId}/workouts`, {
  method: 'POST',
  body: JSON.stringify({}),
})
assert(plan.status === 200 && plan.data.name === 'Trening A', 'nowy trening dostaje nazwę')
const workout = await req(`/api/trainer/workouts/${plan.data.id}`)
assert(workout.status === 200, 'odczyt treningu')
assert(workout.data.blocks.length === 1 && workout.data.blocks[0].name === 'Rozgrzewka', 'domyślny blok Rozgrzewka')
assert(workout.data.blocks[0].exercises.length === 0, 'pusty blok')

const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)
const saved = await req(`/api/trainer/workouts/${plan.data.id}`, {
  method: 'PUT',
  body: JSON.stringify({
    name: 'Trening A',
    blocks: [
      {
        id: workout.data.blocks[0].id,
        name: 'Rozgrzewka',
        exercises: [
          {
            cwiczenie: 'Przysiad\nwolno',
            serie: '4',
            reps: '8 min',
            opis: 'Plecy prosto',
            done: false,
            image: { data: png.toString('base64'), mime: 'image/png' },
          },
        ],
      },
      { name: 'Siła', exercises: [] },
    ],
  }),
})
assert(saved.status === 200 && saved.data.blocks.length === 2, `zapis planu ${saved.status} ${JSON.stringify(saved.data)}`)
assert(saved.data.blocks[0].exercises[0].cwiczenie.includes('wolno'), 'zapis nazwy')
assert(saved.data.blocks[0].exercises[0].opis === 'Plecy prosto', 'zapis opisu')
assert(saved.data.blocks[0].exercises[0].reps === '8 min', 'reps zostaje tekstem')
assert(saved.data.blocks[0].exercises[0].hasImage === true, 'zdjęcie ćwiczenia')
assert(saved.data.blocks[1].name === 'Siła', 'nowy blok')
const exerciseId = saved.data.blocks[0].exercises[0].id

const seen = await req(`/api/client/${token}/workouts/${plan.data.id}`)
assert(seen.status === 200 && seen.data.blocks[0].exercises[0].opis === 'Plecy prosto', 'klient widzi plan')
assert(seen.data.blocks[0].exercises[0].reps === '8 min', 'klient widzi tekstowe reps')
const image = await fetch(`${base}/api/client/${token}/exercises/${exerciseId}/image`)
assert(image.status === 200 && (image.headers.get('content-type') || '').includes('image'), 'klient widzi zdjęcie')

const forbiddenEdit = await req(`/api/client/${token}/exercises/${exerciseId}`, {
  method: 'PATCH',
  body: JSON.stringify({ done: true, cwiczenie: 'HACKED' }),
})
assert(forbiddenEdit.status === 403, 'klient nie może zmienić treści')
const unchanged = await req(`/api/client/${token}/workouts/${plan.data.id}`)
assert(unchanged.data.blocks[0].exercises[0].cwiczenie.includes('wolno'), 'treść bez zmian po 403')
assert(unchanged.data.blocks[0].exercises[0].done === false, 'checkbox nie zapisany przy 403')

const toggled = await req(`/api/client/${token}/exercises/${exerciseId}`, {
  method: 'PATCH',
  body: JSON.stringify({ done: true }),
})
assert(toggled.status === 200 && toggled.data.done === true, 'klient odhacza')
const trainerView = await req(`/api/trainer/workouts/${plan.data.id}`)
assert(trainerView.data.blocks[0].exercises[0].done === true, 'trener widzi wspólny checkbox')

const cleared = await req(`/api/trainer/exercises/${exerciseId}`, {
  method: 'PATCH',
  body: JSON.stringify({ done: false }),
})
assert(cleared.data.done === false, 'trener cofa checkbox')
const clientAgain = await req(`/api/client/${token}/workouts/${plan.data.id}`)
assert(clientAgain.data.blocks[0].exercises[0].done === false, 'klient widzi cofnięcie')

for (const [method, path] of [
  ['POST', `/api/client/${token}/workouts`],
  ['POST', `/api/client/${token}/workouts/${plan.data.id}/blocks`],
  ['POST', `/api/client/${token}/workouts/${plan.data.id}/exercises`],
  ['PUT', `/api/client/${token}/workouts/${plan.data.id}`],
  ['DELETE', `/api/client/${token}/workouts/${plan.data.id}`],
  ['DELETE', `/api/client/${token}/blocks/${saved.data.blocks[0].id}`],
  ['DELETE', `/api/client/${token}/exercises/${exerciseId}`],
  ['POST', `/api/client/${token}/exercises/${exerciseId}/image`],
]) {
  const denied = await req(path, { method, body: method === 'DELETE' ? undefined : '{}' })
  assert(denied.status === 403, `${method} ${path} ma dać 403, jest ${denied.status}`)
}

const beataEmail = `e2e-b-${Date.now()}@example.com`
const other = await req('/api/trainer/clients', {
  method: 'POST',
  body: JSON.stringify({ name: 'E2E Beata', email: beataEmail }),
})
const otherToken = other.data.inviteUrl.split('/c/')[1]
const foreign = await req(`/api/client/${otherToken}/workouts/${plan.data.id}`)
assert(foreign.status === 404, 'cudzy trening jest niedostępny')
const foreignToggle = await req(`/api/client/${otherToken}/exercises/${exerciseId}`, {
  method: 'PATCH',
  body: JSON.stringify({ done: true }),
})
assert(foreignToggle.status === 404, 'cudze ćwiczenie jest niedostępne')

const today = warsawToday()
const profileBody = {
  name: 'Ania',
  birthDate: '1990-05-15',
  weightKg: 75.5,
  heightCm: 180,
  level: 'Średniozaawansowany',
  passType: '4',
  trainingStart: today,
  passUsed: [true, false, false, false],
  goal: 'Siła',
  injuries: 'brak',
}
const profile = await req(`/api/trainer/clients/${clientId}/profile`, {
  method: 'PATCH',
  body: JSON.stringify(profileBody),
})
assert(profile.status === 200, `zapis profilu ${profile.status} ${JSON.stringify(profile.data)}`)
assert(profile.data.age === ageOn('1990-05-15', today), 'wiek liczony, nie zapisany na sztywno')
assert(profile.data.pass.kind === 'active' && profile.data.pass.remaining === 30, 'karnet 4: 30 dni w dniu startu')
assert(profile.data.pass.validUntil === formatPl(addDays(today, 30)), 'termin ważności +30 dni')
assert(profile.data.passUsed.filter(Boolean).length === 1 && profile.data.passUsed.length === 4, '1 z 4 wejść')
assert(profile.data.weightKg === 75.5, 'waga')

const clientProfile = await req(`/api/client/${token}/profile`)
assert(clientProfile.status === 200 && clientProfile.data.goal === 'Siła', 'klient widzi profil trenera')
const clientEdit = await req(`/api/client/${token}/profile`, {
  method: 'PATCH',
  body: JSON.stringify({ ...profileBody, goal: 'Wytrzymałość', injuries: 'kolano' }),
})
assert(clientEdit.status === 200 && clientEdit.data.goal === 'Wytrzymałość', 'klient zapisuje swój profil')
const stealPass = await req(`/api/client/${token}/profile`, {
  method: 'PATCH',
  body: JSON.stringify({ ...profileBody, passType: '8', trainingStart: '2020-01-01', passUsed: [true, true, true, true, true, true, true, true], goal: 'HACK' }),
})
assert(stealPass.status === 403, `klient nie zmienia karnetu: ${stealPass.status}`)
const passUntouched = await req(`/api/client/${token}/profile`)
assert(passUntouched.data.passType === '4', 'rodzaj karnetu bez zmian')
assert(passUntouched.data.trainingStart === today, 'data startu bez zmian')
assert(passUntouched.data.passUsed.filter(Boolean).length === 1, 'wejścia bez zmian')
assert(passUntouched.data.goal === 'Wytrzymałość', 'odrzucona zmiana karnetu nie nadpisuje celu')
const homePass = await req(`/api/client/${token}`)
assert(homePass.data.passSummary.used === 1 && homePass.data.passSummary.limit === 4, 'home: wykorzystane')
assert(homePass.data.passSummary.remainingDays === 30 && homePass.data.passSummary.status === 'active', 'home: ten sam status')
assert(homePass.data.passSummary.validUntil === formatPl(addDays(today, 30)), 'home: ważny do')
const trainerSees = await req(`/api/trainer/clients/${clientId}/profile`)
assert(trainerSees.data.goal === 'Wytrzymałość' && trainerSees.data.injuries === 'kolano', 'trener widzi zapis klienta')

const badWeight = await req(`/api/client/${token}/profile`, {
  method: 'PATCH',
  body: JSON.stringify({ ...profileBody, weightKg: -5 }),
})
assert(badWeight.status === 400, 'ujemna waga odrzucona')

const pass8 = await req(`/api/trainer/clients/${clientId}/profile`, {
  method: 'PATCH',
  body: JSON.stringify({ ...profileBody, passType: '8', passUsed: [true, false, false, false] }),
})
assert(pass8.data.pass.remaining === 40 && pass8.data.pass.validUntil === formatPl(addDays(today, 40)), 'karnet 8: 40 dni')
assert(pass8.data.passUsed.length === 8 && pass8.data.passUsed[0] === true, 'wejścia rozszerzone do 8')

const single = await req(`/api/trainer/clients/${clientId}/profile`, {
  method: 'PATCH',
  body: JSON.stringify({ ...profileBody, passType: '1', passUsed: [true] }),
})
assert(single.data.pass.kind === 'hidden' && single.data.passUsed.length === 1, 'jednorazowe bez licznika dni')

const future = await req(`/api/trainer/clients/${clientId}/profile`, {
  method: 'PATCH',
  body: JSON.stringify({ ...profileBody, passType: '4', trainingStart: addDays(today, 3) }),
})
assert(future.data.pass.kind === 'future', 'karnet w przyszłości')

const expired = await req(`/api/trainer/clients/${clientId}/profile`, {
  method: 'PATCH',
  body: JSON.stringify({ ...profileBody, passType: '4', trainingStart: '2020-01-01' }),
})
assert(expired.data.pass.kind === 'expired' && expired.data.pass.remaining === 0, 'karnet wygasły, zero dni')

const noDate = await req(`/api/trainer/clients/${clientId}/profile`, {
  method: 'PATCH',
  body: JSON.stringify({ ...profileBody, passType: '4', trainingStart: '' }),
})
assert(noDate.data.pass.kind === 'hidden', 'brak daty ukrywa licznik')

const form = new FormData()
form.append('file', new Blob([png], { type: 'image/png' }), 'a.png')
const uploaded = await fetch(`${base}/api/trainer/clients/${clientId}/avatar`, {
  method: 'POST',
  headers: { cookie: cookieHeader() },
  body: form,
})
assert(uploaded.status === 200, `avatar ${uploaded.status}`)
const avatar = await fetch(`${base}/api/client/${token}/avatar`)
assert(avatar.status === 200 && (avatar.headers.get('content-type') || '').includes('image'), 'klient czyta swój avatar')
const removedAvatar = await req(`/api/client/${token}/avatar`, { method: 'DELETE' })
assert(removedAvatar.status === 200, 'klient usuwa avatar')
const avatarGone = await fetch(`${base}/api/client/${token}/avatar`)
assert(avatarGone.status === 404, 'avatara już nie ma')

const session = await fetch(`${base}/api/client/session`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ token }),
})
const setCookie = session.headers.get('set-cookie') || ''
assert(session.status === 200 && setCookie.includes('gr_client'), 'sesja klienta')
const me = await fetch(`${base}/api/client/me`, { headers: { cookie: setCookie.split(';')[0] } })
assert(me.status === 200, 'panel pamięta ciasteczko')

const lockedProfile = await fetch(`${base}/api/trainer/clients/${clientId}/profile`, { method: 'PATCH' })
assert(lockedProfile.status === 401, 'profil trenera wymaga sesji')

const dated = await req(`/api/trainer/workouts/${plan.data.id}`, {
  method: 'PATCH',
  body: JSON.stringify({ planDate: '2024-03-05' }),
})
assert(dated.status === 200 && dated.data.date === '2024-03-05', `zapis daty treningu ${dated.status}`)
const listed = await req('/api/trainer/clients')
const listedClient = listed.data.clients.find((item) => item.id === clientId)
const listedPlan = listedClient?.workouts.find((item) => item.id === plan.data.id)
assert(listedPlan?.date === '2024-03-05', 'lista pokazuje nową datę')
const badDate = await req(`/api/trainer/workouts/${plan.data.id}`, {
  method: 'PATCH',
  body: JSON.stringify({ planDate: '32.13.2020' }),
})
assert(badDate.status === 400, 'zła data odrzucona')
const clientDate = await req(`/api/client/${token}/workouts/${plan.data.id}`, {
  method: 'PATCH',
  body: JSON.stringify({ planDate: '2024-01-01' }),
})
assert(clientDate.status === 403, 'klient nie zmienia daty treningu')
const clientRemove = await req(`/api/client/${otherToken}/remove`, { method: 'POST', body: '{}' })
assert(clientRemove.status === 403, 'klient nie usuwa się z panelu')

const library = await req('/api/trainer/library')
assert(library.status === 200, `biblioteka ${library.status}`)
const libraryNames = library.data.exercises.map((item) => item.name)
assert(libraryNames.length === 97, `biblioteka ma 97 pozycji, jest ${libraryNames.length}`)
assert(libraryNames.filter((item) => item === 'Toe Touch Crunch').length === 1, 'Toe Touch Crunch raz')
assert(library.data.exercises.every((item) => item.hasImage), 'każde ćwiczenie startowe ma zdjęcie')
const manual = await req('/api/trainer/library', {
  method: 'POST',
  body: JSON.stringify({ name: 'Deska boczna', image: { data: png.toString('base64'), mime: 'image/png' } }),
})
assert(manual.status === 200 && manual.data.exercise.name === 'Deska boczna', 'dodanie ręczne')
const manualAgain = await req('/api/trainer/library', {
  method: 'POST',
  body: JSON.stringify({ name: '  deska   boczna ', image: null }),
})
assert(manualAgain.status === 200 && manualAgain.data.exercise.id === manual.data.exercise.id, 'drugie kliknięcie nie tworzy duplikatu')
const textReps = await req(`/api/trainer/workouts/${plan.data.id}`, {
  method: 'PUT',
  body: JSON.stringify({
    name: 'Trening A',
    blocks: [
      {
        id: saved.data.blocks[0].id,
        name: 'Rozgrzewka',
        exercises: [
          {
            id: exerciseId,
            cwiczenie: 'Deska boczna',
            serie: '3',
            reps: '30–45 s',
            opis: 'Bok',
            done: false,
            image: { data: png.toString('base64'), mime: 'image/png' },
          },
          { cwiczenie: 'Skok', serie: '2', reps: '10/strona', opis: '', done: true },
          { cwiczenie: 'Finisz', serie: '1', reps: 'AMRAP', opis: '', done: false },
        ],
      },
    ],
  }),
})
assert(textReps.status === 200, `zapis tekstowych reps ${textReps.status} ${JSON.stringify(textReps.data)}`)
const repsValues = textReps.data.blocks[0].exercises.map((item) => item.reps)
assert(JSON.stringify(repsValues) === JSON.stringify(['30–45 s', '10/strona', 'AMRAP']), `reps ${repsValues}`)
assert(textReps.data.blocks[0].exercises[1].done === true, 'zapis reps nie rusza wykonane sąsiada')
assert(textReps.data.blocks[0].exercises[0].serie === '3', 'serie zostają')
const dropped = await req(`/api/trainer/library/${manual.data.exercise.id}`, { method: 'DELETE' })
assert(dropped.status === 200, 'usunięcie z biblioteki')
const libraryAfter = await req('/api/trainer/library')
assert(!libraryAfter.data.exercises.some((item) => item.id === manual.data.exercise.id), 'usunięte znika z wyboru')
assert(libraryAfter.data.exercises.length === 97, 'seed zostaje')
const kept = await req(`/api/trainer/workouts/${plan.data.id}`)
assert(kept.data.blocks[0].exercises[0].cwiczenie === 'Deska boczna', 'plan trzyma nazwę po usunięciu z biblioteki')
assert(kept.data.blocks[0].exercises[0].reps === '30–45 s', 'plan trzyma reps')
assert(kept.data.blocks[0].exercises[0].hasImage === true, 'plan trzyma zdjęcie')
const keptImage = await fetch(`${base}/api/client/${token}/exercises/${exerciseId}/image`)
assert(keptImage.status === 200, 'zdjęcie planu działa po usunięciu z biblioteki')

const beataProfile = await req(`/api/trainer/clients/${other.data.client.id}/profile`, {
  method: 'PATCH',
  body: JSON.stringify({
    name: 'E2E Beata',
    birthDate: '1992-02-02',
    weightKg: 60,
    heightCm: 170,
    level: 'Początkujący',
    passType: '8',
    trainingStart: today,
    passUsed: [true, true, true, true, true, true, true, false],
    goal: 'Mobilność',
    injuries: 'bark',
  }),
})
assert(beataProfile.status === 200, 'profil Beaty')
const beataPlan = await req(`/api/trainer/clients/${other.data.client.id}/workouts`, { method: 'POST', body: '{}' })
assert(beataPlan.status === 200, 'trening Beaty')
const beataSession = await req('/api/client/session', { method: 'POST', body: JSON.stringify({ token: otherToken }) })
assert(beataSession.status === 200, 'sesja Beaty')
const archived = await req(`/api/trainer/clients/${other.data.client.id}/archive`, { method: 'POST', body: '{}' })
assert(archived.status === 200, 'trener ukrywa klienta')
const afterArchive = await req('/api/trainer/clients')
assert(!afterArchive.data.clients.some((item) => item.id === other.data.client.id), 'ukryty klient znika z listy')
const stillThere = await req(`/api/client/${otherToken}`)
assert(stillThere.status === 403 || stillThere.status === 404, `stary link: ${stillThere.status}`)
const oldProfile = await req(`/api/client/${otherToken}/profile`)
assert(oldProfile.status === 403 || oldProfile.status === 404, 'API profilu odcięte')
const oldWorkout = await req(`/api/client/${otherToken}/workouts/${beataPlan.data.id}`)
assert(oldWorkout.status === 403 || oldWorkout.status === 404, 'API treningu odcięte')
const oldSession = await req('/api/client/session', { method: 'POST', body: JSON.stringify({ token: otherToken }) })
assert(oldSession.status === 403 || oldSession.status === 404, 'sesja odrzucona')
const oldMe = await req('/api/client/me')
assert(oldMe.status === 403 || oldMe.status === 404, `aktywna sesja nie działa: ${oldMe.status}`)
const trainerGone = await req(`/api/trainer/clients/${other.data.client.id}`)
assert(trainerGone.status === 404, 'ukryty klient nie otwiera się w panelu')
const restored = await req('/api/trainer/clients', {
  method: 'POST',
  body: JSON.stringify({ name: 'Beata', email: beataEmail }),
})
assert(restored.status === 200, `ponowne zaproszenie ${restored.status} ${JSON.stringify(restored.data)}`)
assert(restored.data.client.id === other.data.client.id, 'ten sam rekord klienta')
const freshToken = restored.data.inviteUrl.split('/c/')[1]
assert(freshToken && freshToken !== otherToken, 'nowy token')
const back = await req(`/api/client/${freshToken}`)
assert(back.status === 200 && back.data.workouts.length === 1, 'nowy link widzi historię treningów')
const backProfile = await req(`/api/client/${freshToken}/profile`)
assert(backProfile.data.goal === 'Mobilność' && backProfile.data.passType === '8', 'profil wraca z danymi')
assert(backProfile.data.passSummary.used === 7 && backProfile.data.passSummary.limit === 8, '7/8 po powrocie')
assert(backProfile.data.passSummary.status === 'active', '7/8 jest aktywne')
const dead = await req(`/api/client/${otherToken}/profile`)
assert(dead.status === 403 || dead.status === 404, 'stary token dalej martwy')
const listedBeata = (await req('/api/trainer/clients')).data.clients.find((item) => item.id === other.data.client.id)
assert(listedBeata?.passSummary.used === 7 && listedBeata.passSummary.status === 'active', 'lista trenera ma ten sam karnet')
assert(trainerUsedClass(listedBeata.passSummary), 'kolor 7/8 na liście')

await req('/api/trainer/logout', { method: 'POST', body: '{}' })
jar.delete('gr_trainer')
const relog = await req('/api/trainer/login', {
  method: 'POST',
  body: JSON.stringify({ email: 'Czulosc.Joga@gmail.com', password: 'MasterSplinter' }),
})
assert(relog.status === 200, 'ponowne logowanie')
const afterLogin = await req(`/api/trainer/workouts/${plan.data.id}`)
assert(afterLogin.data.blocks[0].exercises[0].reps === '30–45 s', 'reps po ponownym zalogowaniu')
assert(afterLogin.data.blocks[0].exercises[2].reps === 'AMRAP', 'AMRAP po ponownym zalogowaniu')
const libAgain = await req('/api/trainer/library')
assert(libAgain.data.exercises.length === 97 && libAgain.data.exercises.every((item) => item.hasImage), 'biblioteka po ponownym zalogowaniu')

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
