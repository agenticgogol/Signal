import { verifyAdminToken } from '@/lib/adminAuth'
import { createServiceClient } from '@/lib/supabase'

export type UserPlan = 'free' | 'pro'
export interface UserAccessProfile {
  plan: UserPlan
  hasApiKeyConfigured: boolean
}

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

export async function getUserAccessProfile(userId: string): Promise<UserAccessProfile | null> {
  if (!userId) return null
  const { data, error } = await createServiceClient()
    .from('user_profiles')
    .select('plan, llm_api_key')
    .eq('id', userId)
    .maybeSingle()

  if (error) throw error
  return {
    plan: (data?.plan as UserPlan | null) ?? 'free',
    hasApiKeyConfigured: Boolean(String(data?.llm_api_key || '').trim()),
  }
}

export async function canUsePaidFeature(req: Request, userId: string): Promise<boolean> {
  if (verifyAdminToken(req)) return true
  const profile = await getUserAccessProfile(userId)
  return profile?.plan === 'pro' || profile?.hasApiKeyConfigured === true
}

export async function requirePaidFeature(
  req: Request,
  userId: string,
  featureName: string,
  extra?: Record<string, unknown>,
) {
  if (await canUsePaidFeature(req, userId)) return null
  return Response.json({
    error: `${featureName} requires a subscription or a configured account-level model API key.`,
    upgrade_required: true,
    feature: featureName,
    ...extra,
  }, { status: 402 })
}
