-- Feedback given on a Today-page draft ("give feedback & regenerate") is
-- logged here so it can be distilled into durable voice_fingerprint traits
-- over time, not just used for the one-off regeneration.

create table if not exists public.voice_feedback_events (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  draft_item_id uuid references public.draft_inbox_items(id) on delete set null,
  feedback_text text not null,
  created_at timestamptz not null default now()
);

create index if not exists voice_feedback_events_user_created_idx
  on public.voice_feedback_events (user_id, created_at desc);

alter table public.voice_feedback_events enable row level security;

create policy "Users manage own voice feedback events"
  on public.voice_feedback_events for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Service role full access to voice feedback events"
  on public.voice_feedback_events for all
  using (auth.role() = 'service_role');
