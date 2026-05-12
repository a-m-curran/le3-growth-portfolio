import { StubCard } from '@/components/v2/StubCard'

export default function V2CoachTodayPage() {
  return (
    <StubCard
      title="Today"
      description="Your daily triage. Students who need outreach, scheduled sessions, recent activity. Designed so on a normal day this is the only screen you check."
      willContain={[
        'Attention items with specific reasons (e.g. “Aja hasn\'t reflected in 3 weeks”, “Marcus had an error mid-conversation yesterday”)',
        'Today\'s sessions (stubbed for now — we\'ll integrate scheduling once NLU tells us what they use)',
        'Compressed Live Activity feed (just notable events, not every LLM call)',
        'Quick actions: Sync now, View full caseload',
      ]}
    />
  )
}
