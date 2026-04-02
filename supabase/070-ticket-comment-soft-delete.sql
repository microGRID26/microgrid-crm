-- Migration 070: Soft-delete for ticket comments
-- Comments are never truly deleted — hidden from normal view but preserved for audit.

ALTER TABLE ticket_comments ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE ticket_comments ADD COLUMN IF NOT EXISTS deleted_by TEXT;

CREATE INDEX IF NOT EXISTS idx_ticket_comments_deleted ON ticket_comments (deleted_at) WHERE deleted_at IS NOT NULL;

COMMENT ON COLUMN ticket_comments.deleted_at IS 'Soft-delete timestamp. NULL = visible. Non-null = hidden from normal view.';
COMMENT ON COLUMN ticket_comments.deleted_by IS 'Who deleted this comment (audit trail).';
