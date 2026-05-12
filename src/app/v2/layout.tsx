import { redirect } from 'next/navigation'
import { getV2Identity } from '@/lib/v2-auth'

/**
 * v2 root layout — auth gate only, no shell.
 *
 * Shell rendering happens in the (student) / (coach) group layouts.
 * The /v2/me route is also outside groups and renders its own shell
 * via MeView.
 *
 * This split lets URL determine shell (rather than auth role) so a
 * coach previewing the demo can browse the student experience by
 * visiting /v2/today etc., and vice versa. Identity in the shell
 * always reflects the real authenticated user.
 */
export default async function V2Layout({ children }: { children: React.ReactNode }) {
  const identity = await getV2Identity()
  if (!identity) redirect('/login')
  return <>{children}</>
}
