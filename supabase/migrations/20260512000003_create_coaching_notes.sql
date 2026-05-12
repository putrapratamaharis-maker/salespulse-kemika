-- Buat tabel coaching_notes untuk fitur Coaching Notes UI
-- Supervisor input catatan coaching per salesperson

CREATE TABLE IF NOT EXISTS public.coaching_notes (
  id          UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  supervisor_id UUID      NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sales_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_date DATE       NOT NULL DEFAULT CURRENT_DATE,
  category    TEXT        NOT NULL DEFAULT 'general',
  -- category: general | skill | performance | attitude | strategy
  note        TEXT        NOT NULL,
  is_shared   BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.coaching_notes ENABLE ROW LEVEL SECURITY;

-- Supervisor: full CRUD atas notes milik sendiri
CREATE POLICY "Supervisor manage own coaching notes"
ON public.coaching_notes
FOR ALL
TO authenticated
USING (supervisor_id = auth.uid())
WITH CHECK (supervisor_id = auth.uid());

-- Salesperson: hanya bisa baca notes yang ditujukan ke mereka (is_shared = true)
CREATE POLICY "Sales can read their coaching notes"
ON public.coaching_notes
FOR SELECT
TO authenticated
USING (sales_id = auth.uid() AND is_shared = true);

-- Admin/super_admin: baca semua
CREATE POLICY "Admin read all coaching notes"
ON public.coaching_notes
FOR SELECT
TO authenticated
USING (
  public.get_user_system_role(auth.uid()) = ANY (ARRAY['super_admin'::system_role, 'admin'::system_role])
);

COMMENT ON TABLE public.coaching_notes IS 'Catatan coaching dari supervisor ke salesperson';
COMMENT ON COLUMN public.coaching_notes.category IS 'Kategori: general, skill, performance, attitude, strategy';
COMMENT ON COLUMN public.coaching_notes.is_shared IS 'Jika true, salesperson bisa melihat catatan ini';
