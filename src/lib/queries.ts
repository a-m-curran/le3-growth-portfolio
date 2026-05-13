import { SDT_LEVEL_MAP } from './constants'
import { createAdminClient } from './supabase-admin'
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
  SyncRun,
} from './types'

// ─── SUPABASE HELPERS ──────────────────────────────

/**
 * User-session-aware client. Use ONLY in functions that fall back
 * to `auth.getUser()` (getCurrentStudent / getCurrentCoach in their
 * "no id provided" branch). RLS will gate what these can see based
 * on the real authenticated user — fine for real auth, blocks
 * everything for demo personas (which don't have a real session).
 */
async function getSupabase() {
  const { createServerClient } = await import('./supabase-server')
  return createServerClient()
}

/**
 * Admin client (service role, bypasses RLS). Use for queries that
 * take an explicit id — caller is responsible for authorization
 * upstream (typically via getV2StudentId / getV2CoachId in v2 routes
 * or the appropriate caseload check). Required for the demo-persona
 * path since demo personas have no real auth session and RLS would
 * otherwise block their queries.
 */
function getAdmin() {
  return createAdminClient()
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
  const admin = getAdmin()
  const { data } = await admin
    .from('student')
    .select('*')
    .eq('id', studentId)
    .single()
  return data ? snakeToCamel(data) as unknown as Student : null
}

export async function getCurrentStudent(studentId?: string): Promise<Student | null> {
  const admin = getAdmin()

  if (studentId) {
    const { data } = await admin
      .from('student')
      .select('*')
      .eq('id', studentId)
      .single()
    return data ? snakeToCamel(data) as unknown as Student : null
  }

  // Fall back to real Supabase auth session — read the auth_user_id
  // from the session (user-session client), then look up the student
  // row via admin so it works regardless of RLS.
  const supabase = await getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await admin
    .from('student')
    .select('*')
    .eq('auth_user_id', user.id)
    .single()
  return data ? snakeToCamel(data) as unknown as Student : null
}

export async function getAllStudents(): Promise<Student[]> {
  const admin = getAdmin()
  const { data } = await admin.from('student').select('*').eq('is_demo', false)
  return (data || []).map(s => snakeToCamel(s) as unknown as Student)
}

export async function getAllCoaches(): Promise<Coach[]> {
  const admin = getAdmin()
  const { data } = await admin.from('coach').select('*').eq('is_demo', false)
  return (data || []).map(c => snakeToCamel(c) as unknown as Coach)
}

export async function getCurrentCoach(coachId?: string): Promise<Coach | null> {
  const admin = getAdmin()

  if (coachId) {
    const { data } = await admin
      .from('coach')
      .select('*')
      .eq('id', coachId)
      .single()
    return data ? snakeToCamel(data) as unknown as Coach : null
  }

  // Fall back to real Supabase auth — same shape as getCurrentStudent.
  const supabase = await getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await admin
    .from('coach')
    .select('*')
    .eq('auth_user_id', user.id)
    .single()
  return data ? snakeToCamel(data) as unknown as Coach : null
}

// ─── GARDEN DATA ────────────────────────────────────

