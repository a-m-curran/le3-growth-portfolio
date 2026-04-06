import type { Rubric } from '@/lib/types'

export const rubrics: Rubric[] = [
  {
    id: 'rubric_cps',
    skillId: 'skill_creative_problem_solving',
    version: 1,
    externalDescriptors: [
      'Solutions closely replicate examples or templates with no deviation from prescribed format.',
      'Single-draft submissions with no evidence of iteration or alternative approaches.',
      'Does not engage with peers\' creative work.',
    ],
    introjectedDescriptors: [
      'Solutions show minor variations from templates but remain structurally safe.',
      'Evidence of self-censorship: brainstorming shows ideas generated then abandoned.',
      'Shares ideas tentatively with disclaimers.',
    ],
    identifiedDescriptors: [
      'Solutions depart meaningfully from templates in at least one structural dimension.',
      'Evidence of deliberate experimentation with multiple approaches explored.',
      'Asks genuine questions about peers\' creative approaches.',
    ],
    integratedDescriptors: [
      'Solutions demonstrate original reframing of the problem itself.',
      'Integrates methods from outside the domain with a personal creative methodology visible across assignments.',
      'Builds on peers\' ideas in unexpected directions.',
    ],
    intrinsicDescriptors: [
      'Creative sophistication exceeds requirements, explored further because they wanted to.',
      'Contains playful elements and unexpected connections.',
      'Self-directed side projects documented for their own sake.',
    ],
    isCurrent: true,
  },
  {
    id: 'rubric_ct',
    skillId: 'skill_critical_thinking',
    version: 1,
    externalDescriptors: [
      'Arguments restate source material without evaluation.',
      'Claims supported by single sources with no counterarguments addressed.',
      'Does not challenge peers\' claims in discussions.',
    ],
    introjectedDescriptors: [
      'Frameworks applied formulaically with multiple sources cited but listed rather than synthesized.',
      'Counterarguments mentioned but dismissed.',
      'Quality higher on graded work than ungraded.',
    ],
    identifiedDescriptors: [
      'Genuinely compares and contrasts sources with at least one counterargument substantively engaged.',
      'Identifies assumptions and revision history shows deepening of reasoning.',
      'Asks probing questions and revises position based on new evidence.',
    ],
    integratedDescriptors: [
      'Steel-mans opposing arguments and evaluates evidence quality.',
      'Consistent analytical rigor across required and optional work.',
      'Seeks disconfirming evidence proactively and models intellectual humility.',
    ],
    intrinsicDescriptors: [
      'Tackles questions beyond assignment scope for their own sake.',
      'Playful engagement with complexity: edge cases, paradoxes, and methodological puzzles.',
      'Self-directed analytical projects with time invested exceeding what incentives justify.',
    ],
    isCurrent: true,
  },
  {
    id: 'rubric_cur',
    skillId: 'skill_curiosity',
    version: 1,
    externalDescriptors: [
      'Research limited to assigned sources with questions restated from prompts.',
      'No evidence of self-directed inquiry or follow-up.',
      'Does not ask follow-up questions in discussions.',
    ],
    introjectedDescriptors: [
      'Questions are strategic, asked to appear engaged rather than genuinely explore.',
      'Research stays within safe, familiar boundaries.',
      'Asks questions publicly that they already know the answer to.',
    ],
    identifiedDescriptors: [
      'Research extends beyond assigned sources into self-selected territory.',
      'At least one tangent pursued with documented reasoning.',
      'Evidence of self-directed research such as additional sources and follow-up reading.',
    ],
    integratedDescriptors: [
      'Cross-domain inquiry pulling insights from outside the immediate subject.',
      'Self-generated research questions that reframe assignments.',
      'Self-directed learning plans maintained independently.',
    ],
    intrinsicDescriptors: [
      'Investigations extend far beyond requirements with evident delight.',
      'Explores edge cases, paradoxes, and what-if scenarios for their own sake.',
      'Side projects, reading lists, and question journals maintained voluntarily.',
    ],
    isCurrent: true,
  },
  {
    id: 'rubric_ini',
    skillId: 'skill_initiative',
    version: 1,
    externalDescriptors: [
      'Completes only explicitly assigned tasks with no optional elements.',
      'No evidence of anticipating next steps or identifying unaddressed needs.',
      'In group contexts, waits for assignment rather than volunteering.',
    ],
    introjectedDescriptors: [
      'Takes visible but safe actions, volunteering for low-risk, high-visibility tasks.',
      'Asks permission frequently beyond what the task requires.',
      'Monitors whether initiative is noticed.',
    ],
    identifiedDescriptors: [
      'At least one self-initiated contribution per project that addresses an identified need.',
      'Anticipates at least one future requirement.',
      'Suggests improvements to group process.',
    ],
    integratedDescriptors: [
      'Consistently identifies and acts on opportunities across projects.',
      'Creates deliverables that weren\'t assigned but add clear value.',
      'Quality doesn\'t depend on visibility; self-starts without external triggers.',
    ],
    intrinsicDescriptors: [
      'Creates entirely new opportunities and structures that benefit others.',
      'Proactive contributions exceed any possible external reward.',
      'Builds cultures of ownership and mentors agency in others.',
    ],
    isCurrent: true,
  },
  {
    id: 'rubric_emp',
    skillId: 'skill_empathy',
    version: 1,
    externalDescriptors: [
      'Perspective-taking is superficial, restating others\' positions without demonstrating understanding.',
      'Stakeholder analyses miss emotional or contextual dimensions.',
      'Minimal acknowledgment of peers\' contributions or experiences.',
    ],
    introjectedDescriptors: [
      'Perspective-taking is present but formulaic, following a template rather than demonstrating genuine insight.',
      'Validates others to avoid disapproval and people-pleases.',
      'Avoids hard conversations.',
    ],
    identifiedDescriptors: [
      'Perspective-taking shows genuine insight, identifying non-obvious emotional or contextual factors.',
      'Proactively seeks diverse perspectives beyond what is required.',
      'Offers honest rather than comfortable feedback.',
    ],
    integratedDescriptors: [
      'Empathic insight woven through all work, not just assignments that require it.',
      'Navigates conflict with care and creates space for diverse voices naturally.',
      'Deep, authentic connections.',
    ],
    intrinsicDescriptors: [
      'Empathic sophistication exceeds requirements.',
      'Seeks out complex human dynamics for their own sake.',
      'Creates work that helps others develop empathic capacity.',
    ],
    isCurrent: true,
  },
  {
    id: 'rubric_com',
    skillId: 'skill_communication',
    version: 1,
    externalDescriptors: [
      'Writes to meet minimum requirements with no audience adaptation.',
      'Structure follows templates exactly with formulaic introductions and conclusions.',
      'Peer feedback is vague and does not ask clarifying questions.',
    ],
    introjectedDescriptors: [
      'Surface polish is high but substance is hedged with overuse of qualifiers and passive voice.',
      'Tone is formal beyond what the context requires.',
      'Gives only positive, non-specific peer feedback and avoids constructive criticism.',
    ],
    identifiedDescriptors: [
      'Audience analysis is visible with tone and vocabulary shifting between tasks.',
      'Structure serves the argument, not the template, with substantive revisions.',
      'Gives specific, actionable peer feedback.',
    ],
    integratedDescriptors: [
      'Distinct authorial voice recognizable across submissions.',
      'Sophisticated audience adaptation in framing, evidence, and structure.',
      'Takes clear positions even on difficult topics.',
    ],
    intrinsicDescriptors: [
      'Writing demonstrates craft beyond functional clarity with rhythm, precision, and creative structure.',
      'Produces voluntary contributions that exceed requirements.',
      'Experiments with communication approaches and studies communication beyond course requirements.',
    ],
    isCurrent: true,
  },
  {
    id: 'rubric_ada',
    skillId: 'skill_adaptability',
    version: 1,
    externalDescriptors: [
      'When conditions change, output shows no adjustment or only surface-level changes.',
      'Clings to the original plan even when feedback suggests a different direction.',
      'Does not adjust communication style based on team feedback.',
    ],
    introjectedDescriptors: [
      'Adjusts when told to, but adjustments track authority\'s position rather than own assessment.',
      'Revision history shows pivots that correlate with feedback timing rather than new understanding.',
      'Monitors others before committing.',
    ],
    identifiedDescriptors: [
      'When conditions change, adjusts with documented reasoning reflecting genuine reassessment.',
      'Revision history shows deliberate replanning with annotations.',
      'Willing to suggest team pivots with reasoning.',
    ],
    integratedDescriptors: [
      'Consistently incorporates new information fluidly across projects.',
      'Planning documents build in contingency thinking from the start.',
      'Helps teams navigate transitions and reframes setbacks as opportunities.',
    ],
    intrinsicDescriptors: [
      'Voluntarily seeks out high-ambiguity challenges.',
      'Output quality peaks during complexity rather than stability.',
      'Creates adaptive approaches that others adopt.',
    ],
    isCurrent: true,
  },
  {
    id: 'rubric_res',
    skillId: 'skill_resilience',
    version: 1,
    externalDescriptors: [
      'Work quality drops sharply after setbacks with incomplete submissions following challenging feedback.',
      'Abandons approach at first obstacle with no troubleshooting visible.',
      'Does not seek support when struggling.',
    ],
    introjectedDescriptors: [
      'Persists, but quality is driven by ego preservation.',
      'Interprets setbacks as personal threats and hides struggles.',
      'Avoids asking for help until crisis point.',
    ],
    identifiedDescriptors: [
      'After setbacks, subsequent submissions show specific incorporation of failure feedback.',
      'Seeks support proactively and shares challenges with peers without shame.',
      'Coping strategies are visible and deliberate.',
    ],
    integratedDescriptors: [
      'Consistent quality through periods of difficulty.',
      'Treats failure as diagnostic information with learning that improves work across projects.',
      'Supports others authentically through difficulty.',
    ],
    intrinsicDescriptors: [
      'Voluntarily takes on challenges beyond comfort zone.',
      'Produces highest-quality work under the most demanding conditions.',
      'Creates frameworks that help others navigate difficulty.',
    ],
    isCurrent: true,
  },
  {
    id: 'rubric_col',
    skillId: 'skill_collaboration',
    version: 1,
    externalDescriptors: [
      'Group contributions are minimal, late, or disconnected from teammates\' ideas.',
      'Completes sub-tasks in isolation with no participation in planning or synthesis.',
      'Communication logs show minimal engagement.',
    ],
    introjectedDescriptors: [
      'Reliable but safe contributions, taking visible tasks over essential invisible ones.',
      'Avoids positions that could cause disagreement and agrees with proposals quickly.',
      'Takes on extra work to avoid confrontation rather than addressing issues.',
    ],
    identifiedDescriptors: [
      'Contributions reflect awareness of collective direction and attempt to strengthen it.',
      'Seeks input from quieter members and engages in productive disagreement.',
      'References teammates\' work in communication logs.',
    ],
    integratedDescriptors: [
      'Contributions designed with integration in mind; takes coordination and synthesis roles naturally.',
      'Elevates teammates\' contributions and navigates conflict directly.',
      'Creates space for productive disagreement.',
    ],
    intrinsicDescriptors: [
      'Creates collaborative structures beyond what is assigned.',
      'Deliverables reflect genuine collective intelligence.',
      'Initiates collaboration in non-required contexts and brings complementary perspectives together.',
    ],
    isCurrent: true,
  },
  {
    id: 'rubric_net',
    skillId: 'skill_networking',
    version: 1,
    externalDescriptors: [
      'Networking assignments completed minimally with contact lists limited to existing connections.',
      'No evidence of outreach beyond requirements.',
      'No follow-up communication after initial outreach.',
    ],
    introjectedDescriptors: [
      'Outreach follows templates with connections strategic for appearance.',
      'Follow-up is formulaic and activity spikes around assignments.',
      'Seeks status-enhancing connections.',
    ],
    identifiedDescriptors: [
      'Outreach is personalized, not templated, with contacts selected for genuine relevance.',
      'Follow-up demonstrates remembered details and maintains contacts over time.',
      'Shares networking opportunities with peers.',
    ],
    integratedDescriptors: [
      'Extensive network maintained through genuine relationship investment.',
      'Creates value for contacts proactively, not transactionally.',
      'Natural connector role and active community member.',
    ],
    intrinsicDescriptors: [
      'Creates networking opportunities for others and builds professional communities.',
      'Networking activity exceeds any strategic benefit.',
      'Investment in professional ecosystem dramatically exceeds personal return.',
    ],
    isCurrent: true,
  },
  {
    id: 'rubric_rel',
    skillId: 'skill_relationship_building',
    version: 1,
    externalDescriptors: [
      'No evidence of trust-building behaviors or vulnerability in professional contexts.',
      'No follow-up or relationship maintenance visible.',
      'Minimal investment in peer relationships beyond task requirements.',
    ],
    introjectedDescriptors: [
      'Relationship maintenance visible but driven by guilt or obligation.',
      'Over-accommodates and avoids difficult conversations.',
      'Prioritizes being liked over mutual authenticity.',
    ],
    identifiedDescriptors: [
      'Evidence of deepening relationships over time with personalized communication and remembered details.',
      'Invests in relationships beyond immediate utility.',
      'Willing to have harder conversations.',
    ],
    integratedDescriptors: [
      'Rich network of meaningful relationships that persist across contexts and time.',
      'Navigates conflict constructively and initiates difficult conversations.',
      'Models healthy boundaries.',
    ],
    intrinsicDescriptors: [
      'Creates relational infrastructure that strengthens community.',
      'Investment in others\' relational development.',
      'Quality of relationships exceeds any strategic benefit.',
    ],
    isCurrent: true,
  },
  {
    id: 'rubric_soc',
    skillId: 'skill_social_awareness',
    version: 1,
    externalDescriptors: [
      'Analyses of social situations miss obvious dynamics with no cultural consideration.',
      'Communication tone identical regardless of context.',
      'Unaware of own impact on group dynamics.',
    ],
    introjectedDescriptors: [
      'Social analysis follows rules or checklists rather than demonstrating genuine insight.',
      'Overconforms and is highly sensitive to status and belonging.',
      'Avoids speaking up to maintain acceptance.',
    ],
    identifiedDescriptors: [
      'Analyses of social situations identify at least one non-obvious dynamic.',
      'Communication adaptation reflects genuine consideration, not just rule-following.',
      'Advocates for inclusion and is aware of power dynamics.',
    ],
    integratedDescriptors: [
      'Consistently considers social and cultural dynamics across all work.',
      'Creates inclusive communication naturally and adapts proactively.',
      'Continues learning about unfamiliar cultural contexts.',
    ],
    intrinsicDescriptors: [
      'Creates socially aware frameworks that benefit communities.',
      'Navigates multicultural complexity with evident engagement.',
      'Self-directed learning about social dynamics far beyond requirements.',
    ],
    isCurrent: true,
  },
]
