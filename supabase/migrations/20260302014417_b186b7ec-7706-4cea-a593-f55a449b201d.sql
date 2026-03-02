
-- 1. Positions table
CREATE TABLE public.positions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  position_code text NOT NULL UNIQUE,
  position_name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read positions" ON public.positions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage positions" ON public.positions
  FOR ALL TO authenticated
  USING (get_user_system_role(auth.uid()) = ANY (ARRAY['super_admin'::system_role, 'admin'::system_role]));

-- 2. KPI Templates table
CREATE TABLE public.kpi_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_name text NOT NULL,
  position_id uuid NOT NULL REFERENCES public.positions(id),
  year integer NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.kpi_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read kpi_templates" ON public.kpi_templates
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage kpi_templates" ON public.kpi_templates
  FOR ALL TO authenticated
  USING (get_user_system_role(auth.uid()) = ANY (ARRAY['super_admin'::system_role, 'admin'::system_role]));

-- 3. KPI Template Items table
CREATE TABLE public.kpi_template_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id uuid NOT NULL REFERENCES public.kpi_templates(id) ON DELETE CASCADE,
  kpi_id uuid NOT NULL REFERENCES public.kpi_master(id),
  weight_pct numeric NOT NULL DEFAULT 0 CHECK (weight_pct >= 0 AND weight_pct <= 100),
  baseline_annual_target_value numeric,
  baseline_annual_target_pct numeric,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.kpi_template_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read kpi_template_items" ON public.kpi_template_items
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage kpi_template_items" ON public.kpi_template_items
  FOR ALL TO authenticated
  USING (get_user_system_role(auth.uid()) = ANY (ARRAY['super_admin'::system_role, 'admin'::system_role]));

-- Triggers for updated_at
CREATE TRIGGER update_positions_updated_at BEFORE UPDATE ON public.positions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_kpi_templates_updated_at BEFORE UPDATE ON public.kpi_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
