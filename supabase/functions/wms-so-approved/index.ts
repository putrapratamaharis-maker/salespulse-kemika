// Edge Function: wms-so-approved
// POST /functions/v1/wms-so-approved
// Webhook dipanggil oleh WMS saat Sales Order di-APPROVE.
// Mengupdate kartu deal SalesPulse: stage -> po_secured, value, po_number,
// wms_so_number, wms_so_date, dan koreksi nama customer.
//
// Authentication: Header `X-WMS-API-Key` harus cocok dengan WMS_INTEGRATION_API_KEY.
//
// Body payload:
// {
//   "reference_number": "REF-DSP-2026-0001",  // wajib, dari SalesPulse
//   "so_number": "SO-2026-1234",              // wajib
//   "so_date": "2026-04-21",                  // wajib (YYYY-MM-DD)
//   "total_value": 66000000,                  // wajib (numeric)
//   "customer_po": "SPK/123/2026",            // opsional, No. PO dari customer (SP/SPK/PO)
//   "customer_name": "PT ABCD EFGH",          // opsional, untuk koreksi nama
//   "items": [                                // opsional tapi DIREKOMENDASIKAN
//     {
//       "sku": "SKU-001",                     // opsional, untuk match ke products
//       "product_name": "Produk A",           // wajib
//       "category": "Kategori X",             // opsional
//       "unit": "pcs",                        // opsional, default 'pcs'
//       "qty": 10,                            // wajib (integer >= 1)
//       "price_per_unit": 6000000,            // wajib (number >= 0) — harga jual final SO
//       "other_cost": 0                       // opsional, default 0
//     }
//   ]
// }
//
// Pemetaan kolom deals:
// - po_number       <- customer_po (No. PO/SP/SPK customer). Tidak di-overwrite jika customer_po tidak dikirim/kosong.
// - wms_so_number   <- so_number   (No. SO internal warehouse).
// - wms_so_date     <- so_date.
//
// Catatan items:
// - Jika items[] dikirim, deal_products LAMA akan DI-REPLACE TOTAL dengan items dari WMS.
// - Sumber NILAI deal (deal.value) SELALU diambil dari `total_amount` (alias: `total_value`/`grand_total`)
//   yang dikirim WMS — termasuk PPN/diskon/pembulatan. Sales Pulse TIDAK menghitung ulang dari items.
// - price_per_unit per item disimpan apa adanya dari payload (boleh net, boleh gross — tidak diubah).
// - Jika items[] tidak dikirim/kosong, deal_products tidak diubah; deal.value tetap pakai total dari WMS.
// }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-wms-api-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Payload {
  reference_number?: string;
  so_number?: string;
  so_date?: string;
  total_value?: number;   // legacy alias
  total_amount?: number;  // PRIMARY: total final dari WMS (termasuk PPN/diskon)
  grand_total?: number;   // legacy alias
  customer_po?: string;
  customer_name?: string;
  items?: WmsItem[];
}

