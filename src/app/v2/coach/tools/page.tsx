import { StubCard } from '@/components/v2/StubCard'

export default function V2ToolsPage() {
  return (
    <StubCard
      title="Tools"
      description="Admin and debug surfaces — Sync Inspector, LTI Inspector, Live Activity. Currently gated to ADMIN_EMAILS only so they're off the daily-driver path for other coaches."
      willContain={[
        'Tabbed view: Sync · LTI · Live Activity · System Health',
        'Same Inspector panels we already built, just relocated off the main coach dashboard',
        'Maybe: settings for sync schedule, manual flush controls',
        'May split off into its own /admin route family eventually',
      ]}
    />
  )
}
