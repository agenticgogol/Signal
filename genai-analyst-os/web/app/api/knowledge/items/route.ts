import { NextRequest } from 'next/server'
import { requirePaidFeature } from '@/lib/featureAccess'
import { resolveSignedInOrAdmin } from '@/lib/serverAuth'
import { ingestKnowledgeItem } from '@/lib/knowledge'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const userId = typeof body.userId === 'string' ? body.userId : ''
  const notebookId = typeof body.notebookId === 'string' ? body.notebookId : ''
  const sourceType = body.sourceType === 'url' ? 'url' : body.sourceType === 'note' ? 'note' : null
  const sourceUrl = typeof body.sourceUrl === 'string' ? body.sourceUrl.trim() : ''
  const noteText = typeof body.noteText === 'string' ? body.noteText : ''
  const title = typeof body.title === 'string' ? body.title.trim() : ''

  if (!userId || !notebookId || !sourceType) {
    return Response.json({ error: 'userId, notebookId, and sourceType are required' }, { status: 400 })
  }

  const paidGate = await requirePaidFeature(req, userId, 'Knowledge ingestion')
  if (paidGate) return paidGate

  const access = await resolveSignedInOrAdmin(req, userId)
  if (access instanceof Response) return access

  if (sourceType === 'url' && !sourceUrl) {
    return Response.json({ error: 'sourceUrl is required for URL ingestion' }, { status: 400 })
  }
  if (sourceType === 'note' && !noteText.trim()) {
    return Response.json({ error: 'noteText is required for note ingestion' }, { status: 400 })
  }

  try {
    const item = await ingestKnowledgeItem({
      userId: access.userId,
      notebookId,
      sourceType,
      sourceUrl,
      noteText,
      title,
    })
    return Response.json({ item })
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}
