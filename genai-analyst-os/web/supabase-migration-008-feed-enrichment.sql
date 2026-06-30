-- Feed enrichment, artwork, and per-user pipeline run tracking.
-- Safe to run more than once in the Supabase SQL editor.
alter table public.articles
  add column if not exists why_it_matters text,
  add column if not exists key_takeaways text[],
  add column if not exists og_image_url text;

alter table public.crawl_runs
  add column if not exists user_id uuid references public.user_profiles(id) on delete set null;

create index if not exists crawl_runs_user_started_idx
  on public.crawl_runs (user_id, started_at desc);
