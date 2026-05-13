-- Fix 2: SKU alignment antara WMS dan SalesPulse
--
-- Masalah: products.sku adalah SKU internal SalesPulse. WMS bisa punya
-- format SKU berbeda (misal: WMS pakai "ACT300", SalesPulse pakai "SP-ACT300").
-- Jika berbeda, wms-product-upsert gagal find → INSERT duplikat produk.
--
-- Solusi:
-- 1. Tambah products.wms_sku — menyimpan kode SKU dari WMS
-- 2. Tambah deal_products.sku — mencatat SKU yang dipakai saat item dibuat/sync

-- 1. Kolom wms_sku di tabel products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS wms_sku TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS products_wms_sku_unique
  ON public.products (wms_sku)
  WHERE wms_sku IS NOT NULL AND wms_sku != '';

CREATE INDEX IF NOT EXISTS idx_products_wms_sku
  ON public.products (wms_sku)
  WHERE wms_sku IS NOT NULL;

COMMENT ON COLUMN public.products.wms_sku IS
  'SKU dari sistem WMS (bisa berbeda dengan sku internal SalesPulse). '
  'Diisi otomatis saat wms-product-upsert pertama kali sync produk ini.';

-- 2. Kolom sku di tabel deal_products
ALTER TABLE public.deal_products
  ADD COLUMN IF NOT EXISTS sku TEXT;

CREATE INDEX IF NOT EXISTS idx_deal_products_sku
  ON public.deal_products (sku)
  WHERE sku IS NOT NULL;

COMMENT ON COLUMN public.deal_products.sku IS
  'SKU produk yang dipakai saat baris ini dibuat. '
  'Jika dari WMS → sku SalesPulse yang ter-resolve. '
  'Jika WMS SKU tidak ditemukan di master → WMS SKU disimpan apa adanya.';

-- 3. Backfill: untuk produk yang sudah ada dan wms_sku masih kosong,
--    salin nilai sku ke wms_sku sebagai starting point
--    (asumsi awal: format sama — bisa dikoreksi manual)
UPDATE public.products
  SET wms_sku = sku
  WHERE sku IS NOT NULL AND sku != ''
    AND wms_sku IS NULL;
