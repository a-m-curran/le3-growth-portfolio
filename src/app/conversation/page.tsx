import { getAvailableWork, getCurrentStudent } from '@/lib/queries'
import { selectWorkForConversation } from '@/lib/work-selection'
import { redirect } from 'next/navigation'
import { ConversationStart } from './ConversationStart'

interface Props {
  searchParams: { student?: string }
}

export default async function ConversationPage({ searchParams }: Props) {
  const student = await getCurrentStudent(searchParams.student)
  if (!student) redirect('/login')
  const studentId = student.id
  const availableWork = await getAvailableWork(studentId)
  const selection = selectWorkForConversation(availableWork)

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-xl font-bold text-green-900 mb-1">Growth Conversation</h1>
      <p className="text-sm text-gray-500 mb-6">
        Choose a piece of your work to reflect on.
      </p>

      {selection ? (
        <ConversationStart
          studentId={studentId}
          primary={selection.primary}
          alternatives={selection.alternatives}
        />
      ) : (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg mb-2">No work available for reflection.</p>
          <p className="text-sm">
            All your submitted work has already been reflected on. Check back after submitting new assignments.
          </p>
        </div>
      )}
    </main>
  )
}
