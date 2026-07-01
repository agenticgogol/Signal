import { NextRequest } from 'next/server'
import { requireSignedInUser } from '@/lib/serverAuth'
import { getOrGenerateTodayQueue } from '@/lib/todayQueue'

// Free — pure ranking arithmetic over existing scores, no LLM call.
export async function GET(req: NextRequest) {
  const userId = new URL(req.url).searchParams.get('userId') || ''
  if (!userId) return Response.json({ error: 'userId is required' }, { status: 400 })

  const signedIn = await requireSignedInUser(req, userId)
  if (signedIn instanceof Response) return signedIn

  try {
    const result = await getOrGenerateTodayQueue(userId)
    return Response.json(result)
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}
