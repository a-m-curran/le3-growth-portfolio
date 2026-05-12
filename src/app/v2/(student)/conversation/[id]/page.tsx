import { ConversationReplay } from './ConversationReplay'

/**
 * v2 Conversation Replay — phase-by-phase walkthrough of a conversation
 * with the v1 demo's typewriter effect. Demo-only for now (the real
 * v2 conversation flow isn't built yet); the page fetches the
 * conversation through /api/conversations/[id], which has its own
 * demo short-circuit returning static seed data.
 *
 * Sits in the (student) group so the shell shows the student sidebar
 * and bottom tab bar — appropriate since the replay is the student
 * experience of going through a reflection.
 */
export default function V2ConversationReplayPage({
  params,
}: {
  params: { id: string }
}) {
  return <ConversationReplay conversationId={params.id} />
}
