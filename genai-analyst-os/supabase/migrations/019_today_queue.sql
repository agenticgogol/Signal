-- "Today" queue — a single ranked, time-boxed reading list blending Feed
-- articles and Reading List items (News folded in later once this pattern
-- is proven). One row per user per queue item per day; regenerating a day
-- only replaces still-unread rows so read history/progress is never lost.

alter table public.user_profiles
  add column if not exists daily_reading_minutes integer not null default 15
  check (daily_reading_minutes in (10, 15, 20, 30));

comment on column public.user_profiles.daily_reading_minutes is
  'User-adjustable target for the daily Today queue (Settings). Read time per item is estimated from word count.';

create table if not exists public.daily_reading_queue (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  queue_date date not null default current_date,
  item_type text not null check (item_type in ('feed', 'reading_list')),
  article_id uuid references public.articles(id) on delete cascade,
  knowledge_item_id uuid references public.knowledge_items(id) on delete cascade,
  rank integer not null default 0,
  est_minutes numeric(5,2) not null default 1,
  score numeric(6,4) not null default 0,
  status text not null default 'unread' check (status in ('unread', 'read', 'skipped')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint daily_reading_queue_exactly_one_ref check (
    (item_type = 'feed' and article_id is not null and knowledge_item_id is null) or
    (item_type = 'reading_list' and knowledge_item_id is not null and article_id is null)
  )
);

-- Partial unique indexes (not a single UNIQUE across nullable columns) so
-- regenerating a day can't insert the same article/item twice.
create unique index if not exists daily_reading_queue_user_date_article_idx
  on public.daily_reading_queue (user_id, queue_date, article_id) where article_id is not null;

create unique index if not exists daily_reading_queue_user_date_item_idx
  on public.daily_reading_queue (user_id, queue_date, knowledge_item_id) where knowledge_item_id is not null;

create index if not exists daily_reading_queue_user_date_idx
  on public.daily_reading_queue (user_id, queue_date, rank);

alter table public.daily_reading_queue enable row level security;

create policy "Users manage own reading queue"
  on public.daily_reading_queue for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Service role full access to reading queue"
  on public.daily_reading_queue for all
  using (auth.role() = 'service_role');
