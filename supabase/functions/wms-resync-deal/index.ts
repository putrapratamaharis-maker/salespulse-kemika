// Edge Function: wms-resync-deal
// POST /functions/v1/wms-resync-deal
// Re-apply the LAST WMS so_approved/so_updated webhook payload for a given deal,
// using the stored payload from `wms_sync_log` (event_type IN ('so_approved','so_updated')).
//
// Auth: requires a valid Supabase JWT (verify_jwt = true, default).
// Authorisation: caller must be the deal owner (sales_id) OR a super_admin/admin.
//
// Request body: { "deal_id": "<uuid>" }
//
// Response 200:
//   { status: "resynced", event_type, deal_id, log_id, last_event_at, ... }
// Response 200 (no log to replay):
//   { status: "no_log", message }

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

interface WmsItem {
  sku?: string;
  product_name?: string;
  category?: string;
  unit?: string;
  qty?: number;
  price_per_unit?: number;
  other_cost?: number;
}

interface WmsPayload {
  reference_number?: string;
  so_number?: string;
  so_date?: string;
  total_value?: number;
  total_amount?: number;
  grand_total?: number;
  customer_po?: string;
  customer_name?: string;
  items?: WmsItem[];
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
        "id, sales_id, account_id, name, stage, value, segment, reference_number, wms_so_number",
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

    if (!deal.reference_number && !deal.wms_so_number) {
      return ok({
        status: "no_so",
        message:
          "Deal ini belum memiliki No. Referensi maupun No. SO WMS, jadi belum ada event WMS untuk diresync.",
      });
    }

    if (deal.stage === "canceled" || deal.stage === "lost") {
      return jsonError(
        409,
        `Deal sudah berstatus ${deal.stage}, tidak bisa di-sync.`,
      );
    }

    // 2. Find latest so_approved/so_updated log for this deal
    //    (cari berdasarkan reference_number dulu, fallback ke wms_so_number)
    let logQuery = admin
      .from("wms_sync_log")
      .select("id, event_type, payload, created_at")
      .in("event_type", ["so_approved", "so_updated"])
      .order("created_at", { ascending: false })
      .limit(1);

    if (deal.reference_number) {
      logQuery = logQuery.eq("reference_number", deal.reference_number);
    } else if (deal.wms_so_number) {
      logQuery = logQuery.eq("wms_so_number", deal.wms_so_number);
    }

    const { data: lastLog, error: logErr } = await logQuery.maybeSingle();
    if (logErr) return jsonError(500, logErr.message);

    if (!lastLog) {
      return ok({
        status: "no_log",
        message:
          `Belum ada event SO Approved/Updated tersimpan untuk ${
            deal.reference_number ?? deal.wms_so_number
          }. WMS belum pernah mengirim webhook untuk deal ini, atau log sudah dihapus.`,
      });
    }

    const payload = (lastLog.payload ?? {}) as WmsPayload;

    const soNum = (payload.so_number ?? "").trim();
    const soDate = payload.so_date;
    const wmsTotal =
      typeof payload.total_amount === "number" ? payload.total_amount :
      typeof payload.grand_total === "number" ? payload.grand_total :
      typeof payload.total_value === "number" ? payload.total_value :
      undefined;

    if (!soNum || !soDate || typeof wmsTotal !== "number") {
      return jsonError(
        422,
        "Payload terakhir tidak lengkap (so_number/so_date/total_amount kurang). Tidak bisa di-replay.",
      );
    }

    // 3. Re-apply same logic as wms-so-approved
    const now = new Date().toISOString();
    const oldValue = Number(deal.value) || 0;
    const newValue = wmsTotal;
    const customerPo = (payload.customer_po ?? "").trim();
    const hasItems = Array.isArray(payload.items) && payload.items.length > 0;

    const itemsSum = hasItems
      ? payload.items!.reduce((sum, it) => {
          const line = (it.qty ?? 0) * (it.price_per_unit ?? 0) +
            (it.other_cost ?? 0);
          return sum + line;
        }, 0)
      : null;

    const valueDiffPct = oldValue > 0
      ? Math.abs(newValue - oldValue) / oldValue * 100
      : 0;

    const dealUpdate: Record<string, unknown> = {
      stage: "po_secured",
      probability: 100,
      wms_so_number: soNum,
      wms_so_date: soDate,
      wms_synced_at: now,
      wms_last_event_at: now,
      value: newValue,
      expected_close_date: soDate,
    };
    if (customerPo) dealUpdate.po_number = customerPo;
    if (deal.stage !== "po_secured") dealUpdate.days_in_stage = 0;

    const { error: updErr } = await admin
      .from("deals")
      .update(dealUpdate)
      .eq("id", deal.id);
    if (updErr) return jsonError(500, `Update deal gagal: ${updErr.message}`);

    // 4. Replace deal_products jika items tersedia di payload
    let itemsReplaced = 0;
    if (hasItems) {
      const { error: delErr } = await admin
        .from("deal_products")
        .delete()
        .eq("deal_id", deal.id);
      if (delErr) {
        return jsonError(500, `Hapus deal_products gagal: ${delErr.message}`);
      }

      const rows = payload.items!.map((it) => ({
        deal_id: deal.id,
        product_name: (it.product_name ?? "").trim(),
        category: (it.category ?? "").trim(),
        unit: (it.unit ?? "pcs").trim() || "pcs",
        qty: Math.floor(it.qty ?? 1),
        price_per_unit: it.price_per_unit ?? 0,
        other_cost: it.other_cost ?? 0,
      }));

      const { error: insErr } = await admin
        .from("deal_products")
        .insert(rows);
      if (insErr) {
        return jsonError(500, `Insert deal_products gagal: ${insErr.message}`);
      }
      itemsReplaced = rows.length;
    }

    // 5. Koreksi nama customer (jika dikirim)
    let customerNameUpdated = false;
    if (payload.customer_name && payload.customer_name.trim()) {
      const newName = payload.customer_name.trim();
      const { data: acc } = await admin
        .from("accounts")
        .select("name")
        .eq("id", deal.account_id)
        .maybeSingle();

      if (acc && acc.name !== newName) {
        const { error: accErr } = await admin
          .from("accounts")
          .update({ name: newName })
          .eq("id", deal.account_id);
        if (!accErr) customerNameUpdated = true;
      }
    }

    // 6. Log the resync as a new entry so audit trail stays intact
    const { data: newLog } = await admin
      .from("wms_sync_log")
      .insert({
        event_type: "so_approved_resync",
        reference_number: deal.reference_number,
        wms_so_number: soNum,
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
      event_type: lastLog.event_type,
      deal_id: deal.id,
      log_id: newLog?.id ?? null,
      source_log_id: lastLog.id,
      last_event_at: now,
      original_event_at: lastLog.created_at,
      reference_number: deal.reference_number,
      wms_so_number: soNum,
      wms_so_date: soDate,
      old_value: oldValue,
      new_value: newValue,
      value_diff_pct: Number(valueDiffPct.toFixed(2)),
      wms_items_subtotal: itemsSum,
      tax_or_adjustment: itemsSum !== null
        ? Number((newValue - itemsSum).toFixed(2))
        : null,
      items_replaced: itemsReplaced,
      customer_po_updated: Boolean(customerPo),
      customer_name_updated: customerNameUpdated,
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