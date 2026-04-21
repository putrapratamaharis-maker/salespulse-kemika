---
name: WMS Integration
description: Sinkronisasi 2-arah antara SalesPulse dan Warehouse Management System via reference number dan webhook
type: feature
---
Integrasi SalesPulse ↔ Warehouse Management System (WMS) menggunakan pola reference-driven webhook:

**Auto-Generate No. Referensi**:
- Setiap deal baru otomatis dapat `reference_number` format `REF-{InisialSales}-{YYYY}-{NNNN}` (contoh: `REF-DSP-2026-0001`)
- Trigger DB `set_deal_reference_number` BEFORE INSERT, sequence per sales per tahun
- Read-only (auto-gen final), ditampilkan di kartu kanban sebagai badge muted sebelum SO sync
- Helper functions: `get_sales_initials()`, `generate_deal_reference_number()`

**Edge Functions** (verify_jwt=false, auth via X-WMS-API-Key header):
- `GET /list-open-references` — return deal aktif (prospect s/d po_secured) untuk dropdown SO di WMS
- `POST /wms-so-approved` — webhook saat SO approved: update stage → po_secured, set probability=100%, sync po_number/value/date, koreksi nama customer, kirim notif sales (warning jika selisih nilai >5%)
- `POST /wms-customer-upsert` — sinkron customer dari WMS ke SalesPulse `accounts`, upsert by `code`→`customer_id`. Mapping customer_type→segment (Government=B2G, Individual/Retail=B2C, else B2B). Auto-assign sales_id default (admin/super_admin pertama via `get_default_sync_sales_id()`). Update tidak overwrite sales_id existing.
- `POST /wms-product-upsert` — sinkron produk dari WMS ke SalesPulse `products`, upsert by `sku`. Auto-create kategori jika `category_name` baru. PENTING: tidak overwrite `selling_price` jika sudah >0 (sales bebas atur harga jual).

**Idempotency**: skip update jika `wms_so_number` sudah sama. Deal canceled/lost return 409.

**Kolom baru di `deals`**: `reference_number` (unique), `wms_so_number`, `wms_so_date`, `wms_synced_at`. Realtime aktif untuk auto-refresh kanban.

**Secret**: `WMS_INTEGRATION_API_KEY`. Dokumentasi lengkap di `docs/WMS_INTEGRATION.md`.

**Tampilan kartu kanban**: badge `REF-XXX` muted (menunggu SO) atau badge `✓ SO-XXX` emerald (sudah sync).
