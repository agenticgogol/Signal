import { createServiceClient } from '@/lib/supabase'
import { NextRequest } from 'next/server'

// Returns frozen outlines for a user, most recent first
export async function GET(req: NextRequest) {
  const userId = new URL(req.url).searchParams.get('userId') || process.env.NEXT_PUBLIC_USER_ID!
  try {
    const db = createServiceClient()
    const { data, error } = await db
      .from('content_outlines')
      .select('id, topic, format, focus_areas, outline, status, created_at')
      .eq('user_id', userId)
      .eq('status', 'frozen')
      .order('created_at', { ascending: false })
      .limit(20)
    if (error) return Response.json({ outlines: [], error: error.message })
    return Response.json({ outlines: data ?? [] })
  } catch (err) {
    return Response.json({ outlines: [], error: String(err) })
  }
}
