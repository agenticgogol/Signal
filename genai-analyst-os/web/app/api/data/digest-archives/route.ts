import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId') || process.env.NEXT_PUBLIC_USER_ID!
  const db = createServiceClient()

  const dailyCutoff = new Date()
  dailyCutoff.setUTCDate(dailyCutoff.getUTCDate() - 7)
  const dailyISO = dailyCutoff.toISOString().slice(0, 10)

  const weeklyCutoff = new Date()
  weeklyCutoff.setUTCDate(weeklyCutoff.getUTCDate() - 56)
  const weeklyISO = weeklyCutoff.toISOString().slice(0, 10)

  const { data: dailyArchive } = await db
    .from('daily_digests')
    .select('digest_date, article_count, dominant_topics, generated_at')
    .eq('user_id', userId)
    .lt('digest_date', dailyISO)
    .order('digest_date', { ascending: false })
    .limit(30)

  const { data: weeklyArchive } = await db
    .from('weekly_digests')
    .select('week_start, article_count, dominant_topics, generated_at')
    .eq('user_id', userId)
    .lt('week_start', weeklyISO)
    .order('week_start', { ascending: false })
    .limit(20)

  return Response.json({
    dailyArchive: dailyArchive ?? [],
    weeklyArchive: weeklyArchive ?? [],
  })
}
