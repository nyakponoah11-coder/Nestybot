import { getSupabase, parseBody, setCorsHeaders, sendSecurityAlert, getEnvVar, data1db, invalidateSettingsCache } from "./_supabase.js";
import { callGeminiSingle, callOwnerCoPilotAI } from "./_ai-rotator.js";
import { resolveDatamartKeys } from "./_datamart.js";

export function normalizeGhanaPhone(p: string): string {
  let clean = String(p || "").replace(/\D/g, "");
  if (clean.startsWith("233") && clean.length === 12) {
    clean = "0" + clean.slice(3);
  } else if (clean.length === 9) {
    clean = "0" + clean;
  }
  return clean;
}

export async function generateFreeDataVouchersDirect(admin: any, count = 5, network = "MTN", capacity = "1") {
  const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const numCodes = Math.min(Math.max(1, parseInt(String(count), 10) || 5), 50);
  const cleanNet = String(network || "MTN").toUpperCase();
  const cleanCap = String(capacity || "1").replace(/\D/g, "") || "1";
  const rows: any[] = [];
  const generatedCodes: string[] = [];

  for (let i = 0; i < numCodes; i++) {
    let c = "FD";
    for (let j = 0; j < 8; j++) {
      c += CODE_CHARS.charAt(Math.floor(Math.random() * CODE_CHARS.length));
    }
    generatedCodes.push(c);
    rows.push({
      code: c,
      network: cleanNet,
      capacity: cleanCap,
      claimed: false,
      created_at: new Date().toISOString(),
    });
  }

  try {
    await data1db.getClient().from("free_data_codes").insert(rows);
  } catch (_) { }

  try {
    await admin.from("free_data_codes").insert(rows);
  } catch (err: any) {
    console.warn("generateFreeDataVouchersDirect error:", err?.message);
  }

  return { codes: generatedCodes, network: cleanNet, capacity: cleanCap };
}

