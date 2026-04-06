import type { DurableSkill } from '@/lib/types'

export const skills: DurableSkill[] = [
  // ─── Pillar 1: Creative & Curious Thinkers ─────────
  {
    id: 'skill_creative_problem_solving',
    pillarId: 'pillar_creative',
    name: 'Creative Problem Solving',
    description: 'Generates original solutions; reframes problems to find new pathways.',
    displayOrder: 1,
    isActive: true,
  },
  {
    id: 'skill_critical_thinking',
    pillarId: 'pillar_creative',
    name: 'Critical Thinking',
    description: 'Analyzes information deeply; evaluates evidence before making decisions.',
    displayOrder: 2,
    isActive: true,
  },
  {
    id: 'skill_curiosity',
    pillarId: 'pillar_creative',
    name: 'Curiosity',
    description: 'Asks meaningful questions; seeks to understand beyond surface-level answers.',
    displayOrder: 3,
    isActive: true,
  },

  // ─── Pillar 2: Leaders with Purpose & Agency ───────
  {
    id: 'skill_initiative',
    pillarId: 'pillar_lead',
    name: 'Initiative',
    description: 'Takes proactive steps; does not wait to be told what to do.',
    displayOrder: 1,
    isActive: true,
  },
  {
    id: 'skill_empathy',
    pillarId: 'pillar_lead',
    name: 'Empathy',
    description: "Understands and respects others' feelings and perspectives; integrates this understanding into leadership.",
    displayOrder: 2,
    isActive: true,
  },
  {
    id: 'skill_communication',
    pillarId: 'pillar_lead',
    name: 'Communication',
    description: 'Clearly articulates ideas verbally and in writing for different audiences.',
    displayOrder: 3,
    isActive: true,
  },

  // ─── Pillar 3: Thrivers in Change ──────────────────
  {
    id: 'skill_adaptability',
    pillarId: 'pillar_thrive',
    name: 'Adaptability',
    description: 'Adjusts approach as new information or challenges arise; adjusts effectively when conditions change.',
    displayOrder: 1,
    isActive: true,
  },
  {
    id: 'skill_resilience',
    pillarId: 'pillar_thrive',
    name: 'Resilience',
    description: 'Perseveres through challenges; maintains effort despite obstacles.',
    displayOrder: 2,
    isActive: true,
  },

  // ─── Pillar 4: Network Builders ───────────────────
  {
    id: 'skill_collaboration',
    pillarId: 'pillar_network',
    name: 'Collaboration',
    description: 'Works well with others toward shared goals, even in stressful contexts.',
    displayOrder: 1,
    isActive: true,
  },
  {
    id: 'skill_networking',
    pillarId: 'pillar_network',
    name: 'Networking',
    description: 'Builds professional connections across contexts.',
    displayOrder: 2,
    isActive: true,
  },
  {
    id: 'skill_relationship_building',
    pillarId: 'pillar_network',
    name: 'Relationship Building',
    description: 'Develops and maintains meaningful relationships.',
    displayOrder: 3,
    isActive: true,
  },
  {
    id: 'skill_social_awareness',
    pillarId: 'pillar_network',
    name: 'Social Awareness',
    description: 'Reads social context; navigates group dynamics effectively.',
    displayOrder: 4,
    isActive: true,
  },

  // ─── Legacy (inactive) ────────────────────────────
  {
    id: 'skill_self_directed_learning',
    pillarId: 'pillar_creative',
    name: 'Self-Directed Learning',
    description: 'Identifying learning needs, seeking resources independently, learning without external structure',
    displayOrder: 99,
    isActive: false,
  },
]
