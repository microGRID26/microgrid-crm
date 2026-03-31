-- Migration 055: Reset stage_dates on active projects for meaningful SLA tracking
--
-- Problem: Many projects have stale stage_dates from the NetSuite migration,
-- making SLA thresholds meaningless (everything shows as critical).
--
-- Solution: For each active project (disposition = Sale or null, not In Service/Loyalty/Cancelled),
-- reset stage_date to the most recent stage_history entry for the current stage.
-- If no stage_history exists, set stage_date to today (fresh start).

-- Step 1: Reset stage_date from stage_history (most recent entry for current stage)
UPDATE projects p
SET stage_date = sh.entered
FROM (
  SELECT DISTINCT ON (project_id)
    project_id, entered
  FROM stage_history
  ORDER BY project_id, entered DESC
) sh
WHERE p.id = sh.project_id
  AND (p.disposition IS NULL OR p.disposition = 'Sale')
  AND p.stage != 'complete';

-- Step 2: For active projects with no stage_history, set to today
UPDATE projects
SET stage_date = CURRENT_DATE
WHERE (disposition IS NULL OR disposition = 'Sale')
  AND stage != 'complete'
  AND stage_date IS NULL;

-- Step 3: Also update the sla_thresholds table to match code constants
-- (ensures DB function sla_status() uses real values too)
INSERT INTO sla_thresholds (stage, target, risk, crit) VALUES
  ('evaluation', 3, 4, 6),
  ('survey', 3, 5, 10),
  ('design', 3, 5, 10),
  ('permit', 21, 30, 45),
  ('install', 5, 7, 10),
  ('inspection', 14, 21, 30),
  ('complete', 3, 5, 7)
ON CONFLICT (stage) DO UPDATE SET
  target = EXCLUDED.target,
  risk = EXCLUDED.risk,
  crit = EXCLUDED.crit;
