import { ConversationFlow } from './ConversationFlow'

interface Props {
  params: { id: string }
  searchParams: { student?: string }
}

export default function ConversationDetailPage({ params, searchParams }: Props) {
  const studentId = searchParams.student || 'stu_aja'

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <ConversationFlow workId={params.id} studentId={studentId} />
    </main>
  )
}
