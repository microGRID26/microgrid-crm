-- Migration 142 + 142b: Paul HQ in-app /learn content.
-- Mirrors selected ATLAS-HQ concept pages so Paul can read AI-fundamentals
-- material from inside Paul HQ, without traversing Atlas HQ. RLS enabled,
-- no policies, base grants revoked. Service-role only.
-- Seed inserted via 142b (full SQL applied via Supabase MCP).

CREATE TABLE IF NOT EXISTS public.paul_hq_concepts (
  slug text PRIMARY KEY,
  title text NOT NULL,
  subtitle text,
  category text,
  cfo_summary text,
  body_md text NOT NULL,
  display_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.paul_hq_concepts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.paul_hq_concepts FROM anon, authenticated;
