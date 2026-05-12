import { JournalView } from './JournalView'

/**
 * v2 Journal — open standalone reflections, the "something on my
 * mind" surface. Distinct from /v2/reflect which handles work-tied
 * conversations.
 *
 * Layout:
 *   - "What's on your mind?" composer at the top (reuses v1
 *     ReflectForm, which posts to /api/reflect/start)
 *   - In-progress journal entries (resume cards)
 *   - Past entries (read-back via ConversationPanel)
 */
export default function V2JournalPage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Journal</h1>
        <p className="text-sm text-gray-500 mt-1">
          Something on your mind? Describe what happened and we&rsquo;ll
          think through it together.
        </p>
      </div>
      <JournalView />
    </div>
  )
}
