import { createClient } from "@supabase/supabase-js";
import { verifyAdminUser, getSupabase, getEnvVar } from "./_supabase.js";
import { sendPaymentReceivedNotification } from "./_notifications.js";
import { DEFAULT_PRODUCTS } from "../src/lib/networks.js";
import { detectAndBlockIntrusion } from "./_firewall.js";

// In-memory cache to slash Supabase database egress
let memoryShopProducts: any[] | null = null;
let memoryShopProductsLoadedAt = 0;
const PRODUCTS_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes cache for products catalog

let memoryShopSettings: any[] | null = null;
let memoryShopSettingsLoadedAt = 0;
const SETTINGS_CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes cache for settings (refresh=true bypasses)

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

export const PAYSTACK_BASE = "https://api.paystack.co";
export const GMAIL_BASE = "https://gmail.googleapis.com/gmail/v1";

export function parseNoteTag(notes: string | null | undefined, tag: string): string | null {
  if (!notes) return null;
  const match = notes.match(new RegExp(`\\[${tag}:([^\\]]+)\\]`));
  return match ? match[1].trim() : null;
}

export function setNoteTag(notes: string | null | undefined, tag: string, value: string | null | undefined): string {
  let str = (notes || "").trim();
  const regex = new RegExp(`\\[${tag}:[^\\]]*\\]\\s*`, "g");
  str = str.replace(regex, "").trim();
  if (value !== null && value !== undefined && String(value).trim() !== "") {
    str = str ? `${str} [${tag}:${String(value).trim()}]` : `[${tag}:${String(value).trim()}]`;
  }
  return str;
}

export function enrichServiceOrder(order: any) {
  if (!order || typeof order !== "object") return order;
  const notes = order.notes || "";
  const customer_name = order.customer_name || parseNoteTag(notes, "name") || null;
  const payment_status = order.payment_status || order.status || "pending";
  const netflix_last_code = order.netflix_last_code || parseNoteTag(notes, "netflix_code") || parseNoteTag(notes, "code") || null;
  const netflix_last_code_at = order.netflix_last_code_at || parseNoteTag(notes, "netflix_code_at") || null;
  const netflix_login_expires_at = order.netflix_login_expires_at || parseNoteTag(notes, "netflix_login_expires_at") || null;

  const boost_service_id = parseNoteTag(notes, "boost_service_id") || parseNoteTag(notes, "service_id") || null;
  const boost_service_name = parseNoteTag(notes, "boost_service_name") || null;
  const boost_platform = parseNoteTag(notes, "boost_platform") || null;
  const boost_link = parseNoteTag(notes, "boost_link") || parseNoteTag(notes, "link") || null;
  const boost_quantity = parseNoteTag(notes, "boost_quantity") || parseNoteTag(notes, "quantity") || null;
  const boost_order_id = parseNoteTag(notes, "boost_order_id") || null;
  const boost_status = parseNoteTag(notes, "boost_status") || null;
  const boost_dispatch_error = parseNoteTag(notes, "boost_dispatch_error") || null;

  const service_name =
    order.service === "netflix"
      ? "Netflix 30-Day Premium Account"
      : order.service === "afa"
        ? "MTN AFA Registration"
        : order.service === "mashup"
          ? "MTN Mashup Bundle"
          : order.service === "boost"
            ? (boost_service_name || "Social Media Boost")
            : (order.service_name || order.service || "Service");

  return {
    ...order,
    service_type: order.service_type || order.service,
    service: order.service || order.service_type,
    service_name,
    customer_name,
    payment_status,
    status: payment_status,
    netflix_last_code,
    netflix_last_code_at,
    netflix_login_expires_at,
    boost_service_id,
    boost_service_name,
    boost_platform,
    boost_link,
    boost_quantity,
    boost_order_id,
    boost_status,
    boost_dispatch_error,
  };
}

const DEFAULTS: Record<string, { amount: number; label: string; prefix: string; settingKey: string }> = {
  netflix: { amount: 30, label: "Netflix 1-month sign-in", prefix: "NF", settingKey: "netflix_price" },
  afa: { amount: 20, label: "AFA registration", prefix: "AF", settingKey: "afa_price" },
  mashup: { amount: 25, label: "MTN Mashup", prefix: "MU", settingKey: "mashup_price" },
  boost: { amount: 5, label: "Social Media Boost", prefix: "SB", settingKey: "boost_price" },
};

export const BOOSTUPGH_API_BASE = "https://www.boostupgh.com/api/v2";

export const DEFAULT_BOOST_SERVICES = [
  // TikTok
  {
    service: 101,
    name: "TikTok Followers [HQ - Instant Start - High Retention]",
    category: "TikTok Followers",
    platform: "tiktok",
    rate: 14.50,
    min: 100,
    max: 50000,
    refill: true,
    cancel: false,
  },
  {
    service: 102,
    name: "TikTok Video Likes [Real & Active - Fast Speed]",
    category: "TikTok Likes",
    platform: "tiktok",
    rate: 6.50,
    min: 100,
    max: 100000,
    refill: true,
    cancel: true,
  },
  {
    service: 103,
    name: "TikTok Video Views [Ultra Fast - High Retention]",
    category: "TikTok Views",
    platform: "tiktok",
    rate: 0.90,
    min: 500,
    max: 1000000,
    refill: false,
    cancel: true,
  },
  {
    service: 104,
    name: "TikTok Video Shares & Saves Combo",
    category: "TikTok Engagement",
    platform: "tiktok",
    rate: 4.50,
    min: 100,
    max: 50000,
    refill: false,
    cancel: true,
  },

  // Instagram
  {
    service: 201,
    name: "Instagram Followers [Guaranteed Real - 30 Days Refill]",
    category: "Instagram Followers",
    platform: "instagram",
    rate: 12.00,
    min: 100,
    max: 50000,
    refill: true,
    cancel: true,
  },
  {
    service: 202,
    name: "Instagram Post & Reel Likes [Instant - Super Fast]",
    category: "Instagram Likes",
    platform: "instagram",
    rate: 5.50,
    min: 100,
    max: 50000,
    refill: true,
    cancel: true,
  },
  {
    service: 203,
    name: "Instagram Reel / Video Views [Speed: 100K/Day]",
    category: "Instagram Views",
    platform: "instagram",
    rate: 1.20,
    min: 500,
    max: 500000,
    refill: false,
    cancel: true,
  },
  {
    service: 204,
    name: "Instagram Custom Comments [Positive Real Comments]",
    category: "Instagram Comments",
    platform: "instagram",
    rate: 28.00,
    min: 10,
    max: 1500,
    type: "Custom Comments",
    refill: false,
    cancel: true,
  },

  // Facebook
  {
    service: 301,
    name: "Facebook Page Followers & Likes [HQ - Non Drop]",
    category: "Facebook Followers",
    platform: "facebook",
    rate: 16.00,
    min: 100,
    max: 30000,
    refill: true,
    cancel: false,
  },
  {
    service: 302,
    name: "Facebook Post Reactions [Like, Love, Care]",
    category: "Facebook Likes",
    platform: "facebook",
    rate: 8.50,
    min: 100,
    max: 20000,
    refill: true,
    cancel: true,
  },
  {
    service: 303,
    name: "Facebook Video & Reel Views [Real Monetizable Views]",
    category: "Facebook Views",
    platform: "facebook",
    rate: 2.50,
    min: 500,
    max: 200000,
    refill: false,
    cancel: true,
  },

  // YouTube
  {
    service: 401,
    name: "YouTube Channel Subscribers [HQ - 30d Refill]",
    category: "YouTube Subscribers",
    platform: "youtube",
    rate: 45.00,
    min: 50,
    max: 10000,
    refill: true,
    cancel: false,
  },
  {
    service: 402,
    name: "YouTube Video Views [High Watch Time Retention]",
    category: "YouTube Views",
    platform: "youtube",
    rate: 18.00,
    min: 500,
    max: 500000,
    refill: true,
    cancel: true,
  },
  {
    service: 403,
    name: "YouTube Video Likes [Instant Start]",
    category: "YouTube Likes",
    platform: "youtube",
    rate: 12.00,
    min: 50,
    max: 20000,
    refill: true,
    cancel: true,
  },

  // Twitter / X
  {
    service: 501,
    name: "Twitter (X) Followers [Real Looking - 30d Guarantee]",
    category: "Twitter Followers",
    platform: "twitter",
    rate: 22.00,
    min: 100,
    max: 20000,
    refill: true,
    cancel: false,
  },
  {
    service: 502,
    name: "Twitter (X) Retweets & Likes Combo",
    category: "Twitter Engagement",
    platform: "twitter",
    rate: 14.00,
    min: 100,
    max: 25000,
    refill: false,
    cancel: true,
  },

  // Telegram
  {
    service: 601,
    name: "Telegram Channel & Group Members [Non-Drop 0% Drop]",
    category: "Telegram Members",
    platform: "telegram",
    rate: 10.00,
    min: 100,
    max: 50000,
    refill: true,
    cancel: false,
  },
  {
    service: 602,
    name: "Telegram Post Views [Instant Delivery]",
    category: "Telegram Views",
    platform: "telegram",
    rate: 1.50,
    min: 200,
    max: 100000,
    refill: false,
    cancel: true,
  },

  // WhatsApp
  {
    service: 701,
    name: "WhatsApp Channel Followers [Global Real]",
    category: "WhatsApp Followers",
    platform: "whatsapp",
    rate: 18.00,
    min: 100,
    max: 15000,
    refill: true,
    cancel: false,
  },
];

let memoryBoostServices: any[] | null = null;
let memoryBoostServicesLoadedAt = 0;
const BOOST_SERVICES_CACHE_TTL_MS = 15 * 60 * 1000; // 15 mins cache

export function detectPlatform(category: string, name: string): string {
  const combined = `${category || ""} ${name || ""}`.toLowerCase();
  if (combined.includes("tiktok")) return "tiktok";
  if (combined.includes("instagram") || combined.includes("ig ")) return "instagram";
  if (combined.includes("facebook") || combined.includes("fb ")) return "facebook";
  if (combined.includes("youtube") || combined.includes("yt ")) return "youtube";
  if (combined.includes("twitter") || combined.includes(" x ") || combined.startsWith("x ")) return "twitter";
  if (combined.includes("telegram") || combined.includes("tg ")) return "telegram";
  if (combined.includes("whatsapp")) return "whatsapp";
  if (combined.includes("spotify")) return "spotify";
  if (combined.includes("threads")) return "threads";
  if (combined.includes("linkedin")) return "linkedin";
  return "other";
}

