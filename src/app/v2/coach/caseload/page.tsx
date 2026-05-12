import { StubCard } from '@/components/v2/StubCard'

export default function V2CaseloadPage() {
  return (
    <StubCard
      title="Caseload"
      description="Browse all your assigned students. On desktop this will be a two-pane master/detail — list on the left, selected student summary on the right."
      willContain={[
        'Filterable list (needs attention / active this week / alphabetical)',
        'Per-row: name, last activity, skill highlights, attention flag',
        'Selecting a row opens the detail pane (or navigates on mobile)',
        'Persistent "selected student" updates the sidebar picker',
        'Empty state when caseload is empty (just-flushed, or fresh prod)',
      ]}
    />
  )
}
