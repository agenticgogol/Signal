import { createServiceClient } from '@/lib/supabase'
import {
  runOrchestratorAgent,
  runWriterAgent,
  runCriticAgent,
  runHumanizerAgent,
  runClaimVerifierAgent,
  runEvaluatorAgent,
  runAudienceSimAgent,
  runFinalPolishAgent,
  type SourceArticle,
} from '@/lib/agents'
import type { VoiceFingerprint } from '@/lib/voice'

// Overnight Drafts Inbox — opt-in (user_profiles.drafts_inbox_enabled),
// button-free, runs once a day per user via a scheduled job. Picks whatever
// the user engaged with most in the last week and writes ONE full draft
// through the same evidence-grounded pipeline Create uses — capped at fewer
// revision loops than the interactive flow since this runs unattended and
// nobody is present to review a citation_warning mid-stream. Never
// publishes; always lands in draft_inbox_items as 'pending'.

const INBOX_MAX_LOOPS = 2
const ENGAGEMENT_WEIGHT: Record<string, number> = { like: 3, pin: 3, save: 2, open: 1 }

async function pickEngagementSource(userId: string) {
  const db = createServiceClient()
  const since = new Date()
  since.setUTCDate(since.getUTCDate() - 7)

  const { data: events } = await db
    .from('user_article_events')
    .select('event_type, article_id, articles(id, title, url, why_it_matters, tldr_bullets, topic_tags)')
    .eq('user_id', userId)
    .in('event_type', ['like', 'pin', 'save', 'open'])
    .gte('created_at', since.toISOString())
    .limit(300)

  const scores = new Map<string, { score: number; article: Record<string, unknown> }>()
  for (const row of events ?? []) {
    const article = Array.isArray(row.articles) ? row.articles[0] : row.articles as Record<string, unknown> | null
    if (!article?.id) continue
    const weight = ENGAGEMENT_WEIGHT[row.event_type] ?? 0
    const existing = scores.get(String(article.id))
    scores.set(String(article.id), { score: (existing?.score ?? 0) + weight, article })
  }

  const ranked = Array.from(scores.values()).sort((a, b) => b.score - a.score)
  return ranked[0]?.article ?? null
}

export interface DraftInboxResult {
  status: 'created' | 'skipped_no_engagement' | 'skipped_already_today'
  itemId?: string
}

export async function generateDailyDraftForUser(userId: string): Promise<DraftInboxResult> {
  const db = createServiceClient()

  const article = await pickEngagementSource(userId)
  if (!article) return { status: 'skipped_no_engagement' }

  const [{ data: profile }] = await Promise.all([
    db.from('user_profiles').select('voice_fingerprint, onboarding_target_audience, drafts_inbox_format').eq('id', userId).maybeSingle(),
  ])
  const voiceFingerprint = (profile?.voice_fingerprint as VoiceFingerprint | null) ?? null

  const title = String(article.title || '')
  const whyItMatters = String(article.why_it_matters || '')
  const tldrBullets = Array.isArray(article.tldr_bullets) ? article.tldr_bullets as string[] : []
  const sourceUrl = String(article.url || '')

  const brief = `Write a post reacting to and building on this article, from the practitioner's own perspective: "${title}". ${whyItMatters}`
  const format = String(profile?.drafts_inbox_format || 'linkedin')
  const sources: SourceArticle[] = [{
    title,
    url: sourceUrl,
    domain: (() => { try { return new URL(sourceUrl).hostname.replace(/^www\./, '') } catch { return '' } })(),
    evidence: [whyItMatters, ...tldrBullets].filter(Boolean).join('\n'),
  }]

  const orchestratorBrief = await runOrchestratorAgent(userId, brief, format, '', sources)

  let currentDraft = ''
  let currentCritique = ''
  let currentHumanized = ''
  let writerInstructions = ''
  let claimReport = ''

  for (let loop = 1; loop <= INBOX_MAX_LOOPS; loop++) {
    const writerContext = loop > 1
      ? `${orchestratorBrief}\n\n---\nPREVIOUS DRAFT FEEDBACK (loop ${loop - 1}):\n${writerInstructions}\nRewrite the content addressing ALL of these issues.`
      : orchestratorBrief

    currentDraft = await runWriterAgent(userId, writerContext, format, sources, voiceFingerprint)

    const verifierResult = await runClaimVerifierAgent(userId, currentDraft, sources, brief)
    claimReport = verifierResult.report

    const criticInput = `${orchestratorBrief}\n\nCLAIM VERIFICATION REPORT:\n${claimReport}`
    currentCritique = await runCriticAgent(userId, currentDraft, criticInput, format, sources)

    currentHumanized = await runHumanizerAgent(userId, currentDraft, currentCritique, format, sources, voiceFingerprint)

    const evalResult = await runEvaluatorAgent(userId, currentHumanized, format, brief, loop, claimReport, true)
    const citationsClean = verifierResult.hallucinatedCount === 0 && verifierResult.unsupportedCount === 0

    if ((evalResult.pass && citationsClean) || loop === INBOX_MAX_LOOPS) break
    writerInstructions = evalResult.writerInstructions
  }

  const audienceFeedback = await runAudienceSimAgent(userId, currentHumanized, format)
  const final = await runFinalPolishAgent(userId, currentHumanized, audienceFeedback, format, sources, voiceFingerprint)

  const { data: inserted, error } = await db
    .from('draft_inbox_items')
    .insert({
      user_id: userId,
      topic: title.slice(0, 200),
      format,
      brief,
      final_content: final,
      source_title: title,
      source_url: sourceUrl,
    })
    .select('id')
    .single()

  // A unique (user_id, day) index means a second attempt the same day
  // conflicts here rather than double-drafting — that's the expected,
  // desired outcome, not a bug.
  if (error) {
    if (error.code === '23505') return { status: 'skipped_already_today' }
    throw error
  }

  return { status: 'created', itemId: inserted?.id }
}

export async function runDailyDraftsInboxJob(): Promise<{ processed: number; created: number; errors: number }> {
  const db = createServiceClient()
  const { data: users, error } = await db
    .from('user_profiles')
    .select('id')
    .eq('drafts_inbox_enabled', true)

  if (error) throw error

  let created = 0
  let errors = 0
  for (const user of users ?? []) {
    try {
      const result = await generateDailyDraftForUser(String(user.id))
      if (result.status === 'created') created++
    } catch (err) {
      errors++
      console.error(`Drafts Inbox failed for user ${user.id}:`, err)
    }
  }

  return { processed: (users ?? []).length, created, errors }
}
