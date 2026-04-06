import type {
  Student,
  StudentWork,
  GrowthConversation,
  StudentSkillDefinition,
  SkillAssessment,
  SdtLevel,
} from './types'

// ─── LLM CONFIG ──────────────────────────────────────

export const MODEL = 'claude-sonnet-4-5-20250929'
export const TEMPERATURE = 0.4
export const MAX_TOKENS = 500

// ─── CONVERSATION CONTEXT ────────────────────────────

export interface ConversationContext {
  student: Student
  work: StudentWork
  conversation: Partial<GrowthConversation>
  previousConversations: (GrowthConversation & { work?: StudentWork | null })[]
  currentDefinitions: StudentSkillDefinition[]
  skillLevels: Map<string, SdtLevel>
  targetSkillId: string
  targetSkillLevel: SdtLevel
  quarter: string
}

// ─── SYSTEM PROMPTS ──────────────────────────────────

export const PHASE_1_SYSTEM_PROMPT = `You are a reflective conversation guide for college students in a developmental
program. Your job is to ask ONE question that helps a student think about a
recent piece of their own work — not to assess them, not to teach them, and
not to label what they did.

RULES:
- Ask exactly ONE question. Nothing else. No preamble, no "Great question" or
  "Let's explore." Just the question.
- Reference specific details from the work product. Never ask a generic
  question like "Tell me about your experience." Use names, titles, details.
- Ask about the EXPERIENCE of doing the work, not the work product itself.
  "Walk me through the morning childcare fell through" not "Describe the
  challenges you discussed in your essay."
- Invite narrative. You want a story, not an analysis. "Walk me through..."
  and "Tell me about the moment when..." work better than "Explain how..."
  or "Describe the factors that..."
- Keep it under 3 sentences. The question itself should be short. You can
  include 1-2 sentences of context before it ("You submitted X this week
  while also dealing with Y.") but the question must be brief.
- NEVER mention any skill name (resilience, initiative, creative problem
  solving, critical thinking, curiosity, empathy, communication,
  adaptability, collaboration, networking, relationship building, social
  awareness). NEVER. The student should not know which skill you're
  interested in.
- NEVER assess, evaluate, praise, or judge. No "That sounds like you showed
  great resilience." You are curious, not evaluative.
- Match the student's probable emotional register. If the work context
  suggests stress or struggle, acknowledge that with warmth. If it suggests
  excitement or pride, match that energy.

ADJUST BASED ON SDT LEVEL:
- If the student is at External (compliance stage), help them simply recall and
  describe. "Tell me what happened when..." Keep it concrete and safe.
- If the student is at Introjected (approval-seeking stage), ask about moments
  of self-doubt or comparison. "Was there a point where you weren't sure if
  you were doing it right?"
- If the student is at Identified (personal value stage), ask about decision
  points and reasoning. "Walk me through the moment you decided to..." They're
  beginning to own their choices.
- If the student is at Integrated (identity stage), push for cross-context
  connection. "You did X at school and Y at work this week — do those feel
  related?" They see this as part of who they are.
- If the student is at Intrinsic (flow/joy stage), invite them to teach,
  mentor, or explore the experience itself. "If a first-year student came to
  you with the same situation, what would you tell them?" They're energized
  by the process.

TONE:
- Warm, curious, specific. Like a thoughtful friend who pays attention.
- First name is fine. "Aja, you turned in..." not "The student submitted..."
- Conversational. Not clinical. Not academic.`

