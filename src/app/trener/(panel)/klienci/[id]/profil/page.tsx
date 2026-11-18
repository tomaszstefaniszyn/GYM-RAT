import { notFound } from 'next/navigation'
import { ProfileForm } from '@/components/profile-form'
import { getProfile } from '@/lib/data'

export const dynamic = 'force-dynamic'

export default async function TrainerProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const profile = await getProfile(id)
  if (!profile) notFound()
  return (
    <main className="shell has-dock">
      <ProfileForm
        initial={profile}
        backHref={`/trener/klienci/${id}`}
        saveUrl={`/api/trainer/clients/${id}/profile`}
        avatarUrl={`/api/trainer/clients/${id}/avatar`}
      />
    </main>
  )
}
