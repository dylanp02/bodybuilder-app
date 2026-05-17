-- ─────────────────────────────────────────────────────────────────────────────
-- Bodyweight reminder cron job — runs daily at 09:00 UTC
--
-- Prerequisites (run once in Supabase SQL Editor → Extensions):
--   1. Enable pg_cron:  CREATE EXTENSION IF NOT EXISTS pg_cron;
--   2. Enable pg_net:   CREATE EXTENSION IF NOT EXISTS pg_net;
--
-- Replace <PROJECT_REF> with your Supabase project reference
-- (the subdomain from your project URL, e.g. wryqwwxhelcxoroxuyyx).
-- Replace <SERVICE_ROLE_KEY> with the value from
-- Project Settings → API → service_role key.
--
-- To view scheduled jobs:   SELECT * FROM cron.job;
-- To remove this job:       SELECT cron.unschedule('bodyweight-reminder-daily');
-- ─────────────────────────────────────────────────────────────────────────────

SELECT cron.schedule(
  'bodyweight-reminder-daily',          -- job name (unique)
  '0 9 * * *',                          -- every day at 09:00 UTC
  $$
  SELECT net.http_post(
    url     := 'https://wryqwwxhelcxoroxuyyx.supabase.co/functions/v1/bodyweight-reminder',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || '<SERVICE_ROLE_KEY>'
    ),
    body    := '{}'::jsonb
  );
  $$
);
