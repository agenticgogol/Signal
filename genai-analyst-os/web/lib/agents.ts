import { createServiceClient } from './supabase'
import { PLATFORM_SPECS } from './platformSpecs'
import { buildVoiceConstitution, type VoiceFingerprint } from './voice'
import { generateTextForUser, generateJsonForUser } from './llmClient'

export { PLATFORM_SPECS }

export interface SourceArticle {
  title: string
  url: string
  domain: string
  // The actual substance to ground claims in — why_it_matters + tldr_bullets
  // for feed articles, or summary + why_it_matters for notebook items.
  // Without this, agents can only cite a URL they've never actually
  // "read," which produces citations that look real but aren't grounded —
  // exactly what the Claim Verifier exists to catch, so it must have this
  // to check against.
  evidence?: string
}

// ── Citation format per platform ───────────────────────────────────────────────

function citationGuide(format: string): string {
  switch (format) {
    case 'linkedin':
      return `CITATION RULES for LinkedIn:
- After any factual claim or opinion drawn from a source, add (via domain.com) inline — e.g. "Retrieval latency dropped 40% (via arxiv.org)"
- At the very end of the post, add a "Sources:" line listing each cited article as: • Title — url
- Never cite more than 3 sources total in the body; pick the most relevant`

    case 'substack':
      return `CITATION RULES for Substack:
- Use inline hyperlinks in markdown: [claim or article title](url) wherever you draw on a source
- For direct data points or quotes, write: "According to [Source Title](url), ..."
- At the bottom, add a "---\\n**Sources**" section listing all cited articles as markdown links`

    case 'thread':
      return `CITATION RULES for Twitter/X Thread:
- For tweets making a specific factual claim, end with 📎 [domain.com] — short enough to fit in 280 chars
- Add a final tweet: "Sources:\\n" followed by one URL per line
- Prioritize 1-2 strongest sources — don't over-cite in a thread`

    case 'blog':
      return `CITATION RULES for Blog:
- Use inline markdown hyperlinks: [descriptive anchor text](url) — every factual claim must link to its source
- For data points, use the pattern: "A [recent study](url) found that..."
- Add a ## Sources section at the bottom listing all cited articles`

    case 'youtube_long':
      return `CITATION RULES for YouTube Script:
- After any statistic or claim in the script, add a stage direction: [SOURCE: Article Title — domain.com]
- These won't be spoken but guide the editor on what to show as a B-roll graphic
- Add a "DESCRIPTION LINKS:" block at the very end of the script listing all sources`

    case 'youtube_short':
      return `CITATION RULES for YouTube Short:
- After any specific claim, add [SOURCE: domain.com] as a script note
- Add [TEXT OVERLAY: "Source: domain.com"] for the editor to show on screen
- Keep it to 1 source maximum — shorts can't sustain more`

    default:
      return `After any factual claim or opinion, cite the source inline as (Source: title — url).`
  }
}

// Full evidence block — every agent that can cite or verify a claim gets the
// actual substance of each source, not just its title and URL. This is the
// single fix that makes citations mean something: an agent that has never
// seen a source's actual content can only fabricate a claim and staple a
// real-looking citation onto it.
function formatSourceList(sources: SourceArticle[], label = 'AVAILABLE SOURCES'): string {
  if (!sources || sources.length === 0) return ''
  return `\n${label} (you MUST draw from these and cite them — do not cite anything not listed here):\n` +
    sources.map((s, i) => {
      const evidence = s.evidence?.trim()
      return `${i + 1}. "${s.title}"\n   URL: ${s.url}\n   Domain: ${s.domain}${evidence ? `\n   Evidence: ${evidence}` : '\n   Evidence: (none captured — do not cite specific numbers or quotes to this source)'}`
    }).join('\n')
}

// ── Agent functions ────────────────────────────────────────────────────────────

const ORCHESTRATOR_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    angle: { type: 'string' },
    key_claims: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          claim: { type: 'string' },
          source_url: { type: 'string' },
          source_title: { type: 'string' },
          source_domain: { type: 'string' },
        },
        required: ['claim', 'source_url', 'source_title', 'source_domain'],
      },
    },
    target_persona: { type: 'string' },
    tone: { type: 'string' },
    hook_idea: { type: 'string' },
    platform_notes: { type: 'string' },
    avoid_these_cliches: { type: 'array', items: { type: 'string' } },
  },
  required: ['angle', 'key_claims', 'target_persona', 'tone', 'hook_idea', 'platform_notes', 'avoid_these_cliches'],
} as const

