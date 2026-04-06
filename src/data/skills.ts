import type { DurableSkill } from '@/lib/types'

export const skills: DurableSkill[] = [
  {
    id: 'skill_creative_problem_solving',
    pillarId: 'pillar_creative',
    name: 'Creative Problem Solving',
    description: 'Approaching challenges from novel angles, questioning default approaches, combining ideas across domains',
    displayOrder: 1,
    isActive: true,
  },
  {
    id: 'skill_critical_thinking',
    pillarId: 'pillar_creative',
    name: 'Critical Thinking',
    description: 'Analyzing information carefully, questioning assumptions, evaluating evidence, distinguishing fact from opinion',
    displayOrder: 2,
    isActive: true,
  },
  {
    id: 'skill_self_directed_learning',
    pillarId: 'pillar_creative',
    name: 'Self-Directed Learning',
    description: 'Identifying learning needs, seeking resources independently, learning without external structure',
    displayOrder: 3,
    isActive: true,
  },
  {
    id: 'skill_resilience',
    pillarId: 'pillar_lead',
    name: 'Resilience',
    description: 'Navigating setbacks, adapting plans, seeking help when needed, recovering from failure, managing stress productively',
    displayOrder: 1,
    isActive: true,
  },
  {
    id: 'skill_initiative',
    pillarId: 'pillar_lead',
    name: 'Initiative',
    description: 'Acting without being prompted, creating opportunities, volunteering, proposing new approaches, stepping into leadership',
    displayOrder: 2,
    isActive: true,
  },
]
