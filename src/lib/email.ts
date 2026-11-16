import 'server-only'
import { inviteText } from './invite'

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
  const user = process.env.GMAIL_USER?.trim()
  const pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, '')
  if (!user && !pass) return null
  return { user: user ?? '', pass: pass ?? '' }
}

async function sendViaGmail(to: string, text: string, url: string, user: string, pass: string) {
  const nodemailer = await import('nodemailer')
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user, pass },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  })
  await transporter.sendMail({
    from: `${SENDER_NAME} <${user}>`,
    to,
    subject: SUBJECT,
    text,
    html: inviteHtml(text, url),
  })
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
    console.error('[gym-rat] Resend error', result.error)
    return { emailed: false as const, error: 'Nie udało się wysłać e-maila. Link możesz skopiować poniżej.' }
  }
  return { emailed: true as const }
}

/**
 * Gmail SMTP when GMAIL_USER and GMAIL_APP_PASSWORD are set, otherwise Resend,
 * otherwise the dev fallback (log the invite, return the link to the trainer).
 * Nodemailer uses Node's net/tls, so callers must run on the Node.js runtime.
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
      console.error('[gym-rat] Gmail SMTP', error)
      return { emailed: false, error: 'Nie udało się wysłać e-maila przez Gmail. Sprawdź GMAIL_USER i hasło aplikacji. Link możesz skopiować poniżej.' }
    }
  }

  const resendKey = process.env.RESEND_API_KEY?.trim()
  if (resendKey) {
    try {
      const result = await sendViaResend(to, text, url, resendKey)
      if (result.emailed) console.info(`[gym-rat] Wysłano zaproszenie przez Resend do ${to}`)
      return result
    } catch (error) {
      console.error('[gym-rat] Resend exception', error)
      return { emailed: false, error: 'Nie udało się wysłać e-maila. Link możesz skopiować poniżej.' }
    }
  }

  console.info(`\n[gym-rat] Tryb lokalny (brak GMAIL_* i RESEND_API_KEY). Treść zaproszenia:\n${text}\n`)
  return { emailed: false }
}
