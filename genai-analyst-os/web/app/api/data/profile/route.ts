import { NextRequest } from 'next/server'
import { getUserAccessProfile } from '@/lib/featureAccess'

export async function GET(req: NextRequest) {
  const userId = new URL(req.url).searchParams.get('userId') || process.env.NEXT_PUBLIC_USER_ID
  if (!userId) return Response.json({ error: 'userId is required' }, { status: 400 })

  try {
    const profile = await getUserAccessProfile(userId)
    if (!profile) return Response.json({ error: 'Profile not found' }, { status: 404 })

    return Response.json({
      plan: profile.plan,
      isPro: profile.plan === 'pro',
      hasPaidEntitlement: profile.hasPaidEntitlement,
      hasApiKeyConfigured: profile.hasApiKeyConfigured,
      canManageModelSettings: profile.canManageModelSettings,
      canUsePaidFeatures: profile.canUsePaidFeatures,
      requiresAdminForPaidActions: profile.requiresAdminForPaidActions,
    })
  } catch (error) {
    return Response.json({ error: String(error) }, { status: 500 })
  }
}
