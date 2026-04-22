import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

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

// Map WMS customer_type → SalesPulse segment
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

  // Authenticate via X-WMS-API-Key
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
  if (!code) return json({ error: "code (customer code) is required" }, 400);
  if (!name) return json({ error: "name is required" }, 400);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Cek apakah customer dengan code ini sudah ada
  const { data: existing, error: findErr } = await admin
    .from("accounts")
    .select("id, name, sales_id")
    .eq("customer_id", code)
    .maybeSingle();

  if (findErr) {
    console.error("[wms-customer-upsert] find error:", findErr);
    return json({ error: "Lookup failed. Contact SalesPulse administrator." }, 500);
  }

  const customerType = clean(body.customer_type, 50) || "Corporate";
  const payload: Record<string, unknown> = {
    customer_id: code,
    name,
    type: mapType(customerType),
    segment: mapSegment(customerType),
    pic_name: clean(body.pic, 255),
    pic_email: clean(body.email, 255),
    pic_contact: clean(body.phone, 50),
    city: clean(body.city, 100),
    region: clean(body.region ?? body.city, 100),
    status: body.is_active === false ? "Inactive" : "Active",
  };

  if (existing) {
    // UPDATE — pertahankan sales_id existing
    const { error: updErr } = await admin
      .from("accounts")
      .update(payload)
      .eq("id", existing.id);

    if (updErr) {
      console.error("[wms-customer-upsert] update error:", updErr);
      return json({ error: "Update failed. Contact SalesPulse administrator." }, 500);
    }

    return json({
      success: true,
      action: "updated",
      account_id: existing.id,
      customer_id: code,
      name,
    });
  }

  // INSERT — butuh sales_id default (admin/super_admin pertama)
  const { data: defaultSalesData, error: salesErr } = await admin.rpc("get_default_sync_sales_id");
  if (salesErr || !defaultSalesData) {
    console.error("[wms-customer-upsert] no default sales user:", salesErr);
    return json({
      error: "No default sales owner available. Set at least one active admin/super_admin user in SalesPulse.",
    }, 503);
  }

  const { data: inserted, error: insErr } = await admin
    .from("accounts")
    .insert({ ...payload, sales_id: defaultSalesData })
    .select("id")
    .single();

  if (insErr) {
    console.error("[wms-customer-upsert] insert error:", insErr);
    return json({ error: "Insert failed. Contact SalesPulse administrator." }, 500);
  }

  return json({
    success: true,
    action: "created",
    account_id: inserted.id,
    customer_id: code,
    name,
    note: "Default sales owner assigned. Reassign in SalesPulse if needed.",
  }, 201);
});