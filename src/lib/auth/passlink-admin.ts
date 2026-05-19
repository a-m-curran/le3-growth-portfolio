import { createHash, randomBytes } from 'crypto'
import { createAdminClient } from '@/lib/supabase-admin'

/**
 * Server-side passlink admin lib (Next runtime; service-role client).
 * Provisions subjects + mints hashed tokens, gathers the pilot
 * population, builds the status roster, rotates/revokes, and renders
 * the one-time CSV. Coach logic mirrors scripts/issue-passlink.ts;
 * students must already exist (the synced cohort) — we never create
 * student rows. Instructors are provisioned as coach rows.
 */

type Admin = ReturnType<typeof createAdminClient>
export type SubjectKind = 'coach' | 'student'

export interface PilotSubject {
  kind: SubjectKind
  email: string
  name: string
}

export interface IssueResult {
  name: string
  email: string
  role: SubjectKind
  status: 'minted' | 'already-active' | 'error'
  url: string | null
  detail: string
}

export interface RosterRow {
  passlinkId: string | null
  role: SubjectKind
  name: string
  email: string
  status: 'active' | 'revoked' | 'none'
  lastUsedAt: string | null
  createdAt: string | null
}

// Verbatim from src/app/api/auth/callback/route.ts (local, unexported)
// — kept in sync so provisioned coaches get the same display name.
function deriveNameFromEmail(email: string): string {
  const local = email.split('@')[0] || 'Admin'
  return (
    local
      .split(/[._-]+/)
      .filter(Boolean)
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ') || 'Admin'
  )
}

function sha256hex(s: string): string {
  return createHash('sha256').update(s).digest('hex')
}

async function findAuthUserIdByEmail(admin: Admin, email: string): Promise<string | null> {
  const target = email.toLowerCase()
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    const users = data?.users ?? []
    const hit = users.find(u => (u.email ?? '').toLowerCase() === target)
    if (hit) return hit.id
    if (users.length < 1000) break
  }
  return null
}

async function ensureAuthUser(admin: Admin, email: string): Promise<string> {
  const existing = await findAuthUserIdByEmail(admin, email)
  if (existing) return existing
  const { data, error } = await admin.auth.admin.createUser({ email, email_confirm: true })
  if (error || !data?.user) {
    throw new Error(`auth user create failed for ${email}: ${error?.message ?? 'no user'}`)
  }
  return data.user.id
}

async function ensureCoachId(admin: Admin, email: string, name: string): Promise<string> {
  const authUserId = await ensureAuthUser(admin, email)
  const { data: coach, error: cErr } = await admin
    .from('coach')
    .select('id, auth_user_id, status')
    .eq('email', email)
    .maybeSingle()
  if (cErr) throw cErr
  if (coach?.id) {
    const patch: Record<string, unknown> = {}
    if (!coach.auth_user_id) patch.auth_user_id = authUserId
    if (coach.status !== 'active') patch.status = 'active'
    if (Object.keys(patch).length > 0) {
      const { error } = await admin.from('coach').update(patch).eq('id', coach.id as string)
      if (error) throw error
    }
    return coach.id as string
  }
  const { data: inserted, error } = await admin
    .from('coach')
    .insert({ auth_user_id: authUserId, name: name || deriveNameFromEmail(email), email, status: 'active' })
    .select('id')
    .single()
  if (error || !inserted) throw new Error(`coach insert failed for ${email}: ${error?.message ?? 'no row'}`)
  return inserted.id as string
}

async function ensureStudentId(admin: Admin, email: string): Promise<string> {
  const { data: student, error } = await admin
    .from('student')
    .select('id, auth_user_id')
    .eq('email', email)
    .eq('is_demo', false)
    .eq('status', 'active')
    .maybeSingle()
  if (error) throw error
  if (!student?.id) throw new Error(`no active non-demo student row for ${email}`)
  const authUserId = await ensureAuthUser(admin, email)
  if (!student.auth_user_id) {
    const { error: uErr } = await admin
      .from('student')
      .update({ auth_user_id: authUserId })
      .eq('id', student.id as string)
    if (uErr) throw uErr
  }
  return student.id as string
}

export async function ensureSubjectAndMint(
  admin: Admin,
  subject: PilotSubject,
  baseUrl: string,
  rotate = false
): Promise<IssueResult> {
  const base = { name: subject.name, email: subject.email, role: subject.kind }
  try {
    const col = subject.kind === 'coach' ? 'coach_id' : 'student_id'
    const subjectId =
      subject.kind === 'coach'
        ? await ensureCoachId(admin, subject.email, subject.name)
        : await ensureStudentId(admin, subject.email)

    const { data: active, error: aErr } = await admin
      .from('auth_passlink')
      .select('id')
      .eq(col, subjectId)
      .is('revoked_at', null)
    if (aErr) throw aErr

    if (active && active.length > 0) {
      if (!rotate) {
        return { ...base, status: 'already-active', url: null, detail: 'active link exists (rotate to re-export)' }
      }
      const { error: rErr } = await admin
        .from('auth_passlink')
        .update({ revoked_at: new Date().toISOString() })
        .eq(col, subjectId)
        .is('revoked_at', null)
      if (rErr) throw rErr
    }

    const token = randomBytes(32).toString('base64url')
    const { error: insErr } = await admin
      .from('auth_passlink')
      .insert({ [col]: subjectId, token_hash: sha256hex(token) })
    if (insErr) throw insErr

    const url = `${baseUrl.replace(/\/+$/, '')}/api/auth/passlink?t=${token}`
    return { ...base, status: 'minted', url, detail: '' }
  } catch (err) {
    return { ...base, status: 'error', url: null, detail: String(err) }
  }
}

