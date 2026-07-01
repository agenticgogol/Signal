import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireSignedInUser } from '@/lib/serverAuth'
import { getErrorMessage } from '@/lib/errors'
import { DEFAULT_SIGNAL_WEIGHTS, getSignalWeights } from '@/lib/contentSignals'

const SIGNAL_KEYS = Object.keys(DEFAULT_SIGNAL_WEIGHTS)

export async function GET(req: NextRequest) {
  const userId = new URL(req.url).searchParams.get('userId') || ''
  if (!userId) return Response.json({ error: 'userId is required' }, { status: 400 })

  const signedIn = await requireSignedInUser(req, userId)
  if (signedIn instanceof Response) return signedIn

  try {
    const weights = await getSignalWeights(userId)
    return Response.json({ weights })
  } catch (error) {
    return Response.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const userId = typeof body.userId === 'string' ? body.userId : ''
  if (!userId) return Response.json({ error: 'userId is required' }, { status: 400 })

  const signedIn = await requireSignedInUser(req, userId)
  if (signedIn instanceof Response) return signedIn

  const rawWeights = body.weights
  if (!rawWeights || typeof rawWeights !== 'object') {
    return Response.json({ error: 'weights object is required' }, { status: 400 })
  }

  // Store whatever the user set — normalization/redistribution happens at
  // use-time (pickWeightedCandidate), so this never has to force an exact
  // sum-to-1 here and reject otherwise-reasonable slider positions.
  const weights: Record<string, number> = {}
  for (const key of SIGNAL_KEYS) {
    const value = Number(rawWeights[key])
    weights[key] = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : DEFAULT_SIGNAL_WEIGHTS[key as keyof typeof DEFAULT_SIGNAL_WEIGHTS]
  }

  try {
    const { error } = await createServiceClient()
      .from('user_profiles')
      .update({ content_signal_weights: weights })
      .eq('id', userId)
    if (error) throw error
    return Response.json({ ok: true, weights })
  } catch (error) {
    return Response.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}
