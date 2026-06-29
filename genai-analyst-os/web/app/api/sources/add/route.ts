import { createServiceClient } from '@/lib/supabase'
import { NextRequest } from 'next/server'

export async function POST(req: NextRequest) {
  const { url, userId } = await req.json()
  if (!url || !userId) return Response.json({ error: 'url and userId required' }, { status: 400 })

  const db = createServiceClient()
  const { data, error } = await db.from('user_sources').insert({
    user_id: userId,
    url: url.trim(),
    source_tier: 2,
    rss_detection_method: 'not_found',
  }).select().single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true, source: data })
}
