# Integrasi SalesPulse ↔ Warehouse Management System (WMS)

Dokumentasi ini menjelaskan cara WMS terhubung dengan SalesPulse melalui empat endpoint:

1. **`GET /list-open-references`** — Mengambil daftar deal aktif untuk ditampilkan di dropdown form Sales Order WMS.
2. **`POST /wms-so-approved`** — Memberi tahu SalesPulse bahwa SO telah di-approve, sehingga kartu kanban auto-update.
3. **`POST /wms-customer-upsert`** — Sinkronkan customer baru/update dari WMS ke SalesPulse Accounts.
4. **`POST /wms-product-upsert`** — Sinkronkan produk baru/update dari WMS ke SalesPulse Products.

---

## 🔐 Autentikasi

Semua request menggunakan header:

```
X-WMS-API-Key: <kunci-yang-disepakati>
```

Kunci ini disimpan sebagai secret `WMS_INTEGRATION_API_KEY` di SalesPulse. Hubungi admin SalesPulse untuk mendapatkannya.

---

## 🌐 Base URL

```
https://ggzttrxpkbpjbymrzpsg.supabase.co/functions/v1
```

---

## 📥 1. GET `/list-open-references`

Mengembalikan daftar deal yang masih aktif (stage: `prospect`, `quotation`, `negotiation`, `po_secured`) untuk ditampilkan sebagai opsi dropdown di form Sales Order WMS.

### Query parameters (opsional)

| Param | Tipe | Default | Keterangan |
|---|---|---|---|
| `search` | string | - | Cari di reference_number, deal_name, customer_name, customer_code |
| `segment` | string | - | Filter `B2G`, `B2B`, atau `B2C` |
| `limit` | number | 200 | Maksimum 500 |

### Contoh request

```bash
curl -X GET \
  "https://ggzttrxpkbpjbymrzpsg.supabase.co/functions/v1/list-open-references?search=abcd&limit=50" \
  -H "X-WMS-API-Key: YOUR_KEY"
```

### Contoh response (200 OK)

```json
{
  "count": 2,
  "data": [
    {
      "deal_id": "dea17ade-c262-4bc3-870d-d0fb1facbfc2",
      "reference_number": "REF-DSP-2026-0001",
      "deal_name": "PT ABCD EFGH - IK VC Super 10x8",
      "account_id": "uuid",
      "customer_code": "CUST2026-0042",
      "customer_name": "PT ABCD EFGH",
      "segment": "B2B",
      "stage": "negotiation",
      "value": 45288000,
      "expected_close_date": "2026-04-30",
      "sales_id": "uuid",
      "sales_name": "Demo Sales Person",
      "already_synced": false,
      "wms_so_number": null,
      "wms_so_date": null,
      "products": [
        { "name": "IK VC Super 10x8", "qty": 5, "unit": "pcs", "price_per_unit": 9057600 }
      ]
    }
  ]
}
```

### Cara pakai di WMS

1. Saat user buka form **Create Sales Order**, panggil endpoint ini.
2. Tampilkan list di dropdown dengan format:
   `{reference_number} — {customer_name} — Rp {value}`
3. Saat user pilih satu opsi, simpan `reference_number` di field SO.
4. Field yang `already_synced: true` sebaiknya disable atau diberi badge agar tidak di-pilih ulang.

---

## 📤 2. POST `/wms-so-approved`

Webhook yang dipanggil **WMS** saat Sales Order di-**APPROVE**. SalesPulse akan otomatis:

- Pindahkan kartu kanban ke stage **PO Secured/Won**
- Set `probability = 100%`
- Update `po_number` dengan **`customer_po`** (No. PO/SP/SPK customer). Jika `customer_po` tidak dikirim, `po_number` existing TIDAK di-overwrite.
- Simpan `so_number` ke kolom **`wms_so_number`** (No. SO internal warehouse, tampil terpisah di kartu deal).
- Update `value` dengan `total_value` dari WMS
- Update `expected_close_date` dengan `so_date`
- Koreksi nama customer (jika dikirim & berbeda)
- **Replace total daftar produk** di deal dengan items dari SO (jika `items[]` dikirim)
- Recalculate `value` otomatis dari `Σ(qty × price_per_unit) + Σ(other_cost)` saat items dikirim
- Kirim notifikasi ke sales owner

### Request body

