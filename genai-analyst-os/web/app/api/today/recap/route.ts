import { NextRequest } from 'next/server'
import { getLearningRecap } from '@/lib/learningRecap'
import { getErrorMessage } from '@/lib/errors'

// Public read, same cold-start rationale as /api/today/queue — pure
// aggregation over existing events, no LLM call, so it's free to compute.
export async function GET(req: NextRequest) {
  const userId = new URL(req.url).searchParams.get('userId') || ''
  if (!userId) return Response.json({ error: 'userId is required' }, { status: 400 })

  try {
    const recap = await getLearningRecap(userId)
    return Response.json(recap)
  } catch (error) {
    return Response.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}
