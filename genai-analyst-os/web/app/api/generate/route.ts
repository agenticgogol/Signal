import {
  runOrchestratorAgent,
  runWriterAgent,
  runCriticAgent,
  runHumanizerAgent,
  runClaimVerifierAgent,
  runEvaluatorAgent,
  runAudienceSimAgent,
  runFinalPolishAgent,
  persistJob,
} from '@/lib/agents'
import { createServiceClient } from '@/lib/supabase'
import { requirePaidFeature } from '@/lib/featureAccess'
import { logCreateEvent } from '@/lib/memory'
import type { VoiceFingerprint } from '@/lib/voice'

export const maxDuration = 300

const MAX_LOOPS = 3

export async function POST(req: Request) {
  const { brief, sources, format, pov, userId } = await req.json()
  if (!userId) {
    return Response.json({ error: 'userId is required' }, { status: 400 })
  }
  const paidGate = await requirePaidFeature(req, userId, 'Content generation')
  if (paidGate) return paidGate

  let voiceFingerprint: VoiceFingerprint | null = null
  if (userId) {
    const { data } = await createServiceClient()
      .from('user_profiles')
      .select('voice_fingerprint')
      .eq('id', userId)
      .maybeSingle()
    voiceFingerprint = (data?.voice_fingerprint as VoiceFingerprint | null) ?? null
  }

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: Record<string, unknown>) => {
        controller.enqueue(
          new TextEncoder().encode(
            `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
          )
        )
      }

      try {
        // ── Step 1: Orchestrator ────────────────────────────────────────────
        send('agent_start', { agent: 'orchestrator' })
        const orchestratorBrief = await runOrchestratorAgent(userId, brief, format, pov, sources)
        send('agent_complete', { agent: 'orchestrator', output: orchestratorBrief })

        let currentDraft = ''
        let currentCritique = ''
        let currentHumanized = ''
        let writerInstructions = ''
        let claimReport = ''
        let loopScores = ''
        let lastVerifierResult: Awaited<ReturnType<typeof runClaimVerifierAgent>> | null = null

        // ── Steps 2-5: Writer → Verifier → Critic → Humanizer (with loops) ─
        for (let loop = 1; loop <= MAX_LOOPS; loop++) {
          if (loop > 1) {
            send('loop_start', { loop, maxLoops: MAX_LOOPS, reason: writerInstructions })
          }

          // Step 2: Writer
          const writerContext = loop > 1
            ? `${orchestratorBrief}\n\n---\nPREVIOUS DRAFT FEEDBACK (loop ${loop - 1}):\n${writerInstructions}\nRewrite the content addressing ALL of these issues.`
            : orchestratorBrief

          send('agent_start', { agent: 'writer', loop })
          currentDraft = await runWriterAgent(userId, writerContext, format, sources, voiceFingerprint)
          send('agent_complete', { agent: 'writer', output: currentDraft, loop })

          // Step 3: Claim Verifier — checks each citation against the
          // source's real evidence text and returns a structured verdict.
          send('agent_start', { agent: 'verifier', loop })
          const verifierResult = await runClaimVerifierAgent(userId, currentDraft, sources, brief)
          lastVerifierResult = verifierResult
          claimReport = verifierResult.report
          send('agent_complete', {
            agent: 'verifier',
            output: claimReport,
            verdict: verifierResult.verdict,
            hallucinatedCount: verifierResult.hallucinatedCount,
            unsupportedCount: verifierResult.unsupportedCount,
            loop,
          })

          // Step 4: Critic (receives both verifier report and draft)
          send('agent_start', { agent: 'critic', loop })
          const criticInput = `${orchestratorBrief}\n\nCLAIM VERIFICATION REPORT:\n${claimReport}`
          currentCritique = await runCriticAgent(userId, currentDraft, criticInput, format, sources)
          send('agent_complete', { agent: 'critic', output: currentCritique, loop })

          // Step 5: Humanizer
          send('agent_start', { agent: 'humanizer', loop })
          currentHumanized = await runHumanizerAgent(userId, currentDraft, currentCritique, format, sources, voiceFingerprint)
          send('agent_complete', { agent: 'humanizer', output: currentHumanized, loop })

          // Step 6: Evaluator — score the humanized output, weighing the
          // verifier's independent findings heavily on the citations score.
          send('agent_start', { agent: 'evaluator', loop })
          const evalResult = await runEvaluatorAgent(userId, currentHumanized, format, brief, loop, claimReport)
          loopScores = evalResult.scoresSummary
          send('agent_complete', {
            agent: 'evaluator',
            output: evalResult.scoresSummary,
            scores: evalResult.scores,
            pass: evalResult.pass,
            failedCriteria: evalResult.failedCriteria,
            loop,
          })

          // Hard gate: a hallucinated or unsupported citation must never
          // ship, regardless of how the Evaluator scored everything else —
          // this is exactly the kind of thing a human would otherwise have
          // to catch by hand before publishing.
          const citationsClean = verifierResult.hallucinatedCount === 0 && verifierResult.unsupportedCount === 0

          if ((evalResult.pass && citationsClean) || loop === MAX_LOOPS) {
            break
          }

          // Failed — merge Evaluator's rewrite instructions with any
          // specific citation problems the Verifier found, so the retry
          // actually fixes both instead of only whatever the Evaluator
          // happened to mention.
          const citationFixes = verifierResult.claims
            .filter(c => c.status === 'hallucinated' || c.status === 'unsupported')
            .map(c => `- Fix citation: "${c.claim}" (${c.status}) — ${c.note}`)
            .join('\n')
          writerInstructions = [evalResult.writerInstructions, citationFixes].filter(Boolean).join('\n\n')
        }

        // If the loop ceiling was hit with citation problems still open,
        // say so explicitly rather than shipping a hallucinated or
        // unsupported claim silently — this is exactly the failure mode a
        // human reviewer would otherwise have to catch by hand.
        const unresolvedCitationIssues = lastVerifierResult
          ? lastVerifierResult.hallucinatedCount + lastVerifierResult.unsupportedCount
          : 0
        if (unresolvedCitationIssues > 0) {
          send('citation_warning', {
            message: `${unresolvedCitationIssues} citation issue(s) remained unresolved after ${MAX_LOOPS} loops — review the flagged claims before publishing.`,
            claims: lastVerifierResult?.claims.filter(c => c.status === 'hallucinated' || c.status === 'unsupported') ?? [],
          })
        }

        // ── Step 7: Audience Simulation ─────────────────────────────────────
        send('agent_start', { agent: 'audience_sim' })
        const audienceFeedback = await runAudienceSimAgent(userId, currentHumanized, format)
        send('agent_complete', { agent: 'audience_sim', output: audienceFeedback })

        // ── Step 8: Final Polish (addresses audience objections) ─────────────
        send('agent_start', { agent: 'final_polish' })
        const final = await runFinalPolishAgent(userId, currentHumanized, audienceFeedback, format, sources, voiceFingerprint)
        send('agent_complete', { agent: 'final_polish', output: final })

        // Persist
        await persistJob(userId, brief, format, orchestratorBrief, currentDraft, currentCritique, final, {
          verifier_report: claimReport,
          audience_feedback: audienceFeedback,
          evaluator_scores: loopScores,
        })
        await logCreateEvent({
          userId,
          eventType: 'generate_draft',
          topic: typeof brief === 'string' ? brief.slice(0, 200) : null,
          format,
          sourceMode: Array.isArray(sources) && sources.some((source: { url?: string }) => String(source?.url || '').startsWith('signal://knowledge/'))
            ? 'notebook'
            : Array.isArray(sources) && sources.length > 0
              ? 'feed'
              : 'custom',
          metadata: { sourceCount: Array.isArray(sources) ? sources.length : 0 },
        })

        send('complete', { final })
      } catch (err) {
        send('error', { message: String(err) })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
