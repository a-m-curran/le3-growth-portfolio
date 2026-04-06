import { SDT_LEVELS } from '@/lib/constants'

export function GardenLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-gray-600">
      <div className="flex items-center gap-3">
        <span className="font-medium text-gray-700">Growth Level:</span>
        {Object.entries(SDT_LEVELS).map(([level, config]) => (
          <span key={level} className="flex items-center gap-1">
            <span>{config.emoji}</span>
            <span>{config.name}</span>
          </span>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <span className="font-medium text-gray-700">Conversations:</span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-green-600" />
          <span>This quarter</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-green-400" />
          <span>Last quarter</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-green-300 opacity-50" />
          <span>Earlier</span>
        </span>
      </div>
    </div>
  )
}
