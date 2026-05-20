/**
 * Shared types for the redesigned student reflect + today surfaces.
 *
 * Consumed by:
 *   - /api/student/reflect/route.ts  (response typing)
 *   - /api/student/today/route.ts    (response typing)
 *   - SubmissionRow, ReflectTree, TodayBuckets, InProgressBanner,
 *     InProgressInterstitial, useStartReflection
 *
 * Single source of truth so the shared SubmissionRow renders the
 * same shape on both surfaces.
 */

export type SubmissionStatus = 'unreflected' | 'in_progress' | 'completed'

export interface SubmissionItem {
  id: string              // student_work.id
  title: string
  courseName: string | null
  courseCode: string | null
  quarter: string         // e.g. "Spring 2026"
  weekNumber: number | null
  submittedAt: string | null  // ISO timestamp
  workType: string | null
  status: SubmissionStatus
  conversationId: string | null   // non-null for status='in_progress' | 'completed'
  primaryPillar: string | null    // non-null for status='completed'; drives row stripe
}

export interface ActiveInProgress {
  id: string                                        // growth_conversation.id
  workId: string | null                             // null when conversation_type='open_reflection'
  workTitle: string | null
  conversationType: 'work_based' | 'open_reflection'
  currentPhase: 1 | 2 | 3
  startedAt: string                                 // ISO timestamp
}
