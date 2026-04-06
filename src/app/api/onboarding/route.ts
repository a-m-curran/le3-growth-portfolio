import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { createAdminClient } from '@/lib/supabase-admin'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    // Get authenticated user
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

    const { firstName, lastName, nluId, coachId } = await request.json()

    if (!firstName || !lastName || !nluId || !coachId) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
    }

    const admin = createAdminClient()

    // Check if student record already exists for this auth user
    const { data: existing } = await admin
      .from('student')
      .select('id')
      .eq('auth_user_id', user.id)
      .single()

    if (existing) {
      return NextResponse.json({ error: 'Account already exists', studentId: existing.id }, { status: 409 })
    }

    // Verify coach exists
    const { data: coach } = await admin
      .from('coach')
      .select('id')
      .eq('id', coachId)
      .single()

    if (!coach) {
      return NextResponse.json({ error: 'Selected coach not found' }, { status: 400 })
    }

    // Determine current cohort
    const now = new Date()
    const month = now.getMonth()
    const year = now.getFullYear()
    let cohort: string
    if (month < 3) cohort = `Winter ${year}`
    else if (month < 6) cohort = `Spring ${year}`
    else if (month < 9) cohort = `Summer ${year}`
    else cohort = `Fall ${year}`

    // Create student record
    const { data: student, error: insertError } = await admin
      .from('student')
      .insert({
        auth_user_id: user.id,
        nlu_id: nluId,
        first_name: firstName,
        last_name: lastName,
        email: user.email,
        coach_id: coachId,
        cohort,
        program_start_date: now.toISOString().split('T')[0],
        status: 'active',
      })
      .select('id')
      .single()

    if (insertError) {
      if (insertError.code === '23505') {
        return NextResponse.json(
          { error: 'A student with this NLU ID or email already exists' },
          { status: 409 }
        )
      }
      console.error('Onboarding insert error:', insertError)
      return NextResponse.json({ error: 'Failed to create account' }, { status: 500 })
    }

    return NextResponse.json({ studentId: student.id })
  } catch (error) {
    console.error('Onboarding error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
