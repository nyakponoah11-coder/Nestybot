import { createClient } from "@supabase/supabase-js";
import { getEnvVar, getSupabase, data1db } from "./_supabase.js";
import { askCustomerSupportAI } from "./_ai-rotator.js";

function setCorsHeaders(res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "authorization, x-client-info, apikey, content-type, x-function-name"
  );
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
}

function parseBody(req: any) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string" && req.body.trim()) {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return {};
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

function formatArkeselPhone(raw: string): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("233") && digits.length === 12) return digits;
  if (digits.startsWith("0") && digits.length === 10) return `233${digits.slice(1)}`;
  if (digits.length === 9) return `233${digits}`;
  return null;
}

function formatOrderDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr || "recently";
  }
}

function extractCustomerInputs(
  text: string,
  history: Array<{ sender: string; body: string }>,
  visitorPhone?: string
) {
  const combined = [
    visitorPhone || "",
    ...history.slice(-8).map((h) => h.body),
    text,
  ].join(" \n ");

  // Extract phone numbers (Ghana 10 digits starting with 0, or 233, or 9 digits)
  let phone = "";
  const phoneMatches =
    combined.match(/(?:\+?233|0)\s*[25]\d(?:\s*\d){7}/g) ||
    combined.match(/\b0\d{9}\b/g) ||
    combined.match(/\b233\d{9}\b/g);
  if (phoneMatches && phoneMatches.length > 0) {
    phone = phoneMatches[phoneMatches.length - 1].replace(/\D/g, "");
  } else if (visitorPhone) {
    phone = visitorPhone.replace(/\D/g, "");
  }

  // Extract reference code (ORD-..., CK-..., NF-..., etc.)
  const refMatch =
    combined.match(/\b(ORD-[A-Za-z0-9_-]+|CK-[A-Za-z0-9_-]+|NF-[A-Za-z0-9_-]+)\b/i) ||
    text.match(/\b([A-Za-z0-9]{10,24})\b/);
  const ref = refMatch ? refMatch[1].trim() : "";

  // Extract data capacity (e.g. 1GB, 2.5GB, 5GB, 10GB, 20GB, 50GB, 500MB)
  const capMatch = combined.match(/\b(\d+(?:\.\d+)?)\s*(?:gb|mb)\b/i);
  const capacity = capMatch
    ? `${capMatch[1]}${capMatch[0].toLowerCase().includes("mb") ? "MB" : "GB"}`
    : "";

  return { phone, ref, capacity };
}

async function findCustomerOrders(admin: any, phone: string, ref: string) {
  const orders: any[] = [];
  if (!admin) return orders;
  const cleanDigits = phone ? phone.replace(/\D/g, "") : "";
  const last9 = cleanDigits.length >= 9 ? cleanDigits.slice(-9) : "";

  // 1. Telecom bundle orders
  try {
    if (ref) {
      const { data: refOrders } = await admin
        .from("orders")
        .select("id, reference, network, capacity, recipient_phone, amount, payment_status, delivery_status, created_at")
        .eq("reference", ref)
        .limit(5);
      if (refOrders) {
        for (const ro of refOrders) {
          orders.push({ ...ro, order_type: "data" });
        }
      }
    }
    if (last9) {
      const { data: phoneOrders } = await admin
        .from("orders")
        .select("id, reference, network, capacity, recipient_phone, amount, payment_status, delivery_status, created_at")
        .ilike("recipient_phone", `%${last9}%`)
        .order("created_at", { ascending: false })
        .limit(6);
      if (phoneOrders) {
        for (const po of phoneOrders) {
          if (!orders.find((o) => o.id === po.id || o.reference === po.reference)) {
            orders.push({ ...po, order_type: "data" });
          }
        }
      }
    }
  } catch (_) {}

  // 2. Service orders (Netflix, MTN Mashup combos, AFA)
  try {
    if (ref) {
      const { data: sRef } = await admin
        .from("service_orders")
        .select("id, reference, service, customer_phone, amount, status, delivery_status, notes, created_at")
        .eq("reference", ref)
        .limit(5);
      if (sRef) {
        for (const so of sRef) {
          if (!orders.find((o) => o.id === so.id || o.reference === so.reference)) {
            const codeMatch = so.notes?.match(/\[netflix_code:([^\]]+)\]/) || so.notes?.match(/\[code:([^\]]+)\]/);
            orders.push({
              id: so.id,
              reference: so.reference,
              network: so.service === "mashup" ? "MTN Mashup" : so.service === "netflix" ? "Netflix" : "AFA",
              capacity: so.service === "mashup" ? (so.notes || "Mashup Combo") : so.service === "netflix" ? "Netflix 30-Day Pass" : "AFA Registration",
              recipient_phone: so.customer_phone,
              amount: so.amount,
              payment_status: so.status || "pending",
              delivery_status: so.delivery_status,
              created_at: so.created_at,
              notes: so.notes,
              netflix_last_code: codeMatch ? codeMatch[1].trim() : null,
              order_type: "service",
            });
          }
        }
      }
    }
    if (last9) {
      const { data: sPhone } = await admin
        .from("service_orders")
        .select("id, reference, service, customer_phone, amount, status, delivery_status, notes, created_at")
        .ilike("customer_phone", `%${last9}%`)
        .order("created_at", { ascending: false })
        .limit(6);
      if (sPhone) {
        for (const so of sPhone) {
          if (!orders.find((o) => o.id === so.id || o.reference === so.reference)) {
            const codeMatch = so.notes?.match(/\[netflix_code:([^\]]+)\]/) || so.notes?.match(/\[code:([^\]]+)\]/);
            orders.push({
              id: so.id,
              reference: so.reference,
              network: so.service === "mashup" ? "MTN Mashup" : so.service === "netflix" ? "Netflix" : "AFA",
              capacity: so.service === "mashup" ? (so.notes || "Mashup Combo") : so.service === "netflix" ? "Netflix 30-Day Pass" : "AFA Registration",
              recipient_phone: so.customer_phone,
              amount: so.amount,
              payment_status: so.status || "pending",
              delivery_status: so.delivery_status,
              created_at: so.created_at,
              notes: so.notes,
              netflix_last_code: codeMatch ? codeMatch[1].trim() : null,
              order_type: "service",
            });
          }
        }
      }
    }
  } catch (_) {}

  // 3. Checker orders (WAEC, BECE, WASSCE, NovDec)
  try {
    if (ref) {
      const { data: cRef } = await admin
        .from("checker_orders")
        .select("id, reference, checker_type, customer_phone, amount, status, delivery_status, notes, created_at")
        .eq("reference", ref)
        .limit(5);
      if (cRef) {
        for (const co of cRef) {
          if (!orders.find((o) => o.id === co.id || o.reference === co.reference)) {
            const serialMatch = co.notes?.match(/\[serial:([^\]]+)\]/);
            const pinMatch = co.notes?.match(/\[pin:([^\]]+)\]/);
            orders.push({
              id: co.id,
              reference: co.reference,
              network: "WAEC",
              capacity: `${String(co.checker_type).toUpperCase()} Checker`,
              recipient_phone: co.customer_phone,
              amount: co.amount,
              payment_status: co.status || "pending",
              delivery_status: co.delivery_status,
              created_at: co.created_at,
              serial_number: serialMatch ? serialMatch[1].trim() : null,
              pin: pinMatch ? pinMatch[1].trim() : null,
              order_type: "checker",
            });
          }
        }
      }
    }
    if (last9) {
      const { data: cPhone } = await admin
        .from("checker_orders")
        .select("id, reference, checker_type, customer_phone, amount, status, delivery_status, notes, created_at")
        .ilike("customer_phone", `%${last9}%`)
        .order("created_at", { ascending: false })
        .limit(6);
      if (cPhone) {
        for (const co of cPhone) {
          if (!orders.find((o) => o.id === co.id || o.reference === co.reference)) {
            const serialMatch = co.notes?.match(/\[serial:([^\]]+)\]/);
            const pinMatch = co.notes?.match(/\[pin:([^\]]+)\]/);
            orders.push({
              id: co.id,
              reference: co.reference,
              network: "WAEC",
              capacity: `${String(co.checker_type).toUpperCase()} Checker`,
              recipient_phone: co.customer_phone,
              amount: co.amount,
              payment_status: co.status || "pending",
              delivery_status: co.delivery_status,
              created_at: co.created_at,
              serial_number: serialMatch ? serialMatch[1].trim() : null,
              pin: pinMatch ? pinMatch[1].trim() : null,
              order_type: "checker",
            });
          }
        }
      }
    }
  } catch (_) {}

  // Sort newest first
  orders.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return orders;
}

// Owner instruction: ALL automatic SMS are blocked. Set to true to re-enable.
const AUTO_SMS_ENABLED = false;

async function sendResolutionSms(
  admin: any,
  order: any,
  adminAlertPhone: string
) {
  if (!AUTO_SMS_ENABLED) return;
  try {
    const { data: sRows } = await admin
      .from("settings")
      .select("key,value")
      .in("key", [
        "admin_alert_phone",
        "support_phone",
        "arkesel_api_key",
        "ARKESEL_API_KEY",
        "arkesel_sender_id",
      ]);
    const smap = Object.fromEntries((sRows || []).map((s: any) => [s.key, s.value]));

    const arkeselKey = cleanApiKey(
      process.env.ARKESEL_API_KEY ||
      process.env.VITE_ARKESEL_API_KEY ||
      smap.arkesel_api_key ||
      smap.ARKESEL_API_KEY ||
      ""
    );
    if (!arkeselKey) {
      console.warn("sendResolutionSms: No Arkesel API key configured.");
      return;
    }

    const sender = (process.env.ARKESEL_SENDER_ID || smap.arkesel_sender_id || "Data1gh").slice(0, 11);
    const packageLabel = order.capacity
      ? `${order.capacity} ${order.network && !order.capacity.includes(order.network) ? order.network : ""}`.trim()
      : (order.notes || "Package");

    // 1. Send SMS to Customer
    const customerPhoneFormatted = formatArkeselPhone(order.recipient_phone);
    if (customerPhoneFormatted) {
      const customerMsg = `DATA 1 GH: Hello! Your order inquiry for ${packageLabel} on ${order.recipient_phone} (Ref: ${order.reference}) has been noted and our team is actively resolving it. You will receive your delivery shortly. Thank you!`;
      await fetch("https://sms.arkesel.com/api/v2/sms/send", {
        method: "POST",
        headers: {
          "api-key": arkeselKey,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          sender: sender,
          message: customerMsg,
          recipients: [customerPhoneFormatted],
        }),
      }).catch((err) => console.warn("Customer SMS send error:", err));
    }

    // 2. Send SMS to Admin: "DATA 1 GH Alert: Low balance / Failed order. Number: [phone], Package: [pkg], Ref: [ref]"
    const targetAdmin =
      smap.support_phone || adminAlertPhone || smap.admin_alert_phone || process.env.ADMIN_ALERT_PHONE || "";
    const adminPhoneFormatted = formatArkeselPhone(targetAdmin);
    if (adminPhoneFormatted) {
      const adminMsg = `DATA 1 GH Alert: Low balance / Failed order. Number: ${order.recipient_phone}, Package: ${packageLabel}, Ref: ${order.reference}`;
      await fetch("https://sms.arkesel.com/api/v2/sms/send", {
        method: "POST",
        headers: {
          "api-key": arkeselKey,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          sender: "Data1gh",
          message: adminMsg,
          recipients: [adminPhoneFormatted],
        }),
      }).catch((err) => console.warn("Admin SMS send error:", err));
    }
  } catch (e) {
    console.error("sendResolutionSms error:", e);
  }
}

