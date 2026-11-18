import { trainerPasswordOk } from '../src/lib/password'

function assert(condition: unknown, message: string) {
  if (!condition) {
    console.error('FAIL', message)
    process.exit(1)
  }
}

delete process.env.TRAINER_PASSWORD
assert(trainerPasswordOk('MasterSplinter'), 'wbudowane hasło')
assert(!trainerPasswordOk('mastersplinter'), 'wielkość liter')
assert(!trainerPasswordOk('MasterSplinter '), 'bez spacji')
assert(!trainerPasswordOk(''), 'puste')

process.env.TRAINER_PASSWORD = 'InneHaslo123'
assert(trainerPasswordOk('InneHaslo123'), 'nadpisanie ze zmiennej')
assert(!trainerPasswordOk('MasterSplinter'), 'wbudowane nie działa, gdy jest zmienna')
delete process.env.TRAINER_PASSWORD
assert(trainerPasswordOk('MasterSplinter'), 'powrót do wbudowanego')

console.log('PASSWORD OK')
