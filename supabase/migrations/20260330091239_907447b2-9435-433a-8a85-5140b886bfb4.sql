ALTER TABLE public.product_categories
  ADD COLUMN IF NOT EXISTS code text DEFAULT '',
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;