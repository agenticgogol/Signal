import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const userId = new URL(req.url).searchParams.get('userId') || process.env.NEXT_PUBLIC_USER_ID
  if (!userId) return Response.json({ error: 'userId is required' }, { status: 400 })

  try {
    const { data, error } = await createServiceClient()
      .from('user_profiles')
      .select('voice_fingerprint')
      .eq('id', userId)
      .maybeSingle()

    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ fingerprint: data?.voice_fingerprint ?? null })
  } catch (error) {
    return Response.json({ error: String(error) }, { status: 500 })
  }
}