| Field | Tipe | Wajib | Keterangan |
|---|---|---|---|
| `reference_number` | string | ✅ | No. Referensi SalesPulse (misal `REF-DSP-2026-0001`) |
| `so_number` | string | ✅ | No. Sales Order **internal WMS** (misal `SO/20260421.03`). Disimpan di kolom `wms_so_number`. |
| `so_date` | string | ✅ | Format `YYYY-MM-DD` |
| `total_value` | number | ✅ | Nilai total SO (Rupiah, tanpa desimal) |
| `customer_po` | string | ❌ | **No. PO/SP/SPK dari customer** (misal `SPK/123/2026`). Disimpan di kolom `po_number`. Jika kosong/tidak dikirim, `po_number` existing tidak di-overwrite. |
| `customer_name` | string | ❌ | Nama customer di WMS (untuk koreksi penamaan) |
| `items` | array | ❌ | Daftar produk SO. **Sangat direkomendasikan.** Jika dikirim, `deal_products` lama akan **di-REPLACE TOTAL** dan `total_value` di-recalculate otomatis. |

#### Field per item (`items[]`)

| Field | Tipe | Wajib | Keterangan |
|---|---|---|---|
| `product_name` | string | ✅ | Nama produk (sesuai di WMS) |
| `qty` | integer | ✅ | Kuantitas (>= 1) |
| `price_per_unit` | number | ✅ | Harga jual per unit (Rupiah) |
| `sku` | string | ❌ | SKU produk (untuk traceability) |
| `category` | string | ❌ | Nama kategori |
| `unit` | string | ❌ | Satuan, default `pcs` |
| `other_cost` | number | ❌ | Biaya tambahan per line, default `0` |

### Contoh request

```bash
curl -X POST \
  "https://ggzttrxpkbpjbymrzpsg.supabase.co/functions/v1/wms-so-approved" \
  -H "X-WMS-API-Key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "reference_number": "REF-DSP-2026-0001",
    "so_number": "SO/20260421.03",
    "so_date": "2026-04-21",
    "total_value": 66000000,
    "customer_po": "SPK/123/2026",
    "customer_name": "PT ABCD EFGH",
    "items": [
      {
        "sku": "SKU-001",
        "product_name": "Pompa Sentrifugal 5HP",
        "category": "Pompa",
        "unit": "unit",
        "qty": 2,
        "price_per_unit": 25000000,
        "other_cost": 0
      },
      {
        "sku": "SKU-002",
        "product_name": "Pipa PVC 4 inch",
        "category": "Pipa",
        "unit": "batang",
        "qty": 40,
        "price_per_unit": 400000,
        "other_cost": 0
      }
    ]
  }'
```

### Response sukses (200 OK)

```json
{
  "status": "synced",
  "deal_id": "uuid",
  "reference_number": "REF-DSP-2026-0001",
  "wms_so_number": "SO/20260421.03",
  "wms_so_date": "2026-04-21",
  "customer_po": "SPK/123/2026",
  "po_number_updated": true,
  "old_value": 45288000,
  "new_value": 66000000,
  "value_diff_pct": 45.74,
  "customer_name_updated": false,
  "items_replaced": 2,
  "synced_at": "2026-04-21T10:15:30.000Z"
}
```

### Response sudah pernah sync (200 OK, idempotent)

```json
{
  "status": "skipped",
  "reason": "Already synced (idempotent)",
  "deal_id": "uuid",
  "wms_so_number": "SO-2026-1234"
}
```

### Error responses

| Status | Penyebab |
|---|---|
| 400 | Payload tidak valid (field hilang/format salah) |
| 401 | API key salah/tidak ada |
| 404 | `reference_number` tidak ditemukan di SalesPulse |
| 409 | Deal sudah berstatus `canceled` atau `lost` |
| 500 | Server error (cek log SalesPulse) |

---

## 🔁 Alur End-to-End

```
┌──────────────────┐                          ┌──────────────────┐
│   SalesPulse     │                          │       WMS        │
└────────┬─────────┘                          └────────┬─────────┘
         │                                              │
   1. Sales bikin Lead                                  │
   → auto-gen REF-DSP-2026-0001                         │
         │                                              │
         │     2. Sales buka WMS, klik "Buat SO"        │
         │ ←──── GET /list-open-references ─────────────┤
         ├──────── return list deals ──────────────────→│
         │                                              │
         │              3. Sales pilih REF-DSP-2026-0001
         │                 dan submit SO                │
         │                                              │
         │              4. SO di-approve atasan WMS    │
         │ ←─ POST /wms-so-approved (with so_number) ──┤
         │                                              │
   5. Update deal:                                      │
   - stage → po_secured                                 │
   - po_number = SO-2026-1234                           │
   - value, date update                                 │
   - notif ke sales                                     │
         │                                              │
   6. Realtime broadcast → kartu kanban auto-refresh    │
         │                                              │
```

---

## ⚠️ Best Practices untuk WMS

1. **Idempotency**: Aman untuk retry — request yang sama tidak akan double-update.
2. **Retry on failure**: Jika dapat 5xx, retry max 3x dengan exponential backoff.
3. **Rate limit**: Hindari polling `/list-open-references` lebih sering dari 1x per detik. Cache 30 detik di sisi WMS.
4. **Nilai total**: Selisih >5% akan memicu warning notification ke sales (tetap di-sync, tapi minta review manual).
5. **Stage canceled/lost**: Tidak bisa di-sync (response 409). WMS harus handle ini di UI.

