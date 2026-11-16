import 'server-only'

const DEFAULT_TRAINER_EMAILS = ['tomaszstefaniszyn9@gmail.com', 'czulosc.joga@gmail.com']

export function trainerAllowlist() {
  const raw = process.env.TRAINER_EMAILS
  const source = raw === undefined || raw.trim() === '' ? DEFAULT_TRAINER_EMAILS : raw.split(',')
  return source.map((email) => email.trim().toLowerCase()).filter(Boolean)
}

export function isAllowedTrainerEmail(email: string) {
  return trainerAllowlist().includes(email.trim().toLowerCase())
}

export function sessionSecret() {
  const secret = process.env.SESSION_SECRET?.trim()
  if (secret && secret.length >= 16) return secret
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SESSION_SECRET (min. 16 znaków) jest wymagany na produkcji.')
  }
  return 'dev-only-session-secret-change-me'
}

export function appBaseUrl(req?: Request) {
  const configured = process.env.APP_URL?.trim()
  if (configured) return configured.replace(/\/$/, '')
  if (req) {
    const hostHeader = req.headers.get('x-forwarded-host') ?? req.headers.get('host')
    if (hostHeader) {
      const host = hostHeader.split(',')[0]!.trim()
      const protoHeader = req.headers.get('x-forwarded-proto')
      const proto = protoHeader
        ? protoHeader.split(',')[0]!.trim()
        : host.startsWith('localhost') || host.startsWith('127.')
          ? 'http'
          : 'https'
      return `${proto}://${host}`
    }
  }
  return 'http://localhost:3000'
}

export function supabaseStorageConfig() {
  const url = process.env.SUPABASE_URL?.trim().replace(/\/$/, '')
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !key) return null
  const bucket = process.env.SUPABASE_BUCKET?.trim() || 'avatars'
  return { url, key, bucket }
}
