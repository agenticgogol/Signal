import { createServiceClient } from '@/lib/supabase'
import { NextRequest } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId') || process.env.NEXT_PUBLIC_USER_ID!
  const date = searchParams.get('date')
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  try {
    const db = createServiceClient()
    let query = db
      .from('user_feed_items')
      .select('blend_score, feed_date, articles(id, url, title, tldr_bullets, topic_tags, depth_score, published_at, source_id)')
      .eq('user_id', userId)
      .order('blend_score', { ascending: false })
      .limit(120)

    if (date) {
      query = query.eq('feed_date', date)
    } else if (from && to) {
      query = query.gte('feed_date', from).lte('feed_date', to)
    } else {
      // Default: today
      query = query.eq('feed_date', new Date().toISOString().split('T')[0])
    }

    const { data, error } = await query
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ items: data ?? [] })
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 })
  }
}
