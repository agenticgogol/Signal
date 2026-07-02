-- AI Tutor: inline concept/term explanations (Feed + Library) plus a
-- standalone Tutor Hub. Two-tier design so the expensive part is shared:
--   - concept_terms: one row per distinct term, globally cached general
--     explanation (same "what is RAG" for everyone — generate once, reuse
--     for every user forever after), same idea as shared article enrichment.
--   - user_concept_lookups: per-user history + the personalized "grounded
--     in your own Library/Feed" citations, which genuinely differ per user
--     and so can't be part of the shared cache.

create table if not exists public.concept_terms (
  id uuid primary key default uuid_generate_v4(),
  term text not null unique,
  what_it_is text not null default '',
  why_it_matters text not null default '',
  how_it_works text not null default '',
  code_snippet text,
  use_cases text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists concept_terms_term_idx on public.concept_terms (term);

alter table public.concept_terms enable row level security;

create policy "Authenticated users read concept terms"
  on public.concept_terms for select
  using (auth.role() = 'authenticated');

create policy "Service role full access to concept terms"
  on public.concept_terms for all
  using (auth.role() = 'service_role');

create table if not exists public.user_concept_lookups (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  term text not null,
  concept_term_id uuid references public.concept_terms(id) on delete set null,
  grounded_titles text[] not null default '{}',
  source_article_id uuid,
  source_knowledge_item_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists user_concept_lookups_user_created_idx
  on public.user_concept_lookups (user_id, created_at desc);

alter table public.user_concept_lookups enable row level security;

create policy "Users manage own concept lookups"
  on public.user_concept_lookups for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Service role full access to user concept lookups"
  on public.user_concept_lookups for all
  using (auth.role() = 'service_role');

-- Extracted at summarization time — the terms worth making clickable in a
-- given piece of content. Nullable/empty for anything processed before
-- this migration; backfill happens lazily (extracted on next reprocessing),
-- not retroactively for every historical row.
alter table public.articles
  add column if not exists concept_terms text[] not null default '{}';

alter table public.knowledge_items
  add column if not exists concept_terms text[] not null default '{}';
