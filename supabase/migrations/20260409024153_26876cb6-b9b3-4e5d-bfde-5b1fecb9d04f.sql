
-- Add file_url column to download_history
ALTER TABLE public.download_history ADD COLUMN file_url text;

-- Create storage bucket for report files
INSERT INTO storage.buckets (id, name, public) VALUES ('report-files', 'report-files', false);

-- Users can upload their own report files
CREATE POLICY "Users can upload report files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'report-files' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Users can read their own report files
CREATE POLICY "Users can read own report files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'report-files' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Users can delete their own report files
CREATE POLICY "Users can delete own report files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'report-files' AND auth.uid()::text = (storage.foldername(name))[1]);
