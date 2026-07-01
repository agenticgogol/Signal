import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { resolveSignedInOrAdmin } from '@/lib/serverAuth'

export async function GET(req: NextRequest) {
  const userId = new URL(req.url).searchParams.get('userId') || ''
  if (!userId) return Response.json({ error: 'userId is required' }, { status: 400 })

  const access = await resolveSignedInOrAdmin(req, userId)
  if (access instanceof Response) return access

  const db = createServiceClient()
  const { data, error } = await db
    .from('knowledge_links')
    .select('id, url, link_type, label, topic_tags, created_at, notebook_id, item_id, knowledge_notebooks(title), knowledge_items(title)')
    .eq('user_id', access.userId)
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) return Response.json({ error: error.message }, { status: 500 })

  const links = (data ?? []).map((row: Record<string, unknown>) => {
    const notebook = Array.isArray(row.knowledge_notebooks) ? row.knowledge_notebooks[0] : row.knowledge_notebooks as Record<string, unknown> | null
    const item = Array.isArray(row.knowledge_items) ? row.knowledge_items[0] : row.knowledge_items as Record<string, unknown> | null
    return {
      id: String(row.id),
      url: String(row.url),
      linkType: String(row.link_type),
      label: String(row.label || ''),
      topicTags: Array.isArray(row.topic_tags) ? row.topic_tags : [],
      createdAt: String(row.created_at || ''),
      notebookId: String(row.notebook_id || ''),
      notebookTitle: notebook?.title ? String(notebook.title) : '',
      itemId: String(row.item_id || ''),
      itemTitle: item?.title ? String(item.title) : '',
    }
  })

  return Response.json({ links, userId: access.userId, mode: access.mode })
}