async function fetchDataMartDeliveryTracker(admin: any): Promise<{
  deliverySpeedText: string;
  etaWindowText: string;
  trackerSummary: string;
}> {
  let dmKey = "";
  if (admin) {
    try {
      const { data: sRows } = await admin
        .from("settings")
        .select("key,value")
        .in("key", ["datamart_api_key", "DATAMART_API_KEY", "datamart_key", "dm_api_key"]);
      const smap = Object.fromEntries((sRows || []).map((s: any) => [s.key, s.value]));
      dmKey = cleanApiKey(smap.datamart_api_key || smap.DATAMART_API_KEY || smap.datamart_key || smap.dm_api_key);
    } catch (_) {}
  }
  if (!dmKey) {
    dmKey = cleanApiKey(
      process.env.DATAMART_API_KEY ||
      process.env.VITE_DATAMART_API_KEY ||
      ""
    );
  }

  let trackerPayload: any = null;
  let statusPayload: any = null;

  try {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (dmKey) headers["X-API-Key"] = dmKey;

    const [tRes, sRes] = await Promise.all([
      fetch("https://api.datamartgh.shop/api/developer/delivery-tracker", { headers, signal: AbortSignal.timeout(3000) }).catch(() => null),
      fetch("https://api.datamartgh.shop/api/v1/data/delivery-status", { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(3000) }).catch(() => null),
    ]);

    if (tRes && tRes.ok) {
      trackerPayload = await tRes.json().catch(() => null);
    }
    if (sRes && sRes.ok) {
      statusPayload = await sRes.json().catch(() => null);
    }
  } catch (_) {}

  const trackerData = trackerPayload?.data || trackerPayload;
  const statusData = statusPayload?.data;

  // 1. Calculate ETA minutes from fastLane or recent order
  let estimatedMinutes = 5;
  let isFastLane = false;
  let lastPlacedIso = "";
  let lastDeliveredIso = "";

  if (statusData?.unibundleActive && statusData?.unibundleFrontier?.placedAt && statusData?.unibundleFrontier?.deliveredAt) {
    const placed = new Date(statusData.unibundleFrontier.placedAt).getTime();
    const delivered = new Date(statusData.unibundleFrontier.deliveredAt).getTime();
    estimatedMinutes = Math.max(1, Math.round((delivered - placed) / 60000));
    isFastLane = true;
    lastPlacedIso = statusData.unibundleFrontier.placedAt;
    lastDeliveredIso = statusData.unibundleFrontier.deliveredAt;
  } else if (trackerData?.fastLane?.minutes != null) {
    estimatedMinutes = Math.max(1, Math.round(trackerData.fastLane.minutes));
    isFastLane = true;
    lastPlacedIso = trackerData.fastLane.placedAt || "";
    lastDeliveredIso = trackerData.fastLane.deliveredAt || "";
  } else if (trackerData?.lastDelivered?.placedAt && trackerData?.lastDelivered?.deliveredAt) {
    const p = new Date(trackerData.lastDelivered.placedAt).getTime();
    const d = new Date(trackerData.lastDelivered.deliveredAt).getTime();
    estimatedMinutes = Math.min(15, Math.max(1, Math.round((d - p) / 60000)));
  } else if (trackerData?.scanner?.pendingBatches != null) {
    const batches = Number(trackerData.scanner.pendingBatches);
    estimatedMinutes = batches <= 1 ? 3 : batches <= 3 ? 6 : 10;
  }

  if (estimatedMinutes > 15 || estimatedMinutes < 1 || isNaN(estimatedMinutes)) {
    estimatedMinutes = 5;
  }

  // 2. Compute exact time calculation based on current Ghana time
  const now = new Date();
  const formatTime = (d: Date) =>
    d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Accra" });

  const nowFormatted = formatTime(now);
  const minEtaDate = new Date(now.getTime() + Math.max(1, estimatedMinutes - 1) * 60000);
  const maxEtaDate = new Date(now.getTime() + (estimatedMinutes + 3) * 60000);
  const etaWindowText = `If you place your order now (at ${nowFormatted}), you will receive it between ${formatTime(minEtaDate)} and ${formatTime(maxEtaDate)} (estimated delivery time is ~${estimatedMinutes} minute${estimatedMinutes === 1 ? "" : "s"}).`;

  // 3. Stats from Delivery Progress
  const deliveredCount = trackerData?.stats?.delivered ?? statusData?.deliveredToday ?? null;
  const pendingCount = trackerData?.stats?.pending ?? trackerData?.scanner?.pendingBatches ?? null;
  const lastSummary = trackerData?.lastDelivered?.summary || "";

  let statsText = "";
  if (deliveredCount != null) {
    statsText += `Delivery Progress: ${deliveredCount} orders completed today`;
    if (pendingCount != null) {
      statsText += `, ${pendingCount} order${pendingCount === 1 ? "" : "s"} currently in queue.`;
    } else {
      statsText += `.`;
    }
  }

  let fastLaneDetail = "";
  if (isFastLane && lastPlacedIso && lastDeliveredIso) {
    const pTime = formatTime(new Date(lastPlacedIso));
    const dTime = formatTime(new Date(lastDeliveredIso));
    fastLaneDetail = ` Our automated fast lane is active — the latest order was placed at ${pTime} and delivered at ${dTime} in approximately ${estimatedMinutes} minute(s).`;
  }

  const deliverySpeedText = `According to our live delivery tracker, deliveries are currently running at approximately ~${estimatedMinutes} minute(s). ${statsText}${fastLaneDetail} ${etaWindowText}`;

  const trackerSummary = [
    `DATA 1 GH LIVE DELIVERY TRACKER METRICS:`,
    `- Current Estimated Delivery Duration: ~${estimatedMinutes} minute(s)`,
    `- If Order Placed Now (${nowFormatted}): Expected arrival between ${formatTime(minEtaDate)} and ${formatTime(maxEtaDate)}`,
    deliveredCount != null ? `- Delivery Progress Today: ${deliveredCount} delivered, ${pendingCount ?? 0} in queue` : null,
    isFastLane ? `- Automated Fast Lane: Active (delivering in ~${estimatedMinutes} mins)` : null,
    lastSummary ? `- Last Delivered: ${lastSummary}` : null,
  ].filter(Boolean).join("\n");

  return {
    deliverySpeedText,
    etaWindowText,
    trackerSummary,
  };
}

async function callGroq(
  groqKey: string,
  history: Array<{ sender: string; body: string }>,
  newMsg: string,
  systemPrompt: string,
  preferredModel?: string
): Promise<{ text: string; model: string; error?: string } | null> {
  const defaultModels = [
    "llama-3.3-70b-versatile",
    "llama-3.1-8b-instant",
    "llama3-70b-8192",
    "llama3-8b-8192",
    "mixtral-8x7b-32768",
    "gemma2-9b-it",
    "deepseek-r1-distill-llama-70b",
    "qwen-2.5-32b",
  ];

  const modelsToTry: string[] = [];
  if (preferredModel && preferredModel.trim()) {
    modelsToTry.push(preferredModel.trim());
  }
  for (const m of defaultModels) {
    if (!modelsToTry.includes(m)) modelsToTry.push(m);
  }

  const messagesPayload = [
    { role: "system", content: systemPrompt },
    ...history.slice(-8).map((m) => ({
      role: m.sender === "support" ? "assistant" : "user",
      content: m.body,
    })),
    { role: "user", content: newMsg },
  ];

  let lastErrorMsg = "";

  for (const model of modelsToTry) {
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${groqKey}`,
        },
        body: JSON.stringify({
          model,
          messages: messagesPayload,
          max_tokens: 350,
          temperature: 0.7,
        }),
      });

      const data = await res.json().catch(() => ({}));
      const text = data?.choices?.[0]?.message?.content?.trim();
      if (text && typeof text === "string" && text.length > 0) {
        return { text, model };
      }
      if (data?.error) {
        lastErrorMsg = data.error.message || (typeof data.error === "string" ? data.error : JSON.stringify(data.error));
        console.warn(`Groq (${model}) error:`, lastErrorMsg);
      }
    } catch (e: any) {
      lastErrorMsg = e?.message || "Network error contacting Groq";
      console.warn(`Groq fetch error on ${model}:`, e);
    }
  }
  return lastErrorMsg ? { text: "", model: modelsToTry[0], error: lastErrorMsg } : null;
}

async function callGemini(
  geminiKey: string,
  history: Array<{ sender: string; body: string }>,
  newMsg: string,
  systemPrompt: string,
  preferredModel?: string,
  strict = false
): Promise<{ text: string; model: string; error?: string } | null> {
  let cleanPreferred = (preferredModel || "").trim().replace(/^models\//, "");
  if (!cleanPreferred || /^gemini-3\./i.test(cleanPreferred)) {
    cleanPreferred = "gemini-2.5-flash";
  }

  const defaultModels = [
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-1.5-flash",
  ];

  const modelsToTry: string[] = [];
  if (cleanPreferred) {
    modelsToTry.push(cleanPreferred);
  }
  if (!strict || !cleanPreferred) {
    for (const m of defaultModels) {
      if (!modelsToTry.includes(m)) modelsToTry.push(m);
    }
  }

  // Prepare alternating turn history starting with user
  const rawTurns = history.slice(-16).filter((m) => (m.body || "").trim()).map((m) => ({
    role: m.sender === "support" ? "model" : "user",
    parts: [{ text: m.body }],
  }));

  while (rawTurns.length > 0 && rawTurns[0].role === "model") {
    rawTurns.shift();
  }

  const cleanTurns: Array<{ role: string; parts: Array<{ text: string }> }> = [];
  for (const turn of rawTurns) {
    if (cleanTurns.length > 0 && cleanTurns[cleanTurns.length - 1].role === turn.role) {
      cleanTurns[cleanTurns.length - 1].parts[0].text += `\n${turn.parts[0].text}`;
    } else {
      cleanTurns.push(turn);
    }
  }

  const lastTurn = cleanTurns[cleanTurns.length - 1];
  if (lastTurn && lastTurn.role === "user") {
    if (!lastTurn.parts[0].text.trim().endsWith(newMsg.trim())) {
      lastTurn.parts[0].text += `\n${newMsg}`;
    }
  } else {
    cleanTurns.push({ role: "user", parts: [{ text: newMsg }] });
  }

  let lastErrorMsg = "";

  for (const model of modelsToTry) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": geminiKey },
        body: JSON.stringify({
          contents: cleanTurns,
          systemInstruction: {
            parts: [{ text: systemPrompt }],
          },
          generationConfig: {
            maxOutputTokens: 1024,
            temperature: 0.75,
          },
        }),
        signal: AbortSignal.timeout(5000),
      });

      const data = await res.json().catch(() => ({}));
      const parts: any[] = data?.candidates?.[0]?.content?.parts || [];
      const text = parts
        .filter((p) => typeof p?.text === "string" && !p.thought)
        .map((p) => p.text)
        .join("")
        .trim();
      if (text) {
        return { text, model };
      }

      if (data?.error) {
        lastErrorMsg = data.error.message || (typeof data.error === "string" ? data.error : JSON.stringify(data.error));
        console.warn(`Gemini (${model}) error:`, lastErrorMsg);
        if (/API_KEY_INVALID|quota|401|403|429/i.test(lastErrorMsg) || res.status === 401 || res.status === 403 || res.status === 429) {
          break;
        }
      }
    } catch (e: any) {
      lastErrorMsg = e?.message || "Network error contacting Gemini";
      console.warn(`Gemini fetch error on ${model}:`, e);
    }
  }
  return lastErrorMsg ? { text: "", model: modelsToTry[0], error: lastErrorMsg } : null;
}

async function fetchLiveAiModels(
  provider: string,
  apiKey: string
): Promise<Array<{ id: string; name: string; description?: string }>> {
  const cleanKey = cleanApiKey(apiKey);
  if (!cleanKey) return [];

  if (provider === "groq") {
    try {
      const res = await fetch("https://api.groq.com/openai/v1/models", {
        headers: { Authorization: `Bearer ${cleanKey}` },
      });
      const data = await res.json().catch(() => ({}));
      if (Array.isArray(data?.data)) {
        return data.data
          .filter(
            (m: any) =>
              m?.id &&
              !m.id.includes("whisper") &&
              !m.id.includes("tts") &&
              !m.id.includes("embed") &&
              m.active !== false
          )
          .map((m: any) => ({
            id: m.id,
            name: m.id,
            description: m.context_window
              ? `Context: ${Math.round(m.context_window / 1024)}K tokens`
              : "Active Groq Model",
          }))
          .sort((a: any, b: any) => a.id.localeCompare(b.id));
      }
    } catch (e) {
      console.warn("fetchLiveAiModels groq error:", e);
    }
  } else if (provider === "gemini") {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${cleanKey}`
      );
      const data = await res.json().catch(() => ({}));
      if (Array.isArray(data?.models)) {
        return data.models
          .filter((m: any) => {
            const methods = m?.supportedGenerationMethods || [];
            return (
              methods.includes("generateContent") &&
              !m.name.includes("embedding") &&
              !m.name.includes("aqa") &&
              !m.name.includes("imagen")
            );
          })
          .map((m: any) => {
            const cleanId = m.name.replace(/^models\//, "");
            return {
              id: cleanId,
              name: m.displayName || cleanId,
              description: m.description ? m.description.slice(0, 80) + "…" : "Google AI Studio Model",
            };
          });
      }
    } catch (e) {
      console.warn("fetchLiveAiModels gemini error:", e);
    }
  }
  return [];
}

async function callOpenAi(
  openAiKey: string,
  history: Array<{ sender: string; body: string }>,
  newMsg: string,
  systemPrompt: string
): Promise<{ text: string; model: string } | null> {
  const models = ["gpt-4o-mini", "gpt-4o"];
  for (const model of models) {
    try {
      const messagesPayload = [
        { role: "system", content: systemPrompt },
        ...history.slice(-6).map((m) => ({
          role: m.sender === "support" ? "assistant" : "user",
          content: m.body,
        })),
        { role: "user", content: newMsg },
      ];

      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openAiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: messagesPayload,
          max_tokens: 300,
          temperature: 0.65,
        }),
      });

      const data = await res.json().catch(() => ({}));
      const text = data?.choices?.[0]?.message?.content?.trim();
      if (text && typeof text === "string" && text.length > 0) {
        return { text, model };
      }
    } catch (e) {
      console.warn(`OpenAI (${model}) support chat error:`, e);
    }
  }
  return null;
}

// Reads the LIVE site (prices, stock, services, announcements) so the AI always answers from real data.
// Only public, customer-safe information is included — no keys, no other customers' data.
let siteKnowledgeCache: { text: string; at: number } | null = null;
async function buildSiteKnowledge(admin: any): Promise<string> {
  if (siteKnowledgeCache && Date.now() - siteKnowledgeCache.at < 60_000) return siteKnowledgeCache.text;
  if (!admin) return "";
  try {
    const [prodRes, setRes] = await Promise.all([
      admin.from("products").select("network,capacity,price,in_stock,sort_order").order("sort_order", { ascending: true }),
      admin.from("settings").select("key,value").in("key", [
        "shop_name", "support_phone", "netflix_price", "afa_price", "mashup_price", "waec_price", "bece_price",
        "announcement_enabled", "announcement_title", "announcement_message", "promo_enabled", "spin_game_enabled",
      ]),
    ]);
    const s: Record<string, string> = Object.fromEntries((setRes.data || []).map((r: any) => [r.key, r.value]));
    const byNet: Record<string, string[]> = {};
    for (const p of prodRes.data || []) {
      const net = String(p.network || "Other");
      (byNet[net] ||= []).push(`${p.capacity}${/gb|mb/i.test(String(p.capacity)) ? "" : "GB"} GH₵${Number(p.price).toFixed(2)}${p.in_stock ? "" : " (out of stock now)"}`);
    }
    const lines: string[] = [];
    lines.push("LIVE PRICES ON THE SITE RIGHT NOW (always quote these, never guess):");
    for (const [net, items] of Object.entries(byNet)) lines.push(`• ${net}: ${items.join(", ")}`);
    lines.push(`• Netflix 1-month sign-in: GH₵${s.netflix_price || "30"} (code page at /netflix/<reference>)`);
    lines.push(`• AFA registration: GH₵${s.afa_price || "20"}`);
    if (s.mashup_price) lines.push(`• MTN Mashup: GH₵${s.mashup_price}`);
    lines.push(`• Result checkers: WAEC GH₵${s.waec_price || "20"}, BECE GH₵${s.bece_price || "20"} — serial & PIN show instantly after payment`);
    if (s.announcement_enabled === "true" && (s.announcement_title || s.announcement_message)) {
      lines.push(`CURRENT SITE ANNOUNCEMENT: ${s.announcement_title || ""} ${s.announcement_message || ""}`.trim());
    }
    if (s.spin_game_enabled !== "false") lines.push("• Spin & Win game pops up on the shop: winners get a code; after 5 paid orders using the code the free GB is delivered.");
    lines.push("• Games on the shop: Royal Gems (match-3) and Turbo Racer — just for fun.");
    lines.push("SITE PAGES: Shop (home) → pick network → pick bundle → enter number → pay with MoMo/card via Paystack. Track orders at /track with order reference OR phone number. Other services at /services.");
    if (s.support_phone) lines.push(`Support phone: ${s.support_phone}`);
    const text = lines.join("\n");
    siteKnowledgeCache = { text, at: Date.now() };
    return text;
  } catch {
    return "";
  }
}