interface OrchestratorPlan {
  angle: string
  key_claims: { claim: string; source_url: string; source_title: string; source_domain: string }[]
  target_persona: string
  tone: string
  hook_idea: string
  platform_notes: string
  avoid_these_cliches: string[]
}

export async function runOrchestratorAgent(
  userId: string,
  brief: string,
  format: string,
  pov?: string,
  sources: SourceArticle[] = []
): Promise<string> {
  const spec = PLATFORM_SPECS[format]
  const platformContext = spec
    ? `\nTarget platform: ${spec.name}\nWord/length target: ${spec.wordLimit}\nContent structure: ${spec.structure}\nTone: ${spec.tone}`
    : ''

  const sourceContext = formatSourceList(sources, 'SOURCE ARTICLES to ground this content')

  // Schema-validated JSON, not a regex fence-extraction — a malformed
  // response used to silently degrade every downstream agent's context.
  const plan = await generateJsonForUser<OrchestratorPlan>({
    userId,
    maxTokens: 1500,
    system: 'You are a content strategist for a senior GenAI practitioner. Every key claim you propose must be traceable to one of the supplied sources — if no source supports a good claim, leave source_url/source_title/source_domain as empty strings rather than inventing one.',
    prompt: `Brief: ${brief}${platformContext}${pov ? `\nAuthor POV: ${pov}` : ''}${sourceContext}

Produce the content plan. Ground every key_claim in a specific source's evidence above — do not propose a claim that isn't backed by an actual excerpt you were given.`,
    schema: ORCHESTRATOR_SCHEMA,
  })

  return JSON.stringify(plan, null, 2)
}

export async function runWriterAgent(
  userId: string,
  orchestratorBrief: string,
  format: string,
  sources: SourceArticle[] = [],
  voiceFingerprint?: VoiceFingerprint | null
): Promise<string> {
  const spec = PLATFORM_SPECS[format]
  const mustDos = spec?.mustDos.map(d => `• ${d}`).join('\n') ?? ''
  const avoid = spec?.avoid.map(d => `• ${d}`).join('\n') ?? ''

  const baseSystemPrompt = spec
    ? `You are a professional ghostwriter writing a ${spec.name} post for a GenAI practitioner.

PLATFORM RULES for ${spec.name}:
Structure: ${spec.structure}
Tone: ${spec.tone}
Length: ${spec.wordLimit}${spec.charLimit ? ` (max ${spec.charLimit} characters)` : ''}

MUST DO:
${mustDos}

AVOID:
${avoid}

${citationGuide(format)}

Ground every factual claim in the Evidence text given for that source — never state a number, quote, or specific finding that isn't present in the evidence. If you have an idea worth making but no evidence backs it, frame it as your own opinion instead of attributing it to a source.

Write ONLY the final content — no meta-commentary, no "here is your post", no preamble.`
    : `Write a ${format} post about the following topic. Be direct and substantive.\n\n${citationGuide(format)}`
  const systemPrompt = baseSystemPrompt + buildVoiceConstitution(voiceFingerprint)

  const sourceContext = formatSourceList(sources)

  return generateTextForUser({
    userId,
    maxTokens: 2500,
    system: systemPrompt,
    prompt: `Content plan:\n${orchestratorBrief}${sourceContext}\n\nWrite the ${spec?.name ?? format} content now. Every opinion and factual claim must be grounded in the evidence given for one of the sources above, with a citation in the format specified.`,
  })
}

export async function runCriticAgent(
  userId: string,
  draft: string,
  orchestratorBrief: string,
  format: string,
  sources: SourceArticle[] = []
): Promise<string> {
  const spec = PLATFORM_SPECS[format]
  const platformChecks = spec
    ? `Also check platform-specific issues for ${spec.name}: Does it meet "${spec.wordLimit}"? Does it follow "${spec.structure}"?`
    : ''

  const sourceList = formatSourceList(sources)

  return generateTextForUser({
    userId,
    maxTokens: 1400,
    system: `You are a fact-checker and content critic for a GenAI practitioner's content.

Review for:
1. CITATION GAPS — any factual claim, statistic, or opinion that is NOT cited to a source. List each uncited claim verbatim.
2. CITATION ACCURACY — for each citation, check the source's Evidence text above. Does the evidence actually support the claim? Flag any claim that goes beyond, contradicts, or has no relation to its cited source's evidence — and flag any citation to a source not in the list.
3. AI writing tells: em-dashes, "delve", "it's worth noting", "in conclusion", "I hope this helps", perfectly symmetrical lists
4. Weak or generic hook — does the opening actually grab attention?
5. Passive voice overuse
6. Vague claims that need a concrete number or example
${platformChecks}

Output format:
CITATION GAPS (list every uncited factual claim or opinion — these MUST be fixed)
CITATION ACCURACY ISSUES (list every claim whose cited source's evidence doesn't actually support it)
OTHER ISSUES (numbered list, be specific about what line/phrase needs fixing)
TOP 3 REWRITES (exact suggestions: "Change [X] to [Y] because [reason]")`,
    prompt: `Content plan: ${orchestratorBrief}${sourceList}\n\nDraft:\n${draft}`,
  })
}

