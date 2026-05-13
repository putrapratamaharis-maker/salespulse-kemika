// Edge Function: wms-so-updated
// POST /functions/v1/wms-so-updated
// Webhook dipanggil oleh WMS saat Sales Order yang sudah di-approve MENGALAMI PERUBAHAN
// (revisi qty, harga, customer PO, tanggal SO, atau item line).
//
// Authentication: Header `X-WMS-API-Key` harus cocok dengan WMS_INTEGRATION_API_KEY.
//
// Body payload (semua field opsional KECUALI so_number — hanya kirim yang berubah):
// {
//   "so_number": "SO-2026-1234",              // wajib, untuk identifikasi deal
//   "reference_number": "REF-DSP-2026-0001",  // opsional, fallback identifier
//   "so_date": "2026-04-22",                  // opsional (YYYY-MM-DD)
//   "total_value": 70000000,                  // opsional (number >= 0)
//   "customer_po": "SPK/124/2026",            // opsional, No. PO/SP/SPK customer
//   "customer_name": "PT ABCD EFGH",          // opsional, untuk koreksi nama
//   "items": [ ... ]                          // opsional, kalau dikirim REPLACE total deal_products
// }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-wms-api-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface WmsItem {
  sku?: string;
  product_name?: string;
  category?: string;
  unit?: string;
  qty?: number;
  price_per_unit?: number;
  discount_pct?: number;
  discount_rp?: number;
}

