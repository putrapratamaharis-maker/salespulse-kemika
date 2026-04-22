// Edge Function: wms-so-cancelled
// POST /functions/v1/wms-so-cancelled
// Webhook dipanggil oleh WMS saat Sales Order DI-CANCEL.
// Soft-handling: deal stage diubah ke 'canceled', alasan + waktu disimpan,
// data historis tetap utuh untuk audit & report.
//
// Authentication: Header `X-WMS-API-Key` harus cocok dengan WMS_INTEGRATION_API_KEY.
//
// Body payload:
// {
//   "so_number": "SO-2026-1234",              // wajib
//   "reference_number": "REF-DSP-2026-0001",  // opsional, fallback identifier
//   "cancelled_at": "2026-04-22T10:15:00Z",   // opsional (ISO timestamp), default now()
//   "reason": "Customer batal order"          // opsional, akan disimpan
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
  cancelled_at?: string;
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
    const cancelledAt = body.cancelled_at && !isNaN(Date.parse(body.cancelled_at))
      ? new Date(body.cancelled_at).toISOString()
      : new Date().toISOString();
    const reason = (body.reason ?? "").trim() || "Cancelled from WMS";

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: logRow } = await supabase.from("wms_sync_log").insert({
      event_type: "so_cancelled",
      reference_number: refNum,
      wms_so_number: soNum,
      payload: body as unknown as Record<string, unknown>,
      status: "received",
    }).select("id").single();
    const logId = logRow?.id ?? null;

    // Cari deal: utama via wms_so_number, fallback ke reference_number
    let deal: { id: string; sales_id: string; name: string; stage: string } | null = null;
    {
      const { data, error } = await supabase
        .from("deals")
        .select("id, sales_id, name, stage")
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
        .from("deals").select("id, sales_id, name, stage")
        .eq("reference_number", refNum).maybeSingle();
      deal = data as typeof deal;
    }
    if (!deal) {
      await markLog(supabase, logId, "failed", `Deal not found for SO ${soNum}`);
      return jsonError(404, `Deal untuk SO '${soNum}' tidak ditemukan`);
    }
    if (deal.stage === "canceled") {
      await markLog(supabase, logId, "ignored", "Already cancelled");
      return new Response(
        JSON.stringify({ status: "skipped", reason: "Already cancelled", deal_id: deal.id }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { error: updErr } = await supabase
      .from("deals")
      .update({
        stage: "canceled",
        probability: 0,
        wms_cancelled_at: cancelledAt,
        wms_cancel_reason: reason,
        wms_synced_at: new Date().toISOString(),
        wms_last_event_at: new Date().toISOString(),
      })
      .eq("id", deal.id);

    if (updErr) {
      await markLog(supabase, logId, "failed", updErr.message);
      return jsonError(500, "Update deal gagal");
    }

    await supabase.from("notifications").insert({
      user_id: deal.sales_id,
      title: "SO Dibatalkan di WMS",
      message: `Deal "${deal.name}" (SO ${soNum}) telah dibatalkan di WMS. Alasan: ${reason}`,
      type: "warning",
      reference_id: deal.id,
      reference_type: "deal",
    });

    await markLog(supabase, logId, "processed", null);
    return new Response(
      JSON.stringify({
        status: "cancelled",
        deal_id: deal.id,
        wms_so_number: soNum,
        cancelled_at: cancelledAt,
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