import { getCurrentStudent } from '@/lib/queries'
import { redirect } from 'next/navigation'
import { ConversationFlow } from './ConversationFlow'

interface Props {
  params: { id: string }
}

export default async function ConversationDetailPage({ params }: Props) {
  const student = await getCurrentStudent()
  if (!student) redirect('/login')

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <ConversationFlow workId={params.id} studentId={student.id} />
    </main>
  )
}
