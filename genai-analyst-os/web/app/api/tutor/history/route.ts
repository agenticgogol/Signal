import { NextRequest } from 'next/server'
import { resolveSignedInOrAdmin } from '@/lib/serverAuth'
import { getConceptLookupHistory } from '@/lib/conceptTutor'
import { getErrorMessage } from '@/lib/errors'

export async function GET(req: NextRequest) {
  const userId = new URL(req.url).searchParams.get('userId') || ''
  if (!userId) return Response.json({ error: 'userId is required' }, { status: 400 })

  const access = await resolveSignedInOrAdmin(req, userId)
  if (access instanceof Response) return access

  try {
    const history = await getConceptLookupHistory(access.userId)
    return Response.json({ history })
  } catch (error) {
    return Response.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}
