import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient } from '@/lib/supabase'
import { NextRequest } from 'next/server'
import { TAG_LABELS } from '@/lib/tagColors'
import { fetchAiNews } from '@/lib/aiNews'

export const maxDuration = 60

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId') || process.env.NEXT_PUBLIC_USER_ID!
  const days = parseInt(searchParams.get('days') || '7', 10)

  const from = new Date()
  from.setDate(from.getDate() - days)
  const fromISO = from.toISOString().split('T')[0]

  try {
    const db = createServiceClient()
    const { data } = await db
      .from('user_feed_items')
      .select('blend_score, articles(url, title, tldr_bullets, topic_tags, why_it_matters, full_text)')
      .eq('user_id', userId)
      .gte('feed_date', fromISO)
      .order('blend_score', { ascending: false })
      .limit(20)

    if (!data || data.length === 0) {
      return Response.json({ narrative: null, error: 'No articles found for the period' })
    }

    const seenArticleIds = new Set<string>()
    const uniqueData = data.filter(item => {
      const art = Array.isArray(item.articles) ? item.articles[0] : item.articles
      const key = String(art?.url ?? art?.title ?? '')
      if (!key || seenArticleIds.has(key)) return false
      seenArticleIds.add(key)
      return true
    })

    // Build a rich content brief from all articles
    const articleBriefs = uniqueData
      .map((item: Record<string, unknown>, i: number) => {
        const art = Array.isArray(item.articles) ? item.articles[0] : item.articles as Record<string, unknown> | null
        if (!art) return null
        const bullets = Array.isArray(art.tldr_bullets) ? (art.tldr_bullets as string[]).join(' ') : ''
        const why = art.why_it_matters ? `Why it matters: ${art.why_it_matters}` : ''
        const tags = Array.isArray(art.topic_tags) ? (art.topic_tags as string[]).map(t => TAG_LABELS[t] ?? t).join(', ') : ''
        return `[${i + 1}] ${art.title} (${tags})\n${bullets}\n${why}\nURL: ${art.url}`
      })
      .filter(Boolean)
      .join('\n\n')

    // Group topics to understand the week's themes
    const topicSet = new Map<string, number>()
    for (const item of uniqueData) {
      const art = Array.isArray(item.articles) ? item.articles[0] : item.articles as Record<string, unknown> | null
      for (const t of (Array.isArray(art?.topic_tags) ? art!.topic_tags as string[] : [])) {
        topicSet.set(t, (topicSet.get(t) ?? 0) + 1)
      }
    }
    const dominantTopics = [...topicSet.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([t]) => TAG_LABELS[t] ?? t)

    // Add current external context so the digest can compare the user's feed
    // with how the wider AI press is framing the same week.
    const worldNews = await fetchAiNews(12)
    const worldBriefs = worldNews.map((item, i) =>
      `[W${i + 1}] ${item.title} — ${item.source}\n${item.description}\nURL: ${item.url}`
    ).join('\n\n')

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      system: `You are a senior AI analyst writing a weekly intelligence newsletter for GenAI practitioners.
Your newsletter should read like The Pragmatic Engineer or Import AI — analytical, direct, no hype.

Write in sections:
1. THE WEEK IN ONE SENTENCE — a single punchy sentence capturing the single biggest theme
2. THE SIGNAL THIS WEEK — 3-4 paragraphs weaving the top stories into a coherent narrative.
   Do NOT list articles. Write a story: "While [company] announced X, researchers at [place] were showing that Y...".
   Compare the user's sources with the WORLDWIDE AI NEWS context. Show patterns,
   disagreements, tensions, and what they mean for practitioners building today.
3. THE THREE THINGS TO WATCH — 3 specific developments that will matter in the next 30-90 days, with a brief "why"
4. PRACTITIONER TAKEAWAY — one paragraph on what someone building AI systems should actually do differently this week

Rules:
- Cite specific articles by title and URL when referencing them
- Treat RSS headlines/snippets as context, not proof of facts absent from the supplied text
- Be specific about numbers, papers, companies
- Avoid: "fascinating", "in conclusion", "it's worth noting", "delve", "leverage"
- Sound like someone who read everything and is telling a colleague what actually matters
Return as JSON: { "headline": "...", "signal": "...", "watch": [{"item": "...", "why": "..."}], "takeaway": "..." }`,
      messages: [{
        role: 'user',
        content: `Dominant topics this week: ${dominantTopics.join(', ')}\n\nUSER'S TOP ARTICLES (${uniqueData.length}):\n\n${articleBriefs}\n\nWORLDWIDE AI NEWS CONTEXT (live RSS):\n\n${worldBriefs || 'No live external headlines were available.'}\n\nWrite the weekly intelligence briefing as JSON.`,
      }],
    })

    const raw = response.content[0].type === 'text' ? response.content[0].text : '{}'
    const cleaned = raw.replace(/^```[a-z]*\n?/, '').replace(/\n?```$/, '').trim()
    const parsed = JSON.parse(cleaned)

    return Response.json({
      narrative: parsed,
      articleCount: uniqueData.length,
      dominantTopics,
      period: `Last ${days} days`,
    })
  } catch (err) {
    return Response.json({ narrative: null, error: String(err) })
  }
}