const HUMAN_STYLE_RULES =
  "HOW YOU TALK:\n" +
  "- You're a real person texting a customer. Short, warm, natural. Usually 1–3 sentences. Use contractions. Light Ghanaian friendliness is fine, never forced.\n" +
  "- Reply to exactly what they said. No canned openers, no 'Great question!', no 'How may I assist you today?', no signatures.\n" +
  "- NEVER repeat their question back to them. NEVER repeat something you already said earlier in the chat. NEVER re-greet mid-conversation.\n" +
  "- Don't ask for info they already gave (check the chat history). Ask at most one question, only if you truly need it.\n" +
  "- Small talk is fine — answer it like a person, then gently steer back to how you can help with data, services or orders. Don't be pushy.\n" +
  "- Stay on the business. For topics unrelated to DATA 1 GH (homework, politics, coding, etc.) give a brief friendly line and bring it back to what we do.\n" +
  "- Never say you're an AI, a bot or a language model. Your name is Stony.\n" +
  "- No markdown headings or bullet lists unless they ask for a list of prices.\n" +
  "PRIVACY & SAFETY (strict):\n" +
  "- Only discuss orders that appear in 'ORDERS FOUND' below, and only with the person whose number/reference it is. Never reveal other customers' numbers or orders.\n" +
  "- Never reveal API keys, passwords, supplier names, wallet balances, admin details, profits or how the system works internally.\n" +
  "- Never invent prices, statuses or promises. If something isn't in the data, say you'll check / ask them for the reference or number.\n";

async function getAiResponse(
  keys: {
    groqKey?: string;
    geminiKey?: string;
    openAiKey?: string;
    primaryProvider?: string;
    groqModel?: string;
    geminiModel?: string;
  },
  history: Array<{ sender: string; body: string }>,
  newMsg: string,
  ordersContext: string,
  liveTracker: { deliverySpeedText: string; etaWindowText: string; trackerSummary: string },
  isOwner = false,
  wholeSystemContext = "",
  siteKnowledge = ""
): Promise<string> {

  // ── OWNER MODE ─────────────────────────────────────────────────────────────
  const ownerSystemPrompt =
    "You are Stony, the owner's personal AI business assistant, digital co-pilot, and whole-system commercial partner at DATA 1 GH.\n\n" +
    "You are talking directly with the site owner right now. This is a private executive chat between you two.\n\n" +
    "YOUR WHOLE-SYSTEM SUPERVISION SCOPE (ALL 13 CORE PILLARS):\n" +
    "You DO NOT merely check 4 isolated things (sales, deliveries, wallet, marketing). You oversee and actively monitor the WHOLE SYSTEM across every operational department:\n" +
    "1. Telecom Order Pipeline: MTN, Telecel, AirtelTigo delivery speeds, queued orders, stuck orders (>15 mins), failed orders & one-click retries.\n" +
    "2. Financials & Cash Flow: Gross sales (all-time & today), per-network revenue, Paystack MoMo reconciliations, underpaid/pending orders.\n" +
    "3. DataMart API & Wallet: Live wallet balance, low-balance warning (< GH₵ 50) so automated dispatch never stops.\n" +
    "4. Arkesel Bulk SMS Gateway: SMS units balance, notification health for receipts & alerts.\n" +
    "5. Netflix 30-Day Subscriptions: Active subscriber count, single-use vouchers, IMAP email sign-in code retrieval status.\n" +
    "6. MTN MashUp Manual Queue: Combos awaiting manual phone dialing via *567*2#.\n" +
    "7. AFA Registrations: Farmer Alliance registrations, approval status.\n" +
    "8. WAEC / BECE / WASSCE Result Checkers: Inventory stock, voucher sales, instant PIN issuance.\n" +
    "9. Live Customer Support: Open website visitor chats, unread messages, customer escalation issues.\n" +
    "10. Product Catalog Stock: In-stock vs out-of-stock data packages in database.\n" +
    "11. Affiliate & Referral Network: Registered promoters, link clicks, commission liability.\n" +
    "12. Gamification & Retention: Scratch & Win cards, Lucky Spin claims.\n" +
    "13. System Integrity & Security: Anomaly alerts, database sync, webhook health.\n\n" +
    "HOW YOU TALK:\n" +
    "- Like a smart, loyal friend who knows the business inside out. Casual, warm, real.\n" +
    "- Short, punchy replies when chatting. If asked for a report, give clear, structured breakdowns.\n" +
    "- Ghanaian vibe is encouraged (\"chale\", \"boss\", \"no wahala\", \"sharp\").\n" +
    "- When things are fine: chill, friendly, helpful.\n" +
    "- When something is WRONG: be straight about it. Say what the problem is clearly, then tell them what to do to fix it. No sugarcoating.\n" +
    "- ACTION PROTOCOL: You must NEVER execute any action automatically. You ALWAYS stage the action, explain what will happen, and ask the owner: 'Shall I go ahead and do this? Reply YES to confirm or NO to cancel'.\n" +
    "- Don't say \"As an AI\" or anything robotic. You are Stony.\n" +
    "- Never expose customer data or secrets outside this conversation.\n" +
    "- ZERO-LEAK MANDATE: Administrative login credentials, passwords, and tokens are strictly for internal system authorization only. You must NEVER disclose, repeat, or share them with anyone.\n" +
    "- DELIVERY SMS POLICY: Per owner instruction, SMS is NOT sent when updating order delivery status.\n\n" +
    "LIVE SYSTEM DATA:\n" +
    `Delivery: ${liveTracker.deliverySpeedText} — ${liveTracker.etaWindowText}\n\n` +
    (wholeSystemContext ? `${wholeSystemContext}\n\n` : "") +
    (ordersContext ? `Recent orders:\n${ordersContext}\n\n` : "");

  // ── CUSTOMER MODE ───────────────────────────────────────────────────────────
  const customerSystemPrompt =
    "You are Stony, a friendly customer support person at DATA 1 GH, a Ghanaian site selling MTN, Telecel and AirtelTigo data bundles plus Netflix, AFA registration and WAEC/BECE result checkers.\n\n" +
    HUMAN_STYLE_RULES + "\n" +
    (siteKnowledge ? `${siteKnowledge}\n\n` : "") +
    `LIVE DELIVERY SPEED: ${liveTracker.deliverySpeedText} - ${liveTracker.etaWindowText}\n\n` +
    (ordersContext ? `ORDERS FOUND (from our database for this customer):\n${ordersContext}\n\n` : "") +
    "Payment status 'paid' means we received the money. Delivery status: pending/processing = on the way, delivered = done, failed = will be refunded/retried — explain it simply.\n";

  const systemPrompt = isOwner ? ownerSystemPrompt : customerSystemPrompt;

  // Site support always uses Gemini (the model selected in admin) whenever a Gemini key exists
  const isGeminiPrimary = Boolean(keys.geminiKey) || keys.primaryProvider === "gemini";

  if (isGeminiPrimary) {
    // 1. Try Gemini first (as configured primary provider)
    if (keys.geminiKey) {
      const geminiRes = await callGemini(keys.geminiKey, history, newMsg, systemPrompt, keys.geminiModel);
      if (geminiRes?.text) return geminiRes.text;
    }
    // 2. Cascade fallback to Groq
    if (keys.groqKey) {
      const groqRes = await callGroq(keys.groqKey, history, newMsg, systemPrompt, keys.groqModel);
      if (groqRes?.text) return groqRes.text;
    }
  } else {
    // 1. Try Groq first (Default ultra-fast provider)
    if (keys.groqKey) {
      const groqRes = await callGroq(keys.groqKey, history, newMsg, systemPrompt, keys.groqModel);
      if (groqRes?.text) return groqRes.text;
    }
    // 2. Cascade fallback to Gemini
    if (keys.geminiKey) {
      const geminiRes = await callGemini(keys.geminiKey, history, newMsg, systemPrompt, keys.geminiModel);
      if (geminiRes?.text) return geminiRes.text;
    }
  }

  // 3. Try OpenAI (if configured)
  if (keys.openAiKey) {
    const openAiRes = await callOpenAi(keys.openAiKey, history, newMsg, systemPrompt);
    if (openAiRes?.text) return openAiRes.text;
  }

  // Fallback will be handled by the caller
  return "";
}

