import { NextRequest } from 'next/server'
import { resolveSignedInOrAdmin } from '@/lib/serverAuth'
import { findStaleKnowledgeItems } from '@/lib/knowledge'
import { getErrorMessage } from '@/lib/errors'

// Free — pure heuristics, no LLM call. Not paid-gated for that reason,
// same as any other read-only scan.
export async function GET(req: NextRequest) {
  const userId = new URL(req.url).searchParams.get('userId') || ''
  if (!userId) return Response.json({ error: 'userId is required' }, { status: 400 })

  const access = await resolveSignedInOrAdmin(req, userId)
  if (access instanceof Response) return access

  try {
    const items = await findStaleKnowledgeItems(access.userId)
    return Response.json({ items })
  } catch (error) {
    return Response.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}
