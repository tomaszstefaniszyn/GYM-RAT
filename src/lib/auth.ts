import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'
import { isAllowedTrainerEmail, sessionSecret } from './config'

export const TRAINER_COOKIE = 'gr_trainer'
export const CLIENT_COOKIE = 'gr_client'
const TRAINER_MAX_AGE = 60 * 60 * 24 * 180
const CLIENT_MAX_AGE = 60 * 60 * 24 * 400

type TrainerPayload = { email: string; exp: number }

function cookieBase() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  }
}

export function signTrainerToken(email: string) {
  const payload: TrainerPayload = {
    email,
    exp: Math.floor(Date.now() / 1000) + TRAINER_MAX_AGE,
  }
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = createHmac('sha256', sessionSecret()).update(body).digest('base64url')
  return `${body}.${sig}`
}

export function readTrainerToken(token: string | undefined | null): TrainerPayload | null {
  if (!token) return null
  const [body, sig] = token.split('.')
  if (!body || !sig) return null
  const expected = createHmac('sha256', sessionSecret()).update(body).digest('base64url')
  const actualBuf = Buffer.from(sig)
  const expectedBuf = Buffer.from(expected)
  if (actualBuf.length !== expectedBuf.length || !timingSafeEqual(actualBuf, expectedBuf)) return null
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as TrainerPayload
    if (!payload?.email || typeof payload.exp !== 'number') return null
    if (payload.exp < Math.floor(Date.now() / 1000)) return null
    if (!isAllowedTrainerEmail(payload.email)) return null
    return payload
  } catch {
    return null
  }
}

export async function createTrainerSession(email: string) {
  const jar = await cookies()
  jar.set(TRAINER_COOKIE, signTrainerToken(email), { ...cookieBase(), maxAge: TRAINER_MAX_AGE })
}

export async function clearTrainerSession() {
  const jar = await cookies()
  jar.set(TRAINER_COOKIE, '', { ...cookieBase(), maxAge: 0 })
}

export async function getTrainerSession() {
  const jar = await cookies()
  return readTrainerToken(jar.get(TRAINER_COOKIE)?.value)
}

/**
 * Passwordless trainer login, as requested: allowlisted email, no password.
 * Split on purpose so a one-time emailed code can be inserted later:
 *   1. requestTrainerLogin — checks the allowlist (this function)
 *   2. issueLoginCode — create a short-lived code and email it (not built)
 *   3. verifyLoginCode — only then call createTrainerSession
 * Today step 1 creates the session immediately.
 */
export async function requestTrainerLogin(email: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const normalized = email.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    return { ok: false, error: 'Podaj prawidłowy adres e-mail.' }
  }
  if (!isAllowedTrainerEmail(normalized)) {
    return { ok: false, error: 'Ten adres nie ma dostępu do panelu trenera.' }
  }
  await createTrainerSession(normalized)
  return { ok: true }
}

export async function setClientCookie(token: string) {
  const jar = await cookies()
  jar.set(CLIENT_COOKIE, token, { ...cookieBase(), maxAge: CLIENT_MAX_AGE })
}

export async function getClientTokenFromCookie() {
  const jar = await cookies()
  return jar.get(CLIENT_COOKIE)?.value ?? null
}