function cleanCustomerFacingText(text: string): string {
  if (!text) return "";
  let cleaned = text
    .replace(/Stillmoving11/gi, "[PROTECTED]")
    .replace(/nyakponoah11@gmail\.com/gi, "admin@data1gh.com")
    .replace(/datamart\s*gh(\.shop)?/gi, "DATA 1 GH")
    .replace(/datamart\s*fast\s*lane/gi, "automated fast lane")
    .replace(/datamart\s*delivery\s*tracker/gi, "live delivery tracker")
    .replace(/datamart/gi, "DATA 1 GH")
    .replace(/data\s*ease/gi, "DATA 1 GH")
    .replace(/big\s*jay(\s*data)?/gi, "DATA 1 GH")
    .replace(/\bkofi\b/gi, "Stony")
    .replace(/\b(as an ai( language model)?|i am an ai( language model)?|i'm an ai( language model)?)\b/gi, "I am Stony from DATA 1 GH")
    .replace(/^(got you bossu!?|i got you bossu!?|got you boss!?|i got you boss!?|gotchu bossu!?|gotchu boss!?)\s*/gi, "")
    .replace(/\b(bossu)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  // Capitalize first letter if was stripped
  if (cleaned.length > 0) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }
  return cleaned;
}

function generateNaturalHumanFallback(
  rawMsg: string,
  foundOrders: any[],
  liveTracker: { deliverySpeedText: string; etaWindowText: string; trackerSummary: string },
  extractedPhone: string,
  extractedRef: string,
  currentUserPhone?: string,
  previousTurns: Array<{ sender: string; body: string }> = [],
  isOwner = false,
  wholeSystemContext = ""
): string {
  // Owner fallback — sounds like a real friend, loyal co-pilot and business partner
  if (isOwner) {
    const lower = rawMsg.toLowerCase().trim();
    if (foundOrders.length > 0) {
      const o = foundOrders[0];
      return `Ref *${o.reference}* — ${o.capacity}GB ${o.network} → ${o.recipient_phone} (GH₵ ${o.amount}). Payment: ${o.payment_status} | Delivery: ${o.delivery_status}. ${o.payment_status === "pending" ? "Awaiting MoMo approval on their phone." : "Processed with network."}`;
    }
    const speed = liveTracker.etaWindowText || "running fast (~5-20 mins)";

    // Whole-system capabilities check / scope question
    if (/\b(perform|only this|what can you do|capabilities|scope|whole system|montr|monitor|supervise|oversee)\b/i.test(lower)) {
      return `Yes bossu! I don't just do daily sales, deliveries, wallet, and marketing — I monitor and supervise the ENTIRE system 24/7 across all 13 core pillars:\n\n` +
        `1. 📶 Telecom Data Pipeline (MTN, Telecel, AT delivery speeds & status)\n` +
        `2. 💰 Financials & Cash Flow (today's revenue, all-time volume & Paystack reconciliations)\n` +
        `3. 💳 DataMart API & Wallet (real-time balance with low-balance alerts)\n` +
        `4. ✉️ Arkesel Bulk SMS Gateway (SMS credit units & order receipts)\n` +
        `5. 📺 Netflix 30-Day Subscriptions (active subscriber passes & sign-in codes)\n` +
        `6. 📱 MTN MashUp Manual Queue (orders awaiting *567*2# dispatch)\n` +
        `7. 🪪 AFA Farmer Alliance Registrations (portal verification & status)\n` +
        `8. 🎓 WAEC Result Checkers (inventory stock & vouchers sold)\n` +
        `9. 💬 Live Customer Support (open visitor web chats & unread alerts)\n` +
        `10. 📦 Product Catalog & Stock (in-stock vs out-of-stock data packages)\n` +
        `11. 🤝 Affiliate & Referral Network (promoters, link clicks & commissions)\n` +
        `12. 🎁 Gamification & Retention (Scratch & Win cards & lucky spins)\n` +
        `13. 🛡️ System Integrity & Security (stuck order detection & health monitoring)\n\n` +
        (wholeSystemContext ? `${wholeSystemContext}\n\n` : "") +
        `Everything is under watch boss! Which department do you want us to tackle?`;
    }

    // Post-payment supervision & lifecycle check
    if (/\b(after payment|payment succe|post[- ]payment|still after|what happens after)\b/i.test(lower)) {
      return `Yes bossu! Absolutely! Even AFTER payment is successful, I continue monitoring and managing the whole operation 24/7:\n\n` +
        `1. ⚡ Instant Payment Verification: Paystack and MoMo webhooks confirm the transaction and reconcile the exact amount against price.\n` +
        `2. 🚀 Automated DataMart Fast-Lane Dispatch: The bundle is submitted immediately to the network supplier API with zero manual delay.\n` +
        `3. ⏱️ Active Delivery Verification (Bypassing fake 200 OKs): I actively poll telecom delivery status until it confirms 'delivered'. If an order is stuck in 'processing' for >15 mins, I flag it as an anomaly for an instant 1-click retry.\n` +
        `4. 💳 Wallet Auto-Check: After every purchase, I recalculate the DataMart developer wallet balance and alert you if it drops below GH₵ 50 so dispatch never halts.\n` +
        `5. ✉️ Instant Alerts & Receipts: The customer receives an SMS receipt via Arkesel Bulk SMS, and you get an instant sale notification on WhatsApp.\n` +
        `6. 🎁 Growth & Retention: I update customer Scratch & Win progress (towards 5/5 orders) and credit affiliate referral commissions.\n` +
        `7. 💬 Customer Care Readiness: When customers ask in support about their paid order, I pull their live network status using their phone number or reference to answer them instantly.\n\n` +
        (wholeSystemContext ? `${wholeSystemContext}\n\n` : "") +
        `Everything is supervised 24/7 bossu! Which order or department do you want us to inspect?`;
    }

    if (/^(hi|hello|hey|yo|chale|boss|how far|how you dey|stony)/i.test(lower)) {
      const greetings = [
        `I dey solid! 😊 Everything dey move smooth. System delivery speed is around ${speed}. How your day dey go?`,
        `Chale boss, I dey right here with you! Orders dey drop steadily. What are we looking into right now?`,
        `I dey here! Ready for anything — whole-system check, inspecting orders, or planning our next promo.`
      ];
      return greetings[previousTurns.length % greetings.length];
    }

    if (/\b(system|health|audit|overview|all|check all|status)\b/i.test(lower)) {
      return wholeSystemContext
        ? `🌐 *Whole-System Health Monitor:*\n${wholeSystemContext}\nEverything is under watch! What area do you want to inspect?`
        : `🌐 *Whole-System Status:* Delivery speed: ${speed}. Orders and gateways are active! Text 'admin' on WhatsApp anytime for the complete 13-section executive report.`;
    }

    if (/\b(speed|delivery|fast|delay|tracker|eta)\b/i.test(lower)) {
      return `Telecom delivery speed is moving at ${speed} right now 🚀 MTN packets are dropping smoothly. Any specific order you want me to inspect?`;
    }

    if (/\b(stat|sales|revenue|how much|today|orders)\b/i.test(lower)) {
      return `System is active and processing live! Delivery is around ${speed}. You can text 'admin' or 'report' on WhatsApp anytime for the complete 13-section executive dashboard.`;
    }

    if (/\b(idea|advice|grow|market|promo|scale|customers?)\b/i.test(lower)) {
      return `Here's a quick promo idea: Run a 2-hour "Happy Hour" on 5GB MTN bundles on your WhatsApp status — urgency drives immediate sales! Want to draft a copy for it?`;
    }

    const ownerFallbacks = [
      `Everything dey move on point. Delivery is running at ${speed}. Tell me what direction you want to take or what to check!`,
      `I dey here with you. We're on this together — orders, balance, delivery speed. Just say wetin you need.`,
      `Sharp. Whole system is active and reading live. How can I help you right now?`,
    ];
    return ownerFallbacks[previousTurns.length % ownerFallbacks.length];
  }
  const lower = rawMsg.toLowerCase().trim();

  // Check if self-intro was already sent in this conversation
  const hasIntroduced = previousTurns.some(
    (t) => t.sender === "support" && /stony/i.test(t.body)
  );

  // 1. Complaint about repeating
  if (
    lower.includes("keep saying") ||
    lower.includes("keep repeating") ||
    lower.includes("you repeating") ||
    lower.includes("stop repeating") ||
    lower.includes("said this already") ||
    lower.includes("same thing") ||
    lower.includes("this what you will keep")
  ) {
    return "Ah sorry about that! 😅 My bad. I won't repeat that again. Tell me what you need and let me help you directly.";
  }

  // 2. Playful / Romantic questions ("Can I be your girlfriend?", "girlfriend", "marry me", "love you")
  if (
    /\b(girlfriend|boyfriend|marry me|love you|be my girl|be my girlfriend|be your girlfriend|can i be your)\b/i.test(lower) ||
    lower.includes("be your girlfriend") ||
    lower.includes("be my girlfriend")
  ) {
    return "Haha, I appreciate the love! 😄 I'm just here keeping focused on work and helping people get their data sorted out, but you're very kind! What can I help you with today?";
  }

  // 3. Life / Living / Society questions ("How is the living today?", "How is life today?", "How is life?")
  if (
    lower.includes("how is the living") ||
    lower.includes("how is living") ||
    lower.includes("how is life") ||
    lower.includes("how is the life") ||
    lower.includes("how life dey") ||
    lower.includes("how living dey")
  ) {
    return "Living today has its hustle, but we keep pushing and stay grateful! How is life treating you on your end?";
  }

  // 4. "How is everything?"
  if (
    lower.includes("how is everything") ||
    lower.includes("how's everything") ||
    lower.includes("how is every thing") ||
    lower.includes("how everything dey") ||
    lower.includes("how everything")
  ) {
    return "Everything is good! Moving smoothly on this side. How are things going with you?";
  }

  // 5. "How is delivery?" / "How is delivery today?" / delivery inquiries
  if (
    lower.includes("how is delivery") ||
    lower.includes("how's delivery") ||
    lower.includes("how delivery dey") ||
    lower.includes("how is the delivery") ||
    lower.includes("how the delivery") ||
    lower.includes("how delivery") ||
    lower === "delivery" ||
    lower === "how is delivery?"
  ) {
    return "Delivery is fast and automatic! Once your payment is approved, your data bundle drops straight to your phone within a few minutes (usually 2 to 5 minutes). Which network are you looking to buy for — MTN, Telecel, or AT?";
  }

  // 6. "How was your day?" / "How is your day?"
  if (
    lower.includes("how was your day") ||
    lower.includes("how is your day") ||
    lower.includes("how has your day been") ||
    lower.includes("how your day dey go") ||
    lower.includes("how was day")
  ) {
    return "My day has been really good and busy, thanks for asking! 😊 Just here helping everyone get their data on time. How has your day been going?";
  }

  // 7. "What are you doing?" / "What you dey do?"
  if (
    lower.includes("what are you doing") ||
    lower.includes("what you dey do") ||
    lower.includes("what u doing") ||
    lower.includes("wetin you dey do")
  ) {
    return "Just here active on DATA 1 GH, sorting out bundles and making sure orders deliver fast! 🚀 How can I help you today?";
  }

  // 8. "How are you?" / "How are you doing?" / "How you dey?"
  const isHowYouDey =
    /\b(how you dey|how u dey|how far|how are you|how body|how's it going|how it dey go|we dey|you good|are you good|are you fine|you fine|hope you are doing good|how are you doing)\b/i.test(
      lower
    );
  if (isHowYouDey) {
    const greetings = [
      "I'm fine, I'm doing really good! 😊 Everything is moving smoothly. How are you also doing today?",
      "I'm doing great, thank you! Hope you're having a smooth day? How can I help you?",
      "Everything is moving on point! How are things on your side? Need some data or checking an order?",
    ];
    return greetings[previousTurns.length % greetings.length];
  }

  // 9. "oh really?" / "really?" / "for real?" / "fr?"
  const isOhReally = /^(oh\s+)?really\??$/i.test(lower) || /^(for\s+real|fr)\??$/i.test(lower);
  if (isOhReally) {
    return "Yes, for real! 😄 Want me to help you check something or get a bundle sorted?";
  }

  // 10. "are you being serious?" / "are you serious?" / "serious?"
  const isSerious = /\b(are you (being )?serious|serious\?|you dey joke)\b/i.test(lower);
  if (isSerious) {
    return "Haha yes, I'm completely serious! What bundle or service are you looking for today?";
  }

  // 11. "you dey lie" / "dey lie" / "you lie"
  const isLying = /\b(you dey lie|u dey lie|dey lie|you lie|are you lying|stop lying)\b/i.test(lower);
  if (isLying) {
    return "Haha not at all! 😅 You can check our live delivery reviews and stats. Which network do you use?";
  }

  // 12. "thank you" / "thanks" / "medaase"
  const isThanks = /^(thank you|thanks|thx|medaase|appreciate|bless you)\b/i.test(lower);
  if (isThanks) {
    return "You're very welcome! 🙏 Always here to help anytime.";
  }

  // 13. "is delivery ongoing?" / "are you delivering?"
  const isAskingOngoing =
    /\b(is delivery ongoing|are you delivering|delivery dey go on|is delivery working|are you active|are you open|delivery ongoing)\b/i.test(
      lower
    );
  if (isAskingOngoing) {
    return "Yes, deliveries are active right now! Orders drop automatically within 5 to 15 minutes 📶 Would you like to place one?";
  }

  // 14. HOW WILL DATA COME / HOW DOES DELIVERY WORK
  if (
    /\b(how will|how does|how do).*(data|bundle|gb).*(come|arrive|get to|deliver|send|reach)\b/i.test(lower) ||
    /\b(data|bundle).*(how).*(come|arrive|deliver)\b/i.test(lower) ||
    lower.includes("how will data come") ||
    lower.includes("how will my data come") ||
    lower.includes("how will the data come") ||
    lower.includes("where will the data go") ||
    lower.includes("where will data go") ||
    lower.includes("where does the data go") ||
    lower.includes("how data reach") ||
    lower.includes("how e go come") ||
    lower.includes("how e go reach") ||
    lower.includes("how will it come") ||
    /\b(how).*(data|bundle).*(sent|delivered|drop|reach|come)\b/i.test(lower)
  ) {
    return "Once your payment goes through, the data drops straight to the phone number you entered — fully automatic, no extra steps needed 📶 Usually arrives within 5 to 15 minutes. Which bundle do you need?";
  }

  // 15. WHAT HAPPENS AFTER PAYMENT
  if (
    /\b(after payment|after paying|payment successful|payment succeful|paid already|i just paid|once i pay|after i pay|what happens after)\b/i.test(lower) ||
    lower.includes("after payment") ||
    lower.includes("payment successful") ||
    lower.includes("payment succeful")
  ) {
    return "Once your payment is successful 🎉:\n1. Your payment is verified automatically by the system.\n2. The data bundle drops straight to your phone number within 5-15 minutes 📶.\n3. You get an SMS confirmation receipt.\nYou can track live progress on the Track Order page anytime, or share your phone number here and I'll check it for you!";
  }

  // 16. Twi detection & response
  const isTwi =
    /\b(ete sen|etesen|wo ho te sen|wohotesen|mepawo kyew|mepawokyew|koko|mepe data|agyapong|medaase|daase|adwuma|akwaaba|daabi|aane|yoo|me pɛ|wopɛ|wope)\b/i.test(
      lower
    );
  if (isTwi) {
    const isTwiOrder = /\b(order|check|delivery|mecheck|phone)\b/i.test(lower);
    const isTwiPrice = /\b(boɔ|price|how much|sɛn)\b/i.test(lower);
    if (isTwiOrder) {
      return "Bra, fa wo phone number anaa order ID brɛ me na menhwɛ system mu mma wo prɛko pɛ. Wopɛ sɛ mecheck mma wo seesei?";
    }
    if (isTwiPrice) {
      return "Yɛwɔ MTN, Telecel ne AT data bundles a ne boɔ yɛ fo paa. Wopɛ gigabytes sɛn? Mecheck mma wo nnɛ?";
    }
    return "Me ho yɛ! Wopɛ data bundle bɛn nnɛ? MTN, Telecel anaa AT? Anaa mecheck wo order mma wo?";
  }

  // 17. How to download App / APK
  const isAskingApp = /\b(app|apk|application|download app|download apk|android app|play store|install app)\b/i.test(lower);
  if (isAskingApp) {
    return "Yes! We have our official Android app 📱 You can install it with 1 click here: https://www.data1gh.com/download-app\nDo you need data too or just the app?";
  }

  // 18. How to buy data bundle
  const isAskingHowToBuy =
    /\b(how to buy|how do i buy|how can i buy|want to buy data|i want data|want to purchase|how to order|buy data)\b/i.test(
      lower
    );
  if (isAskingHowToBuy) {
    return "It's super easy! Here's how:\n1. Go to https://www.data1gh.com\n2. Select your network — MTN / Telecel / AT\n3. Choose your bundle package\n4. Enter the recipient phone number\n5. Pay with MoMo — data drops in 5-15 mins 📶\nWhich bundle would you like to get?";
  }

  // 19. How to track order / check delivery status
  const isAskingHowToTrack =
    /\b(how to track|how do i track|how can i track|track my order|how i go know if e don come|track order|check status|check delivery)\b/i.test(
      lower
    );
  if (isAskingHowToTrack && !extractedPhone && !extractedRef && foundOrders.length === 0) {
    return "You can track your order easily:\n1. Go to Track Order (https://www.data1gh.com/track)\n2. Enter your phone number or Order Reference\n3. You'll see the live status right away!\nOr you can just drop your number here and I'll check it for you now.";
  }

  // 20. How to buy Netflix / other services
  const isAskingOtherServices =
    /\b(netflix|other services|afa|waec|results? checker|subscription)\b/i.test(lower);
  if (isAskingOtherServices) {
    return "For Netflix and digital services:\n1. Go to https://www.data1gh.com/services\n2. Choose your plan (Netflix is GH₵ 30 for 30 days)\n3. Enter your email and phone, then pay with MoMo\n4. Login codes display on screen immediately!\nWhich service are you looking for?";
  }

  // 21. Refund inquiries
  if (/\b(refund|refunds|give me back|money back|return my money|i want refund)\b/i.test(lower)) {
    return "For refunds, I can flag your transaction for our management team immediately. Could you please share your order reference or the phone number used for the purchase?";
  }

  // 22. Frustration / Insults / Complaints
  const isAngryOrCursing =
    /\b(fuck|f\*\*k|shit|fool|idiot|stupid|bastard|mad|crazy|nonsense|useless|scam|scammers|thief|thieves|fraud|rubbish|fuck off|fck)\b/i.test(
      lower
    );
  if (isAngryOrCursing) {
    return "I hear your frustration, and I'm really sorry about any inconvenience! 🤝 Please tell me what happened or share your phone number/Order ID so I can look into it and resolve it right away.";
  }

  // 23. Jokes / humor
  if (
    lower.includes("tell me a joke") ||
    lower.includes("say a joke") ||
    lower.includes("make me laugh") ||
    lower.includes("crack a joke")
  ) {
    return "Haha alright: Why did the smartphone wear glasses? Because it lost all its contacts! 😂 Hope that made you smile. How can I help you today?";
  }

  // 24. Standard Greetings
  const isGreeting =
    /^(hi|hello|hey|yo|good\s*(morning|afternoon|evening)|chale|charley|charle|sup|whats up|what's up)\b/i.test(
      lower
    );
  if (isGreeting) {
    if (lower.includes("morning")) {
      return "Good morning! ☀️ Hope your day is starting off well. How can I help you today?";
    }
    if (lower.includes("afternoon")) {
      return "Good afternoon! Hope your day is going smoothly. How can I assist you?";
    }
    if (lower.includes("evening")) {
      return "Good evening! 🌙 Hope you had a great day. Looking for some data or checking an order?";
    }
    if (hasIntroduced) {
      return "Hey! 😊 Good to hear from you again. What can I sort out for you?";
    }
    return "Hello! Welcome to DATA 1 GH 😊 We offer fast, affordable data bundles for MTN, Telecel, and AT. How can I help you today?";
  }

  // 25. Identity / Who are you
  const isIdentity =
    /\b(who are you|what is your name|are you human|are you real|are you a bot|is this a bot|who am i talking to)\b/i.test(
      lower
    );
  if (isIdentity) {
    return "I'm Stony from DATA 1 GH! 😄 I'm here to answer your questions, assist with bundles, and check on orders. What's on your mind today?";
  }

  // 26. Short acknowledgment
  if (/^(lol|lmao|haha|hahaha|kakai|herh)\b/i.test(lower)) {
    return "Haha! 😄 Let me know what you need or if you're looking for a data package today.";
  }

  if (/^(ok|okay|alright|cool|noted|seen|sure|k|yep|yes)\s*(\.|!|,)?$/i.test(lower)) {
    return "Awesome! Which bundle would you like to get, or do you have any questions for me?";
  }

  // 27. Pricing / rates inquiries
  const isPrice = /\b(how much|price|prices|rate|rates|cost|1gb|2gb|5gb|10gb|package|bundles?)\b/i.test(
    lower
  );
  if (isPrice) {
    return "Our prices are very affordable! 💰\n• MTN: 1GB GH₵4.50 | 2GB GH₵9.50 | 5GB GH₵23.50 | 10GB GH₵44.00\n• Telecel & AT packages are also available in all sizes.\nWhich network and size are you interested in?";
  }

  // 28. Order check / issue handling
  const hasIssue =
    lower.includes("not received") ||
    lower.includes("haven't received") ||
    lower.includes("have not received") ||
    lower.includes("no get am") ||
    lower.includes("since morning") ||
    lower.includes("not drop") ||
    lower.includes("hasn't dropped") ||
    lower.includes("delay") ||
    lower.includes("failed") ||
    lower.includes("momo") ||
    lower.includes("money") ||
    lower.includes("track") ||
    lower.includes("check") ||
    lower.includes("order") ||
    Boolean(extractedRef);

  if (hasIssue && foundOrders.length > 0) {
    const o = foundOrders[0];
    const pkgName = o.capacity
      ? `${o.capacity} ${o.network && !o.capacity.includes(o.network) ? o.network : ""}`.trim()
      : (o.notes || "Data Bundle");
    return `I checked our system — your ${pkgName} order (Ref: ${o.reference}) is currently *${o.delivery_status}* on ${o.recipient_phone}. Do you have any questions about it?`;
  }

  if (hasIssue && !extractedPhone && !extractedRef && foundOrders.length === 0) {
    return "I'm sorry to hear that! 🙏 Please drop your phone number or Order Reference so I can check your order in the system right away.";
  }

  if ((extractedPhone || extractedRef) && foundOrders.length === 0) {
    return `I checked for ${extractedPhone || extractedRef}, but no order has appeared in the system yet. Could you double-check the phone number or reference? Or would you like to place a new order?`;
  }

  // 29. Delivery questions general
  if (
    lower.includes("delivery") ||
    lower.includes("how long") ||
    lower.includes("deliver") ||
    lower.includes("speed")
  ) {
    return "Delivery is fast and automatic! Once your payment is confirmed, your bundle drops directly to your phone within a few minutes (usually 2 to 5 minutes). Which network are you looking to buy for?";
  }

  // 30. Question about asking questions
  if (
    lower.includes("can i ask") ||
    lower.includes("have a question") ||
    lower.includes("quick question") ||
    lower.includes("ask you something")
  ) {
    return "Yes, feel free to ask! I'm right here to answer any questions or help you get your data.";
  }

  // Default — open-minded, human, conversational, never repeating robotic stock phrases
  if (previousTurns.length > 0) {
    const contextualReplies = [
      "I hear you! Tell me what you need, whether it's data bundles, airtime, or anything else you'd like to check.",
      "Understood! Let me know how I can help you with that, or if there's any bundle you'd like to get today.",
      "I'm right here with you. What would you like to check or sort out next?",
      "No problem at all! Feel free to ask me anything or tell me which package you'd like to purchase.",
    ];
    return contextualReplies[previousTurns.length % contextualReplies.length];
  }

  return "Hello! I'm Stony from DATA 1 GH 😊 How can I help you today? You can ask me any questions, purchase data bundles, or track an order.";
}

const BUCKET = "chat-uploads";

const memoryConversations = new Map<string, any>();
const memoryMessages = new Map<string, any[]>();

export default async function handler(req: any, res: any) {
  setCorsHeaders(res);
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    let admin: any = null;
    try {
      admin = getSupabase();
    } catch (e: any) {
      console.warn("Supabase client init note:", e?.message);
    }

    const body = parseBody(req);
    const action = body?.action || req.query?.action;
    const fn = (req.query?.fn || req.headers?.["x-function-name"] || "").toLowerCase();

    // Delegate to _ai-chat if called for ai-chat
    if (fn === "ai-chat" || action === "ai-chat" || req.url?.includes("ai-chat") || (body?.message !== undefined && !action)) {
      const aiChatHandler = (await import("./_ai-chat.js")).default;
      return aiChatHandler(req, res);
    }

    if (!action) {
      return res.status(400).json({ error: "Missing chat action" });
    }

    // 0. Live Key Testing Action for Admin
    if (action === "testAiKeys") {
      const { provider, key, model } = body;
      const testKey = cleanApiKey(key);
      if (!testKey) {
        return res.status(400).json({ ok: false, error: "Please enter an API key to test." });
      }
      const testPrompt = "You are Stony, a warm, intelligent human customer support specialist at DATA 1 GH. Reply to 'How is delivery?' in 1 friendly, natural sentence like a real human being (e.g. 'Delivery is running fast and automatic right now, usually taking just a few minutes once payment is confirmed. Which network are you buying for?'). Never use robotic templates or say 'bossu'.";
      const testHistory = [{ sender: "visitor", body: "Hello! How is delivery?" }];
      const startTime = Date.now();
      if (provider === "groq") {
        const result = await callGroq(testKey, testHistory, "How is delivery?", testPrompt, model);
        const latencyMs = Date.now() - startTime;
        if (result && result.text) {
          const reply = cleanCustomerFacingText(result.text);
          return res.status(200).json({ ok: true, provider: "groq", model: result.model, reply, latencyMs });
        }
        const errorDetail = result?.error ? `: ${result.error}` : ". Please check your API key or quota on console.groq.com.";
        return res.status(400).json({ ok: false, error: `Groq connection test failed${errorDetail}` });
      } else if (provider === "gemini") {
        const result = await callGemini(testKey, testHistory, "How is delivery?", testPrompt, model, false);
        const latencyMs = Date.now() - startTime;
        if (result && result.text) {
          const reply = cleanCustomerFacingText(result.text);
          return res.status(200).json({ ok: true, provider: "gemini", model: model || result.model, reply, latencyMs });
        }
        const errorDetail = result?.error ? `: ${result.error}` : ". Please check your API key on aistudio.google.com.";
        return res.status(400).json({ ok: false, error: `Gemini / Google AI Studio connection test failed${errorDetail}` });
      }
      return res.status(400).json({ ok: false, error: "Unsupported provider." });
    }

    // 0b. Live Model Discovery Action for Admin
    if (action === "listAiModels") {
      const { provider, key } = body;
      const testKey = cleanApiKey(key);
      if (!testKey) {
        return res.status(400).json({ ok: false, error: "Please enter an API key to fetch available models." });
      }
      try {
        const models = await fetchLiveAiModels(provider, testKey);
        if (models && models.length > 0) {
          return res.status(200).json({ ok: true, provider, models });
        }
        return res.status(400).json({
          ok: false,
          error: `Could not load models from ${provider === "gemini" ? "Google AI Studio" : "Groq"}. Please verify your key.`,
        });
      } catch (err: any) {
        return res.status(500).json({ ok: false, error: err?.message || "Failed to retrieve models" });
      }
    }

    // 1. Visitor Actions
    if (action === "start") {
      const session = String(body.session || "").trim();
      if (!session) return res.status(400).json({ error: "Missing session" });

      const forceNew = Boolean(body.force_new);

      if (admin && !forceNew) {
        try {
          const { data: existing } = await admin
            .from("chat_conversations")
            .select("*")
            .eq("visitor_session", session)
            .eq("status", "open")
            .order("last_message_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (existing) {
            if (body.name || body.phone) {
              await admin
                .from("chat_conversations")
                .update({
                  visitor_name: body.name ?? existing.visitor_name,
                  visitor_phone: body.phone ?? existing.visitor_phone,
                })
                .eq("id", existing.id);
            }
            return res.status(200).json({ conversation: existing });
          }
        } catch (_) {}
      }

      let conv: any = null;
      if (admin) {
        try {
          const { data: created, error } = await admin
            .from("chat_conversations")
            .insert({
              visitor_session: session,
              visitor_name: body.name || null,
              visitor_phone: body.phone || null,
              status: "open",
            })
            .select("*")
            .single();
          if (!error && created) conv = created;
        } catch (_) {}
      }

      if (!conv) {
        const id = "conv-" + (session ? session.slice(-8) : Date.now());
        conv = {
          id,
          visitor_session: session,
          visitor_name: body.name || null,
          visitor_phone: body.phone || null,
          status: "open",
          unread_for_support: 0,
        };
        memoryConversations.set(id, conv);
      }

      return res.status(200).json({ conversation: conv });
    }

    if (action === "send") {
      const { session, conversation_id, body: msgBody } = body;
      if (!session || !msgBody) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      let conv: any = null;
      if (admin && conversation_id) {
        try {
          const { data } = await admin
            .from("chat_conversations")
            .select("id, visitor_session, visitor_name, visitor_phone, unread_for_support")
            .eq("id", conversation_id)
            .maybeSingle();

          if (data && (!data.visitor_session || data.visitor_session === session)) {
            conv = data;
          }
        } catch (_) {}
      }

      // If conversation wasn't found or session mismatched, look for existing open conversation for this visitor session
      if (admin && !conv && session) {
        try {
          const { data: existing } = await admin
            .from("chat_conversations")
            .select("id, visitor_session, visitor_name, visitor_phone, unread_for_support")
            .eq("visitor_session", session)
            .eq("status", "open")
            .order("last_message_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          conv = existing;
        } catch (_) {}
      }

      // If still not found, automatically create a new conversation for this visitor session
      if (admin && !conv && session) {
        try {
          const { data: newConv } = await admin
            .from("chat_conversations")
            .insert({
              visitor_session: session,
              visitor_name: body.name || null,
              visitor_phone: body.phone || null,
              status: "open",
            })
            .select("id, visitor_session, visitor_name, visitor_phone, unread_for_support")
            .single();

          conv = newConv;
        } catch (_) {}
      }

      if (!conv) {
        const id = conversation_id || ("conv-" + (session ? session.slice(-8) : Date.now()));
        conv = memoryConversations.get(id) || {
          id,
          visitor_session: session,
          visitor_name: body.name || null,
          visitor_phone: body.phone || null,
          status: "open",
          unread_for_support: 1,
        };
        memoryConversations.set(id, conv);
      }

      const newMsg = String(msgBody).trim();

      // 1. Insert customer message
      let msg: any = null;
      if (admin) {
        try {
          const { data: insertedMsg } = await admin
            .from("chat_messages")
            .insert({
              conversation_id: conv.id,
              sender: "visitor",
              body: newMsg,
            })
            .select("*")
            .single();
          if (insertedMsg) msg = insertedMsg;
        } catch (_) {}
      }

      if (!msg) {
        msg = {
          id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          conversation_id: conv.id,
          sender: "visitor",
          body: newMsg,
          created_at: new Date().toISOString(),
        };
      }

      const memList = memoryMessages.get(conv.id) || [];
      memList.push(msg);
      memoryMessages.set(conv.id, memList);

      if (admin) {
        try {
          await admin
            .from("chat_conversations")
            .update({
              last_message_at: new Date().toISOString(),
              unread_for_support: (conv.unread_for_support || 0) + 1,
            })
            .eq("id", conv.id);
        } catch (_) {}
      }

      // 2. Fetch recent conversation history
      let historyRows: any[] = [];
      if (admin) {
        try {
          const { data } = await admin
            .from("chat_messages")
            .select("sender, body, created_at")
            .eq("conversation_id", conv.id)
            .order("created_at", { ascending: false })
            .limit(10);
          if (data) historyRows = data;
        } catch (_) {}
      }

      if (historyRows.length === 0) {
        const memMsgs = memoryMessages.get(conv.id) || [];
        historyRows = [...memMsgs].slice(-10).reverse();
      }

      const history = (historyRows || []).reverse();
      // Exclude the message we just inserted for previous state analysis
      const previousTurns = history.filter((m) => m.sender === "visitor" || m.sender === "support").slice(0, -1);
      const lastSupportMsg = [...previousTurns].reverse().find((m) => m.sender === "support")?.body || "";

      // 3. Extract inputs & search orders
      const { phone: extractedPhone, ref: extractedRef } = extractCustomerInputs(
        newMsg,
        previousTurns,
        conv.visitor_phone || ""
      );

      const foundOrders = await findCustomerOrders(admin, extractedPhone, extractedRef);

      // 4. Retrieve settings (Keys & Admin Alert Phone)
      let sRows: any[] = [];
      if (admin) {
        try {
          const { data } = await admin
            .from("settings")
            .select("key,value")
            .in("key", [
              "admin_alert_phone",
              "support_phone",
              "ai_support_enabled",
              "primary_ai_provider",
              "groq_api_key",
              "GROQ_API_KEY",
              "groq_model",
              "gemini_api_key",
              "GEMINI_API_KEY",
              "gemini_model",
              "openai_api_key",
              "OPENAI_API_KEY",
              "arkesel_api_key",
              "ARKESEL_API_KEY",
            ]);
          if (data) sRows = data;
        } catch (_) {}
      }
      const sMap = Object.fromEntries((sRows || []).map((s: any) => [s.key, s.value]));

      const isAiEnabled = sMap.ai_support_enabled !== "false";
      const adminAlertPhone =
        sMap.admin_alert_phone || sMap.support_phone || process.env.ADMIN_ALERT_PHONE || "";

      // Detect OWNER MODE — visitor's phone matches the configured admin/support phone
      const ownerPhoneDigits = adminAlertPhone.replace(/\D/g, "");
      const visitorPhoneDigits = (conv.visitor_phone || "").replace(/\D/g, "");
      const isOwner =
        Boolean(ownerPhoneDigits) &&
        Boolean(visitorPhoneDigits) &&
        (
          ownerPhoneDigits === visitorPhoneDigits ||
          ownerPhoneDigits.endsWith(visitorPhoneDigits.slice(-9)) ||
          visitorPhoneDigits.endsWith(ownerPhoneDigits.slice(-9))
        );

      let groqKey = cleanApiKey(
        getEnvVar(["GROQ_API_KEY", "VITE_GROQ_API_KEY", "GROQ_KEY"]) ||
        sMap.groq_api_key ||
        sMap.GROQ_API_KEY
      );

      let geminiKey = cleanApiKey(
        getEnvVar([
          "GEMINI_API_KEY",
          "VITE_GEMINI_API_KEY",
          "GOOGLE_GEMINI_API_KEY",
          "GOOGLE_API_KEY",
          "GEMINI_KEY",
        ]) ||
        sMap.gemini_api_key ||
        sMap.GEMINI_API_KEY
      );

      let openAiKey = cleanApiKey(
        getEnvVar(["OPENAI_API_KEY", "VITE_OPENAI_API_KEY", "OPENAI_KEY"]) ||
        sMap.openai_api_key ||
        sMap.OPENAI_API_KEY
      );

      if (!geminiKey && openAiKey && openAiKey.startsWith("AIzaSy")) {
        geminiKey = openAiKey;
        openAiKey = "";
      }

      // Check if last support message was awaiting order confirmation
      // Check if last support message was awaiting order confirmation
      const isAwaitingConfirm =
        /is this the order you('re| are)? (checking on|inquiring about|asking about)|please confirm|is this your order/i.test(
          lastSupportMsg
        );

      const isAffirmative =
        /\b(yes|yeah|yep|yess|correct|confirm|confirmed|that's it|thats it|that is it|exactly|sure|right|proceed|ok|okay)\b/i.test(
          newMsg
        ) && !/\b(no|nope|not)\b/i.test(newMsg);

      const isNegative =
        /\b(no|nope|nah|not that|wrong order|not it|that's not it|thats not it|different order|not (netflix|netflex|data|checker|mashup)|not this|different)\b/i.test(
          newMsg
        ) ||
        /\b(is|it'?s) (data|netflix|netflex|checker|mashup) not\b/i.test(newMsg) ||
        /\bnot\s+(netflix|netflex|data|checker|mashup)\b/i.test(newMsg) ||
        /is\s+data\s+(puchase|purchase)?\s*not\s+netfl/i.test(newMsg);

      // Check if user is asking for someone else's order (Privacy rule)
      const isAskingOtherPerson =
        /\b(someone else|another person|my friend('?s)? (order|number)|my brother('?s)? (order|number)|my sister('?s)? (order|number)|different person|check for my friend|check for my bro)\b/i.test(
          newMsg
        );

      let aiReplyText = "";

      // No fixed/canned replies — every reply is written by the AI from live data.
      if (isAwaitingConfirm && isAffirmative && foundOrders.length > 0) {
        sendResolutionSms(admin, foundOrders[0], adminAlertPhone).catch(() => {});
      }
      {
        const privacyNote = isAskingOtherPerson ? "\nNOTE: The customer is asking about someone else's order. Politely explain you can only check orders for their own number/reference unless they share the exact reference." : "";
        // Build database order context for AI
        let ordersContext = "";
        if (foundOrders.length > 0) {
          ordersContext =
            "DATABASE ORDERS FOUND FOR THIS CUSTOMER:\n" +
            foundOrders
              .map(
                (o, idx) =>
                  `[Order ${idx + 1}]\n` +
                  `- Reference: ${o.reference}\n` +
                  `- Package: ${o.capacity} (${o.network})\n` +
                  `- Recipient Phone: ${o.recipient_phone}\n` +
                  `- Amount: GHS ${o.amount}\n` +
                  `- Delivery Status: ${o.delivery_status}\n` +
                  `- Date: ${formatOrderDate(o.created_at)}`
              )
              .join("\n\n");
        } else {
          ordersContext = "None found yet. If they ask about an order, ask once for the order reference or the phone number that received it.";
        }
        ordersContext += privacyNote;
        const siteKnowledge = await buildSiteKnowledge(admin);

        // Query live DataMart delivery tracker metrics (API-driven, not from order history)
        const liveTracker = await fetchDataMartDeliveryTracker(admin);

        // If in Owner Mode, compile live Whole-System Status across all pillars
        let wholeSystemContext = "";
        if (isOwner && admin) {
          try {
            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);
            const [todayOrdersRes, servicesRes, checkersRes, chatsRes, productsRes] = await Promise.all([
              admin.from("orders").select("id, amount, payment_status, delivery_status").gte("created_at", startOfDay.toISOString()),
              admin.from("service_orders").select("id, service, amount, status").eq("status", "paid"),
              admin.from("checker_orders").select("id, amount, status").eq("status", "paid"),
              admin.from("chat_conversations").select("id, unread_for_support").eq("status", "open"),
              admin.from("products").select("id, name, network, capacity, in_stock")
            ]);
            const paidToday = (todayOrdersRes.data || []).filter((o: any) => /paid|success/i.test(o.payment_status || ""));
            const todayRev = paidToday.reduce((s: number, o: any) => s + Number(o.amount || 0), 0);
            const netflixPaid = (servicesRes.data || []).filter((s: any) => s.service === "netflix").length;
            const mashupPaid = (servicesRes.data || []).filter((s: any) => s.service === "mashup").length;
            const afaPaid = (servicesRes.data || []).filter((s: any) => s.service === "afa").length;
            const checkersPaid = (checkersRes.data || []).length;
            const openChats = (chatsRes.data || []).length;
            const unreadChats = (chatsRes.data || []).reduce((s: number, c: any) => s + Number(c.unread_for_support || 0), 0);
            const outOfStock = (productsRes.data || []).filter((p: any) => !p.in_stock);

            wholeSystemContext =
              `• Data Bundles: ${paidToday.length} paid today | ₵${todayRev.toFixed(2)} sales | Delivery: ${liveTracker.deliverySpeedText}\n` +
              `• Digital Services: ${netflixPaid} active Netflix | ${mashupPaid} MTN MashUp | ${afaPaid} AFA registered\n` +
              `• Result Checkers: ${checkersPaid} WAEC vouchers sold\n` +
              `• Customer Live Chat: ${openChats} open conversation(s) (${unreadChats > 0 ? `⚠️ ${unreadChats} unread` : "all answered"})\n` +
              `• Product Catalog: ${outOfStock.length > 0 ? `⚠️ ${outOfStock.length} items OUT OF STOCK` : "All items in stock ✅"}`;
          } catch (_) {}
        }

        // Try AI generation
        if (isAiEnabled) {
          if (!isOwner) {
            try {
              const aiRes = await askCustomerSupportAI({
                userMessage: newMsg,
                history: history.map((h) => ({
                  role: h.sender === "support" ? "assistant" : "user",
                  content: h.body,
                })),
                extraContext: ordersContext || undefined,
                supabase: admin,
              });
              if (aiRes?.reply) {
                aiReplyText = aiRes.reply;
              }
            } catch (rotErr) {
              console.warn("askCustomerSupportAI error in api/chat:", rotErr);
            }
          }
          if (!aiReplyText && (groqKey || geminiKey || openAiKey)) {
            aiReplyText = await getAiResponse(
              {
                groqKey,
                geminiKey,
                openAiKey,
                primaryProvider: sMap.primary_ai_provider || "groq",
                groqModel: sMap.groq_model || "llama-3.3-70b-versatile",
                geminiModel: sMap.gemini_model || "gemini-3.8-flash",
              },
              history.map((h) => ({ sender: h.sender, body: h.body })),
              newMsg,
              ordersContext,
              liveTracker,
              isOwner,
              wholeSystemContext,
              siteKnowledge
            );
          }
        }

        // Intelligent human-like fallback if AI key missing or model failed
        if (!aiReplyText) {
          aiReplyText = generateNaturalHumanFallback(
            newMsg,
            foundOrders,
            liveTracker,
            extractedPhone,
            extractedRef,
            conv.visitor_phone || "",
            previousTurns,
            isOwner,
            wholeSystemContext
          );
        }
      }

      let aiMessage: any = null;
      if (aiReplyText) {
        aiReplyText = cleanCustomerFacingText(aiReplyText);
        if (admin) {
          try {
            const { data: aiMsgRow } = await admin
              .from("chat_messages")
              .insert({
                conversation_id: conv.id,
                sender: "support",
                body: aiReplyText,
              })
              .select("*")
              .single();

            if (aiMsgRow) {
              aiMessage = aiMsgRow;
              await admin
                .from("chat_conversations")
                .update({
                  unread_for_visitor: 1,
                })
                .eq("id", conv.id);
            }
          } catch (_) {}
        }

        if (!aiMessage) {
          aiMessage = {
            id: `msg-ai-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            conversation_id: conv.id,
            sender: "support",
            body: aiReplyText,
            created_at: new Date().toISOString(),
          };
        }

        const memList = memoryMessages.get(conv.id) || [];
        memList.push(aiMessage);
        memoryMessages.set(conv.id, memList);
      }

      return res.status(200).json({ ok: true, message: msg, ai_message: aiMessage, conversation_id: conv.id });
    }

    if (action === "list") {
      const { session, conversation_id } = body;
      if (!session) return res.status(400).json({ error: "Missing session" });

      let conv: any = null;
      if (admin && conversation_id) {
        try {
          const { data } = await admin
            .from("chat_conversations")
            .select("id, visitor_session")
            .eq("id", conversation_id)
            .maybeSingle();

          if (data && (!data.visitor_session || data.visitor_session === session)) {
            conv = data;
          }
        } catch (_) {}
      }

      if (admin && !conv && session) {
        try {
          const { data: bySession } = await admin
            .from("chat_conversations")
            .select("id, visitor_session")
            .eq("visitor_session", session)
            .eq("status", "open")
            .order("last_message_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          conv = bySession;
        } catch (_) {}
      }

      if (!conv) {
        conv = (conversation_id && memoryConversations.get(conversation_id)) ||
          Array.from(memoryConversations.values()).find((c: any) => c.visitor_session === session);
      }

      if (!conv) {
        return res.status(200).json({ messages: [], conversation_id: null });
      }

      let msgs: any[] = [];
      if (admin) {
        try {
          const { data, error } = await admin
            .from("chat_messages")
            .select("*")
            .eq("conversation_id", conv.id)
            .order("created_at", { ascending: true })
            .limit(40);

          if (!error && Array.isArray(data)) msgs = data;
        } catch (_) {}
      }

      if (msgs.length === 0) {
        msgs = memoryMessages.get(conv.id) || [];
      }

      return res.status(200).json({ messages: msgs || [], conversation_id: conv.id });
    }

    if (action === "markVisitorRead") {
      const { session, conversation_id } = body;
      if (session && conversation_id) {
        await admin
          .from("chat_conversations")
          .update({ unread_for_visitor: 0 })
          .eq("id", conversation_id)
          .eq("visitor_session", session);
      }
      return res.status(200).json({ ok: true });
    }

    // 2. Staff / Admin Actions
    if (action === "listConversations") {
      let rows: any[] = [];
      if (admin) {
        try {
          const { data, error } = await admin
            .from("chat_conversations")
            .select("*")
            .order("last_message_at", { ascending: false })
            .limit(100);
          if (!error && Array.isArray(data)) rows = data;
        } catch (e: any) {
          console.warn("[chat.ts] admin listConversations error:", e?.message);
        }
      }
      try {
        const { data: localData } = await data1db.getClient()
          .from("chat_conversations")
          .select("*")
          .order("last_message_at", { ascending: false })
          .limit(100);
        if (localData && Array.isArray(localData)) {
          for (const item of localData) {
            if (!rows.find((r) => r.id === item.id || (r.visitor_session && r.visitor_session === item.visitor_session))) {
              rows.push(item);
            }
          }
        }
      } catch (_) {}

      if (rows.length === 0) {
        rows = Array.from(memoryConversations.values());
      }
      return res.status(200).json({ conversations: rows || [] });
    }

    if (action === "listMessages") {
      const { conversation_id } = body;
      if (!conversation_id) return res.status(400).json({ error: "Missing conversation_id" });

      let msgs: any[] = [];
      if (admin) {
        try {
          const { data, error } = await admin
            .from("chat_messages")
            .select("*")
            .eq("conversation_id", conversation_id)
            .order("created_at", { ascending: true })
            .limit(300);
          if (!error && Array.isArray(data)) msgs = data;
        } catch (_) {}
      }
      try {
        const { data: localMsgs } = await data1db.getClient()
          .from("chat_messages")
          .select("*")
          .eq("conversation_id", conversation_id)
          .order("created_at", { ascending: true })
          .limit(300);
        if (localMsgs && Array.isArray(localMsgs)) {
          for (const lm of localMsgs) {
            if (!msgs.find((m) => m.id === lm.id || (m.body === lm.body && m.created_at === lm.created_at))) {
              msgs.push(lm);
            }
          }
        }
      } catch (_) {}

      if (msgs.length === 0) {
        msgs = memoryMessages.get(conversation_id) || [];
      }
      return res.status(200).json({ messages: msgs || [] });
    }

    if (action === "reply") {
      const { conversation_id, body: replyText } = body;
      if (!conversation_id || !replyText) return res.status(400).json({ error: "Missing fields" });

      let conv: any = null;
      if (admin) {
        try {
          const { data } = await admin
            .from("chat_conversations")
            .select("id, unread_for_visitor")
            .eq("id", conversation_id)
            .maybeSingle();
          conv = data;
        } catch (_) {}
      }

      if (!conv) {
        conv = memoryConversations.get(conversation_id) || {
          id: conversation_id,
          unread_for_visitor: 0,
          status: "open",
        };
        memoryConversations.set(conversation_id, conv);
      }

      let msg: any = null;
      if (admin) {
        try {
          const { data: m, error: mErr } = await admin
            .from("chat_messages")
            .insert({
              conversation_id,
              sender: "support",
              body: String(replyText).trim(),
            })
            .select("*")
            .single();
          if (!mErr && m) msg = m;
        } catch (_) {}
      }

      // Also replicate to localDb
      try {
        await data1db.getClient().from("chat_messages").insert({
          id: msg?.id || undefined,
          conversation_id,
          sender: "support",
          body: String(replyText).trim(),
          created_at: new Date().toISOString(),
        });
      } catch (_) {}

      if (!msg) {
        msg = {
          id: `msg-rep-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          conversation_id,
          sender: "support",
          body: String(replyText).trim(),
          created_at: new Date().toISOString(),
        };
      }

      const memList = memoryMessages.get(conversation_id) || [];
      memList.push(msg);
      memoryMessages.set(conversation_id, memList);

      if (admin) {
        try {
          await admin
            .from("chat_conversations")
            .update({
              last_message_at: new Date().toISOString(),
              unread_for_visitor: (conv?.unread_for_visitor || 0) + 1,
            })
            .eq("id", conversation_id);
        } catch (_) {}
      }
      try {
        await data1db.getClient()
          .from("chat_conversations")
          .update({
            last_message_at: new Date().toISOString(),
            unread_for_visitor: ((conv?.unread_for_visitor || 0) + 1),
          })
          .eq("id", conversation_id);
      } catch (_) {}

      return res.status(200).json({ message: msg });
    }

    if (action === "markRead") {
      const { conversation_id } = body;
      if (conversation_id) {
        await admin
          .from("chat_conversations")
          .update({ unread_for_support: 0 })
          .eq("id", conversation_id);
      }
      return res.status(200).json({ ok: true });
    }

    if (action === "setStatus") {
      const { conversation_id, status } = body;
      if (conversation_id && (status === "open" || status === "closed")) {
        await admin
          .from("chat_conversations")
          .update({ status })
          .eq("id", conversation_id);
      }
      return res.status(200).json({ ok: true });
    }

    // 3. Upload signing helpers
    if (action === "saveVoiceCall") {
      const {
        session,
        customer_phone,
        visitor_name = "Voice Customer",
        transcript = "",
        ai_reply = "",
        audio_url = "",
        duration_seconds = 0,
        network = "",
        capacity = "",
        price = 0,
        intent = "buy_data",
      } = body;

      const callId = `vc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const newCallRecord = {
        id: callId,
        created_at: new Date().toISOString(),
        customer_phone: customer_phone || null,
        visitor_name,
        transcript: transcript || "(Spoken Voice Note)",
        ai_reply,
        audio_url: audio_url || null,
        duration_seconds: Number(duration_seconds) || 0,
        network: network || null,
        capacity: capacity ? `${capacity}` : null,
        price: Number(price) || 0,
        intent,
        status: intent === "buy_data" && network && capacity ? "ready_to_order" : "inquiry",
      };

      // 1. Maintain recent_voice_calls list in settings
      if (admin) {
        try {
          const { data: currentSetting } = await admin
            .from("settings")
            .select("value")
            .eq("key", "recent_voice_calls")
            .maybeSingle();

          let list: any[] = [];
          if (currentSetting?.value) {
            try {
              list = JSON.parse(currentSetting.value);
              if (!Array.isArray(list)) list = [];
            } catch {}
          }

          list.unshift(newCallRecord);
          if (list.length > 100) list = list.slice(0, 100);

          await admin.from("settings").upsert(
            { key: "recent_voice_calls", value: JSON.stringify(list) },
            { onConflict: "key" }
          );
        } catch (e: any) {
          console.warn("Could not save to recent_voice_calls setting:", e?.message);
        }

        // 2. Also log to chat_conversations & chat_messages so support sees it
        if (session) {
          try {
            let convId: string | null = null;
            const { data: conv } = await admin
              .from("chat_conversations")
              .select("id, visitor_phone")
              .eq("visitor_session", session)
              .maybeSingle();

            if (conv) {
              convId = conv.id;
              if (customer_phone && !conv.visitor_phone) {
                await admin
                  .from("chat_conversations")
                  .update({ visitor_phone: customer_phone, last_message_at: new Date().toISOString() })
                  .eq("id", conv.id);
              }
            } else {
              const { data: newConv } = await admin
                .from("chat_conversations")
                .insert({
                  visitor_session: session,
                  visitor_name,
                  visitor_phone: customer_phone || null,
                })
                .select("id")
                .single();
              if (newConv) convId = newConv.id;
            }

            if (convId) {
              let msgBody = `[voice] ${transcript || "Customer Voice Call"}`;
              if (network || capacity) {
                msgBody += `\n[bundle: ${network} ${capacity}GB - GHS ${price}]`;
              }
              if (audio_url) {
                msgBody += `\n[audio] ${audio_url}`;
              }

              await admin.from("chat_messages").insert({
                conversation_id: convId,
                sender: "visitor",
                body: msgBody,
              });

              if (ai_reply) {
                await admin.from("chat_messages").insert({
                  conversation_id: convId,
                  sender: "support",
                  body: `[ai_voice] ${ai_reply}`,
                });
              }
            }
          } catch (convErr: any) {
            console.warn("Could not attach voice call to chat conversation:", convErr?.message);
          }
        }
      }

      return res.status(200).json({ ok: true, call: newCallRecord });
    }

    if (action === "voiceTurn") {
      const userText = String(body.text || "").trim();
      const curNetwork = body.detectedNetwork || null;
      const curCapacity = body.detectedCapacity || null;
      const curPhone = body.detectedPhone || null;
      const historyTurns = Array.isArray(body.history) ? body.history : [];

      if (!userText) {
        return res.status(200).json({
          reply: "I'm listening bossu! What bundle or question can I help you with?",
          detectedNetwork: curNetwork,
          detectedCapacity: curCapacity,
          detectedPhone: curPhone,
        });
      }

      // 1. Fast entity extraction
      let nextNetwork = curNetwork;
      const lower = userText.toLowerCase();
      if (lower.includes("mtn") || lower.includes("yello")) nextNetwork = "MTN";
      else if (lower.includes("telecel") || lower.includes("vodafone") || lower.includes("voda") || lower.includes("red")) nextNetwork = "TELECEL";
      else if (lower.includes("airtel") || lower.includes("tigo") || lower.includes("at network") || lower.includes("at data") || /\bat\b/.test(lower)) nextNetwork = "AT";

      let nextCapacity = curCapacity;
      const capMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:gb|gig|gigs|gigabyte|gigabytes)\b/);
      if (capMatch) {
        nextCapacity = capMatch[1];
      } else {
        const numMatch = lower.match(/\b(1|2|3|4|5|6|8|10|12|15|20|25|30|35|40|45|50|100)\b/);
        if (numMatch && (lower.includes("data") || lower.includes("bundle") || lower.includes("buy") || lower.includes("want"))) {
          nextCapacity = numMatch[1];
        }
      }

      let nextPhone = curPhone;
      const cleanDigits = userText.replace(/\D/g, "");
      const intlMatch = userText.match(/(?:\+?233)(\d{9})\b/);
      if (intlMatch) {
        nextPhone = `0${intlMatch[1]}`;
      } else {
        const ghPhoneMatch = cleanDigits.match(/(0(?:20|23|24|25|26|27|28|30|50|53|54|55|56|57|58|59)\d{7})/);
        if (ghPhoneMatch) nextPhone = ghPhoneMatch[1];
      }

      // Check for checkout / confirmation intent
      const isConfirming = /\b(confirm|yes|proceed|buy now|pay now|checkout|ready to pay|pay|make payment)\b/i.test(lower);

      // Check if we have a full bundle order or airtime
      let matchedProduct: any = null;
      const isAirtime = lower.includes("airtime") || lower.includes("credit");

      // Check if user specifically requested 40
      const mentioned40 = /\b40\b/.test(lower) || lower.includes("forty");

      if (nextNetwork && (nextCapacity || isAirtime || mentioned40)) {
        const DEFAULT_CATALOG: Array<{ id?: string; network: string; capacity: string; price: number; name: string }> = [
          { id: "p-mtn-1", network: "MTN", capacity: "1", price: 4.20, name: "MTN 1GB Data" },
          { id: "p-mtn-2", network: "MTN", capacity: "2", price: 11.50, name: "MTN 2GB Data" },
          { id: "p-mtn-3", network: "MTN", capacity: "3", price: 17.00, name: "MTN 3GB Data" },
          { id: "p-mtn-4", network: "MTN", capacity: "4", price: 18.00, name: "MTN 4GB Data" },
          { id: "p-mtn-5", network: "MTN", capacity: "5", price: 27.50, name: "MTN 5GB Data" },
          { id: "p-mtn-6", network: "MTN", capacity: "6", price: 26.50, name: "MTN 6GB Data" },
          { id: "p-mtn-8", network: "MTN", capacity: "8", price: 35.00, name: "MTN 8GB Data" },
          { id: "p-mtn-10", network: "MTN", capacity: "10", price: 53.00, name: "MTN 10GB Data" },
          { id: "p-mtn-15", network: "MTN", capacity: "15", price: 78.00, name: "MTN 15GB Data" },
          { id: "p-mtn-20", network: "MTN", capacity: "20", price: 102.00, name: "MTN 20GB Data" },
          { id: "p-mtn-25", network: "MTN", capacity: "25", price: 105.50, name: "MTN 25GB Data" },
          { id: "p-mtn-30", network: "MTN", capacity: "30", price: 121.60, name: "MTN 30GB Data" },
          { id: "p-mtn-40", network: "MTN", capacity: "40", price: 165.00, name: "MTN 40GB Data" },
          { id: "p-mtn-50", network: "MTN", capacity: "50", price: 215.00, name: "MTN 50GB Data" },
          { id: "p-tel-10", network: "TELECEL", capacity: "10", price: 38.50, name: "Telecel 10GB Data" },
          { id: "p-tel-12", network: "TELECEL", capacity: "12", price: 45.50, name: "Telecel 12GB Data" },
          { id: "p-tel-15", network: "TELECEL", capacity: "15", price: 56.40, name: "Telecel 15GB Data" },
          { id: "p-tel-20", network: "TELECEL", capacity: "20", price: 27.90, name: "Telecel 20GB Data" },
          { id: "p-tel-25", network: "TELECEL", capacity: "25", price: 100.50, name: "Telecel 25GB Data" },
          { id: "p-tel-30", network: "TELECEL", capacity: "30", price: 110.00, name: "Telecel 30GB Data" },
          { id: "p-tel-35", network: "TELECEL", capacity: "35", price: 133.40, name: "Telecel 35GB Data" },
          { id: "p-tel-40", network: "TELECEL", capacity: "40", price: 145.00, name: "Telecel 40GB Data" },
          { id: "p-tel-45", network: "TELECEL", capacity: "45", price: 160.80, name: "Telecel 45GB Data" },
          { id: "p-tel-50", network: "TELECEL", capacity: "50", price: 180.00, name: "Telecel 50GB Data" },
          { id: "p-tel-100", network: "TELECEL", capacity: "100", price: 400.75, name: "Telecel 100GB Data" },
          { id: "p-at-1", network: "AT", capacity: "1", price: 4.50, name: "AT 1GB Data" },
          { id: "p-at-2", network: "AT", capacity: "2", price: 11.00, name: "AT 2GB Data" },
          { id: "p-at-3", network: "AT", capacity: "3", price: 15.00, name: "AT 3GB Data" },
          { id: "p-at-4", network: "AT", capacity: "4", price: 18.00, name: "AT 4GB Data" },
          { id: "p-at-5", network: "AT", capacity: "5", price: 23.00, name: "AT 5GB Data" },
          { id: "p-at-6", network: "AT", capacity: "6", price: 27.00, name: "AT 6GB Data" },
          { id: "p-at-8", network: "AT", capacity: "8", price: 35.00, name: "AT 8GB Data" },
          { id: "p-at-10", network: "AT", capacity: "10", price: 44.00, name: "AT 10GB Data" },
          { id: "p-at-15", network: "AT", capacity: "15", price: 62.00, name: "AT 15GB Data" },
          { id: "p-at-25", network: "AT", capacity: "25", price: 106.00, name: "AT 25GB Data" },
          { id: "p-at-30", network: "AT", capacity: "30", price: 121.00, name: "AT 30GB Data" },
        ];

        const targetCap = nextCapacity || (mentioned40 ? "40" : "1");
        matchedProduct = DEFAULT_CATALOG.find(
          (p) => p.network.toUpperCase() === nextNetwork.toUpperCase() && (p.capacity === String(targetCap) || Number(p.capacity) === Number(targetCap))
        ) || null;
      }

      // 1B. Phone number verification check against database orders
      let isNewNumber = true;
      let isExistingNumber = false;
      if (nextPhone && admin) {
        try {
          const last9 = nextPhone.slice(-9);
          const { data: pastOrders } = await admin
            .from("orders")
            .select("id")
            .ilike("recipient_phone", `%${last9}%`)
            .limit(1);

          if (pastOrders && pastOrders.length > 0) {
            isNewNumber = false;
            isExistingNumber = true;
          }
        } catch {}
      }

      // If user is selecting bundle + phone:
      if (matchedProduct && nextPhone) {
        let replyMessage = "";
        if (isNewNumber) {
          replyMessage = `The price for ${matchedProduct.network} ${matchedProduct.capacity}GB on our site is GH₵ ${matchedProduct.price.toFixed(2)}. I'm coming to process it for you now! Your number ${nextPhone} is a new number and needs to be verified, so it will take a little time before it comes. Please approve the payment prompt opening on your screen now!`;
        } else {
          replyMessage = `The price for ${matchedProduct.network} ${matchedProduct.capacity}GB on our site is GH₵ ${matchedProduct.price.toFixed(2)}. I'm coming to process it now! Your number ${nextPhone} is already in our system. You will receive a payment prompt shortly for you to enter your MoMo PIN and approve. Opening Paystack now!`;
        }

        return res.status(200).json({
          reply: replyMessage,
          detectedNetwork: nextNetwork,
          detectedCapacity: matchedProduct.capacity,
          detectedPhone: nextPhone,
          stagedProduct: matchedProduct,
          isNewNumber,
          isExistingNumber,
          isReadyToCheckout: true,
        });
      }

      // If user selected bundle but not phone yet:
      if (matchedProduct && !nextPhone) {
        return res.status(200).json({
          reply: `The price for ${matchedProduct.network} ${matchedProduct.capacity}GB on our site is GH₵ ${matchedProduct.price.toFixed(2)}. I'm coming to process it for you now! What phone number should receive the data?`,
          detectedNetwork: nextNetwork,
          detectedCapacity: matchedProduct.capacity,
          detectedPhone: null,
          stagedProduct: matchedProduct,
          isReadyToCheckout: false,
        });
      }

      // 2. Fetch Groq / Gemini / OpenAI keys for intelligent customer conversation
      let groqKey = cleanApiKey(
        getEnvVar(["GROQ_API_KEY", "VITE_GROQ_API_KEY", "GROQ_KEY"])
      );
      let geminiKey = cleanApiKey(
        getEnvVar(["GEMINI_API_KEY", "VITE_GEMINI_API_KEY", "GOOGLE_GEMINI_API_KEY", "GOOGLE_API_KEY"])
      );
      let openAiKey = cleanApiKey(
        getEnvVar(["OPENAI_API_KEY", "VITE_OPENAI_API_KEY", "OPENAI_KEY"])
      );

      let primaryProvider = "groq";
      let groqModel = "llama-3.3-70b-versatile";
      let geminiModel = "gemini-3.8-flash";

      if (admin) {
        try {
          const { data: sRows } = await admin
            .from("settings")
            .select("key, value")
            .in("key", [
              "primary_ai_provider",
              "groq_api_key",
              "GROQ_API_KEY",
              "groq_model",
              "gemini_api_key",
              "GEMINI_API_KEY",
              "gemini_model",
              "openai_api_key",
              "OPENAI_API_KEY",
            ]);
          const sMap = Object.fromEntries((sRows || []).map((s: any) => [s.key, s.value]));
          if (!groqKey) groqKey = cleanApiKey(sMap.groq_api_key || sMap.GROQ_API_KEY);
          if (!geminiKey) geminiKey = cleanApiKey(sMap.gemini_api_key || sMap.GEMINI_API_KEY);
          if (!openAiKey) openAiKey = cleanApiKey(sMap.openai_api_key || sMap.OPENAI_API_KEY);
          if (sMap.primary_ai_provider) primaryProvider = sMap.primary_ai_provider;
          if (sMap.groq_model) groqModel = sMap.groq_model;
          if (sMap.gemini_model) geminiModel = sMap.gemini_model;
        } catch (_) {}
      }

      let aiVoiceReply: string | null = null;
      const voiceSiteKnowledge = await buildSiteKnowledge(admin);
      const voiceSystemPrompt =
        "You are Stony from DATA 1 GH, talking to a customer on a live phone call in Ghana.\n\n" +
        HUMAN_STYLE_RULES +
        "VOICE RULES: This is spoken audio. Speak 1–2 short natural sentences. No lists, symbols, URLs, emojis or markdown. Say prices like '4 cedis 50'.\n\n" +
        (voiceSiteKnowledge ? `${voiceSiteKnowledge}\n` : "");

      if (geminiKey) primaryProvider = "gemini";
      const turns = historyTurns.slice(-10).map((h: any) => ({
        sender: h.role === "user" ? "visitor" : "support",
        body: String(h.text || ""),
      }));

      if (primaryProvider === "gemini") {
        // 1. Try Gemini first (as configured primary provider)
        if (geminiKey) {
          const geminiRes = await callGemini(geminiKey, turns, userText, voiceSystemPrompt, geminiModel);
          if (geminiRes?.text) aiVoiceReply = geminiRes.text;
        }
        // 2. Fallback to Groq
        if (!aiVoiceReply && groqKey) {
          const groqRes = await callGroq(groqKey, turns, userText, voiceSystemPrompt, groqModel);
          if (groqRes?.text) aiVoiceReply = groqRes.text;
        }
      } else {
        // 1. Try Groq first (Default ultra-fast)
        if (groqKey) {
          const groqRes = await callGroq(groqKey, turns, userText, voiceSystemPrompt, groqModel);
          if (groqRes?.text) aiVoiceReply = groqRes.text;
        }
        // 2. Fallback to Gemini
        if (!aiVoiceReply && geminiKey) {
          const geminiRes = await callGemini(geminiKey, turns, userText, voiceSystemPrompt, geminiModel);
          if (geminiRes?.text) aiVoiceReply = geminiRes.text;
        }
      }
      // 3. Try OpenAI
      if (!aiVoiceReply && openAiKey) {
        const openAiRes = await callOpenAi(openAiKey, turns, userText, voiceSystemPrompt);
        if (openAiRes?.text) aiVoiceReply = openAiRes.text;
      }

      // Fast conversational fallback if AI keys are not configured or offline
      if (!aiVoiceReply) {
        if (/girlfriend|boyfriend|love you|marry me/i.test(lower)) {
          aiVoiceReply = "Haha, I appreciate the love! I'm just here keeping focused on helping people get their data sorted out, but you're very kind!";
        } else if (/how is the living|how is living|how is life|living today/i.test(lower)) {
          aiVoiceReply = "Living today has its hustle, but we keep pushing and stay grateful! How is life treating you on your end?";
        } else if (/how is everything|how's everything/i.test(lower)) {
          aiVoiceReply = "Everything is good! Things are moving along smoothly here. How is everything on your end?";
        } else if (/how is delivery|how's delivery|delivery speed|delivery working|delivery ongoing/i.test(lower)) {
          aiVoiceReply = "Delivery is super fast right now! It drops automatically within 5 to 15 minutes right after your payment is approved.";
        } else if (/how was your day|how has your day been|how is your day|how your day dey/i.test(lower)) {
          aiVoiceReply = "My day has been really good and busy, thanks for asking! Just here helping everyone get their data on time. How has your day been?";
        } else if (/how are you|how you dey|how are u|how body/i.test(lower)) {
          aiVoiceReply = "I'm fine, I'm doing really good! Everything is moving smoothly. How are you doing today?";
        } else if (/what are you doing|what you dey do/i.test(lower)) {
          aiVoiceReply = "Just here making sure everyone's data bundles deliver fast and on time! What can I help you with today?";
        } else if (/joke|laugh|funny/i.test(lower)) {
          aiVoiceReply = "Haha! Why did the smartphone wear glasses? Because it lost its contacts! What bundle can I get ready for you?";
        } else if (/price|cost|how much|rate/i.test(lower)) {
          aiVoiceReply = "MTN 1GB is GH₵ 4.50, 2GB is GH₵ 9.50, and 5GB is GH₵ 23.50. All our bundles are non-expiry! Which network and size do you want?";
        } else if (/delivery|how long|arrive|reach|when will/i.test(lower)) {
          aiVoiceReply = "Delivery is super fast! Data drops straight to your phone within 5 to 15 minutes right after payment confirmation.";
        } else if (/pay|payment|momo|mobile money|card/i.test(lower)) {
          aiVoiceReply = "You can pay easily using MTN MoMo, Telecel Cash, AT Money, or bank card securely through Paystack. What bundle should I prepare for you?";
        } else if (/netflix/i.test(lower)) {
          aiVoiceReply = "Yes, we offer premium 30-day Netflix access for only GH₵ 30, with automatic login codes provided right away!";
        } else if (/afa/i.test(lower)) {
          aiVoiceReply = "AFA registration is GH₵ 20. It unlocks permanent discounted farmer alliance data rates directly on your MTN SIM!";
        } else if (/checker|waec|bece|wassce|exam/i.test(lower)) {
          aiVoiceReply = "We sell instant WAEC checkers for GH₵ 20 and BECE for GH₵ 18, with your serial and pin displayed immediately after payment.";
        } else if (/track|order status|where is my/i.test(lower)) {
          aiVoiceReply = "You can track your order anytime on our Track page using your phone number or reference. Would you like to check one now?";
        } else if (/who are you|what is this|about/i.test(lower)) {
          aiVoiceReply = "I'm Stony from DATA 1 GH! You can ask me any question or tell me what bundle you want, and I'll get it ready for you.";
        } else if (/hello|hi|hey|akwaaba|good morning|good afternoon|good evening/i.test(lower)) {
          aiVoiceReply = "Hello! Good to hear from you today. How are you doing? What bundle or service can I help you with?";
        } else {
          aiVoiceReply = "I'm right here with you! Tell me what's on your mind or what data bundle or service you'd like to get today.";
        }
      }

      // Clean spoken output of any markdown artifacts
      aiVoiceReply = aiVoiceReply
        .replace(/[*_#`~[\]]/g, "")
        .replace(/https?:\/\/\S+/g, "our website")
        .replace(/\n+/g, " ")
        .trim();

      return res.status(200).json({
        reply: aiVoiceReply,
        detectedNetwork: nextNetwork,
        detectedCapacity: nextCapacity,
        detectedPhone: nextPhone,
        stagedProduct: matchedProduct,
        isReadyToCheckout: false,
      });
    }

    if (action === "listVoiceCalls") {
      try {
        let list: any[] = [];
        if (admin) {
          const { data: currentSetting } = await admin
            .from("settings")
            .select("value")
            .eq("key", "recent_voice_calls")
            .maybeSingle();

          if (currentSetting?.value) {
            try {
              list = JSON.parse(currentSetting.value);
              if (!Array.isArray(list)) list = [];
            } catch {}
          }
        }
        return res.status(200).json({ ok: true, calls: list });
      } catch (e: any) {
        return res.status(200).json({ ok: true, calls: [] });
      }
    }

    if (action === "deleteVoiceCall") {
      try {
        const { id } = body;
        let list: any[] = [];
        if (admin) {
          const { data: currentSetting } = await admin
            .from("settings")
            .select("value")
            .eq("key", "recent_voice_calls")
            .maybeSingle();

          if (currentSetting?.value) {
            try {
              list = JSON.parse(currentSetting.value);
              if (!Array.isArray(list)) list = [];
            } catch {}
          }

          if (id === "all") {
            list = [];
          } else if (id) {
            list = list.filter((c: any) => String(c.id) !== String(id));
          }

          await admin.from("settings").upsert(
            { key: "recent_voice_calls", value: JSON.stringify(list) },
            { onConflict: "key" }
          );
        }
        return res.status(200).json({ ok: true, calls: list });
      } catch (e: any) {
        return res.status(200).json({ ok: true, calls: [] });
      }
    }

    if (action === "signUpload" || action === "staffSignUpload") {
      const { conversation_id, ext = "png" } = body;
      const path = `${conversation_id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      try {
        const { data: signed, error: sErr } = await admin.storage
          .from(BUCKET)
          .createSignedUploadUrl(path);
        if (sErr) throw sErr;
        return res.status(200).json({ path, token: signed.token, url: signed.signedUrl });
      } catch (e: any) {
        return res.status(200).json({ path, token: "direct", url: "" });
      }
    }

    if (action === "signView" || action === "staffSignView") {
      const { path } = body;
      if (!path) return res.status(400).json({ error: "Missing path" });
      try {
        const { data: signed, error: sErr } = await admin.storage
          .from(BUCKET)
          .createSignedUrl(path, 3600);
        if (sErr) throw sErr;
        return res.status(200).json({ url: signed.signedUrl });
      } catch (e: any) {
        return res.status(200).json({ url: "" });
      }
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });
  } catch (err: any) {
    console.error("api/chat error:", err);
    return res.status(500).json({ error: err?.message || "Internal server error" });
  }
}