export async function getGardenData(studentId: string): Promise<GardenData> {
  // Admin client bypasses RLS. Authorization for who can see whose
  // garden data happens at the route layer (via getV2StudentId or
  // getCurrentCoach + their caseload check) — by the time we get
  // here we've already decided this caller can see this studentId.
  // Using the user-session client would fail for demo personas (no
  // real auth) and for cross-student access by coaches.
  const supabase = createAdminClient()

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

// Removed: buildGardenDataFromStatic, buildCoachDashboardFromStatic,
// buildSessionPrepFromStatic, buildAttentionItems. Demo personas
// now live in the DB with is_demo=true and flow through the same
// real-DB query paths. extractPullQuote is kept since it's still
// used by the DB-mode paths.

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

  const supabase = getAdmin()
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

  const supabase = getAdmin()
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

  const supabase = getAdmin()
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

  const supabase = getAdmin()
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

// ─── SKILL COVERAGE ─────────────────────────────────

export async function getSkillCoverage(studentId: string): Promise<import('./types').SkillCoverageData[]> {
  const supabase = getAdmin()

  // Get all active skills with pillars
  const { data: skillRows } = await supabase
    .from('durable_skill')
    .select('id, name, pillar_id, pillar:pillar_id(name)')
    .eq('is_active', true)
    .order('display_order')

  // Get tagged assignment counts per skill
  const { data: tagCounts } = await supabase
    .from('work_skill_tag')
    .select('skill_id, work_id, student_work!inner(student_id)')
    .eq('student_work.student_id', studentId)

  // Get completed conversation counts per skill
  const { data: convoCounts } = await supabase
    .from('conversation_skill_tag')
    .select('skill_id, growth_conversation!inner(student_id, status)')
    .eq('growth_conversation.student_id', studentId)
    .eq('growth_conversation.status', 'completed')

  // Count per skill
  const tagCountMap = new Map<string, number>()
  for (const t of (tagCounts || [])) {
    tagCountMap.set(t.skill_id, (tagCountMap.get(t.skill_id) || 0) + 1)
  }

  const convoCountMap = new Map<string, number>()
  for (const c of (convoCounts || [])) {
    convoCountMap.set(c.skill_id, (convoCountMap.get(c.skill_id) || 0) + 1)
  }

  return (skillRows || []).map((row: Record<string, unknown>) => {
    const skillId = row.id as string
    const tagged = tagCountMap.get(skillId) || 0
    const completed = convoCountMap.get(skillId) || 0
    return {
      skillId,
      skillName: row.name as string,
      pillarId: row.pillar_id as string,
      pillarName: ((row.pillar as Record<string, unknown>)?.name as string) || '',
      taggedAssignments: tagged,
      completedConversations: completed,
      coverageRatio: tagged > 0 ? completed / tagged : 0,
    }
  })
}

// ─── WORK WITH SKILL TAGS ───────────────────────────

export async function getAvailableWorkWithTags(studentId: string): Promise<(import('./types').StudentWork & { skillTags: { skillId: string; skillName: string }[] })[]> {
  const supabase = getAdmin()

  const { data: allWork } = await supabase
    .from('student_work')
    .select('*, work_skill_tag(skill_id, durable_skill(name))')
    .eq('student_id', studentId)
    .order('submitted_at', { ascending: false })

  const { data: convos } = await supabase
    .from('growth_conversation')
    .select('work_id')
    .eq('student_id', studentId)
    .in('status', ['completed', 'in_progress'])

  const reflectedWorkIds = new Set((convos || []).map(c => c.work_id).filter(Boolean))

  return (allWork || [])
    .filter(w => !reflectedWorkIds.has(w.id))
    .map(w => {
      const work = snakeToCamel(w) as unknown as import('./types').StudentWork
      const tags = (w.work_skill_tag || []).map((t: Record<string, unknown>) => ({
        skillId: t.skill_id as string,
        skillName: ((t.durable_skill as Record<string, unknown>)?.name as string) || '',
      }))
      return { ...work, skillTags: tags }
    })
}

// ─── WORK QUERIES ───────────────────────────────────

export async function getAvailableWork(studentId: string): Promise<StudentWork[]> {

  const supabase = getAdmin()

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

  const supabase = getAdmin()

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

  const supabase = getAdmin()

  const { data: studentRow } = await supabase
    .from('student')
    .select('*')
    .eq('id', studentId)
    .single()
  if (!studentRow) throw new Error(`Student not found: ${studentId}`)
  const student = snakeToCamel(studentRow) as unknown as Student

  const { data: convoRows } = await supabase
    .from('growth_conversation')
    .select('*, conversation_skill_tag(*), student_work(title)')
    .eq('student_id', studentId)
    .eq('status', 'completed')
    .order('started_at', { ascending: false })
    .limit(3)

  const recentConversations = (convoRows || []).map(row => {
    const conv = snakeToCamel(row) as unknown as GrowthConversation & {
      workTitle?: string | null
    }
    conv.skillTags = (row.conversation_skill_tag || []).map(
      (t: Record<string, unknown>) => snakeToCamel(t)
    )
    // Pull joined work title onto the conversation for Prep card display
    const work = (row as { student_work?: { title: string } | null }).student_work
    conv.workTitle = work?.title ?? null
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
        `${student.firstName}'s ${skill.name} language has shifted from "${previousDef.definitionText}" to "${currentDef.definitionText}"`
      )
    }
  }

  return { student, recentConversations, patterns, currentGoals, lastNote }
}

// ─── SYNC OBSERVABILITY ─────────────────────────────

/**
 * Get the most recent sync_run rows, newest first. Used by the coach
 * dashboard's sync status panel to show "last sync was X minutes ago,
 * synced Y submissions, Z errors."
 *
 * Safe to call in demo mode — returns an empty array.
 */
export async function getRecentSyncRuns(limit: number = 5): Promise<SyncRun[]> {

  const supabase = getAdmin()
  const { data, error } = await supabase
    .from('sync_run')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('getRecentSyncRuns error:', error)
    return []
  }

  return (data || []).map(row => snakeToCamel(row) as unknown as SyncRun)
}

/**
 * Get the most recent successfully-completed sync_run row, or null if
 * there has never been one. Used by the dashboard to show "last
 * successful sync N minutes ago" regardless of how many failed attempts
 * have happened since.
 */
export async function getLastSuccessfulSyncRun(): Promise<SyncRun | null> {

  const supabase = getAdmin()
  const { data } = await supabase
    .from('sync_run')
    .select('*')
    .eq('status', 'completed')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return data ? (snakeToCamel(data) as unknown as SyncRun) : null
}
