import { getAvailableWork, getCurrentStudent } from '@/lib/queries'
import { selectWorkForConversation } from '@/lib/work-selection'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ConversationStart } from './ConversationStart'

export default async function ConversationPage() {
  const student = await getCurrentStudent()
  if (!student) redirect('/login')

  const availableWork = await getAvailableWork(student.id)
  const selection = selectWorkForConversation(availableWork)

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-green-900 mb-1">Growth Conversation</h1>
          <p className="text-sm text-gray-500">
            Choose a piece of your work to reflect on.
          </p>
        </div>
        <Link
          href="/work/submit"
          className="text-sm px-4 py-2 bg-green-700 text-white rounded-lg hover:bg-green-800 transition-colors whitespace-nowrap"
        >
          + Submit Work
        </Link>
      </div>

      {selection ? (
        <ConversationStart
          studentId={student.id}
          primary={selection.primary}
          alternatives={selection.alternatives}
        />
      ) : (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg mb-2">No work available for reflection.</p>
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
    </main>
  )
}
