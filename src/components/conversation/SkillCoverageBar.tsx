import type { SkillCoverageData } from '@/lib/types'

interface Props {
  coverage: SkillCoverageData
}

export function SkillCoverageBar({ coverage }: Props) {
  const { completedConversations, taggedAssignments } = coverage
  const ratio = taggedAssignments > 0 ? completedConversations / taggedAssignments : 0
  const percent = Math.min(Math.round(ratio * 100), 100)

  let color = 'bg-gray-300'
  let textColor = 'text-gray-500'
  if (taggedAssignments === 0) {
    color = 'bg-gray-200'
    textColor = 'text-gray-400'
  } else if (percent === 0) {
    color = 'bg-red-300'
    textColor = 'text-red-600'
  } else if (percent < 50) {
    color = 'bg-amber-400'
    textColor = 'text-amber-700'
  } else {
    color = 'bg-green-400'
    textColor = 'text-green-700'
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${Math.max(percent, taggedAssignments > 0 ? 4 : 0)}%` }}
        />
      </div>
      <span className={`text-[10px] font-medium ${textColor} whitespace-nowrap`}>
        {completedConversations}/{taggedAssignments}
      </span>
    </div>
  )
}
