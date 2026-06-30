import { requirePaidFeature } from '@/lib/featureAccess'
import { createServiceClient } from '@/lib/supabase'

export async function POST(req: Request) {
  const pat = process.env.GITHUB_PAT
  let lookbackDays: string | null = null
  let maxPerSource: string | null = null
  let userId = ''
  try {
    const body = await req.json()
    userId = String(body.userId ?? '')
    if ([1, 3, 7, 14].includes(Number(body.lookbackDays))) lookbackDays = String(body.lookbackDays)
    if ([1, 3, 5, 10].includes(Number(body.maxPerSource))) maxPerSource = String(body.maxPerSource)
  } catch {}

  if (!userId) {
    return Response.json({ ok: false, error: 'userId is required' }, { status: 400 })
  }
  const paidGate = await requirePaidFeature(req, userId, 'Feed pipeline refresh')
  if (paidGate) return paidGate

  // If the caller (e.g. Settings "Run now") didn't pass explicit values,
  // fall back to the user's persisted schedule config rather than a silent
  // 7/5 default — keeps manual and scheduled runs using the same depth.
  if (lookbackDays === null || maxPerSource === null) {
    const { data } = await createServiceClient()
      .from('user_profiles')
      .select('scheduled_crawl_lookback_days, scheduled_crawl_max_per_source')
      .eq('id', userId)
      .maybeSingle()
    if (lookbackDays === null) lookbackDays = String(data?.scheduled_crawl_lookback_days ?? 7)
    if (maxPerSource === null) maxPerSource = String(data?.scheduled_crawl_max_per_source ?? 5)
  }

  if (!pat) {
    return Response.json({ ok: false, error: 'GITHUB_PAT not configured' }, { status: 500 })
  }

  const res = await fetch(
    'https://api.github.com/repos/agenticgogol/Signal/actions/workflows/daily-pipeline.yml/dispatches',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${pat}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ref: 'master',
        inputs: {
          lookback_days: lookbackDays,
          max_per_source: maxPerSource,
          user_id: userId,
        },
      }),
    }
  )

  if (res.status === 204) {
    return Response.json({ ok: true, async: true })
  }

  const body = await res.text()
  return Response.json({ ok: false, error: body }, { status: res.status })
}
