/**
 * D2L Brightspace Valence API Client — DEPRECATED
 *
 * This client was written before we discovered NLU's Brightspace supports
 * LTI Asset Processor (https://standards.1edtech.org/lti/specifications/proposals/asset-processor).
 * The Asset Processor flow handles submission retrieval via push-based
 * LtiAssetProcessorSubmissionNotice through the Platform Notification Service,
 * which is a cleaner integration than polling the proprietary Valence REST API.
 *
 * Active integration: see src/lib/lti/* and src/app/api/lti/notice/route.ts
 *
 * This file is kept for reference and as a fallback if the Asset Processor
 * path becomes unavailable. It is NOT imported anywhere in active code paths.
 *
 * Docs: https://docs.valence.desire2learn.com/
 */

// ─── D2L API TYPES (matching Valence schema) ────────

export interface D2LConfig {
  instanceUrl: string       // e.g. https://nlu.brightspace.com
  accessToken: string       // OAuth2 bearer token
  apiVersion?: string       // defaults to '1.82'
}

/** Maps to Valence DropboxFolder */
export interface D2LDropboxFolder {
  Id: number
  CategoryId: number | null
  Name: string
  CustomInstructions: { Text: string; Html: string } | null
  DueDate: string | null
  Assessment: {
    ScoreDenominator: number | null
    Rubrics: unknown[]
  } | null
  DropboxType: number       // 1=Group, 2=Individual
  SubmissionType: number    // 0=File, 1=Text, 2=OnPaper, 3=Observed, 4=FileOrText
  GradeItemId: number | null
  IsHidden: boolean
  TotalFiles: number
  TotalUsersWithSubmissions: number
  Availability: {
    StartDate: string | null
    EndDate: string | null
  } | null
}

/** Maps to Valence EntityDropbox submission entry */
export interface D2LSubmission {
  Id: number
  SubmittedBy: { Id: string; DisplayName: string }
  SubmissionDate: string | null
  Comment: { Text: string; Html: string } | null
  Files: D2LFile[]
}

export interface D2LEntityDropbox {
  Entity: {
    EntityId: number
    EntityType: 'User' | 'Group'
    DisplayName: string
  }
  Status: number            // 0=Unsubmitted, 1=Submitted, 2=Draft, 3=Published
  Feedback: {
    Score: number | null
    Feedback: { Text: string; Html: string } | null
    IsGraded: boolean
  } | null
  Submissions: D2LSubmission[]
  CompletionDate: string | null
}

export interface D2LFile {
  FileId: number
  FileName: string
  Size: number
}

/** Maps to Valence enrollment MyOrgUnitInfo */
export interface D2LEnrollment {
  OrgUnit: {
    Id: number
    Type: { Id: number; Code: string; Name: string }
    Name: string
    Code: string | null
  }
  Access: {
    IsActive: boolean
    StartDate: string | null
    EndDate: string | null
    CanAccess: boolean
  }
}

/** Maps to Valence ClasslistUser */
export interface D2LClasslistUser {
  Identifier: string
  DisplayName: string
  Username: string
  OrgDefinedId: string | null
  Email: string | null
  FirstName: string
  LastName: string
  RoleId: number
}

// ─── SIMPLIFIED TYPES FOR OUR APP ───────────────────

export interface D2LCourse {
  id: string
  name: string
  code: string
  isActive: boolean
}

export interface D2LAssignment {
  id: string
  name: string
  instructions?: string
  dueDate?: string
  courseId: string
  courseName: string
  maxPoints?: number
  submissionType: string
  totalSubmissions: number
}

export interface D2LStudentSubmission {
  id: string
  assignmentId: string
  assignmentName: string
  studentId: string
  studentName: string
  submittedDate: string
  grade?: number
  isGraded: boolean
  comment?: string
  files: { fileId: number; fileName: string; size: number }[]
}

// ─── API CLIENT ─────────────────────────────────────

export class D2LClient {
  private baseUrl: string
  private token: string
  private version: string

