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

function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
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

  const sku = clean(body.sku, 50);
  const name = clean(body.name, 255);
  if (!sku) return json({ error: "sku is required" }, 400);
  if (!name) return json({ error: "name is required" }, 400);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Resolve atau auto-create kategori berdasarkan nama (WMS kirim category_name)
  let categoryId: string | null = null;
  const categoryName = clean(body.category_name, 100);
  if (categoryName) {
    const { data: cat } = await admin
      .from("product_categories")
      .select("id")
      .eq("name", categoryName)
      .maybeSingle();

    if (cat) {
      categoryId = cat.id;
    } else {
      const { data: newCat, error: catErr } = await admin
        .from("product_categories")
        .insert({ name: categoryName, code: categoryName.toUpperCase().slice(0, 10), is_active: true })
        .select("id")
        .single();
      if (!catErr && newCat) categoryId = newCat.id;
    }
  }

  // Resolve unit (WMS kirim unit_name, fallback "pcs")
  const unitName = clean(body.unit_name, 50) || "pcs";

  const purchasePrice = num(body.purchase_price);
  const sellingPrice = num(body.selling_price, purchasePrice);

  const { data: existing, error: findErr } = await admin
    .from("products")
    .select("id, selling_price")
    .eq("sku", sku)
    .maybeSingle();

  if (findErr) {
    console.error("[wms-product-upsert] find error:", findErr);
    return json({ error: "Lookup failed. Contact SalesPulse administrator." }, 500);
  }

  // Logic: selling_price di SalesPulse adalah harga jual yang bisa diatur sales.
  // Saat update dari WMS, JANGAN overwrite selling_price jika sudah ada custom value
  // (sesuai memory product-data-synchronization). Hanya sinkronkan purchase_price & metadata.
  const basePayload: Record<string, unknown> = {
    sku,
    name,
    unit: unitName,
    purchase_price: purchasePrice,
    price: Math.round(sellingPrice), // legacy column (bigint)
    is_active: body.is_active !== false,
  };
  if (categoryId) basePayload.category_id = categoryId;

  if (existing) {
    // Update — pertahankan selling_price kecuali memang null/0
    const updatePayload: Record<string, unknown> = { ...basePayload };
    if (!existing.selling_price || Number(existing.selling_price) === 0) {
      updatePayload.selling_price = sellingPrice;
    }

    const { error: updErr } = await admin
      .from("products")
      .update(updatePayload)
      .eq("id", existing.id);

    if (updErr) {
      console.error("[wms-product-upsert] update error:", updErr);
      return json({ error: "Update failed. Contact SalesPulse administrator." }, 500);
    }

    return json({
      success: true,
      action: "updated",
      product_id: existing.id,
      sku,
      name,
      selling_price_preserved: !!(existing.selling_price && Number(existing.selling_price) > 0),
    });
  }

  const { data: inserted, error: insErr } = await admin
    .from("products")
    .insert({ ...basePayload, selling_price: sellingPrice })
    .select("id")
    .single();

  if (insErr) {
    console.error("[wms-product-upsert] insert error:", insErr);
    return json({ error: "Insert failed. Contact SalesPulse administrator." }, 500);
  }

  return json({
    success: true,
    action: "created",
    product_id: inserted.id,
    sku,
    name,
  }, 201);
});