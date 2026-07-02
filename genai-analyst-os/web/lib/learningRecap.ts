import { createServiceClient } from '@/lib/supabase'

// Turns data that already exists (article/knowledge engagement events, AI
// Tutor lookups, Ask Signal questions) into a visible artifact on Today —
// "here's what you've actually been focused on" — with a direct path into
// Generate, so reading turns into a post idea without the user having to
// notice the pattern themselves. Pure aggregation, no LLM call: this is a
// grouping/counting problem, not a generative one.

const RECAP_WINDOW_DAYS = 7
const REVISIT_WINDOW_DAYS = 21
const REVISIT_STALE_AFTER_DAYS = 7

export interface RecapConcept {
  term: string
  count: number
}

export interface RevisitCandidate {
  term: string
  lastLookedUpAt: string
  lookupCount: number
}

export interface LearningRecap {
  topConcepts: RecapConcept[]
  revisitCandidates: RevisitCandidate[]
  itemsEngaged: number
  questionsAsked: number
}

export async function getLearningRecap(userId: string): Promise<LearningRecap> {
  const db = createServiceClient()
  const since = new Date()
  since.setUTCDate(since.getUTCDate() - RECAP_WINDOW_DAYS)
  const revisitSince = new Date()
  revisitSince.setUTCDate(revisitSince.getUTCDate() - REVISIT_WINDOW_DAYS)

  const [{ data: articleEvents }, { data: knowledgeEvents }, { data: chatEvents }, { data: lookups }] = await Promise.all([
    db.from('user_article_events')
      .select('event_type, articles(concept_terms)')
      .eq('user_id', userId)
      .in('event_type', ['open', 'pin', 'like', 'save'])
      .gte('created_at', since.toISOString())
      .limit(300),
    db.from('user_knowledge_events')
      .select('event_type, knowledge_items(concept_terms)')
      .eq('user_id', userId)
      .eq('event_type', 'open_item')
      .gte('created_at', since.toISOString())
      .limit(300),
    db.from('user_chat_events')
      .select('id')
      .eq('user_id', userId)
      .gte('created_at', since.toISOString())
      .limit(300),
    db.from('user_concept_lookups')
      .select('term, created_at')
      .eq('user_id', userId)
      .gte('created_at', revisitSince.toISOString())
      .order('created_at', { ascending: false })
      .limit(200),
  ])

  const weight: Record<string, number> = { open: 1, save: 1, pin: 2, like: 2, open_item: 1 }
  const scores = new Map<string, number>()

  for (const row of articleEvents ?? []) {
    const article = Array.isArray(row.articles) ? row.articles[0] : row.articles as Record<string, unknown> | null
    const terms: string[] = Array.isArray(article?.concept_terms) ? article.concept_terms as string[] : []
    for (const term of terms) scores.set(term, (scores.get(term) ?? 0) + (weight[row.event_type] ?? 1))
  }
  for (const row of knowledgeEvents ?? []) {
    const item = Array.isArray(row.knowledge_items) ? row.knowledge_items[0] : row.knowledge_items as Record<string, unknown> | null
    const terms: string[] = Array.isArray(item?.concept_terms) ? item.concept_terms as string[] : []
    for (const term of terms) scores.set(term, (scores.get(term) ?? 0) + 1)
  }

  const topConcepts: RecapConcept[] = Array.from(scores.entries())
    .map(([term, count]) => ({ term, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  // Revisit candidates: looked up via AI Tutor more than once (a sign it
  // didn't stick the first time), or looked up a while ago with no repeat
  // reinforcement since — either way, a light "still fuzzy on this?" nudge.
  const lookupsByTerm = new Map<string, { count: number; lastLookedUpAt: string }>()
  for (const row of lookups ?? []) {
    const term = String(row.term)
    const existing = lookupsByTerm.get(term)
    if (existing) existing.count += 1
    else lookupsByTerm.set(term, { count: 1, lastLookedUpAt: String(row.created_at) })
  }
  const now = Date.now()
  const revisitCandidates: RevisitCandidate[] = Array.from(lookupsByTerm.entries())
    .map(([term, { count, lastLookedUpAt }]) => ({ term, lookupCount: count, lastLookedUpAt }))
    .filter(c => c.lookupCount > 1 || (now - new Date(c.lastLookedUpAt).getTime()) / 86400000 >= REVISIT_STALE_AFTER_DAYS)
    .sort((a, b) => b.lookupCount - a.lookupCount)
    .slice(0, 3)

  return {
    topConcepts,
    revisitCandidates,
    itemsEngaged: (articleEvents ?? []).length + (knowledgeEvents ?? []).length,
    questionsAsked: (chatEvents ?? []).length,
  }
}
