// Edge Function: list-open-references
// GET /functions/v1/list-open-references
// Mengembalikan daftar deal aktif (Prospect s/d PO Secured) untuk ditampilkan
// di dropdown form Sales Order di Warehouse Management System (WMS).
//
// Authentication: Header `X-WMS-API-Key` harus cocok dengan secret WMS_INTEGRATION_API_KEY.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-wms-api-key",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const ACTIVE_STAGES = [
  "prospect",
  "quotation",
  "negotiation",
  "po_secured",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1. Validasi API key dari WMS
    const expectedKey = Deno.env.get("WMS_INTEGRATION_API_KEY");
    if (!expectedKey) {
      console.error("WMS_INTEGRATION_API_KEY not configured");
      return jsonError(500, "Server misconfiguration");
    }
    const providedKey = req.headers.get("x-wms-api-key");
    if (!providedKey || providedKey !== expectedKey) {
      return jsonError(401, "Invalid or missing X-WMS-API-Key");
    }

    // 2. Optional query params: ?search=abc&segment=B2B&limit=100
    const url = new URL(req.url);
    const search = (url.searchParams.get("search") || "").trim().toLowerCase();
    const segment = (url.searchParams.get("segment") || "").trim();
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "200", 10), 500);

    // 3. Init Supabase admin client
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // 4. Fetch deals
    let query = supabase
      .from("deals")
      .select(
        "id, reference_number, name, value, stage, segment, expected_close_date, account_id, sales_id, wms_so_number, wms_so_date",
      )
      .in("stage", ACTIVE_STAGES)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (segment) query = query.eq("segment", segment);

    const { data: deals, error: dealsErr } = await query;
    if (dealsErr) {
      console.error("deals query error:", dealsErr);
      return jsonError(500, dealsErr.message);
    }

    // 5. Fetch related accounts & sales names
    const accountIds = [...new Set((deals || []).map((d) => d.account_id))];
    const salesIds = [...new Set((deals || []).map((d) => d.sales_id))];

    const [{ data: accounts }, { data: profiles }] = await Promise.all([
      supabase.from("accounts").select("id, name, customer_id").in("id", accountIds),
      supabase.from("profiles").select("user_id, full_name").in("user_id", salesIds),
    ]);

    const accMap = new Map((accounts || []).map((a) => [a.id, a]));
    const salesMap = new Map(
      (profiles || []).map((p) => [p.user_id, p.full_name]),
    );

    // 6. Fetch products per deal
    const { data: products } = await supabase
      .from("deal_products")
      .select("deal_id, product_name, qty, unit, price_per_unit")
      .in("deal_id", (deals || []).map((d) => d.id));

    const productMap = new Map<string, any[]>();
    (products || []).forEach((p) => {
      const arr = productMap.get(p.deal_id) || [];
      arr.push(p);
      productMap.set(p.deal_id, arr);
    });

    // 7. Build response
    const results = (deals || [])
      .map((d) => {
        const acc = accMap.get(d.account_id);
        return {
          deal_id: d.id,
          reference_number: d.reference_number,
          deal_name: d.name,
          account_id: d.account_id,
          customer_code: acc?.customer_id || null,
          customer_name: acc?.name || null,
          segment: d.segment,
          stage: d.stage,
          value: Number(d.value) || 0,
          expected_close_date: d.expected_close_date,
          sales_id: d.sales_id,
          sales_name: salesMap.get(d.sales_id) || null,
          already_synced: !!d.wms_so_number,
          wms_so_number: d.wms_so_number || null,
          wms_so_date: d.wms_so_date || null,
          products: (productMap.get(d.id) || []).map((p) => ({
            name: p.product_name,
            qty: p.qty,
            unit: p.unit,
            price_per_unit: Number(p.price_per_unit) || 0,
          })),
        };
      })
      .filter((r) => {
        if (!search) return true;
        return (
          (r.reference_number || "").toLowerCase().includes(search) ||
          (r.deal_name || "").toLowerCase().includes(search) ||
          (r.customer_name || "").toLowerCase().includes(search) ||
          (r.customer_code || "").toLowerCase().includes(search)
        );
      });

    return new Response(
      JSON.stringify({ count: results.length, data: results }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("Unhandled error:", err);
    return jsonError(500, err instanceof Error ? err.message : "Unknown error");
  }
});

function jsonError(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}