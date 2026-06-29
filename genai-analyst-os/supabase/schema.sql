-- =============================================================================
-- GenAI Analyst OS — Supabase Schema
-- Run this entire file in the Supabase SQL editor (Database → SQL Editor).
-- Safe to re-run: all statements use IF NOT EXISTS / OR REPLACE.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------

create extension if not exists "uuid-ossp";       -- uuid_generate_v4()
create extension if not exists vector;             -- pgvector
create extension if not exists pg_cron;            -- scheduled crawls (enable in dashboard first)
-- pg_embedding (pgai) must be enabled in the Supabase dashboard:
--   Database → Extensions → search "pg_embedding" → Enable
-- It provides: pgai.embed('gte-small', text) → vector(384)


-- =============================================================================
-- TABLES
-- =============================================================================

-- ---------------------------------------------------------------------------
-- user_profiles
-- One row per authenticated user. Created on first sign-in via Supabase Auth trigger.
-- ---------------------------------------------------------------------------

create table if not exists public.user_profiles (
    id                  uuid primary key references auth.users(id) on delete cascade,
    plan                text not null default 'free' check (plan in ('free', 'pro')),
    is_admin            boolean not null default false,
    style_seed          text not null default 'practitioner'
                            check (style_seed in ('practitioner', 'technical', 'business', 'beginner-friendly')),
    topic_weights       jsonb not null default '{
        "agents": 0.5, "evals": 0.5, "fine-tuning": 0.5, "rag": 0.5,
        "multimodal": 0.5, "reasoning": 0.5, "infrastructure": 0.5,
        "safety": 0.5, "hardware": 0.5, "products": 0.5, "research": 0.5
    }'::jsonb,
    stripe_customer_id  text,
    draft_count_month   integer not null default 0,   -- rolling monthly draft counter
    draft_reset_at      timestamptz not null default date_trunc('month', now()) + interval '1 month',
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now()
);

comment on table public.user_profiles is
    'One row per user. topic_weights drives relevance ranking; plan enforces feature limits.';


-- ---------------------------------------------------------------------------
-- user_sources
-- RSS/blog sources the user has added. RSS URL resolved at add-time.
-- ---------------------------------------------------------------------------

create table if not exists public.user_sources (
    id              uuid primary key default uuid_generate_v4(),
    user_id         uuid not null references public.user_profiles(id) on delete cascade,
    url             text not null,                          -- canonical homepage URL entered by user
    rss_url         text,                                   -- resolved RSS/Atom feed URL
    rss_detection_method text check (
                        rss_detection_method in ('link_tag', 'path_probe', 'article_scrape', 'not_found')
                    ),
    source_tier     integer not null default 2 check (source_tier between 1 and 3),
    created_at      timestamptz not null default now(),
    unique (user_id, url)                                   -- one entry per source per user
);

comment on column public.user_sources.source_tier is
    '1 = top-tier (Anthropic blog, major research labs), 2 = practitioner, 3 = community/aggregator';


-- ---------------------------------------------------------------------------
-- articles
-- Global catalogue of crawled articles, shared across users.
-- Embedding generated via: pgai.embed(''gte-small'', title || '' '' || full_text) → vector(384)
-- ---------------------------------------------------------------------------

create table if not exists public.articles (
    id              uuid primary key default uuid_generate_v4(),
    url             text not null unique,
    title           text not null default '',
    full_text       text not null default '',
    tldr_bullets    jsonb,                                  -- string[]
    topic_tags      jsonb,                                  -- string[] from 11-item taxonomy
    depth_score     integer check (depth_score between 1 and 5),
    embedding       vector(384),                            -- gte-small via pgai
    published_at    timestamptz,
    source_id       uuid references public.user_sources(id) on delete set null,
    created_at      timestamptz not null default now()
);

comment on table public.articles is
    'Global article catalogue. url is UNIQUE — deduplication enforced at DB level.';
comment on column public.articles.embedding is
    'Set via: pgai.embed(''gte-small'', title || '' '' || full_text) inside the INSERT statement.';


-- ---------------------------------------------------------------------------
-- user_feed_items
-- Per-user ranked feed for a given date. Populated by the rank node.
-- UNIQUE(user_id, article_id, feed_date) prevents double-inserts on crawler retries.
-- ---------------------------------------------------------------------------

create table if not exists public.user_feed_items (
    id              uuid primary key default uuid_generate_v4(),
    user_id         uuid not null references public.user_profiles(id) on delete cascade,
    article_id      uuid not null references public.articles(id) on delete cascade,
    blend_score     numeric(6,4) not null,
    feed_date       date not null default current_date,
    created_at      timestamptz not null default now(),
    unique (user_id, article_id, feed_date)
);

