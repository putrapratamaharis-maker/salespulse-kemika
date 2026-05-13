import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// Edge Function: wms-customer-upsert
// POST /functions/v1/wms-customer-upsert
//
// Webhook dari WMS untuk sync data customer ke SalesPulse.
// Lookup dilakukan dengan 3 tahap untuk mencegah duplikasi akun:
//
//   Step 1: Cari by wms_customer_code = body.code
//           → ketemu → UPDATE
//   Step 2: Tidak ketemu → cari by name exact match
//           → ketemu → UPDATE + isi wms_customer_code (link ke WMS)
//   Step 3: Masih tidak ketemu → INSERT akun baru
//
// Dengan 3 tahap ini, akun yang sudah ada di SalesPulse (meski belum
// punya wms_customer_code) akan ter-link ke WMS tanpa membuat duplikat.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-wms-api-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function clean(v: unknown, max = 255): string {
  return String(v ?? "").trim().slice(0, max);
}

function mapSegment(customerType: string): string {
  const t = customerType.toLowerCase();
  if (t.includes("government") || t.includes("instansi") || t.includes("pemerintah")) return "B2G";
  if (t.includes("individual") || t.includes("retail") || t.includes("personal")) return "B2C";
  return "B2B";
}

function mapType(customerType: string): string {
  const t = customerType.trim();
  if (!t) return "Corporate";
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const apiKey = req.headers.get("x-wms-api-key");
  const expectedKey = Deno.env.get("WMS_INTEGRATION_API_KEY");
  if (!expectedKey) return json({ error: "Server not configured" }, 500);
  if (!apiKey || apiKey !== expectedKey) return json({ error: "Unauthorized" }, 401);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const code = clean(body.code, 50);
  const name = clean(body.name, 255);
  if (!code) return json({ error: "code (customer code from WMS) is required" }, 400);
  if (!name) return json({ error: "name is required" }, 400);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const customerType = clean(body.customer_type, 50) || "Corporate";
  const updatePayload: Record<string, unknown> = {
    name,
    wms_customer_code: code,
    type: mapType(customerType),
    segment: mapSegment(customerType),
    pic_name: clean(body.pic, 255),
    pic_email: clean(body.email, 255),
    pic_contact: clean(body.phone, 50),
    city: clean(body.city, 100),
    region: clean(body.region ?? body.city, 100),
    status: body.is_active === false ? "Inactive" : "Active",
  };

  // ── STEP 1: Cari by wms_customer_code ─────────────────────────────────
  {
    const { data, error } = await admin
      .from("accounts")
      .select("id, name")
      .eq("wms_customer_code", code)
      .maybeSingle();

    if (error) {
      console.error("[wms-customer-upsert] step1 error:", error);
      return json({ error: "Lookup failed" }, 500);
    }

    if (data) {
      const { error: updErr } = await admin
        .from("accounts")
        .update(updatePayload)
        .eq("id", data.id);

      if (updErr) {
        console.error("[wms-customer-upsert] update error:", updErr);
        return json({ error: "Update failed" }, 500);
      }

      return json({
        success: true,
        action: "updated",
        matched_by: "wms_customer_code",
        account_id: data.id,
        wms_customer_code: code,
        name,
      });
    }
  }

  // ── STEP 2: Cari by name (exact) — link akun SalesPulse yg sudah ada ──
  {
    const { data, error } = await admin
      .from("accounts")
      .select("id, name, wms_customer_code")
      .eq("name", name)
      .is("wms_customer_code", null)   // hanya akun yang belum ter-link
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("[wms-customer-upsert] step2 error:", error);
      return json({ error: "Lookup failed" }, 500);
    }

    if (data) {
      const { error: updErr } = await admin
        .from("accounts")
        .update(updatePayload)
        .eq("id", data.id);

      if (updErr) {
        console.error("[wms-customer-upsert] link error:", updErr);
        return json({ error: "Link account failed" }, 500);
      }

      return json({
        success: true,
        action: "linked",
        matched_by: "name",
        account_id: data.id,
        wms_customer_code: code,
        name,
        note: "Existing SalesPulse account linked to WMS customer code. No duplicate created.",
      });
    }
  }

  // ── STEP 3: Tidak ada akun → INSERT baru ───────────────────────────────
  const { data: defaultSalesId, error: salesErr } = await admin
    .rpc("get_default_sync_sales_id");

  if (salesErr || !defaultSalesId) {
    console.error("[wms-customer-upsert] no default sales user:", salesErr);
    return json({
      error: "No default sales owner available. Set at least one active admin/super_admin in SalesPulse.",
    }, 503);
  }

  const { data: inserted, error: insErr } = await admin
    .from("accounts")
    .insert({ ...updatePayload, sales_id: defaultSalesId })
    .select("id")
    .single();

  if (insErr) {
    console.error("[wms-customer-upsert] insert error:", insErr);
    return json({ error: "Insert failed" }, 500);
  }

  return json({
    success: true,
    action: "created",
    matched_by: "none",
    account_id: inserted.id,
    wms_customer_code: code,
    name,
    note: "New account created. Default sales owner assigned — reassign in SalesPulse if needed.",
  }, 201);
});
