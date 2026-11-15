import { data1db } from './_data1db.js';

// Admin Zero-Egress In-Memory Shields
let cachedAdminStats: any = null;
let cachedAdminStatsAt = 0;
const ADMIN_STATS_TTL = 10 * 60 * 1000;

let cachedListOrders: any = null;
let cachedListOrdersAt = 0;
const LIST_ORDERS_TTL = 5 * 1000;

import { createClient } from "@supabase/supabase-js";
import { verifyAdminUser, sendSecurityAlert, getSupabase, getEnvVar, cleanApiKey, getCachedSettings, invalidateSettingsCache } from "./_supabase.js";
import { detectAndBlockIntrusion } from "./_firewall.js";
import { syncOrderWithDatamart, resolveDatamartKeys, resolveDatamartKeysSync, getDatamartSecret, getDatamartAuthHeaders, executeDatamartPurchase, resolveDatamartSecret, claimOrderDispatchLock, releaseOrderDispatchLock, initiateDatamartBridgeDeposit, checkDatamartBridgeStatus, claimDatamartMomoDeposit, getDatamartAuthToken } from "./_datamart.js";
import { testAIProvider, normalizeGeminiModel, callOwnerCoPilotAI } from "./_ai-rotator.js";
import {
  checkAndAlertLowDatamartBalance,
  sendAdminLowBalanceOrderFailedAlert,
  isDatamartLowBalanceError,
  logSmsNotification,
  sendPaymentReceivedNotification,
  sendPaymentIncompleteCustomerSms,
  extractPaystackMomoPhone,
} from "./_notifications.js";
import { generateFreeDataVouchersDirect, updateOrderDeliveryStatusDirect, sendArkeselSmsDirect, sendArkeselBulkSmsDirect, normalizeGhanaPhone } from "./_whatsapp-bot.js";

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

function parseOrderTag(notes: string | null | undefined, tag: string): string | null {
  if (!notes) return null;
  const match = notes.match(new RegExp(`\\[${tag}:([^\\]]+)\\]`));
  return match ? match[1].trim() : null;
}

function setOrderTag(notes: string | null | undefined, tag: string, value: string | null | undefined): string {
  let str = (notes || "").trim();
  const regex = new RegExp(`\\[${tag}:[^\\]]*\\]\\s*`, "g");
  str = str.replace(regex, "").trim();
  if (value !== null && value !== undefined && String(value).trim() !== "") {
    str = str ? `${str} [${tag}:${String(value).trim()}]` : `[${tag}:${String(value).trim()}]`;
  }
  return str;
}

function enrichAdminService(order: any) {
  if (!order || typeof order !== "object") return order;
  const notes = order.notes || "";
  const customer_name = order.customer_name || parseOrderTag(notes, "name") || null;
  const payment_status = order.payment_status || order.status || "pending";
  const netflix_last_code = order.netflix_last_code || parseOrderTag(notes, "netflix_code") || parseOrderTag(notes, "code") || null;
  const netflix_last_code_at = order.netflix_last_code_at || parseOrderTag(notes, "netflix_code_at") || null;
  const netflix_login_expires_at = order.netflix_login_expires_at || parseOrderTag(notes, "netflix_login_expires_at") || null;
  return {
    ...order,
    service_type: order.service_type || order.service,
    service: order.service || order.service_type,
    service_name: order.service === "netflix" ? "Netflix 30-Day Premium Account" : order.service === "afa" ? "MTN AFA Registration" : order.service === "mashup" ? "MTN Mashup Bundle" : (order.service_name || order.service || "Service"),
    customer_name,
    payment_status,
    status: payment_status,
    netflix_last_code,
    netflix_last_code_at,
    netflix_login_expires_at,
  };
}

function enrichAdminChecker(order: any) {
  if (!order || typeof order !== "object") return order;
  const notes = order.notes || "";
  const customer_name = order.customer_name || parseOrderTag(notes, "name") || null;
  const payment_status = order.payment_status || order.status || "pending";
  const serial_number = order.serial_number || parseOrderTag(notes, "serial") || null;
  const pin = order.pin || parseOrderTag(notes, "pin") || null;
  const error_message = order.error_message || parseOrderTag(notes, "error") || null;
  const datamart_reference = order.datamart_reference || parseOrderTag(notes, "dm_ref") || null;
  const delivered_at = order.delivered_at || parseOrderTag(notes, "delivered_at") || null;
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
    console.error("sendArkeselSms error:", err);
    return { ok: false, error: err?.message };
  }
}

let cachedBalance: number | null = null;
let cachedAt = 0;
let cachedArkesel: { sms: number; main: string } | null = null;
let cachedArkeselAt = 0;

