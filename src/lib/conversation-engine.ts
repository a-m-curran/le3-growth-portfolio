import type { GrowthConversation } from './types'
import { conversations as allConversations } from '@/data'

/**
 * Demo mode conversation engine.
 * Returns pre-written conversations for guided replay.
 * In MVP mode, this would be replaced by live LLM calls.
 */
export function findDemoConversation(
  studentId: string,
  workId: string
): GrowthConversation | null {
  return (
    allConversations.find(
      c => c.studentId === studentId && c.workId === workId && c.status === 'completed'
    ) ?? null
  )
}

export function getNextUnreflectedConversation(
  studentId: string
): GrowthConversation | null {
  // Find a completed conversation that could be replayed in demo mode
  const studentConvos = allConversations.filter(
    c => c.studentId === studentId && c.status === 'completed'
  )
  return studentConvos[0] ?? null
}
