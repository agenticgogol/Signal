import { createServiceClient } from '@/lib/supabase'

// Lightweight, always-on LLM call tracing — every generateTextForUser /
// generateJsonForUser call records one span here (agent, provider, model,
// size, latency, outcome). This is the baseline that works with zero
// external configuration. If ARIZE_API_KEY and ARIZE_SPACE_ID are set, the
// same span is also forwarded to Arize over OTLP/HTTP, best-effort — a
// missing or unreachable Arize endpoint never affects the actual LLM call.

export interface LlmTraceSpan {
  userId?: string | null
  agent: string
  provider?: string | null
  model?: string | null
  promptChars: number
  completionChars: number
  durationMs: number
  status: 'success' | 'error'
  errorMessage?: string | null
}

async function forwardToArize(span: LlmTraceSpan) {
  const apiKey = process.env.ARIZE_API_KEY
  const spaceId = process.env.ARIZE_SPACE_ID
  if (!apiKey || !spaceId) return

  // Minimal OTLP/HTTP span payload — one span per LLM call, named after the
  // agent that made it. Arize accepts standard OTLP ingestion, so this needs
  // no SDK dependency, just a well-formed trace payload.
  const nowNanos = Date.now() * 1_000_000
  const startNanos = nowNanos - span.durationMs * 1_000_000
  const body = {
    resourceSpans: [{
      resource: {
        attributes: [
          { key: 'service.name', value: { stringValue: 'signal-genai-analyst-os' } },
          { key: 'arize.space_id', value: { stringValue: spaceId } },
        ],
      },
      scopeSpans: [{
        spans: [{
          name: `llm.${span.agent}`,
          startTimeUnixNano: String(startNanos),
          endTimeUnixNano: String(nowNanos),
          attributes: [
            { key: 'llm.provider', value: { stringValue: span.provider ?? 'unknown' } },
            { key: 'llm.model', value: { stringValue: span.model ?? 'unknown' } },
            { key: 'llm.prompt_chars', value: { intValue: String(span.promptChars) } },
            { key: 'llm.completion_chars', value: { intValue: String(span.completionChars) } },
            { key: 'openinference.span.kind', value: { stringValue: 'LLM' } },
          ],
          status: { code: span.status === 'error' ? 2 : 1, message: span.errorMessage ?? '' },
        }],
      }],
    }],
  }

  try {
    await fetch('https://otlp.arize.com/v1/traces', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'space_id': spaceId,
        'api_key': apiKey,
      },
      body: JSON.stringify(body),
    })
  } catch {
    // Arize being unreachable must never affect the product — best-effort only.
  }
}

export async function recordLlmTrace(span: LlmTraceSpan) {
  try {
    await createServiceClient().from('llm_traces').insert({
      user_id: span.userId || null,
      agent: span.agent,
      provider: span.provider ?? null,
      model: span.model ?? null,
      prompt_chars: span.promptChars,
      completion_chars: span.completionChars,
      duration_ms: span.durationMs,
      status: span.status,
      error_message: span.errorMessage ?? null,
    })
  } catch {
    // Tracing must never break the actual LLM call it's observing.
  }
  // Fire-and-forget — do not let a slow/unreachable Arize endpoint add
  // latency to the user-facing request.
  void forwardToArize(span)
}
