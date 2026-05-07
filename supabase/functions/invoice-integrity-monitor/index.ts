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

    // Compare with previous run — only alert when counts INCREASED
    const { data: prevRun } = await supabase
      .from("invoice_integrity_runs")
      .select("orphan_count, inactive_count")
      .order("run_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const prevOrphan = prevRun?.orphan_count ?? 0;
    const prevInactive = prevRun?.inactive_count ?? 0;
    const orphanIncreased = orphanCount > prevOrphan && orphanCount > ORPHAN_THRESHOLD;
    const inactiveIncreased = inactiveCount > prevInactive && inactiveCount > INACTIVE_THRESHOLD;
    const shouldAlert = orphanIncreased || inactiveIncreased;

    // Always log this run for next comparison
    await supabase.from("invoice_integrity_runs").insert({
      orphan_count: orphanCount,
      inactive_count: inactiveCount,
      alerted: shouldAlert,
    });

    if (!shouldAlert) {
      return new Response(
        JSON.stringify({
          ok: true, orphanCount, inactiveCount, prevOrphan, prevInactive, alerted: false,
          reason: "no_increase",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 3. Find admin users
    const { data: admins, error: e3 } = await supabase
      .from("user_roles")
      .select("user_id")
      .in("system_role", ["super_admin", "admin"]);
    if (e3) throw e3;

    // 4. Build alert payload — unique per run timestamp (no daily dedupe needed
    // because we already gate on "increased vs previous run")
    const runStamp = new Date().toISOString();
    const title = "⚠️ Invoice Integrity Alert";

    // Resolve account names for orphan invoices
    const orphanAccountIds = [...new Set((orphans || []).map((o: any) => o.account_id).filter(Boolean))];
    const { data: accts } = orphanAccountIds.length > 0
      ? await supabase.from("accounts").select("id, name").in("id", orphanAccountIds)
      : { data: [] as any[] };
    const acctMap = new Map((accts || []).map((a: any) => [a.id, a.name]));

    const MAX_LIST = 10;
    const orphanLines = (orphans || []).slice(0, MAX_LIST).map((o: any) =>
      `• ${o.invoice_number} — ${acctMap.get(o.account_id) || "Akun tidak diketahui"}`
    );
    const inactiveLines = inactive.slice(0, MAX_LIST).map((i: any) =>
      `• ${i.invoice_number} — Deal "${i.deal?.name}" (${i.deal?.stage})`
    );

    const messageParts: string[] = [];
    if (orphanCount > 0) {
      messageParts.push(
        `🔸 ${orphanCount} invoice tanpa deal_id (orphan):\n${orphanLines.join("\n")}` +
        (orphanCount > MAX_LIST ? `\n…dan ${orphanCount - MAX_LIST} lainnya` : "")
      );
    }
    if (inactiveCount > 0) {
      messageParts.push(
        `🔸 ${inactiveCount} invoice di deal canceled/lost:\n${inactiveLines.join("\n")}` +
        (inactiveCount > MAX_LIST ? `\n…dan ${inactiveCount - MAX_LIST} lainnya` : "")
      );
    }
    const deltaParts: string[] = [];
    if (orphanIncreased) deltaParts.push(`orphan +${orphanCount - prevOrphan} (${prevOrphan}→${orphanCount})`);
    if (inactiveIncreased) deltaParts.push(`inactive +${inactiveCount - prevInactive} (${prevInactive}→${inactiveCount})`);
    const message = `Peningkatan terdeteksi: ${deltaParts.join(", ")}.\n\n${messageParts.join("\n\n")}\n\nBuka Revenue & Margin untuk review.`;

    const notifs = (admins || []).map((a: any) => ({
      user_id: a.user_id,
      title,
      message,
      type: "warning",
      reference_type: "invoice_integrity",
      reference_id: runStamp,
    }));

    if (notifs.length > 0) {
      const { error: e4 } = await supabase.from("notifications").insert(notifs);
      if (e4) throw e4;
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