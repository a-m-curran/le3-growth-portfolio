import { redirect } from 'next/navigation'
import { getRecentSyncRuns, getLastSuccessfulSyncRun } from '@/lib/queries'
import { getV2Identity, isAdminEmail } from '@/lib/v2-auth'
import { createAdminClient } from '@/lib/supabase-admin'
import { getPasslinkRoster } from '@/lib/auth/passlink-admin'
import { ToolsView } from './ToolsView'

/**
 * v2 Tools — admin observability surface.
 *
 * Relocates the Sync / LTI / Live Activity / Sync Status panels off
 * the main /coach Today view. Gated to ADMIN_EMAILS via real auth
 * identity (getV2Identity) — NOT getCurrentCoach, which in demo mode
 * returns the demo coach (Elizabeth) and would fail the admin check
 * even for the actual builder.
 */
export default async function V2ToolsPage() {
  const identity = await getV2Identity()
  if (!identity) redirect('/login')

  const allowed = identity.role === 'coach' && isAdminEmail(identity.email)
  if (!allowed) {
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
  const admin = createAdminClient()
  const [recentSyncRuns, lastSuccessful, passlinkRoster] = await Promise.all([
    getRecentSyncRuns(5),
    getLastSuccessfulSyncRun(),
    getPasslinkRoster(admin),
  ])

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Tools</h1>
        <p className="text-sm text-gray-500 mt-1">
          Admin views for the integrations powering the portfolio.
        </p>
      </div>
      <ToolsView
        recentSyncRuns={recentSyncRuns}
        lastSuccessful={lastSuccessful}
        passlinkRoster={passlinkRoster}
      />
    </div>
  )
}
