/**
 * LE3 sync engine — framework-agnostic core logic for pulling all LE3
 * data from D2L Valence into our Supabase database.
 *
 * This module is deliberately NOT coupled to Trigger.dev, Vercel Cron,
 * or any specific HTTP framework. It exposes pure async functions that
 * can be called from a Trigger.dev task, a Next.js API route, or a
 * local CLI script.
 *
 * High-level flow:
 *   1. Discover all course offerings under the configured LE3 org unit
 *   2. For each course:
 *      a. Upsert the course row
 *      b. Pull instructor and upsert as coach
 *      c. Pull student classlist and upsert each student row (with default coach)
 *      d. Upsert student_course enrollment rows
 *      e. Pull assignments (dropbox folders) and upsert assignment rows
 *      f. For each assignment, pull submissions
 *         - For each submission, download file → extract text → upsert student_work
 *           (deduped by brightspace_submission_id)
 *         - Run auto-tagger on newly-created work, insert work_skill_tag rows
 *   3. Write a sync_run row summarizing the outcome
 *
 * Error handling philosophy: per-course and per-submission errors are
 * caught, logged, counted, and the sync continues. Only a top-level
 * infrastructure failure (e.g. can't get a Valence token at all) should
 * abort the whole run.
 */

import { createAdminClient } from '@/lib/supabase-admin'
import {
  listCoursesUnderOrgUnit,
  listCourseEnrollments,
  listCourseAssignments,
  listAssignmentSubmissions,
  downloadSubmissionFile,
  getValenceConfig,
  inferWorkType,
  type NormalizedCourse,
  type NormalizedEnrollment,
  type NormalizedAssignment,
  type NormalizedSubmission,
} from '@/lib/d2l'
import { extractText, isSupported } from '@/lib/extract-text'
import { autoTagWork } from '@/lib/conversation-engine-live'
import type {
  WorkType,
  StudentWork,
  SyncRunSource,
  SyncRunMode,
} from '@/lib/types'

// ─── PUBLIC API ─────────────────────────────────────

export interface SyncOptions {
  source: SyncRunSource
  mode: SyncRunMode
  triggeredBy?: string
  /** Optional override for the LE3 org unit (defaults to env config) */
  le3OrgUnitId?: string
  /** Optional progress callback for UI/metadata updates */
  onProgress?: (progress: SyncProgress) => void | Promise<void>
}

export interface SyncProgress {
  stage: 'starting' | 'courses' | 'enrollments' | 'assignments' | 'submissions' | 'completed'
  currentCourse?: string
  currentCourseIndex?: number
  totalCourses?: number
  counts: SyncCounts
}

export interface SyncCounts {
  coursesSynced: number
  studentsSynced: number
  assignmentsSynced: number
  submissionsSynced: number
  submissionsSkipped: number
  errorsCount: number
}

export interface SyncResult {
  syncRunId: string
  counts: SyncCounts
  errors: SyncError[]
  durationMs: number
}

export interface SyncError {
  stage: string
  context: string
  message: string
}

/**
 * Run a full LE3 sync. Creates a sync_run row, walks the Valence API,
 * upserts everything, and finalizes the sync_run row with counts and
 * timing. Throws only on catastrophic failure; per-item errors are
 * collected and returned in the result.
 */
