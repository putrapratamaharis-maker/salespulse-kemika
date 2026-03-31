
-- Create deal_products table to persist product/item data for each deal
CREATE TABLE public.deal_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT '',
  product_name text NOT NULL DEFAULT '',
  unit text NOT NULL DEFAULT 'pcs',
  qty integer NOT NULL DEFAULT 1,
  price_per_unit numeric NOT NULL DEFAULT 0,
  other_cost numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.deal_products ENABLE ROW LEVEL SECURITY;

-- Users can read deal_products for their own deals
CREATE POLICY "Users can read own deal_products" ON public.deal_products
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.deals WHERE deals.id = deal_products.deal_id AND deals.sales_id = auth.uid())
    OR (get_user_system_role(auth.uid()) = ANY (ARRAY['super_admin'::system_role, 'admin'::system_role]))
  );

-- Users can insert deal_products for their own deals
CREATE POLICY "Users can insert own deal_products" ON public.deal_products
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.deals WHERE deals.id = deal_products.deal_id AND deals.sales_id = auth.uid())
    OR (get_user_system_role(auth.uid()) = ANY (ARRAY['super_admin'::system_role, 'admin'::system_role]))
  );

-- Users can update deal_products for their own deals
CREATE POLICY "Users can update own deal_products" ON public.deal_products
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.deals WHERE deals.id = deal_products.deal_id AND deals.sales_id = auth.uid())
    OR (get_user_system_role(auth.uid()) = ANY (ARRAY['super_admin'::system_role, 'admin'::system_role]))
  );

-- Users can delete deal_products for their own deals
CREATE POLICY "Users can delete own deal_products" ON public.deal_products
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.deals WHERE deals.id = deal_products.deal_id AND deals.sales_id = auth.uid())
    OR (get_user_system_role(auth.uid()) = ANY (ARRAY['super_admin'::system_role, 'admin'::system_role]))
  );

-- Also add expected_margin column to deals table
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS expected_margin numeric DEFAULT 0;
-- Add location column to deals table
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS location text DEFAULT '';
-- Add notes column to deals table
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS notes text DEFAULT '';
