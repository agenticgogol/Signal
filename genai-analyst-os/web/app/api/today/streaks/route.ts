import { NextRequest } from 'next/server'
import { requireSignedInUser } from '@/lib/serverAuth'
import { getStreaks } from '@/lib/gamification'
import { getErrorMessage } from '@/lib/errors'

export async function GET(req: NextRequest) {
  const userId = new URL(req.url).searchParams.get('userId') || ''
  if (!userId) return Response.json({ error: 'userId is required' }, { status: 400 })

  const signedIn = await requireSignedInUser(req, userId)
  if (signedIn instanceof Response) return signedIn

  try {
    const streaks = await getStreaks(userId)
    return Response.json(streaks)
  } catch (error) {
    return Response.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}
