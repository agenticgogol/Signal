import { createServiceClient } from '@/lib/supabase'
import { NextRequest } from 'next/server'

export async function GET(req: NextRequest) {
  const params = new URL(req.url).searchParams
  const userId = params.get('userId') || process.env.NEXT_PUBLIC_USER_ID
  const startedAt = params.get('startedAt')
  if (!userId || !startedAt || Number.isNaN(Date.parse(startedAt))) {
    return Response.json({ error: 'userId and a valid startedAt are required' }, { status: 400 })
  }

  try {
    const { data, error } = await createServiceClient()
      .from('crawl_runs')
      .select('id, status, started_at, completed_at, articles_fetched, articles_new, articles_failed, error_log')
      .eq('user_id', userId)
      .gte('started_at', startedAt)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) return Response.json({ error: error.message }, { status: 500 })
    if (!data) return Response.json({ state: 'queued', run: null })
    return Response.json({
      state: data.completed_at ? 'finished' : 'running',
      run: data,
    })
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 })
  }
}
