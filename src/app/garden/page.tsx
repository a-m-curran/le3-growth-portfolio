import { getGardenData } from '@/lib/queries'
import { GardenClient } from './GardenClient'

interface Props {
  searchParams: { student?: string }
}

export default async function GardenPage({ searchParams }: Props) {
  const studentId = searchParams.student || 'stu_aja'
  const data = await getGardenData(studentId)

  return (
    <main className="max-w-5xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-green-900 mb-1">
        {data.student.firstName}&apos;s Growth Garden
      </h1>
      <GardenClient data={data} />
    </main>
  )
}
