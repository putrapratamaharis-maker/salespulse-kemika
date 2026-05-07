// Edge Function: apar-resync-deal
// POST /functions/v1/apar-resync-deal
// Re-trigger the LAST AP/AR Nexus webhook event for a given deal,
// using the stored payload from `wms_sync_log` (event_type LIKE 'apar_%').
//
// Auth: requires a valid Supabase JWT (verify_jwt = true).
// Authorisation: caller must be the deal owner (sales_id) OR a super_admin/admin.
//
// Request body: { "deal_id": "<uuid>" }
//
// Response 200:
//   { status: "resynced", event_type, deal_id, log_id, last_event_at, replayed_payload }
// Response 200 (no log to replay):
//   { status: "no_log", message, latest_status: { ... } | null }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ReqBody {
  deal_id?: string;
}

interface AparPayload {
  event_type?: string;
  so_number?: string;
  invoice_number?: string;
  invoice_date?: string;
  invoice_amount?: number;
  due_date?: string;
  paid_amount?: number;
  paid_date?: string;
  reason?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") return jsonError(405, "Method not allowed");

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonError(401, "Missing Authorization header");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    // Auth client to identify the caller
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userRes?.user) return jsonError(401, "Invalid token");
    const userId = userRes.user.id;

    let body: ReqBody;
    try {
      body = await req.json();
    } catch {
      return jsonError(400, "Invalid JSON body");
    }
    const dealId = (body.deal_id ?? "").trim();
    if (!dealId) return jsonError(400, "deal_id wajib (uuid)");

    // Service-role client for downstream work
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // 1. Load deal + verify access
    const { data: deal, error: dealErr } = await admin
      .from("deals")
      .select(
        "id, sales_id, account_id, name, stage, value, segment, wms_so_number, ar_invoice_number, ar_paid_amount",
      )
      .eq("id", dealId)
      .maybeSingle();
    if (dealErr) return jsonError(500, dealErr.message);
    if (!deal) return jsonError(404, "Deal tidak ditemukan");

    // Role check
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("system_role")
      .eq("user_id", userId)
      .maybeSingle();
    const isAdmin = roleRow?.system_role === "super_admin" ||
      roleRow?.system_role === "admin";
    if (!isAdmin && deal.sales_id !== userId) {
      return jsonError(403, "Anda tidak berhak melakukan resync deal ini");
    }

    if (!deal.wms_so_number) {
      return ok({
        status: "no_so",
        message:
          "Deal ini belum memiliki No. SO WMS, jadi belum ada event AR untuk diresync.",
        latest_status: null,
      });
    }

    // 2. Find latest apar_* log for this SO
    const { data: lastLog, error: logErr } = await admin
      .from("wms_sync_log")
      .select(
        "id, event_type, payload, status, error_message, created_at, processed_at",
      )
      .eq("wms_so_number", deal.wms_so_number)
      .like("event_type", "apar_%")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (logErr) return jsonError(500, logErr.message);

    if (!lastLog) {
      return ok({
        status: "no_log",
        message:
          `Belum ada event AR/AP untuk SO ${deal.wms_so_number}. Tidak ada yang bisa di-resync.`,
        latest_status: null,
      });
    }

    const payload = (lastLog.payload ?? {}) as AparPayload;
    const event = payload.event_type as AparPayload["event_type"];
    const validEvents = [
      "approved",
      "partial_paid",
      "paid",
      "overdue",
      "cancelled",
      "revised",
    ];
    if (!event || !validEvents.includes(event)) {
      return jsonError(
        422,
        `Payload terakhir tidak valid (event_type='${event ?? "null"}'). Tidak bisa replay.`,
      );
    }

    const invNum = (payload.invoice_number ?? "").trim();
    const now = new Date().toISOString();
    const update: Record<string, unknown> = { ar_last_event_at: now };

    // 3. Apply same logic as apar-invoice-event (idempotent replay)
    switch (event) {
      case "approved": {
        update.stage = "invoice_issued";
        update.probability = 100;
        update.ar_invoice_number = invNum;
        update.ar_invoice_date = payload.invoice_date;
        update.ar_invoice_amount = payload.invoice_amount;
        update.ar_due_date = payload.due_date ?? null;
        update.ar_status = "approved";
        if (deal.stage !== "invoice_issued") update.days_in_stage = 0;

        if (invNum && payload.invoice_date && payload.invoice_amount != null) {
          await admin.from("invoices").upsert(
            {
              invoice_number: invNum,
              account_id: deal.account_id,
              sales_id: deal.sales_id,
              segment: deal.segment,
              net_sales: payload.invoice_amount,
              gross_profit: 0,
              issue_date: payload.invoice_date,
              due_date: payload.due_date ?? payload.invoice_date,
              deal_id: deal.id,
            },
            { onConflict: "invoice_number" },
          );
        }
        break;
      }
      case "partial_paid": {
        update.ar_paid_amount = payload.paid_amount ?? 0;
        update.ar_status = "partial_paid";
        if (invNum) update.ar_invoice_number = invNum;
        break;
      }
      case "paid": {
        update.ar_status = "paid";
        update.ar_paid_date = payload.paid_date;
        if (invNum) update.ar_invoice_number = invNum;
        if (invNum && payload.paid_date) {
          await admin
            .from("invoices")
            .update({ paid_date: payload.paid_date })
            .eq("invoice_number", invNum);
        }
        break;
      }
      case "overdue": {
        update.ar_status = "overdue";
        if (invNum) update.ar_invoice_number = invNum;
        break;
      }
      case "cancelled": {
        update.stage = "po_secured";
        update.ar_invoice_number = null;
        update.ar_invoice_date = null;
        update.ar_invoice_amount = null;
        update.ar_due_date = null;
        update.ar_paid_date = null;
        update.ar_paid_amount = 0;
        update.ar_status = "cancelled";
        if (deal.stage !== "po_secured") update.days_in_stage = 0;
        break;
      }
      case "revised": {
        update.ar_invoice_number = invNum;
        update.ar_invoice_date = payload.invoice_date;
        update.ar_invoice_amount = payload.invoice_amount;
        if (payload.due_date) update.ar_due_date = payload.due_date;
        if (invNum && payload.invoice_amount != null && payload.invoice_date) {
          await admin
            .from("invoices")
            .update({
              net_sales: payload.invoice_amount,
              issue_date: payload.invoice_date,
              ...(payload.due_date ? { due_date: payload.due_date } : {}),
            })
            .eq("invoice_number", invNum);
        }
        break;
      }
    }

    const { error: updErr } = await admin
      .from("deals")
      .update(update)
      .eq("id", deal.id);
    if (updErr) return jsonError(500, `Update deal gagal: ${updErr.message}`);

    // 4. Log the resync as a new entry so audit trail stays intact
    const { data: newLog } = await admin
      .from("wms_sync_log")
      .insert({
        event_type: `apar_${event}_resync`,
        wms_so_number: deal.wms_so_number,
        payload: {
          ...payload,
          _resynced_from_log_id: lastLog.id,
          _resynced_by: userId,
        } as unknown as Record<string, unknown>,
        status: "processed",
        processed_at: now,
      })
      .select("id")
      .single();

    return ok({
      status: "resynced",
      event_type: event,
      deal_id: deal.id,
      log_id: newLog?.id ?? null,
      source_log_id: lastLog.id,
      last_event_at: now,
      original_event_at: lastLog.created_at,
      replayed_payload: payload,
    });
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

function ok(data: unknown) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}