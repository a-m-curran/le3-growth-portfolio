import { getAvailableWork, getCurrentStudent, getAllStudentConversations } from '@/lib/queries'
import { selectWorkForConversation } from '@/lib/work-selection'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ConversationStart } from './ConversationStart'
import type { GrowthConversation } from '@/lib/types'

export default async function ConversationPage() {
  const student = await getCurrentStudent()
  if (!student) redirect('/login')

  const [availableWork, allConversations] = await Promise.all([
    getAvailableWork(student.id),
    getAllStudentConversations(student.id),
  ])

  const inProgress = allConversations.filter(c => c.status === 'in_progress')
  const completed = allConversations.filter(c => c.status === 'completed')
  const selection = selectWorkForConversation(availableWork)

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-green-900 mb-1">Growth Conversations</h1>
          <p className="text-sm text-gray-500">
            Reflect on your work through guided conversations.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/reflection/new"
            className="text-sm px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors whitespace-nowrap"
          >
            + Reflect
          </Link>
          <Link
            href="/work/submit"
            className="text-sm px-3 py-2 bg-green-700 text-white rounded-lg hover:bg-green-800 transition-colors whitespace-nowrap"
          >
            + Submit
          </Link>
          <Link
            href="/work/import"
            className="text-sm px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors whitespace-nowrap"
          >
            Import
          </Link>
        </div>
      </div>

      {/* In-progress conversations */}
      {inProgress.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-amber-700 uppercase tracking-wide mb-3">
            In Progress
          </h2>
          <div className="space-y-3">
            {inProgress.map(conv => (
              <ConversationCard key={conv.id} conversation={conv} />
            ))}
          </div>
        </section>
      )}

      {/* Start new conversation */}
      {selection && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Start New Reflection
          </h2>
          <ConversationStart
            studentId={student.id}
            primary={selection.primary}
            alternatives={selection.alternatives}
          />
        </section>
      )}

      {/* Empty state — no conversations and no work */}
      {inProgress.length === 0 && completed.length === 0 && !selection && (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg mb-2">No conversations yet.</p>
          <p className="text-sm mb-4">
            Submit a piece of work to start your first growth conversation.
          </p>
          <Link
            href="/work/submit"
            className="inline-block px-6 py-3 bg-green-700 text-white rounded-lg text-sm font-medium hover:bg-green-800 transition-colors"
          >
            Submit Your First Work
          </Link>
        </div>
      )}

      {/* Completed conversations */}
      {completed.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Completed ({completed.length})
          </h2>
          <div className="space-y-3">
            {completed.map(conv => (
              <ConversationCard key={conv.id} conversation={conv} completed />
            ))}
          </div>
        </section>
      )}
    </main>
  )
}

function ConversationCard({
  conversation,
  completed = false,
}: {
  conversation: GrowthConversation & { workTitle?: string }
  completed?: boolean
}) {
  const isReflection = conversation.conversationType === 'open_reflection'
  const workTitle = isReflection
    ? (conversation.reflectionDescription?.substring(0, 60) || 'Open Reflection')
    : ((conversation as unknown as { workTitle?: string }).workTitle || conversation.workContext || 'Reflection')

  const date = new Date(conversation.startedAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })

  // Figure out which phase the conversation is on
  let phase = 'Phase 1'
  if (conversation.responsePhase1 && conversation.promptPhase2) phase = 'Phase 2'
  if (conversation.responsePhase2 && conversation.promptPhase3) phase = 'Phase 3'

  return (
    <Link
      href={completed ? '#' : `/conversation/${conversation.workId || conversation.id}`}
      className={`block p-4 rounded-xl bg-white border transition-colors ${
        completed
          ? 'border-gray-200 opacity-75'
          : 'border-amber-200 hover:border-green-400 hover:shadow-sm cursor-pointer'
      }`}
    >
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium text-gray-900 text-sm">{workTitle}</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {date}
            {!completed && (
              <span className="ml-2 text-amber-600 font-medium">{phase} &middot; Resume &rarr;</span>
            )}
            {completed && conversation.synthesisText && (
              <span className="ml-2 text-green-600">Completed</span>
            )}
          </p>
        </div>
        {!completed && (
          <span className="text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded-full font-medium">
            In progress
          </span>
        )}
      </div>
      {completed && conversation.synthesisText && (
        <p className="text-xs text-gray-500 mt-2 line-clamp-2 italic">
          {conversation.synthesisText.substring(0, 120)}...
        </p>
      )}
    </Link>
  )
}
