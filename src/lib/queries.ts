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

// ─── SUPABASE HELPERS ──────────────────────────────

async function getSupabase() {
  // Dynamic import to avoid issues when supabase env vars aren't set (demo mode)
  const { createServerClient } = await import('./supabase-server')
  return createServerClient()
}

function snakeToCamel(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase())
    result[camelKey] = value
  }
  return result
}

// ─── STUDENT QUERIES ────────────────────────────────

export async function getStudent(studentId: string): Promise<Student | null> {
  if (isDemoMode) {
    return staticData.getStudent(studentId) ?? null
  }

  const supabase = await getSupabase()
  const { data } = await supabase
    .from('student')
    .select('*')
    .eq('id', studentId)
    .single()
  return data ? snakeToCamel(data) as unknown as Student : null
}

export async function getCurrentStudent(studentId?: string): Promise<Student | null> {
  if (isDemoMode) {
    return staticData.getStudent(studentId || 'stu_aja') ?? null
  }

  const supabase = await getSupabase()

  if (studentId) {
    const { data } = await supabase
      .from('student')
      .select('*')
      .eq('id', studentId)
      .single()
    return data ? snakeToCamel(data) as unknown as Student : null
  }

  // Get from auth session
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('student')
    .select('*')
    .eq('auth_user_id', user.id)
    .single()
  return data ? snakeToCamel(data) as unknown as Student : null
}

export async function getAllStudents(): Promise<Student[]> {
  if (isDemoMode) return staticData.students

  const supabase = await getSupabase()
  const { data } = await supabase.from('student').select('*')
  return (data || []).map(s => snakeToCamel(s) as unknown as Student)
}

export async function getAllCoaches(): Promise<Coach[]> {
  if (isDemoMode) return staticData.coaches

  const supabase = await getSupabase()
  const { data } = await supabase.from('coach').select('*')
  return (data || []).map(c => snakeToCamel(c) as unknown as Coach)
}

export async function getCurrentCoach(coachId?: string): Promise<Coach | null> {
  if (isDemoMode) {
    return staticData.getCoach(coachId || 'coach_elizabeth') ?? null
  }

  const supabase = await getSupabase()

  if (coachId) {
    const { data } = await supabase
      .from('coach')
      .select('*')
      .eq('id', coachId)
      .single()
    return data ? snakeToCamel(data) as unknown as Coach : null
  }

  // Get from auth session
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('coach')
    .select('*')
    .eq('auth_user_id', user.id)
    .single()
  return data ? snakeToCamel(data) as unknown as Coach : null
}

// ─── GARDEN DATA ────────────────────────────────────

