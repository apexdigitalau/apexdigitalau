'use client'

import { useEffect, useState } from 'react'
import { getSupabase } from '@/lib/supabase'
import { isOwner } from '@/lib/is-owner'

/**
 * Whether the signed-in user is one of the owners, for hiding owner-only UI.
 *
 * `null` until the session resolves so callers can render nothing rather than
 * flashing the panel and pulling it away. This is presentation only — every
 * owner-only page and route re-checks server side, and RLS backs that up.
 */
export function useIsOwner(): boolean | null {
  const [owner, setOwner] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false
    getSupabase()
      .auth.getUser()
      .then(({ data }) => {
        if (!cancelled) setOwner(isOwner(data.user?.email))
      })
      .catch(() => {
        if (!cancelled) setOwner(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return owner
}
