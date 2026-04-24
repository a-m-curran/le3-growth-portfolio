/**
 * Mock Valence API for integration testing.
 *
 * Replaces global.fetch with a URL-pattern dispatcher that serves a
 * realistic fake pilot cohort. Used by scripts/test-sync-engine.ts to
 * run the full sync engine end-to-end against in-memory data before
 * NLU's real Valence credentials arrive.
 *
 * Every endpoint our D2L client actually hits is mocked here:
 *   - OAuth2 client credentials token exchange
 *   - Org structure descendants (course discovery)
 *   - Classlist (enrollments + roles)
 *   - Dropbox folders (assignments)
 *   - Dropbox folder submissions (per-student submission state)
 *   - Individual submission file download
 *
 * Any URL that doesn't match a known pattern will throw, so the test
 * will catch any accidental real HTTP call.
 *
 * Install with `installMockValence()` before calling runLe3Sync().
 * Uninstall with `uninstallMockValence()` to restore real fetch.
 *
 * All mock data uses deterministic IDs and an `d2l:mock:` external_id
 * prefix so the test cleanup step can target it precisely.
 */

// ─── DATASET ────────────────────────────────────────

const LE3_ORG_UNIT_ID = '1001'

interface MockCourse {
  id: string
  name: string
  code: string
}

interface MockUser {
  id: string
  firstName: string
  lastName: string
  email: string
  orgDefinedId: string | null
  roleId: number // 110 = student, 117 = instructor
}

interface MockFolder {
  id: string
  name: string
  instructions: string
  dueDate: string | null
}

interface MockSubmissionFile {
  fileId: string
  fileName: string
  content: string // plain text — served as text/plain .txt to the extractor
}

interface MockSubmission {
  id: string
  folderId: string
  userId: string
  submittedAt: string
  files: MockSubmissionFile[]
  grade: number | null
}

const MOCK_COURSES: MockCourse[] = [
  { id: '2001', name: 'Applied Ethics', code: 'HUM340-01' },
  { id: '2002', name: 'Social Inquiry', code: 'SOC220-01' },
]

const MOCK_INSTRUCTORS: MockUser[] = [
  {
    id: '9001',
    firstName: 'Elizabeth',
    lastName: 'Chen (Mock)',
    email: 'echen@mock.test',
    orgDefinedId: null,
    roleId: 117,
  },
  {
    id: '9002',
    firstName: 'Angelica',
    lastName: 'Morales (Mock)',
    email: 'amorales@mock.test',
    orgDefinedId: null,
    roleId: 117,
  },
]

const MOCK_STUDENTS: MockUser[] = [
  {
    id: '5001',
    firstName: 'Aja',
    lastName: 'Williams (Mock)',
    email: 'awilliams-mock@mock.test',
    orgDefinedId: 'N90000001',
    roleId: 110,
  },
  {
    id: '5002',
    firstName: 'Marcus',
    lastName: 'Chen (Mock)',
    email: 'mchen-mock@mock.test',
    orgDefinedId: 'N90000002',
    roleId: 110,
  },
  {
    id: '5003',
    firstName: 'Sofia',
    lastName: 'Reyes (Mock)',
    email: 'sreyes-mock@mock.test',
    orgDefinedId: 'N90000003',
    roleId: 110,
  },
  {
    id: '5004',
    firstName: 'Jordan',
    lastName: 'Kim (Mock)',
    email: 'jkim-mock@mock.test',
    orgDefinedId: 'N90000004',
    roleId: 110,
  },
]

// Course enrollments (studentId → courseIds)
const MOCK_ENROLLMENTS: Record<string, string[]> = {
  '5001': ['2001', '2002'], // Aja in both
  '5002': ['2001'],         // Marcus in HUM only
  '5003': ['2002'],         // Sofia in SOC only
  '5004': ['2001', '2002'], // Jordan in both
}

// Instructor assignments
const COURSE_INSTRUCTORS: Record<string, string[]> = {
  '2001': ['9001'], // Elizabeth teaches HUM340
  '2002': ['9002'], // Angelica teaches SOC220
}

