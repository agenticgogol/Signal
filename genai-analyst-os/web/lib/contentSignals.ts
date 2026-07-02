import { createServiceClient } from '@/lib/supabase'
import { scanNoveltyRadar } from '@/lib/radar'
import { fetchAiNewsStories } from '@/lib/aiNews'

// Weighted, multi-signal candidate picker behind "Generate today's content" —
// replaces "just pick the single most-engaged article" with a rule-based
// blend of five signals, each user-adjustable in Settings. Two related but
// separately-handled concepts:
//   - custom topic: a hard override, bypasses this scorer entirely (handled
//     by the caller before this function is ever invoked)
//   - user interest area (topic_weights): a multiplier applied to every
//     candidate's blended score, not a sixth weighted row — it modulates
//     everything rather than competing with the other five for its own slice

export const DEFAULT_SIGNAL_WEIGHTS = {
  engagement: 0.35,
  recently_read: 0.25,
  trending_news: 0.15,
  recent_trend: 0.15,
  emerging_topic: 0.10,
}

export type SignalWeights = typeof DEFAULT_SIGNAL_WEIGHTS

const ENGAGEMENT_EVENT_WEIGHT: Record<string, number> = { like: 3, pin: 3, save: 2, open: 1 }
const RECENT_READ_WINDOW_DAYS = 3
const CANDIDATE_WINDOW_DAYS = 7
const READING_LIST_WINDOW_DAYS = 14

const STOPWORDS = new Set([
  'the','a','an','and','or','but','of','to','in','on','for','with','is','are',
  'was','were','how','why','what','new','after','over','into','its','it','as',
  'from','by','at','this','that','will','can','says','say','said',
])

