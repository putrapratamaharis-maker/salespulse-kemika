
-- Add new columns to sales_activities
ALTER TABLE public.sales_activities
  ADD COLUMN IF NOT EXISTS cost numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS purpose text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS outcome text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS evidence_url text DEFAULT NULL;

-- Create storage bucket for activity evidence
INSERT INTO storage.buckets (id, name, public)
VALUES ('activity-evidence', 'activity-evidence', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to their own folder
CREATE POLICY "Users can upload evidence"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'activity-evidence' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow authenticated users to read all evidence
CREATE POLICY "Authenticated can read evidence"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'activity-evidence');

-- Allow users to delete their own evidence
CREATE POLICY "Users can delete own evidence"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'activity-evidence' AND (storage.foldername(name))[1] = auth.uid()::text);
