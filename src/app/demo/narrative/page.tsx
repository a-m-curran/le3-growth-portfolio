import { Suspense } from 'react'
import { DemoNarrativeContent } from './DemoNarrativeContent'

interface Props {
  searchParams: { student?: string }
}

export default function DemoNarrativePage({ searchParams }: Props) {
  const studentId = searchParams.student || 'stu_aja'

  return (
    <Suspense>
      <DemoNarrativeContent studentId={studentId} />
    </Suspense>
  )
}
