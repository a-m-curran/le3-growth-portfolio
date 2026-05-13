'use client'

import { useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { ConversationPanel } from '@/components/panels/ConversationPanel'
import { GrowthGrid } from '@/components/v2/growth/GrowthGrid'
import type { CoachNote, GardenData, SessionPrepData } from '@/lib/types'

/**
 * v2 Student Detail view — coach's deep view of one student.
 *
 * Receives pre-fetched data for all three tabs from the server.
 * Tab switching is client-side via URL query param (?tab=prep/portfolio/notes)
 * so deep-links work and refresh preserves position.
 *
 * Tabs:
 *   prep      — recent conversations (each opens ConversationPanel),
 *               patterns to explore, active goals
 *   portfolio — read-only Garden visualization
 *   notes     — chronological coach note history
 *
 * Designed so prep is the daily-driver tab; portfolio + notes are
 * available for deeper context.
 */

type Tab = 'prep' | 'portfolio' | 'notes'

interface StudentDetailViewProps {
  student: {
    id: string
    firstName: string
    lastName: string
    cohort: string | null
  }
  sessionPrep: SessionPrepData | null
  garden: GardenData | null
  notes: CoachNote[]
  initialTab: Tab
}

export function StudentDetailView({
  student,
  sessionPrep,
  garden,
  notes,
  initialTab,
}: StudentDetailViewProps) {
  const [tab, setTabState] = useState<Tab>(initialTab)
  const [openConversationId, setOpenConversationId] = useState<string | null>(null)

  const setTab = (next: Tab) => {
    setTabState(next)
    // Push the tab change to the URL so reload / share-link preserves
    // position. Use shallow replaceState rather than router.push so
    // we don't trigger a server re-render.
    const url = new URL(window.location.href)
    if (next === 'prep') {
      url.searchParams.delete('tab')
    } else {
      url.searchParams.set('tab', next)
    }
    window.history.replaceState(null, '', url.toString())
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* Header */}
      <Header
        student={student}
        recentConversationCount={sessionPrep?.recentConversations.length ?? 0}
        notesCount={notes.length}
        garden={garden}
      />

      {/* Tab nav */}
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        <TabBtn label="Prep" active={tab === 'prep'} onClick={() => setTab('prep')} />
        <TabBtn label="Portfolio" active={tab === 'portfolio'} onClick={() => setTab('portfolio')} />
        <TabBtn
          label={`Notes${notes.length > 0 ? ` (${notes.length})` : ''}`}
          active={tab === 'notes'}
          onClick={() => setTab('notes')}
        />
      </div>

      {/* Tab content */}
      {tab === 'prep' && (
        <PrepTab
          sessionPrep={sessionPrep}
          onOpenConversation={id => setOpenConversationId(id)}
        />
      )}
      {tab === 'portfolio' && <PortfolioTab garden={garden} />}
      {tab === 'notes' && <NotesTab notes={notes} student={student} />}

      {/* Conversation panel triggered from Prep tab. (Portfolio's
          SkillPanel handles its own conversation drill-throughs
          internally via GrowthGrid.) */}
      <AnimatePresence>
        {openConversationId && (
          <ConversationPanel
            conversationId={openConversationId}
            onClose={() => setOpenConversationId(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Header ─────────────────────────────────────

function Header({
  student,
  recentConversationCount,
  notesCount,
  garden,
}: {
  student: StudentDetailViewProps['student']
  recentConversationCount: number
  notesCount: number
  garden: GardenData | null
}) {
  return (
    <div className="mb-6 flex items-center gap-4">
      <div className="w-14 h-14 rounded-full bg-green-100 text-green-800 flex items-center justify-center text-lg font-semibold shrink-0">
        {((student.firstName[0] || '') + (student.lastName[0] || '')).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <h1 className="text-2xl font-bold text-gray-900">
          {student.firstName} {student.lastName}
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {student.cohort && `${student.cohort} · `}
          {recentConversationCount} recent reflection
          {recentConversationCount === 1 ? '' : 's'} · {notesCount} note
          {notesCount === 1 ? '' : 's'}
          {garden && (
            <>
              {' · '}
              {garden.plants.length} skill{garden.plants.length === 1 ? '' : 's'} tracked
            </>
          )}
        </p>
      </div>
    </div>
  )
}

// ─── Tabs ───────────────────────────────────────

function PrepTab({
  sessionPrep,
  onOpenConversation,
}: {
  sessionPrep: SessionPrepData | null
  onOpenConversation: (id: string) => void
}) {
  if (!sessionPrep) {
    return (
      <Card>
        <p className="text-sm text-gray-500 italic">
          No session prep available yet. Once this student has completed
          a few conversations, you&rsquo;ll see them here.
        </p>
      </Card>
    )
  }

  const { recentConversations, patterns, currentGoals } = sessionPrep

  return (
    <div className="space-y-5">
      {/* Recent conversations */}
      <Card>
        <SectionHeader
          title="Recent conversations"
          meta={`${recentConversations.length} since last session`}
        />
        {recentConversations.length === 0 ? (
          <EmptyState message="No recent conversations." />
        ) : (
          <ul className="space-y-2">
            {recentConversations.map(c => {
              const workTitle =
                (c as unknown as { workTitle?: string }).workTitle || 'Reflection'
              const date = new Date(c.startedAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              })
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => onOpenConversation(c.id)}
                    className="w-full text-left p-3 rounded-lg bg-gray-50 border border-gray-100 hover:border-green-400 hover:bg-white hover:shadow-sm transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm">📝</span>
                      <span className="text-sm font-medium text-gray-700">{workTitle}</span>
                      <span className="text-xs text-gray-400">({date})</span>
                      <span className="ml-auto text-xs text-gray-400">Read →</span>
                    </div>
                    {c.suggestedInsight && (
                      <p className="text-xs text-gray-600 ml-6">{c.suggestedInsight}</p>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      {/* Patterns */}
      {patterns.length > 0 && (
        <Card>
          <SectionHeader
            title="Patterns to explore"
            meta={`${patterns.length} observation${patterns.length === 1 ? '' : 's'}`}
          />
          <ul className="space-y-2">
            {patterns.map((p, i) => (
              <li
                key={i}
                className="p-3 rounded-lg bg-amber-50/50 border border-amber-100 text-sm text-gray-800"
              >
                {p}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Goals */}
      {currentGoals.length > 0 && (
        <Card>
          <SectionHeader title="Active goals" />
          <ul className="space-y-2">
            {currentGoals.map(goal => (
              <li key={goal.id} className="text-sm">
                <p className="text-gray-700">{goal.goalText}</p>
                {goal.progressNotes && (
                  <p className="text-xs text-gray-500 mt-0.5">{goal.progressNotes}</p>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}

function PortfolioTab({ garden }: { garden: GardenData | null }) {
  if (!garden) {
    return (
      <Card>
        <p className="text-sm text-gray-500 italic">
          Portfolio not available — this student hasn&rsquo;t generated
          any skill data yet.
        </p>
      </Card>
    )
  }
  // Reuse the same pillar-grouped layout as the student's own /v2/growth
  // page. Visual coherence between "what the student sees" and "what the
  // coach sees when looking at the same student" is the point — pillar
  // tints, artwork-per-skill, hover trailers and skill-detail drill-in
  // all work the same way here.
  return <GrowthGrid data={garden} />
}

function NotesTab({
  notes,
  student,
}: {
  notes: CoachNote[]
  student: StudentDetailViewProps['student']
}) {
  return (
    <div className="space-y-4">
      <Card>
        <SectionHeader
          title="New note"
          subtitle={`Capture a thought about ${student.firstName}`}
        />
        <p className="text-xs text-gray-500 italic">
          Note-capture form will hook up to /api/coach/note in a later
          pass — for now the v1 form on the existing /coach/{student.id}/prep
          page is the canonical capture surface.
        </p>
      </Card>

      <Card>
        <SectionHeader
          title="Note history"
          meta={`${notes.length} total`}
        />
        {notes.length === 0 ? (
          <EmptyState message="No notes yet." />
        ) : (
          <ul className="space-y-3">
            {notes.map(n => (
              <li key={n.id} className="p-3 rounded-lg bg-gray-50 border border-gray-100">
                <div className="flex items-baseline justify-between mb-1.5">
                  <span className="text-xs font-semibold text-gray-700">
                    {new Date(n.sessionDate).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                  <span className="text-[10px] uppercase tracking-wider text-gray-400">
                    {n.contactMethod}
                  </span>
                </div>
                <p className="text-sm text-gray-800 whitespace-pre-wrap">{n.noteText}</p>
                {n.brightSpot && (
                  <p className="text-xs text-green-700 mt-2">
                    <span className="font-semibold">Bright spot:</span> {n.brightSpot}
                  </p>
                )}
                {n.nextStep && (
                  <p className="text-xs text-blue-700 mt-1">
                    <span className="font-semibold">Next step:</span> {n.nextStep}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}

// ─── Primitives ─────────────────────────────────

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-5">{children}</div>
}

function SectionHeader({
  title,
  subtitle,
  meta,
}: {
  title: string
  subtitle?: string
  meta?: React.ReactNode
}) {
  return (
    <div className="flex items-baseline justify-between mb-3">
      <div>
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      {meta && <span className="text-xs text-gray-500">{meta}</span>}
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return <p className="text-sm text-gray-500 italic py-2">{message}</p>
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
