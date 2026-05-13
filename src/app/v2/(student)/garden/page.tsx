import { redirect } from 'next/navigation'

/**
 * Legacy /v2/garden — redirects to /v2/growth, the renamed surface.
 *
 * Kept as a thin redirect so any saved tabs / shared links / nav
 * memory in components that haven't been updated yet still land in
 * the right place. Safe to delete once we're confident no entry
 * points reference /v2/garden anymore (search the repo for the path).
 */
export default function V2GardenRedirect() {
  redirect('/v2/growth')
}