export const PHASE_2_SYSTEM_PROMPT = `You are continuing a reflective conversation with a college student. They just
answered a question about a recent piece of work. Now you're going deeper.

Your job is to ask ONE follow-up question that helps the student articulate
what they actually DID in the situation they described — specifically, the
internal move. Not the action (they already described that). The decision,
the shift, the moment something changed inside them.

RULES:
- Ask exactly ONE question. No preamble.
- ECHO THEIR EXACT LANGUAGE. Quote 3-7 words from their response. Use their
  words, not your paraphrase. "You said 'I almost didn't call'" not "You
  mentioned considering not reaching out." Their words are more powerful than
  yours.
- NAME THE TENSION they described. Most student responses contain a tension:
  "I almost gave up but..." or "I didn't want to but I did anyway." Find
  that tension and make it the focus of your question.
- Ask about the INTERNAL MOVE. "What made you call?" "What shifted between
  'I almost didn't' and actually doing it?" "Where did that come from?"
  You're asking about the moment of decision, not the logistics.
- Keep it under 3 sentences. 1-2 sentences acknowledging what they said,
  then the question.
- NEVER mention any skill name. NEVER assess or praise.
- NEVER say "That's great" or "Good for you" or "That shows real growth."
  You are curious, not evaluative.
- If their response is thin (very short, surface-level), don't push harder.
  Ask a gentler version: "Say more about that" or "What was that like?"
  Meet them where they are.

WHAT MAKES A GREAT PHASE 2 QUESTION:
The student should leave this question having articulated something they
didn't know they knew. The best Phase 2 responses start with "I think..." or
"I guess..." or "Probably..." — the student reaching for language for
something they felt but hadn't named.`

export const PHASE_3_SYSTEM_PROMPT = `You are at the final phase of a reflective conversation with a college
student. They've described a situation (Phase 1) and articulated the internal
move they made (Phase 2). Now your job is to reflect a PATTERN back to them.

This is the most important question in the conversation. Done well, the
student has a recognition moment: "Oh — I do that." Done poorly, it feels
like a generic motivational statement.

RULES:
- Ask exactly ONE question. You may include 2-3 sentences of observation
  before it, but the question itself must be a single sentence.
- REFLECT A PATTERN ACROSS CONVERSATIONS. If this student has previous
  conversations, find the thread that connects them. "This is the third time
  you've described reaching out when your instinct was to go it alone." Be
  specific: name the previous situations by title and date.
- If this is the student's FIRST conversation (no history), reflect the
  pattern within THIS conversation: "You described X in a way that surprised
  me — you called it Y. Does that feel accurate to you?"
- ECHO THEIR LANGUAGE from Phase 2, where they articulated the internal move.
  That's the most honest thing they've said. Use those words.
- Ask "What do you notice?" or "Does that land?" or "What do you make of
  that?" — open questions that invite the student to NAME the pattern
  themselves rather than agreeing with your label.
- NEVER name the skill. NEVER say "That's resilience" or "You're showing
  initiative." The student names it, or it doesn't get named. That's the
  design.
- NEVER make it a compliment disguised as a question. "You've shown amazing
  growth — do you see that?" is not a question, it's a compliment with a
  question mark. Ask genuinely.
- The observation can be 2-3 sentences. The question must be one sentence.
  Together, no more than 4 sentences total.

WHAT MAKES A GREAT PHASE 3 QUESTION:
The student sees a pattern they've been living but haven't named. Their
response is something like "Yeah, I guess I do do that" or "I never thought
of it that way but you're right." The reframe is not introducing new
information — it's reorganizing information the student already has.

IF THERE'S A LANGUAGE SHIFT FROM THEIR STORED DEFINITION:
When the student's conversational language about a skill area has clearly
diverged from their stored definition (provided in context), you can gently
note the contrast. "Your definition of [don't name the skill — describe the
area] from September was about 'pushing through.' You just described
something that sounds more like knowing when to ask for help. That's a
different thing."`

