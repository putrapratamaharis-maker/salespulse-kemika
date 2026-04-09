
CREATE OR REPLACE FUNCTION public.get_segment_invoices()
RETURNS SETOF public.invoices
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.invoices;
$$;

CREATE OR REPLACE FUNCTION public.get_segment_deals()
RETURNS TABLE(value numeric, stage public.deal_stage, segment text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT value, stage, segment FROM public.deals;
$$;

CREATE OR REPLACE FUNCTION public.get_segment_targets()
RETURNS TABLE(revenue_target numeric, segment text, month text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT revenue_target, segment, month FROM public.targets;
$$;
