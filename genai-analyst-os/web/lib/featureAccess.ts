import { verifyAdminToken } from '@/lib/adminAuth'
import { requireSignedInUser } from '@/lib/serverAuth'
import { createServiceClient } from '@/lib/supabase'

export type UserPlan = 'free' | 'pro'
export interface UserAccessProfile {
  plan: UserPlan
  hasApiKeyConfigured: boolean
  hasPaidEntitlement: boolean
  canManageModelSettings: boolean
  canUsePaidFeatures: boolean
  requiresAdminForPaidActions: boolean
}

function toAccessProfile(data: { plan?: UserPlan | null; llm_api_key?: string | null } | null): UserAccessProfile {
  const plan = (data?.plan as UserPlan | null) ?? 'free'
  const hasApiKeyConfigured = Boolean(String(data?.llm_api_key || '').trim())
  const hasPaidEntitlement = plan === 'pro'
  const canUsePaidFeatures = hasPaidEntitlement && hasApiKeyConfigured

  return {
    plan,
    hasApiKeyConfigured,
    hasPaidEntitlement,
    canManageModelSettings: hasPaidEntitlement,
    canUsePaidFeatures,
    requiresAdminForPaidActions: !canUsePaidFeatures,
  }
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
  return toAccessProfile(data)
}

export async function canUsePaidFeature(req: Request, userId: string): Promise<boolean> {
  if (verifyAdminToken(req)) return true
  const signedIn = await requireSignedInUser(req, userId)
  if (signedIn instanceof Response) return false
  const profile = await getUserAccessProfile(userId)
  return profile?.canUsePaidFeatures === true
}

export async function requirePaidFeature(
  req: Request,
  userId: string,
  featureName: string,
  extra?: Record<string, unknown>,
) {
  if (verifyAdminToken(req)) return null

  const signedIn = await requireSignedInUser(req, userId)
  if (signedIn instanceof Response) return signedIn

  const profile = await getUserAccessProfile(userId)
  if (profile?.canUsePaidFeatures === true) return null

  return Response.json({
    error: `${featureName} requires an active subscription and a configured account-level model API key.`,
    upgrade_required: true,
    model_configuration_required: true,
    feature: featureName,
    ...extra,
  }, { status: 402 })
}
