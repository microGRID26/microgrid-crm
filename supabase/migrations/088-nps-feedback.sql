-- 088: NPS feedback support
-- Extends customer_feedback to support periodic NPS prompts (0-10 scale)
-- alongside the existing 1-5 star rating for ad-hoc feedback.

-- 1. Add 'nps' to the category CHECK constraint
ALTER TABLE customer_feedback DROP CONSTRAINT IF EXISTS customer_feedback_category_check;
ALTER TABLE customer_feedback
  ADD CONSTRAINT customer_feedback_category_check
  CHECK (category IN ('bug', 'idea', 'praise', 'question', 'confusing', 'nps'));

-- 2. Extend rating CHECK to allow 0-10 (was 1-5).
-- NPS uses 0-10. Star ratings still use 1-5. App-side validates per category.
ALTER TABLE customer_feedback DROP CONSTRAINT IF EXISTS customer_feedback_rating_check;
ALTER TABLE customer_feedback
  ADD CONSTRAINT customer_feedback_rating_check
  CHECK (rating IS NULL OR (rating >= 0 AND rating <= 10));

-- 3. Track which NPS prompts a customer has been shown so we don't repeat.
-- Stored as JSONB on customer_accounts (no new table needed).
-- Shape: { "pto_complete": "2026-04-08", "first_billing_30d": "2026-05-15", ... }
-- The presence of a key means "already shown" — value is the date shown.
ALTER TABLE customer_accounts
  ADD COLUMN IF NOT EXISTS nps_prompts_shown JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN customer_accounts.nps_prompts_shown IS
  'Tracks which NPS prompts have been shown to this customer (one-shot per milestone). Keys are milestone identifiers, values are ISO date strings.';
