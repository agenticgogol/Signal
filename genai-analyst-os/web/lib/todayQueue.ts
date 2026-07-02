import { createServiceClient } from '@/lib/supabase'

// The "Today" queue — one blended, ranked, time-boxed reading list across
// Feed, Reading List, and News. Pure heuristics, zero LLM cost: this is
// ranking arithmetic reusing signals that already exist (blend_score for
// Feed, topic/recency/detail for Reading List, source-coverage for News),
// not a generative call.

const WORDS_PER_MINUTE = 200
const MIN_MINUTES = 1
const CANDIDATE_WINDOW_DAYS = 3
const NEWS_WINDOW_DAYS = 3
const REPEAT_COOLDOWN_DAYS = 14

function estimateMinutes(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length
  return Math.max(MIN_MINUTES, Math.round((words / WORDS_PER_MINUTE) * 10) / 10)
}

function recencyDecay(processedAt: string | null | undefined, halfLifeDays = 14): number {
  if (!processedAt) return 0.3
  const days = (Date.now() - new Date(processedAt).getTime()) / (1000 * 60 * 60 * 24)
  return Math.pow(0.5, days / halfLifeDays)
}

export interface QueueEntry {
  id: string
  itemType: 'feed' | 'reading_list' | 'news'
  title: string
  url: string | null
  sourceLabel: string
  estMinutes: number
  score: number
  status: 'unread' | 'read' | 'skipped'
  rank: number
  summary: string | null
  whyItMatters: string | null
  takeaways: string[]
}

async function generateCandidates(userId: string): Promise<Array<{
  itemType: 'feed' | 'reading_list' | 'news'
  refId: string
  title: string
  url: string | null
  sourceLabel: string
  estMinutes: number
  rawScore: number
}>> {
  const db = createServiceClient()

  const { data: profile } = await db.from('user_profiles').select('topic_weights').eq('id', userId).maybeSingle()
  const topicWeights: Record<string, number> = profile?.topic_weights ?? {}

  const since = new Date()
  since.setUTCDate(since.getUTCDate() - CANDIDATE_WINDOW_DAYS)

  const newsSince = new Date()
  newsSince.setUTCDate(newsSince.getUTCDate() - NEWS_WINDOW_DAYS)

  const cooldownSince = new Date()
  cooldownSince.setUTCDate(cooldownSince.getUTCDate() - REPEAT_COOLDOWN_DAYS)

  const [{ data: alreadyRead }, { data: feedRows }, { data: knowledgeRows }, { data: newsRows }] = await Promise.all([
    db.from('daily_reading_queue')
      .select('article_id, knowledge_item_id, news_article_id')
      .eq('user_id', userId)
      .eq('status', 'read')
      .gte('queue_date', cooldownSince.toISOString().slice(0, 10)),
    db.from('user_feed_items')
      .select('blend_score, article_id, articles(id, title, url, full_text, tldr_bullets)')
      .eq('user_id', userId)
      .gte('feed_date', since.toISOString().slice(0, 10))
      .order('blend_score', { ascending: false })
      .limit(40),
    db.from('knowledge_items')
      .select('id, title, source_url, cleaned_text, why_it_matters, topic_tags, processed_at')
      .eq('user_id', userId)
      .eq('status', 'ready')
      .is('archived_at', null)
      .order('processed_at', { ascending: false })
      .limit(60),
    db.from('news_articles')
      .select('id, title, url, description, sources_count, published_at')
      .gte('published_at', newsSince.toISOString())
      .order('sources_count', { ascending: false })
      .limit(30),
  ])

  const readArticleIds = new Set((alreadyRead ?? []).map(r => r.article_id).filter(Boolean))
  const readItemIds = new Set((alreadyRead ?? []).map(r => r.knowledge_item_id).filter(Boolean))
  const readNewsIds = new Set((alreadyRead ?? []).map(r => r.news_article_id).filter(Boolean))

  const feedCandidates = (feedRows ?? [])
    .map((row: Record<string, unknown>) => {
      const article = Array.isArray(row.articles) ? row.articles[0] : row.articles as Record<string, unknown> | null
      if (!article || readArticleIds.has(String(row.article_id))) return null
      const text = [article.full_text, ...(Array.isArray(article.tldr_bullets) ? article.tldr_bullets : [])].filter(Boolean).join(' ')
      return {
        itemType: 'feed' as const,
        refId: String(row.article_id),
        title: String(article.title || 'Untitled'),
        url: article.url ? String(article.url) : null,
        sourceLabel: 'Feed',
        estMinutes: estimateMinutes(text || String(article.title || '')),
        rawScore: Number(row.blend_score ?? 0),
      }
    })
    .filter((c): c is NonNullable<typeof c> => c !== null)

  const knowledgeCandidates = (knowledgeRows ?? [])
    .map((item: Record<string, unknown>) => {
      if (readItemIds.has(String(item.id))) return null
      const tags: string[] = Array.isArray(item.topic_tags) ? item.topic_tags.map(String) : []
      const topicScore = tags.length > 0 ? tags.reduce((sum, t) => sum + (topicWeights[t] ?? 0.3), 0) / tags.length : 0.3
      const score = 0.6 * topicScore + 0.4 * recencyDecay(item.processed_at as string | null)
      const text = String(item.cleaned_text || item.why_it_matters || '')
      return {
        itemType: 'reading_list' as const,
        refId: String(item.id),
        title: String(item.title || 'Untitled'),
        url: item.source_url ? String(item.source_url) : null,
        sourceLabel: 'Reading List',
        estMinutes: estimateMinutes(text || String(item.title || '')),
        rawScore: score,
      }
    })
    .filter((c): c is NonNullable<typeof c> => c !== null)

  // News has no per-user affinity data of its own — sources_count (how many
  // independent outlets covered it) stands in for blend_score/topic-fit,
  // same "multi-source coverage = signal" idea the News tab UI already uses.
  const newsCandidates = (newsRows ?? [])
    .map((item: Record<string, unknown>) => {
      if (readNewsIds.has(String(item.id))) return null
      const text = String(item.description || '')
      return {
        itemType: 'news' as const,
        refId: String(item.id),
        title: String(item.title || 'Untitled'),
        url: item.url ? String(item.url) : null,
        sourceLabel: 'News',
        estMinutes: estimateMinutes(text || String(item.title || '')),
        rawScore: Number(item.sources_count ?? 1),
      }
    })
    .filter((c): c is NonNullable<typeof c> => c !== null)

  return [...feedCandidates, ...knowledgeCandidates, ...newsCandidates]
}

