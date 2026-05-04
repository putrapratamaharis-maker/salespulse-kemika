REVOKE ALL ON FUNCTION public.get_sales_person_targets() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_sales_person_targets() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_sales_person_targets() TO authenticated;