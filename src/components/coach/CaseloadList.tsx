'use client'

import Link from 'next/link'
import type { CoachStudentSummary } from '@/lib/types'
import { SDT_LEVEL_MAP } from '@/lib/constants'
import { Badge } from '@/components/ui/Badge'

interface CaseloadListProps {
  students: CoachStudentSummary[]
  coachId: string
}

export function CaseloadList({ students, coachId }: CaseloadListProps) {
  return (
    <div className="space-y-4">
      {students.map(({ student, conversationsThisQuarter, latestPullQuote, skillLevels }) => (
        <div
          key={student.id}
          className="p-4 rounded-xl bg-white border border-gray-200 hover:border-green-300 transition-colors"
        >
          <div className="flex items-start justify-between mb-2">
            <div>
              <h3 className="font-semibold text-gray-900">
                {student.firstName} {student.lastName}
              </h3>
              <p className="text-xs text-gray-500">
                {conversationsThisQuarter} conversation{conversationsThisQuarter !== 1 ? 's' : ''} this quarter
              </p>
            </div>
          </div>

          {/* Skill levels as dots */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3">
            {skillLevels.slice(0, 3).map(sl => (
              <div key={sl.skillId} className="flex items-center gap-1.5">
                <Badge level={SDT_LEVEL_MAP[sl.sdtLevel]} />
                <span className="text-xs text-gray-600">{sl.skillName}</span>
              </div>
            ))}
          </div>

          {/* Latest pull quote */}
          {latestPullQuote && (
            <p className="text-xs text-gray-500 italic mb-3">
              Latest: &ldquo;{latestPullQuote.substring(0, 80)}
              {latestPullQuote.length > 80 ? '...' : ''}&rdquo;
            </p>
          )}

          {/* Action buttons */}
          <div className="flex gap-2">
            <Link
              href={`/coach/${student.id}?coach=${coachId}`}
              className="text-xs px-3 py-1.5 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors"
            >
              View Garden
            </Link>
            <Link
              href={`/coach/${student.id}/prep?coach=${coachId}`}
              className="text-xs px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
            >
              Prep for Session
            </Link>
          </div>
        </div>
      ))}
    </div>
  )
}
