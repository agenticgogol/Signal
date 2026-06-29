-- Migration 006: Content outlines (idea wizard output → content generation input)
create table if not exists public.content_outlines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  topic text not null,
  format text not null,
  focus_areas text[] not null default '{}',
  outline jsonb not null,          -- { sections: [{title, points}], angle, audience, hook }
  source_article_ids uuid[] default '{}',
  status text not null default 'draft' check (status in ('draft','frozen','used')),
  created_at timestamptz not null default now()
);

alter table public.content_outlines enable row level security;
create policy "Service role manages outlines" on public.content_outlines
  for all using (auth.role() = 'service_role');
create policy "Users manage own outlines" on public.content_outlines
  for all using (auth.uid() = user_id);
