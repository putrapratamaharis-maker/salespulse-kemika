
-- Add new org_role enum values
ALTER TYPE public.org_role ADD VALUE IF NOT EXISTS 'ceo_director';
ALTER TYPE public.org_role ADD VALUE IF NOT EXISTS 'commissioner';
ALTER TYPE public.org_role ADD VALUE IF NOT EXISTS 'manager';
ALTER TYPE public.org_role ADD VALUE IF NOT EXISTS 'staff_operational';

-- Add is_active column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