// Normalizes each pool to 0-1 by its own max before merging — Feed's
// blend_score and the Reading List's topic/recency blend aren't on
// comparable scales, so a raw global sort would systematically favor
// whichever pool happens to produce larger numbers.
function normalizeAndMerge(candidates: Awaited<ReturnType<typeof generateCandidates>>) {
  const maxByType: Record<string, number> = {}
  for (const c of candidates) maxByType[c.itemType] = Math.max(maxByType[c.itemType] ?? 0, c.rawScore)
  // Array.sort is stable, and candidates are built as
  // [...feed, ...reading_list, ...news] — with no tiebreaker, every tie
  // (extremely common for News, where most stories share the same
  // sources_count and normalize to an identical value) resolves in favor
  // of whichever pool was concatenated first, i.e. News always loses to
  // Feed/Reading List regardless of how many fresh News candidates exist.
  // A random tiebreaker, computed once per candidate here (not per compare),
  // makes ties resolve fairly across pools instead of by array position.
  return candidates
    .map(c => ({ ...c, score: maxByType[c.itemType] > 0 ? c.rawScore / maxByType[c.itemType] : 0, tiebreak: Math.random() }))
    .sort((a, b) => b.score - a.score || b.tiebreak - a.tiebreak)
}

async function buildAndPersistQueue(userId: string, targetMinutes: number): Promise<void> {
  const db = createServiceClient()
  const candidates = normalizeAndMerge(await generateCandidates(userId))

  const selected: typeof candidates = []
  let minutesSoFar = 0
  for (const candidate of candidates) {
    if (minutesSoFar >= targetMinutes) break
    selected.push(candidate)
    minutesSoFar += candidate.estMinutes
  }

  if (selected.length === 0) return

  const rows = selected.map((c, index) => ({
    user_id: userId,
    item_type: c.itemType,
    article_id: c.itemType === 'feed' ? c.refId : null,
    knowledge_item_id: c.itemType === 'reading_list' ? c.refId : null,
    news_article_id: c.itemType === 'news' ? c.refId : null,
    rank: index,
    est_minutes: c.estMinutes,
    score: c.score,
  }))

  // Plain insert, not upsert — the migration's unique indexes are partial
  // (WHERE article_id/knowledge_item_id IS NOT NULL), and Postgres requires
  // ON CONFLICT to repeat that WHERE clause to match a partial index, which
  // the Supabase JS client's upsert() has no way to express. A rare
  // concurrent double-generation just hits a unique-violation here, which
  // is fine to ignore since it means the row already exists.
  const { error: insertError } = await db.from('daily_reading_queue').insert(rows)
  if (insertError && insertError.code !== '23505') throw insertError
}

