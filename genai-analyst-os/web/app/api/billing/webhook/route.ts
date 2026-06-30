import crypto from 'node:crypto'
import { createServiceClient } from '@/lib/supabase'
import { mapStripePlan, resolveUserIdFromStripe } from '@/lib/stripe'

function verifyStripeSignature(body: string, signatureHeader: string | null) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) throw new Error('Missing STRIPE_WEBHOOK_SECRET.')
  if (!signatureHeader) return false

  const parts = Object.fromEntries(
    signatureHeader.split(',').map(part => {
      const [key, value] = part.split('=')
      return [key, value]
    }),
  )

  const timestamp = parts.t
  const signature = parts.v1
  if (!timestamp || !signature) return false

  const ageSeconds = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp))
  if (!Number.isFinite(ageSeconds) || ageSeconds > 300) return false

  const payload = `${timestamp}.${body}`
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex')

  const left = Buffer.from(expected)
  const right = Buffer.from(signature)
  return left.length === right.length && crypto.timingSafeEqual(left, right)
}

export async function POST(req: Request) {
  const rawBody = await req.text()
  if (!verifyStripeSignature(rawBody, req.headers.get('stripe-signature'))) {
    return Response.json({ error: 'Invalid Stripe signature' }, { status: 400 })
  }

  const event = JSON.parse(rawBody) as {
    id: string
    type: string
    data?: { object?: Record<string, unknown> }
  }

  const db = createServiceClient()
  const { data: existing, error: existingError } = await db
    .from('processed_stripe_events')
    .select('event_id')
    .eq('event_id', event.id)
    .maybeSingle()

  if (existingError) return Response.json({ error: existingError.message }, { status: 500 })
  if (existing) return Response.json({ ok: true, duplicate: true })

  const object = event.data?.object ?? {}
  const metadata = (object.metadata ?? {}) as Record<string, string>
  const customerId = typeof object.customer === 'string' ? object.customer : null
  const userId = await resolveUserIdFromStripe(customerId, metadata.user_id ?? null)

  let plan: 'free' | 'pro' | null = null
  if (event.type === 'checkout.session.completed') {
    plan = 'pro'
  } else if (
    event.type === 'customer.subscription.created'
    || event.type === 'customer.subscription.updated'
    || event.type === 'customer.subscription.deleted'
  ) {
    plan = mapStripePlan(typeof object.status === 'string' ? object.status : null)
  }

  if (userId && plan) {
    const patch: { plan: 'free' | 'pro'; stripe_customer_id?: string } = { plan }
    if (customerId) patch.stripe_customer_id = customerId

    const { error: updateError } = await db
      .from('user_profiles')
      .update(patch)
      .eq('id', userId)

    if (updateError) return Response.json({ error: updateError.message }, { status: 500 })
  }

  const { error: insertError } = await db
    .from('processed_stripe_events')
    .insert({
      event_id: event.id,
      event_type: event.type,
      user_id: userId,
    })

  if (insertError) return Response.json({ error: insertError.message }, { status: 500 })
  return Response.json({ ok: true })
}
