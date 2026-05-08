CREATE OR REPLACE FUNCTION public.is_supervisor_of(_supervisor_user_id uuid, _target_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH RECURSIVE chain AS (
    -- Anchor: target user's direct supervisor (profile.id), keep visited path to prevent cycles
    SELECT
      p.supervisor_id,
      ARRAY[p.id] AS visited,
      1 AS depth
    FROM public.profiles p
    WHERE p.user_id = _target_user_id
      AND p.supervisor_id IS NOT NULL

    UNION ALL

    -- Walk up the chain, but never revisit a profile (cycle guard) and cap depth at 10
    SELECT
      p.supervisor_id,
      c.visited || p.id,
      c.depth + 1
    FROM chain c
    JOIN public.profiles p ON p.id = c.supervisor_id
    WHERE c.depth < 10
      AND p.supervisor_id IS NOT NULL
      AND NOT (p.id = ANY (c.visited))
  )
  SELECT EXISTS (
    SELECT 1
    FROM chain c
    JOIN public.profiles sp ON sp.id = c.supervisor_id
    WHERE sp.user_id = _supervisor_user_id
  );
$$;