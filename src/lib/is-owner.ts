/**
 * The two people allowed to see company expenses.
 *
 * This same list is written into the RLS policies in
 * supabase-migrations/add-expenses.sql — change one, change the other. The app
 * gate exists to produce a clean 403 and hide the nav link; RLS is what
 * actually stops a non-owner reading the rows.
 */
export const OWNER_EMAILS = [
  'tomas@apexdigitalau.com',
  'anthony@apexdigitalau.com',
] as const

/** Case-insensitive: Supabase stores emails lowercased, but sessions and
 *  hand-typed config are not guaranteed to be. */
export function isOwner(email: string | null | undefined): boolean {
  if (!email) return false
  const normalised = email.trim().toLowerCase()
  return OWNER_EMAILS.some((owner) => owner === normalised)
}
