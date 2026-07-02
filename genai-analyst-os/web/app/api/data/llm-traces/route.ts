import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireSignedInUser } from '@/lib/serverAuth'

export async function GET(req: NextRequest) {
  const userId = new URL(req.url).searchParams.get('userId') || ''
  if (!userId) return Response.json({ error: 'userId is required' }, { status: 400 })

  const signedIn = await requireSignedInUser(req, userId)
  if (signedIn instanceof Response) return signedIn

  const db = createServiceClient()
  const { data, error } = await db
    .from('llm_traces')
    .select('id, agent, provider, model, prompt_chars, completion_chars, input_tokens, output_tokens, estimated_cost_usd, duration_ms, status, error_message, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(25)

  if (error) return Response.json({ error: error.message }, { status: 500 })

  const arizeConfigured = Boolean(process.env.ARIZE_API_KEY && process.env.ARIZE_SPACE_ID)

  return Response.json({ traces: data ?? [], arizeConfigured })
}
