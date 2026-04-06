import { getAvailableWork } from '@/lib/queries'
import { selectWorkForConversation } from '@/lib/work-selection'
import { DemoConversationStart } from './DemoConversationStart'

interface Props {
  searchParams: { student?: string }
}

export default async function DemoConversationPage({ searchParams }: Props) {
  const studentId = searchParams.student || 'stu_aja'
  const availableWork = await getAvailableWork(studentId)
  const selection = selectWorkForConversation(availableWork)

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-xl font-bold text-green-900 mb-1">Growth Conversation</h1>
      <p className="text-sm text-gray-500 mb-6">
        Choose a piece of your work to reflect on.
      </p>

      {selection ? (
        <DemoConversationStart
          studentId={studentId}
          primary={selection.primary}
          alternatives={selection.alternatives}
        />
      ) : (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg mb-2">No work available for reflection.</p>
          <p className="text-sm">
            All submitted work has already been reflected on.
          </p>
        </div>
      )}
    </main>
  )
}
