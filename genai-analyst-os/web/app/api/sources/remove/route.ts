import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireSignedInUser } from '@/lib/serverAuth'

export async function POST(req: NextRequest) {
  const { sourceId, userId } = await req.json()
  if (!sourceId || !userId) return Response.json({ error: 'sourceId and userId required' }, { status: 400 })

  const signedIn = await requireSignedInUser(req, userId)
  if (signedIn instanceof Response) return signedIn

  const db = createServiceClient()
  const { error } = await db
    .from('user_sources')
    .delete()
    .eq('id', sourceId)
    .eq('user_id', userId)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
