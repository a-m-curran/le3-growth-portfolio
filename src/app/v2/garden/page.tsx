import { redirect } from 'next/navigation'
import { getCurrentStudent, getGardenData } from '@/lib/queries'
import { GardenClient } from '@/app/garden/GardenClient'

/**
 * v2 Garden — student growth visualization.
 *
 * Reuses the existing v1 GardenClient (which handles the three
 * visualization modes — Garden / Mountain / Cityscape — and the
 * skill-detail slide-out via SkillPanel). The only thing new here
 * is the wider canvas: the v1 page was capped at max-w-5xl, this
 * one expands to take advantage of the desktop real estate inside
 * the v2 shell.
 */
export default async function V2GardenPage() {
  const student = await getCurrentStudent()
  if (!student) redirect('/login')

  const data = await getGardenData(student.id)

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Garden
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          How your skills are growing across the program.
        </p>
      </div>
      <GardenClient data={data} />
    </div>
  )
}
