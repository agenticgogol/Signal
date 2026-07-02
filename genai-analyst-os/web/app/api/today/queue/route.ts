import { NextRequest } from 'next/server'
import { getErrorMessage } from '@/lib/errors'
import { getOrGenerateTodayQueue } from '@/lib/todayQueue'

// Free — pure ranking arithmetic over existing scores, no LLM call. Public
// read, same trust model as /api/data/feed: signed-out visitors see the
// admin/demo account's queue (cold-start content) scoped by whatever userId
// is passed, so Today is never blank for a guest. Writes (mark read, refresh)
// still require a real session or an admin token.
export async function GET(req: NextRequest) {
  const userId = new URL(req.url).searchParams.get('userId') || ''
  if (!userId) return Response.json({ error: 'userId is required' }, { status: 400 })

  try {
    const result = await getOrGenerateTodayQueue(userId)
    return Response.json(result)
  } catch (error) {
    return Response.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}