function tokenize(text: string): Set<string> {
  return new Set((text.toLowerCase().match(/[a-z0-9][a-z0-9'-]{2,}/g) ?? []).filter(w => !STOPWORDS.has(w)))
}

function overlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0
  let shared = 0
  for (const w of a) if (b.has(w)) shared++
  return shared / Math.min(a.size, b.size)
}

const RELEVANCE_THRESHOLD = 0.35

const NEWS_WINDOW_DAYS = 3

export interface ContentCandidate {
  itemType: 'feed' | 'reading_list' | 'news'
  refId: string
  title: string
  url: string | null
  whyItMatters: string
  topicTags: string[]
  rawSignals: {
    engagement: number
    recently_read: number
    trending_news: number
    recent_trend: number
    emerging_topic: number
  }
  matchedSignals: string[]
  score: number
}

export async function getSignalWeights(userId: string): Promise<SignalWeights> {
  const db = createServiceClient()
  const { data } = await db.from('user_profiles').select('content_signal_weights').eq('id', userId).maybeSingle()
  const stored = data?.content_signal_weights as Partial<SignalWeights> | null
  if (!stored) return { ...DEFAULT_SIGNAL_WEIGHTS }
  return {
    engagement: Number(stored.engagement ?? DEFAULT_SIGNAL_WEIGHTS.engagement),
    recently_read: Number(stored.recently_read ?? DEFAULT_SIGNAL_WEIGHTS.recently_read),
    trending_news: Number(stored.trending_news ?? DEFAULT_SIGNAL_WEIGHTS.trending_news),
    recent_trend: Number(stored.recent_trend ?? DEFAULT_SIGNAL_WEIGHTS.recent_trend),
    emerging_topic: Number(stored.emerging_topic ?? DEFAULT_SIGNAL_WEIGHTS.emerging_topic),
  }
}

export async function pickWeightedCandidate(userId: string): Promise<ContentCandidate | null> {
  const candidates = await pickWeightedCandidates(userId, 1)
  return candidates[0] ?? null
}

export async function pickWeightedCandidates(userId: string, count: number): Promise<ContentCandidate[]> {
  const db = createServiceClient()
  const weights = await getSignalWeights(userId)

  const since = new Date(); since.setUTCDate(since.getUTCDate() - CANDIDATE_WINDOW_DAYS)
  const readingSince = new Date(); readingSince.setUTCDate(readingSince.getUTCDate() - READING_LIST_WINDOW_DAYS)
  const readSince = new Date(); readSince.setUTCDate(readSince.getUTCDate() - RECENT_READ_WINDOW_DAYS)
  const newsSince = new Date(); newsSince.setUTCDate(newsSince.getUTCDate() - NEWS_WINDOW_DAYS)

  const [
    { data: profile },
    { data: feedRows },
    { data: knowledgeRows },
    { data: newsRows },
    { data: articleEvents },
    { data: knowledgeEvents },
    { data: readQueueRows },
    radarResult,
    newsStories,
  ] = await Promise.all([
    db.from('user_profiles').select('topic_weights').eq('id', userId).maybeSingle(),
    db.from('user_feed_items')
      .select('article_id, articles(id, title, url, why_it_matters, tldr_bullets, topic_tags)')
      .eq('user_id', userId)
      .gte('feed_date', since.toISOString().slice(0, 10))
      .limit(60),
    db.from('knowledge_items')
      .select('id, title, source_url, summary, why_it_matters, topic_tags, processed_at')
      .eq('user_id', userId)
      .eq('status', 'ready')
      .is('archived_at', null)
      .gte('processed_at', readingSince.toISOString())
      .limit(60),
    db.from('news_articles')
      .select('id, title, url, description, sources_count, published_at')
      .gte('published_at', newsSince.toISOString())
      .order('sources_count', { ascending: false })
      .limit(30),
    db.from('user_article_events')
      .select('event_type, article_id')
      .eq('user_id', userId)
      .in('event_type', ['like', 'pin', 'save', 'open'])
      .gte('created_at', since.toISOString())
      .limit(300),
    db.from('user_knowledge_events')
      .select('event_type, knowledge_item_id')
      .eq('user_id', userId)
      .eq('event_type', 'open_item')
      .gte('created_at', readingSince.toISOString())
      .limit(300),
    db.from('daily_reading_queue')
      .select('article_id, knowledge_item_id, status, completed_at')
      .eq('user_id', userId)
      .eq('status', 'read')
      .gte('queue_date', readSince.toISOString().slice(0, 10)),
    scanNoveltyRadar(userId).catch(() => null),
    fetchAiNewsStories().catch(() => []),
  ])

  const topicWeights: Record<string, number> = profile?.topic_weights ?? {}

  // ── Build the candidate pool ──────────────────────────────────────────
  const candidates = new Map<string, ContentCandidate>()

  for (const row of feedRows ?? []) {
    const article = Array.isArray(row.articles) ? row.articles[0] : row.articles as Record<string, unknown> | null
    if (!article?.id) continue
    const key = `feed:${article.id}`
    candidates.set(key, {
      itemType: 'feed',
      refId: String(article.id),
      title: String(article.title || 'Untitled'),
      url: article.url ? String(article.url) : null,
      whyItMatters: String(article.why_it_matters || ''),
      topicTags: Array.isArray(article.topic_tags) ? article.topic_tags.map(String) : [],
      rawSignals: { engagement: 0, recently_read: 0, trending_news: 0, recent_trend: 0, emerging_topic: 0 },
      matchedSignals: [],
      score: 0,
    })
  }

  for (const item of knowledgeRows ?? []) {
    const key = `reading_list:${item.id}`
    candidates.set(key, {
      itemType: 'reading_list',
      refId: String(item.id),
      title: String(item.title || 'Untitled'),
      url: item.source_url ? String(item.source_url) : null,
      whyItMatters: String(item.why_it_matters || item.summary || ''),
      topicTags: Array.isArray(item.topic_tags) ? item.topic_tags.map(String) : [],
      rawSignals: { engagement: 0, recently_read: 0, trending_news: 0, recent_trend: 0, emerging_topic: 0 },
      matchedSignals: [],
      score: 0,
    })
  }

  // News candidates start with their own multi-source coverage already
  // folded into the trending_news signal directly (no title-matching
  // needed — they *are* the trending-news items), rather than only ever
  // boosting some other feed article's score.
  for (const item of newsRows ?? []) {
    const key = `news:${item.id}`
    candidates.set(key, {
      itemType: 'news',
      refId: String(item.id),
      title: String(item.title || 'Untitled'),
      url: item.url ? String(item.url) : null,
      whyItMatters: String(item.description || ''),
      topicTags: [],
      rawSignals: { engagement: 0, recently_read: 0, trending_news: Number(item.sources_count ?? 1), recent_trend: 0, emerging_topic: 0 },
      matchedSignals: Number(item.sources_count ?? 1) >= 2 ? ['trending_news'] : [],
      score: 0,
    })
  }

  if (candidates.size === 0) return []

  // ── Signal 1: explicit engagement (like/pin/save/open, feed + reading list) ──
  for (const event of articleEvents ?? []) {
    const key = `feed:${event.article_id}`
    const c = candidates.get(key)
    if (c) c.rawSignals.engagement += ENGAGEMENT_EVENT_WEIGHT[event.event_type] ?? 0
  }
  for (const event of knowledgeEvents ?? []) {
    const key = `reading_list:${event.knowledge_item_id}`
    const c = candidates.get(key)
    if (c) c.rawSignals.engagement += 1
  }

  // ── Signal 2: recently read (Today queue completions, recency-decayed) ──
  for (const row of readQueueRows ?? []) {
    const key = row.article_id ? `feed:${row.article_id}` : `reading_list:${row.knowledge_item_id}`
    const c = candidates.get(key)
    if (!c) continue
    const days = row.completed_at ? (Date.now() - new Date(row.completed_at).getTime()) / (1000 * 60 * 60 * 24) : RECENT_READ_WINDOW_DAYS
    c.rawSignals.recently_read += Math.max(0, 1 - days / RECENT_READ_WINDOW_DAYS)
  }

  // ── Signal 3: trending news (multi-source News stories), relevance-gated ──
  const multiSourceStories = newsStories.filter(s => s.sources.length >= 2)
  for (const candidate of candidates.values()) {
    const candidateTokens = tokenize(candidate.title)
    for (const story of multiSourceStories) {
      if (overlap(candidateTokens, tokenize(story.title)) >= RELEVANCE_THRESHOLD) {
        candidate.rawSignals.trending_news = Math.max(candidate.rawSignals.trending_news, story.sources.length)
        if (!candidate.matchedSignals.includes('trending_news')) candidate.matchedSignals.push('trending_news')
      }
    }
  }

  // ── Signals 4 & 5: emerging / recent-trend (Novelty Radar), same-corpus match ──
  if (radarResult) {
    for (const hit of radarResult.hits) {
      const field = hit.tier === 'new' ? 'emerging_topic' as const : 'recent_trend' as const
      for (const article of hit.articles) {
        for (const candidate of candidates.values()) {
          const isUrlMatch = article.url && candidate.url && article.url === candidate.url
          const isTitleMatch = overlap(tokenize(article.title), tokenize(candidate.title)) >= RELEVANCE_THRESHOLD
          if (isUrlMatch || isTitleMatch) {
            candidate.rawSignals[field] = Math.max(candidate.rawSignals[field], hit.recentSourceCount)
            if (!candidate.matchedSignals.includes(field)) candidate.matchedSignals.push(field)
          }
        }
      }
    }
  }

  // ── Normalize each signal column to 0-1 by its own max, then blend with
  // redistributed weights (a signal with zero candidates today drops out
  // and its weight is redistributed proportionally across the rest) ──────
  const signalKeys = Object.keys(weights) as (keyof SignalWeights)[]
  const maxBySignal: Record<string, number> = {}
  for (const key of signalKeys) {
    maxBySignal[key] = Math.max(0, ...Array.from(candidates.values()).map(c => c.rawSignals[key]))
  }
  const activeKeys = signalKeys.filter(key => maxBySignal[key] > 0)
  const activeWeightSum = activeKeys.reduce((sum, key) => sum + weights[key], 0)
  const redistributedWeights: Record<string, number> = {}
  for (const key of activeKeys) {
    redistributedWeights[key] = activeWeightSum > 0 ? weights[key] / activeWeightSum : 1 / activeKeys.length
  }

  for (const candidate of candidates.values()) {
    let blended = 0
    for (const key of activeKeys) {
      const normalized = maxBySignal[key] > 0 ? candidate.rawSignals[key] / maxBySignal[key] : 0
      blended += redistributedWeights[key] * normalized
    }
    // Interest-area multiplier (0.5x-1.5x), not a sixth weighted row —
    // modulates the blended score by how well this candidate's topics
    // align with the user's declared/learned interests.
    const tagScores = candidate.topicTags.map(t => topicWeights[t] ?? 0.5)
    const interestAlignment = tagScores.length > 0 ? tagScores.reduce((a, b) => a + b, 0) / tagScores.length : 0.5
    const interestMultiplier = 0.5 + interestAlignment
    candidate.score = blended * interestMultiplier
  }

  // Same stable-sort tiebreaker issue as todayQueue.ts's merge: candidates
  // are inserted feed-first, then reading_list, then news, so any tie in
  // score would otherwise always resolve in favor of whichever pool was
  // inserted first rather than fairly.
  const ranked = Array.from(candidates.values()).sort((a, b) => b.score - a.score || Math.random() - 0.5)
  return ranked.slice(0, count)
}
