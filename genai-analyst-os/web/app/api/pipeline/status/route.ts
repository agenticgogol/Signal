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
    const db = createServiceClient()
    const select = 'id, status, started_at, completed_at, articles_fetched, articles_new, articles_failed, error_log'

    // Trusting the client's clock exactly here is fragile — any clock skew
    // between the browser and the DB server, or GitHub Actions' own dispatch
    // queueing delay before the crawler node actually opens its crawl_runs
    // row, can push the real row's started_at earlier than this threshold,
    // silently excluding it and leaving the UI stuck on "queued" forever
    // even though the run completed. A few minutes of tolerance absorbs
    // both without meaningfully risking picking up a stale unrelated run.
    const toleranceMs = 3 * 60 * 1000
    const toleratedStartedAt = new Date(new Date(startedAt).getTime() - toleranceMs).toISOString()

    let { data, error } = await db
      .from('crawl_runs')
      .select(select)
      .eq('user_id', userId)
      .gte('started_at', toleratedStartedAt)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) return Response.json({ error: error.message }, { status: 500 })

    // Belt-and-suspenders: if the tolerance window still somehow misses it
    // (e.g. a very slow GitHub Actions queue), fall back to this user's
    // single latest run rather than reporting "queued" indefinitely.
    if (!data) {
      const fallback = await db
        .from('crawl_runs')
        .select(select)
        .eq('user_id', userId)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (fallback.error) return Response.json({ error: fallback.error.message }, { status: 500 })
      data = fallback.data
    }

    if (!data) return Response.json({ state: 'queued', run: null })
    return Response.json({
      state: data.completed_at ? 'finished' : 'running',
      run: data,
    })
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 })
  }
}
