alter table public.user_profiles
  add column if not exists digest_email text,
  add column if not exists daily_digest_enabled boolean not null default false;

create table if not exists public.daily_digests (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  digest_date date not null default current_date,
  narrative jsonb not null,
  article_count integer not null default 0,
  dominant_topics text[] not null default '{}',
  generated_at timestamptz not null default now(),
  emailed_at timestamptz,
  unique (user_id, digest_date)
);

create index if not exists daily_digests_user_date_idx
  on public.daily_digests (user_id, digest_date desc);

alter table public.daily_digests enable row level security;

comment on table public.daily_digests is
  'Cached daily narrative digests used for email delivery and in-app reading.';
