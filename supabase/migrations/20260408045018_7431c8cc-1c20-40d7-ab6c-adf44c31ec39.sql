
CREATE TABLE public.download_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  report_type text NOT NULL,
  report_name text NOT NULL,
  file_format text NOT NULL DEFAULT 'csv',
  file_name text NOT NULL,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  record_count integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.download_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own download history"
ON public.download_history FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own download history"
ON public.download_history FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own download history"
ON public.download_history FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can read all download history"
ON public.download_history FOR SELECT
USING (get_user_system_role(auth.uid()) = ANY (ARRAY['super_admin'::system_role, 'admin'::system_role]));