export async function runLe3Sync(options: SyncOptions): Promise<SyncResult> {
  const startedAt = Date.now()
  const admin = createAdminClient()
  const config = getValenceConfig()
  const le3OrgUnitId = options.le3OrgUnitId || config.le3OrgUnitId

  // Create sync_run row
  const { data: syncRun, error: syncRunErr } = await admin
    .from('sync_run')
    .insert({
      source: options.source,
      mode: options.mode,
      status: 'running',
      triggered_by: options.triggeredBy || null,
    })
    .select('id')
    .single()

  if (syncRunErr || !syncRun) {
    throw new Error(`Failed to create sync_run: ${syncRunErr?.message}`)
  }

  const syncRunId = syncRun.id as string
  const counts: SyncCounts = {
    coursesSynced: 0,
    studentsSynced: 0,
    assignmentsSynced: 0,
    submissionsSynced: 0,
    submissionsSkipped: 0,
    errorsCount: 0,
  }
  const errors: SyncError[] = []
  const studentIdsTouched = new Set<string>()

  try {
    await options.onProgress?.({ stage: 'starting', counts })

    // 1. Discover courses
    await options.onProgress?.({ stage: 'courses', counts })
    const courses = await listCoursesUnderOrgUnit(le3OrgUnitId)

    // 2. Process each course
    for (let i = 0; i < courses.length; i++) {
      const course = courses[i]

      await options.onProgress?.({
        stage: 'enrollments',
        currentCourse: course.name,
        currentCourseIndex: i,
        totalCourses: courses.length,
        counts,
      })

      try {
        const courseRowId = await upsertCourse(course)
        counts.coursesSynced++

        // Pull enrollments
        const enrollments = await listCourseEnrollments(course.orgUnitId)
        const instructors = enrollments.filter(e => e.isInstructor)
        const students = enrollments.filter(e => e.isStudent && !e.isInstructor)

        // Upsert instructors as coaches
        const coachIdsByEmail = new Map<string, string>()
        for (const instructor of instructors) {
          if (!instructor.email) continue
          try {
            const coachId = await upsertCoach(instructor)
            if (coachId) coachIdsByEmail.set(instructor.email.toLowerCase(), coachId)
          } catch (err) {
            recordError(errors, 'coach_upsert', `course=${course.name} email=${instructor.email}`, err)
            counts.errorsCount++
          }
        }

        // Pick a default coach for new student records (first instructor we found)
        const defaultCoachId = await pickDefaultCoachId(coachIdsByEmail)

        // Link course to primary instructor if we found one
        if (defaultCoachId) {
          await admin
            .from('course')
            .update({ instructor_id: defaultCoachId })
            .eq('id', courseRowId)
        }

        // Upsert students + enrollments
        for (const student of students) {
          if (!student.email) {
            counts.errorsCount++
            recordError(
              errors,
              'student_upsert',
              `course=${course.name} userId=${student.userId}`,
              new Error('Student has no email — skipping')
            )
            continue
          }
          try {
            const studentId = await upsertStudent(student, defaultCoachId)
            if (studentId) {
              studentIdsTouched.add(studentId)
              await upsertStudentCourse(studentId, courseRowId)
            }
          } catch (err) {
            recordError(errors, 'student_upsert', `course=${course.name} email=${student.email}`, err)
            counts.errorsCount++
          }
        }
        counts.studentsSynced = studentIdsTouched.size

        // Pull assignments
        await options.onProgress?.({
          stage: 'assignments',
          currentCourse: course.name,
          currentCourseIndex: i,
          totalCourses: courses.length,
          counts,
        })
        const assignments = await listCourseAssignments(course.orgUnitId)

        for (const assignment of assignments) {
          try {
            const assignmentRowId = await upsertAssignment(assignment, courseRowId, course.orgUnitId)
            counts.assignmentsSynced++

            // Pull submissions for this assignment
            await options.onProgress?.({
              stage: 'submissions',
              currentCourse: course.name,
              currentCourseIndex: i,
              totalCourses: courses.length,
              counts,
            })

            const submissions = await listAssignmentSubmissions(course.orgUnitId, assignment.folderId)

            for (const submission of submissions) {
              try {
                const inserted = await processSubmission({
                  submission,
                  assignment,
                  assignmentRowId,
                  courseRowId,
                  courseName: course.name,
                  courseCode: course.code,
                  mode: options.mode,
                })
                if (inserted) {
                  counts.submissionsSynced++
                } else {
                  counts.submissionsSkipped++
                }
              } catch (err) {
                recordError(
                  errors,
                  'submission_process',
                  `course=${course.name} assignment=${assignment.name} submissionId=${submission.submissionId}`,
                  err
                )
                counts.errorsCount++
              }
            }
          } catch (err) {
            recordError(
              errors,
              'assignment_process',
              `course=${course.name} assignment=${assignment.name}`,
              err
            )
            counts.errorsCount++
          }
        }
      } catch (err) {
        recordError(errors, 'course_process', `course=${course.name}`, err)
        counts.errorsCount++
      }
    }

    await options.onProgress?.({ stage: 'completed', counts })

    // Finalize sync_run
    const durationMs = Date.now() - startedAt
    await admin
      .from('sync_run')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        duration_seconds: Math.round(durationMs / 1000),
        courses_synced: counts.coursesSynced,
        students_synced: counts.studentsSynced,
        assignments_synced: counts.assignmentsSynced,
        submissions_synced: counts.submissionsSynced,
        submissions_skipped: counts.submissionsSkipped,
        errors_count: counts.errorsCount,
        error_details: errors.length > 0 ? errors : null,
      })
      .eq('id', syncRunId)

    return { syncRunId, counts, errors, durationMs }
  } catch (err) {
    // Catastrophic failure — mark run as failed and re-throw
    const durationMs = Date.now() - startedAt
    await admin
      .from('sync_run')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        duration_seconds: Math.round(durationMs / 1000),
        courses_synced: counts.coursesSynced,
        students_synced: counts.studentsSynced,
        assignments_synced: counts.assignmentsSynced,
        submissions_synced: counts.submissionsSynced,
        submissions_skipped: counts.submissionsSkipped,
        errors_count: counts.errorsCount + 1,
        error_details: [
          ...errors,
          { stage: 'fatal', context: 'top-level', message: String(err) },
        ],
      })
      .eq('id', syncRunId)
    throw err
  }
}

