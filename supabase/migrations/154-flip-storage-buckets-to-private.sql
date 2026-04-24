-- Migration 154 — Flip all 6 Supabase Storage buckets from public to private.
--
-- Closes the `public_bucket_allows_listing` Supabase advisor for:
--   wo-photos, ticket-attachments, rep-files, customer-feedback,
--   spoke-feedback, Project-documents.
--
-- Pre-flip state (verified 2026-04-24 via storage.objects + project_files +
-- drift-checker subagent):
--
--   wo-photos             0 live URLs in wo_checklist_items
--   ticket-attachments    9 image_url rows, all dual-written with image_path
--                         via migration 150 backfill; new uploads dual-write
--                         at lib/api/tickets.ts:313 and mobile/lib/api.ts:140
--   rep-files             0 rows in rep_files table
--   customer-feedback     0 rows in customer_feedback_attachments table
--   spoke-feedback        1 row with attachment_url NULL
--   Project-documents     6 orphan objects from a single 2026-03-15 test
--                         upload (PROJ-28490 / Fernando Rodriguez). Zero
--                         code references. project_files.file_url is 100%
--                         Google Drive URLs (128,413/128,413) — the project
--                         never migrated from Drive to this bucket.
--
-- After flip:
--   - Reads continue via createSignedUrl through lib/storage/signed-url.ts
--     (commit d84a366, migration 150).
--   - Direct public-URL access returns 403. Any holder of a cached public
--     URL loses access — that's the point.
--   - Service_role bypass unchanged (uploads, admin tooling).
--
-- Project-documents reversibility: if the 6 orphan files are ever needed,
-- service_role can enumerate + download via storage API; or re-flip this
-- single bucket with `UPDATE storage.buckets SET public = true WHERE id =
-- 'Project-documents'` as a one-liner rollback.

UPDATE storage.buckets
SET public = false
WHERE id IN (
  'wo-photos',
  'ticket-attachments',
  'rep-files',
  'customer-feedback',
  'spoke-feedback',
  'Project-documents'
)
AND public = true;
