-- ============================================================================
-- 015-mentions.sql — Mention notifications table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.mention_notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id TEXT NOT NULL,
  note_id TEXT,
  mentioned_user_id TEXT NOT NULL,
  mentioned_by TEXT,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.mention_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mentions_read" ON public.mention_notifications FOR SELECT TO authenticated USING (true);
CREATE POLICY "mentions_write" ON public.mention_notifications FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_mentions_user ON public.mention_notifications(mentioned_user_id, read);
CREATE INDEX IF NOT EXISTS idx_mentions_project ON public.mention_notifications(project_id);
