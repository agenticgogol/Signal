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
  since.setUTCDate(since.getUTCDate() - 30)

  const [chatsRes, articleEventsRes] = await Promise.all([
    db.from('user_chat_events')
      .select('id, question, answer_summary, citations, scope, created_at')
      .eq('user_id', userId)
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false })
      .limit(20),
    db.from('user_article_events')
      .select('article_id, event_type, created_at, articles(id, title, url, published_at)')
      .eq('user_id', userId)
      .in('event_type', ['open', 'pin', 'like'])
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false })
      .limit(30),
  ])

  // Deduplicate article events — keep most significant event per article
  const seen = new Set<string>()
  const articleHistory: Array<{
    articleId: string
    title: string
    url: string
    eventType: string
    publishedAt: string | null
    seenAt: string
  }> = []

  for (const row of (articleEventsRes.data ?? []) as Array<Record<string, unknown>>) {
    const articleId = String(row.article_id || '')
    if (seen.has(articleId)) continue
    seen.add(articleId)
    const article = Array.isArray(row.articles) ? row.articles[0] : row.articles as Record<string, unknown> | null
    if (!article) continue
    articleHistory.push({
      articleId,
      title: String(article.title || ''),
      url: String(article.url || ''),
      eventType: String(row.event_type || 'open'),
      publishedAt: article.published_at ? String(article.published_at) : null,
      seenAt: String(row.created_at || ''),
    })
  }

  return Response.json({
    chatHistory: (chatsRes.data ?? []).map((row: Record<string, unknown>) => ({
      id: String(row.id || ''),
      question: String(row.question || ''),
      answerSummary: String(row.answer_summary || ''),
      citations: Array.isArray(row.citations) ? row.citations : [],
      scope: String(row.scope || 'memory'),
      createdAt: String(row.created_at || ''),
    })),
    articleHistory: articleHistory.slice(0, 20),
  })
}