// Dropbox folders per course
const MOCK_FOLDERS: Record<string, MockFolder[]> = {
  '2001': [
    {
      id: '3001',
      name: 'Final Ethics Paper',
      instructions:
        'Write a 5-page paper analyzing an ethical dilemma you have personally encountered, either in your work, studies, or community. Apply at least two of the ethical frameworks we studied: deontology, utilitarianism, virtue ethics, or care ethics. Identify the values in tension and how you navigated them.',
      dueDate: '2026-05-15T23:59:00Z',
    },
    {
      id: '3002',
      name: 'Week 3 Discussion: Moral Relativism',
      instructions:
        'Post a 300-word response to this week\'s reading on moral relativism. Do you agree with Rachels\' rejection of cultural relativism? Support your position with specific examples.',
      dueDate: '2026-04-01T23:59:00Z',
    },
    {
      id: '3003',
      name: 'Midterm Case Study',
      instructions:
        'Select one of the three case studies provided and write a 3-page analysis identifying the stakeholders, the ethical issues at stake, and a defensible course of action.',
      dueDate: '2026-03-20T23:59:00Z',
    },
  ],
  '2002': [
    {
      id: '3004',
      name: 'Field Observation Report',
      instructions:
        'Spend at least 2 hours observing a public space of your choice. Write a 4-page report applying sociological concepts from Weeks 1-4: social roles, norms, deviance, and interaction rituals.',
      dueDate: '2026-04-10T23:59:00Z',
    },
    {
      id: '3005',
      name: 'Policy Analysis Essay',
      instructions:
        'Choose a current social policy (housing, education, criminal justice, etc.) and write a 6-page essay analyzing who benefits, who is harmed, and what values the policy reflects. Draw on at least three course readings.',
      dueDate: '2026-05-01T23:59:00Z',
    },
  ],
}

// Realistic student submission content — rotated across submissions
const SAMPLE_SUBMISSIONS = [
  `When I first read about moral relativism, I thought it made sense — who are we to judge another culture's practices? But after working through Rachels' argument, I see the problem. If we can't judge any cultural practice, then we can't say apartheid was wrong, or that slavery was wrong, or that female genital cutting is wrong. That feels intuitively impossible to accept.

The breakthrough for me was realizing that "disagreement about values" doesn't prove "no right answer." Two doctors can disagree about a diagnosis; it doesn't mean there's no actual disease. Same with ethics. Just because cultures disagree doesn't mean all their answers are equally valid.

I think the best version of this view is that SOME things are universally wrong (cruelty, suffering) even if other things (marriage customs, diet) are culturally relative. That's where I've landed.`,

  `The case I want to analyze is when I was working as a server last year and my manager asked me to lie to a customer about why their food was late. The real reason was that our kitchen had run out of a key ingredient, but she didn't want the customer to know.

The stakeholders here are the customer (who deserves honest information), the manager (who wanted to avoid a complaint), me (who would be doing the lying), and the restaurant as a whole (which has a reputation to maintain). The tension is between short-term comfort and long-term trust.

Using virtue ethics, I asked myself: what would an honest person do? They would apologize, tell the truth, and offer a free dessert. That's what I ended up doing. The customer actually thanked me for being honest, and my manager was annoyed but didn't fire me. I think I would make the same choice again.`,

  `I spent two hours at a downtown coffee shop observing interactions. What struck me most was how much "performance" goes into a casual space. People were clearly aware of being seen — adjusting posture when someone new walked in, reading their phones strategically to signal "I'm busy, don't talk to me," laughing a little too loudly at friends' jokes.

Goffman's idea of the "front stage" made so much sense here. The coffee shop looks informal but it's a stage. People are curating how they look, what they read, what they type. I saw one woman re-take a selfie four times. I saw a man check his reflection in the window twice while pretending not to. I saw two friends agree on what to say BEFORE greeting a third friend who walked in.

This felt important to me because I do the same things and had never noticed. I'm always performing, even when I think I'm just "being myself."`,

  `The policy I chose is cash bail. My analysis: cash bail is supposed to ensure defendants return to court, but in practice it creates two separate systems of justice — one for people who can afford to post bail and one for people who can't. A wealthy person charged with a serious crime can go home, keep their job, prepare their defense. A poor person charged with a minor crime can lose their job, lose their housing, and feel pressured to plead guilty just to get out.

Who benefits: bail bond companies (an industry that makes billions), prosecutors (who get leverage to push plea deals), and wealthy defendants. Who is harmed: poor defendants, their families, and communities where pretrial detention is concentrated.

The values the policy reflects are efficiency (move cases through the system fast), property (money equals freedom), and a punitive assumption of guilt. It does NOT reflect the values of equal treatment under law or the presumption of innocence. I found Pfaff's argument persuasive: we could replace cash bail with risk assessment and lose almost nothing in terms of court appearance rates while gaining enormous amounts of fairness.`,

  `Walking through the first case study, my stakeholders are: the patient (who cannot communicate), the family (split on whether to continue treatment), the medical team (facing resource constraints), and the hospital ethics committee. The ethical issues include patient autonomy, beneficence, and distributive justice when ICU beds are scarce.

I think the defensible course of action is to call an ethics consultation and document the family disagreement clearly. Act cautiously — don't withdraw support until there is either consensus or clear legal authority. If the adult daughter has durable power of attorney, her wishes carry weight even if her brother disagrees. The medical team should continue to provide comfort care no matter what.

The hardest part of this case isn't finding the answer, it's communicating it to a family in crisis. I kept thinking about what my instructor said: that the job of an ethics committee is less about being right and more about helping people feel heard as they move through something impossible.`,
]

