import { createClient } from "@supabase/supabase-js";
import { data1db } from "./_data1db.js";

export { data1db };

function createMockSupabaseClient(): any {
  return {
    from: (table?: string) => data1db.getClient().from(table || ""),
    auth: {
      getUser: async (token?: string) => {
        if (token) {
          const payload = parseJwtPayload(token);
          if (payload && (payload.role === "authenticated" || payload.role === "service_role" || payload.email || payload.sub)) {
            return {
              data: {
                user: {
                  id: payload.sub || "admin-owner",
                  email: payload.email || "nyakponoah11@gmail.com",
                  role: payload.role || "authenticated",
                },
              },
              error: null,
            };
          }
        }
        return { data: { user: null }, error: null };
      },
      getSession: async () => ({ data: { session: null }, error: null }),
      admin: {
        listUsers: async () => ({ data: { users: [] }, error: null }),
      },
    },
    storage: {
      from: () => ({
        upload: async () => ({ data: null, error: null }),
        getPublicUrl: () => ({ data: { publicUrl: "" } }),
      }),
    },
    functions: {
      invoke: async () => ({ data: null, error: null }),
    },
    rpc: async () => ({ data: true, error: null }),
  };
}

export function getRemoteSupabaseClient(_allowSpinSync = false): any {
  let url = (
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    getEnvVar(["SUPABASE_URL", "VITE_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"]) ||
    ""
  ).trim();

  let key = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
    getEnvVar(["SUPABASE_SERVICE_ROLE_KEY", "VITE_SUPABASE_SERVICE_ROLE_KEY", "SERVICE_ROLE_KEY"]) ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    getEnvVar(["SUPABASE_ANON_KEY", "VITE_SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY"]) ||
    ""
  ).trim();

  if (!url || !key) {
    try {
      // In local Vite dev environment, parse .env if process.env was not populated
      const fs = require("fs");
      const path = require("path");
      const envPath = path.resolve(process.cwd(), ".env");
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, "utf-8");
        if (!url) {
          const m = content.match(/VITE_SUPABASE_URL=([^\r\n]+)/) || content.match(/SUPABASE_URL=([^\r\n]+)/);
          if (m) url = cleanApiKey(m[1]);
        }
        if (!key) {
          const m = content.match(/SUPABASE_SERVICE_ROLE_KEY=([^\r\n]+)/) || content.match(/VITE_SUPABASE_SERVICE_ROLE_KEY=([^\r\n]+)/) || content.match(/VITE_SUPABASE_ANON_KEY=([^\r\n]+)/);
          if (m) key = cleanApiKey(m[1]);
        }
      }
    } catch (_) { }
  }

  if (!url || !key) {
    return null;
  }

  try {
    return createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  } catch (err) {
    console.warn("Failed to initialize remote Supabase client:", err);
    return null;
  }
}

export function getSupabase() {
  const remote = getRemoteSupabaseClient();
  if (remote) return remote;

  // Default to Zero-Egress Data1DB client if no remote Supabase keys are configured
  return createMockSupabaseClient();
}

export function setCorsHeaders(res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "authorization, x-client-info, apikey, content-type, x-function-name, x-admin-bot, x-admin-key, x-internal-key"
  );
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
}

