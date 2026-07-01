-- Extracted URLs and GitHub repo links from saved knowledge items (notes and
-- URLs). A pasted LinkedIn post often buries several valuable links inside a
-- wall of text — this table pulls them out at ingestion time so they can be
-- browsed as a first-class, topic-organized resource library instead of
-- staying lost inside individual notes.

create table if not exists public.knowledge_links (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  notebook_id uuid not null references public.knowledge_notebooks(id) on delete cascade,
  item_id uuid not null references public.knowledge_items(id) on delete cascade,
  url text not null,
  link_type text not null check (link_type in ('github', 'paper', 'video', 'article')),
  label text not null default '',
  topic_tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (item_id, url)
);

comment on column public.knowledge_links.link_type is
  'github = github.com repo/gist link, paper = arxiv/doi/research link, video = youtube/vimeo, article = everything else.';

comment on column public.knowledge_links.label is
  'Short display label — e.g. "owner/repo" for GitHub links, or the link text/domain for others.';

comment on column public.knowledge_links.topic_tags is
  'Inherited from the parent knowledge_item at extraction time so links can be browsed topic-wise without a second LLM call.';

create index if not exists knowledge_links_user_type_idx
  on public.knowledge_links (user_id, link_type, created_at desc);

create index if not exists knowledge_links_topic_idx
  on public.knowledge_links using gin (topic_tags);

create index if not exists knowledge_links_item_idx
  on public.knowledge_links (item_id);

alter table public.knowledge_links enable row level security;

create policy "Users manage own knowledge links"
  on public.knowledge_links for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Service role full access to knowledge links"
  on public.knowledge_links for all
  using (auth.role() = 'service_role');
