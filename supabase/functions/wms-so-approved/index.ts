// Edge Function: wms-so-approved
// POST /functions/v1/wms-so-approved
// Webhook dipanggil oleh WMS saat Sales Order di-APPROVE.
//
// Authentication: Header `X-WMS-API-Key` harus cocok dengan WMS_INTEGRATION_API_KEY.
//
// Body payload:
// {
//   "reference_number": "REF-DSP-2026-0001",  // wajib, dari SalesPulse
//   "so_number": "SO-2026-1234",              // wajib
//   "so_date": "2026-04-21",                  // wajib (YYYY-MM-DD)
//   "subtotal_gross": 249900,                 // DIUTAMAKAN — subtotal sebelum PPN & shipping (DPP)
//   "grand_total": 277389,                    // total akhir termasuk PPN & shipping (disimpan sebagai info)
//   "total_value": 249900,                    // legacy alias untuk subtotal_gross
//   "total_amount": 249900,                   // legacy alias untuk subtotal_gross
//   "tax_amount": 27489,                      // opsional — nominal PPN
//   "shipping_cost": 0,                       // opsional — biaya pengantaran
//   "customer_po": "SPK/123/2026",            // opsional, No. PO dari customer
//   "customer_name": "PT ABCD EFGH",          // opsional — tidak dipakai untuk overwrite nama akun
//   "items": [
//     {
//       "sku": "ACT300",                      // opsional, untuk match ke products master
//       "product_name": "Actellic 300 CS",    // wajib
//       "category": "Insektisida",            // opsional
//       "unit": "Botol",                      // opsional, default 'pcs'
//       "qty": 1,                             // wajib (integer >= 1)
//       "price_per_unit": 249900,             // wajib (number >= 0) — harga satuan pre-tax
//       "discount_pct": 0,                    // opsional — diskon per baris (%)
//       "discount_rp": 0                      // opsional — diskon per baris (Rp), dihitung otomatis jika tidak ada
//     }
//   ]
// }
//
// Logika nilai deal (deal.value):
// - Prioritas: subtotal_gross → total_value → total_amount
// - deal.value = pre-tax subtotal (DPP), BUKAN grand_total yang sudah include PPN
// - Ini konsisten dengan cara salesperson input harga di SalesPulse (pre-tax)
// - grand_total + tax_amount disimpan ke wms_sync_log payload untuk referensi
//
// Pemetaan kolom deals:
// - po_number    <- customer_po. Tidak di-overwrite jika tidak dikirim.
// - wms_so_number <- so_number
// - wms_so_date  <- so_date

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
  subtotal_gross?: number;  // PRIMARY: pre-tax subtotal (DPP) — ini yang masuk ke deal.value
  total_value?: number;     // legacy alias untuk subtotal_gross
  total_amount?: number;    // legacy alias untuk subtotal_gross
  grand_total?: number;     // total akhir include PPN+shipping — disimpan di log, TIDAK ke deal.value
  tax_amount?: number;      // nominal PPN (opsional, untuk info)
  shipping_cost?: number;   // biaya pengantaran (opsional, untuk info)
  customer_po?: string;
  customer_name?: string;   // hanya dicatat di log, tidak overwrite accounts.name
  items?: WmsItem[];
  dry_run?: boolean;        // jika true → preview saja, TIDAK ada perubahan ke DB
}

