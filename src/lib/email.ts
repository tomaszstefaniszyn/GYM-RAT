import 'server-only'
import { inviteText } from './invite'
import {
  gmailFailureLog,
  gmailFailureMessage,
  isGmailConnectFailure,
  normalizeAppPassword,
  normalizeMailbox,
} from './mail-failure'

const SUBJECT = 'Twoje zaproszenie do Gym Rat'
const SENDER_NAME = 'Gym Rat'

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function inviteHtml(text: string, url: string) {
  const sentence = escapeHtml(text.split('\n\n')[0] ?? text)
  const href = escapeHtml(url)
  return `<!DOCTYPE html><html lang="pl"><body style="font-family:sans-serif;font-size:16px;color:#111"><p>${sentence}</p><p><a href="${href}">${href}</a></p></body></html>`
}

function gmailConfig() {
  const user = normalizeMailbox(process.env.GMAIL_USER)
  const pass = normalizeAppPassword(process.env.GMAIL_APP_PASSWORD)
  if (!user && !pass) return null
  return { user, pass }
}

async function deliverGmail(to: string, text: string, url: string, user: string, pass: string, port: 465 | 587) {
  const nodemailer = await import('nodemailer')
  const secure = port === 465
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port,
    secure,
    requireTLS: !secure,
    auth: { user, pass },
    connectionTimeout: 8_000,
    greetingTimeout: 8_000,
    socketTimeout: 12_000,
  })
  try {
    await transporter.sendMail({
      from: `${SENDER_NAME} <${user}>`,
      to,
      subject: SUBJECT,
      text,
      html: inviteHtml(text, url),
    })
  } finally {
    try {
      transporter.close()
    } catch {
      /* the send result is what matters */
    }
  }
}

async function sendViaGmail(to: string, text: string, url: string, user: string, pass: string) {
  try {
    await deliverGmail(to, text, url, user, pass, 465)
    return
  } catch (error) {
    console.error('[gym-rat] Gmail SMTP 465', gmailFailureLog(error, pass))
    if (!isGmailConnectFailure(error)) throw error
  }
  try {
    await deliverGmail(to, text, url, user, pass, 587)
  } catch (error) {
    console.error('[gym-rat] Gmail SMTP 587', gmailFailureLog(error, pass))
    throw error
  }
}

async function sendViaResend(to: string, text: string, url: string, key: string) {
  const from = process.env.EMAIL_FROM?.trim()
  if (!from) {
    console.error('[gym-rat] RESEND_API_KEY jest ustawiony, ale brak EMAIL_FROM.')
    return { emailed: false as const, error: 'Ustaw EMAIL_FROM, aby wysyłać maile przez Resend.' }
  }
  const { Resend } = await import('resend')
  const resend = new Resend(key)
  const result = await resend.emails.send({
    from,
    to,
    subject: SUBJECT,
    text,
    html: inviteHtml(text, url),
  })
  if (result.error) {
    console.error('[gym-rat] Resend error', result.error.name ?? 'resend', result.error.message ?? '')
    return { emailed: false as const, error: 'Nie udało się wysłać e-maila. Link możesz skopiować poniżej.' }
  }
  return { emailed: true as const }
}

/**
 * Gmail SMTP when GMAIL_USER and GMAIL_APP_PASSWORD are set, otherwise Resend,
 * otherwise the dev fallback (log the invite, return the link to the trainer).
 * Env is read on each call. Nodemailer is created inside the send, then awaited.
 */
export async function sendInviteEmail(to: string, url: string): Promise<{ emailed: boolean; error?: string }> {
  const text = inviteText(url)
  const gmail = gmailConfig()

  if (gmail) {
    if (!gmail.user || !gmail.pass) {
      return { emailed: false, error: 'Ustaw obie zmienne: GMAIL_USER i GMAIL_APP_PASSWORD.' }
    }
    try {
      await sendViaGmail(to, text, url, gmail.user, gmail.pass)
      console.info(`[gym-rat] Wysłano zaproszenie przez Gmail do ${to}`)
      return { emailed: true }
    } catch (error) {
      return { emailed: false, error: gmailFailureMessage(error) }
    }
  }

  const resendKey = process.env.RESEND_API_KEY?.trim()
  if (resendKey) {
    try {
      const result = await sendViaResend(to, text, url, resendKey)
      if (result.emailed) console.info(`[gym-rat] Wysłano zaproszenie przez Resend do ${to}`)
      return result
    } catch (error) {
      const code = error && typeof error === 'object' && 'name' in error ? String((error as { name?: unknown }).name) : 'error'
      console.error('[gym-rat] Resend exception', code)
      return { emailed: false, error: 'Nie udało się wysłać e-maila. Link możesz skopiować poniżej.' }
    }
  }

  console.info(`\n[gym-rat] Tryb lokalny (brak GMAIL_* i RESEND_API_KEY). Treść zaproszenia:\n${text}\n`)
  return { emailed: false }
}