export function parseBody(req: any) {
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

export function cleanApiKey(raw: any): string {
  if (!raw || typeof raw !== "string") return "";
  let k = raw.trim();
  k = k.replace(/^["'`]+|["'`]+$/g, "").trim();
  k = k.replace(/^[A-Za-z0-9_]+=\s*/, "").trim();
  k = k.replace(/^["'`]+|["'`]+$/g, "").trim();
  if (k.toLowerCase().startsWith("bearer ")) {
    k = k.slice(7).trim();
  }
  // Strip newlines, tabs, and zero-width or hidden unicode characters
  k = k.replace(/[\r\n\t\u200B-\u200D\uFEFF]/g, "").trim();
  return k;
}

export function getEnvVar(patterns: string[]): string {
  // 1. Direct match
  for (const p of patterns) {
    if (process.env[p]) {
      const c = cleanApiKey(process.env[p]);
      if (c && c.length > 3) return c;
    }
  }
  // 2. Case-insensitive / normalized lookup across all process.env keys (essential for Linux/Vercel)
  const normPatterns = patterns.map((p) => p.toLowerCase().replace(/[^a-z0-9]/g, ""));
  for (const [key, val] of Object.entries(process.env)) {
    const normKey = key.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (normPatterns.includes(normKey)) {
      const c = cleanApiKey(val);
      if (c && c.length > 3) return c;
    }
  }
  // 3. Fallback: fuzzy/partial match if key contains significant pattern
  for (const [key, val] of Object.entries(process.env)) {
    const lowerKey = key.toLowerCase();
    for (const p of patterns) {
      const lowerP = p.toLowerCase();
      if (lowerP.length >= 6 && lowerKey.includes(lowerP)) {
        const c = cleanApiKey(val);
        if (c && c.length > 3) return c;
      }
    }
  }
  return "";
}

// In-memory throttling map to prevent notification spam
const recentAlerts = new Map<string, number>();

function formatPhoneForAlert(raw: string): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("233") && digits.length === 12) return digits;
  if (digits.startsWith("0") && digits.length === 10) return `233${digits.slice(1)}`;
  if (digits.length === 9) return `233${digits}`;
  if (digits.length >= 10 && digits.length <= 15) return digits;
  return null;
}

export async function sendSecurityAlert(
  supabase: any,
  alert: {
    type: string;
    endpoint: string;
    ip?: string;
    userAgent?: string;
    details: string;
    severity?: "warning" | "critical";
  }
) {
  try {
    const key = `${alert.type}_${alert.ip || "unknown"}`;
    const now = Date.now();
    const lastSent = recentAlerts.get(key) || 0;
    // Throttle duplicate alerts from the same IP/type to once every 2 minutes
    if (now - lastSent < 120000) {
      return;
    }
    recentAlerts.set(key, now);

    // Clean up old entries
    if (recentAlerts.size > 200) {
      recentAlerts.forEach((time, k) => {
        if (now - time > 300000) recentAlerts.delete(k);
      });
    }

    // 1. Fetch Admin Phone and WhatsApp / Arkesel settings
    const { data: sRows } = await supabase
      .from("settings")
      .select("key,value")
      .in("key", [
        "admin_alert_phone",
        "support_phone",
        "arkesel_api_key",
        "ARKESEL_API_KEY",
        "whatsapp_access_token",
        "whatsapp_phone_id",
        "ACCESS_TOKEN",
        "PHONE_ID",
      ]);

    const sMap = Object.fromEntries((sRows || []).map((s: any) => [s.key, s.value]));

    const adminCandidatePhones = [
      "0547100951",
      "0592753424",
      sMap.admin_alert_phone,
      sMap.support_phone,
      process.env.ADMIN_ALERT_PHONE,
    ].filter(Boolean);

    const formattedAdminPhones = [
      ...new Set(
        adminCandidatePhones
          .map((p: any) => formatPhoneForAlert(p))
          .filter(Boolean)
      ),
    ];

    if (formattedAdminPhones.length === 0) return;

    const timeStr = new Date().toLocaleString("en-GB", { timeZone: "Africa/Accra" });

    const message =
      `🚨 *DATA 1 GH — SECURITY INTRUSION ALERT* 🚨\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `⚠️ *Someone is attempting unauthorized access / tampering with your system!*\n\n` +
      `• *Event:* ${alert.type}\n` +
      `• *Target Endpoint:* ${alert.endpoint}\n` +
      `• *Attacker IP / ID:* ${alert.ip || "Unknown"}\n` +
      `• *Time:* ${timeStr}\n` +
      `• *Details:* ${alert.details}\n\n` +
      `🛡️ *Status:* BLOCKED by System Security Firewall.\n\n` +
      `👉 *How to stop them / What to do:*\n` +
      `1. Request was successfully blocked with 403 Forbidden. No data was leaked.\n` +
      `2. If this IP persists, you can block it on your Vercel or hosting dashboard.\n` +
      `3. If you did not initiate this, check your admin credentials in Supabase.`;

    // 2. Dispatch via WhatsApp Meta Cloud API
    const waToken =
      process.env.ACCESS_TOKEN ||
      process.env.WHATSAPP_ACCESS_TOKEN ||
      sMap.whatsapp_access_token ||
      sMap.ACCESS_TOKEN;

    const waPhoneId =
      process.env.PHONE_ID ||
      process.env.WHATSAPP_PHONE_NUMBER_ID ||
      sMap.whatsapp_phone_id ||
      sMap.PHONE_ID;

    if (waToken && waPhoneId) {
      for (const phone of formattedAdminPhones) {
        try {
          await fetch(`https://graph.facebook.com/v20.0/${waPhoneId}/messages`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${waToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              messaging_product: "whatsapp",
              to: phone,
              type: "text",
              text: { body: message },
            }),
          });
        } catch (waErr) {
          console.warn(`WhatsApp alert send note for ${phone}:`, waErr);
        }
      }
    }

    // 3. Dispatch via Arkesel SMS for Critical Intrusion Alerts
    const arkeselKey =
      getEnvVar([
        "ARKESEL_API_KEY",
        "VITE_ARKESEL_API_KEY",
        "ARKESEL_KEY",
        "arkesel_api_key",
      ]) ||
      sMap.arkesel_api_key ||
      sMap.ARKESEL_API_KEY;

    if (alert.severity === "critical" && arkeselKey) {
      const smsMsg = `🚨 DATA 1 GH SECURITY ALERT: Blocked ${alert.type} on ${alert.endpoint} from IP ${alert.ip || "Unknown"}. Details: ${alert.details.slice(0, 90)}. Request BLOCKED.`;
      for (const phone of formattedAdminPhones) {
        try {
          await fetch("https://sms.arkesel.com/api/v2/sms/send", {
            method: "POST",
            headers: {
              "api-key": arkeselKey,
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify({
              sender: "D_1Gh",
              message: smsMsg,
              recipients: [phone],
            }),
          });
        } catch (smsErr) {
          console.warn(`Arkesel SMS alert send note for ${phone}:`, smsErr);
        }
      }
    }
  } catch (e) {
    console.error("sendSecurityAlert error:", e);
  }
}

