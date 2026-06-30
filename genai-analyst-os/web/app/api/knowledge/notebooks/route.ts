import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { resolveSignedInOrAdmin } from '@/lib/serverAuth'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const userId = typeof body.userId === 'string' ? body.userId : ''
  const title = typeof body.title === 'string' ? body.title.trim() : ''
  const description = typeof body.description === 'string' ? body.description.trim() : ''

  if (!userId || !title) {
    return Response.json({ error: 'userId and title are required' }, { status: 400 })
  }

  const access = await resolveSignedInOrAdmin(req, userId)
  if (access instanceof Response) return access

  const db = createServiceClient()
  const { data, error } = await db
    .from('knowledge_notebooks')
    .insert({
      user_id: access.userId,
      title,
      description: description || null,
      updated_at: new Date().toISOString(),
    })
    .select('id, user_id, title, description, created_at, updated_at')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ notebook: data })
}
