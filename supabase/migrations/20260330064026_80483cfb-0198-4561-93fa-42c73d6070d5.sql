-- Fix 1: Restrict invoices SELECT to owner sales_id + admins
DROP POLICY IF EXISTS "Authenticated can read invoices" ON public.invoices;
CREATE POLICY "Users can read own or admin invoices"
ON public.invoices
FOR SELECT
TO authenticated
USING (
  auth.uid() = sales_id
  OR get_user_system_role(auth.uid()) IN ('super_admin'::system_role, 'admin'::system_role)
);

-- Fix 2: Make activity-evidence bucket private
UPDATE storage.buckets SET public = false WHERE id = 'activity-evidence';

-- Fix 3: Add WITH CHECK to user_roles UPDATE policy to prevent privilege escalation
DROP POLICY IF EXISTS "Only super_admin can update roles" ON public.user_roles;
CREATE POLICY "Only super_admin can update roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (has_system_role(auth.uid(), 'super_admin'::system_role))
WITH CHECK (has_system_role(auth.uid(), 'super_admin'::system_role));