import { createClient } from "@supabase/supabase-js";
import { verifyAdminUser, getEnvVar, getSupabase } from "./_supabase.js";
import { resolveDatamartKeys, resolveDatamartSecret, getDatamartAuthHeaders } from "./_datamart.js";
import { detectAndBlockIntrusion } from "./_firewall.js";
import { sendPaymentReceivedNotification } from "./_notifications.js";

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

const PAYSTACK_BASE = "https://api.paystack.co";
const CHECKERS_BASE = "https://api.datamartgh.shop/api/checkers";
const DEFAULT_PRICE = 20;

export function parseCheckerNoteTag(notes: string | null | undefined, tag: string): string | null {
  if (!notes) return null;
  const match = notes.match(new RegExp(`\\[${tag}:([^\\]]+)\\]`));
  return match ? match[1].trim() : null;
}

export function setCheckerNoteTag(notes: string | null | undefined, tag: string, value: string | null | undefined): string {
  let str = (notes || "").trim();
  const regex = new RegExp(`\\[${tag}:[^\\]]*\\]\\s*`, "g");
  str = str.replace(regex, "").trim();
  if (value !== null && value !== undefined && String(value).trim() !== "") {
    str = str ? `${str} [${tag}:${String(value).trim()}]` : `[${tag}:${String(value).trim()}]`;
  }
  return str;
}

export function enrichCheckerOrder(order: any) {
  if (!order || typeof order !== "object") return order;
  const notes = order.notes || "";
  const customer_name = order.customer_name || parseCheckerNoteTag(notes, "name") || null;
  const payment_status = order.payment_status || order.status || "pending";
  const serial_number = order.serial_number || parseCheckerNoteTag(notes, "serial") || null;
  const pin = order.pin || parseCheckerNoteTag(notes, "pin") || null;
  const error_message = order.error_message || parseCheckerNoteTag(notes, "error") || null;
  const datamart_reference = order.datamart_reference || parseCheckerNoteTag(notes, "dm_ref") || null;
  const delivered_at = order.delivered_at || parseCheckerNoteTag(notes, "delivered_at") || null;
  return {
    ...order,
    customer_name,
    payment_status,
    status: payment_status,
    serial_number,
    pin,
    error_message,
    datamart_reference,
    delivered_at,
  };
}

function safeCallbackUrl(raw: unknown): string | undefined {
  if (typeof raw !== "string" || !raw) return undefined;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return undefined;
  }
  if (u.protocol !== "https:" && u.hostname !== "localhost") return undefined;
  return u.toString();
}

function formatArkeselPhone(raw: string): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("233") && digits.length === 12) return digits;
  if (digits.startsWith("0") && digits.length === 10) return `233${digits.slice(1)}`;
  if (digits.length === 9) return `233${digits}`;
  if (digits.length >= 10 && digits.length <= 15) return digits;
  return null;
}

function stripEmojis(str: string): string {
  if (!str) return "";
  return str
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/\u200D/g, "")
    .replace(/\uFE0E/g, "")
    .replace(/\uFE0F/g, "")
    .trim();
}

async function sendArkeselSms(supabase: any, phone: string, message: string) {
  try {
    const formatted = formatArkeselPhone(phone);
    if (!formatted) {
      console.warn("sendArkeselSms: Invalid phone number:", phone);
      return { ok: false, error: "Invalid phone number" };
    }

    const cleanMessage = stripEmojis(message);

    let arkeselKey = cleanApiKey(
      process.env.ARKESEL_API_KEY ||
      process.env.VITE_ARKESEL_API_KEY ||
      ""
    );
    let sender = (process.env.ARKESEL_SENDER_ID || "Data1gh").trim().slice(0, 11);

    if (!arkeselKey || !process.env.ARKESEL_SENDER_ID) {
      const { data: sRows } = await supabase
        .from("settings")
        .select("key,value")
        .in("key", [
          "arkesel_api_key",
          "ARKESEL_API_KEY",
          "arkesel_key",
          "arkesel_sender_id",
          "ARKESEL_SENDER_ID",
        ]);

      for (const row of sRows || []) {
        const k = (row?.key || "").toLowerCase();
        if (k.includes("key") && !arkeselKey) {
          const c = cleanApiKey(row?.value);
          if (c) arkeselKey = c;
        }
        if (k.includes("sender")) {
          const s = String(row?.value || "").trim();
          if (s) sender = s.slice(0, 11);
        }
      }
    }

    if (!arkeselKey) {
      console.warn("sendArkeselSms: Arkesel API key not configured.");
      return { ok: false, error: "Arkesel API key not configured" };
    }

    const res = await fetch("https://sms.arkesel.com/api/v2/sms/send", {
      method: "POST",
      headers: {
        "api-key": arkeselKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        sender: sender || "D_1Gh",
        message: cleanMessage,
        recipients: [formatted],
      }),
    });

    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, data };
  } catch (err: any) {
    console.error("sendArkeselSms error:", err);
    return { ok: false, error: err?.message };
  }
}

