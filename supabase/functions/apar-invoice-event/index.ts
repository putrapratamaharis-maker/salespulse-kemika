// Edge Function: apar-invoice-event
// POST /functions/v1/apar-invoice-event
// Webhook dipanggil oleh AP/AR Nexus setiap kali status invoice berubah.
// Menyinkronkan data invoice ke kartu deal SalesPulse berdasarkan No. SO yang sama.
//
// Authentication: Header `X-APAR-API-Key` harus cocok dengan APAR_INTEGRATION_API_KEY.
//
// Body payload:
// {
//   "event_type": "approved" | "partial_paid" | "paid" | "overdue" | "cancelled" | "revised",
//   "so_number": "SO-2026-1234",                // wajib, untuk match deal (= deals.wms_so_number)
//   "invoice_number": "INV-2026-0123",          // wajib (kecuali event=cancelled), nomor invoice baru dari AR
//   "invoice_date": "2026-04-25",               // wajib saat approved/revised
//   "invoice_amount": 66000000,                 // wajib saat approved/revised
//   "due_date": "2026-05-25",                   // opsional
//   "paid_amount": 30000000,                    // wajib saat partial_paid (running total)
//   "paid_date": "2026-05-15",                  // wajib saat paid
//   "ar_url": "https://apar.app/invoices/xxx",  // opsional, deep link
//   "reason": "..."                             // opsional, untuk cancelled
// }
//
// Behaviour:
// - approved   : stage -> invoice_issued, isi field ar_*, auto-create record di tabel invoices.
// - partial_paid: update ar_paid_amount + ar_status, kirim notif info.
// - paid       : isi ar_paid_date, set ar_status='paid', update invoices.paid_date, kirim notif success.
// - overdue    : set ar_status='overdue', kirim notif warning.
// - cancelled  : ROLLBACK stage ke po_secured, hapus field ar_*, kirim notif warning.
// - revised    : update ar_invoice_amount/date tanpa ubah stage, kirim notif info.
//
// Idempotency: skip jika event_type=approved dan ar_invoice_number sudah sama.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-apar-api-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type ArEvent =
  | "approved"
  | "partial_paid"
  | "paid"
  | "overdue"
  | "cancelled"
  | "revised";

