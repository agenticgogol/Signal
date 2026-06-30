create table if not exists public.knowledge_notebooks (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  title text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.knowledge_items (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  notebook_id uuid not null references public.knowledge_notebooks(id) on delete cascade,
  source_type text not null check (source_type in ('url', 'note')),
  source_url text,
  title text not null default '',
  raw_text text not null default '',
  cleaned_text text not null default '',
  summary text,
  why_it_matters text,
  topic_tags text[] not null default '{}',
  status text not null default 'pending' check (status in ('pending', 'processing', 'ready', 'failed')),
  processing_error text,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.knowledge_chunks (
  id uuid primary key default uuid_generate_v4(),
  item_id uuid not null references public.knowledge_items(id) on delete cascade,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  notebook_id uuid not null references public.knowledge_notebooks(id) on delete cascade,
  chunk_index integer not null,
  content text not null,
  created_at timestamptz not null default now(),
  unique (item_id, chunk_index)
);

create index if not exists knowledge_notebooks_user_idx
  on public.knowledge_notebooks (user_id, updated_at desc);

create index if not exists knowledge_items_notebook_idx
  on public.knowledge_items (notebook_id, created_at desc);

create index if not exists knowledge_items_user_status_idx
  on public.knowledge_items (user_id, status, created_at desc);

create index if not exists knowledge_chunks_notebook_idx
  on public.knowledge_chunks (notebook_id, item_id, chunk_index);

alter table public.knowledge_notebooks enable row level security;
alter table public.knowledge_items enable row level security;
alter table public.knowledge_chunks enable row level security;

create policy "Users manage own knowledge notebooks"
  on public.knowledge_notebooks for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Service role full access to knowledge notebooks"
  on public.knowledge_notebooks for all
  using (auth.role() = 'service_role');

create policy "Users manage own knowledge items"
  on public.knowledge_items for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Service role full access to knowledge items"
  on public.knowledge_items for all
  using (auth.role() = 'service_role');

create policy "Users read own knowledge chunks"
  on public.knowledge_chunks for select
  using (auth.uid() = user_id);

create policy "Service role full access to knowledge chunks"
  on public.knowledge_chunks for all
  using (auth.role() = 'service_role');