comment on table public.user_feed_items is
    'Ranked feed items per user per day. UNIQUE constraint makes crawler retries idempotent.';


-- ---------------------------------------------------------------------------
-- user_feedback
-- Raw like/dislike signals. topic_weights are recomputed from this table on each signal.
-- ---------------------------------------------------------------------------

create table if not exists public.user_feedback (
    id              uuid primary key default uuid_generate_v4(),
    user_id         uuid not null references public.user_profiles(id) on delete cascade,
    article_id      uuid not null references public.articles(id) on delete cascade,
    signal          text not null check (signal in ('like', 'dislike')),
    created_at      timestamptz not null default now(),
    unique (user_id, article_id)                            -- one signal per article per user (upsert)
);


-- ---------------------------------------------------------------------------
-- daily_ideas
-- 5 content angle cards generated per user per day. Always inserted as a full set.
-- ---------------------------------------------------------------------------

create table if not exists public.daily_ideas (
    id                  uuid primary key default uuid_generate_v4(),
    user_id             uuid not null references public.user_profiles(id) on delete cascade,
    idea_date           date not null default current_date,
    position            integer not null check (position between 1 and 5),
    angle_title         text not null,
    format              text not null check (format in ('substack', 'linkedin')),
    hook_sentence       text not null default '',
    rationale           text not null default '',
    source_article_ids  jsonb not null default '[]'::jsonb,  -- uuid[]
    created_at          timestamptz not null default now(),
    unique (user_id, idea_date, position)
);

comment on table public.daily_ideas is
    'Exactly 5 rows per (user_id, idea_date). Never partially populated — delete-and-reinsert on retry.';


-- ---------------------------------------------------------------------------
-- drafts
-- User-generated drafts. Upserted on stream completion.
-- ---------------------------------------------------------------------------

create table if not exists public.drafts (
    id              uuid primary key default uuid_generate_v4(),
    user_id         uuid not null references public.user_profiles(id) on delete cascade,
    idea_id         uuid references public.daily_ideas(id) on delete set null,
    format          text not null check (format in ('substack', 'linkedin')),
    pov_bullets     jsonb not null default '[]'::jsonb,
    content         text not null default '',
    updated_at      timestamptz not null default now(),
    created_at      timestamptz not null default now()
);


-- ---------------------------------------------------------------------------
-- processed_stripe_events
-- Idempotency log for Stripe webhook events.
-- ---------------------------------------------------------------------------

create table if not exists public.processed_stripe_events (
    event_id        text primary key,                       -- Stripe event.id (e.g. evt_...)
    event_type      text not null,
    user_id         uuid references public.user_profiles(id) on delete set null,
    processed_at    timestamptz not null default now()
);


-- ---------------------------------------------------------------------------
-- crawl_runs
-- One row per pipeline execution. Used for monitoring and degraded-crawl detection.
-- ---------------------------------------------------------------------------

create table if not exists public.crawl_runs (
    id                      uuid primary key default uuid_generate_v4(),
    started_at              timestamptz not null default now(),
    completed_at            timestamptz,                    -- null = still running or failed
    status                  text not null default 'running'
                                check (status in ('running', 'completed', 'degraded', 'failed')),
    articles_fetched        integer not null default 0,
    articles_new            integer not null default 0,
    articles_failed         integer not null default 0,
    users_ranked            integer not null default 0,
    users_ideas_generated   integer not null default 0,
    error_log               jsonb not null default '[]'::jsonb  -- [{ source_id, error, stage }]
);

comment on column public.crawl_runs.completed_at is
    'Null means the run is still active or crashed. Alert if no completed row within 24 h by 04:00 UTC.';


-- =============================================================================
-- INDEXES
-- =============================================================================

-- articles: fast lookup by URL (already covered by UNIQUE, but explicit for clarity)
create index if not exists articles_url_idx on public.articles (url);

-- articles: ANN similarity search on embedding
create index if not exists articles_embedding_idx
    on public.articles using ivfflat (embedding vector_cosine_ops)
    with (lists = 100);

-- articles: filter by published date for recency scoring
create index if not exists articles_published_at_idx on public.articles (published_at desc);

-- user_feed_items: fast feed lookup per user per date
create index if not exists feed_items_user_date_idx
    on public.user_feed_items (user_id, feed_date desc, blend_score desc);

-- daily_ideas: fast ideas lookup per user per date
create index if not exists ideas_user_date_idx
    on public.daily_ideas (user_id, idea_date desc, position asc);

