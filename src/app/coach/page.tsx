import { getCoachDashboard } from '@/lib/queries'
import { AttentionBanner } from '@/components/coach/AttentionBanner'
import { CaseloadList } from '@/components/coach/CaseloadList'

interface Props {
  searchParams: { coach?: string }
}

export default async function CoachPage({ searchParams }: Props) {
  const coachId = searchParams.coach || 'coach_elizabeth'
  const data = await getCoachDashboard(coachId)

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
      <CaseloadList students={data.students} coachId={coachId} />
    </main>
  )
}
