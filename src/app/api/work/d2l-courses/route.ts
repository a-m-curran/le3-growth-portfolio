import { createD2LClient } from '@/lib/d2l-client'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/work/d2l-courses — DEPRECATED
 *
 * Lists courses available in D2L for the authenticated Valence service account.
 * Kept as a fallback. The active path is LTI Asset Processor
 * (see src/app/api/lti/notice/route.ts) which is push-based and doesn't
 * need a Valence registration.
 */
export async function GET() {
  try {
    const d2l = createD2LClient()
    if (!d2l) {
      return NextResponse.json({
        configured: false,
        courses: [],
        message: 'D2L integration is not configured. Use CSV import instead.',
      })
    }

    const courses = await d2l.getCourses()

    return NextResponse.json({
      configured: true,
      courses: courses.filter(c => c.isActive),
    })
  } catch (error) {
    console.error('D2L courses error:', error)
    return NextResponse.json({
      configured: true,
      courses: [],
      error: 'Failed to fetch courses from D2L: ' + String(error),
    })
  }
}