export async function getGardenData(studentId: string): Promise<GardenData> {
  if (isDemoMode) {
    return buildGardenDataFromStatic(studentId)
  }

  const supabase = await getSupabase()

  // Fetch student
  const { data: studentRow } = await supabase
    .from('student')
    .select('*')
    .eq('id', studentId)
    .single()
  if (!studentRow) throw new Error(`Student not found: ${studentId}`)
  const student = snakeToCamel(studentRow) as unknown as Student

  // Fetch all active skills with pillars
  const { data: skillRows } = await supabase
    .from('durable_skill')
    .select('*, pillar(*)')
    .eq('is_active', true)
    .order('display_order')

  // Fetch conversations
  const { data: convoRows } = await supabase
    .from('growth_conversation')
    .select('*, conversation_skill_tag(*), student_work(title)')
    .eq('student_id', studentId)
    .eq('status', 'completed')
    .order('started_at', { ascending: true })

  // Fetch assessments
  const { data: assessmentRows } = await supabase
    .from('skill_assessment')
    .select('*')
    .eq('student_id', studentId)
    .order('assessed_at', { ascending: false })

  // Fetch definitions
  const { data: definitionRows } = await supabase
    .from('student_skill_definition')
    .select('*')
    .eq('student_id', studentId)
    .order('version', { ascending: false })

  const conversations = (convoRows || []).map(c => snakeToCamel(c) as unknown as GrowthConversation & { studentWork?: { title: string } })
  const assessments = (assessmentRows || []).map(a => snakeToCamel(a) as unknown as { skillId: string; assessorType: string; sdtLevel: SdtLevel })
  const definitions = (definitionRows || []).map(d => snakeToCamel(d) as unknown as { skillId: string; definitionText: string; isCurrent: boolean; id: string })

  const plants: GardenPlant[] = (skillRows || []).map((skillRow: Record<string, unknown>) => {
    const skill = snakeToCamel(skillRow) as unknown as { id: string; name: string; pillarId: string }
    const pillarData = skillRow.pillar as Record<string, unknown> | null
    const pillarName = pillarData ? (pillarData.name as string) : 'Unknown'

    const coachAssessment = assessments.find(a => a.skillId === skill.id && a.assessorType === 'coach')
    const selfAssessment = assessments.find(a => a.skillId === skill.id && a.assessorType === 'self')

    const currentDef = definitions.find(d => d.skillId === skill.id && d.isCurrent)
    const previousDef = definitions.find(d => d.skillId === skill.id && !d.isCurrent)

    const skillConvos = conversations.filter(c =>
      (c as unknown as { skillTags?: { skillId: string }[] }).skillTags?.some(
        (t: { skillId: string }) => t.skillId === skill.id
      )
    )

    const convoSummaries: ConversationSummary[] = skillConvos.map(c => ({
      id: c.id,
      workTitle: (c as unknown as { studentWork?: { title: string } }).studentWork?.title || 'Reflection',
      quarter: c.quarter,
      date: c.startedAt,
      pullQuote: extractPullQuote(c),
    }))

    return {
      skillId: skill.id,
      skillName: skill.name,
      pillarId: skill.pillarId,
      pillarName,
      sdtLevel: coachAssessment ? SDT_LEVEL_MAP[coachAssessment.sdtLevel] : 1,
      selfLevel: selfAssessment ? SDT_LEVEL_MAP[selfAssessment.sdtLevel] : null,
      currentDefinition: currentDef?.definitionText ?? null,
      previousDefinition: previousDef?.definitionText ?? null,
      definitionRevised: !!previousDef && !!currentDef,
      conversationCount: skillConvos.length,
      conversations: convoSummaries,
    }
  })

  const quarters = new Set(conversations.map(c => c.quarter))

  return {
    student,
    plants,
    totalConversations: conversations.length,
    quartersActive: quarters.size,
  }
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
  const phase2 = conversation.responsePhase2 || ''
  const phase3 = conversation.responsePhase3 || ''

  const candidates = [...phase2.split('.'), ...phase3.split('.')]
    .map(s => s.trim())
    .filter(s => s.length > 20 && s.length < 120)

  if (candidates.length > 0) {
    return candidates[0]
  }

  return conversation.suggestedInsight || 'No pull quote available'
}

// ─── CONVERSATION QUERIES ───────────────────────────

export async function getConversation(id: string): Promise<GrowthConversation | null> {
  if (isDemoMode) return staticData.getConversation(id) ?? null

  const supabase = await getSupabase()
  const { data } = await supabase
    .from('growth_conversation')
    .select('*, conversation_skill_tag(*)')
    .eq('id', id)
    .single()

  if (!data) return null

  const conv = snakeToCamel(data) as unknown as GrowthConversation
  conv.skillTags = (data.conversation_skill_tag || []).map(
    (t: Record<string, unknown>) => snakeToCamel(t)
  )
  return conv
}

export async function getStudentConversations(studentId: string): Promise<GrowthConversation[]> {
  if (isDemoMode) return staticData.getStudentConversations(studentId)

  const supabase = await getSupabase()
  const { data } = await supabase
    .from('growth_conversation')
    .select('*, conversation_skill_tag(*)')
    .eq('student_id', studentId)
    .eq('status', 'completed')
    .order('started_at', { ascending: true })

  return (data || []).map(row => {
    const conv = snakeToCamel(row) as unknown as GrowthConversation
    conv.skillTags = (row.conversation_skill_tag || []).map(
      (t: Record<string, unknown>) => snakeToCamel(t)
    )
    return conv
  })
}

export async function getConversationsForSkill(
  studentId: string,
  skillId: string
): Promise<GrowthConversation[]> {
  if (isDemoMode) return staticData.getConversationsForSkill(studentId, skillId)

  const supabase = await getSupabase()
  const { data } = await supabase
    .from('growth_conversation')
    .select('*, conversation_skill_tag!inner(*)')
    .eq('student_id', studentId)
    .eq('status', 'completed')
    .eq('conversation_skill_tag.skill_id', skillId)
    .order('started_at', { ascending: true })

  return (data || []).map(row => {
    const conv = snakeToCamel(row) as unknown as GrowthConversation
    conv.skillTags = (row.conversation_skill_tag || []).map(
      (t: Record<string, unknown>) => snakeToCamel(t)
    )
    return conv
  })
}

