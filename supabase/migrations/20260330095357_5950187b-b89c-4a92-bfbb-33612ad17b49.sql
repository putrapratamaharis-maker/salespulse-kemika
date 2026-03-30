
-- Allow super_admin and admin to update any profile
CREATE POLICY "Admins can update profiles"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (get_user_system_role(auth.uid()) = ANY (ARRAY['super_admin'::system_role, 'admin'::system_role]))
  WITH CHECK (get_user_system_role(auth.uid()) = ANY (ARRAY['super_admin'::system_role, 'admin'::system_role]));

-- Allow super_admin to delete profiles
CREATE POLICY "Admins can delete profiles"
  ON public.profiles FOR DELETE
  TO authenticated
  USING (get_user_system_role(auth.uid()) = ANY (ARRAY['super_admin'::system_role, 'admin'::system_role]));

-- Allow super_admin to delete user_roles
CREATE POLICY "Super admin can delete roles"
  ON public.user_roles FOR DELETE
  TO authenticated
  USING (has_system_role(auth.uid(), 'super_admin'::system_role));
