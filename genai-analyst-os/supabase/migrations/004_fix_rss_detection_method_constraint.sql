-- Migration 004: Expand rss_detection_method allowed values
--
-- The original CHECK constraint only included values from the production Edge Function
-- path (link_tag, path_probe, article_scrape, not_found).
-- The Python eval harness add_source.py also produces:
--   direct_feed_url  — user passed a URL that is already a feed
--   known_pattern    — RSS URL resolved from internal known-feeds map
--
-- Safe to re-run: DROP CONSTRAINT IF EXISTS is idempotent.

alter table public.user_sources
  drop constraint if exists user_sources_rss_detection_method_check;

alter table public.user_sources
  add constraint user_sources_rss_detection_method_check
  check (rss_detection_method in (
    'link_tag',        -- found via <link rel=alternate> tag in page HTML
    'path_probe',      -- found by probing /feed /rss /feed.xml /rss.xml
    'article_scrape',  -- no feed; source will be scraped as HTML
    'not_found',       -- no feed and no scrapeable articles detected
    'direct_feed_url', -- URL provided was already an RSS/Atom feed URL
    'known_pattern'    -- RSS URL resolved from add_source.py known-feeds map
  ));
