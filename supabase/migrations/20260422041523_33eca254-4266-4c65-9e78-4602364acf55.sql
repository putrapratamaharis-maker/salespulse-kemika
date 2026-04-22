-- 1. PENDING SIGNUP: new users created via self-signup land as inactive
-- Update handle_new_user trigger to set is_active = false for self-signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email, is_active)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.email, ''),
    false  -- New self-registered users are inactive until admin approval
  );
  RETURN NEW;
END;
$function$;

-- 2. PRIVATE AVATARS: make avatars bucket private; remove broad public SELECT policy
UPDATE storage.buckets SET public = false WHERE id = 'avatars';

-- Drop any existing broad SELECT policies on avatars and recreate scoped ones
DO $$
DECLARE
  pol_name text;
BEGIN
  FOR pol_name IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND (qual ILIKE '%avatars%' OR with_check ILIKE '%avatars%' OR policyname ILIKE '%avatar%')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol_name);
  END LOOP;
END $$;

-- Authenticated users can read any avatar (via signed URL or direct path)
CREATE POLICY "Authenticated users can read avatars"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'avatars');

-- Users can upload/replace only their own avatar (path must start with their user id)
CREATE POLICY "Users can upload own avatar"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can update own avatar"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete own avatar"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 3. REALTIME RLS: restrict channel subscriptions to authenticated users,
-- and require user-notifications channels to be scoped to the auth.uid().
-- Other channels (presence, deal_deletion_requests, sales_activities) are
-- shared admin/team channels; postgres-changes payloads are still filtered
-- by table RLS so row data does not leak.
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can use realtime" ON realtime.messages;
CREATE POLICY "Authenticated can use realtime"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (
    -- User-specific notification channels: must end with the caller's uid
    (realtime.topic() LIKE 'user-notifications:%' AND realtime.topic() = 'user-notifications:' || auth.uid()::text)
    OR
    -- Allow-listed shared channels (presence + postgres_changes that respect table RLS)
    realtime.topic() IN (
      'online-users',
      'deletion-requests-count',
      'pending-approvals',
      'live-activities'
    )
  );