// Assemble submissions: each student gets one submission per assignment they're enrolled in
function buildSubmissions(): MockSubmission[] {
  const submissions: MockSubmission[] = []
  let submissionCounter = 7000

  for (const studentId in MOCK_ENROLLMENTS) {
    const courseIds = MOCK_ENROLLMENTS[studentId]
    for (const courseId of courseIds) {
      const folders = MOCK_FOLDERS[courseId] || []
      for (const folder of folders) {
        // Every student submits everything (for test completeness)
        const contentIdx = submissions.length % SAMPLE_SUBMISSIONS.length
        submissions.push({
          id: String(submissionCounter++),
          folderId: folder.id,
          userId: studentId,
          submittedAt: new Date(
            Date.UTC(2026, 2, 15 + (submissionCounter % 20))
          ).toISOString(),
          files: [
            {
              fileId: String(submissionCounter * 10),
              fileName: `submission-${submissionCounter}.txt`,
              content: SAMPLE_SUBMISSIONS[contentIdx],
            },
          ],
          grade: null,
        })
      }
    }
  }

  return submissions
}

const MOCK_SUBMISSIONS = buildSubmissions()

// ─── STATS ──────────────────────────────────────────

export const MOCK_STATS = {
  le3OrgUnitId: LE3_ORG_UNIT_ID,
  courseCount: MOCK_COURSES.length,
  instructorCount: MOCK_INSTRUCTORS.length,
  studentCount: MOCK_STUDENTS.length,
  assignmentCount: Object.values(MOCK_FOLDERS).flat().length,
  submissionCount: MOCK_SUBMISSIONS.length,
} as const

// ─── FETCH DISPATCHER ───────────────────────────────

type Fetch = typeof globalThis.fetch
let realFetch: Fetch | null = null
let requestLog: { method: string; url: string }[] = []

/**
 * Install the mock. Replaces global.fetch. Safe to call multiple times
 * (subsequent calls are no-ops once installed).
 */
export function installMockValence(): void {
  if (realFetch) return // already installed
  realFetch = globalThis.fetch
  globalThis.fetch = mockFetch as Fetch
  requestLog = []
}

/**
 * Restore the real fetch. Idempotent.
 */
