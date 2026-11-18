import 'server-only'
import { createHash, timingSafeEqual } from 'node:crypto'

// sha256("MasterSplinter"). Plaintext stays out of the source and the client bundle.
// Override on the server with TRAINER_PASSWORD. Empty means this fallback.
const FALLBACK_HASH = Buffer.from('a2a1dba5391d5199a1eebca7318e43b9e72b9ee46fe0ff37ec29c1ec3ddf9ac2', 'hex')

function sha256(value: string) {
  return createHash('sha256').update(value).digest()
}

export function trainerPasswordOk(password: string) {
  const configured = process.env.TRAINER_PASSWORD
  const expected = configured && configured.length > 0 ? sha256(configured) : FALLBACK_HASH
  const actual = sha256(typeof password === 'string' ? password : '')
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}