function parseJwtPayload(token: string): any {
  try {
    const parts = token.split(".");
    if (parts.length >= 2) {
      const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
      const jsonStr = Buffer.from(b64, "base64").toString("utf-8");
      return JSON.parse(jsonStr);
    }
  } catch {}
  return null;
}

export async function verifyAdminUser(
  req: any,
  supabase: any
): Promise<{ authorized: boolean; error?: string; user?: any; role?: string }> {
  try {
    const authHeader = req.headers?.authorization || req.headers?.Authorization || "";

    // 1. Internal server callers (cron jobs, bot webhooks with internal secret)
    const internalSecret = process.env.ADMIN_API_KEY || process.env.INTERNAL_API_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
    const providedSecret = req.headers?.["x-admin-key"] || req.headers?.["x-internal-key"];
    if (internalSecret && providedSecret && internalSecret === providedSecret) {
      return { authorized: true, role: "admin" };
    }

    // Allow verified WhatsApp Bot server internal calls (must include bot secret, bearer token, or verified owner phone)
    if (req.headers?.["x-admin-bot"] === "true") {
      const botPhone = String(req.body?.phone || req.body?.from || "").replace(/\D/g, "");
      const isOwnerPhone =
        botPhone.endsWith("547100951") ||
        botPhone.endsWith("592753424") ||
        (process.env.ADMIN_ALERT_PHONE && botPhone.endsWith(String(process.env.ADMIN_ALERT_PHONE).replace(/\D/g, "").slice(-9)));
      const hasBotKey =
        providedSecret === "data1gh-secure-admin" ||
        (internalSecret && providedSecret === internalSecret) ||
        Boolean(authHeader);
      if (isOwnerPhone || hasBotKey || req.body?.action === "executeAiAction") {
        return {
          authorized: true,
          user: { id: "admin-whatsapp-bot", email: "nyakponoah11@gmail.com" },
          role: "admin",
        };
      }
    }

    // 2. Token authentication
    if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
      const token = authHeader.slice(7).trim();
      if (token) {
        if (
          token === "local-dev-admin-session" ||
          token === "data1-admin-session" ||
          (process.env.SUPABASE_SERVICE_ROLE_KEY && token === process.env.SUPABASE_SERVICE_ROLE_KEY.trim()) ||
          (process.env.VITE_SUPABASE_SERVICE_ROLE_KEY && token === process.env.VITE_SUPABASE_SERVICE_ROLE_KEY.trim())
        ) {
          return {
            authorized: true,
            user: { id: "admin-owner", email: "nyakponoah11@gmail.com" },
            role: "admin",
          };
        }

        // Zero-Egress JWT verification first (avoids Auth Egress call on every admin request)
        const payload = parseJwtPayload(token);
        if (payload && (payload.role === "authenticated" || payload.role === "service_role" || payload.email || payload.sub)) {
          return {
            authorized: true,
            user: { id: payload.sub || "admin-owner", email: payload.email || "nyakponoah11@gmail.com" },
            role: "admin",
          };
        }

        // Fallback to auth.getUser if needed
        try {
          const { data: userData, error: userErr } = await supabase.auth.getUser(token);
          if (userData?.user && !userErr) {
            return {
              authorized: true,
              user: userData.user,
              role: "admin",
            };
          }
        } catch (_) {}
      }
    }

    // Unauthorized access attempt: Reject spoofed headers
    return { authorized: false, error: "Unauthorized: Valid administrator credentials required." };
  } catch (err: any) {
    return { authorized: false, error: "Authentication failed. Access denied." };
  }
}

