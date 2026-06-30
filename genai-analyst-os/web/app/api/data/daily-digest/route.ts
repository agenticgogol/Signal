import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { TAG_LABELS } from '@/lib/tagColors'
import { requirePaidFeature } from '@/lib/featureAccess'
import { generateJsonForUser } from '@/lib/llmClient'

interface DailyDigest {
  headline: string
  signal: string
  highlights: { title: string; why: string }[]
  takeaway: string
}

const DAILY_DIGEST_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    headline: { type: 'string' },
    signal: { type: 'string' },
    highlights: {
      type: 'array',
      minItems: 3,
      maxItems: 4,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          title: { type: 'string' },
          why: { type: 'string' },
        },
        required: ['title', 'why'],
      },
    },
    takeaway: { type: 'string' },
  },
  required: ['headline', 'signal', 'highlights', 'takeaway'],
} as const

function isDailyDigest(value: unknown): value is DailyDigest {
  if (!value || typeof value !== 'object') return false
  const digest = value as Partial<DailyDigest>
  return typeof digest.headline === 'string'
    && typeof digest.signal === 'string'
    && typeof digest.takeaway === 'string'
    && Array.isArray(digest.highlights)
    && digest.highlights.length >= 3
    && digest.highlights.every(item => typeof item?.title === 'string' && typeof item?.why === 'string')
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId') || process.env.NEXT_PUBLIC_USER_ID!
  const db = createServiceClient()
  const today = new Date().toISOString().slice(0, 10)

  const { data: current, error: currentError } = await db
    .from('daily_digests')
    .select('digest_date, narrative, article_count, dominant_topics, generated_at, emailed_at')
    .eq('user_id', userId)
    .lte('digest_date', today)
    .order('digest_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (currentError) return Response.json({ error: currentError.message }, { status: 500 })

  const sevenDaysAgo = new Date()
  sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7)
  const cutoff = sevenDaysAgo.toISOString().slice(0, 10)

  const { data: recent } = await db
    .from('daily_digests')
    .select('digest_date, article_count, dominant_topics, generated_at')
    .eq('user_id', userId)
    .gte('digest_date', cutoff)
    .order('digest_date', { ascending: false })

  const { data: archive } = await db
    .from('daily_digests')
    .select('digest_date, article_count, dominant_topics, generated_at')
    .eq('user_id', userId)
    .lt('digest_date', cutoff)
    .order('digest_date', { ascending: false })
    .limit(24)

  return Response.json({
    current: current ?? null,
    recent: recent ?? [],
    archive: archive ?? [],
  })
}

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId') || process.env.NEXT_PUBLIC_USER_ID!
  const paidGate = await requirePaidFeature(req, userId, 'Daily Digest regeneration')
  if (paidGate) return paidGate

  const db = createServiceClient()
  const today = new Date().toISOString().slice(0, 10)

  try {
    const { data: latestFeed } = await db
      .from('user_feed_items')
      .select('feed_date')
      .eq('user_id', userId)
      .order('feed_date', { ascending: false })
      .limit(1)
      .maybeSingle()

    const feedDate = latestFeed?.feed_date || today
    const { data, error } = await db
      .from('user_feed_items')
      .select('blend_score, articles(url, title, tldr_bullets, topic_tags, why_it_matters)')
      .eq('user_id', userId)
      .eq('feed_date', feedDate)
      .order('blend_score', { ascending: false })
      .limit(12)

    if (error) throw error
    if (!data?.length) {
      return Response.json({ error: 'No ranked articles are available yet for a daily digest.' }, { status: 404 })
    }

    const topicCounts = new Map<string, number>()
    const articleBriefs = data.map((item, index) => {
      const article = Array.isArray(item.articles) ? item.articles[0] : item.articles
      const tags = Array.isArray(article?.topic_tags) ? article.topic_tags as string[] : []
      tags.forEach(tag => topicCounts.set(tag, (topicCounts.get(tag) ?? 0) + 1))
      const bullets = Array.isArray(article?.tldr_bullets) ? (article?.tldr_bullets as string[]).slice(0, 3).join(' ') : ''
      return `[${index + 1}] ${article?.title}\nTopics: ${tags.map(tag => TAG_LABELS[tag] ?? tag).join(', ')}\n${bullets}\nWhy it matters: ${article?.why_it_matters ?? 'Not supplied'}\nURL: ${article?.url}`
    }).join('\n\n')

    const dominantTopics = [...topicCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([tag]) => TAG_LABELS[tag] ?? tag)

    const parsed: unknown = await generateJsonForUser({
      userId,
      system: `You are writing a sharp, story-like daily AI intelligence brief for a serious GenAI practitioner. Connect the strongest ranked articles into one coherent story. Do not write bullet sludge. Return valid JSON only.`,
      prompt: `Feed date: ${feedDate}\nDominant topics: ${dominantTopics.join(', ')}\n\nTOP RANKED ARTICLES:\n${articleBriefs}\n\nProduce the daily story with 3-4 highlights and one practical takeaway.`,
      schema: DAILY_DIGEST_SCHEMA,
      maxTokens: 2400,
    })

    if (!isDailyDigest(parsed)) throw new Error('Invalid daily digest structure returned by model.')

    const generatedAt = new Date().toISOString()
    const { error: upsertError } = await db.from('daily_digests').upsert({
      user_id: userId,
      digest_date: feedDate,
      narrative: parsed,
      article_count: data.length,
      dominant_topics: dominantTopics,
      generated_at: generatedAt,
      emailed_at: null,
    }, { onConflict: 'user_id,digest_date' })
    if (upsertError) throw upsertError

    return Response.json({
      current: {
        digest_date: feedDate,
        narrative: parsed,
        article_count: data.length,
        dominant_topics: dominantTopics,
        generated_at: generatedAt,
        emailed_at: null,
      },
      regenerated: true,
    })
  } catch (error) {
    console.error('daily_digest_generation_failed', error)
    return Response.json({ error: 'The daily digest could not be regenerated. Please try again.' }, { status: 500 })
  }
}
