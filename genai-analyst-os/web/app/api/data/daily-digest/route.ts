import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId') || process.env.NEXT_PUBLIC_USER_ID!
  const db = createServiceClient()
  const today = new Date().toISOString().slice(0, 10)

  const { data: current, error: currentError } = await db
    .from('daily_digests')
    .select('digest_date, narrative, article_count, dominant_topics, generated_at, emailed_at')
    .eq('user_id', userId)
    .lte('digest_date', today)
    .order('digest_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (currentError) return Response.json({ error: currentError.message }, { status: 500 })

  const sevenDaysAgo = new Date()
  sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7)
  const cutoff = sevenDaysAgo.toISOString().slice(0, 10)

  const { data: recent } = await db
    .from('daily_digests')
    .select('digest_date, article_count, dominant_topics, generated_at')
    .eq('user_id', userId)
    .gte('digest_date', cutoff)
    .order('digest_date', { ascending: false })

  const { data: archive } = await db
    .from('daily_digests')
    .select('digest_date, article_count, dominant_topics, generated_at')
    .eq('user_id', userId)
    .lt('digest_date', cutoff)
    .order('digest_date', { ascending: false })
    .limit(24)

  return Response.json({
    current: current ?? null,
    recent: recent ?? [],
    archive: archive ?? [],
  })
}
