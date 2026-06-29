import { createServiceClient } from '@/lib/supabase'
import { NextRequest } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId') || process.env.NEXT_PUBLIC_USER_ID!
  const date = searchParams.get('date') || new Date().toISOString().split('T')[0]
  const db = createServiceClient()
  const { data } = await db.from('daily_ideas').select('*').eq('user_id', userId).eq('idea_date', date).order('position')
  return Response.json({ ideas: data ?? [] })
}
