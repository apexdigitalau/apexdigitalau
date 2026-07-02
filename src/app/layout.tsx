import type { Metadata } from 'next'
import './globals.css'
import { ToastProvider } from '@/components/common/Toast'
import { BRAND } from '@/lib/brand'

export const metadata: Metadata = {
  title: BRAND.pageTitle,
  description: BRAND.tagline,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  )
}
