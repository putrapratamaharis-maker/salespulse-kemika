
-- Replace the permissive INSERT policy with a more restrictive one
DROP POLICY "System can insert audit_logs" ON public.audit_logs;

-- Only admin/super_admin can trigger inserts (though actual inserts come from the SECURITY DEFINER trigger)
CREATE POLICY "Admins can insert audit_logs"
  ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (get_user_system_role(auth.uid()) IN ('super_admin'::system_role, 'admin'::system_role));
