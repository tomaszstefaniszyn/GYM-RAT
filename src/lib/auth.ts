import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'
import { isAllowedTrainerEmail, sessionSecret } from './config'
import { trainerPasswordOk } from './password'

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

export const TRAINER_LOGIN_ERROR = 'Nieprawidłowy e-mail lub hasło.'

/**
 * Trainer login: allowlisted email AND server-side password.
 * Both checks run for a well-formed address so the error stays generic.
 */
export async function requestTrainerLogin(
  email: string,
  password: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const normalized = email.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    return { ok: false, error: 'Podaj prawidłowy adres e-mail.' }
  }
  const passwordOk = trainerPasswordOk(password)
  const emailOk = isAllowedTrainerEmail(normalized)
  if (!passwordOk || !emailOk) return { ok: false, error: TRAINER_LOGIN_ERROR }
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
