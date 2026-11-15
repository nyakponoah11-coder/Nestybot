// Admin-only: list service orders (netflix/afa), list referrals + their friends,
// and toggle the referral promo on/off.
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

    if (action === "togglePromo") {
      const enabled = !!body.enabled;
      await admin.from("settings").upsert({ key: "promo_enabled", value: enabled ? "true" : "false" }, { onConflict: "key" });
      return json({ ok: true, enabled });
    }

    if (action === "toggleSpin") {
      const enabled = !!body.enabled;
      await admin.from("settings").upsert({ key: "spin_game_enabled", value: enabled ? "true" : "false" }, { onConflict: "key" });
      return json({ ok: true, enabled });
    }

    if (action === "setPrices") {
      const netflix = Number(body.netflix_price);
      const afa = Number(body.afa_price);
      const mashup = Number(body.mashup_price);
      if (!Number.isFinite(netflix) || netflix <= 0) return json({ error: "Invalid Netflix price" }, 400);
      if (!Number.isFinite(afa) || afa <= 0) return json({ error: "Invalid AFA price" }, 400);
      const upserts = [
        { key: "netflix_price", value: String(netflix) },
        { key: "afa_price", value: String(afa) },
      ];
      if (Number.isFinite(mashup) && mashup > 0) {
        upserts.push({ key: "mashup_price", value: String(mashup) });
      }
      await admin.from("settings").upsert(upserts, { onConflict: "key" });
      return json({ ok: true, netflix_price: netflix, afa_price: afa, mashup_price: mashup > 0 ? mashup : 25 });
    }

    // Default: return everything the admin dashboards need
    const [servicesRes, referralsRes, redemptionsRes, settingsRes, spinWinsRes, spinRedemptionsRes, scratchCodesRes, scratchCountsRes] = await Promise.all([
      admin.from("service_orders").select("*").order("created_at", { ascending: false }).limit(500),
      admin.from("referrals").select("*").order("created_at", { ascending: false }).limit(500),
      admin.from("referral_redemptions").select("*").order("created_at", { ascending: false }).limit(2000),
      admin.from("settings").select("key,value").in("key", ["promo_enabled", "netflix_price", "afa_price", "spin_game_enabled"]),
      admin.from("spin_wins").select("*").order("created_at", { ascending: false }).limit(2000),
      admin.from("spin_redemptions").select("*").order("created_at", { ascending: false }).limit(10000),
      admin.from("scratch_codes").select("id,code,assigned_to,status,orders_completed,unlocked,scratched").order("id", { ascending: false }).limit(2000),
      admin.from("scratch_order_counts").select("id,scratch_code,order_reference,customer_phone,created_at").order("created_at", { ascending: false }).limit(10000),
    ]);

    const smap = Object.fromEntries((settingsRes.data || []).map((s: any) => [s.key, s.value]));
    const spinWins = (spinWinsRes.data || []).length > 0
      ? spinWinsRes.data || []
      : (scratchCodesRes.data || []).map((row: any) => ({
        id: `scratch-${row.id}`,
        code: row.code,
        owner_phone: row.assigned_to,
        prize_capacity: "5",
        orders_count: Number(row.orders_completed || 0),
        reward_sent: row.unlocked === true || row.status === "unlocked",
        reward_reference: null,
        reward_sent_at: null,
        created_at: null,
      }));
    const spinRedemptions = (spinRedemptionsRes.data || []).length > 0
      ? spinRedemptionsRes.data || []
      : (scratchCountsRes.data || []).map((row: any) => ({
        id: `scratch-order-${row.id}`,
        spin_id: `scratch-${(scratchCodesRes.data || []).find((code: any) => code.code === row.scratch_code)?.id ?? row.scratch_code}`,
        order_reference: row.order_reference,
        buyer_phone: row.customer_phone,
        created_at: row.created_at,
      }));

    return json({
      services: servicesRes.data || [],
      referrals: referralsRes.data || [],
      redemptions: redemptionsRes.data || [],
      spin_wins: spinWins,
      spin_redemptions: spinRedemptions,
      promo_enabled: (smap.promo_enabled ?? "true") !== "false",
      spin_game_enabled: smap.spin_game_enabled === "true",
      netflix_price: Number(smap.netflix_price) || 30,
      afa_price: Number(smap.afa_price) || 20,
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unknown" }, 500);
  }
});
