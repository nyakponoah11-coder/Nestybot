// Admin-only: result checker purchases, live stock, and selling prices.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, "Content-Type": "application/json" },
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);
    const token = authHeader.replace("Bearer ", "");

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await userClient.auth.getUser(token);
    if (!userData.user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const isOwner = userData.user.email?.toLowerCase() === "stillmoving11@gmail.com";
    let isAdmin = isOwner;
    if (!isAdmin) {
      const { data: roleRow } = await admin.from("user_roles")
        .select("id").eq("user_id", userData.user.id).eq("role", "admin").maybeSingle();
      if (roleRow) isAdmin = true;
    }
    if (!isAdmin) return json({ error: "Forbidden" }, 403);

    // Auto-upsert admin role for session resilience
    await admin.from("user_roles").upsert({ user_id: userData.user.id, role: "admin" }, { onConflict: "user_id,role" }).catch(() => {});

    const body = await req.json().catch(() => ({}));
    const action = body?.action || "overview";

    if (action === "setPrices") {
      const waec = Number(body.waec_price);
      const bece = Number(body.bece_price);
      if (!Number.isFinite(waec) || waec <= 0) return json({ error: "Invalid WAEC price" }, 400);
      if (!Number.isFinite(bece) || bece <= 0) return json({ error: "Invalid BECE price" }, 400);
      await admin.from("settings").upsert([
        { key: "waec_price", value: String(waec) },
        { key: "waec_checker_price", value: String(waec) },
        { key: "bece_price", value: String(bece) },
        { key: "bece_checker_price", value: String(bece) },
      ], { onConflict: "key" });
      return json({ ok: true, waec_price: waec, bece_price: bece });
    }

    const [ordersRes, settingsRes] = await Promise.all([
      admin.from("checker_orders").select("*").order("created_at", { ascending: false }).limit(500),
      admin.from("settings").select("key,value").in("key", ["waec_price", "bece_price"]),
    ]);
    const smap = Object.fromEntries((settingsRes.data || []).map((s: any) => [s.key, s.value]));

    let stock: any[] = [];
    let balance: number | null = null;
    const key = Deno.env.get("DATAMART_API_KEY");
    if (key) {
      try {
        const apiSecret = Deno.env.get("DATAMART_API_SECRET");
        const [pRes, bRes] = await Promise.all([
          fetch("https://api.datamartgh.shop/api/checkers/products", { headers: { "X-API-Key": key } }),
          fetch("https://api.datamartgh.shop/api/developer/balance", {
            headers: { "X-API-Key": key, ...(apiSecret ? { "X-API-Secret": apiSecret } : {}) },
          }),
        ]);
        const pBody = await pRes.json().catch(() => ({}));
        const bBody = await bRes.json().catch(() => ({}));
        stock = pBody?.data || [];
        balance = Number(bBody?.data?.balance);
        if (!Number.isFinite(balance)) balance = null;
      } catch (_) { /* ignore */ }
    }

    return json({
      orders: ordersRes.data || [],
      waec_price: Number(smap.waec_price) || 20,
      bece_price: Number(smap.bece_price) || 20,
      stock,
      balance,
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unknown" }, 500);
  }
});
