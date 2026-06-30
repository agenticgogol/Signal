alter table public.user_profiles
  add column if not exists role text,
  add column if not exists interest_areas text[] not null default '{}',
  add column if not exists reading_goal text
    check (reading_goal in ('stay_current', 'deep_research', 'content_creation', 'general_curiosity')),
  add column if not exists reading_frequency text
    check (reading_frequency in ('daily', 'weekly', 'on_demand')),
  add column if not exists onboarding_completed_at timestamptz;

comment on column public.user_profiles.role is
  'Self-reported role captured during onboarding, used for cold-start personalization.';

comment on column public.user_profiles.interest_areas is
  'Topic tags the user selected during onboarding; seeds initial topic_weights.';

comment on column public.user_profiles.reading_goal is
  'Why the user is here: stay_current, deep_research, content_creation, general_curiosity.';

comment on column public.user_profiles.reading_frequency is
  'Preferred cadence: daily, weekly, on_demand. Used to tune default digest settings.';

comment on column public.user_profiles.onboarding_completed_at is
  'Set once the first-sign-in onboarding wizard is completed or explicitly skipped.';
