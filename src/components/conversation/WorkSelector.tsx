'use client'

import type { StudentWork } from '@/lib/types'

interface WorkSelectorProps {
  primary: StudentWork
  alternatives: StudentWork[]
  onSelect: (workId: string) => void
}

export function WorkSelector({ primary, alternatives, onSelect }: WorkSelectorProps) {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-gray-600 mb-4">Let&apos;s look at something you did recently.</p>

        {/* Primary suggestion */}
        <button
          onClick={() => onSelect(primary.id)}
          className="w-full text-left p-5 rounded-xl border-2 border-green-300 bg-white hover:bg-green-50 transition-colors"
        >
          <div className="flex items-start gap-3">
            <span className="text-xl mt-0.5">{getWorkIcon(primary.workType)}</span>
            <div>
              <h3 className="font-semibold text-gray-900">{primary.title}</h3>
              <p className="text-sm text-gray-500 mt-0.5">
                {primary.courseName && `${primary.courseName} · `}
                {primary.quarter}
                {primary.weekNumber && ` · Week ${primary.weekNumber}`}
              </p>
              {primary.description && (
                <p className="text-sm text-gray-600 mt-2">{primary.description}</p>
              )}
            </div>
          </div>
          <div className="mt-4 text-center">
            <span className="inline-block px-4 py-2 bg-green-700 text-white rounded-full text-sm font-medium">
              Let&apos;s Explore This
            </span>
          </div>
        </button>
      </div>

      {/* Alternatives */}
      {alternatives.length > 0 && (
        <div>
          <p className="text-sm text-gray-400 text-center mb-3">
            &mdash; or pick a different piece of work &mdash;
          </p>
          <div className="space-y-2">
            {alternatives.map(work => (
              <button
                key={work.id}
                onClick={() => onSelect(work.id)}
                className="w-full text-left p-3 rounded-lg border border-gray-200 hover:border-green-300 hover:bg-green-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">{getWorkIcon(work.workType)}</span>
                  <span className="text-sm text-gray-700">{work.title}</span>
                  {work.courseName && (
                    <span className="text-xs text-gray-400">
                      ({work.courseName}
                      {work.weekNumber && `, Week ${work.weekNumber}`})
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function getWorkIcon(type: string): string {
  switch (type) {
    case 'essay': return '📝'
    case 'project': return '📊'
    case 'presentation': return '🎤'
    case 'exam': return '📋'
    case 'lab_report': return '🔬'
    case 'discussion_post': return '💬'
    case 'portfolio_piece': return '📁'
    default: return '📄'
  }
}
