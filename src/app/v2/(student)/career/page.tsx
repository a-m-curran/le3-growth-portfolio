import { CareerView } from './CareerView'

/**
 * v2 Career — resume-ready translation of the student's growth.
 *
 * Two sections:
 *   - Professional Summary: a single paragraph synthesizing the
 *     student's overall growth into language they can paste into a
 *     resume or cover letter
 *   - Skill Descriptions: per-skill resume language + 3-5 interview
 *     talking points, tinted by pillar
 *
 * Data flows through /api/student/career which reads the latest
 * career_output row (or the static demo seed in demo mode).
 */
export default function V2CareerPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Career</h1>
        <p className="text-sm text-gray-500 mt-1">
          How to talk about your growth — in resumes, in interviews, in your own words.
        </p>
      </div>
      <CareerView />
    </div>
  )
}
