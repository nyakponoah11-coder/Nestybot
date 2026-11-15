// Admin-only: returns aggregate stats for dashboard.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Cache supplier wallet balance briefly — dashboard polls every second.
let cachedBalance: number | null = null;
let cachedAt = 0;
let cachedArkesel: { sms: number; main: string } | null = null;
let cachedArkeselAt = 0;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await userClient.auth.getUser(token);
    if (!userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: roleRow } = await admin.from("user_roles")
      .select("id").eq("user_id", userData.user.id).eq("role", "admin").maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Daily window: from local midnight (Africa/Accra = UTC+0) until now.
    const now = new Date();
    const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
    const { data: ordersToday } = await admin.from("orders")
      .select("*")
      .gte("created_at", startOfDay.toISOString())
      .order("created_at", { ascending: false });
    const { data: recentAll } = await admin.from("orders")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    const all = ordersToday || [];
    const paid = all.filter(o => o.payment_status === "paid");
    const delivered = all.filter(o => o.payment_status === "paid" && o.delivery_status === "delivered");
    // Revenue counts every successful payment, regardless of delivery status.
    const totalRevenue = paid.reduce((s, o) => s + Number(o.amount), 0);
    const pending = all.filter(o => o.payment_status === "paid" && o.delivery_status !== "delivered" && !["failed", "refunded"].includes(o.delivery_status));
    const failed = all.filter(o => o.delivery_status === "failed");

    const byNetwork: Record<string, { orders: number; revenue: number; delivered: number }> = {};
    for (const o of all) {
      const k = o.network;
      byNetwork[k] ||= { orders: 0, revenue: 0, delivered: 0 };
      byNetwork[k].orders += 1;
      if (o.payment_status === "paid") {
        byNetwork[k].revenue += Number(o.amount);
      }
      if (o.payment_status === "paid" && o.delivery_status === "delivered") {
        byNetwork[k].delivered += 1;
      }
    }

    // Supplier wallet balance (cached briefly — dashboard polls every second)
    let walletBalance: number | null = cachedBalance;
    const key = Deno.env.get("DATAMART_API_KEY");
    if (key && Date.now() - cachedAt > 30000) {
      try {
        const apiSecret = Deno.env.get("DATAMART_API_SECRET");
        let bRes = await fetch("https://api.datamartgh.shop/api/developer/balance", {
          headers: { "X-API-Key": key, ...(apiSecret ? { "X-API-Secret": apiSecret } : {}) },
        });
        if (!bRes.ok) {
          bRes = await fetch("https://api.datamartgh.shop/api/checkers/balance", {
            headers: { "X-API-Key": key, ...(apiSecret ? { "X-API-Secret": apiSecret } : {}) },
          });
        }
        const bBody = await bRes.json().catch(() => ({}));
        const v = Number(bBody?.data?.walletBalance ?? bBody?.data?.balance ?? bBody?.walletBalance);
        if (Number.isFinite(v)) { walletBalance = v; cachedBalance = v; cachedAt = Date.now(); }
      } catch (_) { /* ignore */ }
    }

    let arkeselSmsBalance: number | null = cachedArkesel?.sms ?? null;
    let arkeselMainBalance: string | null = cachedArkesel?.main ?? null;
    const arkeselKey = Deno.env.get("ARKESEL_API_KEY");
    if (arkeselKey && Date.now() - cachedArkeselAt > 30000) {
      try {
        const balanceRes = await fetch("https://sms.arkesel.com/api/v2/clients/balance-details", {
          headers: { "api-key": arkeselKey, Accept: "application/json" },
        });
        const balanceBody = await balanceRes.json().catch(() => ({}));
        const balance = balanceBody?.data || {};
        const sms = Number(balance.sms_balance);
        const main = String(balance.main_balance || "");
        if (Number.isFinite(sms)) {
          arkeselSmsBalance = sms;
          arkeselMainBalance = main || null;
          cachedArkesel = { sms, main };
          cachedArkeselAt = Date.now();
        }
      } catch (_) { /* keep the last cached value */ }
    }

    // Akwaaba Sale wallet balance
    let akwaabaBalance: number | null = null;
    const akwaabaKey = Deno.env.get("AKWAABA_API_KEY") || Deno.env.get("AKWAABA_SALE_API_KEY");
    const akwaabaUrl = Deno.env.get("AKWAABA_API_URL") || Deno.env.get("AKWAABA_URL") || "https://akwaabasale.com/api";
    if (akwaabaKey) {
      try {
        const akRes = await fetch(`${akwaabaUrl.replace(/\/+$/, '')}/balance`, {
          headers: {
            "Authorization": `Bearer ${akwaabaKey}`,
            "X-API-Key": akwaabaKey,
            "Accept": "application/json",
          },
        });
        const akJson = await akRes.json().catch(() => ({}));
        const val = Number(akJson?.balance ?? akJson?.data?.balance ?? akJson?.wallet_balance);
        if (Number.isFinite(val)) {
          akwaabaBalance = val;
        }
      } catch (_) { /* ignore */ }
    }

    return new Response(JSON.stringify({
      wallet_balance: walletBalance,
      akwaaba_balance: akwaabaBalance,
      arkesel_sms_balance: arkeselSmsBalance,
      arkesel_main_balance: arkeselMainBalance,
      totals: {
        orders: paid.length,
        paid_orders: paid.length,
        revenue: totalRevenue,
        delivered: delivered.length,
        pending: pending.length,
        failed: failed.length,
      },
      by_network: byNetwork,
      recent_orders: (recentAll || []).slice(0, 50),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