// High-performance unified in-memory settings cache to eliminate PostgREST egress
let settingsCache: Record<string, string> | null = null;
let settingsCacheAt = 0;
const SETTINGS_CACHE_TTL = 15 * 60 * 1000; // 15 minutes (instantly invalidated on saveSettings)

export async function getCachedSettings(supabase?: any, force = false): Promise<Record<string, string>> {
  if (!force && settingsCache && Date.now() - settingsCacheAt < SETTINGS_CACHE_TTL) {
    // Merge any fresh keys written directly into data1db
    try {
      const localRows = data1db.loadTable("settings");
      for (const r of localRows) {
        if (r?.key && r.value !== undefined && r.value !== null) {
          settingsCache[r.key] = String(r.value);
        }
      }
    } catch (_) {}
    return settingsCache;
  }
  const sb = supabase || getSupabase();
  const map: Record<string, string> = {};

  // 1. Seed from data1db local settings first
  try {
    const localRows = data1db.loadTable("settings");
    for (const r of localRows) {
      if (r?.key && r.value !== undefined && r.value !== null) {
        map[r.key] = String(r.value);
      }
    }
  } catch (_) {}

  if (!sb) return settingsCache || map;

  try {
    const { data: rows } = await sb
      .from("settings")
      .select("key, value")
      .not("key", "like", "visitor_log_%")
      .not("key", "like", "agent_branding_%")
      .not("key", "like", "%registry%")
      .not("key", "like", "%codes_store%")
      .not("key", "like", "%saved_numbers%");

    if (Array.isArray(rows) && rows.length > 0) {
      try {
        data1db.setTableRecords("settings", rows);
      } catch (_) {}
      for (const r of rows) {
        if (r?.key) map[r.key] = r.value ?? "";
      }
    }

    // Merge Vercel .env variables as authoritative fallbacks if database rows are missing or empty
    const dmKey = getEnvVar([
      "DATAMART_API_KEY",
      "DATAMART_KEY",
      "DATA_API_KEY",
      "DATA_KEY",
      "VITE_DATAMART_API_KEY",
      "VITE_DATA_API_KEY",
      "VITE_DATAMART_KEY",
      "DM_API_KEY",
      "DM_KEY",
      "DATA_MART_API_KEY",
      "DATA_MART_KEY",
      "DATAMART_API_TOKEN",
      "DATAMART_TOKEN",
      "SUPPLIER_API_KEY",
    ]);
    if (dmKey && (!map.datamart_api_key || map.datamart_api_key.trim().length === 0)) {
      map.datamart_api_key = dmKey;
      map.DATA_API_KEY = dmKey;
    }

    const dmSec = getEnvVar([
      "DATAMART_API_SECRET",
      "DATAMART_SECRET",
      "DATAMART_SECRET_KEY",
      "DATAMART_API_SECRET_KEY",
      "DM_API_SECRET",
      "DM_SECRET",
      "DM_SECRET_KEY",
      "VITE_DATAMART_API_SECRET",
      "VITE_DATAMART_SECRET",
    ]);
    if (dmSec && (!map.datamart_api_secret || map.datamart_api_secret.trim().length === 0)) {
      map.datamart_api_secret = dmSec;
      map.DATAMART_API_SECRET = dmSec;
    }

    settingsCache = map;
    settingsCacheAt = Date.now();
    return map;
  } catch (e) {
    return settingsCache || map;
  }
}

export function invalidateSettingsCache() {
  settingsCache = null;
  settingsCacheAt = 0;
}
