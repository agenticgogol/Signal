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
    .select('scheduled_crawl_enabled, scheduled_crawl_hour_utc, last_scheduled_crawl_at')
    .eq('id', userId)
    .maybeSingle()

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({
    enabled: Boolean(data?.scheduled_crawl_enabled),
    hourUtc: data?.scheduled_crawl_hour_utc ?? null,
    lastScheduledCrawlAt: data?.last_scheduled_crawl_at ?? null,
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

  const { error } = await createServiceClient()
    .from('user_profiles')
    .update({
      scheduled_crawl_enabled: enabled,
      scheduled_crawl_hour_utc: hourUtc,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true, enabled, hourUtc })
}
