export function CityscapeLegend() {
  const levels = [
    { emoji: '🏗️', name: 'Foundation' },
    { emoji: '🔨', name: 'Under Construction' },
    { emoji: '🏢', name: 'Mid-Rise' },
    { emoji: '🏙️', name: 'High-Rise' },
    { emoji: '🌟', name: 'Landmark' },
  ]

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-gray-600">
      <div className="flex items-center gap-3">
        <span className="font-medium text-gray-700">Building Level:</span>
        {levels.map(l => (
          <span key={l.name} className="flex items-center gap-1">
            <span>{l.emoji}</span>
            <span>{l.name}</span>
          </span>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <span className="font-medium text-gray-700">Windows:</span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2 rounded-sm bg-yellow-400" />
          <span>This quarter</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2 rounded-sm bg-amber-500 opacity-70" />
          <span>Last quarter</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2 rounded-sm bg-amber-600 opacity-40" />
          <span>Earlier</span>
        </span>
      </div>
    </div>
  )
}