  constructor(config?: D2LConfig) {
    this.baseUrl = config?.instanceUrl || process.env.D2L_INSTANCE_URL || ''
    this.token = config?.accessToken || process.env.D2L_ACCESS_TOKEN || ''
    this.version = config?.apiVersion || process.env.D2L_API_VERSION || '1.82'

    if (!this.baseUrl || !this.token) {
      throw new Error(
        'D2L client requires instance URL and access token. ' +
        'Set D2L_INSTANCE_URL and D2L_ACCESS_TOKEN environment variables, ' +
        'or pass them in the config. Use CSV import as an alternative.'
      )
    }
  }

  /**
   * Check if D2L integration is configured and available.
   */
  static isConfigured(): boolean {
    return !!(process.env.D2L_INSTANCE_URL && process.env.D2L_ACCESS_TOKEN)
  }

  // ─── HTTP HELPERS ───────────────────────────────────

  private async get<T>(path: string): Promise<T> {
    const url = `${this.baseUrl}${path}`
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Accept': 'application/json',
      },
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`D2L API error ${res.status} on GET ${path}: ${text}`)
    }

    return res.json()
  }

  private async getBuffer(path: string): Promise<Buffer> {
    const url = `${this.baseUrl}${path}`
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${this.token}` },
    })

    if (!res.ok) {
      throw new Error(`D2L API error ${res.status} on file download ${path}`)
    }

    const arrayBuf = await res.arrayBuffer()
    return Buffer.from(arrayBuf)
  }

  private lePath(path: string): string {
    return `/d2l/api/le/${this.version}${path}`
  }

  private lpPath(path: string): string {
    return `/d2l/api/lp/${this.version}${path}`
  }

  // ─── COURSES ────────────────────────────────────────

  /**
   * Get all courses the authenticated user is enrolled in.
   * Filters to CourseOffering type (type ID 3).
   */
  async getCourses(): Promise<D2LCourse[]> {
    const enrollments = await this.getPagedEnrollments()

    return enrollments
      .filter(e => e.OrgUnit.Type.Id === 3) // CourseOffering
      .map(e => ({
        id: String(e.OrgUnit.Id),
        name: e.OrgUnit.Name,
        code: e.OrgUnit.Code || '',
        isActive: e.Access.IsActive,
      }))
  }

  /**
   * Get the class list (enrolled students) for a course.
   */
  async getClassList(courseId: string): Promise<D2LClasslistUser[]> {
    return this.get<D2LClasslistUser[]>(
      this.lePath(`/${courseId}/classlist/`)
    )
  }

  // ─── ASSIGNMENTS (DROPBOX FOLDERS) ──────────────────

  /**
   * Get all assignment/dropbox folders for a course.
   */
  async getAssignments(courseId: string): Promise<D2LAssignment[]> {
    const folders = await this.get<D2LDropboxFolder[]>(
      this.lePath(`/${courseId}/dropbox/folders/`)
    )

    return folders
      .filter(f => !f.IsHidden)
      .map(f => ({
        id: String(f.Id),
        name: f.Name,
        instructions: f.CustomInstructions?.Text,
        dueDate: f.DueDate || undefined,
        courseId,
        courseName: '', // Will be filled by caller
        maxPoints: f.Assessment?.ScoreDenominator || undefined,
        submissionType: this.mapSubmissionType(f.SubmissionType),
        totalSubmissions: f.TotalUsersWithSubmissions,
      }))
  }

  /**
   * Get details for a single assignment/dropbox folder.
   */
  async getAssignment(courseId: string, folderId: string): Promise<D2LDropboxFolder> {
    return this.get<D2LDropboxFolder>(
      this.lePath(`/${courseId}/dropbox/folders/${folderId}`)
    )
  }

  // ─── SUBMISSIONS ────────────────────────────────────

  /**
   * Get all submissions for a specific assignment in a course.
   * Returns per-entity (student or group) submission data.
   */
  async getSubmissions(courseId: string, folderId: string): Promise<D2LStudentSubmission[]> {
    const entities = await this.get<D2LEntityDropbox[]>(
      this.lePath(`/${courseId}/dropbox/folders/${folderId}/submissions/`)
    )

    const results: D2LStudentSubmission[] = []

    for (const entity of entities) {
      if (entity.Entity.EntityType === 'Group') continue // Skip group submissions for now

      for (const sub of entity.Submissions) {
        results.push({
          id: String(sub.Id),
          assignmentId: folderId,
          assignmentName: '', // Will be filled by caller
          studentId: String(entity.Entity.EntityId),
          studentName: entity.Entity.DisplayName,
          submittedDate: sub.SubmissionDate || '',
          grade: entity.Feedback?.Score || undefined,
          isGraded: entity.Feedback?.IsGraded || false,
          comment: sub.Comment?.Text,
          files: sub.Files.map(f => ({
            fileId: f.FileId,
            fileName: f.FileName,
            size: f.Size,
          })),
        })
      }
    }

    return results
  }

  /**
   * Get submissions for a specific student in a course assignment.
   */
  async getStudentSubmissions(courseId: string, folderId: string, userId: string): Promise<D2LEntityDropbox> {
    return this.get<D2LEntityDropbox>(
      this.lePath(`/${courseId}/dropbox/folders/${folderId}/submissions/user/${userId}`)
    )
  }

  // ─── FILE DOWNLOADS ─────────────────────────────────

  /**
   * Download a specific submitted file.
   */
  async downloadSubmissionFile(
    courseId: string,
    folderId: string,
    submissionId: string,
    fileId: string
  ): Promise<Buffer> {
    return this.getBuffer(
      this.lePath(`/${courseId}/dropbox/folders/${folderId}/submissions/${submissionId}/files/${fileId}`)
    )
  }

  /**
   * Download all files for a user's submissions in a folder (as zip).
   */
  async downloadAllUserFiles(courseId: string, folderId: string, userId: string): Promise<Buffer> {
    return this.getBuffer(
      this.lePath(`/${courseId}/dropbox/folders/${folderId}/submissions/${userId}/download`)
    )
  }

  // ─── SYNC HELPER ────────────────────────────────────

  /**
   * High-level: Pull all assignments and submissions for a course.
   * Returns data ready to be inserted into our student_work table.
   */
  async syncCourse(courseId: string, courseName: string): Promise<{
    assignments: D2LAssignment[]
    submissions: D2LStudentSubmission[]
  }> {
    const assignments = await this.getAssignments(courseId)
    assignments.forEach(a => { a.courseName = courseName })

    const allSubmissions: D2LStudentSubmission[] = []

    for (const assignment of assignments) {
      try {
        const subs = await this.getSubmissions(courseId, assignment.id)
        subs.forEach(s => { s.assignmentName = assignment.name })
        allSubmissions.push(...subs)
      } catch (err) {
        console.error(`Failed to fetch submissions for ${assignment.name}:`, err)
      }
    }

    return { assignments, submissions: allSubmissions }
  }

  // ─── PAGINATION HELPERS ─────────────────────────────

  private async getPagedEnrollments(): Promise<D2LEnrollment[]> {
    const all: D2LEnrollment[] = []
    let bookmark: string | undefined

    while (true) {
      const params = new URLSearchParams()
      if (bookmark) params.set('bookmark', bookmark)

      const page = await this.get<{
        PagingInfo: { Bookmark: string; HasMoreItems: boolean }
        Items: D2LEnrollment[]
      }>(this.lpPath(`/enrollments/myenrollments/?${params.toString()}`))

      all.push(...page.Items)

      if (!page.PagingInfo.HasMoreItems) break
      bookmark = page.PagingInfo.Bookmark
    }

    return all
  }

  // ─── MAPPING HELPERS ────────────────────────────────

  private mapSubmissionType(type: number): string {
    switch (type) {
      case 0: return 'file'
      case 1: return 'text'
      case 2: return 'on_paper'
      case 3: return 'observed'
      case 4: return 'file_or_text'
      default: return 'unknown'
    }
  }
}

// ─── CONVENIENCE FACTORY ────────────────────────────

/**
 * Create a D2L client from environment variables.
 * Returns null if D2L is not configured.
 */
export function createD2LClient(): D2LClient | null {
  if (!D2LClient.isConfigured()) return null
  return new D2LClient()
}