-- user_feedback: history lookup for weight recomputation
create index if not exists feedback_user_idx on public.user_feedback (user_id, created_at desc);

-- user_sources: all sources for a user (read by crawler)
create index if not exists sources_user_idx on public.user_sources (user_id);

-- crawl_runs: monitoring query
create index if not exists crawl_runs_started_at_idx on public.crawl_runs (started_at desc);


-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

-- Enable RLS on every table
alter table public.user_profiles        enable row level security;
alter table public.user_sources         enable row level security;
alter table public.articles             enable row level security;
alter table public.user_feed_items      enable row level security;
alter table public.user_feedback        enable row level security;
alter table public.daily_ideas          enable row level security;
alter table public.drafts               enable row level security;
alter table public.processed_stripe_events enable row level security;
alter table public.crawl_runs           enable row level security;

-- ---------------------------------------------------------------------------
-- user_profiles policies
-- ---------------------------------------------------------------------------

create policy "Users read own profile"
    on public.user_profiles for select
    using (auth.uid() = id);

create policy "Users update own profile"
    on public.user_profiles for update
    using (auth.uid() = id)
    with check (auth.uid() = id);

-- Service role (Edge Functions) can read/write all profiles
create policy "Service role full access to profiles"
    on public.user_profiles for all
    using (auth.role() = 'service_role');

-- ---------------------------------------------------------------------------
-- user_sources policies
-- ---------------------------------------------------------------------------

create policy "Users manage own sources"
    on public.user_sources for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

create policy "Service role full access to sources"
    on public.user_sources for all
    using (auth.role() = 'service_role');

-- ---------------------------------------------------------------------------
-- articles policies
-- Articles are global — any authenticated user can read; only service role writes
-- ---------------------------------------------------------------------------

create policy "Authenticated users read articles"
    on public.articles for select
    using (auth.role() = 'authenticated');

create policy "Service role writes articles"
    on public.articles for all
    using (auth.role() = 'service_role');

-- ---------------------------------------------------------------------------
-- user_feed_items policies
-- ---------------------------------------------------------------------------

create policy "Users read own feed items"
    on public.user_feed_items for select
    using (auth.uid() = user_id);

create policy "Service role full access to feed items"
    on public.user_feed_items for all
    using (auth.role() = 'service_role');

-- ---------------------------------------------------------------------------
-- user_feedback policies
-- ---------------------------------------------------------------------------

create policy "Users read own feedback"
    on public.user_feedback for select
    using (auth.uid() = user_id);

create policy "Users insert own feedback"
    on public.user_feedback for insert
    with check (auth.uid() = user_id);

create policy "Service role full access to feedback"
    on public.user_feedback for all
    using (auth.role() = 'service_role');

-- ---------------------------------------------------------------------------
-- daily_ideas policies
-- ---------------------------------------------------------------------------

create policy "Users read own ideas"
    on public.daily_ideas for select
    using (auth.uid() = user_id);

create policy "Service role full access to ideas"
    on public.daily_ideas for all
    using (auth.role() = 'service_role');

-- ---------------------------------------------------------------------------
-- drafts policies
-- ---------------------------------------------------------------------------

create policy "Users manage own drafts"
    on public.drafts for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- processed_stripe_events — service role only (Stripe webhook runs server-side)
-- ---------------------------------------------------------------------------

create policy "Service role manages stripe events"
    on public.processed_stripe_events for all
    using (auth.role() = 'service_role');

-- ---------------------------------------------------------------------------
-- crawl_runs — service role writes; admins read
-- ---------------------------------------------------------------------------

create policy "Service role manages crawl_runs"
    on public.crawl_runs for all
    using (auth.role() = 'service_role');

create policy "Admins read crawl_runs"
    on public.crawl_runs for select
    using (
        exists (
            select 1 from public.user_profiles
            where id = auth.uid() and is_admin = true
        )
    );


-- =============================================================================
-- FUNCTIONS
-- =============================================================================

-- ---------------------------------------------------------------------------
-- update_feedback_and_weights
-- Called by the feedback Edge Function and the Python harness via supabase.rpc().
-- Atomically: inserts feedback signal + recomputes topic_weights from full history.
-- Both writes happen in a single transaction — if either fails, both roll back.
-- ---------------------------------------------------------------------------

create or replace function public.update_feedback_and_weights(
    p_user_id       uuid,
    p_article_id    uuid,
    p_signal        text       -- 'like' | 'dislike'
)
returns jsonb
language plpgsql
security definer                -- runs as DB owner so it can bypass RLS inside the function
as $$
declare
    v_article_tags  text[];
    v_weights       jsonb;
    v_like_delta    numeric := 0.10;
    v_dislike_delta numeric := -0.05;
    v_delta         numeric;
    v_tag           text;
    v_current       numeric;
    v_new_val       numeric;
