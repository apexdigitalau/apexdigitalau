import type { Metadata } from 'next'
import './globals.css'
import { ToastProvider } from '@/components/common/Toast'

export const metadata: Metadata = {
  title: 'Apex Digital AU — CRM',
  description: 'The central operating system for Apex Digital AU',
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
