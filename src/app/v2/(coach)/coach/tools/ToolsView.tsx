'use client'

import { useState } from 'react'
import { SyncStatusPanel } from '@/components/coach/SyncStatusPanel'
import { SyncInspectorPanel } from '@/components/coach/SyncInspectorPanel'
import { LTIInspectorPanel } from '@/components/coach/LTIInspectorPanel'
import { LiveActivityPanel } from '@/components/coach/LiveActivityPanel'
import { RecoverExtractionsPanel } from '@/components/coach/RecoverExtractionsPanel'
import { PasslinksPanel } from '@/components/coach/PasslinksPanel'
import type { SyncRun } from '@/lib/types'
import type { RosterRow } from '@/lib/auth/passlink-admin'

/**
 * Tabbed view of the admin observability panels. Reuses the existing
 * v1 components wholesale — each is already a self-contained client
 * component with its own data fetching and UI state.
 */
type Tab = 'sync' | 'lti' | 'activity' | 'passlinks'

interface ToolsViewProps {
  recentSyncRuns: SyncRun[]
  lastSuccessful: SyncRun | null
  passlinkRoster: RosterRow[]
}

export function ToolsView({ recentSyncRuns, lastSuccessful, passlinkRoster }: ToolsViewProps) {
  const [tab, setTab] = useState<Tab>('sync')

  return (
    <div>
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        <TabBtn label="Sync" active={tab === 'sync'} onClick={() => setTab('sync')} />
        <TabBtn label="LTI" active={tab === 'lti'} onClick={() => setTab('lti')} />
        <TabBtn label="Live Activity" active={tab === 'activity'} onClick={() => setTab('activity')} />
        <TabBtn label="Passlinks" active={tab === 'passlinks'} onClick={() => setTab('passlinks')} />
      </div>

      {tab === 'sync' && (
        <div className="space-y-5">
          <SyncStatusPanel recentRuns={recentSyncRuns} lastSuccessful={lastSuccessful} />
          <SyncInspectorPanel />
          <RecoverExtractionsPanel />
        </div>
      )}
      {tab === 'lti' && <LTIInspectorPanel />}
      {tab === 'activity' && <LiveActivityPanel />}
      {tab === 'passlinks' && <PasslinksPanel roster={passlinkRoster} />}
    </div>
  )
}

function TabBtn({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2 -mb-px border-b-2 text-sm transition-colors ${
        active
          ? 'border-green-700 text-green-900 font-medium'
          : 'border-transparent text-gray-500 hover:text-gray-900'
      }`}
    >
      {label}
    </button>
  )
}
