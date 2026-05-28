'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { pillarStripeStyle } from '@/components/v2/PillarStripe'
import { InProgressBanner } from '@/components/v2/student/InProgressBanner'
import { InProgressInterstitial } from '@/components/v2/student/InProgressInterstitial'
import { RecentSubmissions } from '@/components/v2/student/RecentSubmissions'
import { useStartReflection } from '@/components/v2/student/use-start-reflection'
import type { ActiveInProgress, SubmissionItem } from '@/components/v2/student/types'

/**
 * Student-side Today view (post-redesign).
 *
 * Stack (top → bottom):
 *   1. Greeting / hero
 *   2. LTI pinned (when arriving from Brightspace) — unchanged
 *   3. InProgressBanner (if activeInProgress)
 *   4. RecentSubmissions (10 most recent actionable, newest first)
 *   5. WeekStatsCard — unchanged
 *   6. RecentJournalSection — unchanged
 *   7. QuickActions — unchanged
 *
 * Click routing on submissions is delegated to useStartReflection
 * (shared with ReflectView).
 */

interface TodayResponse {
  activeInProgress: ActiveInProgress | null
  submissions: SubmissionItem[]
  recentJournal: Array<{
    id: string
    startedAt: string
    description: string | null
    synthesisExcerpt: string | null
    primaryPillar?: string | null
  }>
  weekStats: {
    conversationsCompleted: number
    workSubmitted: number
  }
  ltiPinned: {
    resourceLinkId: string
    title: string
    courseTitle: string | null
  } | null
}

export function TodayView() {
  const router = useRouter()
  const [data, setData] = useState<TodayResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const refresh = useCallback(() => setReloadKey(k => k + 1), [])

  useEffect(() => {
    let cancelled = false
    fetch('/api/student/today', { cache: 'no-store' })
      .then(async r => {
        if (!r.ok) {
          const j = (await r.json().catch(() => ({}))) as { error?: string }
          throw new Error(j.error || `HTTP ${r.status}`)
        }
        return (await r.json()) as TodayResponse
      })
      .then(j => { if (!cancelled) setData(j) })
      .catch(e => { if (!cancelled) setError(String(e)) })
    return () => { cancelled = true }
  }, [reloadKey])

  const { onSubmissionClick, interstitialFor, closeInterstitial, startError } =
    useStartReflection({ active: data?.activeInProgress ?? null, onRefresh: refresh })

  if (error) {
    return (
      <Card>
        <p className="text-sm text-red-700">Couldn&rsquo;t load Today: {error}</p>
      </Card>
    )
  }
  if (data === null) {
    return (
      <div className="space-y-4">
        <div className="h-24 rounded-2xl bg-white border border-gray-200 animate-pulse" />
        <div className="h-32 rounded-2xl bg-white border border-gray-200 animate-pulse" />
        <div className="h-20 rounded-2xl bg-white border border-gray-200 animate-pulse" />
      </div>
    )
  }

  const totalActionable =
    (data.ltiPinned ? 1 : 0) +
    data.submissions.filter(s => s.status === 'unreflected').length
  const hasAnyContent =
    totalActionable > 0 ||
    data.recentJournal.length > 0 ||
    data.weekStats.conversationsCompleted > 0 ||
    data.weekStats.workSubmitted > 0

  return (
    <div className="space-y-5">
      <div className="mb-2">
        <h1 className="text-2xl font-bold text-gray-900">Today</h1>
        <p className="text-sm text-gray-500 mt-1">
          {totalActionable > 0
            ? `${totalActionable} piece${totalActionable === 1 ? '' : 's'} of work waiting for you`
            : hasAnyContent
            ? `You're caught up. Nothing waiting on you right now.`
            : `Your portfolio fills in as you submit work.`}
        </p>
      </div>

      {data.ltiPinned && (
        <LtiPinnedCard
          pinned={data.ltiPinned}
          onStart={() =>
            router.push(`/v2/reflect/start?lti=${data.ltiPinned!.resourceLinkId}`)
          }
        />
      )}

      {data.activeInProgress && (
        <InProgressBanner active={data.activeInProgress} onDiscarded={refresh} />
      )}

      {startError && <p className="text-xs text-red-700">{startError}</p>}

      <RecentSubmissions
        submissions={data.submissions}
        activeInProgress={data.activeInProgress}
        onRowClick={onSubmissionClick}
      />

      <WeekStatsCard stats={data.weekStats} />

      <RecentJournalSection
        items={data.recentJournal}
        onOpen={id => router.push(`/v2/journal?entry=${id}`)}
      />

      <QuickActions
        onStartJournal={() => router.push('/v2/journal?new=1')}
        onOpenGrowth={() => router.push('/v2/growth')}
      />

      {interstitialFor && data.activeInProgress && (
        <InProgressInterstitial
          active={data.activeInProgress}
          newWork={interstitialFor}
          onClose={closeInterstitial}
          onStarted={refresh}
        />
      )}
    </div>
  )
}

