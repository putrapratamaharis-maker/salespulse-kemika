ALTER TABLE public.units
  ADD COLUMN IF NOT EXISTS code text DEFAULT '',
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;