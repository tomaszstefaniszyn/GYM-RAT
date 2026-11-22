/** Trim, drop wrapping quotes, then remove every space, newline and quote. App passwords are 16 letters. */
export function normalizeAppPassword(value: string | undefined) {
  return unwrapEnv(value).replace(/[\s\u00a0"']+/g, '')
}

/** Trim and drop one layer of wrapping quotes. Leaves the address itself intact. */
export function normalizeMailbox(value: string | undefined) {
  return unwrapEnv(value)
}

function unwrapEnv(value: string | undefined) {
  if (!value) return ''
  let text = value.replace(/^\uFEFF/, '').trim()
  if (
    text.length >= 2 &&
    ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'")))
  ) {
    text = text.slice(1, -1).trim()
  }
  return text
}

const CONNECT_CODES = new Set([
  'ETIMEDOUT',
  'ECONNECTION',
  'ESOCKET',
  'ECONNREFUSED',
  'ENOTFOUND',
  'EAI_AGAIN',
  'ECONNRESET',
  'EHOSTUNREACH',
  'EDNS',
])

export type SmtpBits = {
  code: string
  responseCode: number | null
  command: string
  response: string
}

/** Codes and SMTP text only. Never the auth secret. */
export function readSmtpError(error: unknown): SmtpBits {
  if (!error || typeof error !== 'object') {
    return { code: '', responseCode: null, command: '', response: '' }
  }
  const err = error as {
    code?: unknown
    responseCode?: unknown
    command?: unknown
    response?: unknown
    message?: unknown
  }
  const responseCode = typeof err.responseCode === 'number' && Number.isFinite(err.responseCode) ? err.responseCode : null
  const response = typeof err.response === 'string' ? err.response : typeof err.message === 'string' ? err.message : ''
  return {
    code: typeof err.code === 'string' ? err.code : '',
    responseCode,
    command: typeof err.command === 'string' ? err.command : '',
    response: response.replace(/\s+/g, ' ').trim().slice(0, 300),
  }
}

export function isGmailAuthFailure(error: unknown) {
  const info = readSmtpError(error)
  if (info.responseCode === 534 || info.responseCode === 535) return true
  if (info.code === 'EAUTH') return true
  return /535|534|badcredentials|username and password not accepted|application-specific password/i.test(info.response)
}

export function isGmailConnectFailure(error: unknown) {
  if (isGmailAuthFailure(error)) return false
  const info = readSmtpError(error)
  if (CONNECT_CODES.has(info.code)) return true
  return /timeout|timed out|econn|getaddrinfo|greeting never received|socket closed/i.test(`${info.code} ${info.response}`)
}

/** Short Polish reason for the trainer. No SMTP body and no secret. */
export function gmailFailureMessage(error: unknown) {
  const info = readSmtpError(error)
  if (info.responseCode === 534) return 'Gmail odrzucił logowanie (534).'
  if (isGmailAuthFailure(error)) return 'Gmail odrzucił hasło aplikacji (535).'
  if (isGmailConnectFailure(error)) return 'Brak połączenia z serwerem Gmail.'
  return 'Nie udało się wysłać e-maila przez Gmail.'
}

/** One log line: code, response code, command, SMTP text. The secret is replaced if it leaked in. */
export function gmailFailureLog(error: unknown, secret: string) {
  const info = readSmtpError(error)
  let line = JSON.stringify({
    code: info.code || null,
    responseCode: info.responseCode,
    command: info.command || null,
    response: info.response || null,
  })
  if (secret) line = line.split(secret).join('[redacted]')
  return line
}
