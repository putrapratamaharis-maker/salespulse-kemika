
-- Fix FK constraints to cascade delete
ALTER TABLE public.sales_activities DROP CONSTRAINT sales_activities_account_id_fkey;
ALTER TABLE public.sales_activities ADD CONSTRAINT sales_activities_account_id_fkey 
  FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;

ALTER TABLE public.deals DROP CONSTRAINT deals_account_id_fkey;
ALTER TABLE public.deals ADD CONSTRAINT deals_account_id_fkey 
  FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;

ALTER TABLE public.invoices DROP CONSTRAINT invoices_account_id_fkey;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_account_id_fkey 
  FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;

-- Fix accounts visibility: all authenticated users can read all accounts
DROP POLICY IF EXISTS "Users can read authorized accounts" ON public.accounts;
CREATE POLICY "All authenticated users can read accounts" ON public.accounts
  FOR SELECT TO authenticated USING (true);

-- Also allow admins to delete any account (not just own)
DROP POLICY IF EXISTS "Users can delete own accounts" ON public.accounts;
CREATE POLICY "Users can delete own or admin accounts" ON public.accounts
  FOR DELETE TO authenticated USING (
    auth.uid() = sales_id 
    OR get_user_system_role(auth.uid()) = ANY (ARRAY['super_admin'::system_role, 'admin'::system_role])
  );
