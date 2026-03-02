
-- Create source enum type
CREATE TYPE public.kpi_target_source AS ENUM ('MANUAL', 'IMPORT', 'AUTO');

-- Create kpi_monthly_targets table
CREATE TABLE public.kpi_monthly_targets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  kpi_id UUID NOT NULL REFERENCES public.kpi_master(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  target_value NUMERIC NULL,
  target_pct NUMERIC NULL,
  source kpi_target_source NOT NULL DEFAULT 'MANUAL',
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, kpi_id, year, month)
);

-- Enable RLS
ALTER TABLE public.kpi_monthly_targets ENABLE ROW LEVEL SECURITY;

-- RLS: Admins can manage
CREATE POLICY "Admins can manage kpi_monthly_targets"
ON public.kpi_monthly_targets
FOR ALL
TO authenticated
USING (get_user_system_role(auth.uid()) = ANY (ARRAY['super_admin'::system_role, 'admin'::system_role]));

-- RLS: Users can read own targets
CREATE POLICY "Users can read own monthly targets"
ON public.kpi_monthly_targets
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR get_user_system_role(auth.uid()) = ANY (ARRAY['super_admin'::system_role, 'admin'::system_role])
);

-- Trigger for updated_at
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.kpi_monthly_targets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
