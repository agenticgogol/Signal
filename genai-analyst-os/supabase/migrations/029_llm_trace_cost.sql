-- Real token counts (from each provider's own usage field in the response,
-- not estimated from character count) plus a best-effort USD cost estimate,
-- so "Recent AI activity" in Settings — and the Arize spans — can actually
-- answer "how much did this cost" instead of just "how long did it take."
alter table public.llm_traces
  add column if not exists input_tokens integer,
  add column if not exists output_tokens integer,
  add column if not exists estimated_cost_usd numeric(10, 6);
