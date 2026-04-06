import { DemoConversationFlow } from './DemoConversationFlow'

interface Props {
  params: { id: string }
  searchParams: { student?: string }
}

export default function DemoConversationDetailPage({ params, searchParams }: Props) {
  const studentId = searchParams.student || 'stu_aja'

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <DemoConversationFlow workId={params.id} studentId={studentId} />
    </main>
  )
}
