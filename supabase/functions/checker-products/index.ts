// Public: WAEC/BECE result checker availability + the shop's selling prices.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, "Content-Type": "application/json" },
});

const DEFAULT_PRICE = 20;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: settings } = await supabase.from("settings")
      .select("key,value").in("key", ["waec_price", "bece_price"]);
    const smap = Object.fromEntries((settings || []).map((s: any) => [s.key, s.value]));

    let stock: Record<string, { inStock: boolean; stockCount: number; cost: number }> = {};
    const key = Deno.env.get("DATAMART_API_KEY");
    if (key) {
      try {
        const res = await fetch("https://api.datamartgh.shop/api/checkers/products", {
          headers: { "X-API-Key": key, Accept: "application/json" },
        });
        const body = await res.json();
        for (const p of (body?.data || [])) {
          stock[String(p.name).toUpperCase()] = {
            inStock: !!p.inStock,
            stockCount: Number(p.stockCount) || 0,
            cost: Number(p.price) || 0,
          };
        }
      } catch (_) { /* stock unknown */ }
    }

    const build = (type: "WAEC" | "BECE", settingKey: string) => ({
      type,
      price: Number(smap[settingKey]) > 0 ? Number(smap[settingKey]) : DEFAULT_PRICE,
      cost: stock[type]?.cost ?? null,
      inStock: stock[type]?.inStock ?? true,
      stockCount: stock[type]?.stockCount ?? null,
    });

    return json({ checkers: [build("WAEC", "waec_price"), build("BECE", "bece_price")] });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unknown" }, 500);
  }
});
