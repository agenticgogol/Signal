import { createServiceClient } from '@/lib/supabase'
import { NextRequest } from 'next/server'
import { requirePaidFeature } from '@/lib/featureAccess'
import { generateJsonForUser } from '@/lib/llmClient'
import { getNotebookContext } from '@/lib/knowledge'

const TOPIC_IDEAS_SCHEMA = {
  type: 'array',
  description: 'Exactly five timely content topic ideas.',
  items: {
    type: 'object',
    additionalProperties: false,
    properties: {
      title: { type: 'string' },
      pitch: { type: 'string' },
      why_timely: { type: 'string' },
    },
    required: ['title', 'pitch', 'why_timely'],
  },
} as const

export async function POST(req: NextRequest) {
  const { focusAreas, audience, angle, freeText, userId, notebookId } = await req.json()
  if (!userId) {
    return Response.json({ error: 'userId is required' }, { status: 400 })
  }
  const paidGate = await requirePaidFeature(req, userId, 'AI topic ideas')
  if (paidGate) return paidGate

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

  let notebookContext = ''
  if (typeof notebookId === 'string' && notebookId.trim()) {
    const notebookItems = await getNotebookContext({ userId, notebookId, limit: 6 })
    notebookContext = notebookItems
      .map(item => `- ${item.title}\nSummary: ${item.summary}\nWhy it matters: ${item.why}\nTopics: ${item.topicTags.join(', ')}`)
      .join('\n')
  }

  const prompt = `You are a content strategist for a GenAI practitioner.

Recent articles from their feed (last 3 days):
${feedContext || '(no recent feed available)'}

Notebook context:
${notebookContext || '(no notebook context supplied)'}

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
    const ideas: unknown = await generateJsonForUser({
      userId,
      system: 'You are a content strategist for a GenAI practitioner.',
      prompt,
      schema: TOPIC_IDEAS_SCHEMA,
      maxTokens: 1400,
    })
    if (!Array.isArray(ideas) || ideas.length !== 5) {
      throw new Error('Model did not return exactly five topic ideas')
    }
    return Response.json({ ideas })
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 })
  }
}
