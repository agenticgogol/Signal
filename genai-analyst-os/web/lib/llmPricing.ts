// Best-effort USD-per-1M-token pricing for cost estimation in "Recent AI
// activity" and Arize spans. Not billing-accurate — providers change prices
// and this isn't refreshed automatically — but close enough to see which
// agents/models are actually expensive versus cheap at a glance. Unknown
// models return null cost rather than a guessed number.

interface ModelPrice {
  inputPer1M: number
  outputPer1M: number
}

// Matched by substring against the configured model name, longest match
// wins, so "claude-sonnet-5-20260101" still matches "claude-sonnet-5".
const PRICING: Record<string, ModelPrice> = {
  'claude-opus-4': { inputPer1M: 15, outputPer1M: 75 },
  'claude-sonnet-5': { inputPer1M: 3, outputPer1M: 15 },
  'claude-sonnet-4': { inputPer1M: 3, outputPer1M: 15 },
  'claude-haiku-4': { inputPer1M: 0.8, outputPer1M: 4 },
  'claude-3-5-haiku': { inputPer1M: 0.8, outputPer1M: 4 },
  'gpt-5': { inputPer1M: 5, outputPer1M: 15 },
  'gpt-4o-mini': { inputPer1M: 0.15, outputPer1M: 0.6 },
  'gpt-4o': { inputPer1M: 2.5, outputPer1M: 10 },
  'gpt-4.1-mini': { inputPer1M: 0.4, outputPer1M: 1.6 },
  'gpt-4.1': { inputPer1M: 2, outputPer1M: 8 },
  'llama-3.1-8b': { inputPer1M: 0.05, outputPer1M: 0.08 },
  'llama-3.1-70b': { inputPer1M: 0.59, outputPer1M: 0.79 },
  'llama-3.3-70b': { inputPer1M: 0.59, outputPer1M: 0.79 },
  'mixtral-8x7b': { inputPer1M: 0.24, outputPer1M: 0.24 },
}

export function estimateCostUsd(model: string | null | undefined, inputTokens: number | null | undefined, outputTokens: number | null | undefined): number | null {
  if (!model || inputTokens == null || outputTokens == null) return null
  const lower = model.toLowerCase()
  const match = Object.keys(PRICING)
    .filter(key => lower.includes(key))
    .sort((a, b) => b.length - a.length)[0]
  if (!match) return null
  const price = PRICING[match]
  const cost = (inputTokens / 1_000_000) * price.inputPer1M + (outputTokens / 1_000_000) * price.outputPer1M
  return Number(cost.toFixed(6))
}
