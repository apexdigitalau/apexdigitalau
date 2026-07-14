'use client'

import { useEffect } from 'react'

/**
 * Registers the service worker. Chrome/Android will not offer "Install app"
 * without one, so this is what makes the CRM installable rather than just
 * bookmarkable.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (!('serviceWorker' in navigator)) return

    const onLoad = () => {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .catch(err => console.error('Service worker registration failed:', err))
    }

    if (document.readyState === 'complete') onLoad()
    else window.addEventListener('load', onLoad)
    return () => window.removeEventListener('load', onLoad)
  }, [])

  return null
}
