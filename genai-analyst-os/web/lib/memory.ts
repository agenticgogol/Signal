import { createServiceClient } from '@/lib/supabase'

export async function logArticleEvent(params: {
  userId: string
  articleId: string
  eventType: 'impression' | 'open' | 'pin' | 'save' | 'like' | 'dislike' | 'dismiss'
  sessionId?: string | null
  metadata?: Record<string, unknown>
}) {
  if (!params.userId || !params.articleId) return
  await createServiceClient().from('user_article_events').insert({
    user_id: params.userId,
    article_id: params.articleId,
    event_type: params.eventType,
    session_id: params.sessionId ?? null,
    metadata: params.metadata ?? {},
  })
}

export async function logKnowledgeEvent(params: {
  userId: string
  notebookId?: string | null
  knowledgeItemId?: string | null
  eventType: 'open_notebook' | 'open_item' | 'save_url' | 'save_note' | 'upload_file' | 'ask_chat'
  metadata?: Record<string, unknown>
}) {
  if (!params.userId) return
  await createServiceClient().from('user_knowledge_events').insert({
    user_id: params.userId,
    notebook_id: params.notebookId ?? null,
    knowledge_item_id: params.knowledgeItemId ?? null,
    event_type: params.eventType,
    metadata: params.metadata ?? {},
  })
}

export async function logChatEvent(params: {
  userId: string
  scope: 'memory' | 'notebook' | 'feed'
  notebookId?: string | null
  question: string
  answerSummary?: string | null
  citations?: Array<{ title: string; url: string }>
  metadata?: Record<string, unknown>
}) {
  if (!params.userId || !params.question.trim()) return
  await createServiceClient().from('user_chat_events').insert({
    user_id: params.userId,
    scope: params.scope,
    notebook_id: params.notebookId ?? null,
    question: params.question.trim(),
    answer_summary: params.answerSummary ?? null,
    citations: params.citations ?? [],
    metadata: params.metadata ?? {},
  })
}

export async function logCreateEvent(params: {
  userId: string
  eventType: 'generate_draft' | 'save_outline' | 'export_content'
  topic?: string | null
  format?: string | null
  sourceMode?: string | null
  notebookId?: string | null
  metadata?: Record<string, unknown>
}) {
  if (!params.userId) return
  await createServiceClient().from('user_create_events').insert({
    user_id: params.userId,
    event_type: params.eventType,
    topic: params.topic ?? null,
    format: params.format ?? null,
    source_mode: params.sourceMode ?? null,
    notebook_id: params.notebookId ?? null,
    metadata: params.metadata ?? {},
  })
}

export async function getRecentArticleMemoryBoosts(userId: string) {
  const since = new Date()
  since.setUTCDate(since.getUTCDate() - 14)
  const { data, error } = await createServiceClient()
    .from('user_article_events')
    .select('article_id, event_type, created_at')
    .eq('user_id', userId)
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) throw error

  const boosts: Record<string, number> = {}
  const nowMs = Date.now()
  for (const row of (data ?? []) as Array<{ article_id: string; event_type: string; created_at: string }>) {
    const days = Math.max(0, (nowMs - new Date(row.created_at).getTime()) / (1000 * 60 * 60 * 24))
    const decay = Math.max(0.25, 1 - (days / 14))
    const base =
      row.event_type === 'pin' ? 0.12 :
      row.event_type === 'like' ? 0.1 :
      row.event_type === 'open' ? 0.06 :
      row.event_type === 'save' ? 0.08 :
      row.event_type === 'dislike' ? -0.08 :
      row.event_type === 'dismiss' ? -0.05 :
      0.02
    boosts[row.article_id] = (boosts[row.article_id] ?? 0) + (base * decay)
  }

  return boosts
}
