import { notFound } from 'next/navigation'
import { ProfileForm } from '@/components/profile-form'
import { getProfileByToken } from '@/lib/data'

export const dynamic = 'force-dynamic'

export default async function ClientProfilePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const profile = await getProfileByToken(token)
  if (!profile) notFound()
  return (
    <main className="shell has-dock">
      <ProfileForm
        initial={profile}
        backHref={`/c/${token}`}
        saveUrl={`/api/client/${token}/profile`}
        avatarUrl={`/api/client/${token}/avatar`}
        lockPass
      />
    </main>
  )
}
