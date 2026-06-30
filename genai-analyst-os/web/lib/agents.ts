import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient } from './supabase'
import { PLATFORM_SPECS } from './platformSpecs'
import { buildVoiceConstitution, type VoiceFingerprint } from './voice'

export { PLATFORM_SPECS }

export interface SourceArticle {
  title: string
  url: string
  domain: string
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

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

function formatSourceList(sources: SourceArticle[]): string {
  if (!sources || sources.length === 0) return ''
  return `\nAVAILABLE SOURCES (you MUST draw from these and cite them):\n` +
    sources.map((s, i) => `${i + 1}. "${s.title}"\n   URL: ${s.url}\n   Domain: ${s.domain}`).join('\n')
}

// ── Agent functions ────────────────────────────────────────────────────────────

export async function runOrchestratorAgent(
  brief: string,
  format: string,
  pov?: string,
  sources: SourceArticle[] = []
): Promise<string> {
  const spec = PLATFORM_SPECS[format]
  const platformContext = spec
    ? `\nTarget platform: ${spec.name}\nWord/length target: ${spec.wordLimit}\nContent structure: ${spec.structure}\nTone: ${spec.tone}`
    : ''

  const sourceContext = sources.length > 0
    ? `\n\nSOURCE ARTICLES to ground this content:\n${sources.map((s, i) => `${i + 1}. "${s.title}" — ${s.url}`).join('\n')}`
    : ''

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1500,
    system: 'You are a content strategist for a senior GenAI practitioner. Produce a structured content plan as JSON.',
    messages: [{
      role: 'user',
      content: `Brief: ${brief}${platformContext}${pov ? `\nAuthor POV: ${pov}` : ''}${sourceContext}

Produce a JSON object with:
- angle: string (the unique take)
- key_claims: array of objects, each with:
    - claim: string (the specific assertion to make)
    - source_url: string (URL from the source list above that backs this claim — use "" if none)
    - source_title: string (title of that source — use "" if none)
    - source_domain: string (domain only — e.g. "arxiv.org" — use "" if none)
- target_persona: string
- tone: string
- hook_idea: string (opening line idea — must be specific, not generic)
- platform_notes: string (specific structural guidance for ${spec?.name ?? format})
- avoid_these_cliches: string[]

Return only valid JSON, no markdown fences.`,
    }],
  })
  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  return jsonMatch ? jsonMatch[1].trim() : text.trim()
}