// ─── Sections (LTI / WeekStats / RecentJournal / QuickActions — unchanged) ───

function LtiPinnedCard({
  pinned,
  onStart,
}: {
  pinned: { resourceLinkId: string; title: string; courseTitle: string | null }
  onStart: () => void
}) {
  return (
    <Card emphasis="green">
      <div className="text-[10px] uppercase tracking-wider font-semibold text-green-700 mb-1">
        From Brightspace
      </div>
      <h2 className="text-base font-semibold text-gray-900 leading-snug">{pinned.title}</h2>
      {pinned.courseTitle && (
        <p className="text-xs text-gray-500 mt-0.5">{pinned.courseTitle}</p>
      )}
      <button
        type="button"
        onClick={onStart}
        className="mt-3 px-4 py-2 text-sm font-medium rounded-lg bg-green-700 text-white hover:bg-green-800 transition-colors"
      >
        Start reflecting →
      </button>
    </Card>
  )
}

function WeekStatsCard({ stats }: { stats: TodayResponse['weekStats'] }) {
  if (stats.conversationsCompleted === 0 && stats.workSubmitted === 0) return null
  return (
    <Card>
      <SectionHeader title="This week" />
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Reflections" value={stats.conversationsCompleted} />
        <Stat label="Submitted" value={stats.workSubmitted} />
      </div>
    </Card>
  )
}

function RecentJournalSection({
  items,
  onOpen,
}: {
  items: TodayResponse['recentJournal']
  onOpen: (id: string) => void
}) {
  if (items.length === 0) return null
  return (
    <Card>
      <SectionHeader title="Recent journal entries" subtitle="Your private reflections" />
      <ul className="space-y-2">
        {items.map(j => (
          <li key={j.id}>
            <button
              type="button"
              onClick={() => onOpen(j.id)}
              className="w-full text-left pl-3 pr-3 py-3 rounded-lg hover:bg-gray-50 transition-colors"
              style={pillarStripeStyle(j.primaryPillar)}
            >
              <p className="text-sm text-gray-700 line-clamp-1">
                {j.description || 'Reflection'}
              </p>
              {j.synthesisExcerpt && (
                <p className="text-xs text-gray-500 mt-1 italic line-clamp-2">
                  {j.synthesisExcerpt}
                </p>
              )}
              <p className="text-[11px] text-gray-400 mt-1.5">
                {formatRelative(j.startedAt)}
              </p>
            </button>
          </li>
        ))}
      </ul>
    </Card>
  )
}

function QuickActions({
  onStartJournal,
  onOpenGrowth,
}: {
  onStartJournal: () => void
  onOpenGrowth: () => void
}) {
  return (
    <Card>
      <SectionHeader title="Other things you can do" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onStartJournal}
          className="px-4 py-3 text-sm font-medium rounded-lg bg-white border border-gray-200 hover:border-green-400 hover:bg-green-50/30 text-left transition-colors"
        >
          <span className="text-gray-900 font-semibold block">Open journal</span>
          <span className="text-xs text-gray-500">Reflect on whatever&rsquo;s on your mind</span>
        </button>
        <button
          type="button"
          onClick={onOpenGrowth}
          className="px-4 py-3 text-sm font-medium rounded-lg bg-white border border-gray-200 hover:border-green-400 hover:bg-green-50/30 text-left transition-colors"
        >
          <span className="text-gray-900 font-semibold block">See your growth</span>
          <span className="text-xs text-gray-500">How your skills are growing</span>
        </button>
      </div>
    </Card>
  )
}

// ─── Primitives (unchanged from prior file) ─────────

function Card({
  children,
  emphasis,
}: {
  children: React.ReactNode
  emphasis?: 'green'
}) {
  const ringClass =
    emphasis === 'green'
      ? 'ring-1 ring-green-200 border-green-200 bg-green-50/30'
      : 'border-gray-200 bg-white'
  return (
    <div className={`rounded-2xl border shadow-sm p-5 ${ringClass}`}>{children}</div>
  )
}

function SectionHeader({
  title,
  subtitle,
}: {
  title: string
  subtitle?: string
}) {
  return (
    <div className="mb-3">
      <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
      {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-gray-50 border border-gray-100 p-3 text-center">
      <div className="text-2xl font-semibold text-gray-900">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-gray-500 mt-0.5">
        {label}
      </div>
    </div>
  )
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime()
  const days = Math.floor((Date.now() - then) / (24 * 60 * 60 * 1000))
  if (days < 1) return 'today'
  if (days < 2) return 'yesterday'
  if (days < 7) return `${days} days ago`
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`
  return `${Math.floor(days / 30)} months ago`
}
