-- B→A: drop the 5 broad SELECT policies on storage.objects for public
-- buckets. Public buckets serve objects via direct public URL (no policy
-- needed for fetch-by-URL); the SELECT policy additionally enables
-- client-side LIST operations which let callers enumerate every file.
--
-- Pre-check (2026-04-17): 0 TS/TSX callers use .list() on any of the 5
-- buckets. Public-URL fetches via supabase.storage.from(bucket).getPublicUrl()
-- keep working because that path doesn't go through storage.objects policies.

DROP POLICY IF EXISTS "customer_feedback_read" ON storage.objects;
DROP POLICY IF EXISTS "auth read" ON storage.objects;
DROP POLICY IF EXISTS "rep_files_storage_read" ON storage.objects;
DROP POLICY IF EXISTS "ticket_attachments_read" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view wo photos" ON storage.objects;
