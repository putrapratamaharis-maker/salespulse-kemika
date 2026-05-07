
CREATE TABLE IF NOT EXISTS public.invoice_integrity_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at timestamptz NOT NULL DEFAULT now(),
  orphan_count integer NOT NULL DEFAULT 0,
  inactive_count integer NOT NULL DEFAULT 0,
  alerted boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS idx_iir_run_at ON public.invoice_integrity_runs (run_at DESC);
ALTER TABLE public.invoice_integrity_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read invoice_integrity_runs"
ON public.invoice_integrity_runs FOR SELECT TO authenticated
USING (get_user_system_role(auth.uid()) = ANY (ARRAY['super_admin'::system_role, 'admin'::system_role]));
