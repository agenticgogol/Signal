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
    .from('knowledge_notebooks')
    .select('id, user_id, title, description, created_at, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ notebooks: data ?? [] })
}
