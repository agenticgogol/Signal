-- Voice fingerprint extracted from 3–5 user-provided writing samples.
-- Safe to run repeatedly in the Supabase SQL editor.
alter table public.user_profiles
  add column if not exists voice_fingerprint jsonb;

comment on column public.user_profiles.voice_fingerprint is
  'Structured writing-style constitution injected into content generation agents.';
