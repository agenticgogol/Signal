export type SupportedProvider = 'anthropic' | 'openai' | 'groq' | 'openrouter'

export interface ProviderOption {
  id: SupportedProvider
  label: string
  description: string
  models: string[]
}

export interface UserLlmSettings {
  provider: SupportedProvider
  model: string
  apiKey: string
  custom: boolean
}

export const PROVIDER_OPTIONS: ProviderOption[] = [
  {
    id: 'anthropic',
    label: 'Anthropic',
    description: 'Best for long-form reasoning and editorial quality.',
    models: ['claude-sonnet-4-6', 'claude-haiku-4-5-20251001'],
  },
  {
    id: 'openai',
    label: 'OpenAI',
    description: 'Strong general-purpose writing and structured outputs.',
    models: ['gpt-4.1', 'gpt-4.1-mini', 'gpt-4o', 'gpt-4o-mini'],
  },
  {
    id: 'groq',
    label: 'Groq',
    description: 'Fast inference with open-weight and hosted models.',
    models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'moonshotai/kimi-k2-instruct'],
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    description: 'Use paid and open models from many providers through one API key.',
    models: ['openai/gpt-4.1-mini', 'anthropic/claude-3.7-sonnet', 'meta-llama/llama-3.3-70b-instruct'],
  },
]

export const DEFAULT_PROVIDER: SupportedProvider = 'anthropic'

export function defaultModelFor(provider: SupportedProvider) {
  return PROVIDER_OPTIONS.find(option => option.id === provider)?.models[0] ?? 'claude-sonnet-4-6'
}

export function normalizeProvider(value: unknown): SupportedProvider {
  return PROVIDER_OPTIONS.some(option => option.id === value)
    ? value as SupportedProvider
    : DEFAULT_PROVIDER
}

export function maskSecret(value: string | null | undefined) {
  if (!value) return ''
  if (value.length <= 8) return '••••••••'
  return `${value.slice(0, 4)}••••${value.slice(-4)}`
}