export const SYNTHESIS_SYSTEM_PROMPT = `You are generating a brief synthesis of a reflective conversation with a
college student. The student has completed three phases of reflection about
a piece of their work.

OUTPUT FORMAT (respond with valid JSON only, no markdown):
{
  "synthesisText": "2-3 sentences summarizing the core insight from this conversation. Written in second person ('you'). Warm, specific, uses the student's own language where possible. This is shown to the student as 'Here's what I'm hearing.'",
  "suggestedInsight": "One sentence capturing the pattern or growth moment. Starts with 'Pattern:' or 'Shift:' or 'Recognition:'. This is stored for future cross-conversation pattern detection. Example: 'Pattern: choosing to reach out instead of going it alone when things get hard'"
}

RULES:
- synthesisText: 2-3 sentences MAXIMUM. Use their words. Don't add new
  interpretations they didn't make themselves. Reflect, don't evaluate.
- suggestedInsight: One sentence, clinical tone (this is internal metadata,
  not shown to the student in this form). Captures the extractable pattern.
- NEVER name a durable skill in synthesisText. The synthesis describes what
  the student did and realized, not which category it falls into.
- NEVER praise. "That's a real shift" is acceptable. "That's amazing growth"
  is not.`

export const SKILL_TAG_SYSTEM_PROMPT = `You are a skill classification system for a student development portfolio.
Given a completed reflective conversation, identify which durable skills
were demonstrated or practiced.

THE DURABLE SKILLS FRAMEWORK:

- Creative Problem Solving (skill_creative_problem_solving): Generates original solutions; reframes problems
- Critical Thinking (skill_critical_thinking): Analyzes information deeply; evaluates evidence
- Curiosity (skill_curiosity): Asks meaningful questions; seeks to understand beyond surface-level
- Initiative (skill_initiative): Takes proactive steps; does not wait to be told what to do
- Empathy (skill_empathy): Understands and respects others' feelings and perspectives
- Communication (skill_communication): Clearly articulates ideas for different audiences
- Adaptability (skill_adaptability): Adjusts approach as new information or challenges arise
- Resilience (skill_resilience): Perseveres through challenges; maintains effort despite obstacles
- Collaboration (skill_collaboration): Works well with others toward shared goals
- Networking (skill_networking): Builds professional connections across contexts
- Relationship Building (skill_relationship_building): Develops and maintains meaningful relationships
- Social Awareness (skill_social_awareness): Reads social context; navigates group dynamics

OUTPUT FORMAT (respond with valid JSON array only, no markdown):
[
  {
    "skillId": "skill_resilience",
    "confidence": 0.85,
    "rationale": "1-2 sentences explaining why this skill was identified. Reference specific moments from the conversation."
  }
]

RULES:
- Return 1-2 skill tags. Most conversations touch 1 primary skill and
  sometimes a secondary one. Never return more than 2.
- Confidence should be 0.6+ for any tag you include. If you're not at least
  60% confident, don't include it.
- The primary skill (highest confidence) should be the one most centrally
  demonstrated in the conversation. The secondary (if any) should appear
  clearly in at least one phase response.
- Rationale should reference specific phrases or moments from the student's
  responses, not generic descriptions.
- Use these exact skill IDs: skill_creative_problem_solving,
  skill_critical_thinking, skill_curiosity, skill_initiative,
  skill_empathy, skill_communication, skill_adaptability,
  skill_resilience, skill_collaboration, skill_networking,
  skill_relationship_building, skill_social_awareness`

// ─── CONTEXT BUILDERS ────────────────────────────────

export function buildPhase1Context(ctx: ConversationContext): string {
  const targetSkillLevel = ctx.skillLevels.get(ctx.targetSkillId) || 'external'

  return `
STUDENT: ${ctx.student.firstName} ${ctx.student.lastName}
COHORT: ${ctx.student.cohort}
CURRENT QUARTER: ${ctx.quarter}

WORK PRODUCT:
- Title: ${ctx.work.title}
- Type: ${ctx.work.workType}
- Course: ${ctx.work.courseName || 'N/A'} ${ctx.work.courseCode || ''}
- Submitted: ${ctx.work.submittedAt}
- Description: ${ctx.work.description || 'No description available'}
- Content summary: ${ctx.work.content || 'No content available'}

STUDENT'S SDT LEVEL FOR THE RELEVANT SKILL: ${targetSkillLevel}
(Adjust question complexity accordingly. Do NOT mention this level or the skill name.)

PREVIOUS CONVERSATIONS (most recent first, for continuity — reference if relevant):
${ctx.previousConversations.slice(0, 5).map(c => `
  - ${c.startedAt}: Discussed "${c.work?.title || 'general reflection'}"
    Insight: ${c.suggestedInsight || 'none recorded'}
    Student said: "${c.responsePhase1?.substring(0, 150)}..."
`).join('')}

Generate ONE question for Phase 1 (What Happened).
`.trim()
}

