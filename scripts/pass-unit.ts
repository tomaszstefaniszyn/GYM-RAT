import {
  addDays,
  clientDaysTone,
  clientUsedTone,
  summarizePass,
  toIso,
  trainerDaysTone,
  trainerUsedTone,
  warsawToday,
} from '../src/lib/pass'
import { LIBRARY_EXERCISES, exerciseFileKey, normalizeExerciseName } from '../src/lib/library-names'
import {
  gmailFailureLog,
  gmailFailureMessage,
  isGmailAuthFailure,
  isGmailConnectFailure,
  normalizeAppPassword,
  normalizeMailbox,
} from '../src/lib/mail-failure'

function fail(message: string): never {
  console.error('FAIL:', message)
  process.exit(1)
}

function assert(condition: unknown, message: string) {
  if (!condition) fail(message)
}

const today = { y: 2026, m: 11, d: 20 }

function summary(passType: '4' | '8' | '1' | null, start: { y: number; m: number; d: number } | null, used: number) {
  const flags = Array.from({ length: 12 }, (_, index) => index < used)
  return summarizePass(passType, start, flags, today)
}

const threeOfFour = summary('4', addDays(today, -20), 3)
assert(threeOfFour.used === 3 && threeOfFour.limit === 4, '3/4 used/limit')
assert(threeOfFour.remainingDays === 10, `3/4 start-20d → 10 dni, jest ${threeOfFour.remainingDays}`)
assert(threeOfFour.status === 'active', '3/4 z dniami jest aktywny')
assert(clientUsedTone(3, 4) === 'tone-warn', 'klient 3/4 pomarańczowy')
assert(trainerUsedTone(3, 4) === 'tone-warn', 'trener 3/4 pomarańczowy')

const fourOfFour = summary('4', addDays(today, -10), 4)
assert(fourOfFour.used === 4 && fourOfFour.limit === 4, '4/4')
assert(fourOfFour.remainingDays === 20, '4/4 nadal ma dni')
assert(fourOfFour.status === 'inactive', '4/4 jest nieaktywny mimo dni')
assert(trainerUsedTone(4, 4) === 'tone-muted', 'trener 4/4 szary')
assert(clientUsedTone(4, 4) === 'tone-ink', 'klient 4/4 domyślny, nie pomarańczowy')

const sevenOfEight = summary('8', today, 7)
assert(sevenOfEight.used === 7 && sevenOfEight.limit === 8, '7/8')
assert(sevenOfEight.remainingDays === 40, `karnet 8 ma 40 dni, jest ${sevenOfEight.remainingDays}`)
assert(sevenOfEight.status === 'active', '7/8 aktywny')
assert(clientUsedTone(7, 8) === 'tone-warn' && trainerUsedTone(7, 8) === 'tone-warn', '7/8 pomarańczowy')

const eightOfEight = summary('8', today, 8)
assert(eightOfEight.status === 'inactive', '8/8 nieaktywny')
assert(trainerUsedTone(8, 8) === 'tone-muted', 'trener 8/8 szary')
assert(clientUsedTone(8, 8) === 'tone-ink', 'klient 8/8 domyślny')

const fullButFresh = summary('4', today, 4)
assert(fullButFresh.remainingDays === 30 && fullButFresh.status === 'inactive', 'wykorzystane wejścia mają pierwszeństwo')

const expired = summary('4', { y: 2020, m: 1, d: 1 }, 0)
assert(expired.remainingDays === 0, 'dni nie są ujemne')
assert(expired.status === 'inactive', '0 dni = nieaktywny')
assert(expired.validUntil === '31.01.2020', `ważny do ${expired.validUntil}`)

const oneDay = summary('4', addDays(today, -29), 1)
assert(oneDay.remainingDays === 1 && oneDay.status === 'active', '1 dzień jeszcze aktywny')

const zeroDaysUsed = summary('4', addDays(today, -30), 2)
assert(zeroDaysUsed.remainingDays === 0 && zeroDaysUsed.status === 'inactive', 'dzień ważności ma 0 dni')

for (const days of [0, 1, 7, 8, 9, 10]) {
  const client = clientDaysTone(days)
  const trainer = trainerDaysTone(days)
  const clientExpected = days >= 1 && days <= 7 ? 'tone-warn' : 'tone-ink'
  const trainerExpected = days <= 0 ? 'tone-muted' : days <= 9 ? 'tone-warn' : 'tone-info'
  assert(client === clientExpected, `klient ${days} dni → ${client}, oczekiwano ${clientExpected}`)
  assert(trainer === trainerExpected, `trener ${days} dni → ${trainer}, oczekiwano ${trainerExpected}`)
}

