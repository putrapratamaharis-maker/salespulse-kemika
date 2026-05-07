// Periodic monitor: detects orphan invoices (deal_id NULL) and invoices linked
// to inactive deals (canceled/lost/closed_lost), then notifies all admins.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Threshold: only alert when counts exceed these values
const ORPHAN_THRESHOLD = 0;
const INACTIVE_THRESHOLD = 0;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // 1. Count orphans (deal_id NULL)
    const { data: orphans, error: e1 } = await supabase
      .from("invoices")
      .select("id, invoice_number, account_id, net_sales, created_at")
      .is("deal_id", null);
    if (e1) throw e1;

    // 2. Count invoices on inactive deals (need a join via RPC-style query)
    const { data: allLinked, error: e2 } = await supabase
      .from("invoices")
      .select("id, invoice_number, deal_id, net_sales, deal:deals!inner(id, stage, name)")
      .not("deal_id", "is", null);
    if (e2) throw e2;

    const inactive = (allLinked || []).filter((inv: any) =>
      ["canceled", "lost", "closed_lost"].includes(inv.deal?.stage)
    );

    const orphanCount = orphans?.length ?? 0;
    const inactiveCount = inactive.length;

    if (orphanCount <= ORPHAN_THRESHOLD && inactiveCount <= INACTIVE_THRESHOLD) {
      return new Response(
        JSON.stringify({ ok: true, orphanCount, inactiveCount, alerted: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 3. Find admin users
    const { data: admins, error: e3 } = await supabase
      .from("user_roles")
      .select("user_id")
      .in("system_role", ["super_admin", "admin"]);
    if (e3) throw e3;

    // 4. Build deduped alert payload (one notif per admin per run)
    const today = new Date().toISOString().slice(0, 10);
    const title = "⚠️ Invoice Integrity Alert";
    const messageParts: string[] = [];
    if (orphanCount > 0) messageParts.push(`${orphanCount} invoice tanpa deal_id (orphan)`);
    if (inactiveCount > 0) messageParts.push(`${inactiveCount} invoice masih ter-link ke deal canceled/lost`);
    const message = `Terdeteksi: ${messageParts.join(" & ")}. Buka Revenue & Margin atau jalankan backfill.`;

    const notifs = (admins || []).map((a: any) => ({
      user_id: a.user_id,
      title,
      message,
      type: "warning",
      reference_type: "invoice_integrity",
      reference_id: today,
    }));

    // Skip if today's alert already sent (dedupe by reference_id+user)
    if (notifs.length > 0) {
      const { data: existing } = await supabase
        .from("notifications")
        .select("user_id")
        .eq("reference_type", "invoice_integrity")
        .eq("reference_id", today);
      const sent = new Set((existing || []).map((r: any) => r.user_id));
      const fresh = notifs.filter((n) => !sent.has(n.user_id));
      if (fresh.length > 0) {
        const { error: e4 } = await supabase.from("notifications").insert(fresh);
        if (e4) throw e4;
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        orphanCount,
        inactiveCount,
        alerted: true,
        adminsNotified: notifs.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("invoice-integrity-monitor error:", err);
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});