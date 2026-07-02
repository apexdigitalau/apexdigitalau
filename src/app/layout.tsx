import type { Metadata } from 'next'
import './globals.css'
import { ToastProvider } from '@/components/common/Toast'
import { ThemeProvider } from '@/components/common/ThemeProvider'
import { BRAND } from '@/lib/brand'

export const metadata: Metadata = {
  title: BRAND.pageTitle,
  description: BRAND.tagline,
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
      </body>
    </html>
  )
}
