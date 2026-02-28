
-- Create deal_stage enum
CREATE TYPE public.deal_stage AS ENUM ('prospect', 'qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost');

-- Create accounts table
CREATE TABLE public.accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  segment text NOT NULL DEFAULT 'B2B',
  region text NOT NULL DEFAULT '',
  sales_id uuid NOT NULL,
  type text NOT NULL DEFAULT 'Corporate',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create deals table
CREATE TABLE public.deals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE NOT NULL,
  sales_id uuid NOT NULL,
  name text NOT NULL,
  segment text NOT NULL DEFAULT 'B2B',
  stage deal_stage NOT NULL DEFAULT 'prospect',
  value bigint NOT NULL DEFAULT 0,
  probability integer NOT NULL DEFAULT 0,
  expected_close_date date NOT NULL,
  days_in_stage integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create invoices table
CREATE TABLE public.invoices (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE NOT NULL,
  sales_id uuid NOT NULL,
  invoice_number text NOT NULL,
  net_sales bigint NOT NULL DEFAULT 0,
  gross_profit bigint NOT NULL DEFAULT 0,
  issue_date date NOT NULL,
  due_date date NOT NULL,
  paid_date date,
  segment text NOT NULL DEFAULT 'B2B',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create targets table
CREATE TABLE public.targets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  segment text NOT NULL DEFAULT 'B2B',
  month text NOT NULL,
  revenue_target bigint NOT NULL DEFAULT 0,
  margin_target numeric(5,2) NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.targets ENABLE ROW LEVEL SECURITY;

-- RLS policies: Admins can manage, Authenticated can read
CREATE POLICY "Admins can manage accounts" ON public.accounts FOR ALL
  USING (get_user_system_role(auth.uid()) = ANY (ARRAY['super_admin'::system_role, 'admin'::system_role]));

CREATE POLICY "Authenticated can read accounts" ON public.accounts FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage deals" ON public.deals FOR ALL
  USING (get_user_system_role(auth.uid()) = ANY (ARRAY['super_admin'::system_role, 'admin'::system_role]));

CREATE POLICY "Authenticated can read deals" ON public.deals FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage invoices" ON public.invoices FOR ALL
  USING (get_user_system_role(auth.uid()) = ANY (ARRAY['super_admin'::system_role, 'admin'::system_role]));

CREATE POLICY "Authenticated can read invoices" ON public.invoices FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage targets" ON public.targets FOR ALL
  USING (get_user_system_role(auth.uid()) = ANY (ARRAY['super_admin'::system_role, 'admin'::system_role]));

CREATE POLICY "Authenticated can read targets" ON public.targets FOR SELECT
  USING (true);

-- Add updated_at trigger for accounts and deals
CREATE TRIGGER update_accounts_updated_at
  BEFORE UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_deals_updated_at
  BEFORE UPDATE ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
