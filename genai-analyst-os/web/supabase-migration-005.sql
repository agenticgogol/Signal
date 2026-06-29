-- Migration 005: Content generation blackboard tables

create table if not exists public.generation_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  brief text not null,
  format text not null check (format in ('linkedin','substack','thread','blog','youtube_long','youtube_short')),
  status text not null default 'pending' check (status in ('pending','running','complete','failed')),
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.generation_artifacts (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.generation_jobs(id) on delete cascade,
  slot text not null,  -- orchestrator_brief | draft | critique | final
  content text not null,
  agent text not null,
  created_at timestamptz not null default now(),
  unique(job_id, slot)
);

alter table public.generation_jobs enable row level security;
alter table public.generation_artifacts enable row level security;

create policy "Service role manages generation_jobs" on public.generation_jobs
  for all using (auth.role() = 'service_role');
create policy "Service role manages generation_artifacts" on public.generation_artifacts
  for all using (auth.role() = 'service_role');
create policy "Users read own jobs" on public.generation_jobs
  for select using (auth.uid() = user_id);
create policy "Users read own artifacts" on public.generation_artifacts
  for select using (
    job_id in (select id from public.generation_jobs where user_id = auth.uid())
  );
