-- "Generate today's content" runs the full evidence-grounded pipeline,
-- possibly for several ideas x several platforms — a multi-minute job. It
-- used to run synchronously inside the API request, so navigating away
-- (which the browser can treat as abandoning the underlying connection)
-- risked cutting the generation short. This table lets the route return
-- immediately while the work continues server-side via Next.js `after()`,
-- and the client polls for the result instead of holding the connection open.

create table if not exists public.content_generation_jobs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'completed', 'failed')),
  result jsonb,
  error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists content_generation_jobs_user_created_idx
  on public.content_generation_jobs (user_id, created_at desc);

alter table public.content_generation_jobs enable row level security;

create policy "Users manage own content generation jobs"
  on public.content_generation_jobs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Service role full access to content generation jobs"
  on public.content_generation_jobs for all
  using (auth.role() = 'service_role');
