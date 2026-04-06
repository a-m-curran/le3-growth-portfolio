// src/lib/types.ts

// ─── PEOPLE ─────────────────────────────────────────

export interface Student {
  id: string
  nluId: string
  firstName: string
  lastName: string
  email: string
  coachId: string
  cohort: string
  programStartDate: string // ISO date
  status: 'active' | 'on_leave' | 'withdrawn' | 'graduated'
}

export interface Coach {
  id: string
  name: string
  email: string
  status: 'active' | 'inactive'
}

// ─── SKILLS FRAMEWORK ───────────────────────────────

export interface Pillar {
  id: string
  name: string
  description?: string
  displayOrder: number
}

export interface DurableSkill {
  id: string
  pillarId: string
  name: string
  description?: string
  displayOrder: number
  isActive: boolean
}

export interface Rubric {
  id: string
  skillId: string
  version: number
  externalDescriptors: string[]
  introjectedDescriptors: string[]
  identifiedDescriptors: string[]
  integratedDescriptors: string[]
  intrinsicDescriptors: string[]
  isCurrent: boolean
}

// ─── STUDENT WORK (Source Material) ─────────────────

export type WorkType =
  | 'essay'
  | 'project'
  | 'discussion_post'
  | 'presentation'
  | 'exam'
  | 'lab_report'
  | 'portfolio_piece'
  | 'other'

export type WorkSource = 'manual' | 'csv_import' | 'd2l_api' | 'reflection'

export interface StudentWork {
  id: string
  studentId: string
  title: string
  description?: string
  workType: WorkType
  courseName?: string
  courseCode?: string
  submittedAt: string // ISO datetime
  quarter: string
  weekNumber?: number
  content?: string
  grade?: string
  source?: WorkSource
  externalId?: string
  importedAt?: string
}

export interface WorkSkillTag {
  id: string
  workId: string
  skillId: string
  confidence: number
  rationale?: string
  source: 'llm_auto' | 'student_manual' | 'coach_manual'
  taggedAt: string
}

export interface WorkImportBatch {
  id: string
  studentId: string
  source: 'csv' | 'd2l_api'
  filename?: string
  totalItems: number
  processedItems: number
  status: 'pending' | 'processing' | 'completed' | 'failed'
  createdAt: string
  completedAt?: string
}

// ─── GROWTH CONVERSATION ────────────────────────────

export type ConversationStatus = 'in_progress' | 'completed' | 'abandoned'

export type ConversationType = 'work_based' | 'open_reflection'

export interface GrowthConversation {
  id: string
  studentId: string
  workId?: string
  quarter: string
  weekNumber?: number
  status: ConversationStatus
  conversationType?: ConversationType
  reflectionDescription?: string
  studentTaggedSkillId?: string
  startedAt: string // ISO datetime
  completedAt?: string
  durationSeconds?: number

  // The conversation arc (3 phases)
  workContext?: string
  promptPhase1?: string
  responsePhase1?: string
  promptPhase2?: string
  responsePhase2?: string
  promptPhase3?: string
  responsePhase3?: string

  // AI-generated synthesis
  synthesisText?: string
  suggestedInsight?: string

  // Skill tags (inline for JSON simplicity)
  skillTags: ConversationSkillTag[]
}

export interface ConversationSkillTag {
  skillId: string
  confidence: number // 0-1
  studentConfirmed: boolean
  rationale?: string
}

// ─── STUDENT SKILL DEFINITIONS ──────────────────────

export type DefinitionPrompt =
  | 'initial_onboarding'
  | 'quarterly_revision'
  | 'conversation_prompted'
  | 'self_initiated'

export interface StudentSkillDefinition {
  id: string
  studentId: string
  skillId: string
  definitionText: string
  personalExample?: string
  whyItMatters?: string
  version: number
  isCurrent: boolean
  promptedBy?: DefinitionPrompt
  createdAt: string // ISO datetime
}

// ─── ASSESSMENTS ────────────────────────────────────

export type SdtLevel = 'external' | 'introjected' | 'identified' | 'integrated' | 'intrinsic'
export type AssessorType = 'self' | 'coach'

export interface SkillAssessment {
  id: string
  studentId: string
  skillId: string
  assessorType: AssessorType
  assessorId?: string
  sdtLevel: SdtLevel
  rationale?: string
  confidence?: number // 1-5
  quarter: string
  assessedAt: string // ISO datetime
}

// ─── GOALS ──────────────────────────────────────────

export interface StudentGoal {
  id: string
  studentId: string
  goalText: string
  quarter: string
  status: 'active' | 'adjusted' | 'completed' | 'abandoned'
  progressNotes?: string
  outcomeReflection?: string
  carriedForward: boolean
  previousGoalId?: string
  createdAt: string // ISO datetime
}

// ─── COACH NOTES ────────────────────────────────────

export type ContactMethod = 'in_person' | 'video' | 'phone' | 'text' | 'email'

export interface CoachNote {
  id: string
  coachId: string
  studentId: string
  noteText: string
  brightSpot?: string
  nextStep?: string
  sessionDate: string // ISO date
  quarter: string
  contactMethod: ContactMethod
}

// ─── GARDEN VIEW TYPES ──────────────────────────────

export interface GardenPlant {
  skillId: string
  skillName: string
  pillarId: string
  pillarName: string
  sdtLevel: number // 1-4, from most recent coach assessment
  selfLevel: number | null
  currentDefinition: string | null
  previousDefinition: string | null
  definitionRevised: boolean
  conversationCount: number
  conversations: ConversationSummary[]
}

export interface ConversationSummary {
  id: string
  workTitle: string
  quarter: string
  date: string
  pullQuote: string
}

export interface GardenData {
  student: Student
  plants: GardenPlant[]
  totalConversations: number
  quartersActive: number
}

// ─── COACH DASHBOARD TYPES ──────────────────────────

export interface CoachDashboardData {
  coach: Coach
  students: CoachStudentSummary[]
  attentionItems: AttentionItem[]
}

export interface CoachStudentSummary {
  student: Student
  conversationsThisQuarter: number
  latestPullQuote: string | null
  latestConversationDate: string | null
  skillLevels: { skillId: string; skillName: string; sdtLevel: SdtLevel }[]
}

export interface AttentionItem {
  type: 'inactive' | 'assessment_gap' | 'language_shift'
  studentId: string
  studentName: string
  message: string
}

export interface SessionPrepData {
  student: Student
  recentConversations: GrowthConversation[]
  patterns: string[]
  currentGoals: StudentGoal[]
  lastNote: CoachNote | null
}
