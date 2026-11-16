import Link from 'next/link'
import { Logo } from '@/components/mark'

export default function NotFound() {
  return (
    <main className="shell message-page">
      <div className="home-brand">
        <Logo size={56} />
        <div className="home-title">GYM RAT</div>
      </div>
      <p>Nie znaleziono strony.</p>
      <Link href="/trener" className="pill" style={{ marginTop: 12 }}>
        Panel trenera
      </Link>
    </main>
  )
}
