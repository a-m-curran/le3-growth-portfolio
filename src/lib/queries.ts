import * as staticData from '@/data'
import { skills, pillars } from '@/data'
import { SDT_LEVEL_MAP } from './constants'
import type {
  Student,
  Coach,
  GrowthConversation,
  GardenData,
  GardenPlant,
  ConversationSummary,
  CoachDashboardData,
  CoachStudentSummary,
  AttentionItem,
  SessionPrepData,
  StudentWork,
  SdtLevel,
} from './types'

const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

// ─── STUDENT QUERIES ────────────────────────────────

export async function getStudent(studentId: string): Promise<Student | null> {
  if (isDemoMode) {
    return staticData.getStudent(studentId) ?? null
  }
  // MVP: Supabase query
  return null
}

export async function getCurrentStudent(studentId?: string): Promise<Student | null> {
  if (isDemoMode) {
    return staticData.getStudent(studentId || 'stu_aja') ?? null
  }
  // MVP: get from auth session
  return null
}

export async function getAllStudents(): Promise<Student[]> {
  if (isDemoMode) return staticData.students
  return []
}

export async function getAllCoaches(): Promise<Coach[]> {
  if (isDemoMode) return staticData.coaches
  return []
}

// ─── GARDEN DATA ────────────────────────────────────

export async function getGardenData(studentId: string): Promise<GardenData> {
  if (isDemoMode) {
    return buildGardenDataFromStatic(studentId)
  }
  // MVP: Supabase queries
  return buildGardenDataFromStatic(studentId)
}

function buildGardenDataFromStatic(studentId: string): GardenData {
  const student = staticData.getStudent(studentId)
  if (!student) throw new Error(`Student not found: ${studentId}`)

  const studentConversations = staticData.getStudentConversations(studentId)
  const activeSkills = skills.filter(s => s.isActive)

  const plants: GardenPlant[] = activeSkills.map(skill => {
    const pillar = pillars.find(p => p.id === skill.pillarId)!
    const coachAssessment = staticData.getLatestCoachAssessment(studentId, skill.id)
    const selfAssessment = staticData.getLatestSelfAssessment(studentId, skill.id)
    const currentDef = staticData.getCurrentDefinition(studentId, skill.id)
    const previousDef = staticData.getPreviousDefinition(studentId, skill.id)
    const skillConversations = staticData.getConversationsForSkill(studentId, skill.id)

    const conversations: ConversationSummary[] = skillConversations.map(c => {
      const work = c.workId ? staticData.getStudentWork(c.workId) : null
      return {
        id: c.id,
        workTitle: work?.title || 'Reflection',
        quarter: c.quarter,
        date: c.startedAt,
        pullQuote: extractPullQuote(c),
      }
    })

    return {
      skillId: skill.id,
      skillName: skill.name,
      pillarId: skill.pillarId,
      pillarName: pillar.name,
      sdtLevel: coachAssessment ? SDT_LEVEL_MAP[coachAssessment.sdtLevel] : 1,
      selfLevel: selfAssessment ? SDT_LEVEL_MAP[selfAssessment.sdtLevel] : null,
      currentDefinition: currentDef?.definitionText ?? null,
      previousDefinition: previousDef?.definitionText ?? null,
      definitionRevised: !!previousDef && !!currentDef,
      conversationCount: skillConversations.length,
      conversations,
    }
  })

  const quarters = new Set(studentConversations.map(c => c.quarter))

  return {
    student,
    plants,
    totalConversations: studentConversations.length,
    quartersActive: quarters.size,
  }
}

function extractPullQuote(conversation: GrowthConversation): string {
  // Use the most revealing part of Phase 2 or Phase 3 response
  const phase2 = conversation.responsePhase2 || ''
  const phase3 = conversation.responsePhase3 || ''

  // Find a short, quotable sentence
  const candidates = [...phase2.split('.'), ...phase3.split('.')]
    .map(s => s.trim())
    .filter(s => s.length > 20 && s.length < 120)

  if (candidates.length > 0) {
    return candidates[0]
  }

  // Fallback to suggested insight
  return conversation.suggestedInsight || 'No pull quote available'
}

// ─── CONVERSATION QUERIES ───────────────────────────

export async function getConversation(id: string): Promise<GrowthConversation | null> {
  if (isDemoMode) return staticData.getConversation(id) ?? null
  return null
}

export async function getStudentConversations(studentId: string): Promise<GrowthConversation[]> {
  if (isDemoMode) return staticData.getStudentConversations(studentId)
  return []
}

export async function getConversationsForSkill(
  studentId: string,
  skillId: string
): Promise<GrowthConversation[]> {
  if (isDemoMode) return staticData.getConversationsForSkill(studentId, skillId)
  return []
}

// ─── WORK QUERIES ───────────────────────────────────

export async function getAvailableWork(studentId: string): Promise<StudentWork[]> {
  if (isDemoMode) return staticData.getAvailableWork(studentId)
  return []
}

// ─── COACH QUERIES ──────────────────────────────────

export async function getCoachDashboard(coachId: string): Promise<CoachDashboardData> {
  if (isDemoMode) return buildCoachDashboardFromStatic(coachId)
  return buildCoachDashboardFromStatic(coachId)
}

