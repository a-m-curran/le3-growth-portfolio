/**
 * v2 authentication identity helper.
 *
 * IMPORTANT: this is DIFFERENT from getCurrentCoach/getCurrentStudent
 * in lib/queries.ts. Those helpers short-circuit to static demo data
 * in demo mode regardless of real auth — useful for data fetching in
 * demo flows, but wrong for IDENTITY (the name in the sidebar).
 *
 * This helper always uses real Supabase auth. The sidebar / header /
 * Me page should always show the actually-authenticated user, even
 * when the rest of the app is rendering demo data.
 *
 * Returns null when there's no authenticated user — caller should
 * redirect to /login.
 */

import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase-admin'
import { students as staticStudents, coaches as staticCoaches } from '@/data'

const PERSONA_COOKIE = 'le3-v2-demo-persona'

export type V2Identity =
  | {
      role: 'coach'
      id: string
      name: string
      email: string
      authUserId: string
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
    }

export async function getV2Identity(): Promise<V2Identity | null> {
  const cookieStore = cookies()

  // ─── Demo persona override ──────────────────
  // When demo mode is on AND a persona cookie is set (via /v2/demo),
  // the persona's identity drives the shell. Lets stakeholders click
  // "Try as Aja" and have the whole experience feel like they're Aja —
  // sidebar shows her name, not the actual authenticated user. No real
  // auth required, which is appropriate for demo viewing.
  if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
    const persona = cookieStore.get(PERSONA_COOKIE)?.value
    if (persona) {
      const fromPersona = resolveDemoPersona(persona)
      if (fromPersona) return fromPersona
    }
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
    .select('id, name, email')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (coachRow) {
    return {
      role: 'coach',
      id: coachRow.id as string,
      name: coachRow.name as string,
      email: coachRow.email as string,
      authUserId: user.id,
    }
  }

  const { data: studentRow } = await admin
    .from('student')
    .select('id, first_name, last_name, email, cohort')
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
 * Resolve a demo persona id (e.g. 'stu_aja' or 'coach_elizabeth')
 * to a V2Identity object using the static seed in src/data/.
 * Returns null if the id doesn't match a known persona.
 */
function resolveDemoPersona(personaId: string): V2Identity | null {
  const student = staticStudents.find(s => s.id === personaId)
  if (student) {
    return {
      role: 'student',
      id: student.id,
      firstName: student.firstName,
      lastName: student.lastName,
      name: `${student.firstName} ${student.lastName}`.trim(),
      email: student.email,
      cohort: student.cohort,
      authUserId: `demo:${student.id}`,
    }
  }
  const coach = staticCoaches.find(c => c.id === personaId)
  if (coach) {
    return {
      role: 'coach',
      id: coach.id,
      name: coach.name,
      email: coach.email,
      authUserId: `demo:${coach.id}`,
    }
  }
  return null
}

export { PERSONA_COOKIE }
