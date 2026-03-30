
-- 1. Create a security definer function to check supervisor chain (up to 5 levels)
CREATE OR REPLACE FUNCTION public.is_supervisor_of(_supervisor_user_id uuid, _target_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH RECURSIVE chain AS (
    -- Start from target user's profile
    SELECT p.supervisor_id, p.id AS profile_id, 1 AS depth
    FROM public.profiles p
    WHERE p.user_id = _target_user_id
    
    UNION ALL
    
    -- Walk up the supervisor chain
    SELECT p.supervisor_id, p.id AS profile_id, c.depth + 1
    FROM chain c
    JOIN public.profiles p ON p.id = c.supervisor_id
    WHERE c.depth < 5 AND c.supervisor_id IS NOT NULL
  )
  SELECT EXISTS (
    SELECT 1 FROM chain c
    JOIN public.profiles sp ON sp.id = c.supervisor_id
    WHERE sp.user_id = _supervisor_user_id
  )
$$;

-- 2. Update deals SELECT: owner + supervisor chain + admins
DROP POLICY IF EXISTS "Authenticated can read deals" ON public.deals;
CREATE POLICY "Users can read authorized deals" ON public.deals
  FOR SELECT TO authenticated
  USING (
    auth.uid() = sales_id
    OR is_supervisor_of(auth.uid(), sales_id)
    OR get_user_system_role(auth.uid()) IN ('super_admin'::system_role, 'admin'::system_role)
  );

-- 3. Update accounts SELECT: owner + supervisor chain + admins
DROP POLICY IF EXISTS "Authenticated can read accounts" ON public.accounts;
CREATE POLICY "Users can read authorized accounts" ON public.accounts
  FOR SELECT TO authenticated
  USING (
    auth.uid() = sales_id
    OR is_supervisor_of(auth.uid(), sales_id)
    OR get_user_system_role(auth.uid()) IN ('super_admin'::system_role, 'admin'::system_role)
  );

-- 4. Update sales_activities SELECT: owner + supervisor chain + admins
DROP POLICY IF EXISTS "Authenticated can read sales_activities" ON public.sales_activities;
CREATE POLICY "Users can read authorized activities" ON public.sales_activities
  FOR SELECT TO authenticated
  USING (
    auth.uid() = sales_id
    OR is_supervisor_of(auth.uid(), sales_id)
    OR get_user_system_role(auth.uid()) IN ('super_admin'::system_role, 'admin'::system_role)
  );

-- 5. Update targets SELECT: owner + supervisor chain + admins
DROP POLICY IF EXISTS "Authenticated can read targets" ON public.targets;
CREATE POLICY "Users can read authorized targets" ON public.targets
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR is_supervisor_of(auth.uid(), user_id)
    OR get_user_system_role(auth.uid()) IN ('super_admin'::system_role, 'admin'::system_role)
  );

-- 6. Update profiles SELECT: own + subordinates + admins (keep broader for name lookups)
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
CREATE POLICY "Users can read authorized profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR is_supervisor_of(auth.uid(), user_id)
    OR get_user_system_role(auth.uid()) IN ('super_admin'::system_role, 'admin'::system_role)
  );

-- 7. Fix storage: restrict evidence reads to owner, add UPDATE policy
DROP POLICY IF EXISTS "Authenticated can read evidence" ON storage.objects;
CREATE POLICY "Users can read own evidence" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'activity-evidence'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can update own evidence" ON storage.objects;
CREATE POLICY "Users can update own evidence" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'activity-evidence'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
