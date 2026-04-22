// Edge Function: wms-so-deleted
// POST /functions/v1/wms-so-deleted
// Webhook dipanggil oleh WMS saat Sales Order DI-HAPUS dari sistem WMS.
// Soft-handling: deal TIDAK dihapus dari CRM. Sebagai gantinya:
//  - kosongkan field WMS (wms_so_number, wms_so_date, wms_synced_at)
//  - kembalikan stage ke 'quotation' (kalau saat ini po_secured) supaya bisa di-link ulang
//  - kosongkan po_number jika diisi otomatis dari WMS
//  - notifikasi sales owner agar review manual
//
// Authentication: Header `X-WMS-API-Key` harus cocok dengan WMS_INTEGRATION_API_KEY.
//
// Body payload:
// {
//   "so_number": "SO-2026-1234",              // wajib
//   "reference_number": "REF-DSP-2026-0001",  // opsional, fallback identifier
//   "deleted_at": "2026-04-22T10:15:00Z",     // opsional, default now()
//   "reason": "Duplicate entry"               // opsional
// }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-wms-api-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Payload {
  so_number?: string;
  reference_number?: string;
  deleted_at?: string;
  reason?: string;
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

    if (!body.so_number || typeof body.so_number !== "string") {
      return jsonError(400, "so_number wajib (string)");
    }

    const soNum = body.so_number.trim();
    const refNum = body.reference_number?.trim() ?? null;
    const reason = (body.reason ?? "").trim() || "Deleted from WMS";
    const now = new Date().toISOString();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: logRow } = await supabase.from("wms_sync_log").insert({
      event_type: "so_deleted",
      reference_number: refNum,
      wms_so_number: soNum,
      payload: body as unknown as Record<string, unknown>,
      status: "received",
    }).select("id").single();
    const logId = logRow?.id ?? null;

    let deal: { id: string; sales_id: string; name: string; stage: string; po_number: string | null } | null = null;
    {
      const { data, error } = await supabase
        .from("deals")
        .select("id, sales_id, name, stage, po_number")
        .eq("wms_so_number", soNum)
        .maybeSingle();
      if (error) {
        await markLog(supabase, logId, "failed", error.message);
        return jsonError(500, "Database error");
      }
      deal = data as typeof deal;
    }
    if (!deal && refNum) {
      const { data } = await supabase
        .from("deals").select("id, sales_id, name, stage, po_number")
        .eq("reference_number", refNum).maybeSingle();
      deal = data as typeof deal;
    }
    if (!deal) {
      await markLog(supabase, logId, "ignored", `Deal not found for SO ${soNum}`);
      // 200 supaya WMS tidak retry — SO mungkin sudah pernah dihapus
      return new Response(
        JSON.stringify({ status: "skipped", reason: "Deal not found, nothing to clear" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Tentukan stage baru: kalau saat ini po_secured/invoice_issued, balikkan ke quotation supaya bisa di-link ulang
    const stageNow = deal.stage;
    const stageNext = (stageNow === "po_secured" || stageNow === "invoice_issued")
      ? "quotation"
      : stageNow;

    const { error: updErr } = await supabase
      .from("deals")
      .update({
        stage: stageNext,
        probability: stageNext === "quotation" ? 60 : undefined,
        wms_so_number: null,
        wms_so_date: null,
        wms_synced_at: null,
        po_number: null,  // kosongkan po_number karena auto-filled dari WMS
        wms_last_event_at: now,
      })
      .eq("id", deal.id);

    if (updErr) {
      await markLog(supabase, logId, "failed", updErr.message);
      return jsonError(500, "Update deal gagal");
    }

    await supabase.from("notifications").insert({
      user_id: deal.sales_id,
      title: "SO Dihapus dari WMS",
      message: `SO ${soNum} (Deal "${deal.name}") telah dihapus dari WMS. Stage dikembalikan ke ${stageNext === "quotation" ? "Quotation" : stageNow}. ` +
        `Alasan: ${reason}. Mohon review manual.`,
      type: "warning",
      reference_id: deal.id,
      reference_type: "deal",
    });

    await markLog(supabase, logId, "processed", null);
    return new Response(
      JSON.stringify({
        status: "cleared",
        deal_id: deal.id,
        wms_so_number: soNum,
        previous_stage: stageNow,
        new_stage: stageNext,
        reason,
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

// deno-lint-ignore no-explicit-any
async function markLog(supabase: any, logId: string | null, status: string, errorMsg: string | null) {
  if (!logId) return;
  await supabase.from("wms_sync_log").update({
    status, error_message: errorMsg, processed_at: new Date().toISOString(),
  }).eq("id", logId);
}