'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Student-side Today view.
 *
 * Renders a stack of focused cards:
 *   1. LTI pinned (when arriving from Brightspace) — the launched
 *      resource as the top action
 *   2. Featured work — submitted assignments awaiting reflection
 *   3. This week — count card (conversations + uploads)
 *   4. Recent journal — last few open reflections
 *   5. Quick actions — start a journal entry, open the garden
 *
 * Designed so on most visits, the top card answers "what should I do
 * now?" within one glance.
 */

interface TodayResponse {
  featuredWork: Array<{
    id: string
    title: string
    courseName: string | null
    submittedAt: string | null
    workType: string | null
    /**
     * Demo mode only: id of the existing conversation for this work,
     * used to route to the /v2/conversation/[id] replay. Real mode
     * leaves this absent (featuredWork is unreflected work) and the
     * card routes to the /v2/reflect/start stub instead.
     */
    conversationId?: string | null
  }>
  recentJournal: Array<{
    id: string
    startedAt: string
    description: string | null
    synthesisExcerpt: string | null
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
  }, [])

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
    (data.ltiPinned ? 1 : 0) + data.featuredWork.length
  const hasAnyContent =
    totalActionable > 0 || data.recentJournal.length > 0 ||
    data.weekStats.conversationsCompleted > 0 || data.weekStats.workSubmitted > 0

  return (
    <div className="space-y-5">
      {/* Hero / greeting line */}
      <div className="mb-2">
        <h1 className="text-2xl font-bold text-gray-900">Today</h1>
        <p className="text-sm text-gray-500 mt-1">
          {totalActionable > 0
            ? `${totalActionable} thing${totalActionable === 1 ? '' : 's'} to reflect on`
            : hasAnyContent
            ? `You're up to date — nothing waiting on you right now`
            : `Welcome — your portfolio will fill in as you submit work`}
        </p>
      </div>

      {/* LTI pinned card */}
      {data.ltiPinned && (
        <LtiPinnedCard
          pinned={data.ltiPinned}
          onStart={() =>
            router.push(`/v2/reflect/start?lti=${data.ltiPinned!.resourceLinkId}`)
          }
        />
      )}

      {/* Featured work */}
      <FeaturedWorkSection
        items={data.featuredWork}
        onSelect={item => {
          // Demo mode: each featured item carries a conversationId so
          // we deep-link into the replay. Real mode: no conversation
          // yet (the whole point of "featured" is "unreflected"), so
          // we land on the start stub.
          if (item.conversationId) {
            router.push(`/v2/conversation/${item.conversationId}`)
          } else {
            router.push(`/v2/reflect/start?work=${item.id}`)
          }
        }}
      />

      {/* Week stats */}
      <WeekStatsCard stats={data.weekStats} />

      {/* Recent journal */}
      <RecentJournalSection
        items={data.recentJournal}
        onOpen={id => router.push(`/v2/journal?entry=${id}`)}
      />

      {/* Quick actions */}
      <QuickActions
        onStartJournal={() => router.push('/v2/journal?new=1')}
        onOpenGarden={() => router.push('/v2/garden')}
      />
    </div>
  )
}

// ─── Sections ───────────────────────────────────

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
      <h2 className="text-base font-semibold text-gray-900 leading-snug">
        {pinned.title}
      </h2>
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

function FeaturedWorkSection({
  items,
  onSelect,
}: {
  items: TodayResponse['featuredWork']
  onSelect: (item: TodayResponse['featuredWork'][number]) => void
}) {
  if (items.length === 0) return null
  return (
    <Card>
      <SectionHeader title="Submitted work" subtitle="Reflect on what you've turned in" />
      <ul className="space-y-2">
        {items.map(w => (
          <li key={w.id}>
            <button
              type="button"
              onClick={() => onSelect(w)}
              className="w-full text-left flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{w.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {w.courseName && `${w.courseName} · `}
                  {w.submittedAt ? `Submitted ${formatRelative(w.submittedAt)}` : 'Recently added'}
                </p>
              </div>
              <span className="text-gray-400 shrink-0">→</span>
            </button>
          </li>
        ))}
      </ul>
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
              className="w-full text-left p-3 rounded-lg hover:bg-gray-50 transition-colors"
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
  onOpenGarden,
}: {
  onStartJournal: () => void
  onOpenGarden: () => void
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
          onClick={onOpenGarden}
          className="px-4 py-3 text-sm font-medium rounded-lg bg-white border border-gray-200 hover:border-green-400 hover:bg-green-50/30 text-left transition-colors"
        >
          <span className="text-gray-900 font-semibold block">See your garden</span>
          <span className="text-xs text-gray-500">How your skills are growing</span>
        </button>
      </div>
    </Card>
  )
}

// ─── Primitives ─────────────────────────────────

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
