import type { StudentWork, ConversationOutput } from './types'
import { getClient } from './llm-client'
import {
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

// All functions use the default LLM client (set via LLM_PROVIDER env var)
const llm = () => getClient()

export async function generatePhase1Question(context: ConversationContext): Promise<string> {
  return llm().generate(PHASE_1_SYSTEM_PROMPT, buildPhase1Context(context))
}

export async function generatePhase2Question(
  context: ConversationContext,
  phase1Response: string
): Promise<string> {
  return llm().generate(PHASE_2_SYSTEM_PROMPT, buildPhase2Context(context, phase1Response))
}

export async function generatePhase3Question(
  context: ConversationContext,
  phase1Response: string,
  phase2Response: string
): Promise<string> {
  return llm().generate(PHASE_3_SYSTEM_PROMPT, buildPhase3Context(context, phase1Response, phase2Response))
}

export async function generateSynthesis(
  context: ConversationContext,
  phases: { p1: string; p2: string; p3: string }
): Promise<{ synthesisText: string; suggestedInsight: string }> {
  const text = await llm().generate(
    SYNTHESIS_SYSTEM_PROMPT,
    buildSynthesisContext(context, phases),
    { temperature: 0.3, maxTokens: 300 }
  )
  try {
    return JSON.parse(text)
  } catch {
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
  const text = await llm().generate(
    SKILL_TAG_SYSTEM_PROMPT,
    buildSkillTagContext(context, phases, synthesis),
    { temperature: 0.2, maxTokens: 500 }
  )
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
  const text = await llm().generate(
    WORK_SKILL_TAG_SYSTEM_PROMPT,
    buildWorkSkillTagContext(work, coverageCounts),
    { temperature: 0.2, maxTokens: 500 }
  )
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
  const text = await llm().generate(
    CONVERSATION_OUTPUT_SYSTEM_PROMPT,
    buildConversationOutputContext(conversation, skillTags, rubricDescriptors, previousConversations),
    { temperature: 0.2, maxTokens: 1500 }
  )
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
  const text = await llm().generate(
    CAREER_OUTPUT_SYSTEM_PROMPT,
    buildCareerOutputContext(studentName, narratives),
    { temperature: 0.4, maxTokens: 2000 }
  )
  try {
    return JSON.parse(text)
  } catch {
    return { resumeSummary: text, skillDescriptions: [] }
  }
}

export async function generateSkillNarrative(
  ctx: NarrativeContext
): Promise<{ narrativeText: string; richness: 'thin' | 'developing' | 'rich' }> {
  const text = await llm().generate(
    NARRATIVE_GENERATION_SYSTEM_PROMPT,
    buildNarrativeContext(ctx),
    { temperature: 0.5, maxTokens: 2000 }
  )
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
  return llm().generate(
    PHASE_1_SYSTEM_PROMPT,
    buildReflectionPhase1Context(context, reflectionDescription, taggedSkillName)
  )
}
