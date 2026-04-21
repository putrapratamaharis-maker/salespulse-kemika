-- Fix duplikat customer_id lama (suffix -DUP pada record yang lebih baru)
WITH dups AS (
  SELECT id, customer_id,
    ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY created_at ASC) AS rn
  FROM public.accounts
  WHERE customer_id IS NOT NULL AND customer_id != ''
)
UPDATE public.accounts a
SET customer_id = a.customer_id || '-DUP' || (d.rn - 1)::text
FROM dups d
WHERE a.id = d.id AND d.rn > 1;

-- Unique partial index untuk support upsert by customer_id (WMS code)
CREATE UNIQUE INDEX IF NOT EXISTS accounts_customer_id_unique
  ON public.accounts (customer_id)
  WHERE customer_id IS NOT NULL AND customer_id != '';

-- Unique partial index untuk support upsert by SKU
CREATE UNIQUE INDEX IF NOT EXISTS products_sku_unique
  ON public.products (sku)
  WHERE sku IS NOT NULL AND sku != '';

-- Helper function: cari sales_id default untuk akun yang di-sync dari WMS
CREATE OR REPLACE FUNCTION public.get_default_sync_sales_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ur.user_id
  FROM public.user_roles ur
  JOIN public.profiles p ON p.user_id = ur.user_id
  WHERE p.is_active = true
  ORDER BY
    CASE ur.system_role
      WHEN 'super_admin' THEN 1
      WHEN 'admin' THEN 2
      ELSE 3
    END,
    p.created_at ASC
  LIMIT 1
$$;