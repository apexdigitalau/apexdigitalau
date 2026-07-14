import type { Metadata, Viewport } from 'next'
import './globals.css'
import { ToastProvider } from '@/components/common/Toast'
import { ThemeProvider } from '@/components/common/ThemeProvider'
import { ServiceWorkerRegistrar } from '@/components/common/ServiceWorkerRegistrar'
import { BRAND } from '@/lib/brand'

export const metadata: Metadata = {
  title: BRAND.pageTitle,
  description: BRAND.tagline,
  applicationName: BRAND.companyName,
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: BRAND.companyName,
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
  },
}

export const viewport: Viewport = {
  themeColor: '#181A20',
  width: 'device-width',
  initialScale: 1,
  // 'black-translucent' draws the app under the status bar, so the layout has
  // to opt into the full screen and pad itself back with env(safe-area-inset-*).
  viewportFit: 'cover',
  // Keeps the layout above the on-screen keyboard instead of letting it
  // overlay focused inputs.
  interactiveWidget: 'resizes-content',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
        <ThemeProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </ThemeProvider>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  )
}
