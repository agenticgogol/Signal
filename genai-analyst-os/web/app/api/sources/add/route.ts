import { createServiceClient } from '@/lib/supabase'
import { NextRequest } from 'next/server'
import { resolveSignedInOrAdmin } from '@/lib/serverAuth'

export async function POST(req: NextRequest) {
  const { url, userId } = await req.json()
  if (!url || !userId) return Response.json({ error: 'url and userId required' }, { status: 400 })

  const access = await resolveSignedInOrAdmin(req, userId)
  if (access instanceof Response) return access

  const db = createServiceClient()
  const { data, error } = await db.from('user_sources').insert({
    user_id: access.userId,
    url: url.trim(),
    source_tier: 2,
    rss_detection_method: 'not_found',
  }).select().single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true, source: data })
}
