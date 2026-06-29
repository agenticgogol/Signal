import { createServiceClient } from '@/lib/supabase'
import { NextRequest } from 'next/server'

// Returns the most recent feed_date that has articles for this user
export async function GET(req: NextRequest) {
  const userId = new URL(req.url).searchParams.get('userId') || process.env.NEXT_PUBLIC_USER_ID!
  try {
    const db = createServiceClient()
    const { data } = await db
      .from('user_feed_items')
      .select('feed_date')
      .eq('user_id', userId)
      .order('feed_date', { ascending: false })
      .limit(1)
    const latestDate = data?.[0]?.feed_date ?? null
    return Response.json({ date: latestDate })
  } catch (err) {
    return Response.json({ date: null, error: String(err) })
  }
}
