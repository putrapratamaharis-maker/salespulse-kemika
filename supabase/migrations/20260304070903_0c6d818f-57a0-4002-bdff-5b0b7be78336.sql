
-- Create units table for managing unit options
CREATE TABLE public.units (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;

-- Everyone can read
CREATE POLICY "Authenticated can read units"
ON public.units FOR SELECT
TO authenticated
USING (true);

-- Admins can manage
CREATE POLICY "Admins can manage units"
ON public.units FOR ALL
TO authenticated
USING (get_user_system_role(auth.uid()) = ANY (ARRAY['super_admin'::system_role, 'admin'::system_role]));

-- Seed default units
INSERT INTO public.units (name) VALUES
  ('pcs'), ('unit'), ('set'), ('lot'), ('pack'), ('box'), ('roll'), ('meter'), ('kg'), ('liter');
