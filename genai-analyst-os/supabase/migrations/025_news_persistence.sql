-- News stories were fetched live from RSS on every request and thrown
-- away — fine for "browse headlines," but it meant News could never be
-- referenced later, tracked for read-status, cited in generated content,
-- or folded into the same daily queue as Feed/Reading List (which are
-- persisted rows with real IDs). This persists the clustered stories
-- (same clustering already built in lib/aiNews.ts) into a real catalogue,
-- global rather than per-user since the same 6 RSS sources are shared by
-- everyone — same shape as `articles`.

create table if not exists public.news_articles (
  id uuid primary key default uuid_generate_v4(),
  url text not null unique,
  title text not null default '',
  description text not null default '',
  category text not null default '',
  primary_source text not null default '',
  sources text[] not null default '{}',
  sources_count integer not null default 1,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists news_articles_published_idx
  on public.news_articles (published_at desc);

create index if not exists news_articles_sources_count_idx
  on public.news_articles (sources_count desc, published_at desc);

alter table public.news_articles enable row level security;

create policy "Authenticated users read news articles"
  on public.news_articles for select
  using (auth.role() = 'authenticated');

create policy "Service role full access to news articles"
  on public.news_articles for all
  using (auth.role() = 'service_role');

-- Reading queue: widen to a third source type alongside feed/reading_list.
alter table public.daily_reading_queue
  drop constraint if exists daily_reading_queue_exactly_one_ref;

alter table public.daily_reading_queue
  add column if not exists news_article_id uuid references public.news_articles(id) on delete cascade;

alter table public.daily_reading_queue
  drop constraint if exists daily_reading_queue_item_type_check;

alter table public.daily_reading_queue
  add constraint daily_reading_queue_item_type_check
  check (item_type in ('feed', 'reading_list', 'news'));

alter table public.daily_reading_queue
  add constraint daily_reading_queue_exactly_one_ref check (
    (item_type = 'feed' and article_id is not null and knowledge_item_id is null and news_article_id is null) or
    (item_type = 'reading_list' and knowledge_item_id is not null and article_id is null and news_article_id is null) or
    (item_type = 'news' and news_article_id is not null and article_id is null and knowledge_item_id is null)
  );

create unique index if not exists daily_reading_queue_user_date_news_idx
  on public.daily_reading_queue (user_id, queue_date, news_article_id) where news_article_id is not null;