// Owner instruction: ALL automatic SMS are blocked. Set to true to re-enable.
const AUTO_SMS_ENABLED = false;

async function sendAdminFailedCheckerSms(supabase: any, ref: string, errorDetail?: string) {
  if (!AUTO_SMS_ENABLED) return;
  try {
    const { data: sRows } = await supabase
      .from("settings")
      .select("key,value")
      .in("key", ["admin_alert_phone", "support_phone"]);
    const smap = Object.fromEntries((sRows || []).map((s: any) => [s.key, s.value]));
    const adminPhone = smap.admin_alert_phone || smap.support_phone || "";
    const cleanAdmin = String(adminPhone).replace(/\D/g, "");
    if (!adminPhone || cleanAdmin === "0547100951" || cleanAdmin === "233547100951") return;
    await sendArkeselSms(supabase, adminPhone, `ALERT: Result Checker order FAILED for ref ${ref}. Reason: ${errorDetail || "Purchase failed"}. Please fulfill manually!`);
  } catch (_) {}
}


export async function purchaseCheckerFromDatamart(
  params: {
    checkerType: string;
    phoneNumber: string;
    reference: string;
  },
  supabaseClient?: any
): Promise<{
  success: boolean;
  serialNumber?: string | null;
  pin?: string | null;
  reference?: string | null;
  error?: string;
}> {
  const sb = supabaseClient || getSupabase();
  const keys = await resolveDatamartKeys(sb);
  const secret = await resolveDatamartSecret(sb);

  if (keys.length === 0) {
    return { success: false, error: "DataMart API key not found in environment or settings" };
  }

  const cleanRef = String(params.reference || "").trim();
  const dmRef = cleanRef.startsWith("WS-") ? cleanRef : `WS-CK-${cleanRef.replace(/^CK-?/, "")}`;

  const rawType = String(params.checkerType || "WAEC").toUpperCase().trim();
  let typeCode = "WAEC";
  if (rawType.includes("BECE")) typeCode = "BECE";
  else if (rawType.includes("NOV") || rawType.includes("DEC")) typeCode = "NOVDEC";
  else if (rawType.includes("PLACE")) typeCode = "PLACEMENT";
  else typeCode = "WAEC";

  const cleanPhone = String(params.phoneNumber || "").replace(/\D/g, "");
  let formattedPhone = cleanPhone;
  if (cleanPhone.length === 9) formattedPhone = "0" + cleanPhone;
  if (cleanPhone.startsWith("233") && cleanPhone.length === 12) formattedPhone = "0" + cleanPhone.slice(3);

  const candidateEndpoints = [
    "https://api.datamartgh.shop/api/checkers/purchase",
    "https://api.datamartgh.shop/api/developer/checkers/purchase",
    "https://api.datamartgh.shop/api/developer/checkers",
    "https://api.datamartgh.shop/api/developer/purchase",
  ];

  let lastError = "DataMart purchase failed";

  for (const key of keys) {
    const headers = getDatamartAuthHeaders(key, secret);
    headers["x-idempotency-key"] = dmRef;
    headers["Content-Type"] = "application/json";

    const payload = {
      checkerType: typeCode,
      type: typeCode,
      phoneNumber: formattedPhone,
      phone: formattedPhone,
      ref: dmRef,
      reference: dmRef,
      skipSms: false,
    };

    for (const url of candidateEndpoints) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
        });

        const body = await res.json().catch(() => ({}));

        if (res.ok && (body?.status === "success" || body?.success === true || body?.data?.pin || body?.pin)) {
          const d = body.data || body;
          const pin = d.pin || d.card_pin || d.pin_code || d.serialPin || null;
          const serialNumber = d.serialNumber || d.serial || d.serial_number || null;
          const resRef = d.reference || d.orderReference || d.ref || dmRef;
          return {
            success: true,
            serialNumber,
            pin,
            reference: resRef,
          };
        }

        const msg = body?.message || body?.error || `Status ${res.status}`;
        lastError = msg;

        if (res.status === 404) {
          continue;
        }

        if (res.status === 401 || res.status === 400 || res.status === 403 || res.status === 500) {
          break;
        }
      } catch (err: any) {
        lastError = err?.message || "Connection error to DataMart";
      }
    }
  }

  return { success: false, error: lastError };
}


