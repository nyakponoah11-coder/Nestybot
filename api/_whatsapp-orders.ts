import { data1db } from './_data1db.js';
import { getSupabase, verifyAdminUser } from './_supabase.js';

let cachedWaResponse: any = null;
let cachedWaResponseAt = 0;
const WA_CACHE_TTL = 30 * 1000;

function setCorsHeaders(res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "authorization, x-client-info, apikey, content-type"
  );
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
}

const mask = (raw: string) => {
  const d = (raw || "").replace(/\D/g, "").replace(/^233/, "0");
  if (d.length < 6) return d;
  return `${d.slice(0, 3)}${"*".repeat(d.length - 5)}${d.slice(-2)}`;
};

export default async function handler(req: any, res: any) {
  setCorsHeaders(res);
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const supabase = getSupabase();
    const auth = await verifyAdminUser(req, supabase);
    if (!auth.authorized) {
      return res.status(401).json({ error: auth.error || "Unauthorized: Administrator privileges required." });
    }

    if (!req.body?.refresh && cachedWaResponse && Date.now() - cachedWaResponseAt < WA_CACHE_TTL) {
      return res.status(200).json(cachedWaResponse);
    }

    // Always fetch genuine bot orders from database
    let dbOrdersList: any[] = [];
    try {
      const { data } = await supabase
        .from("orders")
        .select("id, reference, ref, datamart_reference, network, capacity, bundle, recipient_phone, phone, phone_number, amount, datamart_status, delivery_status, payment_status, created_at, notes, agent_id")
        .or("notes.ilike.%channel:whatsapp_bot%,notes.ilike.%whatsapp_phone:%,notes.ilike.%whatsapp_bot%,network.eq.MASHUP,reference.ilike.MASHUP-%")
        .order("created_at", { ascending: false })
        .limit(200);

      if (data && Array.isArray(data)) {
        dbOrdersList = data;
        for (const row of data) {
          try { data1db.getClient().from("orders").upsert(row); } catch (_) {}
        }
      }
    } catch (_) {}

    if (!dbOrdersList.length) {
      try {
        const d1Orders = data1db.loadTable("orders");
        if (d1Orders && d1Orders.length > 0) {
          dbOrdersList = d1Orders;
        }
      } catch (_) {}
    }

    const botDbOrders: any[] = [];
    for (const o of dbOrdersList || []) {
      const isWa =
        Boolean(o.notes && String(o.notes).toLowerCase().includes("channel:whatsapp_bot")) ||
        Boolean(o.notes && String(o.notes).toLowerCase().includes("whatsapp_bot")) ||
        Boolean(o.notes && String(o.notes).toLowerCase().includes("whatsapp_phone:")) ||
        String(o.network || "").toUpperCase() === "MASHUP" ||
        Boolean(o.reference && String(o.reference).startsWith("MASHUP-")) ||
        Boolean(o.ref && String(o.ref).startsWith("MASHUP-")) ||
        o.source === "whatsapp" ||
        o.source === "whatsapp_bot";

      if (isWa) {
        const phone = o.recipient_phone || o.phone_number || o.phone || "";
        const deliveryStatus = String(o.datamart_status || o.delivery_status || o.status || "unknown").toLowerCase().trim();
        let storeName = "Main Store";
        if (o.notes) {
          const sm = String(o.notes).match(/\[store:([^\]]+)\]/i);
          if (sm && sm[1]) storeName = sm[1];
        }
        botDbOrders.push({
          id: String(o.id || o.reference || o.ref),
          reference: String(o.reference || o.ref || o.id),
          display_reference: String(o.datamart_reference || o.reference || o.ref || o.id),
          network: o.network || "MTN",
          capacity: String(o.capacity || o.bundle || "").replace(/GB/i, ""),
          phone: phone || "—",
          phone_masked: mask(phone),
          real_phone: phone,
          amount: Number(o.amount || 0),
          status: deliveryStatus,
          delivery_status: deliveryStatus,
          payment_status: o.payment_status || "paid",
          paid_at: o.created_at,
          created_at: o.created_at,
          source: "whatsapp",
          datamart_reference: o.datamart_reference || null,
          store_name: storeName,
          agent_id: o.agent_id || null,
        });
      }
    }

    botDbOrders.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

    // Current / Today's calendar day window (starts fresh from 00:00:00 midnight)
    const startOfToday = new Date();
    startOfToday.setUTCHours(0, 0, 0, 0);
    const todayOrders = botDbOrders.filter(
      (o) => new Date(o.created_at || 0).getTime() >= startOfToday.getTime()
    );

    const totals = {
      // Current / Today's Metrics (as requested: today's order, delivered, paid, and amount)
      count: todayOrders.length,
      revenue: todayOrders.reduce((s, o) => s + (o.amount || 0), 0),
      completed: todayOrders.filter((o) => /deliv|success/i.test(o.status || o.delivery_status || "")).length,
      paid: todayOrders.filter((o) => o.payment_status === "paid" || /paid/i.test(o.status || "")).length,
      pending: todayOrders.filter((o) => /pend|wait|process/i.test(o.status || o.delivery_status || "")).length,
      failed: todayOrders.filter((o) => /fail|cancel|refund/i.test(o.status || o.delivery_status || "")).length,
      payment_pending: todayOrders.filter((o) => /pend/i.test(o.payment_status || "")).length,

      // All-time Metrics
      all_count: botDbOrders.length,
      all_revenue: botDbOrders.reduce((s, o) => s + (o.amount || 0), 0),
      all_completed: botDbOrders.filter((o) => /deliv|success/i.test(o.status || o.delivery_status || "")).length,
      all_paid: botDbOrders.filter((o) => o.payment_status === "paid" || /paid/i.test(o.status || "")).length,
      all_pending: botDbOrders.filter((o) => /pend|wait|process/i.test(o.status || o.delivery_status || "")).length,
      all_failed: botDbOrders.filter((o) => /fail|cancel|refund/i.test(o.status || o.delivery_status || "")).length,
    };

    const payload = {
      ok: true,
      scanned: botDbOrders.length,
      totals,
      orders: botDbOrders,
    };

    cachedWaResponse = payload;
    cachedWaResponseAt = Date.now();
    return res.status(200).json(payload);
  } catch (e: any) {
    console.error("whatsapp-orders error:", e);
    return res.status(500).json({ error: e?.message || "Internal server error" });
  }
}
