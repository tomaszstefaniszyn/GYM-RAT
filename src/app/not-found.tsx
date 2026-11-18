import Link from 'next/link'
import { Logo } from '@/components/mark'

export default function NotFound() {
  return (
    <main className="shell message-page">
      <div className="brand">
        <Logo size={56} />
        <div className="wordmark">
          <b>GYM</b> RAT
        </div>
      </div>
      <p>Nie znaleziono strony.</p>
      <Link href="/trener" className="retry">
        Panel trenera
      </Link>
    </main>
  )
}
