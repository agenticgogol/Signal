import { createServiceClient } from '@/lib/supabase'
import { generateJsonForUser } from '@/lib/llmClient'
import { overlapScore } from '@/lib/knowledge'

// AI Tutor — two-tier design so the expensive part is shared:
//   - The general explanation ("what is RAG") is the same for every user,
//     so it's generated once and cached in concept_terms, same idea as
//     shared article enrichment (nothing personal in it to leak).
//   - Grounding ("here's where this showed up in YOUR Feed/Library") is
//     genuinely per-user, computed fresh each lookup from existing
//     word-overlap retrieval (same helper Ask Signal's recall uses) —
//     no LLM call needed for this half, just a ranked search.

const EXPLANATION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    what_it_is: { type: 'string' },
    why_it_matters: { type: 'string' },
    how_it_works: { type: 'string' },
    code_snippet: { type: ['string', 'null'] },
    use_cases: { type: 'array', items: { type: 'string' } },
  },
  required: ['what_it_is', 'why_it_matters', 'how_it_works', 'code_snippet', 'use_cases'],
} as const

export interface ConceptExplanation {
  term: string
  whatItIs: string
  whyItMatters: string
  howItWorks: string
  codeSnippet: string | null
  useCases: string[]
}

export interface GroundedMatch {
  type: 'feed' | 'knowledge'
  title: string
  url: string
}

function normalizeTerm(term: string): string {
  return term.trim().toLowerCase().replace(/\s+/g, ' ')
}

async function getCachedExplanation(term: string): Promise<ConceptExplanation | null> {
  const db = createServiceClient()
  const { data } = await db.from('concept_terms').select('*').eq('term', term).maybeSingle()
  if (!data) return null
  return {
    term: data.term,
    whatItIs: data.what_it_is || '',
    whyItMatters: data.why_it_matters || '',
    howItWorks: data.how_it_works || '',
    codeSnippet: data.code_snippet ?? null,
    useCases: Array.isArray(data.use_cases) ? data.use_cases : [],
  }
}

async function generateExplanation(userId: string, originalTerm: string, normalizedTerm: string): Promise<ConceptExplanation> {
  const result = await generateJsonForUser<{
    what_it_is: string
    why_it_matters: string
    how_it_works: string
    code_snippet: string | null
    use_cases: string[]
  }>({
    userId,
    agent: 'concept_tutor_explain',
    system: 'You are an AI tutor explaining a technical AI/ML/GenAI concept to a working practitioner who is unfamiliar with this specific term. Be precise and concrete, not generic. Only include a code_snippet if the concept is genuinely code-expressible (e.g. an API pattern, an algorithm) — use null for concepts like "AI safety" or "model card" that aren\'t.',
    prompt: `Explain the concept/term: "${originalTerm}"\n\nReturn:\n- what_it_is: a clear 1-2 sentence definition\n- why_it_matters: practical significance for an AI practitioner, 1-2 sentences\n- how_it_works: the technical mechanics, 3-5 sentences\n- code_snippet: a short illustrative example (or null if not code-expressible)\n- use_cases: 2-4 concrete real-world examples of where this shows up`,
    schema: EXPLANATION_SCHEMA,
    maxTokens: 1500,
  })

  const explanation: ConceptExplanation = {
    term: normalizedTerm,
    whatItIs: result.what_it_is || '',
    whyItMatters: result.why_it_matters || '',
    howItWorks: result.how_it_works || '',
    codeSnippet: result.code_snippet || null,
    useCases: Array.isArray(result.use_cases) ? result.use_cases.slice(0, 4) : [],
  }

  const db = createServiceClient()
  await db.from('concept_terms').upsert({
    term: normalizedTerm,
    what_it_is: explanation.whatItIs,
    why_it_matters: explanation.whyItMatters,
    how_it_works: explanation.howItWorks,
    code_snippet: explanation.codeSnippet,
    use_cases: explanation.useCases,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'term' })

  return explanation
}

async function findGroundedMatches(userId: string, term: string): Promise<GroundedMatch[]> {
  const db = createServiceClient()
  const since = new Date()
  since.setUTCDate(since.getUTCDate() - 60)

  const [{ data: knowledgeItems }, { data: feedItems }] = await Promise.all([
    db.from('knowledge_items')
      .select('id, title, source_url, summary, why_it_matters, cleaned_text, concept_terms')
      .eq('user_id', userId)
      .eq('status', 'ready')
      .is('archived_at', null)
      .order('processed_at', { ascending: false })
      .limit(150),
    db.from('user_feed_items')
      .select('articles(title, url, why_it_matters, tldr_bullets, concept_terms)')
      .eq('user_id', userId)
      .gte('feed_date', since.toISOString().slice(0, 10))
      .limit(150),
  ])

  const matches: (GroundedMatch & { score: number })[] = []

  for (const item of knowledgeItems ?? []) {
    const terms: string[] = Array.isArray(item.concept_terms) ? item.concept_terms : []
    const directHit = terms.some((t: string) => normalizeTerm(t) === term)
    const text = `${item.title || ''}\n${item.summary || ''}\n${item.why_it_matters || ''}\n${String(item.cleaned_text || '').slice(0, 2000)}`
    const score = directHit ? 100 : overlapScore(term, text)
    if (score > 0) matches.push({ type: 'knowledge', title: String(item.title || 'Untitled'), url: String(item.source_url || ''), score })
  }

  for (const row of feedItems ?? []) {
    const article = Array.isArray(row.articles) ? row.articles[0] : row.articles as Record<string, unknown> | null
    if (!article) continue
    const terms: string[] = Array.isArray(article.concept_terms) ? article.concept_terms as string[] : []
    const directHit = terms.some((t: string) => normalizeTerm(t) === term)
    const bullets = Array.isArray(article.tldr_bullets) ? article.tldr_bullets.join(' ') : ''
    const text = `${article.title || ''}\n${article.why_it_matters || ''}\n${bullets}`
    const score = directHit ? 100 : overlapScore(term, text as string)
    if (score > 0) matches.push({ type: 'feed', title: String(article.title || 'Untitled'), url: String(article.url || ''), score })
  }

  return matches.sort((a, b) => b.score - a.score).slice(0, 3).map(({ type, title, url }) => ({ type, title, url }))
}

export async function explainConcept(userId: string, rawTerm: string, sourceRef?: { articleId?: string; knowledgeItemId?: string }): Promise<{
  explanation: ConceptExplanation
  grounding: GroundedMatch[]
}> {
  const normalizedTerm = normalizeTerm(rawTerm)
  if (!normalizedTerm) throw new Error('A concept or term is required.')

  const [cached, grounding] = await Promise.all([
    getCachedExplanation(normalizedTerm),
    findGroundedMatches(userId, normalizedTerm),
  ])

  const explanation = cached ?? await generateExplanation(userId, rawTerm, normalizedTerm)

  const db = createServiceClient()
  await db.from('user_concept_lookups').insert({
    user_id: userId,
    term: normalizedTerm,
    grounded_titles: grounding.map(g => g.title),
    source_article_id: sourceRef?.articleId ?? null,
    source_knowledge_item_id: sourceRef?.knowledgeItemId ?? null,
  })

  return { explanation, grounding }
}

export async function getConceptLookupHistory(userId: string, limit = 20) {
  const db = createServiceClient()
  const { data, error } = await db
    .from('user_concept_lookups')
    .select('id, term, grounded_titles, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data ?? []
}
