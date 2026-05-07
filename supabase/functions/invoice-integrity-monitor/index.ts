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

    // ===== Root-cause heuristics =====
    const rootCauses: string[] = [];

    if (orphanCount > 0) {
      // Pattern A: invoice_number tidak match deals.ar_invoice_number sama sekali
      const orphanNumbers = (orphans || []).map((o: any) => o.invoice_number).filter(Boolean);
      const { data: matchedDeals } = orphanNumbers.length > 0
        ? await supabase.from("deals").select("ar_invoice_number").in("ar_invoice_number", orphanNumbers)
        : { data: [] as any[] };
      const matchedSet = new Set((matchedDeals || []).map((d: any) => d.ar_invoice_number));
      const unmatched = orphanNumbers.filter((n: string) => !matchedSet.has(n));

      // Pattern B: format nomor invoice tidak konsisten (cek prefix)
      const prefixes = new Map<string, number>();
      for (const n of orphanNumbers) {
        const p = (n.match(/^[A-Za-z\-\/]+/)?.[0] || "(numeric)").toUpperCase();
        prefixes.set(p, (prefixes.get(p) || 0) + 1);
      }
      const prefixSummary = [...prefixes.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([p, c]) => `${p}×${c}`)
        .join(", ");

      if (unmatched.length === orphanNumbers.length && orphanNumbers.length > 0) {
        rootCauses.push(`• Orphan: nomor invoice tidak match field ar_invoice_number deal manapun → kemungkinan invoice di-input manual tanpa link deal, atau format penomoran berbeda (prefix terdeteksi: ${prefixSummary}).`);
      } else if (unmatched.length > 0) {
        rootCauses.push(`• Orphan: ${unmatched.length}/${orphanNumbers.length} nomor invoice tidak punya deal cocok (prefix: ${prefixSummary}); ${orphanNumbers.length - unmatched.length} cocok tapi deal_id belum ter-set → backfill diperlukan.`);
      } else {
        rootCauses.push(`• Orphan: nomor cocok dengan deal tapi deal_id NULL → trigger/insert path tidak set deal_id (cek edge function insert invoice).`);
      }
    }

    if (inactiveCount > 0) {
      // Pattern C: distribusi stage
      const stageCounts = new Map<string, number>();
      for (const i of inactive) {
        const s = i.deal?.stage || "unknown";
        stageCounts.set(s, (stageCounts.get(s) || 0) + 1);
      }
      const stageSummary = [...stageCounts.entries()]
        .map(([s, c]) => `${s}×${c}`)
        .join(", ");
      rootCauses.push(`• Inactive: deal dipindah ke stage non-aktif (${stageSummary}) setelah invoice terbit → user perlu hapus invoice terkait, atau revert stage deal.`);
    }

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
    const rootCauseBlock = rootCauses.length > 0
      ? `\n\n🔍 Kemungkinan root cause:\n${rootCauses.join("\n")}`
      : "";
    const message = `Peningkatan terdeteksi: ${deltaParts.join(", ")}.\n\n${messageParts.join("\n\n")}${rootCauseBlock}\n\nBuka Revenue & Margin untuk review.`;

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