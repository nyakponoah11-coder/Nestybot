// Admin-only: rich analytics — sales per bundle size, profit (gross/net),
// savings, new customers, time series for charts.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Paystack Ghana standard local-card fee. Override via PAYSTACK_FEE_PERCENT secret if needed.
const PAYSTACK_FEE_PERCENT = Number(Deno.env.get("PAYSTACK_FEE_PERCENT") ?? "1.95");
const SAVINGS_PERCENT = 45;
// Analytics baseline — everything before this date is ignored. Defaults to today (UTC) so the
// dashboard starts fresh from launch. Override with ANALYTICS_START_DATE=YYYY-MM-DD.
const ANALYTICS_START_DATE = Deno.env.get("ANALYTICS_START_DATE") ?? "2026-06-05";


const networkToDatamartKey: Record<string, string> = { MTN: "YELLO", AT: "at", TELECEL: "TELECEL" };

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

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

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: roleRow } = await admin.from("user_roles").select("id")
      .eq("user_id", userData.user.id).eq("role", "admin").maybeSingle();
    if (!roleRow) return json({ error: "Forbidden" }, 403);

    // Fetch base prices from Datamart
    const dmKey = Deno.env.get("DATAMART_API_KEY");
    const basePriceMap = new Map<string, number>(); // key = `${MTN|AT|TELECEL}-${capacity}`
    if (dmKey) {
      try {
        const r = await fetch("https://api.datamartgh.shop/api/developer/data-packages", {
          headers: { "X-API-Key": dmKey },
        });
        const j = await r.json();
        const data = j?.data || {};
        for (const [net, ourNet] of [["YELLO", "MTN"], ["at", "AT"], ["TELECEL", "TELECEL"]] as const) {
          const arr = data[net] || [];
          for (const p of arr) {
            basePriceMap.set(`${ourNet}-${String(p.capacity)}`, Number(p.price));
          }
        }
      } catch (e) { console.error("datamart prices error", e); }
    }

    // Baseline — analytics only consider orders on/after ANALYTICS_START_DATE.
    const now = new Date();
    const baseline = new Date(`${ANALYTICS_START_DATE}T00:00:00Z`);
    const since = baseline;
    const { data: orders, error: ordErr } = await admin.from("orders")
      .select("*")
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: false });
    if (ordErr) return json({ error: ordErr.message }, 500);

    // First-seen emails are also scoped from the baseline forward.
    const { data: firstSeenRows } = await admin.from("orders")
      .select("customer_email, created_at")
      .gte("created_at", baseline.toISOString())
      .order("created_at", { ascending: true });
    const firstSeen = new Map<string, string>();
    for (const r of firstSeenRows || []) {
      const e = (r.customer_email || "").toLowerCase();
      if (!e) continue;
      if (!firstSeen.has(e)) firstSeen.set(e, r.created_at);
    }

    const clamp = (d: Date) => (d < baseline ? baseline : d);
    const startOfDay = clamp(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())));
    const startOfWeek = clamp(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - 6 * 24 * 3600 * 1000));
    const startOfMonth = clamp(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)));


    const buildPeriodStats = (from: Date) => {
      const paid = (orders || []).filter(o =>
        o.payment_status === "paid" && new Date(o.created_at) >= from,
      );
      const revenue = paid.reduce((s, o) => s + Number(o.amount), 0);
      const baseCost = paid.reduce((s, o) => {
        const bp = basePriceMap.get(`${o.network}-${o.capacity}`) ?? 0;
        return s + bp;
      }, 0);
      // Order: revenue → minus paystack fee → minus base cost → net profit → 45% savings.
      const paystackFee = revenue * (PAYSTACK_FEE_PERCENT / 100);
      const afterFee = revenue - paystackFee;
      const netProfit = afterFee - baseCost;
      const grossProfit = revenue - baseCost;
      const savings = Math.max(0, netProfit) * (SAVINGS_PERCENT / 100);

      // new customers: first_seen timestamp inside this window
      const newCustomers = new Set<string>();
      for (const [email, ts] of firstSeen) {
        if (new Date(ts) >= from) newCustomers.add(email);
      }
      return {
        orders: paid.length,
        revenue,
        paystack_fee: paystackFee,
        after_fee: afterFee,
        base_cost: baseCost,
        gross_profit: grossProfit,
        net_profit: netProfit,
        savings,
        new_customers: newCustomers.size,
      };
    };

    const periods = {
      daily: buildPeriodStats(startOfDay),
      weekly: buildPeriodStats(startOfWeek),
      monthly: buildPeriodStats(startOfMonth),
    };

    // Sales by bundle size (capacity) — for the monthly window
    const salesByBundle: Record<string, { network: string; capacity: string; count: number; revenue: number; profit: number }> = {};
    for (const o of orders || []) {
      if (o.payment_status !== "paid") continue;
      if (new Date(o.created_at) < startOfMonth) continue;
      const key = `${o.network}-${o.capacity}`;
      salesByBundle[key] ||= { network: o.network, capacity: o.capacity, count: 0, revenue: 0, profit: 0 };
      salesByBundle[key].count += 1;
      salesByBundle[key].revenue += Number(o.amount);
      const bp = basePriceMap.get(key) ?? 0;
      salesByBundle[key].profit += Number(o.amount) - bp;
    }

    // Daily time series of revenue + net profit + savings, from baseline up to today.
    const series: { date: string; revenue: number; profit: number; savings: number; orders: number }[] = [];
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const totalDays = Math.max(1, Math.floor((today.getTime() - baseline.getTime()) / (24 * 3600 * 1000)) + 1);
    const days = Math.min(totalDays, 60);
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today.getTime() - i * 24 * 3600 * 1000);
      const next = new Date(d.getTime() + 24 * 3600 * 1000);
      const slice = (orders || []).filter(o =>
        o.payment_status === "paid" &&
        new Date(o.created_at) >= d && new Date(o.created_at) < next,
      );
      const revenue = slice.reduce((s, o) => s + Number(o.amount), 0);
      const baseCost = slice.reduce((s, o) => s + (basePriceMap.get(`${o.network}-${o.capacity}`) ?? 0), 0);
      const fee = revenue * (PAYSTACK_FEE_PERCENT / 100);
      const profit = revenue - fee - baseCost;
      const savings = Math.max(0, profit) * (SAVINGS_PERCENT / 100);
      series.push({
        date: d.toISOString().slice(5, 10),
        revenue: Number(revenue.toFixed(2)),
        profit: Number(profit.toFixed(2)),
        savings: Number(savings.toFixed(2)),
        orders: slice.length,
      });
    }


    return json({
      periods,
      sales_by_bundle: Object.values(salesByBundle).sort((a, b) => b.count - a.count),
      series,
      meta: {
        paystack_fee_percent: PAYSTACK_FEE_PERCENT,
        savings_percent: SAVINGS_PERCENT,
        base_prices_loaded: basePriceMap.size,
        start_date: ANALYTICS_START_DATE,
      },
    });

  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : "Unknown" }, 500);
  }
});
