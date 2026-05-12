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
 *
 * Demo-mode handling: when NEXT_PUBLIC_DEMO_MODE=true, a non-student
 * authenticated viewer (e.g. the builder logged in as a coach
 * previewing student experience) falls back to a fixed demo student
 * (stu_aja) so the page renders meaningful content. In real mode,
 * non-students get redirected to /login as expected.
 */
export default async function V2GardenPage() {
  const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

  const student = await getCurrentStudent()
  const targetStudentId = student?.id || (isDemoMode ? 'stu_aja' : null)

  if (!targetStudentId) {
    redirect('/login')
  }

  const data = await getGardenData(targetStudentId)

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Garden</h1>
        <p className="text-sm text-gray-500 mt-1">
          How your skills are growing across the program.
        </p>
      </div>
      <GardenClient data={data} />
    </div>
  )
}