begin
    -- Validate signal
    if p_signal not in ('like', 'dislike') then
        raise exception 'signal must be ''like'' or ''dislike'', got: %', p_signal;
    end if;

    -- Upsert the feedback row (one signal per article per user)
    insert into public.user_feedback (user_id, article_id, signal)
    values (p_user_id, p_article_id, p_signal)
    on conflict (user_id, article_id) do update set signal = excluded.signal;

    -- Look up the article's topic_tags
    select array(select jsonb_array_elements_text(topic_tags))
    into v_article_tags
    from public.articles
    where id = p_article_id;

    if v_article_tags is null then
        v_article_tags := '{}';
    end if;

    -- Load current topic_weights
    select topic_weights into v_weights
    from public.user_profiles
    where id = p_user_id;

    if v_weights is null then
        v_weights := '{
            "agents":0.5,"evals":0.5,"fine-tuning":0.5,"rag":0.5,
            "multimodal":0.5,"reasoning":0.5,"infrastructure":0.5,
            "safety":0.5,"hardware":0.5,"products":0.5,"research":0.5
        }'::jsonb;
    end if;

    -- Apply delta to each tag in the article, clamping to [0.0, 1.0]
    v_delta := case when p_signal = 'like' then v_like_delta else v_dislike_delta end;

    foreach v_tag in array v_article_tags loop
        if v_weights ? v_tag then
            v_current := (v_weights ->> v_tag)::numeric;
            v_new_val := greatest(0.0, least(1.0, v_current + v_delta));
            v_weights := jsonb_set(v_weights, array[v_tag], to_jsonb(v_new_val));
        end if;
    end loop;

    -- Persist updated weights
    update public.user_profiles
    set topic_weights = v_weights,
        updated_at    = now()
    where id = p_user_id;

    return v_weights;
end;
$$;

comment on function public.update_feedback_and_weights is
    'Atomically inserts a feedback signal and recomputes topic_weights. '
    'Call via supabase.rpc(''update_feedback_and_weights'', {...}) — never call separately.';


-- ---------------------------------------------------------------------------
-- handle_new_user
-- Trigger: auto-create user_profiles row when a new auth.users row is inserted.
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
    insert into public.user_profiles (id)
    values (new.id)
    on conflict (id) do nothing;
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();

comment on function public.handle_new_user is
    'Auto-provisions user_profiles with default plan=free and equal topic_weights on sign-up.';


-- ---------------------------------------------------------------------------
-- reset_monthly_draft_count
-- Called by pg_cron on the 1st of each month to reset the rolling draft counter.
-- ---------------------------------------------------------------------------

create or replace function public.reset_monthly_draft_count()
returns void
language plpgsql
security definer
as $$
begin
    update public.user_profiles
    set draft_count_month = 0,
        draft_reset_at    = date_trunc('month', now()) + interval '1 month',
        updated_at        = now()
    where plan = 'free';
end;
$$;


-- =============================================================================
-- PG_CRON JOBS
-- (pg_cron must be enabled in Supabase dashboard: Database → Extensions → pg_cron)
-- =============================================================================

-- Daily crawl at 02:00 UTC — calls the crawler Edge Function
-- Replace <project-ref> with your actual Supabase project reference ID.
-- Uncomment after the Edge Function is deployed.

/*
select cron.schedule(
    'daily-crawl',
    '0 2 * * *',
    $$
    select net.http_post(
        url     := 'https://<project-ref>.supabase.co/functions/v1/crawler',
        headers := jsonb_build_object(
            'Authorization', 'Bearer ' || current_setting('app.service_role_key'),
            'Content-Type',  'application/json'
        ),
        body    := '{}'::jsonb
    );
    $$
);
*/

-- Reset free-plan draft counters on the 1st of each month at 00:05 UTC
/*
select cron.schedule(
    'monthly-draft-reset',
    '5 0 1 * *',
    'select public.reset_monthly_draft_count()'
);
*/


-- =============================================================================
-- SEED: insert your own user profile as admin
-- Run this AFTER creating your account via Supabase Auth (email sign-up).
-- Replace the email below with the one you used to sign up.
-- =============================================================================

/*
update public.user_profiles
set is_admin     = true,
    plan         = 'pro',
    style_seed   = 'practitioner'
where id = (
    select id from auth.users where email = 'utsab.chakraborty@gmail.com'
);
*/