assert(trainerUsedTone(2, 4) === 'tone-info', 'trener 2/4 niebieski')
assert(clientUsedTone(2, 4) === 'tone-ink', 'klient 2/4 domyślny')
assert(trainerDaysTone(10) === 'tone-info' && trainerDaysTone(9) === 'tone-warn', 'próg 10 dni u trenera')
assert(clientDaysTone(8) === 'tone-ink' && clientDaysTone(7) === 'tone-warn', 'próg 8 dni u klienta')

const single = summary('1', null, 0)
assert(single.remainingDays === null && single.validUntil === null && single.status === 'active', 'jednorazowe bez licznika dni')
assert(summary('1', null, 1).status === 'inactive', 'jednorazowe wykorzystane')
assert(summary(null, null, 0).status === 'inactive' && summary(null, null, 0).limit === 0, 'brak karnetu')

const late = warsawToday(new Date('2026-11-20T23:30:00.000Z'))
assert(toIso(late) === '2026-11-21', `Warszawa po północy: ${toIso(late)}`)
const early = warsawToday(new Date('2026-11-20T22:30:00.000Z'))
assert(toIso(early) === '2026-11-20', `Warszawa przed północą: ${toIso(early)}`)

assert(LIBRARY_EXERCISES.length === 97, '97 ćwiczeń w bibliotece')
assert(LIBRARY_EXERCISES.filter((item) => item.name === 'Toe Touch Crunch').length === 1, 'Toe Touch Crunch raz')
assert(LIBRARY_EXERCISES.filter((item) => item.name === 'Burpee').length === 1, 'Burpee raz')
assert(LIBRARY_EXERCISES.filter((item) => item.name === 'Hip Thrust').length === 1, 'Hip Thrust raz')
assert(LIBRARY_EXERCISES.filter((item) => item.name === 'Hip Thrust Barbell').length === 1, 'Hip Thrust Barbell osobno')
assert(LIBRARY_EXERCISES.filter((item) => item.name === 'Romanian Deadlift – Bench Cue').length === 1, 'RDL Bench Cue raz')
assert(new Set(LIBRARY_EXERCISES.map((item) => item.file)).size === 97, 'każde zdjęcie inne')
const folded = new Map<string, string>()
for (const item of LIBRARY_EXERCISES) {
  const key = normalizeExerciseName(item.name).normalize('NFD').replace(/\p{M}/gu, '')
  const previous = folded.get(key)
  assert(!previous, `duplikat nazwy: ${item.name} / ${previous}`)
  folded.set(key, item.name)
}
assert(exerciseFileKey('Toe Touch Crunch.PNG') === normalizeExerciseName('  toe   touch   crunch '), 'dopasowanie nazwy pliku')
assert(
  exerciseFileKey('Face Pull - power band with external rotation.webp') ===
    normalizeExerciseName('Face Pull - power band with external rotation'),
  'face pull',
)

const secret = 'abcd efgh ijkl mnop'
assert(normalizeAppPassword(`  "${secret}"\n`) === 'abcdefghijklmnop', 'hasło aplikacji bez spacji i cudzysłowu')
assert(normalizeAppPassword("  'abcd efgh'\n") === 'abcdefgh', 'hasło w apostrofach')
assert(normalizeMailbox('  "tomaszstefaniszyn9@gmail.com"  ') === 'tomaszstefaniszyn9@gmail.com', 'adres bez cudzysłowu')
const auth = { code: 'EAUTH', responseCode: 535, command: 'AUTH', response: '535-5.7.8 Username and Password not accepted' }
assert(isGmailAuthFailure(auth) && !isGmailConnectFailure(auth), '535 to odrzucenie hasła')
assert(gmailFailureMessage(auth) === 'Gmail odrzucił hasło aplikacji (535).', 'komunikat 535')
const timeout = { code: 'ETIMEDOUT', message: 'Connection timeout' }
assert(isGmailConnectFailure(timeout) && !isGmailAuthFailure(timeout), 'timeout to brak połączenia')
assert(gmailFailureMessage(timeout) === 'Brak połączenia z serwerem Gmail.', 'komunikat timeout')
assert(gmailFailureMessage({ responseCode: 534, code: 'EAUTH', response: '534-5.7.9 Application-specific password required' }) === 'Gmail odrzucił logowanie (534).', 'komunikat 534')
const leaked = gmailFailureLog({ code: 'EAUTH', responseCode: 535, response: `535 rejected ${'abcdefghijklmnop'}` }, 'abcdefghijklmnop')
assert(!leaked.includes('abcdefghijklmnop') && leaked.includes('[redacted]'), 'log nie zawiera hasła')
assert(leaked.includes('"responseCode":535') && leaked.includes('EAUTH'), 'log ma kod SMTP')

console.log('UNIT OK')
