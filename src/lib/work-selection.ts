import type { StudentWork } from './types'

export function selectWorkForConversation(
  availableWork: StudentWork[],
  count: number = 3
): { primary: StudentWork; alternatives: StudentWork[] } | null {
  if (availableWork.length === 0) return null

  // Sort by recency (most recent first), then by content richness
  const scored = availableWork.map(work => ({
    work,
    score: computeScore(work),
  }))

  scored.sort((a, b) => b.score - a.score)

  const primary = scored[0].work
  const alternatives = scored.slice(1, count).map(s => s.work)

  return { primary, alternatives }
}

function computeScore(work: StudentWork): number {
  let score = 0

  // Recency: more recent = higher score
  const daysSinceSubmission = (Date.now() - new Date(work.submittedAt).getTime()) / (1000 * 60 * 60 * 24)
  if (daysSinceSubmission < 14) score += 30
  else if (daysSinceSubmission < 30) score += 20
  else if (daysSinceSubmission < 60) score += 10

  // Content richness: prefer items with content
  if (work.content && work.content.length > 50) score += 20
  if (work.description && work.description.length > 20) score += 10

  // Type preference: essays and projects over exams and other
  const typeScores: Record<string, number> = {
    essay: 15,
    project: 15,
    discussion_post: 12,
    presentation: 12,
    lab_report: 10,
    portfolio_piece: 10,
    exam: 5,
    other: 8,
  }
  score += typeScores[work.workType] || 5

  return score
}
