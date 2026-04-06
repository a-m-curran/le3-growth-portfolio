'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { students, coaches } from '@/data'

interface PersonSelectorProps {
  isCoach: boolean
}

export function PersonSelector({ isCoach }: PersonSelectorProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  if (isCoach) {
    const currentCoach = searchParams.get('coach') || 'coach_elizabeth'
    return (
      <select
        value={currentCoach}
        onChange={e => router.push(`/coach?coach=${e.target.value}`)}
        className="text-sm border border-green-300 rounded-md px-2 py-1 bg-white text-green-900 focus:outline-none focus:ring-2 focus:ring-green-500"
        aria-label="Select coach"
      >
        {coaches.map(c => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    )
  }

  const currentStudent = searchParams.get('student') || 'stu_aja'
  return (
    <select
      value={currentStudent}
      onChange={e => router.push(`/garden?student=${e.target.value}`)}
      className="text-sm border border-green-300 rounded-md px-2 py-1 bg-white text-green-900 focus:outline-none focus:ring-2 focus:ring-green-500"
      aria-label="Select student"
    >
      {students.map(s => (
        <option key={s.id} value={s.id}>
          {s.firstName} {s.lastName}
        </option>
      ))}
    </select>
  )
}
