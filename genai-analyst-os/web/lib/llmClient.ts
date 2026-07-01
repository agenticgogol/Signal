import { createServiceClient } from '@/lib/supabase'
import { DEFAULT_PROVIDER, defaultModelFor, normalizeProvider, type SupportedProvider, type UserLlmSettings } from '@/lib/llmConfig'
import { decryptSecretIfNeeded } from '@/lib/secrets'
import { recordLlmTrace } from '@/lib/observability'

function providerApiKey(provider: SupportedProvider) {
  switch (provider) {
    case 'openai':
      return process.env.OPENAI_API_KEY || ''
    case 'groq':
      return process.env.GROQ_API_KEY || ''
    case 'openrouter':
      return process.env.OPENROUTER_API_KEY || ''
    case 'anthropic':
    default:
      return process.env.ANTHROPIC_API_KEY || ''
  }
}

function envDefaultSettings(): UserLlmSettings {
  const provider = normalizeProvider(process.env.LLM_PROVIDER)
  return {
    provider,
    model: defaultModelFor(provider),
    apiKey: providerApiKey(provider),
    custom: false,
  }
}

export async function getUserLlmSettings(userId: string): Promise<UserLlmSettings> {
  const fallback = envDefaultSettings()
  if (!userId) return fallback

  const { data, error } = await createServiceClient()
    .from('user_profiles')
    .select('llm_provider, llm_model, llm_api_key')
    .eq('id', userId)
    .maybeSingle()

  if (error) throw error

  const provider = normalizeProvider(data?.llm_provider)
  const model = String(data?.llm_model || '').trim() || defaultModelFor(provider)
  const storedApiKey = String(data?.llm_api_key || '').trim()
  const apiKey = (storedApiKey ? decryptSecretIfNeeded(storedApiKey) : '') || providerApiKey(provider)

  return {
    provider,
    model,
    apiKey,
    custom: Boolean(data?.llm_provider || data?.llm_model || data?.llm_api_key),
  }
}

function extractJson(text: string) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  return (fenced ? fenced[1] : text).trim()
}

async function callAnthropic(settings: UserLlmSettings, params: {
  system?: string
  prompt: string
  maxTokens: number
  temperature?: number
}) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': settings.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: settings.model,
      max_tokens: params.maxTokens,
      temperature: params.temperature,
      system: params.system,
      messages: [{ role: 'user', content: params.prompt }],
    }),
  })

  const json = await response.json()
  if (!response.ok) {
    throw new Error(json?.error?.message ?? 'Anthropic request failed')
  }

  const content = Array.isArray(json?.content)
    ? json.content.find((item: { type?: string }) => item.type === 'text')?.text
    : ''

  return String(content || '')
}

function openAiCompatibleBaseUrl(provider: SupportedProvider) {
  switch (provider) {
    case 'groq':
      return 'https://api.groq.com/openai/v1'
    case 'openrouter':
      return 'https://openrouter.ai/api/v1'
    case 'openai':
    default:
      return 'https://api.openai.com/v1'
  }
}

async function callOpenAiCompatible(settings: UserLlmSettings, params: {
  system?: string
  prompt: string
  maxTokens: number
  temperature?: number
}) {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    authorization: `Bearer ${settings.apiKey}`,
  }
  if (settings.provider === 'openrouter') {
    headers['HTTP-Referer'] = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000'
    headers['X-Title'] = 'Signal'
  }

  const response = await fetch(`${openAiCompatibleBaseUrl(settings.provider)}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: settings.model,
      temperature: params.temperature,
      max_tokens: params.maxTokens,
      messages: [
        ...(params.system ? [{ role: 'system', content: params.system }] : []),
        { role: 'user', content: params.prompt },
      ],
    }),
  })

  const json = await response.json()
  if (!response.ok) {
    throw new Error(json?.error?.message ?? `${settings.provider} request failed`)
  }

  return String(json?.choices?.[0]?.message?.content || '')
}

export async function generateTextForUser(params: {
  userId: string
  system?: string
  prompt: string
  maxTokens?: number
  temperature?: number
  // Tags the span for observability — which agent/workflow made this call.
  // Optional so existing call sites keep working; defaults to 'unspecified'.
  agent?: string
}) {
  const settings = await getUserLlmSettings(params.userId)
  if (!settings.apiKey) {
    throw new Error('No API key configured for this account. Open Settings and add your provider, model, and API key.')
  }

  const call = settings.provider === 'anthropic' ? callAnthropic : callOpenAiCompatible
  const startedAt = Date.now()
  try {
    const result = await call(settings, {
      system: params.system,
      prompt: params.prompt,
      maxTokens: params.maxTokens ?? 2000,
      temperature: params.temperature,
    })
    void recordLlmTrace({
      userId: params.userId,
      agent: params.agent ?? 'unspecified',
      provider: settings.provider,
      model: settings.model,
      promptChars: (params.system?.length ?? 0) + params.prompt.length,
      completionChars: result.length,
      durationMs: Date.now() - startedAt,
      status: 'success',
    })
    return result
  } catch (error) {
    void recordLlmTrace({
      userId: params.userId,
      agent: params.agent ?? 'unspecified',
      provider: settings.provider,
      model: settings.model,
      promptChars: (params.system?.length ?? 0) + params.prompt.length,
      completionChars: 0,
      durationMs: Date.now() - startedAt,
      status: 'error',
      errorMessage: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}

export async function generateJsonForUser<T>(params: {
  userId: string
  system?: string
  prompt: string
  schema: unknown
  maxTokens?: number
  temperature?: number
  agent?: string
}) {
  const text = await generateTextForUser({
    userId: params.userId,
    system: `${params.system ?? ''}\nReturn only valid JSON. No markdown fences.`,
    prompt: `${params.prompt}\n\nJSON schema:\n${JSON.stringify(params.schema, null, 2)}`,
    maxTokens: params.maxTokens ?? 2000,
    temperature: params.temperature,
    agent: params.agent,
  })

  return JSON.parse(extractJson(text)) as T
}