export async function getAllStudentConversations(studentId: string): Promise<GrowthConversation[]> {
  if (isDemoMode) return staticData.getStudentConversations(studentId)

  const supabase = await getSupabase()
  const { data } = await supabase
    .from('growth_conversation')
    .select('*, conversation_skill_tag(*), student_work(title)')
    .eq('student_id', studentId)
    .in('status', ['in_progress', 'completed'])
    .order('started_at', { ascending: false })

  return (data || []).map(row => {
    const conv = snakeToCamel(row) as unknown as GrowthConversation
    conv.skillTags = (row.conversation_skill_tag || []).map(
      (t: Record<string, unknown>) => snakeToCamel(t)
    )
    // Attach work title
    if (row.student_work) {
      (conv as unknown as Record<string, unknown>).workTitle = (row.student_work as Record<string, unknown>).title
    }
    return conv
  })
}

// ─── WORK QUERIES ───────────────────────────────────

export async function getAvailableWork(studentId: string): Promise<StudentWork[]> {
  if (isDemoMode) return staticData.getAvailableWork(studentId)

  const supabase = await getSupabase()

  // Get all work for student
  const { data: allWork } = await supabase
    .from('student_work')
    .select('*')
    .eq('student_id', studentId)
    .order('submitted_at', { ascending: false })

  // Get work IDs that already have conversations
  const { data: convos } = await supabase
    .from('growth_conversation')
    .select('work_id')
    .eq('student_id', studentId)
    .in('status', ['completed', 'in_progress'])

  const reflectedWorkIds = new Set((convos || []).map(c => c.work_id).filter(Boolean))

  return (allWork || [])
    .filter(w => !reflectedWorkIds.has(w.id))
    .map(w => snakeToCamel(w) as unknown as StudentWork)
}

// ─── COACH QUERIES ──────────────────────────────────

