CREATE OR REPLACE FUNCTION public.get_realtime_activities_for_user(_limit integer DEFAULT 8)
RETURNS TABLE(
  id uuid,
  type text,
  activity_date date,
  notes text,
  sales_id uuid,
  account_id uuid,
  created_at timestamptz,
  sales_name text,
  account_name text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _sys system_role;
  _org org_role;
  _is_admin boolean;
  _is_top boolean;
BEGIN
  IF _uid IS NULL THEN
    RETURN;
  END IF;

  SELECT system_role, org_role INTO _sys, _org
  FROM public.user_roles WHERE user_id = _uid LIMIT 1;

  _is_admin := _sys IN ('super_admin'::system_role, 'admin'::system_role);
  -- Treat sales_manager and representative_management (CEO/Mgmt) as company-wide viewers
  _is_top := _is_admin OR _org IN ('sales_manager'::org_role, 'representative_management'::org_role);

  RETURN QUERY
  SELECT
    sa.id, sa.type, sa.activity_date, sa.notes, sa.sales_id, sa.account_id, sa.created_at,
    p.full_name AS sales_name,
    a.name AS account_name
  FROM public.sales_activities sa
  LEFT JOIN public.profiles p ON p.user_id = sa.sales_id
  LEFT JOIN public.accounts a ON a.id = sa.account_id
  WHERE
    _is_top
    OR sa.sales_id = _uid
    OR (_org = 'supervisor'::org_role AND public.is_supervisor_of(_uid, sa.sales_id))
  ORDER BY sa.created_at DESC
  LIMIT GREATEST(_limit, 1);
END;
$$;