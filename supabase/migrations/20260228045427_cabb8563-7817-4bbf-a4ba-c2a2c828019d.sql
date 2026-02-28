
-- Product categories table
CREATE TABLE public.product_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Products table
CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  sku TEXT UNIQUE,
  category_id UUID REFERENCES public.product_categories(id) ON DELETE SET NULL,
  price BIGINT NOT NULL DEFAULT 0,
  unit TEXT DEFAULT 'pcs',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Product sales (aggregated per product per month)
CREATE TABLE public.product_sales (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  month TEXT NOT NULL, -- YYYY-MM
  revenue BIGINT NOT NULL DEFAULT 0,
  units_sold INTEGER NOT NULL DEFAULT 0,
  segment TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(product_id, month, segment)
);

-- Enable RLS
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_sales ENABLE ROW LEVEL SECURITY;

-- RLS: authenticated users can read all product data
CREATE POLICY "Authenticated can read categories" ON public.product_categories
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage categories" ON public.product_categories
  FOR ALL TO authenticated USING (
    public.get_user_system_role(auth.uid()) IN ('super_admin', 'admin')
  );

CREATE POLICY "Authenticated can read products" ON public.products
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage products" ON public.products
  FOR ALL TO authenticated USING (
    public.get_user_system_role(auth.uid()) IN ('super_admin', 'admin')
  );

CREATE POLICY "Authenticated can read product_sales" ON public.product_sales
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage product_sales" ON public.product_sales
  FOR ALL TO authenticated USING (
    public.get_user_system_role(auth.uid()) IN ('super_admin', 'admin')
  );

-- Trigger for updated_at on products
CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
