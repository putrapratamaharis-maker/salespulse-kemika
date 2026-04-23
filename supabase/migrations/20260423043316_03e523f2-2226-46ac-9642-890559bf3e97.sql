-- Server-side next-customer-id generator that bypasses RLS so we always
-- see the true global maximum, even for users (e.g. staff_operational)
-- whose SELECT policy hides accounts owned by others.
CREATE OR REPLACE FUNCTION public.get_next_customer_id(_year integer)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path TO 'public'
AS $$
DECLARE
  _prefix text := 'CUST' || _year::text || '-';
  _upper  text := 'CUST' || _year::text || '.';
  _last   text;
  _seq    int := 0;
  _tail   text;
BEGIN
  -- Range scan uses idx_accounts_customer_id_pattern (text_pattern_ops)
  SELECT customer_id INTO _last
  FROM public.accounts
  WHERE customer_id >= _prefix
    AND customer_id <  _upper
  ORDER BY customer_id DESC
  LIMIT 1;

  IF _last IS NOT NULL THEN
    _tail := substring(_last from length(_prefix) + 1);
    IF _tail ~ '^[0-9]+$' THEN
      _seq := _tail::int;
    END IF;
  END IF;

  RETURN _prefix || lpad((_seq + 1)::text, 4, '0');
END;
$$;

REVOKE ALL ON FUNCTION public.get_next_customer_id(integer) FROM public;
GRANT EXECUTE ON FUNCTION public.get_next_customer_id(integer) TO authenticated;