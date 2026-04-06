import { SDT_LEVELS } from '@/lib/constants'

interface BadgeProps {
  level: number
}

export function Badge({ level }: BadgeProps) {
  const config = SDT_LEVELS[level as 1 | 2 | 3 | 4] || SDT_LEVELS[1]
  const filled = level
  const empty = 4 - level

  return (
    <span className="inline-flex gap-0.5" title={config.name}>
      {Array.from({ length: filled }).map((_, i) => (
        <span
          key={`f${i}`}
          className="w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: config.color }}
        />
      ))}
      {Array.from({ length: empty }).map((_, i) => (
        <span
          key={`e${i}`}
          className="w-1.5 h-1.5 rounded-full bg-gray-200"
        />
      ))}
    </span>
  )
}