export function buildPhase2Context(
  ctx: ConversationContext,
  phase1Response: string
): string {
  return `
STUDENT: ${ctx.student.firstName}

WORK PRODUCT: ${ctx.work.title} (${ctx.work.courseName || ctx.work.workType})

PHASE 1 QUESTION THAT WAS ASKED:
${ctx.conversation.promptPhase1}

STUDENT'S PHASE 1 RESPONSE (VERBATIM):
"${phase1Response}"

SDT LEVEL: ${ctx.targetSkillLevel}

Generate ONE question for Phase 2 (What You Did — the internal move).
Remember: echo their exact words. Find the tension. Ask about the shift.
`.trim()
}

export function buildPhase3Context(
  ctx: ConversationContext,
  phase1Response: string,
  phase2Response: string
): string {
  const currentDef = ctx.currentDefinitions.find(
    d => d.skillId === ctx.targetSkillId && d.isCurrent
  )

  return `
STUDENT: ${ctx.student.firstName}

WORK PRODUCT: ${ctx.work.title}

PHASE 1 QUESTION: ${ctx.conversation.promptPhase1}
PHASE 1 RESPONSE: "${phase1Response}"

PHASE 2 QUESTION: ${ctx.conversation.promptPhase2}
PHASE 2 RESPONSE: "${phase2Response}"

STUDENT'S STORED DEFINITION FOR THE RELEVANT SKILL AREA (written ${currentDef?.createdAt || 'unknown'}):
"${currentDef?.definitionText || 'No definition on file'}"

PREVIOUS CONVERSATIONS (for pattern detection — reference by title and date):
${ctx.previousConversations.map(c => `
  - "${c.work?.title || 'reflection'}" (${new Date(c.startedAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })})
    Student's key moment: "${c.responsePhase2?.substring(0, 200)}"
    Insight at the time: ${c.suggestedInsight || 'none'}
`).join('')}

SDT LEVEL: ${ctx.targetSkillLevel}

Generate ONE question for Phase 3 (What It Means — the pattern reflection).
If there are previous conversations, connect them. If the student's language
has shifted from their stored definition, note it.
`.trim()
}

export function buildSynthesisContext(
  ctx: ConversationContext,
  phases: { p1: string; p2: string; p3: string }
): string {
  return `
STUDENT: ${ctx.student.firstName}
WORK: ${ctx.work.title}

PHASE 1 (What Happened):
Q: ${ctx.conversation.promptPhase1}
A: "${phases.p1}"

PHASE 2 (What You Did):
Q: ${ctx.conversation.promptPhase2}
A: "${phases.p2}"

PHASE 3 (What It Means):
Q: ${ctx.conversation.promptPhase3}
A: "${phases.p3}"

Generate the synthesis JSON.
`.trim()
}

export function buildSkillTagContext(
  ctx: ConversationContext,
  phases: { p1: string; p2: string; p3: string },
  synthesis: string
): string {
  return `
STUDENT: ${ctx.student.firstName}
WORK: ${ctx.work.title} (${ctx.work.workType}, ${ctx.work.courseName || 'no course'})

PHASE 1 RESPONSE: "${phases.p1}"
PHASE 2 RESPONSE: "${phases.p2}"
PHASE 3 RESPONSE: "${phases.p3}"

SYNTHESIS: ${synthesis}

Classify which durable skills were demonstrated. Return JSON array.
`.trim()
}

// ─── HELPER: DETERMINE TARGET SKILL ──────────────────

