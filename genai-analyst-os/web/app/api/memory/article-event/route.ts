import { NextRequest } from 'next/server'
import { resolveSignedInOrAdmin } from '@/lib/serverAuth'
import { logArticleEvent } from '@/lib/memory'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const userId = typeof body.userId === 'string' ? body.userId : ''
  const articleId = typeof body.articleId === 'string' ? body.articleId : ''
  const eventType = typeof body.eventType === 'string' ? body.eventType : ''
  const sessionId = typeof body.sessionId === 'string' ? body.sessionId : ''
  const metadata = body.metadata && typeof body.metadata === 'object' ? body.metadata as Record<string, unknown> : {}

  if (!userId || !articleId || !['open', 'pin', 'save', 'dismiss', 'impression'].includes(eventType)) {
    return Response.json({ error: 'userId, articleId, and valid eventType are required' }, { status: 400 })
  }

  const access = await resolveSignedInOrAdmin(req, userId)
  if (access instanceof Response) return access

  await logArticleEvent({
    userId: access.userId,
    articleId,
    eventType: eventType as 'open' | 'pin' | 'save' | 'dismiss' | 'impression',
    sessionId,
    metadata,
  })

  return Response.json({ ok: true })
}
