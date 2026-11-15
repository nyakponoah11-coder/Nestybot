// Public storefront data API. Bypasses PostgREST schema cache flakiness.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const [productsRes, settingsRes] = await Promise.all([
      admin.from("products").select("*").eq("in_stock", true).order("network").order("sort_order"),
      admin.from("settings").select("key,value"),
    ]);

    if (productsRes.error) return json({ error: productsRes.error.message }, 500);
    if (settingsRes.error) return json({ error: settingsRes.error.message }, 500);

    return json({
      products: productsRes.data || [],
      settings: settingsRes.data || [],
    });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});
