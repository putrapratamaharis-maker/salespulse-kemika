import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// Edge Function: wms-product-upsert
// POST /functions/v1/wms-product-upsert
//
// Sync produk dari WMS ke SalesPulse product master.
// Lookup dilakukan 3 tahap untuk mencegah duplikasi produk
// saat format SKU WMS berbeda dari SKU internal SalesPulse:
//
//   Step 1: Cari by wms_sku = body.sku
//           → ketemu → UPDATE
//   Step 2: Tidak ketemu → cari by sku = body.sku (SalesPulse internal SKU)
//           → ketemu → UPDATE + isi wms_sku (link ke WMS)
//   Step 3: Masih tidak ketemu → cari by name exact match
//           → ketemu → UPDATE + isi wms_sku
//   Step 4: Tidak ada → INSERT produk baru dengan wms_sku = body.sku
//
// Catatan selling_price:
// selling_price di SalesPulse adalah harga yang ditetapkan sales/admin.
// Saat sync dari WMS, selling_price TIDAK di-overwrite jika sudah terisi.
// Hanya purchase_price dan metadata yang diperbarui.

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

  const wmsSku = clean(body.sku, 50);
  const name   = clean(body.name, 255);
  if (!wmsSku) return json({ error: "sku (WMS SKU code) is required" }, 400);
  if (!name)   return json({ error: "name is required" }, 400);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  // Resolve atau auto-create kategori
  let categoryId: string | null = null;
  const categoryName = clean(body.category ?? body.category_name, 100);
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

  const unitName      = clean(body.unit ?? body.unit_name, 50) || "pcs";
  const purchasePrice = num(body.purchase_price);
  const sellingPrice  = num(body.selling_price, purchasePrice);

  // Base payload — selalu disimpan saat update/insert
  const basePayload: Record<string, unknown> = {
    wms_sku: wmsSku,
    name,
    unit: unitName,
    purchase_price: purchasePrice,
    price: Math.round(sellingPrice),
    is_active: body.is_active !== false,
  };
  if (categoryId) basePayload.category_id = categoryId;

  type ProductRow = { id: string; sku: string | null; selling_price: number | null; wms_sku: string | null };

  const doUpdate = async (row: ProductRow, matchedBy: string) => {
    const updatePayload: Record<string, unknown> = { ...basePayload };
    // Jangan overwrite selling_price jika sudah ada nilai custom
    if (!row.selling_price || Number(row.selling_price) === 0) {
      updatePayload.selling_price = sellingPrice;
    }
    const { error: updErr } = await admin
      .from("products")
      .update(updatePayload)
      .eq("id", row.id);

    if (updErr) {
      console.error("[wms-product-upsert] update error:", updErr);
      return json({ error: "Update failed" }, 500);
    }
    return json({
      success: true,
      action: "updated",
      matched_by: matchedBy,
      product_id: row.id,
      wms_sku: wmsSku,
      sku: row.sku,
      name,
      selling_price_preserved: !!(row.selling_price && Number(row.selling_price) > 0),
    });
  };

  // ── STEP 1: Cari by wms_sku ────────────────────────────────────────────
  {
    const { data, error } = await admin
      .from("products")
      .select("id, sku, selling_price, wms_sku")
      .eq("wms_sku", wmsSku)
      .maybeSingle();

    if (error) {
      console.error("[wms-product-upsert] step1 error:", error);
      return json({ error: "Lookup failed" }, 500);
    }
    if (data) return doUpdate(data as ProductRow, "wms_sku");
  }

  // ── STEP 2: Cari by sku (SalesPulse internal SKU) ─────────────────────
  {
    const { data, error } = await admin
      .from("products")
      .select("id, sku, selling_price, wms_sku")
      .eq("sku", wmsSku)
      .maybeSingle();

    if (error) {
      console.error("[wms-product-upsert] step2 error:", error);
      return json({ error: "Lookup failed" }, 500);
    }
    if (data) {
      console.log(`[wms-product-upsert] matched by sku="${wmsSku}", linking wms_sku`);
      return doUpdate(data as ProductRow, "sku");
    }
  }

  // ── STEP 3: Cari by name exact match ──────────────────────────────────
  {
    const { data, error } = await admin
      .from("products")
      .select("id, sku, selling_price, wms_sku")
      .eq("name", name)
      .is("wms_sku", null)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("[wms-product-upsert] step3 error:", error);
      return json({ error: "Lookup failed" }, 500);
    }
    if (data) {
      console.log(`[wms-product-upsert] matched by name="${name}", linking wms_sku=${wmsSku}`);
      return doUpdate(data as ProductRow, "name");
    }
  }

  // ── STEP 4: INSERT baru ────────────────────────────────────────────────
  const { data: inserted, error: insErr } = await admin
    .from("products")
    .insert({ ...basePayload, selling_price: sellingPrice })
    .select("id")
    .single();

  if (insErr) {
    console.error("[wms-product-upsert] insert error:", insErr);
    return json({ error: "Insert failed" }, 500);
  }

  return json({
    success: true,
    action: "created",
    matched_by: "none",
    product_id: inserted.id,
    wms_sku: wmsSku,
    name,
    note: "New product created from WMS sync.",
  }, 201);
});
