import { StubCard } from '@/components/v2/StubCard'

export default function V2ReflectPage() {
  return (
    <StubCard
      title="Reflect"
      description="Reflect on submitted student work. Work-tied conversations live here — each card represents an assignment you've submitted, in progress or completed. Open reflections (the “something on my mind” kind) live under Journal instead."
      willContain={[
        'In-progress reflections (resume cards)',
        'Completed work reflections, grouped by quarter',
        'Click a card → opens the conversation slide-out (full prompts + responses + synthesis)',
        'Quick-start: pick a recent submission to reflect on',
        'Empty state when D2L hasn\'t synced anything to reflect on',
      ]}
    />
  )
}
