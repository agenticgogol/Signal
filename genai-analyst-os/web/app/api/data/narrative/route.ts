import Anthropic from '@anthropic-ai/sdk'
import { NextRequest } from 'next/server'
import { fetchAiNews } from '@/lib/aiNews'
import { createServiceClient } from '@/lib/supabase'
import { TAG_LABELS } from '@/lib/tagColors'
import { requirePaidFeature } from '@/lib/featureAccess'

export const maxDuration = 60

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

interface Narrative {
  headline: string
  signal: string
  watch: { item: string; why: string }[]
  takeaway: string
}

const NARRATIVE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    headline: { type: 'string', description: 'One punchy sentence capturing the biggest theme.' },
    signal: { type: 'string', description: 'A concise 3-4 paragraph connected narrative.' },
    watch: {
      type: 'array',
      description: 'Exactly three specific developments to watch.',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          item: { type: 'string' },
          why: { type: 'string' },
        },
        required: ['item', 'why'],
      },
    },
    takeaway: { type: 'string', description: 'One practical paragraph for AI builders.' },
  },
  required: ['headline', 'signal', 'watch', 'takeaway'],
} as const

function weekStartISO() {
  const now = new Date()
  const day = now.getUTCDay()
  now.setUTCDate(now.getUTCDate() - (day === 0 ? 6 : day - 1))
  return now.toISOString().slice(0, 10)
}

function isNarrative(value: unknown): value is Narrative {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<Narrative>
  return typeof item.headline === 'string'
    && typeof item.signal === 'string'
    && typeof item.takeaway === 'string'
    && Array.isArray(item.watch)
    && item.watch.length === 3
    && item.watch.every(w => typeof w?.item === 'string' && typeof w?.why === 'string')
}

async function handle(req: NextRequest, force: boolean) {
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId') || process.env.NEXT_PUBLIC_USER_ID!
  const requestedDays = Number.parseInt(searchParams.get('days') || '7', 10)
  const days = Number.isFinite(requestedDays) ? Math.min(14, Math.max(1, requestedDays)) : 7
  const weekStart = weekStartISO()
  const db = createServiceClient()

  try {
    if (!force) {
      const { data: cached } = await db
        .from('weekly_digests')
        .select('narrative, article_count, dominant_topics, generated_at')
        .eq('user_id', userId)
        .eq('week_start', weekStart)
        .maybeSingle()

      if (cached && isNarrative(cached.narrative)) {
        return Response.json({
          narrative: cached.narrative,
          articleCount: cached.article_count,
          dominantTopics: cached.dominant_topics ?? [],
          generatedAt: cached.generated_at,
          cached: true,
          period: `Last ${days} days`,
        })
      }
    }

    const paidGate = await requirePaidFeature(req, userId, 'Weekly Digest regeneration')
    if (paidGate) return paidGate

    const from = new Date()
    from.setUTCDate(from.getUTCDate() - days)
    const fromISO = from.toISOString().slice(0, 10)
    const { data, error } = await db
      .from('user_feed_items')
      .select('blend_score, articles(url, title, tldr_bullets, topic_tags, why_it_matters)')
      .eq('user_id', userId)
      .gte('feed_date', fromISO)
      .order('blend_score', { ascending: false })
      .limit(40)

    if (error) throw error
    if (!data?.length) {
      return Response.json({ narrative: null, error: 'No articles found in this period.' }, { status: 404 })
    }

    const seen = new Set<string>()
    const uniqueData = data.filter(item => {
      const article = Array.isArray(item.articles) ? item.articles[0] : item.articles
      const key = String(article?.url ?? '')
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    }).slice(0, 12)

    const topicCounts = new Map<string, number>()
    const articleBriefs = uniqueData.map((item, index) => {
      const article = (Array.isArray(item.articles) ? item.articles[0] : item.articles)!
      const tags = Array.isArray(article.topic_tags) ? article.topic_tags as string[] : []
      tags.forEach(tag => topicCounts.set(tag, (topicCounts.get(tag) ?? 0) + 1))
      const bullets = Array.isArray(article.tldr_bullets)
        ? (article.tldr_bullets as string[]).slice(0, 3).join(' ')
        : ''
      return `[${index + 1}] ${article.title}\nTopics: ${tags.map(tag => TAG_LABELS[tag] ?? tag).join(', ')}\n${bullets}\nWhy it matters: ${article.why_it_matters ?? 'Not supplied'}\nURL: ${article.url}`
    }).join('\n\n')

    const dominantTopics = [...topicCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([tag]) => TAG_LABELS[tag] ?? tag)

    const worldNews = await fetchAiNews(8)
    const worldBriefs = worldNews.map((item, index) =>
      `[W${index + 1}] ${item.title} — ${item.source}\n${item.description.slice(0, 220)}\nURL: ${item.url}`
    ).join('\n\n')

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      output_config: {
        format: { type: 'json_schema', schema: NARRATIVE_SCHEMA },
      },
      system: `You are a senior AI analyst writing a concise weekly intelligence newsletter for GenAI practitioners. Connect stories into a coherent argument; do not list or merely summarize them. Compare the user's sources with worldwide AI coverage, identify agreement and tension, and explain practical implications. Return exactly three items in watch. Cite evidence inline as "Article title (URL)". Treat RSS snippets as context rather than proof. Be analytical, direct, specific, and free of hype.`,
      messages: [{
        role: 'user',
        content: `Dominant topics: ${dominantTopics.join(', ')}\n\nUSER'S TOP ARTICLES:\n${articleBriefs}\n\nWORLDWIDE AI NEWS:\n${worldBriefs || 'No external headlines available.'}\n\nProduce the weekly intelligence briefing.`,
      }],
    })

    if (response.stop_reason === 'max_tokens') throw new Error('Digest exceeded its output budget.')
    const block = response.content.find(item => item.type === 'text')
    const parsed: unknown = block?.type === 'text' ? JSON.parse(block.text) : null
    if (!isNarrative(parsed)) throw new Error('Claude returned an invalid digest structure.')

    const generatedAt = new Date().toISOString()
    const { error: cacheError } = await db.from('weekly_digests').upsert({
      user_id: userId,
      week_start: weekStart,
      narrative: parsed,
      article_count: uniqueData.length,
      dominant_topics: dominantTopics,
      generated_at: generatedAt,
    }, { onConflict: 'user_id,week_start' })

    if (cacheError) console.error('weekly_digest_cache_failed', cacheError.message)

    return Response.json({
      narrative: parsed,
      articleCount: uniqueData.length,
      dominantTopics,
      generatedAt,
      cached: false,
      period: `Last ${days} days`,
    })
  } catch (error) {
    console.error('weekly_digest_generation_failed', error)
    return Response.json({
      narrative: null,
      error: 'The briefing could not be generated. Please try Regenerate once more.',
    }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  return handle(req, false)
}

export async function POST(req: NextRequest) {
  return handle(req, true)
}
