import { getGardenData, getCurrentCoach } from '@/lib/queries'
import { redirect } from 'next/navigation'
import { GardenClient } from '@/app/garden/GardenClient'
import Link from 'next/link'

interface Props {
  params: { studentId: string }
}

export default async function CoachStudentPage({ params }: Props) {
  const coach = await getCurrentCoach()
  if (!coach) redirect('/login')

  const data = await getGardenData(params.studentId)

  return (
    <main className="max-w-5xl mx-auto px-4 py-6">
      <div className="flex items-center gap-4 mb-4">
        <Link
          href="/coach"
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          &larr; Back to Caseload
        </Link>
      </div>
      <h1 className="text-2xl font-bold text-green-900 mb-1">
        {data.student.firstName}&apos;s Growth Portfolio
      </h1>
      <p className="text-xs text-gray-500 mb-4">Coach view</p>
      <GardenClient data={data} />
    </main>
  )
}
