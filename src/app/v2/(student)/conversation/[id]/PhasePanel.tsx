'use client'

import { useState, useRef, useEffect } from 'react'
import { CONVERSATION } from '@/lib/constants'

/**
 * PhasePanel — one phase of the v2 interactive conversation flow.
 *
 * v2 design language: phase-color accent strip on the prompt card,
 * Apple-HIG-style layered surfaces, clean typography hierarchy.
 * The phase color is one of the three CONVERSATION constants
 * (blue / purple / green) so the visual progression is consistent.
 *
 * When `previousResponse` is provided, it renders above the prompt
 * as a quiet blockquote so the student can see what they just said
 * before answering the next question.
 *
 * Submit is disabled while the response is empty or while the
 * parent is awaiting the next-phase API response. Auto-focuses the
 * textarea on mount so the student can start typing immediately
 * (no extra click needed after a phase transition).
 */

interface Props {
  phase: 1 | 2 | 3
  prompt: string
  previousResponse?: string
  submitting?: boolean
  onSubmit: (response: string) => void
}

const PHASE_LABELS = {
  1: 'What happened',
  2: 'What you did',
  3: 'What it means',
} as const

const PHASE_COLORS = {
  1: CONVERSATION.phase1, // blue
  2: CONVERSATION.phase2, // purple
  3: CONVERSATION.phase3, // green
} as const

export function PhasePanel({ phase, prompt, previousResponse, submitting, onSubmit }: Props) {
  const [response, setResponse] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const color = PHASE_COLORS[phase]

  // Auto-focus on mount + on phase change so a transition flows
  // straight into typing.
  useEffect(() => {
    textareaRef.current?.focus()
  }, [phase])

  const canSubmit = response.trim().length > 0 && !submitting

  return (
    <div className="space-y-5">
      {/* Previous response — quoted, phase-color-coded by the
          phase it came from (so phase 2 quotes phase 1's color etc) */}
      {previousResponse && (
        <blockquote
          className="text-sm text-gray-600 italic pl-4 py-1 whitespace-pre-wrap"
          style={{
            borderLeft: `2px solid ${PHASE_COLORS[((phase - 1) as 1 | 2 | 3)] ?? '#cbd5e1'}66`,
          }}
        >
          &ldquo;{previousResponse}&rdquo;
        </blockquote>
      )}

      {/* Prompt card — phase-color top strip + body */}
      <div
        className="rounded-2xl bg-white shadow-sm overflow-hidden"
        style={{
          borderTopWidth: 3,
          borderTopStyle: 'solid',
          borderTopColor: color,
          borderRightWidth: 1,
          borderRightStyle: 'solid',
          borderRightColor: '#e5e7eb',
          borderBottomWidth: 1,
          borderBottomStyle: 'solid',
          borderBottomColor: '#e5e7eb',
          borderLeftWidth: 1,
          borderLeftStyle: 'solid',
          borderLeftColor: '#e5e7eb',
        }}
      >
        <div className="p-5">
          <div
            className="text-[10px] font-semibold uppercase tracking-wider mb-2"
            style={{ color }}
          >
            Phase {phase} · {PHASE_LABELS[phase]}
          </div>
          <p className="text-[15px] text-gray-900 leading-relaxed">{prompt}</p>
        </div>
      </div>

      {/* Response composer */}
      <div className="rounded-2xl bg-white border border-gray-200 shadow-sm overflow-hidden">
        <textarea
          ref={textareaRef}
          value={response}
          onChange={e => setResponse(e.target.value)}
          placeholder="Take your time. Type what comes to mind…"
          rows={6}
          disabled={submitting}
          className="w-full px-5 py-4 text-[15px] text-gray-800 leading-relaxed resize-y focus:outline-none disabled:opacity-60"
        />
        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-gray-50/40">
          <span className="text-[11px] text-gray-400">
            {response.trim().length === 0
              ? 'Press the button when you’re ready to continue'
              : `${response.trim().split(/\s+/).length} word${response.trim().split(/\s+/).length === 1 ? '' : 's'}`}
          </span>
          <button
            type="button"
            onClick={() => canSubmit && onSubmit(response.trim())}
            disabled={!canSubmit}
            className="px-5 py-2 rounded-full text-sm font-medium text-white transition-all disabled:cursor-not-allowed"
            style={{
              backgroundColor: canSubmit ? color : '#94a3b8',
              opacity: canSubmit ? 1 : 0.55,
              boxShadow: canSubmit ? `0 4px 12px ${color}33` : 'none',
            }}
          >
            {submitting ? 'Thinking…' : phase === 3 ? 'Wrap up' : 'Continue →'}
          </button>
        </div>
      </div>
    </div>
  )
}
