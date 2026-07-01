import { NextRequest } from 'next/server'
import { resolveSignedInOrAdmin } from '@/lib/serverAuth'
import { archiveKnowledgeItems } from '@/lib/knowledge'
import { getErrorMessage } from '@/lib/errors'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const userId = typeof body.userId === 'string' ? body.userId : ''
  const itemIds = Array.isArray(body.itemIds) ? body.itemIds.filter((id: unknown) => typeof id === 'string') : []
  if (!userId || itemIds.length === 0) {
    return Response.json({ error: 'userId and itemIds are required' }, { status: 400 })
  }

  const access = await resolveSignedInOrAdmin(req, userId)
  if (access instanceof Response) return access

  try {
    const archivedCount = await archiveKnowledgeItems(access.userId, itemIds)
    return Response.json({ archivedCount })
  } catch (error) {
    return Response.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}
