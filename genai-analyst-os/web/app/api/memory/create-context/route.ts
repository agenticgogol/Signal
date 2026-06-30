import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireSignedInUser } from '@/lib/serverAuth'

export async function GET(req: NextRequest) {
  const userId = new URL(req.url).searchParams.get('userId') || ''
  if (!userId) return Response.json({ error: 'userId is required' }, { status: 400 })

  const signedIn = await requireSignedInUser(req, userId)
  if (signedIn instanceof Response) return signedIn

  const db = createServiceClient()
  const since = new Date()
  since.setUTCDate(since.getUTCDate() - 60)

  const { data, error } = await db
    .from('user_create_events')
    .select('event_type, topic, format, source_mode, notebook_id, created_at')
    .eq('user_id', userId)
    .eq('event_type', 'generate_draft')
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: false })
    .limit(10)

  if (error) return Response.json({ error: error.message }, { status: 500 })

  const rows = (data ?? []) as Array<{
    topic: string | null
    format: string | null
    source_mode: string | null
    notebook_id: string | null
    created_at: string
  }>

  // Most-used format in last 60 days
  const formatCounts: Record<string, number> = {}
  for (const row of rows) {
    if (row.format) formatCounts[row.format] = (formatCounts[row.format] ?? 0) + 1
  }
  const preferredFormat = Object.entries(formatCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

  return Response.json({
    recentDrafts: rows.slice(0, 3).map(row => ({
      topic: row.topic,
      format: row.format,
      sourceMode: row.source_mode,
      notebookId: row.notebook_id,
      createdAt: row.created_at,
    })),
    preferredFormat,
  })
}
