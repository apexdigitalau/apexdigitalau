'use client'

import { useEffect } from 'react'

/**
 * Service worker recovery.
 *
 * We used to register `/sw.js` here to make the CRM installable. That worker
 * cached JS bundles and left iOS Safari / installed PWAs stuck on a stale app
 * shell, which broke AI email generation. `/sw.js` is now a kill-switch that
 * unregisters itself and clears caches on activation.
 *
 * This component no longer registers a worker. Instead it nudges the browser to
 * fetch the updated (kill-switch) `/sw.js` for any device that still has the old
 * one installed, and clears caches directly as a belt-and-braces recovery. Once
 * the kill-switch has run there is no registration left, so this becomes a no-op.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return

    ;(async () => {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations()

        // Force the browser to re-fetch /sw.js so the kill-switch installs and
        // self-destructs on devices carrying the old caching worker.
        await Promise.all(registrations.map(reg => reg.update().catch(() => {})))

        // Directly clear any caches the old worker left behind, in case the
        // kill-switch activation hasn't run yet on this load.
        if ('caches' in window) {
          const keys = await caches.keys()
          await Promise.all(keys.map(key => caches.delete(key)))
        }
      } catch (err) {
        console.error('Service worker recovery failed:', err)
      }
    })()
  }, [])

  return null
}
