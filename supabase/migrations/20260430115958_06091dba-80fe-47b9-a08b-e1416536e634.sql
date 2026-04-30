CREATE OR REPLACE FUNCTION public.get_sales_person_targets()
RETURNS TABLE(
  user_id uuid,
  segment text,
  month text,
  revenue_target numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    t.user_id,
    t.segment,
    t.month,
    t.revenue_target::numeric
  FROM public.targets t;
$function$;