import { redirect } from 'next/navigation'
import { getCurrentStudent, getGardenData } from '@/lib/queries'
import { GrowthView } from './GrowthView'

/**
 * v2 Growth — student skill visualization, second-gen.
 *
 * Replaces the old /v2/garden route. Each skill gets a bespoke
 * procedural artwork (Critical Thinking = crystalline lattice,
 * Resilience = bent-but-growing trunk, etc.) rather than the previous
 * five-discrete-stages plant template. See
 * `src/components/v2/growth/SkillVisual.tsx` for the dispatcher and
 * `./archetypes/` for each skill's renderer.
 *
 * Data source unchanged: `getGardenData(studentId)` from queries.ts,
 * which is already demo-aware (returns Aja's static skills in demo
 * mode and DB-sourced plants in real mode).
 *
 * Demo-mode handling: non-student authenticated viewers fall through
 * to `stu_aja` so coaches previewing the student experience see
 * meaningful content. Real-mode non-students get redirected to login.
 */
export default async function V2GrowthPage() {
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
        <h1 className="text-2xl font-bold text-gray-900">Growth</h1>
        <p className="text-sm text-gray-500 mt-1">
          How your skills are growing across the program. Each visual is its own — click any to see the conversations behind it.
        </p>
      </div>
      <GrowthView data={data} />
    </div>
  )
}
