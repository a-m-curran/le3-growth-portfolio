/**
 * Per-course LE3 sync pipeline. Syncs exactly one course offering:
 * classlist → instructors → students → enrollments → assignments →
 * submissions → download → extract → student_work. Idempotent and
 * race-safe (see upsertStudent/upsertInstructor 23505 handling).
 *
 * Extracted from the former monolithic runLe3Sync loop so it can run
 * as an isolated Trigger.dev child task with bounded memory.
 */
import { createAdminClient } from '@/lib/supabase-admin'
import {
  listCourseEnrollments,
  listCourseAssignments,
  listAssignmentSubmissions,
  downloadSubmissionFile,
  inferWorkType,
  type NormalizedCourse,
  type NormalizedEnrollment,
  type NormalizedAssignment,
  type NormalizedSubmission,
} from '@/lib/d2l'
import { extractText, isSupported } from '@/lib/extract-text'
import { autoTagWork } from '@/lib/conversation-engine-live'
import type { WorkType, StudentWork, SyncRunMode } from '@/lib/types'
import type { SyncCounts, SyncError } from '@/lib/sync/sync-engine'

export interface SyncOneCourseParams {
  syncRunId: string
  course: NormalizedCourse
  mode: SyncRunMode
  defaultCoachId: string | null
}

export interface CourseSyncResult {
  courseOuId: string
  courseName: string
  counts: SyncCounts
  errors: SyncError[]
  /** UUIDs of every student row upserted or claimed in this course. Used by
   *  the run-level aggregator (runLe3Sync) to compute global unique student
   *  count across courses, matching the pre-refactor behaviour of a shared
   *  studentIdsTouched Set. */
  studentIds: string[]
}