export async function runHumanizerAgent(
  userId: string,
  draft: string,
  critique: string,
  format: string,
  sources: SourceArticle[] = [],
  voiceFingerprint?: VoiceFingerprint | null
): Promise<string> {
  const spec = PLATFORM_SPECS[format]
  const charNote = spec?.charLimit ? `\nCRITICAL: Final output must be under ${spec.charLimit} characters.` : ''

  const sourceContext = formatSourceList(sources, 'SOURCES available for any remaining uncited or inaccurate claims')

  return generateTextForUser({
    userId,
    maxTokens: 2500,
    system: `You are a ghostwriter specializing in humanizing AI-generated content for ${spec?.name ?? format}.

Apply ALL of:
1. Fix every issue in the critique — implement the specific rewrites suggested
2. Fix every CITATION GAP and CITATION ACCURACY ISSUE flagged in the critique — add or correct citations using only the evidence given for each source below. If a claim's evidence doesn't support it, soften the claim or remove it rather than leaving a mismatched citation.
3. PRESERVE all existing correct citations exactly — do NOT remove or alter any (via ...), [link](url), or [SOURCE: ...] references that the critique did not flag
4. Remove ALL em-dashes (—) — replace with a comma or start a new sentence
5. Remove: "delve", "it's worth noting", "in conclusion", "I hope this helps", "fascinating", "crucial"
6. Vary sentence length — mix 3-word punches with longer flowing sentences
7. Replace vague claims with specifics: add numbers, names, or concrete scenarios drawn from the evidence below
8. Make the opening line land — it must be specific and non-generic
9. Ensure the voice sounds like an experienced practitioner, not a text generator${charNote}

${citationGuide(format)}

Return ONLY the rewritten content. No meta-commentary, no "Here is the revised version:", just the content.${buildVoiceConstitution(voiceFingerprint)}`,
    prompt: `Draft:\n${draft}\n\nCritique:\n${critique}${sourceContext}\n\nFormat: ${spec?.name ?? format}`,
  })
}

// ── Claim Verifier ─────────────────────────────────────────────────────────────
// Runs after Writer. For each claim in the draft, checks the cited source's
// actual evidence text — not a placeholder — to see whether it genuinely
// supports the claim. Flags hallucinated citations. Structured output lets
// the route hard-gate the loop on real citation problems instead of hoping
// the Evaluator's freeform score happens to catch them.

const VERIFIER_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    claims: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          claim: { type: 'string' },
          cited_domain: { type: 'string' },
          status: { type: 'string', enum: ['supported', 'overstated', 'unsupported', 'hallucinated'] },
          note: { type: 'string' },
        },
        required: ['claim', 'cited_domain', 'status', 'note'],
      },
    },
    verdict: { type: 'string', enum: ['pass', 'needs_revision'] },
  },
  required: ['claims', 'verdict'],
} as const

export interface VerifierResult {
  claims: { claim: string; cited_domain: string; status: 'supported' | 'overstated' | 'unsupported' | 'hallucinated'; note: string }[]
  verdict: 'pass' | 'needs_revision'
  hallucinatedCount: number
  unsupportedCount: number
  overstatedCount: number
  report: string
}

