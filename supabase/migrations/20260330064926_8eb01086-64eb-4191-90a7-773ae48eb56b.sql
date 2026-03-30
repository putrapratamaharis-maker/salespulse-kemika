
-- Fix PUBLIC_DATA_EXPOSURE: Change all RLS policies from TO public to TO authenticated

-- ===== accounts =====
DROP POLICY IF EXISTS "Authenticated can read accounts" ON public.accounts;
CREATE POLICY "Authenticated can read accounts" ON public.accounts FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins can manage accounts" ON public.accounts;
CREATE POLICY "Admins can manage accounts" ON public.accounts FOR ALL TO authenticated USING (get_user_system_role(auth.uid()) = ANY (ARRAY['super_admin'::system_role, 'admin'::system_role]));

DROP POLICY IF EXISTS "Users can delete own accounts" ON public.accounts;
CREATE POLICY "Users can delete own accounts" ON public.accounts FOR DELETE TO authenticated USING (auth.uid() = sales_id);

-- ===== sales_activities =====
DROP POLICY IF EXISTS "Authenticated can read sales_activities" ON public.sales_activities;
CREATE POLICY "Authenticated can read sales_activities" ON public.sales_activities FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins can manage sales_activities" ON public.sales_activities;
CREATE POLICY "Admins can manage sales_activities" ON public.sales_activities FOR ALL TO authenticated USING (get_user_system_role(auth.uid()) = ANY (ARRAY['super_admin'::system_role, 'admin'::system_role]));

DROP POLICY IF EXISTS "Users can delete own activities" ON public.sales_activities;
CREATE POLICY "Users can delete own activities" ON public.sales_activities FOR DELETE TO authenticated USING (auth.uid() = sales_id);

DROP POLICY IF EXISTS "Users can insert own activities" ON public.sales_activities;
CREATE POLICY "Users can insert own activities" ON public.sales_activities FOR INSERT TO authenticated WITH CHECK (auth.uid() = sales_id);

DROP POLICY IF EXISTS "Users can update own activities" ON public.sales_activities;
CREATE POLICY "Users can update own activities" ON public.sales_activities FOR UPDATE TO authenticated USING (auth.uid() = sales_id);

-- ===== deals =====
DROP POLICY IF EXISTS "Authenticated can read deals" ON public.deals;
CREATE POLICY "Authenticated can read deals" ON public.deals FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins can manage deals" ON public.deals;
CREATE POLICY "Admins can manage deals" ON public.deals FOR ALL TO authenticated USING (get_user_system_role(auth.uid()) = ANY (ARRAY['super_admin'::system_role, 'admin'::system_role]));

-- ===== targets =====
DROP POLICY IF EXISTS "Authenticated can read targets" ON public.targets;
CREATE POLICY "Authenticated can read targets" ON public.targets FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins can manage targets" ON public.targets;
CREATE POLICY "Admins can manage targets" ON public.targets FOR ALL TO authenticated USING (get_user_system_role(auth.uid()) = ANY (ARRAY['super_admin'::system_role, 'admin'::system_role]));

-- ===== kpi_definitions =====
DROP POLICY IF EXISTS "Authenticated can read kpi_definitions" ON public.kpi_definitions;
CREATE POLICY "Authenticated can read kpi_definitions" ON public.kpi_definitions FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins can manage kpi_definitions" ON public.kpi_definitions;
CREATE POLICY "Admins can manage kpi_definitions" ON public.kpi_definitions FOR ALL TO authenticated USING (get_user_system_role(auth.uid()) = ANY (ARRAY['super_admin'::system_role, 'admin'::system_role]));

-- ===== invoices (fix remaining public-scoped admin policy) =====
DROP POLICY IF EXISTS "Admins can manage invoices" ON public.invoices;
CREATE POLICY "Admins can manage invoices" ON public.invoices FOR ALL TO authenticated USING (get_user_system_role(auth.uid()) = ANY (ARRAY['super_admin'::system_role, 'admin'::system_role]));

-- ===== kpi_submissions =====
DROP POLICY IF EXISTS "Admins can manage all submissions" ON public.kpi_submissions;
CREATE POLICY "Admins can manage all submissions" ON public.kpi_submissions FOR ALL TO authenticated USING (get_user_system_role(auth.uid()) = ANY (ARRAY['super_admin'::system_role, 'admin'::system_role]));

DROP POLICY IF EXISTS "Supervisors can read team submissions" ON public.kpi_submissions;
CREATE POLICY "Supervisors can read team submissions" ON public.kpi_submissions FOR SELECT TO authenticated USING ((get_user_system_role(auth.uid()) = ANY (ARRAY['super_admin'::system_role, 'admin'::system_role])) OR (auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can manage own submissions" ON public.kpi_submissions;
CREATE POLICY "Users can manage own submissions" ON public.kpi_submissions FOR ALL TO authenticated USING (auth.uid() = user_id);

-- ===== kpi_results_monthly =====
DROP POLICY IF EXISTS "Admins can manage kpi_results" ON public.kpi_results_monthly;
CREATE POLICY "Admins can manage kpi_results" ON public.kpi_results_monthly FOR ALL TO authenticated USING (get_user_system_role(auth.uid()) = ANY (ARRAY['super_admin'::system_role, 'admin'::system_role]));

DROP POLICY IF EXISTS "Users can read own kpi_results" ON public.kpi_results_monthly;
CREATE POLICY "Users can read own kpi_results" ON public.kpi_results_monthly FOR SELECT TO authenticated USING ((auth.uid() = user_id) OR (get_user_system_role(auth.uid()) = ANY (ARRAY['super_admin'::system_role, 'admin'::system_role])));

-- ===== kpi_total_score_monthly =====
DROP POLICY IF EXISTS "Admins can manage kpi_totals" ON public.kpi_total_score_monthly;
CREATE POLICY "Admins can manage kpi_totals" ON public.kpi_total_score_monthly FOR ALL TO authenticated USING (get_user_system_role(auth.uid()) = ANY (ARRAY['super_admin'::system_role, 'admin'::system_role]));

DROP POLICY IF EXISTS "Users can read own kpi_totals" ON public.kpi_total_score_monthly;
CREATE POLICY "Users can read own kpi_totals" ON public.kpi_total_score_monthly FOR SELECT TO authenticated USING ((auth.uid() = user_id) OR (get_user_system_role(auth.uid()) = ANY (ARRAY['super_admin'::system_role, 'admin'::system_role])));

-- ===== kpi_user_configs =====
DROP POLICY IF EXISTS "Admins can manage kpi_user_configs" ON public.kpi_user_configs;
CREATE POLICY "Admins can manage kpi_user_configs" ON public.kpi_user_configs FOR ALL TO authenticated USING (get_user_system_role(auth.uid()) = ANY (ARRAY['super_admin'::system_role, 'admin'::system_role]));

DROP POLICY IF EXISTS "Users can read own kpi_user_configs" ON public.kpi_user_configs;
CREATE POLICY "Users can read own kpi_user_configs" ON public.kpi_user_configs FOR SELECT TO authenticated USING ((auth.uid() = user_id) OR (get_user_system_role(auth.uid()) = ANY (ARRAY['super_admin'::system_role, 'admin'::system_role])));
