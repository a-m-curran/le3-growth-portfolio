import { StubCard } from '@/components/v2/StubCard'

export default function V2MePage() {
  return (
    <StubCard
      title="Me"
      description="Profile, settings, and account controls."
      willContain={[
        'Your name, NLU ID, cohort, coach',
        'Privacy / data-handling preferences (re-show consent notice)',
        'Notification preferences (once PWA push is wired)',
        'Sign out',
        'For coaches: program-level settings + sync schedule',
      ]}
    />
  )
}
