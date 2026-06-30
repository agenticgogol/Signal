alter table public.user_profiles
  add column if not exists scheduled_crawl_lookback_days smallint not null default 7
    check (scheduled_crawl_lookback_days in (1, 3, 7, 14)),
  add column if not exists scheduled_crawl_max_per_source smallint not null default 5
    check (scheduled_crawl_max_per_source in (1, 3, 5, 10));

comment on column public.user_profiles.scheduled_crawl_lookback_days is
  'How many days back the crawl looks, used by both manual "Run now" and the scheduled hourly run. Single source of truth — Feed page localStorage is just a UI cache of this.';

comment on column public.user_profiles.scheduled_crawl_max_per_source is
  'Max articles fetched per source per run, used by both manual "Run now" and the scheduled hourly run.';
