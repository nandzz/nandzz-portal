-- Runtime, admin-controlled master switch for ALL AI surfaces.
--
-- AI (the agent chat/studio/widget AND the "edit pages with AI" page editor,
-- plus the credits/credit-pack UI that only meters AI usage) is being paused
-- until it can be properly tested. Rather than a redeploy-gated compile-time
-- flag, this is an `app_settings` row an admin flips from the admin panel.
--
-- Shape mirrors the other app_settings knobs: value is a small JSON object.
-- Defaults OFF so AI stays hidden until explicitly enabled per environment.
insert into public.app_settings (key, value, description)
values (
  'ai_enabled',
  '{"enabled": false}'::jsonb,
  'Master switch for all AI features (agent + AI page editor) and the credits UI. OFF = hidden everywhere.'
)
on conflict (key) do nothing;
