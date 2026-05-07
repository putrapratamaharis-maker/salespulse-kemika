
-- Filter get_segment_invoices: only invoices with linked active deal
CREATE OR REPLACE FUNCTION public.get_segment_invoices()
RETURNS SETOF public.invoices
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT i.*
  FROM public.invoices i
  JOIN public.deals d ON d.id = i.deal_id
  WHERE i.deal_id IS NOT NULL
    AND d.stage NOT IN ('canceled'::deal_stage, 'lost'::deal_stage, 'closed_lost'::deal_stage);
$$;
