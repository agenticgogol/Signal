import { createServiceClient } from '@/lib/supabase'
import { NextRequest } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId') || process.env.NEXT_PUBLIC_USER_ID!

  try {
    const db = createServiceClient()
    const { data, error } = await db
      .from('user_sources')
      .select('id, url, rss_url, source_tier, rss_detection_method')
      .eq('user_id', userId)
      .order('source_tier')
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ sources: data ?? [] })
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 })
  }
}
