-- Schema for four new agentic capabilities: Republish Pack, Knowledge Decay
-- (+ declutter), Novelty/Velocity Radar, and the overnight Drafts Inbox —
-- plus lightweight LLM call observability across all of them.

-- ── Drafts Inbox ────────────────────────────────────────────────────────────
-- Opt-in, toggled per account. A scheduled job drafts at most one piece per
-- user per day from what they engaged with most, landing here for
-- approve/dismiss rather than being auto-published.

alter table public.user_profiles
  add column if not exists drafts_inbox_enabled boolean not null default false;

comment on column public.user_profiles.drafts_inbox_enabled is
  'Opt-in toggle (Settings) for the overnight Drafts Inbox agent. Off by default — never runs without explicit consent.';

create table if not exists public.draft_inbox_items (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  topic text not null,
  format text not null,
  brief text not null default '',
  final_content text not null default '',
  source_title text,
  source_url text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'dismissed')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index if not exists draft_inbox_items_user_status_idx
  on public.draft_inbox_items (user_id, status, created_at desc);

-- One draft per user per day — the daily job checks this before generating.
-- timestamptz::date depends on the session TimeZone setting, so Postgres
-- refuses it directly in an index expression (must be IMMUTABLE, not just
-- STABLE). Pinning the conversion to a fixed 'UTC' offset inside a small
-- wrapper function makes the result deterministic regardless of session
-- settings, which is the standard way around this restriction.
create or replace function public.draft_inbox_day(ts timestamptz)
returns date
language sql
immutable
as $$
  select (ts at time zone 'utc')::date
$$;

create unique index if not exists draft_inbox_items_user_day_idx
  on public.draft_inbox_items (user_id, public.draft_inbox_day(created_at));

alter table public.draft_inbox_items enable row level security;

create policy "Users manage own draft inbox items"
  on public.draft_inbox_items for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Service role full access to draft inbox items"
  on public.draft_inbox_items for all
  using (auth.role() = 'service_role');

-- ── Knowledge Decay / declutter ──────────────────────────────────────────────
-- Soft-archive only — decluttering never deletes, it hides from active
-- ranking/search until explicitly restored.

alter table public.knowledge_items
  add column if not exists archived_at timestamptz;

comment on column public.knowledge_items.archived_at is
  'Set when the user archives a stale item via the Declutter UI. Excluded from ranking, connections, and Ask by default; never hard-deleted.';

create index if not exists knowledge_items_active_idx
  on public.knowledge_items (user_id, archived_at) where archived_at is null;

-- ── LLM call observability (Arize-compatible spans) ─────────────────────────
-- Every generateTextForUser/generateJsonForUser call records a span here.
-- If ARIZE_API_KEY/ARIZE_SPACE_ID are configured, the same span data is also
-- forwarded to Arize over OTLP/HTTP — this table is the always-on baseline
-- that works with zero external configuration.

create table if not exists public.llm_traces (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.user_profiles(id) on delete cascade,
  agent text not null default 'unspecified',
  provider text,
  model text,
  prompt_chars integer not null default 0,
  completion_chars integer not null default 0,
  duration_ms integer not null default 0,
  status text not null default 'success' check (status in ('success', 'error')),
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists llm_traces_user_created_idx
  on public.llm_traces (user_id, created_at desc);

create index if not exists llm_traces_agent_idx
  on public.llm_traces (agent, created_at desc);

alter table public.llm_traces enable row level security;

create policy "Users read own llm traces"
  on public.llm_traces for select
  using (auth.uid() = user_id);

create policy "Service role full access to llm traces"
  on public.llm_traces for all
  using (auth.role() = 'service_role');
