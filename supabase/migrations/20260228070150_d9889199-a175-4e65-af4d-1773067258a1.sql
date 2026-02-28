
-- Create sales_activities table
CREATE TABLE public.sales_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_id UUID NOT NULL,
  type TEXT NOT NULL DEFAULT 'call',
  activity_date DATE NOT NULL DEFAULT CURRENT_DATE,
  account_id UUID REFERENCES public.accounts(id),
  notes TEXT DEFAULT '',
  next_action_date DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sales_activities ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admins can manage sales_activities"
  ON public.sales_activities FOR ALL
  USING (get_user_system_role(auth.uid()) = ANY (ARRAY['super_admin'::system_role, 'admin'::system_role]));

CREATE POLICY "Authenticated can read sales_activities"
  ON public.sales_activities FOR SELECT
  USING (true);

-- Updated_at trigger
CREATE TRIGGER update_sales_activities_updated_at
  BEFORE UPDATE ON public.sales_activities
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
