-- Index khusus untuk LIKE 'CUST{year}-%' pattern matching + ORDER BY DESC
-- text_pattern_ops diperlukan agar PostgreSQL bisa menggunakan index untuk LIKE prefix
CREATE INDEX IF NOT EXISTS idx_accounts_customer_id_pattern
  ON public.accounts (customer_id text_pattern_ops)
  WHERE customer_id IS NOT NULL AND customer_id <> '';