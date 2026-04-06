import { getSessionPrep } from '@/lib/queries'
import { SessionPrep } from '@/components/coach/SessionPrep'
import Link from 'next/link'

interface Props {
  params: { studentId: string }
  searchParams: { coach?: string }
}

export default async function SessionPrepPage({ params, searchParams }: Props) {
  const coachId = searchParams.coach || 'coach_elizabeth'
  const data = await getSessionPrep(coachId, params.studentId)

  return (
    <main className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center gap-4 mb-4">
        <Link
          href={`/coach?coach=${coachId}`}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← Back to Caseload
        </Link>
      </div>
      <h1 className="text-xl font-bold text-green-900 mb-1">
        Prep: {data.student.firstName} {data.student.lastName}
      </h1>
      <SessionPrep data={data} />
    </main>
  )
}
