/**
 * D2L Valence API client stub.
 *
 * This module defines the interfaces and placeholder functions for
 * integrating with the D2L Brightspace Valence API.
 *
 * When API credentials are available, implement the actual HTTP calls
 * using the interfaces defined here.
 *
 * D2L API docs: https://docs.valence.desire2learn.com/
 */

// ─── D2L API TYPES ──────────────────────────────────

export interface D2LConfig {
  instanceUrl: string     // e.g. https://yourschool.brightspace.com
  appId: string
  appKey: string
  userId?: string
  userKey?: string
}

export interface D2LAssignment {
  id: string
  name: string
  instructions?: string
  dueDate?: string
  courseId: string
  courseName: string
  maxPoints?: number
}

export interface D2LSubmission {
  id: string
  assignmentId: string
  userId: string
  submittedDate: string
  grade?: number
  feedback?: string
  fileUrls?: string[]
}

export interface D2LCourse {
  id: string
  name: string
  code: string
}

// ─── API CLIENT ─────────────────────────────────────

export class D2LClient {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(_config: D2LConfig) {
    // Will store config and initialize OAuth when implemented
  }

  async getCourses(): Promise<D2LCourse[]> {
    throw new Error('D2L API integration not yet implemented. Use CSV import instead.')
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getAssignments(_courseId: string): Promise<D2LAssignment[]> {
    throw new Error('D2L API integration not yet implemented. Use CSV import instead.')
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getSubmissions(_courseId: string, _assignmentId: string): Promise<D2LSubmission[]> {
    throw new Error('D2L API integration not yet implemented. Use CSV import instead.')
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async downloadSubmissionFile(_fileUrl: string): Promise<Buffer> {
    throw new Error('D2L API integration not yet implemented. Use CSV import instead.')
  }
}
