import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { resolveSignedInOrAdmin } from '@/lib/serverAuth'

function daysAgoScore(iso: string | null | undefined) {
  if (!iso) return 0.35
  const diffMs = Date.now() - new Date(iso).getTime()
  const days = Math.max(0, diffMs / (1000 * 60 * 60 * 24))
  if (days <= 2) return 1
  if (days <= 7) return 0.85
  if (days <= 14) return 0.7
  if (days <= 30) return 0.55
  return 0.4
}

function richnessScore(item: { summary?: string | null; why_it_matters?: string | null; cleaned_text?: string | null }) {
  const summary = String(item.summary || '')
  const why = String(item.why_it_matters || '')
  const text = String(item.cleaned_text || '')
  const signal = summary.length + why.length + Math.min(text.length, 4000) / 10
  if (signal > 700) return 1
  if (signal > 450) return 0.8
  if (signal > 220) return 0.6
  return 0.4
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId') || ''
  const notebookId = searchParams.get('notebookId') || ''
  if (!userId) return Response.json({ error: 'userId is required' }, { status: 400 })

  const access = await resolveSignedInOrAdmin(req, userId)
  if (access instanceof Response) return access

  try {
    const db = createServiceClient()
    const [{ data: profile, error: profileError }, { data: items, error: itemsError }, { data: notebooks, error: notebooksError }] = await Promise.all([
      db.from('user_profiles').select('topic_weights').eq('id', access.userId).maybeSingle(),
      db.from('knowledge_items')
        .select('id, notebook_id, title, source_type, source_url, summary, why_it_matters, topic_tags, cleaned_text, processed_at, created_at')
        .eq('user_id', access.userId)
        .eq('status', 'ready')
        .is('archived_at', null)
        .order('processed_at', { ascending: false })
        .limit(200),
      db.from('knowledge_notebooks')
        .select('id, title')
        .eq('user_id', access.userId)
        .order('updated_at', { ascending: false }),
    ])

    if (profileError) return Response.json({ error: profileError.message }, { status: 500 })
    if (itemsError) return Response.json({ error: itemsError.message }, { status: 500 })
    if (notebooksError) return Response.json({ error: notebooksError.message }, { status: 500 })

    const notebookMap = new Map((notebooks ?? []).map((notebook: Record<string, unknown>) => [String(notebook.id), String(notebook.title || 'Notebook')]))
    const topicWeights = (profile?.topic_weights ?? {}) as Record<string, number>

    const filtered = (items ?? []).filter((item: Record<string, unknown>) =>
      !notebookId || String(item.notebook_id) === notebookId
    )

    const ranked = filtered
      .map((item: Record<string, unknown>) => {
        const tags = Array.isArray(item.topic_tags) ? item.topic_tags.map(String) : []
        const tagScores = tags.map(tag => Number(topicWeights[tag] ?? 0.45))
        const topicScore = tagScores.length > 0
          ? tagScores.reduce((sum, value) => sum + value, 0) / tagScores.length
          : 0.4
        const recencyScore = daysAgoScore(typeof item.processed_at === 'string' ? item.processed_at : typeof item.created_at === 'string' ? item.created_at : null)
        const detailScore = richnessScore({
          summary: typeof item.summary === 'string' ? item.summary : '',
          why_it_matters: typeof item.why_it_matters === 'string' ? item.why_it_matters : '',
          cleaned_text: typeof item.cleaned_text === 'string' ? item.cleaned_text : '',
        })
        const blend = 0.55 * topicScore + 0.3 * recencyScore + 0.15 * detailScore
        return {
          id: String(item.id),
          notebook_id: String(item.notebook_id),
          notebook_title: notebookMap.get(String(item.notebook_id)) ?? 'Notebook',
          title: String(item.title || ''),
          source_type: item.source_type === 'note' ? 'note' : item.source_type === 'youtube' ? 'youtube' : 'url',
          source_url: typeof item.source_url === 'string' ? item.source_url : null,
          summary: typeof item.summary === 'string' ? item.summary : null,
          why_it_matters: typeof item.why_it_matters === 'string' ? item.why_it_matters : null,
          topic_tags: tags,
          processed_at: typeof item.processed_at === 'string' ? item.processed_at : null,
          created_at: typeof item.created_at === 'string' ? item.created_at : null,
          blend_score: Number(blend.toFixed(4)),
          topic_score: Number(topicScore.toFixed(4)),
          recency_score: Number(recencyScore.toFixed(4)),
          detail_score: Number(detailScore.toFixed(4)),
          is_fresh: recencyScore >= 0.85,
        }
      })
      .sort((a, b) => b.blend_score - a.blend_score)

    return Response.json({
      items: ranked,
      notebooks: (notebooks ?? []).map((notebook: Record<string, unknown>) => ({
        id: String(notebook.id),
        title: String(notebook.title || 'Notebook'),
      })),
    })
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}
