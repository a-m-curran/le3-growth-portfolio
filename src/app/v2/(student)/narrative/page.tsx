import { NarrativeView } from './NarrativeView'

/**
 * v2 Narrative — your growth story per skill.
 *
 * Renders the synthesized narrative for each active skill, grouped
 * by pillar. Each narrative is a paragraph (or several) written
 * from the student's conversations, definitions, and assessments,
 * showing how their understanding of that skill has evolved.
 *
 * Data flows through /api/student/narrative which:
 *   - in demo mode, reads the static skill-narratives seed
 *   - in real mode, queries the latest skill_narrative per skill
 *
 * The page is intentionally read-heavy — long, flowing prose. The
 * v2 styling pulls the pillar tint into each card's left edge so
 * the page still has color organization while keeping focus on
 * the writing.
 */
export default function V2NarrativePage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Narrative</h1>
        <p className="text-sm text-gray-500 mt-1">
          Your story for each skill, built from how you talk about your work.
        </p>
      </div>
      <NarrativeView />
    </div>
  )
}
