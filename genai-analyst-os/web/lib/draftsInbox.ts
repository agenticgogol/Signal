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
import { pickWeightedCandidate, pickWeightedCandidates, type ContentCandidate } from '@/lib/contentSignals'
import { generateJsonForUser } from '@/lib/llmClient'
import type { VoiceFingerprint } from '@/lib/voice'

// Drafts Inbox — opt-in (user_profiles.drafts_inbox_enabled) autonomous
// daily draft, plus a manual "Generate today's content" button on the Today
// page. Both share the same evidence-grounded pipeline; the manual path can
// also add one cheap Republish-Pack-adapted variant for a paired platform,
// since a deliberate user click is a different trust/cost level than the
// unattended job (same reasoning Create and Republish Pack already use —
// neither of those are capped either).

const INBOX_MAX_LOOPS = 2

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

function buildSourcesFromCandidate(candidate: ContentCandidate): { brief: string; title: string; sourceUrl: string; sources: SourceArticle[] } {
  const { title, whyItMatters, url } = candidate
  const sourceUrl = url || ''
  const kind = candidate.itemType === 'feed' ? 'article' : candidate.itemType === 'news' ? 'news story' : 'saved resource'
  const brief = `Write a post reacting to and building on this ${kind}, from the practitioner's own perspective: "${title}". ${whyItMatters}`
  const sources: SourceArticle[] = [{
    title,
    url: sourceUrl,
    domain: (() => { try { return new URL(sourceUrl).hostname.replace(/^www\./, '') } catch { return '' } })(),
    evidence: whyItMatters,
  }]
  return { brief, title, sourceUrl, sources }
}

function buildSourcesFromCustomTopic(topic: string): { brief: string; title: string; sourceUrl: string; sources: SourceArticle[] } {
  return {
    brief: `Write a post about: ${topic}`,
    title: topic.slice(0, 200),
    sourceUrl: '',
    sources: [], // no external sources — this is the "personal opinion/announcement" path the agents already support
  }
}

export interface DraftInboxResult {
  status: 'created' | 'skipped_no_engagement' | 'skipped_already_today'
  itemId?: string
}

export async function generateDailyDraftForUser(userId: string): Promise<DraftInboxResult> {
  const db = createServiceClient()

  const candidate = await pickWeightedCandidate(userId)
  if (!candidate) return { status: 'skipped_no_engagement' }

  const { data: profile } = await db.from('user_profiles').select('voice_fingerprint, drafts_inbox_format').eq('id', userId).maybeSingle()
  const voiceFingerprint = (profile?.voice_fingerprint as VoiceFingerprint | null) ?? null
  const format = String(profile?.drafts_inbox_format || 'linkedin')

  const { brief, title, sourceUrl, sources } = buildSourcesFromCandidate(candidate)
  const final = await runEvidenceGroundedPipeline(userId, brief, format, sources, voiceFingerprint)

  const { data: inserted, error } = await db
    .from('draft_inbox_items')
    .insert({ user_id: userId, topic: title.slice(0, 200), format, brief, final_content: final, source_title: title, source_url: sourceUrl, source: 'auto' })
    .select('id')
    .single()

  // A unique (user_id, day, format) index — scoped to source='auto' rows
  // only — means a second autonomous attempt for the same format the same
  // day conflicts here rather than double-drafting. Manual generations are
  // not capped this way.
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
  topic: string
}

// Button-triggered from the Today page — same evidence-grounded pipeline as
// the autonomous job, run on demand rather than waiting for the daily cron.
//
// Topic selection: a user-typed custom topic is a hard override (skips the
// weighted picker entirely, always exactly one idea — you typed the one
// thing you want). Otherwise pickWeightedCandidates blends five signals —
// explicit engagement, recent reading behavior, relevance-gated trending
// news, and emerging/trending topics, now including News alongside Feed and
// Reading List — each weighted per the user's Settings, with topic-interest
// alignment applied as a multiplier. ideaCount controls how many of the
// top-ranked candidates to generate for — diversity, not just depth: 2-3
// different ideas instead of one, each getting its own full pipeline run.
//
// Platform selection: for EACH idea, the first chosen format runs the full
// pipeline and every additional format is a cheap Republish-adapted variant
// of that same idea — same idea, several platforms, not a second full
// generation per platform. With no explicit format choice (the autonomous
// daily job), falls back to the user's configured default format plus one
// naturally paired platform.
export async function generateSmartDraftsForUser(
  userId: string,
  customTopic?: string,
  formats?: string[],
  ideaCount = 1,
): Promise<{ drafts: SmartDraftResult[]; skipped?: string }> {
  const db = createServiceClient()

  const trimmedTopic = customTopic?.trim()
  const candidates = trimmedTopic ? [] : await pickWeightedCandidates(userId, Math.max(1, Math.min(3, ideaCount)))
  if (!trimmedTopic && candidates.length === 0) {
    return { drafts: [], skipped: 'Nothing to go on yet — read a few things, or type a custom topic below.' }
  }

  const { data: profile } = await db.from('user_profiles').select('voice_fingerprint, drafts_inbox_format').eq('id', userId).maybeSingle()
  const voiceFingerprint = (profile?.voice_fingerprint as VoiceFingerprint | null) ?? null

  const chosenFormats = formats && formats.length > 0 ? Array.from(new Set(formats)) : null
  const primaryFormat = chosenFormats ? chosenFormats[0] : String(profile?.drafts_inbox_format || 'linkedin')
  const remainingFormats = chosenFormats ? chosenFormats.slice(1) : [PAIRED_FORMAT[primaryFormat] ?? 'thread']

  const ideas = trimmedTopic ? [buildSourcesFromCustomTopic(trimmedTopic)] : candidates.map(buildSourcesFromCandidate)
  const results: SmartDraftResult[] = []

  for (const { brief, title, sourceUrl, sources } of ideas) {
    const primaryContent = await runEvidenceGroundedPipeline(userId, brief, primaryFormat, sources, voiceFingerprint)
    const primaryInsert = await db
      .from('draft_inbox_items')
      .insert({ user_id: userId, topic: title.slice(0, 200), format: primaryFormat, brief, final_content: primaryContent, source_title: title, source_url: sourceUrl, source: 'manual' })
      .select('id')
      .single()
    if (primaryInsert.error) throw primaryInsert.error
    results.push({ format: primaryFormat, itemId: primaryInsert.data.id, isNew: true, topic: title })

    for (const extraFormat of remainingFormats) {
      if (extraFormat === primaryFormat) continue
      const extraContent = await runRepublishAgent(userId, primaryContent, primaryFormat, extraFormat, sources, voiceFingerprint)
      const extraInsert = await db
        .from('draft_inbox_items')
        .insert({ user_id: userId, topic: title.slice(0, 200), format: extraFormat, brief, final_content: extraContent, source_title: title, source_url: sourceUrl, source: 'manual' })
        .select('id')
        .single()
      if (extraInsert.error) throw extraInsert.error
      results.push({ format: extraFormat, itemId: extraInsert.data.id, isNew: true, topic: title })
    }
  }

  return { drafts: results }
}

