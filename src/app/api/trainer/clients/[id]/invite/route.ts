import { appBaseUrl } from '@/lib/config'
import { getClientRow } from '@/lib/data'
import { sendInviteEmail } from '@/lib/email'
import { trainerGuard } from '@/lib/guard'
import { json, rejectCrossSite } from '@/lib/http'
import { inviteText } from '@/lib/invite'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await trainerGuard()
  if (session instanceof Response) return session
  const blocked = rejectCrossSite(req)
  if (blocked) return blocked
  const { id } = await ctx.params
  const client = await getClientRow(id)
  if (!client) return json({ error: 'Nie znaleziono klienta.' }, 404)
  const inviteUrl = `${appBaseUrl(req)}/c/${client.token}`
  const mail = await sendInviteEmail(client.email, inviteUrl)
  return json({
    inviteUrl,
    emailed: mail.emailed,
    emailError: mail.error ?? null,
    emailText: inviteText(inviteUrl),
  })
}
