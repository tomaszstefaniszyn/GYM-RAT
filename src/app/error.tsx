'use client'

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="shell message-page">
      <p>Coś poszło nie tak.</p>
      <button type="button" className="retry" onClick={reset}>
        Spróbuj ponownie
      </button>
    </main>
  )
}