export async function gatherPilotSubjects(admin: Admin): Promise<PilotSubject[]> {
  const subjects: PilotSubject[] = []
  const coachEmails = new Set<string>()

  const { data: students } = await admin
    .from('student')
    .select('first_name, last_name, email')
    .eq('status', 'active')
    .eq('is_demo', false)
    .order('last_name', { ascending: true })
  for (const s of students ?? []) {
    subjects.push({
      kind: 'student',
      email: s.email as string,
      name: `${s.first_name as string} ${s.last_name as string}`.trim(),
    })
  }

  const { data: coaches } = await admin
    .from('coach')
    .select('name, email')
    .eq('is_demo', false)
    .order('name', { ascending: true })
  for (const c of coaches ?? []) {
    const key = (c.email as string).toLowerCase()
    if (coachEmails.has(key)) continue
    coachEmails.add(key)
    subjects.push({ kind: 'coach', email: c.email as string, name: c.name as string })
  }

  const { data: instructors } = await admin
    .from('instructor')
    .select('name, email')
    .order('name', { ascending: true })
  for (const i of instructors ?? []) {
    const email = (i.email as string | null)?.trim()
    if (!email || !email.includes('@')) continue
    const key = email.toLowerCase()
    if (coachEmails.has(key)) continue
    coachEmails.add(key)
    subjects.push({ kind: 'coach', email, name: (i.name as string) || deriveNameFromEmail(email) })
  }

  return subjects
}

export async function getPasslinkRoster(admin: Admin): Promise<RosterRow[]> {
  const rows: RosterRow[] = []

  const { data: links } = await admin
    .from('auth_passlink')
    .select('id, coach_id, student_id, revoked_at, last_used_at, created_at')
    .order('created_at', { ascending: false })
  const byCoach = new Map<string, { id: string; revoked: boolean; lastUsedAt: string | null; createdAt: string | null }>()
  const byStudent = new Map<string, { id: string; revoked: boolean; lastUsedAt: string | null; createdAt: string | null }>()
  for (const l of links ?? []) {
    const rec = {
      id: l.id as string,
      revoked: l.revoked_at != null,
      lastUsedAt: (l.last_used_at as string | null) ?? null,
      createdAt: (l.created_at as string | null) ?? null,
    }
    if (l.coach_id && !byCoach.has(l.coach_id as string)) byCoach.set(l.coach_id as string, rec)
    if (l.student_id && !byStudent.has(l.student_id as string)) byStudent.set(l.student_id as string, rec)
  }

  const { data: coaches } = await admin
    .from('coach')
    .select('id, name, email')
    .eq('is_demo', false)
    .order('name', { ascending: true })
  for (const c of coaches ?? []) {
    const link = byCoach.get(c.id as string)
    rows.push({
      passlinkId: link?.id ?? null,
      role: 'coach',
      name: c.name as string,
      email: c.email as string,
      status: !link ? 'none' : link.revoked ? 'revoked' : 'active',
      lastUsedAt: link?.lastUsedAt ?? null,
      createdAt: link?.createdAt ?? null,
    })
  }

  const { data: students } = await admin
    .from('student')
    .select('id, first_name, last_name, email')
    .eq('status', 'active')
    .eq('is_demo', false)
    .order('last_name', { ascending: true })
  for (const s of students ?? []) {
    const link = byStudent.get(s.id as string)
    rows.push({
      passlinkId: link?.id ?? null,
      role: 'student',
      name: `${s.first_name as string} ${s.last_name as string}`.trim(),
      email: s.email as string,
      status: !link ? 'none' : link.revoked ? 'revoked' : 'active',
      lastUsedAt: link?.lastUsedAt ?? null,
      createdAt: link?.createdAt ?? null,
    })
  }

  return rows
}

export async function rotatePasslink(
  admin: Admin,
  passlinkId: string,
  baseUrl: string
): Promise<IssueResult> {
  const { data: link, error } = await admin
    .from('auth_passlink')
    .select('coach_id, student_id')
    .eq('id', passlinkId)
    .maybeSingle()
  if (error) throw error
  if (!link) {
    return { name: '', email: '', role: 'coach', status: 'error', url: null, detail: 'passlink not found' }
  }

  let subject: PilotSubject
  if (link.coach_id) {
    const { data: c } = await admin
      .from('coach')
      .select('name, email')
      .eq('id', link.coach_id as string)
      .maybeSingle()
    if (!c) return { name: '', email: '', role: 'coach', status: 'error', url: null, detail: 'coach not found' }
    subject = { kind: 'coach', email: c.email as string, name: c.name as string }
  } else {
    const { data: st } = await admin
      .from('student')
      .select('first_name, last_name, email')
      .eq('id', link.student_id as string)
      .maybeSingle()
    if (!st) return { name: '', email: '', role: 'student', status: 'error', url: null, detail: 'student not found' }
    subject = {
      kind: 'student',
      email: st.email as string,
      name: `${st.first_name as string} ${st.last_name as string}`.trim(),
    }
  }
  return ensureSubjectAndMint(admin, subject, baseUrl, true)
}

export async function revokeAllPasslinks(admin: Admin): Promise<number> {
  const { data, error } = await admin
    .from('auth_passlink')
    .update({ revoked_at: new Date().toISOString() })
    .is('revoked_at', null)
    .select('id')
  if (error) throw error
  return data?.length ?? 0
}

function csvCell(v: string): string {
  return `"${v.replace(/"/g, '""')}"`
}

export function toCsv(rows: IssueResult[]): string {
  const header = ['name', 'email', 'role', 'status', 'url'].join(',')
  const body = rows.map(r =>
    [r.name, r.email, r.role, r.status, r.url ?? ''].map(csvCell).join(',')
  )
  return [header, ...body].join('\r\n') + '\r\n'
}