export async function getCoachDashboard(coachId: string): Promise<CoachDashboardData> {
  if (isDemoMode) return buildCoachDashboardFromStatic(coachId)

  const supabase = await getSupabase()

  // Get coach
  const { data: coachRow } = await supabase
    .from('coach')
    .select('*')
    .eq('id', coachId)
    .single()
  if (!coachRow) throw new Error(`Coach not found: ${coachId}`)
  const coach = snakeToCamel(coachRow) as unknown as Coach

  // Get assigned students
  const { data: studentRows } = await supabase
    .from('student')
    .select('*')
    .eq('coach_id', coachId)

  const students = (studentRows || []).map(s => snakeToCamel(s) as unknown as Student)

  // Get active skills
  const { data: skillRows } = await supabase
    .from('durable_skill')
    .select('*')
    .eq('is_active', true)
    .order('display_order')
  const activeSkills = (skillRows || []).map(s => snakeToCamel(s) as unknown as { id: string; name: string })

  const studentSummaries: CoachStudentSummary[] = await Promise.all(
    students.map(async (student) => {
      const { data: convoRows } = await supabase
        .from('growth_conversation')
        .select('*')
        .eq('student_id', student.id)
        .eq('status', 'completed')
        .order('started_at', { ascending: true })

      const convos = (convoRows || []).map(c => snakeToCamel(c) as unknown as GrowthConversation)

      const now = new Date()
      const quarterStr = `${now.getMonth() < 3 ? 'Winter' : now.getMonth() < 6 ? 'Spring' : now.getMonth() < 9 ? 'Summer' : 'Fall'} ${now.getFullYear()}`
      const thisQuarterConvos = convos.filter(c => c.quarter === quarterStr)
      const latestConvo = convos[convos.length - 1]

      const { data: assessmentRows } = await supabase
        .from('skill_assessment')
        .select('*')
        .eq('student_id', student.id)
        .eq('assessor_type', 'coach')
        .order('assessed_at', { ascending: false })

      const assessments = (assessmentRows || []).map(a => snakeToCamel(a) as unknown as { skillId: string; sdtLevel: SdtLevel })

      const skillLevels = activeSkills.map(skill => {
        const assessment = assessments.find(a => a.skillId === skill.id)
        return {
          skillId: skill.id,
          skillName: skill.name,
          sdtLevel: (assessment?.sdtLevel || 'external') as SdtLevel,
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
  )

  const attentionItems = buildAttentionItemsFromSummaries(studentSummaries)

  return { coach, students: studentSummaries, attentionItems }
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
        sdtLevel: (assessment?.sdtLevel || 'external') as SdtLevel,
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

  return { coach, students: studentSummaries, attentionItems }
}

function buildAttentionItems(students: Student[]): AttentionItem[] {
  const items: AttentionItem[] = []
  const now = new Date()
  const threeWeeksAgo = new Date(now.getTime() - 21 * 24 * 60 * 60 * 1000)

  for (const student of students) {
    const convos = staticData.getStudentConversations(student.id)
    const latestConvo = convos[convos.length - 1]

    if (!latestConvo || new Date(latestConvo.startedAt) < threeWeeksAgo) {
      items.push({
        type: 'inactive',
        studentId: student.id,
        studentName: `${student.firstName} ${student.lastName}`,
        message: `${student.firstName} hasn't had a conversation in 3+ weeks.`,
      })
    }

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

function buildAttentionItemsFromSummaries(summaries: CoachStudentSummary[]): AttentionItem[] {
  const items: AttentionItem[] = []
  const now = new Date()
  const threeWeeksAgo = new Date(now.getTime() - 21 * 24 * 60 * 60 * 1000)

  for (const summary of summaries) {
    if (!summary.latestConversationDate || new Date(summary.latestConversationDate) < threeWeeksAgo) {
      items.push({
        type: 'inactive',
        studentId: summary.student.id,
        studentName: `${summary.student.firstName} ${summary.student.lastName}`,
        message: `${summary.student.firstName} hasn't had a conversation in 3+ weeks.`,
      })
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

  const supabase = await getSupabase()

  const { data: studentRow } = await supabase
    .from('student')
    .select('*')
    .eq('id', studentId)
    .single()
  if (!studentRow) throw new Error(`Student not found: ${studentId}`)
  const student = snakeToCamel(studentRow) as unknown as Student

  const { data: convoRows } = await supabase
    .from('growth_conversation')
    .select('*, conversation_skill_tag(*)')
    .eq('student_id', studentId)
    .eq('status', 'completed')
    .order('started_at', { ascending: false })
    .limit(3)

  const recentConversations = (convoRows || []).map(row => {
    const conv = snakeToCamel(row) as unknown as GrowthConversation
    conv.skillTags = (row.conversation_skill_tag || []).map(
      (t: Record<string, unknown>) => snakeToCamel(t)
    )
    return conv
  }).reverse()

  const { data: goalRows } = await supabase
    .from('student_goal')
    .select('*')
    .eq('student_id', studentId)
    .eq('status', 'active')

  const currentGoals = (goalRows || []).map(g => snakeToCamel(g) as unknown as SessionPrepData['currentGoals'][0])

  const { data: noteRows } = await supabase
    .from('coach_note')
    .select('*')
    .eq('coach_id', coachId)
    .eq('student_id', studentId)
    .order('session_date', { ascending: false })
    .limit(1)

  const lastNote = noteRows && noteRows[0]
    ? snakeToCamel(noteRows[0]) as unknown as SessionPrepData['lastNote']
    : null

  // Build patterns from definitions
  const patterns: string[] = []
  const { data: defRows } = await supabase
    .from('student_skill_definition')
    .select('*')
    .eq('student_id', studentId)
    .order('version', { ascending: false })

  const defs = (defRows || []).map(d => snakeToCamel(d) as unknown as { skillId: string; definitionText: string; isCurrent: boolean })

  // Check for definition shifts
  const { data: activeSkillRows } = await supabase
    .from('durable_skill')
    .select('*')
    .eq('is_active', true)

  for (const skillRow of (activeSkillRows || [])) {
    const skill = snakeToCamel(skillRow) as unknown as { id: string; name: string }
    const currentDef = defs.find(d => d.skillId === skill.id && d.isCurrent)
    const previousDef = defs.find(d => d.skillId === skill.id && !d.isCurrent)
    if (currentDef && previousDef) {
      patterns.push(
        `${student.firstName}'s ${skill.name} language has shifted from "${previousDef.definitionText.substring(0, 50)}..." to "${currentDef.definitionText.substring(0, 50)}..."`
      )
    }
  }

  return { student, recentConversations, patterns, currentGoals, lastNote }
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

  const patterns: string[] = []

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

  for (const skill of activeSkills) {
    const coachAssess = staticData.getLatestCoachAssessment(studentId, skill.id)
    const selfAssess = staticData.getLatestSelfAssessment(studentId, skill.id)
    if (coachAssess && selfAssess && coachAssess.sdtLevel !== selfAssess.sdtLevel) {
      patterns.push(
        `Assessment gap for ${skill.name}: Self=${selfAssess.sdtLevel}, Coach=${coachAssess.sdtLevel}. Worth surfacing gently.`
      )
    }
  }

  const thisQuarterConvos = allConvos.filter(c => c.quarter === 'Spring 2026')
  if (thisQuarterConvos.length >= 3) {
    patterns.push(
      `${student.firstName} has completed ${thisQuarterConvos.length} conversations this quarter — strong engagement.`
    )
  }

  return { student, recentConversations, patterns, currentGoals, lastNote }
}
