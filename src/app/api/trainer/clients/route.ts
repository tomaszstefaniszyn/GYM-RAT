import { appBaseUrl } from '@/lib/config'
import { createClient, listClients, getClientDetail } from '@/lib/data'
import { sendInviteEmail } from '@/lib/email'
import { trainerGuard } from '@/lib/guard'
import { json, readBody, rejectCrossSite } from '@/lib/http'
import { inviteText } from '@/lib/invite'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function GET() {
  const session = await trainerGuard()
  if (session instanceof Response) return session
  return json({ clients: await listClients() })
}

export async function POST(req: Request) {
  const session = await trainerGuard()
  if (session instanceof Response) return session
  const blocked = rejectCrossSite(req)
  if (blocked) return blocked

  const body = await readBody<{ name?: string; email?: string }>(req)
  const name = body?.name?.trim() ?? ''
  const email = body?.email?.trim() ?? ''
  if (!name) return json({ error: 'Podaj imię.' }, 400)
  if (name.length > 80) return json({ error: 'Imię jest za długie.' }, 400)
  if (!emailOk.test(email)) return json({ error: 'Podaj prawidłowy e-mail.' }, 400)

  const created = await createClient({ name, email })
  if ('error' in created) return json({ error: created.error }, 409)

  const inviteUrl = `${appBaseUrl(req)}/c/${created.client.token}`
  const mail = await sendInviteEmail(created.client.email, inviteUrl)
  const client = await getClientDetail(created.client.id)
  return json({
    client,
    inviteUrl,
    emailed: mail.emailed,
    emailError: mail.error ?? null,
    emailText: inviteText(inviteUrl),
  })
}
