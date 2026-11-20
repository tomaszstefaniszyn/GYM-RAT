'use client'

import { useEffect } from 'react'

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[gym-rat] boundary', error.digest ?? '', error)
  }, [error])
  return (
    <main className="shell message-page">
      <p>Coś poszło nie tak.</p>
      <button type="button" className="retry" onClick={reset}>
        Spróbuj ponownie
      </button>
    </main>
  )
}
