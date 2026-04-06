import Anthropic from '@anthropic-ai/sdk'
import type { StudentWork, ConversationOutput } from './types'
import {
  MODEL,
  TEMPERATURE,
  MAX_TOKENS,
  PHASE_1_SYSTEM_PROMPT,
  PHASE_2_SYSTEM_PROMPT,
  PHASE_3_SYSTEM_PROMPT,
  SYNTHESIS_SYSTEM_PROMPT,
  SKILL_TAG_SYSTEM_PROMPT,
  WORK_SKILL_TAG_SYSTEM_PROMPT,
  CONVERSATION_OUTPUT_SYSTEM_PROMPT,
  NARRATIVE_GENERATION_SYSTEM_PROMPT,
  CAREER_OUTPUT_SYSTEM_PROMPT,
  buildPhase1Context,
  buildPhase2Context,
  buildPhase3Context,
  buildSynthesisContext,
  buildSkillTagContext,
  buildWorkSkillTagContext,
  buildReflectionPhase1Context,
  buildConversationOutputContext,
  buildNarrativeContext,
  buildCareerOutputContext,
  type ConversationContext,
  type NarrativeContext,
} from './llm-prompts'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function generatePhase1Question(context: ConversationContext): Promise<string> {
  const response = await anthropic.messages.create({
    model: MODEL,
    temperature: TEMPERATURE,
    max_tokens: MAX_TOKENS,
    system: PHASE_1_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildPhase1Context(context) }],
  })
  return extractText(response)
}

export async function generatePhase2Question(
  context: ConversationContext,
  phase1Response: string
): Promise<string> {
  const response = await anthropic.messages.create({
    model: MODEL,
    temperature: TEMPERATURE,
    max_tokens: MAX_TOKENS,
    system: PHASE_2_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildPhase2Context(context, phase1Response) }],
  })
  return extractText(response)
}

export async function generatePhase3Question(
  context: ConversationContext,
  phase1Response: string,
  phase2Response: string
): Promise<string> {
  const response = await anthropic.messages.create({
    model: MODEL,
    temperature: TEMPERATURE,
    max_tokens: MAX_TOKENS,
    system: PHASE_3_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildPhase3Context(context, phase1Response, phase2Response) }],
  })
  return extractText(response)
}

export async function generateSynthesis(
  context: ConversationContext,
  phases: { p1: string; p2: string; p3: string }
): Promise<{ synthesisText: string; suggestedInsight: string }> {
  const response = await anthropic.messages.create({
    model: MODEL,
    temperature: 0.3,
    max_tokens: 300,
    system: SYNTHESIS_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildSynthesisContext(context, phases) }],
  })
  const text = extractText(response)
  try {
    return JSON.parse(text)
  } catch {
    // Fallback if LLM doesn't return clean JSON
    return {
      synthesisText: text,
      suggestedInsight: 'Pattern: unable to parse structured insight',
    }
  }
}

export async function suggestSkillTags(
  context: ConversationContext,
  phases: { p1: string; p2: string; p3: string },
  synthesis: string
): Promise<{ skillId: string; confidence: number; rationale: string }[]> {
  const response = await anthropic.messages.create({
    model: MODEL,
    temperature: 0.2,
    max_tokens: 500,
    system: SKILL_TAG_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildSkillTagContext(context, phases, synthesis) }],
  })
  const text = extractText(response)
  try {
    return JSON.parse(text)
  } catch {
    return []
  }
}

export async function autoTagWork(
  work: StudentWork,
  coverageCounts?: Record<string, number>
): Promise<{ skillId: string; confidence: number; rationale: string }[]> {
  const response = await anthropic.messages.create({
    model: MODEL,
    temperature: 0.2,
    max_tokens: 500,
    system: WORK_SKILL_TAG_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildWorkSkillTagContext(work, coverageCounts) }],
  })
  const text = extractText(response)
  try {
    return JSON.parse(text)
  } catch {
    return []
  }
}

export async function generateConversationOutput(
  conversation: { promptPhase1?: string; responsePhase1?: string; promptPhase2?: string; responsePhase2?: string; promptPhase3?: string; responsePhase3?: string; synthesisText?: string },
  skillTags: { skillId: string }[],
  rubricDescriptors: Record<string, Record<string, string[]>>,
  previousConversations?: { synthesisText?: string; suggestedInsight?: string }[]
): Promise<Omit<ConversationOutput, 'id' | 'conversationId' | 'createdAt'>> {
  const response = await anthropic.messages.create({
    model: MODEL,
    temperature: 0.2,
    max_tokens: 1500,
    system: CONVERSATION_OUTPUT_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildConversationOutputContext(conversation, skillTags, rubricDescriptors, previousConversations) }],
  })
  const text = extractText(response)
  try {
    return JSON.parse(text)
  } catch {
    return {
      evidenceStrength: 'thin',
      evidenceRationale: 'Failed to parse structured output',
      behavioralIndicators: [],
      sdtLevelSignals: {},
      growthTrajectory: 'emerging',
      trajectoryRationale: 'Unable to assess',
      keyMoments: [],
      voiceMarkers: {
        sentenceLength: 'medium',
        vocabulary: 'conversational',
        metaphors: [],
        repeatPhrases: [],
        emotionalRegister: 'neutral',
      },
    }
  }
}

export async function generateCareerOutput(
  studentName: string,
  narratives: { skillName: string; skillId: string; narrativeText: string }[]
): Promise<{ resumeSummary: string; skillDescriptions: { skillId: string; skillName: string; resumeLanguage: string; talkingPoints: string[] }[] }> {
  const response = await anthropic.messages.create({
    model: MODEL,
    temperature: 0.4,
    max_tokens: 2000,
    system: CAREER_OUTPUT_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildCareerOutputContext(studentName, narratives) }],
  })
  const text = extractText(response)
  try {
    return JSON.parse(text)
  } catch {
    return { resumeSummary: text, skillDescriptions: [] }
  }
}

export async function generateSkillNarrative(
  ctx: NarrativeContext
): Promise<{ narrativeText: string; richness: 'thin' | 'developing' | 'rich' }> {
  const response = await anthropic.messages.create({
    model: MODEL,
    temperature: 0.5,
    max_tokens: 2000,
    system: NARRATIVE_GENERATION_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildNarrativeContext(ctx) }],
  })
  const text = extractText(response)
  try {
    return JSON.parse(text)
  } catch {
    return { narrativeText: text, richness: 'thin' }
  }
}

export async function generateReflectionPhase1Question(
  context: ConversationContext,
  reflectionDescription: string,
  taggedSkillName: string
): Promise<string> {
  const response = await anthropic.messages.create({
    model: MODEL,
    temperature: TEMPERATURE,
    max_tokens: MAX_TOKENS,
    system: PHASE_1_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildReflectionPhase1Context(context, reflectionDescription, taggedSkillName) }],
  })
  return extractText(response)
}

function extractText(response: Anthropic.Message): string {
  const block = response.content[0]
  if (block.type === 'text') return block.text
  return ''
}