export async function resolveBoostUpGhCredentials(supabase: any) {
  let apiKey =
    getEnvVar([
      "BOOSTUPGH_API_KEY",
      "BOOST_API_KEY",
      "SMM_API_KEY",
      "boostupgh_api_key",
      "boost_api_key",
    ]) || "";

  let markupPercent = 40; // Default 40% profit markup above wholesale BoostUpGH rates

  if (supabase) {
    try {
      const { data: rows } = await supabase
        .from("settings")
        .select("key, value")
        .in("key", ["boostupgh_api_key", "boost_api_key", "smm_api_key", "BOOSTUPGH_API_KEY", "boost_markup_percent"]);

      const smap: Record<string, string> = {};
      (rows || []).forEach((r: any) => { if (r?.key) smap[r.key.toLowerCase()] = String(r.value || "").trim(); });

      if (!apiKey) {
        apiKey = cleanApiKey(smap["boostupgh_api_key"] || smap["boost_api_key"] || smap["smm_api_key"] || smap["boostupgh_api_key".toLowerCase()] || "");
      }
      const parsedMarkup = Number(smap["boost_markup_percent"]);
      if (Number.isFinite(parsedMarkup) && parsedMarkup >= 0) {
        markupPercent = parsedMarkup;
      }
    } catch (_) {}
  }

  return { apiKey: cleanApiKey(apiKey), markupPercent };
}

export async function callBoostUpGh(action: string, params: Record<string, any> = {}, apiKey?: string) {
  if (!apiKey) return { ok: false, error: "BoostUpGH API key not configured" };

  const form = new URLSearchParams();
  form.append("key", apiKey);
  form.append("action", action);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) {
      form.append(k, String(v));
    }
  }

  try {
    const res = await fetch(BOOSTUPGH_API_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
      signal: AbortSignal.timeout(9000),
    });

    const data = await res.json().catch(async () => {
      const text = await res.text().catch(() => "");
      return { error: text || `HTTP ${res.status}` };
    });

    return { ok: res.ok, status: res.status, data };
  } catch (err: any) {
    return { ok: false, error: err?.message || "Network error calling BoostUpGH API" };
  }
}

export async function fetchBoostServices(supabase: any, forceRefresh = false) {
  const now = Date.now();
  const { apiKey, markupPercent } = await resolveBoostUpGhCredentials(supabase);

  if (!forceRefresh && memoryBoostServices && now - memoryBoostServicesLoadedAt < BOOST_SERVICES_CACHE_TTL_MS) {
    return { services: memoryBoostServices, is_live: Boolean(apiKey), markup_percent: markupPercent };
  }

  if (apiKey) {
    try {
      const res = await callBoostUpGh("services", {}, apiKey);
      if (res.ok && Array.isArray(res.data) && res.data.length > 0) {
        const multiplier = 1 + (markupPercent / 100);
        const mapped = res.data.map((item: any) => {
          const rawRate = Number(item.rate) || 1;
          const userRate = Math.round(rawRate * multiplier * 100) / 100;
          const min = Number(item.min) || 1;
          const max = Number(item.max) || 100000;
          const isPackage = String(item.type || "").toLowerCase() === "package" || (min === max && min > 0);
          return {
            service: item.service,
            name: item.name,
            category: item.category || "General",
            platform: detectPlatform(item.category || "", item.name || ""),
            rate: userRate,
            wholesale_rate: rawRate,
            min,
            max,
            type: item.type || "Default",
            is_package: isPackage,
            refill: Boolean(item.refill),
            cancel: Boolean(item.cancel),
          };
        });

        memoryBoostServices = mapped;
        memoryBoostServicesLoadedAt = now;
        return { services: mapped, is_live: true, markup_percent: markupPercent };
      }
    } catch (e) {
      console.warn("Failed to fetch live services from BoostUpGH, using curated catalog:", e);
    }
  }

  // Graceful fallback to default curated catalog with markup applied
  const multiplier = 1 + (markupPercent / 100);
  const fallbackServices = DEFAULT_BOOST_SERVICES.map((s) => ({
    ...s,
    rate: Math.round(s.rate * (markupPercent > 0 ? (1 + (markupPercent - 40) / 100) : 1) * 100) / 100,
  }));

  memoryBoostServices = fallbackServices;
  memoryBoostServicesLoadedAt = now;
  return { services: fallbackServices, is_live: false, markup_percent: markupPercent };
}

export async function dispatchBoostOrder(supabase: any, order: any, apiKey?: string) {
  if (!apiKey) {
    const creds = await resolveBoostUpGhCredentials(supabase);
    apiKey = creds.apiKey;
  }

  const serviceId = parseNoteTag(order.notes, "boost_service_id") || parseNoteTag(order.notes, "service_id");
  const link = parseNoteTag(order.notes, "boost_link") || parseNoteTag(order.notes, "link");
  const quantityStr = parseNoteTag(order.notes, "boost_quantity") || parseNoteTag(order.notes, "quantity");
  const comments = parseNoteTag(order.notes, "boost_comments") || parseNoteTag(order.notes, "comments");
  const quantity = Number(quantityStr);

  if (!apiKey) {
    let updatedNotes = setNoteTag(order.notes || "", "boost_status", "awaiting_api_key");
    await supabase.from("service_orders").update({
      delivery_status: "pending",
      notes: updatedNotes,
    }).eq("reference", order.reference);
    return { ok: false, error: "BoostUpGH API key not set yet in Vercel environment or settings" };
  }

  if (!serviceId || !link || !quantity || isNaN(quantity)) {
    return { ok: false, error: "Missing required boost fields: service_id, link, or quantity" };
  }

  const res = await callBoostUpGh("add", {
    service: serviceId,
    link,
    quantity,
    comments: comments || undefined,
  }, apiKey);

  if (res.ok && res.data && res.data.order) {
    const boostOrderId = String(res.data.order);
    let updatedNotes = setNoteTag(order.notes || "", "boost_order_id", boostOrderId);
    updatedNotes = setNoteTag(updatedNotes, "boost_dispatched_at", new Date().toISOString());
    updatedNotes = setNoteTag(updatedNotes, "boost_status", "in_progress");

    await supabase.from("service_orders").update({
      delivery_status: "in_progress",
      notes: updatedNotes,
    }).eq("reference", order.reference);

    return { ok: true, boost_order_id: boostOrderId };
  } else {
    const errMsg = res.data?.error || res.error || "Failed to dispatch boost order to BoostUpGH";
    let updatedNotes = setNoteTag(order.notes || "", "boost_dispatch_error", String(errMsg));
    updatedNotes = setNoteTag(updatedNotes, "boost_status", "dispatch_failed");

    await supabase.from("service_orders").update({
      delivery_status: "pending",
      notes: updatedNotes,
    }).eq("reference", order.reference);

    return { ok: false, error: errMsg };
  }
}

export async function getBoostOrderStatus(supabase: any, boostOrderId: string | number, apiKey?: string) {
  if (!apiKey) {
    const creds = await resolveBoostUpGhCredentials(supabase);
    apiKey = creds.apiKey;
  }
  if (!apiKey) return { ok: false, error: "BoostUpGH API key not configured" };

  const res = await callBoostUpGh("status", { order: boostOrderId }, apiKey);
  if (!res.ok) {
    return { ok: false, error: res.data?.error || res.error || "Failed to check order status from BoostUpGH" };
  }
  if (res.data?.error) {
    return { ok: false, error: res.data.error };
  }
  return {
    ok: true,
    ...(typeof res.data === "object" ? res.data : {}),
  };
}

