
-- Add new columns to accounts table
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS pic_name text NOT NULL DEFAULT '';
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS pic_contact text NOT NULL DEFAULT '';
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS pic_email text NOT NULL DEFAULT '';
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'Active';
