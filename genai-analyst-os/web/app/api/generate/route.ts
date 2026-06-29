import {
  runOrchestratorAgent,
  runWriterAgent,
  runCriticAgent,
  runHumanizerAgent,
  persistJob,
} from '@/lib/agents'

export const maxDuration = 120

export async function POST(req: Request) {
  const { brief, sources, format, pov, userId } = await req.json()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: Record<string, string>) => {
        controller.enqueue(
          new TextEncoder().encode(
            `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
          )
        )
      }

      try {
        // Step 1: Orchestrator
        send('agent_start', { agent: 'orchestrator' })
        const orchestratorBrief = await runOrchestratorAgent(brief, format, pov, sources)
        send('agent_complete', { agent: 'orchestrator', output: orchestratorBrief })

        // Step 2: Writer
        send('agent_start', { agent: 'writer' })
        const draft = await runWriterAgent(orchestratorBrief, format, sources)
        send('agent_complete', { agent: 'writer', output: draft })

        // Step 3: Critic
        send('agent_start', { agent: 'critic' })
        const critique = await runCriticAgent(draft, orchestratorBrief, format, sources)
        send('agent_complete', { agent: 'critic', output: critique })

        // Step 4: Humanizer
        send('agent_start', { agent: 'humanizer' })
        const final = await runHumanizerAgent(draft, critique, format, sources)
        send('agent_complete', { agent: 'humanizer', output: final })

        // Persist
        await persistJob(userId, brief, format, orchestratorBrief, draft, critique, final)

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
