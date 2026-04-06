import { pillars } from './pillars'
import { skills } from './skills'
import { rubrics } from './rubrics'
import { coaches } from './coaches'
import { students } from './students'
import { studentWork } from './student-work'
import { conversations } from './conversations'
import { skillDefinitions } from './skill-definitions'
import { assessments } from './assessments'
import { goals } from './goals'
import { coachNotes } from './coach-notes'

export {
  pillars,
  skills,
  rubrics,
  coaches,
  students,
  studentWork,
  conversations,
  skillDefinitions,
  assessments,
  goals,
  coachNotes,
}

// ─── LOOKUP HELPERS ─────────────────────────────────

export const getStudent = (id: string) =>
  students.find(s => s.id === id)!

export const getCoach = (id: string) =>
  coaches.find(c => c.id === id)!

export const getPillar = (id: string) =>
  pillars.find(p => p.id === id)!

export const getSkill = (id: string) =>
  skills.find(s => s.id === id)!

export const getRubric = (skillId: string) =>
  rubrics.find(r => r.skillId === skillId && r.isCurrent)!

export const getStudentWork = (id: string) =>
  studentWork.find(w => w.id === id)

export const getStudentConversations = (studentId: string) =>
  conversations
    .filter(c => c.studentId === studentId && c.status === 'completed')
    .sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime())

export const getConversation = (id: string) =>
  conversations.find(c => c.id === id)

export const getConversationsForSkill = (studentId: string, skillId: string) =>
  conversations.filter(
    c =>
      c.studentId === studentId &&
      c.status === 'completed' &&
      c.skillTags.some(t => t.skillId === skillId)
  )

export const getStudentDefinitions = (studentId: string) =>
  skillDefinitions.filter(d => d.studentId === studentId)

export const getCurrentDefinition = (studentId: string, skillId: string) =>
  skillDefinitions.find(
    d => d.studentId === studentId && d.skillId === skillId && d.isCurrent
  )

export const getPreviousDefinition = (studentId: string, skillId: string) =>
  skillDefinitions.find(
    d => d.studentId === studentId && d.skillId === skillId && !d.isCurrent
  )

export const getLatestCoachAssessment = (studentId: string, skillId: string) =>
  assessments
    .filter(
      a =>
        a.studentId === studentId &&
        a.skillId === skillId &&
        a.assessorType === 'coach'
    )
    .sort((a, b) => new Date(b.assessedAt).getTime() - new Date(a.assessedAt).getTime())[0]

export const getLatestSelfAssessment = (studentId: string, skillId: string) =>
  assessments
    .filter(
      a =>
        a.studentId === studentId &&
        a.skillId === skillId &&
        a.assessorType === 'self'
    )
    .sort((a, b) => new Date(b.assessedAt).getTime() - new Date(a.assessedAt).getTime())[0]

export const getStudentsByCoach = (coachId: string) =>
  students.filter(s => s.coachId === coachId)

export const getStudentGoals = (studentId: string, quarter?: string) =>
  goals.filter(
    g => g.studentId === studentId && (!quarter || g.quarter === quarter)
  )

export const getCoachNotes = (coachId: string, studentId: string) =>
  coachNotes
    .filter(n => n.coachId === coachId && n.studentId === studentId)
    .sort((a, b) => new Date(b.sessionDate).getTime() - new Date(a.sessionDate).getTime())

export const getStudentWorkItems = (studentId: string) =>
  studentWork.filter(w => w.studentId === studentId)

export const getAvailableWork = (studentId: string) => {
  const completedWorkIds = new Set(
    conversations
      .filter(c => c.studentId === studentId && c.status === 'completed')
      .map(c => c.workId)
      .filter(Boolean)
  )
  return studentWork.filter(
    w => w.studentId === studentId && !completedWorkIds.has(w.id)
  )
}