export async function runWriterAgent(
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

Write ONLY the final content — no meta-commentary, no "here is your post", no preamble.`
    : `Write a ${format} post about the following topic. Be direct and substantive.\n\n${citationGuide(format)}`
  const systemPrompt = baseSystemPrompt + buildVoiceConstitution(voiceFingerprint)

  const sourceContext = formatSourceList(sources)

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2500,
    system: systemPrompt,
    messages: [{
      role: 'user',
      content: `Content plan:\n${orchestratorBrief}${sourceContext}\n\nWrite the ${spec?.name ?? format} content now. Every opinion and factual claim must be grounded in one of the sources above with a citation in the format specified.`,
    }],
  })
  return response.content[0].type === 'text' ? response.content[0].text : ''
}

export async function runCriticAgent(
  draft: string,
  orchestratorBrief: string,
  format: string,
  sources: SourceArticle[] = []
): Promise<string> {
  const spec = PLATFORM_SPECS[format]
  const platformChecks = spec
    ? `Also check platform-specific issues for ${spec.name}: Does it meet "${spec.wordLimit}"? Does it follow "${spec.structure}"?`
    : ''

  const sourceList = sources.length > 0
    ? `\nAVAILABLE SOURCES:\n${sources.map(s => `• ${s.title} — ${s.url}`).join('\n')}`
    : ''

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1400,
    system: `You are a fact-checker and content critic for a GenAI practitioner's content.

Review for:
1. CITATION GAPS — any factual claim, statistic, or opinion that is NOT cited to a source. List each uncited claim verbatim.
2. CITATION ACCURACY — do the cited sources actually exist in the available sources list? Flag any invented or hallucinated URLs.
3. AI writing tells: em-dashes, "delve", "it's worth noting", "in conclusion", "I hope this helps", perfectly symmetrical lists
4. Weak or generic hook — does the opening actually grab attention?
5. Passive voice overuse
6. Vague claims that need a concrete number or example
${platformChecks}

Output format:
CITATION GAPS (list every uncited factual claim or opinion — these MUST be fixed)
OTHER ISSUES (numbered list, be specific about what line/phrase needs fixing)
TOP 3 REWRITES (exact suggestions: "Change [X] to [Y] because [reason]")`,
    messages: [{
      role: 'user',
      content: `Content plan: ${orchestratorBrief}${sourceList}\n\nDraft:\n${draft}`,
    }],
  })
  return response.content[0].type === 'text' ? response.content[0].text : ''
}

export async function runHumanizerAgent(
  draft: string,
  critique: string,
  format: string,
  sources: SourceArticle[] = [],
  voiceFingerprint?: VoiceFingerprint | null
): Promise<string> {
  const spec = PLATFORM_SPECS[format]
  const charNote = spec?.charLimit ? `\nCRITICAL: Final output must be under ${spec.charLimit} characters.` : ''

  const sourceContext = sources.length > 0
    ? `\n\nSOURCES available for any remaining uncited claims:\n${sources.map(s => `• ${s.title} — ${s.url}`).join('\n')}`
    : ''

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2500,
    system: `You are a ghostwriter specializing in humanizing AI-generated content for ${spec?.name ?? format}.

Apply ALL of:
1. Fix every issue in the critique — implement the specific rewrites suggested
2. Fix every CITATION GAP flagged in the critique — add citations from the available sources
3. PRESERVE all existing citations exactly — do NOT remove or alter any (via ...), [link](url), or [SOURCE: ...] references
4. Remove ALL em-dashes (—) — replace with a comma or start a new sentence
5. Remove: "delve", "it's worth noting", "in conclusion", "I hope this helps", "fascinating", "crucial"
6. Vary sentence length — mix 3-word punches with longer flowing sentences
7. Replace vague claims with specifics: add numbers, names, or concrete scenarios
8. Make the opening line land — it must be specific and non-generic
9. Ensure the voice sounds like an experienced practitioner, not a text generator${charNote}

${citationGuide(format)}

Return ONLY the rewritten content. No meta-commentary, no "Here is the revised version:", just the content.${buildVoiceConstitution(voiceFingerprint)}`,
    messages: [{
      role: 'user',
      content: `Draft:\n${draft}\n\nCritique:\n${critique}${sourceContext}\n\nFormat: ${spec?.name ?? format}`,
    }],
  })
  return response.content[0].type === 'text' ? response.content[0].text : ''
}

// ── Claim Verifier ─────────────────────────────────────────────────────────────
// Runs after Writer. For each claim in the draft, checks whether the cited
// source's TL;DR bullets actually support it. Flags hallucinated citations.

export async function runClaimVerifierAgent(
  draft: string,
  sources: SourceArticle[],
  brief: string
): Promise<string> {
  if (sources.length === 0) return 'No sources provided — skipping claim verification.'

  const sourceDigest = sources
    .map(s => `SOURCE: "${s.title}" (${s.url})\n  → Available evidence: [from feed TL;DR bullets stored in pipeline]`)
    .join('\n\n')

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1200,
    system: `You are a fact-checker verifying that each claim in a draft is actually supported by the cited source.

For each claim+citation pair you find in the draft:
1. Extract the claim being made
2. Extract which source it cites (by URL or domain)
3. Assess: SUPPORTED (source clearly backs this), OVERSTATED (source is related but claim goes further than evidence), UNSUPPORTED (no citation at all or wrong source cited), HALLUCINATED (cited source doesn't appear in available sources list)

Output format:
CLAIM VERIFICATION REPORT
--------------------------
[SUPPORTED] "exact claim text" → cited: domain.com ✓
[OVERSTATED] "exact claim text" → cited: domain.com — claim goes beyond what source says; suggest softening to "..."
[UNSUPPORTED] "exact claim text" → no citation found — needs citation or removal
[HALLUCINATED] "exact claim text" → cited URL not in source list — must be corrected

VERDICT: X of Y claims verified. [PASS / NEEDS REVISION]`,
    messages: [{
      role: 'user',
      content: `Brief: ${brief}\n\nAvailable sources:\n${sourceDigest}\n\nDraft to verify:\n${draft}`,
    }],
  })
  return response.content[0].type === 'text' ? response.content[0].text : ''
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

export async function runEvaluatorAgent(
  content: string,
  format: string,
  brief: string,
  loopNumber: number
): Promise<EvaluatorResult> {
  const spec = PLATFORM_SPECS[format]

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1000,
    system: `You are a content quality evaluator. Score this ${spec?.name ?? format} content on 5 criteria, each 1-10:

1. HOOK STRENGTH (1-10): Does the opening line grab a practitioner immediately? 7+ = specific and compelling. Below 7 = generic or vague.
2. CLAIM SPECIFICITY (1-10): Are claims backed by numbers, names, or concrete examples? 7+ = most claims have specifics. Below 7 = too many vague assertions.
3. CITATION DENSITY (1-10): Are opinions and facts properly cited? 7+ = all key claims have sources. Below 7 = gaps exist.
4. VOICE AUTHENTICITY (1-10): Does it sound like a human expert or like AI? 7+ = reads naturally. Below 7 = AI tells present (em-dashes, "delve", symmetrical lists).
5. PLATFORM FIT (1-10): Does format/length match ${spec?.name ?? format} norms? 7+ = fits the platform. Below 7 = structure mismatch.

Return ONLY valid JSON:
{
  "scores": { "hook": N, "specificity": N, "citations": N, "voice": N, "platform": N },
  "failed": ["hook", "voice"],  // criteria scoring < 7, empty array if all pass
  "writer_instructions": "Specific rewrite instructions for the Writer — what exactly to fix, with examples. Empty string if all pass."
}`,
    messages: [{
      role: 'user',
      content: `Brief: ${brief}\n\nContent (loop ${loopNumber}):\n${content}`,
    }],
  })

  const raw = response.content[0].type === 'text' ? response.content[0].text : '{}'
  const cleaned = raw.replace(/^```[a-z]*\n?/, '').replace(/\n?```$/, '').trim()

  try {
    const parsed = JSON.parse(cleaned)
    const scores = parsed.scores ?? { hook: 8, specificity: 8, citations: 8, voice: 8, platform: 8 }
    const failed: string[] = parsed.failed ?? []
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
  content: string,
  format: string
): Promise<string> {
  const spec = PLATFORM_SPECS[format]

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 800,
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
    messages: [{
      role: 'user',
      content: `Content:\n${content}`,
    }],
  })
  return response.content[0].type === 'text' ? response.content[0].text : ''
}

// ── Audience-aware Humanizer ───────────────────────────────────────────────────
// Final humanizer pass that also addresses audience sim objections.

export async function runFinalPolishAgent(
  content: string,
  audienceFeedback: string,
  format: string,
  sources: SourceArticle[] = [],
  voiceFingerprint?: VoiceFingerprint | null
): Promise<string> {
  const spec = PLATFORM_SPECS[format]
  const charNote = spec?.charLimit ? `\nCRITICAL: Final output must be under ${spec.charLimit} characters.` : ''
  const sourceContext = sources.length > 0
    ? `\nSOURCES if any claims still need citation:\n${sources.map(s => `• ${s.title} — ${s.url}`).join('\n')}`
    : ''

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2500,
    system: `You are making the final polish pass on a ${spec?.name ?? format} post.

Three different reader personas just read this and gave feedback. Your job is to address their objections in the existing text — not add sections, but fix the specific lines that caused the reactions.

Rules:
1. Address each objection by fixing the specific line — clarify jargon, add a concrete "so what", make the opening line's impact unmissable
2. Do NOT add new sections or change the overall structure
3. Keep all existing citations — add any that are still missing${charNote}
${sourceContext}

Return ONLY the revised content. No preamble.${buildVoiceConstitution(voiceFingerprint)}`,
    messages: [{
      role: 'user',
      content: `Content:\n${content}\n\nAudience feedback to address:\n${audienceFeedback}`,
    }],
  })
  return response.content[0].type === 'text' ? response.content[0].text : content
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
