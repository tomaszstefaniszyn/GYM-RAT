import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'GYM RAT SPLINTER',
  applicationName: 'GYM RAT SPLINTER',
  description: 'Panel trenera GYM RAT SPLINTER',
  manifest: '/manifest-trener.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'GYM RAT SPLINTER',
    statusBarStyle: 'default',
  },
}

export default function TrainerLayout({ children }: { children: React.ReactNode }) {
  return children
}
