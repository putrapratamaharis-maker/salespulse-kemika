# Integrasi AP/AR Nexus ↔ SalesPulse

Sinkronisasi 1-arah dari **AP/AR Nexus** ke **SalesPulse**: setiap perubahan status invoice di AR akan otomatis update kartu deal di SalesPulse.

## Endpoint

```
POST https://ggzttrxpkbpjbymrzpsg.supabase.co/functions/v1/apar-invoice-event
```

### Headers

| Header | Value |
|---|---|
| `Content-Type` | `application/json` |
| `X-APAR-API-Key` | nilai secret `APAR_INTEGRATION_API_KEY` |

### Matching key

SalesPulse mencari deal berdasarkan **`so_number`** = `deals.wms_so_number` (No. SO yang sudah link sebelumnya via WMS approval).

## Event Types & Payload

### 1. `approved` — Invoice baru diterbitkan

Memindahkan kartu dari **PO Secured** → **Invoice Issued**, mengisi `ar_invoice_number` (BARU, beda dari SO/PO), dan auto-create record di tabel `invoices` SalesPulse.

```json
{
  "event_type": "approved",
  "so_number": "SO-2026-1234",
  "invoice_number": "INV-2026-0123",
  "invoice_date": "2026-04-25",
  "invoice_amount": 66000000,
  "due_date": "2026-05-25",
  "ar_url": "https://apar.app/invoices/abc123"
}
```

### 2. `partial_paid` — Pembayaran sebagian

Update `ar_paid_amount` (running total) + status `partial_paid`. Stage tetap `invoice_issued`.

```json
{
  "event_type": "partial_paid",
  "so_number": "SO-2026-1234",
  "invoice_number": "INV-2026-0123",
  "paid_amount": 30000000
}
```

### 3. `paid` — LUNAS

Set `ar_status='paid'` + isi `ar_paid_date`. Update `invoices.paid_date`. Kartu tetap di **Invoice Issued** dengan badge emerald **✓ LUNAS**.

```json
{
  "event_type": "paid",
  "so_number": "SO-2026-1234",
  "invoice_number": "INV-2026-0123",
  "paid_date": "2026-05-15"
}
```

### 4. `overdue` — Lewat jatuh tempo

Set `ar_status='overdue'`. Badge merah **Overdue** muncul di kartu.

```json
{
  "event_type": "overdue",
  "so_number": "SO-2026-1234",
  "invoice_number": "INV-2026-0123"
}
```

### 5. `cancelled` — Invoice dibatalkan

**Rollback** kartu kembali ke **PO Secured** dan hapus semua field `ar_*`. Kirim notifikasi warning ke sales owner.

```json
{
  "event_type": "cancelled",
  "so_number": "SO-2026-1234",
  "reason": "Customer cancel order"
}
```

### 6. `revised` — Nilai/tanggal invoice direvisi

Update `ar_invoice_amount` / `ar_invoice_date` / `ar_due_date` tanpa ubah stage. Kalau selisih nilai >5%, notif `warning`.

```json
{
  "event_type": "revised",
  "so_number": "SO-2026-1234",
  "invoice_number": "INV-2026-0123",
  "invoice_date": "2026-04-26",
  "invoice_amount": 70000000,
  "due_date": "2026-05-26"
}
```

## Response

```json
{
  "status": "synced",
  "event_type": "approved",
  "deal_id": "uuid",
  "ar_invoice_number": "INV-2026-0123",
  "synced_at": "2026-04-25T10:00:00.000Z"
}
```

- `200 status=synced` — sukses
- `200 status=skipped` — idempotent (event approved dengan invoice_number sama)
- `400` — payload tidak valid (cek field `error`)
- `401` — `X-APAR-API-Key` salah
- `404` — `so_number` tidak ditemukan di SalesPulse
- `500` — error server / DB

## Catatan Penting

1. **No. Invoice TIDAK menimpa No. PO atau No. SO** — ketiganya tampil terpisah di kartu detail (badge biru `📄 INV-XXX` di samping badge emerald `✓ SO-XXX`).
2. **Auto-create invoice**: saat event `approved`, record otomatis dibuat di tabel `invoices` SalesPulse → langsung muncul di dashboard Revenue & Margin.
3. **gross_profit di tabel invoices** diisi `0` saat auto-create — bisa diupdate manual oleh sales/admin sesuai realisasi HPP.
4. **Idempotency**: event `approved` dengan `invoice_number` sama akan di-skip (return `status=skipped`).
5. **Audit log**: semua event tersimpan di `wms_sync_log` dengan `event_type='apar_*'`.
6. **UI realtime**: kartu kanban auto-refresh via Supabase Realtime begitu update DB selesai.

## Secret yang dibutuhkan

- `APAR_INTEGRATION_API_KEY` — sudah dikonfigurasi di Lovable Cloud secrets.