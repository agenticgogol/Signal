import { NextRequest } from 'next/server'
import { getUserAccessProfile } from '@/lib/featureAccess'
import { defaultModelFor, normalizeProvider, PROVIDER_OPTIONS } from '@/lib/llmConfig'
import { createServiceClient } from '@/lib/supabase'
import { requireSignedInUser } from '@/lib/serverAuth'
import { encryptSecret, maskStoredSecret } from '@/lib/secrets'

export async function GET(req: NextRequest) {
  const userId = new URL(req.url).searchParams.get('userId') || ''
  if (!userId) return Response.json({ error: 'userId is required' }, { status: 400 })

  const signedIn = await requireSignedInUser(req, userId)
  if (signedIn instanceof Response) return signedIn

  const { data, error } = await createServiceClient()
    .from('user_profiles')
    .select('llm_provider, llm_model, llm_api_key')
    .eq('id', userId)
    .maybeSingle()

  if (error) return Response.json({ error: error.message }, { status: 500 })

  const provider = normalizeProvider(data?.llm_provider)
  const model = String(data?.llm_model || '').trim() || defaultModelFor(provider)
  const hasApiKey = Boolean(String(data?.llm_api_key || '').trim())

  return Response.json({
    provider,
    model,
    hasApiKey,
    maskedApiKey: hasApiKey ? maskStoredSecret(String(data?.llm_api_key)) : '',
    providerOptions: PROVIDER_OPTIONS,
  })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const userId = typeof body.userId === 'string' ? body.userId : ''
  if (!userId) return Response.json({ error: 'userId is required' }, { status: 400 })

  const signedIn = await requireSignedInUser(req, userId)
  if (signedIn instanceof Response) return signedIn

  const access = await getUserAccessProfile(userId)
  if (access?.plan !== 'pro') {
    return Response.json({
      error: 'Model settings can only be changed by subscribed users.',
      upgrade_required: true,
    }, { status: 402 })
  }

  const provider = normalizeProvider(body.provider)
  const model = String(body.model || '').trim() || defaultModelFor(provider)
  const apiKey = String(body.apiKey || '').trim()

  const updates: Record<string, unknown> = {
    llm_provider: provider,
    llm_model: model,
    updated_at: new Date().toISOString(),
  }
  if (apiKey) {
    try {
      updates.llm_api_key = encryptSecret(apiKey)
    } catch (error) {
      return Response.json({
        error: error instanceof Error ? error.message : 'API key encryption failed',
      }, { status: 500 })
    }
  }
  if (body.clearApiKey === true) updates.llm_api_key = null

  const { error } = await createServiceClient()
    .from('user_profiles')
    .update(updates)
    .eq('id', userId)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