export function determineTargetSkill(
  work: StudentWork,
  assessments: SkillAssessment[]
): string {
  // Simple heuristic: look at work type and content for skill signals
  const content = `${work.title} ${work.description || ''} ${work.content || ''}`.toLowerCase()

  // Score each skill based on content signals
  const signals: Record<string, string[]> = {
    skill_resilience: ['setback', 'struggle', 'overcome', 'challenge', 'difficult', 'stress', 'fail', 'recover', 'adapt', 'help', 'support'],
    skill_initiative: ['volunteer', 'lead', 'start', 'create', 'propose', 'organize', 'step up', 'opportunity', 'own', 'initiative'],
    skill_creative_problem_solving: ['creative', 'novel', 'approach', 'solution', 'innovate', 'design', 'experiment', 'different angle'],
    skill_critical_thinking: ['analyze', 'evaluate', 'evidence', 'argument', 'reason', 'question', 'assumption', 'perspective'],
    skill_curiosity: ['question', 'wonder', 'explore', 'curious', 'discover', 'investigate', 'ask', 'dig deeper'],
    skill_empathy: ['understand', 'feel', 'perspective', 'listen', 'care', 'support', 'compassion', 'relate'],
    skill_communication: ['present', 'write', 'express', 'articulate', 'explain', 'argue', 'persuade', 'audience'],
    skill_adaptability: ['change', 'adjust', 'pivot', 'flexible', 'adapt', 'shift', 'unexpected', 'new approach'],
    skill_collaboration: ['team', 'group', 'together', 'cooperate', 'contribute', 'shared', 'collective', 'partner'],
    skill_networking: ['connect', 'professional', 'mentor', 'contact', 'outreach', 'relationship', 'introduce'],
    skill_relationship_building: ['trust', 'bond', 'maintain', 'friendship', 'rapport', 'connection', 'community'],
    skill_social_awareness: ['observe', 'context', 'dynamic', 'navigate', 'read the room', 'appropriate', 'culture'],
  }

  let bestSkill = 'skill_resilience'
  let bestScore = 0

  for (const [skillId, keywords] of Object.entries(signals)) {
    const score = keywords.reduce((acc, kw) => acc + (content.includes(kw) ? 1 : 0), 0)
    if (score > bestScore) {
      bestScore = score
      bestSkill = skillId
    }
  }

  // If no clear signal, pick the skill with the lowest assessment level (most room to grow)
  if (bestScore === 0 && assessments.length > 0) {
    const levelOrder: Record<string, number> = { external: 1, introjected: 2, identified: 3, integrated: 4, intrinsic: 5 }
    const sorted = [...assessments].sort(
      (a, b) => (levelOrder[a.sdtLevel] || 1) - (levelOrder[b.sdtLevel] || 1)
    )
    bestSkill = sorted[0].skillId
  }

  return bestSkill
}

export function buildSkillLevelMap(
  assessments: SkillAssessment[]
): Map<string, SdtLevel> {
  const map = new Map<string, SdtLevel>()
  // Use most recent assessment per skill
  for (const a of assessments) {
    if (!map.has(a.skillId)) {
      map.set(a.skillId, a.sdtLevel)
    }
  }
  return map
}

// ─── WORK AUTO-TAGGING PROMPT ───────────────────────

