alter table public.user_profiles
  add column if not exists scheduled_crawl_enabled boolean not null default false,
  add column if not exists scheduled_crawl_hour_utc smallint
    check (scheduled_crawl_hour_utc is null or scheduled_crawl_hour_utc between 0 and 23),
  add column if not exists last_scheduled_crawl_at timestamptz;

comment on column public.user_profiles.scheduled_crawl_enabled is
  'Pro-only: whether this account auto-runs the feed pipeline at scheduled_crawl_hour_utc every day.';

comment on column public.user_profiles.scheduled_crawl_hour_utc is
  'UTC hour (0-23) the scheduled pipeline run fires for this user. Chosen in Settings, where it is shown converted to the user''s local time.';

comment on column public.user_profiles.last_scheduled_crawl_at is
  'Timestamp of the most recent scheduled (non-manual) pipeline run for this user, set by src/run_scheduled_pipeline.py.';
