import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'GYM RAT',
  applicationName: 'GYM RAT',
  description: 'Twój plan treningowy GYM RAT',
  manifest: '/api/manifest-klient',
  appleWebApp: {
    capable: true,
    title: 'GYM RAT',
    statusBarStyle: 'default',
  },
}

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return children
}
