
-- 1. Add customer_id column to accounts table
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS customer_id text DEFAULT '';

-- 2. Add division column to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS division text DEFAULT '';