// ── Feedback -> regenerate now, remember for later ─────────────────────────
// Regenerating targets the specific feedback immediately (like Create's
// "give feedback & regenerate"); separately, the feedback text is logged and
// distilled into durable voice_fingerprint traits so future drafts — not
// just this one — improve. Distillation merges into voice_principles rather
// than overwriting the fingerprint wholesale, and is capped/deduped so it
// can't grow into an unbounded or self-contradicting pile of one-off notes.

const MAX_VOICE_PRINCIPLES = 8
const FEEDBACK_HISTORY_FOR_DISTILLATION = 10

export async function regenerateDraftWithFeedback(userId: string, itemId: string, feedback: string): Promise<{ finalContent: string }> {
  const db = createServiceClient()

  const { data: draft, error: draftError } = await db
    .from('draft_inbox_items')
    .select('id, brief, format, final_content')
    .eq('user_id', userId)
    .eq('id', itemId)
    .single()
  if (draftError) throw draftError

  const { data: profile } = await db.from('user_profiles').select('voice_fingerprint').eq('id', userId).maybeSingle()
  const voiceFingerprint = (profile?.voice_fingerprint as VoiceFingerprint | null) ?? null

  const writerContext = `${draft.brief}\n\n---\nPREVIOUS DRAFT (the human reviewed this and asked for changes):\n${draft.final_content}\n\nHUMAN FEEDBACK — you MUST address this while keeping what already worked:\n${feedback}\n\nRewrite the content now, targeting this feedback specifically.`
  const revisedDraft = await runWriterAgent(userId, writerContext, draft.format, [], voiceFingerprint)
  const humanized = await runHumanizerAgent(userId, revisedDraft, `Feedback to address: ${feedback}`, draft.format, [], voiceFingerprint)

  const { error: updateError } = await db
    .from('draft_inbox_items')
    .update({ final_content: humanized })
    .eq('id', itemId)
  if (updateError) throw updateError

  await recordFeedbackAndDistill(userId, itemId, feedback)

  return { finalContent: humanized }
}

async function recordFeedbackAndDistill(userId: string, draftItemId: string, feedbackText: string): Promise<void> {
  const db = createServiceClient()
  await db.from('voice_feedback_events').insert({ user_id: userId, draft_item_id: draftItemId, feedback_text: feedbackText })

  const { data: recentFeedback } = await db
    .from('voice_feedback_events')
    .select('feedback_text')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(FEEDBACK_HISTORY_FOR_DISTILLATION)

  const feedbackList = (recentFeedback ?? []).map(r => r.feedback_text).filter(Boolean)
  if (feedbackList.length === 0) return

  const { data: profile } = await db.from('user_profiles').select('voice_fingerprint').eq('id', userId).maybeSingle()
  const fingerprint = profile?.voice_fingerprint as VoiceFingerprint | null
  const existingPrinciples = fingerprint?.voice_principles ?? []

  try {
    const distilled = await generateJsonForUser<{ principles: string[] }>({
      userId,
      agent: 'voice_distillation',
      maxTokens: 500,
      system: 'You maintain a short list of durable writing-style rules for a content creator, based on their recent edit feedback. Merge new feedback with existing rules — keep rules that still apply, drop ones contradicted by newer feedback, add genuinely new ones. Keep each rule short and actionable (e.g. "avoid emoji", "open with a contrarian claim, not a question"). Return at most 8 rules, most important first.',
      prompt: `Existing voice rules:\n${existingPrinciples.join('\n') || '(none yet)'}\n\nRecent edit feedback (most recent first):\n${feedbackList.map((f, i) => `${i + 1}. ${f}`).join('\n')}\n\nReturn the merged, deduplicated rule list.`,
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: { principles: { type: 'array', items: { type: 'string' } } },
        required: ['principles'],
      },
    })

    const mergedPrinciples = distilled.principles.slice(0, MAX_VOICE_PRINCIPLES)
    const updatedFingerprint: Partial<VoiceFingerprint> = { ...(fingerprint ?? {}), voice_principles: mergedPrinciples }
    await db.from('user_profiles').update({ voice_fingerprint: updatedFingerprint }).eq('id', userId)
  } catch {
    // Distillation is a nice-to-have on top of the immediate regeneration —
    // never let it fail the user-facing feedback/regenerate action.
  }
}
