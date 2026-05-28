'use client'

import { useState } from 'react'

/**
 * Inline editor for a student's skill definition (3 fields). Posts to
 * /api/student/skill-definition which writes a new version. On success,
 * calls onSaved (the panel triggers router.refresh()).
 */

interface SkillDefinitionEditorProps {
  skillId: string
  initialDefinition: string | null
  initialPersonalExample: string | null
  initialWhyItMatters: string | null
  onSaved: () => void
  onCancel: () => void
}

export function SkillDefinitionEditor({
  skillId,
  initialDefinition,
  initialPersonalExample,
  initialWhyItMatters,
  onSaved,
  onCancel,
}: SkillDefinitionEditorProps) {
  const [definitionText, setDefinitionText] = useState(initialDefinition ?? '')
  const [personalExample, setPersonalExample] = useState(initialPersonalExample ?? '')
  const [whyItMatters, setWhyItMatters] = useState(initialWhyItMatters ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSave = definitionText.trim().length > 0 && !saving

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const r = await fetch('/api/student/skill-definition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skillId,
          definitionText,
          personalExample,
          whyItMatters,
        }),
      })
      const data = (await r.json()) as { ok?: boolean; error?: string }
      if (!r.ok || !data.ok) throw new Error(data.error || `HTTP ${r.status}`)
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          What this skill means to me
        </label>
        <textarea
          value={definitionText}
          onChange={e => setDefinitionText(e.target.value)}
          rows={3}
          className="w-full text-sm border border-gray-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-green-600"
          placeholder="In your own words…"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          A time it showed up <span className="text-gray-400">(optional)</span>
        </label>
        <textarea
          value={personalExample}
          onChange={e => setPersonalExample(e.target.value)}
          rows={2}
          className="w-full text-sm border border-gray-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-green-600"
          placeholder="A moment when you used it…"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Why it matters to me <span className="text-gray-400">(optional)</span>
        </label>
        <textarea
          value={whyItMatters}
          onChange={e => setWhyItMatters(e.target.value)}
          rows={2}
          className="w-full text-sm border border-gray-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-green-600"
          placeholder="What it gives you…"
        />
      </div>

      {error && <p className="text-xs text-red-700">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={save}
          disabled={!canSave}
          className="rounded-lg bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white px-3 py-1.5 text-sm font-medium"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="rounded-lg border border-gray-300 hover:bg-gray-50 px-3 py-1.5 text-sm"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
