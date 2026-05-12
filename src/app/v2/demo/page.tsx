import Link from 'next/link'
import { students as staticStudents, coaches as staticCoaches } from '@/data'

/**
 * v2 demo entry — pick a persona to preview the v2 experience as.
 *
 * Mirrors /demo (v1) but routes through /api/v2/demo-as which sets
 * a cookie and redirects to the appropriate Today view. Once the
 * persona is set, the v2 shell renders that persona's identity
 * (sidebar name, role-appropriate nav) throughout the session.
 *
 * Cookie expires after 1 day. To switch back to real auth, hit
 * /api/v2/demo-as?persona=clear or just wait it out.
 *
 * Sits OUTSIDE the (student) and (coach) route groups so it has no
 * AppShell — it's an entry-point page, not part of the app proper.
 * The root /v2/layout's auth gate would normally trigger here, but
 * we skip it: this page is reachable without auth so demo viewers
 * can land here directly.
 */
export default function V2DemoEntryPage() {
  const isDemoEnabled = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

  if (!isDemoEnabled) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-bold text-gray-900 mb-2">Demo not enabled</h1>
          <p className="text-sm text-gray-600">
            Set <code className="font-mono text-xs bg-gray-100 px-1 rounded">NEXT_PUBLIC_DEMO_MODE=true</code>{' '}
            on Vercel to enable demo persona switching.
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
            Pick a person to preview the experience as. Sets a 1-day cookie;
            visit /api/v2/demo-as?persona=clear to switch back.
          </p>
        </div>

        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
            Students
          </h2>
          <div className="grid gap-2">
            {staticStudents.map(s => (
              <Link
                key={s.id}
                href={`/api/v2/demo-as?persona=${s.id}`}
                className="group block px-4 py-3 bg-white border border-gray-200 rounded-xl hover:border-green-400 hover:shadow-sm transition-all"
              >
                <div className="font-medium text-gray-900 group-hover:text-green-800">
                  {s.firstName} {s.lastName}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">{s.cohort}</div>
              </Link>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
            Coaches
          </h2>
          <div className="grid gap-2">
            {staticCoaches.map(c => (
              <Link
                key={c.id}
                href={`/api/v2/demo-as?persona=${c.id}`}
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
