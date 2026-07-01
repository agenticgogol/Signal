-- Direct-publish connectors. Same "bring your own credential" pattern
-- already used for LLM provider keys (encrypted at rest, decrypted
-- server-side only) rather than a full OAuth app per platform — LinkedIn/X
-- native posting APIs require developer-app review that's an external,
-- per-platform approval process outside this codebase's control. Medium
-- and Resend-based email export need no OAuth at all (self-service tokens).

create table if not exists public.platform_connections (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  platform text not null check (platform in ('medium', 'linkedin', 'x')),
  access_token text not null,
  extra jsonb not null default '{}'::jsonb,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, platform)
);

comment on column public.platform_connections.access_token is
  'Encrypted at rest (same enc:v1 scheme as user_profiles.llm_api_key) — never returned to the client after saving.';
comment on column public.platform_connections.extra is
  'Platform-specific extras, e.g. LinkedIn requires a person URN alongside the access token.';

alter table public.platform_connections enable row level security;

create policy "Users manage own platform connections"
  on public.platform_connections for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Service role full access to platform connections"
  on public.platform_connections for all
  using (auth.role() = 'service_role');

-- Track what's been published where, per draft — separate from approval
-- status since one draft could get published to multiple connected
-- platforms (or none, if the user only ever copies it manually).
alter table public.draft_inbox_items
  add column if not exists published_platforms jsonb not null default '[]'::jsonb;