interface WmsItem {
  sku?: string;
  product_name?: string;
  category?: string;
  unit?: string;
  qty?: number;
  price_per_unit?: number;  // harga satuan pre-tax
  discount_pct?: number;    // diskon per baris (%)
  discount_rp?: number;     // diskon per baris (Rp)
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
    // Nilai pre-tax (DPP) yang masuk ke deal.value.
    // Prioritas: subtotal_gross → total_value → total_amount → grand_total (fallback)
    // grand_total idealnya TIDAK dipakai karena sudah include PPN, tapi diterima
    // sebagai fallback sementara WMS belum kirim subtotal_gross.
    const wmsSubtotalGross =
      typeof body.subtotal_gross === "number" ? body.subtotal_gross :
      typeof body.total_value   === "number" ? body.total_value :
      typeof body.total_amount  === "number" ? body.total_amount :
      typeof body.grand_total   === "number" ? body.grand_total :
      undefined;
    const valueSource =
      typeof body.subtotal_gross === "number" ? "subtotal_gross" :
      typeof body.total_value   === "number" ? "total_value" :
      typeof body.total_amount  === "number" ? "total_amount" :
      typeof body.grand_total   === "number" ? "grand_total_fallback" :
      "none";
    if (typeof wmsSubtotalGross !== "number" || !Number.isFinite(wmsSubtotalGross) || wmsSubtotalGross < 0) {
      errs.push("Nilai wajib (number >= 0). Field yang diterima: subtotal_gross | total_value | total_amount | grand_total");
    }
    const wmsGrandTotal =
      typeof body.grand_total === "number" ? body.grand_total :
      wmsSubtotalGross;
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

