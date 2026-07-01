import { requireSignedInUser } from '@/lib/serverAuth'
import { publishDraft } from '@/lib/publishing'
import { getErrorMessage } from '@/lib/errors'

const VALID_TARGETS = ['medium', 'linkedin', 'x', 'email']

export async function POST(req: Request) {
  const { userId, itemId, platform } = await req.json()
  if (!userId || !itemId || !VALID_TARGETS.includes(platform)) {
    return Response.json({ error: 'userId, itemId, and a valid platform are required' }, { status: 400 })
  }

  const signedIn = await requireSignedInUser(req, userId)
  if (signedIn instanceof Response) return signedIn

  try {
    const result = await publishDraft(userId, itemId, platform)
    return Response.json(result)
  } catch (error) {
    return Response.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}
