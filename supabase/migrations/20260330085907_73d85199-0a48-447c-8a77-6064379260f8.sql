ALTER TABLE public.products ADD COLUMN IF NOT EXISTS purchase_price numeric DEFAULT 0, ADD COLUMN IF NOT EXISTS selling_price numeric DEFAULT 0;

UPDATE public.products SET purchase_price = price WHERE purchase_price = 0 AND price > 0;