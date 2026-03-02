
-- 1. Add position_id to profiles for clean user→position mapping
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS position_id uuid REFERENCES public.positions(id);

-- 2. Create enum for KPI result status
DO $$ BEGIN
  CREATE TYPE public.kpi_result_status AS ENUM ('GREEN', 'YELLOW', 'RED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.kpi_total_status AS ENUM ('EXCELLENT', 'ON_TRACK', 'NEED_IMPROVEMENT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. Create kpi_results_monthly table
CREATE TABLE IF NOT EXISTS public.kpi_results_monthly (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kpi_id uuid NOT NULL REFERENCES public.kpi_master(id),
  year integer NOT NULL,
  month integer NOT NULL CHECK (month BETWEEN 1 AND 12),
  target_value numeric,
  target_pct numeric,
  actual_value numeric,
  actual_pct numeric,
  achievement_ratio numeric DEFAULT 0,
  achievement_pct numeric DEFAULT 0,
  weight_pct numeric DEFAULT 0,
  weighted_score numeric DEFAULT 0,
  status public.kpi_result_status DEFAULT 'RED',
  calculated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, kpi_id, year, month)
);

-- 4. Create kpi_total_score_monthly table
CREATE TABLE IF NOT EXISTS public.kpi_total_score_monthly (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  year integer NOT NULL,
  month integer NOT NULL CHECK (month BETWEEN 1 AND 12),
  total_score numeric DEFAULT 0,
  status public.kpi_total_status DEFAULT 'NEED_IMPROVEMENT',
  calculated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, year, month)
);

-- 5. Create kpi_submissions table (for MANUAL/HYBRID KPI)
CREATE TABLE IF NOT EXISTS public.kpi_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kpi_id uuid NOT NULL REFERENCES public.kpi_master(id),
  year integer NOT NULL,
  month integer NOT NULL CHECK (month BETWEEN 1 AND 12),
  submitted_value numeric,
  evidence_url text,
  notes text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, kpi_id, year, month)
);

-- 6. Enable RLS
ALTER TABLE public.kpi_results_monthly ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_total_score_monthly ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_submissions ENABLE ROW LEVEL SECURITY;

-- 7. RLS policies for kpi_results_monthly
CREATE POLICY "Admins can manage kpi_results" ON public.kpi_results_monthly
  FOR ALL USING (get_user_system_role(auth.uid()) IN ('super_admin', 'admin'));

CREATE POLICY "Users can read own kpi_results" ON public.kpi_results_monthly
  FOR SELECT USING (
    auth.uid() = user_id 
    OR get_user_system_role(auth.uid()) IN ('super_admin', 'admin')
  );

-- 8. RLS policies for kpi_total_score_monthly
CREATE POLICY "Admins can manage kpi_totals" ON public.kpi_total_score_monthly
  FOR ALL USING (get_user_system_role(auth.uid()) IN ('super_admin', 'admin'));

CREATE POLICY "Users can read own kpi_totals" ON public.kpi_total_score_monthly
  FOR SELECT USING (
    auth.uid() = user_id 
    OR get_user_system_role(auth.uid()) IN ('super_admin', 'admin')
  );

-- 9. RLS policies for kpi_submissions
CREATE POLICY "Users can manage own submissions" ON public.kpi_submissions
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all submissions" ON public.kpi_submissions
  FOR ALL USING (get_user_system_role(auth.uid()) IN ('super_admin', 'admin'));

CREATE POLICY "Supervisors can read team submissions" ON public.kpi_submissions
  FOR SELECT USING (
    get_user_system_role(auth.uid()) IN ('super_admin', 'admin')
    OR auth.uid() = user_id
  );

-- 10. Updated_at trigger for kpi_submissions
CREATE TRIGGER update_kpi_submissions_updated_at
  BEFORE UPDATE ON public.kpi_submissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
