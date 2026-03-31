
-- Create deal deletion requests table
CREATE TABLE public.deal_deletion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_notes text,
  deal_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.deal_deletion_requests ENABLE ROW LEVEL SECURITY;

-- Users can insert their own requests
CREATE POLICY "Users can insert own deletion requests"
  ON public.deal_deletion_requests FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = requested_by);

-- Users can read their own requests, admins can read all
CREATE POLICY "Users can read own or admin deletion requests"
  ON public.deal_deletion_requests FOR SELECT
  TO authenticated
  USING (
    auth.uid() = requested_by 
    OR get_user_system_role(auth.uid()) = ANY (ARRAY['super_admin'::system_role, 'admin'::system_role])
  );

-- Only admins can update (approve/reject)
CREATE POLICY "Admins can update deletion requests"
  ON public.deal_deletion_requests FOR UPDATE
  TO authenticated
  USING (get_user_system_role(auth.uid()) = ANY (ARRAY['super_admin'::system_role, 'admin'::system_role]))
  WITH CHECK (get_user_system_role(auth.uid()) = ANY (ARRAY['super_admin'::system_role, 'admin'::system_role]));

-- Only admins can delete
CREATE POLICY "Admins can delete deletion requests"
  ON public.deal_deletion_requests FOR DELETE
  TO authenticated
  USING (get_user_system_role(auth.uid()) = ANY (ARRAY['super_admin'::system_role, 'admin'::system_role]));
