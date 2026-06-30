import { verifyAdminToken } from '@/lib/adminAuth'
import { createServiceClient } from '@/lib/supabase'

export type UserPlan = 'free' | 'pro'

export async function getUserPlan(userId: string): Promise<UserPlan | null> {
  if (!userId) return null
  const { data, error } = await createServiceClient()
    .from('user_profiles')
    .select('plan')
    .eq('id', userId)
    .maybeSingle()

  if (error) throw error
  return (data?.plan as UserPlan | null) ?? 'free'
}

export async function canUsePaidFeature(req: Request, userId: string): Promise<boolean> {
  if (verifyAdminToken(req)) return true
  const plan = await getUserPlan(userId)
  return plan === 'pro'
}

export async function requirePaidFeature(
  req: Request,
  userId: string,
  featureName: string,
  extra?: Record<string, unknown>,
) {
  if (await canUsePaidFeature(req, userId)) return null
  return Response.json({
    error: `${featureName} is a Pro feature.`,
    upgrade_required: true,
    feature: featureName,
    ...extra,
  }, { status: 402 })
}