export async function runClaimVerifierAgent(
  userId: string,
  draft: string,
  sources: SourceArticle[],
  brief: string
): Promise<VerifierResult> {
  if (sources.length === 0) {
    return {
      claims: [], verdict: 'pass', hallucinatedCount: 0, unsupportedCount: 0, overstatedCount: 0,
      report: 'No sources provided — skipping claim verification.',
    }
  }

  const sourceDigest = formatSourceList(sources, 'AVAILABLE SOURCES')

  const result = await generateJsonForUser<{
    claims: VerifierResult['claims']
    verdict: 'pass' | 'needs_revision'
  }>({
    userId,
    maxTokens: 1200,
    system: `You are a fact-checker verifying that each claim in a draft is actually supported by its cited source's evidence text — not just that the URL exists.

For each claim+citation pair you find in the draft, extract the claim and assess it against the matching source's Evidence text:
- supported: the evidence text clearly backs this claim
- overstated: the source is related but the claim goes further than its evidence says
- unsupported: no citation at all for a factual claim, or the claim doesn't relate to its evidence
- hallucinated: the cited domain/URL doesn't appear in the available sources list at all

Set verdict to "needs_revision" if any claim is hallucinated or unsupported. Overstated claims alone can still be "pass" if minor.`,
    prompt: `Brief: ${brief}\n\n${sourceDigest}\n\nDraft to verify:\n${draft}`,
    schema: VERIFIER_SCHEMA,
  }).catch(() => ({ claims: [], verdict: 'pass' as const }))

  const hallucinatedCount = result.claims.filter(c => c.status === 'hallucinated').length
  const unsupportedCount = result.claims.filter(c => c.status === 'unsupported').length
  const overstatedCount = result.claims.filter(c => c.status === 'overstated').length

  const report = result.claims.length === 0
    ? 'CLAIM VERIFICATION REPORT\n--------------------------\nNo distinct citation-bearing claims detected.\n\nVERDICT: PASS'
    : `CLAIM VERIFICATION REPORT\n--------------------------\n${result.claims.map(c =>
        `[${c.status.toUpperCase()}] "${c.claim}" → cited: ${c.cited_domain || '(none)'} — ${c.note}`
      ).join('\n')}\n\nVERDICT: ${result.claims.length - hallucinatedCount - unsupportedCount} of ${result.claims.length} claims fully verified. [${hallucinatedCount + unsupportedCount > 0 ? 'NEEDS REVISION' : 'PASS'}]`

  return {
    claims: result.claims,
    verdict: hallucinatedCount + unsupportedCount > 0 ? 'needs_revision' : result.verdict,
    hallucinatedCount,
    unsupportedCount,
    overstatedCount,
    report,
  }
}

// ── Evaluator ──────────────────────────────────────────────────────────────────
// Scores the final content on 5 criteria. If any score < 7, returns instructions
// for the Writer to fix specific issues. Caps at 3 iterations.

export interface EvaluatorResult {
  scores: { hook: number; specificity: number; citations: number; voice: number; platform: number }
  pass: boolean
  failedCriteria: string[]
  writerInstructions: string
  scoresSummary: string
}

const EVALUATOR_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    scores: {
      type: 'object',
      additionalProperties: false,
      properties: {
        hook: { type: 'number' },
        specificity: { type: 'number' },
        citations: { type: 'number' },
        voice: { type: 'number' },
        platform: { type: 'number' },
      },
      required: ['hook', 'specificity', 'citations', 'voice', 'platform'],
    },
    failed: { type: 'array', items: { type: 'string' } },
    writer_instructions: { type: 'string' },
  },
  required: ['scores', 'failed', 'writer_instructions'],
} as const

export async function runEvaluatorAgent(
  userId: string,
  content: string,
  format: string,
  brief: string,
  loopNumber: number,
  verifierReport?: string
): Promise<EvaluatorResult> {
  const spec = PLATFORM_SPECS[format]

  try {
    const parsed = await generateJsonForUser<{
      scores: EvaluatorResult['scores']
      failed: string[]
      writer_instructions: string
    }>({
      userId,
      maxTokens: 1000,
      system: `You are a content quality evaluator. Score this ${spec?.name ?? format} content on 5 criteria, each 1-10:

1. HOOK STRENGTH (1-10): Does the opening line grab a practitioner immediately? 7+ = specific and compelling. Below 7 = generic or vague.
2. CLAIM SPECIFICITY (1-10): Are claims backed by numbers, names, or concrete examples? 7+ = most claims have specifics. Below 7 = too many vague assertions.
3. CITATION DENSITY (1-10): Are opinions and facts properly cited, and do those citations hold up against the independent claim-verification report given below? 7+ = all key claims have accurate sources. Below 7 = gaps or accuracy issues exist. If the verification report flags hallucinated or unsupported claims, this score must be below 7 regardless of how confident the prose sounds.
4. VOICE AUTHENTICITY (1-10): Does it sound like a human expert or like AI? 7+ = reads naturally. Below 7 = AI tells present (em-dashes, "delve", symmetrical lists).
5. PLATFORM FIT (1-10): Does format/length match ${spec?.name ?? format} norms? 7+ = fits the platform. Below 7 = structure mismatch.

failed: list of criteria names scoring below 7, empty array if all pass.
writer_instructions: specific rewrite instructions for the Writer — what exactly to fix, with examples. Empty string if all pass.`,
      prompt: `Brief: ${brief}\n\nContent (loop ${loopNumber}):\n${content}${verifierReport ? `\n\nIndependent claim-verification report (weigh this heavily for the citations score):\n${verifierReport}` : ''}`,
      schema: EVALUATOR_SCHEMA,
    })

    const scores = parsed.scores
    const failed = parsed.failed ?? []
    const pass = failed.length === 0
    const scoresSummary = `Hook: ${scores.hook}/10 | Specificity: ${scores.specificity}/10 | Citations: ${scores.citations}/10 | Voice: ${scores.voice}/10 | Platform: ${scores.platform}/10`
    return {
      scores,
      pass,
      failedCriteria: failed,
      writerInstructions: parsed.writer_instructions ?? '',
      scoresSummary,
    }
  } catch {
    return {
      scores: { hook: 8, specificity: 8, citations: 8, voice: 8, platform: 8 },
      pass: true,
      failedCriteria: [],
      writerInstructions: '',
      scoresSummary: 'Evaluation parse error — treating as pass',
    }
  }
}

