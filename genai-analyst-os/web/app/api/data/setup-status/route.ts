import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getUserAccessProfile } from '@/lib/featureAccess'
import { requireSignedInUser } from '@/lib/serverAuth'

export async function GET(req: NextRequest) {
  const userId = new URL(req.url).searchParams.get('userId') || ''
  if (!userId) return Response.json({ error: 'userId is required' }, { status: 400 })

  const signedIn = await requireSignedInUser(req, userId)
  if (signedIn instanceof Response) return signedIn

  try {
    const db = createServiceClient()
    const [access, sourcesRes, profileRes] = await Promise.all([
      getUserAccessProfile(userId),
      db.from('user_sources').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      db.from('user_profiles').select('voice_fingerprint, digest_email, daily_digest_enabled').eq('id', userId).maybeSingle(),
    ])

    if (sourcesRes.error) return Response.json({ error: sourcesRes.error.message }, { status: 500 })
    if (profileRes.error) return Response.json({ error: profileRes.error.message }, { status: 500 })

    const sourcesCount = Number(sourcesRes.count ?? 0)
    const hasVoice = Boolean(profileRes.data?.voice_fingerprint)
    const digestEmail = String(profileRes.data?.digest_email || '').trim()
    const dailyDigestEnabled = Boolean(profileRes.data?.daily_digest_enabled)

    return Response.json({
      sourcesCount,
      hasSources: sourcesCount > 0,
      hasEnoughSources: sourcesCount >= 3,
      hasVoice,
      digestEmail,
      hasDigestEmail: Boolean(digestEmail),
      dailyDigestEnabled,
      hasPaidEntitlement: access?.hasPaidEntitlement ?? false,
      hasApiKeyConfigured: access?.hasApiKeyConfigured ?? false,
      canUsePaidFeatures: access?.canUsePaidFeatures ?? false,
      checklistComplete: sourcesCount > 0 && Boolean(access?.hasPaidEntitlement) && Boolean(access?.hasApiKeyConfigured),
    })
  } catch (error) {
    return Response.json({ error: String(error) }, { status: 500 })
  }
}
