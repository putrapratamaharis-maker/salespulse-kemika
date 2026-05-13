-- ============================================================
-- Fix: Duplikasi akun karena wms-customer-upsert lookup by
-- customer_id (internal SalesPulse) bukan kode dari WMS.
--
-- Solusi:
-- 1. Tambah kolom wms_customer_code untuk menyimpan kode WMS
-- 2. Unique index agar tidak ada dua akun dengan kode WMS sama
-- 3. Script cleanup: merge akun duplikat (nama identik) menjadi satu
-- ============================================================

-- 1. Tambah kolom wms_customer_code
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS wms_customer_code TEXT;

-- 2. Unique partial index (hanya jika terisi)
CREATE UNIQUE INDEX IF NOT EXISTS accounts_wms_customer_code_unique
  ON public.accounts (wms_customer_code)
  WHERE wms_customer_code IS NOT NULL AND wms_customer_code != '';

-- Index untuk fast lookup by wms_customer_code
CREATE INDEX IF NOT EXISTS idx_accounts_wms_customer_code
  ON public.accounts (wms_customer_code)
  WHERE wms_customer_code IS NOT NULL;

COMMENT ON COLUMN public.accounts.wms_customer_code IS
  'Kode customer dari sistem WMS (berbeda dengan customer_id internal SalesPulse). '
  'Diisi otomatis saat wms-customer-upsert pertama kali sync akun ini.';

-- ============================================================
-- 3. Cleanup duplikasi: untuk setiap grup nama yang sama,
--    pertahankan akun TERTUA (created_at paling lama),
--    pindahkan semua deals dari akun duplikat ke akun tertua,
--    lalu hapus akun duplikat.
--
--    Prioritas: akun yang punya deals > akun tanpa deals
--    Tie-break: created_at ASC (paling lama = canonical)
-- ============================================================
DO $$
DECLARE
  _name TEXT;
  _canonical_id UUID;
  _dup_id UUID;
  _dup_ids UUID[];
  _moved_deals INT;
BEGIN
  -- Loop per grup nama yang duplikat
  FOR _name IN
    SELECT name
    FROM public.accounts
    WHERE status != 'Inactive'
    GROUP BY name
    HAVING COUNT(*) > 1
  LOOP
    -- Pilih akun canonical: prioritas punya deals, lalu paling lama dibuat
    SELECT id INTO _canonical_id
    FROM public.accounts
    WHERE name = _name
    ORDER BY
      (SELECT COUNT(*) FROM public.deals WHERE account_id = accounts.id) DESC,
      created_at ASC
    LIMIT 1;

    -- Kumpulkan semua duplikat (bukan canonical)
    SELECT ARRAY_AGG(id) INTO _dup_ids
    FROM public.accounts
    WHERE name = _name AND id != _canonical_id;

    -- Pindahkan deals dari setiap duplikat ke canonical
    FOREACH _dup_id IN ARRAY _dup_ids LOOP
      UPDATE public.deals
        SET account_id = _canonical_id
        WHERE account_id = _dup_id;

      GET DIAGNOSTICS _moved_deals = ROW_COUNT;

      -- Pindahkan invoices
      UPDATE public.invoices
        SET account_id = _canonical_id
        WHERE account_id = _dup_id;

      -- Ambil wms_customer_code dari duplikat jika canonical belum punya
      UPDATE public.accounts
        SET wms_customer_code = (
          SELECT wms_customer_code FROM public.accounts
          WHERE id = _dup_id AND wms_customer_code IS NOT NULL
          LIMIT 1
        )
        WHERE id = _canonical_id
          AND wms_customer_code IS NULL;

      -- Hapus akun duplikat
      DELETE FROM public.accounts WHERE id = _dup_id;

      RAISE NOTICE 'Merged duplicate account "%" — dup_id: %, canonical_id: %, deals_moved: %',
        _name, _dup_id, _canonical_id, _moved_deals;
    END LOOP;

  END LOOP;
END;
$$;
