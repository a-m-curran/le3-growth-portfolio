'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { ConversationPanel } from '@/components/panels/ConversationPanel'
import { getPillarPalette } from '@/lib/constants'

/**
 * Client view for /v2/career.
 *
 * Functionality matches v1 — same data, same generate/regenerate
 * flow, same copy-to-clipboard. Presentation is v2: pillar-tinted
 * cards, Apple-HIG-style layered surfaces, and the same
 * sentence-level provenance pattern the narrative view uses.
 *
 * Provenance on a career card lives in two places:
 *   - Inline source-conversation links inside `resumeLanguage` and
 *     `talkingPoints`. Sentences from the annotations array become
 *     clickable buttons; click → opens the source conversation in
 *     the existing ConversationPanel slide-out.
 *   - A collapsed "Built from N conversations" disclosure at the
 *     bottom of each card listing every conversation tagged with
 *     this skill, chronologically.
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

interface SkillDescription {
  skillId: string
  skillName: string
  resumeLanguage: string
  talkingPoints: string[]
  pillarName: string | null
  annotations: Annotation[]
  sources: Source[]
}

interface CareerOutput {
  resumeSummary: string
  skillDescriptions: SkillDescription[]
  version: number
  generatedAt: string | null
}

interface CareerResponse {
  output: CareerOutput | null
}

export function CareerView() {
  const [output, setOutput] = useState<CareerOutput | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [openConversationId, setOpenConversationId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/student/career', { cache: 'no-store' })
      .then(async r => {
        if (!r.ok) {
          const j = (await r.json().catch(() => ({}))) as { error?: string }
          throw new Error(j.error || `HTTP ${r.status}`)
        }
        return (await r.json()) as CareerResponse
      })
      .then(j => {
        if (!cancelled) {
          setOutput(j.output)
          setLoading(false)
        }
      })
      .catch(e => {
        if (!cancelled) {
          setError(String(e))
          setLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [])

  const handleGenerate = async () => {
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch('/api/career/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const j = await res.json()
      if (!res.ok) {
        setError(j.error || 'Failed to generate')
        setGenerating(false)
        return
      }
      const refreshed = await fetch('/api/student/career', { cache: 'no-store' })
      const refreshedJson = (await refreshed.json()) as CareerResponse
      setOutput(refreshedJson.output)
    } catch {
      setError('Something went wrong')
    } finally {
      setGenerating(false)
    }
  }

  const handleCopy = () => {
    if (!output) return
    navigator.clipboard?.writeText(output.resumeSummary).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  if (error && !output) {
    return (
      <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800">
        Couldn&rsquo;t load career output: {error}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-32 rounded-2xl bg-white border border-gray-200 animate-pulse" />
        <div className="h-40 rounded-2xl bg-white border border-gray-200 animate-pulse" />
      </div>
    )
  }

  if (!output) {
    return (
      <div className="rounded-2xl bg-white border border-gray-200 p-10 text-center">
        <p className="text-gray-600 mb-2">
          Translate your growth into resume-ready language.
        </p>
        <p className="text-xs text-gray-400 mb-5 max-w-md mx-auto">
          We&rsquo;ll synthesize your skill narratives into a professional summary, per-skill resume bullets, and interview talking points.
        </p>
        {generating ? (
          <div className="animate-pulse text-sm text-green-700">
            Synthesizing your narratives…
          </div>
        ) : (
          <button
            type="button"
            onClick={handleGenerate}
            className="px-5 py-2.5 bg-green-700 text-white rounded-lg text-sm font-medium hover:bg-green-800 transition-colors"
          >
            Generate career output
          </button>
        )}
        {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
      </div>
    )
  }

  return (
    <>
      <div className="space-y-8">
        {/* Professional Summary */}
        <section>
          <h2 className="text-xs uppercase tracking-wider font-semibold text-gray-500 mb-3">
            Professional Summary
          </h2>
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <p className="text-sm text-gray-800 leading-relaxed">{output.resumeSummary}</p>
            <div className="flex items-center gap-3 mt-4">
              <button
                type="button"
                onClick={handleCopy}
                className="text-xs font-medium px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
              >
                {copied ? 'Copied ✓' : 'Copy to clipboard'}
              </button>
              <span className="text-[11px] text-gray-400">v{output.version}</span>
            </div>
          </div>
        </section>

        {/* Skill Descriptions */}
        <section>
          <h2 className="text-xs uppercase tracking-wider font-semibold text-gray-500 mb-3">
            Skill Descriptions
          </h2>
          <div className="space-y-3">
            {output.skillDescriptions.map(sd => (
              <SkillCard
                key={sd.skillId}
                sd={sd}
                onOpenConversation={id => setOpenConversationId(id)}
              />
            ))}
          </div>
        </section>

        {/* Regenerate */}
        <div className="text-center pt-2">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating}
            className="text-xs text-gray-500 hover:text-gray-800 underline-offset-2 hover:underline disabled:opacity-50"
          >
            {generating ? 'Regenerating…' : 'Regenerate with latest narratives'}
          </button>
        </div>
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

function SkillCard({
  sd,
  onOpenConversation,
}: {
  sd: SkillDescription
  onOpenConversation: (id: string) => void
}) {
  const palette = getPillarPalette(sd.pillarName)
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
      <h3 className="font-semibold text-gray-900 mb-2">{sd.skillName}</h3>

      <ProseWithSources
        text={sd.resumeLanguage}
        annotations={sd.annotations}
        palette={palette}
        onOpenConversation={onOpenConversation}
        className="text-sm text-gray-700 leading-relaxed mb-4"
      />

      <p className="text-[11px] font-medium uppercase tracking-wider text-gray-500 mb-2">
        Interview talking points
      </p>
      <ul className="space-y-2">
        {sd.talkingPoints.map((tp, i) => (
          <li
            key={i}
            className="pl-3"
            style={{ borderLeft: `2px solid ${palette.surfaceBorder}80` }}
          >
            <ProseWithSources
              text={tp}
              annotations={sd.annotations}
              palette={palette}
              onOpenConversation={onOpenConversation}
              className="text-sm text-gray-700 leading-relaxed"
            />
          </li>
        ))}
      </ul>

      {sd.sources.length > 0 && (
        <SourcesDisclosure
          sources={sd.sources}
          palette={palette}
          onOpenConversation={onOpenConversation}
        />
      )}
    </article>
  )
}

// ─── Inline-linked prose (same pattern as NarrativeView) ──────

type Token =
  | { kind: 'text'; text: string }
  | { kind: 'link'; text: string; conversationId: string }

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
  className,
}: {
  text: string
  annotations: Annotation[]
  palette: ReturnType<typeof getPillarPalette>
  onOpenConversation: (id: string) => void
  className?: string
}) {
  const tokens = tokenize(text, annotations)
  return (
    <p className={className}>
      {tokens.map((t, ti) =>
        t.kind === 'text' ? (
          <span key={ti}>{t.text}</span>
        ) : (
          <button
            key={ti}
            type="button"
            onClick={() => onOpenConversation(t.conversationId)}
            className="text-left transition-colors"
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
}

// ─── Sources disclosure (same shape as NarrativeView) ────────

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