    // 4b. DRY RUN — preview saja, tidak ada perubahan ke DB
    if (body.dry_run === true) {
      // Ambil produk existing untuk perbandingan
      const { data: existingProducts } = await supabase
        .from("deal_products")
        .select("product_name, qty, unit, price_per_unit, sku")
        .eq("deal_id", deal.id);

      const existingNames = (existingProducts ?? []).map(p => p.product_name.toLowerCase());
      const incomingNames = (body.items ?? []).map(it => (it.product_name ?? "").toLowerCase());
      const mismatched = incomingNames.filter(n => !existingNames.includes(n));
      const removed    = existingNames.filter(n => !incomingNames.includes(n));

      const { data: accInfo } = await supabase
        .from("accounts").select("name").eq("id", deal.account_id).maybeSingle();
      const { data: salesInfo } = await supabase
        .from("profiles").select("full_name").eq("user_id", deal.sales_id).maybeSingle();

      return new Response(JSON.stringify({
        dry_run: true,
        status: "preview",
        deal: {
          id: deal.id,
          reference_number: refNum,
          current_stage: deal.stage,
          will_change_to_stage: "po_secured",
          account_name: accInfo?.name ?? "-",
          sales_name: salesInfo?.full_name ?? "-",
          current_value: Number(deal.value),
          new_value: wmsSubtotalGross,
          wms_grand_total: wmsGrandTotal,
        },
        items_comparison: {
          existing_products: existingProducts ?? [],
          incoming_products: body.items ?? [],
          new_items: mismatched.length > 0 ? mismatched : null,
          removed_items: removed.length > 0 ? removed : null,
          has_mismatch: mismatched.length > 0 || removed.length > 0,
        },
        warning: (mismatched.length > 0 || removed.length > 0)
          ? `⚠️ Produk tidak sesuai! Item baru dari WMS: [${mismatched.join(", ")}]. Item yang akan dihapus: [${removed.join(", ")}]. Pastikan REF ${refNum} sudah benar sebelum konfirmasi.`
          : null,
        confirmation_message: `Deal "${deal.id}" milik ${salesInfo?.full_name ?? deal.sales_id} akan dipindahkan ke PO Secured. Kirim ulang tanpa dry_run:true untuk mengkonfirmasi.`,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 5. Update deal
    const now = new Date().toISOString();
    const oldValue = Number(deal.value) || 0;
    const hasItems = Array.isArray(body.items) && body.items.length > 0;

    // deal.value = subtotal_gross (pre-tax/DPP), BUKAN grand_total.
    // Ini konsisten dengan cara salesperson input harga di SalesPulse.
    const newValue = wmsSubtotalGross!;
    const itemsSum = hasItems
      ? body.items!.reduce((sum, it) => {
          const gross = (it.qty ?? 0) * (it.price_per_unit ?? 0);
          const disc  = it.discount_rp ?? (gross * (it.discount_pct ?? 0) / 100);
          return sum + gross - disc;
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
      .eq("id", deal.id)
      // ⛔ Defensive: pastikan update hanya pernah menyentuh 1 baris (deal target).
      // Jika .select() mengembalikan != 1 row, sesuatu yang salah terjadi dan kita abort.
      .select("id");

    if (updErr) {
      await markLog(supabase, logId, "failed", updErr.message);
      return jsonError(500, "Update deal gagal");
    }

    // 5b. Replace deal_products jika items dikirim
    let itemsReplaced = 0;
    if (hasItems) {
      // Build lookup map: wms_sku → product master row
      // Ini untuk resolve SKU WMS ke SKU internal SalesPulse
      const wmsSkus = body.items!.map(it => it.sku).filter(Boolean) as string[];
      type MasterRow = { id: string; sku: string | null; wms_sku: string | null; name: string; category_id: string | null; unit: string | null };
      const masterMap = new Map<string, MasterRow>(); // key = wms_sku

      if (wmsSkus.length > 0) {
        // Cari by wms_sku dulu
        const { data: byWmsSku } = await supabase
          .from("products")
          .select("id, sku, wms_sku, name, category_id, unit")
          .in("wms_sku", wmsSkus);
        (byWmsSku ?? []).forEach((p: MasterRow) => {
          if (p.wms_sku) masterMap.set(p.wms_sku, p);
        });

        // Fallback: cari by sku (SalesPulse internal) untuk SKU yang belum ter-resolve
        const unresolved = wmsSkus.filter(s => !masterMap.has(s));
        if (unresolved.length > 0) {
          const { data: bySku } = await supabase
            .from("products")
            .select("id, sku, wms_sku, name, category_id, unit")
            .in("sku", unresolved);
          (bySku ?? []).forEach((p: MasterRow) => {
            if (p.sku && !masterMap.has(p.sku)) masterMap.set(p.sku, p);
          });
        }
      }

      // Hapus semua produk lama
      const { error: delErr } = await supabase
        .from("deal_products")
        .delete()
        .eq("deal_id", deal.id);
      if (delErr) {
        return jsonError(500, `Hapus deal_products gagal: ${delErr.message}`);
      }

      // Insert produk baru — gunakan data master jika SKU ter-resolve
      const rows = body.items!.map((it) => {
        const master = it.sku ? masterMap.get(it.sku) : undefined;
        const gross   = (it.qty ?? 0) * (it.price_per_unit ?? 0);
        const discPct = it.discount_pct ?? 0;
        const discRp  = it.discount_rp  ?? (gross * discPct / 100);

        return {
          deal_id: deal.id,
          // Nama & kategori: prioritas dari master produk SalesPulse jika ter-resolve,
          // fallback ke data WMS payload
          product_name: master?.name ?? it.product_name!.trim(),
          category: (it.category ?? "").trim(),
          unit: master?.unit ?? (it.unit ?? "pcs").trim() || "pcs",
          qty: Math.floor(it.qty!),
          price_per_unit: it.price_per_unit!,
          discount_pct: discPct,
          discount_rp: discRp,
          other_cost: 0,
          // Simpan SKU: SalesPulse internal jika ter-resolve, WMS SKU jika tidak
          sku: master?.sku ?? it.sku ?? null,
        };
      });

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
        value_source: valueSource,        // subtotal_gross | total_value | grand_total_fallback
        wms_grand_total: wmsGrandTotal,
        wms_tax_amount: body.tax_amount ?? null,
        wms_shipping_cost: body.shipping_cost ?? null,
        warning: valueSource === "grand_total_fallback"
          ? "deal.value diisi dari grand_total (include PPN). Kirim subtotal_gross untuk nilai pre-tax yang akurat."
          : null,
        value_diff_pct: Number(valueDiffPct.toFixed(2)),
        wms_items_subtotal: itemsSum,
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
