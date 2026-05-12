import { redirect } from 'next/navigation'
import { getCurrentCoach, getRecentSyncRuns, getLastSuccessfulSyncRun } from '@/lib/queries'
import { ToolsView } from './ToolsView'

/**
 * v2 Tools — admin observability surface.
 *
 * Relocates the Sync / LTI / Live Activity / Sync Status panels off
 * the main /coach Today view. Gated to ADMIN_EMAILS (the layout's
 * showAdmin flag also hides this from the sidebar nav for
 * non-admins) so the daily-driver path stays clean for other coaches.
 *
 * Components reused from v1 wholesale — they're already self-contained
 * client components with their own data fetching.
 */
export default async function V2ToolsPage() {
  const coach = await getCurrentCoach()
  if (!coach) redirect('/login')

  if (!isAdminEmail(coach.email)) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="rounded-2xl bg-white border border-gray-200 p-8 text-center">
          <h1 className="text-lg font-semibold text-gray-900 mb-2">
            Not available
          </h1>
          <p className="text-sm text-gray-600">
            Tools are limited to designated administrators. If you think you
            should have access, contact NLU IT.
          </p>
        </div>
      </div>
    )
  }

  // Pre-fetch the sync data the SyncStatusPanel needs server-side
  // (it expects props rather than fetching itself).
  const [recentSyncRuns, lastSuccessful] = await Promise.all([
    getRecentSyncRuns(5),
    getLastSuccessfulSyncRun(),
  ])

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Tools</h1>
        <p className="text-sm text-gray-500 mt-1">
          Admin views for the integrations powering the portfolio.
        </p>
      </div>
      <ToolsView recentSyncRuns={recentSyncRuns} lastSuccessful={lastSuccessful} />
    </div>
  )
}

function isAdminEmail(email: string): boolean {
  const raw = process.env.ADMIN_EMAILS || ''
  if (!raw.trim()) return false
  const list = raw.split(',').map(e => e.trim().toLowerCase()).filter(Boolean)
  return list.includes(email.toLowerCase())
}
