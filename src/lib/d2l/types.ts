/**
 * Raw response types from the D2L Valence API.
 *
 * These mirror the shapes documented at
 * https://docs.valence.desire2learn.com/res/dropbox.html and neighbors.
 * Field names are PascalCase to match the API — our mapping layer converts
 * them to camelCase for internal use.
 */

// ─── ORG UNITS & COURSES ────────────────────────────

export interface D2LOrgUnitType {
  Id: number
  Code: string
  Name: string
}

export interface D2LOrgUnitInfo {
  Id: number
  Type: D2LOrgUnitType
  Name: string
  Code: string | null
}

/** Response shape from /lp/{ver}/orgstructure/{orgUnitId}/children/ */
export interface D2LOrgUnitDescendant {
  Identifier: string
  Type: D2LOrgUnitType
  Name: string
  Code: string | null
}

/** Response shape from /lp/{ver}/enrollments/myenrollments/ */
export interface D2LMyEnrollment {
  OrgUnit: D2LOrgUnitInfo
  Access: {
    IsActive: boolean
    StartDate: string | null
    EndDate: string | null
    CanAccess: boolean
  }
}

// ─── CLASSLIST (enrollments by org unit) ────────────

/** Response shape from /le/{ver}/{orgUnitId}/classlist/ */
export interface D2LClasslistUser {
  Identifier: string
  ProfileIdentifier: string
  DisplayName: string
  Username: string
  OrgDefinedId: string | null
  Email: string | null
  FirstName: string
  LastName: string
  RoleId: number
}

// ─── USERS ──────────────────────────────────────────

/** Response shape from /lp/{ver}/users/{userId} */
export interface D2LUser {
  OrgId: number
  UserId: number
  FirstName: string
  MiddleName: string | null
  LastName: string
  UserName: string
  ExternalEmail: string | null
  OrgDefinedId: string | null
  UniqueIdentifier: string | null
  Activation: { IsActive: boolean }
  LastAccessedDate: string | null
  DisplayName: string
}

// ─── DROPBOX FOLDERS (assignments) ──────────────────

export interface D2LRichText {
  Text: string
  Html: string
}

export interface D2LDropboxFolder {
  Id: number
  CategoryId: number | null
  Name: string
  CustomInstructions: D2LRichText | null
  Attachments: unknown[]
  TotalFiles: number
  TotalUsersWithSubmissions: number
  TotalUsersWithFeedback: number
  DueDate: string | null
  DisplayInCalendar: boolean
  Assessment: {
    ScoreDenominator: number | null
    Rubrics: unknown[]
  } | null
  NotificationEmail: string | null
  IsHidden: boolean
  GroupTypeId: number | null
  DropboxType: number // 1 = Group, 2 = Individual
  SubmissionType: number // 0=File, 1=Text, 2=OnPaper, 3=Observed, 4=FileOrText
  GradeItemId: number | null
  Availability: {
    StartDate: string | null
    EndDate: string | null
  } | null
  ActivityId: string | null
}

// ─── SUBMISSIONS ────────────────────────────────────

export interface D2LFile {
  FileId: number
  FileName: string
  Size: number
}

export interface D2LSubmissionRecord {
  Id: number
  SubmittedBy: {
    Identifier: string
    DisplayName: string
  }
  SubmissionDate: string | null
  Comment: D2LRichText | null
  Files: D2LFile[]
}

/** One entry per enrolled user's submission state to a folder. */
export interface D2LEntityDropbox {
  Entity: {
    EntityId: number
    EntityType: 'User' | 'Group'
    Active: boolean
    DisplayName: string
  }
  Status: number // 0=Unsubmitted, 1=Submitted, 2=Draft, 3=Published
  Feedback: {
    Score: number | null
    Feedback: D2LRichText | null
    RubricAssessments: unknown[]
    IsGraded: boolean
    GradedSymbol: string | null
  } | null
  Submissions: D2LSubmissionRecord[]
  CompletionDate: string | null
}

// ─── PAGINATION ─────────────────────────────────────

export interface D2LPagedResultSet<T> {
  PagingInfo: {
    Bookmark: string
    HasMoreItems: boolean
  }
  Items: T[]
}

// ─── NORMALIZED APPLICATION TYPES ───────────────────
//
// These are the shapes the sync engine and downstream code use.
// The mapping layer in src/lib/d2l/mappers.ts converts raw D2L types
// into these.

export interface NormalizedCourse {
  orgUnitId: string
  name: string
  code: string | null
  active: boolean
  instructorEmail?: string
}

export interface NormalizedEnrollment {
  userId: string
  orgDefinedId: string | null
  email: string | null
  firstName: string
  lastName: string
  displayName: string
  roleId: number
  isStudent: boolean
  isInstructor: boolean
}

export interface NormalizedAssignment {
  folderId: string
  orgUnitId: string
  name: string
  description: string | null
  dueDate: string | null
  active: boolean
  submissionType: 'file' | 'text' | 'on_paper' | 'observed' | 'file_or_text' | 'unknown'
  maxPoints: number | null
}

export interface NormalizedSubmission {
  submissionId: string
  folderId: string
  orgUnitId: string
  studentUserId: string
  studentDisplayName: string
  submittedAt: string | null
  attempt: number
  grade: number | null
  isGraded: boolean
  comment: string | null
  files: {
    fileId: string
    fileName: string
    size: number
  }[]
}
