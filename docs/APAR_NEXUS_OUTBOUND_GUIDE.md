# Panduan Outbound Webhook untuk Tim AP/AR Nexus

> **Audience**: Developer di project **AP/AR Nexus**. Dokumen ini berisi yang perlu Anda **tambahkan di sisi AP/AR Nexus** agar setiap perubahan status invoice otomatis ter-sinkron ke kartu deal di **SalesPulse**.

Tipe integrasi: **outbound webhook 1-arah** (AP/AR Nexus → SalesPulse). Tidak ada perubahan skema yang dibutuhkan di AP/AR Nexus, hanya menambah pemicu (trigger) di alur status invoice.

---

## 1. Endpoint tujuan

```
POST https://ggzttrxpkbpjbymrzpsg.supabase.co/functions/v1/apar-invoice-event
```

**Headers wajib**:

| Header | Value |
|---|---|
| `Content-Type` | `application/json` |
| `X-APAR-API-Key` | nilai secret `APAR_INTEGRATION_API_KEY` (minta dari admin SalesPulse) |

> ⚠️ Simpan API key di **Supabase Secret** AP/AR Nexus dengan nama `SALESPULSE_WEBHOOK_KEY`. Jangan commit ke repo.

---

## 2. Mapping event status AR → event SalesPulse

| Status di AP/AR Nexus | `event_type` ke SalesPulse | Efek di SalesPulse |
|---|---|---|
| Invoice approved (pertama kali) | `approved` | Stage pindah ke **Invoice Issued**, isi semua field AR |
| Pembayaran sebagian masuk | `partial_paid` | Update `ar_paid_amount` (running total) |
| Lunas | `paid` | Badge **✓ LUNAS** muncul, isi `ar_paid_date` |
| Lewat jatuh tempo | `overdue` | Badge **Overdue** muncul |
| Invoice dibatalkan / di-void | `cancelled` | **Rollback** kartu ke PO Secured, hapus field AR |
| Invoice direvisi (nilai/tanggal) | `revised` | Update field AR tanpa ubah stage |

**Matching key**: SalesPulse mencari deal berdasarkan `so_number` = `deals.wms_so_number`. Pastikan setiap invoice di AP/AR Nexus menyimpan **No. SO dari WMS** sebagai `so_number` agar match.

Lihat detail payload tiap event di file `docs/APAR_INTEGRATION.md` (saya sertakan ringkasan di bagian §5 di bawah).

---

## 3. Helper TypeScript (siap di-paste ke project AP/AR Nexus)

Buat file baru: `src/lib/salespulseWebhook.ts`

```typescript
// src/lib/salespulseWebhook.ts
// Helper untuk mengirim event invoice AR ke SalesPulse.
// HARUS dipanggil dari edge function (server-side), JANGAN dari browser
// karena membawa SALESPULSE_WEBHOOK_KEY.

const SALESPULSE_ENDPOINT =
  "https://ggzttrxpkbpjbymrzpsg.supabase.co/functions/v1/apar-invoice-event";

export type SalesPulseEvent =
  | "approved"
  | "partial_paid"
  | "paid"
  | "overdue"
  | "cancelled"
  | "revised";

export interface SalesPulsePayload {
  event_type: SalesPulseEvent;
  so_number: string;            // wajib, = deals.wms_so_number di SalesPulse
  invoice_number?: string;      // wajib kecuali cancelled
  invoice_date?: string;        // YYYY-MM-DD, wajib saat approved/revised
  invoice_amount?: number;      // wajib saat approved/revised
  due_date?: string;            // YYYY-MM-DD, opsional
  paid_amount?: number;         // wajib saat partial_paid
  paid_date?: string;           // YYYY-MM-DD, wajib saat paid
  reason?: string;              // opsional, untuk cancelled
  ar_url?: string;              // opsional, deep link kembali ke AR Nexus
}

export interface SalesPulseResponse {
  ok: boolean;
  status: number;
  body: unknown;
}

export async function sendToSalesPulse(
  payload: SalesPulsePayload,
): Promise<SalesPulseResponse> {
  const apiKey = Deno.env.get("SALESPULSE_WEBHOOK_KEY");
  if (!apiKey) {
    console.error("SALESPULSE_WEBHOOK_KEY belum dikonfigurasi");
    return { ok: false, status: 500, body: { error: "Missing API key" } };
  }

  try {
    const res = await fetch(SALESPULSE_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-APAR-API-Key": apiKey,
      },
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.warn("SalesPulse webhook returned non-2xx", res.status, body);
    }
    return { ok: res.ok, status: res.status, body };
  } catch (err) {
    console.error("SalesPulse webhook error:", err);
    return {
      ok: false,
      status: 0,
      body: { error: err instanceof Error ? err.message : "Unknown" },
    };
  }
}
```

---

## 4. Titik integrasi di alur AP/AR Nexus

Panggil `sendToSalesPulse(...)` di setiap **edge function / handler** berikut. Jangan pasang di trigger DB (lebih sulit di-debug & retry).

