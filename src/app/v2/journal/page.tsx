import { StubCard } from '@/components/v2/StubCard'

export default function V2JournalPage() {
  return (
    <StubCard
      title="Journal"
      description="Open standalone reflections — the “something on my mind” kind, not tied to a specific submitted assignment. Process whatever's coming up for you, with the same 3-phase AI-guided structure."
      willContain={[
        '“What’s on your mind?” prompt + start button',
        'In-progress journal entries',
        'Past entries with synthesis previews',
        'Same ConversationPanel for read-back',
        'Privacy note: journal entries are not surfaced to instructors',
      ]}
    />
  )
}
