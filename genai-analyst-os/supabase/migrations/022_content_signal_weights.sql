-- User-adjustable weights for the "Your Daily Publishing" candidate picker
-- (Settings). Five candidate-generating signals; custom-topic and interest-
-- area are handled separately (override and multiplier, not weighted rows —
-- see lib/contentSignals.ts). Defaults reflect the agreed design: explicit
-- engagement is the highest-trust signal, then recent reading behavior,
-- then relevance-gated trend/news signals, with emerging topics weighted
-- lowest since they're the most speculative.

alter table public.user_profiles
  add column if not exists content_signal_weights jsonb not null default '{
    "engagement": 0.35,
    "recently_read": 0.25,
    "trending_news": 0.15,
    "recent_trend": 0.15,
    "emerging_topic": 0.10
  }'::jsonb;

comment on column public.user_profiles.content_signal_weights is
  'User-adjustable weights (Settings) for the candidate picker behind "Generate today''s content". Renormalized at use-time if a signal has no candidates that day.';