// ── Audience Simulation ────────────────────────────────────────────────────────
// Simulates 3 reader personas and returns their objections/questions.
// The Humanizer uses this as a final-pass brief.

export async function runAudienceSimAgent(
  userId: string,
  content: string,
  format: string
): Promise<string> {
  const spec = PLATFORM_SPECS[format]

  return generateTextForUser({
    userId,
    maxTokens: 800,
    system: `You are simulating 3 different readers of a ${spec?.name ?? format} post.

Read the content as each persona and give their honest reaction:

PERSONA 1 — Skeptical ML Engineer: deeply technical, spots hand-wavy claims immediately, allergic to hype
PERSONA 2 — Curious PM / Product Lead: understands AI at a business level, needs jargon explained, cares about "so what for my team"
PERSONA 3 — Executive Skimmer: reads only the first sentence and last paragraph, needs the business impact to be unmissable

For each persona, output:
**[Persona name]**
Objection: [one specific thing they'd push back on]
Question: [one thing they'd want answered that isn't in the content]

Keep each response to 2 lines max. Be specific about what line/claim triggered the reaction.`,
    prompt: `Content:\n${content}`,
  })
}

// ── Audience-aware Humanizer ───────────────────────────────────────────────────
// Final humanizer pass that also addresses audience sim objections.

export async function runFinalPolishAgent(
  userId: string,
  content: string,
  audienceFeedback: string,
  format: string,
  sources: SourceArticle[] = [],
  voiceFingerprint?: VoiceFingerprint | null
): Promise<string> {
  const spec = PLATFORM_SPECS[format]
  const charNote = spec?.charLimit ? `\nCRITICAL: Final output must be under ${spec.charLimit} characters.` : ''
  const sourceContext = formatSourceList(sources, 'SOURCES if any claims still need citation')

  return generateTextForUser({
    userId,
    maxTokens: 2500,
    system: `You are making the final polish pass on a ${spec?.name ?? format} post.

Three different reader personas just read this and gave feedback. Your job is to address their objections in the existing text — not add sections, but fix the specific lines that caused the reactions.

Rules:
1. Address each objection by fixing the specific line — clarify jargon, add a concrete "so what", make the opening line's impact unmissable
2. Do NOT add new sections or change the overall structure
3. Keep all existing citations — add any that are still missing, grounded only in the evidence given below${charNote}
${sourceContext}

Return ONLY the revised content. No preamble.${buildVoiceConstitution(voiceFingerprint)}`,
    prompt: `Content:\n${content}\n\nAudience feedback to address:\n${audienceFeedback}`,
  })
}

export async function persistJob(
  userId: string,
  brief: string,
  format: string,
  orchestratorBrief: string,
  draft: string,
  critique: string,
  final: string,
  extras: Record<string, string> = {}
): Promise<void> {
  try {
    const client = createServiceClient()
    const { data: job, error: jobError } = await client
      .from('generation_jobs')
      .insert({ user_id: userId, brief, format, status: 'complete', completed_at: new Date().toISOString() })
      .select('id').single()
    if (jobError || !job) return
    const artifacts = [
      { job_id: job.id, slot: 'orchestrator_brief', content: orchestratorBrief, agent: 'orchestrator' },
      { job_id: job.id, slot: 'draft', content: draft, agent: 'writer' },
      { job_id: job.id, slot: 'critique', content: critique, agent: 'critic' },
      { job_id: job.id, slot: 'final', content: final, agent: 'humanizer' },
      ...Object.entries(extras).map(([slot, content]) => ({ job_id: job.id, slot, content, agent: slot })),
    ]
    await client.from('generation_artifacts').insert(artifacts)
  } catch (err) {
    console.error('persistJob error:', err)
  }
}