// ─── UPSERT HELPERS ─────────────────────────────────

async function upsertCourse(course: NormalizedCourse): Promise<string> {
  const admin = createAdminClient()
  const externalId = `d2l:${course.orgUnitId}`
  const quarter = currentQuarter()

  const { data: existing } = await admin
    .from('course')
    .select('id')
    .eq('external_id', externalId)
    .maybeSingle()

  if (existing) {
    await admin
      .from('course')
      .update({
        name: course.name,
        code: course.code,
        active: course.active,
        synced_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
    return existing.id as string
  }

  const { data: inserted, error } = await admin
    .from('course')
    .insert({
      external_id: externalId,
      brightspace_org_unit_id: course.orgUnitId,
      name: course.name,
      code: course.code,
      quarter,
      active: course.active,
    })
    .select('id')
    .single()

  if (error || !inserted) {
    throw new Error(`Failed to insert course ${course.name}: ${error?.message}`)
  }
  return inserted.id as string
}

async function upsertCoach(instructor: NormalizedEnrollment): Promise<string | null> {
  if (!instructor.email) return null

  const admin = createAdminClient()
  const email = instructor.email.toLowerCase()

  const { data: existing } = await admin
    .from('coach')
    .select('id')
    .eq('email', email)
    .maybeSingle()

  if (existing) return existing.id as string

  const name = `${instructor.firstName} ${instructor.lastName}`.trim() || instructor.displayName

  const { data: inserted, error } = await admin
    .from('coach')
    .insert({
      name,
      email,
      status: 'active',
    })
    .select('id')
    .single()

  if (error || !inserted) {
    throw new Error(`Failed to insert coach ${email}: ${error?.message}`)
  }
  return inserted.id as string
}

async function pickDefaultCoachId(
  coachIdsByEmail: Map<string, string>
): Promise<string | null> {
  // Prefer a course-specific coach if we found one
  const first = coachIdsByEmail.values().next().value
  if (first) return first

  // Otherwise fall back to the first active coach in the system
  const admin = createAdminClient()
  const { data: defaultCoach } = await admin
    .from('coach')
    .select('id')
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  return defaultCoach?.id || null
}

async function upsertStudent(
  student: NormalizedEnrollment,
  defaultCoachId: string | null
): Promise<string | null> {
  if (!student.email) return null

  const admin = createAdminClient()
  const email = student.email.toLowerCase()

  const { data: existing } = await admin
    .from('student')
    .select('id, nlu_id, coach_id')
    .eq('email', email)
    .maybeSingle()

  if (existing) {
    // Keep the existing coach assignment — don't clobber a real coach-student
    // relationship with whoever teaches this particular course.
    return existing.id as string
  }

  if (!defaultCoachId) {
    throw new Error(
      `Cannot create student ${email}: no default coach available. ` +
      'Ensure at least one coach record exists before running sync.'
    )
  }

  // Use the D2L OrgDefinedId as the nlu_id if available; otherwise fall back
  // to a d2l-prefixed user ID. LTI launches will later claim the record by
  // updating nlu_id to 'lti:{sub}'.
  const nluId = student.orgDefinedId || `d2l:${student.userId}`

  const { data: inserted, error } = await admin
    .from('student')
    .insert({
      nlu_id: nluId,
      first_name: student.firstName || 'Student',
      last_name: student.lastName || '',
      email,
      coach_id: defaultCoachId,
      cohort: currentQuarter(),
      program_start_date: new Date().toISOString().split('T')[0],
      status: 'active',
    })
    .select('id')
    .single()

  if (error || !inserted) {
    throw new Error(`Failed to insert student ${email}: ${error?.message}`)
  }
  return inserted.id as string
}

async function upsertStudentCourse(
  studentId: string,
  courseId: string
): Promise<void> {
  const admin = createAdminClient()

  // Use ON CONFLICT DO NOTHING via a conditional insert pattern
  const { data: existing } = await admin
    .from('student_course')
    .select('id')
    .eq('student_id', studentId)
    .eq('course_id', courseId)
    .maybeSingle()

  if (existing) return

  await admin.from('student_course').insert({
    student_id: studentId,
    course_id: courseId,
    enrolled_at: new Date().toISOString(),
    status: 'enrolled',
  })
}

async function upsertAssignment(
  assignment: NormalizedAssignment,
  courseRowId: string,
  orgUnitId: string
): Promise<string> {
  const admin = createAdminClient()
  const externalId = `d2l:${orgUnitId}:${assignment.folderId}`
  const quarter = currentQuarter()

  const { data: existing } = await admin
    .from('assignment')
    .select('id')
    .eq('external_id', externalId)
    .maybeSingle()

  if (existing) {
    await admin
      .from('assignment')
      .update({
        title: assignment.name,
        description: assignment.description,
        due_date: assignment.dueDate,
        work_type: inferWorkType(assignment.name),
        active: assignment.active,
        synced_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
    return existing.id as string
  }

  const { data: inserted, error } = await admin
    .from('assignment')
    .insert({
      external_id: externalId,
      brightspace_folder_id: assignment.folderId,
      course_id: courseRowId,
      title: assignment.name,
      description: assignment.description,
      due_date: assignment.dueDate,
      work_type: inferWorkType(assignment.name),
      quarter,
      active: assignment.active,
    })
    .select('id')
    .single()

  if (error || !inserted) {
    throw new Error(`Failed to insert assignment ${assignment.name}: ${error?.message}`)
  }
  return inserted.id as string
}

/**
 * Process a single submission: dedup check, file download, text extraction,
 * student_work insert, auto-tag. Returns true if a new work record was
 * inserted, false if it was a duplicate.
 */
async function processSubmission(params: {
  submission: NormalizedSubmission
  assignment: NormalizedAssignment
  assignmentRowId: string
  courseRowId: string
  courseName: string
  courseCode: string | null
  mode: SyncRunMode
}): Promise<boolean> {
  const { submission, assignment, assignmentRowId, courseName, courseCode } = params
  const admin = createAdminClient()

  // Dedup by unified key
  const { data: existingByBrightspaceId } = await admin
    .from('student_work')
    .select('id')
    .eq('brightspace_submission_id', submission.submissionId)
    .maybeSingle()

  if (existingByBrightspaceId) {
    return false
  }

  // Look up the student in our DB by Brightspace user ID
  // We match via the D2L OrgDefinedId nlu_id format we used at enrollment time,
  // OR by the display name as a fallback. First-launch LTI claim will later
  // update nlu_id to the lti: prefix.
  const { data: student } = await admin
    .from('student')
    .select('id')
    .or(`nlu_id.eq.d2l:${submission.studentUserId},nlu_id.eq.${submission.studentUserId}`)
    .maybeSingle()

  if (!student) {
    // Student wasn't in our enrollment data — skip silently rather than
    // error. This usually means they're in a course we haven't enrolled yet.
    return false
  }

  // Download the first file in the submission if present, otherwise fall
  // back to the submission comment text
  let content: string | null = submission.comment
  let fileTitle: string | null = null

  if (submission.files.length > 0) {
    const file = submission.files[0]
    fileTitle = file.fileName

    try {
      const downloaded = await downloadSubmissionFile(
        submission.orgUnitId,
        submission.folderId,
        submission.submissionId,
        file.fileId
      )
      if (isSupported(downloaded.filename)) {
        content = await extractText(downloaded.buffer, downloaded.filename)
      } else if (downloaded.contentType.startsWith('text/')) {
        content = downloaded.buffer.toString('utf-8').substring(0, 8000)
      }
    } catch (err) {
      // File download or text extraction failed — continue without content
      console.warn(
        `Failed to download/extract submission ${submission.submissionId}:`,
        err
      )
    }
  }

  const workType = (inferWorkType(assignment.name) || 'other') as WorkType
  const title = assignment.name || fileTitle || 'Assignment'

  // Insert student_work
  const { data: work, error: insertError } = await admin
    .from('student_work')
    .insert({
      student_id: student.id,
      assignment_id: assignmentRowId,
      title,
      description: assignment.description,
      work_type: workType,
      course_name: courseName,
      course_code: courseCode,
      submitted_at: submission.submittedAt || new Date().toISOString(),
      quarter: currentQuarter(),
      attempt_number: submission.attempt,
      content,
      grade: submission.grade != null ? String(submission.grade) : null,
      source: 'd2l_valence_sync',
      external_id: `d2l:${submission.orgUnitId}:${submission.folderId}:${submission.submissionId}`,
      brightspace_submission_id: submission.submissionId,
      imported_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (insertError || !work) {
    // If it's a uniqueness violation, treat as duplicate (race with another
    // sync or Asset Processor notice)
    if (insertError?.code === '23505') return false
    throw new Error(`student_work insert failed: ${insertError?.message}`)
  }

  // Auto-tag with skills
  try {
    const workObj: StudentWork = {
      id: work.id,
      studentId: student.id,
      assignmentId: assignmentRowId,
      title,
      description: assignment.description || undefined,
      workType,
      courseName,
      courseCode: courseCode || undefined,
      submittedAt: submission.submittedAt || new Date().toISOString(),
      quarter: currentQuarter(),
      attemptNumber: submission.attempt,
      content: content || undefined,
    }
    const tags = await autoTagWork(workObj)
    if (tags.length > 0) {
      await admin.from('work_skill_tag').insert(
        tags.map(t => ({
          work_id: work.id,
          skill_id: t.skillId,
          confidence: t.confidence,
          rationale: t.rationale,
          source: 'llm_auto',
        }))
      )
    }
  } catch (err) {
    console.warn(`Auto-tagging failed for submission ${submission.submissionId}:`, err)
  }

  return true
}

// ─── UTILITIES ─────────────────────────────────────

function currentQuarter(): string {
  const now = new Date()
  const month = now.getMonth()
  const year = now.getFullYear()
  if (month < 3) return `Winter ${year}`
  if (month < 6) return `Spring ${year}`
  if (month < 9) return `Summer ${year}`
  return `Fall ${year}`
}

function recordError(errors: SyncError[], stage: string, context: string, err: unknown): void {
  errors.push({
    stage,
    context,
    message: String(err),
  })
}
