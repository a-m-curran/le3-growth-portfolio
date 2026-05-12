import { StubCard } from '@/components/v2/StubCard'

export default function V2TodayPage() {
  return (
    <StubCard
      title="Today"
      description="What you should do right now. Surfaces the one thing waiting on you — usually a submitted assignment you haven't reflected on yet, or the LTI-launched resource if you arrived from Brightspace."
      willContain={[
        'Pinned LTI resource (when launched from Brightspace)',
        'Featured assignments: submitted to D2L but not yet reflected on',
        'Recent journal entries (your private reflections)',
        '“Start something new” quick action',
        'Quick-stat card: this week’s activity',
      ]}
    />
  )
}