interface Payload {
  so_number?: string;
  reference_number?: string;
  so_date?: string;
  total_value?: number;
  customer_po?: string;
  customer_name?: string;
  items?: WmsItem[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonError(405, "Method not allowed");

  try {
    const expectedKey = Deno.env.get("WMS_INTEGRATION_API_KEY");
    if (!expectedKey) return jsonError(500, "Server misconfiguration");
    if (req.headers.get("x-wms-api-key") !== expectedKey) {
      return jsonError(401, "Invalid or missing X-WMS-API-Key");
    }

    let body: Payload;
    try { body = await req.json(); } catch { return jsonError(400, "Invalid JSON body"); }

    const errs: string[] = [];
    if (!body.so_number || typeof body.so_number !== "string") {
      errs.push("so_number wajib (string)");
    }
    if (body.so_date !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(body.so_date)) {
      errs.push("so_date harus format YYYY-MM-DD");
    }
    if (body.total_value !== undefined && (typeof body.total_value !== "number" || body.total_value < 0)) {
      errs.push("total_value harus number >= 0");
    }
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
        });
      }
    }
    if (errs.length) return jsonError(400, errs.join("; "));

    const soNum = body.so_number!.trim();
    const refNum = body.reference_number?.trim() ?? null;
    const customerPo = body.customer_po?.trim();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Audit log entry
    const { data: logRow } = await supabase
      .from("wms_sync_log")
      .insert({
        event_type: "so_updated",
        reference_number: refNum,
        wms_so_number: soNum,
        payload: body as unknown as Record<string, unknown>,
        status: "received",
      })
      .select("id")
      .single();
    const logId = logRow?.id ?? null;

    // Cari deal: utama via wms_so_number, fallback ke reference_number
    type DealRow = { id: string; account_id: string; sales_id: string; name: string; value: number; stage: string; po_number: string | null; wms_so_date: string | null };
    let deal: DealRow | null = null;
    {
      const { data, error } = await supabase
        .from("deals")
        .select("id, account_id, sales_id, name, value, stage, po_number, wms_so_date")
        .eq("wms_so_number", soNum)
        .maybeSingle();
      if (error) {
        await markLog(supabase, logId, "failed", error.message);
        return jsonError(500, "Database error");
      }
      deal = data as DealRow | null;
    }
    if (!deal && refNum) {
      const { data } = await supabase
        .from("deals")
        .select("id, account_id, sales_id, name, value, stage, po_number, wms_so_date")
        .eq("reference_number", refNum)
        .maybeSingle();
      deal = data as DealRow | null;
    }
    if (!deal) {
      await markLog(supabase, logId, "failed", `Deal not found for SO ${soNum}`);
      return jsonError(404, `Deal untuk SO '${soNum}' tidak ditemukan`);
    }
    if (deal.stage === "canceled" || deal.stage === "lost") {
      await markLog(supabase, logId, "ignored", `Deal already ${deal.stage}`);
      return jsonError(409, `Deal sudah berstatus ${deal.stage}, tidak bisa di-update`);
    }

    const now = new Date().toISOString();
    const oldValue = Number(deal.value) || 0;
    const hasItems = Array.isArray(body.items) && body.items.length > 0;

    // Nilai pre-tax (DPP) — pakai subtotal_gross bukan grand_total.
    // Prioritas: subtotal_gross → total_value → total_amount → hitung dari items → oldValue
    let newValue = oldValue;
    if (hasItems) {
      newValue = body.items!.reduce((s, it) => {
        const gross = (it.qty ?? 0) * (it.price_per_unit ?? 0);
        const disc  = it.discount_rp ?? (gross * (it.discount_pct ?? 0) / 100);
        return s + gross - disc;
      }, 0);
    } else if (typeof (body as any).subtotal_gross === "number") {
      newValue = (body as any).subtotal_gross;
    } else if (typeof body.total_value === "number") {
      newValue = body.total_value;
    }

    const valueDiffPct = oldValue > 0 ? Math.abs(newValue - oldValue) / oldValue * 100 : 0;

    // Build update object — hanya field yg berubah
    const updatePayload: Record<string, unknown> = {
      wms_synced_at: now,
      wms_last_event_at: now,
    };
    if (customerPo !== undefined && customerPo.length > 0) updatePayload.po_number = customerPo;
    if (body.so_date) {
      updatePayload.wms_so_date = body.so_date;
      updatePayload.expected_close_date = body.so_date;
    }
    if (newValue !== oldValue) updatePayload.value = newValue;

    const { error: updErr } = await supabase
      .from("deals")
      .update(updatePayload)
      .eq("id", deal.id);
    if (updErr) {
      await markLog(supabase, logId, "failed", updErr.message);
      return jsonError(500, "Update deal gagal");
    }

    // Replace deal_products kalau items dikirim
    let itemsReplaced = 0;
    if (hasItems) {
      // Resolve SKU WMS → produk master SalesPulse
      const wmsSkus = body.items!.map((it: any) => it.sku).filter(Boolean) as string[];
      type MasterRow = { id: string; sku: string | null; wms_sku: string | null; name: string; unit: string | null };
      const masterMap = new Map<string, MasterRow>();
      if (wmsSkus.length > 0) {
        const { data: byWmsSku } = await supabase
          .from("products").select("id, sku, wms_sku, name, unit").in("wms_sku", wmsSkus);
        (byWmsSku ?? []).forEach((p: MasterRow) => { if (p.wms_sku) masterMap.set(p.wms_sku, p); });
        const unresolved = wmsSkus.filter(s => !masterMap.has(s));
        if (unresolved.length > 0) {
          const { data: bySku } = await supabase
            .from("products").select("id, sku, wms_sku, name, unit").in("sku", unresolved);
          (bySku ?? []).forEach((p: MasterRow) => { if (p.sku && !masterMap.has(p.sku)) masterMap.set(p.sku, p); });
        }
      }

      const { error: delErr } = await supabase
        .from("deal_products").delete().eq("deal_id", deal.id);
      if (delErr) {
        await markLog(supabase, logId, "failed", delErr.message);
        return jsonError(500, "Hapus deal_products gagal");
      }
      const rows = body.items!.map((it: any) => {
        const master  = it.sku ? masterMap.get(it.sku) : undefined;
        const gross   = (it.qty ?? 0) * (it.price_per_unit ?? 0);
        const discPct = it.discount_pct ?? 0;
        const discRp  = it.discount_rp  ?? (gross * discPct / 100);
        return {
          deal_id: deal!.id,
          product_name: master?.name ?? it.product_name!.trim(),
          category: (it.category ?? "").trim(),
          unit: master?.unit ?? (it.unit ?? "pcs").trim() || "pcs",
          qty: Math.floor(it.qty!),
          price_per_unit: it.price_per_unit!,
          discount_pct: discPct,
          discount_rp: discRp,
          other_cost: 0,
          sku: master?.sku ?? it.sku ?? null,
        };
      });
      const { error: insErr } = await supabase.from("deal_products").insert(rows);
      if (insErr) {
        await markLog(supabase, logId, "failed", insErr.message);
        return jsonError(500, "Insert deal_products gagal");
      }
      itemsReplaced = rows.length;
    }

    // Nama customer TIDAK di-overwrite dari WMS.
    // customer_name dari payload hanya dicatat di wms_sync_log (via payload).
    const customerNameUpdated = false;

    // Notifikasi ke sales owner
    const changes: string[] = [];
    if (customerPo !== undefined && customerPo.length > 0 && customerPo !== (deal.po_number ?? "")) {
      changes.push(`Customer PO: ${customerPo}`);
    }
    if (body.so_date && body.so_date !== deal.wms_so_date) changes.push(`Tgl SO: ${body.so_date}`);
    if (newValue !== oldValue) changes.push(`Nilai: ${formatIDR(newValue)}`);
    if (itemsReplaced > 0) changes.push(`${itemsReplaced} item produk diperbarui`);
    if (customerNameUpdated) changes.push("Nama customer diperbarui");

    if (changes.length > 0) {
      await supabase.from("notifications").insert({
        user_id: deal.sales_id,
        title: "SO Diperbarui di WMS",
        message: `Deal "${deal.name}" (SO ${soNum}) diperbarui: ${changes.join(", ")}.` +
          (valueDiffPct > 5 ? ` ⚠️ Selisih nilai ${valueDiffPct.toFixed(1)}%.` : ""),
        type: valueDiffPct > 5 ? "warning" : "info",
        reference_id: deal.id,
        reference_type: "deal",
      });
    }

    await markLog(supabase, logId, "processed", null);
    return new Response(
      JSON.stringify({
        status: "updated",
        deal_id: deal.id,
        wms_so_number: soNum,
        old_value: oldValue,
        new_value: newValue,
        value_diff_pct: Number(valueDiffPct.toFixed(2)),
        items_replaced: itemsReplaced,
        customer_name_updated: customerNameUpdated,
        po_number_updated: Boolean(customerPo),
        changes,
        synced_at: now,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("Unhandled error:", err);
    return jsonError(500, "Internal error");
  }
});

function jsonError(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function formatIDR(n: number): string {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
}

// deno-lint-ignore no-explicit-any
async function markLog(supabase: any, logId: string | null, status: string, errorMsg: string | null) {
  if (!logId) return;
  await supabase.from("wms_sync_log").update({
    status, error_message: errorMsg, processed_at: new Date().toISOString(),
  }).eq("id", logId);
}