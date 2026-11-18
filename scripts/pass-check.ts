import {
  ageYears,
  addDays,
  formatYmd,
  parsePlDate,
  passStatus,
  toIso,
} from '../src/lib/pass'

function assert(condition: unknown, message: string) {
  if (!condition) {
    console.error('FAIL', message)
    process.exit(1)
  }
}

const today = { y: 2026, m: 11, d: 18 }
const start = { y: 2026, m: 11, d: 18 }

const four = passStatus('4', start, today)
assert(four.kind === 'active' && four.remaining === 30, '4 wejścia w dniu startu: 30 dni')
assert(four.kind === 'active' && four.validUntil === '18.12.2026', 'ważny do 18.12.2026')

const expiry = passStatus('4', start, { y: 2026, m: 12, d: 18 })
assert(expiry.kind === 'expired' && expiry.remaining === 0, 'dzień upływu: 0 dni')

const after = passStatus('4', start, { y: 2026, m: 12, d: 19 })
assert(after.kind === 'expired' && after.remaining === 0, 'po terminie bez wartości ujemnej')

const future = passStatus('4', start, { y: 2026, m: 11, d: 17 })
assert(future.kind === 'future' && future.startsOn === '18.11.2026', 'start w przyszłości')

const eight = passStatus('8', start, today)
assert(eight.kind === 'active' && eight.remaining === 40 && eight.validUntil === '28.12.2026', '8 wejść: 40 dni')

assert(passStatus('1', start, today).kind === 'hidden', 'jednorazowe bez licznika')
assert(passStatus('4', null, today).kind === 'hidden', 'brak daty ukrywa licznik')
assert(toIso(addDays(start, 30)) === '2026-12-18', 'dodawanie dni')
assert(formatYmd(start) === '18.11.2026', 'format daty')

assert(ageYears({ y: 1990, m: 5, d: 15 }, today) === 36, 'wiek 15.05.1990')
assert(ageYears({ y: 1990, m: 12, d: 1 }, today) === 35, 'urodziny jeszcze przed nami')
assert(ageYears({ y: 1990, m: 11, d: 18 }, today) === 36, 'urodziny dzisiaj')
assert(ageYears({ y: 1990, m: 11, d: 19 }, today) === 35, 'urodziny jutro')
assert(parsePlDate('31.02.2020') === null, '31 lutego')
assert(parsePlDate('29.02.2024') !== null, 'rok przestępny')
assert(parsePlDate('29.02.2023') === null, 'nieprzestępny luty')
assert(parsePlDate('15.05.1990')?.d === 15, 'parsowanie PL')

console.log('PASS OK')