interface WmsItem {
  sku?: string;
  product_name?: string;
  category?: string;
  unit?: string;
  qty?: number;
  price_per_unit?: number;
  other_cost?: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonError(405, "Method not allowed");
  }

  try {
    // 1. Validasi API key
    const expectedKey = Deno.env.get("WMS_INTEGRATION_API_KEY");
    if (!expectedKey) {
      return jsonError(500, "Server misconfiguration: WMS_INTEGRATION_API_KEY missing");
    }
    if (req.headers.get("x-wms-api-key") !== expectedKey) {
      return jsonError(401, "Invalid or missing X-WMS-API-Key");
    }

    // 2. Parse + validasi payload
    let body: Payload;
    try {
      body = await req.json();
    } catch {
      return jsonError(400, "Invalid JSON body");
    }

    const errs: string[] = [];
    if (!body.reference_number || typeof body.reference_number !== "string") {
      errs.push("reference_number wajib (string)");
    }
    if (!body.so_number || typeof body.so_number !== "string") {
      errs.push("so_number wajib (string)");
    }
    if (!body.so_date || !/^\d{4}-\d{2}-\d{2}$/.test(body.so_date)) {
      errs.push("so_date wajib (format YYYY-MM-DD)");
    }
    // Terima total dari beberapa kemungkinan field name (kompatibilitas lintas versi WMS).
    const wmsTotal =
      typeof body.total_amount === "number" ? body.total_amount :
      typeof body.grand_total === "number" ? body.grand_total :
      typeof body.total_value === "number" ? body.total_value :
      undefined;
    if (typeof wmsTotal !== "number" || !Number.isFinite(wmsTotal) || wmsTotal < 0) {
      errs.push("total_amount wajib (number >= 0). Alias yang diterima: total_amount | grand_total | total_value");
    }
    // Validasi items (jika dikirim)
    if (body.items !== undefined) {
      if (!Array.isArray(body.items)) {
        errs.push("items harus array");
      } else {
        body.items.forEach((it, idx) => {
          if (!it.product_name || typeof it.product_name !== "string") {
            errs.push(`items[${idx}].product_name wajib (string)`);
          }
          if (typeof it.qty !== "number" || !Number.isFinite(it.qty) || it.qty < 1) {
            errs.push(`items[${idx}].qty wajib (number >= 1)`);
          }
          if (typeof it.price_per_unit !== "number" || it.price_per_unit < 0) {
            errs.push(`items[${idx}].price_per_unit wajib (number >= 0)`);
          }
          if (it.other_cost !== undefined && (typeof it.other_cost !== "number" || it.other_cost < 0)) {
            errs.push(`items[${idx}].other_cost harus number >= 0`);
          }
        });
      }
    }
    if (errs.length) return jsonError(400, errs.join("; "));

    const refNum = body.reference_number!.trim();
    const soNum = body.so_number!.trim();
    const customerPo = (body.customer_po ?? "").trim();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Catat event mentah ke audit log
    const { data: logRow } = await supabase
      .from("wms_sync_log")
      .insert({
        event_type: "so_approved",
        reference_number: refNum,
        wms_so_number: soNum,
        payload: body as unknown as Record<string, unknown>,
        status: "received",
      })
      .select("id")
      .single();
    const logId = logRow?.id ?? null;

    // 3. Cari deal berdasarkan reference_number
    const { data: deal, error: dealErr } = await supabase
      .from("deals")
      .select("id, account_id, value, stage, wms_so_number, wms_synced_at")
      .eq("reference_number", refNum)
      .maybeSingle();

    if (dealErr) {
      await markLog(supabase, logId, "failed", dealErr.message);
      return jsonError(500, "Database error");
    }
    if (!deal) {
      await markLog(supabase, logId, "failed", `Deal not found: ${refNum}`);
      return jsonError(
        404,
        `Deal dengan reference_number '${refNum}' tidak ditemukan`,
      );
    }

    // 4. Idempotency check
    if (deal.wms_so_number === soNum) {
      await markLog(supabase, logId, "ignored", "Already synced (idempotent)");
      return new Response(
        JSON.stringify({
          status: "skipped",
          reason: "Already synced (idempotent)",
          deal_id: deal.id,
          wms_so_number: soNum,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (deal.stage === "canceled" || deal.stage === "lost") {
      await markLog(supabase, logId, "ignored", `Deal already ${deal.stage}`);
      return jsonError(
        409,
        `Deal sudah berstatus ${deal.stage}, tidak bisa di-sync`,
      );
    }

    // 5. Update deal
    const now = new Date().toISOString();
    const oldValue = Number(deal.value) || 0;
    const hasItems = Array.isArray(body.items) && body.items.length > 0;

    // Sumber kebenaran nilai = total_amount dari WMS (termasuk PPN/diskon/pembulatan).
    // Hitungan dari items hanya dipakai untuk INFO selisih, bukan untuk nilai deal.
    const newValue = wmsTotal!;
    const itemsSum = hasItems
      ? body.items!.reduce((sum, it) => {
          const line = (it.qty ?? 0) * (it.price_per_unit ?? 0) + (it.other_cost ?? 0);
          return sum + line;
        }, 0)
      : null;

    const valueDiffPct = oldValue > 0
      ? Math.abs(newValue - oldValue) / oldValue * 100
      : 0;

    const { error: updErr } = await supabase
      .from("deals")
      .update({
        stage: "po_secured",
        probability: 100,
        // po_number diisi dari customer_po (No. PO/SP/SPK dari customer).
        // Jika WMS tidak kirim, jangan di-overwrite (kirim undefined supaya field tidak berubah).
        ...(customerPo ? { po_number: customerPo } : {}),
        wms_so_number: soNum,
        wms_so_date: body.so_date,
        wms_synced_at: now,
        wms_last_event_at: now,
        value: newValue,
        expected_close_date: body.so_date,
        days_in_stage: 0,
      })
      .eq("id", deal.id);

    if (updErr) {
      await markLog(supabase, logId, "failed", updErr.message);
      return jsonError(500, "Update deal gagal");
    }

    // 5b. Replace deal_products jika items dikirim
    let itemsReplaced = 0;
    if (hasItems) {
      // Hapus semua produk lama
      const { error: delErr } = await supabase
        .from("deal_products")
        .delete()
        .eq("deal_id", deal.id);
      if (delErr) {
        return jsonError(500, `Hapus deal_products gagal: ${delErr.message}`);
      }

      // Insert produk baru dari payload SO
      const rows = body.items!.map((it) => ({
        deal_id: deal.id,
        product_name: it.product_name!.trim(),
        category: (it.category ?? "").trim(),
        unit: (it.unit ?? "pcs").trim() || "pcs",
        qty: Math.floor(it.qty!),
        price_per_unit: it.price_per_unit!,
        other_cost: it.other_cost ?? 0,
      }));

      const { error: insErr } = await supabase
        .from("deal_products")
        .insert(rows);
      if (insErr) {
        return jsonError(500, `Insert deal_products gagal: ${insErr.message}`);
      }
      itemsReplaced = rows.length;
    }

    // 6. Nama customer TIDAK di-overwrite dari WMS.
    // Perubahan nama akun harus dilakukan manual di SalesPulse oleh admin/sales
    // untuk menghindari perubahan yang tidak disengaja pada semua deal yang
    // terhubung ke akun tersebut.
    // customer_name dari payload WMS hanya dicatat di wms_sync_log (via payload).
    const customerNameUpdated = false;

    // 7. Buat notifikasi untuk sales owner
    const { data: dealOwner } = await supabase
      .from("deals")
      .select("sales_id, name")
      .eq("id", deal.id)
      .maybeSingle();

    if (dealOwner) {
      await supabase.from("notifications").insert({
        user_id: dealOwner.sales_id,
        title: "SO Disetujui di WMS",
        message:
          `Deal "${dealOwner.name}" telah di-link dengan SO ${soNum} (${body.so_date}).` +
          (itemsReplaced > 0
            ? ` ${itemsReplaced} item produk diperbarui dari SO.`
            : "") +
          (valueDiffPct > 5
            ? ` ⚠️ Selisih nilai ${valueDiffPct.toFixed(1)}% dari estimasi semula.`
            : ""),
        type: valueDiffPct > 5 ? "warning" : "success",
        reference_id: deal.id,
        reference_type: "deal",
      });
    }

    await markLog(supabase, logId, "processed", null);
    return new Response(
      JSON.stringify({
        status: "synced",
        deal_id: deal.id,
        reference_number: refNum,
        wms_so_number: soNum,
        wms_so_date: body.so_date,
        customer_po: customerPo || null,
        po_number_updated: Boolean(customerPo),
        old_value: oldValue,
        new_value: newValue,
        value_diff_pct: Number(valueDiffPct.toFixed(2)),
        wms_items_subtotal: itemsSum,
        tax_or_adjustment: itemsSum !== null ? Number((newValue - itemsSum).toFixed(2)) : null,
        customer_name_updated: customerNameUpdated,
        items_replaced: itemsReplaced,
        synced_at: now,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("Unhandled error:", err);
    return jsonError(500, "Internal error");
  }
});

function jsonError(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// deno-lint-ignore no-explicit-any
async function markLog(supabase: any, logId: string | null, status: string, errorMsg: string | null) {
  if (!logId) return;
  await supabase
    .from("wms_sync_log")
    .update({
      status,
      error_message: errorMsg,
      processed_at: new Date().toISOString(),
    })
    .eq("id", logId);
}