export function uninstallMockValence(): void {
  if (!realFetch) return
  globalThis.fetch = realFetch
  realFetch = null
}

/**
 * Return the list of URLs the mock handled during the current test run.
 * Useful for asserting coverage of all endpoints.
 */
export function getMockRequestLog(): ReadonlyArray<{ method: string; url: string }> {
  return requestLog
}

// ─── Handler ─────────────────────────────────────

/**
 * Hostname prefixes we consider "Brightspace-ish" — any URL whose host
 * contains one of these is served by the mock. All other URLs (Supabase,
 * Anthropic, Vercel, etc.) pass through to the real fetch.
 */
const BRIGHTSPACE_HOSTS = ['brightspace.test', 'mock.brightspace.test']

function isBrightspaceUrl(url: URL): boolean {
  return BRIGHTSPACE_HOSTS.some(host => url.host.includes(host))
}

async function mockFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const urlStr =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url
  const url = new URL(urlStr)
  const method = (init?.method || 'GET').toUpperCase()

  // Pass through non-Brightspace requests (Supabase, Anthropic, etc.)
  if (!isBrightspaceUrl(url)) {
    if (!realFetch) {
      throw new Error('Mock fetch called but realFetch is null')
    }
    return realFetch(input as RequestInfo, init)
  }

  requestLog.push({ method, url: urlStr })

  // ─── Auth token exchange ──────────────────────
  if (url.pathname.endsWith('/core/connect/token')) {
    return jsonResponse({
      access_token: 'mock-access-token-' + Date.now(),
      token_type: 'Bearer',
      expires_in: 3600,
    })
  }

  // ─── LP: org structure descendants ────────────
  //
  // Our client first tries paged, falls back to unpaged. We support the
  // unpaged variant since it's simpler and the client handles both.
  const descMatch = url.pathname.match(
    /\/lp\/[\d.]+\/orgstructure\/(\d+)\/descendants\/?$/
  )
  if (descMatch) {
    const parentId = descMatch[1]
    if (parentId !== LE3_ORG_UNIT_ID) {
      return jsonResponse([])
    }
    return jsonResponse(
      MOCK_COURSES.map(c => ({
        Identifier: c.id,
        Type: { Id: 3, Code: 'CourseOffering', Name: 'Course Offering' },
        Name: c.name,
        Code: c.code,
      }))
    )
  }

  // ─── LE: classlist ────────────────────────────
  const classlistMatch = url.pathname.match(
    /\/le\/[\d.]+\/(\d+)\/classlist\/?$/
  )
  if (classlistMatch) {
    const orgUnitId = classlistMatch[1]
    return jsonResponse(buildClasslist(orgUnitId))
  }

  // ─── LE: dropbox folder listing ───────────────
  const foldersMatch = url.pathname.match(
    /\/le\/[\d.]+\/(\d+)\/dropbox\/folders\/?$/
  )
  if (foldersMatch) {
    const orgUnitId = foldersMatch[1]
    const folders = MOCK_FOLDERS[orgUnitId] || []
    return jsonResponse(
      folders.map(f => ({
        Id: parseInt(f.id, 10),
        CategoryId: null,
        Name: f.name,
        CustomInstructions: { Text: f.instructions, Html: `<p>${f.instructions}</p>` },
        Attachments: [],
        TotalFiles: 0,
        TotalUsersWithSubmissions: 0,
        TotalUsersWithFeedback: 0,
        DueDate: f.dueDate,
        DisplayInCalendar: true,
        Assessment: { ScoreDenominator: 100, Rubrics: [] },
        NotificationEmail: null,
        IsHidden: false,
        GroupTypeId: null,
        DropboxType: 2, // Individual
        SubmissionType: 0, // File
        GradeItemId: null,
        Availability: { StartDate: null, EndDate: null },
        ActivityId: null,
      }))
    )
  }

  // ─── LE: submissions for a folder ────────────
  const submissionsMatch = url.pathname.match(
    /\/le\/[\d.]+\/(\d+)\/dropbox\/folders\/(\d+)\/submissions\/?$/
  )
  if (submissionsMatch) {
    const folderId = submissionsMatch[2]
    return jsonResponse(buildEntityDropbox(folderId))
  }

  // ─── LE: download a specific submission file ─
  const fileMatch = url.pathname.match(
    /\/le\/[\d.]+\/(\d+)\/dropbox\/folders\/(\d+)\/submissions\/(\d+)\/files\/(\d+)/
  )
  if (fileMatch) {
    const submissionId = fileMatch[3]
    const fileId = fileMatch[4]
    const submission = MOCK_SUBMISSIONS.find(s => s.id === submissionId)
    const file = submission?.files.find(f => f.fileId === fileId)
    if (!submission || !file) {
      return new Response('File not found', { status: 404 })
    }
    return new Response(file.content, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain',
        'Content-Disposition': `attachment; filename="${file.fileName}"`,
      },
    })
  }

  // ─── Unknown URL ──────────────────────────────
  throw new Error(
    `[mock-valence] Unmocked URL: ${method} ${urlStr}\n` +
      `Add a handler to src/lib/d2l/__mocks__/mock-valence.ts if this ` +
      `endpoint is genuinely needed, or fix the caller to use a known endpoint.`
  )
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

