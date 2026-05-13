import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * v2 demo entry — pick a persona to preview the v2 experience as.
 *
 * Lists every demo persona in the DB (rows with is_demo=true).
 * Clicking one hits /api/v2/demo-as which sets a session cookie and
 * redirects to the appropriate Today view for that role.
 *
 * Demo personas are real DB rows now — picking one acts as that real
 * student/coach for the session, querying the same tables real
 * students will use post-launch. The is_demo flag is what keeps demo
 * personas out of real-cohort views.
 *
 * Sits OUTSIDE the (student) and (coach) route groups so this page
 * doesn't trigger their auth-redirect logic — anyone can land here
 * directly without authentication.
 */
export default async function V2DemoEntryPage() {
  const admin = createAdminClient()

  const [{ data: studentRows }, { data: coachRows }] = await Promise.all([
    admin
      .from('student')
      .select('id, demo_slug, first_name, last_name, cohort')
      .eq('is_demo', true)
      .order('first_name'),
    admin
      .from('coach')
      .select('id, demo_slug, name')
      .eq('is_demo', true)
      .order('name'),
  ])

  interface StudentRow {
    id: string
    demo_slug: string
    first_name: string
    last_name: string
    cohort: string | null
  }
  interface CoachRow {
    id: string
    demo_slug: string
    name: string
  }
  const students = (studentRows ?? []) as unknown as StudentRow[]
  const coaches = (coachRows ?? []) as unknown as CoachRow[]

  if (students.length === 0 && coaches.length === 0) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-bold text-gray-900 mb-2">No demo personas yet</h1>
          <p className="text-sm text-gray-600">
            Run <code className="font-mono text-xs bg-gray-100 px-1 rounded">npx tsx scripts/seed-demo-data.ts</code>{' '}
            to seed demo data into the DB.
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
      <div className="max-w-lg w-full space-y-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Explore the v2 Demo</h1>
          <p className="text-sm text-gray-600 mt-2">
            Pick a person to preview the experience as. Sets a 1-day cookie; visit{' '}
            <code className="font-mono text-xs bg-gray-100 px-1 rounded">
              /api/v2/demo-as?persona=clear
            </code>{' '}
            to switch back.
          </p>
        </div>

        {students.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
              Students
            </h2>
            <div className="grid gap-2">
              {students.map(s => (
                <Link
                  key={s.id}
                  href={`/api/v2/demo-as?persona=${s.demo_slug}`}
                  className="group block px-4 py-3 bg-white border border-gray-200 rounded-xl hover:border-green-400 hover:shadow-sm transition-all"
                >
                  <div className="font-medium text-gray-900 group-hover:text-green-800">
                    {s.first_name} {s.last_name}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">{s.cohort}</div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {coaches.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
              Coaches
            </h2>
            <div className="grid gap-2">
              {coaches.map(c => (
                <Link
                  key={c.id}
                  href={`/api/v2/demo-as?persona=${c.demo_slug}`}
                  className="group block px-4 py-3 bg-white border border-gray-200 rounded-xl hover:border-green-400 hover:shadow-sm transition-all"
                >
                  <div className="font-medium text-gray-900 group-hover:text-green-800">
                    {c.name}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">Coach</div>
                </Link>
              ))}
            </div>
          </section>
        )}

        <p className="text-xs text-gray-400 text-center pt-2">
          Clear demo persona:{' '}
          <Link href="/api/v2/demo-as?persona=clear" className="text-green-700 hover:underline">
            switch back to real auth
          </Link>
        </p>
      </div>
    </main>
  )
}
