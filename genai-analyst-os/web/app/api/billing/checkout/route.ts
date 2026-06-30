import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireSignedInUser } from '@/lib/serverAuth'
import { createCheckoutSession } from '@/lib/stripe'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const userId = typeof body.userId === 'string' ? body.userId : ''
    if (!userId) return Response.json({ error: 'userId is required' }, { status: 400 })

    const signedIn = await requireSignedInUser(req, userId)
    if (signedIn instanceof Response) return signedIn

    const db = createServiceClient()
    const { data, error } = await db
      .from('user_profiles')
      .select('plan, stripe_customer_id')
      .eq('id', userId)
      .maybeSingle()

    if (error) return Response.json({ error: error.message }, { status: 500 })
    if (data?.plan === 'pro') {
      return Response.json({ error: 'Account is already subscribed.' }, { status: 409 })
    }

    const session = await createCheckoutSession({
      userId,
      email: signedIn.email,
      stripeCustomerId: data?.stripe_customer_id ?? null,
    })

    return Response.json({ ok: true, url: session.url, sessionId: session.id })
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Checkout failed' }, { status: 500 })
  }
}
