-- Lets a user choose which platform their one daily auto-draft targets,
-- instead of it always being LinkedIn. Filterable on the Today page once a
-- few days of history (potentially across different formats) accumulate.

alter table public.user_profiles
  add column if not exists drafts_inbox_format text not null default 'linkedin'
  check (drafts_inbox_format in ('linkedin', 'substack', 'thread', 'blog', 'youtube_long', 'youtube_short'));

comment on column public.user_profiles.drafts_inbox_format is
  'Target platform format for the daily Drafts Inbox auto-draft (Settings).';
