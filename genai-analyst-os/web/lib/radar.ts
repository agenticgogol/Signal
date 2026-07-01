import { createServiceClient } from '@/lib/supabase'
import { generateJsonForUser } from '@/lib/llmClient'

// Novelty/Velocity Radar — pure heuristics, zero LLM cost by default.
// Different from topic ranking: this looks for terms that are NEW —
// absent from the last month, then suddenly mentioned by several
// independent sources within the last few days. That "three unrelated
// sources in 48 hours" pattern is a genuine early signal, not just
// "here's what's already popular."

const RECENT_WINDOW_DAYS = 7
const BASELINE_WINDOW_DAYS = 45
const MIN_RECENT_SOURCES = 2
const MIN_RECENT_SOURCES_SINGLE_WORD = 3
const MIN_BASELINE_ARTICLES_FOR_CONFIDENCE = 15
// A term with zero baseline mentions is "brand new." One with some baseline
// history but a much higher mention rate this week is "trending up" — both
// are useful signal, so both are surfaced, just labeled differently.
const TRENDING_VELOCITY_RATIO = 3

const STOPWORDS = new Set([
  'the','a','an','and','or','but','of','to','in','on','for','with','is','are','was','were',
  'this','that','these','those','it','its','as','at','by','from','be','been','being','can',
  'will','would','should','could','what','why','how','your','you','we','our','their','they',
  'not','no','do','does','did','have','has','had','more','most','than','into','about','if',
  'new','how','why','use','using','used','via','after','before','over','under','out','up',
])

// Permanently-common words in a GenAI-focused feed — these are background
// noise here, not signal, regardless of how thin the baseline window is.
// A candidate is dropped only if EVERY word in it is on this list, so a
// genuinely new compound like "Nano Banana" or "Model Context Protocol"
// still gets through even though it contains no denylisted words, while
// "Claude Sonnet" (both halves generic in this domain) does not.
const DOMAIN_NOISE_WORDS = new Set([
  'anthropic','openai','google','meta','microsoft','amazon','nvidia',
  'claude','gpt','chatgpt','llm','llms','ai','ml','genai',
  'sonnet','opus','haiku','gemini','copilot',
  'model','models','agent','agents','api','apis','data','cloud','app','apps',
])

function isDomainNoise(term: string): boolean {
  const words = term.toLowerCase().split(/\s+/)
  return words.every(w => DOMAIN_NOISE_WORDS.has(w))
}

function extractTerms(text: string): string[] {
  // Proper-noun-ish runs (e.g. "Model Context Protocol", "GPT-5", "LangGraph")
  // plus significant single words — this is intentionally simple/cheap since
  // it has to scan every article for free.
  const phrases = text.match(/\b([A-Z][a-zA-Z0-9]*(?:[-.][A-Za-z0-9]+)?(?:\s+[A-Z][a-zA-Z0-9]*){0,2})\b/g) ?? []
  return phrases
    .map(p => p.trim())
    .filter(p => p.length >= 3 && !STOPWORDS.has(p.toLowerCase()) && !isDomainNoise(p))
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
  baselineMentions: number
  tier: 'new' | 'trending'
  articles: { title: string; url: string }[]
  insight?: string
}

export interface RadarScanResult {
  hits: RadarHit[]
  articlesScanned: number
  // True when the baseline window has too few articles to reliably tell
  // "actually new" apart from "just how few sources cover this niche" —
  // surfaced so the UI can caveat results instead of presenting them with
  // false confidence.
  lowConfidence: boolean
}

export async function scanNoveltyRadar(userId: string): Promise<RadarScanResult> {
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

  // Match terms case-insensitively (so "Claude Sonnet" and "claude sonnet"
  // in different articles count as the same entity) while keeping the
  // first-seen casing for display.
  const baselineTermCounts = new Map<string, number>()
  for (const doc of baselineDocs) {
    const terms = new Set(extractTerms(doc.text).map(t => t.toLowerCase()))
    for (const term of terms) baselineTermCounts.set(term, (baselineTermCounts.get(term) ?? 0) + 1)
  }

  const candidates = new Map<string, RadarCandidate>()
  for (const doc of recentDocs) {
    const terms = new Set(extractTerms(doc.text))
    for (const displayTerm of terms) {
      const key = displayTerm.toLowerCase()
      const existing = candidates.get(key) ?? { term: displayTerm, recentCount: 0, recentSources: new Set<string>(), recentArticles: [], baselineCount: baselineTermCounts.get(key) ?? 0 }
      existing.recentCount++
      if (doc.sourceId) existing.recentSources.add(doc.sourceId)
      if (existing.recentArticles.length < 3) existing.recentArticles.push({ title: doc.title, url: doc.url })
      candidates.set(key, existing)
    }
  }

  // Normalized rate per day so a 7-day recent window and a 45-day baseline
  // window are comparable — a term mentioned twice this week with zero
  // baseline history is "new"; one mentioned twice this week after only
  // appearing once across the whole baseline is "trending up."
  const recentRatePerDay = (n: number) => n / RECENT_WINDOW_DAYS
  const baselineRatePerDay = (n: number) => n / BASELINE_WINDOW_DAYS

  const hits: RadarHit[] = Array.from(candidates.values())
    .filter(c => c.recentSources.size >= (c.term.includes(' ') ? MIN_RECENT_SOURCES : MIN_RECENT_SOURCES_SINGLE_WORD))
    .map(c => {
      const velocityRatio = c.baselineCount === 0
        ? Infinity
        : recentRatePerDay(c.recentCount) / baselineRatePerDay(c.baselineCount)
      const tier: 'new' | 'trending' = c.baselineCount === 0 ? 'new' : 'trending'
      return { ...c, velocityRatio, tier }
    })
    .filter(c => c.tier === 'new' || c.velocityRatio >= TRENDING_VELOCITY_RATIO)
    .sort((a, b) => {
      // Brand-new terms first, then by how many independent sources picked
      // it up, then by raw mention count.
      if (a.tier !== b.tier) return a.tier === 'new' ? -1 : 1
      return b.recentSources.size - a.recentSources.size || b.recentCount - a.recentCount
    })
    .slice(0, 10)
    .map(c => ({
      term: c.term,
      recentMentions: c.recentCount,
      recentSourceCount: c.recentSources.size,
      baselineMentions: c.baselineCount,
      tier: c.tier,
      articles: c.recentArticles,
    }))

  return {
    hits,
    articlesScanned: recentDocs.length + baselineDocs.length,
    lowConfidence: baselineDocs.length < MIN_BASELINE_ARTICLES_FOR_CONFIDENCE,
  }
}

// Optional, separately gated — explains WHY each heuristic hit looks like a
// genuine signal, in one batched call covering every hit found.
export async function explainNoveltyRadar(userId: string, hits: RadarHit[]): Promise<RadarHit[]> {
  if (hits.length === 0) return hits

  const block = hits.map((h, i) => {
    const history = h.tier === 'new'
      ? `absent from the prior ${BASELINE_WINDOW_DAYS} days`
      : `mentioned only ${h.baselineMentions} time(s) across the prior ${BASELINE_WINDOW_DAYS} days`
    return `[${i + 1}] "${h.term}" — mentioned ${h.recentMentions} time(s) by ${h.recentSourceCount} independent sources in the last ${RECENT_WINDOW_DAYS} days, ${history}.\nArticles: ${h.articles.map(a => a.title).join(' | ')}`
  }).join('\n\n')

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
