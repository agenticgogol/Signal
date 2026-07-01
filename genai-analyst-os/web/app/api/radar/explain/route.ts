import { NextRequest } from 'next/server'
import { requirePaidFeature } from '@/lib/featureAccess'
import { resolveSignedInOrAdmin } from '@/lib/serverAuth'
import { explainNoveltyRadar, type RadarHit } from '@/lib/radar'

// Costs one batched LLM call — separately gated from the free scan above,
// same "button first, LLM optional" pattern as Find Connections.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const userId = typeof body.userId === 'string' ? body.userId : ''
  const hits: RadarHit[] = Array.isArray(body.hits) ? body.hits : []
  if (!userId || hits.length === 0) {
    return Response.json({ error: 'userId and hits are required' }, { status: 400 })
  }

  const paidGate = await requirePaidFeature(req, userId, 'Novelty Radar explanations')
  if (paidGate) return paidGate

  const access = await resolveSignedInOrAdmin(req, userId)
  if (access instanceof Response) return access

  try {
    const explained = await explainNoveltyRadar(access.userId, hits)
    return Response.json({ hits: explained })
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}
