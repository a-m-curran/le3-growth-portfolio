/**
 * v2 authentication identity helper.
 *
 * Resolution order:
 *   1. If a demo persona cookie is set (set by /api/v2/demo-as), look up
 *      the matching row in `student`/`coach` by `demo_slug` and act as
 *      that real DB persona. The cookie is the slug ('stu_aja',
 *      'coach_elizabeth', etc.); demo_slug is unique per row.
 *   2. Otherwise, fall through to real Supabase auth — look up
 *      coach/student by `auth_user_id`.
 *
 * The persona cookie is the only "demo" code path left. Everything
 * downstream reads from the same DB tables real students do, with
 * `is_demo = true` on the persona rows so real-cohort queries can
 * filter them out.
 *
 * Returns null when there's no resolvable identity — caller should
 * redirect to /v2/demo or /login.
 */

import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase-admin'

const PERSONA_COOKIE = 'le3-v2-demo-persona'

export type V2Identity =
  | {
      role: 'coach'
      id: string
      name: string
      email: string
      authUserId: string
      isDemo: boolean
    }
  | {
      role: 'student'
      id: string
      firstName: string
      lastName: string
      name: string
      email: string
      cohort: string | null
      authUserId: string
      isDemo: boolean
    }

export async function getV2Identity(): Promise<V2Identity | null> {
  const cookieStore = cookies()

  // ─── Demo persona override ──────────────────
  // Persona cookie maps to a real DB row via demo_slug. No more
  // static-seed lookup — the persona acts as the actual student or
  // coach row, with the same downstream data the v2 surfaces read.
  const personaSlug = cookieStore.get(PERSONA_COOKIE)?.value
  if (personaSlug) {
    const fromPersona = await resolvePersonaFromDb(personaSlug)
    if (fromPersona) return fromPersona
  }

  // ─── Real Supabase auth ─────────────────────
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const admin = createAdminClient()

  // Coach first — coaches who are also students would still want
  // the coach shell as their primary view.
  const { data: coachRow } = await admin
    .from('coach')
    .select('id, name, email, is_demo')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (coachRow) {
    return {
      role: 'coach',
      id: coachRow.id as string,
      name: coachRow.name as string,
      email: coachRow.email as string,
      authUserId: user.id,
      isDemo: !!(coachRow.is_demo as boolean | null),
    }
  }

  const { data: studentRow } = await admin
    .from('student')
    .select('id, first_name, last_name, email, cohort, is_demo')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (studentRow) {
    return {
      role: 'student',
      id: studentRow.id as string,
      firstName: studentRow.first_name as string,
      lastName: studentRow.last_name as string,
      name: `${studentRow.first_name} ${studentRow.last_name}`.trim(),
      email: studentRow.email as string,
      cohort: (studentRow.cohort as string | null) ?? null,
      authUserId: user.id,
      isDemo: !!(studentRow.is_demo as boolean | null),
    }
  }

  return null
}

/**
 * Check if a coach email is on the ADMIN_EMAILS allowlist.
 * Used to gate /v2/coach/tools and the Tools nav item.
 */
export function isAdminEmail(email: string): boolean {
  const raw = process.env.ADMIN_EMAILS || ''
  if (!raw.trim()) return false
  const list = raw.split(',').map(e => e.trim().toLowerCase()).filter(Boolean)
  return list.includes(email.toLowerCase())
}

/**
 * Resolve a demo persona slug to a V2Identity from the live DB.
 * Looks up by `demo_slug` (which the seed script wrote per persona)
 * and short-circuits with a synthetic auth_user_id of `demo:<slug>`
 * since demo personas don't have real Supabase auth accounts.
 */
async function resolvePersonaFromDb(personaSlug: string): Promise<V2Identity | null> {
  const admin = createAdminClient()

  const { data: studentRow } = await admin
    .from('student')
    .select('id, first_name, last_name, email, cohort')
    .eq('demo_slug', personaSlug)
    .eq('is_demo', true)
    .maybeSingle()

  if (studentRow) {
    return {
      role: 'student',
      id: studentRow.id as string,
      firstName: studentRow.first_name as string,
      lastName: studentRow.last_name as string,
      name: `${studentRow.first_name} ${studentRow.last_name}`.trim(),
      email: studentRow.email as string,
      cohort: (studentRow.cohort as string | null) ?? null,
      authUserId: `demo:${personaSlug}`,
      isDemo: true,
    }
  }

  const { data: coachRow } = await admin
    .from('coach')
    .select('id, name, email')
    .eq('demo_slug', personaSlug)
    .eq('is_demo', true)
    .maybeSingle()

  if (coachRow) {
    return {
      role: 'coach',
      id: coachRow.id as string,
      name: coachRow.name as string,
      email: coachRow.email as string,
      authUserId: `demo:${personaSlug}`,
      isDemo: true,
    }
  }

  return null
}

export { PERSONA_COOKIE }

/**
 * Convenience helper for API routes: get the resolved student id
 * (persona override or real auth) without dragging in the full
 * V2Identity shape. Returns null when there's no usable identity.
 *
 * Use in routes that previously had two branches (demo + real DB):
 *   const studentId = await getV2StudentId()
 *   if (!studentId) return 401
 *   // single DB query path follows
 */
export async function getV2StudentId(): Promise<string | null> {
  const id = await getV2Identity()
  if (!id || id.role !== 'student') return null
  return id.id
}

/** Same as getV2StudentId but for coaches. */
export async function getV2CoachId(): Promise<string | null> {
  const id = await getV2Identity()
  if (!id || id.role !== 'coach') return null
  return id.id
}
