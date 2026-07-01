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
    .select('drafts_inbox_enabled')
    .eq('id', userId)
    .maybeSingle()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ enabled: Boolean(data?.drafts_inbox_enabled) })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const userId = typeof body.userId === 'string' ? body.userId : ''
  if (!userId) return Response.json({ error: 'userId is required' }, { status: 400 })

  // Same gate as every other agentic/costly feature — the overnight job
  // itself also re-checks this before spending anything.
  const paidGate = await requirePaidFeature(req, userId, 'Drafts Inbox')
  if (paidGate) return paidGate

  const enabled = Boolean(body.enabled)
  const { error } = await createServiceClient()
    .from('user_profiles')
    .update({ drafts_inbox_enabled: enabled, updated_at: new Date().toISOString() })
    .eq('id', userId)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true, enabled })
}
