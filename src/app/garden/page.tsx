import { getGardenData, getCurrentStudent } from '@/lib/queries'
import { redirect } from 'next/navigation'
import { GardenClient } from './GardenClient'

export default async function GardenPage() {
  const student = await getCurrentStudent()
  if (!student) redirect('/login')

  const data = await getGardenData(student.id)

  return (
    <main className="max-w-5xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-green-900 mb-1">
        {data.student.firstName}&apos;s Growth Portfolio
      </h1>
      <GardenClient data={data} />
    </main>
  )
}
