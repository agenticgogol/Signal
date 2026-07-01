import { createServiceClient } from '@/lib/supabase'
import { generateJsonForUser } from '@/lib/llmClient'

// Novelty/Velocity Radar — pure heuristics, zero LLM cost by default.
// Different from topic ranking: this looks for terms that are NEW —
// absent from the last month, then suddenly mentioned by several
// independent sources within the last few days. That "three unrelated
// sources in 48 hours" pattern is a genuine early signal, not just
// "here's what's already popular."

const RECENT_WINDOW_DAYS = 4
const BASELINE_WINDOW_DAYS = 45
const MIN_RECENT_SOURCES = 2
const MAX_BASELINE_MENTIONS = 1

const STOPWORDS = new Set([
  'the','a','an','and','or','but','of','to','in','on','for','with','is','are','was','were',
  'this','that','these','those','it','its','as','at','by','from','be','been','being','can',
  'will','would','should','could','what','why','how','your','you','we','our','their','they',
  'not','no','do','does','did','have','has','had','more','most','than','into','about','if',
  'new','how','why','use','using','used','via','after','before','over','under','out','up',
])

function extractTerms(text: string): string[] {
  // Proper-noun-ish runs (e.g. "Model Context Protocol", "GPT-5", "LangGraph")
  // plus significant single words — this is intentionally simple/cheap since
  // it has to scan every article for free.
  const phrases = text.match(/\b([A-Z][a-zA-Z0-9]*(?:[-.][A-Za-z0-9]+)?(?:\s+[A-Z][a-zA-Z0-9]*){0,2})\b/g) ?? []
  return phrases
    .map(p => p.trim())
    .filter(p => p.length >= 3 && !STOPWORDS.has(p.toLowerCase()))
}

interface RadarCandidate {
  term: string
  recentCount: number
  recentSources: Set<string>
  recentArticles: { title: string; url: string }[]
  baselineCount: number
}

export interface RadarHit {
  term: string
  recentMentions: number
  recentSourceCount: number
  articles: { title: string; url: string }[]
  insight?: string
}

export async function scanNoveltyRadar(userId: string): Promise<{ hits: RadarHit[]; articlesScanned: number }> {
  const db = createServiceClient()
  const recentSince = new Date(); recentSince.setUTCDate(recentSince.getUTCDate() - RECENT_WINDOW_DAYS)
  const baselineSince = new Date(); baselineSince.setUTCDate(baselineSince.getUTCDate() - BASELINE_WINDOW_DAYS)

  const { data: feedItems, error } = await db
    .from('user_feed_items')
    .select('feed_date, articles(title, url, tldr_bullets, source_id, published_at)')
    .eq('user_id', userId)
    .gte('feed_date', baselineSince.toISOString().slice(0, 10))
    .limit(400)

  if (error) throw error

  const recentDocs: { title: string; url: string; sourceId: string; text: string }[] = []
  const baselineDocs: { text: string }[] = []

  for (const row of feedItems ?? []) {
    const article = Array.isArray(row.articles) ? row.articles[0] : row.articles as Record<string, unknown> | null
    if (!article) continue
    const publishedAt = article.published_at ? new Date(String(article.published_at)) : null
    const text = [article.title, ...(Array.isArray(article.tldr_bullets) ? article.tldr_bullets : [])].filter(Boolean).join(' ')
    if (publishedAt && publishedAt >= recentSince) {
      recentDocs.push({ title: String(article.title || ''), url: String(article.url || ''), sourceId: String(article.source_id || ''), text })
    } else {
      baselineDocs.push({ text })
    }
  }

  const baselineTermCounts = new Map<string, number>()
  for (const doc of baselineDocs) {
    const terms = new Set(extractTerms(doc.text))
    for (const term of terms) baselineTermCounts.set(term, (baselineTermCounts.get(term) ?? 0) + 1)
  }

  const candidates = new Map<string, RadarCandidate>()
  for (const doc of recentDocs) {
    const terms = new Set(extractTerms(doc.text))
    for (const term of terms) {
      const existing = candidates.get(term) ?? { term, recentCount: 0, recentSources: new Set<string>(), recentArticles: [], baselineCount: baselineTermCounts.get(term) ?? 0 }
      existing.recentCount++
      if (doc.sourceId) existing.recentSources.add(doc.sourceId)
      if (existing.recentArticles.length < 3) existing.recentArticles.push({ title: doc.title, url: doc.url })
      candidates.set(term, existing)
    }
  }

  const hits: RadarHit[] = Array.from(candidates.values())
    .filter(c => c.recentSources.size >= MIN_RECENT_SOURCES && c.baselineCount <= MAX_BASELINE_MENTIONS)
    .sort((a, b) => b.recentSources.size - a.recentSources.size || b.recentCount - a.recentCount)
    .slice(0, 8)
    .map(c => ({
      term: c.term,
      recentMentions: c.recentCount,
      recentSourceCount: c.recentSources.size,
      articles: c.recentArticles,
    }))

  return { hits, articlesScanned: recentDocs.length + baselineDocs.length }
}

// Optional, separately gated — explains WHY each heuristic hit looks like a
// genuine signal, in one batched call covering every hit found.
export async function explainNoveltyRadar(userId: string, hits: RadarHit[]): Promise<RadarHit[]> {
  if (hits.length === 0) return hits

  const block = hits.map((h, i) => `[${i + 1}] "${h.term}" — mentioned by ${h.recentSourceCount} independent sources in the last ${RECENT_WINDOW_DAYS} days, absent before that.\nArticles: ${h.articles.map(a => a.title).join(' | ')}`).join('\n\n')

  const result = await generateJsonForUser<{ explanations: { index: number; insight: string }[] }>({
    userId,
    agent: 'novelty_radar',
    maxTokens: 900,
    system: 'You explain why a term suddenly spiking across independent sources might matter to a GenAI practitioner. One sharp sentence per term — what it is (if inferable from the article titles) and why the sudden multi-source attention is worth noticing. Do not overclaim significance if the evidence is thin.',
    prompt: `Candidate emerging terms:\n\n${block}\n\nReturn one explanation per numbered term.`,
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        explanations: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: { index: { type: 'number' }, insight: { type: 'string' } },
            required: ['index', 'insight'],
          },
        },
      },
      required: ['explanations'],
    },
  })

  const byIndex = new Map(result.explanations.map(e => [e.index, e.insight]))
  return hits.map((h, i) => ({ ...h, insight: byIndex.get(i + 1) }))
}