---

## 📤 3. POST `/wms-customer-upsert`

Sinkronkan customer baru atau perubahan customer dari WMS ke SalesPulse `accounts`. Idempotent: upsert berdasarkan `code` (= `customer_id` di SalesPulse).

**Endpoint**: `POST https://ggzttrxpkbpjbymrzpsg.supabase.co/functions/v1/wms-customer-upsert`

**Headers**: `X-WMS-API-Key: <key>`, `Content-Type: application/json`

**Request body**:
```json
{
  "code": "CUST-WMS-001",          // wajib, jadi customer_id di SalesPulse (unique)
  "name": "PT Bintang Mandiri",    // wajib
  "customer_type": "Corporate",    // optional: Corporate|Government|Individual|Distributor|Retail
  "pic": "Budi Santoso",
  "email": "budi@example.com",
  "phone": "081234567890",
  "city": "Jakarta",
  "region": "DKI Jakarta",         // optional, fallback ke city
  "is_active": true
}
```

**Mapping otomatis**:
- `customer_type` → `segment`: Government → B2G, Individual/Retail → B2C, lainnya → B2B
- Akun baru di-assign ke admin/super_admin pertama sebagai `sales_id` default (sales bisa reassign manual di SalesPulse)
- Update tidak mengubah `sales_id` yang sudah ada

**Response sukses (201 created / 200 updated)**:
```json
{ "success": true, "action": "created", "account_id": "uuid", "customer_id": "CUST-WMS-001", "name": "..." }
```

**Error**: 400 (field wajib hilang), 401 (API key salah), 503 (no admin user di SalesPulse).

---

## 📤 4. POST `/wms-product-upsert`

Sinkronkan produk baru atau perubahan produk dari WMS ke SalesPulse `products`. Idempotent: upsert berdasarkan `sku`.

**Endpoint**: `POST https://ggzttrxpkbpjbymrzpsg.supabase.co/functions/v1/wms-product-upsert`

**Headers**: `X-WMS-API-Key: <key>`, `Content-Type: application/json`

**Request body**:
```json
{
  "sku": "SKU-WMS-12345",          // wajib, jadi sku di SalesPulse (unique)
  "name": "Reagen Hematology X",   // wajib
  "category_name": "Reagen",       // optional, auto-create kategori jika belum ada
  "unit_name": "vial",             // optional, default "pcs"
  "purchase_price": 150000,
  "selling_price": 180000,         // optional, fallback ke purchase_price
  "is_active": true
}
```

**Behavior penting**:
- Untuk produk yang sudah ada, `selling_price` di SalesPulse **TIDAK** di-overwrite jika sudah punya nilai >0 (sales bebas atur harga jual sendiri). Hanya `purchase_price` & metadata yang ikut update.
- Kategori baru otomatis dibuat di `product_categories` jika `category_name` belum ada.

**Response sukses (201 created / 200 updated)**:
```json
{ "success": true, "action": "updated", "product_id": "uuid", "sku": "...", "selling_price_preserved": true }
```

**Error**: 400 (field wajib hilang), 401 (API key salah), 500 (DB error).

---

## 📞 Kontak

Untuk pertanyaan teknis atau request fitur tambahan, hubungi admin SalesPulse.

---

## 🔁 5. POST `/wms-resync-deal` (internal, untuk SalesPulse UI)

Endpoint internal yang dipanggil dari halaman **Deal Detail** di SalesPulse via tombol **"Re-sync from WMS"**. Tidak dipakai oleh WMS, hanya untuk operator SalesPulse yang ingin me-replay payload SO terakhir dari WMS tanpa harus minta WMS mengirim ulang webhook.

**Auth**: Supabase JWT (user harus login). Hanya owner deal (sales_id) atau admin/super_admin yang bisa memanggil.

**Mekanisme**: Cari log terakhir di `wms_sync_log` dengan `event_type IN ('so_approved','so_updated')` untuk `reference_number` deal, lalu re-apply payload yang sama (idempotent — aman untuk diulang).

**Request body**:
```json
{ "deal_id": "<uuid deal di SalesPulse>" }
```

**Response sukses (200)**:
```json
{
  "status": "resynced",
  "event_type": "so_approved",
  "deal_id": "uuid",
  "wms_so_number": "SO/20260423.01",
  "wms_so_date": "2026-04-23",
  "old_value": 2223214,
  "new_value": 2467768,
  "value_diff_pct": 11.0,
  "items_replaced": 2,
  "last_event_at": "2026-04-24T08:00:00.000Z"
}
```

**Response tidak ada log**:
```json
{ "status": "no_log", "message": "Belum ada event SO Approved/Updated tersimpan untuk REF-DSP-2026-0001..." }
```