import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireSignedInUser } from '@/lib/serverAuth'

const VALID_TOPICS = ['infra', 'llm', 'finetune', 'rag', 'agentic', 'llmops', 'eval']

const ROLE_TOPIC_SEED: Record<string, Record<string, number>> = {
  ml_engineer:    { llm: 0.7, finetune: 0.7, infra: 0.6, llmops: 0.5 },
  researcher:     { llm: 0.8, eval: 0.7, finetune: 0.6, rag: 0.5 },
  product_manager: { agentic: 0.6, llm: 0.5, eval: 0.5, rag: 0.4 },
  founder:        { agentic: 0.7, llm: 0.6, infra: 0.4, llmops: 0.4 },
  executive:      { agentic: 0.6, llm: 0.5, eval: 0.4 },
  content_creator: { llm: 0.6, agentic: 0.5, rag: 0.4 },
  student:        { llm: 0.6, rag: 0.5, agentic: 0.5 },
  other:          { llm: 0.5, agentic: 0.5 },
}

export async function GET(req: NextRequest) {
  const userId = new URL(req.url).searchParams.get('userId') || ''
  if (!userId) return Response.json({ error: 'userId is required' }, { status: 400 })

  const signedIn = await requireSignedInUser(req, userId)
  if (signedIn instanceof Response) return signedIn

  const db = createServiceClient()
  const { data, error } = await db
    .from('user_profiles')
    .select('role, interest_areas, reading_goal, reading_frequency, onboarding_completed_at')
    .eq('id', userId)
    .maybeSingle()

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({
    role: data?.role ?? null,
    interestAreas: data?.interest_areas ?? [],
    readingGoal: data?.reading_goal ?? null,
    readingFrequency: data?.reading_frequency ?? null,
    onboardingCompleted: Boolean(data?.onboarding_completed_at),
  })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const userId = typeof body.userId === 'string' ? body.userId : ''
  if (!userId) return Response.json({ error: 'userId is required' }, { status: 400 })

  const signedIn = await requireSignedInUser(req, userId)
  if (signedIn instanceof Response) return signedIn

  const role = typeof body.role === 'string' ? body.role : null
  const interestAreas = Array.isArray(body.interestAreas)
    ? body.interestAreas.filter((t: unknown) => typeof t === 'string' && VALID_TOPICS.includes(t))
    : []
  const readingGoal = typeof body.readingGoal === 'string' ? body.readingGoal : null
  const readingFrequency = typeof body.readingFrequency === 'string' ? body.readingFrequency : null
  const markComplete = body.markComplete !== false

  const db = createServiceClient()

  // Seed topic_weights from role + chosen interests so ranking has a cold-start signal immediately.
  const { data: existing } = await db.from('user_profiles').select('topic_weights').eq('id', userId).maybeSingle()
  const currentWeights = (existing?.topic_weights ?? {}) as Record<string, number>
  const roleSeed = role ? (ROLE_TOPIC_SEED[role] ?? {}) : {}
  const seededWeights = { ...roleSeed }
  for (const topic of interestAreas) {
    seededWeights[topic] = Math.max(seededWeights[topic] ?? 0, 0.75)
  }
  const mergedWeights = { ...seededWeights, ...currentWeights }

  const update: Record<string, unknown> = {
    id: userId,
    role,
    interest_areas: interestAreas,
    reading_goal: readingGoal,
    reading_frequency: readingFrequency,
    topic_weights: mergedWeights,
  }
  if (markComplete) update.onboarding_completed_at = new Date().toISOString()

  const { error } = await db.from('user_profiles').upsert(update)
  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Daily digest is a sensible default for anyone who said "stay current" or "daily" cadence.
  if (readingFrequency === 'daily') {
    await db.from('user_profiles').update({ daily_digest_enabled: true }).eq('id', userId)
  }

  return Response.json({ ok: true, topicWeights: mergedWeights })
}
