import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { STARTER_SOURCES } from '@/lib/starterSources'
import { resolveSignedInOrAdmin } from '@/lib/serverAuth'

export async function POST(req: NextRequest) {
  const { userId } = await req.json()
  if (!userId) return Response.json({ error: 'userId required' }, { status: 400 })

  const access = await resolveSignedInOrAdmin(req, userId)
  if (access instanceof Response) return access

  const db = createServiceClient()
  const { data: existing, error: existingError } = await db
    .from('user_sources')
    .select('id')
    .eq('user_id', access.userId)
    .limit(1)

  if (existingError) return Response.json({ error: existingError.message }, { status: 500 })
  if ((existing ?? []).length > 0) return Response.json({ ok: true, inserted: 0, skipped: true })

  const rows = STARTER_SOURCES.map(source => ({
    user_id: access.userId,
    url: source.url,
    rss_url: source.rss_url ?? null,
    source_tier: source.source_tier,
    rss_detection_method: source.rss_detection_method,
  }))

  const { error } = await db
    .from('user_sources')
    .insert(rows)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true, inserted: rows.length, skipped: false })
}
