import { notFound } from 'next/navigation'
import { getSupabaseFromSession } from '@/lib/supabase-server'
import { isOwner } from '@/lib/is-owner'
import { ExpensesClient } from '@/components/expenses/ExpensesClient'

// The gate reads the session cookie, so this route can never be prerendered.
export const dynamic = 'force-dynamic'

/**
 * Server-side owner gate. The sidebar hides this link for non-owners, but that
 * is cosmetic — typing /expenses has to fail too, and it fails here before any
 * markup is produced. The API routes gate independently, and RLS gates below
 * both of them.
 *
 * notFound() rather than a 403 screen: a 404 does not confirm the page exists.
 * (Next's forbidden() would give a real 403 but needs the experimental
 * authInterrupts flag turned on app-wide, which is not worth it for this.)
 */
export default async function ExpensesPage() {
  const supabase = await getSupabaseFromSession()
  const { data } = await supabase.auth.getUser()

  if (!isOwner(data?.user?.email)) {
    console.info(`[expenses] blocked non-owner page load by ${data?.user?.email ?? 'anonymous'}`)
    notFound()
  }

  return <ExpensesClient />
}
