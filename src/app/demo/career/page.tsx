import { Suspense } from 'react'
import { DemoCareerContent } from './DemoCareerContent'

interface Props {
  searchParams: { student?: string }
}

export default function DemoCareerPage({ searchParams }: Props) {
  const studentId = searchParams.student || 'stu_aja'

  return (
    <Suspense>
      <DemoCareerContent studentId={studentId} />
    </Suspense>
  )
}
