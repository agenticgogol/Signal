create table if not exists public.weekly_digests (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  week_start date not null,
  narrative jsonb not null,
  article_count integer not null default 0,
  dominant_topics text[] not null default '{}',
  generated_at timestamptz not null default now(),
  unique (user_id, week_start)
);

create index if not exists weekly_digests_user_week_idx
  on public.weekly_digests (user_id, week_start desc);

alter table public.weekly_digests enable row level security;
