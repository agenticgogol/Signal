-- "N ideas x N platforms" means a manual generate click can legitimately
-- produce several drafts in the same format the same day (e.g. 3 different
-- ideas, all for LinkedIn) — the old (user_id, day, format) unique index
-- would reject the 2nd and 3rd. That cap only ever needed to protect the
-- *autonomous* daily job from double-firing; a manual click is a deliberate,
-- explicitly-paid-for action (same trust level as Create), so it shouldn't
-- be capped by a constraint meant for the unattended job.

alter table public.draft_inbox_items
  add column if not exists source text not null default 'manual'
  check (source in ('auto', 'manual'));

drop index if exists draft_inbox_items_user_day_format_idx;

-- Only the autonomous job's rows are capped at one per (day, format).
create unique index if not exists draft_inbox_items_auto_user_day_format_idx
  on public.draft_inbox_items (user_id, public.draft_inbox_day(created_at), format)
  where source = 'auto';
