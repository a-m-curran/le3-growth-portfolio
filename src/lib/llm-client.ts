/**
 * LLM Client Abstraction Layer
 *
 * Supports multiple LLM providers via a common interface.
 * Set LLM_PROVIDER env var to switch: "anthropic" (default) or "gemini"
 *
 * Both providers can coexist — you can even use different providers
 * for different tasks by calling createClient() with a specific provider.
 */

export interface LLMOptions {
  temperature?: number
  maxTokens?: number
}

export interface LLMClient {
  generate(system: string, user: string, options?: LLMOptions): Promise<string>
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
    async generate(system: string, user: string, options: LLMOptions = {}): Promise<string> {
      const response = await client.messages.create({
        model,
        temperature: options.temperature ?? 0.4,
        max_tokens: options.maxTokens ?? 500,
        system,
        messages: [{ role: 'user', content: user }],
      })
      const block = response.content[0]
      return block?.type === 'text' ? block.text : ''
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
    async generate(system: string, user: string, options: LLMOptions = {}): Promise<string> {
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
      return response.text() || ''
    },
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
