alter table public.user_profiles
  add column if not exists llm_provider text
    check (llm_provider in ('anthropic', 'openai', 'groq', 'openrouter')),
  add column if not exists llm_model text,
  add column if not exists llm_api_key text;

comment on column public.user_profiles.llm_provider is
  'Per-user LLM provider for paid generation actions.';

comment on column public.user_profiles.llm_model is
  'Per-user model name used for paid generation actions.';

comment on column public.user_profiles.llm_api_key is
  'Per-user API key for the selected LLM provider. Stored server-side as an application-encrypted payload for account-specific paid generation.';
