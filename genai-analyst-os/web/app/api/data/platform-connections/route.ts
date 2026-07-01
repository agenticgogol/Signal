import { NextRequest } from 'next/server'
import { requireSignedInUser } from '@/lib/serverAuth'
import { listConnections, saveConnection, removeConnection, type Platform } from '@/lib/publishing'
import { getErrorMessage } from '@/lib/errors'

const VALID_PLATFORMS: Platform[] = ['medium', 'linkedin', 'x']

export async function GET(req: NextRequest) {
  const userId = new URL(req.url).searchParams.get('userId') || ''
  if (!userId) return Response.json({ error: 'userId is required' }, { status: 400 })

  const signedIn = await requireSignedInUser(req, userId)
  if (signedIn instanceof Response) return signedIn

  try {
    const connected = await listConnections(userId)
    return Response.json({ connected })
  } catch (error) {
    return Response.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const userId = typeof body.userId === 'string' ? body.userId : ''
  const platform = VALID_PLATFORMS.includes(body.platform) ? body.platform as Platform : null
  const accessToken = typeof body.accessToken === 'string' ? body.accessToken.trim() : ''
  if (!userId || !platform || !accessToken) {
    return Response.json({ error: 'userId, a valid platform, and accessToken are required' }, { status: 400 })
  }

  const signedIn = await requireSignedInUser(req, userId)
  if (signedIn instanceof Response) return signedIn

  const extra: Record<string, unknown> = {}
  if (platform === 'linkedin' && typeof body.personUrn === 'string') extra.personUrn = body.personUrn.trim()

  try {
    await saveConnection(userId, platform, accessToken, extra)
    return Response.json({ ok: true })
  } catch (error) {
    return Response.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const userId = typeof body.userId === 'string' ? body.userId : ''
  const platform = VALID_PLATFORMS.includes(body.platform) ? body.platform as Platform : null
  if (!userId || !platform) return Response.json({ error: 'userId and a valid platform are required' }, { status: 400 })

  const signedIn = await requireSignedInUser(req, userId)
  if (signedIn instanceof Response) return signedIn

  try {
    await removeConnection(userId, platform)
    return Response.json({ ok: true })
  } catch (error) {
    return Response.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}