async function fetchTodayQueue(userId: string): Promise<QueueEntry[]> {
  const db = createServiceClient()
  const { data: rows, error } = await db
    .from('daily_reading_queue')
    .select('id, item_type, article_id, knowledge_item_id, news_article_id, rank, est_minutes, score, status')
    .eq('user_id', userId)
    .eq('queue_date', new Date().toISOString().slice(0, 10))
    .order('rank', { ascending: true })
  if (error) throw error
  if (!rows || rows.length === 0) return []

  const articleIds = rows.filter(r => r.article_id).map(r => r.article_id)
  const knowledgeIds = rows.filter(r => r.knowledge_item_id).map(r => r.knowledge_item_id)
  const newsIds = rows.filter(r => r.news_article_id).map(r => r.news_article_id)

  const [{ data: articles }, { data: items }, { data: newsItems }] = await Promise.all([
    articleIds.length ? db.from('articles').select('id, title, url, why_it_matters, tldr_bullets, key_takeaways').in('id', articleIds) : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    knowledgeIds.length ? db.from('knowledge_items').select('id, title, source_url, summary, why_it_matters').in('id', knowledgeIds) : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    newsIds.length ? db.from('news_articles').select('id, title, url, description, sources, sources_count').in('id', newsIds) : Promise.resolve({ data: [] as Record<string, unknown>[] }),
  ])

  const articleMap = new Map((articles ?? []).map((a: Record<string, unknown>) => [String(a.id), a]))
  const itemMap = new Map((items ?? []).map((i: Record<string, unknown>) => [String(i.id), i]))
  const newsMap = new Map((newsItems ?? []).map((n: Record<string, unknown>) => [String(n.id), n]))

  return rows.map(row => {
    const isFeed = row.item_type === 'feed'
    const isNews = row.item_type === 'news'
    const ref = isFeed ? articleMap.get(String(row.article_id)) : isNews ? newsMap.get(String(row.news_article_id)) : itemMap.get(String(row.knowledge_item_id))
    const takeaways = isFeed
      ? [
          ...(Array.isArray(ref?.key_takeaways) ? ref.key_takeaways.map(String) : []),
          ...(Array.isArray(ref?.tldr_bullets) ? ref.tldr_bullets.map(String) : []),
        ]
      : []
    const sourceLabel = isFeed ? 'Feed' : isNews ? 'News' : 'Reading List'
    const whyItMatters = isNews
      ? (ref?.sources_count ? `Covered by ${ref.sources_count} independent source${Number(ref.sources_count) === 1 ? '' : 's'}.` : null)
      : (ref?.why_it_matters ? String(ref.why_it_matters) : null)
    return {
      id: String(row.id),
      itemType: row.item_type as 'feed' | 'reading_list' | 'news',
      title: String(ref?.title || 'Untitled'),
      url: (ref?.url || ref?.source_url) ? String(ref.url || ref.source_url) : null,
      sourceLabel,
      estMinutes: Number(row.est_minutes),
      score: Number(row.score),
      status: row.status as 'unread' | 'read' | 'skipped',
      rank: Number(row.rank),
      summary: !isFeed && !isNews ? (ref?.summary ? String(ref.summary) : null) : (isNews ? (ref?.description ? String(ref.description) : null) : null),
      whyItMatters,
      takeaways: Array.from(new Set(takeaways)).slice(0, 6),
    }
  })
}

export async function getOrGenerateTodayQueue(userId: string): Promise<{ entries: QueueEntry[]; targetMinutes: number }> {
  const db = createServiceClient()
  const { data: profile } = await db.from('user_profiles').select('daily_reading_minutes').eq('id', userId).maybeSingle()
  const targetMinutes = profile?.daily_reading_minutes ?? 15

  let entries = await fetchTodayQueue(userId)
  if (entries.length === 0) {
    await buildAndPersistQueue(userId, targetMinutes)
    entries = await fetchTodayQueue(userId)
  }
  return { entries, targetMinutes }
}

export async function regenerateTodayQueue(userId: string): Promise<{ entries: QueueEntry[]; targetMinutes: number }> {
  const db = createServiceClient()
  const { data: profile } = await db.from('user_profiles').select('daily_reading_minutes').eq('id', userId).maybeSingle()
  const targetMinutes = profile?.daily_reading_minutes ?? 15

  // Only clear still-unread rows — read/skipped history for today stays,
  // so a manual refresh can't erase progress already made.
  await db.from('daily_reading_queue')
    .delete()
    .eq('user_id', userId)
    .eq('queue_date', new Date().toISOString().slice(0, 10))
    .eq('status', 'unread')

  await buildAndPersistQueue(userId, targetMinutes)
  const entries = await fetchTodayQueue(userId)
  return { entries, targetMinutes }
}

export async function markQueueItemStatus(userId: string, queueItemId: string, status: 'read' | 'skipped' | 'unread'): Promise<void> {
  const db = createServiceClient()
  const { error } = await db
    .from('daily_reading_queue')
    // Undoing back to 'unread' clears completed_at too — it's genuinely
    // not done anymore, not just relabeled, so it shouldn't keep a stale
    // completion timestamp around (streaks/candidate-cooldown logic both
    // read completed_at as "when this was actually finished").
    .update({ status, completed_at: status === 'unread' ? null : new Date().toISOString() })
    .eq('user_id', userId)
    .eq('id', queueItemId)
  if (error) throw error
}
