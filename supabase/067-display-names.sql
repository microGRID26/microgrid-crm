-- Migration 067: Add display_name to AHJs and utilities
-- Same pattern as financiers — short label for dropdowns and UI, fallback to name if null

ALTER TABLE ahjs ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE utilities ADD COLUMN IF NOT EXISTS display_name TEXT;

-- Index for efficient lookup
CREATE INDEX IF NOT EXISTS idx_ahjs_display_name ON ahjs (display_name) WHERE display_name IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_utilities_display_name ON utilities (display_name) WHERE display_name IS NOT NULL;

COMMENT ON COLUMN ahjs.display_name IS 'Short display label for UI dropdowns. Falls back to name if null.';
COMMENT ON COLUMN utilities.display_name IS 'Short display label for UI dropdowns. Falls back to name if null.';
