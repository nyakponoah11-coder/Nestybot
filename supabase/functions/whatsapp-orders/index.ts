// Admin-only: lists data orders made through the WhatsApp bot.
// The bot uses the SAME Datamart API key as the website, so every bot purchase appears in the
// Datamart wallet transaction feed. We pull that feed and subtract purchases that match orders
// created on this website — what remains was placed through WhatsApp.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const DATAMART_BASE = "https://api.datamartgh.shop/api/developer";
const netMap: Record<string, string> = { YELLO: "MTN", MTN: "MTN", at: "AT", AT: "AT", TELECEL: "TELECEL" };

// Datamart returns masked recipients like "054*****79". Mask ours the same way to compare.
const mask = (raw: string) => {
  const d = (raw || "").replace(/\D/g, "").replace(/^233/, "0");
  if (d.length < 6) return d;
  return `${d.slice(0, 3)}${"*".repeat(d.length - 5)}${d.slice(-2)}`;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);
    const token = authHeader.replace("Bearer ", "");

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY")!,
    );
    const { data: userData } = await userClient.auth.getUser(token);
    if (!userData.user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: roleRow } = await admin.from("user_roles").select("id")
      .eq("user_id", userData.user.id).eq("role", "admin").maybeSingle();
    if (!roleRow) return json({ error: "Forbidden" }, 403);

    const key = Deno.env.get("DATAMART_API_KEY");
    if (!key) return json({ error: "DATAMART_API_KEY not configured" }, 500);

    // Datamart occasionally returns 5xx; retry a few times with backoff before giving up.
    const fetchPage = async (page: number) => {
      let last: Response | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const res = await fetch(`${DATAMART_BASE}/transactions?page=${page}&limit=100`, {
            headers: { "X-API-Key": key, Accept: "application/json" },
          });
          if (res.ok) return res;
          last = res;
          if (res.status < 500) break;
        } catch (_e) {
          last = null;
        }
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
      }
      return last;
    };

    // Pull the complete available transaction feed so orders from today are not
    // lost when older traffic fills the first few pages.
    const purchases: any[] = [];
    let totalPages = 1;
    for (let page = 1; page <= totalPages; page++) {
      const r = await fetchPage(page);
      if (!r || !r.ok) {
        if (page === 1) {
          // Upstream is down — respond 200 so the dashboard shows a soft notice instead of erroring.
          return json({
            ok: true,
            upstream_down: true,
            message: "Datamart is temporarily unavailable. Showing no bot orders until it responds again.",
            scanned: 0,
            totals: { count: 0, revenue: 0, completed: 0, pending: 0, failed: 0 },
            orders: [],
          });
        }
        break;
      }
      const j = await r.json();
      const rows: any[] = j?.data?.transactions || [];
      purchases.push(...rows.filter((t) => t?.type === "purchase"));
      totalPages = Math.min(Number(j?.data?.pagination?.totalPages ?? page), 100);
    }

    // Website orders we submitted to Datamart (used to exclude them)
    const { data: siteOrders } = await admin.from("orders")
      .select("recipient_phone, network, capacity, amount, created_at, payment_status")
      .order("created_at", { ascending: false })
      .limit(3000);

    const siteKeys = (siteOrders || []).map((o) => ({
      k: `${mask(o.recipient_phone)}|${String(o.network).toUpperCase()}|${parseFloat(String(o.capacity))}`,
      amount: Number(o.amount),
      t: new Date(o.created_at).getTime(),
      used: false,
    }));

    // ---- Paystack payments (to show whether the bot order was paid) ----
    // Bot payments hit the same Paystack account. Pull recent transactions and
    // match them to a bot purchase by amount + time proximity (and phone when present).
    const psKey = Deno.env.get("PAYSTACK_SECRET_KEY");
    type PsTx = { amount: number; status: string; paid_at: string | null; created_at: string; ts: number; phone: string; raw_phone: string; used: boolean };
    const psTx: PsTx[] = [];
    if (psKey) {
      for (let page = 1; page <= 3; page++) {
        try {
          const r = await fetch(`https://api.paystack.co/transaction?perPage=100&page=${page}`, {
            headers: { Authorization: `Bearer ${psKey}` },
          });
          if (!r.ok) break;
          const j = await r.json();
          const rows: any[] = j?.data || [];
          for (const t of rows) {
            const meta = t?.metadata || {};
            const rawPhone = String(meta.phone ?? meta.recipient_phone ?? meta.recipientPhone ?? t?.customer?.phone ?? "");
            psTx.push({
              amount: Number(t?.amount ?? 0) / 100,
              status: String(t?.status ?? "unknown"),
              paid_at: t?.paid_at ?? null,
              created_at: t?.created_at ?? "",
              ts: new Date(t?.paid_at || t?.created_at || 0).getTime(),
              phone: mask(rawPhone),
              raw_phone: rawPhone,
              used: false,
            });
          }
          if (rows.length < 100) break;
        } catch (_e) {
          break;
        }
      }
    }

    const orders = purchases.map((p) => {
      const rp = p.relatedPurchase || {};
      const network = netMap[String(rp.network ?? "")] ?? String(rp.network ?? "—");
      const phone = String(rp.phoneNumber ?? "");
      const capacity = rp.capacity != null ? Number(rp.capacity) : NaN;
      const amount = Number(p.amount ?? 0);
      const ts = new Date(p.createdAt).getTime();
      // Datamart may return a local number while site orders are stored in either
      // local or international format. Compare the same masked representation.
      const k = `${mask(phone)}|${network}|${capacity}`;

      // Only exclude a site order when its amount and timing also line up. A broad
      // six-hour match can incorrectly hide a real WhatsApp order from the report.
      const match = siteKeys.find((s) => !s.used && s.k === k && s.amount === amount && Math.abs(s.t - ts) < 15 * 60 * 1000);
      if (match) match.used = true;

      // match a Paystack transaction: same phone (when known) or same-ish time window
      const byPhone = psTx.find((t) => !t.used && t.phone && t.phone === mask(phone) && Math.abs(t.ts - ts) < 6 * 60 * 60 * 1000);
      const byTime = byPhone ||
        psTx.find((t) => !t.used && Math.abs(t.ts - ts) < 30 * 60 * 1000 && Math.abs(t.amount - amount) <= Math.max(1, amount * 0.6));
      if (byTime) byTime.used = true;

      const payment_status = !psKey
        ? "unknown"
        : byTime
        ? (byTime.status === "success" ? "paid" : byTime.status === "abandoned" ? "pending" : byTime.status)
        : "unknown";

      const rawReal = (byTime as any)?.raw_phone ? String((byTime as any).raw_phone) : "";
      const isRealPhone = /^(?:0\d{9}|233\d{9}|\+233\d{9})$/.test(rawReal.trim());
      return {
        id: String(p._id),
        reference: String(p.reference ?? ""),
        network,
        capacity: Number.isNaN(capacity) ? "" : String(capacity),
        phone: isRealPhone ? rawReal.trim() : phone,
        phone_masked: phone,
        real_phone: isRealPhone ? rawReal.trim() : "",
        amount,
        status: String(p.status ?? "unknown"),
        payment_status,
        paid_at: byTime?.paid_at ?? null,
        created_at: p.createdAt ?? null,
        description: String(p.description ?? ""),
        source: match ? "website" : "whatsapp",
      };
    });

    const whatsapp = orders
      .filter((o) => o.source === "whatsapp")
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
    const totals = {
      count: whatsapp.length,
      revenue: whatsapp.reduce((s, o) => s + (o.amount || 0), 0),
      completed: whatsapp.filter((o) => /complet|deliver|success/i.test(o.status)).length,
      pending: whatsapp.filter((o) => /pend|process/i.test(o.status)).length,
      failed: whatsapp.filter((o) => /fail|cancel|refund/i.test(o.status)).length,
      paid: whatsapp.filter((o) => o.payment_status === "paid").length,
      payment_pending: whatsapp.filter((o) => /pend/i.test(o.payment_status)).length,
    };

    return json({ ok: true, scanned: orders.length, totals, orders: whatsapp });

  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unknown" }, 500);
  }
});
