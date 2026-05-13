import { ConversationView } from './ConversationView'

/**
 * v2 Conversation page — dispatches between the replay view (for
 * completed conversations) and the interactive flow view (for
 * in-progress conversations) based on the status returned by
 * /api/conversations/[id]. The dispatch is done client-side in
 * ConversationView; this server component is just the route shim.
 */
export default function V2ConversationPage({
  params,
}: {
  params: { id: string }
}) {
  return <ConversationView conversationId={params.id} />
}
