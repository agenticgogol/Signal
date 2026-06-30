import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireSignedInUser } from '@/lib/serverAuth'
import { requirePaidFeature } from '@/lib/featureAccess'

export async function GET(req: NextRequest) {
  const userId = new URL(req.url).searchParams.get('userId') || ''
  if (!userId) return Response.json({ error: 'userId is required' }, { status: 400 })

  const signedIn = await requireSignedInUser(req, userId)
  if (signedIn instanceof Response) return signedIn

  const { data, error } = await createServiceClient()
    .from('user_profiles')
    .select('scheduled_crawl_enabled, scheduled_crawl_hour_utc, last_scheduled_crawl_at, scheduled_crawl_lookback_days, scheduled_crawl_max_per_source')
    .eq('id', userId)
    .maybeSingle()

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({
    enabled: Boolean(data?.scheduled_crawl_enabled),
    hourUtc: data?.scheduled_crawl_hour_utc ?? null,
    lastScheduledCrawlAt: data?.last_scheduled_crawl_at ?? null,
    lookbackDays: data?.scheduled_crawl_lookback_days ?? 7,
    maxPerSource: data?.scheduled_crawl_max_per_source ?? 5,
  })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const userId = typeof body.userId === 'string' ? body.userId : ''
  if (!userId) return Response.json({ error: 'userId is required' }, { status: 400 })

  // Scheduling is a Pro feature, same gate as the manual "Get Latest Feed" trigger.
  const paidGate = await requirePaidFeature(req, userId, 'Scheduled feed refresh')
  if (paidGate) return paidGate

  const enabled = Boolean(body.enabled)
  const hourUtc = enabled
    ? Math.max(0, Math.min(23, Number(body.hourUtc)))
    : (Number.isFinite(Number(body.hourUtc)) ? Math.max(0, Math.min(23, Number(body.hourUtc))) : null)

  if (enabled && !Number.isFinite(Number(body.hourUtc))) {
    return Response.json({ error: 'hourUtc is required to enable scheduling' }, { status: 400 })
  }

  const update: Record<string, unknown> = {
    scheduled_crawl_enabled: enabled,
    scheduled_crawl_hour_utc: hourUtc,
    updated_at: new Date().toISOString(),
  }

  // lookbackDays/maxPerSource are shared by manual "Run now" and the scheduled
  // hourly job — single source of truth instead of the Feed page's localStorage.
  if ([1, 3, 7, 14].includes(Number(body.lookbackDays))) {
    update.scheduled_crawl_lookback_days = Number(body.lookbackDays)
  }
  if ([1, 3, 5, 10].includes(Number(body.maxPerSource))) {
    update.scheduled_crawl_max_per_source = Number(body.maxPerSource)
  }

  const { error } = await createServiceClient()
    .from('user_profiles')
    .update(update)
    .eq('id', userId)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({
    ok: true,
    enabled,
    hourUtc,
    lookbackDays: update.scheduled_crawl_lookback_days,
    maxPerSource: update.scheduled_crawl_max_per_source,
  })
}
