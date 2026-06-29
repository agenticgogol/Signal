import { createServiceClient } from '@/lib/supabase'
import { NextRequest } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId') || process.env.NEXT_PUBLIC_USER_ID!
  const db = createServiceClient()
  const { data } = await db.from('user_profiles').select('topic_weights').eq('id', userId).maybeSingle()
  return Response.json({ weights: data?.topic_weights ?? {} })
}

export async function POST(req: NextRequest) {
  const { userId, topic, boost } = await req.json()
  const uid = userId || process.env.NEXT_PUBLIC_USER_ID!
  const db = createServiceClient()

  const { data } = await db.from('user_profiles').select('topic_weights').eq('id', uid).maybeSingle()
  const existing = (data?.topic_weights ?? {}) as Record<string, number>

  const updated = { ...existing, [topic]: Math.min(1.0, Math.max(0.1, (existing[topic] ?? 0.5) + boost)) }

  await db.from('user_profiles').upsert({ id: uid, topic_weights: updated })
  return Response.json({ ok: true, weights: updated })
}
