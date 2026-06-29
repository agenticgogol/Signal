import { createServiceClient } from '@/lib/supabase'
import { NextRequest } from 'next/server'

export async function POST(req: NextRequest) {
  const { outline, topic, format, focusAreas, userId } = await req.json()
  if (!outline || !topic || !userId) {
    return Response.json({ error: 'outline, topic, and userId required' }, { status: 400 })
  }

  const db = createServiceClient()
  const { data, error } = await db
    .from('content_outlines')
    .insert({
      user_id: userId,
      topic,
      format: format ?? outline.format_recommendation ?? 'blog',
      focus_areas: focusAreas ?? [],
      outline,
      status: 'frozen',
    })
    .select('id')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ id: data.id })
}
