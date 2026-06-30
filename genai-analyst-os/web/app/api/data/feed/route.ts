import { createServiceClient } from '@/lib/supabase'
import { NextRequest } from 'next/server'
import { getRecentArticleMemoryBoosts } from '@/lib/memory'

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
    const boosts = await getRecentArticleMemoryBoosts(userId).catch(() => ({} as Record<string, number>))
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
      return {
        ...item,
        blend_score: Math.max(0, Math.min(1, Number(item.blend_score) + memoryBoost)),
        memory_boost: Number(memoryBoost.toFixed(4)),
      }
    }).sort((a, b) => Number(b.blend_score) - Number(a.blend_score))
    return Response.json({ items })
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 })
  }
}
