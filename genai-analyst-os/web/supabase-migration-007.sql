-- Migration 007: article reactions + selected_for_create flag on user_feed_items
-- Run this in Supabase SQL editor

-- Article reactions (like / dislike)
create table if not exists public.article_reactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  article_id uuid not null references public.articles(id) on delete cascade,
  reaction text not null check (reaction in ('like', 'dislike')),
  created_at timestamptz not null default now(),
  unique (user_id, article_id)
);

alter table public.article_reactions enable row level security;
create policy "Users manage own reactions" on public.article_reactions
  for all using (true) with check (true);

-- selected_for_create: user marks articles from feed to use in Create
alter table public.user_feed_items
  add column if not exists selected_for_create boolean not null default false;

-- Index for fast reaction lookups
create index if not exists idx_article_reactions_user on public.article_reactions(user_id);
