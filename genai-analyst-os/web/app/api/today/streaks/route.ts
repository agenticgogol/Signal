import { NextRequest } from 'next/server'
import { getStreaks } from '@/lib/gamification'
import { getErrorMessage } from '@/lib/errors'

// Public read, same cold-start rationale as /api/today/queue.
export async function GET(req: NextRequest) {
  const userId = new URL(req.url).searchParams.get('userId') || ''
  if (!userId) return Response.json({ error: 'userId is required' }, { status: 400 })

  try {
    const streaks = await getStreaks(userId)
    return Response.json(streaks)
  } catch (error) {
    return Response.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}
