import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

// Public read, same cold-start rationale as /api/today/queue — a signed-out
// visitor sees the admin/demo account's pending drafts on Today instead of
// an empty Publishing section.
export async function GET(req: NextRequest) {
  const userId = new URL(req.url).searchParams.get('userId') || ''
  if (!userId) return Response.json({ error: 'userId is required' }, { status: 400 })

  const { data, error } = await createServiceClient()
    .from('draft_inbox_items')
    .select('id, topic, format, final_content, source_title, source_url, status, created_at, published_platforms')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(30)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ items: data ?? [] })
}
