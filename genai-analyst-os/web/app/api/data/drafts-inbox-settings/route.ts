import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireSignedInUser } from '@/lib/serverAuth'
import { requirePaidFeature } from '@/lib/featureAccess'
import { getErrorMessage } from '@/lib/errors'

const VALID_FORMATS = ['linkedin', 'substack', 'thread', 'blog', 'youtube_long', 'youtube_short']

export async function GET(req: NextRequest) {
  const userId = new URL(req.url).searchParams.get('userId') || ''
  if (!userId) return Response.json({ error: 'userId is required' }, { status: 400 })

  const signedIn = await requireSignedInUser(req, userId)
  if (signedIn instanceof Response) return signedIn

  const { data, error } = await createServiceClient()
    .from('user_profiles')
    .select('drafts_inbox_enabled, drafts_inbox_format')
    .eq('id', userId)
    .maybeSingle()

  if (error) return Response.json({ error: getErrorMessage(error) }, { status: 500 })
  return Response.json({
    enabled: Boolean(data?.drafts_inbox_enabled),
    format: data?.drafts_inbox_format || 'linkedin',
  })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const userId = typeof body.userId === 'string' ? body.userId : ''
  if (!userId) return Response.json({ error: 'userId is required' }, { status: 400 })

  // Same gate as every other agentic/costly feature — the overnight job
  // itself also re-checks this before spending anything.
  const paidGate = await requirePaidFeature(req, userId, 'Drafts Inbox')
  if (paidGate) return paidGate

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (typeof body.enabled === 'boolean') update.drafts_inbox_enabled = body.enabled
  if (typeof body.format === 'string' && VALID_FORMATS.includes(body.format)) update.drafts_inbox_format = body.format

  const { error } = await createServiceClient()
    .from('user_profiles')
    .update(update)
    .eq('id', userId)

  if (error) return Response.json({ error: getErrorMessage(error) }, { status: 500 })
  return Response.json({ ok: true, enabled: update.drafts_inbox_enabled, format: update.drafts_inbox_format })
}
