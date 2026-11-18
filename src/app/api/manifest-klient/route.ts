import { getClientTokenFromCookie } from '@/lib/auth'
import { getClientByToken } from '@/lib/data'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const icons = [
  { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
  { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
  { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
]

export async function GET() {
  const token = await getClientTokenFromCookie()
  let start = '/panel'
  let id = '/panel'
  if (token) {
    const client = await getClientByToken(token)
    if (client) {
      start = `/c/${token}`
      id = `/c/${token}`
    }
  }

  return new Response(
    JSON.stringify({
      id,
      name: 'GYM RAT',
      short_name: 'GYM RAT',
      description: 'Twój plan treningowy GYM RAT',
      lang: 'pl',
      start_url: start,
      scope: '/',
      display: 'standalone',
      background_color: '#f6f4ef',
      theme_color: '#f6f4ef',
      icons,
    }),
    {
      headers: {
        'Content-Type': 'application/manifest+json',
        'Cache-Control': 'no-store',
      },
    },
  )
}
