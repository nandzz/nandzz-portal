-- Owner-controllable agent settings.
-- agent_enabled: agent is OFF for every account (existing + new) until the owner
--   turns it on. When off, the agent disappears from the profile entirely.
-- agent_suggested_questions: owner-defined visitor prompt chips. Empty array ⇒
--   the visitor chat falls back to the default (i18n) suggestions.
alter table public.profiles
  add column if not exists agent_enabled boolean not null default false,
  add column if not exists agent_suggested_questions jsonb not null default '[]'::jsonb;
