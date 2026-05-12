import { redirect } from 'next/navigation'
import { getV2Identity } from '@/lib/v2-auth'
import { CoachTodayView } from './TodayView'

/**
 * v2 Coach Today — the daily triage view.
 *
 * Server component shell: confirms coach auth, captures the
 * greeting context (name, today's date), hands off to the client
 * TodayView which fetches and composes the dynamic data.
 *
 * Layout sections (top-to-bottom on mobile, side-by-side on wide):
 *   1. Header — greeting + date
 *   2. Attention items — students who need outreach with specific
 *      reasons. The "anything I need to handle today" anchor.
 *   3. Today's sessions — placeholder until we wire actual scheduling
 *   4. Recent activity — compressed feed of notable events
 *   5. Quick actions — Sync, View caseload, Diagnostics
 */
export default async function V2CoachTodayPage() {
  // Use real auth identity so the greeting reflects the actual user,
  // not a demo-mode placeholder. Data on the page still flows through
  // /api/coach/students which has its own demo short-circuit.
  const identity = await getV2Identity()
  if (!identity) redirect('/login')

  const firstName = identity.name.split(/\s+/)[0] || identity.name

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <CoachTodayHeader firstName={firstName} />
      <CoachTodayView />
    </div>
  )
}

function CoachTodayHeader({ firstName }: { firstName: string }) {
  const today = new Date()
  const dateStr = today.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
  const greeting = pickGreeting(today.getHours())
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-bold text-gray-900">
        {greeting}, {firstName}
      </h1>
      <p className="text-sm text-gray-500 mt-1">{dateStr}</p>
    </div>
  )
}

function pickGreeting(hour: number): string {
  if (hour < 5) return 'Up late'
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  if (hour < 21) return 'Good evening'
  return 'Working late'
}
