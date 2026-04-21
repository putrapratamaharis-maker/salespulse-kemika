
-- 1. Add admin-only role guard to SECURITY DEFINER RPCs
CREATE OR REPLACE FUNCTION public.get_all_deals_pipeline()
 RETURNS SETOF public.deals
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF public.get_user_system_role(auth.uid()) NOT IN ('super_admin'::system_role, 'admin'::system_role) THEN
    RETURN;
  END IF;
  RETURN QUERY SELECT * FROM public.deals;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_all_deal_products_pipeline()
 RETURNS SETOF public.deal_products
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF public.get_user_system_role(auth.uid()) NOT IN ('super_admin'::system_role, 'admin'::system_role) THEN
    RETURN;
  END IF;
  RETURN QUERY SELECT * FROM public.deal_products;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_segment_invoices()
 RETURNS SETOF public.invoices
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF public.get_user_system_role(auth.uid()) NOT IN ('super_admin'::system_role, 'admin'::system_role) THEN
    RETURN;
  END IF;
  RETURN QUERY SELECT * FROM public.invoices;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_segment_deals()
 RETURNS TABLE(value numeric, stage public.deal_stage, segment text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF public.get_user_system_role(auth.uid()) NOT IN ('super_admin'::system_role, 'admin'::system_role) THEN
    RETURN;
  END IF;
  RETURN QUERY SELECT d.value, d.stage, d.segment FROM public.deals d;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_segment_targets()
 RETURNS TABLE(revenue_target numeric, segment text, month text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF public.get_user_system_role(auth.uid()) NOT IN ('super_admin'::system_role, 'admin'::system_role) THEN
    RETURN;
  END IF;
  RETURN QUERY SELECT t.revenue_target::numeric, t.segment, t.month FROM public.targets t;
END;
$function$;

-- 2. Restrict accounts SELECT to owner/supervisor/admin (full row including PIC contact details)
DROP POLICY IF EXISTS "All authenticated users can read accounts" ON public.accounts;
DROP POLICY IF EXISTS "Users can read authorized accounts" ON public.accounts;

CREATE POLICY "Users can read authorized accounts"
ON public.accounts
FOR SELECT
TO authenticated
USING (
  (auth.uid() = sales_id)
  OR public.is_supervisor_of(auth.uid(), sales_id)
  OR (public.get_user_system_role(auth.uid()) = ANY (ARRAY['super_admin'::system_role, 'admin'::system_role]))
);

-- 3. Helper RPC exposing non-PII account fields to all authenticated users (no email/phone/PIC name)
CREATE OR REPLACE FUNCTION public.get_accounts_basic()
 RETURNS TABLE(
   id uuid,
   name text,
   segment text,
   type text,
   region text,
   city text,
   status text,
   customer_id text,
   sales_id uuid
 )
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT a.id, a.name, a.segment, a.type, a.region, a.city, a.status, a.customer_id, a.sales_id
  FROM public.accounts a;
$function$;

-- 4. Storage policies for avatars bucket (drop public, restrict listing to authenticated)
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Avatars are readable by authenticated users" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload to their own avatar folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;

CREATE POLICY "Avatars are readable by authenticated users"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload to their own avatar folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (auth.uid()::text = (storage.foldername(name))[1] OR public.get_user_system_role(auth.uid()) = ANY (ARRAY['super_admin'::system_role, 'admin'::system_role]))
);

CREATE POLICY "Users can update their own avatar"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (auth.uid()::text = (storage.foldername(name))[1] OR public.get_user_system_role(auth.uid()) = ANY (ARRAY['super_admin'::system_role, 'admin'::system_role]))
);

CREATE POLICY "Users can delete their own avatar"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (auth.uid()::text = (storage.foldername(name))[1] OR public.get_user_system_role(auth.uid()) = ANY (ARRAY['super_admin'::system_role, 'admin'::system_role]))
);

-- 5. Storage policies for report-files bucket (admin management + user own access)
DROP POLICY IF EXISTS "Users can read own report files" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own report files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own report files" ON storage.objects;
DROP POLICY IF EXISTS "Users and admins can delete report files" ON storage.objects;

CREATE POLICY "Users can read own report files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'report-files'
  AND (auth.uid()::text = (storage.foldername(name))[1] OR public.get_user_system_role(auth.uid()) = ANY (ARRAY['super_admin'::system_role, 'admin'::system_role]))
);

CREATE POLICY "Users can upload own report files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'report-files'
  AND (auth.uid()::text = (storage.foldername(name))[1] OR public.get_user_system_role(auth.uid()) = ANY (ARRAY['super_admin'::system_role, 'admin'::system_role]))
);

CREATE POLICY "Users can update own report files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'report-files'
  AND (auth.uid()::text = (storage.foldername(name))[1] OR public.get_user_system_role(auth.uid()) = ANY (ARRAY['super_admin'::system_role, 'admin'::system_role]))
);

CREATE POLICY "Users and admins can delete report files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'report-files'
  AND (auth.uid()::text = (storage.foldername(name))[1] OR public.get_user_system_role(auth.uid()) = ANY (ARRAY['super_admin'::system_role, 'admin'::system_role]))
);
