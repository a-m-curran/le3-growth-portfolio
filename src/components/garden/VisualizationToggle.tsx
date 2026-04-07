'use client'

export type VisualizationType = 'garden' | 'mountain' | 'cityscape'

interface Props {
  value: VisualizationType
  onChange: (type: VisualizationType) => void
}

const options: { type: VisualizationType; emoji: string; label: string }[] = [
  { type: 'garden', emoji: '🌱', label: 'Garden' },
  { type: 'mountain', emoji: '🏔️', label: 'Mountain Trail' },
  { type: 'cityscape', emoji: '🏙️', label: 'Cityscape' },
]

export function VisualizationToggle({ value, onChange }: Props) {
  return (
    <div className="flex items-center gap-1 bg-white/60 rounded-full p-1 border border-gray-200">
      {options.map(opt => (
        <button
          key={opt.type}
          onClick={() => onChange(opt.type)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
            value === opt.type
              ? 'bg-green-700 text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <span>{opt.emoji}</span>
          <span className="hidden sm:inline">{opt.label}</span>
        </button>
      ))}
    </div>
  )
}
