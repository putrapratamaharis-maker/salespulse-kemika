
CREATE OR REPLACE FUNCTION public.get_all_deals_pipeline()
RETURNS SETOF public.deals
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT * FROM public.deals;
$$;

CREATE OR REPLACE FUNCTION public.get_all_deal_products_pipeline()
RETURNS SETOF public.deal_products
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT * FROM public.deal_products;
$$;

CREATE OR REPLACE FUNCTION public.get_active_sales_profiles()
RETURNS TABLE(user_id uuid, full_name text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT p.user_id, p.full_name FROM public.profiles p WHERE p.is_active = true;
$$;