interface Payload {
  event_type?: ArEvent;
  so_number?: string;
  invoice_number?: string;
  invoice_date?: string;
  invoice_amount?: number;
  due_date?: string;
  paid_amount?: number;
  paid_date?: string;
  ar_url?: string;
  reason?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonError(405, "Method not allowed");
  }

  try {
    // 1. Auth
    const expectedKey = Deno.env.get("APAR_INTEGRATION_API_KEY");
    if (!expectedKey) {
      return jsonError(500, "Server misconfiguration: APAR_INTEGRATION_API_KEY missing");
    }
    if (req.headers.get("x-apar-api-key") !== expectedKey) {
      return jsonError(401, "Invalid or missing X-APAR-API-Key");
    }

    // 2. Parse + validate
    let body: Payload;
    try {
      body = await req.json();
    } catch {
      return jsonError(400, "Invalid JSON body");
    }

    const errs: string[] = [];
    const validEvents: ArEvent[] = [
      "approved", "partial_paid", "paid", "overdue", "cancelled", "revised",
    ];
    if (!body.event_type || !validEvents.includes(body.event_type)) {
      errs.push(`event_type wajib (${validEvents.join("|")})`);
    }
    if (!body.so_number || typeof body.so_number !== "string") {
      errs.push("so_number wajib (string)");
    }
    if (body.event_type !== "cancelled") {
      if (!body.invoice_number || typeof body.invoice_number !== "string") {
        errs.push("invoice_number wajib (string) untuk event ini");
      }
    }
    if (body.event_type === "approved" || body.event_type === "revised") {
      if (!body.invoice_date || !/^\d{4}-\d{2}-\d{2}$/.test(body.invoice_date)) {
        errs.push("invoice_date wajib (YYYY-MM-DD) untuk approved/revised");
      }
      if (typeof body.invoice_amount !== "number" || body.invoice_amount < 0) {
        errs.push("invoice_amount wajib (number >= 0) untuk approved/revised");
      }
    }
    if (body.event_type === "partial_paid") {
      if (typeof body.paid_amount !== "number" || body.paid_amount < 0) {
        errs.push("paid_amount wajib (number >= 0) untuk partial_paid");
      }
    }
    if (body.event_type === "paid") {
      if (!body.paid_date || !/^\d{4}-\d{2}-\d{2}$/.test(body.paid_date)) {
        errs.push("paid_date wajib (YYYY-MM-DD) untuk paid");
      }
    }
    if (errs.length) return jsonError(400, errs.join("; "));

    const event = body.event_type!;
    const soNum = body.so_number!.trim();
    const invNum = (body.invoice_number ?? "").trim();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // 3. Log raw event
    const { data: logRow } = await supabase
      .from("wms_sync_log")
      .insert({
        event_type: `apar_${event}`,
        wms_so_number: soNum,
        payload: body as unknown as Record<string, unknown>,
        status: "received",
      })
      .select("id")
      .single();
    const logId = logRow?.id ?? null;

    // 4. Match deal by wms_so_number
    const { data: deal, error: dealErr } = await supabase
      .from("deals")
      .select(
        "id, sales_id, account_id, name, stage, value, ar_invoice_number, ar_paid_amount, segment",
      )
      .eq("wms_so_number", soNum)
      .maybeSingle();

    if (dealErr) {
      await markLog(supabase, logId, "failed", dealErr.message);
      return jsonError(500, "Database error");
    }
    if (!deal) {
      await markLog(supabase, logId, "failed", `Deal not found for SO ${soNum}`);
      return jsonError(
        404,
        `Deal dengan wms_so_number '${soNum}' tidak ditemukan di SalesPulse`,
      );
    }

    // 5. Idempotency: skip approved jika invoice_number sudah sama
    if (event === "approved" && deal.ar_invoice_number === invNum) {
      await markLog(supabase, logId, "ignored", "Already linked (idempotent)");
      return ok({
        status: "skipped",
        reason: "Already linked (idempotent)",
        deal_id: deal.id,
        ar_invoice_number: invNum,
      });
    }

    const now = new Date().toISOString();
    const update: Record<string, unknown> = { ar_last_event_at: now };
    let notifTitle = "";
    let notifMsg = "";
    let notifType: "info" | "success" | "warning" = "info";

    // 6. Apply update per event
    switch (event) {
      case "approved": {
        update.stage = "invoice_issued";
        update.probability = 100;
        update.ar_invoice_number = invNum;
        update.ar_invoice_date = body.invoice_date;
        update.ar_invoice_amount = body.invoice_amount;
        update.ar_due_date = body.due_date ?? null;
        update.ar_status = "approved";
        update.days_in_stage = 0;

        // Auto-create record di tabel invoices SalesPulse
        const { error: invErr } = await supabase
          .from("invoices")
          .upsert(
            {
              invoice_number: invNum,
              account_id: deal.account_id,
              sales_id: deal.sales_id,
              segment: deal.segment,
              net_sales: body.invoice_amount!,
              gross_profit: 0, // dihitung manual / dari margin deal
              issue_date: body.invoice_date!,
              due_date: body.due_date ?? body.invoice_date!,
            },
            { onConflict: "invoice_number" },
          );
        if (invErr) {
          console.warn("Insert invoices failed (non-fatal):", invErr.message);
        }

        notifTitle = "Invoice Diterbitkan di AP/AR";
        notifMsg = `Deal "${deal.name}" pindah ke Invoice Issued. No. Invoice: ${invNum}, nilai Rp ${body.invoice_amount!.toLocaleString("id-ID")}.`;
        notifType = "success";
        break;
      }
      case "partial_paid": {
        update.ar_paid_amount = body.paid_amount;
        update.ar_status = "partial_paid";
        if (invNum) update.ar_invoice_number = invNum;

        const total = Number(deal.ar_paid_amount ?? 0);
        notifTitle = "Pembayaran Sebagian Diterima";
        notifMsg = `Invoice ${invNum} dibayar sebagian: Rp ${body.paid_amount!.toLocaleString("id-ID")} (sebelumnya Rp ${total.toLocaleString("id-ID")}).`;
        notifType = "info";
        break;
      }
      case "paid": {
        update.ar_status = "paid";
        update.ar_paid_date = body.paid_date;
        if (invNum) update.ar_invoice_number = invNum;

        // Update invoices.paid_date
        if (invNum) {
          await supabase
            .from("invoices")
            .update({ paid_date: body.paid_date })
            .eq("invoice_number", invNum);
        }

        notifTitle = "✓ Invoice LUNAS";
        notifMsg = `Invoice ${invNum} untuk deal "${deal.name}" sudah LUNAS pada ${body.paid_date}.`;
        notifType = "success";
        break;
      }
      case "overdue": {
        update.ar_status = "overdue";
        if (invNum) update.ar_invoice_number = invNum;

        notifTitle = "⚠️ Invoice Overdue";
        notifMsg = `Invoice ${invNum} untuk deal "${deal.name}" sudah lewat jatuh tempo.`;
        notifType = "warning";
        break;
      }
      case "cancelled": {
        // Rollback ke po_secured + hapus field AR
        update.stage = "po_secured";
        update.ar_invoice_number = null;
        update.ar_invoice_date = null;
        update.ar_invoice_amount = null;
        update.ar_due_date = null;
        update.ar_paid_date = null;
        update.ar_paid_amount = 0;
        update.ar_status = "cancelled";
        update.days_in_stage = 0;

        notifTitle = "⚠️ Invoice Dibatalkan di AP/AR";
        notifMsg = `Invoice untuk deal "${deal.name}" dibatalkan${body.reason ? ": " + body.reason : ""}. Kartu dikembalikan ke PO Secured.`;
        notifType = "warning";
        break;
      }
      case "revised": {
        update.ar_invoice_number = invNum;
        update.ar_invoice_date = body.invoice_date;
        update.ar_invoice_amount = body.invoice_amount;
        if (body.due_date) update.ar_due_date = body.due_date;

        // Sync ke tabel invoices
        if (invNum) {
          await supabase
            .from("invoices")
            .update({
              net_sales: body.invoice_amount,
              issue_date: body.invoice_date,
              ...(body.due_date ? { due_date: body.due_date } : {}),
            })
            .eq("invoice_number", invNum);
        }

        const oldVal = Number(deal.value) || 0;
        const diffPct = oldVal > 0
          ? Math.abs(body.invoice_amount! - oldVal) / oldVal * 100
          : 0;
        notifTitle = "Invoice Direvisi di AP/AR";
        notifMsg = `Invoice ${invNum} direvisi. Nilai baru: Rp ${body.invoice_amount!.toLocaleString("id-ID")}` +
          (diffPct > 5 ? ` (selisih ${diffPct.toFixed(1)}% dari deal value).` : ".");
        notifType = diffPct > 5 ? "warning" : "info";
        break;
      }
    }

    const { error: updErr } = await supabase
      .from("deals")
      .update(update)
      .eq("id", deal.id);

    if (updErr) {
      await markLog(supabase, logId, "failed", updErr.message);
      return jsonError(500, `Update deal gagal: ${updErr.message}`);
    }

    // 7. Notif ke sales owner
    if (notifTitle) {
      await supabase.from("notifications").insert({
        user_id: deal.sales_id,
        title: notifTitle,
        message: notifMsg,
        type: notifType,
        reference_id: deal.id,
        reference_type: "deal",
      });
    }

    await markLog(supabase, logId, "processed", null);
    return ok({
      status: "synced",
      event_type: event,
      deal_id: deal.id,
      ar_invoice_number: invNum || null,
      synced_at: now,
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