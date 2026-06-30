import { createServiceClient } from '@/lib/supabase'
import { NextRequest } from 'next/server'
import { getRecentArticleMemoryBoosts } from '@/lib/memory'

// Mirrors src/nodes.py::_cosine_approx — average of the user's topic weight
// across an article's tags. Lets freshly-saved preferences (or onboarding
// choices) nudge the feed immediately, without waiting for the next pipeline
// run to recompute blend_score server-side.
function cosineApprox(weights: Record<string, number>, tags: string[]): number {
  if (!tags.length || !Object.keys(weights).length) return 0
  const scores = tags.map(tag => weights[tag] ?? 0)
  return scores.reduce((a, b) => a + b, 0) / scores.length
}

async function getTopicWeights(db: ReturnType<typeof createServiceClient>, userId: string): Promise<Record<string, number>> {
  const { data } = await db.from('user_profiles').select('topic_weights').eq('id', userId).maybeSingle()
  return (data?.topic_weights ?? {}) as Record<string, number>
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId') || process.env.NEXT_PUBLIC_USER_ID!
  const date = searchParams.get('date')
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  try {
    const db = createServiceClient()
    let query = db
      .from('user_feed_items')
      .select('blend_score, feed_date, articles(id, url, title, tldr_bullets, topic_tags, depth_score, why_it_matters, key_takeaways, og_image_url, published_at, source_id)')
      .eq('user_id', userId)
      .order('blend_score', { ascending: false })
      .limit(120)

    if (date) {
      query = query.eq('feed_date', date)
    } else if (from && to) {
      query = query.gte('feed_date', from).lte('feed_date', to)
    } else {
      // Default: today
      query = query.eq('feed_date', new Date().toISOString().split('T')[0])
    }

    const { data, error } = await query
    if (error) return Response.json({ error: error.message }, { status: 500 })
    const [boosts, topicWeights] = await Promise.all([
      getRecentArticleMemoryBoosts(userId).catch(() => ({} as Record<string, number>)),
      getTopicWeights(db, userId).catch(() => ({} as Record<string, number>)),
    ])
    // The same article can be ranked on several feed dates. Range views should
    // show it once, keeping the highest-ranked occurrence.
    const seen = new Set<string>()
    const items = (data ?? []).filter(item => {
      const article = Array.isArray(item.articles) ? item.articles[0] : item.articles
      const articleId = article?.id
      if (!articleId || seen.has(articleId)) return false
      seen.add(articleId)
      return true
    }).map(item => {
      const article = Array.isArray(item.articles) ? item.articles[0] : item.articles
      const articleId = article?.id ? String(article.id) : ''
      const memoryBoost = articleId ? (boosts[articleId] ?? 0) : 0

      // Nudge — not override — the pipeline-computed blend_score using the user's
      // current topic_weights, so onboarding/settings changes are reflected on the
      // very next feed load rather than waiting for the next "Get Latest Feed" run.
      const tags = Array.isArray(article?.topic_tags) ? article.topic_tags : []
      const cosine = cosineApprox(topicWeights, tags)
      const preferenceBoost = Object.keys(topicWeights).length
        ? Math.max(-0.12, Math.min(0.18, (cosine - 0.5) * 0.25))
        : 0

      return {
        ...item,
        blend_score: Math.max(0, Math.min(1, Number(item.blend_score) + memoryBoost + preferenceBoost)),
        memory_boost: Number(memoryBoost.toFixed(4)),
        preference_boost: Number(preferenceBoost.toFixed(4)),
      }
    }).sort((a, b) => Number(b.blend_score) - Number(a.blend_score))
    return Response.json({ items })
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 })
  }
}
