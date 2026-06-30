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

          // Step 3: Claim Verifier
          send('agent_start', { agent: 'verifier', loop })
          claimReport = await runClaimVerifierAgent(userId, currentDraft, sources, brief)
          send('agent_complete', { agent: 'verifier', output: claimReport, loop })

          // Step 4: Critic (receives both verifier report and draft)
          send('agent_start', { agent: 'critic', loop })
          const criticInput = `${orchestratorBrief}\n\nCLAIM VERIFICATION REPORT:\n${claimReport}`
          currentCritique = await runCriticAgent(userId, currentDraft, criticInput, format, sources)
          send('agent_complete', { agent: 'critic', output: currentCritique, loop })

          // Step 5: Humanizer
          send('agent_start', { agent: 'humanizer', loop })
          currentHumanized = await runHumanizerAgent(userId, currentDraft, currentCritique, format, sources, voiceFingerprint)
          send('agent_complete', { agent: 'humanizer', output: currentHumanized, loop })

          // Step 6: Evaluator — score the humanized output
          send('agent_start', { agent: 'evaluator', loop })
          const evalResult = await runEvaluatorAgent(userId, currentHumanized, format, brief, loop)
          loopScores = evalResult.scoresSummary
          send('agent_complete', {
            agent: 'evaluator',
            output: evalResult.scoresSummary,
            scores: evalResult.scores,
            pass: evalResult.pass,
            failedCriteria: evalResult.failedCriteria,
            loop,
          })

          if (evalResult.pass || loop === MAX_LOOPS) {
            // All criteria met (or max loops reached) — proceed to audience sim
            break
          }

          // Failed — prepare Writer instructions for next loop
          writerInstructions = evalResult.writerInstructions
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