export async function syncOneCourse(
  params: SyncOneCourseParams
): Promise<CourseSyncResult> {
  const { course, mode, defaultCoachId } = params
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
    const courseRowId = await upsertCourse(course)
    counts.coursesSynced++

    // Pull enrollments
    const enrollments = await listCourseEnrollments(course.orgUnitId)
    const instructors = enrollments.filter(e => e.isInstructor)
    const students = enrollments.filter(e => e.isStudent && !e.isInstructor)

    // Upsert Brightspace instructors into the `instructor` table.
    // These are NOT LE3 program coaches — coaches are a separate
    // group of humans, manually managed. See migration 014.
    const instructorIdsByEmail = new Map<string, string>()
    for (const instructor of instructors) {
      if (!instructor.email) continue
      try {
        const instructorId = await upsertInstructor(instructor)
        if (instructorId)
          instructorIdsByEmail.set(instructor.email.toLowerCase(), instructorId)

        // If this instructor was misclassified as a student on a
        // prior sync (e.g. before the ClasslistRoleDisplayName-based
        // fix landed), flag it so we can clean up the stale record.
        // We don't auto-delete — the coach can confirm and remove
        // via an admin action — but we surface the mismatch via
        // sync_run error_details so it isn't invisible.
        await flagStaleStudentFromInstructor(
          instructor.email,
          instructor.userId,
          course.name,
          errors,
          counts
        )
      } catch (err) {
        recordError(
          errors,
          'instructor_upsert',
          `course=${course.name} email=${instructor.email}`,
          err
        )
        counts.errorsCount++
      }
    }

    // Link course → instructor (first instructor we found, if any).
    // Course can have null instructor_id; that's fine.
    const admin = createAdminClient()
    const primaryInstructorId =
      instructorIdsByEmail.values().next().value ?? null
    if (primaryInstructorId) {
      await admin
        .from('course')
        .update({ instructor_id: primaryInstructorId })
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
    const assignments = await listCourseAssignments(course.orgUnitId)

    for (const assignment of assignments) {
      try {
        const assignmentRowId = await upsertAssignment(assignment, courseRowId, course.orgUnitId)
        counts.assignmentsSynced++

        // Pull submissions for this assignment
        const submissions = await listAssignmentSubmissions(course.orgUnitId, assignment.folderId)

        for (const submission of submissions) {
          try {
            const result = await processSubmission({
              submission,
              assignment,
              assignmentRowId,
              courseRowId,
              courseName: course.name,
              courseCode: course.code,
              mode,
            })
            if (result.inserted) {
              counts.submissionsSynced++
            } else {
              counts.submissionsSkipped++
            }
            // Surface extraction failures (download/mammoth/pdf-parse)
            // into sync_run.error_details. Previously these were
            // swallowed as console.warn, which is why content_len=0
            // rows landed invisibly. The work row still gets created
            // (with empty content), so the sync continues — but now
            // the failure is visible in the Inspector.
            if (result.extractionError) {
              errors.push({
                stage: 'submission_extract',
                context: `course=${course.name} assignment=${assignment.name} submissionId=${submission.submissionId}`,
                message: result.extractionError,
              })
              counts.errorsCount++
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

  return {
    courseOuId: course.orgUnitId,
    courseName: course.name,
    counts,
    errors,
    studentIds: Array.from(studentIdsTouched),
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

/**
 * Upsert a Brightspace instructor into the `instructor` table. Distinct
 * from LE3 coaches — instructors come from classlist data and are
 * per-course; coaches are program-level humans manually managed.
 */
async function upsertInstructor(
  instructor: NormalizedEnrollment
): Promise<string | null> {
  if (!instructor.email) return null

  const admin = createAdminClient()
  const email = instructor.email.toLowerCase()

  const { data: existing } = await admin
    .from('instructor')
    .select('id, d2l_user_id')
    .eq('email', email)
    .maybeSingle()

  if (existing) {
    // Claim d2l_user_id if not yet set so future lookups can match by ID.
    if (!existing.d2l_user_id && instructor.userId) {
      await admin
        .from('instructor')
        .update({
          d2l_user_id: instructor.userId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
    }
    return existing.id as string
  }

  const name =
    `${instructor.firstName} ${instructor.lastName}`.trim() ||
    instructor.displayName

  const { data: inserted, error } = await admin
    .from('instructor')
    .insert({
      name,
      email,
      d2l_user_id: instructor.userId || null,
      org_defined_id: instructor.orgDefinedId || null,
      status: 'active',
    })
    .select('id')
    .single()

  if (inserted) return inserted.id as string

  // 23505 = unique_violation. A concurrent child created this instructor
  // (shared across courses) between our existence check and insert.
  // instructor_email_key (UNIQUE(email)) is the ONLY unique constraint
  // and the only column the insert can collide on, so re-fetch by email.
  // Mirrors the upsertStudent / processSubmission 23505 recovery pattern.
  if (error?.code === '23505') {
    const { data: raced } = await admin
      .from('instructor')
      .select('id')
      .eq('email', email)
      .limit(1)
      .maybeSingle()
    if (raced) return raced.id as string
  }

  throw new Error(`Failed to insert instructor ${email}: ${error?.message}`)
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
    .select('id, nlu_id, coach_id, d2l_user_id')
    .eq('email', email)
    .maybeSingle()

  if (existing) {
    // Student already exists (from a prior sync, an LTI launch, or CSV
    // import). Claim their d2l_user_id if not yet set, so future
    // submission processing can find them by Brightspace user ID.
    // Preserve the existing coach assignment — don't clobber a real
    // coach-student relationship with whoever teaches this course.
    if (!existing.d2l_user_id) {
      await admin
        .from('student')
        .update({ d2l_user_id: student.userId })
        .eq('id', existing.id)
    }
    return existing.id as string
  }

  if (!defaultCoachId) {
    throw new Error(
      `Cannot create student ${email}: no default coach available. ` +
      'Ensure at least one coach record exists before running sync.'
    )
  }

  // Use the D2L OrgDefinedId as the nlu_id if available; otherwise fall
  // back to a d2l-prefixed user ID. LTI launches will later claim the
  // record by updating nlu_id to 'lti:{sub}'. Separately, we store the
  // raw Brightspace user ID in d2l_user_id so that submission processing
  // can reliably find this student regardless of nlu_id format.
  const nluId = student.orgDefinedId || `d2l:${student.userId}`

  const { data: inserted, error } = await admin
    .from('student')
    .insert({
      nlu_id: nluId,
      d2l_user_id: student.userId,
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

  if (inserted) return inserted.id as string

  // 23505 = unique_violation. A concurrent child created this student
  // (shared across courses) between our existence check and insert.
  // Re-fetch the now-existing row by the same keys and use it. This is
  // the same recovery pattern processSubmission uses for student_work.
  if (error?.code === '23505') {
    // Recover only via the UNIQUE keys (student_email_key,
    // student_nlu_id_key). d2l_user_id is intentionally NON-unique — a
    // person can have a pre-existing row under a different identity that
    // later gets d2l_user_id back-filled — so including it here could
    // match >1 row and make maybeSingle() throw, which would defeat the
    // race recovery this block exists for. The insert only sets
    // email+nlu_id, so a 23505 here is always one of those two unique
    // constraints; both point at the same winning row in the real race.
    const { data: raced } = await admin
      .from('student')
      .select('id')
      .or(`email.eq.${email},nlu_id.eq.${nluId}`)
      .limit(1)
      .maybeSingle()
    if (raced) return raced.id as string
  }

  throw new Error(`Failed to insert student ${email}: ${error?.message}`)
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

interface ProcessSubmissionResult {
  inserted: boolean
  extractionError: string | null
}

/**
 * Process a single submission: dedup check, file download, text extraction,
 * student_work insert, auto-tag. Returns inserted=true if a new work record
 * was created, inserted=false if it was a duplicate. Also surfaces any
 * download/extract error so the caller can log it into sync_run.error_details
 * instead of swallowing it as a console.warn.
 */
async function processSubmission(params: {
  submission: NormalizedSubmission
  assignment: NormalizedAssignment
  assignmentRowId: string
  courseRowId: string
  courseName: string
  courseCode: string | null
  mode: SyncRunMode
}): Promise<ProcessSubmissionResult> {
  const { submission, assignment, assignmentRowId, courseName, courseCode } = params
  const admin = createAdminClient()

  // Dedup by unified key
  const { data: existingByBrightspaceId } = await admin
    .from('student_work')
    .select('id')
    .eq('brightspace_submission_id', submission.submissionId)
    .maybeSingle()

  if (existingByBrightspaceId) {
    return { inserted: false, extractionError: null }
  }

  // Look up the student by their raw Brightspace user ID. The sync
  // engine populates d2l_user_id on every upsert, so any student who
  // has been through at least one classlist-sync will match here.
  //
  // Fall back to nlu_id formats for legacy records (pre-migration 012
  // students, CSV imports, or students whose upserts failed for some
  // reason). This gives us three ways to find a student, all of which
  // should converge on the same row if the upsert ran correctly.
  const { data: student } = await admin
    .from('student')
    .select('id')
    .or(
      `d2l_user_id.eq.${submission.studentUserId},` +
      `nlu_id.eq.d2l:${submission.studentUserId},` +
      `nlu_id.eq.${submission.studentUserId}`
    )
    .maybeSingle()

  if (!student) {
    // Student wasn't in our enrollment data — skip silently rather than
    // error. This usually means they're in a course we haven't enrolled
    // yet, or the classlist fetch missed them for this particular sync.
    return { inserted: false, extractionError: null }
  }

  // Download the first file in the submission if present, otherwise fall
  // back to the submission comment text
  let content: string | null = submission.comment
  let fileTitle: string | null = null
  let extractionError: string | null = null

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
      } else {
        extractionError = `Unsupported file type: ${downloaded.filename} (${downloaded.contentType})`
      }
    } catch (err) {
      // File download or text extraction failed — record so it shows up in
      // sync_run.error_details (not just a console.warn that disappears).
      // Sync continues so other submissions aren't blocked.
      extractionError = `download/extract failed for ${file.fileName}: ${String(err)}`
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
    if (insertError?.code === '23505') return { inserted: false, extractionError }
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

  return { inserted: true, extractionError }
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

/**
 * If an email that now appears as an instructor also has a stale
 * `student` row (from an earlier sync that misclassified them), flag
 * the mismatch via sync_run error_details. Doesn't delete — that's a
 * coach decision — but makes the stale data visible instead of silent.
 */
async function flagStaleStudentFromInstructor(
  email: string,
  d2lUserId: string,
  courseName: string,
  errors: SyncError[],
  counts: SyncCounts
): Promise<void> {
  const admin = createAdminClient()
  const { data: staleStudent } = await admin
    .from('student')
    .select('id, first_name, last_name')
    .eq('email', email.toLowerCase())
    .maybeSingle()

  if (!staleStudent) return

  errors.push({
    stage: 'role_mismatch',
    context: `course=${courseName} email=${email} d2l_user_id=${d2lUserId}`,
    message:
      `Stale student row detected for ${staleStudent.first_name} ${staleStudent.last_name} ` +
      `(student.id=${staleStudent.id}) — this user is now correctly classified as an ` +
      `instructor. Delete the student row manually once you've confirmed no real ` +
      `student data is tied to it.`,
  })
  counts.errorsCount++
}
