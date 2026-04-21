
-- 1) Admin-scoped UPDATE policy on profiles so admin edits work via RLS
CREATE POLICY "Admins can update any profile fields"
ON public.profiles
FOR UPDATE
TO authenticated
USING (public.get_user_system_role(auth.uid()) = ANY (ARRAY['super_admin'::system_role, 'admin'::system_role]))
WITH CHECK (public.get_user_system_role(auth.uid()) = ANY (ARRAY['super_admin'::system_role, 'admin'::system_role]));

-- 2) Prevent regular users from escalating themselves by changing privileged fields on own profile
CREATE OR REPLACE FUNCTION public.guard_profile_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _is_admin boolean;
BEGIN
  _is_admin := public.get_user_system_role(auth.uid()) = ANY (ARRAY['super_admin'::system_role, 'admin'::system_role]);

  -- Admins/super_admins are allowed to change privileged fields
  IF _is_admin THEN
    RETURN NEW;
  END IF;

  -- For self-update by non-admin: block changes to privileged fields
  IF NEW.supervisor_id IS DISTINCT FROM OLD.supervisor_id
     OR NEW.segment IS DISTINCT FROM OLD.segment
     OR NEW.region IS DISTINCT FROM OLD.region
     OR NEW.position_id IS DISTINCT FROM OLD.position_id
     OR NEW.division IS DISTINCT FROM OLD.division
     OR NEW.is_active IS DISTINCT FROM OLD.is_active
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.email IS DISTINCT FROM OLD.email
  THEN
    RAISE EXCEPTION 'Not allowed to modify privileged profile fields (supervisor_id, segment, region, position_id, division, is_active, user_id, email). Contact an administrator.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_profile_self_update_trg ON public.profiles;
CREATE TRIGGER guard_profile_self_update_trg
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.guard_profile_self_update();

-- 3) Restrict download_history policies to authenticated role only
DROP POLICY IF EXISTS "Admins can read all download history" ON public.download_history;
DROP POLICY IF EXISTS "Users can delete own download history" ON public.download_history;
DROP POLICY IF EXISTS "Users can insert own download history" ON public.download_history;
DROP POLICY IF EXISTS "Users can read own download history" ON public.download_history;

CREATE POLICY "Admins can read all download history"
ON public.download_history
FOR SELECT
TO authenticated
USING (public.get_user_system_role(auth.uid()) = ANY (ARRAY['super_admin'::system_role, 'admin'::system_role]));

CREATE POLICY "Users can delete own download history"
ON public.download_history
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own download history"
ON public.download_history
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own download history"
ON public.download_history
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- 4) Prevent a super_admin from demoting/removing themselves (lock-out protection)
CREATE OR REPLACE FUNCTION public.guard_user_roles_self_demotion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- Block super_admin from changing their own system_role away from super_admin
    IF OLD.user_id = auth.uid()
       AND OLD.system_role = 'super_admin'::system_role
       AND NEW.system_role IS DISTINCT FROM 'super_admin'::system_role
    THEN
      RAISE EXCEPTION 'Super admins cannot demote themselves. Have another super admin perform this change.'
        USING ERRCODE = '42501';
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    -- Block super_admin from deleting their own role row
    IF OLD.user_id = auth.uid()
       AND OLD.system_role = 'super_admin'::system_role
    THEN
      RAISE EXCEPTION 'Super admins cannot delete their own role. Have another super admin perform this change.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS guard_user_roles_self_demotion_trg ON public.user_roles;
CREATE TRIGGER guard_user_roles_self_demotion_trg
BEFORE UPDATE OR DELETE ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.guard_user_roles_self_demotion();
