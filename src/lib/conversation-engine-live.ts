import Anthropic from '@anthropic-ai/sdk'
import {
  MODEL,
  TEMPERATURE,
  MAX_TOKENS,
  PHASE_1_SYSTEM_PROMPT,
  PHASE_2_SYSTEM_PROMPT,
  PHASE_3_SYSTEM_PROMPT,
  SYNTHESIS_SYSTEM_PROMPT,
  SKILL_TAG_SYSTEM_PROMPT,
  buildPhase1Context,
  buildPhase2Context,
  buildPhase3Context,
  buildSynthesisContext,
  buildSkillTagContext,
  type ConversationContext,
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

function extractText(response: Anthropic.Message): string {
  const block = response.content[0]
  if (block.type === 'text') return block.text
  return ''
}