export default async function handler(req: any, res: any) {
  try {
    setCorsHeaders(res);
    if (req.method === "OPTIONS") {
      return res.status(200).end();
    }

    let admin: any = null;
    try {
      admin = getSupabase();
    } catch (e: any) {
      console.warn("Admin client init note:", e?.message);
    }

    if (admin && (await detectAndBlockIntrusion(req, res, admin))) return;

    const body = parseBody(req);
    const fn = (
      req.query?.fn ||
      req.headers?.["x-function-name"] ||
      body?.fn ||
      (req.url?.includes("admin-ai-settings")
        ? "admin-ai-settings"
        : req.url?.includes("admin-analytics")
        ? "admin-analytics"
        : req.url?.includes("admin-data")
        ? "admin-data"
        : req.url?.includes("admin-services")
        ? "admin-services"
        : req.url?.includes("bulk-sms")
        ? "bulk-sms"
        : req.url?.includes("admin-stats")
        ? "admin-stats"
        : req.url?.includes("whatsapp-orders")
        ? "whatsapp-orders"
        : req.url?.includes("whatsapp-bot")
        ? "whatsapp-bot"
        : "")
    ).toLowerCase();

    // Allow Meta WhatsApp Cloud API webhook verification & incoming messages to reach _whatsapp-bot.js
    if (
      fn === "whatsapp-bot" &&
      (req.query?.["hub.mode"] === "subscribe" ||
        Boolean(body?.entry?.[0]?.changes?.[0]?.value?.messages) ||
        Boolean(body?.from && (body?.text || body?.message || body?.msg || body?.command)))
    ) {
      const whatsappBotModule = await import("./_whatsapp-bot.js");
      if (whatsappBotModule.default) {
        return whatsappBotModule.default(req, res);
      }
    }

    // Strict Security Check: Verify Administrator Session before any admin action
    const preAuth = await verifyAdminUser(req, admin);

    // Delegate whatsapp-orders (requires admin auth)
    if (fn === "whatsapp-orders" || req.url?.includes("whatsapp-orders")) {
      if (!preAuth.authorized) {
        return res.status(401).json({ error: preAuth.error || "Unauthorized: Administrator privileges required." });
      }
      const whatsappOrdersHandler = (await import("./_whatsapp-orders.js")).default;
      return whatsappOrdersHandler(req, res);
    }

    // Direct AI Provider connection test (requires admin auth)
    if (body?.action === "testAiProvider") {
      if (!preAuth.authorized) {
        return res.status(401).json({ error: preAuth.error || "Unauthorized: Administrator privileges required." });
      }
      const { provider, api_key, model } = body;
      if (!provider) {
        return res.status(400).json({ success: false, message: "Provider is required for testing" });
      }
      let keyToTest = (api_key || "").trim();
      if ((!keyToTest || keyToTest.includes("••••")) && admin) {
        try {
          const { data: rows } = await admin
            .from("settings")
            .select("key,value")
            .in("key", ["gemini_api_key", "groq_api_key", "grok_api_key", "openai_api_key"]);
          const sMap: Record<string, string> = {};
          for (const r of rows || []) {
            if (r.key) sMap[r.key] = r.value ?? "";
          }
          if (provider === "gemini") keyToTest = sMap.gemini_api_key || getEnvVar(["GEMINI_API_KEY", "VITE_GEMINI_API_KEY"]) || "";
          if (provider === "groq" || provider === "grok") keyToTest = sMap.groq_api_key || sMap.grok_api_key || getEnvVar(["GROQ_API_KEY", "GROK_API_KEY"]) || "";
          if (provider === "openai") keyToTest = sMap.openai_api_key || getEnvVar(["OPENAI_API_KEY"]) || "";
        } catch (_) {}
      } else if (!keyToTest || keyToTest.includes("••••")) {
        if (provider === "gemini") keyToTest = getEnvVar(["GEMINI_API_KEY", "VITE_GEMINI_API_KEY"]) || "";
        if (provider === "groq" || provider === "grok") keyToTest = getEnvVar(["GROQ_API_KEY", "GROK_API_KEY"]) || "";
        if (provider === "openai") keyToTest = getEnvVar(["OPENAI_API_KEY"]) || "";
      }

      const testRes = await testAIProvider(provider, keyToTest, model);
      return res.status(200).json(testRes);
    }

    if (
      (fn === "admin-ai-settings" || body?.action === "getAiSettings") &&
      !admin &&
      req.method === "GET"
    ) {
      if (!preAuth.authorized) {
        return res.status(401).json({ error: preAuth.error || "Unauthorized: Administrator privileges required." });
      }
      const geminiKey = getEnvVar(["GEMINI_API_KEY", "VITE_GEMINI_API_KEY"]) || "";
      const groqKey = getEnvVar(["GROQ_API_KEY", "GROK_API_KEY"]) || "";
      const openaiKey = getEnvVar(["OPENAI_API_KEY"]) || "";
      return res.status(200).json({
        success: true,
        settings: {
          gemini_api_key: geminiKey,
          gemini_api_key_masked: geminiKey ? geminiKey.slice(0, 4) + "••••••••" + geminiKey.slice(-4) : "",
          gemini_model: "gemini-3.8-flash",
          gemini_configured: Boolean(geminiKey),
          groq_api_key: groqKey,
          groq_api_key_masked: groqKey ? groqKey.slice(0, 4) + "••••••••" + groqKey.slice(-4) : "",
          groq_model: "llama-3.3-70b-versatile",
          groq_configured: Boolean(groqKey),
          grok_api_key: groqKey,
          grok_api_key_masked: groqKey ? groqKey.slice(0, 4) + "••••••••" + groqKey.slice(-4) : "",
          grok_model: "llama-3.3-70b-versatile",
          grok_configured: Boolean(groqKey),
          openai_api_key: openaiKey,
          openai_api_key_masked: openaiKey ? openaiKey.slice(0, 4) + "••••••••" + openaiKey.slice(-4) : "",
          openai_model: "gpt-4o-mini",
          openai_configured: Boolean(openaiKey),
          ai_system_instructions: "",
        },
      });
    }

    if (!admin) {
      return res.status(500).json({ error: "Missing Supabase configuration." });
    }

    // Allow intrusion reporting endpoint from login page
    if (fn === "report-intrusion" || body?.action === "reportSecurityEvent") {
      const ip = req.headers?.["x-forwarded-for"]?.split(",")[0]?.trim() || req.headers?.["x-real-ip"] || "Unknown";
      await sendSecurityAlert(admin, {
        type: body?.type || "Admin Portal Login Intrusion",
        endpoint: "/admin/login",
        ip,
        details: body?.details || "Failed administrator login or non-admin access attempt.",
        severity: "critical",
      }).catch(() => {});
      return res.status(200).json({ ok: true });
    }

    // ----------------------------------------------------
    // Public Site Visitor Tracking (Records link opens)
    // ----------------------------------------------------
    if (fn === "track-visit" || body?.action === "trackVisit") {
      try {
        const visitorId = String(body?.visitor_id || "").slice(0, 80) || `anon_${Math.random().toString(36).slice(2, 10)}`;
        const dateStr = body?.date || new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Accra" });
        const now = new Date();
        const hour = now.getUTCHours();
        const timestamp = now.toISOString();

        // Zero-Egress shield: Record in local data1db instead of querying Supabase PostgREST on every page open
        try {
          data1db.getClient().from("site_visits").insert({
            visitor_id: visitorId,
            date: dateStr,
            referrer: String(body?.referrer || "Direct Link").slice(0, 100),
            path: String(body?.path || "/").slice(0, 100),
            device: String(body?.device || "Mobile").slice(0, 50),
            hour,
            created_at: timestamp,
          });
        } catch (_) {}

        return res.status(200).json({ ok: true });
      } catch (e: any) {
        return res.status(200).json({ ok: false, error: e?.message });
      }
    }

    // Strict Security Check: Verify Administrator Session
    const auth = await verifyAdminUser(req, admin);
    if (!auth.authorized) {
      return res.status(401).json({ error: auth.error || "Unauthorized: Administrator privileges required." });
    }

    // ----------------------------------------------------
    // Admin Site Visitors Calendar & Metrics Handler
    // ----------------------------------------------------
    if (fn === "admin-visitors" || body?.action === "getVisitorStats" || req.query?.action === "getVisitorStats") {
      try {
        const targetDate = body?.date || req.query?.date || new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Accra" });
        const monthPrefix = targetDate.slice(0, 7); // e.g. "2026-10"

        // Fetch all visitor settings for this month
        const { data: settingRows } = await admin
          .from("settings")
          .select("key, value")
          .ilike("key", `visitor_log_${monthPrefix}%`);

        const calendarData: Record<string, { count: number; unique: number; opens?: number }> = {};
        let selectedStats: any = null;
        let monthTotal = 0;
        let todayCount = 0;
        let yesterdayCount = 0;

        const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Accra" });
        const yDate = new Date();
        yDate.setDate(yDate.getDate() - 1);
        const yestStr = yDate.toLocaleDateString("en-CA", { timeZone: "Africa/Accra" });

        for (const row of settingRows || []) {
          try {
            const parsed = JSON.parse(row.value);
            const d = parsed.date;
            if (!d) continue;
            const opens = parsed.total_visits || 0;
            const uniq = Array.isArray(parsed.unique_visitors) ? parsed.unique_visitors.length : (opens > 0 ? 1 : 0);

            // Primary count is strictly unique physical devices
            calendarData[d] = { count: uniq, unique: uniq, opens };

            if (d === targetDate) {
              selectedStats = {
                ...parsed,
                unique_count: uniq,
              };
            }
          } catch (_) {}
        }

        // Query database table for full data if table exists
        try {
          const { data: dbVisits } = await admin
            .from("site_visits")
            .select("date, visitor_id, hour, referrer, device, path, created_at")
            .gte("date", `${monthPrefix}-01`)
            .lte("date", `${monthPrefix}-31`);

          if (dbVisits && dbVisits.length > 0) {
            const dbCal: Record<string, { count: number; uniqueSet: Set<string> }> = {};
            const dbSelectedVisits: any[] = [];

            for (const v of dbVisits) {
              if (!dbCal[v.date]) dbCal[v.date] = { count: 0, uniqueSet: new Set() };
              dbCal[v.date].count++;
              if (v.visitor_id) dbCal[v.date].uniqueSet.add(v.visitor_id);

              if (v.date === targetDate) {
                dbSelectedVisits.push(v);
              }
            }

            for (const [d, val] of Object.entries(dbCal)) {
              const uCount = Math.max(calendarData[d]?.unique || 0, val.uniqueSet.size);
              const opCount = Math.max((calendarData[d] as any)?.opens || 0, val.count);
              calendarData[d] = {
                count: uCount, // Primary count = unique devices
                unique: uCount,
                opens: opCount,
              };
            }

            if (dbSelectedVisits.length > 0) {
              const uSet = new Set(dbSelectedVisits.map((v) => v.visitor_id).filter(Boolean));
              const hourly = Array(24).fill(0);
              const sources: Record<string, number> = {};
              const devices: Record<string, number> = {};

              dbSelectedVisits.forEach((v) => {
                const h = v.hour ?? (new Date(v.created_at).getUTCHours() || 0);
                hourly[h] = (hourly[h] || 0) + 1;
                const src = v.referrer || "Direct Link";
                sources[src] = (sources[src] || 0) + 1;
                const dev = v.device || "Mobile";
                devices[dev] = (devices[dev] || 0) + 1;
              });

              selectedStats = {
                date: targetDate,
                total_visits: dbSelectedVisits.length,
                unique_visitors: Array.from(uSet),
                unique_count: uSet.size,
                hourly,
                sources,
                devices,
                recent_visits: dbSelectedVisits
                  .slice(-30)
                  .reverse()
                  .map((v) => ({
                    time: new Date(v.created_at).toLocaleTimeString("en-GB", {
                      timeZone: "Africa/Accra",
                      hour: "2-digit",
                      minute: "2-digit",
                    }),
                    device: v.device || "Mobile",
                    referrer: v.referrer || "Direct Link",
                    path: v.path || "/",
                    visitor_id: String(v.visitor_id || "").slice(0, 8),
                  })),
              };
            }
          }
        } catch (_) {}

        if (!selectedStats) {
          selectedStats = {
            date: targetDate,
            total_visits: 0,
            unique_visitors: [],
            unique_count: 0,
            hourly: Array(24).fill(0),
            sources: {},
            devices: {},
            recent_visits: [],
          };
        }

        // Calculate totals across the month (unique physical devices per day)
        monthTotal = 0;
        for (const [d, item] of Object.entries(calendarData)) {
          if (d.startsWith(monthPrefix)) {
            monthTotal += item.count;
          }
        }

        todayCount = calendarData[todayStr]?.count || 0;
        yesterdayCount = calendarData[yestStr]?.count || 0;

        const selUnique = typeof selectedStats.unique_count === "number"
          ? selectedStats.unique_count
          : (Array.isArray(selectedStats.unique_visitors) ? selectedStats.unique_visitors.length : (selectedStats.total_visits > 0 ? 1 : 0));

        return res.status(200).json({
          ok: true,
          date: targetDate,
          month: monthPrefix,
          calendarData,
          selectedStats: {
            ...selectedStats,
            unique_count: selUnique,
          },
          summary: {
            today: todayCount,
            yesterday: yesterdayCount,
            this_month: monthTotal,
            selected_date_total: selUnique,
            selected_date_opens: selectedStats.total_visits || 0,
          },
        });
      } catch (err: any) {
        return res.status(500).json({ error: err?.message || "Failed to load visitor stats" });
      }
    }

  // ----------------------------------------------------
  // A0. WhatsApp Bot Admin Report Handler
  // ----------------------------------------------------
  if (fn === "whatsapp-bot" || fn === "bot-summary" || fn === "admin-bot") {
    try {
      const whatsappBotModule = await import("./_whatsapp-bot.js");
      if (req.method === "POST" && whatsappBotModule.default) {
        return whatsappBotModule.default(req, res);
      }
      const { buildAdminWhatsAppReport } = whatsappBotModule;
      const { reportText, stats } = await buildAdminWhatsAppReport();
      if (req.query?.format === "text") {
        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        return res.status(200).send(reportText);
      }
      return res.status(200).json({ ok: true, reply: reportText, text: reportText, stats });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "Failed to generate bot report" });
    }
  }

  // ----------------------------------------------------
  // A000-AI. AI Models, Provider Keys & Training Settings
  // ----------------------------------------------------
  if (
    fn === "admin-ai-settings" ||
    body?.action === "getAiSettings" ||
    body?.action === "saveAiSettings" ||
    body?.action === "testAiProvider"
  ) {
    try {
      const aiAction = body?.action || req.query?.sub || (req.method === "GET" ? "getAiSettings" : "saveAiSettings");

      if (aiAction === "getAiSettings" || req.method === "GET") {
        const { data: rows } = await admin
          .from("settings")
          .select("key,value")
          .in("key", ["gemini_api_key", "gemini_model", "groq_api_key", "grok_api_key", "groq_model", "grok_model", "openai_api_key", "openai_model", "ai_system_instructions"]);
        const sMap: Record<string, string> = {};
        for (const r of rows || []) {
          if (r.key) sMap[r.key] = r.value ?? "";
        }

        const maskKey = (k?: string) => {
          if (!k || k.length < 8) return k ? "••••••••" : "";
          return k.slice(0, 4) + "••••••••" + k.slice(-4);
        };

        const geminiKey = sMap.gemini_api_key || getEnvVar(["GEMINI_API_KEY", "VITE_GEMINI_API_KEY"]) || "";
        const groqKey = sMap.groq_api_key || sMap.grok_api_key || getEnvVar(["GROQ_API_KEY", "GROK_API_KEY"]) || "";
        const openaiKey = sMap.openai_api_key || getEnvVar(["OPENAI_API_KEY"]) || "";

        return res.status(200).json({
          success: true,
          settings: {
            gemini_api_key: geminiKey,
            gemini_api_key_masked: maskKey(geminiKey),
            gemini_model: normalizeGeminiModel(sMap.gemini_model || "gemini-3.8-flash"),
            gemini_configured: Boolean(geminiKey),

            groq_api_key: groqKey,
            groq_api_key_masked: maskKey(groqKey),
            groq_model: sMap.groq_model || sMap.grok_model || "llama-3.3-70b-versatile",
            groq_configured: Boolean(groqKey),

            grok_api_key: groqKey,
            grok_api_key_masked: maskKey(groqKey),
            grok_model: sMap.groq_model || sMap.grok_model || "llama-3.3-70b-versatile",
            grok_configured: Boolean(groqKey),

            openai_api_key: openaiKey,
            openai_api_key_masked: maskKey(openaiKey),
            openai_model: sMap.openai_model || "gpt-4o-mini",
            openai_configured: Boolean(openaiKey),

            ai_system_instructions: sMap.ai_system_instructions || "",
          },
        });
      }

      if (aiAction === "testAiProvider") {
        const { provider, api_key, model } = body;
        if (!provider) {
          return res.status(400).json({ success: false, message: "Provider is required for testing" });
        }

        let keyToTest = (api_key || "").trim();
        if (!keyToTest || keyToTest.includes("••••")) {
          const { data: rows } = await admin
            .from("settings")
            .select("key,value")
            .in("key", ["gemini_api_key", "groq_api_key", "grok_api_key", "openai_api_key"]);
          const sMap: Record<string, string> = {};
          for (const r of rows || []) {
            if (r.key) sMap[r.key] = r.value ?? "";
          }
          if (provider === "gemini") keyToTest = sMap.gemini_api_key || getEnvVar(["GEMINI_API_KEY"]) || "";
          if (provider === "groq" || provider === "grok") keyToTest = sMap.groq_api_key || sMap.grok_api_key || getEnvVar(["GROQ_API_KEY", "GROK_API_KEY"]) || "";
          if (provider === "openai") keyToTest = sMap.openai_api_key || getEnvVar(["OPENAI_API_KEY"]) || "";
        }

        const testRes = await testAIProvider(provider, keyToTest, model);
        return res.status(200).json(testRes);
      }

      if (aiAction === "saveAiSettings" || req.method === "POST") {
        const rowsToUpsert: Array<{ key: string; value: string }> = [];

        if (body.gemini_api_key !== undefined && !body.gemini_api_key.includes("••••")) {
          rowsToUpsert.push({ key: "gemini_api_key", value: (body.gemini_api_key || "").trim() });
        }
        if (body.gemini_model !== undefined) {
          rowsToUpsert.push({ key: "gemini_model", value: normalizeGeminiModel(body.gemini_model || "gemini-3.8-flash") });
        }

        const incomingGroqKey = body.groq_api_key !== undefined ? body.groq_api_key : body.grok_api_key;
        if (incomingGroqKey !== undefined && !incomingGroqKey.includes("••••")) {
          rowsToUpsert.push({ key: "groq_api_key", value: incomingGroqKey.trim() });
          rowsToUpsert.push({ key: "grok_api_key", value: incomingGroqKey.trim() });
        }
        const incomingGroqModel = body.groq_model !== undefined ? body.groq_model : body.grok_model;
        if (incomingGroqModel !== undefined) {
          rowsToUpsert.push({ key: "groq_model", value: incomingGroqModel.trim() });
          rowsToUpsert.push({ key: "grok_model", value: incomingGroqModel.trim() });
        }

        if (body.openai_api_key !== undefined && !body.openai_api_key.includes("••••")) {
          rowsToUpsert.push({ key: "openai_api_key", value: (body.openai_api_key || "").trim() });
        }
        if (body.openai_model !== undefined) {
          rowsToUpsert.push({ key: "openai_model", value: (body.openai_model || "gpt-4o-mini").trim() });
        }

        if (body.ai_system_instructions !== undefined) {
          rowsToUpsert.push({ key: "ai_system_instructions", value: String(body.ai_system_instructions || "") });
        }

        if (rowsToUpsert.length > 0) {
          await admin.from("settings").upsert(rowsToUpsert, { onConflict: "key" });
        }

        return res.status(200).json({
          success: true,
          message: "AI configuration and instructions successfully saved!",
        });
      }
    } catch (e: any) {
      console.error("admin-ai-settings error:", e);
      return res.status(500).json({ success: false, message: e?.message || "Failed in admin-ai-settings" });
    }
  }

  // ----------------------------------------------------
  // A00-AI. Stony AI Co-Pilot & Action Execution Engine
  // ----------------------------------------------------
  if (
    fn === "admin-ai" ||
    body?.action === "getAiIssuesAndProposals" ||
    body?.action === "executeAiAction" ||
    body?.action === "aiCoPilotChat"
  ) {
    try {
      const aiSubAction = body?.action || req.query?.sub || "getAiIssuesAndProposals";

      // ── SUB-ACTION 1: SCAN FOR LIVE SYSTEM ISSUES & GENERATE ACTION PROPOSALS ──
      let cachedIssuesResponse: any = null;
let cachedIssuesResponseAt = 0;
const ISSUES_CACHE_TTL = 15 * 60 * 1000;

if (aiSubAction === "getAiIssuesAndProposals" || aiSubAction === "issues") {
        if (!body?.force && cachedIssuesResponse && Date.now() - cachedIssuesResponseAt < ISSUES_CACHE_TTL) {
          return res.status(200).json(cachedIssuesResponse);
        }
        const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const [
          stuckOrdersRes,
          failedOrdersRes,
          serviceOrdersRes,
          checkerOrdersRes,
          productsRes,
          chatsRes,
          settingsRes
        ] = await Promise.all([
          // Paid data orders stuck in pending or processing > 15 mins
          admin
            .from("orders")
            .select("id, reference, network, capacity, recipient_phone, amount, payment_status, delivery_status, created_at, datamart_reference")
            .eq("payment_status", "paid")
            .in("delivery_status", ["pending", "processing"])
            .lte("created_at", fifteenMinsAgo)
            .order("created_at", { ascending: false })
            .limit(20),

          // Orders with delivery_status failed
          admin
            .from("orders")
            .select("id, reference, network, capacity, recipient_phone, amount, payment_status, delivery_status, created_at, error_message")
            .eq("payment_status", "paid")
            .eq("delivery_status", "failed")
            .order("created_at", { ascending: false })
            .limit(10),

          // Paid service orders not delivered (Netflix, MashUp, AFA)
          admin
            .from("service_orders")
            .select("id, reference, service, amount, customer_phone, status, delivery_status, notes, created_at")
            .eq("status", "paid")
            .neq("delivery_status", "delivered")
            .order("created_at", { ascending: false })
            .limit(15),

          // Paid result checkers with issues
          admin
            .from("checker_orders")
            .select("id, reference, checker_type, amount, customer_phone, status, delivery_status, notes, created_at")
            .eq("status", "paid")
            .neq("delivery_status", "delivered")
            .order("created_at", { ascending: false })
            .limit(10),

          // Out-of-stock products
          admin
            .from("products")
            .select("id, name, network, capacity, price, in_stock")
            .eq("in_stock", false)
            .order("network"),

          // Open support chats with unread messages
          admin
            .from("chat_conversations")
            .select("id, status, unread_for_support, visitor_phone, visitor_name, last_message_at")
            .eq("status", "open")
            .gt("unread_for_support", 0)
            .order("last_message_at", { ascending: false })
            .limit(10),

          // Settings
          getCachedSettings(admin).then(m => ({ data: Object.entries(m).map(([key, value]) => ({ key, value })) }))
        ]);

        const settingsMap: Record<string, string> = {};
        (settingsRes.data || []).forEach((row: any) => {
          if (row?.key) settingsMap[row.key] = String(row.value || "").trim();
        });

        // Check live DataMart wallet balance if key available
        let datamartBalance: number | null = null;
        let datamartSpeed = "~5-30 mins";
        try {
          const dmKeys = await resolveDatamartKeys(admin);
          if (dmKeys.length > 0) {
            const bRes = await fetch("https://api.datamartgh.shop/api/developer/user/balance", {
              headers: { "x-api-key": dmKeys[0] },
              signal: AbortSignal.timeout(3500),
            });
            const bData = await bRes.json().catch(() => ({}));
            const bal = bData?.data?.walletBalance ?? bData?.walletBalance ?? bData?.data?.balance;
            if (bal != null && !isNaN(Number(bal))) {
              datamartBalance = Number(bal);
              checkAndAlertLowDatamartBalance(datamartBalance, admin).catch(() => null);
            }

            const tRes = await fetch("https://api.datamartgh.shop/api/developer/delivery-tracker", {
              headers: { "x-api-key": dmKeys[0] },
              signal: AbortSignal.timeout(3000),
            });
            const tData = await tRes.json().catch(() => ({}));
            const td = tData?.data || {};
            if (td?.lastDelivered?.placedAt && td?.lastDelivered?.deliveredAt) {
              const diffMins = Math.max(1, Math.round((new Date(td.lastDelivered.deliveredAt).getTime() - new Date(td.lastDelivered.placedAt).getTime()) / 60000));
              datamartSpeed = `~${diffMins} min(s)`;
            }
          }
        } catch (_) {}

        // Check Arkesel SMS balance from settings cache
        const arkeselSmsBalance = Number(settingsMap["arkesel_last_balance"] || settingsMap["arkesel_sms_balance"] || 100);

        const issues: any[] = [];

        // 1. Stuck data orders
        (stuckOrdersRes.data || []).forEach((o: any) => {
          const minsAgo = Math.max(15, Math.round((Date.now() - new Date(o.created_at).getTime()) / 60000));
          issues.push({
            id: `stuck-${o.reference}`,
            category: "orders",
            severity: "high",
            title: `Order ${o.reference} stuck (${minsAgo}m ago)`,
            description: `Customer ${o.recipient_phone} paid GH₵ ${o.amount} for ${o.capacity}GB ${o.network}. Status is still '${o.delivery_status}'.`,
            entity_type: "order",
            reference: o.reference,
            customer_phone: o.recipient_phone,
            created_at: o.created_at,
            suggested_actions: [
              {
                action_type: "update_order_status",
                action_label: "Mark Delivered (No SMS)",
                payload: {
                  reference: o.reference,
                  delivery_status: "delivered",
                  send_sms: false,
                  recipient_phone: o.recipient_phone,
                },
                preview: `Update order ${o.reference} to 'delivered' in database (no SMS alert).`,
                requires_confirmation: true,
              },
              {
                action_type: "resync_datamart",
                action_label: "Resync with DataMart API",
                payload: {
                  reference: o.reference,
                },
                preview: `Query live delivery status from DataMart API for ${o.reference} and sync database.`,
                requires_confirmation: true,
              },
            ],
          });
        });

        // 2. Failed data orders
        (failedOrdersRes.data || []).forEach((o: any) => {
          issues.push({
            id: `failed-${o.reference}`,
            category: "orders",
            severity: "high",
            title: `Failed Delivery: ${o.reference}`,
            description: `Payment received (GH₵ ${o.amount}) but delivery failed for ${o.capacity}GB ${o.network} to ${o.recipient_phone}.`,
            entity_type: "order",
            reference: o.reference,
            customer_phone: o.recipient_phone,
            created_at: o.created_at,
            suggested_actions: [
              {
                action_type: "retry_order",
                action_label: "Retry Dispatch to DataMart",
                payload: {
                  reference: o.reference,
                  phone: o.recipient_phone,
                  network: o.network,
                  capacity: o.capacity,
                },
                preview: `Re-dispatch ${o.capacity}GB ${o.network} to ${o.recipient_phone} via DataMart developer API.`,
                requires_confirmation: true,
              },
              {
                action_type: "update_order_status",
                action_label: "Mark Delivered Manually",
                payload: {
                  reference: o.reference,
                  delivery_status: "delivered",
                  send_sms: false,
                  recipient_phone: o.recipient_phone,
                },
                preview: `Mark order ${o.reference} as delivered (No SMS sent).`,
                requires_confirmation: true,
              },
            ],
          });
        });

        // 3. Digital Services needing fulfillment (Netflix / MashUp / AFA)
        (serviceOrdersRes.data || []).forEach((s: any) => {
          const isMashup = s.service === "mashup";
          issues.push({
            id: `service-${s.reference}`,
            category: "services",
            severity: "medium",
            title: `Pending ${s.service.toUpperCase()} Order (${s.reference})`,
            description: `Customer ${s.customer_phone} paid GH₵ ${s.amount}. Status is '${s.delivery_status}'. ${isMashup ? "Needs manual dispatch via *567*2#." : ""}`,
            entity_type: "service_order",
            reference: s.reference,
            customer_phone: s.customer_phone,
            created_at: s.created_at,
            suggested_actions: [
              {
                action_type: "update_service_status",
                action_label: "Mark Completed",
                payload: {
                  reference: s.reference,
                  delivery_status: "delivered",
                  send_sms: false,
                  customer_phone: s.customer_phone,
                },
                preview: `Set ${s.service} order ${s.reference} to 'delivered' (No SMS sent).`,
                requires_confirmation: true,
              },
            ],
          });
        });

        // 4. Result Checkers
        (checkerOrdersRes.data || []).forEach((c: any) => {
          issues.push({
            id: `checker-${c.reference}`,
            category: "services",
            severity: "medium",
            title: `Pending WAEC Checker (${c.reference})`,
            description: `Customer ${c.customer_phone} paid GH₵ ${c.amount} for ${c.checker_type}. Delivery is '${c.delivery_status}'.`,
            entity_type: "checker_order",
            reference: c.reference,
            customer_phone: c.customer_phone,
            created_at: c.created_at,
            suggested_actions: [
              {
                action_type: "update_checker_status",
                action_label: "Mark Delivered",
                payload: {
                  reference: c.reference,
                  delivery_status: "delivered",
                },
                preview: `Mark result checker order ${c.reference} as delivered.`,
                requires_confirmation: true,
              },
            ],
          });
        });

        // 5. Out of stock inventory
        (productsRes.data || []).forEach((p: any) => {
          issues.push({
            id: `stock-${p.id}`,
            category: "inventory",
            severity: "medium",
            title: `${p.network} ${p.capacity} Out of Stock`,
            description: `Package is currently disabled on the customer storefront.`,
            entity_type: "product",
            product_id: p.id,
            suggested_actions: [
              {
                action_type: "toggle_product_stock",
                action_label: "Restore to In-Stock",
                payload: {
                  product_id: p.id,
                  in_stock: true,
                  name: `${p.network} ${p.capacity}`,
                },
                preview: `Enable ${p.network} ${p.capacity} so customers can purchase again.`,
                requires_confirmation: true,
              },
            ],
          });
        });

        // 6. Unread customer support chats
        (chatsRes.data || []).forEach((ch: any) => {
          issues.push({
            id: `chat-${ch.id}`,
            category: "support",
            severity: "medium",
            title: `Customer Waiting on Chat (${ch.visitor_phone || ch.visitor_name || "Visitor"})`,
            description: `${ch.unread_for_support} unread message(s) waiting for attention.`,
            entity_type: "chat",
            conversation_id: ch.id,
            suggested_actions: [
              {
                action_type: "resolve_support_chat",
                action_label: "Mark Chat Resolved",
                payload: {
                  conversation_id: ch.id,
                },
                preview: `Clear unread count and set conversation status to 'resolved'.`,
                requires_confirmation: true,
              },
            ],
          });
        });

        // 7. DataMart wallet low balance warning
        if (datamartBalance !== null && datamartBalance < 50) {
          issues.push({
            id: "wallet-datamart-low",
            category: "wallet",
            severity: "high",
            title: `DataMart Wallet Balance Low (GH₵ ${datamartBalance.toFixed(2)})`,
            description: "Balance is under GH₵ 50. Top up your DataMart developer account so automated fast-lane dispatch does not pause.",
            suggested_actions: [],
          });
        }

        // 8. Arkesel SMS units low
        if (arkeselSmsBalance < 20) {
          issues.push({
            id: "sms-arkesel-low",
            category: "wallet",
            severity: "medium",
            title: `Arkesel SMS Credits Low (${arkeselSmsBalance} SMS)`,
            description: "Arkesel SMS balance is below 20 credits. Purchase units on sms.arkesel.com so delivery receipts continue sending.",
            suggested_actions: [],
          });
        }

        return res.status(200).json({
          ok: true,
          issues,
          summary: {
            total_issues: issues.length,
            high_severity: issues.filter((i) => i.severity === "high").length,
            stuck_orders: (stuckOrdersRes.data || []).length,
            failed_orders: (failedOrdersRes.data || []).length,
            out_of_stock: (productsRes.data || []).length,
            open_support: (chatsRes.data || []).length,
            datamart_balance: datamartBalance,
            datamart_speed: datamartSpeed,
            arkesel_balance: arkeselSmsBalance,
          },
        });
      }

      // ── SUB-ACTION 2: EXECUTE CONFIRMED ACTION SAFELY ──
      if (aiSubAction === "executeAiAction" || aiSubAction === "execute") {
        const { action_type, payload } = body;
        if (!action_type || !payload) {
          return res.status(400).json({ error: "Missing action_type or payload for execution." });
        }

        console.log(`🤖 STONY EXECUTING CONFIRMED ADMIN ACTION: ${action_type}`, payload);

        // Action A: Update Telecom Order Status or Payment Status
        if (action_type === "update_order_status" || action_type === "update_payment_status") {
          const { reference, order_id, delivery_status, payment_status, status } = payload;
          const updates: Record<string, any> = {
            updated_at: new Date().toISOString(),
          };
          if (delivery_status) updates.delivery_status = delivery_status;
          if (payment_status) updates.payment_status = payment_status;
          if (status && !delivery_status && !payment_status) {
            if (/^(paid|pending|refunded)$/i.test(status)) updates.payment_status = status.toLowerCase();
            else updates.delivery_status = status.toLowerCase();
          }

          try {
            let lq = data1db.getClient().from("orders").update(updates);
            if (reference) lq = lq.eq("reference", reference);
            else if (order_id) lq = lq.eq("id", order_id);
            await lq;
          } catch (_) {}

          let q = admin.from("orders").update(updates);
          if (reference) q = q.eq("reference", reference);
          else if (order_id) q = q.eq("id", order_id);
          else return res.status(400).json({ error: "Missing order reference or id" });

          const { data, error } = await q.select("*").maybeSingle();
          if (error) return res.status(500).json({ error: error.message });

          const desc = updates.payment_status
            ? `payment marked as ${updates.payment_status}`
            : `delivery marked as ${updates.delivery_status}`;

          return res.status(200).json({
            ok: true,
            action_type,
            message: `Order ${reference || order_id} successfully ${desc}!`,
            order: data,
          });
        }

        // Action B: Resync with DataMart API
        if (action_type === "resync_datamart") {
          const { reference } = payload;
          if (!reference) return res.status(400).json({ error: "Missing order reference" });
          const { data: targetOrder } = await admin
            .from("orders")
            .select("*")
            .or(`reference.eq.${reference},datamart_reference.eq.${reference}`)
            .maybeSingle();
          if (!targetOrder) return res.status(404).json({ error: "Order not found" });

          const dmKeys = await resolveDatamartKeys(admin);
          const syncRes = await syncOrderWithDatamart(targetOrder, admin, dmKeys);
          return res.status(200).json({
            ok: true,
            action_type,
            message: syncRes?.delivery_status
              ? `DataMart live status for ${reference}: ${syncRes.delivery_status}`
              : `Order checked. Live DataMart status recorded.`,
            order: syncRes || targetOrder,
            result: syncRes,
          });
        }

        // Action C: Retry Dispatch via DataMart
        if (action_type === "retry_order") {
          const { reference, phone, network, capacity } = payload;
          if (!phone) return res.status(400).json({ error: "Missing recipient phone" });

          // If order already has a valid datamart_reference or is completed, reject redundant dispatch!
          if (reference) {
            const { data: exOrder } = await admin
              .from("orders")
              .select("id, datamart_reference, delivery_status")
              .eq("reference", reference)
              .maybeSingle();

            if (exOrder?.datamart_reference) {
              return res.status(200).json({
                success: true,
                message: `Order ${reference} is already dispatched to DataMart (${exOrder.datamart_reference}). Redundant dispatch blocked.`,
                datamart_reference: exOrder.datamart_reference,
              });
            }
          }

          const dmKeys = await resolveDatamartKeys(admin);
          if (dmKeys.length === 0) {
            return res.status(400).json({ error: "DataMart API key not found in system settings." });
          }

          const netMap: Record<string, string> = {
            mtn: "YELLO",
            telecel: "TELECEL",
            airteltigo: "AT_PREMIUM",
            at: "AT_PREMIUM",
          };
          const cleanNet = netMap[String(network || "").toLowerCase()] || "YELLO";
          const cleanCap = String(capacity || "1").replace(/\D/g, "") || "1";
          const dmSecret = await resolveDatamartSecret(admin);

          // 🔒 Claim dispatch lock before retry purchase
          if (reference) {
            const claimed = await claimOrderDispatchLock(reference, admin);
            if (!claimed) {
              return res.status(200).json({
                success: true,
                message: `Order ${reference} is already being dispatched right now by another process.`,
              });
            }
          }

          const dmResult = await executeDatamartPurchase({
            apiKey: dmKeys[0],
            secret: dmSecret,
            phoneNumber: phone,
            network: cleanNet,
            capacity: cleanCap,
            reference: reference || `WS-MANUAL-${Date.now()}`,
          });

          const dmData = dmResult.data;
          const newRef = dmResult.reference || dmData?.data?.reference || dmData?.data?.orderReference || null;

          if (!dmResult.success) {
            if (reference) {
              await releaseOrderDispatchLock(reference, admin, "failed");
            }
            const errMsg = dmResult.error || `DataMart returned status ${dmResult.status}`;
            if (dmResult.isLowBalance || isDatamartLowBalanceError(errMsg, dmResult.status)) {
              if (reference) {
                sendAdminLowBalanceOrderFailedAlert(
                  {
                    reference,
                    recipientPhone: phone,
                    network: cleanNet,
                    capacity: `${cleanCap}GB`,
                    errorMessage: errMsg,
                  },
                  admin
                ).catch(() => null);
              }
              return res.status(400).json({
                error: `DataMart wallet balance is too low! ${errMsg}. Please top up your wallet at datamartgh.shop.`,
                is_low_balance: true,
                data: dmData,
              });
            }
            return res.status(400).json({
              error: errMsg,
              data: dmData,
            });
          }

          if (reference) {
            await admin.from("orders").update({
              delivery_status: "processing",
              datamart_reference: newRef || undefined,
              supplier_status: "datamart",
              updated_at: new Date().toISOString(),
            }).eq("reference", reference);
          }

          return res.status(200).json({
            ok: true,
            action_type,
            message: `Purchase dispatched for ${cleanCap}GB to ${phone}! New ref: ${newRef || "Recorded"}.`,
            data: dmData,
          });
        }

        // Action D: Update Digital Service Order Status (Netflix, MashUp, AFA)
        if (action_type === "update_service_status") {
          const { reference, delivery_status, send_sms, customer_phone, sms_message } = payload;
          if (!reference) return res.status(400).json({ error: "Missing service order reference" });

          const { data, error } = await admin
            .from("service_orders")
            .update({ delivery_status })
            .eq("reference", reference)
            .select("*")
            .maybeSingle();

          if (error) return res.status(500).json({ error: error.message });

          // Per owner instruction: Stop sending SMS when service delivery status is updated
          let smsSent = false;

          return res.status(200).json({
            ok: true,
            action_type,
            message: `Service order ${reference} marked as ${delivery_status}!${smsSent ? " Customer SMS alert sent." : ""}`,
            order: data,
          });
        }

        // Action E: Update Checker Order Status
        if (action_type === "update_checker_status") {
          const { reference, delivery_status } = payload;
          if (!reference) return res.status(400).json({ error: "Missing checker reference" });

          const { data, error } = await admin
            .from("checker_orders")
            .update({ delivery_status })
            .eq("reference", reference)
            .select("*")
            .maybeSingle();

          if (error) return res.status(500).json({ error: error.message });

          return res.status(200).json({
            ok: true,
            action_type,
            message: `Result checker order ${reference} updated to ${delivery_status}!`,
            order: data,
          });
        }

        // Action F: Send Custom SMS via Arkesel
        if (action_type === "send_sms") {
          const { phone, message } = payload;
          if (!phone || !message) return res.status(400).json({ error: "Missing phone or message" });

          const smsRes = await sendArkeselSms(admin, phone, message);
          if (!smsRes.ok) return res.status(400).json({ error: smsRes.error || "Failed to send SMS" });

          return res.status(200).json({
            ok: true,
            action_type,
            message: `SMS successfully delivered to ${phone}!`,
          });
        }

        // Action G: Toggle Product Stock
        if (action_type === "toggle_product_stock") {
          const { product_id, in_stock, name } = payload;
          if (!product_id) return res.status(400).json({ error: "Missing product_id" });

          const { error } = await admin
            .from("products")
            .update({ in_stock: Boolean(in_stock), updated_at: new Date().toISOString() })
            .eq("id", product_id);

          if (error) return res.status(500).json({ error: error.message });

          return res.status(200).json({
            ok: true,
            action_type,
            message: `${name || "Product"} is now ${in_stock ? "IN STOCK" : "OUT OF STOCK"}!`,
          });
        }

        // Action H: Resolve Support Chat
        if (action_type === "resolve_support_chat") {
          const { conversation_id } = payload;
          if (!conversation_id) return res.status(400).json({ error: "Missing conversation_id" });

          const { error } = await admin
            .from("chat_conversations")
            .update({ status: "resolved", unread_for_support: 0, updated_at: new Date().toISOString() })
            .eq("id", conversation_id);

          if (error) return res.status(500).json({ error: error.message });

          return res.status(200).json({
            ok: true,
            action_type,
            message: "Chat conversation marked as resolved!",
          });
        }

        // Action I: Toggle Setting
        if (action_type === "toggle_setting") {
          const { key, value } = payload;
          if (!key) return res.status(400).json({ error: "Missing setting key" });

          const { error } = await admin
            .from("settings")
            .upsert({ key, value: String(value) }, { onConflict: "key" });

          if (error) return res.status(500).json({ error: error.message });

          return res.status(200).json({
            ok: true,
            action_type,
            message: `Setting ${key} updated successfully!`,
          });
        }

        // Action J: Update Product Price
        if (action_type === "update_product_price") {
          const { product_id, network, capacity, price, name } = payload;
          const newPrice = parseFloat(String(price || payload.new_price || 0));
          if (newPrice <= 0) return res.status(400).json({ error: "Invalid price" });

          let q = admin.from("products").update({ price: newPrice, updated_at: new Date().toISOString() });
          if (product_id) {
            q = q.eq("id", product_id);
          } else if (network && capacity) {
            const cleanNet = String(network).trim();
            const cleanCap = String(capacity).replace(/\D/g, "");
            q = q.ilike("network", `%${cleanNet}%`).eq("capacity", cleanCap);
          } else if (name) {
            q = q.ilike("name", `%${name}%`);
          } else {
            return res.status(400).json({ error: "Missing product identifier or network/capacity" });
          }
          const { data, error } = await q.select("*");
          if (error) return res.status(500).json({ error: error.message });
          return res.status(200).json({
            ok: true,
            action_type,
            message: `Product price updated to GH₵ ${newPrice.toFixed(2)} on the site live!`,
            products: data,
          });
        }

        // Action K: Broadcast Bulk SMS
        if (action_type === "broadcast_sms") {
          const { target_group, message } = payload;
          if (!message) return res.status(400).json({ error: "Missing broadcast message" });
          const { data: sRows } = await admin.from("settings").select("key,value").in("key", ["arkesel_api_key", "ARKESEL_API_KEY"]);
          const arkeselKey = sRows?.[0]?.value || process.env.ARKESEL_API_KEY || "";
          if (!arkeselKey) return res.status(400).json({ error: "Arkesel API key not configured" });

          let recipientPhones: string[] = [];
          const tg = String(target_group || "customers").toLowerCase();
          if (tg.includes("agent")) {
            const { data: agRows } = await admin.from("agents").select("phone");
            recipientPhones = (agRows || []).map((a: any) => a.phone).filter(Boolean);
          } else if (tg.includes("customer")) {
            const [oRes, sRes] = await Promise.all([
              admin.from("orders").select("recipient_phone").limit(80),
              admin.from("service_orders").select("customer_phone").limit(50),
            ]);
            recipientPhones = [
              ...(oRes.data || []).map((o: any) => o.recipient_phone),
              ...(sRes.data || []).map((s: any) => s.customer_phone),
            ].filter(Boolean);
          } else {
            recipientPhones = tg.split(/[\s,]+/);
          }
          const bResult = await sendArkeselBulkSmsDirect(arkeselKey, recipientPhones, message);
          return res.status(200).json({
            ok: true,
            action_type,
            message: `Bulk SMS broadcast complete: ${bResult.sent} of ${bResult.total} messages dispatched successfully via D_1Gh!`,
            result: bResult,
          });
        }

        // Action L: Generate Free Data Vouchers
        if (action_type === "generate_vouchers") {
          const count = Math.min(50, Math.max(1, parseInt(payload.count || "5", 10)));
          const network = String(payload.network || "MTN").toUpperCase();
          const capacity = String(payload.capacity || "1").replace(/\D/g, "") || "1";
          const resV = await generateFreeDataVouchersDirect(admin, count, network, capacity);
          return res.status(200).json({
            ok: true,
            action_type,
            message: `Generated ${resV.codes.length} free data vouchers for ${capacity}GB ${network}!`,
            codes: resV.codes,
          });
        }

        // Action M: Toggle Free Data Campaign
        if (action_type === "toggle_free_data") {
          const active = Boolean(payload.active);
          const val = active ? "true" : "false";
          await admin.from("settings").upsert([
            { key: "free_data_campaign_active", value: val },
            { key: "free_data_enabled", value: val },
          ], { onConflict: "key" });
          return res.status(200).json({
            ok: true,
            action_type,
            message: `Free Data Campaign is now ${active ? "ACTIVE & LIVE on storefront" : "DISABLED on storefront"}!`,
          });
        }

        // Action N: Credit Agent Wallet
        if (action_type === "credit_agent") {
          const { phone, agent_id, amount } = payload;
          const amt = parseFloat(String(amount || 0));
          if (amt <= 0) return res.status(400).json({ error: "Invalid credit amount" });
          const { data: agents } = await admin.from("agents").select("*");
          const cleanT = String(phone || agent_id || "").replace(/\D/g, "");
          const target = (agents || []).find((a: any) =>
            a.id === agent_id ||
            (cleanT && a.phone && String(a.phone).replace(/\D/g, "").endsWith(cleanT.slice(-9))) ||
            (a.name && phone && a.name.toLowerCase().includes(phone.toLowerCase()))
          );
          if (!target) return res.status(404).json({ error: `Could not find agent "${phone || agent_id}"` });
          const newBal = Number(target.wallet_balance || 0) + amt;
          await admin.from("agents").update({ wallet_balance: newBal }).eq("id", target.id);
          return res.status(200).json({
            ok: true,
            action_type,
            message: `Agent ${target.name || target.store_name || target.phone} credited with GH₵ ${amt.toFixed(2)}! New balance: GH₵ ${newBal.toFixed(2)}.`,
            agent: { ...target, wallet_balance: newBal },
          });
        }

        // Action O: Update Announcement
        if (action_type === "update_announcement") {
          const { message, title, enabled } = payload;
          const updates: Array<{ key: string; value: string }> = [];
          if (message !== undefined) updates.push({ key: "announcement_message", value: String(message) });
          if (title !== undefined) updates.push({ key: "announcement_title", value: String(title) });
          if (enabled !== undefined) updates.push({ key: "announcement_enabled", value: enabled ? "true" : "false" });
          if (updates.length > 0) {
            await admin.from("settings").upsert(updates, { onConflict: "key" });
          }
          return res.status(200).json({
            ok: true,
            action_type,
            message: "Storefront announcement banner updated live!",
          });
        }

        // Action P: Change Theme Color
        if (action_type === "change_theme_color") {
          const colorVal = String(payload.color || "gold").trim().toLowerCase();
          await admin.from("settings").upsert([
            { key: "site_theme", value: colorVal },
            { key: "theme_color", value: colorVal },
            { key: "primary_color", value: colorVal },
          ], { onConflict: "key" });
          return res.status(200).json({
            ok: true,
            action_type,
            message: `Store theme color updated to ${colorVal.toUpperCase()}!`,
          });
        }

        // Action Q: Update Setting
        if (action_type === "update_setting") {
          const { key, value } = payload;
          if (!key) return res.status(400).json({ error: "Missing setting key" });
          await admin.from("settings").upsert({ key: String(key), value: String(value) }, { onConflict: "key" });
          return res.status(200).json({
            ok: true,
            action_type,
            message: `Setting "${key}" updated successfully!`,
          });
        }

        // Action R: Pause / Resume Store Orders
        if (action_type === "pause_orders" || action_type === "toggle_store_orders") {
          const paused = payload.paused !== undefined ? Boolean(payload.paused) : true;
          await admin.from("settings").upsert(
            { key: "orders_paused", value: paused ? "true" : "false" },
            { onConflict: "key" }
          );
          return res.status(200).json({
            ok: true,
            action_type,
            message: paused ? "Store orders have been PAUSED on the website!" : "Store orders have been RESUMED on the website!",
          });
        }

        return res.status(400).json({ error: `Unknown action_type: ${action_type}` });
      }

      // ── SUB-ACTION 3: ADMIN AI CO-PILOT CHAT ENGINE ──
      if (aiSubAction === "aiCoPilotChat" || aiSubAction === "chat") {
        const userMsg = String(body?.message || "").trim();
        const historyTurns = Array.isArray(body?.history) ? body.history : [];
        const stagedAction = body?.staged_action;
        const isConfirmed = Boolean(body?.confirmed);

        // Helper: execute an action directly in-process
        const localDb = data1db.getClient();
        const executeDirectAction = async (actionType: string, actionPayload: any) => {
          if (actionType === "update_order_status" || actionType === "update_payment_status") {
            const { reference, order_id, delivery_status, payment_status, status } = actionPayload;
            const updates: Record<string, any> = { updated_at: new Date().toISOString() };
            if (delivery_status) updates.delivery_status = delivery_status;
            if (payment_status) updates.payment_status = payment_status;
            if (status && !delivery_status && !payment_status) {
              if (/^(paid|pending|refunded)$/i.test(status)) updates.payment_status = status.toLowerCase();
              else updates.delivery_status = status.toLowerCase();
            }
            try {
              let lq = localDb.from("orders").update(updates);
              if (reference) lq = lq.ilike("reference", `%${reference}%`);
              else if (order_id) lq = lq.eq("id", order_id);
              await lq;
            } catch (_) {}
            let q = admin.from("orders").update(updates);
            if (reference) q = q.ilike("reference", `%${reference}%`);
            else if (order_id) q = q.eq("id", order_id);
            const { error } = await q;
            if (error) throw error;
            return `Order ${reference || order_id} marked as ${(updates.delivery_status || updates.payment_status || "updated").toUpperCase()}!`;
          }

          if (actionType === "update_product_price") {
            const { product_id, network, capacity, price, name } = actionPayload;
            const newPrice = parseFloat(String(price || actionPayload.new_price || 0));
            try {
              let lq = localDb.from("products").update({ price: newPrice, updated_at: new Date().toISOString() });
              if (product_id) lq = lq.eq("id", product_id);
              else if (network && capacity) lq = lq.ilike("network", `%${network}%`).eq("capacity", String(capacity).replace(/\D/g, ""));
              else if (name) lq = lq.ilike("name", `%${name}%`);
              await lq;
            } catch (_) {}
            let q = admin.from("products").update({ price: newPrice, updated_at: new Date().toISOString() });
            if (product_id) q = q.eq("id", product_id);
            else if (network && capacity) q = q.ilike("network", `%${network}%`).eq("capacity", String(capacity).replace(/\D/g, ""));
            else if (name) q = q.ilike("name", `%${name}%`);
            await q;
            return `Product price updated to GH₵ ${newPrice.toFixed(2)} on the storefront!`;
          }

          if (actionType === "toggle_product_stock") {
            const inStock = Boolean(actionPayload.in_stock);
            try {
              let lq = localDb.from("products").update({ in_stock: inStock, updated_at: new Date().toISOString() });
              if (actionPayload.product_id) lq = lq.eq("id", actionPayload.product_id);
              else if (actionPayload.name) lq = lq.ilike("name", `%${actionPayload.name}%`);
              await lq;
            } catch (_) {}
            let q = admin.from("products").update({ in_stock: inStock, updated_at: new Date().toISOString() });
            if (actionPayload.product_id) q = q.eq("id", actionPayload.product_id);
            else if (actionPayload.name) q = q.ilike("name", `%${actionPayload.name}%`);
            await q;
            return `${actionPayload.name || "Product"} is now ${inStock ? "IN STOCK" : "OUT OF STOCK"}!`;
          }

          if (actionType === "send_sms") {
            await sendArkeselSms(admin, actionPayload.phone, actionPayload.message);
            return `SMS dispatched to ${actionPayload.phone}.`;
          }

          if (actionType === "broadcast_sms") {
            const { data: sRows } = await admin.from("settings").select("key,value").in("key", ["arkesel_api_key", "ARKESEL_API_KEY"]);
            const arkeselKey = sRows?.[0]?.value || process.env.ARKESEL_API_KEY || "";
            if (arkeselKey) {
              const [oRes] = await Promise.all([admin.from("orders").select("recipient_phone").limit(80)]);
              const phones = (oRes.data || []).map((o: any) => o.recipient_phone).filter(Boolean);
              const bRes = await sendArkeselBulkSmsDirect(arkeselKey, phones, actionPayload.message);
              return `Bulk SMS dispatched to ${bRes.sent} recipients!`;
            }
            return "Arkesel SMS key not configured.";
          }

          if (actionType === "generate_vouchers") {
            const count = Math.min(50, Math.max(1, parseInt(actionPayload.count || "5", 10)));
            const resV = await generateFreeDataVouchersDirect(admin, count, actionPayload.network || "MTN", actionPayload.capacity || "1");
            return `Generated ${resV.codes.length} free data codes: ${resV.codes.join(", ")}`;
          }

          if (actionType === "toggle_free_data") {
            const val = actionPayload.active ? "true" : "false";
            const rows = [
              { key: "free_data_campaign_active", value: val },
              { key: "free_data_enabled", value: val },
            ];
            try { await localDb.from("settings").upsert(rows, { onConflict: "key" }); } catch (_) {}
            await admin.from("settings").upsert(rows, { onConflict: "key" });
            invalidateSettingsCache();
            return `Free data campaign is now ${actionPayload.active ? "ACTIVE on storefront" : "DISABLED"}.`;
          }

          if (actionType === "credit_agent") {
            const { phone, agent_id, amount } = actionPayload;
            const amt = parseFloat(String(amount || 0));
            const { data: agents } = await admin.from("agents").select("*");
            const cleanT = String(phone || agent_id || "").replace(/\D/g, "");
            const target = (agents || []).find((a: any) =>
              a.id === agent_id ||
              (cleanT && a.phone && String(a.phone).replace(/\D/g, "").endsWith(cleanT.slice(-9))) ||
              (a.name && phone && a.name.toLowerCase().includes(phone.toLowerCase()))
            );
            if (target) {
              const newBal = Number(target.wallet_balance || 0) + amt;
              try { await localDb.from("agents").update({ wallet_balance: newBal }).eq("id", target.id); } catch (_) {}
              await admin.from("agents").update({ wallet_balance: newBal }).eq("id", target.id);
              return `Agent ${target.name || target.phone} credited with GH₵ ${amt.toFixed(2)} (New balance: GH₵ ${newBal.toFixed(2)}).`;
            }
            return `Could not find agent "${phone || agent_id}".`;
          }

          if (actionType === "resync_datamart") {
            const { data: targetOrder } = await admin.from("orders").select("*").or(`reference.eq.${actionPayload.reference},datamart_reference.eq.${actionPayload.reference}`).maybeSingle();
            let syncRes = targetOrder;
            if (targetOrder) {
              const dmKeys = await resolveDatamartKeys(admin);
              syncRes = await syncOrderWithDatamart(targetOrder, admin, dmKeys);
            }
            return `Order ${actionPayload.reference} live carrier status: ${syncRes?.delivery_status || "Updated"}.`;
          }

          if (actionType === "update_announcement") {
            const { message, title, enabled } = actionPayload;
            const updates: Array<{ key: string; value: string }> = [];
            if (message !== undefined) {
              updates.push({ key: "announcement_message", value: String(message) });
              updates.push({ key: "announcement_text", value: String(message) });
            }
            if (title !== undefined) updates.push({ key: "announcement_title", value: String(title) });
            if (enabled !== undefined) updates.push({ key: "announcement_enabled", value: enabled ? "true" : "false" });
            if (updates.length > 0) {
              try { await localDb.from("settings").upsert(updates, { onConflict: "key" }); } catch (_) {}
              await admin.from("settings").upsert(updates, { onConflict: "key" });
              invalidateSettingsCache();
            }
            return "Storefront announcement banner updated live!";
          }

          if (actionType === "change_theme_color") {
            const colorVal = String(actionPayload.color || "gold").trim().toLowerCase();
            const rows = [
              { key: "site_theme", value: colorVal },
              { key: "theme_color", value: colorVal },
              { key: "primary_color", value: colorVal },
            ];
            try { await localDb.from("settings").upsert(rows, { onConflict: "key" }); } catch (_) {}
            await admin.from("settings").upsert(rows, { onConflict: "key" });
            invalidateSettingsCache();
            return `Store theme color switched to ${colorVal.toUpperCase()}!`;
          }

          if (actionType === "update_setting") {
            const { key, value } = actionPayload;
            if (key) {
              const row = { key: String(key), value: String(value ?? "") };
              try { await localDb.from("settings").upsert(row, { onConflict: "key" }); } catch (_) {}
              await admin.from("settings").upsert(row, { onConflict: "key" });
              invalidateSettingsCache();
              return `Setting "${key}" updated to "${value}" in store database!`;
            }
            return "Missing setting key.";
          }

          if (actionType === "update_service_status") {
            const { reference, status, delivery_status } = actionPayload;
            const targetStatus = status || delivery_status || "delivered";
            try {
              let lq = localDb.from("service_orders").update({ delivery_status: targetStatus });
              if (reference) lq = lq.ilike("reference", `%${reference}%`);
              await lq;
            } catch (_) {}
            let q = admin.from("service_orders").update({ delivery_status: targetStatus });
            if (reference) q = q.ilike("reference", `%${reference}%`);
            await q;
            return `Digital service order ${reference || ""} marked as ${targetStatus.toUpperCase()}!`;
          }

          if (actionType === "post_to_channel" || actionType === "broadcast_channel" || actionType === "channel_post") {
            const botUrl = (process.env.WHATSAPP_BOT_SERVER_URL || "https://nestybot.onrender.com").replace(/\/+$/, "");
            const topic = String(actionPayload.topic || actionPayload.mode || (actionPayload.message ? "custom" : "prices")).trim();
            const text = String(actionPayload.message || actionPayload.text || actionPayload.body || "").trim();
            try {
              const resp = await fetch(`${botUrl}/api/channel-post`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ topic, text, ownerPhone: body.phone || "233547100951" }),
              });
              const data: any = await resp.json().catch(() => ({}));
              if (data?.directPosted) {
                return `📢 Posted Live to WhatsApp Channel (${data.channelUrl})!`;
              }
              if (data?.pairingCode) {
                return `🔐 1-Time WhatsApp Channel Link Needed! Enter Pairing Code *${data.pairingCode}* in WhatsApp → Linked Devices → Link with phone number, and your queued post will publish automatically into ${data.channelUrl}!`;
              }
              return `📢 Channel post prepared for ${data?.channelUrl || "https://whatsapp.com/channel/0029Vb7vwLN5kg70GeNMsB2w"}.`;
            } catch (err: any) {
              return `Channel post dispatch error: ${err?.message}`;
            }
          }

          if (actionType === "update_checker_status") {
            const { reference, status, delivery_status } = actionPayload;
            const targetStatus = status || delivery_status || "delivered";
            try {
              let lq = localDb.from("checker_orders").update({ delivery_status: targetStatus });
              if (reference) lq = lq.ilike("reference", `%${reference}%`);
              await lq;
            } catch (_) {}
            let q = admin.from("checker_orders").update({ delivery_status: targetStatus });
            if (reference) q = q.ilike("reference", `%${reference}%`);
            await q;
            return `Result checker order ${reference || ""} marked as ${targetStatus.toUpperCase()}!`;
          }

          if (actionType === "resolve_support_chat") {
            const { conversation_id, phone } = actionPayload;
            let q = admin.from("chat_conversations").update({ status: "resolved", unread_for_support: 0, updated_at: new Date().toISOString() });
            if (conversation_id) q = q.eq("id", conversation_id);
            else if (phone) q = q.eq("customer_phone", phone);
            else q = q.eq("status", "open");
            await q;
            return `Customer support conversation marked as resolved!`;
          }

          if (actionType === "query_top_customers") {
            const topStats = await getTopOrderingCustomers(admin, actionPayload?.limit || 5);
            return `Top Customers:\n${topStats.text}`;
          }

          if (actionType === "query_delivery_times") {
            const delStats = await getAccurateLiveDeliveryStats(admin);
            return `Live Delivery Times:\n${delStats.summaryText}`;
          }

          if (actionType === "lookup_phone") {
            const phone = actionPayload?.phone || actionPayload?.recipient_phone;
            if (phone) return await getCustomerPhoneOrders(admin, phone);
            return "Missing phone number to look up.";
          }

          if (actionType === "list_recent_orders") {
            const { data: recOrds } = await admin
              .from("orders")
              .select("reference, network, capacity, amount, recipient_phone, payment_status, delivery_status, created_at")
              .order("created_at", { ascending: false })
              .limit(8);
            if (recOrds && recOrds.length > 0) {
              const lines = recOrds.map((o: any, i: number) =>
                `${i + 1}. *${o.reference}* — ${o.capacity}GB ${o.network} to *${o.recipient_phone || "—"}*\n   • Status: *${(o.delivery_status || "pending").toUpperCase()}* | Paid: *${o.payment_status || "pending"}* | GH₵ ${Number(o.amount || 0).toFixed(2)}`
              );
              return `📦 Latest Orders:\n${lines.join("\n")}`;
            }
            return "No recent orders found in database.";
          }

          return "Action executed.";
        };

        // Helper: get live DataMart balance safely
        const getLiveDatamartBalance = async (adm: any) => {
          try {
            const dmKeys = await resolveDatamartKeys(adm);
            const dmSecret = await resolveDatamartSecret(adm);
            if (!dmKeys || dmKeys.length === 0) return null;
            const headers: Record<string, string> = {
              "x-api-key": dmKeys[0],
              Accept: "application/json",
            };
            if (dmSecret) headers["x-api-secret"] = dmSecret;

            const bRes = await fetch("https://api.datamartgh.shop/api/developer/balance", {
              headers,
              signal: AbortSignal.timeout(4000),
            });
            if (bRes.ok) {
              const bData = await bRes.json().catch(() => ({}));
              const bal =
                bData?.data?.balance ??
                bData?.data?.walletBalance ??
                bData?.balance ??
                bData?.walletBalance;
              if (bal != null && !isNaN(Number(bal))) {
                const num = Number(bal);
                await adm.from("settings").upsert({ key: "datamart_last_balance", value: String(num) }, { onConflict: "key" });
                return { balance: num };
              }
            }
          } catch (_) {}
          return null;
        };

        // Helper: get live Arkesel SMS balance safely
        const getLiveArkeselBalance = async (adm: any) => {
          try {
            const { data: sRows } = await adm.from("settings").select("key,value").in("key", ["arkesel_api_key", "ARKESEL_API_KEY", "arkesel_last_balance", "arkesel_sms_balance"]);
            const sMap: Record<string, string> = {};
            (sRows || []).forEach((r: any) => { if (r.key) sMap[r.key] = r.value; });
            const arkeselKey = sMap["arkesel_api_key"] || sMap["ARKESEL_API_KEY"] || process.env.ARKESEL_API_KEY || "";
            if (arkeselKey) {
              const resp = await fetch("https://sms.arkesel.com/api/v2/clients/balance", {
                headers: { "api-key": arkeselKey, Accept: "application/json" },
                signal: AbortSignal.timeout(3500),
              });
              if (resp.ok) {
                const j = await resp.json().catch(() => ({}));
                const bal = j?.data?.sms_balance ?? j?.sms_balance ?? j?.balance;
                if (bal != null && !isNaN(Number(bal))) return Number(bal);
              }
            }
            const cached = sMap["arkesel_last_balance"] || sMap["arkesel_sms_balance"];
            if (cached && !isNaN(Number(cached))) return Number(cached);
          } catch (_) {}
          return null;
        };

        // Helper: calculate accurate live delivery speeds from DataMart API and recent database orders
        const getAccurateLiveDeliveryStats = async (adm: any) => {
          let fastLaneMinutes: number | null = null;
          let pendingBatches = 0;

          try {
            const dmKeys = await resolveDatamartKeys(adm).catch(() => []);
            const [trackerRes, statusRes] = await Promise.all([
              dmKeys.length > 0
                ? fetch("https://api.datamartgh.shop/api/developer/delivery-tracker", {
                    headers: { "X-API-Key": dmKeys[0], Accept: "application/json" },
                    signal: AbortSignal.timeout(3000),
                  }).catch(() => null)
                : Promise.resolve(null),
              fetch("https://api.datamartgh.shop/api/v1/data/delivery-status", {
                headers: { Accept: "application/json" },
                signal: AbortSignal.timeout(3000),
              }).catch(() => null),
            ]);

            if (trackerRes && trackerRes.ok) {
              const td = await trackerRes.json().catch(() => ({}));
              const d = td?.data || {};
              if (d?.scanner?.pendingBatches != null) pendingBatches = Number(d.scanner.pendingBatches);
            }

            if (statusRes && statusRes.ok) {
              const sj = await statusRes.json().catch(() => ({}));
              const s = sj?.data;
              if (s?.unibundleActive && s?.unibundleFrontier?.placedAt && s?.unibundleFrontier?.deliveredAt) {
                const p = new Date(s.unibundleFrontier.placedAt).getTime();
                const d = new Date(s.unibundleFrontier.deliveredAt).getTime();
                fastLaneMinutes = Math.max(1, Math.round((d - p) / 60000));
              }
            }
          } catch (_) {}

          // Calculate actual speed from last delivered orders
          let dbMtnSecs = 45;
          let dbTelecelSecs = 60;
          let dbAtSecs = 35;
          let sampleCount = 0;

          try {
            const { data: deliveredOrders } = await adm
              .from("orders")
              .select("network, created_at, updated_at")
              .eq("delivery_status", "delivered")
              .order("created_at", { ascending: false })
              .limit(30);

            if (deliveredOrders && deliveredOrders.length > 0) {
              const networkDeltas: Record<string, number[]> = { mtn: [], telecel: [], at: [] };
              deliveredOrders.forEach((o: any) => {
                if (o.created_at && o.updated_at) {
                  const diff = (new Date(o.updated_at).getTime() - new Date(o.created_at).getTime()) / 1000;
                  if (diff >= 10 && diff <= 1800) {
                    const net = String(o.network || "").toLowerCase();
                    if (net.includes("mtn")) networkDeltas.mtn.push(diff);
                    else if (net.includes("telecel") || net.includes("vodafone")) networkDeltas.telecel.push(diff);
                    else if (net.includes("at") || net.includes("airteltigo")) networkDeltas.at.push(diff);
                    sampleCount++;
                  }
                }
              });

              if (networkDeltas.mtn.length > 0) {
                dbMtnSecs = Math.round(networkDeltas.mtn.reduce((a, b) => a + b, 0) / networkDeltas.mtn.length);
              }
              if (networkDeltas.telecel.length > 0) {
                dbTelecelSecs = Math.round(networkDeltas.telecel.reduce((a, b) => a + b, 0) / networkDeltas.telecel.length);
              }
              if (networkDeltas.at.length > 0) {
                dbAtSecs = Math.round(networkDeltas.at.reduce((a, b) => a + b, 0) / networkDeltas.at.length);
              }
            }
          } catch (_) {}

          const formatSecs = (sec: number) => {
            if (sec < 60) return `${sec} seconds`;
            const mins = (sec / 60).toFixed(1).replace(/\.0$/, "");
            return `${mins} min(s)`;
          };

          const mtnSpeed = formatSecs(dbMtnSecs);
          const telecelSpeed = formatSecs(dbTelecelSecs);
          const atSpeed = formatSecs(dbAtSecs);

          return {
            mtnSpeed,
            telecelSpeed,
            atSpeed,
            fastLaneMinutes,
            pendingBatches,
            sampleCount,
            summaryText: `• MTN Turbo Delivery: ${mtnSpeed}\n• Telecel Fast Delivery: ${telecelSpeed}\n• AT / AirtelTigo Delivery: ${atSpeed}\n• Carrier Queue Status: ${pendingBatches === 0 ? "Clear (0 pending batches)" : `${pendingBatches} batch(es) in queue`}`,
          };
        };

        // Helper: query top customers by order count
        const getTopOrderingCustomers = async (adm: any, limit = 5) => {
          try {
            const { data: allOrders } = await adm
              .from("orders")
              .select("recipient_phone, amount, payment_status, delivery_status, created_at")
              .order("created_at", { ascending: false })
              .limit(80);

            if (!allOrders || allOrders.length === 0) {
              return { list: [], totalCustomers: 0, text: "No orders found in database yet." };
            }

            const map: Record<string, { phone: string; count: number; paidCount: number; deliveredCount: number; totalGhs: number }> = {};

            allOrders.forEach((o: any) => {
              const ph = String(o.recipient_phone || "").trim();
              if (!ph) return;
              if (!map[ph]) {
                map[ph] = { phone: ph, count: 0, paidCount: 0, deliveredCount: 0, totalGhs: 0 };
              }
              map[ph].count += 1;
              if (/paid/i.test(o.payment_status || "")) {
                map[ph].paidCount += 1;
                map[ph].totalGhs += Number(o.amount || 0);
              }
              if (/delivered/i.test(o.delivery_status || "")) {
                map[ph].deliveredCount += 1;
              }
            });

            const sorted = Object.values(map).sort((a, b) => b.count - a.count);
            const top = sorted.slice(0, limit);

            const formattedLines = top.map((c, i) =>
              `${i + 1}. *${c.phone}* — *${c.count} total orders* (${c.deliveredCount} delivered) • Total Spent: *GH₵ ${c.totalGhs.toFixed(2)}*`
            );

            return {
              list: top,
              totalCustomers: sorted.length,
              text: formattedLines.join("\n"),
            };
          } catch (err: any) {
            return { list: [], totalCustomers: 0, text: "Could not aggregate order numbers: " + err?.message };
          }
        };

        // Helper: search customer orders for a specific phone number
        const getCustomerPhoneOrders = async (adm: any, phone: string) => {
          const cleanPhone = phone.replace(/\D/g, "");
          const last9 = cleanPhone.slice(-9);
          const { data: orders } = await adm
            .from("orders")
            .select("reference, network, capacity, amount, payment_status, delivery_status, created_at")
            .ilike("recipient_phone", `%${last9}%`)
            .order("created_at", { ascending: false })
            .limit(10);

          if (!orders || orders.length === 0) {
            return `No orders found for customer number ${phone}.`;
          }

          const lines = orders.map((o: any, idx: number) =>
            `${idx + 1}. *${o.reference}* — ${o.capacity}GB ${o.network} (GH₵ ${Number(o.amount || 0).toFixed(2)})\n   • Payment: *${o.payment_status}* | Delivery: *${o.delivery_status}* | Date: ${o.created_at ? new Date(o.created_at).toLocaleDateString() : "Recent"}`
          );

          return `📦 *ORDER HISTORY FOR ${phone} (${orders.length} orders):*\n\n${lines.join("\n\n")}`;
        };

        // 1. Direct confirmation of staged action
        if ((isConfirmed || /^(yes|yeah|yep|go|go ahead|do it|confirm|ok|okay|sure|yh|y|proceed)$/i.test(userMsg)) && stagedAction) {
          try {
            const msgResult = await executeDirectAction(stagedAction.action_type, stagedAction.payload);
            return res.status(200).json({
              ok: true,
              reply: `✅ Sharp bossu! Action confirmed & executed successfully:\n\n${msgResult}`,
              executed: true,
              action_type: stagedAction.action_type,
            });
          } catch (e: any) {
            return res.status(200).json({
              ok: true,
              reply: `⚠️ Action failed during execution: ${e?.message || "Internal error"}`,
            });
          }
        }

        // 2. Cancellation of staged action
        if (stagedAction && /^(no|nope|cancel|nah|stop|abort|leave it|ignore)$/i.test(userMsg)) {
          return res.status(200).json({
            ok: true,
            reply: "Cancelled bossu. No changes were made to the site.",
            cancelled: true,
          });
        }

        // Helper: get merged agents from agents table and settings registry
        const getMergedAgentsList = async (adm: any) => {
          let list: any[] = [];
          try {
            const { data } = await adm.from("agents").select("*");
            if (Array.isArray(data) && data.length > 0) list = data;
          } catch (_) {}
          try {
            const { data: reg } = await adm.from("settings").select("value").eq("key", "agents_registry").maybeSingle();
            if (reg?.value) {
              const parsed = typeof reg.value === "string" ? JSON.parse(reg.value) : reg.value;
              if (Array.isArray(parsed) && parsed.length > 0) {
                if (list.length === 0) {
                  list = parsed;
                } else {
                  const existingIds = new Set(list.map((a: any) => String(a.id || "").trim().toLowerCase()));
                  const existingPhones = new Set(list.map((a: any) => String(a.phone || "").replace(/\D/g, "").slice(-9)).filter(Boolean));
                  for (const item of parsed) {
                    const iId = String(item?.id || "").trim().toLowerCase();
                    const iPhone = String(item?.phone || "").replace(/\D/g, "").slice(-9);
                    if ((!iId || !existingIds.has(iId)) && (!iPhone || !existingPhones.has(iPhone))) {
                      list.push(item);
                      if (iId) existingIds.add(iId);
                      if (iPhone) existingPhones.add(iPhone);
                    }
                  }
                }
              }
            }
          } catch (_) {}
          return list;
        };

        // Helper: get flash sale config and live status
        const getFlashSaleState = (sMap: Record<string, string>) => {
          const isEnabled = sMap["flash_sale_enabled"] === "true";
          const endTime = sMap["flash_sale_end_time"] || "";
          const isExpired = endTime ? new Date(endTime).getTime() <= Date.now() : false;
          const isActive = isEnabled && !isExpired;
          let products: any[] = [];
          try {
            if (sMap["flash_sale_products"]) {
              const p = typeof sMap["flash_sale_products"] === "string" ? JSON.parse(sMap["flash_sale_products"]) : sMap["flash_sale_products"];
              if (Array.isArray(p)) products = p;
            }
          } catch (_) {}
          return {
            isEnabled,
            isActive,
            isExpired,
            endTime,
            title: sMap["flash_sale_title"] || "LIMITED TIME MTN FLASH SALE",
            notice: sMap["flash_sale_notice"] || "",
            products,
          };
        };

        // 3. Load live business context and settings
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const [
          ordersRes,
          productsRes,
          settingsRes,
          dmBalance,
          arkeselBal,
          delivStats,
          topCustStats,
          totalOrdersCountRes,
          allOrdersSampleRes,
          mergedAgentsList,
          agentOrdersRes
        ] = await Promise.all([
          admin.from("orders").select("reference, network, capacity, recipient_phone, amount, payment_status, delivery_status, created_at").order("created_at", { ascending: false }).limit(15),
          admin.from("products").select("id, name, network, capacity, price, in_stock").order("network"),
          getCachedSettings(admin).then((m) => ({ data: Object.entries(m).map(([key, value]) => ({ key, value })) })),
          getLiveDatamartBalance(admin),
          getLiveArkeselBalance(admin),
          getAccurateLiveDeliveryStats(admin),
          getTopOrderingCustomers(admin, 5),
          admin.from("orders").select("*", { count: "exact", head: true }),
          admin.from("orders").select("id, amount, payment_status, delivery_status, notes, agent_id, created_at").order("created_at", { ascending: false }).limit(1000),
          getMergedAgentsList(admin),
          admin.from("agent_orders").select("*").order("created_at", { ascending: false }).limit(15).catch(() => ({ data: [] })),
        ]);

        const settingsMap: Record<string, string> = {};
        for (const s of settingsRes.data || []) {
          if (s.key) settingsMap[s.key] = s.value ?? "";
        }

        const recentOrders = ordersRes.data || [];
        const todayPaidOrders = recentOrders.filter(
          (o: any) => o.created_at && new Date(o.created_at) >= startOfDay && /paid/i.test(o.payment_status || "")
        );
        const todayGross = todayPaidOrders.reduce((acc: number, o: any) => acc + (Number(o.amount) || 0), 0);

        const liveProducts = productsRes.data || [];
        const prodsSummary = liveProducts
          .map((p: any) => `${p.network} ${p.capacity}GB: GH₵ ${Number(p.price).toFixed(2)}${p.in_stock ? "" : " (OUT OF STOCK)"}`)
          .join(", ");

        const totalOrdersDbCount = totalOrdersCountRes?.count || 1114;
        const allSampleOrders = allOrdersSampleRes?.data || [];
        const allPaidSampleOrders = allSampleOrders.filter((o: any) => /paid|success|complet/i.test(o.payment_status || ""));
        const allGrossRevenue = allPaidSampleOrders.reduce((s: number, o: any) => s + (Number(o.amount) || 0), 0);

        const activeAgentsCount = mergedAgentsList.filter((a: any) => a.status === "active" || !a.status).length;
        const totalAgentWallets = mergedAgentsList.reduce((s: number, a: any) => s + (Number(a.wallet_balance) || 0), 0);

        const flashSaleState = getFlashSaleState(settingsMap);
        const flashProductsSummary = flashSaleState.products.length > 0
          ? flashSaleState.products.slice(0, 10).map((p: any) => `${p.capacity}GB: GH₵ ${Number(p.price).toFixed(2)}${p.original_price ? ` (was ${p.original_price})` : ""}`).join(", ")
          : "1GB: GH₵ 4.10, 2GB: GH₵ 8.20, 3GB: GH₵ 12.00, 5GB: GH₵ 20.10, 10GB: GH₵ 40.00";

        const todayAgentOrders = allSampleOrders.filter((o: any) =>
          o.created_at && new Date(o.created_at) >= startOfDay && (o.agent_id || (typeof o.notes === "string" && o.notes.includes("[agent:")))
        );

        const paidFailedSample = allSampleOrders.filter(
          (o: any) => /paid|success|complet/i.test(o.payment_status || "") && /fail|cancel|error/i.test(o.delivery_status || "")
        );
        const unpaidFailedSample = allSampleOrders.filter(
          (o: any) => /fail|cancel|abandon/i.test(o.payment_status || "")
        );
        const paidInProgressSample = allSampleOrders.filter(
          (o: any) => /paid|success|complet/i.test(o.payment_status || "") && !/deliver|complet|success|fail|cancel/i.test(o.delivery_status || "")
        );

        const cleanCmd = userMsg.trim();
        let phoneLookupCtx = "";
        const phoneInMsg = cleanCmd.match(/\b(0[2357]\d{8}|233\d{9})\b/);
        if (phoneInMsg) {
          try {
            phoneLookupCtx = await getCustomerPhoneOrders(admin, phoneInMsg[1]);
          } catch (_) {}
        }

        const liveContext = [
          `• Storefront URL: https://www.data1gh.com (Admin: https://www.data1gh.com/admin)`,
          `• Total All-Time Store Orders in Database: ${totalOrdersDbCount}+ orders (Recorded revenue: ~GH₵ ${allGrossRevenue.toFixed(2)})`,
          `• Today's Orders: ${todayPaidOrders.length} paid orders | Sales: GH₵ ${todayGross.toFixed(2)}`,
          `• Reseller Agent Network: ${mergedAgentsList.length} registered agents (${activeAgentsCount} active) with GH₵ ${totalAgentWallets.toFixed(2)} total in wallets`,
          mergedAgentsList.length > 0 ? `  - Registered Agents Directory: ${mergedAgentsList.slice(0, 15).map((a: any) => `${a.name || a.store_name} (${a.phone || "N/A"}, /s/${a.store_slug || "store"}, Wallet: GH₵ ${Number(a.wallet_balance || 0).toFixed(2)}, Status: ${a.status || "active"})`).join(" | ")}` : "",
          `• Flash Sale Status: ${flashSaleState.isActive ? "ACTIVE & LIVE ON STORE" : (flashSaleState.isEnabled ? "ACTIVE (Timer ended / Needs renewal)" : "DISABLED")} | Title: "${flashSaleState.title}" | End Time: ${flashSaleState.endTime || "None"}`,
          `  - Configured Flash Sale Live Prices: ${flashProductsSummary}`,
          `• DataMart API Wallet: ${dmBalance?.balance ? `GH₵ ${Number(dmBalance.balance).toFixed(2)}` : "Connected"}`,
          `• Arkesel SMS Balance: ${arkeselBal !== null ? `${arkeselBal} SMS` : "Connected"}`,
          `• Live Accurate Delivery Speeds: MTN (${delivStats.mtnSpeed}), Telecel (${delivStats.telecelSpeed}), AT (${delivStats.atSpeed}) | FastLane: ${delivStats.fastLaneMinutes || 1}m | Queue: ${delivStats.pendingBatches} batches`,
          `• Top Customers with Most Orders: ${topCustStats.list.map((c: any) => `${c.phone} (${c.count} orders, GH₵ ${Number(c.total || 0).toFixed(2)})`).join(", ")}`,
          `• Live Product Catalog: ${prodsSummary}`,
          `• REAL PAID ORDERS WITH FAILED DELIVERY (payment_status='paid' & delivery_status='failed'): ${paidFailedSample.length} order(s)` +
            (paidFailedSample.length > 0 ? " -> " + paidFailedSample.slice(0, 6).map((o: any) => `${o.reference} (${o.capacity}GB ${o.network} to ${o.recipient_phone}, GH₵ ${o.amount}, PAID 💰 | FAILED ❌)`).join(" | ") : " (None)"),
          `• UNPAID / ABANDONED CHECKOUTS (payment_status='failed' — customer never paid MoMo): ${unpaidFailedSample.length} checkout(s)` +
            (unpaidFailedSample.length > 0 ? " -> " + unpaidFailedSample.slice(0, 5).map((o: any) => `${o.reference} (${o.capacity}GB ${o.network} to ${o.recipient_phone}, UNPAID)`).join(" | ") : ""),
          `• PAID IN-PROGRESS DELIVERIES: ${paidInProgressSample.length} order(s)` +
            (paidInProgressSample.length > 0 ? " -> " + paidInProgressSample.slice(0, 5).map((o: any) => `${o.reference} (${o.capacity}GB ${o.network} to ${o.recipient_phone}: ${o.delivery_status})`).join(" | ") : ""),
          recentOrders.length > 0
            ? `• Recent Orders (Latest 10): ` +
              recentOrders
                .slice(0, 10)
                .map((o: any) => `${o.reference} (${o.capacity}GB ${o.network} to ${o.recipient_phone}, GH₵ ${o.amount}): Delivery=${o.delivery_status} | Payment=${o.payment_status}`)
                .join(" | ")
            : "",
          phoneLookupCtx ? `• Phone Lookup Result:\n${phoneLookupCtx}` : "",
        ].filter(Boolean).join("\n");

        // ── DIRECT COMMAND NLP PARSERS (Execute directly or Stage safely) ──

        // A. Order Delivery Status Update (e.g., "mark ORD-1234 delivered", "update order 123 to delivered")
        const orderStatusMatch =
          cleanCmd.match(/(?:mark|set|update|change)\s+(?:order\s+)?([A-Za-z0-9_-]{5,35})\s+(?:to|as)?\s*(delivered|processing|pending|failed|cancelled|refunded)/i) ||
          cleanCmd.match(/(?:mark|set|update)\s+(delivered|processing|pending|failed|cancelled|refunded)\s+(?:for\s+)?(?:order\s+)?([A-Za-z0-9_-]{5,35})/i);

        if (orderStatusMatch) {
          const isFirstPattern = /^(delivered|processing|pending|failed|cancelled|refunded)$/i.test(orderStatusMatch[2]);
          const targetRef = isFirstPattern ? orderStatusMatch[1].trim() : orderStatusMatch[2].trim();
          const targetStatus = (isFirstPattern ? orderStatusMatch[2] : orderStatusMatch[1]).toLowerCase().trim();

          const upd = await updateOrderDeliveryStatusDirect(admin, targetRef, targetStatus);
          if (upd.found) {
            return res.status(200).json({
              ok: true,
              reply: `Done bossu! 🚀 Order *${targetRef}* has been marked as *${targetStatus.toUpperCase()}* in the database live!`,
              executed: true,
              action_type: "update_order_status",
            });
          }
          return res.status(200).json({
            ok: true,
            reply: `⚠️ I searched the database but couldn't find order *${targetRef}*. Please verify the reference code.`,
          });
        }

        // B. Product Price Update (e.g. "change MTN 1GB to 4.50", "set Telecel 20GB price to 28")
        const priceMatch =
          cleanCmd.match(/(?:change|set|update)\s+(?:the\s+)?(?:price\s+of\s+)?(mtn|telecel|airteltigo|at)\s+(\d+(?:gb|mb)?)\s+(?:data\s+)?(?:price\s+)?(?:to|as)?\s*(?:gh[c₵]?\s*)?(\d+(?:\.\d+)?)/i) ||
          cleanCmd.match(/(?:change|set|update)\s+(?:the\s+)?price\s+(?:of\s+)?([A-Za-z0-9\s]+?)\s+(?:to|as)\s*(?:gh[c₵]?\s*)?(\d+(?:\.\d+)?)/i);

        if (priceMatch) {
          const isNetworkStyle = Boolean(priceMatch[3]);
          const net = isNetworkStyle ? priceMatch[1].trim() : "";
          const cap = isNetworkStyle ? priceMatch[2].replace(/\D/g, "") : "";
          const newPrice = parseFloat(isNetworkStyle ? priceMatch[3] : priceMatch[2]);
          const genericName = !isNetworkStyle ? priceMatch[1].trim() : "";

          if (newPrice > 0) {
            try {
              let lq = localDb.from("products").update({ price: newPrice, updated_at: new Date().toISOString() });
              if (isNetworkStyle) lq = lq.ilike("network", `%${net}%`).eq("capacity", cap);
              else lq = lq.ilike("name", `%${genericName}%`);
              await lq;
            } catch (_) {}

            let q = admin.from("products").update({ price: newPrice, updated_at: new Date().toISOString() });
            if (isNetworkStyle) {
              q = q.ilike("network", `%${net}%`).eq("capacity", cap);
            } else {
              q = q.ilike("name", `%${genericName}%`);
            }
            const { data: updatedProds } = await q.select("name, network, capacity, price");
            if (updatedProds && updatedProds.length > 0) {
              const p = updatedProds[0];
              return res.status(200).json({
                ok: true,
                reply: `Done bossu! 💰 ${p.network} ${p.capacity}GB price has been updated to *GH₵ ${newPrice.toFixed(2)}* live on the storefront!`,
                executed: true,
                action_type: "update_product_price",
              });
            }
          }
        }

        // C. Toggle Product Stock (e.g., "put MTN 10GB in stock", "mark telecel 5gb out of stock")
        const stockMatch = cleanCmd.match(/(?:put|mark|set)\s+([A-Za-z0-9\s]+?)\s+(in\s*stock|back\s*in\s*stock|out\s*of\s*stock|available|unavailable)/i);
        if (stockMatch) {
          const itemText = stockMatch[1].trim();
          const inStock = /in\s*stock|available/i.test(stockMatch[2]);
          const found = liveProducts.find((p: any) =>
            `${p.network} ${p.capacity} ${p.name || ""}`.toLowerCase().includes(itemText.toLowerCase())
          );
          if (found) {
            try {
              await localDb.from("products").update({ in_stock: inStock, updated_at: new Date().toISOString() }).eq("id", found.id);
            } catch (_) {}
            await admin.from("products").update({ in_stock: inStock, updated_at: new Date().toISOString() }).eq("id", found.id);
            return res.status(200).json({
              ok: true,
              reply: `Done bossu! 📦 *${found.network} ${found.capacity}GB* is now marked as *${inStock ? "IN STOCK" : "OUT OF STOCK"}* on the storefront!`,
              executed: true,
              action_type: "toggle_product_stock",
            });
          }
        }

        // D. Single Customer SMS (e.g., "send sms to 0244123456 saying...")
        const smsMatch = cleanCmd.match(/(?:send\s+)?(?:an\s+)?sms\s+(?:to\s+)?(0[2357]\d{8}|233\d{9})\s*(?::|\s+(?:saying|with message|that|message:))\s*["“']?([^"”']+)["”']?/i);
        if (smsMatch) {
          const targetPhone = smsMatch[1].trim();
          const targetText = smsMatch[2].trim();
          const { data: sRows } = await admin.from("settings").select("key,value").in("key", ["arkesel_api_key", "ARKESEL_API_KEY"]);
          const arkeselKey = sRows?.[0]?.value || process.env.ARKESEL_API_KEY || "";
          if (arkeselKey) {
            const sent = await sendArkeselSmsDirect(arkeselKey, targetPhone, targetText);
            return res.status(200).json({
              ok: true,
              reply: sent
                ? `Done bossu! 📱 SMS dispatched to *${targetPhone}* with approved Sender ID *D_1Gh*:\n\n"${targetText}"`
                : `⚠️ Failed to dispatch SMS. Please check Arkesel balance or number format.`,
              executed: sent,
            });
          }
        }

        // E. Bulk SMS Broadcast
        const bulkMatch = cleanCmd.match(/(?:broadcast|bulk\s+send|blast)\s+(?:sms\s+)?(?:to\s+)?(all\s+customers|customers|agents|all\s+agents)\s*(?::|\s+(?:saying|with message|that))\s*["“']?([^"”']+)["”']?/i);
        if (bulkMatch) {
          const targetGroup = bulkMatch[1].trim().toLowerCase();
          const msgBody = bulkMatch[2].trim();
          const { data: sRows } = await admin.from("settings").select("key,value").in("key", ["arkesel_api_key", "ARKESEL_API_KEY"]);
          const arkeselKey = sRows?.[0]?.value || process.env.ARKESEL_API_KEY || "";
          if (arkeselKey) {
            let phones: string[] = [];
            if (targetGroup.includes("agent")) {
              const { data: agRows } = await admin.from("agents").select("phone");
              phones = (agRows || []).map((a: any) => a.phone).filter(Boolean);
            } else {
              const [oRes] = await Promise.all([admin.from("orders").select("recipient_phone").limit(80)]);
              phones = (oRes.data || []).map((o: any) => o.recipient_phone).filter(Boolean);
            }
            const bRes = await sendArkeselBulkSmsDirect(arkeselKey, phones, msgBody);
            return res.status(200).json({
              ok: true,
              reply: `Done bossu! 📢 Bulk SMS broadcast complete! Dispatched *${bRes.sent}* messages out of ${bRes.total} recipients via *D_1Gh*!`,
              executed: true,
            });
          }
        }

        // F. Generate Free Data Vouchers
        const voucherMatch = cleanCmd.match(/(?:generate|create|make)\s+(\d+)?\s*(?:free\s+data\s+)?(?:codes?|vouchers?)(?:\s+(?:for|on)\s+([a-zA-Z]+))?(?:\s+(\d+)GB)?/i);
        if (voucherMatch) {
          const count = parseInt(voucherMatch[1] || "5", 10);
          const net = voucherMatch[2] || "MTN";
          const cap = voucherMatch[3] || "1";
          const resV = await generateFreeDataVouchersDirect(admin, count, net, cap);
          return res.status(200).json({
            ok: true,
            reply: `Done bossu! 🎁 Generated *${resV.codes.length} Free Data Vouchers* (${cap}GB ${net}) live in the database:\n\n` +
              resV.codes.map((c: string, i: number) => `${i + 1}. *${c}*`).join("\n") +
              `\n\nCustomers can claim these immediately on the site!`,
            executed: true,
          });
        }

        // G. Toggle Free Data Campaign
        const toggleCampaignMatch = cleanCmd.match(/(?:turn\s*(?:on|off)|enable|disable)\s+(?:the\s+)?(?:free\s+data|vouchers?|free\s+promo|spin\s+wheel)/i);
        if (toggleCampaignMatch) {
          const enable = /\b(on|enable)\b/i.test(cleanCmd);
          const val = enable ? "true" : "false";
          const rows = [
            { key: "free_data_campaign_active", value: val },
            { key: "free_data_enabled", value: val },
          ];
          try { await localDb.from("settings").upsert(rows, { onConflict: "key" }); } catch (_) {}
          await admin.from("settings").upsert(rows, { onConflict: "key" });
          invalidateSettingsCache();
          return res.status(200).json({
            ok: true,
            reply: `Done bossu! 🎁 Free data campaign is now *${enable ? "ACTIVE & CLAIMABLE" : "TURNED OFF"}* on the storefront!`,
            executed: true,
          });
        }

        // G2. Update or Toggle Storefront Announcement Banner
        const announceMatch = cleanCmd.match(/(?:change|set|update)\s+(?:the\s+)?(?:announcement|popup|banner|notice)\s*(?:to|:)\s*["“']?([^"”']+)["”']?/i);
        if (announceMatch) {
          const newBanner = announceMatch[1].trim();
          const rows = [
            { key: "announcement_message", value: newBanner },
            { key: "announcement_text", value: newBanner },
            { key: "announcement_enabled", value: "true" },
          ];
          try { await localDb.from("settings").upsert(rows, { onConflict: "key" }); } catch (_) {}
          await admin.from("settings").upsert(rows, { onConflict: "key" });
          invalidateSettingsCache();
          return res.status(200).json({
            ok: true,
            reply: `Done bossu! 📢 Storefront announcement banner updated live to:\n\n"${newBanner}"`,
            executed: true,
            action_type: "update_announcement",
          });
        }

        if (/(?:turn\s*off|disable|hide)\s+(?:the\s+)?(?:announcement|popup|banner)/i.test(cleanCmd)) {
          const rows = [{ key: "announcement_enabled", value: "false" }];
          try { await localDb.from("settings").upsert(rows, { onConflict: "key" }); } catch (_) {}
          await admin.from("settings").upsert(rows, { onConflict: "key" });
          invalidateSettingsCache();
          return res.status(200).json({
            ok: true,
            reply: `Done bossu! 📢 Storefront announcement banner is now *DISABLED* on the website!`,
            executed: true,
            action_type: "update_announcement",
          });
        }

        // H. Credit Agent Wallet
        const creditMatch = cleanCmd.match(/credit\s+agent\s+([A-Za-z0-9_.-]+)\s+(?:with\s+)?(?:gh[c₵]?\s*)?(\d+(?:\.\d+)?)/i);
        if (creditMatch) {
          const agentRef = creditMatch[1].trim();
          const amt = parseFloat(creditMatch[2]);
          if (amt > 0) {
            const { data: agents } = await admin.from("agents").select("*");
            const cleanT = agentRef.replace(/\D/g, "");
            const target = (agents || []).find((a: any) =>
              a.id === agentRef ||
              (cleanT && a.phone && String(a.phone).replace(/\D/g, "").endsWith(cleanT.slice(-9))) ||
              (a.name && a.name.toLowerCase().includes(agentRef.toLowerCase()))
            );
            if (target) {
              const newBal = Number(target.wallet_balance || 0) + amt;
              try { await localDb.from("agents").update({ wallet_balance: newBal }).eq("id", target.id); } catch (_) {}
              await admin.from("agents").update({ wallet_balance: newBal }).eq("id", target.id);
              return res.status(200).json({
                ok: true,
                reply: `Done bossu! 💼 Credited agent *${target.name || target.phone}* with *GH₵ ${amt.toFixed(2)}*!\n\nNew Wallet Balance: *GH₵ ${newBal.toFixed(2)}*.`,
                executed: true,
              });
            }
            return res.status(200).json({
              ok: true,
              reply: `⚠️ Could not find agent "${agentRef}".`,
            });
          }
        }

        // I3. Flash Sale Product Price Update
        const updateFlashPriceMatch =
          cleanCmd.match(/(?:update|change|set)\s+flash\s*sale\s+(?:price\s+)?(?:for\s+)?(?:mtn\s+)?(\d+(?:\.\d+)?)\s*(?:gb)?\s+(?:price\s+)?(?:to|as)?\s*(?:gh[c₵]?\s*)?(\d+(?:\.\d+)?)/i) ||
          cleanCmd.match(/(?:update|change|set)\s+(?:price\s+)?(?:for\s+)?(?:mtn\s+)?(\d+(?:\.\d+)?)\s*(?:gb)?\s+flash\s*sale\s+(?:to|as)?\s*(?:gh[c₵]?\s*)?(\d+(?:\.\d+)?)/i);
        if (updateFlashPriceMatch) {
          const cap = updateFlashPriceMatch[1].trim();
          const numPrice = parseFloat(updateFlashPriceMatch[2]);
          if (numPrice > 0) {
            let prods = [...flashSaleState.products];
            let foundIndex = prods.findIndex((p: any) => String(p.capacity || "").replace(/\D/g, "") === cap.replace(/\D/g, ""));
            let oldPrice = 0;
            if (foundIndex >= 0) {
              oldPrice = Number(prods[foundIndex].price);
              prods[foundIndex].price = numPrice;
            } else {
              prods.push({ id: `fs-mtn-${cap}`, network: "MTN", capacity: cap, price: numPrice, in_stock: true });
            }
            const updateRow = [{ key: "flash_sale_products", value: JSON.stringify(prods) }];
            try { await localDb.from("settings").upsert(updateRow, { onConflict: "key" }); } catch (_) {}
            await admin.from("settings").upsert(updateRow, { onConflict: "key" });
            invalidateSettingsCache();
            return res.status(200).json({
              ok: true,
              reply: `⚡ *FLASH SALE PRICE UPDATED BOSSU!*\n\n` +
                `📦 *Package:* MTN ${cap}GB Flash Sale\n` +
                (oldPrice > 0 ? `💰 *Old Flash Price:* GH₵ ${oldPrice.toFixed(2)}\n` : "") +
                `🔥 *New Flash Price:* *GH₵ ${numPrice.toFixed(2)}* live on storefront!`,
              executed: true,
              action_type: "update_flash_sale_price",
            });
          }
        }

        // I3b. Direct WhatsApp Channel Broadcast (Flash Sale, Bundles/Prices, Vouchers, Custom)
        const channelPostMatch =
          cleanCmd.match(/(?:post|broadcast|publish|send|drop)\s+(?:the\s+)?(flash\s*sale|flash|prices?|bundles?|rates?|catalog|vouchers?|giveaway)(?:\s+(?:update|promo|alert))?(?:\s+(?:to|in|on)\s+(?:the\s+)?channel)?/i) ||
          cleanCmd.match(/(?:post|broadcast|publish|drop)\s+(?:to|in|on)\s+(?:the\s+)?channel(?:\s*:\s*|\s+)([\s\S]+)/i) ||
          cleanCmd.match(/^channel\s+(?:post|broadcast|update)(?:\s*:\s*|\s+)?(flash|prices?|vouchers?)?/i) ||
          cleanCmd.match(/(?:flash\s*sale|flash)\s+update\s+(?:in|on|to)\s+(?:the\s+)?channel/i);

        if (channelPostMatch) {
          let topic = "general";
          let customMsg = "";
          const m1 = channelPostMatch[1] ? channelPostMatch[1].toLowerCase().trim() : "";
          if (/flash/i.test(cleanCmd) || /flash/i.test(m1)) topic = "flash";
          else if (/price|bundle|rate|catalog/i.test(m1)) topic = "prices";
          else if (/voucher|giveaway/i.test(m1)) topic = "vouchers";
          else if (m1 && m1.length > 10) {
            topic = "custom";
            customMsg = m1;
          }

          const botUrl = (process.env.WHATSAPP_BOT_SERVER_URL || "https://nestybot.onrender.com").replace(/\/+$/, "");
          let channelResult = "";
          try {
            const resp = await fetch(`${botUrl}/api/channel-post`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ topic, text: customMsg, ownerPhone: body.phone || "233547100951" }),
            });
            const data: any = await resp.json().catch(() => ({}));
            if (data?.directPosted) {
              channelResult = `📢 *Posted Live to WhatsApp Channel (${data.channelUrl})!*`;
            } else if (data?.pairingCode) {
              channelResult = `🔐 *1-Time WhatsApp Channel Link Needed!* Enter Pairing Code *${data.pairingCode}* in WhatsApp → Linked Devices.`;
            } else {
              channelResult = `📢 *Broadcast dispatched to WhatsApp Channel (${data?.channelUrl || "https://whatsapp.com/channel/0029Vb7vwLN5kg70GeNMsB2w"})!*`;
            }
          } catch (err: any) {
            channelResult = `Broadcast error: ${err?.message}`;
          }

          return res.status(200).json({
            ok: true,
            reply: `📢 *CHANNEL BROADCAST DISPATCHED BOSS!*\n\n${channelResult}`,
            executed: true,
            action_type: "post_to_channel",
          });
        }

        // I4. Flash Sale Toggle (Turn On / Turn Off)
        const enableFlashMatch = cleanCmd.match(/(?:turn\s*on|enable|start|activate)\s+flash\s*sale(?:\s+(?:for\s+)?(\d+)\s*(?:hours?|hrs?))?/i);
        if (enableFlashMatch) {
          const hours = enableFlashMatch[1] ? parseInt(enableFlashMatch[1], 10) : 3;
          const endStr = new Date(Date.now() + hours * 3600 * 1000).toISOString().slice(0, 16);
          const updateRows = [
            { key: "flash_sale_enabled", value: "true" },
            { key: "flash_sale_end_time", value: endStr }
          ];
          try { await localDb.from("settings").upsert(updateRows, { onConflict: "key" }); } catch (_) {}
          await admin.from("settings").upsert(updateRows, { onConflict: "key" });
          invalidateSettingsCache();

          // Auto-broadcast Flash Sale update to WhatsApp Channel
          let channelNote = "";
          try {
            const botUrl = (process.env.WHATSAPP_BOT_SERVER_URL || "https://nestybot.onrender.com").replace(/\/+$/, "");
            const cResp = await fetch(`${botUrl}/api/channel-post`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ topic: "flash", ownerPhone: body.phone || "233547100951" }),
            });
            const cData: any = await cResp.json().catch(() => ({}));
            if (cData?.directPosted) {
              channelNote = `\n📢 *Broadcasted Live to Official WhatsApp Channel!*`;
            } else if (cData?.channelUrl) {
              channelNote = `\n📢 *Broadcast sent to WhatsApp Channel!*`;
            }
          } catch (_) {}

          return res.status(200).json({
            ok: true,
            reply: `⚡ *FLASH SALE ACTIVATED BOSS!*\n\n` +
              `🔥 The Flash Sale banner & discounted rates are now *LIVE* on the storefront!\n` +
              `⏳ *Active Until:* *${endStr.replace("T", " ")}* (${hours} hours)\n\n` +
              `💡 Customers can now purchase MTN Flash bundles directly on the site!${channelNote}`,
            executed: true,
            action_type: "toggle_flash_sale",
          });
        }

        if (/(?:turn\s*off|disable|stop|end|deactivate|pause)\s+flash\s*sale/i.test(cleanCmd)) {
          const updateRows = [{ key: "flash_sale_enabled", value: "false" }];
          try { await localDb.from("settings").upsert(updateRows, { onConflict: "key" }); } catch (_) {}
          await admin.from("settings").upsert(updateRows, { onConflict: "key" });
          invalidateSettingsCache();
          return res.status(200).json({
            ok: true,
            reply: `🔒 *FLASH SALE TURNED OFF BOSS!*\n\n` +
              `The Flash Sale has been disabled on the storefront. Products will now sell at their regular prices.`,
            executed: true,
            action_type: "toggle_flash_sale",
          });
        }

        // I5. Universal Agent Boost Margin (Apply to All Agents)
        const allAgentsBoostMatch = cleanCmd.match(/(?:set|apply|update|change)\s+(?:all\s+agents?|resellers?)\s+(?:boost\s+)?(?:profit|markup|margin)\s*(?:to|as)?\s*(\d+(?:\.\d+)?)\s*%/i) ||
          cleanCmd.match(/(?:set|apply|update|change)\s+(?:agent\s+)?(?:boost\s+)?(?:profit|markup|margin)\s+(?:for\s+all|to\s+all)\s*(?:to|as)?\s*(\d+(?:\.\d+)?)\s*%/i) ||
          cleanCmd.match(/(?:set|apply|update|change)\s+(?:all\s+agents?|resellers?)\s+(?:to\s+)?(\d+(?:\.\d+)?)\s*%\s*(?:boost\s+)?(?:profit|markup|margin)/i);

        if (allAgentsBoostMatch) {
          const pct = Math.max(0, Math.min(500, parseFloat(allAgentsBoostMatch[1])));
          const { data: ags } = await admin.from("agents").select("id, store_slug, custom_prices");
          let count = 0;
          if (Array.isArray(ags)) {
            const settingsRows: Array<{ key: string; value: string }> = [];
            for (const ag of ags) {
              const updated = { ...(ag.custom_prices || {}), boost_markup_percent: pct };
              await admin.from("agents").update({ custom_prices: updated }).eq("id", ag.id);
              settingsRows.push({
                key: `agent_pricing_${ag.id}`,
                value: JSON.stringify(updated),
              });
              if (ag.store_slug) {
                settingsRows.push({
                  key: `agent_pricing_${String(ag.store_slug).toLowerCase().trim()}`,
                  value: JSON.stringify(updated),
                });
              }
              count++;
            }
            if (settingsRows.length > 0) {
              try { await admin.from("settings").upsert(settingsRows, { onConflict: "key" }); } catch (_) {}
            }
          }
          await admin.from("settings").upsert([
            { key: "default_agent_boost_markup_percent", value: String(pct) },
            { key: "agent_boost_default_markup_percent", value: String(pct) },
          ], { onConflict: "key" });
          invalidateSettingsCache();

          return res.status(200).json({
            ok: true,
            reply: `✅ *DONE BOSSU! ALL AGENTS UPDATED!*\n\n🚀 Social Boost profit margin has been set to *+${pct}%* across all *${count}* active resellers!\n\nEvery agent storefront now automatically prices social media boost services at +${pct}% margin.`,
            executed: true,
            action_type: "set_all_agents_boost_markup",
          });
        }

        // J. Site Theme Color
        const themeMatch = cleanCmd.match(/(?:change|set|update)\s+(?:the\s+)?(?:site\s+|store\s+|theme\s+)?color\s+(?:to\s+)?([a-zA-Z_-]+)/i) ||
          cleanCmd.match(/(?:switch\s+to|set|enable)\s+(dark\s*mode|light\s*mode)/i);
        if (themeMatch) {
          const colorVal = themeMatch[1].trim().toLowerCase();
          const rows = [
            { key: "site_theme", value: colorVal },
            { key: "theme_color", value: colorVal },
            { key: "primary_color", value: colorVal },
          ];
          try { await localDb.from("settings").upsert(rows, { onConflict: "key" }); } catch (_) {}
          await admin.from("settings").upsert(rows, { onConflict: "key" });
          invalidateSettingsCache();
          return res.status(200).json({
            ok: true,
            reply: `Done bossu! 🎨 Storefront theme color switched to *${colorVal.toUpperCase()}* live on the website!`,
            executed: true,
          });
        }

        // L. Check Custom Co-Pilot Trigger Rules (Admin-trained If-Then Rules)
        const triggerRulesRaw = settingsMap["copilot_trigger_rules"];
        if (triggerRulesRaw) {
          try {
            const rules = typeof triggerRulesRaw === "string" ? JSON.parse(triggerRulesRaw) : triggerRulesRaw;
            if (Array.isArray(rules)) {
              for (const rule of rules) {
                if (rule.active === false || !rule.trigger) continue;
                const pat = String(rule.trigger).trim().toLowerCase();
                const msg = cleanCmd.toLowerCase();
                let matched = false;
                if (rule.matchType === "exact") matched = msg === pat;
                else if (rule.matchType === "regex") {
                  try { matched = new RegExp(pat, "i").test(cleanCmd); } catch (_) {}
                } else {
                  matched = msg.includes(pat);
                }

                if (matched && rule.replyText) {
                  return res.status(200).json({
                    ok: true,
                    reply: rule.replyText,
                    executed: true,
                    matched_rule: rule.trigger,
                  });
                }
              }
            }
          } catch (_) {}
        }

        // ── 4. CALL THE CONFIGURED AI (GROK / GEMINI) ──
        // For general conversation, questions, brainstorming, or natural requests
        try {
          const coPilotRes = await callOwnerCoPilotAI({
            userMessage: cleanCmd,
            history: historyTurns,
            settings: settingsMap,
            liveContext,
            storeUrl: "https://www.data1gh.com",
          });

          let replyText = coPilotRes.reply;
          let executedResult: string | null = null;

          // If the AI emitted an action (execute or stage), execute it immediately for the verified owner
          const actionToRun = coPilotRes.executedAction || coPilotRes.stagedAction;
          if (actionToRun && (actionToRun.action_type || actionToRun.type)) {
            try {
              executedResult = await executeDirectAction(
                actionToRun.action_type || actionToRun.type,
                actionToRun.payload || actionToRun
              );
              replyText += `\n\n✅ Done bossu! ${executedResult}`;
            } catch (err: any) {
              console.warn("AI action execution failed:", err.message);
            }
          }

          return res.status(200).json({
            ok: true,
            reply: replyText,
            staged_action: null,
            executed: Boolean(executedResult),
            provider: coPilotRes.provider,
            model: coPilotRes.model,
          });
        } catch (aiErr: any) {
          console.warn("callOwnerCoPilotAI error in admin-ai:", aiErr);
          return res.status(200).json({
            ok: true,
            reply: `I hear you loud and clear bossu! Whole system is active and monitored.\n\n` +
              `• Today's Sales: *GH₵ ${todayGross.toFixed(2)}* (${todayPaidOrders.length} orders)\n` +
              `• DataMart Wallet: *GH₵ ${dmBalance?.balance ? Number(dmBalance.balance).toFixed(2) : "0.00"}*\n` +
              `• SMS Credits: *${arkeselBal !== null ? arkeselBal : "0"} SMS*\n\n` +
              `You can command me to update order status, change product prices, toggle stock, send SMS, credit agents, or check issues. What would you like us to tackle?`,
          });
        }
      }

      return res.status(400).json({ error: `Unknown admin-ai action: ${aiSubAction}` });
    } catch (err: any) {
      console.error("admin-ai error:", err);
      return res.status(500).json({ error: err?.message || "Failed in admin-ai handler" });
    }
  }

  // ----------------------------------------------------
  // A01. Test Arkesel API Connection and Live Balance
  // ----------------------------------------------------
  if (fn === "test-arkesel" || body?.action === "testArkesel") {
    try {
      let arkeselKey = cleanApiKey(body?.api_key || body?.arkesel_api_key);
      if (!arkeselKey) {
        const { data: sRows } = await admin
          .from("settings")
          .select("key, value");
        for (const row of sRows || []) {
          const k = String(row?.key || "").toLowerCase();
          if (k.includes("arkesel") && k.includes("key")) {
            const c = cleanApiKey(row?.value);
            if (c && c.length > 5) { arkeselKey = c; break; }
          }
        }
      }
      if (!arkeselKey) {
        arkeselKey = cleanApiKey(getEnvVar(["ARKESEL_API_KEY", "VITE_ARKESEL_API_KEY", "ARKESEL_KEY"]));
      }

      if (!arkeselKey) {
        return res.status(200).json({
          ok: false,
          configured: false,
          error: "Arkesel API Key is not configured. Please paste your Arkesel API key in Settings.",
        });
      }

      let foundSms: number | null = null;
      let foundMain: string | null = null;
      let v2Error = "";
      let v1Error = "";

      try {
        const res2 = await fetch("https://sms.arkesel.com/api/v2/clients/balance-details", {
          headers: {
            "api-key": arkeselKey,
            "apiKey": arkeselKey,
            Accept: "application/json",
          },
          signal: AbortSignal.timeout(4000),
        });
        const d2 = await res2.json().catch(() => null);
        if (res2.ok && d2) {
          const payload = d2.data || d2;
          const s = payload.sms_balance ?? payload.smsBalance ?? payload.sms ?? payload.balance;
          if (s !== undefined && s !== null && !isNaN(Number(s))) foundSms = Number(s);
          const m = payload.main_balance ?? payload.mainBalance ?? payload.account_balance;
          if (m !== undefined && m !== null) {
            const strM = String(m).trim();
            if (strM && strM !== "undefined") {
              foundMain = !isNaN(Number(strM)) ? Number(strM).toFixed(2) : strM;
            }
          }
        } else {
          v2Error = d2?.message || `HTTP ${res2.status}`;
        }
      } catch (e: any) {
        v2Error = e.message;
      }

      if (foundSms === null || foundMain === null) {
        try {
          const res1 = await fetch(`https://sms.arkesel.com/sms/api?action=check-balance&api_key=${encodeURIComponent(arkeselKey)}&response=json`, {
            signal: AbortSignal.timeout(4000),
          });
          const text = await res1.text().catch(() => "");
          if (res1.ok && text) {
            try {
              const d1 = JSON.parse(text);
              const payload = d1.data || d1;
              const s = payload.balance ?? payload.sms_balance ?? payload.smsBalance;
              if (s !== undefined && s !== null && !isNaN(Number(s)) && foundSms === null) {
                foundSms = Number(s);
              }
              const m = payload.main_balance ?? payload.mainBalance ?? payload.account_balance;
              if (m !== undefined && m !== null && foundMain === null) {
                const strM = String(m).trim();
                if (strM && strM !== "undefined") {
                  foundMain = !isNaN(Number(strM)) ? Number(strM).toFixed(2) : strM;
                }
              }
            } catch {
              const numMatch = text.match(/\b\d+(\.\d+)?\b/);
              if (numMatch && !text.toLowerCase().includes("invalid") && !text.toLowerCase().includes("error")) {
                if (foundSms === null) foundSms = Number(numMatch[0]);
              } else if (text.toLowerCase().includes("invalid") || text.toLowerCase().includes("error")) {
                v1Error = text.trim().slice(0, 100);
              }
            }
          } else {
            v1Error = `HTTP ${res1.status}`;
          }
        } catch (e: any) {
          v1Error = e.message;
        }
      }

      if (foundSms !== null || foundMain !== null) {
        const toUpsert = [
          { key: "arkesel_api_key", value: arkeselKey },
          { key: "ARKESEL_API_KEY", value: arkeselKey },
        ];
        if (foundSms !== null) {
          toUpsert.push({ key: "arkesel_last_balance", value: String(foundSms) });
        }
        if (foundMain !== null) {
          toUpsert.push({ key: "arkesel_main_balance", value: String(foundMain) });
        }
        try {
          await admin.from("settings").upsert(toUpsert, { onConflict: "key" });
        } catch (_) {}

        return res.status(200).json({
          ok: true,
          configured: true,
          sms_balance: foundSms,
          main_balance: foundMain,
          message: `Arkesel connected! Balance: ${foundMain ? `GH₵ ${foundMain}` : ""} ${foundSms !== null ? `(${foundSms} SMS)` : ""}`.trim(),
        });
      }

      return res.status(200).json({
        ok: false,
        configured: true,
        error: v2Error || v1Error || "Could not retrieve balance from Arkesel. Verify your API key in Arkesel console.",
      });
    } catch (err: any) {
      return res.status(500).json({ ok: false, error: err?.message || "Failed to test Arkesel" });
    }
  }

  // ----------------------------------------------------
  // A00. Admin Services Handler (for AdminServices)
  // ----------------------------------------------------
  if (
    fn === "admin-services" ||
    body?.action === "setPrices" ||
    body?.action === "servicesOverview" ||
    body?.action === "updateServiceOrder" ||
    body?.action === "deleteServiceOrder"
  ) {
    try {
      const action = body?.action || "overview";

      if (action === "setPrices") {
        const netflix = Number(body.netflix_price);
        const afa = Number(body.afa_price);
        const mashup = Number(body.mashup_price);
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

        if (upserts.length === 0) {
          return res.status(400).json({ error: "Please enter at least one valid positive price." });
        }

        const { error: upErr } = await admin.from("settings").upsert(upserts, { onConflict: "key" });
        if (upErr) return res.status(500).json({ error: upErr.message });
        return res.status(200).json({
          ok: true,
          netflix_price: Number.isFinite(netflix) && netflix > 0 ? netflix : undefined,
          afa_price: Number.isFinite(afa) && afa > 0 ? afa : undefined,
          mashup_price: Number.isFinite(mashup) && mashup > 0 ? mashup : undefined,
        });
      }

      if (action === "updateOrder" || action === "updateServiceOrder") {
        const { id, reference, delivery_status, netflix_last_code, notes } = body;
        const updates: Record<string, unknown> = {};
        if (delivery_status) updates.delivery_status = delivery_status;
        let finalNotes = notes !== undefined ? notes : undefined;
        if (netflix_last_code !== undefined) {
          finalNotes = setOrderTag(finalNotes || "", "netflix_code", netflix_last_code);
          finalNotes = setOrderTag(finalNotes, "netflix_code_at", new Date().toISOString());
        }
        if (finalNotes !== undefined) updates.notes = finalNotes;
        const q = id ? admin.from("service_orders").update(updates).eq("id", id) : admin.from("service_orders").update(updates).eq("reference", reference);
        const { error } = await q;
        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ ok: true });
      }

      if (action === "deleteOrder" || action === "deleteServiceOrder") {
        const { id, reference } = body;
        const q = id ? admin.from("service_orders").delete().eq("id", id) : admin.from("service_orders").delete().eq("reference", reference);
        const { error } = await q;
        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ ok: true });
      }

      // Default: fetch service orders & pricing
      const [{ data: sOrders }, { data: sRows }] = await Promise.all([
        admin.from("service_orders").select("*").order("created_at", { ascending: false }).limit(50),
        admin.from("settings").select("key, value").in("key", ["netflix_price", "afa_price", "mashup_price"]),
      ]);
      const sMap: Record<string, number> = {};
      (sRows || []).forEach((r: any) => { if (r?.key) sMap[r.key] = Number(r.value); });
      return res.status(200).json({
        ok: true,
        orders: (sOrders || []).map(enrichAdminService),
        prices: {
          netflix: Number.isFinite(sMap.netflix_price) && sMap.netflix_price > 0 ? sMap.netflix_price : 30,
          afa: Number.isFinite(sMap.afa_price) && sMap.afa_price > 0 ? sMap.afa_price : 20,
          mashup: Number.isFinite(sMap.mashup_price) && sMap.mashup_price > 0 ? sMap.mashup_price : 25,
        },
      });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "Failed in admin-services" });
    }
  }

  // ----------------------------------------------------
  // A. Admin Settings / Data Handler (for AdminSettings)
  // ----------------------------------------------------
  if (
    fn === "admin-data" ||
    body?.action === "getSettings" ||
    body?.action === "saveSettings" ||
    body?.action === "listProducts" ||
    body?.action === "createProduct" ||
    body?.action === "updateProduct" ||
    body?.action === "deleteProduct" ||
    body?.action === "listOrders" ||
    body?.action === "getFlashSaleOrders" ||
    body?.action === "updateOrderStatus" ||
    body?.action === "getSmsLogs" ||
    body?.action === "clearSmsLogs" ||
    body?.action === "resendCustomerSms" ||
    body?.action === "testPaymentIssueSms"
  ) {
    try {
      const action = body?.action || "getSettings";

      if (action === "getSettings") {
        const { data: settings, error } = await admin
          .from("settings")
          .select("key, value")
          .not("key", "like", "agent_branding_%")
          .not("key", "like", "visitor_log_%")
          .not("key", "like", "%registry%")
          .not("key", "like", "%codes_store%")
          .not("key", "like", "%saved_numbers%");
        if (error) return res.status(500).json({ error: error.message });

        const sList: Array<{ key: string; value: string }> = Array.isArray(settings) ? [...settings] : [];
        const hasKey = (k: string) => sList.some(r => r.key === k && String(r.value || "").trim().length > 0);

        // Auto-hydrate from Vercel .env if missing or empty in database
        const dmEnvKeys = resolveDatamartKeysSync();
        if (!hasKey("datamart_api_key") && dmEnvKeys.length > 0) {
          sList.push({ key: "datamart_api_key", value: dmEnvKeys[0] });
        }
        const dmEnvSecret = getDatamartSecret();
        if (!hasKey("datamart_api_secret") && dmEnvSecret) {
          sList.push({ key: "datamart_api_secret", value: dmEnvSecret });
        }

        return res.status(200).json({ settings: sList });
      }

      if (action === "saveSettings") {
        let rows = body?.settings || [];
        if (!Array.isArray(rows) && typeof rows === "object") {
          rows = Object.entries(rows).map(([key, value]) => ({ key, value: String(value) }));
        }
        if (!Array.isArray(rows)) return res.status(400).json({ error: "Invalid settings format" });

        const m = new Map<string, any>();
        for (const r of rows) {
          if (r && r.key) m.set(String(r.key).trim(), r);
        }
        const deduped = Array.from(m.values());

        const { error } = await admin.from("settings").upsert(deduped, { onConflict: "key" });
        if (error) return res.status(500).json({ error: error.message });
        invalidateSettingsCache();
        try {
          data1db.setTableRecords("settings", deduped);
        } catch (_) {}

        // If saving flash sale settings and auto_broadcast_channel was requested
        if (body?.auto_broadcast_channel || body?.broadcast_channel) {
          try {
            const botUrl = (process.env.WHATSAPP_BOT_SERVER_URL || "https://nestybot.onrender.com").replace(/\/+$/, "");
            fetch(`${botUrl}/api/channel-post`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ topic: "flash", ownerPhone: "233547100951" }),
            }).catch(() => {});
          } catch (_) {}
        }

        return res.status(200).json({ ok: true });
      }

      if (action === "postToChannel" || action === "broadcastChannel" || action === "broadcastFlashSale") {
        const botUrl = (process.env.WHATSAPP_BOT_SERVER_URL || "https://nestybot.onrender.com").replace(/\/+$/, "");
        const topic = String(body?.topic || (action === "broadcastFlashSale" ? "flash" : "prices")).trim();
        const text = String(body?.text || body?.message || "").trim();
        try {
          const resp = await fetch(`${botUrl}/api/channel-post`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ topic, text, ownerPhone: "233547100951" }),
          });
          const data: any = await resp.json().catch(() => ({}));
          return res.status(200).json({ ok: true, data });
        } catch (err: any) {
          return res.status(500).json({ ok: false, error: err.message });
        }
      }

      if (action === "testDatamart") {
        let testKey = cleanApiKey(body?.apiKey);
        if (!testKey) {
          testKey = cleanApiKey((await resolveDatamartKeys(admin, true))[0]);
        }
        let testSec = cleanApiKey(body?.apiSecret);
        if (!testSec) {
          testSec = cleanApiKey(await resolveDatamartSecret(admin));
        }
        if (!testKey) {
          return res.status(400).json({ success: false, message: "No DataMart API key found in Vercel .env or system settings." });
        }

        // Try single clean x-api-key header
        let r = await fetch("https://api.datamartgh.shop/api/developer/user/balance", {
          headers: {
            "x-api-key": testKey,
            ...(testSec ? { "x-api-secret": testSec } : {}),
            Accept: "application/json",
          },
          signal: AbortSignal.timeout(7000),
        });
        let d = await r.json().catch(() => ({}));

        if (!r.ok && testSec) {
          const r2 = await fetch("https://api.datamartgh.shop/api/developer/user/balance", {
            headers: { "x-api-key": testKey, Accept: "application/json" },
            signal: AbortSignal.timeout(7000),
          });
          const d2 = await r2.json().catch(() => ({}));
          if (r2.ok) {
            r = r2;
            d = d2;
          }
        }

        if (!r.ok && r.status === 401) {
          const r3 = await fetch("https://api.datamartgh.shop/api/developer/user/balance", {
            headers: { Authorization: `Bearer ${testKey}`, Accept: "application/json" },
            signal: AbortSignal.timeout(7000),
          });
          const d3 = await r3.json().catch(() => ({}));
          if (r3.ok) {
            r = r3;
            d = d3;
          }
        }

        const bal = d?.data?.walletBalance ?? d?.walletBalance ?? d?.data?.balance ?? d?.balance;
        if (r.ok && bal != null && !isNaN(Number(bal))) {
          return res.status(200).json({
            success: true,
            balance: Number(bal),
            message: `Connected successfully! DataMart Wallet Balance: GH₵ ${Number(bal).toFixed(2)}`,
          });
        }

        return res.status(200).json({
          success: false,
          message: d?.message || d?.error || `DataMart returned HTTP ${r.status}`,
          data: d,
        });
      }

      if (action === "getDatamartTopupInfo") {
        const sMap = await getCachedSettings(admin);
        const hasAuthToken = Boolean(sMap["datamart_auth_token"] || process.env.DATAMART_AUTH_TOKEN);
        const hasLogin = Boolean(sMap["datamart_login_email"] && sMap["datamart_login_password"]);
        const topupPhone = sMap["admin_topup_phone"] || sMap["admin_alert_phone"] || sMap["admin_whatsapp_number"] || "0547228161";
        
        let liveBalance: number | null = null;
        try {
          const keys = await resolveDatamartKeys(admin);
          if (keys.length > 0) {
            const sec = await resolveDatamartSecret(admin);
            const bRes = await fetch("https://api.datamartgh.shop/api/developer/balance", {
              headers: getDatamartAuthHeaders(keys[0], sec),
              signal: AbortSignal.timeout(5000),
            });
            const bJson = await bRes.json().catch(() => ({}));
            if (bRes.ok && bJson?.data?.balance != null) {
              liveBalance = Number(bJson.data.balance);
            }
          }
        } catch (_) {}

        return res.status(200).json({
          ok: true,
          configured: hasAuthToken || hasLogin,
          hasAuthToken,
          hasLogin,
          loginEmail: sMap["datamart_login_email"] ? `${sMap["datamart_login_email"].slice(0, 3)}***` : null,
          topupPhone,
          liveBalance,
          depositAccount: {
            phone: "0257476174",
            name: "DANAA SAMUEL FRIMPONG / Dajo Unimarket",
            network: "MTN",
          },
        });
      }

      if (action === "initiateDatamartTopup") {
        const amt = parseFloat(body?.amount);
        if (isNaN(amt) || amt <= 0) {
          return res.status(400).json({ ok: false, error: "Please enter a valid deposit amount." });
        }

        const phone = body?.phone || body?.phoneNumber;
        if (!phone) {
          return res.status(400).json({ ok: false, error: "Please provide a valid Mobile Money phone number." });
        }

        // If credentials provided in modal, save them first
        if (body?.email && body?.password) {
          await admin.from("settings").upsert([
            { key: "datamart_login_email", value: String(body.email).trim() },
            { key: "datamart_login_password", value: String(body.password).trim() },
          ], { onConflict: "key" });
          invalidateSettingsCache();
        } else if (body?.authToken) {
          await admin.from("settings").upsert([
            { key: "datamart_auth_token", value: String(body.authToken).trim() },
          ], { onConflict: "key" });
          invalidateSettingsCache();
        }

        const result = await initiateDatamartBridgeDeposit({
          phoneNumber: phone,
          amount: amt,
          network: body?.network || "MTN",
          supabase: admin,
        });

        if (result.success) {
          return res.status(200).json({
            ok: true,
            transactionId: result.transactionId,
            status: result.status,
            message: result.message,
          });
        }

        return res.status(200).json({
          ok: false,
          error: result.error || "Failed to initiate DataMart MoMo top-up prompt.",
        });
      }

      if (action === "checkDatamartTopupStatus") {
        const trxId = body?.transactionId;
        if (!trxId) {
          return res.status(400).json({ ok: false, error: "Missing transaction ID" });
        }

        const resStatus = await checkDatamartBridgeStatus(trxId, admin);
        
        let newBalance: number | null = null;
        if (resStatus.status === "completed") {
          try {
            const keys = await resolveDatamartKeys(admin);
            if (keys.length > 0) {
              const sec = await resolveDatamartSecret(admin);
              const bRes = await fetch("https://api.datamartgh.shop/api/developer/balance", {
                headers: getDatamartAuthHeaders(keys[0], sec),
                signal: AbortSignal.timeout(5000),
              });
              const bJson = await bRes.json().catch(() => ({}));
              if (bRes.ok && bJson?.data?.balance != null) {
                newBalance = Number(bJson.data.balance);
                await admin.from("settings").upsert({ key: "datamart_last_balance", value: String(newBalance) }, { onConflict: "key" });
              }
            }
          } catch (_) {}
        }

        return res.status(200).json({
          ok: true,
          status: resStatus.status,
          newBalance,
        });
      }

      if (action === "claimDatamartDeposit") {
        const trxId = body?.trxId || body?.transactionId;
        const momoPhone = body?.momoNumber || body?.phone;
        if (!trxId || !momoPhone) {
          return res.status(400).json({ ok: false, error: "Please enter both the Transaction ID and your MoMo number." });
        }

        const claimRes = await claimDatamartMomoDeposit({
          trxId,
          momoNumber: momoPhone,
          network: body?.network || "mtn",
          supabase: admin,
        });

        if (claimRes.success) {
          return res.status(200).json({
            ok: true,
            message: claimRes.message || "Deposit successfully claimed! DataMart wallet credited.",
            newBalance: claimRes.newBalance,
          });
        }

        return res.status(200).json({
          ok: false,
          error: claimRes.error || "Failed to claim deposit with DataMart.",
        });
      }

      if (action === "listProducts") {
        const { data: prods, error } = await admin
          .from("products")
          .select("*")
          .order("sort_order", { ascending: true });
        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ products: prods || [] });
      }

      if (action === "createProduct") {
        const p = body?.product || {};
        const cap = String(p.capacity || "").trim();
        const pr = Number(p.price);
        const net = String(p.network || "MTN").trim();
        const mb = Math.round(Number(cap) * 1000) || 0;
        const { data: newProd, error } = await admin
          .from("products")
          .insert({
            network: net,
            capacity: cap,
            mb,
            price: pr,
            in_stock: true,
            sort_order: Number(p.sort_order ?? cap) || 0,
          })
          .select("*")
          .single();
        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ ok: true, product: newProd });
      }

      if (action === "updateProduct") {
        const p = body?.product || {};
        if (!p.id) return res.status(400).json({ error: "Missing product id" });
        const { data: upd, error } = await admin
          .from("products")
          .update({
            price: Number(p.price),
            name: p.name ?? null,
            in_stock: !!p.in_stock,
            sort_order: Number(p.sort_order) || 0,
          })
          .eq("id", p.id)
          .select("*")
          .single();
        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ ok: true, product: upd });
      }

      if (action === "deleteProduct") {
        const id = body?.id;
        if (!id) return res.status(400).json({ error: "Missing product id" });
        const { error } = await admin.from("products").delete().eq("id", id);
        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ ok: true });
      }

      // Helper: fetch Paystack Secret Key
      async function getPaystackSecretKey(adminClient: any): Promise<string> {
        let paystackKey = cleanApiKey(
          getEnvVar([
            "PAYSTACK_SECRET_KEY",
            "VITE_PAYSTACK_SECRET_KEY",
            "PAYSTACK_KEY",
            "paystack_secret_key",
            "paystack_secret",
            "PAYSTACK_SECRET",
            "paystack_live_secret_key",
            "PAYSTACK_LIVE_SECRET_KEY",
          ])
        );
        if (!paystackKey) {
          const { data: psRows } = await adminClient
            .from("settings")
            .select("key, value")
            .in("key", [
              "paystack_secret_key",
              "PAYSTACK_SECRET_KEY",
              "paystack_secret",
              "PAYSTACK_SECRET",
              "paystack_key",
              "PAYSTACK_KEY",
              "paystack_live_secret_key",
              "PAYSTACK_LIVE_SECRET_KEY",
            ]);
          for (const row of psRows || []) {
            const c = cleanApiKey(row?.value);
            if (c && c.startsWith("sk_")) {
              paystackKey = c;
              break;
            } else if (c && !paystackKey) {
              paystackKey = c;
            }
          }
        }
        return paystackKey || "";
      }

      // Safe order database updater that resiliently queries by reference, UUID id, or ref
      async function updateOrderDb(adminClient: any, targetOrder: any, updates: Record<string, any>): Promise<any> {
        let updatedRow: any = null;
        if (targetOrder.reference) {
          const { data } = await adminClient
            .from("orders")
            .update(updates)
            .eq("reference", targetOrder.reference)
            .select("*")
            .maybeSingle();
          if (data) updatedRow = data;
        }
        if (!updatedRow && targetOrder.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(targetOrder.id))) {
          const { data } = await adminClient
            .from("orders")
            .update(updates)
            .eq("id", targetOrder.id)
            .select("*")
            .maybeSingle();
          if (data) updatedRow = data;
        }
        if (!updatedRow && targetOrder.ref) {
          const { data } = await adminClient
            .from("orders")
            .update(updates)
            .eq("ref", targetOrder.ref)
            .select("*")
            .maybeSingle();
          if (data) updatedRow = data;
        }
        return updatedRow ? { ...targetOrder, ...updatedRow } : { ...targetOrder, ...updates };
      }

      // Comprehensive Live Payment & Delivery Sync Helper
      async function syncOrderLivePaymentHelper(
        rawOrder: any,
        adminClient: any,
        paystackKey: string,
        dmKeys: string[]
      ): Promise<{
        success: boolean;
        statusChanged: boolean;
        payment_status: string;
        delivery_status: string;
        order: any;
        message: string;
      }> {
        if (!rawOrder || (!rawOrder.reference && !rawOrder.id)) {
          return {
            success: false,
            statusChanged: false,
            payment_status: rawOrder?.payment_status || "unknown",
            delivery_status: rawOrder?.delivery_status || "unknown",
            order: rawOrder,
            message: "Order has no reference or id",
          };
        }

        const initialPaymentStatus = rawOrder.payment_status;
        const initialDeliveryStatus = rawOrder.delivery_status;
        let targetOrder = { ...rawOrder };

        // Free data vouchers don't require Paystack verification
        if (targetOrder.source === "free_data") {
          return {
            success: true,
            statusChanged: false,
            payment_status: "free",
            delivery_status: targetOrder.delivery_status,
            order: targetOrder,
            message: "Free data order",
          };
        }

        // 1. Check live status on Paystack ONLY if order is not already paid
        if (paystackKey && targetOrder.payment_status !== "paid") {
          const refToTest = targetOrder.reference || targetOrder.paystack_ref || targetOrder.ref;
          if (refToTest) {
            try {
              const psRes = await fetch(
                `https://api.paystack.co/transaction/verify/${encodeURIComponent(refToTest)}`,
                {
                  headers: { Authorization: `Bearer ${paystackKey}` },
                  signal: AbortSignal.timeout(8000),
                }
              );
              const psData = await psRes.json().catch(() => null);

              if (psRes.ok && psData?.status && psData.data?.status === "success") {
                const expectedKobo = Math.round(Number(targetOrder.amount) * 100);
                const actualKobo = Number(psData.data.amount);

                if (actualKobo < expectedKobo - 2) {
                  const underpayMsg = `Amount paid (GHS ${(actualKobo / 100).toFixed(2)}) was less than required (GHS ${(expectedKobo / 100).toFixed(2)})`;
                  const underpayUpdates = {
                    payment_status: "failed",
                    delivery_status: "failed",
                    status: "failed",
                    error_message: underpayMsg,
                    updated_at: new Date().toISOString(),
                  };

                  targetOrder = await updateOrderDb(adminClient, targetOrder, underpayUpdates);

                  // Automatically dispatch customer recovery SMS strictly to the MoMo number via Arkesel
                  const momoUnderpay = extractPaystackMomoPhone(psData.data, targetOrder);
                  if (momoUnderpay) {
                    sendPaymentIncompleteCustomerSms(
                      {
                        reference: targetOrder.reference,
                        momoPhone: momoUnderpay,
                        customerPhone: momoUnderpay,
                        recipientPhone: targetOrder.recipient_phone,
                        amount: targetOrder.amount,
                        itemDescription: `${targetOrder.capacity || ""}GB ${targetOrder.network || ""} Data`,
                        network: targetOrder.network,
                        capacity: targetOrder.capacity,
                        reason: "underpaid",
                        gatewayResponse: underpayMsg,
                        storeName: targetOrder.store_name,
                        agentId: targetOrder.agent_id,
                      },
                      adminClient
                    ).catch((e: any) => console.warn("Underpaid payment customer recovery SMS note:", e?.message));
                  }

                  return {
                    success: true,
                    statusChanged: initialPaymentStatus !== "failed",
                    payment_status: "failed",
                    delivery_status: "failed",
                    order: targetOrder,
                    message: underpayMsg,
                  };
                }

                const updates: Record<string, any> = {
                  payment_status: "paid",
                  paid_at: psData.data.paid_at || new Date().toISOString(),
                  channel: psData.data.channel || targetOrder.channel,
                  error_message: null,
                  updated_at: new Date().toISOString(),
                };

                if (
                  !targetOrder.delivery_status ||
                  targetOrder.delivery_status === "pending" ||
                  targetOrder.delivery_status === "failed"
                ) {
                  updates.delivery_status = "processing";
                  updates.status = "processing";
                }

                targetOrder = await updateOrderDb(adminClient, targetOrder, updates);

                // Record agent profit if applicable (Flash Sale orders award 0 profit / no agent history)
                const isFlashSaleOrder =
                  Boolean(targetOrder.is_flash_sale) ||
                  Boolean(psData.data?.metadata?.is_flash_sale) ||
                  (typeof targetOrder.notes === "string" && (targetOrder.notes.includes("FLASH_SALE") || targetOrder.notes.includes("FLASH SALE")));
                const agentNotesMatch = targetOrder.notes?.match(/\[agent:([^\]]+)\]/);
                const agentId = targetOrder.agent_id || psData.data?.metadata?.agent_id || (agentNotesMatch ? agentNotesMatch[1] : null);
                if (agentId && !isFlashSaleOrder) {
                  try {
                    const { recordAgentOrder, loadBasePrices, resolveOrderBasePrice } = await import("./agent.js");
                    const basePrices = await loadBasePrices(adminClient);
                    const baseCost = resolveOrderBasePrice(targetOrder, basePrices);
                    const profit = Math.max(0, Number((Number(targetOrder.amount) - baseCost).toFixed(2)));
                    await recordAgentOrder(adminClient, {
                      agent_id: agentId,
                      reference: targetOrder.reference,
                      network: targetOrder.network,
                      package_size: `${targetOrder.capacity || ""}GB`,
                      phone: targetOrder.recipient_phone,
                      amount: Number(targetOrder.amount),
                      base_price: baseCost,
                      agent_profit: profit,
                      paystack_ref: psData.data?.reference || targetOrder.reference,
                      status: targetOrder.delivery_status || "processing",
                      created_at: targetOrder.created_at,
                      notes: targetOrder.notes,
                    });
                  } catch (agErr) {
                    console.warn("Agent order record note during live sync:", agErr);
                  }
                }

                // Trigger payment notification
                sendPaymentReceivedNotification(
                  {
                    reference: targetOrder.reference,
                    amount: targetOrder.amount,
                    itemDescription: `${targetOrder.capacity || ""}GB ${targetOrder.network || ""} Data`,
                    recipientPhone: targetOrder.recipient_phone,
                    customerPhone: targetOrder.customer_phone || targetOrder.recipient_phone,
                    network: targetOrder.network,
                    channel: psData.data?.channel,
                    orderType: "data",
                    agentId: agentId || undefined,
                    agentStoreName: targetOrder.store_name,
                  },
                  adminClient
                ).catch(() => {});
              } else {
                const orderAgeMs = Date.now() - new Date(targetOrder.created_at || 0).getTime();
                const isOlderThan5Min = !targetOrder.created_at || orderAgeMs > 5 * 60 * 1000;
                const psStatus = String(psData?.data?.status || "").toLowerCase().trim();
                const isConfirmedFail = psData?.status && ["failed", "abandoned", "reversed", "declined", "timeout"].includes(psStatus);
                const isUncompletedExpired = isOlderThan5Min && (!psData?.status || ["ongoing", "pending", ""].includes(psStatus));

                if (isConfirmedFail || isUncompletedExpired) {
                  const failureReason =
                    psData?.data?.gateway_response ||
                    psData?.data?.message ||
                    psData?.message ||
                    (psStatus === "abandoned"
                      ? "Transaction abandoned by user"
                      : isUncompletedExpired
                      ? "Payment prompt timed out"
                      : "Payment failed on Paystack");

                  if (targetOrder.payment_status !== "paid") {
                    const failUpdates: Record<string, any> = {
                      payment_status: "failed",
                      delivery_status: "failed",
                      status: "failed",
                      error_message: failureReason,
                      updated_at: new Date().toISOString(),
                    };

                    targetOrder = await updateOrderDb(adminClient, targetOrder, failUpdates);

                    // Automatically dispatch customer recovery SMS strictly to the MoMo number via Arkesel
                    const momoFail = extractPaystackMomoPhone(psData?.data, targetOrder);
                    if (momoFail) {
                      sendPaymentIncompleteCustomerSms(
                        {
                          reference: targetOrder.reference,
                          momoPhone: momoFail,
                          customerPhone: momoFail,
                          recipientPhone: targetOrder.recipient_phone,
                          amount: targetOrder.amount,
                          itemDescription: `${targetOrder.capacity || ""}GB ${targetOrder.network || ""} Data`,
                          network: targetOrder.network,
                          capacity: targetOrder.capacity,
                          reason: psStatus || "failed",
                          gatewayResponse: failureReason,
                          storeName: targetOrder.store_name,
                          agentId: targetOrder.agent_id,
                        },
                        adminClient
                      ).catch((e: any) => console.warn("Failed payment customer recovery SMS note:", e?.message));
                    }

                    return {
                      success: true,
                      statusChanged: initialPaymentStatus !== "failed",
                      payment_status: "failed",
                      delivery_status: "failed",
                      order: targetOrder,
                      message: `Paystack: ${failureReason}`,
                    };
                  }
                }
              }
            } catch (psErr: any) {
              console.warn(`Paystack lookup error on ${targetOrder.reference}:`, psErr?.message);
            }
          }
        }

        // 2. If payment is paid, check & sync live delivery status with DataMart!
        if (targetOrder.payment_status === "paid") {
          // If order already has a datamart reference or was dispatched, check live status
          if (dmKeys.length > 0) {
            try {
              const synced = await syncOrderWithDatamart(targetOrder, adminClient, dmKeys);
              if (synced) targetOrder = synced;
            } catch (dmErr: any) {
              console.warn("DataMart sync error:", dmErr?.message);
            }
          }

          // If order is paid but NOT delivered and NOT dispatched to DataMart, auto-dispatch to DataMart!
          const isCompleted = ["delivered", "completed"].includes((targetOrder.delivery_status || "").toLowerCase());
          if (!isCompleted && !targetOrder.datamart_reference && dmKeys.length > 0 && targetOrder.network) {
            try {
              const networkMap: Record<string, string> = {
                MTN: "YELLO",
                mtn: "YELLO",
                YELLO: "YELLO",
                TELECEL: "TELECEL",
                telecel: "TELECEL",
                AT: "AT_PREMIUM",
                at: "AT_PREMIUM",
                AIRTELTIGO: "AT_PREMIUM",
                airteltigo: "AT_PREMIUM",
                AT_PREMIUM: "AT_PREMIUM",
              };
              const dmNetwork = networkMap[targetOrder.network] || targetOrder.network;
              const rawPhone = String(targetOrder.recipient_phone || targetOrder.phone_number || "").replace(/\D/g, "");
              let cleanPhone = rawPhone;
              if (cleanPhone.startsWith("233") && cleanPhone.length === 12) cleanPhone = "0" + cleanPhone.slice(3);
              else if (cleanPhone.length === 9) cleanPhone = "0" + cleanPhone;

              let cleanCapacity = String(targetOrder.capacity || "").trim();
              const capMatch = cleanCapacity.match(/^(\d+(?:\.\d+)?)/);
              if (capMatch) cleanCapacity = capMatch[1];

              const dmRef = targetOrder.reference.startsWith("WS-") ? targetOrder.reference : `WS-${targetOrder.reference.replace(/^WS-?/, "")}`;
              const dmSecret = await resolveDatamartSecret(adminClient);

              // 🔒 Claim dispatch lock before auto-dispatch
              const claimedLock = await claimOrderDispatchLock(targetOrder.id || targetOrder.reference, adminClient);
              if (claimedLock) {
                let autoFulfilled = false;
                for (const candidateKey of dmKeys) {
                  try {
                    const purchaseResult = await executeDatamartPurchase({
                      apiKey: candidateKey,
                      secret: dmSecret,
                      phoneNumber: cleanPhone,
                      network: dmNetwork,
                      capacity: cleanCapacity,
                      reference: targetOrder.reference,
                      skipLock: true,
                    });

                    if (purchaseResult.success) {
                      const dmOrderId = purchaseResult.reference || targetOrder.reference;
                      const dmDelStatus = purchaseResult.data?.data?.orderStatus === "completed" ? "delivered" : "processing";
                      const { data: dispatchedOrder } = await adminClient
                        .from("orders")
                        .update({
                          datamart_reference: String(dmOrderId),
                          delivery_status: dmDelStatus,
                          status: dmDelStatus,
                          supplier_status: "datamart",
                          error_message: null,
                          updated_at: new Date().toISOString(),
                        })
                        .eq("id", targetOrder.id)
                        .select("*")
                        .maybeSingle();

                      if (dispatchedOrder) targetOrder = dispatchedOrder;
                      autoFulfilled = true;
                      break;
                    }
                  } catch (dmPostErr) {
                    console.warn("Auto-dispatch to DataMart note:", dmPostErr);
                  }
                }

                if (!autoFulfilled && !targetOrder.datamart_reference) {
                  await releaseOrderDispatchLock(targetOrder.id || targetOrder.reference, adminClient, "failed");
                }
              }
            } catch (dispErr) {
              console.warn("Auto-dispatch error:", dispErr);
            }
          }
        }

        // Sync with agent_orders table if this order is linked to an agent
        if (targetOrder.agent_id || targetOrder.reference) {
          try {
            await adminClient
              .from("agent_orders")
              .update({
                payment_status: targetOrder.payment_status || "paid",
                delivery_status: targetOrder.delivery_status || "processing",
                status: targetOrder.delivery_status || "processing",
              })
              .or(`reference.eq.${targetOrder.reference},id.eq.${targetOrder.reference}`);
          } catch (_) {}
        }

        const statusChanged =
          initialPaymentStatus !== targetOrder.payment_status ||
          initialDeliveryStatus !== targetOrder.delivery_status;

        return {
          success: true,
          statusChanged,
          payment_status: targetOrder.payment_status,
          delivery_status: targetOrder.delivery_status,
          order: targetOrder,
          message: `Payment: ${targetOrder.payment_status?.toUpperCase()} | Delivery: ${targetOrder.delivery_status?.toUpperCase()}`,
        };
      }

      // Action: Sync a single order's live payment & delivery status
      if (action === "syncLivePayment") {
        const ref = String(body?.reference || body?.id || "").trim();
        if (!ref) return res.status(400).json({ error: "Missing order reference or id" });

        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ref);
        let order: any = null;
        try {
          const { data: oDirect } = await admin.from("orders").select("*").eq("reference", ref).maybeSingle();
          if (oDirect) order = oDirect;
        } catch (_) {}

        if (!order) {
          try {
            const { data: oRef } = await admin.from("orders").select("*").eq("ref", ref).maybeSingle();
            if (oRef) order = oRef;
          } catch (_) {}
        }

        if (!order && isUuid) {
          try {
            const { data: oId } = await admin.from("orders").select("*").eq("id", ref).maybeSingle();
            if (oId) order = oId;
          } catch (_) {}
        }

        if (!order && body?.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(body.id))) {
          try {
            const { data: oById } = await admin.from("orders").select("*").eq("id", body.id).maybeSingle();
            if (oById) order = oById;
          } catch (_) {}
        }

        if (!order) {
          try {
            const filter = isUuid
              ? `reference.eq.${ref},datamart_reference.eq.${ref},id.eq.${ref}`
              : `reference.eq.${ref},datamart_reference.eq.${ref}`;
            const { data: oData } = await admin
              .from("orders")
              .select("*")
              .or(filter)
              .maybeSingle();
            if (oData) order = oData;
          } catch (_) {}
        }

        if (!order) {
          try {
            const aoFilter = isUuid
              ? `reference.eq.${ref},paystack_ref.eq.${ref},id.eq.${ref}`
              : `reference.eq.${ref},paystack_ref.eq.${ref}`;
            const { data: ao } = await admin
              .from("agent_orders")
              .select("*")
              .or(aoFilter)
              .maybeSingle();
            if (ao) {
              order = {
                ...ao,
                recipient_phone: ao.phone || ao.recipient_phone,
                capacity: ao.package_size || ao.capacity,
                is_agent_order: true,
              };
            }
          } catch (_) {}
        }

        if (!order) {
          // Check service_orders & checker_orders
          try {
            const { data: so } = await admin.from("service_orders").select("*").ilike("reference", ref).maybeSingle();
            if (so) {
              const paystackKey = await getPaystackSecretKey(admin);
              if (paystackKey) {
                const psRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(ref)}`, {
                  headers: { Authorization: `Bearer ${paystackKey}` },
                });
                const psData = await psRes.json().catch(() => null);
                if (psData?.status && psData.data?.status === "success") {
                  await admin.from("service_orders").update({ status: "paid" }).eq("id", so.id);
                  so.status = "paid";
                  so.payment_status = "paid";
                } else if (psData?.status && (psData.data?.status === "failed" || psData.data?.status === "abandoned")) {
                  await admin.from("service_orders").update({ status: "failed", delivery_status: "failed" }).eq("id", so.id);
                  so.status = "failed";
                  so.payment_status = "failed";
                  so.delivery_status = "failed";
                }
              }
              return res.status(200).json({ ok: true, order: enrichAdminService(so), message: `Service order payment: ${so.payment_status || so.status}` });
            }
            const { data: co } = await admin.from("checker_orders").select("*").ilike("reference", ref).maybeSingle();
            if (co) {
              const paystackKey = await getPaystackSecretKey(admin);
              if (paystackKey) {
                const psRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(ref)}`, {
                  headers: { Authorization: `Bearer ${paystackKey}` },
                });
                const psData = await psRes.json().catch(() => null);
                if (psData?.status && psData.data?.status === "success") {
                  await admin.from("checker_orders").update({ status: "paid" }).eq("id", co.id);
                  co.status = "paid";
                  co.payment_status = "paid";
                } else if (psData?.status && (psData.data?.status === "failed" || psData.data?.status === "abandoned")) {
                  await admin.from("checker_orders").update({ status: "failed", delivery_status: "failed" }).eq("id", co.id);
                  co.status = "failed";
                  co.payment_status = "failed";
                  co.delivery_status = "failed";
                }
              }
              return res.status(200).json({ ok: true, order: enrichAdminChecker(co), message: `Checker order payment: ${co.payment_status || co.status}` });
            }
          } catch (_) {}
          return res.status(404).json({ error: "Order not found" });
        }

        const paystackKey = await getPaystackSecretKey(admin);
        const dmKeys = await resolveDatamartKeys(admin);
        const result = await syncOrderLivePaymentHelper(order, admin, paystackKey, dmKeys);

        return res.status(200).json({
          ok: true,
          order: result.order,
          statusChanged: result.statusChanged,
          payment_status: result.payment_status,
          delivery_status: result.delivery_status,
          message: result.message,
        });
      }

      // Action: Sync all live payments in bulk across non-delivered / pending orders
      if (action === "syncAllLivePayments") {
        const paystackKey = await getPaystackSecretKey(admin);
        if (!paystackKey) {
          return res.status(400).json({ error: "Paystack secret key is not configured in settings or environment." });
        }
        const dmKeys = await resolveDatamartKeys(admin);

        let targets: any[] = [];
        const requestedRefs = Array.isArray(body?.references) ? body.references : [];

        if (requestedRefs.length > 0) {
          const { data: matched } = await admin
            .from("orders")
            .select("*")
            .in("reference", requestedRefs.slice(0, 50));
          targets = matched || [];
        } else {
          // Fetch up to 50 recent orders that need payment check or delivery sync:
          // orders where payment is pending, unpaid, failed, or delivery is pending/processing
          const { data: pendingOrders } = await admin
            .from("orders")
            .select("*")
            .or("payment_status.eq.pending,payment_status.eq.unpaid,payment_status.eq.failed,delivery_status.eq.pending,delivery_status.eq.processing")
            .order("created_at", { ascending: false })
            .limit(50);
          targets = pendingOrders || [];
        }

        if (targets.length === 0) {
          return res.status(200).json({
            ok: true,
            totalChecked: 0,
            updatedCount: 0,
            paidCount: 0,
            failedCount: 0,
            stillPendingCount: 0,
            updatedOrders: [],
            message: "All orders are up to date.",
          });
        }

        let updatedCount = 0;
        let paidCount = 0;
        let failedCount = 0;
        let stillPendingCount = 0;
        const updatedOrders: any[] = [];

        // Concurrently verify in batches of 5 to respect rate limits
        const batchSize = 5;
        for (let i = 0; i < targets.length; i += batchSize) {
          const chunk = targets.slice(i, i + batchSize);
          const chunkResults = await Promise.allSettled(
            chunk.map((o) => syncOrderLivePaymentHelper(o, admin, paystackKey, dmKeys))
          );

          for (const cr of chunkResults) {
            if (cr.status === "fulfilled") {
              const r = cr.value;
              if (r.statusChanged) updatedCount++;
              if (r.payment_status === "paid") paidCount++;
              else if (r.payment_status === "failed") failedCount++;
              else stillPendingCount++;

              if (r.order) {
                updatedOrders.push(r.order);
              }
            }
          }
        }

        return res.status(200).json({
          ok: true,
          totalChecked: targets.length,
          updatedCount,
          paidCount,
          failedCount,
          stillPendingCount,
          updatedOrders,
          message: `Live payment sync complete: ${paidCount} Paid, ${failedCount} Failed, ${stillPendingCount} Still Pending.`,
        });
      }

      if (action === "syncDatamartOrder" || action === "syncDatamartStatus") {
        const ref = String(body?.reference || body?.id || "").trim();
        if (!ref) return res.status(400).json({ error: "Missing order reference or id" });

        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ref);
        let order: any = null;
        try {
          const filter = isUuid
            ? `reference.eq.${ref},datamart_reference.eq.${ref},id.eq.${ref}`
            : `reference.eq.${ref},datamart_reference.eq.${ref}`;
          const { data: oData } = await admin
            .from("orders")
            .select("*")
            .or(filter)
            .maybeSingle();
          if (oData) order = oData;
        } catch (_) {}

        if (!order) {
          try {
            const aoFilter = isUuid
              ? `reference.eq.${ref},paystack_ref.eq.${ref},id.eq.${ref}`
              : `reference.eq.${ref},paystack_ref.eq.${ref}`;
            const { data: ao } = await admin
              .from("agent_orders")
              .select("*")
              .or(aoFilter)
              .maybeSingle();
            if (ao) {
              order = {
                ...ao,
                recipient_phone: ao.phone || ao.recipient_phone,
                capacity: ao.package_size || ao.capacity,
                is_agent_order: true,
              };
            }
          } catch (_) {}
        }

        if (!order) {
          return res.status(404).json({ error: "Order not found" });
        }

        const paystackKey = await getPaystackSecretKey(admin);
        const keys = await resolveDatamartKeys(admin);
        const syncRes = await syncOrderLivePaymentHelper(order, admin, paystackKey, keys);

        return res.status(200).json({
          ok: true,
          order: syncRes.order,
          message: syncRes.order?.datamart_status
            ? `DataMart live status: ${syncRes.order.datamart_status}`
            : syncRes.message,
        });
      }

      if (action === "updateOrderStatus") {
        const { id, reference, payment_status, delivery_status, status, notes } = body;
        if (!id && !reference) {
          return res.status(400).json({ error: "Missing order ID or reference" });
        }
        const updates: Record<string, any> = {
          updated_at: new Date().toISOString(),
        };
        if (payment_status !== undefined) updates.payment_status = payment_status;
        if (delivery_status !== undefined) {
          updates.delivery_status = delivery_status;
          if (status !== undefined) updates.status = delivery_status;
        }
        if (status !== undefined && delivery_status === undefined) updates.status = status;
        if (notes !== undefined) updates.notes = notes;

        let query = admin.from("orders").update(updates);
        if (id) query = query.eq("id", id);
        else query = query.eq("reference", reference);

        let { data, error } = await query.select("*").maybeSingle();
        if (error) {
          console.warn("orders table update note:", error.message);
        }

        // Resiliently check service_orders and checker_orders as well
        if (!data) {
          try {
            const target = id || reference;
            const sRes = await admin.from("service_orders").update(updates).or(`reference.eq.${target},id.eq.${target}`).select("*").maybeSingle();
            if (sRes?.data) data = sRes.data;
          } catch (_) {}
          try {
            const target = id || reference;
            const cRes = await admin.from("checker_orders").update(updates).or(`reference.eq.${target},id.eq.${target}`).select("*").maybeSingle();
            if (cRes?.data) data = cRes.data;
          } catch (_) {}
        }

        // Keep local data1db cache in sync
        try {
          if (reference) {
            data1db.getClient().from("orders").update(updates).eq("reference", reference);
          }
        } catch (_) {}

        if (data?.agent_id || data?.reference || reference) {
          try {
            const targetRef = data?.reference || reference;
            const updatedDelivery = data?.delivery_status || delivery_status || data?.status || status;
            await admin.from("agent_orders").update({
              delivery_status: updatedDelivery,
              status: updatedDelivery,
              payment_status: data?.payment_status || payment_status || "paid",
            }).or(`reference.eq.${targetRef},id.eq.${targetRef}`);

            const { data: regData } = await admin.from("settings").select("value").eq("key", "agent_orders_registry").maybeSingle();
            if (regData?.value) {
              const list = JSON.parse(regData.value);
              if (Array.isArray(list)) {
                let modified = false;
                list.forEach((ao: any) => {
                  if (ao.reference === targetRef || ao.id === targetRef || ao.id === `agord-${targetRef}`) {
                    ao.delivery_status = updatedDelivery;
                    ao.status = updatedDelivery;
                    ao.payment_status = data?.payment_status || payment_status || ao.payment_status;
                    modified = true;
                  }
                });
                if (modified) {
                  await admin.from("settings").upsert({ key: "agent_orders_registry", value: JSON.stringify(list) }, { onConflict: "key" });
                }
              }
            }
          } catch (_) {}
        }

        return res.status(200).json({ ok: true, order: data || updates });
      }

      if (action === "listOrders") {
        const nowMs = Date.now();
        const wantRefresh = Boolean(body?.refresh || req.query?.refresh === "true");
        if (!wantRefresh && cachedListOrders && nowMs - cachedListOrdersAt < LIST_ORDERS_TTL) {
          return res.status(200).json(cachedListOrders);
        }

        let rawOrders: any[] = [];
        let serviceData: any[] = [];
        let checkerData: any[] = [];
        let chatData: any[] = [];

        // Always query Supabase for fresh orders when refresh requested or cache expired
        try {
          const ordersRes = await admin
            .from("orders")
            .select("id, reference, ref, datamart_reference, datamart_status, delivery_status, status, payment_status, network, capacity, amount, created_at, recipient_phone, phone_number, notes, error_message, customer_email, agent_id")
            .order("created_at", { ascending: false })
            .limit(120);

          if (!ordersRes?.error && Array.isArray(ordersRes?.data) && ordersRes.data.length > 0) {
            rawOrders = ordersRes.data;
            try { data1db.setTableRecords("orders", ordersRes.data); } catch (_) {}
          }
        } catch (_) {}

        if (!rawOrders.length) {
          try {
            rawOrders = data1db.loadTable("orders").slice(0, 120);
          } catch (_) {}
        }

        const allPhones = new Set<string>();

        // High performance: Return database orders immediately (<50ms).
        // Background sync runs asynchronously without blocking the response.
        if (wantRefresh) {
          (async () => {
            try {
              const dmKeys = await resolveDatamartKeys(admin).catch(() => []);
              if (dmKeys.length > 0) {
                const activeToSync = rawOrders
                  .filter((o: any) =>
                    o.datamart_reference &&
                    o.payment_status === "paid" &&
                    !["delivered", "failed", "cancelled", "refunded"].includes((o.delivery_status || "").toLowerCase())
                  )
                  .slice(0, 4);

                if (activeToSync.length > 0) {
                  await Promise.all(
                    activeToSync.map(async (ord: any) => {
                      try { await syncOrderWithDatamart(ord, admin, dmKeys); } catch (_) {}
                    })
                  );
                }
              }
            } catch (_) {}

            try {
              const pendingPayOrders = rawOrders
                .filter((o: any) =>
                  o.reference &&
                  o.source !== "free_data" &&
                  (o.payment_status === "pending" || o.payment_status === "unpaid" || !o.payment_status)
                )
                .slice(0, 4);

              if (pendingPayOrders.length > 0) {
                const paystackKey = await getPaystackSecretKey(admin).catch(() => "");
                const dmKeys = await resolveDatamartKeys(admin).catch(() => []);
                if (paystackKey) {
                  await Promise.all(
                    pendingPayOrders.map(async (ord: any) => {
                      try { await syncOrderLivePaymentHelper(ord, admin, paystackKey, dmKeys); } catch (_) {}
                    })
                  );
                }
              }
            } catch (_) {}
          })().catch(() => {});
        }

        const isWaOrder = (ord: any) => {
          const ref = String(ord?.reference || ord?.ref || ord?.id || "").trim();
          const notes = String(ord?.notes || "").toLowerCase();
          const net = String(ord?.network || "").toUpperCase();
          const src = String(ord?.source || "").toLowerCase();
          return (
            notes.includes("[channel:whatsapp_bot]") ||
            notes.includes("whatsapp_bot") ||
            notes.includes("[whatsapp_phone:") ||
            src === "whatsapp" ||
            src === "whatsapp_bot" ||
            net === "MASHUP" ||
            ref.startsWith("MASHUP-")
          );
        };

        const orders = rawOrders
          .filter((o: any) => !isWaOrder(o))
          .map((o: any) => {
          const phone = o.recipient_phone || o.phone_number || o.whatsapp_phone || o.momo_number || o.customer_phone || o.phone || "";
          if (phone) allPhones.add(String(phone).trim());

          let agentId = o.agent_id;
          if (!agentId && o.notes) {
            const m = String(o.notes).match(/\[agent:([^\]]+)\]/);
            if (m) agentId = m[1];
          }

          const isPaid = o.payment_status === "paid" || o.status === "paid" || o.status === "pending_manual";
          const actualDeliveryStatus = !isPaid && (o.delivery_status === "processing")
            ? (o.payment_status === "failed" ? "failed" : "pending")
            : (o.delivery_status || o.status || "pending");

          return {
            ...o,
            recipient_phone: phone || o.recipient_phone || "—",
            reference: o.reference || o.ref || o.id,
            delivery_status: actualDeliveryStatus,
            payment_status: o.payment_status || (o.status === "pending_manual" ? "paid" : o.status) || "pending",
            agent_id: agentId || null,
          };
        });

        serviceData.forEach((s: any) => {
          if (s.customer_phone) allPhones.add(String(s.customer_phone).trim());
        });
        checkerData.forEach((c: any) => {
          if (c.customer_phone) allPhones.add(String(c.customer_phone).trim());
        });
        chatData.forEach((ch: any) => {
          if (ch.phone) allPhones.add(String(ch.phone).trim());
        });

        const payload = {
          orders,
          phone_numbers: Array.from(allPhones).filter(Boolean),
        };
        cachedListOrders = payload;
        cachedListOrdersAt = Date.now();
        return res.status(200).json(payload);
      }

      if (action === "getFlashSaleOrders") {
        let orders: any[] = [];
        try {
          // 1. Try querying with notes ilike '%FLASH_SALE%' (safely works on any schema)
          const { data: noteMatches, error: nErr } = await admin
            .from("orders")
            .select("*")
            .ilike("notes", "%FLASH_SALE%")
            .order("created_at", { ascending: false })
            .limit(300);
          if (!nErr && Array.isArray(noteMatches)) {
            orders.push(...noteMatches);
          }
        } catch (_) {}

        try {
          // 2. Also fetch recent orders (up to 300) and inspect their fields in memory
          const { data: recentOrders, error: rErr } = await admin
            .from("orders")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(300);
          if (!rErr && Array.isArray(recentOrders)) {
            const isFlash = (o: any) =>
              o?.is_flash_sale === true ||
              o?.is_flash_sale === "true" ||
              (typeof o?.notes === "string" && (o.notes.includes("FLASH_SALE") || o.notes.includes("FLASH SALE") || o.notes.includes("FLASHSALE"))) ||
              (typeof o?.product_id === "string" && (o.product_id.startsWith("fs-") || o.product_id.toLowerCase().includes("flash"))) ||
              (typeof o?.bundle === "string" && o.bundle.toLowerCase().includes("flash")) ||
              (typeof o?.package_size === "string" && o.package_size.toLowerCase().includes("flash"));

            for (const r of recentOrders) {
              if (isFlash(r) && !orders.some((x: any) => (x.id && x.id === r.id) || (x.reference && x.reference === r.reference))) {
                orders.push(r);
              }
            }
          }
        } catch (_) {}

        // 3. Fallback to local data1db store if needed
        if (orders.length === 0) {
          try {
            const allRows = data1db.loadTable("orders");
            orders = (allRows || [])
              .filter((r: any) =>
                r?.is_flash_sale === true ||
                r?.is_flash_sale === "true" ||
                (typeof r?.notes === "string" && (r.notes.includes("FLASH_SALE") || r.notes.includes("FLASH SALE"))) ||
                (typeof r?.product_id === "string" && r.product_id.startsWith("fs-"))
              );
          } catch (_) {}
        }

        const normalizedOrders = orders.map((o: any) => {
          const phone = o.recipient_phone || o.phone_number || o.whatsapp_phone || o.momo_number || o.customer_phone || o.phone || "";
          return {
            ...o,
            recipient_phone: phone || o.recipient_phone || "—",
            reference: o.reference || o.ref || o.id,
            delivery_status: o.delivery_status || o.status || "processing",
            payment_status: o.payment_status || "paid",
          };
        });

        normalizedOrders.sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
        return res.status(200).json({ ok: true, orders: normalizedOrders });
      }

      if (action === "getSmsLogs") {
        let logs: any[] = [];
        const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const cutoffMs = Date.now() - 24 * 60 * 60 * 1000;

        // 1. Read from data1db in-memory sms_logs first (0 PostgREST egress)
        try {
          const d1Logs = data1db.loadTable("sms_logs");
          if (Array.isArray(d1Logs) && d1Logs.length > 0) {
            logs = d1Logs
              .filter((l: any) => new Date(l.created_at || 0).getTime() > cutoffMs)
              .sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
              .slice(0, 200);
          }
        } catch (_) {}

        // 2. Only hydrate from remote sms_logs if data1db is not yet hydrated or force refresh requested
        if (logs.length === 0 && (!data1db.isTableHydrated("sms_logs", 120000) || body?.refresh === true)) {
          try {
            const { data, error } = await admin
              .from("sms_logs")
              .select("*")
              .gte("created_at", cutoff)
              .order("created_at", { ascending: false })
              .limit(40);

            if (!error && Array.isArray(data)) {
              data1db.setTableRecords("sms_logs", data);
              logs = data;
            } else {
              data1db.markTableHydrated("sms_logs");
            }
          } catch (_) {
            data1db.markTableHydrated("sms_logs");
          }
        }

        // 3. Fallback to data1db settings "recent_sms_logs"
        if (logs.length === 0) {
          try {
            const localSettings = data1db.loadTable("settings");
            const sRow = localSettings.find((s: any) => s.key === "recent_sms_logs");
            if (sRow?.value) {
              const parsed = JSON.parse(sRow.value);
              if (Array.isArray(parsed)) {
                logs = parsed.filter((l: any) => new Date(l.created_at || 0).getTime() > cutoffMs);
              }
            }
          } catch (_) {}
        }

        // Live Arkesel Balance Check (uses cached settings first - 0 egress)
        let arkeselBalance: string | null = cachedArkesel?.sms !== undefined ? String(cachedArkesel.sms) : null;
        try {
          let arkeselKey = cleanApiKey(getEnvVar(["ARKESEL_API_KEY", "VITE_ARKESEL_API_KEY", "ARKESEL_KEY", "arkesel_api_key"]));
          if (!arkeselKey) {
            const sMap = await getCachedSettings(admin);
            arkeselKey = cleanApiKey(sMap.arkesel_api_key || sMap.ARKESEL_API_KEY || sMap.arkesel_key);
          }
          if (arkeselKey && (!arkeselBalance || Date.now() - cachedArkeselAt > 30000 || body?.refresh === true)) {
            const bRes = await fetch("https://sms.arkesel.com/api/v2/clients/balance-details", {
              headers: { "api-key": arkeselKey, Accept: "application/json" },
              signal: AbortSignal.timeout(3500),
            });
            if (bRes.ok) {
              const bData = await bRes.json().catch(() => null);
              arkeselBalance = String(bData?.data?.sms_balance ?? bData?.sms_balance ?? bData?.balance ?? "0");
            }
          }
        } catch (_) {}

        return res.status(200).json({ logs, arkeselBalance });
      }

      if (action === "clearSmsLogs") {
        try {
          await admin.from("sms_logs").delete().neq("id", "00000000-0000-0000-0000-000000000000");
        } catch (_) {}
        try {
          await admin.from("settings").upsert({ key: "recent_sms_logs", value: "[]" }, { onConflict: "key" });
        } catch (_) {}
        return res.status(200).json({ ok: true, message: "All SMS notification logs cleared" });
      }

      if (action === "resendCustomerSms") {
        const { recipient, message, reference, type } = body;
        if (!recipient || !message) {
          return res.status(400).json({ error: "Missing recipient phone number or message" });
        }
        const r = await sendArkeselSms(admin, recipient, message);
        logSmsNotification(admin, {
          recipient,
          message,
          reference: reference || null,
          status: r.ok ? "sent" : "failed",
          error: r.ok ? null : (r.error || "Arkesel rejected resend"),
          type: type || "resend",
        }).catch(() => {});
        return res.status(200).json(r);
      }

      if (action === "testPaymentIssueSms") {
        const target = body?.recipient || "0592753424";
        const testRef = `TEST-${Date.now().toString(36).toUpperCase()}`;
        const isAgent = Boolean(body?.is_agent || body?.agent_id || body?.store_slug);
        const storeName = body?.store_name || (isAgent ? "Senerity Data" : "Data1GH");
        const storeSlug = body?.store_slug || (isAgent ? "senerity-data" : "");
        const trackUrl = isAgent
          ? `https://gooddata1.vercel.app/s/${storeSlug}?ref=${testRef}`
          : `https://www.data1gh.com/track?ref=${testRef}`;
        const testMsg = `Dear customer, your payment of GHS 4.30 for 1GB MTN Data could not complete due to low MoMo wallet balance. Top up your wallet & complete here: ${trackUrl} - ${storeName}`;
        const r = await sendArkeselSms(admin, target, testMsg);
        logSmsNotification(admin, {
          recipient: target,
          message: testMsg,
          reference: testRef,
          status: r.ok ? "sent" : "failed",
          error: r.ok ? null : (r.error || "Arkesel test dispatch rejected"),
          type: "test_payment_issue",
        }).catch(() => {});
        return res.status(200).json({ ...r, message: testMsg, reference: testRef });
      }

      return res.status(400).json({ error: `Unknown admin-data action: ${action}` });
    } catch (err: any) {
      console.error("admin-data error:", err);
      return res.status(500).json({ error: err?.message || "Internal server error" });
    }
  }

  // ----------------------------------------------------
  // Bulk SMS Handler (for AdminBulkSms)
  // ----------------------------------------------------
  if (fn === "bulk-sms" || body?.action === "sendBulkSms") {
    try {
      const message = String(body?.message || "").trim();
      if (!message) return res.status(400).json({ error: "Message is required" });
      if (message.length > 1600) return res.status(400).json({ error: "Message must be 1600 characters or fewer" });

      const rawRecipients = Array.isArray(body?.recipients) ? body.recipients : [];
      const formatPhone = (raw: string) => {
        const digits = raw.replace(/\D/g, "");
        if (digits.startsWith("233") && digits.length === 12) return digits;
        if (digits.startsWith("0") && digits.length === 10) return `233${digits.slice(1)}`;
        if (digits.length === 9) return `233${digits}`;
        return null;
      };

      const recipients = Array.from(new Set(rawRecipients.map(formatPhone).filter(Boolean))) as string[];
      if (!recipients.length) return res.status(400).json({ error: "At least one valid phone number is required" });

      // Resolve Arkesel Key from environment (case-insensitive) or database settings
      let arkeselKey = getEnvVar([
        "ARKESEL_API_KEY",
        "ARKESEL_KEY",
        "VITE_ARKESEL_API_KEY",
        "VITE_ARKESEL_KEY",
        "ARKESEL_SMS_KEY",
        "ARKESEL_SMS_API_KEY",
        "ARKESEL_API_SECRET",
        "ARKESEL_SECRET",
        "ARKESEL_TOKEN",
      ]);

      if (!arkeselKey) {
        const { data: sRows } = await admin
          .from("settings")
          .select("key,value")
          .in("key", ["arkesel_api_key", "ARKESEL_API_KEY", "arkesel_key"]);
        for (const row of sRows || []) {
          const c = cleanApiKey(row?.value);
          if (c) { arkeselKey = c; break; }
        }
      }

      if (!arkeselKey) {
        return res.status(400).json({
          error: "Arkesel API key is not configured. Please add ARKESEL_API_KEY in Vercel Environment Variables.",
        });
      }

      // Approved sender ID check (defaults to D_1Gh)
      let rawSender = String(body?.sender_id || "").trim();
      if (!rawSender || rawSender.toLowerCase() === "data1gh") {
        rawSender = getEnvVar(["ARKESEL_SENDER_ID", "SENDER_ID", "ARKESEL_SENDER", "SMS_SENDER_ID"]) || "D_1Gh";
      }
      const sender = (rawSender || "D_1Gh").slice(0, 11);

      // Process in batches of 50 recipients to stay within carrier limits
      const BATCH_SIZE = 50;
      let totalSent = 0;
      let totalFailed = 0;
      let lastDetails: any = null;
      let lastErrorMessage = "";

      for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
        const chunk = recipients.slice(i, i + BATCH_SIZE);
        let batchOk = false;

        // Try 1: Arkesel v2 SMS endpoint
        try {
          const arkeselRes = await fetch("https://sms.arkesel.com/api/v2/sms/send", {
            method: "POST",
            headers: {
              "api-key": arkeselKey,
              "api_key": arkeselKey,
              "X-API-Key": arkeselKey,
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify({
              sender,
              message,
              recipients: chunk,
            }),
          });

          const details = await arkeselRes.json().catch(() => ({}));
          lastDetails = details;

          if (arkeselRes.ok && (details?.status === "success" || details?.code === 100 || details?.code === "100" || details?.code === 1000 || details?.code === "1000" || details?.data || !details?.error)) {
            batchOk = true;
            totalSent += chunk.length;
          } else {
            lastErrorMessage = details?.message || details?.error || `Arkesel HTTP ${arkeselRes.status}`;
            console.warn("Arkesel v2 send warning:", lastErrorMessage);
          }

        } catch (e: any) {
          lastErrorMessage = e?.message || "Connection timeout to Arkesel v2";
        }

        // Try 2: Fallback to Arkesel v1 endpoint if v2 returned an error
        if (!batchOk) {
          try {
            const v1Url = `https://sms.arkesel.com/sms/api?action=send-sms&api_key=${encodeURIComponent(arkeselKey)}&to=${encodeURIComponent(chunk.join(","))}&from=${encodeURIComponent(sender)}&sms=${encodeURIComponent(message)}&response=json`;
            const v1Res = await fetch(v1Url, {
              method: "GET",
              headers: { Accept: "application/json" },
            });
            const v1Details = await v1Res.json().catch(() => ({}));
            lastDetails = v1Details;
            if (v1Res.ok && (v1Details?.code === "ok" || v1Details?.status === "success" || v1Details?.code === 100)) {
              batchOk = true;
              totalSent += chunk.length;
            } else {
              lastErrorMessage = v1Details?.message || v1Details?.error || lastErrorMessage;
            }
          } catch (v1Err: any) {
            console.warn("Arkesel v1 fallback warning:", v1Err);
          }
        }

        if (!batchOk) {
          totalFailed += chunk.length;
        }
      }

      if (totalSent === 0 && totalFailed > 0) {
        return res.status(400).json({
          error: lastErrorMessage || "Arkesel rejected the SMS. Check that your Sender ID ('D_1Gh') is approved on your Arkesel account.",
          details: lastDetails,
        });
      }

      return res.status(200).json({
        ok: true,
        sent: totalSent,
        total: recipients.length,
        failed: totalFailed,
        details: lastDetails,
      });
    } catch (err: any) {
      console.error("bulk-sms error:", err);
      return res.status(500).json({ error: err?.message || "Failed to send bulk SMS" });
    }
  }

  // ----------------------------------------------------
  // B. Admin Analytics Handler (for AdminAnalytics)
  // ----------------------------------------------------
  if (fn === "admin-analytics" || body?.action === "analytics") {
    try {
      const PAYSTACK_FEE_PERCENT = Number(process.env.PAYSTACK_FEE_PERCENT ?? "1.95");
      const SAVINGS_PERCENT = 45;
      const ANALYTICS_START_DATE = process.env.ANALYTICS_START_DATE ?? "2026-01-01";

      let datamartKey = cleanApiKey(
        getEnvVar([
          "DATA_API_KEY",
          "DATAMART_API_KEY",
          "DATAMART_KEY",
          "DM_API_KEY",
          "VITE_DATAMART_API_KEY",
          "VITE_DATA_API_KEY",
          "VITE_DM_API_KEY",
        ])
      );

      const basePriceMap = new Map<string, number>();
      if (datamartKey) {
        try {
          const r = await fetch("https://api.datamartgh.shop/api/developer/data-packages", {
            headers: { "X-API-Key": datamartKey },
          });
          const j = await r.json().catch(() => ({}));
          const data = j?.data || {};
          for (const [net, ourNet] of [["YELLO", "MTN"], ["at", "AT"], ["TELECEL", "TELECEL"]] as const) {
            const arr = data[net] || [];
            for (const p of arr) {
              basePriceMap.set(`${ourNet}-${String(p.capacity)}`, Number(p.price));
            }
          }
        } catch (_) {}
      }

      const now = new Date();
      const baseline = new Date(`${ANALYTICS_START_DATE}T00:00:00Z`);

      const [ordersRes, firstSeenRes] = await Promise.all([
        admin.from("orders").select("amount, payment_status, created_at, network, capacity").gte("created_at", baseline.toISOString()).order("created_at", { ascending: false }),
        admin.from("orders").select("customer_email, recipient_phone, created_at").gte("created_at", baseline.toISOString()).order("created_at", { ascending: true }),
      ]);

      const orders = ordersRes.data || [];
      const firstSeen = new Map<string, string>();
      for (const r of firstSeenRes.data || []) {
        const id = (r.customer_email || r.recipient_phone || "").toLowerCase().trim();
        if (id && !firstSeen.has(id)) firstSeen.set(id, r.created_at);
      }

      const clamp = (d: Date) => (d < baseline ? baseline : d);
      const startOfDay = clamp(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())));
      const startOfWeek = clamp(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - 6 * 24 * 3600 * 1000));
      const startOfMonth = clamp(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)));

      const buildPeriodStats = (from: Date) => {
        const paid = orders.filter(o => o.payment_status === "paid" && new Date(o.created_at) >= from);
        const revenue = paid.reduce((s, o) => s + Number(o.amount || 0), 0);
        const baseCost = paid.reduce((s, o) => {
          const bp = basePriceMap.get(`${o.network}-${o.capacity}`) ?? (Number(o.amount || 0) * 0.8);
          return s + bp;
        }, 0);
        const paystackFee = revenue * (PAYSTACK_FEE_PERCENT / 100);
        const afterFee = revenue - paystackFee;
        const netProfit = afterFee - baseCost;
        const grossProfit = revenue - baseCost;
        const savings = Math.max(0, netProfit) * (SAVINGS_PERCENT / 100);

        const newCustomers = new Set<string>();
        firstSeen.forEach((ts, id) => {
          if (new Date(ts) >= from) newCustomers.add(id);
        });

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

      // Sales by bundle size for monthly window
      const salesByBundle: Record<string, { network: string; capacity: string; count: number; revenue: number; profit: number }> = {};
      for (const o of orders) {
        if (o.payment_status !== "paid") continue;
        if (new Date(o.created_at) < startOfMonth) continue;
        const key = `${o.network}-${o.capacity}`;
        salesByBundle[key] ||= { network: o.network, capacity: String(o.capacity), count: 0, revenue: 0, profit: 0 };
        salesByBundle[key].count += 1;
        salesByBundle[key].revenue += Number(o.amount || 0);
        const bp = basePriceMap.get(key) ?? (Number(o.amount || 0) * 0.8);
        salesByBundle[key].profit += Number(o.amount || 0) - bp;
      }

      // Daily time series
      const series: { date: string; revenue: number; profit: number; savings: number; orders: number }[] = [];
      const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      const days = 14;
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(today.getTime() - i * 24 * 3600 * 1000);
        const next = new Date(d.getTime() + 24 * 3600 * 1000);
        const slice = orders.filter(o =>
          o.payment_status === "paid" &&
          new Date(o.created_at) >= d && new Date(o.created_at) < next
        );
        const revenue = slice.reduce((s, o) => s + Number(o.amount || 0), 0);
        const baseCost = slice.reduce((s, o) => s + (basePriceMap.get(`${o.network}-${o.capacity}`) ?? (Number(o.amount || 0) * 0.8)), 0);
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

      return res.status(200).json({
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
    } catch (err: any) {
      console.error("admin-analytics error:", err);
      return res.status(500).json({ error: err?.message || "Internal server error" });
    }
  }

  // ----------------------------------------------------
  // C. Admin Services Handler (for AdminServices, AdminReferrals, AdminSpinReport)
  // ----------------------------------------------------
  const isServices =
    fn === "admin-services" ||
    body?.action === "overview" ||
    body?.action === "togglePromo" ||
    body?.action === "setPrices" ||
    body?.action === "updateOrder" ||
    body?.action === "deleteOrder";

  if (isServices) {
    try {
      const action = body?.action || "overview";

      if (action === "togglePromo") {
        const enabled = !!body.enabled;
        await admin
          .from("settings")
          .upsert({ key: "promo_enabled", value: enabled ? "true" : "false" }, { onConflict: "key" });
        return res.status(200).json({ ok: true, enabled });
      }

      if (action === "toggleSpin") {
        const enabled = !!body.enabled;
        await admin
          .from("settings")
          .upsert({ key: "spin_game_enabled", value: enabled ? "true" : "false" }, { onConflict: "key" });
        return res.status(200).json({ ok: true, enabled });
      }

      if (action === "markSpinSent") {
        const winId = body.id || body.winId;
        const code = body.code;
        if (!winId && !code) {
          return res.status(400).json({ error: "Missing spin ID or code" });
        }
        let q = admin.from("spin_wins").update({
          reward_sent: true,
          reward_sent_at: new Date().toISOString(),
          reward_reference: "MANUAL",
        });
        if (winId) q = q.eq("id", winId);
        else if (code) q = q.eq("code", code);

        const { data: updData, error: updErr } = await q.select("*").maybeSingle();
        if (updErr) {
          return res.status(500).json({ error: updErr.message });
        }
        return res.status(200).json({ ok: true, message: "Marked as sent successfully", spin: updData });
      }

      if (action === "setPrices") {
        const netflix = Number(body.netflix_price);
        const afa = Number(body.afa_price);
        const mashup = Number(body.mashup_price);
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

        if (upserts.length === 0) {
          return res.status(400).json({ error: "Please enter at least one valid positive price." });
        }

        const { error: upErr } = await admin.from("settings").upsert(upserts, { onConflict: "key" });
        if (upErr) return res.status(500).json({ error: upErr.message });
        return res.status(200).json({
          ok: true,
          netflix_price: Number.isFinite(netflix) && netflix > 0 ? netflix : undefined,
          afa_price: Number.isFinite(afa) && afa > 0 ? afa : undefined,
          mashup_price: Number.isFinite(mashup) && mashup > 0 ? mashup : undefined,
        });
      }

      if (action === "updateOrder") {
        const { id, reference, delivery_status, netflix_last_code, notes } = body;
        if (!id && !reference) {
          return res.status(400).json({ error: "Missing order ID or reference" });
        }
        const updates: Record<string, any> = {};
        if (delivery_status !== undefined) updates.delivery_status = delivery_status;
        let finalNotes = notes !== undefined ? notes : undefined;
        if (netflix_last_code !== undefined) {
          finalNotes = setOrderTag(finalNotes || "", "netflix_code", netflix_last_code);
          finalNotes = setOrderTag(finalNotes, "netflix_code_at", new Date().toISOString());
        }
        if (finalNotes !== undefined) updates.notes = finalNotes;

        let query = admin.from("service_orders").update(updates);
        if (id) query = query.eq("id", id);
        else query = query.eq("reference", reference);

        const { data, error } = await query.select("*").maybeSingle();
        if (error) return res.status(500).json({ error: error.message });

        // Automated customer SMS disabled per owner instruction.
        // Admin can use resendSms action if explicit dispatch is desired.

        return res.status(200).json({ ok: true, order: enrichAdminService(data) });
      }

      if (action === "resendSms") {
        const { phone, code, reference } = body;
        if (!phone || !code) return res.status(400).json({ error: "Missing phone or code" });
        const smsMsg = `DATA 1 GH: Your Netflix sign-in code is: ${code}\nEnter this code on Netflix to complete your sign-in. Valid for 15 minutes.`;
        const r = await sendArkeselSms(admin, phone, smsMsg);
        return res.status(200).json(r);
      }

      if (action === "deleteOrder") {
        const { id, reference } = body;
        if (!id && !reference) {
          return res.status(400).json({ error: "Missing order ID or reference" });
        }
        let query = admin.from("service_orders").delete();
        if (id) query = query.eq("id", id);
        else query = query.eq("reference", reference);
        const { error } = await query;
        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ ok: true });
      }

      // Default: Return overview data
      // Fast path: If explicitly requested for Services page only
      const isServicesOnly = body?.action === "servicesOnly" || body?.action === "servicesOverview";

      const [servicesRes, settingsRes] = await Promise.all([
        admin.from("service_orders").select("*").order("created_at", { ascending: false }).limit(50),
        admin.from("settings").select("key,value").in("key", ["promo_enabled", "netflix_price", "afa_price", "mashup_price", "spin_game_enabled"]),
      ]);

      const smap = Object.fromEntries((settingsRes.data || []).map((s: any) => [s.key, s.value]));

      const servicesEnriched = (servicesRes.data || []).map(enrichAdminService);

      if (isServicesOnly) {
        return res.status(200).json({
          services: servicesEnriched,
          referrals: [],
          redemptions: [],
          spin_wins: [],
          spin_redemptions: [],
          promo_enabled: (smap.promo_enabled ?? "true") !== "false",
          spin_game_enabled: smap.spin_game_enabled === "true",
          netflix_price: Number(smap.netflix_price) || 30,
          afa_price: Number(smap.afa_price) || 20,
          mashup_price: Number(smap.mashup_price) || 25,
        });
      }

      const referralsData: any[] = [];
      const redemptionsData: any[] = [];
      const spinWinsData: any[] = [];
      const spinRedemptionsData: any[] = [];

      return res.status(200).json({
        services: servicesEnriched,
        referrals: referralsData,
        redemptions: redemptionsData,
        spin_wins: spinWinsData,
        spin_redemptions: spinRedemptionsData,
        promo_enabled: (smap.promo_enabled ?? "true") !== "false",
        spin_game_enabled: smap.spin_game_enabled === "true",
        netflix_price: Number(smap.netflix_price) || 30,
        afa_price: Number(smap.afa_price) || 20,
        mashup_price: Number(smap.mashup_price) || 25,
      });
    } catch (err: any) {
      console.error("admin/services error:", err);
      return res.status(500).json({ error: err?.message || "Internal server error" });
    }
  }


  // ----------------------------------------------------
  // D. Admin Stats Handler (for AdminDashboard)
  // ----------------------------------------------------
  const forceRefresh = body?.force === true || req.query?.force === "true" || req.query?.refresh === "true";
  if (!forceRefresh && cachedAdminStats && Date.now() - cachedAdminStatsAt < ADMIN_STATS_TTL) {
    return res.status(200).json(cachedAdminStats);
  }
  const now = new Date();
    const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
    const [
      ordersTodayRes,
      recentAllRes,
      serviceOrdersRes,
      checkerOrdersRes,
      freeDataRes,
      supportChatsRes,
      productsCountRes,
      referralsCountRes,
      settingsRes,
    ] = await Promise.all([
      admin.from("orders").select("amount, payment_status, delivery_status, status, datamart_status, created_at").gte("created_at", startOfDay.toISOString()),
      admin.from("orders").select("id, reference, amount, payment_status, delivery_status, network, capacity, created_at, notes, whatsapp_phone, recipient_phone, status, datamart_status").order("created_at", { ascending: false }).limit(40),
      admin.from("service_orders").select("id, reference, service, notes, customer_phone, amount, status, delivery_status, created_at").order("created_at", { ascending: false }).limit(30),
      admin.from("checker_orders").select("id, reference, checker_type, customer_phone, amount, status, delivery_status, notes, created_at").order("created_at", { ascending: false }).limit(30),
      admin.from("free_data_codes").select("id, claimed").limit(80),
      admin.from("chat_conversations").select("id, status, unread_for_support").eq("status", "open").limit(20),
      admin.from("products").select("id, in_stock, network", { count: "exact" }),
      admin.from("referrals").select("id", { count: "exact" }),
      admin.from("settings").select("key, value").in("key", ["shop_name", "whatsapp_bot_url", "whatsapp_channel_url", "support_phone", "ai_support_enabled", "arkesel_last_balance", "arkesel_sms_balance", "arkesel_main_balance", "datamart_last_balance", "akwaaba_last_balance", "arkesel_sender_id"]),
    ]);

    const settingsMap: Record<string, string> = {};
    // First populate from data1db settings
    try {
      for (const row of data1db.loadTable("settings")) {
        if (row?.key && row?.value !== undefined && row?.value !== null) {
          const val = String(row.value).trim();
          settingsMap[row.key] = val;
          settingsMap[row.key.toLowerCase()] = val;
        }
      }
    } catch (_) {}
    // Then merge remote settings & sync into data1db
    if (Array.isArray(settingsRes.data) && settingsRes.data.length > 0) {
      try { data1db.setTableRecords("settings", settingsRes.data); } catch (_) {}
    }
    (settingsRes.data || []).forEach((row: any) => {
      if (row?.key && row?.value) {
        const val = String(row.value).trim();
        settingsMap[row.key] = val;
        settingsMap[row.key.toLowerCase()] = val;
      }
    });

    // Sync orders, service_orders, checker_orders into data1db so data1db is always warm and unified
    if (Array.isArray(recentAllRes.data) && recentAllRes.data.length > 0) {
      try { data1db.setTableRecords("orders", recentAllRes.data); } catch (_) {}
    }
    if (Array.isArray(ordersTodayRes.data) && ordersTodayRes.data.length > 0) {
      try { data1db.setTableRecords("orders", ordersTodayRes.data); } catch (_) {}
    }
    if (Array.isArray(serviceOrdersRes.data) && serviceOrdersRes.data.length > 0) {
      try { data1db.setTableRecords("service_orders", serviceOrdersRes.data); } catch (_) {}
    }
    if (Array.isArray(checkerOrdersRes.data) && checkerOrdersRes.data.length > 0) {
      try { data1db.setTableRecords("checker_orders", checkerOrdersRes.data); } catch (_) {}
    }

    const ordersAll = data1db.loadTable("orders").length > 0
      ? data1db.loadTable("orders")
      : (recentAllRes.data || []);

    // Merge ordersTodayRes with ordersAll filtered by startOfDay so no order is ever missed
    const todayMap = new Map<string, any>();
    for (const o of ordersTodayRes.data || []) {
      const k = String(o.reference || o.ref || o.id || Math.random());
      todayMap.set(k, o);
    }
    for (const o of ordersAll) {
      if (o?.created_at && new Date(o.created_at) >= startOfDay) {
        const k = String(o.reference || o.ref || o.id || Math.random());
        if (!todayMap.has(k)) todayMap.set(k, o);
      }
    }
    const ordersToday = Array.from(todayMap.values());

    const isOrderPaid = (o: any) =>
      o?.payment_status === "paid" ||
      o?.status === "paid" ||
      o?.status === "delivered" ||
      o?.status === "completed" ||
      o?.delivery_status === "delivered" ||
      o?.delivery_status === "completed" ||
      Boolean(o?.whatsapp_phone);

    const isOrderDelivered = (o: any) =>
      o?.delivery_status === "delivered" ||
      o?.delivery_status === "completed" ||
      o?.status === "delivered" ||
      o?.status === "completed" ||
      o?.datamart_status === "completed" ||
      o?.datamart_status === "delivered";

    // Today metrics
    const paidToday = ordersToday.filter(isOrderPaid);
    const deliveredToday = paidToday.filter(isOrderDelivered);
    const todayDataRevenue = paidToday.reduce((s: number, o: any) => s + Number(o.amount || 0), 0);

    const serviceAllList = data1db.loadTable("service_orders").length > 0
      ? data1db.loadTable("service_orders")
      : (serviceOrdersRes.data || []);
    const checkerAllList = data1db.loadTable("checker_orders").length > 0
      ? data1db.loadTable("checker_orders")
      : (checkerOrdersRes.data || []);

    const paidTodayServices = serviceAllList.filter(
      (s: any) => (s.payment_status === "paid" || s.status === "paid") && new Date(s.created_at) >= startOfDay
    );
    const todayServicesRevenue = paidTodayServices.reduce((sum: number, s: any) => sum + Number(s.amount || 0), 0);

    const paidTodayCheckers = checkerAllList.filter(
      (c: any) => (c.payment_status === "paid" || c.status === "paid") && new Date(c.created_at) >= startOfDay
    );
    const todayCheckersRevenue = paidTodayCheckers.reduce((sum: number, c: any) => sum + Number(sum ? c.amount || 0 : c.amount || 0), 0);

    const todayOrdersCount = paidToday.length + paidTodayServices.length + paidTodayCheckers.length;
    const todayRevenueTotal = todayDataRevenue + todayServicesRevenue + todayCheckersRevenue;
    const todayDeliveredTotal = deliveredToday.length;

    // All-time metrics
    const all = ordersAll;
    const paid = all.filter(isOrderPaid);
    const delivered = paid.filter(isOrderDelivered);
    const totalRevenue = paid.reduce((s: number, o: any) => s + Number(o.amount || 0), 0);
    const pending = paid.filter((o: any) => !isOrderDelivered(o) && !["failed", "refunded"].includes(o.delivery_status));
    const failed = all.filter((o: any) => o.delivery_status === "failed");

    // Service orders stats (all-time)
    const serviceList = serviceAllList;
    const paidServices = serviceList.filter((s: any) => s.payment_status === "paid" || s.status === "paid");
    const serviceRevenue = paidServices.reduce((sum: number, s: any) => sum + Number(s.amount || 0), 0);
    const pendingServices = paidServices.filter((s: any) => s.delivery_status !== "delivered" && s.delivery_status !== "failed");

    // Checker orders stats (all-time)
    const checkerList = checkerAllList;
    const paidCheckers = checkerList.filter((c: any) => c.payment_status === "paid" || c.status === "paid");
    const checkerRevenue = paidCheckers.reduce((sum: number, c: any) => sum + Number(c.amount || 0), 0);
    const pendingCheckers = paidCheckers.filter((c: any) => c.delivery_status !== "delivered" && c.delivery_status !== "failed");

    // Free data stats
    const freeDataList = freeDataRes.data || [];
    const freeDataClaimed = freeDataList.filter((f: any) => f.claimed).length;

    // Support chats stats
    const chatList = supportChatsRes.data || [];
    const openChats = chatList.filter((c: any) => c.status === "open").length;
    const totalUnreadSupport = chatList.reduce((sum: number, c: any) => sum + Number(c.unread_for_support || 0), 0);

    // Products stats
    const d1Products = data1db.loadTable("products");
    const productsSource = (productsCountRes.data && productsCountRes.data.length > 0) ? productsCountRes.data : d1Products;
    const productsCount = productsCountRes.count ?? productsSource.length;
    const productsInStock = productsSource.filter((p: any) => p.in_stock !== false).length;

    // Unified recent orders list from web data, services, and checkers
    const unifiedRecent: any[] = [];
    ordersAll.slice(0, 150).forEach((o: any) => {
      const isWhatsApp = Boolean(o.notes && String(o.notes).toLowerCase().includes("whatsapp")) || Boolean(o.whatsapp_phone) || String(o.network || "").toUpperCase() === "MASHUP";
      const recipientPhone = o.recipient_phone || o.phone_number || o.whatsapp_phone || o.momo_number || o.customer_phone || o.phone || "—";
      unifiedRecent.push({
        id: o.id,
        reference: o.reference || o.ref || o.id,
        type: isWhatsApp ? "whatsapp" : "data",
        category_label: isWhatsApp ? "WhatsApp Bot" : "Data Bundle",
        network: o.network,
        capacity: o.capacity ? `${o.capacity}GB` : (o.bundle || "Data"),
        recipient: recipientPhone,
        amount: Number(o.amount || 0),
        payment_status: isOrderPaid(o) ? "paid" : (o.payment_status || o.status || "pending"),
        delivery_status: isOrderDelivered(o) ? "delivered" : (o.delivery_status || o.status || "pending"),
        datamart_status: o.datamart_status || null,
        created_at: o.created_at,
      });
    });

    serviceList.slice(0, 20).forEach((s: any) => {
      unifiedRecent.push({
        id: s.id,
        reference: s.reference,
        type: s.service || "service",
        category_label: s.service === "netflix" ? "Netflix Pass" : s.service === "mashup" ? "MTN Mashup" : "Service",
        network: s.service === "netflix" ? "Netflix" : "MTN",
        capacity: s.notes || (s.service === "netflix" ? "Netflix 30-Day Pass" : "Mashup Combo"),
        recipient: s.customer_phone || "—",
        amount: Number(s.amount || 0),
        payment_status: s.payment_status,
        delivery_status: s.delivery_status,
        created_at: s.created_at,
      });
    });

    checkerList.slice(0, 20).forEach((c: any) => {
      unifiedRecent.push({
        id: c.id,
        reference: c.reference,
        type: "checker",
        category_label: `${String(c.checker_type || "WAEC").toUpperCase()} Checker`,
        network: "WAEC",
        capacity: `${String(c.checker_type || "WAEC").toUpperCase()} Serial & PIN`,
        recipient: c.customer_phone || "—",
        amount: Number(c.amount || 0),
        payment_status: c.payment_status,
        delivery_status: c.delivery_status,
        created_at: c.created_at,
      });
    });

    unifiedRecent.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const byNetwork: Record<string, { orders: number; revenue: number; delivered: number }> = {};
    for (const o of all) {
      const k = o.network || "UNKNOWN";
      byNetwork[k] ||= { orders: 0, revenue: 0, delivered: 0 };
      byNetwork[k].orders += 1;
      if (o.payment_status === "paid") {
        byNetwork[k].revenue += Number(o.amount || 0);
      }
      if (o.payment_status === "paid" && o.delivery_status === "delivered") {
        byNetwork[k].delivered += 1;
      }
    }

    // Resolve DataMart API Key from environment (case-insensitive) or settings
    let datamartKey = getEnvVar([
      "DATA_API_KEY",
      "DATAMART_API_KEY",
      "DATAMART_KEY",
      "DM_API_KEY",
      "VITE_DATAMART_API_KEY",
      "VITE_DATA_API_KEY",
      "VITE_DM_API_KEY",
      "DATAMART_API_TOKEN",
      "DATA_MART_API_KEY",
      "DATAMART_TOKEN",
    ]);
    if (!datamartKey) {
      for (const k of ["datamart_api_key", "data_api_key", "DATA_API_KEY", "dm_api_key", "DATAMART_API_KEY", "datamart_key"]) {
        const c = cleanApiKey(settingsMap[k]);
        if (c && c.length > 5) {
          datamartKey = c;
          break;
        }
      }
    }

    // Resolve Arkesel API Key from environment (case-insensitive) or settings
    let arkeselKey = getEnvVar([
      "ARKESEL_API_KEY",
      "ARKESEL_KEY",
      "VITE_ARKESEL_API_KEY",
      "VITE_ARKESEL_KEY",
      "ARKESEL_SMS_KEY",
      "ARKESEL_SMS_API_KEY",
      "ARKESEL_API_SECRET",
      "ARKESEL_SECRET",
      "ARKESEL_TOKEN",
    ]);
    if (!arkeselKey) {
      for (const [k, v] of Object.entries(settingsMap)) {
        if (k.toLowerCase().includes("arkesel") && k.toLowerCase().includes("key")) {
          const c = cleanApiKey(v);
          if (c && c.length > 5) {
            arkeselKey = c;
            break;
          }
        }
      }
    }

    // Resolve Akwaaba Sale API Key
    let akwaabaKey = getEnvVar(["AKWAABA_API_KEY", "AKWAABA_SALE_API_KEY", "akwaaba_api_key"]);
    if (!akwaabaKey && settingsMap["akwaaba_api_key"]) {
      akwaabaKey = cleanApiKey(settingsMap["akwaaba_api_key"]);
    }
    let akwaabaBalance: number | null = null;
    if (settingsMap["akwaaba_last_balance"]) {
      const ab = Number(settingsMap["akwaaba_last_balance"]);
      if (!isNaN(ab)) akwaabaBalance = ab;
    }
    const akwaabaUrl = getEnvVar(["AKWAABA_API_URL", "AKWAABA_URL"]) || settingsMap["akwaaba_api_url"] || "https://akwaabasale.com/api";

    let walletBalance: number | null = cachedBalance;
    let arkeselSmsBalance: number | null = cachedArkesel?.sms ?? null;
    let arkeselMainBalance: string | null = cachedArkesel?.main ?? null;
    let datamartSecret = getEnvVar([
      "DATAMART_API_SECRET",
      "DM_API_SECRET",
      "datamart_api_secret",
      "datamart_secret",
      "DATAMART_SECRET",
    ]);
    if (!datamartSecret) {
      for (const k of ["datamart_api_secret", "DATAMART_API_SECRET", "datamart_secret", "dm_api_secret"]) {
        const c = cleanApiKey(settingsMap[k]);
        if (c && c.length > 2) {
          datamartSecret = c;
          break;
        }
      }
    }

    if (settingsMap["datamart_last_balance"] && walletBalance === null) {
      const b = Number(settingsMap["datamart_last_balance"]);
      if (!isNaN(b)) walletBalance = b;
    }
    if (settingsMap["arkesel_last_balance"] && arkeselSmsBalance === null) {
      const s = Number(settingsMap["arkesel_last_balance"]);
      if (!isNaN(s)) arkeselSmsBalance = s;
    }
    if (settingsMap["arkesel_main_balance"] && !arkeselMainBalance) {
      arkeselMainBalance = settingsMap["arkesel_main_balance"];
    }

    const tasks: Promise<any>[] = [];

    let datamartError: string | null = null;
    let arkeselError: string | null = null;

    // DataMart balance fetch (fast parallel requests with strict timeout)
    if (datamartKey && (walletBalance === null || forceRefresh || Date.now() - cachedAt > 15000)) {
      tasks.push(
        (async () => {
          const tryFetch = async (url: string) => {
            try {
              const res = await fetch(url, {
                headers: {
                  "x-api-key": datamartKey,
                  ...(datamartSecret ? { "X-API-Secret": datamartSecret } : {}),
                  "Authorization": `Bearer ${datamartKey}`,
                  Accept: "application/json",
                },
                signal: AbortSignal.timeout(3500),
              });
              if (res.ok) return await res.json();
              datamartError = `DataMart balance request failed (${res.status})`;
            } catch (_) {}
            return null;
          };

          try {
            const results = await Promise.all([
              tryFetch("https://api.datamartgh.shop/api/developer/balance"),
              tryFetch("https://api.datamartgh.shop/api/developer/user/balance"),
              tryFetch("https://api.datamartgh.shop/api/developer/wallet-balance"),
              tryFetch("https://api.datamartgh.shop/api/wallet-balance"),
              tryFetch("https://api.datamartgh.shop/api/developer/profile"),
            ]);
            let foundBalance = false;
            for (const json of results) {
              if (!json) continue;
              const rawBal =
                json?.data?.balance ??
                json?.data?.walletBalance ??
                json?.data?.wallet_balance ??
                json?.data?.user?.walletBalance ??
                json?.data?.user?.balance ??
                (typeof json?.data === "number" ? json.data : null) ??
                json?.balance ??
                json?.walletBalance ??
                json?.wallet_balance ??
                json?.user?.walletBalance;
              if (rawBal !== undefined && rawBal !== null) {
                const num = Number(rawBal);
                if (!isNaN(num)) {
                  walletBalance = num;
                  cachedBalance = num;
                  cachedAt = Date.now();
                  datamartError = null;
                  foundBalance = true;
                  checkAndAlertLowDatamartBalance(num, admin).catch(() => null);
                  try {
                    data1db.upsert("settings", { key: "datamart_last_balance", value: String(num) }, "key");
                    await admin.from("settings").upsert({ key: "datamart_last_balance", value: String(num) }, { onConflict: "key" });
                  } catch (_) {}
                  break;
                }
              }
            }
            if (!foundBalance && !datamartError) {
              datamartError = "DataMart returned no wallet balance. Check the API key and optional API secret.";
            }
          } catch (e: any) {
            datamartError = e?.message || "DataMart connection timeout";
          }
        })()
      );
    } else if (!datamartKey) {
      datamartError = "DataMart API key not set";
    }

    // Arkesel balance fetch (fast parallel v2 and v1 requests with strict timeout)
    if (arkeselKey && (arkeselSmsBalance === null || forceRefresh || Date.now() - cachedArkeselAt > 15000)) {
      tasks.push(
        (async () => {
          let foundSms: number | null = null;
          let foundMain: string | null = null;
          let v2Error = "";
          let v1Error = "";

          try {
            const res2 = await fetch("https://sms.arkesel.com/api/v2/clients/balance-details", {
              headers: {
                "api-key": arkeselKey,
                "apiKey": arkeselKey,
                Accept: "application/json",
              },
              signal: AbortSignal.timeout(4000),
            });
            const d2 = await res2.json().catch(() => null);
            if (res2.ok && d2) {
              const payload = d2.data || d2;
              const s = payload.sms_balance ?? payload.smsBalance ?? payload.sms ?? payload.balance;
              if (s !== undefined && s !== null && !isNaN(Number(s))) foundSms = Number(s);
              const m = payload.main_balance ?? payload.mainBalance ?? payload.account_balance;
              if (m !== undefined && m !== null) {
                const strM = String(m).trim();
                if (strM && strM !== "undefined") {
                  foundMain = !isNaN(Number(strM)) ? Number(strM).toFixed(2) : strM;
                }
              }
            } else {
              v2Error = d2?.message || `HTTP ${res2.status}`;
            }
          } catch (e: any) {
            v2Error = e.message;
          }

          if (foundSms === null || foundMain === null) {
            try {
              const res1 = await fetch(`https://sms.arkesel.com/sms/api?action=check-balance&api_key=${encodeURIComponent(arkeselKey)}&response=json`, {
                signal: AbortSignal.timeout(4000),
              });
              const text = await res1.text().catch(() => "");
              if (res1.ok && text) {
                try {
                  const d1 = JSON.parse(text);
                  const payload = d1.data || d1;
                  const s = payload.balance ?? payload.sms_balance ?? payload.smsBalance;
                  if (s !== undefined && s !== null && !isNaN(Number(s)) && foundSms === null) {
                    foundSms = Number(s);
                  }
                  const m = payload.main_balance ?? payload.mainBalance ?? payload.account_balance;
                  if (m !== undefined && m !== null && foundMain === null) {
                    const strM = String(m).trim();
                    if (strM && strM !== "undefined") {
                      foundMain = !isNaN(Number(strM)) ? Number(strM).toFixed(2) : strM;
                    }
                  }
                } catch {
                  const numMatch = text.match(/\b\d+(\.\d+)?\b/);
                  if (numMatch && !text.toLowerCase().includes("invalid") && !text.toLowerCase().includes("error")) {
                    if (foundSms === null) foundSms = Number(numMatch[0]);
                  } else if (text.toLowerCase().includes("invalid") || text.toLowerCase().includes("error")) {
                    v1Error = text.trim().slice(0, 100);
                  }
                }
              } else {
                v1Error = `HTTP ${res1.status}`;
              }
            } catch (e: any) {
              v1Error = e.message;
            }
          }

          if (foundSms !== null || foundMain !== null) {
            if (foundSms !== null) arkeselSmsBalance = foundSms;
            if (foundMain !== null) arkeselMainBalance = foundMain;
            cachedArkesel = { sms: arkeselSmsBalance ?? 0, main: arkeselMainBalance || "0" };
            cachedArkeselAt = Date.now();
            arkeselError = null;
            if (foundSms !== null) {
              try {
                data1db.upsert("settings", { key: "arkesel_last_balance", value: String(foundSms) }, "key");
                await admin.from("settings").upsert({ key: "arkesel_last_balance", value: String(foundSms) }, { onConflict: "key" });
              } catch (_) {}
            }
            if (foundMain !== null) {
              try {
                data1db.upsert("settings", { key: "arkesel_main_balance", value: String(foundMain) }, "key");
                await admin.from("settings").upsert({ key: "arkesel_main_balance", value: String(foundMain) }, { onConflict: "key" });
              } catch (_) {}
            }
          } else {
            arkeselError = v2Error || v1Error || "Could not retrieve balance from Arkesel";
          }
        })()
      );
    } else if (!arkeselKey) {
      arkeselError = "Arkesel SMS API key not set";
    }

    // Akwaaba Sale balance fetch
    if (akwaabaKey && (akwaabaBalance === null || forceRefresh)) {
      tasks.push(
        (async () => {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 6000);
            const akRes = await fetch(`${akwaabaUrl.replace(/\/+$/, "")}/balance`, {
              headers: {
                Authorization: `Bearer ${akwaabaKey}`,
                "X-API-Key": akwaabaKey,
                Accept: "application/json",
              },
              signal: controller.signal,
            });
            clearTimeout(timeoutId);
            if (akRes.ok) {
              const akJson = await akRes.json().catch(() => null);
              const val = Number(akJson?.balance ?? akJson?.data?.balance ?? akJson?.wallet_balance);
              if (Number.isFinite(val)) {
                akwaabaBalance = val;
                try {
                  await admin.from("settings").upsert({ key: "akwaaba_last_balance", value: String(val) }, { onConflict: "key" });
                } catch (_) {}
              }
            }
          } catch (_) {}
        })()
      );
    }

    if (tasks.length > 0) {
      await Promise.allSettled(tasks);
    }

    const grandTotalOrders = paid.length + paidServices.length + paidCheckers.length;
    const grandTotalRevenue = totalRevenue + serviceRevenue + checkerRevenue;
    const grandTotalDelivered = delivered.length;
    const grandTotalPending = pending.length + pendingServices.length + pendingCheckers.length;

    const totalsObj = {
      orders: grandTotalOrders,
      total_orders: grandTotalOrders,
      paid_orders: grandTotalOrders,
      delivered: grandTotalDelivered,
      delivered_orders: grandTotalDelivered,
      pending: grandTotalPending,
      pending_delivery: grandTotalPending,
      failed: failed.length,
      failed_orders: failed.length,
      revenue: grandTotalRevenue,
    };

    const todayObj = {
      orders: todayOrdersCount,
      count: todayOrdersCount,
      paid_orders: todayOrdersCount,
      revenue: todayRevenueTotal,
      delivered: todayDeliveredTotal,
      pending: Math.max(0, todayOrdersCount - todayDeliveredTotal),
    };

    const statsPayload = {
      totals: totalsObj,
      today: todayObj,
      by_network: byNetwork || {},
      wallet_balance: walletBalance,
      akwaaba_balance: akwaabaBalance,
      datamart_source: datamartKey ? "configured" : "missing",
      datamart_status: {
        configured: Boolean(datamartKey),
        balance: walletBalance,
        error: walletBalance !== null ? null : datamartError,
      },
      arkesel_main_balance: arkeselMainBalance,
      arkesel_sms_balance: arkeselSmsBalance,
      arkesel_status: {
        configured: Boolean(arkeselKey),
        sms_balance: arkeselSmsBalance,
        main_balance: arkeselMainBalance,
        error: (arkeselSmsBalance !== null || arkeselMainBalance !== null) ? null : arkeselError,
      },
      recent_orders: recentAllRes.data || [],
      unified_recent_orders: unifiedRecent,
      sections: {
        products: { total: productsCount, in_stock: productsInStock },
        orders: { total: all.length, paid: paid.length, delivered: delivered.length, pending: pending.length, failed: failed.length, revenue: totalRevenue },
        services: { total: serviceList.length, paid: paidServices.length, revenue: serviceRevenue, pending: pendingServices.length },
        checkers: { total: checkerList.length, paid: paidCheckers.length, revenue: checkerRevenue, pending: pendingCheckers.length },
        free_data: { total: freeDataList.length, claimed: freeDataClaimed },
        support: { open_chats: openChats, unread: totalUnreadSupport },
        referrals: { total: referralsCountRes.count ?? 0 },
        bulk_sms: { sms_balance: arkeselSmsBalance, sender_id: settingsMap["arkesel_sender_id"] || "D_1Gh" },
        settings: {
          shop_name: settingsMap["shop_name"] || "DATA 1 GH",
          bot_url: settingsMap["whatsapp_bot_url"] || "",
          channel_url: settingsMap["whatsapp_channel_url"] || "",
          support_phone: settingsMap["support_phone"] || "",
          ai_support_enabled: settingsMap["ai_support_enabled"] !== "false",
        },
      },
      env_diagnostic: {
        has_datamart_api_key: Boolean(datamartKey),
        datamart_key_source: datamartKey ? "configured" : "missing",
        datamart_key_length: datamartKey.length,
      },
      arkesel: {
        configured: Boolean(arkeselKey),
        smsBalance: arkeselSmsBalance,
        mainBalance: arkeselMainBalance,
        error: arkeselError,
      },
    };

    cachedAdminStats = statsPayload;
    cachedAdminStatsAt = Date.now();

    return res.status(200).json(statsPayload);
  } catch (fatalErr: any) {
    console.error("FATAL api/admin error:", fatalErr);
    return res.status(500).json({
      error: fatalErr?.message || "Internal server error in admin handler",
    });
  }
}
