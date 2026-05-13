import { TodayView } from './TodayView'

/**
 * v2 Student Today — the "what should I do now" home for students.
 *
 * Lands here on:
 *   - Direct sign-in (replaces /garden as the post-auth destination)
 *   - LTI launch (the launched resource is pinned at the top)
 *
 * Layout sections:
 *   - LTI pinned: when arriving from Brightspace, the launched
 *     assignment surfaces as the top action
 *   - Featured work: submitted assignments not yet reflected on
 *   - Recent journal: open standalone reflections (the "something
 *     on my mind" kind, not work-tied)
 *   - Quick actions: start a journal entry, open growth view
 *   - This week summary: stats card
 */
export default function V2StudentTodayPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <TodayView />
    </div>
  )
}
