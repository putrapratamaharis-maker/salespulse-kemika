-- Tighten realtime.messages policy: admin-only channels must require admin role.
-- User-specific notification channels remain scoped to the caller's uid.
DROP POLICY IF EXISTS "Authenticated can use realtime" ON realtime.messages;

CREATE POLICY "Scoped realtime channel access"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (
    -- 1. Per-user notification channel: only the owner may subscribe
    (
      realtime.topic() LIKE 'user-notifications:%'
      AND realtime.topic() = 'user-notifications:' || auth.uid()::text
    )
    OR
    -- 2. Admin-only shared channels (deletion queue, approval queue, live activity feed)
    (
      realtime.topic() IN (
        'deletion-requests-count',
        'pending-approvals',
        'live-activities'
      )
      AND public.get_user_system_role(auth.uid()) = ANY (ARRAY['super_admin'::system_role, 'admin'::system_role])
    )
    OR
    -- 3. Truly public presence channel (online users) — any authenticated user
    realtime.topic() = 'online-users'
  );