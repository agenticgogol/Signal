import { requirePaidFeature } from '@/lib/featureAccess'
import { regenerateDraftWithFeedback } from '@/lib/draftsInbox'
import { getErrorMessage } from '@/lib/errors'

export const maxDuration = 180

// "Give feedback & regenerate" on a Today-page draft — rewrites the draft
// targeting the feedback immediately, and separately logs + distills the
// feedback into durable voice_fingerprint traits for future drafts.
export async function POST(req: Request) {
  const { userId, itemId, feedback } = await req.json()
  if (!userId || !itemId || !feedback?.trim()) {
    return Response.json({ error: 'userId, itemId, and feedback are required' }, { status: 400 })
  }

  const paidGate = await requirePaidFeature(req, userId, 'Regenerate draft')
  if (paidGate) return paidGate

  try {
    const result = await regenerateDraftWithFeedback(userId, itemId, feedback.trim())
    return Response.json(result)
  } catch (error) {
    return Response.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}
