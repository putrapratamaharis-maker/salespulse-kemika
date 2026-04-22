---
name: AP/AR Nexus Integration
description: Sinkronisasi 1-arah dari AP/AR Nexus ke SalesPulse untuk transisi PO Secured → Invoice Issued + tracking pembayaran
type: feature
---
Integrasi SalesPulse ↔ AP/AR Nexus via webhook event-driven pada No. SO yang sama (matching `wms_so_number = ar.so_number`).

**Endpoint**: `POST /apar-invoice-event` (verify_jwt=false, auth via `X-APAR-API-Key` = secret `APAR_INTEGRATION_API_KEY`).

**Event types & behaviour**:
- `approved` → stage `po_secured` → `invoice_issued`, isi `ar_invoice_number` (BARU, beda dari PO/SO), `ar_invoice_date`, `ar_invoice_amount`, `ar_due_date`. Auto-create record di tabel `invoices` SalesPulse (gross_profit=0, diisi manual). Notif success ke sales.
- `partial_paid` → update `ar_paid_amount` (running total) + `ar_status='partial_paid'`. Stage tidak berubah. Notif info.
- `paid` → set `ar_status='paid'` + `ar_paid_date`, update `invoices.paid_date`. Kartu **TETAP di Invoice Issued** + badge emerald `✓ LUNAS`. Notif success.
- `overdue` → `ar_status='overdue'`, badge merah Overdue. Notif warning.
- `cancelled` → **ROLLBACK** ke `po_secured` + hapus semua field `ar_*`. Notif warning.
- `revised` → update nilai/tanggal invoice tanpa ubah stage. Notif warning jika selisih >5%.

**Idempotency**: event `approved` dengan `invoice_number` sama → skip (status=skipped).

**Kolom baru di `deals`**: `ar_invoice_number` (unique inv dari AR), `ar_invoice_date`, `ar_invoice_amount`, `ar_due_date`, `ar_paid_date`, `ar_paid_amount`, `ar_status`, `ar_last_event_at`. Index pada `ar_invoice_number` & `wms_so_number`.

**Tampilan**:
- **Kanban card**: badge biru `📄 INV-XXX` di samping badge emerald `✓ SO-XXX`. Status badge: emerald `✓ LUNAS` / amber `Partial` / merah `Overdue`.
- **DealDetailDialog**: section terpisah "AR Invoice (AP/AR Nexus)" dengan No. Invoice (highlight), nilai, tanggal terbit, jatuh tempo, paid amount, paid date, plus status badge (LUNAS/Partial Paid/Overdue/Approved) di header section.

**Catatan penting**: No. Invoice TIDAK menimpa No. PO atau No. SO — ketiganya tampil terpisah. `gross_profit` di tabel `invoices` diisi 0 saat auto-create, harus diupdate manual sales/admin sesuai HPP realisasi.

**Audit log**: semua event tersimpan di `wms_sync_log` dengan `event_type='apar_*'`. Dokumentasi lengkap di `docs/APAR_INTEGRATION.md`.