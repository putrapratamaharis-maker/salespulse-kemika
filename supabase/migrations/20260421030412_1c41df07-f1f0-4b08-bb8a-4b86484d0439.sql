-- 1. Tambah kolom baru di tabel deals
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS reference_number text UNIQUE,
  ADD COLUMN IF NOT EXISTS wms_so_number text,
  ADD COLUMN IF NOT EXISTS wms_so_date date,
  ADD COLUMN IF NOT EXISTS wms_synced_at timestamptz;

-- 2. Index untuk lookup cepat
CREATE INDEX IF NOT EXISTS idx_deals_reference_number ON public.deals(reference_number);
CREATE INDEX IF NOT EXISTS idx_deals_wms_so_number ON public.deals(wms_so_number);

-- 3. Function: generate inisial dari full_name (ambil huruf pertama dari setiap kata, max 3 huruf)
CREATE OR REPLACE FUNCTION public.get_sales_initials(_user_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _full_name text;
  _initials text := '';
  _word text;
BEGIN
  SELECT full_name INTO _full_name
  FROM public.profiles
  WHERE user_id = _user_id
  LIMIT 1;

  IF _full_name IS NULL OR trim(_full_name) = '' THEN
    RETURN 'XXX';
  END IF;

  -- Ambil huruf pertama dari setiap kata (max 3 huruf)
  FOR _word IN
    SELECT regexp_split_to_table(trim(_full_name), '\s+')
  LOOP
    IF length(_initials) < 3 AND length(_word) > 0 THEN
      _initials := _initials || upper(substring(_word from 1 for 1));
    END IF;
  END LOOP;

  IF length(_initials) = 0 THEN
    RETURN 'XXX';
  END IF;

  RETURN _initials;
END;
$$;

-- 4. Function: generate reference_number unik
CREATE OR REPLACE FUNCTION public.generate_deal_reference_number(_sales_id uuid, _year int)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _initials text;
  _next_seq int;
  _ref text;
  _prefix text;
BEGIN
  _initials := public.get_sales_initials(_sales_id);
  _prefix := 'REF-' || _initials || '-' || _year::text || '-';

  -- Cari sequence terakhir untuk sales + tahun ini
  SELECT COALESCE(MAX(
    CAST(substring(reference_number from length(_prefix) + 1) AS int)
  ), 0) + 1
  INTO _next_seq
  FROM public.deals
  WHERE reference_number LIKE _prefix || '%'
    AND substring(reference_number from length(_prefix) + 1) ~ '^[0-9]+$';

  _ref := _prefix || lpad(_next_seq::text, 4, '0');
  RETURN _ref;
END;
$$;

-- 5. Trigger: auto-set reference_number sebelum insert
CREATE OR REPLACE FUNCTION public.set_deal_reference_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _year int;
  _attempts int := 0;
  _max_attempts int := 5;
BEGIN
  IF NEW.reference_number IS NOT NULL AND NEW.reference_number != '' THEN
    RETURN NEW;
  END IF;

  _year := EXTRACT(YEAR FROM COALESCE(NEW.created_at, now()))::int;

  -- Retry loop untuk handle race condition
  WHILE _attempts < _max_attempts LOOP
    BEGIN
      NEW.reference_number := public.generate_deal_reference_number(NEW.sales_id, _year);
      RETURN NEW;
    EXCEPTION WHEN unique_violation THEN
      _attempts := _attempts + 1;
      IF _attempts >= _max_attempts THEN
        RAISE EXCEPTION 'Failed to generate unique reference_number after % attempts', _max_attempts;
      END IF;
    END;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_deal_reference_number ON public.deals;
CREATE TRIGGER trg_set_deal_reference_number
  BEFORE INSERT ON public.deals
  FOR EACH ROW
  EXECUTE FUNCTION public.set_deal_reference_number();

-- 6. Backfill reference_number untuk deal existing yang belum punya
DO $$
DECLARE
  _deal RECORD;
  _year int;
  _ref text;
BEGIN
  FOR _deal IN
    SELECT id, sales_id, created_at
    FROM public.deals
    WHERE reference_number IS NULL OR reference_number = ''
    ORDER BY created_at ASC
  LOOP
    _year := EXTRACT(YEAR FROM _deal.created_at)::int;
    _ref := public.generate_deal_reference_number(_deal.sales_id, _year);
    UPDATE public.deals SET reference_number = _ref WHERE id = _deal.id;
  END LOOP;
END $$;

-- 7. Aktifkan Realtime untuk tabel deals (jika belum)
ALTER TABLE public.deals REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'deals'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.deals;
  END IF;
END $$;