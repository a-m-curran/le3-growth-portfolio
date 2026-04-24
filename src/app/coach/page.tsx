import {
  getCoachDashboard,
  getCurrentCoach,
  getRecentSyncRuns,
  getLastSuccessfulSyncRun,
} from '@/lib/queries'
import { redirect } from 'next/navigation'
import { AttentionBanner } from '@/components/coach/AttentionBanner'
import { CaseloadList } from '@/components/coach/CaseloadList'
import { SyncStatusPanel } from '@/components/coach/SyncStatusPanel'
import { SyncInspectorPanel } from '@/components/coach/SyncInspectorPanel'
import { LTIInspectorPanel } from '@/components/coach/LTIInspectorPanel'

export default async function CoachPage() {
  const coach = await getCurrentCoach()
  if (!coach) redirect('/login')

  const [data, recentSyncRuns, lastSuccessfulSync] = await Promise.all([
    getCoachDashboard(coach.id),
    getRecentSyncRuns(5),
    getLastSuccessfulSyncRun(),
  ])

  const totalConvos = data.students.reduce(
    (sum, s) => sum + s.conversationsThisQuarter,
    0
  )

  return (
    <main className="max-w-3xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-green-900 mb-1">
        {data.coach.name}&apos;s Caseload
      </h1>
      <p className="text-sm text-green-700 mb-6">
        {data.students.length} students &middot; {totalConvos} conversations this quarter
      </p>

      <AttentionBanner items={data.attentionItems} />
      <SyncStatusPanel recentRuns={recentSyncRuns} lastSuccessful={lastSuccessfulSync} />
      <SyncInspectorPanel />
      <LTIInspectorPanel />
      <CaseloadList students={data.students} coachId={coach.id} />
    </main>
  )
}