| Aksi user di AP/AR Nexus | Trigger pemanggilan |
|---|---|
| Klik **Approve** pada invoice AR | kirim `approved` |
| Catat pembayaran (jumlah < total) | kirim `partial_paid` |
| Catat pembayaran lunas / status berubah ke Paid | kirim `paid` |
| Cron harian: invoice melewati `due_date` & belum lunas | kirim `overdue` (1x per invoice) |
| Klik **Void** / **Cancel** invoice | kirim `cancelled` |
| Edit invoice (ubah nilai/tanggal) setelah `approved` | kirim `revised` |

### Contoh: di handler "Approve Invoice"

```typescript
// supabase/functions/approve-ar-invoice/index.ts (di project AP/AR Nexus)
import { sendToSalesPulse } from "../_shared/salespulseWebhook.ts";

// ... setelah update DB AP/AR sukses ...
await sendToSalesPulse({
  event_type: "approved",
  so_number: invoice.so_number,         // <- field SO yang Anda simpan di AR
  invoice_number: invoice.invoice_number,
  invoice_date: invoice.invoice_date,   // YYYY-MM-DD
  invoice_amount: Number(invoice.total_amount),
  due_date: invoice.due_date,           // YYYY-MM-DD
  ar_url: `https://apar-nexus.lovable.app/invoices/${invoice.id}`,
});
```

### Pola retry sederhana (opsional, recommended)

Bungkus dengan retry 1× setelah delay 2 detik untuk error 5xx / network:

```typescript
async function sendWithRetry(payload: SalesPulsePayload) {
  let res = await sendToSalesPulse(payload);
  if (!res.ok && (res.status === 0 || res.status >= 500)) {
    await new Promise((r) => setTimeout(r, 2000));
    res = await sendToSalesPulse(payload);
  }
  return res;
}
```

---

## 5. Ringkasan payload per event

```jsonc
// approved
{ "event_type": "approved", "so_number": "SO-2026-1234",
  "invoice_number": "INV-2026-0123", "invoice_date": "2026-04-25",
  "invoice_amount": 66000000, "due_date": "2026-05-25" }

// partial_paid (paid_amount = total kumulatif yang sudah dibayar)
{ "event_type": "partial_paid", "so_number": "SO-2026-1234",
  "invoice_number": "INV-2026-0123", "paid_amount": 30000000 }

// paid
{ "event_type": "paid", "so_number": "SO-2026-1234",
  "invoice_number": "INV-2026-0123", "paid_date": "2026-05-15" }

// overdue
{ "event_type": "overdue", "so_number": "SO-2026-1234",
  "invoice_number": "INV-2026-0123" }

// cancelled (boleh tanpa invoice_number)
{ "event_type": "cancelled", "so_number": "SO-2026-1234",
  "reason": "Customer cancel order" }

// revised
{ "event_type": "revised", "so_number": "SO-2026-1234",
  "invoice_number": "INV-2026-0123", "invoice_date": "2026-04-26",
  "invoice_amount": 70000000, "due_date": "2026-05-26" }
```

---

## 6. Response dari SalesPulse

| Status | Arti | Tindakan |
|---|---|---|
| `200 status=synced` | Berhasil | – |
| `200 status=skipped` | Idempotent — event `approved` dengan invoice sama | tidak perlu retry |
| `400` | Payload invalid (cek `body.error`) | perbaiki payload, jangan retry |
| `401` | API key salah/expired | cek secret `SALESPULSE_WEBHOOK_KEY` |
| `404` | `so_number` tidak ada di SalesPulse | log & skip — kemungkinan SO bukan dari WMS |
| `500` | Error server SalesPulse | retry 1× setelah 2 detik |

---

## 7. Checklist implementasi

- [ ] Tambah secret **`SALESPULSE_WEBHOOK_KEY`** di Supabase Secrets AP/AR Nexus (minta nilainya dari admin SalesPulse — sama dengan `APAR_INTEGRATION_API_KEY` di sisi SalesPulse).
- [ ] Buat file `supabase/functions/_shared/salespulseWebhook.ts` (kode di §3).
- [ ] Pastikan setiap invoice AR menyimpan kolom `so_number` (= No. SO dari WMS).
- [ ] Sisipkan `sendToSalesPulse(...)` di 6 titik integrasi (§4).
- [ ] Tambah pola retry untuk error 5xx (opsional tapi recommended).
- [ ] Tambah cron job harian untuk deteksi `overdue` (jalan tiap pagi, cek invoice yang `due_date < today` & belum lunas, kirim `overdue` 1× per invoice).
- [ ] Test end-to-end dengan 1 SO existing di SalesPulse → cek kartu di Pipeline berubah sesuai harapan.
- [ ] Tombol **Sync AR Status** di SalesPulse (DealDetailDialog) bisa dipakai untuk replay event terakhir kalau webhook gagal terkirim.

---

## 8. Debugging

- **Di sisi SalesPulse**: semua event tersimpan di tabel `wms_sync_log` dengan `event_type='apar_<event>'`. Admin SalesPulse bisa lihat status `received | processed | failed | ignored` + `error_message`.
- **Di sisi AP/AR Nexus**: log response (status + body) ke tabel sendiri (mis. `salespulse_webhook_log`) agar bisa diaudit & retry manual.
- **Tombol manual**: SalesPulse menyediakan tombol **Sync AR Status** di DealDetailDialog yang akan memutar ulang event terakhir dari `wms_sync_log` — berguna kalau webhook AP/AR Nexus terlambat / gagal.