import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { STARTER_SOURCES } from '@/lib/starterSources'
import { requireSignedInUser } from '@/lib/serverAuth'

export async function POST(req: NextRequest) {
  const { userId } = await req.json()
  if (!userId) return Response.json({ error: 'userId required' }, { status: 400 })

  const signedIn = await requireSignedInUser(req, userId)
  if (signedIn instanceof Response) return signedIn

  const db = createServiceClient()
  const { data: existing, error: existingError } = await db
    .from('user_sources')
    .select('id')
    .eq('user_id', userId)
    .limit(1)

  if (existingError) return Response.json({ error: existingError.message }, { status: 500 })
  if ((existing ?? []).length > 0) return Response.json({ ok: true, inserted: 0, skipped: true })

  const rows = STARTER_SOURCES.map(source => ({
    user_id: userId,
    url: source.url,
    source_tier: source.source_tier,
    rss_detection_method: 'not_found',
  }))

  const { error } = await db
    .from('user_sources')
    .insert(rows)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true, inserted: rows.length, skipped: false })
}
