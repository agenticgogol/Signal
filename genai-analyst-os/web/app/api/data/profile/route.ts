import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const userId = new URL(req.url).searchParams.get('userId') || process.env.NEXT_PUBLIC_USER_ID
  if (!userId) return Response.json({ error: 'userId is required' }, { status: 400 })

  try {
    const { data, error } = await createServiceClient()
      .from('user_profiles')
      .select('plan, updated_at, llm_api_key')
      .eq('id', userId)
      .maybeSingle()

    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({
      plan: data?.plan ?? 'free',
      isPro: data?.plan === 'pro',
      hasApiKeyConfigured: Boolean(String(data?.llm_api_key || '').trim()),
      hasModelAccess: data?.plan === 'pro' || Boolean(String(data?.llm_api_key || '').trim()),
      updatedAt: data?.updated_at ?? null,
    })
  } catch (error) {
    return Response.json({ error: String(error) }, { status: 500 })
  }
}
