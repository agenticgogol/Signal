import { NextRequest } from 'next/server'
import { getErrorMessage } from '@/lib/errors'
import { resolveSignedInOrAdmin } from '@/lib/serverAuth'
import { regenerateTodayQueue } from '@/lib/todayQueue'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const userId = typeof body.userId === 'string' ? body.userId : ''
  if (!userId) return Response.json({ error: 'userId is required' }, { status: 400 })

  const access = await resolveSignedInOrAdmin(req, userId)
  if (access instanceof Response) return access

  try {
    const result = await regenerateTodayQueue(access.userId)
    return Response.json(result)
  } catch (error) {
    return Response.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}