export async function getBoostBalance(supabase: any, apiKey?: string) {
  if (!apiKey) {
    const creds = await resolveBoostUpGhCredentials(supabase);
    apiKey = creds.apiKey;
  }
  if (!apiKey) return { ok: false, error: "BoostUpGH API key not configured" };

  const res = await callBoostUpGh("balance", {}, apiKey);
  if (!res.ok) {
    return { ok: false, error: res.data?.error || res.error || "Failed to fetch balance from BoostUpGH" };
  }
  if (res.data?.error) {
    return { ok: false, error: res.data.error };
  }
  const bal = res.data?.balance !== undefined ? String(res.data.balance) : undefined;
  return {
    ok: true,
    balance: bal,
    currency: res.data?.currency || "GHS",
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

export function b64urlDecode(input: string): string {
  const s = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  try {
    const bin = Buffer.from(s + pad, "base64");
    return bin.toString("utf-8");
  } catch {
    return "";
  }
}

export function walkParts(payload: any, out: string[]) {
  if (!payload) return;
  if (payload.body?.data) out.push(b64urlDecode(payload.body.data));
  if (Array.isArray(payload.parts)) {
    payload.parts.forEach((p: any) => walkParts(p, out));
  }
}

export function cleanHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/[\u200B-\u200F\uFEFF\u034F]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractCode(text: string, subject = ""): string | null {
  const combined = `${subject}\n${text}`;
  const cleaned = combined.replace(/\r/g, "");
  const noHtml = cleanHtml(cleaned);

  // 1. Check subject first if it specifically contains code
  if (subject) {
    const subjClean = cleanHtml(subject);
    const subjMatch =
      subjClean.match(/(?:code|sign[- ]in|access|código)[^\d]{0,25}(\d{4,6})/i) ||
      subjClean.match(/^(\d{4,6})\s+is your/i);
    if (subjMatch && !["2024", "2025", "2026", "2027"].includes(subjMatch[1])) {
      return subjMatch[1];
    }
  }

  // 2. Prominent HTML table cell (Netflix standard: <td ...> 7050 </td>)
  const tdMatch = cleaned.match(/<td[^>]*>(?:\s*|&nbsp;)*(\d{4,6})(?:\s*|&nbsp;)*<\/td>/i);
  if (tdMatch && !["2024", "2025", "2026", "2027"].includes(tdMatch[1])) {
    return tdMatch[1];
  }

  // 3. Immediately followed by "Enter the code above"
  const aboveMatch = noHtml.match(/(\d{4,6})\s+Enter the code above/i);
  if (aboveMatch && !["2024", "2025", "2026", "2027"].includes(aboveMatch[1])) {
    return aboveMatch[1];
  }

  // 4. Look for spaced digits like "1 2 3 4" or "9  8  7  6" following key Netflix phrases
  const spacedMatch =
    cleaned.match(
      /(?:temporary\s+(?:sign[- ]in|access)?\s*code|sign[- ]in\s+code|access\s+code|single[- ]use\s+code|security\s+code|verification\s+code|your\s+code\s+is|enter\s+this\s+code|use\s+this\s+code)[^\d]{0,60}(\d\s+\d\s+\d\s+\d(?:\s+\d\s+\d)?)/i
    ) ||
    noHtml.match(
      /(?:temporary\s+(?:sign[- ]in|access)?\s*code|sign[- ]in\s+code|access\s+code|single[- ]use\s+code|security\s+code|verification\s+code|your\s+code\s+is|enter\s+this\s+code|use\s+this\s+code)[^\d]{0,60}(\d\s+\d\s+\d\s+\d(?:\s+\d\s+\d)?)/i
    );
  if (spacedMatch) {
    const compact = spacedMatch[1].replace(/\s+/g, "");
    if (compact.length >= 4 && compact.length <= 6 && !["2024", "2025", "2026", "2027"].includes(compact)) {
      return compact;
    }
  }

  // 5. Common contextual Netflix phrases with expanded tolerance for whitespace/invisible characters
  const patterns = [
    /(?:enter\s+(?:this|the)\s+code(?:\s+to\s+sign\s+in)?)[^\d]{0,120}(\d{4,6})/i,
    /(?:temporary\s+(?:sign[- ]in|access)?\s*code)[^\d]{0,80}(\d{4,6})/i,
    /(?:sign[- ]in\s+code)[^\d]{0,80}(\d{4,6})/i,
    /(?:single[- ]use\s+code)[^\d]{0,80}(\d{4,6})/i,
    /(?:security\s+code)[^\d]{0,80}(\d{4,6})/i,
    /(?:verification\s+code)[^\d]{0,80}(\d{4,6})/i,
    /(?:temporary\s+code)[^\d]{0,80}(\d{4,6})/i,
    /(?:your\s+code\s+is)[^\d]{0,80}(\d{4,6})/i,
    /(?:here(?:'s|\s+is)\s+your\s+(?:temporary\s+)?code)[^\d]{0,80}(\d{4,6})/i,
    /(?:use\s+this\s+code)[^\d]{0,80}(\d{4,6})/i,
    /(?:access\s+code)[^\d]{0,80}(\d{4,6})/i,
    /(?:netflix\s+code)[^\d]{0,80}(\d{4,6})/i,
    /(?:code\s*:\s*)(\d{4,6})/i,
    /(?:código\s*(?:de\s+acceso)?)[^\d]{0,80}(\d{4,6})/i,
    /(?:code\s+d['’]acc[eè]s)[^\d]{0,80}(\d{4,6})/i,
  ];

  for (const p of patterns) {
    const m = noHtml.match(p) || cleaned.match(p);
    if (m && !["2024", "2025", "2026", "2027"].includes(m[1])) {
      return m[1];
    }
  }

  // 6. HTML prominent codes (e.g. <h1>1234</h1>, <strong>1234</strong>, <td ...>1234</td>)
  const htmlProminent = cleaned.match(/<(?:h[1-4]|strong|b|span|div|td)[^>]*>(?:\s*|&nbsp;)*(\d{4,6})(?:\s*|&nbsp;)*<\/(?:h[1-4]|strong|b|span|div|td)>/i);
  if (htmlProminent && !["2024", "2025", "2026", "2027"].includes(htmlProminent[1])) {
    return htmlProminent[1];
  }

  // 7. Standalone 4 or 6 digit codes on their own line
  const lineMatch = cleaned.match(/(?:^|\n|\r)\s*(\d{4}|\d{6})\s*(?:\n|\r|$)/);
  if (lineMatch && !["2024", "2025", "2026", "2027"].includes(lineMatch[1])) {
    return lineMatch[1];
  }

  // 8. Generic boundary 4 or 6 digit codes
  const generic = noHtml.match(/\b(\d{4})\b/);
  if (generic && !["2024", "2025", "2026", "2027"].includes(generic[1])) {
    return generic[1];
  }

  const generic6 = noHtml.match(/\b(\d{6})\b/);
  if (generic6) {
    return generic6[1];
  }

  return null;
}

export async function refreshGmailAccessToken(
  supabase: any,
  creds: { clientId: string; clientSecret: string; refreshToken: string }
): Promise<string | null> {
  if (!creds.refreshToken || !creds.clientId || !creds.clientSecret) return null;
  try {
    const cleanClientId = creds.clientId.trim().replace(/\s+/g, "-");
    const cleanSecret = creds.clientSecret.trim();
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      signal: AbortSignal.timeout(8000),
      body: new URLSearchParams({
        client_id: cleanClientId,
        client_secret: cleanSecret,
        refresh_token: creds.refreshToken.trim(),
        grant_type: "refresh_token",
      }),
    });
    const tokenData = await tokenRes.json().catch(() => ({}));
    if (tokenData.access_token) {
      const newExpiresAt = Date.now() + (Number(tokenData.expires_in) || 3600) * 1000;
      await supabase.from("settings").upsert(
        [
          { key: "gmail_access_token", value: tokenData.access_token },
          { key: "gmail_token_expires_at", value: String(newExpiresAt) },
        ],
        { onConflict: "key" }
      );
      return tokenData.access_token;
    }
    if (tokenData.error) {
      console.warn("Google OAuth token refresh rejection:", tokenData.error, tokenData.error_description);
    }
  } catch (e) {
    console.error("Failed to refresh Gmail token:", e);
  }
  return null;
}

export async function resolveGmailCredentials(supabase: any) {
  const { data: rows } = await supabase
    .from("settings")
    .select("key, value")
    .in("key", [
      "netflix_account_email",
      "gmail_account_email",
      "gmail_access_token",
      "gmail_refresh_token",
      "gmail_client_id",
      "gmail_client_secret",
      "gmail_token_expires_at",
      "GMAIL_ACCESS_TOKEN",
      "GMAIL_REFRESH_TOKEN",
      "GMAIL_CLIENT_ID",
      "GMAIL_CLIENT_SECRET",
    ]);

  const map: Record<string, string> = {};
  (rows || []).forEach((r: any) => {
    if (r.key && r.value) map[r.key.toLowerCase()] = String(r.value).trim();
  });

  const netflixEmail =
    map["netflix_account_email"] ||
    getEnvVar(["NETFLIX_ACCOUNT_EMAIL", "netflix_account_email"]) ||
    "stillmoving11@gmail.com";

  let accessToken =
    map["gmail_access_token"] ||
    map["GMAIL_ACCESS_TOKEN".toLowerCase()] ||
    getEnvVar(["GMAIL_ACCESS_TOKEN", "gmail_access_token"]) ||
    "";

  const refreshToken =
    map["gmail_refresh_token"] ||
    map["GMAIL_REFRESH_TOKEN".toLowerCase()] ||
    getEnvVar(["GMAIL_REFRESH_TOKEN", "gmail_refresh_token"]) ||
    "";

  const clientId = (
    map["gmail_client_id"] ||
    map["GMAIL_CLIENT_ID".toLowerCase()] ||
    getEnvVar(["GMAIL_CLIENT_ID", "gmail_client_id"]) ||
    "695163322385-grjddchnib6ambq30ojrc1581ck6s180.apps.googleusercontent.com"
  ).trim().replace(/\s+/g, "-");

  const clientSecret =
    map["gmail_client_secret"] ||
    map["GMAIL_CLIENT_SECRET".toLowerCase()] ||
    getEnvVar(["GMAIL_CLIENT_SECRET", "gmail_client_secret"]) ||
    "";

  const gmailEmail =
    map["gmail_account_email"] ||
    netflixEmail;

  const tokenExpiresAt = Number(map["gmail_token_expires_at"] || 0);
  const isExpiring = !accessToken || (tokenExpiresAt > 0 && Date.now() > tokenExpiresAt - 120000);

  if (isExpiring && refreshToken && clientId && clientSecret) {
    const refreshed = await refreshGmailAccessToken(supabase, { clientId, clientSecret, refreshToken });
    if (refreshed) {
      accessToken = refreshed;
    }
  }

  const isConfigured = Boolean(
    accessToken ||
    refreshToken ||
    map["gmail_refresh_token"] ||
    map["gmail_access_token"]
  );

  return {
    accessToken,
    refreshToken,
    clientId,
    clientSecret,
    netflixEmail,
    gmailEmail,
    isConfigured,
  };
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
      getEnvVar([
        "ARKESEL_API_KEY",
        "VITE_ARKESEL_API_KEY",
        "ARKESEL_KEY",
        "arkesel_api_key",
      ])
    );
    let sender = (getEnvVar(["ARKESEL_SENDER_ID", "arkesel_sender_id"]) || "").trim().slice(0, 11);

    if (!arkeselKey || !sender) {
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
        if (k.includes("sender") && !sender) {
          const s = String(row?.value || "").trim();
          if (s) sender = s.slice(0, 11);
        }
      }
    }

    if (!sender) {
      sender = "D_1Gh";
    }

    if (!arkeselKey) {
      console.warn("sendArkeselSms: Arkesel API key not configured.");
      return { ok: false, error: "Arkesel API key not configured" };
    }

    // Try Arkesel v2 first
    try {
      const res = await fetch("https://sms.arkesel.com/api/v2/sms/send", {
        method: "POST",
        headers: {
          "api-key": arkeselKey,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          sender,
          message: cleanMessage,
          recipients: [formatted],
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        return { ok: true, data };
      }
      console.warn("sendArkeselSms v2 returned non-ok:", data);
    } catch (v2Err) {
      console.warn("sendArkeselSms v2 network error:", v2Err);
    }

    // Fallback to Arkesel v1 endpoint
    try {
      const v1Url = new URL("https://sms.arkesel.com/sms/api");
      v1Url.searchParams.set("action", "send-sms");
      v1Url.searchParams.set("api_key", arkeselKey);
      v1Url.searchParams.set("to", formatted);
      v1Url.searchParams.set("from", sender);
      v1Url.searchParams.set("sms", cleanMessage);

      const v1Res = await fetch(v1Url.toString(), { method: "GET" });
      const v1Data = await v1Res.json().catch(async () => ({ text: await v1Res.text().catch(() => "") }));
      return { ok: v1Res.ok, data: v1Data };
    } catch (v1Err: any) {
      console.error("sendArkeselSms v1 error:", v1Err);
      return { ok: false, error: v1Err?.message };
    }
  } catch (err: any) {
    console.error("sendArkeselSms outer error:", err);
    return { ok: false, error: err?.message };
  }
}

// Owner instruction: ALL automatic SMS are blocked. Set to true to re-enable.
const AUTO_SMS_ENABLED = false;

async function sendAdminFailedServiceSms(supabase: any, ref: string, serviceName: string, errorDetail?: string) {
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
    await sendArkeselSms(supabase, adminPhone, `ALERT: ${serviceName.toUpperCase()} order FAILED for ref ${ref}. Reason: ${errorDetail || "Service error"}. Please check!`);
  } catch (_) { }
}

export default async function handler(req: any, res: any) {
  try {
    setCorsHeaders(res);
    if (req.method === "OPTIONS") {
      return res.status(200).end();
    }

    const body = parseBody(req);
    const fn = (
      req.query?.fn ||
      req.headers?.["x-function-name"] ||
      body?.fn ||
      (req.url?.includes("admin-services")
        ? "admin-services"
        : req.url?.includes("netflix-settings")
          ? "netflix-settings"
          : req.url?.includes("test-gmail")
            ? "test-gmail"
            : req.url?.includes("gmail-auth-url")
              ? "gmail-auth-url"
              : req.url?.includes("gmail-callback")
                ? "gmail-callback"
                : req.url?.includes("netflix-fetch-code")
                  ? "netflix-fetch-code"
                  : req.url?.includes("boost-services")
                    ? "boost-services"
                    : req.url?.includes("boost-status")
                      ? "boost-status"
                      : req.url?.includes("boost-balance")
                        ? "boost-balance"
                        : req.url?.includes("boost-dispatch")
                          ? "boost-dispatch"
                          : req.url?.includes("service-init")
                            ? "service-init"
                            : req.url?.includes("service-verify")
                              ? "service-verify"
                              : "")
    ).toLowerCase();

    let supabase: any;
    try {
      supabase = getSupabase();
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "Missing Supabase credentials." });
    }

    // Active Intrusion Firewall: Blocks PowerShell, shell commands, SQLi, and alerts admin
    if (await detectAndBlockIntrusion(req, res, supabase)) {
      return;
    }

    let PAYSTACK_SECRET_KEY = cleanApiKey(
      getEnvVar([
        "PAYSTACK_SECRET_KEY",
        "VITE_PAYSTACK_SECRET_KEY",
        "PAYSTACK_KEY",
        "paystack_secret_key",
      ])
    );

    const resolvePaystackKey = async () => {
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
    };

    // 1. Service Init
    if (fn === "service-init" || fn === "init") {
      try {
        const psKey = await resolvePaystackKey();
        if (!psKey) {
          return res.status(503).json({
            error: "Paystack secret key is not configured in Vercel Environment Variables.",
          });
        }

        const { service, customer_phone, customer_email, customer_name, callback_url, mashup_package, notes: userNotes, agent_id: rawAgentId, agent_slug: rawAgentSlug } = body;
        const agent_id = String(rawAgentId || body?.metadata?.agent_id || "").trim();
        const agent_slug = String(rawAgentSlug || body?.metadata?.agent_slug || "").trim();
        const sKey = String(service || "").toLowerCase();
        const cfg = DEFAULTS[sKey];
        if (!cfg) return res.status(400).json({ error: "Invalid service (netflix, afa, mashup, or boost)" });

        const rawPhone = String(customer_phone || "").replace(/\s+/g, "");
        let phone = rawPhone;
        if (/^\+?233\d{9}$/.test(rawPhone)) {
          phone = "0" + rawPhone.replace(/^\+?233/, "");
        } else if (/^\d{9}$/.test(rawPhone)) {
          phone = "0" + rawPhone;
        }
        if (!/^0\d{9}$/.test(phone)) {
          return res.status(400).json({ error: "Invalid Ghana phone number (must be 10 digits starting with 0)" });
        }

        const email =
          customer_email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer_email)
            ? customer_email.trim()
            : `${phone}@datashop-receipts.com`;

        let amount = cfg.amount;
        const customAmt = Number(body?.amount);
        if (sKey === "mashup") {
          if (Number.isFinite(customAmt) && customAmt >= 1) {
            amount = Math.round(customAmt * 100) / 100;
          } else {
            const { data: priceRow } = await supabase
              .from("settings")
              .select("value")
              .eq("key", cfg.settingKey)
              .maybeSingle();
            const parsedPrice = Number(priceRow?.value);
            if (Number.isFinite(parsedPrice) && parsedPrice > 0) {
              amount = parsedPrice;
            }
          }
        } else if (sKey === "boost") {
          if (Number.isFinite(customAmt) && customAmt >= 1) {
            amount = Math.round(customAmt * 100) / 100;
          } else {
            amount = 5;
          }
        } else {
          const { data: priceRow } = await supabase
            .from("settings")
            .select("value")
            .eq("key", cfg.settingKey)
            .maybeSingle();
          const parsedPrice = Number(priceRow?.value);
          if (Number.isFinite(parsedPrice) && parsedPrice > 0) {
            amount = parsedPrice;
          }
          // Allow agent markups above base price, but never below configured base price
          if (Number.isFinite(customAmt) && customAmt >= amount) {
            amount = Math.round(customAmt * 100) / 100;
          }
        }

        const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
        const tail = Date.now().toString(36).slice(-4).toUpperCase();
        const reference = `${cfg.prefix}${tail}${rand}`;
        const amountKobo = Math.round(amount * 100);

        // Metadata strictly separated from data bundle fields to prevent WhatsApp bot from treating it as a data order
        const metadataPayload: Record<string, any> =
          sKey === "netflix"
            ? {
              service: "netflix",
              service_name: "Netflix 1 Month",
              customer_phone: phone,
              is_service: true,
              ignore_bot: true,
              skip_bot: true,
              agent_id: agent_id || undefined,
              agent_slug: agent_slug || undefined,
            }
            : sKey === "mashup"
              ? {
                service: "mashup",
                service_name: "MTN Mashup",
                customer_phone: phone,
                package: mashup_package || `GH₵ ${amount} Mashup`,
                is_service: true,
                agent_id: agent_id || undefined,
                agent_slug: agent_slug || undefined,
                custom_fields: [
                  { display_name: "Service", variable_name: "service", value: "MTN Mashup" },
                  { display_name: "Package", variable_name: "mashup_package", value: mashup_package || `GH₵ ${amount}` },
                  { display_name: "Phone", variable_name: "customer_phone", value: phone },
                ],
              }
              : sKey === "boost"
                ? {
                  service: "boost",
                  service_name: "Social Media Boost",
                  customer_phone: phone,
                  is_service: true,
                  ignore_bot: true,
                  skip_bot: true,
                  boost_service_id: body?.boost_service_id || undefined,
                  boost_link: body?.boost_link || undefined,
                  boost_quantity: body?.boost_quantity || undefined,
                  agent_id: agent_id || undefined,
                  agent_slug: agent_slug || undefined,
                }
                : {
                  service: "afa",
                  service_name: "AFA Registration",
                  customer_phone: phone,
                  is_service: true,
                  ignore_bot: true,
                  skip_bot: true,
                  agent_id: agent_id || undefined,
                  agent_slug: agent_slug || undefined,
                };

        const psRes = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${psKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email,
            amount: amountKobo,
            currency: "GHS",
            reference,
            callback_url: safeCallbackUrl(callback_url) || undefined,
            metadata: metadataPayload,
          }),
        });

        const psData = await psRes.json().catch(() => ({}));
        if (!psRes.ok || !psData.status) {
          return res.status(502).json({ error: psData?.message || "Payment initialization failed with Paystack" });
        }

        let orderNotes = sKey === "mashup"
          ? (mashup_package || userNotes || `GH₵ ${amount} Mashup Package`)
          : sKey === "boost"
            ? (userNotes || `Social Media Boost Order`)
            : (userNotes || null);

        if (sKey === "boost") {
          if (body?.boost_service_id) orderNotes = setNoteTag(orderNotes, "boost_service_id", body.boost_service_id);
          if (body?.boost_service_name) orderNotes = setNoteTag(orderNotes, "boost_service_name", body.boost_service_name);
          if (body?.boost_platform) orderNotes = setNoteTag(orderNotes, "boost_platform", body.boost_platform);
          if (body?.boost_link) orderNotes = setNoteTag(orderNotes, "boost_link", body.boost_link);
          if (body?.boost_quantity) orderNotes = setNoteTag(orderNotes, "boost_quantity", body.boost_quantity);
        }

        if (customer_name) {
          orderNotes = `[name:${customer_name}] ${orderNotes || ""}`.trim();
        }
        if (agent_id) {
          orderNotes = `[agent:${agent_id}] ${orderNotes || ""}`.trim();
        }

        const { error: sErr } = await supabase.from("service_orders").insert({
          service: sKey,
          service_type: sKey,
          customer_email: email,
          customer_phone: phone,
          amount,
          reference,
          status: "pending",
          delivery_status: "pending",
          notes: orderNotes || null,
        });

        if (sErr) {
          return res.status(500).json({ error: sErr.message });
        }

        return res.status(200).json({
          authorization_url: psData.data.authorization_url,
          reference,
        });
      } catch (err: any) {
        console.error("services/init error:", err);
        return res.status(500).json({ error: err?.message || "Internal server error" });
      }
    }

    // 2. Service Verify
    if (fn === "service-verify" || fn === "verify") {
      try {
        const psKey = await resolvePaystackKey();
        if (!psKey) {
          return res.status(503).json({
            error: "Paystack secret key is not configured in Vercel Environment Variables.",
          });
        }

        const reference = body?.reference || req.query?.reference;
        if (!reference || typeof reference !== "string") {
          return res.status(400).json({ error: "Missing reference" });
        }

        const { data: rawOrder } = await supabase
          .from("service_orders")
          .select("*")
          .eq("reference", reference)
          .maybeSingle();

        if (!rawOrder) return res.status(404).json({ error: "Order not found" });
        const order = enrichServiceOrder(rawOrder);

        const creds = await resolveGmailCredentials(supabase);

        if (order.status === "paid" || order.payment_status === "paid") {
          return res.status(200).json({
            order,
            netflix_email: creds.netflixEmail,
          });
        }

        const verRes = await fetch(
          `${PAYSTACK_BASE}/transaction/verify/${encodeURIComponent(reference)}`,
          {
            headers: { Authorization: `Bearer ${psKey}` },
          }
        );
        const verData = await verRes.json().catch(() => ({}));
        if (!verRes.ok || !verData.status) {
          return res.status(502).json({ error: verData?.message || "Payment verification failed with Paystack" });
        }

        const status = verData.data?.status;
        if (status !== "success") {
          // NEVER revert a confirmed payment - once paid, always paid
          if (order.status !== "paid" && order.payment_status !== "paid") {
            await supabase
              .from("service_orders")
              .update({
                status: status === "abandoned" ? "pending" : "failed",
              })
              .eq("reference", reference);
          }

          const { data: o2 } = await supabase
            .from("service_orders")
            .select("*")
            .eq("reference", reference)
            .maybeSingle();
          return res.status(200).json({
            order: enrichServiceOrder(o2),
            netflix_email: creds.netflixEmail,
          });
        }

        let updatedNotes = order.notes || "";
        if (order.service === "netflix") {
          const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
          updatedNotes = setNoteTag(updatedNotes, "netflix_login_expires_at", expiresAt);
        }

        const updates: Record<string, unknown> = {
          status: "paid",
          delivery_status: order.service === "netflix" ? "active" : "awaiting_whatsapp",
          notes: updatedNotes || null,
        };

        await supabase.from("service_orders").update(updates).eq("reference", reference);

        const { data: rawFinalOrder } = await supabase
          .from("service_orders")
          .select("*")
          .eq("reference", reference)
          .maybeSingle();
        const finalOrder = enrichServiceOrder(rawFinalOrder);

        if (finalOrder) {
          if (finalOrder.service === "boost") {
            try {
              await dispatchBoostOrder(supabase, finalOrder);
            } catch (bErr) {
              console.warn("Auto-dispatch boost error on verify:", bErr);
            }
          }

          const serviceName =
            finalOrder.service === "netflix"
              ? "Netflix 30-Day Premium Account"
              : finalOrder.service === "afa"
                ? "MTN AFA Registration"
                : finalOrder.service === "mashup"
                  ? "MTN Mashup 50GB Bundle"
                  : finalOrder.service === "boost"
                    ? (finalOrder.boost_service_name || "Social Media Boost")
                    : `${finalOrder.service || "Service"} Order`;

          sendPaymentReceivedNotification({
            reference: finalOrder.reference,
            amount: finalOrder.amount,
            itemDescription: serviceName,
            recipientPhone: finalOrder.customer_phone,
            customerPhone: finalOrder.customer_phone,
            customerEmail: finalOrder.customer_email,
            orderType: finalOrder.service || "service",
          }, supabase).catch(() => { });

          // If order belongs to an agent, credit agent profit immediately
          const agMatch = finalOrder.notes?.match(/\[agent:([^\]]+)\]/);
          const agentId = agMatch ? agMatch[1] : (verData.data?.metadata?.agent_id || null);
          if (agentId) {
            try {
              const { recordAgentOrder, loadBasePrices, resolveOrderBasePrice } = await import("./agent.js");
              const basePrices = await loadBasePrices(supabase);
              const baseCost = resolveOrderBasePrice(finalOrder, basePrices);
              const profit = Math.max(0, Number((Number(finalOrder.amount) - baseCost).toFixed(2)));
              await recordAgentOrder(supabase, {
                agent_id: agentId,
                reference: finalOrder.reference,
                network: finalOrder.service === "netflix" ? "NETFLIX" : "SERVICE",
                package_size: serviceName,
                phone: finalOrder.customer_phone,
                amount: Number(finalOrder.amount),
                base_price: baseCost,
                agent_profit: profit,
                status: "delivered",
              });
            } catch (agErr) {
              console.warn("Could not record agent profit for service order:", agErr);
            }
          }
        }

        return res.status(200).json({
          order: finalOrder,
          netflix_email: creds.netflixEmail,
        });
      } catch (err: any) {
        console.error("services/verify error:", err);
        return res.status(500).json({ error: err?.message || "Internal server error" });
      }
    }

    // 3. Netflix Fetch Code
    if (fn === "netflix-fetch-code" || fn === "netflix-code") {
      try {
        const reference = body?.reference || req.query?.reference;
        if (!reference || typeof reference !== "string") {
          return res.status(400).json({ error: "Missing reference" });
        }

        const { data: rawOrder } = await supabase
          .from("service_orders")
          .select("*")
          .eq("reference", reference)
          .maybeSingle();

        if (!rawOrder) return res.status(404).json({ error: "Order not found" });
        const order = enrichServiceOrder(rawOrder);
        if (order.service !== "netflix") return res.status(400).json({ error: "Not a Netflix order" });
        const adminAuth = await verifyAdminUser(req, supabase).catch(() => ({ authorized: false }));
        const isAdmin = Boolean(adminAuth?.authorized);

        const isConfirmed =
          isAdmin ||
          ["paid", "success", "completed", "manual"].includes(String(order.payment_status || "").toLowerCase()) ||
          ["active", "delivered", "completed", "manual"].includes(String(order.delivery_status || "").toLowerCase()) ||
          Boolean(order.netflix_last_code);

        if (!isConfirmed) return res.status(402).json({ error: "Payment not confirmed yet" });

        if (order.netflix_login_expires_at && new Date(order.netflix_login_expires_at) < new Date()) {
          return res.status(410).json({ error: "Your 30-day access has expired. Please purchase again." });
        }

        const forceRefresh = body?.force || body?.refresh || req.query?.force === "true";
        const shouldResendSms = body?.resend_sms || req.query?.resend_sms === "true";

        const creds = await resolveGmailCredentials(supabase);
        const emailToUse = creds.netflixEmail || "stillmoving11@gmail.com";

        // If code was already delivered and not forcing refresh, return cleanly
        if (order.netflix_last_code && !forceRefresh) {
          if (shouldResendSms && order.customer_phone) {
            const resendText = `DATA 1 GH: Your Netflix sign-in code is: ${order.netflix_last_code}\nAccount: ${emailToUse}\nEnter this code on Netflix to complete sign-in. Valid for 15 minutes.`;
            await sendArkeselSms(supabase, order.customer_phone, resendText);
          }
          return res.status(200).json({
            code: order.netflix_last_code,
            email_at: order.netflix_last_code_at || new Date().toISOString(),
            netflix_email: emailToUse,
            already_used: true,
            message: "Sign-in code retrieved successfully.",
          });
        }

        if (!creds.accessToken) {
          if (order.netflix_last_code) {
            return res.status(200).json({
              code: order.netflix_last_code,
              email_at: order.netflix_last_code_at || new Date().toISOString(),
              netflix_email: emailToUse,
              already_used: true,
              message: "Sign-in code retrieved successfully.",
            });
          }
          return res.status(200).json({
            code: null,
            error: "Gmail is not linked yet by admin. Please contact admin on WhatsApp to get your code immediately.",
            needs_admin: true,
            netflix_email: emailToUse,
          });
        }

        const requestHeaders: Record<string, string> = {
          Authorization: `Bearer ${creds.accessToken}`,
          Accept: "application/json",
        };

        const q = "(from:netflix OR from:account.netflix.com OR subject:netflix OR netflix) newer_than:7d";
        let listRes = await fetch(`${GMAIL_BASE}/users/me/messages?maxResults=8&q=${encodeURIComponent(q)}`, {
          headers: requestHeaders,
          signal: AbortSignal.timeout(5000),
        });

        // If token expired (401), automatically refresh and retry immediately!
        if (!listRes.ok && listRes.status === 401 && creds.refreshToken) {
          const fresh = await refreshGmailAccessToken(supabase, creds);
          if (fresh) {
            requestHeaders.Authorization = `Bearer ${fresh}`;
            listRes = await fetch(`${GMAIL_BASE}/users/me/messages?maxResults=8&q=${encodeURIComponent(q)}`, {
              headers: requestHeaders,
              signal: AbortSignal.timeout(5000),
            });
          }
        }

        if (!listRes.ok) {
          if (order.netflix_last_code) {
            return res.status(200).json({
              code: order.netflix_last_code,
              email_at: order.netflix_last_code_at || new Date().toISOString(),
              netflix_email: emailToUse,
              already_used: true,
              message: "Sign-in code retrieved successfully.",
            });
          }
          const t = await listRes.text().catch(() => "");
          let googleMsg = "";
          try {
            const parsed = JSON.parse(t);
            googleMsg = parsed.error?.message || parsed.error_description || "";
          } catch (_) { }

          let friendlyError = `Gmail connection needs re-authorization (${listRes.status}). Please click 'Connect with Google' in Admin Services > Gmail Setup tab.`;
          if (listRes.status === 403) {
            if (googleMsg.toLowerCase().includes("has not been used in project") || googleMsg.toLowerCase().includes("disabled")) {
              friendlyError = `Gmail API is disabled in your Google Cloud Console project. Go to Google Cloud Console > APIs & Services > Enable APIs & Services and enable "Gmail API".`;
            } else if (googleMsg.toLowerCase().includes("insufficient") || googleMsg.toLowerCase().includes("scope")) {
              friendlyError = `Gmail permissions need re-authorization. Click 'Connect with Google' under Admin Services > Gmail Setup tab to grant Gmail read access.`;
            } else if (googleMsg) {
              friendlyError = `Google error (403): ${googleMsg}. Please re-link in Gmail Setup tab.`;
            }
          }

          return res.status(200).json({
            code: null,
            error: friendlyError,
            detail: t.slice(0, 300),
            needs_admin: true,
            netflix_email: emailToUse,
          });
        }

        const list = await listRes.json().catch(() => ({}));
        const msgs = list.messages || [];
        if (!msgs.length) {
          if (order.netflix_last_code) {
            return res.status(200).json({
              code: order.netflix_last_code,
              email_at: order.netflix_last_code_at || new Date().toISOString(),
              netflix_email: emailToUse,
              already_used: true,
              message: "Sign-in code retrieved successfully.",
            });
          }
          return res.status(200).json({
            code: null,
            error: `No recent Netflix code email found in inbox yet. Enter "${emailToUse}" on Netflix, tap "Send sign-in code", wait 20 seconds, then tap Check Again.`,
            retryable: true,
            netflix_email: emailToUse,
          });
        }

        // Parallel fetch the top 3 newest messages concurrently with a 3.5s timeout (completes in ~700ms total)
        const targetMsgs = msgs.slice(0, 3);
        const fetchedResults = await Promise.all(
          targetMsgs.map(async (m: any) => {
            try {
              const gRes = await fetch(`${GMAIL_BASE}/users/me/messages/${m.id}?format=full`, {
                headers: requestHeaders,
                signal: AbortSignal.timeout(3500),
              });
              if (!gRes.ok) return null;
              return await gRes.json();
            } catch {
              return null;
            }
          })
        );

        let bestCode: string | null = null;
        let bestDate = 0;
        let bestSubject = "";

        // Sort messages descending by internalDate so newest email is analyzed first
        const validMessages = fetchedResults
          .filter(Boolean)
          .sort((a, b) => Number(b.internalDate || 0) - Number(a.internalDate || 0));

        for (const g of validMessages) {
          const internalDate = Number(g.internalDate || 0);
          // Look within the last 7 days
          if (internalDate && Date.now() - internalDate > 7 * 24 * 60 * 60 * 1000) continue;

          const headers = g.payload?.headers || [];
          const subject = headers.find((h: any) => h.name?.toLowerCase() === "subject")?.value || "";
          const snippet = g.snippet || "";

          // 1. Fast check: snippet + subject (extremely fast and contains the code 95% of the time)
          let code = extractCode(snippet, subject);

          // 2. If not found in snippet/subject, walk parts
          if (!code) {
            const parts: string[] = [];
            walkParts(g.payload, parts);
            const bodyText = [snippet, ...parts].join("\n");
            code = extractCode(bodyText, subject);
          }

          if (code && internalDate > bestDate) {
            bestCode = code;
            bestDate = internalDate;
            bestSubject = subject;
            break; // Newest code found!
          }
        }

        if (!bestCode) {
          if (order.netflix_last_code) {
            return res.status(200).json({
              code: order.netflix_last_code,
              email_at: order.netflix_last_code_at || new Date().toISOString(),
              netflix_email: emailToUse,
              already_used: true,
              message: "Sign-in code retrieved successfully.",
            });
          }
          return res.status(200).json({
            code: null,
            error: `No sign-in code found in recent Netflix emails. Please tap 'Send code' on Netflix using ${emailToUse}, wait 25 seconds, and tap Check Again.`,
            retryable: true,
            netflix_email: emailToUse,
          });
        }

        const validDate = bestDate || Date.now();
        const codeTime = new Date(validDate).toISOString();
        let codeNotes = setNoteTag(order.notes, "netflix_code", bestCode);
        codeNotes = setNoteTag(codeNotes, "netflix_code_at", codeTime);
        await supabase.from("service_orders").update({
          delivery_status: "active",
          notes: codeNotes || null,
        }).eq("reference", reference);

        if (AUTO_SMS_ENABLED && order.customer_phone) {
          const netflixMsg = `DATA 1 GH: Your Netflix sign-in code is: ${bestCode}\nAccount: ${emailToUse}\nEnter this code on Netflix to complete sign-in. Valid for 15 minutes.`;
          sendArkeselSms(supabase, order.customer_phone, netflixMsg).catch((err) =>
            console.warn("Netflix code SMS error:", err)
          );
        }

        return res.status(200).json({
          code: bestCode,
          subject: bestSubject,
          email_at: new Date(validDate).toISOString(),
          netflix_email: emailToUse,
          expires_at: new Date(validDate + 15 * 60 * 1000).toISOString(),
          login_expires_at: order.netflix_login_expires_at,
          already_used: true,
        });
      } catch (err: any) {
        console.error("services/netflix-code error:", err);
        sendAdminFailedServiceSms(supabase, reference, "netflix", err?.message).catch(() => { });
        return res.status(500).json({ error: err?.message || "Internal server error" });
      }
    }

    // 3b. Social Media Boost Services & BoostUpGH Actions
    if (fn === "boost-services") {
      try {
        const force = req.query?.refresh === "true" || body?.refresh === true;
        const result = await fetchBoostServices(supabase, force);
        return res.status(200).json(result);
      } catch (err: any) {
        console.error("boost-services error:", err);
        return res.status(500).json({ error: err?.message || "Failed to load boost services" });
      }
    }

    if (fn === "boost-status") {
      try {
        const orderId = body?.order_id || req.query?.order_id;
        const ref = body?.reference || req.query?.reference;
        let targetOrderId = orderId;
        if (!targetOrderId && ref) {
          const { data: ord } = await supabase.from("service_orders").select("notes").eq("reference", ref).maybeSingle();
          targetOrderId = parseNoteTag(ord?.notes, "boost_order_id");
        }
        if (!targetOrderId) {
          return res.status(400).json({ error: "Missing Boost order ID or reference" });
        }
        const st = await getBoostOrderStatus(supabase, targetOrderId);
        return res.status(200).json(st);
      } catch (err: any) {
        return res.status(500).json({ error: err?.message || "Status check failed" });
      }
    }

    if (fn === "boost-balance") {
      try {
        const auth = await verifyAdminUser(req, supabase);
        if (!auth.authorized) {
          return res.status(401).json({ error: auth.error || "Unauthorized" });
        }
        const bal = await getBoostBalance(supabase);
        if (!bal.ok) {
          return res.status(400).json({ error: bal.error || "Failed to fetch BoostUpGH balance" });
        }
        return res.status(200).json(bal);
      } catch (err: any) {
        return res.status(500).json({ error: err?.message || "Balance check failed" });
      }
    }

    if (fn === "boost-dispatch") {
      try {
        const auth = await verifyAdminUser(req, supabase);
        if (!auth.authorized) {
          return res.status(401).json({ error: auth.error || "Unauthorized" });
        }
        const ref = body?.reference || req.query?.reference;
        const id = body?.id;
        let q = supabase.from("service_orders").select("*");
        if (id) q = q.eq("id", id);
        else if (ref) q = q.eq("reference", ref);
        else return res.status(400).json({ error: "Missing reference or id" });

        const { data: rawOrd } = await q.maybeSingle();
        if (!rawOrd) return res.status(404).json({ error: "Order not found" });

        const result = await dispatchBoostOrder(supabase, enrichServiceOrder(rawOrd));
        return res.status(200).json(result);
      } catch (err: any) {
        return res.status(500).json({ error: err?.message || "Manual dispatch failed" });
      }
    }

    // 4. Netflix & Gmail Settings
    if (fn === "netflix-settings") {
      try {
        const auth = await verifyAdminUser(req, supabase);
        if (!auth.authorized) {
          return res.status(401).json({ error: auth.error || "Unauthorized: Administrator privileges required." });
        }

        const action = body?.action || (req.method === "POST" ? "save" : "get");

        if (action === "save" || action === "saveSettings") {
          const {
            netflix_account_email,
            gmail_account_email,
            gmail_client_id,
            gmail_client_secret,
            gmail_refresh_token,
            gmail_access_token,
            netflix_partner_api_key,
            netflix_partner_price,
            netflix_partner_wallet,
            netflix_partner_require_wallet,
          } = body;

          const upserts: { key: string; value: string }[] = [];
          if (netflix_account_email !== undefined) {
            upserts.push({ key: "netflix_account_email", value: String(netflix_account_email).trim() });
          }
          if (gmail_account_email !== undefined) {
            upserts.push({ key: "gmail_account_email", value: String(gmail_account_email).trim() });
          }
          if (gmail_client_id !== undefined) {
            upserts.push({ key: "gmail_client_id", value: String(gmail_client_id).trim() });
          }
          if (gmail_client_secret !== undefined && String(gmail_client_secret).trim()) {
            upserts.push({ key: "gmail_client_secret", value: String(gmail_client_secret).trim() });
          }
          if (gmail_refresh_token !== undefined && String(gmail_refresh_token).trim()) {
            upserts.push({ key: "gmail_refresh_token", value: String(gmail_refresh_token).trim() });
          }
          if (gmail_access_token !== undefined && String(gmail_access_token).trim()) {
            upserts.push({ key: "gmail_access_token", value: String(gmail_access_token).trim() });
            upserts.push({ key: "gmail_token_expires_at", value: String(Date.now() + 3600 * 1000) });
          }
          if (netflix_partner_api_key !== undefined) {
            upserts.push({ key: "netflix_partner_api_key", value: String(netflix_partner_api_key).trim() });
          }
          if (netflix_partner_price !== undefined) {
            upserts.push({ key: "netflix_partner_price", value: String(netflix_partner_price).trim() });
          }
          if (netflix_partner_wallet !== undefined) {
            upserts.push({ key: "netflix_partner_wallet", value: String(netflix_partner_wallet).trim() });
          }
          if (netflix_partner_require_wallet !== undefined) {
            upserts.push({ key: "netflix_partner_require_wallet", value: String(netflix_partner_require_wallet).trim() });
          }
          if (body?.netflix_partners !== undefined) {
            const val = typeof body.netflix_partners === "string" ? body.netflix_partners : JSON.stringify(body.netflix_partners);
            upserts.push({ key: "netflix_partners", value: val });
          }

          if (upserts.length > 0) {
            const { error: upErr } = await supabase.from("settings").upsert(upserts, { onConflict: "key" });
            if (upErr) return res.status(500).json({ error: upErr.message });
          }

          const creds = await resolveGmailCredentials(supabase);
          const { data: pRows } = await supabase.from("settings").select("key, value").in("key", ["netflix_partner_api_key", "netflix_partner_price", "netflix_partner_wallet", "netflix_partner_require_wallet", "netflix_partners"]);
          const pMap: Record<string, string> = {};
          (pRows || []).forEach((r: any) => { if (r?.key) pMap[r.key] = r.value; });

          let partners: any[] = [];
          try {
            if (pMap["netflix_partners"]) partners = JSON.parse(pMap["netflix_partners"]);
          } catch (_) { }

          return res.status(200).json({
            ok: true,
            netflix_account_email: creds.netflixEmail,
            gmail_account_email: creds.gmailEmail,
            gmail_client_id: creds.clientId,
            has_client_secret: !!creds.clientSecret,
            has_refresh_token: !!creds.refreshToken,
            has_access_token: !!creds.accessToken,
            is_connected: creds.isConfigured,
            netflix_partner_api_key: pMap["netflix_partner_api_key"] || "",
            netflix_partner_price: Number(pMap["netflix_partner_price"]) || 25,
            netflix_partner_wallet: Number(pMap["netflix_partner_wallet"]) || 0,
            netflix_partner_require_wallet: pMap["netflix_partner_require_wallet"] === "true",
            netflix_partners: partners,
          });
        }

        // Default: GET settings
        const creds = await resolveGmailCredentials(supabase);
        const { data: pRows } = await supabase.from("settings").select("key, value").in("key", ["netflix_partner_api_key", "netflix_partner_price", "netflix_partner_wallet", "netflix_partner_require_wallet", "netflix_partners"]);
        const pMap: Record<string, string> = {};
        (pRows || []).forEach((r: any) => { if (r?.key) pMap[r.key] = r.value; });

        let partnerApiKey = pMap["netflix_partner_api_key"] || "";
        if (!partnerApiKey) {
          // Auto-generate initial partner API key if not set
          const randomHex = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
          partnerApiKey = `d1_live_nf_${randomHex}`;
          await supabase.from("settings").upsert({ key: "netflix_partner_api_key", value: partnerApiKey }, { onConflict: "key" });
        }

        let partners: any[] = [];
        try {
          if (pMap["netflix_partners"]) partners = JSON.parse(pMap["netflix_partners"]);
        } catch (_) { }

        if (pMap["netflix_partners"] === undefined) {
          partners = [
            {
              id: "partner_1",
              name: "Partner 1",
              phone: "",
              api_key: partnerApiKey,
              wholesale_price: Number(pMap["netflix_partner_price"]) || 25,
              wallet_balance: Number(pMap["netflix_partner_wallet"]) || 0,
              status: "active",
              created_at: new Date().toISOString(),
            },
          ];
          await supabase.from("settings").upsert({ key: "netflix_partners", value: JSON.stringify(partners) }, { onConflict: "key" });
        }

        return res.status(200).json({
          netflix_account_email: creds.netflixEmail,
          gmail_account_email: creds.gmailEmail,
          gmail_client_id: creds.clientId,
          has_client_secret: !!creds.clientSecret,
          has_refresh_token: !!creds.refreshToken,
          has_access_token: !!creds.accessToken,
          is_connected: creds.isConfigured,
          netflix_partner_api_key: partnerApiKey,
          netflix_partner_price: Number(pMap["netflix_partner_price"]) || 25,
          netflix_partner_wallet: Number(pMap["netflix_partner_wallet"]) || 0,
          netflix_partner_require_wallet: pMap["netflix_partner_require_wallet"] === "true",
          netflix_partners: partners,
        });
      } catch (err: any) {
        return res.status(500).json({ error: err?.message || "Failed to handle netflix-settings" });
      }
    }

    // 5. Test Gmail Connection
    if (fn === "test-gmail") {
      try {
        const auth = await verifyAdminUser(req, supabase);
        if (!auth.authorized) {
          return res.status(401).json({ error: auth.error || "Unauthorized: Administrator privileges required." });
        }

        const creds = await resolveGmailCredentials(supabase);
        if (!creds.accessToken) {
          return res.status(200).json({
            ok: false,
            error: "No Gmail access token or refresh token found. Please link your Gmail account first.",
          });
        }

        // Query Gmail Profile
        let currentToken = creds.accessToken;
        let profileRes = await fetch(`${GMAIL_BASE}/users/me/profile`, {
          headers: { Authorization: `Bearer ${currentToken}`, Accept: "application/json" },
        });

        if (!profileRes.ok && profileRes.status === 401 && creds.refreshToken) {
          const fresh = await refreshGmailAccessToken(supabase, creds);
          if (fresh) {
            currentToken = fresh;
            profileRes = await fetch(`${GMAIL_BASE}/users/me/profile`, {
              headers: { Authorization: `Bearer ${currentToken}`, Accept: "application/json" },
            });
          }
        }

        if (!profileRes.ok) {
          const errText = await profileRes.text().catch(() => "");
          return res.status(200).json({
            ok: false,
            error: `Gmail authentication error (${profileRes.status}): Google login session expired or revoked. Please click the red "Connect with Google" button below to reconnect stillmoving11@gmail.com!`,
          });
        }

        const profile = await profileRes.json();
        const emailAddress = profile.emailAddress || creds.gmailEmail;

        // Query recent Netflix emails
        const testQ = "(from:netflix OR from:account.netflix.com OR subject:netflix OR netflix) newer_than:7d";
        const listRes = await fetch(
          `${GMAIL_BASE}/users/me/messages?maxResults=5&q=${encodeURIComponent(testQ)}`,
          {
            headers: { Authorization: `Bearer ${currentToken}`, Accept: "application/json" },
          }
        );

        let netflixCount = 0;
        let sampleSubject = "";
        let sampleDate = "";

        if (!listRes.ok) {
          const listErrText = await listRes.text().catch(() => "");
          let googleMsg = "";
          try {
            const parsed = JSON.parse(listErrText);
            googleMsg = parsed.error?.message || parsed.error_description || "";
          } catch (_) { }

          let hint = "Click 'Connect with Google' below to grant Gmail access.";
          if (googleMsg.toLowerCase().includes("has not been used in project") || googleMsg.toLowerCase().includes("disabled")) {
            hint = "Gmail API is not enabled in your Google Cloud Console project. Please enable 'Gmail API' under APIs & Services > Enabled APIs & Services.";
          } else if (googleMsg.toLowerCase().includes("insufficient") || googleMsg.toLowerCase().includes("scope")) {
            hint = "Insufficient permissions. Click 'Connect with Google' below to grant Gmail read access.";
          }

          return res.status(200).json({
            ok: false,
            error: `Gmail messages access error (${listRes.status}): ${googleMsg || listErrText.slice(0, 150)}. ${hint}`,
            detail: listErrText.slice(0, 300),
            email: emailAddress,
          });
        }

        const listData = await listRes.json().catch(() => ({}));
        netflixCount = (listData.messages || []).length;
        if (netflixCount > 0) {
          const sampleRes = await fetch(
            `${GMAIL_BASE}/users/me/messages/${listData.messages[0].id}?format=metadata`,
            {
              headers: { Authorization: `Bearer ${currentToken}`, Accept: "application/json" },
            }
          );
          if (sampleRes.ok) {
            const sMsg = await sampleRes.json().catch(() => null);
            const headers = sMsg?.payload?.headers || [];
            sampleSubject = headers.find((h: any) => h.name?.toLowerCase() === "subject")?.value || "";
            sampleDate = sMsg?.internalDate ? new Date(Number(sMsg.internalDate)).toLocaleString() : "";
          }
        }

        if (emailAddress) {
          await supabase.from("settings").upsert([
            { key: "gmail_account_email", value: emailAddress },
          ], { onConflict: "key" });
        }

        return res.status(200).json({
          ok: true,
          email: emailAddress,
          total_messages: profile.messagesTotal,
          netflix_emails_found: netflixCount,
          latest_netflix_subject: sampleSubject,
          latest_netflix_date: sampleDate,
        });
      } catch (err: any) {
        return res.status(500).json({ ok: false, error: err?.message || "Failed to test Gmail" });
      }
    }

    // 6. Gmail OAuth Authorization URL
    if (fn === "gmail-auth-url") {
      try {
        const auth = await verifyAdminUser(req, supabase);
        if (!auth.authorized) {
          return res.status(401).json({ error: auth.error || "Unauthorized: Administrator privileges required." });
        }
        const creds = await resolveGmailCredentials(supabase);
        const clientId = body?.client_id || creds.clientId;
        if (!clientId) {
          return res.status(400).json({ error: "Missing Google Client ID. Please enter your Google Client ID first." });
        }

        const redirectUri = body?.redirect_uri || `${req.headers.origin || "http://localhost:5173"}/admin/services`;
        const scope = encodeURIComponent("https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/userinfo.email");
        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&access_type=offline&prompt=consent&include_granted_scopes=true`;

        return res.status(200).json({ auth_url: authUrl });
      } catch (err: any) {
        return res.status(500).json({ error: err?.message || "Failed to generate auth url" });
      }
    }

    // 7. Gmail OAuth Code Exchange
    if (fn === "gmail-callback") {
      try {
        const auth = await verifyAdminUser(req, supabase);
        if (!auth.authorized) {
          return res.status(401).json({ error: auth.error || "Unauthorized: Administrator privileges required." });
        }
        const { code, redirect_uri } = body;
        if (!code) return res.status(400).json({ error: "Missing authorization code" });

        const creds = await resolveGmailCredentials(supabase);
        const clientId = body?.client_id || creds.clientId;
        const clientSecret = body?.client_secret || creds.clientSecret;

        if (!clientId || !clientSecret) {
          return res.status(400).json({ error: "Missing Google Client ID or Client Secret" });
        }

        const redirectUriToUse = redirect_uri || `${req.headers?.origin || "https://bigjaydata.com"}/admin/services`;
        const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          signal: AbortSignal.timeout(5000),
          body: new URLSearchParams({
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUriToUse,
            grant_type: "authorization_code",
          }),
        });

        const tokenData = await tokenRes.json().catch(() => ({}));
        if (!tokenRes.ok || !tokenData.access_token) {
          return res.status(400).json({
            error: tokenData.error_description || tokenData.error || "Failed to exchange Google authorization code.",
          });
        }

        let userEmail = "";
        try {
          const pRes = await fetch(`${GMAIL_BASE}/users/me/profile`, {
            headers: { Authorization: `Bearer ${tokenData.access_token}` },
            signal: AbortSignal.timeout(4000),
          });
          if (pRes.ok) {
            const pData = await pRes.json();
            userEmail = pData.emailAddress || "";
          }
        } catch { }

        const upserts = [
          { key: "gmail_access_token", value: tokenData.access_token },
          { key: "gmail_token_expires_at", value: String(Date.now() + (Number(tokenData.expires_in) || 3600) * 1000) },
        ];
        if (tokenData.refresh_token) {
          upserts.push({ key: "gmail_refresh_token", value: tokenData.refresh_token });
        }
        if (userEmail) {
          upserts.push({ key: "gmail_account_email", value: userEmail });
          upserts.push({ key: "netflix_account_email", value: userEmail });
        }
        if (clientId) upserts.push({ key: "gmail_client_id", value: clientId });
        if (clientSecret) upserts.push({ key: "gmail_client_secret", value: clientSecret });

        await supabase.from("settings").upsert(upserts, { onConflict: "key" });

        return res.status(200).json({
          ok: true,
          email: userEmail,
          message: "Gmail linked successfully!",
        });
      } catch (err: any) {
        return res.status(500).json({ error: err?.message || "Failed to complete Gmail authorization" });
      }
    }

    // 8. Admin Services Handler (overview, setPrices, updateOrder, deleteOrder)
    if (
      fn === "admin-services" ||
      body?.action === "overview" ||
      body?.action === "setPrices" ||
      body?.action === "updateOrder" ||
      body?.action === "deleteOrder" ||
      body?.action === "togglePromo" ||
      body?.action === "toggleSpin"
    ) {
      try {
        const auth = await verifyAdminUser(req, supabase);
        if (!auth.authorized) {
          return res.status(401).json({ error: auth.error || "Unauthorized: Administrator privileges required." });
        }
        const action = body?.action || "overview";

        if (action === "toggleSpin") {
          const enabled = Boolean(body?.enabled);
          await supabase.from("settings").upsert({ key: "spin_game_enabled", value: enabled ? "true" : "false" }, { onConflict: "key" });
          memoryShopSettings = null;
          memoryShopSettingsLoadedAt = 0;
          return res.status(200).json({ ok: true, spin_game_enabled: enabled });
        }

        if (action === "setPrices" || action === "saveBoostSettings") {
          const netflix = Number(body.netflix_price);
          const afa = Number(body.afa_price);
          const mashup = Number(body.mashup_price);
          const boostMarkup = Number(body.boost_markup_percent);
          const boostKey = body.boostupgh_api_key !== undefined ? cleanApiKey(body.boostupgh_api_key) : undefined;

          const upserts: { key: string; value: string }[] = [];

          if (Number.isFinite(netflix) && netflix > 0) {
            upserts.push({ key: "netflix_price", value: String(netflix) });
          }
          if (Number.isFinite(afa) && afa > 0) {
            upserts.push({ key: "afa_price", value: String(afa) });
          }
          if (Number.isFinite(mashup) && mashup > 0) {
            upserts.push({ key: "mashup_price", value: String(mashup) });
          }
          if (Number.isFinite(boostMarkup) && boostMarkup >= 0) {
            upserts.push({ key: "boost_markup_percent", value: String(boostMarkup) });
          }
          if (boostKey !== undefined) {
            upserts.push({ key: "boostupgh_api_key", value: boostKey });
          }

          if (upserts.length === 0) {
            return res.status(400).json({ error: "Please enter at least one valid setting to update." });
          }

          const { error: upErr } = await supabase.from("settings").upsert(upserts, { onConflict: "key" });
          if (upErr) {
            console.error("Failed to upsert service prices to settings:", upErr);
            return res.status(500).json({ error: upErr.message || "Database failed to save prices" });
          }

          // Bust shop-data in-memory settings cache so storefront displays new prices immediately
          memoryShopSettings = null;
          memoryShopSettingsLoadedAt = 0;

          return res.status(200).json({
            ok: true,
            netflix_price: Number.isFinite(netflix) && netflix > 0 ? netflix : undefined,
            afa_price: Number.isFinite(afa) && afa > 0 ? afa : undefined,
            mashup_price: Number.isFinite(mashup) && mashup > 0 ? mashup : undefined,
          });
        }

        if (action === "updateOrder") {
          const { id, reference, delivery_status, netflix_last_code, notes } = body;
          const updates: Record<string, any> = {};
          if (delivery_status !== undefined) updates.delivery_status = delivery_status;
          let finalNotes = notes !== undefined ? notes : undefined;
          if (netflix_last_code !== undefined) {
            finalNotes = setNoteTag(finalNotes || "", "netflix_code", netflix_last_code);
            finalNotes = setNoteTag(finalNotes, "netflix_code_at", new Date().toISOString());
          }
          if (finalNotes !== undefined) updates.notes = finalNotes;

          let query = supabase.from("service_orders").update(updates);
          if (id) query = query.eq("id", id);
          else query = query.eq("reference", reference);

          const { data, error } = await query.select("*").maybeSingle();
          if (error) return res.status(500).json({ error: error.message });
          return res.status(200).json({ ok: true, order: enrichServiceOrder(data) });
        }

        if (action === "deleteOrder") {
          const { id, reference } = body;
          let query = supabase.from("service_orders").delete();
          if (id) query = query.eq("id", id);
          else query = query.eq("reference", reference);
          const { error } = await query;
          if (error) return res.status(500).json({ error: error.message });
          return res.status(200).json({ ok: true });
        }

        // Default: Return overview data (lean, zero redundant queries)
        const [servicesRes, settingsRes, boostCreds] = await Promise.all([
          supabase.from("service_orders").select("*").order("created_at", { ascending: false }).limit(80),
          supabase.from("settings").select("key,value").in("key", ["promo_enabled", "netflix_price", "afa_price", "mashup_price", "spin_game_enabled", "boost_markup_percent", "boostupgh_api_key"]),
          resolveBoostUpGhCredentials(supabase),
        ]);

        const smap = Object.fromEntries((settingsRes.data || []).map((s: any) => [s.key, s.value]));

        return res.status(200).json({
          services: (servicesRes.data || []).map(enrichServiceOrder),
          referrals: [],
          redemptions: [],
          spin_wins: [],
          spin_redemptions: [],
          promo_enabled: (smap.promo_enabled ?? "true") !== "false",
          spin_game_enabled: (smap.spin_game_enabled ?? "true") !== "false",
          netflix_price: Number(smap.netflix_price) > 0 ? Number(smap.netflix_price) : 30,
          afa_price: Number(smap.afa_price) > 0 ? Number(smap.afa_price) : 20,
          mashup_price: Number(smap.mashup_price) > 0 ? Number(smap.mashup_price) : 25,
          boost_markup_percent: Number(smap.boost_markup_percent) >= 0 ? Number(smap.boost_markup_percent) : 40,
          boostupgh_api_key_configured: Boolean(boostCreds.apiKey),
          boostupgh_api_key: smap.boostupgh_api_key || "",
        });
      } catch (err: any) {
        console.error("admin-services in services.ts error:", err);
        return res.status(500).json({ error: err?.message || "Internal server error" });
      }
    }

    // 8. Public Shop Data (products + settings) - Data1DB In-Memory Egress Shield
    if (fn === "shop-data" || req.url?.includes("shop-data") || body?.action === "getShopData") {
      try {
        const PUBLIC_KEYS = [
          "shop_name",
          "store_name",
          "whatsapp_bot_url",
          "whatsapp_channel_url",
          "support_chat_url",
          "announcement_enabled",
          "announcement_title",
          "announcement_message",
          "promo_enabled",
          "spin_game_enabled",
          "free_data_enabled",
          "apk_download_url",
          "netflix_price",
          "afa_price",
          "mashup_price",
          "support_phone",
          "flash_sale_enabled",
          "flash_sale_end_time",
          "flash_sale_title",
          "flash_sale_notice",
          "flash_sale_products",
          "orders_paused",
          "orders_pause_message",
        ];

        const forceRefresh =
          req.query?.refresh === "true" ||
          body?.refresh === true ||
          req.url?.includes("refresh=true");
        const now = Date.now();
        const productsFresh =
          memoryShopProducts &&
          memoryShopProducts.length > 0 &&
          now - memoryShopProductsLoadedAt < PRODUCTS_CACHE_TTL_MS;
        const settingsFresh =
          memoryShopSettings &&
          memoryShopSettings.length > 0 &&
          now - memoryShopSettingsLoadedAt < SETTINGS_CACHE_TTL_MS;

        // Egress Shield: Return cached products & settings if both are fresh
        if (!forceRefresh && productsFresh && settingsFresh) {
          const sList = memoryShopSettings || [];
          res.setHeader("X-Cache-Source", "data1db-memory");
          res.setHeader(
            "Cache-Control",
            forceRefresh
              ? "no-cache, no-store, must-revalidate"
              : "public, max-age=15, s-maxage=30, stale-while-revalidate=60"
          );
          return res.status(200).json({
            products: memoryShopProducts,
            settings: Object.fromEntries(sList.map((s: any) => [s.key, s.value])),
            settingsList: sList,
            cached: true,
            source: "data1db_cache",
          });
        }

        // Fetch missing/expired items from Supabase
        const fetchTasks: Promise<any>[] = [];

        if (forceRefresh || !productsFresh) {
          fetchTasks.push(
            supabase
              .from("products")
              .select("id, network, capacity, mb, price, name, in_stock, sort_order")
              .eq("in_stock", true)
              .order("network")
              .order("sort_order")
          );
        } else {
          fetchTasks.push(Promise.resolve({ data: memoryShopProducts }));
        }

        if (forceRefresh || !settingsFresh) {
          fetchTasks.push(
            supabase.from("settings").select("key, value").in("key", PUBLIC_KEYS)
          );
        } else {
          fetchTasks.push(Promise.resolve({ data: memoryShopSettings }));
        }

        let prods: any[] = [];
        let sList: any[] = [];

        try {
          const [productsRes, settingsRes] = await Promise.all(fetchTasks);

          if (productsRes?.data && productsRes.data.length > 0) {
            prods = productsRes.data;
            memoryShopProducts = prods;
            memoryShopProductsLoadedAt = now;
          }
          if (settingsRes?.data && settingsRes.data.length > 0) {
            sList = settingsRes.data;
            memoryShopSettings = sList;
            memoryShopSettingsLoadedAt = now;
          }
        } catch (fetchErr) {
          console.warn("Supabase shop-data fetch warning:", fetchErr);
        }

        // Fallbacks if Supabase is rate-limited, egress-capped, or down
        if (!prods.length && memoryShopProducts && memoryShopProducts.length > 0) {
          prods = memoryShopProducts;
        } else if (!prods.length && Array.isArray(DEFAULT_PRODUCTS)) {
          prods = (DEFAULT_PRODUCTS as any[]).map((p: any, idx: number) => ({
            id: p.id || `default-${idx}`,
            network: p.network,
            capacity: p.capacity,
            mb: p.mb || 0,
            price: p.price,
            name: p.name || `${p.network} ${p.capacity}`,
            in_stock: true,
            sort_order: idx + 1,
          }));
        }

        if (!sList.length && memoryShopSettings && memoryShopSettings.length > 0) {
          sList = memoryShopSettings;
        }

        res.setHeader("X-Cache-Source", "supabase-refreshed");
        res.setHeader(
          "Cache-Control",
          forceRefresh
            ? "no-cache, no-store, must-revalidate"
            : "public, max-age=15, s-maxage=30, stale-while-revalidate=60"
        );
        return res.status(200).json({
          products: prods,
          settings: Object.fromEntries(sList.map((s: any) => [s.key, s.value])),
          settingsList: sList,
          cached: false,
          source: "supabase_refreshed",
        });
      } catch (err: any) {
        console.error("shop-data error:", err);
        // Resilient fallback: Never 500 when visitors are browsing
        if (memoryShopProducts && memoryShopProducts.length > 0) {
          const sList = memoryShopSettings || [];
          res.setHeader("X-Cache-Source", "data1db-memory-fallback");
          res.setHeader("Cache-Control", "public, max-age=60, s-maxage=120");
          return res.status(200).json({
            products: memoryShopProducts,
            settings: Object.fromEntries(sList.map((s: any) => [s.key, s.value])),
            settingsList: sList,
            cached: true,
            source: "data1db_cache_fallback",
          });
        }
        return res.status(500).json({ error: err?.message || "Failed to load shop data" });
      }
    }

    return res.status(400).json({
      error: "Unknown action. Specify fn=service-init, service-verify, netflix-fetch-code, netflix-settings, admin-services, shop-data, or test-gmail.",
    });
  } catch (fatalErr: any) {
    console.error("FATAL api/services error:", fatalErr);
    return res.status(500).json({ error: fatalErr?.message || "Internal server error in services handler" });
  }
}
