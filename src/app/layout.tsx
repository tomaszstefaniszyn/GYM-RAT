import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { ServiceWorker } from '@/components/service-worker'
import './globals.css'

const inter = Inter({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
})

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#f6f4ef',
}

export const metadata: Metadata = {
  applicationName: 'GYM RAT',
  description: 'Plany treningowe GYM RAT',
  robots: { index: false, follow: false },
  formatDetection: { telephone: false, email: false, address: false },
  icons: {
    icon: [
      { url: '/logo.png', type: 'image/png' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className={inter.className}>
        <ServiceWorker />
        {children}
      </body>
    </html>
  )
}
