// Edge Function: wms-revert-sync
// POST /functions/v1/wms-revert-sync
//
// Membatalkan/revert hasil sinkronisasi WMS pada sebuah deal.
// Gunakan saat data deal berubah karena WMS sync yang salah (REF tidak sesuai).
//
// Auth: JWT Supabase (via Authorization header).
// Otorisasi: hanya super_admin atau admin.
//
// Body: { "deal_id": "<uuid>", "revert_stage": "negotiation" (opsional) }
//
// Yang dilakukan:
// 1. Hapus deal_products yang diisi WMS (user perlu re-input manual)
// 2. Revert stage ke stage sebelum PO Secured (default: negotiation)
// 3. Bersihkan field WMS: wms_so_number, wms_so_date, wms_synced_at, wms_last_event_at
// 4. Catat ke wms_sync_log sebagai event "so_reverted"
//
// CATATAN: Nilai deal (value) dan nama deal TIDAK direset otomatis karena
// data asli sebelum WMS sync tidak disimpan. Admin perlu edit manual.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const REVERTABLE_STAGES = ["prospect", "quotation", "negotiation"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonError(405, "Method not allowed");

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonError(401, "Missing Authorization header");

    const SUPABASE_URL  = Deno.env.get("SUPABASE_URL") ?? "";
    const SERVICE_ROLE  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const ANON          = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    // Identifikasi caller
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userRes?.user) return jsonError(401, "Invalid token");
    const userId = userRes.user.id;

    // Cek role — hanya admin/super_admin
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: roleRow } = await admin
      .from("user_roles").select("system_role").eq("user_id", userId).maybeSingle();
    const isAdmin = roleRow?.system_role === "super_admin" || roleRow?.system_role === "admin";
    if (!isAdmin) return jsonError(403, "Hanya admin/super_admin yang bisa melakukan revert sync");

    let body: { deal_id?: string; revert_stage?: string };
    try { body = await req.json(); } catch { return jsonError(400, "Invalid JSON body"); }

    const dealId      = (body.deal_id ?? "").trim();
    const revertStage = REVERTABLE_STAGES.includes(body.revert_stage ?? "")
      ? body.revert_stage!
      : "negotiation";

    if (!dealId) return jsonError(400, "deal_id wajib (uuid)");

    // Load deal
    const { data: deal, error: dealErr } = await admin
      .from("deals")
      .select("id, sales_id, name, stage, value, wms_so_number, wms_so_date, wms_synced_at, reference_number")
      .eq("id", dealId)
      .maybeSingle();
    if (dealErr) return jsonError(500, dealErr.message);
    if (!deal) return jsonError(404, "Deal tidak ditemukan");

    if (!deal.wms_so_number && !deal.wms_synced_at) {
      return jsonError(400, "Deal ini belum pernah disync dari WMS, tidak ada yang perlu direvert");
    }

    const now = new Date().toISOString();
    const prevSoNumber = deal.wms_so_number;

    // 1. Hapus deal_products yang diisi WMS
    const { data: deletedProducts, error: delErr } = await admin
      .from("deal_products")
      .delete()
      .eq("deal_id", dealId)
      .select("product_name");
    if (delErr) return jsonError(500, `Gagal hapus produk: ${delErr.message}`);

    // 2. Revert stage + bersihkan WMS fields
    const { error: updErr } = await admin
      .from("deals")
      .update({
        stage: revertStage,
        probability: revertStage === "negotiation" ? 75 : revertStage === "quotation" ? 50 : 20,
        days_in_stage: 0,
        wms_so_number: null,
        wms_so_date: null,
        wms_synced_at: null,
        wms_last_event_at: now,
      })
      .eq("id", dealId);
    if (updErr) return jsonError(500, `Gagal revert deal: ${updErr.message}`);

    // 3. Catat ke wms_sync_log
    await admin.from("wms_sync_log").insert({
      event_type: "so_reverted",
      reference_number: deal.reference_number,
      wms_so_number: prevSoNumber,
      payload: {
        reverted_by: userId,
        reverted_at: now,
        prev_stage: deal.stage,
        revert_to_stage: revertStage,
        prev_wms_so_number: prevSoNumber,
        deleted_products: (deletedProducts ?? []).map(p => p.product_name),
        note: "Manual revert by admin — deal products cleared, WMS sync fields reset",
      },
      status: "processed",
      processed_at: now,
    });

    return new Response(JSON.stringify({
      status: "reverted",
      deal_id: dealId,
      deal_name: deal.name,
      reverted_by: userId,
      prev_stage: deal.stage,
      new_stage: revertStage,
      cleared_wms_so: prevSoNumber,
      deleted_products_count: (deletedProducts ?? []).length,
      deleted_products: (deletedProducts ?? []).map(p => p.product_name),
      note: "Deal products telah dihapus. Silakan re-input produk yang benar via form Edit Deal di SalesPulse.",
      reverted_at: now,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

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
