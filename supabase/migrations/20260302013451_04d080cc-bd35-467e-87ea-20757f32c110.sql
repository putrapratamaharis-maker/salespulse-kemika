
-- Create kpi_master table
CREATE TABLE public.kpi_master (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  kpi_code text NOT NULL UNIQUE,
  kpi_name text NOT NULL,
  unit_type text NOT NULL DEFAULT 'Count' CHECK (unit_type IN ('IDR', '%', 'Count', 'Binary', 'Score 0-100')),
  calculation_type text NOT NULL DEFAULT 'MANUAL' CHECK (calculation_type IN ('AUTO', 'MANUAL', 'HYBRID')),
  direction text NOT NULL DEFAULT 'higher_is_better' CHECK (direction IN ('higher_is_better', 'lower_is_better')),
  default_cap numeric NULL,
  threshold_green numeric NOT NULL DEFAULT 100,
  threshold_yellow numeric NOT NULL DEFAULT 80,
  threshold_red numeric NOT NULL DEFAULT 60,
  definition_notes text NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.kpi_master ENABLE ROW LEVEL SECURITY;

-- Authenticated can read
CREATE POLICY "Authenticated can read kpi_master"
ON public.kpi_master FOR SELECT TO authenticated
USING (true);

-- Admins can manage
CREATE POLICY "Admins can manage kpi_master"
ON public.kpi_master FOR ALL TO authenticated
USING (get_user_system_role(auth.uid()) IN ('super_admin', 'admin'));

-- Updated_at trigger
CREATE TRIGGER update_kpi_master_updated_at
  BEFORE UPDATE ON public.kpi_master
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
