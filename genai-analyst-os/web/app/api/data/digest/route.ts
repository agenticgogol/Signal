import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient } from '@/lib/supabase'
import { NextRequest } from 'next/server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

// Returns an InShorts-style digest of the top articles for a given date
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId') || process.env.NEXT_PUBLIC_USER_ID!
  const date = searchParams.get('date') || new Date().toISOString().split('T')[0]

  try {
    const db = createServiceClient()
    const { data } = await db
      .from('user_feed_items')
      .select('blend_score, articles(url, title, tldr_bullets, topic_tags)')
      .eq('user_id', userId)
      .eq('feed_date', date)
      .order('blend_score', { ascending: false })
      .limit(20)

    if (!data || data.length === 0) {
      return Response.json({ items: [] })
    }

    const articleList = data
      .map((item: Record<string, unknown>) => {
        const art = Array.isArray(item.articles) ? item.articles[0] : item.articles as Record<string, unknown> | null
        if (!art) return null
        const bullets = Array.isArray(art.tldr_bullets) ? (art.tldr_bullets as string[]).join(' ') : ''
        return `- ${art.title}: ${bullets}`
      })
      .filter(Boolean)
      .join('\n')

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: `You are an AI news editor writing InShorts-style one-sentence summaries for a GenAI practitioner.
Each summary must be ONE sentence, max 60 words, direct and information-dense.
No fluff, no "this article discusses", no "according to".
Return a JSON array of objects: [{ "headline": "...", "summary": "one sentence", "url": "..." }]
Return only the JSON array, no markdown.`,
      messages: [{
        role: 'user',
        content: `Summarise these ${data.length} articles into crisp InShorts-style digests:\n\n${articleList}\n\nReturn the top 8 most important as JSON.`
      }]
    })

    const raw = response.content[0].type === 'text' ? response.content[0].text : '[]'
    // strip markdown fences if present
    const cleaned = raw.replace(/^```[a-z]*\n?/, '').replace(/\n?```$/, '').trim()

    // Merge URLs back from source data
    const parsed: Array<{headline: string, summary: string, url?: string}> = JSON.parse(cleaned)
    const withUrls = parsed.map(item => {
      const match = data.find((d: Record<string, unknown>) => {
        const art = Array.isArray(d.articles) ? d.articles[0] : d.articles as Record<string, unknown> | null
        return art && (art.title as string)?.toLowerCase().includes(item.headline?.toLowerCase().slice(0, 20))
      })
      const art = match ? (Array.isArray(match.articles) ? match.articles[0] : match.articles) as Record<string, unknown> | null : null
      const tags: string[] = art && Array.isArray(art.topic_tags) ? art.topic_tags as string[] : []
      return { ...item, url: art?.url ?? item.url ?? '#', tags }
    })

    return Response.json({ items: withUrls })
  } catch (err) {
    return Response.json({ items: [], error: String(err) })
  }
}
