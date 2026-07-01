import { NextRequest } from 'next/server'
import { requirePaidFeature } from '@/lib/featureAccess'
import { resolveSignedInOrAdmin } from '@/lib/serverAuth'
import { findKnowledgeConnections } from '@/lib/knowledge'

// Button-triggered only — never called on a schedule. The heuristic pass
// inside findKnowledgeConnections is free; this route's only real cost is
// the single batched LLM call it makes if candidate pairs are found.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const userId = typeof body.userId === 'string' ? body.userId : ''
  if (!userId) return Response.json({ error: 'userId is required' }, { status: 400 })

  const paidGate = await requirePaidFeature(req, userId, 'Knowledge connection finder')
  if (paidGate) return paidGate

  const access = await resolveSignedInOrAdmin(req, userId)
  if (access instanceof Response) return access

  try {
    const result = await findKnowledgeConnections(access.userId)
    return Response.json(result)
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}
