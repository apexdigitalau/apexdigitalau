import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { failWith, type ApiErrorBody } from '@/lib/api-error'
import { isOwner } from '@/lib/is-owner'

/**
 * Supabase client bound to the caller's session cookie, i.e. running as *them*
 * with RLS applied. Deliberately not the service-role client used elsewhere in
 * this app: for expenses, RLS is the layer we actually want enforcing access.
 */
export async function getSupabaseFromSession(): Promise<SupabaseClient> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY')
  }

  const cookieStore = await cookies()

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        } catch {
          // Called from a Server Component, where the cookie store is read-only.
          // The middleware already refreshes the session on every request, so
          // dropping the rotated cookie here is harmless.
        }
      },
    },
  })
}

type OwnerGate =
  | { ok: true; supabase: SupabaseClient; user: User }
  | { ok: false; response: NextResponse<ApiErrorBody> }

/**
 * Session + owner check for the expenses API routes.
 *
 * `getUser()` rather than `getSession()`: getSession trusts whatever is in the
 * cookie, getUser revalidates the token with Supabase, so a forged cookie
 * cannot talk its way past this.
 *
 * Blocked attempts are logged at info level — a signed-in non-owner hitting
 * these endpoints is either a UI bug or someone poking at URLs, and both are
 * worth being able to grep for in the Vercel logs.
 */
export async function requireOwner(route: string): Promise<OwnerGate> {
  const supabase = await getSupabaseFromSession()
  const { data, error } = await supabase.auth.getUser()
  const user = data?.user ?? null

  if (error || !user) {
    console.info(`[expenses] blocked unauthenticated access to ${route}`)
    return {
      ok: false,
      response: failWith({ error: 'Not signed in', stage: 'auth', status: 401 }),
    }
  }

  if (!isOwner(user.email)) {
    console.info(`[expenses] blocked non-owner access to ${route} by ${user.email ?? user.id}`)
    return {
      ok: false,
      response: failWith({ error: 'Not authorised', stage: 'owner-gate', status: 403 }),
    }
  }

  return { ok: true, supabase, user }
}
