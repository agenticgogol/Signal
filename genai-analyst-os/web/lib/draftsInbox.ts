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
  runRepublishAgent,
  type SourceArticle,
} from '@/lib/agents'
import type { VoiceFingerprint } from '@/lib/voice'

// Drafts Inbox — opt-in (user_profiles.drafts_inbox_enabled) autonomous
// daily draft, plus a manual "Generate today's content" button on the Today
// page. Both share the same evidence-grounded pipeline; the manual path can
// also add one cheap Republish-Pack-adapted variant for a paired platform,
// since a deliberate user click is a different trust/cost level than the
// unattended job (same reasoning Create and Republish Pack already use —
// neither of those are capped either).

const INBOX_MAX_LOOPS = 2
const ENGAGEMENT_WEIGHT: Record<string, number> = { like: 3, pin: 3, save: 2, open: 1 }

// Which second platform is worth adapting the same idea into — paired by
// how naturally the content translates (long-form <-> short-form pairs),
// not just picking a random second format.
const PAIRED_FORMAT: Record<string, string> = {
  linkedin: 'thread',
  substack: 'linkedin',
  thread: 'linkedin',
  blog: 'linkedin',
  youtube_long: 'thread',
  youtube_short: 'thread',
}

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

// The full evidence-grounded, citation-verified pipeline (Orchestrator ->
// Writer/Verifier/Critic/Humanizer loop -> Audience Sim -> Final Polish),
// capped at fewer revision loops than the interactive Create flow since
// nobody is present to review a citation_warning mid-stream.
async function runEvidenceGroundedPipeline(
  userId: string,
  brief: string,
  format: string,
  sources: SourceArticle[],
  voiceFingerprint: VoiceFingerprint | null,
): Promise<string> {
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
  return runFinalPolishAgent(userId, currentHumanized, audienceFeedback, format, sources, voiceFingerprint)
}

function buildSourcesFromArticle(article: Record<string, unknown>): { brief: string; title: string; sourceUrl: string; sources: SourceArticle[] } {
  const title = String(article.title || '')
  const whyItMatters = String(article.why_it_matters || '')
  const tldrBullets = Array.isArray(article.tldr_bullets) ? article.tldr_bullets as string[] : []
  const sourceUrl = String(article.url || '')
  const brief = `Write a post reacting to and building on this article, from the practitioner's own perspective: "${title}". ${whyItMatters}`
  const sources: SourceArticle[] = [{
    title,
    url: sourceUrl,
    domain: (() => { try { return new URL(sourceUrl).hostname.replace(/^www\./, '') } catch { return '' } })(),
    evidence: [whyItMatters, ...tldrBullets].filter(Boolean).join('\n'),
  }]
  return { brief, title, sourceUrl, sources }
}

export interface DraftInboxResult {
  status: 'created' | 'skipped_no_engagement' | 'skipped_already_today'
  itemId?: string
}

export async function generateDailyDraftForUser(userId: string): Promise<DraftInboxResult> {
  const db = createServiceClient()

  const article = await pickEngagementSource(userId)
  if (!article) return { status: 'skipped_no_engagement' }

  const { data: profile } = await db.from('user_profiles').select('voice_fingerprint, drafts_inbox_format').eq('id', userId).maybeSingle()
  const voiceFingerprint = (profile?.voice_fingerprint as VoiceFingerprint | null) ?? null
  const format = String(profile?.drafts_inbox_format || 'linkedin')

  const { brief, title, sourceUrl, sources } = buildSourcesFromArticle(article)
  const final = await runEvidenceGroundedPipeline(userId, brief, format, sources, voiceFingerprint)

  const { data: inserted, error } = await db
    .from('draft_inbox_items')
    .insert({ user_id: userId, topic: title.slice(0, 200), format, brief, final_content: final, source_title: title, source_url: sourceUrl })
    .select('id')
    .single()

  // A unique (user_id, day, format) index means a second attempt for the
  // same format the same day conflicts here rather than double-drafting —
  // that's the expected, desired outcome, not a bug.
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

export interface SmartDraftResult {
  format: string
  itemId: string
  isNew: boolean
}

// Button-triggered from the Today page — same evidence-grounded pipeline as
// the autonomous job, run on demand rather than waiting for the daily
// cron, plus one cheap Republish-Pack-adapted variant for a naturally
// paired platform. "Use logic" per the request: rather than generating two
// entirely separate ideas (a second full pipeline run, roughly double the
// cost for a plausibly worse ROI), the second piece reuses the same
// already-verified idea and evidence, adapted for a different platform's
// structure — the same "same idea, several formats" pattern Republish Pack
// already uses in Create.
export async function generateSmartDraftsForUser(userId: string): Promise<{ drafts: SmartDraftResult[]; skipped?: string }> {
  const db = createServiceClient()

  const article = await pickEngagementSource(userId)
  if (!article) return { drafts: [], skipped: 'No recent engagement (opens/likes/pins) to base a draft on yet — read a few things first.' }

  const { data: profile } = await db.from('user_profiles').select('voice_fingerprint, drafts_inbox_format').eq('id', userId).maybeSingle()
  const voiceFingerprint = (profile?.voice_fingerprint as VoiceFingerprint | null) ?? null
  const primaryFormat = String(profile?.drafts_inbox_format || 'linkedin')
  const secondaryFormat = PAIRED_FORMAT[primaryFormat] ?? 'thread'

  const { brief, title, sourceUrl, sources } = buildSourcesFromArticle(article)
  const results: SmartDraftResult[] = []

  const primaryContent = await runEvidenceGroundedPipeline(userId, brief, primaryFormat, sources, voiceFingerprint)
  const primaryInsert = await db
    .from('draft_inbox_items')
    .insert({ user_id: userId, topic: title.slice(0, 200), format: primaryFormat, brief, final_content: primaryContent, source_title: title, source_url: sourceUrl })
    .select('id')
    .single()
  if (primaryInsert.error && primaryInsert.error.code !== '23505') throw primaryInsert.error
  if (!primaryInsert.error) results.push({ format: primaryFormat, itemId: primaryInsert.data.id, isNew: true })

  if (secondaryFormat !== primaryFormat) {
    const secondaryContent = await runRepublishAgent(userId, primaryContent, primaryFormat, secondaryFormat, sources, voiceFingerprint)
    const secondaryInsert = await db
      .from('draft_inbox_items')
      .insert({ user_id: userId, topic: title.slice(0, 200), format: secondaryFormat, brief, final_content: secondaryContent, source_title: title, source_url: sourceUrl })
      .select('id')
      .single()
    if (secondaryInsert.error && secondaryInsert.error.code !== '23505') throw secondaryInsert.error
    if (!secondaryInsert.error) results.push({ format: secondaryFormat, itemId: secondaryInsert.data.id, isNew: true })
  }

  if (results.length === 0) {
    return { drafts: [], skipped: 'Today\'s drafts for these formats already exist — check your pending drafts below.' }
  }

  return { drafts: results }
}