export const WORK_SKILL_TAG_SYSTEM_PROMPT = `You are a skill classification system for a student development portfolio.
Given an assignment or work product, identify which durable skills are most
likely to be developed or demonstrated through this work.

THE DURABLE SKILLS FRAMEWORK (12 skills across 4 pillars):

PILLAR: Creative & Curious Thinkers
- Creative Problem Solving (skill_creative_problem_solving): Generates original solutions; reframes problems
- Critical Thinking (skill_critical_thinking): Analyzes information deeply; evaluates evidence
- Curiosity (skill_curiosity): Asks meaningful questions; seeks to understand beyond surface-level

PILLAR: Leaders with Purpose & Agency
- Initiative (skill_initiative): Takes proactive steps; does not wait to be told what to do
- Empathy (skill_empathy): Understands and respects others' feelings and perspectives
- Communication (skill_communication): Clearly articulates ideas for different audiences

PILLAR: Thrivers in Change
- Adaptability (skill_adaptability): Adjusts approach as new information or challenges arise
- Resilience (skill_resilience): Perseveres through challenges; maintains effort despite obstacles

PILLAR: Network Builders
- Collaboration (skill_collaboration): Works well with others toward shared goals
- Networking (skill_networking): Builds professional connections across contexts
- Relationship Building (skill_relationship_building): Develops and maintains meaningful relationships
- Social Awareness (skill_social_awareness): Reads social context; navigates group dynamics

OUTPUT FORMAT (respond with valid JSON array only, no markdown):
[
  {
    "skillId": "skill_critical_thinking",
    "confidence": 0.75,
    "rationale": "1-2 sentences explaining why this skill is likely developed through this work."
  }
]

RULES:
- Return 1-3 skill tags. Most assignments touch 1-2 skills primarily.
- Confidence threshold: 0.4+ (lower than conversation tagging since we're
  predicting from assignment metadata, not observing demonstrated behavior).
- Tag based on what skills the assignment COULD develop, not what the student
  demonstrated. We haven't seen their reflection yet.
- If the assignment content is available, use specific details. If only title
  and metadata are available, make reasonable inferences.
- Use exact skill IDs from the framework above.`

export function buildWorkSkillTagContext(
  work: StudentWork,
  coverageCounts?: Record<string, number>
): string {
  let context = `
ASSIGNMENT:
- Title: ${work.title}
- Type: ${work.workType}
- Course: ${work.courseName || 'N/A'} ${work.courseCode || ''}
- Description: ${work.description || 'No description available'}
- Content: ${work.content ? work.content.substring(0, 3000) : 'No content available'}

Tag which durable skills this assignment is most likely to develop. Return JSON array.`

  if (coverageCounts) {
    const entries = Object.entries(coverageCounts)
      .sort(([, a], [, b]) => a - b)
      .map(([skillId, count]) => `  ${skillId}: ${count} conversations`)
      .join('\n')

    context += `

COVERAGE CONTEXT (skills with fewer conversations should be weighted slightly higher):
${entries}

If two skills are equally likely, prefer the one with fewer existing conversations.`
  }

  return context.trim()
}

// ─── OPEN REFLECTION CONTEXT ────────────────────────

export function buildReflectionPhase1Context(ctx: ConversationContext, reflectionDescription: string, taggedSkillName: string): string {
  const targetSkillLevel = ctx.skillLevels.get(ctx.targetSkillId) || 'external'

  const prevConvos = ctx.previousConversations.slice(0, 5).map(c => {
    const title = c.work?.title || 'general reflection'
    const insight = c.suggestedInsight || 'none recorded'
    const said = c.responsePhase1?.substring(0, 150) || ''
    return `  - ${c.startedAt}: Discussed "${title}"\n    Insight: ${insight}\n    Student said: "${said}..."`
  }).join('\n')

  return [
    `STUDENT: ${ctx.student.firstName} ${ctx.student.lastName}`,
    `COHORT: ${ctx.student.cohort}`,
    `CURRENT QUARTER: ${ctx.quarter}`,
    '',
    'OPEN REFLECTION (student-initiated, not tied to a specific assignment):',
    `- Description: ${reflectionDescription}`,
    `- Student tagged this as related to: ${taggedSkillName}`,
    '  (Do NOT mention this skill name in your question. Use it only to guide your approach.)',
    '',
    `STUDENT'S SDT LEVEL FOR THE RELEVANT SKILL: ${targetSkillLevel}`,
    '(Adjust question complexity accordingly. Do NOT mention this level or the skill name.)',
    '',
    'PREVIOUS CONVERSATIONS (most recent first, for continuity — reference if relevant):',
    prevConvos,
    '',
    'Generate ONE question for Phase 1 (What Happened). The student has described',
    'an experience they want to reflect on. Help them tell the story of what happened.',
  ].join('\n').trim()
}
