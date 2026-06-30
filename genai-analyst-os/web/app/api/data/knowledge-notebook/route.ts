import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { resolveSignedInOrAdmin } from '@/lib/serverAuth'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId') || ''
  const notebookId = searchParams.get('notebookId') || ''
  if (!userId || !notebookId) {
    return Response.json({ error: 'userId and notebookId are required' }, { status: 400 })
  }

  const access = await resolveSignedInOrAdmin(req, userId)
  if (access instanceof Response) return access

  const db = createServiceClient()
  const [{ data: notebook, error: notebookError }, { data: items, error: itemsError }] = await Promise.all([
    db.from('knowledge_notebooks')
      .select('id, user_id, title, description, created_at, updated_at')
      .eq('id', notebookId)
      .eq('user_id', access.userId)
      .maybeSingle(),
    db.from('knowledge_items')
      .select('id, user_id, notebook_id, source_type, source_url, title, summary, why_it_matters, topic_tags, status, processing_error, created_at, processed_at, updated_at')
      .eq('notebook_id', notebookId)
      .eq('user_id', access.userId)
      .order('created_at', { ascending: false }),
  ])

  if (notebookError) return Response.json({ error: notebookError.message }, { status: 500 })
  if (itemsError) return Response.json({ error: itemsError.message }, { status: 500 })
  if (!notebook) return Response.json({ error: 'Notebook not found' }, { status: 404 })

  return Response.json({ notebook, items: items ?? [], userId: access.userId, mode: access.mode })
}
