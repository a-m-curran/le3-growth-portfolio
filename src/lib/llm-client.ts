/**
 * LLM Client Abstraction Layer
 *
 * Supports multiple LLM providers via a common interface.
 * Set LLM_PROVIDER env var to switch: "anthropic" (default) or "gemini"
 *
 * Every call routed through this module is automatically logged to
 * `event_log` via the observability layer — no discipline required at
 * call sites. Callers can pass an optional `LLMCallContext` to enrich
 * the log entry with the student id, conversation id, or a custom
 * event_type subpath (e.g. 'phase1.question_generation').
 */

import { log, excerpt } from '@/lib/observability/logger'

export interface LLMOptions {
  temperature?: number
  maxTokens?: number
}

/**
 * Per-call observability context. Optional but strongly recommended —
 * unattributed LLM calls are hard to debug when a student says "the
 * question I got was weird."
 */
export interface LLMCallContext {
  /** Student this call is for. Tags the event_log row so per-student debugging works. */
  studentId?: string
  /** Conversation in progress, if any. */
  conversationId?: string
  /** Phase / step within the call site, e.g. 'phase1.excavation', 'autotag'. Used as event_type suffix. */
  callPurpose?: string
  /** Free-form additional context to merge into the log entry. */
  extra?: Record<string, unknown>
  /** Request id from the API edge so events correlate with downstream work. */
  requestId?: string
}

export interface LLMClient {
  generate(
    system: string,
    user: string,
    options?: LLMOptions,
    callContext?: LLMCallContext
  ): Promise<string>
  provider: string
}

// ─── ANTHROPIC (CLAUDE) ─────────────────────────────

function createAnthropicClient(): LLMClient {
  // Dynamic import to avoid loading SDK when not needed
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Anthropic = require('@anthropic-ai/sdk').default
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5-20250929'

  return {
    provider: 'anthropic',
    async generate(
      system: string,
      user: string,
      options: LLMOptions = {},
      callContext: LLMCallContext = {}
    ): Promise<string> {
      return runWithLogging(
        'anthropic',
        model,
        system,
        user,
        options,
        callContext,
        async () => {
          const response = await client.messages.create({
            model,
            temperature: options.temperature ?? 0.4,
            max_tokens: options.maxTokens ?? 500,
            system,
            messages: [{ role: 'user', content: user }],
          })
          const block = response.content[0]
          return {
            text: block?.type === 'text' ? block.text : '',
            inputTokens: response.usage?.input_tokens,
            outputTokens: response.usage?.output_tokens,
          }
        }
      )
    },
  }
}

// ─── GEMINI (GOOGLE) ────────────────────────────────

function createGeminiClient(): LLMClient {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { GoogleGenerativeAI } = require('@google/generative-ai')
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY)

  const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash-preview-04-17'

  return {
    provider: 'gemini',
    async generate(
      system: string,
      user: string,
      options: LLMOptions = {},
      callContext: LLMCallContext = {}
    ): Promise<string> {
      return runWithLogging(
        'gemini',
        modelName,
        system,
        user,
        options,
        callContext,
        async () => {
          const model = genAI.getGenerativeModel({
            model: modelName,
            systemInstruction: system,
            generationConfig: {
              temperature: options.temperature ?? 0.4,
              maxOutputTokens: options.maxTokens ?? 500,
            },
          })
          const result = await model.generateContent(user)
          const response = result.response
          return {
            text: response.text() || '',
            inputTokens: response.usageMetadata?.promptTokenCount,
            outputTokens: response.usageMetadata?.candidatesTokenCount,
          }
        }
      )
    },
  }
}

// ─── Logging wrapper ────────────────────────────────

interface LLMResult {
  text: string
  inputTokens?: number
  outputTokens?: number
}

/**
 * Run an LLM call and emit one event_log row recording everything
 * relevant — provider, model, prompt + response excerpts, token
 * counts, duration, and success/failure.
 *
 * Errors are logged then re-thrown so the calling code path's existing
 * error handling still runs.
 */
async function runWithLogging(
  provider: string,
  model: string,
  system: string,
  user: string,
  options: LLMOptions,
  callContext: LLMCallContext,
  fn: () => Promise<LLMResult>
): Promise<string> {
  const startedAt = Date.now()
  const eventType = callContext.callPurpose
    ? `llm.call.${callContext.callPurpose}`
    : 'llm.call'

  try {
    const result = await fn()

    await log.info(eventType, {
      studentId: callContext.studentId,
      requestId: callContext.requestId,
      message: `${provider}/${model} ok (${result.text.length} chars)`,
      durationMs: Date.now() - startedAt,
      context: {
        provider,
        model,
        temperature: options.temperature ?? 0.4,
        max_tokens: options.maxTokens ?? 500,
        conversation_id: callContext.conversationId,
        prompt_system_excerpt: excerpt(system, 800),
        prompt_user_excerpt: excerpt(user, 800),
        response_excerpt: excerpt(result.text, 1600),
        response_length: result.text.length,
        input_tokens: result.inputTokens,
        output_tokens: result.outputTokens,
        ...(callContext.extra || {}),
      },
    })

    return result.text
  } catch (err) {
    await log.error(eventType, {
      studentId: callContext.studentId,
      requestId: callContext.requestId,
      message: `${provider}/${model} failed: ${String(err).slice(0, 300)}`,
      durationMs: Date.now() - startedAt,
      context: {
        provider,
        model,
        temperature: options.temperature ?? 0.4,
        max_tokens: options.maxTokens ?? 500,
        conversation_id: callContext.conversationId,
        prompt_system_excerpt: excerpt(system, 800),
        prompt_user_excerpt: excerpt(user, 800),
        error_message: String(err),
        error_stack: err instanceof Error ? err.stack?.slice(0, 2000) : undefined,
        ...(callContext.extra || {}),
      },
    })
    throw err
  }
}

// ─── FACTORY ────────────────────────────────────────

let _defaultClient: LLMClient | null = null

export function createClient(provider?: string): LLMClient {
  const p = provider || process.env.LLM_PROVIDER || 'anthropic'

  switch (p) {
    case 'gemini':
    case 'google':
      return createGeminiClient()
    case 'anthropic':
    case 'claude':
    default:
      return createAnthropicClient()
  }
}

/**
 * Get the default LLM client (singleton, created on first call).
 * Uses LLM_PROVIDER env var to determine provider.
 */
export function getClient(): LLMClient {
  if (!_defaultClient) {
    _defaultClient = createClient()
  }
  return _defaultClient
}
