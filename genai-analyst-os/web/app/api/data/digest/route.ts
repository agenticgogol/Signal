import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient } from '@/lib/supabase'
import { NextRequest } from 'next/server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

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
        const bullets = Array.isArray(art.tldr_bullets) ? (art.tldr_bullets as string[]).join(' | ') : ''
        return `TITLE: ${art.title}\nSUMMARY: ${bullets}\nURL: ${art.url}`
      })
      .filter(Boolean)
      .join('\n\n---\n\n')

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      system: `You are an AI editor writing a "what to know" digest for busy GenAI practitioners.

For each article, produce:
- headline: 8-12 words max, specific, no fluff ("Mistral releases new model" not "A major AI company has announced...")
- why_it_matters: ONE sentence, max 25 words — the actual implication for a practitioner ("This changes how you'll need to architect RAG pipelines going forward")
- key_takeaways: exactly 3 bullet strings — specific, information-dense, "need to know" facts:
  • First bullet: the core fact/development
  • Second bullet: the specific impact or mechanism
  • Third bullet: what a practitioner should do or watch
- url: string
- tags: string[]

Return ONLY a JSON array of objects with exactly these fields. No markdown, no fences.`,
      messages: [{
        role: 'user',
        content: `Select the top 8 most important items and format them as the digest JSON:\n\n${articleList}`,
      }],
    })

    const raw = response.content[0].type === 'text' ? response.content[0].text : '[]'
    const cleaned = raw.replace(/^```[a-z]*\n?/, '').replace(/\n?```$/, '').trim()

    const parsed: Array<{
      headline: string
      why_it_matters: string
      key_takeaways: string[]
      url?: string
      tags?: string[]
    }> = JSON.parse(cleaned)

    // Merge URLs + tags back from source data
    const withUrls = parsed.map(item => {
      const match = data.find((d: Record<string, unknown>) => {
        const art = Array.isArray(d.articles) ? d.articles[0] : d.articles as Record<string, unknown> | null
        return art && (art.title as string)?.toLowerCase().includes(item.headline?.toLowerCase().slice(0, 20))
      })
      const art = match
        ? (Array.isArray(match.articles) ? match.articles[0] : match.articles) as Record<string, unknown> | null
        : null
      const tags: string[] = art && Array.isArray(art.topic_tags) ? art.topic_tags as string[] : (item.tags ?? [])
      return {
        headline: item.headline,
        why_it_matters: item.why_it_matters,
        key_takeaways: Array.isArray(item.key_takeaways) ? item.key_takeaways.slice(0, 3) : [],
        url: art?.url ?? item.url ?? '#',
        tags,
      }
    })

    return Response.json({ items: withUrls })
  } catch (err) {
    return Response.json({ items: [], error: String(err) })
  }
}
