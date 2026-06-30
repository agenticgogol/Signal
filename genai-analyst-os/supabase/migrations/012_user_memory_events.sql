create table if not exists public.user_article_events (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  article_id uuid not null references public.articles(id) on delete cascade,
  event_type text not null check (event_type in ('impression', 'open', 'pin', 'save', 'like', 'dislike', 'dismiss')),
  session_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists user_article_events_user_created_idx
  on public.user_article_events (user_id, created_at desc);

create index if not exists user_article_events_article_created_idx
  on public.user_article_events (article_id, created_at desc);

create table if not exists public.user_knowledge_events (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  notebook_id uuid references public.knowledge_notebooks(id) on delete cascade,
  knowledge_item_id uuid references public.knowledge_items(id) on delete cascade,
  event_type text not null check (event_type in ('open_notebook', 'open_item', 'save_url', 'save_note', 'upload_file', 'ask_chat')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists user_knowledge_events_user_created_idx
  on public.user_knowledge_events (user_id, created_at desc);

create table if not exists public.user_chat_events (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  scope text not null check (scope in ('memory', 'notebook', 'feed')),
  notebook_id uuid references public.knowledge_notebooks(id) on delete set null,
  question text not null,
  answer_summary text,
  citations jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists user_chat_events_user_created_idx
  on public.user_chat_events (user_id, created_at desc);

create table if not exists public.user_create_events (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  event_type text not null check (event_type in ('generate_draft', 'save_outline', 'export_content')),
  topic text,
  format text,
  source_mode text,
  notebook_id uuid references public.knowledge_notebooks(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists user_create_events_user_created_idx
  on public.user_create_events (user_id, created_at desc);