async function fetchDatamartStockAndBalance(supabase: any) {
  const keys = await resolveDatamartKeys(supabase);
  const secret = await resolveDatamartSecret(supabase);
  let stock: any[] = [];
  let balance: number | null = null;

  for (const key of keys) {
    const headers = getDatamartAuthHeaders(key, secret);

    // 1. Check stock from live supplier
    if (stock.length === 0) {
      const productUrls = [
        "https://api.datamartgh.shop/api/checkers/products",
        "https://api.datamartgh.shop/api/developer/checkers/products",
        "https://api.datamartgh.shop/api/developer/checkers",
      ];
      for (const url of productUrls) {
        try {
          const r = await fetch(url, { headers, signal: AbortSignal.timeout(4000) });
          const j = await r.json().catch(() => ({}));
          const list = j?.data || j?.products || (Array.isArray(j) ? j : []);
          if (Array.isArray(list) && list.length > 0) {
            stock = list.map((item: any) => ({
              id: item.id || item.type || item.name,
              name: item.name || item.type || "Checker",
              price: Number(item.price ?? item.cost ?? 0),
              inStock: item.inStock !== false,
              stockCount: Number(item.stockCount ?? item.quantity ?? 0),
            }));
            break;
          }
        } catch (_) {}
      }
    }

    // 2. Check DataMart wallet balance
    if (balance === null) {
      const balanceUrls = [
        "https://api.datamartgh.shop/api/developer/user/balance",
        "https://api.datamartgh.shop/api/developer/balance",
        "https://api.datamartgh.shop/api/checkers/balance",
        "https://api.datamartgh.shop/api/developer/wallet-balance",
      ];
      for (const url of balanceUrls) {
        try {
          const r = await fetch(url, { headers, signal: AbortSignal.timeout(6000) });
          let j = await r.json().catch(() => ({}));
          let bal = j?.data?.walletBalance ?? j?.data?.balance ?? j?.walletBalance ?? j?.balance ?? j?.data?.user?.walletBalance;

          if ((bal === undefined || bal === null) && headers["x-api-secret"]) {
            const rNoSec = await fetch(url, {
              headers: { "x-api-key": key, Accept: "application/json" },
              signal: AbortSignal.timeout(6000),
            });
            const jNoSec = await rNoSec.json().catch(() => ({}));
            bal = jNoSec?.data?.walletBalance ?? jNoSec?.data?.balance ?? jNoSec?.walletBalance ?? jNoSec?.balance ?? jNoSec?.data?.user?.walletBalance;
          }

          if (bal !== undefined && bal !== null && !isNaN(Number(bal))) {
            balance = Number(bal);
            try {
              supabase.from("settings").upsert({ key: "datamart_last_balance", value: String(balance) }, { onConflict: "key" }).then(() => {}).catch(() => {});
            } catch (_) {}
            break;
          }
        } catch (_) {}
      }
    }

    if (balance !== null) break;
  }

  // Fallback balance from settings if DataMart API was unreachable
  if (balance === null) {
    try {
      const { data: sRow } = await supabase.from("settings").select("value").eq("key", "datamart_last_balance").maybeSingle();
      if (sRow?.value && !isNaN(Number(sRow.value))) {
        balance = Number(sRow.value);
      }
    } catch (_) {}
  }

  // If supplier doesn't expose a card counter list, synthesize available automated items
  if (stock.length === 0) {
    stock = [
      { id: "WAEC", name: "WAEC Result Checker", price: 20, inStock: true, stockCount: "Automated PIN Delivery" },
      { id: "BECE", name: "BECE Result Checker", price: 20, inStock: true, stockCount: "Automated PIN Delivery" },
    ];
  }

  return { stock, balance };
}

