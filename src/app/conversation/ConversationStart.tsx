'use client'

import { useRouter } from 'next/navigation'
import type { StudentWork } from '@/lib/types'
import { WorkSelector } from '@/components/conversation/WorkSelector'

interface Props {
  studentId: string
  primary: StudentWork
  alternatives: StudentWork[]
}

export function ConversationStart({ studentId, primary, alternatives }: Props) {
  const router = useRouter()

  const handleSelect = (workId: string) => {
    router.push(`/conversation/${workId}?student=${studentId}`)
  }

  return (
    <WorkSelector
      primary={primary}
      alternatives={alternatives}
      onSelect={handleSelect}
    />
  )
}
