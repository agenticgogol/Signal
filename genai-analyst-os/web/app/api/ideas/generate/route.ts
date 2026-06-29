import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient } from '@/lib/supabase'
import { NextRequest } from 'next/server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export async function POST(req: NextRequest) {
  const { focusAreas, audience, angle, freeText, userId } = await req.json()

  const db = createServiceClient()

  // Fetch last 3 days of feed for context
  const threeDaysAgo = new Date()
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)
  const { data: recentFeed } = await db
    .from('user_feed_items')
    .select('articles(title, topic_tags, tldr_bullets)')
    .eq('user_id', userId)
    .gte('feed_date', threeDaysAgo.toISOString().split('T')[0])
    .limit(20)

  const feedContext = (recentFeed ?? [])
    .flatMap((item: Record<string, unknown>) => {
      const art = item.articles
      if (!art) return []
      const articles = Array.isArray(art) ? art : [art]
      return articles.map((a: Record<string, unknown>) => `- ${a.title} [${(a.topic_tags as string[] | null)?.join(', ') ?? ''}]`)
    })
    .join('\n')

  const prompt = `You are a content strategist for a GenAI practitioner.

Recent articles from their feed (last 3 days):
${feedContext || '(no recent feed available)'}

User's content preferences:
- Focus areas: ${focusAreas.join(', ')}
- Target audience: ${audience}
- Preferred angle: ${angle}
${freeText ? `- Additional context: ${freeText}` : ''}

Generate exactly 5 timely, original topic ideas grounded in what's trending in their feed.

Return ONLY a JSON array with exactly this structure:
[
  { "title": "...", "pitch": "one sentence pitch", "why_timely": "why this is relevant right now" },
  ...
]`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = response.content[0].type === 'text' ? response.content[0].text : '[]'
    const match = text.match(/\[[\s\S]*\]/)
    const ideas = match ? JSON.parse(match[0]) : []
    return Response.json({ ideas })
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 })
  }
}
