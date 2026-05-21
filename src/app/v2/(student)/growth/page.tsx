import { redirect } from 'next/navigation'
import { getGardenData } from '@/lib/queries'
import { getV2StudentId } from '@/lib/v2-auth'
import { GrowthView } from './GrowthView'

/**
 * v2 Growth — student skill visualization, second-gen.
 *
 * Each skill gets a bespoke procedural artwork (Critical Thinking
 * = crystalline lattice, Resilience = castle, etc.) rather than the
 * v1 five-discrete-stages plant template. See
 * `src/components/v2/growth/SkillVisual.tsx` for the dispatcher and
 * `./archetypes/` for each skill's renderer.
 *
 * Identity is resolved through `getV2StudentId` (persona cookie OR
 * real Supabase auth). Demo personas are real DB rows now —
 * `getGardenData(studentId)` queries the live DB regardless of which
 * identity path resolved the id.
 */
export default async function V2GrowthPage() {
  const studentId = await getV2StudentId()
  if (!studentId) redirect('/login')

  const data = await getGardenData(studentId)

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
