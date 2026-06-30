import { createServiceClient } from '@/lib/supabase'
import { decryptSecretIfNeeded } from '@/lib/secrets'

const OPENAI_EMBEDDING_MODEL = 'text-embedding-3-small'
const OPENAI_EMBEDDING_DIMENSIONS = 384

function normalizeVector(vector: number[]) {
  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + (value * value), 0))
  if (!magnitude || !Number.isFinite(magnitude)) return vector
  return vector.map(value => value / magnitude)
}

export function toVectorLiteral(vector: number[]) {
  return `[${vector.map(value => Number(value).toFixed(8)).join(',')}]`
}

async function getOpenAiEmbeddingKey(userId: string) {
  const fallback = process.env.OPENAI_API_KEY || ''
  if (!userId) return fallback

  const { data, error } = await createServiceClient()
    .from('user_profiles')
    .select('llm_provider, llm_api_key')
    .eq('id', userId)
    .maybeSingle()

  if (error) throw error

  if (data?.llm_provider === 'openai' && data?.llm_api_key) {
    return decryptSecretIfNeeded(String(data.llm_api_key)) || fallback
  }

  return fallback
}

export async function embedTextsForUser(userId: string, texts: string[]) {
  const trimmed = texts.map(text => String(text || '').trim()).filter(Boolean)
  if (trimmed.length === 0) return [] as number[][]

  const apiKey = await getOpenAiEmbeddingKey(userId)
  if (!apiKey) throw new Error('No OpenAI embedding key configured. Set OPENAI_API_KEY in the environment or save an OpenAI API key in Settings.')

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_EMBEDDING_MODEL,
      input: trimmed,
      dimensions: OPENAI_EMBEDDING_DIMENSIONS,
      encoding_format: 'float',
    }),
  })

  const json = await response.json()
  if (!response.ok) {
    throw new Error(json?.error?.message ?? 'OpenAI embeddings request failed')
  }

  const vectors = Array.isArray(json?.data) ? json.data.map((row: { embedding?: number[] }) => Array.isArray(row.embedding) ? row.embedding.map(Number) : []) : []
  return vectors.map(normalizeVector)
}

export async function embedTextForUser(userId: string, text: string) {
  const vectors = await embedTextsForUser(userId, [text])
  return vectors[0] ?? null
}