function buildCoachDashboardFromStatic(coachId: string): CoachDashboardData {
  const coach = staticData.getCoach(coachId)
  if (!coach) throw new Error(`Coach not found: ${coachId}`)

  const coachStudents = staticData.getStudentsByCoach(coachId)
  const activeSkills = skills.filter(s => s.isActive)

  const studentSummaries: CoachStudentSummary[] = coachStudents.map(student => {
    const studentConvos = staticData.getStudentConversations(student.id)
    const thisQuarterConvos = studentConvos.filter(c => c.quarter === 'Spring 2026')
    const latestConvo = studentConvos[studentConvos.length - 1]

    const skillLevels = activeSkills.map(skill => {
      const assessment = staticData.getLatestCoachAssessment(student.id, skill.id)
      return {
        skillId: skill.id,
        skillName: skill.name,
        sdtLevel: (assessment?.sdtLevel || 'noticing') as SdtLevel,
      }
    })

    return {
      student,
      conversationsThisQuarter: thisQuarterConvos.length,
      latestPullQuote: latestConvo ? extractPullQuote(latestConvo) : null,
      latestConversationDate: latestConvo?.startedAt ?? null,
      skillLevels,
    }
  })

  const attentionItems = buildAttentionItems(coachStudents)

  return {
    coach,
    students: studentSummaries,
    attentionItems,
  }
}

function buildAttentionItems(students: Student[]): AttentionItem[] {
  const items: AttentionItem[] = []
  const now = new Date()
  const threeWeeksAgo = new Date(now.getTime() - 21 * 24 * 60 * 60 * 1000)

  for (const student of students) {
    const convos = staticData.getStudentConversations(student.id)
    const latestConvo = convos[convos.length - 1]

    // Inactive check
    if (!latestConvo || new Date(latestConvo.startedAt) < threeWeeksAgo) {
      items.push({
        type: 'inactive',
        studentId: student.id,
        studentName: `${student.firstName} ${student.lastName}`,
        message: `${student.firstName} hasn't had a conversation in 3+ weeks.`,
      })
    }

    // Assessment gap check
    const activeSkills = skills.filter(s => s.isActive)
    for (const skill of activeSkills) {
      const coachAssess = staticData.getLatestCoachAssessment(student.id, skill.id)
      const selfAssess = staticData.getLatestSelfAssessment(student.id, skill.id)

      if (coachAssess && selfAssess) {
        const coachLevel = SDT_LEVEL_MAP[coachAssess.sdtLevel]
        const selfLevel = SDT_LEVEL_MAP[selfAssess.sdtLevel]

        if (Math.abs(coachLevel - selfLevel) >= 2) {
          items.push({
            type: 'assessment_gap',
            studentId: student.id,
            studentName: `${student.firstName} ${student.lastName}`,
            message: `${student.firstName}'s self-assessment for ${skill.name} is ${Math.abs(coachLevel - selfLevel)} levels ${selfLevel < coachLevel ? 'below' : 'above'} your assessment. Worth discussing.`,
          })
        }
      }
    }
  }

  return items
}

// ─── SESSION PREP ───────────────────────────────────

export async function getSessionPrep(
  coachId: string,
  studentId: string
): Promise<SessionPrepData> {
  if (isDemoMode) return buildSessionPrepFromStatic(coachId, studentId)
  return buildSessionPrepFromStatic(coachId, studentId)
}

function buildSessionPrepFromStatic(coachId: string, studentId: string): SessionPrepData {
  const student = staticData.getStudent(studentId)
  if (!student) throw new Error(`Student not found: ${studentId}`)

  const allConvos = staticData.getStudentConversations(studentId)
  const recentConversations = allConvos.slice(-3)

  const notes = staticData.getCoachNotes(coachId, studentId)
  const lastNote = notes[0] ?? null

  const currentGoals = staticData
    .getStudentGoals(studentId)
    .filter(g => g.status === 'active')

  // Build pattern observations
  const patterns: string[] = []

  // Check for definition shifts
  const activeSkills = skills.filter(s => s.isActive)
  for (const skill of activeSkills) {
    const prev = staticData.getPreviousDefinition(studentId, skill.id)
    const curr = staticData.getCurrentDefinition(studentId, skill.id)
    if (prev && curr && prev.id !== curr.id) {
      patterns.push(
        `${student.firstName}'s ${skill.name} language has shifted from "${prev.definitionText.substring(0, 50)}..." to "${curr.definitionText.substring(0, 50)}..."`
      )
    }
  }

  // Check for assessment gaps
  for (const skill of activeSkills) {
    const coachAssess = staticData.getLatestCoachAssessment(studentId, skill.id)
    const selfAssess = staticData.getLatestSelfAssessment(studentId, skill.id)
    if (coachAssess && selfAssess && coachAssess.sdtLevel !== selfAssess.sdtLevel) {
      patterns.push(
        `Assessment gap for ${skill.name}: Self=${selfAssess.sdtLevel}, Coach=${coachAssess.sdtLevel}. Worth surfacing gently.`
      )
    }
  }

  // Conversation count
  const thisQuarterConvos = allConvos.filter(c => c.quarter === 'Spring 2026')
  if (thisQuarterConvos.length >= 3) {
    patterns.push(
      `${student.firstName} has completed ${thisQuarterConvos.length} conversations this quarter — strong engagement.`
    )
  }

  return {
    student,
    recentConversations,
    patterns,
    currentGoals,
    lastNote,
  }
}