export default async function handler(req: any, res: any) {
  setCorsHeaders(res);
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const body = parseBody(req);
  const fn = (
    req.query?.fn ||
    req.headers?.["x-function-name"] ||
    body?.fn ||
    (req.url?.includes("checker-products")
      ? "checker-products"
      : req.url?.includes("admin-checkers")
      ? "admin-checkers"
      : req.url?.includes("checker-init")
      ? "checker-init"
      : req.url?.includes("checker-verify")
      ? "checker-verify"
      : "")
  ).toLowerCase();

  const supabase = getSupabase();
  if (await detectAndBlockIntrusion(req, res, supabase)) return;

  let PAYSTACK_SECRET_KEY = cleanApiKey(
    process.env.PAYSTACK_SECRET_KEY ||
    process.env.VITE_PAYSTACK_SECRET_KEY ||
    ""
  );

  async function resolvePaystackKey() {
    if (!PAYSTACK_SECRET_KEY) {
      const { data: psRows } = await supabase
        .from("settings")
        .select("key, value")
        .in("key", ["paystack_secret_key", "PAYSTACK_SECRET_KEY", "paystack_secret", "PAYSTACK_SECRET", "paystack_key", "PAYSTACK_KEY", "paystack_live_secret_key"]);
      for (const row of psRows || []) {
        const c = cleanApiKey(row?.value);
        if (c && c.startsWith("sk_")) {
          PAYSTACK_SECRET_KEY = c;
          break;
        } else if (c && !PAYSTACK_SECRET_KEY) {
          PAYSTACK_SECRET_KEY = c;
        }
      }
    }
    return PAYSTACK_SECRET_KEY;
  }

  let DATAMART_API_KEY = cleanApiKey(
    process.env.DATAMART_API_KEY ||
    process.env.DM_API_KEY ||
    process.env.VITE_DATAMART_API_KEY ||
    ""
  );

  async function resolveDatamartKey() {
    if (!DATAMART_API_KEY) {
      const { data: sRow } = await supabase
        .from("settings")
        .select("value")
        .in("key", ["datamart_api_key", "DATAMART_API_KEY", "dm_api_key"])
        .maybeSingle();
      if (sRow?.value) DATAMART_API_KEY = cleanApiKey(sRow.value);
    }
    return DATAMART_API_KEY;
  }

  // 1. Public Checker Products list (for ResultCheckerSection)
  if (fn === "checker-products" || fn === "products") {
    try {
      const { data: settings } = await supabase
        .from("settings")
        .select("key,value")
        .in("key", ["waec_price", "bece_price"]);
      const smap = Object.fromEntries((settings || []).map((s: any) => [s.key, s.value]));

      let stock: Record<string, { inStock: boolean; stockCount: number; cost: number }> = {};
      const { stock: rawStock } = await fetchDatamartStockAndBalance(supabase);
      for (const p of rawStock) {
        stock[String(p.name).toUpperCase()] = {
          inStock: p.inStock !== false,
          stockCount: Number(p.stockCount) || 0,
          cost: Number(p.price) || 0,
        };
      }

      const build = (type: "WAEC" | "BECE", settingKey: string) => ({
        type,
        price: Number(smap[settingKey]) > 0 ? Number(smap[settingKey]) : DEFAULT_PRICE,
        cost: stock[type]?.cost ?? null,
        inStock: stock[type]?.inStock ?? true,
        stockCount: stock[type]?.stockCount ?? null,
      });

      res.setHeader("Cache-Control", "public, max-age=120, s-maxage=300, stale-while-revalidate=600");
      return res.status(200).json({ checkers: [build("WAEC", "waec_price"), build("BECE", "bece_price")] });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || "Failed to load products" });
    }
  }

  // 2. Admin Checkers Overview & Price Management
  if (fn === "admin-checkers" || fn === "admin") {
    try {
      const auth = await verifyAdminUser(req, supabase);
      if (!auth.authorized) {
        return res.status(401).json({ error: auth.error || "Unauthorized: Administrator privileges required." });
      }

      const action = body?.action || "overview";

      if (action === "setPrices") {
        const waec = Number(body.waec_price);
        const bece = Number(body.bece_price);
        if (!Number.isFinite(waec) || waec <= 0) return res.status(400).json({ error: "Invalid WAEC price" });
        if (!Number.isFinite(bece) || bece <= 0) return res.status(400).json({ error: "Invalid BECE price" });
        await supabase.from("settings").upsert([
          { key: "waec_price", value: String(waec) },
          { key: "waec_checker_price", value: String(waec) },
          { key: "bece_price", value: String(bece) },
          { key: "bece_checker_price", value: String(bece) },
        ], { onConflict: "key" });
        return res.status(200).json({ ok: true, waec_price: waec, bece_price: bece });
      }

      if (action === "resendSms" || action === "sendSms") {
        const { reference, phone, serial_number, pin, checker_type } = body;
        const targetPhone = phone || "";
        const targetSerial = serial_number || "N/A";
        const targetPin = pin || "N/A";
        const targetType = checker_type || "Result Checker";
        const smsMsg = `DATA 1 GH: Your ${targetType} Result Checker Details:\nSerial: ${targetSerial}\nPIN: ${targetPin}\nRef: ${reference || "N/A"}\nCheck results at the official WAEC/BECE portal. Thank you for choosing DATA 1 GH!`;
        const smsResult = await sendArkeselSms(supabase, targetPhone, smsMsg);
        return res.status(200).json(smsResult);
      }

      if (action === "retryPurchase") {
        const ref = String(body.reference || "").trim();
        const { data: rawOrd } = await supabase.from("checker_orders").select("*").eq("reference", ref).maybeSingle();
        if (!rawOrd) return res.status(404).json({ error: "Order not found" });
        const ord = enrichCheckerOrder(rawOrd);

        const outcome = await purchaseCheckerFromDatamart({
          checkerType: ord.checker_type,
          phoneNumber: ord.customer_phone,
          reference: ord.reference,
        }, supabase);

        let cNotes = ord.notes || "";
        if (outcome.success) {
          cNotes = setCheckerNoteTag(cNotes, "serial", outcome.serialNumber || "");
          cNotes = setCheckerNoteTag(cNotes, "pin", outcome.pin || "");
          cNotes = setCheckerNoteTag(cNotes, "dm_ref", outcome.reference || "");
          cNotes = setCheckerNoteTag(cNotes, "delivered_at", new Date().toISOString());
          cNotes = setCheckerNoteTag(cNotes, "error", "");
          await supabase.from("checker_orders").update({
            delivery_status: "delivered",
            notes: cNotes || null,
          }).eq("id", ord.id);

          if (ord.customer_phone && (outcome.pin || outcome.serialNumber)) {
            const type = ord.checker_type || "Result Checker";
            const smsMsg = `DATA 1 GH: Your ${type} Result Checker Details:\nSerial: ${outcome.serialNumber || "N/A"}\nPIN: ${outcome.pin || "N/A"}\nRef: ${ord.reference}\nCheck results at the official WAEC/BECE portal. Thank you for choosing DATA 1 GH!`;
            sendArkeselSms(supabase, ord.customer_phone, smsMsg).catch(() => {});
          }
          return res.status(200).json({
            ok: true,
            order: enrichCheckerOrder({ ...ord, delivery_status: "delivered", notes: cNotes }),
          });
        } else {
          cNotes = setCheckerNoteTag(cNotes, "error", outcome.error || "Retry failed");
          await supabase.from("checker_orders").update({
            delivery_status: "failed",
            notes: cNotes || null,
          }).eq("id", ord.id);
          return res.status(400).json({ error: outcome.error || "Retry purchase failed" });
        }
      }

      if (action === "manualFulfill") {
        const ref = String(body.reference || "").trim();
        const serial = String(body.serial_number || "").trim();
        const pin = String(body.pin || "").trim();
        if (!ref) return res.status(400).json({ error: "Order reference required" });
        if (!serial && !pin) return res.status(400).json({ error: "Serial number or PIN is required" });

        const { data: rawOrd } = await supabase.from("checker_orders").select("*").eq("reference", ref).maybeSingle();
        if (!rawOrd) return res.status(404).json({ error: "Order not found" });
        const ord = enrichCheckerOrder(rawOrd);

        let cNotes = setCheckerNoteTag(ord.notes, "serial", serial || "");
        cNotes = setCheckerNoteTag(cNotes, "pin", pin || "");
        cNotes = setCheckerNoteTag(cNotes, "delivered_at", new Date().toISOString());
        cNotes = setCheckerNoteTag(cNotes, "error", "");

        await supabase.from("checker_orders").update({
          delivery_status: "delivered",
          notes: cNotes || null,
        }).eq("id", ord.id);

        if (ord.customer_phone) {
          const type = ord.checker_type || "Result Checker";
          const smsMsg = `DATA 1 GH: Your ${type} Result Checker Details:\nSerial: ${serial || "N/A"}\nPIN: ${pin || "N/A"}\nRef: ${ord.reference}\nCheck results at the official WAEC/BECE portal. Thank you for choosing DATA 1 GH!`;
          sendArkeselSms(supabase, ord.customer_phone, smsMsg).catch(() => {});
        }
        return res.status(200).json({
          ok: true,
          order: enrichCheckerOrder({ ...ord, delivery_status: "delivered", notes: cNotes }),
        });
      }

      // Default: Overview
      const [ordersRes, settingsRes] = await Promise.all([
        supabase.from("checker_orders").select("*").order("created_at", { ascending: false }).limit(60),
        supabase.from("settings").select("key,value").in("key", ["waec_price", "bece_price"]),
      ]);
      const smap = Object.fromEntries((settingsRes.data || []).map((s: any) => [s.key, s.value]));

      const { stock, balance } = await fetchDatamartStockAndBalance(supabase);

      return res.status(200).json({
        orders: (ordersRes.data || []).map(enrichCheckerOrder),
        waec_price: Number(smap.waec_price) || 20,
        bece_price: Number(smap.bece_price) || 20,
        stock,
        balance,
      });
    } catch (err: any) {
      console.error("admin-checkers error:", err);
      return res.status(500).json({ error: err?.message || "Failed to load admin checkers" });
    }
  }

  // 3. Checker Init
  if (fn === "checker-init" || fn === "init") {
    try {
      const psKey = await resolvePaystackKey();
      if (!psKey) {
        return res.status(503).json({ error: "PAYSTACK_SECRET_KEY not configured in Vercel environment" });
      }

      const { checker_type, customer_phone, customer_email, customer_name, callback_url, agent_id: rawAgentId, agent_slug: rawAgentSlug } = body;
      const agent_id = String(rawAgentId || body?.metadata?.agent_id || "").trim();
      const agent_slug = String(rawAgentSlug || body?.metadata?.agent_slug || "").trim();
      const type = String(checker_type || "").toUpperCase();
      if (type !== "WAEC" && type !== "BECE") {
        return res.status(400).json({ error: "Invalid checker type (must be WAEC or BECE)" });
      }

      const rawPhone = String(customer_phone || "").replace(/\s+/g, "");
      let phone = rawPhone;
      if (/^\+?233\d{9}$/.test(rawPhone)) {
        phone = "0" + rawPhone.replace(/^\+?233/, "");
      } else if (/^\d{9}$/.test(rawPhone)) {
        phone = "0" + rawPhone;
      }
      if (!/^0\d{9}$/.test(phone)) {
        return res.status(400).json({ error: "Invalid Ghana phone number" });
      }

      const cleanName = customer_name ? String(customer_name).trim().slice(0, 120) : null;
      const storedName = agent_id ? `${cleanName ? cleanName + " " : ""}[agent:${agent_id}]` : cleanName;
      const email =
        customer_email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer_email)
          ? String(customer_email).trim()
          : `${phone}@datashop-receipts.com`;

      let amount = DEFAULT_PRICE;
      const settingKey = type === "WAEC" ? "waec_price" : "bece_price";
      const { data: priceRow } = await supabase
        .from("settings")
        .select("value")
        .eq("key", settingKey)
        .maybeSingle();

      const parsed = Number(priceRow?.value);
      amount = Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_PRICE;

      const customAmt = Number(body?.amount);
      if (Number.isFinite(customAmt) && customAmt >= amount) {
        amount = Math.round(customAmt * 100) / 100;
      }

      const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
      const tail = Date.now().toString(36).slice(-4).toUpperCase();
      const reference = `WS-CK${tail}${rand}`;

      const psRes = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${psKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          amount: Math.round(amount * 100),
          currency: "GHS",
          reference,
          callback_url: safeCallbackUrl(callback_url) || undefined,
          metadata: {
            checker_type: type,
            customer_phone: phone,
            is_service: true,
            ignore_bot: true,
            skip_bot: true,
            agent_id: agent_id || undefined,
            agent_slug: agent_slug || undefined,
          },
        }),
      });

      const psData = await psRes.json().catch(() => ({}));
      if (!psRes.ok || !psData.status) {
        return res.status(502).json({ error: psData?.message || "Payment init failed" });
      }

      let checkerNotes = userNotes || "";
      if (storedName) {
        checkerNotes = `[name:${storedName}] ${checkerNotes}`.trim();
      }
      if (agent_id) {
        checkerNotes = `[agent:${agent_id}] ${checkerNotes}`.trim();
      }

      const { error: oErr } = await supabase.from("checker_orders").insert({
        checker_type: type,
        customer_phone: phone,
        customer_email: email,
        amount,
        reference,
        status: "pending",
        delivery_status: "pending",
        notes: checkerNotes || null,
      });

      if (oErr) {
        return res.status(500).json({ error: oErr.message });
      }

      return res.status(200).json({
        authorization_url: psData.data.authorization_url,
        reference,
      });
    } catch (err: any) {
      console.error("checkers/init error:", err);
      return res.status(500).json({ error: err?.message || "Internal server error" });
    }
  }

  // 4. Checker Verify
  if (fn === "checker-verify" || fn === "verify") {
    try {
      const psKey = await resolvePaystackKey();
      if (!psKey) {
        return res.status(503).json({ error: "PAYSTACK_SECRET_KEY not configured" });
      }

      const reference = body?.reference || req.query?.reference;
      if (!reference || typeof reference !== "string") {
        return res.status(400).json({ error: "Missing reference" });
      }

      const { data: rawOrder } = await supabase
        .from("checker_orders")
        .select("*")
        .eq("reference", reference)
        .maybeSingle();

      if (!rawOrder) return res.status(404).json({ error: "Order not found" });
      const order = enrichCheckerOrder(rawOrder);

      if (order.delivery_status === "delivered" && order.pin) {
        return res.status(200).json({ order });
      }

      let paid = order.status === "paid" || order.payment_status === "paid";
      if (!paid) {
        const verRes = await fetch(
          `${PAYSTACK_BASE}/transaction/verify/${encodeURIComponent(reference)}`,
          {
            headers: { Authorization: `Bearer ${psKey}` },
          }
        );
        const verData = await verRes.json().catch(() => ({}));
        if (!verRes.ok || !verData.status) {
          return res.status(502).json({ error: "Verify failed" });
        }

        const status = verData.data?.status;
        if (status !== "success") {
          // NEVER revert a confirmed payment - once paid, always paid
          if (order.status !== "paid" && order.payment_status !== "paid") {
            await supabase
              .from("checker_orders")
              .update({
                status: status === "abandoned" ? "pending" : "failed",
              })
              .eq("reference", reference);
          }

          const { data: o2 } = await supabase
            .from("checker_orders")
            .select("*")
            .eq("reference", reference)
            .maybeSingle();
          return res.status(200).json({ order: enrichCheckerOrder(o2) });
        }

        await supabase
          .from("checker_orders")
          .update({ status: "paid" })
          .eq("reference", reference);
        paid = true;
      }

      const dmRes = await purchaseCheckerFromDatamart({
        checkerType: order.checker_type,
        phoneNumber: order.customer_phone,
        reference: order.reference,
      }, supabase);

      let cNotes = order.notes || "";
      let deliveryStatus = "failed";
      let errorMsg: string | null = null;
      let serialVal = "N/A";
      let pinVal = "N/A";

      if (dmRes.success) {
        deliveryStatus = "delivered";
        serialVal = dmRes.serialNumber || "N/A";
        pinVal = dmRes.pin || "N/A";
        cNotes = setCheckerNoteTag(cNotes, "serial", dmRes.serialNumber || "");
        cNotes = setCheckerNoteTag(cNotes, "pin", dmRes.pin || "");
        cNotes = setCheckerNoteTag(cNotes, "dm_ref", dmRes.reference || "");
        cNotes = setCheckerNoteTag(cNotes, "delivered_at", new Date().toISOString());
        cNotes = setCheckerNoteTag(cNotes, "error", "");
      } else {
        deliveryStatus = "failed";
        errorMsg = dmRes.error || "Purchase failed";
        cNotes = setCheckerNoteTag(cNotes, "error", errorMsg);
      }

      await supabase.from("checker_orders").update({
        status: "paid",
        delivery_status: deliveryStatus,
        notes: cNotes || null,
      }).eq("reference", reference);

      if (deliveryStatus === "delivered" && (dmRes.pin || dmRes.serialNumber)) {
        const serial = serialVal;
        const pin = pinVal;
        const type = order.checker_type || "Result Checker";
        const smsMsg = `DATA 1 GH: Your ${type} Result Checker Details:\nSerial: ${serial}\nPIN: ${pin}\nRef: ${reference}\nCheck your results at the official WAEC/BECE portal. Thank you for choosing DATA 1 GH!`;
        if (order.customer_phone) {
          sendArkeselSms(supabase, order.customer_phone, smsMsg).catch((err) =>
            console.warn("Checker SMS delivery error:", err)
          );
        }
      } else if (deliveryStatus === "failed") {
        sendAdminFailedCheckerSms(supabase, reference, errorMsg).catch(() => {});
      }

      // Send automatic payment alert to admin
      sendPaymentReceivedNotification({
        reference: order.reference,
        amount: order.amount,
        itemDescription: `${(order.checker_type || "WAEC").toUpperCase()} Result Checker Card`,
        recipientPhone: order.customer_phone,
        customerPhone: order.customer_phone,
        customerEmail: order.customer_email,
        orderType: "checker",
      }, supabase).catch(() => {});

      // If order belongs to an agent, credit agent profit immediately
      const cAgMatch = order.customer_name?.match(/\[agent:([^\]]+)\]/);
      const agentId = cAgMatch ? cAgMatch[1] : (order.metadata?.agent_id || null);
      if (agentId) {
        try {
          const { recordAgentOrder, loadBasePrices, resolveOrderBasePrice } = await import("./agent.js");
          const basePrices = await loadBasePrices(supabase);
          const baseCost = resolveOrderBasePrice(order, basePrices);
          const profit = Math.max(0, Number((Number(order.amount) - baseCost).toFixed(2)));
          await recordAgentOrder(supabase, {
            agent_id: agentId,
            reference: order.reference,
            network: "CHECKER",
            package_size: `${order.checker_type || "WAEC"} Result Checker`,
            phone: order.customer_phone,
            amount: Number(order.amount),
            base_price: baseCost,
            agent_profit: profit,
            status: deliveryStatus || "delivered",
          });
        } catch (agErr) {
          console.warn("Could not record agent profit for checker order:", agErr);
        }
      }

      const { data: rawFinalOrder } = await supabase
        .from("checker_orders")
        .select("*")
        .eq("reference", reference)
        .maybeSingle();

      return res.status(200).json({ order: enrichCheckerOrder(rawFinalOrder) });
    } catch (err: any) {
      console.error("checkers/verify error:", err);
      return res.status(500).json({ error: err?.message || "Internal server error" });
    }
  }

  // ----------------------------------------------------
    return res.status(400).json({ error: "Unknown action for checkers endpoint." });
}