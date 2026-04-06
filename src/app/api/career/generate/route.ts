import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { createAdminClient } from '@/lib/supabase-admin'
import { generateCareerOutput } from '@/lib/conversation-engine-live'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST() {
  try {
    const cookieStore = cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const admin = createAdminClient()

    const { data: studentRow } = await admin
      .from('student')
      .select('*')
      .eq('auth_user_id', user.id)
      .single()

    if (!studentRow) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 })
    }

    // Get all current narratives
    const { data: narrativeRows } = await admin
      .from('skill_narrative')
      .select('*, durable_skill(name)')
      .eq('student_id', studentRow.id)
      .order('version', { ascending: false })

    // Deduplicate to latest per skill
    const latest = new Map<string, Record<string, unknown>>()
    for (const n of (narrativeRows || [])) {
      if (!latest.has(n.skill_id)) latest.set(n.skill_id, n)
    }

    const narratives = Array.from(latest.values())
      .filter(n => n.narrative_text)
      .map(n => ({
        skillId: n.skill_id as string,
        skillName: ((n.durable_skill as Record<string, unknown>)?.name as string) || '',
        narrativeText: n.narrative_text as string,
      }))

    if (narratives.length === 0) {
      return NextResponse.json({ error: 'No skill narratives found. Generate narratives first.' }, { status: 400 })
    }

    const studentName = `${studentRow.first_name} ${studentRow.last_name}`
    const result = await generateCareerOutput(studentName, narratives)

    // Get next version
    const { data: existing } = await admin
      .from('career_output')
      .select('version')
      .eq('student_id', studentRow.id)
      .order('version', { ascending: false })
      .limit(1)

    const nextVersion = existing && existing.length > 0 ? existing[0].version + 1 : 1

    // Save
    await admin.from('career_output').insert({
      student_id: studentRow.id,
      version: nextVersion,
      resume_summary: result.resumeSummary,
      skill_descriptions: result.skillDescriptions,
    })

    return NextResponse.json({
      resumeSummary: result.resumeSummary,
      skillDescriptions: result.skillDescriptions,
      version: nextVersion,
    })
  } catch (error) {
    console.error('Career output error:', error)
    return NextResponse.json({ error: 'Failed to generate' }, { status: 500 })
  }
}
