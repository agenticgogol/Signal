import { NextRequest } from 'next/server'
import { getErrorMessage } from '@/lib/errors'
import { requireSignedInUser } from '@/lib/serverAuth'
import { markQueueItemStatus } from '@/lib/todayQueue'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const userId = typeof body.userId === 'string' ? body.userId : ''
  const queueItemId = typeof body.queueItemId === 'string' ? body.queueItemId : ''
  const status = body.status === 'read' ? 'read' : body.status === 'skipped' ? 'skipped' : null
  if (!userId || !queueItemId || !status) {
    return Response.json({ error: 'userId, queueItemId, and a valid status are required' }, { status: 400 })
  }

  const signedIn = await requireSignedInUser(req, userId)
  if (signedIn instanceof Response) return signedIn

  try {
    await markQueueItemStatus(userId, queueItemId, status)
    return Response.json({ ok: true })
  } catch (error) {
    return Response.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}