// ─── Helpers ─────────────────────────────────────

function buildClasslist(orgUnitId: string): unknown[] {
  // Instructors for this course
  const instructors = (COURSE_INSTRUCTORS[orgUnitId] || [])
    .map(id => MOCK_INSTRUCTORS.find(u => u.id === id))
    .filter((u): u is MockUser => !!u)

  // Students enrolled in this course
  const students = MOCK_STUDENTS.filter(s =>
    (MOCK_ENROLLMENTS[s.id] || []).includes(orgUnitId)
  )

  return [...instructors, ...students].map(u => ({
    Identifier: u.id,
    ProfileIdentifier: u.id,
    DisplayName: `${u.firstName} ${u.lastName}`,
    Username: u.email,
    OrgDefinedId: u.orgDefinedId,
    Email: u.email,
    FirstName: u.firstName,
    LastName: u.lastName,
    RoleId: u.roleId,
    // Mimic D2L's ClasslistRoleDisplayName — the authoritative field
    // our enrollment normalizer keys off. Derive from the mock's role
    // ID so existing fixtures work without updates.
    ClasslistRoleDisplayName: u.roleId === 117 ? 'Instructor' : 'Student',
  }))
}

function buildEntityDropbox(folderId: string): unknown[] {
  const submissions = MOCK_SUBMISSIONS.filter(s => s.folderId === folderId)

  // Group by user without using Map iteration (sidesteps downlevelIteration)
  const byUser: Record<string, MockSubmission[]> = {}
  for (const sub of submissions) {
    if (!byUser[sub.userId]) byUser[sub.userId] = []
    byUser[sub.userId].push(sub)
  }

  const entries: unknown[] = []
  for (const userId of Object.keys(byUser)) {
    const subs = byUser[userId]
    const user = MOCK_STUDENTS.find(u => u.id === userId)
    if (!user) continue
    entries.push({
      Entity: {
        EntityId: parseInt(user.id, 10),
        EntityType: 'User',
        Active: true,
        DisplayName: `${user.firstName} ${user.lastName}`,
      },
      Status: 1, // Submitted
      Feedback: null,
      Submissions: subs.map((s: MockSubmission) => ({
        Id: parseInt(s.id, 10),
        SubmittedBy: {
          Identifier: user.id,
          DisplayName: `${user.firstName} ${user.lastName}`,
        },
        SubmissionDate: s.submittedAt,
        Comment: null,
        Files: s.files.map((f: MockSubmissionFile) => ({
          FileId: parseInt(f.fileId, 10),
          FileName: f.fileName,
          Size: f.content.length,
        })),
      })),
      CompletionDate: null,
    })
  }

  return entries
}
