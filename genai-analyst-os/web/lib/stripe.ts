import { createServiceClient } from '@/lib/supabase'

function stripeSecretKey() {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('Missing STRIPE_SECRET_KEY.')
  return key
}

export function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000'
}

export function stripePriceId() {
  const priceId = process.env.STRIPE_PRICE_ID
  if (!priceId) throw new Error('Missing STRIPE_PRICE_ID.')
  return priceId
}

export async function createCheckoutSession(params: {
  userId: string
  email?: string | null
  stripeCustomerId?: string | null
}) {
  const body = new URLSearchParams()
  body.set('mode', 'subscription')
  body.set('success_url', `${appUrl()}/feed?subscribed=1`)
  body.set('cancel_url', `${appUrl()}/feed?billing=cancelled`)
  body.set('line_items[0][price]', stripePriceId())
  body.set('line_items[0][quantity]', '1')
  body.set('allow_promotion_codes', 'true')
  body.set('metadata[user_id]', params.userId)
  body.set('subscription_data[metadata][user_id]', params.userId)

  if (params.stripeCustomerId) body.set('customer', params.stripeCustomerId)
  else if (params.email) body.set('customer_email', params.email)

  const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${stripeSecretKey()}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  })

  const json = await response.json()
  if (!response.ok) {
    throw new Error(json?.error?.message ?? 'Stripe checkout session failed')
  }

  return json as { id: string; url: string }
}

export function mapStripePlan(status?: string | null): 'free' | 'pro' {
  if (!status) return 'free'
  return ['active', 'trialing', 'past_due', 'unpaid'].includes(status) ? 'pro' : 'free'
}

export async function resolveUserIdFromStripe(customerId?: string | null, metadataUserId?: string | null) {
  if (metadataUserId) return metadataUserId
  if (!customerId) return null

  const { data, error } = await createServiceClient()
    .from('user_profiles')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle()

  if (error) throw error
  return data?.id ?? null
}
