import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireSignedInUser } from '@/lib/serverAuth'

export async function GET(req: NextRequest) {
  const userId = new URL(req.url).searchParams.get('userId') || ''
  if (!userId) return Response.json({ error: 'userId is required' }, { status: 400 })
  const signedIn = await requireSignedInUser(req, userId)
  if (signedIn instanceof Response) return signedIn

  const { data, error } = await createServiceClient()
    .from('user_profiles')
    .select('digest_email, daily_digest_enabled')
    .eq('id', userId)
    .maybeSingle()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({
    digestEmail: data?.digest_email || signedIn.email || '',
    dailyDigestEnabled: Boolean(data?.daily_digest_enabled),
  })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const userId = typeof body.userId === 'string' ? body.userId : ''
  if (!userId) return Response.json({ error: 'userId is required' }, { status: 400 })
  const signedIn = await requireSignedInUser(req, userId)
  if (signedIn instanceof Response) return signedIn

  const digestEmail = String(body.digestEmail || '').trim() || signedIn.email || ''
  const dailyDigestEnabled = Boolean(body.dailyDigestEnabled)

  const { error } = await createServiceClient()
    .from('user_profiles')
    .update({
      digest_email: digestEmail || null,
      daily_digest_enabled: dailyDigestEnabled,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
