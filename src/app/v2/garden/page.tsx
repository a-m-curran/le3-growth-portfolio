import { StubCard } from '@/components/v2/StubCard'

export default function V2GardenPage() {
  return (
    <StubCard
      title="Garden"
      description="Your growth visualization. Same Garden / Mountain / Cityscape views as today, but using the full desktop canvas instead of a 768px-capped column."
      willContain={[
        'Visualization toggle (Garden / Mountain / Cityscape)',
        'Pillar groups with plants sized by activity',
        'Tap a plant → skill detail panel slides in from the right',
        'Definition evolution highlights',
        'Quarter / cohort filters',
      ]}
    />
  )
}
