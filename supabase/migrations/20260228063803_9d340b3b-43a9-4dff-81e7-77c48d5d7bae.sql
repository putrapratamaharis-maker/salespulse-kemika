
-- KPI data source enum
CREATE TYPE public.kpi_data_source AS ENUM (
  'revenue_achievement',
  'margin_compliance',
  'win_rate',
  'pipeline_health',
  'activity_count',
  'team_activity_compliance',
  'coaching_notes_given',
  'rep_coverage',
  'deal_volume',
  'avg_deal_size',
  'collection_rate',
  'segment_specific'
);

-- KPI Definitions: what KPIs exist, for which roles, with defaults
CREATE TABLE public.kpi_definitions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  org_role org_role NOT NULL,
  data_source kpi_data_source NOT NULL,
  default_weight INTEGER NOT NULL DEFAULT 0,
  default_target NUMERIC NOT NULL DEFAULT 0,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kpi_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage kpi_definitions"
  ON public.kpi_definitions FOR ALL
  USING (get_user_system_role(auth.uid()) IN ('super_admin', 'admin'));

CREATE POLICY "Authenticated can read kpi_definitions"
  ON public.kpi_definitions FOR SELECT
  USING (true);

-- Per-user KPI config: overrides weight/target per user per month
CREATE TABLE public.kpi_user_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  kpi_definition_id UUID NOT NULL REFERENCES public.kpi_definitions(id) ON DELETE CASCADE,
  weight INTEGER,
  target NUMERIC,
  month TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, kpi_definition_id, month)
);

ALTER TABLE public.kpi_user_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage kpi_user_configs"
  ON public.kpi_user_configs FOR ALL
  USING (get_user_system_role(auth.uid()) IN ('super_admin', 'admin'));

CREATE POLICY "Users can read own kpi_user_configs"
  ON public.kpi_user_configs FOR SELECT
  USING (auth.uid() = user_id OR get_user_system_role(auth.uid()) IN ('super_admin', 'admin'));

CREATE TRIGGER update_kpi_user_configs_updated_at
  BEFORE UPDATE ON public.kpi_user_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
