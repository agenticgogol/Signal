import { NextRequest } from 'next/server'
import { resolveSignedInOrAdmin } from '@/lib/serverAuth'
import { scanNoveltyRadar } from '@/lib/radar'

// Free — pure heuristic term-velocity scan, no LLM call. Not paid-gated.
export async function GET(req: NextRequest) {
  const userId = new URL(req.url).searchParams.get('userId') || ''
  if (!userId) return Response.json({ error: 'userId is required' }, { status: 400 })

  const access = await resolveSignedInOrAdmin(req, userId)
  if (access instanceof Response) return access

  try {
    const result = await scanNoveltyRadar(access.userId)
    return Response.json(result)
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}
