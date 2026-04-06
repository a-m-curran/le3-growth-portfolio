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
  solving, critical thinking, self-directed learning). NEVER. The student
  should not know which skill you're interested in.
- NEVER assess, evaluate, praise, or judge. No "That sounds like you showed
  great resilience." You are curious, not evaluative.
- Match the student's probable emotional register. If the work context
  suggests stress or struggle, acknowledge that with warmth. If it suggests
  excitement or pride, match that energy.

ADJUST BASED ON SDT LEVEL:
- If the student is at Noticing (early stage), help them simply recall and
  describe: "Tell me what happened when..." Keep it concrete.
- If the student is at Practicing, ask about decision points: "Walk me through
  the moment you decided to..." They're beginning to act with awareness.
- If the student is at Integrating, push for cross-context connection: "You
  did X at school and Y at work this week — do those feel related?" They're
  ready to see patterns across domains.
- If the student is at Evolving, invite them to teach or mentor: "If a
  first-year student came to you with the same situation, what would you
  tell them?" They're ready to externalize their understanding.

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

Pillar 1: Creative & Curious Mindset
- Creative Problem Solving (skill_creative_problem_solving): Approaching challenges from novel angles,
  questioning default approaches, combining ideas across domains
- Critical Thinking (skill_critical_thinking): Analyzing information carefully, questioning assumptions,
  evaluating evidence, distinguishing fact from opinion
- Self-Directed Learning (skill_self_directed_learning): Identifying learning needs, seeking resources
  independently, learning without external structure

Pillar 2: Lead Themselves & Others
- Resilience (skill_resilience): Navigating setbacks, adapting plans, seeking help when needed,
  recovering from failure, managing stress productively
- Initiative (skill_initiative): Acting without being prompted, creating opportunities,
  volunteering, proposing new approaches, stepping into leadership

Pillar 3: Thrive in Change
(Future skills — not yet active in the framework)

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
  skill_critical_thinking, skill_self_directed_learning, skill_resilience,
  skill_initiative`

// ─── CONTEXT BUILDERS ────────────────────────────────

export function buildPhase1Context(ctx: ConversationContext): string {
  const targetSkillLevel = ctx.skillLevels.get(ctx.targetSkillId) || 'noticing'

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
    skill_self_directed_learning: ['learn', 'research', 'self-taught', 'resource', 'independent', 'explore', 'curiosity', 'figure out'],
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
    const levelOrder: Record<string, number> = { noticing: 1, practicing: 2, integrating: 3, evolving: 4 }
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
