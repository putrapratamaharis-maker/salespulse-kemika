-- Fix: staff users (salesperson) tidak bisa melihat akun existing saat membuat lead baru.
-- Root cause: get_accounts_with_pic_for_user hanya return akun milik sendiri / supervisor /
-- punya deal. User baru dengan role 'staff' yang belum punya akun/deal tidak mendapat hasil.
-- Fix: tambahkan kondisi _is_staff agar semua staff bisa melihat semua akun (standar CRM).

CREATE OR REPLACE FUNCTION public.get_accounts_with_pic_for_user()
 RETURNS TABLE(
   id uuid,
   name text,
   segment text,
   type text,
   region text,
   city text,
   status text,
   customer_id text,
   sales_id uuid,
   pic_name text,
   pic_email text,
   pic_contact text
 )
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _is_admin boolean;
  _is_staff boolean;
BEGIN
  _is_admin := public.get_user_system_role(auth.uid()) = ANY (ARRAY['super_admin'::system_role, 'admin'::system_role]);
  _is_staff := public.get_user_system_role(auth.uid()) = 'staff'::system_role;

  RETURN QUERY
  SELECT a.id, a.name, a.segment, a.type, a.region, a.city, a.status, a.customer_id, a.sales_id,
         a.pic_name, a.pic_email, a.pic_contact
  FROM public.accounts a
  WHERE _is_admin
     OR _is_staff
     OR a.sales_id = auth.uid()
     OR public.is_supervisor_of(auth.uid(), a.sales_id)
     OR EXISTS (
       SELECT 1 FROM public.deals d
       WHERE d.account_id = a.id AND d.sales_id = auth.uid()
     );
END;
$function$;
