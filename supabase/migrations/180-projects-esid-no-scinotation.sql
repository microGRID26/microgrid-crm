-- 180: block scientific-notation strings on projects.esid
--
-- Background: 358 projects.esid values were corrupted into scientific notation
-- (e.g. "1.04437E+16") by a prior ingest path that auto-coerced 17-22 digit
-- ESI IDs into Python floats. Float precision can't represent 17+ digits, so
-- the round-trip back to string produced sci-notation permanently. The repair
-- bot (scripts/esid-repair/fetch_esids.py) cleared all 358 — 332 in the
-- original sweep + 26 in 2026-04-25 (16 corrected/NULLed, 10 escalated and
-- now NULL pending Zach's verification per greg_action #299).
--
-- Hardening: the only way to prevent recurrence is to make the DB reject
-- sci-notation writes. No active ingest path writes esid today (Partner API
-- excludes it, SubHub webhook doesn't carry it, no current pandas script
-- targets it), but the column is text + nullable + unconstrained, so any
-- future ingest could silently re-corrupt the data.
--
-- Pre-flight verified 2026-04-25 (zero sci-notation rows remain):
--   SELECT count(*) FROM projects WHERE esid ~ '^-?\d+(\.\d+)?[eE][+-]?\d+$';
--   -> 0
--
-- Constraint: rejects strings like "1.04437E+16" / "1e15" / "-1.0089E+21"
-- while allowing all-numeric ESI IDs (17-digit Oncor/AEP/TNMP, 22-digit
-- CenterPoint) and NULL.
--
-- Rollback: ALTER TABLE projects DROP CONSTRAINT projects_esid_no_scinotation;

DO $$
DECLARE
  bad_count int;
BEGIN
  -- Race guard: if the cleanup UPDATE was racing a concurrent webhook write
  -- and missed a row, fail the migration loudly instead of partial-applying.
  SELECT count(*) INTO bad_count FROM public.projects
   WHERE esid ~ '^-?\d+(\.\d+)?[eE][+-]?\d+$';
  IF bad_count > 0 THEN
    RAISE EXCEPTION 'cannot add projects_esid_no_scinotation: % rows still hold sci-notation esid; run UPDATE projects SET esid=NULL WHERE esid ~ ''^-?\d+(\.\d+)?[eE][+-]?\d+$'' first', bad_count;
  END IF;
END$$;

ALTER TABLE public.projects
  ADD CONSTRAINT projects_esid_no_scinotation
  CHECK (esid IS NULL OR esid !~ '^-?\d+(\.\d+)?[eE][+-]?\d+$');

COMMENT ON CONSTRAINT projects_esid_no_scinotation ON public.projects IS
  'Rejects sci-notation strings (e.g. "1.04437E+16") that previously came from float-coercion of 17-22 digit ESI IDs during ingest. Force string handling at the source (pandas dtype=str, JSON parser asString, openpyxl cell.value cast) to avoid hitting this constraint.';
