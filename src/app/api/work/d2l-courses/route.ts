import { createD2LClient } from '@/lib/d2l-client'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/work/d2l-courses
 *
 * Lists courses available in D2L for the authenticated service account.
 * Returns 503 if D2L is not configured.
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
