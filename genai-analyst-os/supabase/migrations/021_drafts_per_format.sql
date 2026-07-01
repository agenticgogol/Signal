-- The "one draft per day" cap was designed to protect the unattended
-- autonomous job from runaway cost. A user manually clicking "generate now"
-- on the Today page is a deliberate, explicit action (same trust level as
-- Create or Republish Pack, neither of which are capped) and can reasonably
-- want more than one platform's worth of content the same day. Relaxing the
-- cap to one per (day, format) still protects against the autonomous job
-- (or a double-click) duplicating the exact same format twice in one day.

drop index if exists draft_inbox_items_user_day_idx;

create unique index if not exists draft_inbox_items_user_day_format_idx
  on public.draft_inbox_items (user_id, public.draft_inbox_day(created_at), format);
