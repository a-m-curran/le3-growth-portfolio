'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { ConversationPanel } from '@/components/panels/ConversationPanel'
import { getPillarPalette } from '@/lib/constants'

/**
 * Client view for /v2/narrative.
 *
 * Renders per-skill growth-story cards grouped by pillar. Each
 * card carries a pillar-color left stripe (matching the rest of
 * the v2 IA) and the prose itself is post-processed so specific
 * sentences become inline links to the source conversation.
 *
 * Two provenance affordances:
 *   1. Inline-linked sentences inside the narrative prose. Each
 *      annotated sentence is wrapped in a small button styled with
 *      a subtle pillar-colored bottom border. On click → opens the
 *      source conversation in the existing ConversationPanel slide-out.
 *   2. A collapsed "Built from N conversations" disclosure at the
 *      bottom of each card. Expanding it lists every conversation
 *      tagged with this skill, chronologically. Each row is itself
 *      a click target.
 *
 * The renderer is forgiving: if an annotated sentence doesn't appear
 * verbatim in the text (e.g. because the narrative was regenerated
 * and the annotation went stale), it silently drops the annotation
 * rather than breaking the render.
 */

interface Annotation {
  sentence: string
  conversationId: string
}

interface Source {
  id: string
  workTitle: string
  date: string
}

interface Narrative {
  skillId: string
  skillName: string
  pillarId: string
  pillarName: string | null
  narrativeText: string | null
  narrativeRichness: string | null
  version: number
  generatedAt: string | null
  annotations: Annotation[]
  sources: Source[]
}

interface NarrativeResponse {
  narratives: Narrative[]
}

export function NarrativeView() {
  const [data, setData] = useState<NarrativeResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [openConversationId, setOpenConversationId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/student/narrative', { cache: 'no-store' })
      .then(async r => {
        if (!r.ok) {
          const j = (await r.json().catch(() => ({}))) as { error?: string }
          throw new Error(j.error || `HTTP ${r.status}`)
        }
        return (await r.json()) as NarrativeResponse
      })
      .then(j => { if (!cancelled) setData(j) })
      .catch(e => { if (!cancelled) setError(String(e)) })
    return () => { cancelled = true }
  }, [])

  if (error) {
    return (
      <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800">
        Couldn&rsquo;t load narratives: {error}
      </div>
    )
  }
  if (data === null) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-32 rounded-2xl bg-white border border-gray-200 animate-pulse" />
        ))}
      </div>
    )
  }

  const pillarGroups = new Map<string, { pillarName: string; items: Narrative[] }>()
  for (const n of data.narratives) {
    const key = n.pillarId
    if (!pillarGroups.has(key)) {
      pillarGroups.set(key, { pillarName: n.pillarName ?? '', items: [] })
    }
    pillarGroups.get(key)!.items.push(n)
  }

  return (
    <>
      <div className="space-y-8">
        {Array.from(pillarGroups.values()).map(group => {
          const p = getPillarPalette(group.pillarName)
          return (
            <section key={group.pillarName}>
              <h2
                className="text-xs uppercase tracking-wider font-semibold mb-3"
                style={{ color: p.surfaceText }}
              >
                {group.pillarName}
              </h2>
              <div className="space-y-3">
                {group.items.map(n => (
                  <NarrativeCard
                    key={n.skillId}
                    item={n}
                    onOpenConversation={id => setOpenConversationId(id)}
                  />
                ))}
              </div>
            </section>
          )
        })}
      </div>

      <AnimatePresence>
        {openConversationId && (
          <ConversationPanel
            conversationId={openConversationId}
            onClose={() => setOpenConversationId(null)}
          />
        )}
      </AnimatePresence>
    </>
  )
}

