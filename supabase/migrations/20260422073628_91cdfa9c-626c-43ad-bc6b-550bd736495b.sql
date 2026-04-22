-- 1. Audit log untuk semua event dari WMS
CREATE TABLE IF NOT EXISTS public.wms_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,         -- so_approved | so_updated | so_cancelled | so_deleted | customer_upsert | product_upsert
  reference_number text,            -- CRM reference if any
  wms_so_number text,               -- SO number from WMS if any
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'received',  -- received | processed | failed | ignored
  error_message text,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wms_sync_log_created_at ON public.wms_sync_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wms_sync_log_event_type ON public.wms_sync_log (event_type);
CREATE INDEX IF NOT EXISTS idx_wms_sync_log_reference ON public.wms_sync_log (reference_number);
CREATE INDEX IF NOT EXISTS idx_wms_sync_log_so_number ON public.wms_sync_log (wms_so_number);

ALTER TABLE public.wms_sync_log ENABLE ROW LEVEL SECURITY;

-- Only admins/super_admins can read the WMS audit log
CREATE POLICY "Admins can read wms_sync_log"
  ON public.wms_sync_log
  FOR SELECT
  TO authenticated
  USING (public.get_user_system_role(auth.uid()) = ANY (ARRAY['super_admin'::system_role, 'admin'::system_role]));

-- No INSERT/UPDATE/DELETE policy for end-users — only the service role (used by edge functions) can write.
-- Service role bypasses RLS, so we don't need an explicit policy for it.

-- 2. Extra fields on deals to track WMS cancel/update lifecycle
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS wms_cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS wms_cancel_reason text,
  ADD COLUMN IF NOT EXISTS wms_last_event_at timestamptz;