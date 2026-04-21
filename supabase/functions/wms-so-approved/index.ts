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
// Catatan items:
// - Jika items[] dikirim, deal_products LAMA akan DI-REPLACE TOTAL dengan items dari WMS.
// - total_value akan otomatis di-recalculate dari sum(qty * price_per_unit) + sum(other_cost).
// - Jika items[] tidak dikirim atau kosong, deal_products tidak diubah & total_value pakai field root.
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
  total_value?: number;
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
    if (typeof body.total_value !== "number" || body.total_value < 0) {
      errs.push("total_value wajib (number >= 0)");
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

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // 3. Cari deal berdasarkan reference_number
    const { data: deal, error: dealErr } = await supabase
      .from("deals")
      .select("id, account_id, value, stage, wms_so_number, wms_synced_at")
      .eq("reference_number", refNum)
      .maybeSingle();

    if (dealErr) return jsonError(500, dealErr.message);
    if (!deal) {
      return jsonError(
        404,
        `Deal dengan reference_number '${refNum}' tidak ditemukan`,
      );
    }

    // 4. Idempotency check
    if (deal.wms_so_number === soNum) {
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
      return jsonError(
        409,
        `Deal sudah berstatus ${deal.stage}, tidak bisa di-sync`,
      );
    }

    // 5. Update deal
    const now = new Date().toISOString();
    const oldValue = Number(deal.value) || 0;
    const hasItems = Array.isArray(body.items) && body.items.length > 0;

    // Jika items dikirim, hitung ulang total_value dari items (lebih akurat).
    let newValue = body.total_value!;
    if (hasItems) {
      const computed = body.items!.reduce((sum, it) => {
        const line = (it.qty ?? 0) * (it.price_per_unit ?? 0) + (it.other_cost ?? 0);
        return sum + line;
      }, 0);
      newValue = computed;
    }

    const valueDiffPct = oldValue > 0
      ? Math.abs(newValue - oldValue) / oldValue * 100
      : 0;

    const { error: updErr } = await supabase
      .from("deals")
      .update({
        stage: "po_secured",
        probability: 100,
        po_number: soNum,
        wms_so_number: soNum,
        wms_so_date: body.so_date,
        wms_synced_at: now,
        value: newValue,
        expected_close_date: body.so_date,
        days_in_stage: 0,
      })
      .eq("id", deal.id);

    if (updErr) return jsonError(500, `Update deal gagal: ${updErr.message}`);

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

    // 6. Koreksi nama customer (jika beda dan dikirim)
    let customerNameUpdated = false;
    if (body.customer_name && body.customer_name.trim()) {
      const newName = body.customer_name.trim();
      const { data: acc } = await supabase
        .from("accounts")
        .select("name")
        .eq("id", deal.account_id)
        .maybeSingle();

      if (acc && acc.name !== newName) {
        const { error: accErr } = await supabase
          .from("accounts")
          .update({ name: newName })
          .eq("id", deal.account_id);
        if (!accErr) customerNameUpdated = true;
      }
    }

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

    return new Response(
      JSON.stringify({
        status: "synced",
        deal_id: deal.id,
        reference_number: refNum,
        wms_so_number: soNum,
        wms_so_date: body.so_date,
        old_value: oldValue,
        new_value: newValue,
        value_diff_pct: Number(valueDiffPct.toFixed(2)),
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
    return jsonError(500, err instanceof Error ? err.message : "Unknown error");
  }
});

function jsonError(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}