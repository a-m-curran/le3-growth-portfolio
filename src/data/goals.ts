import type { StudentGoal } from '@/lib/types'

export const goals: StudentGoal[] = [
  // ─── AJA ──────────────────────────────────────────

  {
    id: 'goal_aja_f25_1',
    studentId: 'stu_aja',
    goalText: 'Ask for help at least once a week instead of trying to handle everything alone.',
    quarter: 'Fall 2025',
    status: 'completed',
    progressNotes: 'Writing center visit, study group attendance. Met goal consistently.',
    outcomeReflection: 'I did it more than once a week most weeks. It got easier.',
    carriedForward: false,
    createdAt: '2025-09-15T10:00:00Z',
  },
  {
    id: 'goal_aja_w26_1',
    studentId: 'stu_aja',
    goalText: 'Take initiative on something — start a group, propose an idea, don\'t wait for someone else.',
    quarter: 'Winter 2026',
    status: 'completed',
    progressNotes: 'Started the stats study group. Called professor proactively. Proposed survey redesign.',
    outcomeReflection: 'I went from needing permission to just doing things. The study group was the turning point.',
    carriedForward: false,
    previousGoalId: 'goal_aja_f25_1',
    createdAt: '2026-01-13T10:00:00Z',
  },
  {
    id: 'goal_aja_sp26_1',
    studentId: 'stu_aja',
    goalText: 'Apply critical thinking to topics I don\'t personally care about, not just things that hit close to home.',
    quarter: 'Spring 2026',
    status: 'active',
    progressNotes: 'Caught myself with the news article. Still mostly applies to personal topics though.',
    carriedForward: false,
    createdAt: '2026-04-07T10:00:00Z',
  },
  {
    id: 'goal_aja_sp26_2',
    studentId: 'stu_aja',
    goalText: 'Revise at least two skill definitions to reflect how my understanding has changed.',
    quarter: 'Spring 2026',
    status: 'completed',
    progressNotes: 'Revised Resilience and Creative Problem Solving definitions.',
    outcomeReflection: 'Both definitions feel more real now. They\'re mine, not just textbook words.',
    carriedForward: false,
    createdAt: '2026-04-07T10:00:00Z',
  },

  // ─── MARCUS ───────────────────────────────────────

  {
    id: 'goal_marcus_f25_1',
    studentId: 'stu_marcus',
    goalText: 'Learn to sit with setbacks instead of immediately trying to fix them.',
    quarter: 'Fall 2025',
    status: 'active',
    progressNotes: 'The C on the midterm paper was a test of this. Sat with it for 2 days. Progress.',
    carriedForward: true,
    createdAt: '2025-11-15T10:00:00Z',
  },
  {
    id: 'goal_marcus_sp26_1',
    studentId: 'stu_marcus',
    goalText: 'Continue mentoring Andre and learn from the experience of teaching others.',
    quarter: 'Spring 2026',
    status: 'active',
    progressNotes: 'Mentoring relationship is going well. Realizing I learn by teaching.',
    carriedForward: false,
    createdAt: '2026-04-01T10:00:00Z',
  },

  // ─── SOFIA ────────────────────────────────────────

  {
    id: 'goal_sofia_w26_1',
    studentId: 'stu_sofia',
    goalText: 'Stay in group work even when it gets uncomfortable. Practice not leaving.',
    quarter: 'Winter 2026',
    status: 'adjusted',
    progressNotes: 'Left one group project but recognized the pattern. Adjusted approach for spring.',
    carriedForward: true,
    createdAt: '2026-01-20T10:00:00Z',
  },
  {
    id: 'goal_sofia_sp26_1',
    studentId: 'stu_sofia',
    goalText: 'Speak up more in group settings — share ideas even when I think they might be rejected.',
    quarter: 'Spring 2026',
    status: 'active',
    progressNotes: 'Stayed through two disagreements in the new group. Offered alternative coding method.',
    carriedForward: false,
    previousGoalId: 'goal_sofia_w26_1',
    createdAt: '2026-04-01T10:00:00Z',
  },
]
