export function MountainLegend() {
  const levels = [
    { emoji: '🥾', name: 'Trailhead' },
    { emoji: '🪨', name: 'Lower Trail' },
    { emoji: '⛺', name: 'Basecamp' },
    { emoji: '🚩', name: 'Summit Ridge' },
    { emoji: '🏔️', name: 'Summit' },
  ]

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-gray-600">
      <div className="flex items-center gap-3">
        <span className="font-medium text-gray-700">Elevation:</span>
        {levels.map(l => (
          <span key={l.name} className="flex items-center gap-1">
            <span>{l.emoji}</span>
            <span>{l.name}</span>
          </span>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <span className="font-medium text-gray-700">Trail Markers:</span>
        <span className="flex items-center gap-1">
          <span className="w-0 h-0 border-l-[4px] border-r-[4px] border-b-[6px] border-transparent border-b-red-600" />
          <span>This quarter</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="w-0 h-0 border-l-[4px] border-r-[4px] border-b-[6px] border-transparent border-b-orange-500 opacity-80" />
          <span>Last quarter</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="w-0 h-0 border-l-[4px] border-r-[4px] border-b-[6px] border-transparent border-b-amber-500 opacity-50" />
          <span>Earlier</span>
        </span>
      </div>
    </div>
  )
}