function NarrativeCard({
  item,
  onOpenConversation,
}: {
  item: Narrative
  onOpenConversation: (conversationId: string) => void
}) {
  const [text, setText] = useState(item.narrativeText)
  const [richness, setRichness] = useState(item.narrativeRichness)
  const [annotations, setAnnotations] = useState(item.annotations)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const palette = getPillarPalette(item.pillarName)

  const handleGenerate = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/narrative/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skillId: item.skillId }),
      })
      const j = await res.json()
      if (!res.ok) {
        setError(j.error || 'Failed to generate')
        setLoading(false)
        return
      }
      setText(j.narrativeText)
      setRichness(j.richness)
      // Real-mode regeneration doesn't return annotations yet —
      // they'd come from a post-processing pass that isn't wired
      // up. Clear the current ones rather than leave stale links
      // pointing at the wrong sentences.
      setAnnotations([])
    } catch {
      setError('Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const richnessTone =
    richness === 'rich'
      ? { bg: '#dcfce7', text: '#166534', label: 'rich' }
      : richness === 'developing'
      ? { bg: '#fef3c7', text: '#92400e', label: 'developing' }
      : richness === 'thin'
      ? { bg: '#f1f5f9', text: '#475569', label: 'thin' }
      : null

  return (
    <article
      className="bg-white rounded-xl p-5 transition-shadow hover:shadow-sm"
      style={{
        borderLeftWidth: 3,
        borderLeftStyle: 'solid',
        borderLeftColor: palette.surfaceBorder,
        borderTopWidth: 1,
        borderTopStyle: 'solid',
        borderTopColor: '#e5e7eb',
        borderRightWidth: 1,
        borderRightStyle: 'solid',
        borderRightColor: '#e5e7eb',
        borderBottomWidth: 1,
        borderBottomStyle: 'solid',
        borderBottomColor: '#e5e7eb',
      }}
    >
      <div className="flex items-start justify-between mb-3">
        <h3 className="font-semibold text-gray-900">{item.skillName}</h3>
        <div className="flex items-center gap-2 shrink-0">
          {richnessTone && (
            <span
              className="text-[10px] px-2 py-0.5 rounded-full font-medium uppercase tracking-wider"
              style={{ backgroundColor: richnessTone.bg, color: richnessTone.text }}
            >
              {richnessTone.label}
            </span>
          )}
          {item.version > 0 && (
            <span className="text-[10px] text-gray-400">v{item.version}</span>
          )}
        </div>
      </div>

      {text ? (
        <>
          <ProseWithSources
            text={text}
            annotations={annotations}
            palette={palette}
            onOpenConversation={onOpenConversation}
          />
          {item.sources.length > 0 && (
            <SourcesDisclosure
              sources={item.sources}
              palette={palette}
              onOpenConversation={onOpenConversation}
            />
          )}
          <div className="mt-4 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={loading}
              className="text-[11px] font-medium px-2.5 py-1 rounded-md transition-colors disabled:opacity-50"
              style={{
                backgroundColor: palette.surface,
                color: palette.surfaceText,
                border: `1px solid ${palette.surfaceBorder}88`,
              }}
              title="Regenerate this narrative from the latest conversations"
            >
              {loading ? 'Regenerating…' : 'Regenerate'}
            </button>
            {item.generatedAt && (
              <p className="text-[11px] text-gray-400">
                Generated {new Date(item.generatedAt).toLocaleDateString('en-US', {
                  month: 'short', day: 'numeric', year: 'numeric',
                })}
              </p>
            )}
          </div>
          {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
        </>
      ) : loading ? (
        <div className="py-6 text-center">
          <div className="animate-pulse text-sm" style={{ color: palette.surfaceText }}>
            Generating narrative…
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Analyzing conversations and building your growth story
          </p>
        </div>
      ) : (
        <>
          <p className="text-sm text-gray-400 italic mb-3">
            No narrative generated yet for this skill.
          </p>
          <button
            type="button"
            onClick={handleGenerate}
            className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
            style={{
              backgroundColor: palette.surface,
              color: palette.surfaceText,
              border: `1px solid ${palette.surfaceBorder}`,
            }}
          >
            Generate Narrative
          </button>
          {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
        </>
      )}
    </article>
  )
}

// ─── Inline-linked prose rendering ─────────────────────────────

type Token =
  | { kind: 'text'; text: string }
  | { kind: 'link'; text: string; conversationId: string }

/**
 * Walk through `text` and split it into tokens based on
 * `annotations`. Each annotated sentence becomes a `link` token at
 * its first occurrence; the rest stays plain text. Used inside
 * each paragraph below.
 *
 * Each annotation links the FIRST occurrence only — same sentence
 * appearing twice (rare) only gets linked once, on purpose.
 */
function tokenize(text: string, annotations: Annotation[]): Token[] {
  let tokens: Token[] = [{ kind: 'text', text }]
  for (const ann of annotations) {
    const next: Token[] = []
    let consumed = false
    for (const tk of tokens) {
      if (tk.kind === 'link' || consumed) {
        next.push(tk)
        continue
      }
      const idx = tk.text.indexOf(ann.sentence)
      if (idx < 0) {
        next.push(tk)
        continue
      }
      const before = tk.text.slice(0, idx)
      const after = tk.text.slice(idx + ann.sentence.length)
      if (before) next.push({ kind: 'text', text: before })
      next.push({ kind: 'link', text: ann.sentence, conversationId: ann.conversationId })
      if (after) next.push({ kind: 'text', text: after })
      consumed = true
    }
    tokens = next
  }
  return tokens
}

function ProseWithSources({
  text,
  annotations,
  palette,
  onOpenConversation,
}: {
  text: string
  annotations: Annotation[]
  palette: ReturnType<typeof getPillarPalette>
  onOpenConversation: (id: string) => void
}) {
  // Split on blank lines to preserve paragraph structure; tokenize
  // each paragraph independently so links don't cross paragraph
  // boundaries.
  const paragraphs = text.split(/\n\n+/)
  return (
    <div className="space-y-3">
      {paragraphs.map((para, pi) => {
        const tokens = tokenize(para, annotations)
        return (
          <p
            key={pi}
            className="text-sm text-gray-700 leading-relaxed"
          >
            {tokens.map((t, ti) =>
              t.kind === 'text' ? (
                <span key={ti}>{t.text}</span>
              ) : (
                <button
                  key={ti}
                  type="button"
                  onClick={() => onOpenConversation(t.conversationId)}
                  className="text-left transition-colors hover:bg-opacity-100"
                  style={{
                    color: 'inherit',
                    backgroundColor: 'transparent',
                    borderBottom: `1px dotted ${palette.surfaceBorder}`,
                    padding: 0,
                    cursor: 'pointer',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.backgroundColor = palette.surface
                    e.currentTarget.style.borderBottomStyle = 'solid'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.backgroundColor = 'transparent'
                    e.currentTarget.style.borderBottomStyle = 'dotted'
                  }}
                  title="Open the source conversation"
                >
                  {t.text}
                </button>
              )
            )}
          </p>
        )
      })}
    </div>
  )
}

// ─── Sources disclosure ────────────────────────────────────────

function SourcesDisclosure({
  sources,
  palette,
  onOpenConversation,
}: {
  sources: Source[]
  palette: ReturnType<typeof getPillarPalette>
  onOpenConversation: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="mt-4 pt-3 border-t border-gray-100">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="text-[11px] font-medium text-gray-500 hover:text-gray-800 flex items-center gap-1"
        aria-expanded={open}
      >
        <span
          className="inline-block transition-transform"
          style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}
          aria-hidden="true"
        >
          ▸
        </span>
        Built from {sources.length} conversation{sources.length === 1 ? '' : 's'}
      </button>
      {open && (
        <ul className="mt-2 space-y-1">
          {sources.map(s => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => onOpenConversation(s.id)}
                className="w-full text-left flex items-baseline gap-2 px-2 py-1 rounded text-xs text-gray-700 hover:bg-gray-50 transition-colors"
                style={{
                  borderLeft: `2px solid ${palette.surfaceBorder}66`,
                  paddingLeft: 8,
                }}
              >
                <span className="font-medium truncate">{s.workTitle}</span>
                <span className="text-gray-400 shrink-0 ml-auto">
                  {new Date(s.date).toLocaleDateString('en-US', {
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
