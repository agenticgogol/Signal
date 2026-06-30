-- Persist pipeline enrichment and RSS-provided article artwork.
alter table public.articles
    add column if not exists why_it_matters text,
    add column if not exists key_takeaways text[],
    add column if not exists og_image_url text;

-- Associate execution state with the user whose feed is being built so the UI
-- does not mistake another user's run for its own.
alter table public.crawl_runs
    add column if not exists user_id uuid references public.user_profiles(id) on delete set null;

create index if not exists crawl_runs_user_started_idx
    on public.crawl_runs (user_id, started_at desc);
