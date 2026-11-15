import 'server-only'
import { inviteText } from './invite'

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

export async function sendInviteEmail(to: string, url: string): Promise<{ emailed: boolean; error?: string }> {
  const text = inviteText(url)
  const key = process.env.RESEND_API_KEY?.trim()
  if (!key) {
    console.info(`\n[gym-rat] Tryb lokalny (brak RESEND_API_KEY). Treść zaproszenia:\n${text}\n`)
    return { emailed: false }
  }

  const from = process.env.EMAIL_FROM?.trim()
  if (!from) {
    console.error('[gym-rat] RESEND_API_KEY jest ustawiony, ale brak EMAIL_FROM.')
    return { emailed: false, error: 'Ustaw EMAIL_FROM, aby wysyłać maile przez Resend.' }
  }

  try {
    const { Resend } = await import('resend')
    const resend = new Resend(key)
    const html = `<!DOCTYPE html><html lang="pl"><body style="font-family:sans-serif;font-size:16px;color:#111"><p>${escapeHtml(text.split('\n\n')[0] ?? text)}</p><p><a href="${escapeHtml(url)}">${escapeHtml(url)}</a></p></body></html>`
    const result = await resend.emails.send({
      from,
      to,
      subject: 'Twoje zaproszenie do Gym Rat',
      text,
      html,
    })
    if (result.error) {
      console.error('[gym-rat] Resend error', result.error)
      return { emailed: false, error: 'Nie udało się wysłać e-maila. Link możesz skopiować poniżej.' }
    }
    console.info(`[gym-rat] Wysłano zaproszenie do ${to}`)
    return { emailed: true }
  } catch (error) {
    console.error('[gym-rat] Resend exception', error)
    return { emailed: false, error: 'Nie udało się wysłać e-maila. Link możesz skopiować poniżej.' }
  }
}
