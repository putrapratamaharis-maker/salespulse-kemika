-- Fix 3: Selaraskan struktur deal_products dengan form WMS
-- Tambah kolom discount_pct dan discount_rp ke deal_products
-- other_cost dipertahankan untuk backward compatibility

ALTER TABLE public.deal_products
  ADD COLUMN IF NOT EXISTS discount_pct  NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_rp   NUMERIC NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.deal_products.discount_pct IS 'Diskon per baris dalam % (0-100). Selaras dengan field Line Discount (%) di WMS.';
COMMENT ON COLUMN public.deal_products.discount_rp  IS 'Diskon per baris dalam Rp (dihitung dari discount_pct atau dikirim langsung dari WMS).';
COMMENT ON COLUMN public.deal_products.other_cost   IS 'Biaya tambahan (legacy). Tidak dipakai lagi untuk sync WMS — digantikan discount_pct/discount_rp.';

-- Subtotal per baris = qty × price_per_unit × (1 - discount_pct/100)
-- atau = qty × price_per_unit - discount_rp
