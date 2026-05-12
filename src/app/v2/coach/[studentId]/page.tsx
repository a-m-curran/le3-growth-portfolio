import { StubCard } from '@/components/v2/StubCard'

interface Props {
  params: { studentId: string }
  searchParams: { tab?: string }
}

export default function V2StudentDetailPage({ params, searchParams }: Props) {
  const tab = searchParams.tab || 'prep'
  return (
    <StubCard
      title={`Student detail — ${params.studentId.slice(0, 8)}…`}
      description={`Deep view of one student. Currently on tab: "${tab}". Tabs swap content in the same shell so the coach doesn't lose sidebar context.`}
      willContain={[
        'Header: student name, cohort, last session date, attention flags',
        'Tabs: Prep (default) / Portfolio / Notes',
        'Prep: recent conversations (clickable to read full), patterns to explore, active goals, note capture',
        'Portfolio: their Garden view in read-only mode',
        'Notes: chronological list of coach notes + new-note form',
        'Selecting a different student from sidebar dropdown navigates here with new id',
      ]}
    />
  )
}
