import type { Rubric } from '@/lib/types'

export const rubrics: Rubric[] = [
  {
    id: 'rubric_cps',
    skillId: 'skill_creative_problem_solving',
    version: 1,
    noticingDescriptors: [
      'Recognizes when a problem exists',
      'Notices when standard approaches may not work',
      'Begins to wonder about alternative methods',
    ],
    practicingDescriptors: [
      'Actively looks for different ways to approach problems',
      'Experiments with combining ideas from different sources',
      'Tries at least one non-obvious solution before defaulting',
    ],
    integratingDescriptors: [
      'Consistently generates novel approaches across different contexts',
      'Draws connections between unrelated domains to solve problems',
      'Helps others see problems from new angles',
    ],
    evolvingDescriptors: [
      'Creates frameworks for creative thinking that others adopt',
      'Mentors peers in creative problem-solving approaches',
      'Demonstrates innovative thinking as a natural habit',
    ],
    isCurrent: true,
  },
  {
    id: 'rubric_ct',
    skillId: 'skill_critical_thinking',
    version: 1,
    noticingDescriptors: [
      'Begins to question information rather than accepting it at face value',
      'Notices when sources may be biased or incomplete',
      'Starts distinguishing between opinion and evidence',
    ],
    practicingDescriptors: [
      'Actively evaluates evidence before forming conclusions',
      'Identifies assumptions in arguments and reasoning',
      'Seeks out multiple perspectives on issues',
    ],
    integratingDescriptors: [
      'Systematically analyzes complex information across contexts',
      'Synthesizes contradictory evidence into nuanced positions',
      'Teaches others to evaluate sources and reasoning',
    ],
    evolvingDescriptors: [
      'Models rigorous analytical thinking as a habit of mind',
      'Creates structures that help communities think more critically',
      'Navigates ambiguity with intellectual humility',
    ],
    isCurrent: true,
  },
  {
    id: 'rubric_sdl',
    skillId: 'skill_self_directed_learning',
    version: 1,
    noticingDescriptors: [
      'Recognizes when they need to learn something new',
      'Notices gaps between what they know and what a task requires',
      'Begins to seek help when stuck',
    ],
    practicingDescriptors: [
      'Identifies specific learning goals and pursues them',
      'Seeks out resources independently (tutorials, mentors, books)',
      'Creates own study plans or learning routines',
    ],
    integratingDescriptors: [
      'Learns complex skills across domains without external prompting',
      'Builds learning into daily routines and work habits',
      'Shares learning strategies with peers',
    ],
    evolvingDescriptors: [
      'Designs own learning pathways for professional growth',
      'Mentors others in self-directed learning approaches',
      'Demonstrates lifelong learning as a core identity',
    ],
    isCurrent: true,
  },
  {
    id: 'rubric_res',
    skillId: 'skill_resilience',
    version: 1,
    noticingDescriptors: [
      'Recognizes when they are experiencing a setback',
      'Notices emotional responses to difficulty',
      'Begins to distinguish between giving up and needing help',
    ],
    practicingDescriptors: [
      'Actively uses strategies to manage setbacks',
      'Seeks help when needed rather than isolating',
      'Reframes failures as learning opportunities',
    ],
    integratingDescriptors: [
      'Adapts plans fluidly when circumstances change',
      'Balances self-reliance with knowing when to ask for support',
      'Helps others navigate setbacks',
    ],
    evolvingDescriptors: [
      'Models resilient behavior for communities',
      'Creates support structures for others facing adversity',
      'Demonstrates growth through challenge as a consistent pattern',
    ],
    isCurrent: true,
  },
  {
    id: 'rubric_init',
    skillId: 'skill_initiative',
    version: 1,
    noticingDescriptors: [
      'Notices opportunities to contribute or act',
      'Recognizes when something needs to be done',
      'Begins to volunteer for tasks without being asked',
    ],
    practicingDescriptors: [
      'Regularly takes action without waiting for direction',
      'Proposes new ideas or improvements',
      'Steps into leadership roles when needed',
    ],
    integratingDescriptors: [
      'Consistently creates opportunities rather than waiting for them',
      'Leads projects and initiatives across different contexts',
      'Inspires initiative in others through example',
    ],
    evolvingDescriptors: [
      'Builds systems that encourage initiative in communities',
      'Mentors emerging leaders',
      'Demonstrates proactive leadership as a defining trait',
    ],
    isCurrent: true,
  },
]
