-- 108: ATLAS HQ — update customer feedback status from HQ console
-- Allows the ATLAS HQ server (using the sb_publishable key) to mark
-- customer_feedback rows as reviewed/closed without requiring a full
-- service_role key. SECURITY DEFINER runs as the migration owner,
-- bypassing RLS. Input is validated against the allowed status enum.

CREATE OR REPLACE FUNCTION public.atlas_update_feedback_status(
  p_id     UUID,
  p_status TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_allowed TEXT[] := ARRAY['new', 'reviewing', 'responded', 'closed'];
  v_row     customer_feedback%ROWTYPE;
BEGIN
  IF p_status != ALL(v_allowed) THEN
    RAISE EXCEPTION 'invalid status: %. Must be one of: %', p_status, array_to_string(v_allowed, ', ');
  END IF;

  UPDATE customer_feedback
     SET status     = p_status,
         updated_at = NOW()
   WHERE id = p_id
RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'feedback row % not found', p_id;
  END IF;

  RETURN jsonb_build_object(
    'id',         v_row.id,
    'status',     v_row.status,
    'updated_at', v_row.updated_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.atlas_update_feedback_status(UUID, TEXT) TO anon, authenticated;