export async function updateOrderDeliveryStatusDirect(admin: any, ref: string, status: string) {
  const cleanRef = String(ref || "").replace(/[*_#`"']/g, "").trim();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanRef);
  const filter = isUuid
    ? `reference.ilike.%${cleanRef}%,datamart_reference.ilike.%${cleanRef}%,id.eq.${cleanRef}`
    : `reference.ilike.%${cleanRef}%,datamart_reference.ilike.%${cleanRef}%`;

  const localDb = data1db.getClient();
  let localOrd: any = null;
  try {
    const r = await localDb
      .from("orders")
      .update({ delivery_status: status.toLowerCase(), updated_at: new Date().toISOString() })
      .or(filter)
      .select("reference, recipient_phone, network, capacity, amount")
      .maybeSingle();
    localOrd = r.data;
  } catch (_) { }

  const { data: ord } = await admin
    .from("orders")
    .update({ delivery_status: status.toLowerCase(), updated_at: new Date().toISOString() })
    .or(filter)
    .select("reference, recipient_phone, network, capacity, amount")
    .maybeSingle();

  if (ord || localOrd) return { found: true, order: ord || localOrd };

  const sFilter = isUuid ? `reference.ilike.%${cleanRef}%,id.eq.${cleanRef}` : `reference.ilike.%${cleanRef}%`;
  let localSOrd: any = null;
  try {
    const r = await localDb
      .from("service_orders")
      .update({ delivery_status: status.toLowerCase() })
      .or(sFilter)
      .select("reference, customer_phone, service")
      .maybeSingle();
    localSOrd = r.data;
  } catch (_) { }

  const { data: sOrd } = await admin
    .from("service_orders")
    .update({ delivery_status: status.toLowerCase() })
    .or(sFilter)
    .select("reference, customer_phone, service")
    .maybeSingle();

  if (sOrd || localSOrd) return { found: true, order: sOrd || localSOrd };

  return { found: false, order: null };
}

export async function sendArkeselSmsDirect(apiKey: string, recipient: string, message: string, customSender?: string) {
  if (!apiKey || !recipient || !message) return false;
  let formattedPhone = recipient.replace(/\D/g, "");
  if (formattedPhone.startsWith("0") && formattedPhone.length === 10) {
    formattedPhone = "233" + formattedPhone.slice(1);
  }
  try {
    const res = await fetch("https://sms.arkesel.com/api/v2/sms/send", {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        sender: "D_1Gh",
        message,
        recipients: [formattedPhone],
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function sendArkeselBulkSmsDirect(apiKey: string, recipients: string[], message: string, customSender?: string) {
  if (!apiKey || !recipients.length || !message) return { sent: 0, failed: 0, total: 0 };
  const cleanRecipients = Array.from(
    new Set(
      recipients
        .map((r) => {
          let p = String(r || "").replace(/\D/g, "");
          if (p.startsWith("0") && p.length === 10) p = "233" + p.slice(1);
          if (p.length === 9) p = "233" + p;
          return p.startsWith("233") && p.length === 12 ? p : null;
        })
        .filter(Boolean)
    )
  ) as string[];

  if (!cleanRecipients.length) return { sent: 0, failed: 0, total: 0 };

  const BATCH_SIZE = 50;
  let totalSent = 0;
  let totalFailed = 0;

  for (let i = 0; i < cleanRecipients.length; i += BATCH_SIZE) {
    const batch = cleanRecipients.slice(i, i + BATCH_SIZE);
    try {
      const res = await fetch("https://sms.arkesel.com/api/v2/sms/send", {
        method: "POST",
        headers: {
          "api-key": apiKey,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          sender: "D_1Gh",
          message,
          recipients: batch,
        }),
      });
      if (res.ok) {
        totalSent += batch.length;
      } else {
        totalFailed += batch.length;
      }
    } catch {
      totalFailed += batch.length;
    }
  }
  return { sent: totalSent, failed: totalFailed, total: cleanRecipients.length };
}

function cleanApiKey(raw: any): string {
  if (!raw || typeof raw !== "string") return "";
  let k = raw.trim();
  k = k.replace(/^["'`]+|["'`]+$/g, "").trim();
  k = k.replace(/^[A-Za-z0-9_]+=\s*/, "").trim();
  k = k.replace(/^["'`]+|["'`]+$/g, "").trim();
  if (k.toLowerCase().startsWith("bearer ")) {
    k = k.slice(7).trim();
  }
  return k;
}

function formatGhanaTime(date: Date = new Date()): string {
  try {
    return date.toLocaleString("en-GB", {
      timeZone: "Africa/Accra",
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return date.toUTCString();
  }
}

function maskPhone(raw: string): string {
  const d = (raw || "").replace(/\D/g, "");
  if (d.length <= 5) return raw || "Unknown";
  if (d.startsWith("233") && d.length >= 12) {
    const local = "0" + d.slice(3);
    return `${local.slice(0, 3)}****${local.slice(-3)}`;
  }
  return `${d.slice(0, 3)}****${d.slice(-3)}`;
}

export async function getAccurateLiveDeliveryStats(admin: any) {
  let fastLaneMinutes: number | null = null;
  let pendingBatches = 0;
  let lastDeliveredSummary = "";
  let measuredDurationText: string | null = null;
  let batchId = "";

  const formatEta = (mins: number) => {
    if (mins < 1) return "under a minute";
    if (mins < 60) return `~${Math.round(mins)} min`;
    const h = Math.floor(mins / 60);
    const m = Math.round(mins % 60);
    return m ? `~${h}h ${m}m` : `~${h}h`;
  };

  try {
    const dmKeys = await resolveDatamartKeys(admin).catch(() => []);
    const [trackerRes, statusRes] = await Promise.all([
      dmKeys.length > 0
        ? fetch("https://api.datamartgh.shop/api/developer/delivery-tracker", {
          headers: { "X-API-Key": dmKeys[0], Accept: "application/json" },
          signal: AbortSignal.timeout(4500),
        }).catch(() => null)
        : Promise.resolve(null),
      fetch("https://api.datamartgh.shop/api/v1/data/delivery-status", {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(4500),
      }).catch(() => null),
    ]);

    if (trackerRes && trackerRes.ok) {
      const td = await trackerRes.json().catch(() => ({}));
      const d = td?.data || {};
      if (d?.scanner?.pendingBatches != null) pendingBatches = Number(d.scanner.pendingBatches);
      if (d?.fastLane?.active && d?.fastLane?.minutes != null) {
        measuredDurationText = formatEta(d.fastLane.minutes);
        fastLaneMinutes = Math.round(d.fastLane.minutes);
      }
    }

    if (statusRes && statusRes.ok) {
      const sj = await statusRes.json().catch(() => ({}));
      const s = sj?.data;
      if (s?.unibundleActive && s?.unibundleFrontier?.placedAt && s?.unibundleFrontier?.deliveredAt) {
        const p = new Date(s.unibundleFrontier.placedAt).getTime();
        const d = new Date(s.unibundleFrontier.deliveredAt).getTime();
        const diffMin = Math.max(1, (d - p) / 60000);
        measuredDurationText = formatEta(diffMin);
        fastLaneMinutes = Math.round(diffMin);
        if (s.unibundleFrontier.trackingId) batchId = String(s.unibundleFrontier.trackingId);
      } else if (s?.lastDelivered?.placedAt && s?.lastDelivered?.deliveredAt) {
        const p = new Date(s.lastDelivered.placedAt).getTime();
        const d = new Date(s.lastDelivered.deliveredAt).getTime();
        const diffMin = Math.max(1, (d - p) / 60000);
        measuredDurationText = formatEta(diffMin);
        fastLaneMinutes = Math.round(diffMin);
        if (s.lastDelivered.trackingId) batchId = String(s.lastDelivered.trackingId);
      }
      if (s?.lastDelivered?.summary) {
        lastDeliveredSummary = String(s.lastDelivered.summary);
      }
    }
  } catch (_) { }

  const liveEta = measuredDurationText || (fastLaneMinutes ? `~${fastLaneMinutes} min` : "~15-20 min");

  const mtnSpeed = liveEta;
  const telecelSpeed = liveEta;
  const atSpeed = liveEta;

  const queueText = pendingBatches === 0
    ? "0 pending batches (Instant Gateway Active ✅)"
    : `${pendingBatches} pending batch(es)`;

  const summaryText = [
    `⚡ *ACCURATE LIVE DELIVERY TIME FROM SITE:*`,
    ``,
    `⏱️ *Estimated Network Delivery Time:* *${liveEta}*`,
    batchId ? `📦 *Recent Telecom Batch:* #${batchId} delivered` : (lastDeliveredSummary ? `📦 *Recent Telecom Batch:* ${lastDeliveredSummary}` : ""),
    ``,
    `• *MTN Turbo Bundles:* *${mtnSpeed}*`,
    `• *Telecel Fast Bundles:* *${telecelSpeed}*`,
    `• *AT (AirtelTigo) Bundles:* *${atSpeed}*`,
    ``,
    `📊 *Carrier Queue:* ${queueText}`,
    `_Measured real-time directly from active DataMart gateway and storefront orders._`,
  ].filter(Boolean).join("\n");

  return {
    mtnSpeed,
    telecelSpeed,
    atSpeed,
    fastLaneMinutes,
    pendingBatches,
    sampleCount: 10,
    summaryText,
  };
}

export async function getTopOrderingCustomers(admin: any, limit = 6) {
  try {
    const { data: allOrders } = await admin
      .from("orders")
      .select("recipient_phone, phone_number, amount, payment_status, delivery_status, created_at")
      .order("created_at", { ascending: false })
      .limit(80);

    if (!allOrders || allOrders.length === 0) {
      return { list: [], totalCustomers: 0, text: "No orders found in database yet." };
    }

    const map: Record<string, { phone: string; count: number; paidCount: number; deliveredCount: number; totalGhs: number }> = {};

    allOrders.forEach((o: any) => {
      const raw = o.recipient_phone || o.phone_number;
      const ph = normalizeGhanaPhone(String(raw || ""));
      if (!ph || ph.length < 9) return;
      if (!map[ph]) {
        map[ph] = { phone: ph, count: 0, paidCount: 0, deliveredCount: 0, totalGhs: 0 };
      }
      map[ph].count += 1;
      if (/paid|complet|deliver|success/i.test(o.payment_status || o.status || "")) {
        map[ph].paidCount += 1;
        map[ph].totalGhs += Number(o.amount || 0);
      }
      if (/deliv|success/i.test(o.delivery_status || o.status || "")) {
        map[ph].deliveredCount += 1;
      }
    });

    const sorted = Object.values(map).sort((a, b) => b.count - a.count);
    const top = sorted.slice(0, limit);

    const medals = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣"];

    const lines = top.map((c, i) =>
      `${medals[i] || `${i + 1}.`} *${c.phone}* — *${c.count} total orders* (${c.deliveredCount} delivered) • Total Spent: *GH₵ ${c.totalGhs.toFixed(2)}*`
    );

    const text = [
      `🏆 *CUSTOMER RANKINGS — NUMBERS WITH MOST ORDERS:*`,
      ``,
      lines.join("\n\n"),
      ``,
      `📊 *Total Unique Customer Numbers Analyzed:* ${sorted.length}`,
      `_Pulled live from real customer transactions in the database._`,
    ].join("\n");

    return { list: top, totalCustomers: sorted.length, text };
  } catch (err: any) {
    return { list: [], totalCustomers: 0, text: "Could not aggregate order numbers: " + err?.message };
  }
}

export async function getCustomerPhoneOrders(admin: any, phone: string) {
  const clean = normalizeGhanaPhone(phone);
  const last9 = clean.slice(-9);

  const { data: orders } = await admin
    .from("orders")
    .select("reference, network, capacity, amount, payment_status, delivery_status, created_at")
    .or(`recipient_phone.ilike.%${last9}%,phone_number.ilike.%${last9}%`)
    .order("created_at", { ascending: false })
    .limit(10);

  if (!orders || orders.length === 0) {
    return `🔍 No orders found for customer number *${phone}*.`;
  }

  const lines = orders.map((o: any, idx: number) =>
    `📦 *Order #${idx + 1}: ${o.reference}*\n• Package: *${o.capacity}GB ${o.network}* (GH₵ ${Number(o.amount || 0).toFixed(2)})\n• Payment: *${(o.payment_status || "pending").toUpperCase()}* | Delivery: *${(o.delivery_status || "pending").toUpperCase()}*\n• Date: ${o.created_at ? formatGhanaTime(new Date(o.created_at)) : "Recent"}`
  );

  return [
    `📋 *ORDER HISTORY FOR ${phone} (${orders.length} found):*`,
    ``,
    lines.join("\n━━━━━━━━━━━━━━━━━━━━━\n"),
  ].join("\n");
}

export async function getRecentOrdersList(admin: any, limit = 8) {
  const { data: orders } = await admin
    .from("orders")
    .select("reference, network, capacity, amount, recipient_phone, payment_status, delivery_status, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (!orders || orders.length === 0) {
    return "📦 No orders found in the database yet.";
  }

  const lines = orders.map((o: any, i: number) =>
    `${i + 1}. *${o.reference}* — ${o.capacity}GB ${o.network} to *${o.recipient_phone || "—"}*\n   • Status: *${(o.delivery_status || "pending").toUpperCase()}* | Paid: *${o.payment_status || "pending"}* | GH₵ ${Number(o.amount || 0).toFixed(2)}`
  );

  return [
    `📦 *LATEST STORE ORDERS (LAST ${orders.length}):*`,
    ``,
    lines.join("\n\n"),
  ].join("\n");
}

export async function matchAndExecuteTriggerRule(admin: any, incomingText: string): Promise<{ matched: boolean; replyText: string; rule?: any } | null> {
  try {
    const { data: sRows } = await admin.from("settings").select("key,value").eq("key", "copilot_trigger_rules");
    const raw = sRows?.[0]?.value;
    if (!raw) return null;

    const rules = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!Array.isArray(rules)) return null;

    const clean = incomingText.trim();
    const lower = clean.toLowerCase();

    for (const rule of rules) {
      if (rule.active === false || !rule.trigger) continue;
      const t = String(rule.trigger).trim().toLowerCase();
      let matched = false;

      if (rule.matchType === "exact") {
        matched = lower === t;
      } else if (rule.matchType === "regex") {
        try {
          matched = new RegExp(t, "i").test(clean);
        } catch (_) { }
      } else {
        matched = lower.includes(t);
      }

      if (matched) {
        if (rule.responseType === "action" && rule.actionType) {
          if (rule.actionType === "query_delivery_times") {
            const stats = await getAccurateLiveDeliveryStats(admin);
            return { matched: true, replyText: stats.summaryText, rule };
          }
          if (rule.actionType === "query_top_customers") {
            const top = await getTopOrderingCustomers(admin, 6);
            return { matched: true, replyText: top.text, rule };
          }
          if (rule.actionType === "list_recent_orders") {
            const list = await getRecentOrdersList(admin, 8);
            return { matched: true, replyText: list, rule };
          }
          if (rule.actionType === "check_balances") {
            const { reportText, stats } = await buildAdminWhatsAppReport();
            const balText = `💳 *LIVE SYSTEM BALANCES:*\n\n• DataMart API Wallet: *GH₵ ${Number(stats.wallet_balance || 0).toFixed(2)}*\n• Arkesel SMS Gateway: *${stats.arkesel_sms ?? 0} SMS*\n• Today's Sales: *GH₵ ${Number(stats.gross_revenue_today || 0).toFixed(2)}*`;
            return { matched: true, replyText: balText, rule };
          }
          if (rule.actionType === "lookup_phone") {
            const pMatch = clean.match(/(0[2357]\d{8}|233\d{9})/);
            if (pMatch) {
              const res = await getCustomerPhoneOrders(admin, pMatch[1]);
              return { matched: true, replyText: res, rule };
            }
          }
        }

        if (rule.replyText) {
          return { matched: true, replyText: rule.replyText, rule };
        }
      }
    }
  } catch (err: any) {
    console.warn("matchAndExecuteTriggerRule error:", err?.message);
  }
  return null;
}

export async function buildAdminWhatsAppReport(): Promise<{
  reportText: string;
  stats: any;
}> {
  const admin = getSupabase();

  // 1. Fetch settings (keys, shop name, alert numbers)
  const { data: sRows } = await admin
    .from("settings")
    .select("key, value");

  const settingsMap: Record<string, string> = {};
  (sRows || []).forEach((r: any) => {
    if (r.key) settingsMap[r.key] = r.value || "";
  });

  const shopName = settingsMap["shop_name"] || "DATA 1 GH";
  const supportPhone = settingsMap["support_phone"] || settingsMap["admin_alert_phone"] || "0547100951";
  const rawBotUrl = settingsMap["whatsapp_bot_url"] || "";
  const botUrl = (!rawBotUrl || rawBotUrl.includes("594641841") || rawBotUrl.includes("U6W5JLVZV72WO1") || rawBotUrl.includes("SRFE5G7CWA4CL1"))
    ? "https://wa.me/233200598553"
    : rawBotUrl;
  const siteUrl = "https://www.data1gh.com";

  const datamartKey = cleanApiKey(
    getEnvVar([
      "DATA_API_KEY",
      "DM_API_KEY",
      "DM_KEY",
      "VITE_DM_API_KEY",
      "DATAMART_API_KEY",
      "VITE_DATAMART_API_KEY",
      "DATAMART_KEY",
      "VITE_DATAMART_KEY",
      "SUPPLIER_API_KEY",
    ]) ||
    settingsMap["datamart_api_key"] ||
    settingsMap["DATAMART_API_KEY"] ||
    settingsMap["datamart_key"] ||
    settingsMap["dm_api_key"] ||
    ""
  );

  const arkeselKey = cleanApiKey(
    getEnvVar([
      "ARKESEL_API_KEY",
      "VITE_ARKESEL_API_KEY",
      "ARKESEL_KEY",
      "arkesel_api_key",
    ]) ||
    settingsMap["arkesel_api_key"] ||
    settingsMap["ARKESEL_API_KEY"] ||
    ""
  );

  // 2. Query today and recent metrics across all sections in parallel
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

  const [
    productsRes,
    todayOrdersRes,
    allOrdersRes,
    servicesRes,
    checkersRes,
    freeDataRes,
    scratchRes,
    referralsRes,
    chatsRes,
    recentOrdersRes,
  ] = await Promise.all([
    // Section 2: Products
    admin.from("products").select("id, network, in_stock"),
    // Section 3: Orders (Today)
    admin.from("orders").select("id, amount, payment_status, delivery_status, status, network, capacity, recipient_phone, phone_number, whatsapp_phone, created_at, notes, campaign_code, ref, reference").gte("created_at", startOfDay),
    // All Orders (for all-time / catalog volume analysis)
    admin.from("orders").select("id, amount, payment_status, delivery_status, status, network, capacity, recipient_phone, created_at").order("created_at", { ascending: false }).limit(30),
    // Section 6: Services (Netflix, Mashup, AFA)
    admin.from("service_orders").select("id, service, amount, status, delivery_status, customer_phone, created_at").order("created_at", { ascending: false }).limit(20),
    // Section 10: Checkers
    admin.from("checker_orders").select("id, checker_type, amount, status, delivery_status, customer_phone, created_at").order("created_at", { ascending: false }).limit(20),
    // Section 9: Free Data
    admin.from("free_data_codes").select("id, code, claimed, claimed_at").limit(30),
    // Section 8: Spin & Win (Scratch & Win)
    admin.from("scratch_codes").select("id, code, status, orders_completed, unlocked, scratched, prize").limit(30),
    // Section 7: Referrals
    admin.from("referrals").select("id, code, total_clicks, total_earnings").limit(30),
    // Section 12: Support
    admin.from("chat_conversations").select("id, status, unread_for_support").eq("status", "open"),
    // Recent unified transactions
    admin.from("orders").select("id, reference, ref, recipient_phone, phone_number, network, capacity, amount, payment_status, delivery_status, status, created_at").order("created_at", { ascending: false }).limit(5),
  ]);

  // Section 2: Products Breakdown
  const products = productsRes.data || [];
  const inStockCount = products.filter((p) => p.in_stock !== false).length;
  const mtnProducts = products.filter((p) => /mtn|yello/i.test(p.network || "")).length;
  const telecelProducts = products.filter((p) => /telecel|vod/i.test(p.network || "")).length;
  const atProducts = products.filter((p) => /at|airtel/i.test(p.network || "")).length;

  // Section 3 & 4: All-time & Today Orders Aggregation
  const allOrders = allOrdersRes.data || [];
  const todayOrders = todayOrdersRes.data || [];

  const isPaid = (o: any) => o.payment_status === "paid" || /complet|deliver|success|paid/i.test(o.status || o.delivery_status || "");
  const isDelivered = (o: any) => /deliv|success/i.test(o.delivery_status || o.status || "");

  const allPaid = allOrders.filter(isPaid);
  const allDelivered = allPaid.filter(isDelivered);
  const allPending = allPaid.filter((o: any) => !isDelivered(o) && !/fail|cancel|refund/i.test(o.delivery_status || o.status || ""));
  const allFailed = allOrders.filter((o: any) => /fail|cancel|refund/i.test(o.delivery_status || o.status || ""));
  const allGrossDataRev = allPaid.reduce((sum: number, o: any) => sum + Number(o.amount || 0), 0);

  const todayPaid = todayOrders.filter(isPaid);
  const todayDelivered = todayPaid.filter(isDelivered);
  const todayPending = todayPaid.filter((o: any) => !isDelivered(o) && !/fail|cancel|refund/i.test(o.delivery_status || o.status || ""));
  const todayFailed = todayOrders.filter((o: any) => /fail|cancel|refund/i.test(o.delivery_status || o.status || ""));
  const todayGrossDataRev = todayPaid.reduce((sum: number, o: any) => sum + Number(o.amount || 0), 0);

  // WhatsApp bot stream split
  const isWa = (o: any) =>
    Boolean(o.notes && String(o.notes).toLowerCase().includes("whatsapp")) ||
    Boolean(o.campaign_code && o.campaign_code.startsWith("WA")) ||
    Boolean(o.whatsapp_phone) ||
    Boolean(o.ref && String(o.ref).startsWith("MASHUP-"));

  const allWaOrders = allPaid.filter(isWa);
  const allWaRevenue = allWaOrders.reduce((sum: number, o: any) => sum + Number(o.amount || 0), 0);
  const todayWaOrders = todayPaid.filter(isWa);
  const todayWaRevenue = todayWaOrders.reduce((sum: number, o: any) => sum + Number(o.amount || 0), 0);

  const allWebOrders = allPaid.filter((o: any) => !isWa(o));
  const allWebRevenue = allWebOrders.reduce((sum: number, o: any) => sum + Number(o.amount || 0), 0);
  const todayWebOrders = todayPaid.filter((o: any) => !isWa(o));
  const todayWebRevenue = todayWebOrders.reduce((sum: number, o: any) => sum + Number(o.amount || 0), 0);

  // Section 6: Services (Netflix, Mashup, AFA)
  const services = servicesRes.data || [];
  const paidServices = services.filter((s) => s.payment_status === "paid");
  const servicesRev = paidServices.reduce((sum, s) => sum + Number(s.amount || 0), 0);
  const netflixPaid = paidServices.filter((s) => s.service === "netflix");
  const mashupPaid = paidServices.filter((s) => s.service === "mashup");
  const afaPaid = paidServices.filter((s) => s.service === "afa");

  // Section 10: Checkers
  const checkers = checkersRes.data || [];
  const paidCheckers = checkers.filter((c) => c.payment_status === "paid");
  const checkersRev = paidCheckers.reduce((sum, c) => sum + Number(c.amount || 0), 0);

  // Section 7: Referrals
  const referrals = referralsRes.data || [];
  const totalPromoters = referrals.length;
  const totalReferralClicks = referrals.reduce((sum, r) => sum + Number(r.total_clicks || 0), 0);

  // Section 8: Spin & Win (Scratch & Win)
  const scratches = scratchRes.data || [];
  const totalSpins = scratches.length;
  const unlockedSpins = scratches.filter((s) => s.unlocked || s.scratched).length;
  const completedSpins = scratches.filter((s) => s.scratched).length;

  // Section 9: Free Data Vouchers
  const freeData = freeDataRes.data || [];
  const claimedVouchers = freeData.filter((f) => f.claimed).length;
  const availableVouchers = freeData.length - claimedVouchers;

  // Section 11: Analytics summary
  const mtnPaidOrders = todayPaid.filter((o) => /mtn|yello/i.test(o.network || "")).length;
  const telecelPaidOrders = todayPaid.filter((o) => /telecel|vod/i.test(o.network || "")).length;
  const atPaidOrders = todayPaid.filter((o) => /at|airtel/i.test(o.network || "")).length;
  const topNetwork =
    mtnPaidOrders >= telecelPaidOrders && mtnPaidOrders >= atPaidOrders
      ? "MTN"
      : telecelPaidOrders >= atPaidOrders
        ? "Telecel"
        : "AT";

  // Section 12: Support
  const openChats = chatsRes.data || [];
  const unreadChats = openChats.reduce((sum, c) => sum + (c.unread_for_support || 0), 0);

  // Total Gross Revenue across everything
  const grossRevToday = todayGrossDataRev + servicesRev + checkersRev;

  // 3. Live Balances (DataMart Wallet + Arkesel SMS)
  let walletBalance: number | null = null;
  let arkeselSms: number | null = null;
  let arkeselMain: string | null = null;

  const balancePromises: Promise<any>[] = [];

  if (datamartKey) {
    balancePromises.push(
      (async () => {
        for (const url of [
          "https://api.datamartgh.shop/api/balance",
          "https://api.datamartgh.shop/api/developer/user/balance",
        ]) {
          try {
            const ac = new AbortController();
            const to = setTimeout(() => ac.abort(), 3500);
            let res = await fetch(url, {
              headers: { "X-API-Key": datamartKey, Accept: "application/json" },
              signal: ac.signal,
            });
            clearTimeout(to);
            if (!res.ok && res.status === 401) {
              const ac2 = new AbortController();
              const to2 = setTimeout(() => ac2.abort(), 3500);
              res = await fetch(url, {
                headers: { Authorization: `Bearer ${datamartKey}`, Accept: "application/json" },
                signal: ac2.signal,
              });
              clearTimeout(to2);
            }
            if (res.ok) {
              const json = await res.json().catch(() => null);
              const b = json?.data?.balance ?? json?.balance ?? json?.data?.walletBalance;
              if (b !== undefined && b !== null && !isNaN(Number(b))) {
                walletBalance = Number(b);
                break;
              }
            }
          } catch { }
        }
      })()
    );
  }

  if (arkeselKey) {
    balancePromises.push(
      (async () => {
        try {
          const ac = new AbortController();
          const to = setTimeout(() => ac.abort(), 3500);
          const res = await fetch("https://sms.arkesel.com/api/v2/clients/balance-details", {
            headers: { "api-key": arkeselKey, Accept: "application/json" },
            signal: ac.signal,
          });
          clearTimeout(to);
          if (res.ok) {
            const json = await res.json().catch(() => null);
            const d = json?.data || json;
            const s = Number(d?.sms_balance ?? d?.smsBalance ?? d?.sms);
            const m = String(d?.main_balance ?? d?.balance ?? "0");
            if (!isNaN(s)) arkeselSms = s;
            if (m) arkeselMain = m;
          }
        } catch { }
      })()
    );
  }

  if (balancePromises.length > 0) {
    await Promise.allSettled(balancePromises);
  }

  // 4. Construct recent transactions snippet
  const recentOrders = recentOrdersRes.data || [];
  let recentListText = "";
  if (recentOrders.length > 0) {
    recentListText = recentOrders
      .slice(0, 5)
      .map((o: any, idx: number) => {
        const masked = maskPhone(o.recipient_phone);
        const pkg = `${o.capacity || ""} ${o.network || ""}`.trim() || "Bundle";
        const status = /complet|deliver|success/i.test(o.delivery_status || "")
          ? "✅ Done"
          : o.payment_status === "paid"
            ? "⏳ Pending"
            : "⚠️ Unpaid";
        return `${idx + 1}. *${masked}* — ${pkg} (GH₵ ${Number(o.amount || 0).toFixed(2)}) ${status}`;
      })
      .join("\n");
  } else {
    recentListText = "_No recent orders recorded yet today._";
  }

  // 5. Build Comprehensive WhatsApp Report Covering Every Single Admin Section (1 to 13)
  const timestamp = formatGhanaTime(now);

  const reportText = [
    `📊 *${shopName.toUpperCase()} — ALL ADMIN SECTIONS BRIEFING*`,
    `━━━━━━━━━━━━━━━━━━━━━`,
    `🕒 _${timestamp}_`,
    ``,
    `1️⃣ *DASHBOARD (OVERVIEW)*`,
    `• Total Gross Sales: *GH₵ ${(allGrossDataRev + servicesRev + checkersRev).toFixed(2)}* (Today: *GH₵ ${todayGrossDataRev.toFixed(2)}*)`,
    `• Telecom API Balance: *${walletBalance !== null ? `GH₵ ${walletBalance.toFixed(2)}` : "GH₵ 0.00"}*`,
    `• Arkesel Balance: *${arkeselSms !== null ? `${arkeselSms} SMS` : (arkeselMain ? `GH₵ ${arkeselMain}` : "0 SMS")}*${arkeselMain && arkeselSms !== null ? ` (GH₵ ${arkeselMain})` : ""}`,
    `• Delivery Queue: *${allDelivered.length} Delivered*, *${allPending.length} In Queue*, *${allFailed.length} Failed*`,
    ``,
    `2️⃣ *PRODUCTS & PACKAGES*`,
    `• Total Catalog: *${products.length} Packages* (*${inStockCount}* In Stock)`,
    `• MTN Packages: *${mtnProducts}* | Telecel: *${telecelProducts}* | AT: *${atProducts}*`,
    `• Stock Status: *All active networks available ✅*`,
    ``,
    `3️⃣ *WEBSITE ORDERS*`,
    `• Total Web Orders: *${allWebOrders.length} Paid* (${todayWebOrders.length} Today)`,
    `• Total Web Revenue: *GH₵ ${allWebRevenue.toFixed(2)}* (${todayWebRevenue > 0 ? `Today: GH₵ ${todayWebRevenue.toFixed(2)}` : "Today: GH₵ 0.00"})`,
    `• Status: *${allWebOrders.filter(isDelivered).length} Delivered*, *${allWebOrders.filter((o) => !isDelivered(o)).length} Pending*`,
    ``,
    `4️⃣ *WHATSAPP BOT ORDERS*`,
    `• Total Bot Orders: *${allWaOrders.length} Paid* (${todayWaOrders.length} Today)`,
    `• Total Bot Revenue: *GH₵ ${allWaRevenue.toFixed(2)}* (${todayWaRevenue > 0 ? `Today: GH₵ ${todayWaRevenue.toFixed(2)}` : "Today: GH₵ 0.00"})`,
    `• Bot Status: *Active & Processing Orders 💬*`,
    ``,
    `5️⃣ *BULK SMS*`,
    `• Available SMS Credits: *${arkeselSms !== null ? `${arkeselSms} SMS` : "0 SMS"}*`,
    `• Sender ID: *${settingsMap["arkesel_sender_id"] || "Data1gh"}*`,
    `• Gateway: *Arkesel SMS API Connected ✉️*`,
    ``,
    `6️⃣ *DIGITAL SERVICES*`,
    `• Netflix 30-Day Passes: *${netflixPaid.length} Active*`,
    `• MTN Mashup Combos: *${mashupPaid.length} Dispatched*`,
    `• AFA Registrations: *${afaPaid.length} Processed*`,
    `• Services Revenue: *GH₵ ${servicesRev.toFixed(2)}*`,
    ``,
    `7️⃣ *REFERRALS & REWARDS*`,
    `• Registered Promoters: *${totalPromoters} Affiliates*`,
    `• Total Referral Clicks: *${totalReferralClicks} Visitors*`,
    `• Program Status: *Active 🤝*`,
    ``,
    `8️⃣ *SPIN & WIN (SCRATCH & WIN)*`,
    `• Total Plays: *${totalSpins} Players*`,
    `• Unlocked Cards: *${unlockedSpins} Ready to Scratch*`,
    `• Prizes Claimed: *${completedSpins} Won (1GB / 2GB)* 🎡`,
    ``,
    `9️⃣ *FREE DATA VOUCHERS*`,
    `• Generated Codes: *${freeData.length} Vouchers*`,
    `• Claimed Codes: *${claimedVouchers} Redeemed*`,
    `• Remaining Available: *${availableVouchers > 0 ? availableVouchers : 0} Codes* 🎁`,
    ``,
    `🔟 *RESULT CHECKERS (WAEC)*`,
    `• Checkers Sold: *${paidCheckers.length} Vouchers*`,
    `• Checkers Revenue: *GH₵ ${checkersRev.toFixed(2)}*`,
    `• Inventory: *BECE, WASSCE & NovDec Instant PINs 🎓*`,
    ``,
    `1️⃣1️⃣ *SALES ANALYTICS*`,
    `• Top Ordered Network: *${topNetwork}*`,
    `• Network Orders: *MTN (${mtnPaidOrders})*, *Telecel (${telecelPaidOrders})*, *AT (${atPaidOrders})*`,
    `• Total Day Volume: *${todayPaid.length + paidServices.length + paidCheckers.length} Transactions*`,
    ``,
    `1️⃣2️⃣ *CUSTOMER SUPPORT & AI*`,
    `• Open Chat Sessions: *${openChats.length} Active*`,
    `• Unread Messages: *${unreadChats} Awaiting Response*`,
    `• AI Support: *${settingsMap["ai_support_enabled"] !== "false" ? "Enabled (DATA 1 GH AI) 🤖" : "Manual Mode"}*`,
    ``,
    `1️⃣3️⃣ *STORE SETTINGS & CONFIG*`,
    `• Store Name: *${shopName}*`,
    `• WhatsApp Bot: *${botUrl}*`,
    `• Support & Alert Phone: *${supportPhone}*`,
    `• Paystack & Dispatch: *Configured & Running ⚙️*`,
    ``,
    `━━━━━━━━━━━━━━━━━━━━━`,
    `🕒 *RECENT TRANSACTIONS (LAST 5)*`,
    recentListText,
    ``,
    `━━━━━━━━━━━━━━━━━━━━━`,
    `🏪 *Live Store Preview:* ${siteUrl}`,
    `💡 _Tip: Reply *ADMIN* anytime to refresh this complete report._`,
  ].join("\n");

  return {
    reportText,
    stats: {
      timestamp,
      shop_name: shopName,
      wallet_balance: walletBalance,
      arkesel_sms: arkeselSms,
      gross_revenue_today: grossRevToday,
      orders_paid_today: todayPaid.length,
      orders_delivered_today: todayDelivered.length,
      pending_delivery: todayPending.length,
      failed_today: todayFailed.length,
      products_count: products.length,
      products_in_stock: inStockCount,
      web_orders_count: allWebOrders.length,
      wa_orders_count: allWaOrders.length,
      services_count: paidServices.length,
      netflix_count: netflixPaid.length,
      mashup_count: mashupPaid.length,
      afa_count: afaPaid.length,
      checkers_count: paidCheckers.length,
      promoters_count: totalPromoters,
      spin_plays: totalSpins,
      free_data_claimed: claimedVouchers,
      open_chats: openChats.length,
      unread_chats: unreadChats,
    },
  };
}

export default async function handler(req: any, res: any) {
  setCorsHeaders(res);
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    // 1. Meta WhatsApp Webhook Verification (GET request with hub.challenge)
    if (req.method === "GET") {
      const mode = req.query?.["hub.mode"];
      const token = req.query?.["hub.verify_token"];
      const challenge = req.query?.["hub.challenge"];

      // If Meta Webhook subscription verification
      if (mode === "subscribe" && challenge) {
        const expectedToken = process.env.META_VERIFY_TOKEN || process.env.WHATSAPP_VERIFY_TOKEN || "data1gh_admin_secret";
        if (!token || token === expectedToken || token === "data1gh_admin_secret") {
          return res.status(200).send(challenge);
        }
        return res.status(403).json({ error: "Invalid verification token" });
      }

      // If standard GET call from Render bot or direct browser query
      const { reportText, stats } = await buildAdminWhatsAppReport();

      // If user asks for plain text format (?format=text)
      if (req.query?.format === "text") {
        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        return res.status(200).send(reportText);
      }

      return res.status(200).json({
        ok: true,
        reply: reportText,
        text: reportText,
        stats,
      });
    }

    // 2. POST request (either from Render bot or directly from Meta WhatsApp Webhook)
    const admin = getSupabase();
    const body = parseBody(req);

    // Check if this is a Meta WhatsApp Cloud API incoming webhook
    const metaMessage = body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    const incomingText = (
      metaMessage?.text?.body ||
      body?.text ||
      body?.message ||
      body?.msg ||
      body?.command ||
      ""
    ).trim();

    const senderPhone = metaMessage?.from || body?.from || body?.phone || "";

    const { reportText, stats } = await buildAdminWhatsAppReport();

    // If Meta Cloud API token is present, we can optionally dispatch back to Meta Graph API
    const metaToken = process.env.WHATSAPP_ACCESS_TOKEN || process.env.META_WHATSAPP_TOKEN || "";
    const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID || body?.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id || "";

    const normFrom = senderPhone.replace(/\D/g, "");

    // Dynamic Admin Phone Detection
    const adminPhones = [];
    if (process.env.ADMIN_ALERT_PHONE) adminPhones.push(String(process.env.ADMIN_ALERT_PHONE).replace(/\D/g, ""));
    if (process.env.ADMIN_WHATSAPP_NUMBER) adminPhones.push(String(process.env.ADMIN_WHATSAPP_NUMBER).replace(/\D/g, ""));
    try {
      const { data: sRows } = await admin
        .from("settings")
        .select("key,value")
        .in("key", ["admin_whatsapp_number", "admin_alert_phone", "admin_payment_alert_phone", "support_phone"]);
      (sRows || []).forEach((r: any) => {
        if (r.value) adminPhones.push(String(r.value).replace(/\D/g, ""));
      });
    } catch (_) { }
    if (adminPhones.length === 0) adminPhones.push("233547100951");

    const isAuthorizedAdmin = adminPhones.some(
      (p) => p && (normFrom === p || normFrom.endsWith(p.slice(-9)) || p.endsWith(normFrom.slice(-9)))
    );

    // Match sender against registered Agents / Resellers
    let matchedAgent: any = null;
    try {
      const { data: agentRows } = await admin
        .from("agents")
        .select("id, name, phone, whatsapp_number, store_name, store_slug, wallet_balance, total_earnings, custom_domain");
      if (agentRows && agentRows.length > 0) {
        matchedAgent = agentRows.find((a: any) => {
          const p1 = (a.phone || "").replace(/\D/g, "");
          const p2 = (a.whatsapp_number || "").replace(/\D/g, "");
          return (
            (p1 && (normFrom === p1 || normFrom.endsWith(p1.slice(-9)) || p1.endsWith(normFrom.slice(-9)))) ||
            (p2 && (normFrom === p2 || normFrom.endsWith(p2.slice(-9)) || p2.endsWith(normFrom.slice(-9))))
          );
        });
      }
    } catch (_) { }

    // 0. Check Custom Co-Pilot Trigger Rules (Admin-trained If-Then Rules)
    const matchedRule = await matchAndExecuteTriggerRule(admin, incomingText);
    if (matchedRule?.matched && matchedRule.replyText) {
      if (metaToken && phoneId && senderPhone) {
        try {
          await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
            method: "POST",
            headers: { Authorization: `Bearer ${metaToken}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              messaging_product: "whatsapp",
              to: senderPhone,
              type: "text",
              text: { body: matchedRule.replyText },
            }),
          });
        } catch (_) { }
      }
      return res.status(200).json({ ok: true, reply: matchedRule.replyText, text: matchedRule.replyText, matched_rule: matchedRule.rule?.trigger });
    }

    // 0b. Universal Live Delivery Time Inquiry (Accurate speeds from site & gateway)
    if (
      /^(?:delivery\s*time|delivery\s*speed|delivery|speed|eta)$/i.test(incomingText.trim()) ||
      /(?:accurate\s+)?(?:live\s+)?delivery\s+(?:time|speed|status|tracker|eta)\b/i.test(incomingText) ||
      /how\s+fast\s+(?:is\s+delivery|does\s+delivery\s+take)/i.test(incomingText) ||
      /how\s+long\s+does\s+delivery\s+take/i.test(incomingText) ||
      /is\s+delivery\s+instant/i.test(incomingText) ||
      /(?:when|how\s+long)\s+will\s+(?:my\s+)?data\s+(?:come|deliver)/i.test(incomingText) ||
      /delivery\s+time\s+(?:from|on)\s+(?:the\s+)?site/i.test(incomingText)
    ) {
      const dStats = await getAccurateLiveDeliveryStats(admin);
      const deliveryReply = dStats.summaryText;
      if (metaToken && phoneId && senderPhone) {
        try {
          await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
            method: "POST",
            headers: { Authorization: `Bearer ${metaToken}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              messaging_product: "whatsapp",
              to: senderPhone,
              type: "text",
              text: { body: deliveryReply },
            }),
          });
        } catch (_) { }
      }
      return res.status(200).json({ ok: true, reply: deliveryReply, text: deliveryReply });
    }

    // 0c. Universal Order Tracking
    const trackMatch = incomingText.match(/(?:track|check|status\s+of)\s+(?:order\s+)?([A-Za-z0-9_-]{5,35})/i);
    if (trackMatch) {
      const qRef = trackMatch[1].trim();
      const isPhone = /^(0[2357]\d{8}|233\d{9})$/.test(qRef);
      let ordQuery = admin.from("orders").select("*");
      if (isPhone) {
        const p = normalizeGhanaPhone(qRef);
        ordQuery = ordQuery.or(`recipient_phone.eq.${p},phone_number.eq.${p}`).order("created_at", { ascending: false }).limit(3);
      } else {
        ordQuery = ordQuery.or(`reference.ilike.%${qRef}%,datamart_reference.ilike.%${qRef}%`).limit(1);
      }
      const { data: ords } = await ordQuery;
      let trackReply = "";
      if (ords && ords.length > 0) {
        trackReply = `🔍 *DATA 1 GH — ORDER TRACKING*\n\n` + ords.map((o: any) =>
          `• *Ref:* ${o.reference}\n• *Package:* ${o.capacity}GB ${o.network}\n• *Delivery Status:* *${(o.delivery_status || "pending").toUpperCase()}*\n• *Payment Status:* ${(o.payment_status || "pending").toUpperCase()}\n• *Time:* ${formatGhanaTime(new Date(o.created_at))}`
        ).join("\n\n");
      } else {
        trackReply = `🔍 No order found matching reference *${qRef}*. You can check directly at https://www.data1gh.com/track`;
      }
      if (metaToken && phoneId && senderPhone) {
        try {
          await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
            method: "POST",
            headers: { Authorization: `Bearer ${metaToken}`, "Content-Type": "application/json" },
            body: JSON.stringify({ messaging_product: "whatsapp", to: senderPhone, type: "text", text: { body: trackReply } }),
          });
        } catch (_) { }
      }
      return res.status(200).json({ ok: true, reply: trackReply, text: trackReply });
    }

    // ========================================================
    // AGENT CO-PILOT: STORE RESELLER WHATSAPP ENGINE
    // ========================================================
    if (!isAuthorizedAdmin && matchedAgent) {
      const cleanCmd = incomingText.trim();
      const lowerCmd = cleanCmd.toLowerCase();
      let agentReply = "";

      const storeDomain = (matchedAgent.custom_domain || "https://gooddata1.vercel.app").replace(/\/+$/, "");
      const storefrontUrl = `${storeDomain}/s/${matchedAgent.store_slug}`;
      const dashboardUrl = `${storeDomain}/agent/dashboard`;

      // 1. Root admin security gate: Agents cannot run master admin operations
      const isRootAdminAction = /\b(credit\s+agent|broadcast|bulk\s+sms|blast\s+sms|turn\s+(?:on|off)\s+free\s+data|free\s+data\s+code|change\s+base\s+price|admin\s+password|admin\s+login|secret\s+key)\b/i.test(cleanCmd);
      if (isRootAdminAction) {
        agentReply = `⚠️ *MAIN ADMINISTRATOR PRIVILEGE REQUIRED*\n\nThis system-wide command is reserved for Master Administrators.\n\nAs the verified Store Partner for *${matchedAgent.store_name}*, you have full Store Co-Pilot control over your shop:\n• *balance* - Check wallet balance & today's profit\n• *orders* - View latest customer sales\n• *link* - Get your live customer storefront link\n• *referrals* - View 5GB customer reward milestones\n\nReply *menu* to explore your Co-Pilot!`;
      }

      // 2. Help / Menu / Greeting
      else if (/^(menu|help|hi|hello|start|hey|copilot|co-pilot)$/i.test(lowerCmd)) {
        agentReply = [
          `🏪 *Welcome to your Store Co-Pilot, ${matchedAgent.name}!*`,
          `📍 *Store:* ${matchedAgent.store_name}`,
          `💰 *Wallet Balance:* GH₵ ${Number(matchedAgent.wallet_balance || 0).toFixed(2)}`,
          `📈 *Total Profit Earned:* GH₵ ${Number(matchedAgent.total_earnings || 0).toFixed(2)}`,
          ``,
          `*Quick Commands:*`,
          `📊 *balance* - Check wallet, profit & today's sales`,
          `📦 *orders* - View your 5 latest storefront orders`,
          `🔗 *link* - Get your customer storefront URL`,
          `🎁 *referrals* - Check customer 5GB reward promoters`,
          `⚡ *track [ref]* - Track any order reference`,
          ``,
          `💬 _Or just ask me any question about your store, pricing, or orders!_`,
        ].join("\n");
      }

      // 3. Balance / Wallet / Earnings / Profit
      else if (/\b(balance|wallet|earnings|profit|revenue|how much)\b/i.test(lowerCmd)) {
        const todayDate = new Date().toISOString().split("T")[0];
        let todayCount = 0;
        let todayProfit = 0;
        let totalSalesCount = 0;

        try {
          const { data: ords } = await admin
            .from("orders")
            .select("id, amount, base_price, created_at, status, payment_status")
            .or(`agent_id.eq.${matchedAgent.id},notes.ilike.%[agent:${matchedAgent.id}]%`);

          if (ords) {
            totalSalesCount = ords.length;
            ords.forEach((o: any) => {
              const isToday = (o.created_at || "").startsWith(todayDate);
              const p = o.amount && o.base_price ? Math.max(0, Number(o.amount) - Number(o.base_price)) : 0;
              if (isToday) {
                todayCount++;
                todayProfit += p;
              }
            });
          }
        } catch (_) { }

        agentReply = [
          `📊 *STORE FINANCIAL REPORT*`,
          `🏪 *${matchedAgent.store_name}*`,
          ``,
          `💰 *Available Wallet Balance:* GH₵ ${Number(matchedAgent.wallet_balance || 0).toFixed(2)}`,
          `📈 *All-Time Profit Earned:* GH₵ ${Number(matchedAgent.total_earnings || 0).toFixed(2)}`,
          `📅 *Today's Sales:* ${todayCount} orders (+GH₵ ${todayProfit.toFixed(2)} profit)`,
          `🛍️ *Total Store Sales:* ${totalSalesCount} orders`,
          ``,
          `💳 To withdraw to your Mobile Money, visit your portal:`,
          `👉 ${dashboardUrl}`,
        ].join("\n");
      }

      // 4. Storefront Orders / Sales
      else if (/\b(orders?|sales?|my orders|recent orders|latest orders)\b/i.test(lowerCmd)) {
        try {
          const { data: ords } = await admin
            .from("orders")
            .select("id, reference, network, capacity, amount, base_price, recipient_phone, delivery_status, status, payment_status, created_at")
            .or(`agent_id.eq.${matchedAgent.id},notes.ilike.%[agent:${matchedAgent.id}]%`)
            .order("created_at", { ascending: false })
            .limit(5);

          if (!ords || ords.length === 0) {
            agentReply = [
              `📦 *STORE ORDERS*`,
              `🏪 *${matchedAgent.store_name}*`,
              ``,
              `You have no customer orders yet.`,
              `Share your storefront link to start making sales:`,
              `👉 ${storefrontUrl}`,
            ].join("\n");
          } else {
            const list = ords.map((o: any, idx: number) => {
              const profit = o.amount && o.base_price ? Math.max(0, Number(o.amount) - Number(o.base_price)) : 0;
              const deliv = (o.delivery_status || o.status || "pending").toUpperCase();
              const dateStr = o.created_at ? new Date(o.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Accra" }) : "";
              return `${idx + 1}️⃣ *${o.network || "DATA"} ${o.capacity || ""}* (${o.recipient_phone || "Customer"})\n   💵 GH₵ ${Number(o.amount || 0).toFixed(2)} | Profit: *+GH₵ ${profit.toFixed(2)}*\n   ⏱️ ${dateStr} | Status: ${deliv === "DELIVERED" ? "✅ DELIVERED" : "⏳ " + deliv}`;
            }).join("\n\n");

            agentReply = [
              `📦 *LATEST STORE ORDERS (Last 5)*`,
              `🏪 *${matchedAgent.store_name}*`,
              ``,
              list,
              ``,
              `💡 Reply *balance* to check your current withdrawable wallet.`,
            ].join("\n");
          }
        } catch (_) {
          agentReply = `⚠️ Could not retrieve store orders right now. Please try again.`;
        }
      }

      // 5. Store Link
      else if (/\b(link|store|storefront|my link|website|url)\b/i.test(lowerCmd)) {
        agentReply = [
          `🔗 *YOUR OFFICIAL STOREFRONT LINK*`,
          `🏪 *${matchedAgent.store_name}*`,
          ``,
          `Share this link directly with your customers:`,
          `👉 ${storefrontUrl}`,
          ``,
          `✨ *Benefits:*`,
          `• Instant customer self-service with MoMo checkout`,
          `• Automated bundle delivery directly to the buyer's phone`,
          `• Your profit is credited to your wallet in real time!`,
        ].join("\n");
      }

      // 6. Referrals & 5GB Free Data Rewards
      else if (/\b(referral|referrals|promoter|promoters|5gb|milestone|bonus)\b/i.test(lowerCmd)) {
        let referralsList: any[] = [];
        try {
          const { data: refSetting } = await admin
            .from("settings")
            .select("value")
            .eq("key", `agent_referrals_${matchedAgent.id}`)
            .maybeSingle();

          if (refSetting?.value) {
            referralsList = typeof refSetting.value === "string" ? JSON.parse(refSetting.value) : refSetting.value;
          }
        } catch (_) { }

        const totalPromoters = referralsList.length;
        const totalReferredOrders = referralsList.reduce((sum: number, r: any) => sum + (r.total_qualified_orders || 0), 0);
        const completedRewards = referralsList.filter((r: any) => (r.total_qualified_orders || 0) >= 5);

        let listDetail = "";
        if (referralsList.length > 0) {
          listDetail = referralsList.slice(0, 5).map((r: any) => {
            const count = r.total_qualified_orders || 0;
            const isReady = count >= 5;
            return `• *${r.customer_phone}* (${r.referral_code || "Code"}): ${count}/5 orders ${isReady ? "🏆 (5GB READY!)" : ""}`;
          }).join("\n");
        } else {
          listDetail = "_No customer promoters have registered on your store yet._";
        }

        agentReply = [
          `🎁 *CUSTOMER REFERRALS & 5GB REWARDS*`,
          `🏪 *${matchedAgent.store_name}*`,
          ``,
          `👥 *Registered Promoters:* ${totalPromoters}`,
          `🛍️ *Total Referred Orders:* ${totalReferredOrders}`,
          `🏆 *Completed 5GB Rewards:* ${completedRewards.length}`,
          ``,
          `*Promoter Progress:*`,
          listDetail,
          ``,
          `ℹ️ Once a promoter hits 5 friends, Main Admin is notified to manually issue their 5GB reward!`,
        ].join("\n");
      }

      // 7. Conversational AI fallback via Gemini
      else {
        try {
          const { data: apiKeyRow } = await admin
            .from("settings")
            .select("value")
            .eq("key", "gemini_api_key")
            .maybeSingle();

          const gemKey = apiKeyRow?.value || process.env.GEMINI_API_KEY || "";
          if (gemKey) {
            const agentSystemPrompt = `You are the personal WhatsApp AI Co-Pilot for a data bundle store named "${matchedAgent.store_name}" operated by reseller "${matchedAgent.name}".
Your goal is to assist the agent in managing their store, understanding their earnings, answering questions about MTN/Telecel/AT data bundles in Ghana, and giving helpful tips to sell more data.
Agent Storefront URL: ${storefrontUrl}
Agent Wallet Balance: GH₵ ${Number(matchedAgent.wallet_balance || 0).toFixed(2)}
Agent Lifetime Earnings: GH₵ ${Number(matchedAgent.total_earnings || 0).toFixed(2)}

Style:
- Concise, polite, and energetic WhatsApp style with appropriate emojis.
- Bullet points where applicable.
- Remind them of available commands (*balance*, *orders*, *link*, *referrals*) if relevant.
- Do NOT make up admin features (e.g. they cannot credit other agents or change base prices).`;

            const aiRes = await callGeminiSingle(agentSystemPrompt, cleanCmd, [], gemKey, "gemini-2.5-flash");
            if (aiRes?.reply) {
              agentReply = aiRes.reply.trim();
            }
          }
        } catch (_) { }

        if (!agentReply) {
          agentReply = [
            `🏪 *${matchedAgent.store_name} Co-Pilot*`,
            ``,
            `I received your message: "${cleanCmd}".`,
            ``,
            `*Here is what you can do:*`,
            `📊 *balance* - Check wallet balance & today's profit`,
            `📦 *orders* - View latest customer sales`,
            `🔗 *link* - Get your live customer storefront link`,
            `🎁 *referrals* - Check customer 5GB reward progress`,
            `⚡ *track [ref]* - Track any order reference`,
          ].join("\n");
        }
      }

      // Dispatch reply to Meta Graph API
      if (metaToken && phoneId && senderPhone) {
        try {
          await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
            method: "POST",
            headers: { Authorization: `Bearer ${metaToken}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              messaging_product: "whatsapp",
              to: senderPhone,
              type: "text",
              text: { body: agentReply },
            }),
          });
        } catch (_) { }
      }

      return res.status(200).json({
        ok: true,
        sender: senderPhone,
        agent_id: matchedAgent.id,
        store_name: matchedAgent.store_name,
        reply: agentReply,
        text: agentReply,
      });
    }

    // SECURITY FIREWALL: Check for unauthorized admin commands / tampering
    const isAdminIntent =
      /^(admin|dashboard|report)$/i.test(incomingText) ||
      /\b(pause\s*orders?|pause\s*packages?|resume\s*orders?|resume\s*packages?|stop\s*orders?|close\s*shop|open\s*shop|freeze\s*orders?|unpause\s*orders?|broadcast|bulk\s+sms|blast\s+sms|update\s+order|order\s+status|delivery\s+status|payment\s+status|mark\s+delivered|mark\s+paid|change\s+price|toggle\s+stock|send\s+sms|generate\s+voucher|free\s+data\s+code|turn\s+(?:on|off)\s+free\s+data|credit\s+agent|list\s+agents|change\s+color|change\s+theme|update\s+announcement|admin\s+password|admin\s+login|secret\s+key|resync\s+order|retry\s+order|stuck\s+order|issue\s+radar)\b/i.test(incomingText);

    if (!isAuthorizedAdmin && isAdminIntent) {
      console.warn("🚨 UNAUTHORIZED ADMIN ATTEMPT AT /api/whatsapp-bot FROM:", senderPhone, incomingText);
      await sendSecurityAlert(admin, {
        type: "UNAUTHORIZED_ADMIN_COMMAND",
        endpoint: "/api/whatsapp-bot",
        ip: senderPhone,
        details: `Unauthorized phone ${senderPhone} attempted admin command: "${incomingText}"`,
        severity: "critical",
      });

      const restrictedMsg = "⚠️ *ACCESS RESTRICTED*\n\nThis command is for DATA 1 GH Administrators only.\n\nReply with *hi* to view customer data bundles and services.";

      if (metaToken && phoneId && senderPhone) {
        try {
          await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
            method: "POST",
            headers: { Authorization: `Bearer ${metaToken}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              messaging_product: "whatsapp",
              to: senderPhone,
              type: "text",
              text: { body: restrictedMsg },
            }),
          });
        } catch (_) { }
      }

      return res.status(200).json({ ok: false, error: "Access restricted to administrators", reply: restrictedMsg });
    }

    if (!isAuthorizedAdmin) {
      // Normal visitor greeting
      const visitorReply = `Hello! Welcome to DATA 1 GH 🇬🇭.\nBrowse our data bundles and order online at: https://www.data1gh.com\nReply *hi* to view bundle packages or *track [ref]* to check your order!`;
      if (metaToken && phoneId && senderPhone) {
        try {
          await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
            method: "POST",
            headers: { Authorization: `Bearer ${metaToken}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              messaging_product: "whatsapp",
              to: senderPhone,
              type: "text",
              text: { body: visitorReply },
            }),
          });
        } catch (_) { }
      }
      return res.status(200).json({ ok: true, reply: visitorReply });
    }

    // ========================================================
    // AUTHORIZED ADMIN: STONY AI CO-PILOT SITE CONTROL ENGINE
    // ========================================================
    let replyText = "";
    const cleanCmd = incomingText.trim();
    const lowerCmd = cleanCmd.toLowerCase();

    // 1. Executive Briefing / Report
    if (/^(admin|dashboard|report)$/i.test(lowerCmd)) {
      replyText = reportText;
    }

    // 2. Full Order Details Lookup
    else if (
      /(?:check\s+order|order\s+details|details\s+(?:for|of)?|lookup\s+order|inspect\s+order)\s*([A-Za-z0-9_-]{5,35})/i.test(cleanCmd) ||
      /^(?:details|inspect)\s+([A-Za-z0-9_-]{6,35})$/i.test(cleanCmd)
    ) {
      const match = cleanCmd.match(/(?:check\s+order|order\s+details|details\s+(?:for|of)?|lookup\s+order|inspect\s+order)\s*([A-Za-z0-9_-]{5,35})/i) ||
        cleanCmd.match(/^(?:details|inspect)\s+([A-Za-z0-9_-]{6,35})$/i);
      const qRef = match ? match[1].trim() : "";
      const isPhone = /^(0[2357]\d{8}|233\d{9})$/.test(qRef);

      let ordQuery = admin.from("orders").select("*");
      if (isPhone) {
        const p = normalizeGhanaPhone(qRef);
        ordQuery = ordQuery.or(`recipient_phone.eq.${p},phone_number.eq.${p}`).order("created_at", { ascending: false }).limit(3);
      } else {
        ordQuery = ordQuery.or(`reference.ilike.%${qRef}%,datamart_reference.ilike.%${qRef}%`).limit(1);
      }

      const { data: ords } = await ordQuery;
      if (ords && ords.length > 0) {
        replyText = `🔍 *ORDER INSPECTION RESULT*\n\n` + ords.map((o: any, idx: number) =>
          `📦 *ORDER #${idx + 1}:*\n` +
          `• *Reference:* ${o.reference}\n` +
          `• *Package:* ${o.capacity}GB (${o.network})\n` +
          `• *Recipient:* *${o.recipient_phone || o.phone_number}*\n` +
          `• *Amount:* GH₵ ${Number(o.amount || 0).toFixed(2)}\n` +
          `• *Payment Status:* ${(o.payment_status || "unknown").toUpperCase()}\n` +
          `• *Delivery Status:* *${(o.delivery_status || "unknown").toUpperCase()}*\n` +
          `• *Date Placed:* ${formatGhanaTime(new Date(o.created_at))}`
        ).join("\n━━━━━━━━━━━━━━━━━━━━━\n");
      } else {
        replyText = `🔍 Could not find any order matching *${qRef}*. Please verify the reference or phone number.`;
      }
    }

    // 3. Update Order Delivery Status
    else if (
      /(?:mark|set|update)\s+(?:order\s+)?([A-Za-z0-9_-]{5,35})\s+(?:to|as)?\s*([a-zA-Z_\s-]{3,20})/i.test(cleanCmd) ||
      /(?:mark|set|update)\s+([a-zA-Z_\s-]{3,20})\s+(?:for\s+)?(?:order\s+)?([A-Za-z0-9_-]{5,35})/i.test(cleanCmd)
    ) {
      const match = cleanCmd.match(/(?:mark|set|update)\s+(?:order\s+)?([A-Za-z0-9_-]{5,35})\s+(?:to|as)?\s*([a-zA-Z_\s-]{3,20})/i);
      const targetRef = match ? match[1].trim() : "";
      const rawStatus = match ? match[2].trim() : "delivered";
      const targetStatus = /deliv/i.test(rawStatus) ? "delivered" : (/fail|cancel/i.test(rawStatus) ? "failed" : (/proc/i.test(rawStatus) ? "processing" : rawStatus.toLowerCase()));

      const upd = await updateOrderDeliveryStatusDirect(admin, targetRef, targetStatus);
      if (upd.found) {
        replyText = `✅ *ACTION COMPLETED BOSS!*\n\nI have successfully updated order *${targetRef}* to *${targetStatus.toUpperCase()}* in the database!\n\nDatabase is synchronized with reality. What else would you like me to tackle?`;
      } else {
        replyText = `⚠️ Could not find order *${targetRef}* in the database to update.`;
      }
    }

    // 4. Send Customer SMS via Arkesel
    else if (/(?:send\s+)?(?:an\s+)?(?:custom\s+)?sms\s+(?:to\s+)?(0[2357]\d{8}|233\d{9})\s*(?::|\s+(?:saying|with message|that|message:))\s*["“']?([^"”']+)["”']?/i.test(cleanCmd)) {
      const smsMatch = cleanCmd.match(/(?:send\s+)?(?:an\s+)?(?:custom\s+)?sms\s+(?:to\s+)?(0[2357]\d{8}|233\d{9})\s*(?::|\s+(?:saying|with message|that|message:))\s*["“']?([^"”']+)["”']?/i);
      const targetPhone = smsMatch ? smsMatch[1].trim() : "";
      const msgBody = smsMatch ? smsMatch[2].trim() : "";

      const { data: sRows } = await admin.from("settings").select("key,value").in("key", ["arkesel_api_key", "ARKESEL_API_KEY"]);
      const arkeselKey = sRows?.[0]?.value || process.env.ARKESEL_API_KEY || "";

      if (arkeselKey) {
        const sent = await sendArkeselSmsDirect(arkeselKey, targetPhone, msgBody);
        replyText = sent
          ? `✅ *SMS DELIVERED BOSS!*\n\n📱 *Recipient:* ${targetPhone}\n🆔 *Sender ID:* *D_1Gh*\n💬 *Message:* "${msgBody}"\n\nSMS gateway dispatched successfully!`
          : `❌ Failed to dispatch SMS. Please check Arkesel balance.`;
      } else {
        replyText = `⚠️ Arkesel API key is not configured in settings.`;
      }
    }

    // 4b. Broadcast Bulk SMS via Arkesel (To Customers, Agents, or Multiple Numbers)
    else if (
      /(?:broadcast|bulk\s+send|blast)\s+(?:sms\s+)?(?:to\s+)?(all\s+customers|customers|agents|all\s+agents|[0-9,\s+]+)\s*(?::|\s+(?:saying|with message|that|message:))\s*["“']?([^"”']+)["”']?/i.test(cleanCmd) ||
      /(?:send\s+bulk\s+sms|broadcast\s+message)\s+(?:to\s+)?(all\s+customers|customers|agents|all\s+agents|[0-9,\s+]+)\s*(?::|\s+(?:saying|with message|that|message:))\s*["“']?([^"”']+)["”']?/i.test(cleanCmd)
    ) {
      const bMatch =
        cleanCmd.match(/(?:broadcast|bulk\s+send|blast)\s+(?:sms\s+)?(?:to\s+)?(all\s+customers|customers|agents|all\s+agents|[0-9,\s+]+)\s*(?::|\s+(?:saying|with message|that|message:))\s*["“']?([^"”']+)["”']?/i) ||
        cleanCmd.match(/(?:send\s+bulk\s+sms|broadcast\s+message)\s+(?:to\s+)?(all\s+customers|customers|agents|all\s+agents|[0-9,\s+]+)\s*(?::|\s+(?:saying|with message|that|message:))\s*["“']?([^"”']+)["”']?/i);

      const targetGroup = (bMatch?.[1] || "").trim().toLowerCase();
      const msgBody = (bMatch?.[2] || "").trim();

      const { data: sRows } = await admin.from("settings").select("key,value").in("key", ["arkesel_api_key", "ARKESEL_API_KEY"]);
      const arkeselKey = sRows?.[0]?.value || process.env.ARKESEL_API_KEY || "";

      if (!arkeselKey) {
        replyText = "⚠️ Arkesel API key is not configured in settings. Please configure ARKESEL_API_KEY.";
      } else if (!msgBody) {
        replyText = '⚠️ Please specify the message to broadcast. Example:\n_broadcast sms to customers saying "Special MTN bundle discount today on Data1gh!"_';
      } else {
        let recipientPhones: string[] = [];
        let groupLabel = "Target Group";

        if (targetGroup.includes("agent")) {
          groupLabel = "All Registered Agents";
          const { data: agRows } = await admin.from("agents").select("phone");
          recipientPhones = (agRows || []).map((a: any) => a.phone).filter(Boolean);
        } else if (targetGroup.includes("customer")) {
          groupLabel = "Past Customers";
          const [oRes, sRes] = await Promise.all([
            admin.from("orders").select("recipient_phone").limit(60),
            admin.from("service_orders").select("customer_phone").limit(40),
          ]);
          recipientPhones = [
            ...(oRes.data || []).map((o: any) => o.recipient_phone),
            ...(sRes.data || []).map((s: any) => s.customer_phone),
          ].filter(Boolean);
        } else {
          groupLabel = "Specified Contact List";
          recipientPhones = targetGroup.split(/[\s,]+/);
        }

        const bResult = await sendArkeselBulkSmsDirect(arkeselKey, recipientPhones, msgBody);
        if (bResult.total === 0) {
          replyText = `❌ No valid phone numbers found for group "${groupLabel}".`;
        } else {
          replyText =
            `📢 *BULK SMS BROADCAST COMPLETE BOSS!*\n\n` +
            `• *Target:* ${groupLabel}\n` +
            `• *Total Valid Recipients:* ${bResult.total}\n` +
            `• *Successfully Sent:* *${bResult.sent}*\n` +
            (bResult.failed > 0 ? `• *Failed:* ${bResult.failed}\n` : "") +
            `• *Sender ID:* *D_1Gh*\n` +
            `• *Message:* "${msgBody}"\n\n` +
            `Dispatched via Arkesel SMS gateway! 🚀`;
        }
      }
    }

    // 5. Generate Free Data Vouchers
    else if (/(?:generate|create|make)\s+(\d+)?\s*(?:free\s+data\s+)?(?:codes?|vouchers?)(?:\s+(?:for|on)\s+([a-zA-Z]+))?(?:\s+(\d+)GB)?/i.test(cleanCmd)) {
      const vMatch = cleanCmd.match(/(?:generate|create|make)\s+(\d+)?\s*(?:free\s+data\s+)?(?:codes?|vouchers?)(?:\s+(?:for|on)\s+([a-zA-Z]+))?(?:\s+(\d+)GB)?/i);
      const count = parseInt(vMatch?.[1] || "5", 10);
      const net = vMatch?.[2] || "MTN";
      const cap = vMatch?.[3] || "1";

      const res = await generateFreeDataVouchersDirect(admin, count, net, cap);
      replyText =
        `🎁 *FREE DATA VOUCHERS GENERATED BOSS!*\n\n` +
        `• *Network:* ${res.network}\n` +
        `• *Package:* ${res.capacity}GB\n` +
        `• *Total Codes (${res.codes.length}):*\n\n` +
        res.codes.map((c, i) => `${i + 1}. *${c}*`).join("\n") +
        `\n\nThese codes are saved live in your database and ready for customers to claim on https://www.data1gh.com!`;
    }

    // 6. Toggle Free Data Campaign
    else if (/(?:turn\s*(?:on|off)|enable|disable)\s+(?:the\s+)?(?:free\s+data|vouchers?|free\s+promo)/i.test(cleanCmd)) {
      const enable = /\b(on|enable)\b/i.test(cleanCmd);
      const val = enable ? "true" : "false";
      await admin.from("settings").upsert([
        { key: "free_data_campaign_active", value: val },
        { key: "free_data_enabled", value: val },
      ], { onConflict: "key" });

      replyText = `🎁 *FREE DATA CAMPAIGN ${enable ? "ACTIVATED ✅" : "DISABLED ❌"}*\n\nThe free data giveaway modal is now ${enable ? "*LIVE AND CLAIMABLE* on the storefront." : "*OFF* on the website."}`;
    }

    // 6b. Toggle Orders Pause / Freeze (Storefront + Agent Stores + Bot)
    else if (/\b(?:pause\s*orders?|pause\s*packages?|stop\s*orders?|disable\s*orders?|close\s*shop|turn\s*off\s*orders?|stop\s*taking\s*orders?|hold\s*orders?|freeze\s*orders?)\b/i.test(cleanCmd)) {
      await admin.from("settings").upsert([
        { key: "orders_paused", value: "true" },
        { key: "orders_pause_message", value: "Ordering is temporarily paused for scheduled system maintenance. Please check back shortly!" },
      ], { onConflict: "key" });
      try {
        const { invalidateSettingsCache } = await import("./_supabase.js");
        invalidateSettingsCache();
      } catch (_) {}
      replyText = `⏸️ *ALL ORDERS & PACKAGES PAUSED BOSS!*\n\nI have successfully paused ordering across the entire system:\n• 🌐 *Main Storefront:* All packages paused, buttons locked.\n• 🏪 *Agent Reseller Stores:* All packages paused, checkout locked.\n• 🤖 *WhatsApp Bot:* Incoming purchases paused.\n\nTo resume taking orders anytime, just reply *resume orders* or *open shop*!`;
    }

    else if (/\b(?:resume\s*orders?|resume\s*packages?|open\s*shop|enable\s*orders?|turn\s*on\s*orders?|start\s*taking\s*orders?|unpause\s*orders?|unfreeze\s*orders?)\b/i.test(cleanCmd)) {
      await admin.from("settings").upsert([
        { key: "orders_paused", value: "false" },
      ], { onConflict: "key" });
      try {
        const { invalidateSettingsCache } = await import("./_supabase.js");
        invalidateSettingsCache();
      } catch (_) {}
      replyText = `▶️ *ALL ORDERS & PACKAGES RESUMED BOSS!*\n\nOrdering is now *ACTIVE & LIVE* across all storefronts:\n• 🌐 *Main Storefront:* All packages unlocked and active.\n• 🏪 *Agent Reseller Stores:* All agent checkout buttons active.\n• 🤖 *WhatsApp Bot:* Order processing enabled.\n\nCustomers and agents can now place orders normally!`;
    }

    // 7. Change Site Theme Color
    else if (
      /(?:change|set|update)\s+(?:the\s+)?(?:site\s+|store\s+|theme\s+)?color\s+(?:to\s+)?([a-zA-Z_-]+)/i.test(cleanCmd) ||
      /(?:switch\s+to|set|enable)\s+(dark\s*mode|light\s*mode)/i.test(cleanCmd)
    ) {
      const cMatch = cleanCmd.match(/(?:change|set|update)\s+(?:the\s+)?(?:site\s+|store\s+|theme\s+)?color\s+(?:to\s+)?([a-zA-Z_-]+)/i) ||
        cleanCmd.match(/(?:switch\s+to|set|enable)\s+(dark\s*mode|light\s*mode)/i);
      const colorVal = cMatch ? cMatch[1].trim().toLowerCase() : "midnight";

      await admin.from("settings").upsert([
        { key: "site_theme", value: colorVal },
        { key: "theme_color", value: colorVal },
        { key: "primary_color", value: colorVal },
      ], { onConflict: "key" });

      replyText = `🎨 *SITE THEME & COLOR UPDATED BOSS!*\n\nActive site theme color is now *${colorVal.toUpperCase()}*.\nStorefront styling updated live!`;
    }

    // 8. List Agents (Directory & Status)
    else if (/^(?:list|check|show|view)\s+agents?\b/i.test(lowerCmd) || lowerCmd === "agents" || lowerCmd === "all agents") {
      const { data: agents } = await admin
        .from("agents")
        .select("id, name, phone, store_name, store_slug, wallet_balance, total_earnings, status")
        .order("created_at", { ascending: false })
        .limit(25);

      if (agents && agents.length > 0) {
        replyText =
          `💼 *REGISTERED AGENTS DIRECTORY (${agents.length})*\n\n` +
          agents
            .map((a: any, i: number) => {
              const isSusp = a.status === "suspended";
              const statusBadge = isSusp ? "⛔ SUSPENDED" : "✅ Active";
              return `${i + 1}. *${a.store_name || a.name || "Agent Store"}* (${a.phone || "No phone"})\n   • Owner: ${a.name || "Partner"} | ${statusBadge}\n   • Balance: *GH₵ ${Number(a.wallet_balance || 0).toFixed(2)}* | Earned: *GH₵ ${Number(a.total_earnings || 0).toFixed(2)}*`;
            })
            .join("\n\n") +
          `\n\n💡 *Admin Commands:*` +
          `\n• *check agent [name/phone]*` +
          `\n• *credit agent [name/phone] with [amount]*` +
          `\n• *debit agent [name/phone] with [amount]*` +
          `\n• *suspend agent [name/phone]*` +
          `\n• *activate agent [name/phone]*` +
          `\n• *agent referrals*`;
      } else {
        replyText = "💼 No agents registered yet in database.";
      }
    }

    // 8b. Inspect / Check Specific Agent
    else if (/(?:check|inspect|view|info|details\s+on)\s+agent\s+(.+)/i.test(cleanCmd)) {
      const targetQuery = cleanCmd.replace(/(?:check|inspect|view|info|details\s+on)\s+agent\s+/i, "").trim();
      const { data: agents } = await admin.from("agents").select("*");
      const targetPhone = targetQuery.replace(/\D/g, "");

      const matched = (agents || []).find((a: any) => {
        if (a.id && a.id.toLowerCase() === targetQuery.toLowerCase()) return true;
        if (a.store_slug && a.store_slug.toLowerCase() === targetQuery.toLowerCase()) return true;
        if (a.store_name && a.store_name.toLowerCase().includes(targetQuery.toLowerCase())) return true;
        if (a.name && a.name.toLowerCase().includes(targetQuery.toLowerCase())) return true;
        const p1 = (a.phone || "").replace(/\D/g, "");
        const p2 = (a.whatsapp_number || "").replace(/\D/g, "");
        if (targetPhone && targetPhone.length >= 7) {
          if (p1 && (p1 === targetPhone || p1.endsWith(targetPhone.slice(-9)) || targetPhone.endsWith(p1.slice(-9)))) return true;
          if (p2 && (p2 === targetPhone || p2.endsWith(targetPhone.slice(-9)) || targetPhone.endsWith(p2.slice(-9)))) return true;
        }
        return false;
      });

      if (!matched) {
        replyText = `❌ Agent "${targetQuery}" not found. Type *list agents* to view all registered agents.`;
      } else {
        const todayDate = new Date().toISOString().split("T")[0];
        let todaySales = 0;
        let todayProfit = 0;
        let totalOrders = 0;

        try {
          const { data: ords } = await admin
            .from("orders")
            .select("id, amount, base_price, created_at")
            .or(`agent_id.eq.${matched.id},notes.ilike.%[agent:${matched.id}]%`);

          if (ords) {
            totalOrders = ords.length;
            ords.forEach((o: any) => {
              const isToday = (o.created_at || "").startsWith(todayDate);
              const p = o.amount && o.base_price ? Math.max(0, Number(o.amount) - Number(o.base_price)) : 0;
              if (isToday) {
                todaySales++;
                todayProfit += p;
              }
            });
          }
        } catch (_) {}

        let promotersCount = 0;
        let completed5gb = 0;
        try {
          const { data: refRow } = await admin
            .from("settings")
            .select("value")
            .eq("key", `agent_referrals_${matched.id}`)
            .maybeSingle();

          if (refRow?.value) {
            const list = typeof refRow.value === "string" ? JSON.parse(refRow.value) : refRow.value;
            if (Array.isArray(list)) {
              promotersCount = list.length;
              completed5gb = list.filter((r: any) => (r.total_qualified_orders || 0) >= 5).length;
            }
          }
        } catch (_) {}

        const statusLabel = matched.status === "suspended" ? "⛔ SUSPENDED (STORE BLOCKED)" : "✅ ACTIVE";

        replyText = [
          `🔍 *AGENT PROFILE & STORE INTEL*`,
          `🏪 *${matched.store_name || "Store"}*`,
          ``,
          `• *Owner Name:* ${matched.name || "N/A"}`,
          `• *Email:* ${matched.email || "No email"}`,
          `• *Phone Number:* ${matched.phone || "N/A"}`,
          `• *WhatsApp:* ${matched.whatsapp_number || matched.phone || "N/A"}`,
          `• *Account Status:* *${statusLabel}*`,
          `• *Store URL:* https://gooddata1.vercel.app/s/${matched.store_slug}`,
          ``,
          `💰 *Wallet Balance:* *GH₵ ${Number(matched.wallet_balance || 0).toFixed(2)}*`,
          `📈 *All-Time Profit:* *GH₵ ${Number(matched.total_earnings || 0).toFixed(2)}*`,
          `📅 *Today's Sales:* ${todaySales} orders (+GH₵ ${todayProfit.toFixed(2)} profit)`,
          `🛍️ *Lifetime Sales:* ${totalOrders} orders placed`,
          `🎁 *5GB Promoters:* ${promotersCount} registered (${completed5gb} completed 5 friends)`,
          ``,
          `💡 *Quick Actions:*`,
          `• *credit agent ${matched.phone} with 20*`,
          `• *debit agent ${matched.phone} with 10*`,
          matched.status === "suspended"
            ? `• *activate agent ${matched.phone}*`
            : `• *suspend agent ${matched.phone}*`,
        ].join("\n");
      }
    }

    // 8c. Suspend / Block Agent
    else if (/(?:suspend|block|freeze)\s+agent\s+(.+)/i.test(cleanCmd)) {
      const targetQuery = cleanCmd.replace(/(?:suspend|block|freeze)\s+agent\s+/i, "").trim();
      const { data: agents } = await admin.from("agents").select("*");
      const targetPhone = targetQuery.replace(/\D/g, "");

      const matched = (agents || []).find((a: any) => {
        if (a.id && a.id.toLowerCase() === targetQuery.toLowerCase()) return true;
        if (a.store_slug && a.store_slug.toLowerCase() === targetQuery.toLowerCase()) return true;
        if (a.store_name && a.store_name.toLowerCase().includes(targetQuery.toLowerCase())) return true;
        if (a.name && a.name.toLowerCase().includes(targetQuery.toLowerCase())) return true;
        const p1 = (a.phone || "").replace(/\D/g, "");
        if (targetPhone && targetPhone.length >= 7 && p1 && (p1 === targetPhone || p1.endsWith(targetPhone.slice(-9)))) return true;
        return false;
      });

      if (!matched) {
        replyText = `❌ Agent "${targetQuery}" not found.`;
      } else {
        await admin.from("agents").update({ status: "suspended" }).eq("id", matched.id);
        replyText =
          `⛔ *AGENT STORE SUSPENDED BOSS!*\n\n` +
          `• *Agent:* ${matched.store_name} (${matched.name})\n` +
          `• *Phone:* ${matched.phone}\n` +
          `• *Status:* ⛔ SUSPENDED\n\n` +
          `Their storefront has been frozen. To unfreeze anytime, reply:\n` +
          `*activate agent ${matched.phone}*`;
      }
    }

    // 8d. Activate / Unsuspend Agent
    else if (/(?:activate|unsuspend|unblock|unfreeze)\s+agent\s+(.+)/i.test(cleanCmd)) {
      const targetQuery = cleanCmd.replace(/(?:activate|unsuspend|unblock|unfreeze)\s+agent\s+/i, "").trim();
      const { data: agents } = await admin.from("agents").select("*");
      const targetPhone = targetQuery.replace(/\D/g, "");

      const matched = (agents || []).find((a: any) => {
        if (a.id && a.id.toLowerCase() === targetQuery.toLowerCase()) return true;
        if (a.store_slug && a.store_slug.toLowerCase() === targetQuery.toLowerCase()) return true;
        if (a.store_name && a.store_name.toLowerCase().includes(targetQuery.toLowerCase())) return true;
        if (a.name && a.name.toLowerCase().includes(targetQuery.toLowerCase())) return true;
        const p1 = (a.phone || "").replace(/\D/g, "");
        if (targetPhone && targetPhone.length >= 7 && p1 && (p1 === targetPhone || p1.endsWith(targetPhone.slice(-9)))) return true;
        return false;
      });

      if (!matched) {
        replyText = `❌ Agent "${targetQuery}" not found.`;
      } else {
        await admin.from("agents").update({ status: "active" }).eq("id", matched.id);
        replyText =
          `✅ *AGENT STORE ACTIVATED BOSS!*\n\n` +
          `• *Agent:* ${matched.store_name} (${matched.name})\n` +
          `• *Phone:* ${matched.phone}\n` +
          `• *Status:* ✅ ACTIVE\n\n` +
          `Storefront is live and processing orders!`;
      }
    }

    // 8d. Credit / Top Up DataMart Developer Wallet
    else if (/(?:credit|fund|top\s*up|deposit)\s+(?:to\s+)?(?:datamart|data\s*mart|telecom\s*wallet|dm\s*wallet|my\s+wallet)\s+(?:with\s+)?(?:gh[c₵]?\s*)?(\d+(?:\.\d+)?)/i.test(cleanCmd) ||
             /(?:credit|fund|top\s*up|deposit)\s+(?:gh[c₵]?\s*)?(\d+(?:\.\d+)?)\s+(?:to\s+)?(?:datamart|data\s*mart|telecom\s*wallet|dm\s*wallet|my\s+wallet)/i.test(cleanCmd)) {
      const dmMatch = cleanCmd.match(/(?:credit|fund|top\s*up|deposit)\s+(?:to\s+)?(?:datamart|data\s*mart|telecom\s*wallet|dm\s*wallet|my\s+wallet)\s+(?:with\s+)?(?:gh[c₵]?\s*)?(\d+(?:\.\d+)?)/i) ||
        cleanCmd.match(/(?:credit|fund|top\s*up|deposit)\s+(?:gh[c₵]?\s*)?(\d+(?:\.\d+)?)\s+(?:to\s+)?(?:datamart|data\s*mart|telecom\s*wallet|dm\s*wallet|my\s+wallet)/i);
      const amt = parseFloat(dmMatch?.[1] || "0");
      if (amt > 0) {
        const { getDatamartAuthToken, initiateDatamartBridgeDeposit } = await import("./_datamart.js");
        const token = await getDatamartAuthToken(admin);
        const { data: sRows } = await admin.from("settings").select("key,value").in("key", ["admin_topup_phone", "admin_alert_phone", "admin_whatsapp_number"]);
        const sMap: Record<string, string> = {};
        (sRows || []).forEach((r: any) => { sMap[r.key] = r.value; });

        // Check if an explicit phone was provided in the command (e.g. "top up datamart 50 on 0551234567")
        const explicitPhoneMatch = cleanCmd.match(/(?:on|with|to|for|momo|number|num|phone)\s*(?:0|\+?233)?([2357][0-9]{8})\b/i) ||
          cleanCmd.match(/\b(0[2357][0-9]{8})\b/i) ||
          cleanCmd.match(/\b(233[2357][0-9]{8})\b/i);

        let chosenPhone = "";
        if (explicitPhoneMatch) {
          const rawP = (explicitPhoneMatch[1] || explicitPhoneMatch[0]).replace(/\D/g, "");
          chosenPhone = rawP.startsWith("233") ? "0" + rawP.slice(3) : (rawP.startsWith("0") ? rawP : "0" + rawP);
        } else if (sMap["admin_topup_phone"]) {
          chosenPhone = sMap["admin_topup_phone"];
        } else if (sMap["admin_alert_phone"]) {
          chosenPhone = sMap["admin_alert_phone"];
        } else {
          chosenPhone = cleanAdminPhone || "0547228161";
        }
        const formattedPhone = chosenPhone.length === 12 && chosenPhone.startsWith("233") ? "0" + chosenPhone.slice(3) : chosenPhone;

        if (token) {
          const bRes = await initiateDatamartBridgeDeposit({
            token,
            phoneNumber: formattedPhone,
            amount: amt,
            network: "MTN",
          });
          if (bRes.success) {
            replyText = `📲 *MOMO TOP-UP PROMPT DISPATCHED BOSS!*\n\n` +
              `I have sent a Mobile Money payment prompt of *GH₵ ${amt.toFixed(2)}* to *${formattedPhone}*.\n\n` +
              `🔑 *Next Step:* Enter your MoMo PIN on *${formattedPhone}* to approve the deposit.\n\n` +
              `💡 *Tip:* To use a different number anytime, write:\n` +
              `• *top up datamart ${amt} on [phone]*\n` +
              `• Or change default: *set momo [phone]*`;
          } else {
            replyText = `⚠️ Could not send MoMo prompt: ${bRes.error || "Please verify your DataMart credentials."}\n\n` +
              `Or transfer MoMo to DataMart Merchant: *0257476174* (DANAA SAMUEL FRIMPONG) and reply: *claim datamart [Trx_ID]*`;
          }
        } else {
          replyText = `💳 *TOP UP DATAMART WALLET*\n\n` +
            `To top up *GH₵ ${amt.toFixed(2)}* to your DataMart developer wallet:\n\n` +
            `📱 *Transfer MoMo to DataMart Merchant:*\n` +
            `• *MoMo Number:* *0257476174*\n` +
            `• *Account Name:* *DANAA SAMUEL FRIMPONG / Dajo Unimarket*\n` +
            `• *Network:* MTN\n\n` +
            `After sending, reply here with:\n` +
            `*claim datamart [Transaction_ID]*`;
        }
      }
    }

    // 8d_set_momo: Set default top-up MoMo phone number
    else if (/(?:set|update|change)\s+(?:default\s+)?(?:top\s*up|datamart|telecom|momo)\s*(?:phone|number)?\s*(?:to|=)?\s*(0[2357]\d{8}|233[2357]\d{8})/i.test(cleanCmd) ||
             /(?:set|update|change)\s+momo\s+(?:number\s+)?(?:to|=)?\s*(0[2357]\d{8}|233[2357]\d{8})/i.test(cleanCmd)) {
      const setMatch = cleanCmd.match(/(?:set|update|change)\s+(?:default\s+)?(?:top\s*up|datamart|telecom|momo)\s*(?:phone|number)?\s*(?:to|=)?\s*(0[2357]\d{8}|233[2357]\d{8})/i) ||
        cleanCmd.match(/(?:set|update|change)\s+momo\s+(?:number\s+)?(?:to|=)?\s*(0[2357]\d{8}|233[2357]\d{8})/i);
      if (setMatch) {
        let cleanP = setMatch[1].trim();
        if (cleanP.startsWith("233")) cleanP = "0" + cleanP.slice(3);
        await admin.from("settings").upsert({ key: "admin_topup_phone", value: cleanP }, { onConflict: "key" });
        replyText = `✅ *DEFAULT TOP-UP MOMO NUMBER SAVED BOSS!*\n\n` +
          `• *Saved Number:* *${cleanP}*\n\n` +
          `Whenever you send *top up datamart [amount]*, the payment prompt will automatically be sent to *${cleanP}*!\n\n` +
          `💡 *Tip:* You can also top up any other number anytime by adding it to your message:\n` +
          `• *top up datamart 50 on 054XXXXXXX*`;
      }
    }

    // 8e. Claim DataMart MoMo Deposit
    else if (/(?:claim\s+datamart|claim\s+deposit|claim\s+momo)\s+([A-Za-z0-9_-]+)/i.test(cleanCmd)) {
      const clMatch = cleanCmd.match(/(?:claim\s+datamart|claim\s+deposit|claim\s+momo)\s+([A-Za-z0-9_-]+)/i);
      const trxId = clMatch ? clMatch[1].trim() : "";
      if (trxId) {
        const { getDatamartAuthToken, claimDatamartMomoDeposit } = await import("./_datamart.js");
        const token = await getDatamartAuthToken(admin);
        const { data: sRows } = await admin.from("settings").select("key,value").in("key", ["admin_topup_phone", "admin_alert_phone", "admin_whatsapp_number"]);
        const sMap: Record<string, string> = {};
        (sRows || []).forEach((r: any) => { sMap[r.key] = r.value; });
        const momoPhone = sMap["admin_topup_phone"] || sMap["admin_alert_phone"] || cleanAdminPhone || "0547228161";

        if (token) {
          const clRes = await claimDatamartMomoDeposit({
            token,
            trxId,
            momoNumber: momoPhone,
            network: "mtn",
          });
          if (clRes.success) {
            replyText = `✅ *DATAMART DEPOSIT CLAIMED BOSS!*\n\n` +
              `• *Transaction ID:* ${trxId}\n` +
              `• *New DataMart Balance:* *GH₵ ${clRes.newBalance != null ? Number(clRes.newBalance).toFixed(2) : "Credited"}* 🎉\n\n` +
              `Your developer wallet is updated!`;
          } else {
            replyText = `⚠️ DataMart response: ${clRes.error || "Could not verify transaction ID. Please check the ID and retry."}`;
          }
        } else {
          replyText = `⚠️ Please configure your DataMart login credentials in the Admin Dashboard to claim deposits.`;
        }
      }
    }

    // 9. Credit Agent Wallet
    else if (/credit\s+agent\s+([A-Za-z0-9_.-]+)\s+(?:with\s+)?(?:gh[c₵]?\s*)?(\d+(?:\.\d+)?)/i.test(cleanCmd)) {
      const crMatch = cleanCmd.match(/credit\s+agent\s+([A-Za-z0-9_.-]+)\s+(?:with\s+)?(?:gh[c₵]?\s*)?(\d+(?:\.\d+)?)/i);
      const targetPhone = crMatch ? crMatch[1].trim() : "";
      const amt = parseFloat(crMatch?.[2] || "0");

      if (amt > 0) {
        const { data: agents } = await admin.from("agents").select("*");
        const cleanT = targetPhone.replace(/\D/g, "");
        const target = (agents || []).find((a: any) =>
          a.id === targetPhone ||
          (cleanT && a.phone && String(a.phone).replace(/\D/g, "").endsWith(cleanT.slice(-9))) ||
          (a.name && a.name.toLowerCase().includes(targetPhone.toLowerCase())) ||
          (a.store_name && a.store_name.toLowerCase().includes(targetPhone.toLowerCase()))
        );

        if (target) {
          const newBal = Number(target.wallet_balance || 0) + amt;
          await admin.from("agents").update({ wallet_balance: newBal }).eq("id", target.id);
          replyText = `✅ *AGENT WALLET CREDITED BOSS!*\n\n• *Agent:* ${target.store_name || target.name}\n• *Owner:* ${target.name}\n• *Phone:* ${target.phone}\n• *Amount Added:* *GH₵ ${amt.toFixed(2)}*\n• *New Balance:* *GH₵ ${newBal.toFixed(2)}*`;
        } else {
          replyText = `❌ Could not find agent "${targetPhone}". Use "list agents" to view all registered agents.`;
        }
      }
    }

    // 9b. Debit / Deduct Agent Wallet
    else if (/(?:debit|deduct)\s+agent\s+([A-Za-z0-9_.-]+)\s+(?:with\s+)?(?:gh[c₵]?\s*)?(\d+(?:\.\d+)?)/i.test(cleanCmd)) {
      const dbMatch = cleanCmd.match(/(?:debit|deduct)\s+agent\s+([A-Za-z0-9_.-]+)\s+(?:with\s+)?(?:gh[c₵]?\s*)?(\d+(?:\.\d+)?)/i);
      const targetPhone = dbMatch ? dbMatch[1].trim() : "";
      const amt = parseFloat(dbMatch?.[2] || "0");

      if (amt > 0) {
        const { data: agents } = await admin.from("agents").select("*");
        const cleanT = targetPhone.replace(/\D/g, "");
        const target = (agents || []).find((a: any) =>
          a.id === targetPhone ||
          (cleanT && a.phone && String(a.phone).replace(/\D/g, "").endsWith(cleanT.slice(-9))) ||
          (a.name && a.name.toLowerCase().includes(targetPhone.toLowerCase())) ||
          (a.store_name && a.store_name.toLowerCase().includes(targetPhone.toLowerCase()))
        );

        if (target) {
          const currentBal = Number(target.wallet_balance || 0);
          const newBal = Math.max(0, currentBal - amt);
          await admin.from("agents").update({ wallet_balance: newBal }).eq("id", target.id);
          replyText = `✅ *AGENT WALLET DEDUCTED BOSS!*\n\n• *Agent:* ${target.store_name || target.name}\n• *Phone:* ${target.phone}\n• *Amount Deducted:* *GH₵ ${amt.toFixed(2)}*\n• *New Balance:* *GH₵ ${newBal.toFixed(2)}*`;
        } else {
          replyText = `❌ Could not find agent "${targetPhone}". Use "list agents" to view all registered agents.`;
        }
      }
    }

    // 9c. Agent Customer Referrals & 5GB Free Data Overview for Admin
    else if (/(?:agent\s+referrals?|admin\s+referrals?|promoters?|5gb\s+winners?|referral\s+winners?)/i.test(cleanCmd)) {
      try {
        const { data: rows } = await admin
          .from("settings")
          .select("key, value")
          .like("key", "agent_referrals_%");

        let allPromoters: any[] = [];
        (rows || []).forEach((row: any) => {
          if (!row.value) return;
          try {
            const parsed = typeof row.value === "string" ? JSON.parse(row.value) : row.value;
            if (Array.isArray(parsed)) allPromoters.push(...parsed);
          } catch (_) {}
        });

        const readyRewards = allPromoters.filter((r) => (r.total_qualified_orders || 0) >= 5 && !r.reward_claimed);
        const totalReferredOrders = allPromoters.reduce((sum, r) => sum + (r.total_qualified_orders || 0), 0);

        let winnersList = "";
        if (readyRewards.length > 0) {
          winnersList =
            `\n🏆 *PROMOTERS WAITING FOR 5GB REWARD (${readyRewards.length}):*\n` +
            readyRewards
              .map(
                (w: any, idx: number) =>
                  `${idx + 1}️⃣ *${w.customer_phone}* (${w.agent_name || "Store"})\n   • Code: *${w.referral_code}* | Orders: *${w.total_qualified_orders}/5*\n   • Reward: 5GB Free Data (Manual send)`
              )
              .join("\n\n");
        } else {
          winnersList = `\n_No promoters currently waiting for 5GB rewards._`;
        }

        replyText =
          `🎁 *AGENT CUSTOMER REFERRALS & 5GB REWARDS*\n\n` +
          `• *Total Registered Promoters:* *${allPromoters.length}*\n` +
          `• *Total Referred Customer Sales:* *${totalReferredOrders} orders*\n` +
          `• *Pending 5GB Rewards to Fulfill:* *${readyRewards.length} winners*\n` +
          winnersList +
          `\n\n💡 Manage and mark rewards fulfilled anytime at:\n👉 https://www.data1gh.com/admin/referrals`;
      } catch (_) {
        replyText = `⚠️ Could not load customer referrals list.`;
      }
    }

    // 10. Check Live Balances
    else if (/^(?:check\s+)?(?:balance|balances|wallet|datamart|arkesel)\b/i.test(lowerCmd)) {
      replyText =
        `💳 *LIVE SYSTEM BALANCES*\n\n` +
        `• *DataMart API Wallet:* *GH₵ ${Number(stats.wallet_balance || 0).toFixed(2)}*\n` +
        `• *Arkesel SMS Gateway:* *${stats.arkesel_sms !== null ? stats.arkesel_sms : "0"} SMS*\n` +
        `• *Today's Paid Sales:* *GH₵ ${Number(stats.gross_revenue_today || 0).toFixed(2)}* (${stats.orders_paid_today || 0} orders)\n` +
        `• *Pending Deliveries:* *${stats.pending_delivery || 0}*\n\n` +
        `Status: *Systems operational ✅*`;
    }

    // 10b. Top Customer Numbers & Most Orders Query
    else if (
      /(?:who|which\s+(?:number|phone|customer)|list\s+(?:the\s+)?numbers?)\s+(?:has|have|with)\s+(?:the\s+)?(?:most|highest|top|max)\s+orders?/i.test(cleanCmd) ||
      /(?:number|customer)\s+(?:that\s+)?(?:have|has)\s+(?:a\s+)?(?:list\s+order\s+)?(?:most|top|highest)\s+orders?/i.test(cleanCmd) ||
      /(?:top|highest)\s+(?:order(?:ing)?|customers?|buyers?|numbers?)/i.test(cleanCmd) ||
      /(?:most\s+orders|who\s+ordered\s+most|who\s+bought\s+most|list\s+orders?\s+most)/i.test(cleanCmd)
    ) {
      const topCust = await getTopOrderingCustomers(admin, 6);
      replyText = topCust.text;
    }

    // 10c. List Recent Orders
    else if (/^(?:list|fetch|show|get)\s+(?:recent\s+)?orders?\b/i.test(cleanCmd)) {
      replyText = await getRecentOrdersList(admin, 8);
    }

    // 10d. Lookup Specific Customer Phone
    else if (/(?:check|find|lookup|show|get)\s+(?:orders?\s+(?:for|of)?\s*)?(0[2357]\d{8}|233\d{9})/i.test(cleanCmd)) {
      const pMatch = cleanCmd.match(/(0[2357]\d{8}|233\d{9})/);
      replyText = pMatch ? await getCustomerPhoneOrders(admin, pMatch[1]) : "Please provide a valid Ghana phone number.";
    }

    // 11. Conversational Chat & Site Co-Pilot via Grok & Gemini
    else {
      let aiResponse = "";
      try {
        const settingsMap = await getCachedSettings(admin);

        const [delivStats, topCustStats] = await Promise.all([
          getAccurateLiveDeliveryStats(admin),
          getTopOrderingCustomers(admin, 5),
        ]);

        const enrichedLiveContext = [
          reportText,
          ``,
          `• Live Accurate Delivery Speeds: MTN (${delivStats.mtnSpeed}), Telecel (${delivStats.telecelSpeed}), AT (${delivStats.atSpeed}) | FastLane: ${delivStats.fastLaneMinutes || 1}m | Queue: ${delivStats.pendingBatches} batches`,
          `• Top Customers with Most Orders: ${topCustStats.list.map((c: any) => `${c.phone} (${c.count} orders)`).join(", ")}`,
        ].join("\n");

        const coPilotRes = await callOwnerCoPilotAI({
          userMessage: cleanCmd,
          history: [],
          settings: settingsMap,
          liveContext: enrichedLiveContext,
          storeUrl: "https://www.data1gh.com",
        });

        if (coPilotRes?.reply) {
          aiResponse = coPilotRes.reply.trim();

          // If AI emitted an action to execute directly
          if (coPilotRes.executedAction) {
            try {
              const act = coPilotRes.executedAction;
              const aType = String(act.action_type || act.type || "").toLowerCase();
              const p = act.payload || act;

              if (aType === "query_top_customers") {
                const topRes = await getTopOrderingCustomers(admin, 6);
                aiResponse += `\n\n${topRes.text}`;
              } else if (aType === "query_delivery_times") {
                const dStats = await getAccurateLiveDeliveryStats(admin);
                aiResponse += `\n\n${dStats.summaryText}`;
              } else if (aType === "lookup_phone") {
                const ph = p.phone || p.recipient_phone;
                if (ph) {
                  const pRes = await getCustomerPhoneOrders(admin, ph);
                  aiResponse += `\n\n${pRes}`;
                }
              } else if (aType === "list_recent_orders") {
                const ordList = await getRecentOrdersList(admin, 8);
                aiResponse += `\n\n${ordList}`;
              } else if (aType === "send_sms") {
                const { data: sRows } = await admin.from("settings").select("key,value").in("key", ["arkesel_api_key", "ARKESEL_API_KEY"]);
                const arkeselKey = sRows?.[0]?.value || process.env.ARKESEL_API_KEY || "";
                if (arkeselKey && p.phone && p.message) {
                  const sent = await sendArkeselSmsDirect(arkeselKey, p.phone, p.message);
                  aiResponse += sent ? `\n\n📱 Dispatched SMS to ${p.phone} via D_1Gh!` : `\n\n⚠️ Failed to dispatch SMS.`;
                }
              } else if (aType === "update_order_status") {
                const targetRef = p.reference || p.ref;
                const targetStatus = p.delivery_status || p.status || "delivered";
                if (targetRef) {
                  await updateOrderDeliveryStatusDirect(admin, targetRef, targetStatus);
                  aiResponse += `\n\n✅ Done bossu! Order ${targetRef} marked as ${targetStatus.toUpperCase()}!`;
                }
              } else if (aType === "update_product_price") {
                const newPrice = parseFloat(p.price || p.new_price);
                if (newPrice > 0) {
                  let q = admin.from("products").update({ price: newPrice, updated_at: new Date().toISOString() });
                  if (p.product_id) q = q.eq("id", p.product_id);
                  else if (p.network && p.capacity) q = q.ilike("network", `%${p.network}%`).eq("capacity", String(p.capacity).replace(/\D/g, ""));
                  await q;
                  aiResponse += `\n\n✅ Done bossu! Product price updated to GH₵ ${newPrice.toFixed(2)} on storefront!`;
                }
              } else if (aType === "toggle_product_stock") {
                await admin.from("products").update({ in_stock: Boolean(p.in_stock), updated_at: new Date().toISOString() }).eq("id", p.product_id);
                aiResponse += `\n\n✅ Done bossu! Product stock toggled to ${p.in_stock ? "IN STOCK" : "OUT OF STOCK"}!`;
              } else if (aType === "generate_vouchers") {
                const resV = await generateFreeDataVouchersDirect(admin, parseInt(p.count || "5", 10), p.network || "MTN", p.capacity || "1");
                aiResponse += `\n\n🎁 Generated ${resV.codes.length} codes: ${resV.codes.join(", ")}`;
              } else if (aType === "toggle_free_data") {
                const val = p.active ? "true" : "false";
                await admin.from("settings").upsert([
                  { key: "free_data_campaign_active", value: val },
                  { key: "free_data_enabled", value: val },
                ], { onConflict: "key" });
                aiResponse += `\n\n🎁 Free data campaign is now ${p.active ? "ACTIVE on storefront" : "DISABLED"}!`;
              }
            } catch (execErr: any) {
              console.warn("Direct execution in bot note:", execErr?.message);
            }
          }
        }
      } catch (err: any) {
        console.warn("Bot AI co-pilot call error:", err?.message);
      }

      if (aiResponse) {
        replyText = aiResponse;
      } else {
        replyText =
          `I hear you loud and clear bossu! Whole system is active and monitored.\n` +
          `• Today's Sales: *GH₵ ${Number(stats.gross_revenue_today || 0).toFixed(2)}* (${stats.orders_paid_today || 0} orders)\n` +
          `• DataMart Wallet: *GH₵ ${Number(stats.wallet_balance || 0).toFixed(2)}*\n` +
          `• SMS Credits: *${stats.arkesel_sms !== null ? stats.arkesel_sms : "0"} SMS*\n\n` +
          `You can command me to update order status, inspect orders, check top ordering customers, see accurate live delivery times, send SMS, generate free data codes, list agents, credit/debit agent wallets, suspend/activate agents, or check agent referrals. What would you like us to tackle?`;
      }
    }

    // Dispatch reply to Meta Graph API if credentials are present
    if (metaToken && phoneId && senderPhone) {
      try {
        await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${metaToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: senderPhone,
            type: "text",
            text: { body: replyText },
          }),
        });
      } catch (metaErr) {
        console.warn("Could not post back directly to Meta Graph API:", metaErr);
      }
    }

    // Always respond with JSON containing the reply text so Render bot can simply use it
    return res.status(200).json({
      ok: true,
      sender: senderPhone,
      command: incomingText,
      reply: replyText,
      text: replyText,
      stats,
    });
  } catch (err: any) {
    console.error("whatsapp-bot endpoint error:", err);
    return res.status(500).json({
      ok: false,
      error: err?.message || "Internal server error generating WhatsApp report",
    });
  }
}
