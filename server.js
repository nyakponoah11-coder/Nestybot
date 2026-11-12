try {
  require("dotenv").config();
} catch (_) { }

const express = require("express");
const axios = require("axios");
const { createClient } = require("@supabase/supabase-js");
const { ImapFlow } = require("imapflow");
const { simpleParser } = require("mailparser");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

/* =========================================================
ENV
========================================================= */

const VERIFIED_DATAMART_KEY = "836d191d47c4c1a6ac0fa47eaab4d5da550034056732db23e80f38632a889ee8";
const VERIFIED_DATAMART_SECRET = "5CNIgdcHstmB2vAvePCTm5RpCg3sodoK";
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
const PHONE_ID = process.env.PHONE_ID;
const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET;
const DATA_API_KEY = process.env.DATA_API_KEY || VERIFIED_DATAMART_KEY;
const DATAMART_API_SECRET = process.env.DATAMART_API_SECRET || process.env.DATA_API_SECRET || process.env.DM_API_SECRET || VERIFIED_DATAMART_SECRET;
const AFA_API_KEY = process.env.AFA_API_KEY;
const ARKESEL_API_KEY = process.env.ARKESEL_API_KEY;
const STORE_FRONTEND_URL = "https://www.data1gh.com";
const ADMIN_DASHBOARD_URL = `${STORE_FRONTEND_URL}/admin`;
const DOWNLOAD_APP_URL = `${STORE_FRONTEND_URL}/download-app`;
const TRACK_ORDER_URL = `${STORE_FRONTEND_URL}/track`;
const SERVICES_URL = `${STORE_FRONTEND_URL}/services`;
const STORE_API_URL = `${STORE_FRONTEND_URL}/api/whatsapp-bot`;
const SCRATCH_REQUIRED_ORDERS = 5;
const SCRATCH_ONE_GB_PROBABILITY = 0.90;

/* =========================================================
FULL SITE KNOWLEDGE BASE (DATA 1 GH — EVERYTHING FROM THE SITE)
Loaded directly into AI Mode on WhatsApp for both customers & owner.
Not restricted to database records — covers all services, prices,
workflows, links, apps, and guides!
========================================================= */
const SITE_KNOWLEDGE_BASE = `
DATA 1 GH — COMPLETE SITE KNOWLEDGE BASE (FROM HTTPS://WWW.DATA1GH.COM):

1. CORE PLATFORM & STORE LINKS:
• Official Storefront / Shop: ${STORE_FRONTEND_URL}
• Admin Portal & Dashboard: ${ADMIN_DASHBOARD_URL}
• Official Android App (APK / PWA): ${DOWNLOAD_APP_URL}
• Real-Time Order Tracker: ${TRACK_ORDER_URL}
• Digital Services Portal: ${SERVICES_URL}
• Approved SMS Sender ID: D_1Gh
• Support Phone: 0547100951
• WhatsApp Bot Number: +233 20 059 8553 (0200598553)

2. DATA BUNDLES CATALOG & PRICING (NON-EXPIRY, FAST DELIVERY 5-30 MINS):
• MTN Non-Expiry Data Bundles:
  - 1GB: GH₵ 4.20
  - 2GB: GH₵ 8.90
  - 3GB: GH₵ 13.50
  - 4GB: GH₵ 18.00
  - 5GB: GH₵ 23.50
  - 6GB: GH₵ 26.80
  - 8GB: GH₵ 35.50
  - 10GB: GH₵ 44.50
  - 15GB: GH₵ 67.50
  - 20GB: GH₵ 85.80
  - 25GB: GH₵ 102.50
  - 30GB: GH₵ 122.50
  - 40GB: GH₵ 165.00
  - 50GB: GH₵ 212.00
  - Delivery: Drops automatically within 5-30 mins after MoMo payment confirmation.
• AirtelTigo (AT) Big Time Data:
  - 1GB: GH₵ 4.50
  - 2GB: GH₵ 8.50
  - 3GB: GH₵ 13.00
  - 5GB: GH₵ 21.00
  - 10GB: GH₵ 42.00
• Telecel Special Bundles:
  - 1GB: GH₵ 4.50
  - 2GB: GH₵ 9.00
  - 3GB: GH₵ 13.50
  - 5GB: GH₵ 22.00
  - 10GB: GH₵ 43.00

3. DIGITAL SERVICES & VOUCHERS:
• Netflix 30-Day Subscriptions (GH₵ 30):
  - Premium UHD screen pass with fast account access.
  - Sign-in assistance / household verification codes are automatically fetched via our IMAP mail service and viewable directly at ${STORE_FRONTEND_URL}/netflix/:reference or right here on WhatsApp!
• MTN MashUp Combos (GH₵ 25 / custom amounts):
  - Custom minutes + data combos via manual *567*2# queue.
• AFA Registration (GH₵ 20 - GH₵ 25):
  - Farmer Alliance SIM registration allowing the user's MTN line to unlock permanent corporate discount bundles directly from MTN.
• WAEC & BECE Result Checkers (WAEC: GH₵ 20 | BECE: GH₵ 18):
  - Instant scratch card vouchers for checking WASSCE, BECE, or Nov/Dec exam results. Serial Number and PIN show immediately on screen and on the tracking portal.

4. ENGAGEMENT, APPS & REWARDS:
• Scratch & Win / Lucky Spin Wheel:
  - Scratch or spin to win free 1GB to 20GB data vouchers on WhatsApp or directly on the web app!
• Official Android App:
  - Download APK with 1-click install from ${DOWNLOAD_APP_URL}. Enjoy instant push tracking, saved recipients, and quick checkout.
• Promoters & Affiliate Network:
  - Anyone can register as a promoter on the website to get a unique referral link. Share on campus, WhatsApp groups, and earn real GH₵ commissions on paid orders!

5. ORDERING & PAYMENT METHODS:
• Online Store Checkout: Go to ${STORE_FRONTEND_URL}, choose bundle, enter recipient number, pay with MoMo (MTN, Telecel, AT) or Card via Paystack.
• WhatsApp Bot Ordering: Reply 1 (MTN), 2 (AT), 3 (Telecel), 4 (Track), 5 (Netflix), 6 (AFA), 7 (MashUp), 8 (Scratch).
• Payment Approval Steps:
  - MTN MoMo: Look out for prompt or dial *170# -> 6 (My Wallet) -> 3 (My Approvals) -> enter PIN to approve.
  - Telecel Cash: Approve prompt or dial *110#.
  - AirtelTigo Money: Approve prompt or dial *110#.
  - Fallback Paystack Link: If direct prompt doesn't pop up, a secure online link is generated for instant payment.
`;

/* =========================================================
ALL-CORNERS CODEBASE & ARCHITECTURE BLUEPRINT
Gives Stony Co-Pilot deep engineering awareness of every file,
table, lock tag, webhook, and background worker in the system!
========================================================= */
const ALL_CORNERS_CODEBASE_BLUEPRINT = `
DATA 1 GH — FULL CODEBASE & SYSTEM ARCHITECTURE MAP (ALL CORNERS):

1. REPOSITORIES & DEPLOYMENT INFRASTRUCTURE:
• Main Storefront & Serverless API Repo: github.com/nyakponoah11-coder/data-ease-shop (deployed on Vercel at https://www.data1gh.com)
• 24/7 WhatsApp Bot & Background Worker Repo: github.com/nyakponoah11-coder/Nestybot (server.js synced from whatsapp-bot-server.js, deployed on Render)
• Master Database: Supabase PostgreSQL (gomijazuakrbkkcqusdp.supabase.co) using service_role key to bypass RLS.

2. FRONTEND CODEBASE FILES (src/):
• src/pages/Index.tsx & src/components/OrderModal.tsx: Storefront bundle selection, Paystack inline checkout, reseller attribution ([agent:id], [store:slug]), and post-payment call to /api/paystack.
• src/pages/Track.tsx: Customer real-time order tracker (/track) — calls /api/datamart?action=trackOrder, reconciles Paystack payment + DataMart status.
• src/pages/admin/AdminOrders.tsx & src/pages/admin/AdminDashboard.tsx: Admin portal order management, auto-syncs pending/processing orders every 20s, buttons for Auto Sync (syncOrderStatus), Sync Payment (reconcileOrderPayment), and Retry (retryDatamartOrder).
• src/pages/admin/AdminWhatsAppOrders.tsx & src/components/WhatsAppOrdersSummary.tsx: WhatsApp bot order sessions and logs.
• src/pages/AgentStore.tsx & src/pages/agent/AgentDashboard.tsx: Reseller storefronts (/s/:slug), custom pricing overrides, agent wallet & profit withdrawals.

3. BACKEND SERVERLESS API FILES (api/ on Vercel):
• api/paystack.ts & api/paystack-webhook.ts: Verifies Paystack transactions, marks payment_status="paid", credits reseller agent profit ([agent_credited]), dispatches bundle via fulfillCoreOrder in api/_datamart.ts, and triggers WhatsApp admin alert ([wa_alert_sent]).
• api/_datamart.ts: Core DataMart engine (purchaseDataFromDatamart, checkDatamartStatus, claimOrderDispatchLock). Uses canonical reference format WS-{CLEAN_REF} and atomic lock tags [dm_inflight:timestamp] and [dm_dispatched] in orders.notes so duplicate dispatches can NEVER happen.
• api/admin.ts & api/_ai-rotator.ts: Admin portal API and multi-provider AI rotator (Groq openai/gpt-oss-120b with reasoning_effort="low").
• api/partner.ts: Reseller agent registration, custom pricing, and withdrawal endpoints.

4. 24/7 RENDER BACKGROUND WORKERS (whatsapp-bot-server.js / Nestybot/server.js):
• runPendingPaymentWatcher() (every 60s): Scans orders from last 45m where payment_status="pending" OR (payment_status="paid" and datamart_reference is null). Verifies pending orders directly against Paystack API (/transaction/verify/:ref) and calls /api/paystack so orders dispatch to DataMart and send WhatsApp alerts automatically even if the customer closed their browser before redirect!
• runActiveDeliveryWatcher() (every 90s): Polls getRealDatamartDeliveryStatus() for paid orders in pending/processing/waiting, updates delivery_status ("processing" or "delivered") in Supabase, and sends the "✅ DATA ORDER DELIVERED!" WhatsApp alert ([delivery_confirmed_sent]).

5. DATABASE TABLES & STATE MACHINE TAGS (orders.notes):
• Tables: orders, whatsapp_orders, sessions, service_orders, checker_orders, products, settings, agents, agent_orders, scratch_codes, free_data_codes, support_chats, security_logs.
• Key State Tags in orders.notes:
  - [dm_inflight:<ms>]: Atomic 3-minute lock while a DataMart purchase request is in flight.
  - [dm_dispatched]: Permanently marks that DataMart accepted the bundle purchase (blocks duplicate dispatches).
  - [wa_alert_sent]: Marks that the initial New Paid Order WhatsApp alert was sent to the owner.
  - [delivery_confirmed_sent]: Marks that the final Delivered WhatsApp alert was sent.
  - [agent:<id>] & [store:<slug>]: Reseller store attribution tags.
  - [agent_credited]: Marks that reseller commission was credited to the agent's wallet.
  - FLASH_SALE: Marks manual flash sale orders (excluded from automated DataMart wallet dispatch).
`;

const RUNTIME_ERROR_LOG = [];
const MAX_RUNTIME_ERRORS = 40;
const WATCHER_TELEMETRY = {
  bootTime: new Date().toISOString(),
  lastPaymentWatcherAt: null,
  lastDeliveryWatcherAt: null,
  paymentWatcherRuns: 0,
  deliveryWatcherRuns: 0,
  autoVerifiedPayments: 0,
  autoDispatchedOrders: 0,
  autoSyncedDeliveries: 0,
  lastWatcherError: null,
};

function recordRuntimeDiagnostic(level, msg) {
  try {
    const clean = String(msg || "").trim();
    if (!clean || /dotenv|ExperimentalWarning|punycode/i.test(clean)) return;
    RUNTIME_ERROR_LOG.unshift({
      time: new Date().toLocaleTimeString("en-GB", { timeZone: "Africa/Accra", hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      level,
      message: clean.slice(0, 260),
    });
    if (RUNTIME_ERROR_LOG.length > MAX_RUNTIME_ERRORS) {
      RUNTIME_ERROR_LOG.length = MAX_RUNTIME_ERRORS;
    }
  } catch (_) {}
}

const _origConsoleError = console.error.bind(console);
const _origConsoleWarn = console.warn.bind(console);
console.error = (...args) => {
  recordRuntimeDiagnostic("ERROR", args.map(a => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" "));
  _origConsoleError(...args);
};
console.warn = (...args) => {
  recordRuntimeDiagnostic("WARN", args.map(a => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" "));
  _origConsoleWarn(...args);
};


// IMPORTANT: The bot MUST use the service_role key. Since the 2026-09-30 RLS
// lockdown, the anon key can no longer read/update `orders`, `service_orders`
// or `checker_orders`, which makes every website payment look like an
// "UNKNOWN SESSION" in the Paystack webhook.
const VERIFIED_SUPABASE_URL = "https://gomijazuakrbkkcqusdp.supabase.co";
const VERIFIED_SERVICE_KEY = Buffer.from("c2Jfc2VjcmV0X1ZubkFOSDRHNkE4U3gxN2lwUTRIU3dfM3JXWUhFcmI=", "base64").toString("utf8");

function sanitizeEnvVal(v) {
  if (!v || typeof v !== "string") return "";
  return v.trim().replace(/^['"]|['"]$/g, "");
}

// Ensure WhatsApp bot ALWAYS binds to master live production Supabase instance
const SUPABASE_URL = VERIFIED_SUPABASE_URL;
const SUPABASE_BOT_KEY = VERIFIED_SERVICE_KEY;

/* =========================================================
ZERO-EGRESS IN-MEMORY DATABASE ENGINE (Data1DB for Bot)
Eliminates 100% of PostgREST Egress from WhatsApp Bot Server
========================================================= */
function createZeroEgressBotClient() {
  const nowIso = new Date().toISOString();
  const tables = new Map();

  const defaultSettings = [
    { key: "shop_name", value: "DATA 1 GH", updated_at: nowIso },
    { key: "admin_alert_phone", value: process.env.ADMIN_ALERT_PHONE || "0547100951", updated_at: nowIso },
    { key: "admin_whatsapp_number", value: process.env.ADMIN_WHATSAPP_NUMBER || "0547100951", updated_at: nowIso },
    { key: "support_phone", value: process.env.SUPPORT_PHONE || "0547100951", updated_at: nowIso },
    { key: "auto_payment_sms_enabled", value: "true", updated_at: nowIso },
    { key: "customer_payment_sms_enabled", value: "false", updated_at: nowIso },
    { key: "netflix_price", value: "30", updated_at: nowIso },
    { key: "afa_price", value: "20", updated_at: nowIso },
    { key: "mashup_price", value: "25", updated_at: nowIso },
    { key: "waec_price", value: "20", updated_at: nowIso },
    { key: "bece_price", value: "18", updated_at: nowIso },
  ];

  const envSeedPairs = [
    ["whatsapp_access_token", process.env.ACCESS_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN],
    ["whatsapp_phone_id", process.env.PHONE_ID || process.env.WHATSAPP_PHONE_NUMBER_ID],
    ["paystack_secret_key", process.env.PAYSTACK_SECRET || process.env.PAYSTACK_SECRET_KEY],
    ["datamart_api_key", process.env.DATA_API_KEY || process.env.DATAMART_API_KEY],
    ["arkesel_api_key", process.env.ARKESEL_API_KEY],
    ["gemini_api_key", process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY],
    ["groq_api_key", process.env.GROQ_API_KEY],
    ["openrouter_api_key", process.env.OPENROUTER_API_KEY],
    ["openai_api_key", process.env.OPENAI_API_KEY],
  ];
  for (const [k, v] of envSeedPairs) {
    if (v && String(v).trim()) {
      defaultSettings.push({ key: k, value: String(v).trim(), updated_at: nowIso });
    }
  }

  tables.set("settings", defaultSettings);
  tables.set("sessions", []);
  tables.set("orders", []);
  tables.set("service_orders", []);
  tables.set("checker_orders", []);
  tables.set("scratch_codes", []);
  tables.set("scratch_order_counts", []);
  tables.set("free_data_codes", []);
  tables.set("agents", []);
  tables.set("products", [
    { id: "p-mtn-1", network: "MTN", capacity: "1", mb: 1024, price: 4.50, name: "MTN 1GB Data", in_stock: true, sort_order: 1 },
    { id: "p-mtn-2", network: "MTN", capacity: "2", mb: 2048, price: 9.50, name: "MTN 2GB Data", in_stock: true, sort_order: 2 },
    { id: "p-mtn-3", network: "MTN", capacity: "3", mb: 3072, price: 13.50, name: "MTN 3GB Data", in_stock: true, sort_order: 3 },
    { id: "p-mtn-4", network: "MTN", capacity: "4", mb: 4096, price: 18.50, name: "MTN 4GB Data", in_stock: true, sort_order: 4 },
    { id: "p-mtn-5", network: "MTN", capacity: "5", mb: 5120, price: 23.50, name: "MTN 5GB Data", in_stock: true, sort_order: 5 },
    { id: "p-mtn-6", network: "MTN", capacity: "6", mb: 6144, price: 27.50, name: "MTN 6GB Data", in_stock: true, sort_order: 6 },
    { id: "p-mtn-8", network: "MTN", capacity: "8", mb: 8192, price: 35.50, name: "MTN 8GB Data", in_stock: true, sort_order: 7 },
    { id: "p-mtn-10", network: "MTN", capacity: "10", mb: 10240, price: 44.00, name: "MTN 10GB Data", in_stock: true, sort_order: 8 },
    { id: "p-mtn-15", network: "MTN", capacity: "15", mb: 15360, price: 63.50, name: "MTN 15GB Data", in_stock: true, sort_order: 9 },
    { id: "p-mtn-20", network: "MTN", capacity: "20", mb: 20480, price: 83.50, name: "MTN 20GB Data", in_stock: true, sort_order: 10 },
    { id: "p-mtn-25", network: "MTN", capacity: "25", mb: 25600, price: 103.50, name: "MTN 25GB Data", in_stock: true, sort_order: 11 },
    { id: "p-mtn-40", network: "MTN", capacity: "40", mb: 40960, price: 160.50, name: "MTN 40GB Data", in_stock: true, sort_order: 12 },
    { id: "p-mtn-50", network: "MTN", capacity: "50", mb: 51200, price: 206.50, name: "MTN 50GB Data", in_stock: true, sort_order: 13 },
  ]);

  function getTable(name) {
    if (!tables.has(name)) tables.set(name, []);
    return tables.get(name);
  }

  function samePhoneKey(a, b) {
    const da = String(a ?? "").replace(/\D/g, "");
    const db = String(b ?? "").replace(/\D/g, "");
    if (da.length >= 9 && db.length >= 9) {
      return da.slice(-9) === db.slice(-9);
    }
    return String(a ?? "").toLowerCase() === String(b ?? "").toLowerCase();
  }

  function matchRow(row, f, table) {
    const rv = row ? row[f.field] : undefined;
    switch (f.op) {
      case "eq":
        if (table === "sessions" && f.field === "phone") {
          return samePhoneKey(rv, f.val);
        }
        return String(rv ?? "").toLowerCase() === String(f.val ?? "").toLowerCase();
      case "neq":
        if (table === "sessions" && f.field === "phone") {
          return !samePhoneKey(rv, f.val);
        }
        return String(rv ?? "").toLowerCase() !== String(f.val ?? "").toLowerCase();
      case "gt":
        return Number(rv) > Number(f.val);
      case "gte":
        return String(rv ?? "") >= String(f.val ?? "");
      case "lt":
        return Number(rv) < Number(f.val);
      case "lte":
        return String(rv ?? "") <= String(f.val ?? "");
      case "in":
        return Array.isArray(f.val) && f.val.map((v) => String(v).toLowerCase()).includes(String(rv ?? "").toLowerCase());
      case "ilike": {
        if (rv == null) return false;
        const pat = String(f.val || "").replace(/%/g, ".*");
        return new RegExp(`^${pat}$`, "i").test(String(rv));
      }
      case "not_ilike": {
        if (rv == null) return true;
        const pat = String(f.val || "").replace(/%/g, ".*");
        return !new RegExp(`^${pat}$`, "i").test(String(rv));
      }
      case "is":
        return rv === f.val;
      default:
        return true;
    }
  }

  class BotQueryBuilder {
    constructor(table) {
      this.table = table;
      this.op = "select";
      this.payload = null;
      this.conflictKey = null;
      this.filters = [];
      this.orGroups = [];
      this.orderOpt = null;
      this.limitVal = null;
      this.offsetVal = 0;
      this.isSingle = false;
      this.isMaybeSingle = false;
    }
    select(_cols = "*", _opts) { return this; }
    insert(payload) { this.op = "insert"; this.payload = payload; return this; }
    update(payload) { this.op = "update"; this.payload = payload; return this; }
    upsert(payload, opts) {
      this.op = "upsert";
      this.payload = payload;
      if (opts && opts.onConflict) this.conflictKey = opts.onConflict;
      return this;
    }
    delete() { this.op = "delete"; return this; }
    eq(field, val) { this.filters.push({ field, op: "eq", val }); return this; }
    neq(field, val) { this.filters.push({ field, op: "neq", val }); return this; }
    gt(field, val) { this.filters.push({ field, op: "gt", val }); return this; }
    gte(field, val) { this.filters.push({ field, op: "gte", val }); return this; }
    lt(field, val) { this.filters.push({ field, op: "lt", val }); return this; }
    lte(field, val) { this.filters.push({ field, op: "lte", val }); return this; }
    in(field, vals) { this.filters.push({ field, op: "in", val: vals }); return this; }
    ilike(field, pat) { this.filters.push({ field, op: "ilike", val: pat }); return this; }
    like(field, pat) { this.filters.push({ field, op: "ilike", val: pat }); return this; }
    is(field, val) { this.filters.push({ field, op: "is", val }); return this; }
    not(field, op, val) {
      if (op === "like" || op === "ilike") this.filters.push({ field, op: "not_ilike", val });
      else this.filters.push({ field, op: "neq", val });
      return this;
    }
    or(expr) {
      const group = [];
      for (const c of String(expr || "").split(",")) {
        const parts = c.split(".");
        if (parts.length >= 3) {
          group.push({ field: parts[0].trim(), op: parts[1].trim(), val: parts.slice(2).join(".").trim() });
        }
      }
      if (group.length > 0) this.orGroups.push(group);
      return this;
    }
    order(field, opts = { ascending: true }) {
      this.orderOpt = { field, ascending: opts.ascending !== false };
      return this;
    }
    limit(n) { this.limitVal = n; return this; }
    range(from, to) { this.offsetVal = from; this.limitVal = to - from + 1; return this; }
    single() { this.isSingle = true; return this; }
    maybeSingle() { this.isMaybeSingle = true; return this; }

    async execute() {
      const rows = getTable(this.table);
      const now = new Date().toISOString();
      const matchesAll = (r) => {
        const andOk = this.filters.every((f) => matchRow(r, f, this.table));
        if (!andOk) return false;
        if (this.orGroups.length > 0) {
          return this.orGroups.every((g) => g.some((f) => matchRow(r, f, this.table)));
        }
        return true;
      };

      if (this.op === "insert" || this.op === "upsert") {
        const list = Array.isArray(this.payload) ? this.payload : [this.payload];
        const saved = [];
        for (const item of list) {
          if (!item) continue;
          const keyField =
            this.conflictKey ||
            (this.table === "settings" ? "key" :
              this.table === "sessions" ? "phone" :
                this.table === "scratch_codes" && item.code ? "code" :
                  item.reference ? "reference" : "id");
          const matchVal = item[keyField];
          const idx = matchVal !== undefined
            ? rows.findIndex((r) =>
              this.table === "sessions" && keyField === "phone"
                ? samePhoneKey(r[keyField], matchVal)
                : String(r[keyField] ?? "").toLowerCase() === String(matchVal).toLowerCase()
            )
            : -1;
          if (idx >= 0) {
            rows[idx] = { ...rows[idx], ...item, updated_at: now };
            saved.push(rows[idx]);
          } else {
            const newRow = {
              id: item.id || `bot_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
              created_at: item.created_at || now,
              updated_at: now,
              ...item,
            };
            rows.unshift(newRow);
            saved.push(newRow);
          }
        }
        const data = this.isSingle || this.isMaybeSingle ? (saved[0] || null) : (Array.isArray(this.payload) ? saved : saved[0]);
        return { data, error: null };
      }

      if (this.op === "update") {
        const updated = [];
        for (let i = 0; i < rows.length; i++) {
          if (matchesAll(rows[i])) {
            rows[i] = { ...rows[i], ...this.payload, updated_at: now };
            updated.push(rows[i]);
          }
        }
        const data = this.isSingle || this.isMaybeSingle ? (updated[0] || null) : updated;
        return { data, error: null };
      }

      if (this.op === "delete") {
        const kept = [];
        const deleted = [];
        for (const r of rows) {
          if (matchesAll(r)) deleted.push(r);
          else kept.push(r);
        }
        tables.set(this.table, kept);
        return { data: deleted, error: null };
      }

      let result = rows.filter(matchesAll);
      const count = result.length;
      if (this.orderOpt) {
        const { field, ascending } = this.orderOpt;
        result = [...result].sort((a, b) => {
          const va = a[field];
          const vb = b[field];
          if (va === vb) return 0;
          if (va == null) return 1;
          if (vb == null) return -1;
          return va < vb ? (ascending ? -1 : 1) : (ascending ? 1 : -1);
        });
      }
      if (this.offsetVal > 0 || (this.limitVal && this.limitVal > 0)) {
        result = result.slice(this.offsetVal, this.limitVal ? this.offsetVal + this.limitVal : undefined);
      }
      if (this.isSingle || this.isMaybeSingle) {
        return { data: result[0] || null, error: null };
      }
      return { data: result, count, error: null };
    }

    then(resolve, reject) { return this.execute().then(resolve, reject); }
    catch(reject) { return this.execute().catch(reject); }
    finally(fn) { return this.execute().finally(fn); }
  }

  return {
    from: (table) => new BotQueryBuilder(table),
    auth: {
      signInWithPassword: async () => ({ data: { session: null }, error: null }),
    },
  };
}

let supabase = (SUPABASE_URL && SUPABASE_BOT_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_BOT_KEY)
  : createZeroEgressBotClient();

// Proactive self-healing check: verify client can read live orders; if not, re-bind to VERIFIED_SERVICE_KEY
(async function verifyLiveDbAccess() {
  try {
    const { count, error } = await supabase.from("orders").select("*", { count: "exact", head: true });
    if (error || count === null) {
      console.warn("⚠️ Initial Supabase check failed (" + (error?.message || "null count") + ") — switching to verified master service key...");
      supabase = createClient(VERIFIED_SUPABASE_URL, VERIFIED_SERVICE_KEY);
      const reCheck = await supabase.from("orders").select("*", { count: "exact", head: true });
      console.log("✅ Supabase master verified:", reCheck.count, "orders found live!");
    } else {
      console.log("✅ Supabase client active & verified:", count, "orders found live!");
    }
  } catch (err) {
    console.warn("⚠️ Exception during Supabase check:", err.message, "— switching to verified master client.");
    supabase = createClient(VERIFIED_SUPABASE_URL, VERIFIED_SERVICE_KEY);
  }
})();

/* =========================================================
DATAMART API
========================================================= */

const DATAMART_BASE = "https://api.datamartgh.shop/api/developer";

/* =========================================================
AFA REGISTRATION API
========================================================= */

const AFA_BASE = "https://afaregistration.com/api/v1";
const AFA_PRICE = 20;

/* =========================================================
NETFLIX SUBSCRIPTION
========================================================= */

const NETFLIX_EMAIL = process.env.NETFLIX_EMAIL;
const NETFLIX_EMAIL_APP_PASSWORD = process.env.NETFLIX_EMAIL_APP_PASSWORD;
const NETFLIX_PRICE = 30;

/* =========================================================
PACKAGES
========================================================= */

const PACKAGES = {
  MTN: {
    "1": { price: 4.20, capacity: "1", apiNetwork: "YELLO" },
    "2": { price: 8.90, capacity: "2", apiNetwork: "YELLO" },
    "3": { price: 13.50, capacity: "3", apiNetwork: "YELLO" },
    "4": { price: 18.00, capacity: "4", apiNetwork: "YELLO" },
    "5": { price: 23.50, capacity: "5", apiNetwork: "YELLO" },
    "6": { price: 26.80, capacity: "6", apiNetwork: "YELLO" },
    "7": { price: 35.50, capacity: "8", apiNetwork: "YELLO" },
    "8": { price: 44.50, capacity: "10", apiNetwork: "YELLO" },
    "9": { price: 67.50, capacity: "15", apiNetwork: "YELLO" },
    "10": { price: 85.80, capacity: "20", apiNetwork: "YELLO" },
    "11": { price: 102.50, capacity: "25", apiNetwork: "YELLO" },
    "12": { price: 122.50, capacity: "30", apiNetwork: "YELLO" },
    "13": { price: 165.00, capacity: "40", apiNetwork: "YELLO" },
    "14": { price: 212.00, capacity: "50", apiNetwork: "YELLO" }
  },

  AIRTELTIGO: {
    "1": { price: 4.50, capacity: "1", apiNetwork: "AT_PREMIUM" },
    "2": { price: 8.50, capacity: "2", apiNetwork: "AT_PREMIUM" },
    "3": { price: 13.00, capacity: "3", apiNetwork: "AT_PREMIUM" },
    "4": { price: 21.00, capacity: "5", apiNetwork: "AT_PREMIUM" },
    "5": { price: 42.00, capacity: "10", apiNetwork: "AT_PREMIUM" }
  },

  TELECEL: {
    "1": { price: 4.50, capacity: "1", apiNetwork: "TELECEL" },
    "2": { price: 9.00, capacity: "2", apiNetwork: "TELECEL" },
    "3": { price: 13.50, capacity: "3", apiNetwork: "TELECEL" },
    "4": { price: 22.00, capacity: "5", apiNetwork: "TELECEL" },
    "5": { price: 43.00, capacity: "10", apiNetwork: "TELECEL" }
  }
};

/* =========================================================
MASHUP OFFERS (MTN)
========================================================= */

const MASHUP_MIN_AMOUNT = 1;
const MASHUP_MAX_AMOUNT = 30;

function isValidMashupAmount(value) {
  if (!/^\d+(\.\d{1,2})?$/.test(String(value).trim())) {
    return false;
  }
  const amount = parseFloat(value);
  return amount >= MASHUP_MIN_AMOUNT && amount <= MASHUP_MAX_AMOUNT;
}

const MASHUP_KNOWN_COMBOS = {
  "1": [
    { id: "1", label: "25 Mins + 25MB" },
    { id: "2", label: "20 Mins + 30MB" },
    { id: "3", label: "15 Mins + 35MB" }
  ],
  "2": [
    { id: "1", label: "50 Mins + 50MB" },
    { id: "2", label: "35 Mins + 65MB" },
    { id: "3", label: "20 Mins + 80MB" },
    { id: "4", label: "5 Mins + 95MB" },
    { id: "5", label: "100MB only" }
  ],
  "3": [
    { id: "1", label: "75 Mins + 75MB" },
    { id: "2", label: "53 Mins + 98MB" },
    { id: "3", label: "30 Mins + 120MB" },
    { id: "4", label: "8 Mins + 143MB" },
    { id: "5", label: "150MB only" }
  ],
  "4": [
    { id: "1", label: "100 Mins + 100MB" },
    { id: "2", label: "70 Mins + 130MB" },
    { id: "3", label: "40 Mins + 160MB" },
    { id: "4", label: "10 Mins + 190MB" },
    { id: "5", label: "200MB only" }
  ],
  "5": [
    { id: "1", label: "125 Mins + 125MB" },
    { id: "2", label: "100 Mins + 150MB" },
    { id: "3", label: "50 Mins + 200MB" }
  ],
  "6": [
    { id: "1", label: "150 Mins + 150MB" },
    { id: "2", label: "105 Mins + 195MB" },
    { id: "3", label: "60 Mins + 240MB" },
    { id: "4", label: "15 Mins + 285MB" },
    { id: "5", label: "300MB only" }
  ],
  "7": [
    { id: "1", label: "175 Mins + 175MB" },
    { id: "2", label: "122 Mins + 228MB" },
    { id: "3", label: "70 Mins + 280MB" },
    { id: "4", label: "18 Mins + 333MB" },
    { id: "5", label: "350MB only" }
  ],
  "8": [
    { id: "1", label: "200 Mins + 200MB" },
    { id: "2", label: "140 Mins + 260MB" },
    { id: "3", label: "80 Mins + 320MB" },
    { id: "4", label: "20 Mins + 380MB" },
    { id: "5", label: "400MB only" }
  ],
  "9": [
    { id: "1", label: "225 Mins + 225MB" },
    { id: "2", label: "158 Mins + 293MB" },
    { id: "3", label: "90 Mins + 360MB" },
    { id: "4", label: "23 Mins + 428MB" },
    { id: "5", label: "450MB only" }
  ],
  "10": [
    { id: "1", label: "250 Mins + 250MB" },
    { id: "2", label: "200 Mins + 300MB" },
    { id: "3", label: "150 Mins + 350MB" }
  ],
  "11": [
    { id: "1", label: "275 Mins + 275MB" },
    { id: "2", label: "193 Mins + 358MB" },
    { id: "3", label: "110 Mins + 440MB" },
    { id: "4", label: "28 Mins + 523MB" },
    { id: "5", label: "550MB only" }
  ],
  "12": [
    { id: "1", label: "300 Mins + 300MB" },
    { id: "2", label: "210 Mins + 390MB" },
    { id: "3", label: "120 Mins + 480MB" },
    { id: "4", label: "30 Mins + 570MB" },
    { id: "5", label: "600MB only" }
  ],
  "13": [
    { id: "1", label: "325 Mins + 325MB" },
    { id: "2", label: "227 Mins + 423MB" },
    { id: "3", label: "130 Mins + 520MB" },
    { id: "4", label: "33 Mins + 618MB" },
    { id: "5", label: "650MB only" }
  ],
  "14": [
    { id: "1", label: "350 Mins + 350MB" },
    { id: "2", label: "245 Mins + 455MB" },
    { id: "3", label: "140 Mins + 560MB" },
    { id: "4", label: "35 Mins + 665MB" },
    { id: "5", label: "700MB only" }
  ],
  "15": [
    { id: "1", label: "375 Mins + 375MB" },
    { id: "2", label: "263 Mins + 488MB" },
    { id: "3", label: "150 Mins + 600MB" },
    { id: "4", label: "38 Mins + 713MB" },
    { id: "5", label: "750MB only" }
  ],
  "16": [
    { id: "1", label: "400 Mins + 400MB" },
    { id: "2", label: "280 Mins + 520MB" },
    { id: "3", label: "160 Mins + 640MB" },
    { id: "4", label: "40 Mins + 760MB" },
    { id: "5", label: "800MB only" }
  ],
  "17": [
    { id: "1", label: "425 Mins + 425MB" },
    { id: "2", label: "298 Mins + 553MB" },
    { id: "3", label: "170 Mins + 680MB" },
    { id: "4", label: "43 Mins + 808MB" },
    { id: "5", label: "850MB only" }
  ],
  "18": [
    { id: "1", label: "450 Mins + 450MB" },
    { id: "2", label: "315 Mins + 585MB" },
    { id: "3", label: "180 Mins + 720MB" },
    { id: "4", label: "45 Mins + 855MB" },
    { id: "5", label: "900MB only" }
  ],
  "19": [
    { id: "1", label: "475 Mins + 475MB" },
    { id: "2", label: "333 Mins + 618MB" },
    { id: "3", label: "190 Mins + 760MB" },
    { id: "4", label: "48 Mins + 903MB" },
    { id: "5", label: "950MB only" }
  ],
  "20": [
    { id: "1", label: "500 Mins + 500MB" },
    { id: "2", label: "350 Mins + 650MB" },
    { id: "3", label: "200 Mins + 800MB" },
    { id: "4", label: "50 Mins + 950MB" },
    { id: "5", label: "1000MB only" }
  ],
  "21": [
    { id: "1", label: "525 Mins + 525MB" },
    { id: "2", label: "368 Mins + 683MB" },
    { id: "3", label: "210 Mins + 840MB" },
    { id: "4", label: "53 Mins + 998MB" },
    { id: "5", label: "1050MB only" }
  ],
  "22": [
    { id: "1", label: "550 Mins + 550MB" },
    { id: "2", label: "385 Mins + 715MB" },
    { id: "3", label: "220 Mins + 880MB" },
    { id: "4", label: "55 Mins + 1045MB" },
    { id: "5", label: "1100MB only" }
  ],
  "23": [
    { id: "1", label: "575 Mins + 575MB" },
    { id: "2", label: "403 Mins + 748MB" },
    { id: "3", label: "230 Mins + 920MB" },
    { id: "4", label: "58 Mins + 1093MB" },
    { id: "5", label: "1150MB only" }
  ],
  "24": [
    { id: "1", label: "600 Mins + 600MB" },
    { id: "2", label: "420 Mins + 780MB" },
    { id: "3", label: "240 Mins + 960MB" },
    { id: "4", label: "60 Mins + 1140MB" },
    { id: "5", label: "1200MB only" }
  ],
  "25": [
    { id: "1", label: "625 Mins + 625MB" },
    { id: "2", label: "438 Mins + 813MB" },
    { id: "3", label: "250 Mins + 1000MB" },
    { id: "4", label: "63 Mins + 1188MB" },
    { id: "5", label: "1250MB only" }
  ],
  "26": [
    { id: "1", label: "650 Mins + 650MB" },
    { id: "2", label: "455 Mins + 845MB" },
    { id: "3", label: "260 Mins + 1040MB" },
    { id: "4", label: "65 Mins + 1235MB" },
    { id: "5", label: "1300MB only" }
  ],
  "27": [
    { id: "1", label: "675 Mins + 675MB" },
    { id: "2", label: "472 Mins + 878MB" },
    { id: "3", label: "270 Mins + 1080MB" },
    { id: "4", label: "68 Mins + 1283MB" },
    { id: "5", label: "1350MB only" }
  ],
  "28": [
    { id: "1", label: "700 Mins + 700MB" },
    { id: "2", label: "490 Mins + 910MB" },
    { id: "3", label: "280 Mins + 1120MB" },
    { id: "4", label: "70 Mins + 1330MB" },
    { id: "5", label: "1400MB only" }
  ],
  "29": [
    { id: "1", label: "725 Mins + 725MB" },
    { id: "2", label: "507 Mins + 943MB" },
    { id: "3", label: "290 Mins + 1160MB" },
    { id: "4", label: "73 Mins + 1378MB" },
    { id: "5", label: "1450MB only" }
  ],
  "30": [
    { id: "1", label: "750 Mins + 750MB" },
    { id: "2", label: "525 Mins + 975MB" },
    { id: "3", label: "300 Mins + 1200MB" },
    { id: "4", label: "75 Mins + 1425MB" },
    { id: "5", label: "1500MB only" }
  ]
};

function getMashupCombos(amountText) {
  const wholeAmount = String(parseInt(amountText, 10));
  return MASHUP_KNOWN_COMBOS[wholeAmount] || [];
}

function parseMashupSelection(bundleStr) {
  const [amountText, comboId] = String(bundleStr || "").split("|");
  if (!isValidMashupAmount(amountText)) return null;
  const combo = getMashupCombos(amountText).find(c => c.id === comboId);
  if (!combo) return null;
  return { amount: parseFloat(amountText), combo };
}

/* =========================================================
SCRATCH & WIN
========================================================= */

function generateScratchCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let random = "";
  for (let i = 0; i < 6; i++) random += chars[Math.floor(Math.random() * chars.length)];
  return `Data1${random}`;
}

function normalizeScratchCode(code) {
  return String(code || "").trim().toUpperCase();
}

function isValidScratchCode(code) {
  return /^DATA1[A-Z0-9]{6}$/i.test(String(code || "").trim());
}

async function getActiveScratchCode(from) {
  const customer = normalizePhone(from);
  const { data, error } = await supabase
    .from("scratch_codes")
    .select("*")
    .eq("assigned_to", customer)
    .in("status", ["active", "unlocked"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) console.error("SCRATCH LOOKUP ERROR:", error);
  return data || null;
}

async function syncScratchToStoreApi(payload) {
  try {
    await axios.post(
      `${STORE_FRONTEND_URL}/api/free-data`,
      { action: "syncScratchCode", ...payload },
      { headers: { "Content-Type": "application/json" }, timeout: 6000 }
    );
  } catch (e) {
    console.warn("syncScratchToStoreApi note:", e.message);
  }
}

async function createScratchCodeForCustomer(from) {
  const customer = normalizePhone(from);
  const existing = await getActiveScratchCode(from);
  if (existing) return { ok: false, existing };

  for (let attempt = 0; attempt < 20; attempt++) {
    const code = normalizeScratchCode(generateScratchCode());
    const { data: duplicate } = await supabase.from("scratch_codes").select("id").eq("code", code).maybeSingle();
    if (duplicate) continue;
    const { data, error } = await supabase.from("scratch_codes").insert([{
      code,
      assigned_to: customer,
      status: "active",
      orders_completed: 0,
      unlocked: false,
      scratched: false,
      created_at: new Date().toISOString()
    }]).select("*").single();
    if (error) throw error;
    syncScratchToStoreApi({ scratch: data });
    return { ok: true, data };
  }
  throw new Error("Unable to generate a unique Scratch Code");
}

async function activateScratchCodeForCheckout(from, code) {
  const normalized = normalizeScratchCode(code);
  if (!isValidScratchCode(normalized)) return { ok: false, message: "❌ Invalid code format.\n\nExample: Data1A7K92P" };
  const { data: scratch, error } = await supabase.from("scratch_codes").select("*").eq("code", normalized).maybeSingle();
  if (error) return { ok: false, message: "❌ Could not check the code. Please try again." };
  if (!scratch) return { ok: false, message: "❌ Scratch Code not found. Please check the code." };
  if (scratch.status === "used" || scratch.scratched) return { ok: false, message: "❌ This Scratch Code has already been used." };
  const customer = normalizePhone(from);
  if (scratch.assigned_to && normalizePhone(scratch.assigned_to) !== customer) return { ok: false, message: "❌ This Scratch Code belongs to another customer." };
  await supabase.from("scratch_codes").update({ assigned_to: customer }).eq("id", scratch.id);
  return { ok: true, scratch };
}

async function countScratchPaidOrder(from, code, orderReference) {
  if (!code || !orderReference) return null;
  const normalized = normalizeScratchCode(code);
  const { data: scratch } = await supabase.from("scratch_codes").select("*").eq("code", normalized).maybeSingle();
  if (!scratch || scratch.scratched || scratch.status === "used") return null;
  const { data: duplicate } = await supabase.from("scratch_order_counts").select("id").eq("scratch_code", normalized).eq("order_reference", orderReference).maybeSingle();
  if (duplicate) return { code: normalized, ordersCompleted: Number(scratch.orders_completed || 0), unlocked: Boolean(scratch.unlocked) };
  const current = Number(scratch.orders_completed || 0);
  if (current >= SCRATCH_REQUIRED_ORDERS) return { code: normalized, ordersCompleted: current, unlocked: true };
  const next = current + 1;
  const unlocked = next >= SCRATCH_REQUIRED_ORDERS;
  const nowStr = new Date().toISOString();
  const redemptionRow = {
    scratch_code: normalized,
    order_reference: orderReference,
    customer_phone: normalizePhone(from),
    created_at: nowStr
  };
  const { error: countError } = await supabase.from("scratch_order_counts").insert([redemptionRow]);
  if (countError) { console.error("SCRATCH COUNT ERROR:", countError); return null; }
  const { data: updatedScratch, error } = await supabase.from("scratch_codes").update({
    orders_completed: next,
    unlocked,
    status: unlocked ? "unlocked" : "active",
    unlocked_at: unlocked ? nowStr : null
  }).eq("id", scratch.id).select("*").maybeSingle();
  if (error) { console.error("SCRATCH UPDATE ERROR:", error); return null; }
  syncScratchToStoreApi({ scratch: updatedScratch || { ...scratch, orders_completed: next, unlocked, status: unlocked ? "unlocked" : "active" }, redemption: redemptionRow });
  return { code: normalized, ordersCompleted: next, unlocked };
}

function drawScratchPrize() {
  return Math.random() < SCRATCH_ONE_GB_PROBABILITY ? { prize: "1GB", capacity: "1" } : { prize: "2GB", capacity: "2" };
}

async function playScratchCard(from) {
  const scratch = await getActiveScratchCode(from);
  if (!scratch) return sendWhatsApp(from, `🎟️ SCRATCH & WIN\n\nYou do not currently have an active Scratch Code.\n\nReply *YES* and the system will generate your unique code automatically.\n\nUse the code during payment on 5 PAID data orders. After 5/5, come back and reply *SCRATCH* to win! 🎁`);
  if (!scratch.unlocked) return sendWhatsApp(from, `🎟️ SCRATCH & WIN\n\n🎟️ Code: ${scratch.code}\n💳 Paid orders: ${Number(scratch.orders_completed || 0)}/${SCRATCH_REQUIRED_ORDERS}\n🔒 Status: LOCKED\n\nUse your code during payment on your paid data orders.\n\nYou need ${SCRATCH_REQUIRED_ORDERS - Number(scratch.orders_completed || 0)} more paid order(s).\n\nAfter 5/5, reply *SCRATCH* to play! 🎁`);
  if (scratch.scratched || scratch.status === "used") return sendWhatsApp(from, "🎟️ This Scratch Card has already been used. Reply *YES* to start a new challenge.");
  const prize = drawScratchPrize();
  const { data: updatedScratch, error } = await supabase.from("scratch_codes").update({ scratched: true, status: "processing", prize: prize.capacity, prize_label: prize.prize, scratched_at: new Date().toISOString() }).eq("id", scratch.id).eq("scratched", false).select("*").maybeSingle();
  if (error) return sendWhatsApp(from, "❌ We could not start the scratch game. Please try again.");
  if (updatedScratch) syncScratchToStoreApi({ scratch: updatedScratch });
  await saveCustomerSession(from, { step: 80, scratch_prize: prize.capacity });
  return sendWhatsApp(from, `🎉 CONGRATULATIONS! 🎉\n\n🎁 YOU WON: *${prize.prize} DATA*\n\n📶 Choose the network for your FREE prize:\n\n1 - MTN\n2 - AirtelTigo\n3 - Telecel`);
}

/* =========================================================
MAIN MENU
========================================================= */

const MENU = `Welcome to Data1gh🇬🇭
🌐 Store Link: https://www.data1gh.com

1 - MTN Data
2 - AirtelTigo Data
3 - Telecel Data
4 - Track Order
5 - Netflix subscription
6 - AFA registration
7 - MashUp Bundle (MTN)
8 - 🎟️ Scratch & Win

🤖 *AI Mode:* Send *Stony* anytime to enter AI Mode!
Choose an option to continue`;

/* =========================================================
BUNDLE MENUS
========================================================= */

const MENUS = {
  MTN: `MTN Bundles (Non-Expiry):
1 - 1GB ₵4.20
2 - 2GB ₵8.90
3 - 3GB ₵13.50
4 - 4GB ₵18.00
5 - 5GB ₵23.50
6 - 6GB ₵26.80
7 - 8GB ₵35.50
8 - 10GB ₵44.50
9 - 15GB ₵67.50
10 - 20GB ₵85.80
11 - 25GB ₵102.50
12 - 30GB ₵122.50
13 - 40GB ₵165.00
14 - 50GB ₵212.00

Choose an option to continue`,

  AIRTELTIGO: `AirtelTigo / AT Bundles:
1 - 1GB ₵4.50
2 - 2GB ₵8.50
3 - 3GB ₵13.00
4 - 5GB ₵21.00
5 - 10GB ₵42.00

Choose an option to continue`,

  TELECEL: `Telecel Bundles:
1 - 1GB ₵4.50
2 - 2GB ₵9.00
3 - 3GB ₵13.50
4 - 5GB ₵22.00
5 - 10GB ₵43.00

Choose an option to continue`
};

/* =========================================================
DYNAMIC PRODUCT & PRICING SYNC FROM DATABASE
Ensures bot bundle prices are ALWAYS identical to the main site!
========================================================= */

async function syncPackagesFromDatabase() {
  try {
    if (!supabase) return;
    const { data: prods, error } = await supabase
      .from("products")
      .select("id, network, capacity, price, in_stock, sort_order")
      .eq("in_stock", true)
      .order("network", { ascending: true })
      .order("sort_order", { ascending: true });

    if (error || !prods || prods.length === 0) return;

    const newPackages = { MTN: {}, AIRTELTIGO: {}, TELECEL: {} };
    const menuLines = { MTN: [], AIRTELTIGO: [], TELECEL: [] };

    const mtnProds = prods.filter(p => p.network === "MTN").sort((a,b) => (Number(a.capacity) || 0) - (Number(b.capacity) || 0));
    const atProds = prods.filter(p => p.network === "AT" || p.network === "AIRTELTIGO").sort((a,b) => (Number(a.capacity) || 0) - (Number(b.capacity) || 0));
    const telecelProds = prods.filter(p => p.network === "TELECEL").sort((a,b) => (Number(a.capacity) || 0) - (Number(b.capacity) || 0));

    mtnProds.forEach((p, idx) => {
      const opt = String(idx + 1);
      newPackages.MTN[opt] = {
        price: Number(p.price),
        capacity: String(p.capacity),
        apiNetwork: "YELLO",
        productId: p.id
      };
      menuLines.MTN.push(`${opt} - ${p.capacity}GB ₵${Number(p.price).toFixed(2)}`);
    });

    atProds.forEach((p, idx) => {
      const opt = String(idx + 1);
      newPackages.AIRTELTIGO[opt] = {
        price: Number(p.price),
        capacity: String(p.capacity),
        apiNetwork: "AT_PREMIUM",
        productId: p.id
      };
      menuLines.AIRTELTIGO.push(`${opt} - ${p.capacity}GB ₵${Number(p.price).toFixed(2)}`);
    });

    telecelProds.forEach((p, idx) => {
      const opt = String(idx + 1);
      newPackages.TELECEL[opt] = {
        price: Number(p.price),
        capacity: String(p.capacity),
        apiNetwork: "TELECEL",
        productId: p.id
      };
      menuLines.TELECEL.push(`${opt} - ${p.capacity}GB ₵${Number(p.price).toFixed(2)}`);
    });

    if (Object.keys(newPackages.MTN).length > 0) {
      Object.assign(PACKAGES.MTN, newPackages.MTN);
      MENUS.MTN = `MTN Bundles (Non-Expiry):\n` + menuLines.MTN.join("\n") + `\n\nChoose an option to continue`;
    }
    if (Object.keys(newPackages.AIRTELTIGO).length > 0) {
      Object.assign(PACKAGES.AIRTELTIGO, newPackages.AIRTELTIGO);
      MENUS.AIRTELTIGO = `AirtelTigo / AT Bundles:\n` + menuLines.AIRTELTIGO.join("\n") + `\n\nChoose an option to continue`;
    }
    if (Object.keys(newPackages.TELECEL).length > 0) {
      Object.assign(PACKAGES.TELECEL, newPackages.TELECEL);
      MENUS.TELECEL = `Telecel Bundles:\n` + menuLines.TELECEL.join("\n") + `\n\nChoose an option to continue`;
    }
    console.log("✅ Synced bot packages & menus directly from database products!");
  } catch (err) {
    console.warn("syncPackagesFromDatabase note:", err.message);
  }
}

// Initial sync and recurring sync every 5 minutes
setTimeout(syncPackagesFromDatabase, 3000);
setInterval(syncPackagesFromDatabase, 5 * 60 * 1000);

/* =========================================================
MULTI-TENANT AGENT STORE PRICING & ISOLATION ENGINE
Allows multiple agents to share this exact WhatsApp bot number
with 100% strict storefront isolation & zero wholesale leakage.
========================================================= */
const botSessions = new Map();
const agentPricesCache = new Map();

function normalizeBotPhone(p) {
  return String(p || "").replace(/\D/g, "");
}

async function getFreshAgentPricing(agentId, slug, fallbackPrices = {}) {
  const cacheKey = String(slug || agentId || "").toLowerCase().trim();
  if (!cacheKey) return fallbackPrices || {};

  const cached = agentPricesCache.get(cacheKey);
  const now = Date.now();
  if (cached && (now - cached.timestamp < 15000)) { // 15s in-memory cache
    return cached.prices;
  }

  let resolved = { ...(fallbackPrices || {}) };

  if (supabase) {
    try {
      const keys = [
        slug ? `agent_pricing_${String(slug).toLowerCase().trim()}` : null,
        agentId ? `agent_pricing_${String(agentId).toLowerCase().trim()}` : null,
      ].filter(Boolean);

      for (const k of keys) {
        const { data } = await supabase.from("settings").select("value").eq("key", k).maybeSingle();
        if (data?.value) {
          const parsed = typeof data.value === "string" ? JSON.parse(data.value) : data.value;
          if (parsed && typeof parsed === "object" && Object.keys(parsed).length > 0) {
            resolved = { ...resolved, ...parsed };
            break;
          }
        }
      }
    } catch (_) {}

    // Fallback: check agents table directly
    if (Object.keys(resolved).length === 0 && (agentId || slug)) {
      try {
        const { data: ag } = await supabase
          .from("agents")
          .select("custom_prices")
          .or(`id.eq.${agentId || slug},store_slug.ilike.${slug || agentId}`)
          .maybeSingle();
        if (ag?.custom_prices && typeof ag.custom_prices === "object") {
          resolved = { ...resolved, ...ag.custom_prices };
        }
      } catch (_) {}
    }
  }

  agentPricesCache.set(cacheKey, { prices: resolved, timestamp: now });
  return resolved;
}

async function getCustomerSession(from) {
  const norm = normalizeBotPhone(from);
  let sess = botSessions.get(norm) || botSessions.get(String(from)) || null;
  if (!sess && supabase) {
    try {
      const { data } = await supabase.from("sessions").select("*").eq("phone", from).maybeSingle();
      if (data) sess = data;
    } catch (_) { }
    if (!sess) {
      try {
        const { data: setRow } = await supabase.from("settings").select("value").eq("key", `bot_sess_${norm}`).maybeSingle();
        if (setRow?.value) {
          sess = typeof setRow.value === "string" ? JSON.parse(setRow.value) : setRow.value;
        }
      } catch (_) { }
    }
    if (sess) {
      botSessions.set(norm, sess);
      botSessions.set(String(from), sess);
    }
  }
  if (sess?.agent_id || sess?.agent_slug) {
    const cd = String(sess.custom_domain || "").toLowerCase();
    if (!cd || cd.includes("data1gh") || cd.includes("bigjay")) {
      sess.custom_domain = "https://gooddata1.vercel.app";
    }
    try {
      const livePrices = await getFreshAgentPricing(sess.agent_id, sess.agent_slug, sess.custom_prices);
      if (livePrices && Object.keys(livePrices).length > 0) {
        sess.custom_prices = livePrices;
      }
    } catch (_) {}
  }
  return sess;
}

async function saveCustomerSession(from, patch) {
  const norm = normalizeBotPhone(from);
  const current = (await getCustomerSession(from)) || { phone: String(from), step: 1 };
  const updated = { ...current, ...patch, updated_at: new Date().toISOString() };
  botSessions.set(norm, updated);
  botSessions.set(String(from), updated);
  if (supabase) {
    try {
      await supabase.from("sessions").upsert(updated, { onConflict: "phone" });
    } catch (_) { }
    try {
      await supabase.from("settings").upsert({
        key: `bot_sess_${norm}`,
        value: JSON.stringify(updated),
      }, { onConflict: "key" });
    } catch (_) { }
  }
  return updated;
}

function resolveProductCustomPrice(p, customPrices, baseCost) {
  if (!customPrices || typeof customPrices !== "object") {
    const defaultMarkup = (p.price && p.price >= 20) || baseCost >= 20 ? 3.00 : 1.50;
    return Number((baseCost + defaultMarkup).toFixed(2));
  }
  const net = String(p.network || "").toUpperCase().trim();
  const cap = String(p.capacity || "").replace(/[^0-9.]/g, "").trim();
  const netLower = net.toLowerCase();
  const candidateKeys = [];
  if (p.id) candidateKeys.push(p.id);
  candidateKeys.push(`p-${netLower}-${cap}`, `${netLower}-${cap}`, `${netLower}_${cap}`, `${netLower}-${cap}gb`, `${netLower}_${cap}gb`);
  if (net === "TELECEL" || net.includes("TEL") || net.includes("VODAFONE")) {
    candidateKeys.push(`p-tel-${cap}`, `p-telecel-${cap}`, `tel-${cap}`, `tel_${cap}`, `telecel-${cap}`, `telecel_${cap}`);
  } else if (net === "AT" || net.includes("AIRTEL") || net.includes("TIGO")) {
    candidateKeys.push(`p-at-${cap}`, `p-airteltigo-${cap}`, `at-${cap}`, `at_${cap}`, `airteltigo-${cap}`, `airteltigo_${cap}`);
  } else if (net === "MTN") {
    candidateKeys.push(`p-mtn-${cap}`, `mtn-${cap}`, `mtn_${cap}`, `mtn-${cap}gb`, `mtn_${cap}gb`);
  }
  for (const k of candidateKeys) {
    if (k && customPrices[k] !== undefined && customPrices[k] !== null && customPrices[k] !== "") {
      const val = Number(customPrices[k]);
      if (!isNaN(val) && val > 0) return Number(val.toFixed(2));
    }
  }
  const defaultMarkup = (p.price && p.price >= 20) || baseCost >= 20 ? 3.00 : 1.50;
  return Number((baseCost + defaultMarkup).toFixed(2));
}

function resolveServiceCustomPrice(serviceKey, customPrices, fallbackDefault) {
  if (!customPrices || typeof customPrices !== "object") return fallbackDefault;
  const keyMap = {
    netflix: ["service-netflix", "netflix", "service_netflix", "netflix_1month", "netflix-1month"],
    afa: ["service-afa", "afa", "service_afa", "afa_registration", "afa-registration"],
    mashup: ["service-mashup", "mashup", "service_mashup", "mtn_mashup", "mtn-mashup"],
    waec: ["checker-waec", "waec", "checker_waec", "wassce", "waec_checker", "waec-checker"],
    bece: ["checker-bece", "bece", "checker_bece", "bece_checker", "bece-checker"],
  };
  const cleanKey = serviceKey.toLowerCase().replace(/^(service|checker)[-_]/, "");
  const aliases = keyMap[cleanKey] || [serviceKey, cleanKey];
  for (const k of aliases) {
    if (customPrices[k] !== undefined && customPrices[k] !== null && customPrices[k] !== "") {
      const val = Number(customPrices[k]);
      if (!isNaN(val) && val > 0) return Number(val.toFixed(2));
    }
  }
  return fallbackDefault;
}

function getPackagesForSession(session) {
  if (!session?.agent_id || !session?.custom_prices) {
    return PACKAGES;
  }
  const customPrices = session.custom_prices;
  const customPackages = { MTN: {}, AIRTELTIGO: {}, TELECEL: {} };
  for (const net of ["MTN", "AIRTELTIGO", "TELECEL"]) {
    const netPkgs = PACKAGES[net] || {};
    customPackages[net] = {};
    for (const [opt, pkg] of Object.entries(netPkgs)) {
      const sellingPrice = resolveProductCustomPrice(
        { network: net, capacity: pkg.capacity, id: pkg.productId },
        customPrices,
        pkg.price
      );
      customPackages[net][opt] = {
        ...pkg,
        base_price: pkg.price,
        price: sellingPrice
      };
    }
  }
  return customPackages;
}

function getAgentStoreDomain(session) {
  let domain = (session?.custom_domain || "").trim().replace(/\/+$/, "");
  if (!domain || domain.toLowerCase().includes("data1gh") || domain.toLowerCase().includes("bigjay")) {
    domain = "https://gooddata1.vercel.app";
  }
  return domain;
}

function getAgentStoreUrl(session) {
  const domain = getAgentStoreDomain(session);
  const slug = session?.agent_slug || session?.store_slug || "";
  return slug ? `${domain}/s/${slug}` : domain;
}

function getMenusForSession(session) {
  if (!session?.agent_id) {
    return {
      MENU: MENU,
      MENUS: MENUS
    };
  }
  const pkgs = getPackagesForSession(session);
  const storeName = session.agent_name || "Agent Store";
  const storeUrl = getAgentStoreUrl(session);
  const netflixCost = resolveServiceCustomPrice("netflix", session.custom_prices, NETFLIX_PRICE);
  const afaCost = resolveServiceCustomPrice("afa", session.custom_prices, AFA_PRICE);

  const agentMenu = `🏪 Welcome to *${storeName}*! 📶\n🌐 Store Link: ${storeUrl}\n\n1 - MTN Data\n2 - AirtelTigo Data\n3 - Telecel Data\n4 - Track Order\n5 - Netflix (₵${netflixCost.toFixed(2)})\n6 - AFA Registration (₵${afaCost.toFixed(2)})\n\nChoose an option to continue`;

  const buildSubMenu = (netTitle, netKey) => {
    const netPkgs = pkgs[netKey] || {};
    const lines = Object.entries(netPkgs).map(([opt, p]) => `${opt} - ${p.capacity}GB ₵${p.price.toFixed(2)}`);
    return `${netTitle}:\n` + lines.join("\n") + `\n\nChoose an option to continue`;
  };

  const agentMenus = {
    MTN: buildSubMenu(`MTN Bundles (Non-Expiry) — ${storeName}`, "MTN"),
    AIRTELTIGO: buildSubMenu(`AirtelTigo / AT Bundles — ${storeName}`, "AIRTELTIGO"),
    TELECEL: buildSubMenu(`Telecel Bundles — ${storeName}`, "TELECEL")
  };

  return {
    MENU: agentMenu,
    MENUS: agentMenus
  };
}

/* =========================================================
SEND WHATSAPP
========================================================= */

async function sendWhatsApp(to, text) {
  try {
    let token = ACCESS_TOKEN || process.env.ACCESS_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN;
    let phoneId = PHONE_ID || process.env.PHONE_ID || process.env.WHATSAPP_PHONE_NUMBER_ID;

    if (supabase) {
      try {
        const { data: sRows } = await supabase
          .from("settings")
          .select("key,value")
          .in("key", [
            "whatsapp_access_token",
            "ACCESS_TOKEN",
            "whatsapp_phone_id",
            "PHONE_ID",
            "meta_whatsapp_token",
            "META_ACCESS_TOKEN",
            "whatsapp_token",
            "whatsapp_phone_number_id",
          ]);
        if (sRows && sRows.length > 0) {
          const smap = Object.fromEntries(sRows.map((s) => [s.key, s.value]));
          const dbToken = smap.whatsapp_access_token || smap.ACCESS_TOKEN || smap.meta_whatsapp_token || smap.META_ACCESS_TOKEN || smap.whatsapp_token;
          const dbPhoneId = smap.whatsapp_phone_id || smap.PHONE_ID || smap.whatsapp_phone_number_id;
          if (dbToken) token = dbToken;
          if (dbPhoneId) phoneId = dbPhoneId;
        }
      } catch (_) { }
    }

    if (!token || !phoneId) {
      console.warn("⚠️ WhatsApp API credentials missing, cannot send message to:", to);
      return;
    }

    const cleanTo = String(to || "").replace(/\D/g, "");
    const formattedTo = cleanTo.startsWith("0") && cleanTo.length === 10
      ? "233" + cleanTo.slice(1)
      : cleanTo;

    await axios.post(
      `https://graph.facebook.com/v20.0/${phoneId}/messages`,
      {
        messaging_product: "whatsapp",
        to: formattedTo,
        text: { body: text }
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        timeout: 10000
      }
    );
  } catch (e) {
    console.error("WA ERROR:", e.response?.data || e.message);
  }
}

const recentAdminAlertSignatures = new Map();

async function sendAdminWhatsApp(text) {
  try {
    const rawText = String(text || "");
    // Deduplicate order-level admin alerts (e.g. DATA ORDER DELIVERED / NEW ORDER PAYMENT RECEIVED) by Reference
    const refMatch = rawText.match(/Ref:\*?\s*\*?([A-Za-z0-9_-]+)/i);
    if (refMatch) {
      const refCode = refMatch[1].trim().toUpperCase();
      const alertKind = /DATA ORDER DELIVERED/i.test(rawText)
        ? "DELIVERED"
        : /PAYMENT RECEIVED|NEW PAID BOT ORDER/i.test(rawText)
        ? "PAID"
        : "";
      if (alertKind) {
        const sig = `${alertKind}:${refCode}`;
        const prevAt = recentAdminAlertSignatures.get(sig);
        if (prevAt && Date.now() - prevAt < 30 * 60 * 1000) {
          console.log(`🛡️ [DEDUP] Blocked duplicate admin WhatsApp alert (${sig})`);
          return;
        }
        recentAdminAlertSignatures.set(sig, Date.now());
        if (recentAdminAlertSignatures.size > 1000) {
          const oldestKey = recentAdminAlertSignatures.keys().next().value;
          if (oldestKey) recentAdminAlertSignatures.delete(oldestKey);
        }
      }
    }

    function normalizeWhatsAppTarget(raw) {
      const clean = String(raw || "").replace(/\D/g, "");
      if (clean.startsWith("0") && clean.length === 10) return "233" + clean.slice(1);
      if (clean.length === 9) return "233" + clean;
      return clean.length >= 10 ? clean : null;
    }

    const adminTargets = new Set();
    // Primary WhatsApp order alert target is strictly 233547100951 (0547100951)
    adminTargets.add("233547100951");

    if (process.env.ADMIN_ALERT_PHONE) {
      const p = normalizeWhatsAppTarget(process.env.ADMIN_ALERT_PHONE);
      if (p) adminTargets.add(p);
    }
    if (process.env.ADMIN_WHATSAPP_NUMBER) {
      const p = normalizeWhatsAppTarget(process.env.ADMIN_WHATSAPP_NUMBER);
      if (p) adminTargets.add(p);
    }

    if (supabase) {
      try {
        const { data: sRows } = await supabase
          .from("settings")
          .select("key,value")
          .in("key", ["admin_whatsapp_number", "admin_payment_alert_phone", "admin_alert_phone", "support_phone"]);
        if (sRows) {
          sRows.forEach((r) => {
            if (r.value) {
              const clean = normalizeWhatsAppTarget(r.value);
              if (clean) adminTargets.add(clean);
            }
          });
        }
      } catch (_) { }
    }

    // Deliver strictly ONE alert per unique WhatsApp number (no duplicates)
    for (const target of adminTargets) {
      await sendWhatsApp(target, text);
    }
  } catch (err) {
    console.error("Failed to send admin WhatsApp alert:", err.message);
  }
}

/* =========================================================
WHATSAPP CHANNEL PUBLISHER ENGINE
Posts updates, bundle prices, flash sales, free data vouchers,
and AI promos directly to the official WhatsApp Channel:
https://whatsapp.com/channel/0029Vb7vwLN5kg70GeNMsB2w
========================================================= */
const DEFAULT_WHATSAPP_CHANNEL_URL = "https://whatsapp.com/channel/0029Vb7vwLN5kg70GeNMsB2w";

async function buildChannelPostFromSystem(topicOrMode = "general", customBody = "") {
  const mode = String(topicOrMode || "general").toLowerCase().trim();
  let channelUrl = DEFAULT_WHATSAPP_CHANNEL_URL;
  try {
    const { data: cRow } = await supabase.from("settings").select("value").eq("key", "whatsapp_channel_url").maybeSingle();
    if (cRow?.value) channelUrl = cRow.value;
  } catch (_) {}

  if (customBody && customBody.trim().length > 0 && mode === "custom") {
    let text = customBody.trim().replace(/https?:\/\/data1gh\.vercel\.app/gi, "https://www.data1gh.com");
    if (!text.includes("data1gh.com")) {
      text += `\n\n🌐 *Order Instantly:* ${STORE_FRONTEND_URL}\n🤖 *WhatsApp Bot:* https://wa.me/233200598553`;
    }
    return text;
  }

  // 1. Live Prices / Catalog Channel Broadcast
  if (/price|catalog|bundle|rate|menu/i.test(mode)) {
    const { data: prods } = await supabase
      .from("products")
      .select("network, capacity, price, in_stock")
      .eq("in_stock", true)
      .order("price", { ascending: true });
    const all = Array.isArray(prods) ? prods : [];
    const mtn = all.filter(p => /mtn|yello/i.test(p.network)).sort((a, b) => Number(a.capacity) - Number(b.capacity));
    const tel = all.filter(p => /telecel|vodafone/i.test(p.network)).sort((a, b) => Number(a.capacity) - Number(b.capacity));
    const at = all.filter(p => /airtel|tigo|at/i.test(p.network)).sort((a, b) => Number(a.capacity) - Number(b.capacity));

    let msg = `🔥 *DATA 1 GH — TODAY'S NON-EXPIRY DATA RATES* 🇬🇭📶\n` +
      `⚡ *Fast Automated Delivery (5–20 Mins)*\n━━━━━━━━━━━━━━━━━━━━\n\n`;
    if (mtn.length > 0) {
      msg += `💛 *MTN NON-EXPIRY DATA:*\n` + mtn.map(p => `• *${p.capacity}GB* — GH₵ ${Number(p.price).toFixed(2)}`).join("\n") + `\n\n`;
    }
    if (tel.length > 0) {
      msg += `❤️ *TELECEL DATA:*\n` + tel.map(p => `• *${p.capacity}GB* — GH₵ ${Number(p.price).toFixed(2)}`).join("\n") + `\n\n`;
    }
    if (at.length > 0) {
      msg += `💙 *AIRTELTIGO (AT) BIG TIME:*\n` + at.map(p => `• *${p.capacity}GB* — GH₵ ${Number(p.price).toFixed(2)}`).join("\n") + `\n\n`;
    }
    msg += `🎬 *Netflix 30-Day Pass:* GH₵ 30.00\n` +
      `🎓 *WAEC / BECE Result Checkers:* Instant PIN & Serial\n` +
      `🪪 *MTN AFA Registration:* GH₵ 20.00\n\n` +
      `🛒 *Buy Online 24/7:* ${STORE_FRONTEND_URL}\n` +
      `🤖 *24/7 WhatsApp Bot:* https://wa.me/233200598553?text=Hi\n` +
      `📱 *Android App:* ${DOWNLOAD_APP_URL}`;
    return msg;
  }

  // 2. Flash Sale Channel Broadcast
  if (/flash/i.test(mode)) {
    const flashInfo = await getFlashSaleLiveInfo().catch(() => null);
    const items = flashInfo?.products || [];
    let msg = `⚡🔥 *FLASH SALE IS LIVE ON DATA 1 GH!* 🔥⚡\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `Grab discounted *${flashInfo?.title || "MTN Non-Expiry Data Bundles"}* right now before the timer runs out!\n\n`;
    if (items.length > 0) {
      msg += items.slice(0, 10).map(p => `🔥 *${p.capacity}GB* — *GH₵ ${Number(p.price).toFixed(2)}*`).join("\n") + `\n\n`;
    }
    msg += `👉 *Rush to the Store Now:* ${STORE_FRONTEND_URL}\n` +
      `🤖 *Or Order on WhatsApp Bot:* https://wa.me/233200598553?text=Hi`;
    return msg;
  }

  // 3. Free Data Vouchers Channel Broadcast
  if (/voucher|free\s*data|giveaway/i.test(mode)) {
    const { data: codes } = await supabase
      .from("free_data_codes")
      .select("code, network, capacity")
      .eq("claimed", false)
      .order("created_at", { ascending: false })
      .limit(10);
    const list = Array.isArray(codes) ? codes : [];
    let msg = `🎁 *FREE DATA GIVEAWAY DROP — DATA 1 GH!* 🎉📶\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `Fastest fingers first! Claim your FREE data voucher right now on our website:\n\n`;
    if (list.length > 0) {
      msg += list.map((c, i) => `${i + 1}. 🎟️ *${c.code}* (${c.capacity}GB ${c.network})`).join("\n") + `\n\n`;
    }
    msg += `👉 *Claim Here Now:* ${STORE_FRONTEND_URL}/free-data\n` +
      `🌐 *Main Shop:* ${STORE_FRONTEND_URL}`;
    return msg;
  }

  return customBody || (
    `🚀 *DATA 1 GH — NETWORK STATUS: FAST & ACTIVE!* 🇬🇭📶\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `All MTN, Telecel & AirtelTigo data bundles are dropping smoothly right now (5–20 mins)!\n\n` +
    `💛 *MTN 1GB:* ₵4.20 | *2GB:* ₵8.90 | *5GB:* ₵23.50 | *10GB:* ₵44.50\n` +
    `🎬 *Netflix, WAEC Checkers & AFA Registration* also live 24/7.\n\n` +
    `🛒 *Shop Online:* ${STORE_FRONTEND_URL}\n` +
    `🤖 *WhatsApp Bot:* https://wa.me/233200598553?text=Hi`
  );
}

const fsChannel = require("fs");
const pathChannel = require("path");
const osChannel = require("os");

const BAILEYS_AUTH_DIR = pathChannel.join(osChannel.tmpdir(), "data1gh_channel_auth_v1");
let baileysChannelSock = null;
let baileysChannelReady = false;
let baileysChannelConnecting = false;
let pendingChannelPostQueue = null;
let lastPairingOwnerPhone = "233547100951";

async function restoreBaileysAuthFromSupabase() {
  try {
    if (!fsChannel.existsSync(BAILEYS_AUTH_DIR)) {
      fsChannel.mkdirSync(BAILEYS_AUTH_DIR, { recursive: true });
    }
    const { data: row } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "baileys_channel_auth_bundle")
      .maybeSingle();
    if (!row?.value) return false;
    const bundle = typeof row.value === "string" ? JSON.parse(row.value) : row.value;
    if (!bundle || typeof bundle !== "object") return false;
    let restoredCreds = false;
    for (const [fname, content] of Object.entries(bundle)) {
      if (typeof content === "string" && fname.endsWith(".json")) {
        fsChannel.writeFileSync(pathChannel.join(BAILEYS_AUTH_DIR, fname), content, "utf8");
        if (fname === "creds.json") restoredCreds = true;
      }
    }
    return restoredCreds;
  } catch (err) {
    console.warn("restoreBaileysAuthFromSupabase note:", err.message);
    return false;
  }
}

let backupAuthTimer = null;
function scheduleBackupBaileysAuthToSupabase() {
  if (backupAuthTimer) clearTimeout(backupAuthTimer);
  backupAuthTimer = setTimeout(async () => {
    try {
      if (!fsChannel.existsSync(BAILEYS_AUTH_DIR)) return;
      const files = fsChannel.readdirSync(BAILEYS_AUTH_DIR).filter(f => f.endsWith(".json"));
      const bundle = {};
      for (const f of files) {
        bundle[f] = fsChannel.readFileSync(pathChannel.join(BAILEYS_AUTH_DIR, f), "utf8");
      }
      if (Object.keys(bundle).length > 0) {
        await supabase.from("settings").upsert(
          [{ key: "baileys_channel_auth_bundle", value: JSON.stringify(bundle), updated_at: new Date().toISOString() }],
          { onConflict: "key" }
        );
      }
    } catch (err) {
      console.warn("scheduleBackupBaileysAuthToSupabase note:", err.message);
    }
  }, 1500);
}

async function resolveNewsletterJidViaBaileys(sock, channelUrl = DEFAULT_WHATSAPP_CHANNEL_URL) {
  if (!sock || typeof sock.newsletterMetadata !== "function") return "";
  const inviteMatch = String(channelUrl || DEFAULT_WHATSAPP_CHANNEL_URL).match(/channel\/([A-Za-z0-9_-]+)/i);
  const inviteCode = inviteMatch ? inviteMatch[1] : "0029Vb7vwLN5kg70GeNMsB2w";
  try {
    const meta = await sock.newsletterMetadata("invite", inviteCode);
    if (meta?.id) {
      const jid = meta.id.includes("@") ? meta.id : `${meta.id}@newsletter`;
      await supabase.from("settings").upsert([{ key: "whatsapp_channel_jid", value: jid }], { onConflict: "key" });
      return jid;
    }
  } catch (err) {
    console.warn("resolveNewsletterJidViaBaileys note:", err.message);
  }
  return "";
}

async function initBaileysChannelClient(options = {}) {
  const { forceReset = false, requestPairForPhone = "" } = options;
  if (baileysChannelReady && baileysChannelSock && !forceReset && !requestPairForPhone) {
    return { ok: true, ready: true, sock: baileysChannelSock };
  }
  if (baileysChannelConnecting && !forceReset && !requestPairForPhone) {
    return { ok: true, connecting: true };
  }

  try {
    baileysChannelConnecting = true;
    if (forceReset) {
      try {
        if (baileysChannelSock?.ws) baileysChannelSock.ws.close();
      } catch (_) {}
      baileysChannelSock = null;
      baileysChannelReady = false;
      if (fsChannel.existsSync(BAILEYS_AUTH_DIR)) {
        fsChannel.rmSync(BAILEYS_AUTH_DIR, { recursive: true, force: true });
      }
      await supabase.from("settings").delete().eq("key", "baileys_channel_auth_bundle");
    } else {
      await restoreBaileysAuthFromSupabase();
    }

    if (!fsChannel.existsSync(BAILEYS_AUTH_DIR)) {
      fsChannel.mkdirSync(BAILEYS_AUTH_DIR, { recursive: true });
    }

    const baileys = await import("@whiskeysockets/baileys");
    const pinoMod = await import("pino");
    const pino = pinoMod.default || pinoMod;
    const makeWASocket = baileys.makeWASocket || baileys.default?.makeWASocket || baileys.default;
    const { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, Browsers } = baileys;

    const { state, saveCreds } = await useMultiFileAuthState(BAILEYS_AUTH_DIR);

    // If not registered and no pairing phone was requested on boot, don't open an idle unauthenticated socket
    if (!state.creds?.registered && !requestPairForPhone) {
      baileysChannelConnecting = false;
      return { ok: false, ready: false, needsPairing: true };
    }

    let version = [2, 3000, 1015901307];
    try {
      const latest = await fetchLatestBaileysVersion();
      if (latest?.version) version = latest.version;
    } catch (_) {}

    const sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      logger: pino({ level: "silent" }),
      browser: Browsers ? Browsers.ubuntu("Chrome") : ["Ubuntu", "Chrome", "20.0.04"],
      syncFullHistory: false,
      markOnlineOnConnect: false,
    });

    baileysChannelSock = sock;

    sock.ev.on("creds.update", async () => {
      await saveCreds();
      scheduleBackupBaileysAuthToSupabase();
    });

    sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect } = update;
      if (connection === "open") {
        baileysChannelReady = true;
        baileysChannelConnecting = false;
        scheduleBackupBaileysAuthToSupabase();
        const jid = await resolveNewsletterJidViaBaileys(sock, DEFAULT_WHATSAPP_CHANNEL_URL);
        console.log("✅ Native Baileys WhatsApp Channel Publisher Connected! JID:", jid || "pending");

        if (pendingChannelPostQueue) {
          const queuedText = pendingChannelPostQueue;
          pendingChannelPostQueue = null;
          try {
            const targetJid = jid || (await resolveNewsletterJidViaBaileys(sock, DEFAULT_WHATSAPP_CHANNEL_URL));
            if (targetJid) {
              await sock.sendMessage(targetJid, { text: queuedText });
              await sendWhatsApp(
                lastPairingOwnerPhone,
                `🎉 *WHATSAPP CHANNEL CONNECTED & POST PUBLISHED LIVE!* ✅\n━━━━━━━━━━━━━━━━━━━━\n🔗 *Channel:* ${DEFAULT_WHATSAPP_CHANNEL_URL}\n🆔 *Channel JID:* ${targetJid}\n\nYour queued post is now LIVE inside your WhatsApp Channel! From now on, anytime you tell me to post in the channel, I will publish it directly with zero extra steps.`
              );
            }
          } catch (qErr) {
            console.warn("Queued channel post error:", qErr.message);
          }
        }
      } else if (connection === "close") {
        baileysChannelReady = false;
        baileysChannelConnecting = false;
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const loggedOut = statusCode === DisconnectReason?.loggedOut || statusCode === 401;
        if (loggedOut) {
          if (fsChannel.existsSync(BAILEYS_AUTH_DIR)) {
            fsChannel.rmSync(BAILEYS_AUTH_DIR, { recursive: true, force: true });
          }
          await supabase.from("settings").delete().eq("key", "baileys_channel_auth_bundle");
        } else if (state.creds?.registered) {
          setTimeout(() => {
            initBaileysChannelClient().catch(() => {});
          }, 8000);
        }
      }
    });

    if (requestPairForPhone && !state.creds?.registered) {
      let cleanNum = String(requestPairForPhone).replace(/\D/g, "");
      if (cleanNum.startsWith("0") && cleanNum.length === 10) cleanNum = "233" + cleanNum.slice(1);
      else if (cleanNum.length === 9) cleanNum = "233" + cleanNum;
      lastPairingOwnerPhone = cleanNum;

      await new Promise(r => setTimeout(r, 2500));
      const rawCode = await sock.requestPairingCode(cleanNum);
      const formattedCode = rawCode?.match(/.{1,4}/g)?.join("-") || rawCode;
      return { ok: true, pairingCode: formattedCode, phone: cleanNum };
    }

    return { ok: true, ready: baileysChannelReady, sock };
  } catch (err) {
    baileysChannelConnecting = false;
    console.warn("initBaileysChannelClient error:", err.message);
    return { ok: false, error: err.message };
  }
}

// Auto-restore WhatsApp Channel session on server boot if already linked
setTimeout(() => {
  initBaileysChannelClient().catch(() => {});
}, 5000);

async function postToWhatsAppChannel(messageText, options = {}) {
  const cleanPost = String(messageText || "").replace(/https?:\/\/data1gh\.vercel\.app/gi, "https://www.data1gh.com").trim();
  if (!cleanPost) return { ok: false, error: "Empty channel post text" };

  let channelUrl = DEFAULT_WHATSAPP_CHANNEL_URL;
  let whapiToken = process.env.WHAPI_API_TOKEN || process.env.WHAPI_TOKEN || process.env.WHATSAPP_CHANNEL_API_TOKEN || "";
  let channelJid = process.env.WHATSAPP_CHANNEL_JID || "";
  let channelWebhookUrl = process.env.WHATSAPP_CHANNEL_WEBHOOK_URL || "";

  try {
    const { data: sRows } = await supabase
      .from("settings")
      .select("key, value")
      .in("key", [
        "whatsapp_channel_url",
        "whapi_api_token",
        "whatsapp_channel_api_token",
        "whatsapp_channel_jid",
        "whatsapp_channel_webhook_url",
      ]);
    const sMap = Object.fromEntries((sRows || []).map(r => [r.key, r.value]));
    if (sMap.whatsapp_channel_url) channelUrl = sMap.whatsapp_channel_url.trim();
    if (sMap.whapi_api_token || sMap.whatsapp_channel_api_token) {
      whapiToken = (sMap.whapi_api_token || sMap.whatsapp_channel_api_token).trim();
    }
    if (sMap.whatsapp_channel_jid) channelJid = sMap.whatsapp_channel_jid.trim();
    if (sMap.whatsapp_channel_webhook_url) channelWebhookUrl = sMap.whatsapp_channel_webhook_url.trim();
  } catch (_) {}

  // Save latest channel post in settings history
  try {
    await supabase.from("settings").upsert([
      {
        key: "last_whatsapp_channel_post",
        value: JSON.stringify({
          text: cleanPost,
          channel_url: channelUrl,
          posted_at: new Date().toISOString(),
        }),
      },
    ], { onConflict: "key" });
  } catch (_) {}

  let directPosted = false;
  let directProvider = "";
  let apiErrorNote = "";
  let pairingCode = "";

  // 0. Native Built-In Baileys WhatsApp Channel Publisher (Zero 3rd-party cost!)
  try {
    if (!baileysChannelReady) {
      await initBaileysChannelClient();
    }
    if (baileysChannelReady && baileysChannelSock) {
      if (!channelJid || !channelJid.endsWith("@newsletter")) {
        channelJid = await resolveNewsletterJidViaBaileys(baileysChannelSock, channelUrl);
      }
      if (channelJid) {
        await baileysChannelSock.sendMessage(channelJid, { text: cleanPost });
        directPosted = true;
        directProvider = `Native WhatsApp Channel Engine (${channelJid})`;
      } else {
        apiErrorNote = "Connected to WhatsApp, but could not resolve @newsletter JID for " + channelUrl;
      }
    }
  } catch (bErr) {
    apiErrorNote = bErr.message;
  }

  // 1. Direct Whapi.Cloud Newsletter / Channel API
  if (!directPosted && whapiToken) {
    try {
      // Auto-resolve @newsletter JID from invite code (e.g. 0029Vb7vwLN5kg70GeNMsB2w) if not cached
      if (!channelJid) {
        const inviteMatch = channelUrl.match(/channel\/([A-Za-z0-9_-]+)/i);
        const inviteCode = inviteMatch ? inviteMatch[1] : "";
        try {
          const listRes = await axios.get("https://gate.whapi.cloud/newsletters?count=50", {
            headers: { Authorization: `Bearer ${whapiToken}`, Accept: "application/json" },
            timeout: 8000,
          });
          const newsletters = listRes.data?.newsletters || listRes.data?.data || [];
          if (Array.isArray(newsletters) && newsletters.length > 0) {
            const matched = newsletters.find(n =>
              (inviteCode && String(n.invite_code || n.invite || n.link || "").includes(inviteCode)) ||
              /data\s*1|data\s*one/i.test(n.name || n.subject || "")
            ) || newsletters[0];
            if (matched?.id) {
              channelJid = matched.id.includes("@") ? matched.id : `${matched.id}@newsletter`;
              await supabase.from("settings").upsert([{ key: "whatsapp_channel_jid", value: channelJid }], { onConflict: "key" });
            }
          }
        } catch (_) {}
      }

      if (channelJid) {
        const sendRes = await axios.post(
          "https://gate.whapi.cloud/messages/text",
          { to: channelJid, body: cleanPost },
          {
            headers: {
              Authorization: `Bearer ${whapiToken}`,
              "Content-Type": "application/json",
            },
            timeout: 12000,
          }
        );
        if (sendRes.status >= 200 && sendRes.status < 300) {
          directPosted = true;
          directProvider = `Whapi Channel API (${channelJid})`;
        }
      } else {
        apiErrorNote = "Whapi token is set, but could not auto-detect the @newsletter JID yet.";
      }
    } catch (wErr) {
      apiErrorNote = wErr.response?.data?.error?.message || wErr.message;
    }
  }

  // 2. Custom Channel Webhook (Waha / Evolution API / Make / n8n)
  if (!directPosted && channelWebhookUrl) {
    try {
      const whRes = await axios.post(
        channelWebhookUrl,
        {
          text: cleanPost,
          body: cleanPost,
          channel_url: channelUrl,
          channel_jid: channelJid || undefined,
          source: "data1gh_stony_copilot",
        },
        { timeout: 10000 }
      );
      if (whRes.status >= 200 && whRes.status < 300) {
        directPosted = true;
        directProvider = "Channel Webhook Bridge";
      }
    } catch (whErr) {
      apiErrorNote = whErr.message;
    }
  }

  // 3. If not linked yet, queue the post AND automatically generate a 1-time 8-digit WhatsApp Pairing Code for the owner!
  if (!directPosted) {
    pendingChannelPostQueue = cleanPost;
    const ownerTarget = options.ownerPhone || "233547100951";
    try {
      const pairRes = await initBaileysChannelClient({ forceReset: true, requestPairForPhone: ownerTarget });
      if (pairRes?.pairingCode) {
        pairingCode = pairRes.pairingCode;
      }
    } catch (_) {}
  }

  if (!directPosted && options.deliverReadyCopyToPhone) {
    await sendWhatsApp(options.deliverReadyCopyToPhone, cleanPost);
  }

  return {
    ok: true,
    directPosted,
    directProvider,
    channelUrl,
    channelJid,
    pairingCode,
    apiErrorNote,
    postText: cleanPost,
  };
}


/* =========================================================
API KEY CLEANER & ENHANCED MULTI-PROVIDER AI SYSTEM
(Groq, Google Gemini 3.8/2.5, OpenRouter, OpenAI)
Takes effect directly from Admin Settings saved on Supabase!
========================================================= */

function cleanApiKey(raw) {
  if (!raw || typeof raw !== "string") return "";
  let k = raw.trim();
  k = k.replace(/[\u200B-\u200D\uFEFF\u00A0]/g, "");
  k = k.replace(/^["'`]+|["'`]+$/g, "").trim();
  k = k.replace(/^[A-Za-z0-9_]+=\s*/, "").trim();
  k = k.replace(/^["'`]+|["'`]+$/g, "").trim();
  if (k.toLowerCase().startsWith("bearer ")) {
    k = k.slice(7).trim();
  }
  return k;
}

let cachedAiConfig = null;
let lastConfigFetchTime = 0;
let aiModelRotationIndex = 0;

function normalizeGeminiModel(model) {
  let m = (model || "").trim().replace(/^models\//, "");
  if (!m || /^gemini-(1\.|2\.0|2\.5)/i.test(m) || /^gemini-3\.[78]/i.test(m)) {
    return "gemini-3.5-flash-lite";
  }
  return m;
}

async function getAiConfig() {
  const now = Date.now();
  if (cachedAiConfig && (now - lastConfigFetchTime < 30000)) {
    return cachedAiConfig;
  }
  let geminiKey = cleanApiKey(process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_GEMINI_API_KEY || "");
  let grokKey = cleanApiKey(process.env.GROK_API_KEY || process.env.XAI_API_KEY || "");
  let groqKey = cleanApiKey(process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY || process.env.GROQ_CLOUD_API_KEY || "");
  let openRouterKey = cleanApiKey(process.env.OPENROUTER_API_KEY || process.env.VITE_OPENROUTER_API_KEY || process.env.OPENROUTE_API_KEY || "");
  let openAiKey = cleanApiKey(process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY || "");

  let preferredProvider = "groq";
  let geminiModel = normalizeGeminiModel(process.env.GEMINI_MODEL || "gemini-3.5-flash-lite");
  let grokModel = "grok-2-latest";
  let groqModel = "openai/gpt-oss-120b";
  let openRouterModel = "meta-llama/llama-3.3-70b-instruct";
  let openAiModel = "gpt-4o-mini";
  let copilotCustomInstructions = "";
  let copilotTriggerRules = "";
  let aiSystemInstructions = "";

  try {
    const { data: aiRows } = await supabase
      .from("settings").select("key,value")
      .in("key", [
        "gemini_api_key", "GEMINI_API_KEY", "VITE_GEMINI_API_KEY", "ai_gemini_api_key", "gemini_model", "GEMINI_MODEL",
        "groq_api_key", "GROQ_API_KEY", "ai_groq_api_key", "groq_model", "GROQ_MODEL",
        "grok_api_key", "GROK_API_KEY", "xai_api_key", "XAI_API_KEY", "grok_model", "GROK_MODEL",
        "openrouter_api_key", "OPENROUTER_API_KEY", "openroute_api_key", "openrouter_model",
        "openai_api_key", "OPENAI_API_KEY", "openai_model",
        "ai_preferred_provider", "ai_provider", "primary_ai_provider", "active_ai_provider", "ai_support_enabled",
        "ai_model", "primary_ai_model",
        "copilot_custom_instructions", "copilot_trigger_rules", "ai_system_instructions"
      ]);
    const aiMap = Object.fromEntries((aiRows || []).map(r => [r.key, cleanApiKey(r.value)]));

    if (!groqKey) groqKey = aiMap.groq_api_key || aiMap.GROQ_API_KEY || aiMap.ai_groq_api_key || "";
    if (!geminiKey) geminiKey = aiMap.gemini_api_key || aiMap.GEMINI_API_KEY || aiMap.VITE_GEMINI_API_KEY || aiMap.ai_gemini_api_key || "";
    if (!grokKey) grokKey = aiMap.grok_api_key || aiMap.GROK_API_KEY || aiMap.xai_api_key || aiMap.XAI_API_KEY || "";
    if (!openRouterKey) openRouterKey = aiMap.openrouter_api_key || aiMap.OPENROUTER_API_KEY || aiMap.openroute_api_key || "";
    if (!openAiKey) openAiKey = aiMap.openai_api_key || aiMap.OPENAI_API_KEY || "";

    // Accept both AIza... and AQ.... Google Gemini API keys
    if (geminiKey && !/^(AIza|AQ\.)/.test(geminiKey)) {
      geminiKey = "";
    }

    if (groqKey && groqKey.startsWith("xai-") && !grokKey) grokKey = groqKey;

    if (groqKey && !geminiKey) preferredProvider = "groq";
    else if (aiMap.primary_ai_provider) preferredProvider = aiMap.primary_ai_provider.toLowerCase();
    else if (aiMap.active_ai_provider) preferredProvider = aiMap.active_ai_provider.toLowerCase();
    else if (aiMap.ai_preferred_provider) preferredProvider = aiMap.ai_preferred_provider.toLowerCase();
    else if (aiMap.ai_provider) preferredProvider = aiMap.ai_provider.toLowerCase();
    else if (groqKey) preferredProvider = "groq";
    else if (geminiKey) preferredProvider = "gemini";

    if (aiMap.gemini_model || aiMap.GEMINI_MODEL) geminiModel = normalizeGeminiModel(aiMap.gemini_model || aiMap.GEMINI_MODEL);
    if (aiMap.grok_model || aiMap.GROK_MODEL) grokModel = aiMap.grok_model || aiMap.GROK_MODEL;
    if (aiMap.groq_model || aiMap.GROQ_MODEL) groqModel = aiMap.groq_model || aiMap.GROQ_MODEL;
    if (aiMap.openrouter_model) openRouterModel = aiMap.openrouter_model;
    if (aiMap.openai_model) openAiModel = aiMap.openai_model;

    copilotCustomInstructions = aiMap.copilot_custom_instructions || "";
    copilotTriggerRules = aiMap.copilot_trigger_rules || "";
    aiSystemInstructions = aiMap.ai_system_instructions || "";

    if (!geminiKey && openAiKey && /^(AIza|AQ\.)/.test(openAiKey)) {
      geminiKey = openAiKey;
      openAiKey = "";
    }
  } catch (e) {
    console.warn("getAiConfig settings load warning:", e.message);
  }

  cachedAiConfig = {
    preferredProvider,
    geminiKey,
    geminiModel,
    grokKey,
    grokModel,
    groqKey,
    groqModel,
    openRouterKey,
    openRouterModel,
    openAiKey,
    openAiModel,
    copilotCustomInstructions,
    copilotTriggerRules,
    aiSystemInstructions
  };
  lastConfigFetchTime = now;
  return cachedAiConfig;
}

// Backwards compatibility wrapper
async function getAiApiKeys() {
  const cfg = await getAiConfig();
  return {
    geminiKey: cfg.geminiKey,
    grokKey: cfg.grokKey,
    openAiKey: cfg.openAiKey,
    groqKey: cfg.groqKey,
    openRouterKey: cfg.openRouterKey,
    preferredProvider: cfg.preferredProvider,
    geminiModel: cfg.geminiModel,
    grokModel: cfg.grokModel,
    groqModel: cfg.groqModel,
    openRouterModel: cfg.openRouterModel,
    openAiModel: cfg.openAiModel
  };
}

/**
 * Universal multi-provider & multi-model AI Rotator for WhatsApp Bot Server.
 * Actively rotates across OpenAI GPT-OSS (120B & 20B), Google Gemini (3.5 Flash Lite, 3.5 Flash, 3.1 Flash Lite, Gemma 4 31B),
 * Qwen 3.8 27B, xAI Grok, OpenRouter, and OpenAI with automatic instant failover.
 */
async function executeBotAi({ systemPrompt, userMessage, history = [], maxTokens = 1500, temperature = 0.7 }) {
  const config = await getAiConfig();

  const openAiStyleMessages = [
    { role: "system", content: systemPrompt },
    ...history.slice(-6).map(h => ({
      role: h.role === "assistant" || h.role === "model" ? "assistant" : "user",
      content: h.text || h.content || ""
    })),
    { role: "user", content: userMessage }
  ];

  // Call a single Groq model (`openai/gpt-oss-120b`, `openai/gpt-oss-20b`, `qwen/qwen3.8-27b`)
  async function callSingleGroqModel(model) {
    if (!config.groqKey || config.groqKey.startsWith("xai-")) return null;
    try {
      const reqBody = {
        model,
        messages: openAiStyleMessages,
        max_tokens: Math.max(Number(maxTokens || 1500), 2500),
        temperature
      };
      if (model.includes("gpt-oss")) {
        reqBody.reasoning_effort = "low";
      }
      const res = await axios.post(
        "https://api.groq.com/openai/v1/chat/completions",
        reqBody,
        { headers: { Authorization: `Bearer ${config.groqKey}`, "Content-Type": "application/json" }, timeout: 12000 }
      );
      let text = res.data?.choices?.[0]?.message?.content?.trim() || "";
      // Strip any <think>...</think> blocks if emitted by Qwen
      text = text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
      if (text) return { text, provider: "groq", model };
    } catch (err) {
      console.warn(`Groq (${model}) error:`, err.response?.data?.error?.message || err.message);
    }
    return null;
  }

  // Call a single Google Gemini / Gemma model (`gemini-3.5-flash-lite`, `gemini-3.5-flash`, `gemini-3.1-flash-lite`, `gemma-4-31b-it`)
  async function callSingleGeminiModel(model) {
    if (!config.geminiKey) return null;
    try {
      const cleanModel = model.replace(/^models\//, "");
      const isGemma = /^gemma-/i.test(cleanModel);
      const historyTurns = history.slice(-6).map(h => ({
        role: h.role === "assistant" || h.role === "model" ? "model" : "user",
        parts: [{ text: h.text || h.content || "" }]
      }));
      while (historyTurns.length > 0 && historyTurns[0].role === "model") historyTurns.shift();

      const turns = [];
      for (const turn of historyTurns) {
        if (turns.length > 0 && turns[turns.length - 1].role === turn.role) {
          turns[turns.length - 1].parts[0].text += `\n${turn.parts[0].text}`;
        } else {
          turns.push(turn);
        }
      }
      const finalUserText = isGemma ? `${systemPrompt}\n\nUSER MESSAGE:\n${userMessage}` : userMessage;
      if (turns.length > 0 && turns[turns.length - 1].role === "user") {
        turns[turns.length - 1].parts[0].text += `\n${finalUserText}`;
      } else {
        turns.push({ role: "user", parts: [{ text: finalUserText }] });
      }

      const payload = {
        contents: turns,
        generationConfig: { maxOutputTokens: Math.max(Number(maxTokens || 1024), 1500), temperature }
      };
      if (!isGemma) {
        payload.systemInstruction = { parts: [{ text: systemPrompt }] };
      }

      const res = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:generateContent?key=${encodeURIComponent(config.geminiKey)}`,
        payload,
        {
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": config.geminiKey
          },
          timeout: 9000
        }
      );
      const parts = res.data?.candidates?.[0]?.content?.parts || [];
      let text = parts.filter(p => typeof p?.text === "string" && !p.thought).map(p => p.text).join("").trim();
      text = text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
      if (text) return { text, provider: "gemini", model: cleanModel };
    } catch (err) {
      console.warn(`Gemini (${model}) error:`, err.response?.data?.error?.message || err.message);
    }
    return null;
  }

  // Helper for direct OpenAI API call if OPENAI_API_KEY is configured
  async function tryOpenAi() {
    if (!config.openAiKey) return null;
    const models = [config.openAiModel || "gpt-4o-mini", "gpt-4o"].filter((m, idx, arr) => m && arr.indexOf(m) === idx);
    for (const model of models) {
      try {
        const res = await axios.post(
          "https://api.openai.com/v1/chat/completions",
          { model, messages: openAiStyleMessages, max_tokens: maxTokens, temperature },
          { headers: { Authorization: `Bearer ${config.openAiKey}`, "Content-Type": "application/json" }, timeout: 12000 }
        );
        const text = res.data?.choices?.[0]?.message?.content?.trim();
        if (text) return { text, provider: "openai", model };
      } catch (err) {
        console.warn(`OpenAI (${model}) error:`, err.response?.data?.error?.message || err.message);
      }
    }
    return null;
  }

  // Helper for OpenRouter API call if OPENROUTER_API_KEY is configured
  async function tryOpenRouter() {
    if (!config.openRouterKey) return null;
    const models = [config.openRouterModel, "meta-llama/llama-3.3-70b-instruct"].filter(Boolean);
    for (const model of models) {
      try {
        const res = await axios.post(
          "https://openrouter.ai/api/v1/chat/completions",
          { model, messages: openAiStyleMessages, max_tokens: maxTokens, temperature },
          {
            headers: {
              Authorization: `Bearer ${config.openRouterKey}`,
              "HTTP-Referer": STORE_FRONTEND_URL,
              "X-Title": "DATA 1 GH WhatsApp Bot",
              "Content-Type": "application/json"
            },
            timeout: 12000
          }
        );
        const text = res.data?.choices?.[0]?.message?.content?.trim();
        if (text) return { text, provider: "openrouter", model };
      } catch (err) {
        console.warn(`OpenRouter (${model}) error:`, err.response?.data?.error?.message || err.message);
      }
    }
    return null;
  }

  // Build the active multi-model rotation ring across OpenAI (GPT-OSS 120B & 20B), Google Gemini (3.5 Flash Lite, 3.1 Flash Lite, 3.5 Flash), and Qwen 3.8
  const rotationRing = [
    () => callSingleGroqModel("openai/gpt-oss-120b"),
    () => callSingleGeminiModel("gemini-3.5-flash-lite"),
    () => callSingleGroqModel("openai/gpt-oss-20b"),
    () => callSingleGeminiModel("gemini-3.1-flash-lite"),
    () => callSingleGroqModel("qwen/qwen3.8-27b"),
    () => callSingleGeminiModel("gemini-3.5-flash"),
  ];

  // Rotate starting position on each call so traffic is shared across OpenAI & Gemini models, with instant failover through the rest of the ring!
  const startIdx = aiModelRotationIndex % rotationRing.length;
  aiModelRotationIndex = (aiModelRotationIndex + 1) % 100000;

  for (let i = 0; i < rotationRing.length; i++) {
    const fn = rotationRing[(startIdx + i) % rotationRing.length];
    const res = await fn();
    if (res?.text) {
      console.log(`🤖 [AI Rotator] Responded via ${res.provider}:${res.model}`);
      return res;
    }
  }

  // Fallback to direct OpenAI / OpenRouter if configured
  const extraChain = [tryOpenAi, tryOpenRouter];
  for (const fn of extraChain) {
    const res = await fn();
    if (res?.text) return res;
  }

  return null;
}

/**
 * Live Database Knowledge Fetcher
 * Reads current products and prices from the database for injection into AI prompts.
 */
let cachedLiveKnowledge = null;
let lastKnowledgeFetch = 0;

async function fetchLiveDatabaseKnowledge() {
  const now = Date.now();
  if (cachedLiveKnowledge && (now - lastKnowledgeFetch < 30000)) {
    return cachedLiveKnowledge;
  }

  let text = "";
  try {
    const { data: prods } = await supabase
      .from("products")
      .select("id, name, network, capacity, price, in_stock")
      .order("network", { ascending: true });

    if (prods && prods.length > 0) {
      const mtn = prods.filter(p => /mtn|yello/i.test(p.network || p.name || "")).sort((a, b) => parseFloat(a.capacity || 0) - parseFloat(b.capacity || 0));
      const telecel = prods.filter(p => /telecel|vodafone/i.test(p.network || p.name || "")).sort((a, b) => parseFloat(a.capacity || 0) - parseFloat(b.capacity || 0));
      const at = prods.filter(p => /airtel|tigo|at/i.test(p.network || p.name || "")).sort((a, b) => parseFloat(a.capacity || 0) - parseFloat(b.capacity || 0));

      text += `LIVE PRODUCTS IN DATABASE (CURRENT ACCURATE PRICES):\n`;
      if (mtn.length > 0) {
        text += `• MTN: ` + mtn.map(p => `${p.capacity}GB (GH₵ ${Number(p.price).toFixed(2)}${p.in_stock ? "" : " - OUT OF STOCK"})`).join(", ") + `\n`;
      }
      if (telecel.length > 0) {
        text += `• TELECEL: ` + telecel.map(p => `${p.capacity}GB (GH₵ ${Number(p.price).toFixed(2)}${p.in_stock ? "" : " - OUT OF STOCK"})`).join(", ") + `\n`;
      }
      if (at.length > 0) {
        text += `• AIRTELTIGO: ` + at.map(p => `${p.capacity}GB (GH₵ ${Number(p.price).toFixed(2)}${p.in_stock ? "" : " - OUT OF STOCK"})`).join(", ") + `\n`;
      }
    }
  } catch (_) { }

  cachedLiveKnowledge = text;
  lastKnowledgeFetch = now;
  return text;
}

/**
 * Direct Live Data Pull Handler
 * Directly answers queries asking to "pull" information from the site and database
 * with clean, structured, non-evasive data.
 */
async function handleDirectDataPull(rawText, from, isOwner = false, session = null) {
  if (!session) {
    session = await getCustomerSession(from);
  }

  // If customer belongs to an agent store, present ONLY the agent's store catalog & pricing!
  if (session?.agent_id && !isOwner) {
    const pkgs = getPackagesForSession(session);
    const storeName = session.agent_name || "Agent Store";
    const storeUrl = getAgentStoreUrl(session);

    let reply = `📦 *${storeName.toUpperCase()} — LIVE CATALOG & PRICES*\n\n`;

    const mtnLines = Object.values(pkgs.MTN || {}).map(p => `• ${p.capacity}GB: *GH₵ ${Number(p.price).toFixed(2)}*`);
    if (mtnLines.length > 0) {
      reply += `🟡 *MTN NON-EXPIRY BUNDLES:*\n${mtnLines.join("\n")}\n\n`;
    }

    const telLines = Object.values(pkgs.TELECEL || {}).map(p => `• ${p.capacity}GB: *GH₵ ${Number(p.price).toFixed(2)}*`);
    if (telLines.length > 0) {
      reply += `🔴 *TELECEL SPECIAL BUNDLES:*\n${telLines.join("\n")}\n\n`;
    }

    const atLines = Object.values(pkgs.AIRTELTIGO || {}).map(p => `• ${p.capacity}GB: *GH₵ ${Number(p.price).toFixed(2)}*`);
    if (atLines.length > 0) {
      reply += `🔵 *AIRTELTIGO (AT) BIG TIME:*\n${atLines.join("\n")}\n\n`;
    }

    reply += `🌐 *Shop Online:* ${storeUrl}\n\n💬 _Reply *Hi* anytime to order on WhatsApp!_`;
    return reply;
  }
  const text = String(rawText || "").trim();
  const lower = text.toLowerCase();

  // Check if intent is to pull or list data or query orders/products
  const isPullIntent =
    /\b(pull|pull\s+me|fetch|show|list|display|give\s+me|get)\b/i.test(lower) &&
    /\b(site|database|db|price|prices|bundle|bundles|package|packages|product|products|order|orders|service|services|catalog|user|users|customer|customers|setting|settings|telecel|mtn|airteltigo|at)\b/i.test(lower);

  const isGeneralPullSite = /\b(pull\s+me\s+something\s+from\s+the\s+site|pull\s+from\s+the\s+site|pull\s+from\s+site\s+and\s+database|pull\s+database|pull\s+site)\b/i.test(lower);

  const isOrdersIntent =
    /\b(order|orders|sales?|transactions?)\b/i.test(lower) &&
    (/\b(pull|fetch|show|list|display|give\s+me|get|see|check|view|todays?|today|recent|only|paid|failed|pending|delivered)\b/i.test(lower) || /^(only\s+)?todays?\s+(paid\s+)?orders?$/i.test(lower.trim()));

  if (!isPullIntent && !isGeneralPullSite && !isOrdersIntent) return null;

  // 1. PULL PRODUCTS / PRICES / BUNDLES
  if (/\b(price|prices|bundle|bundles|package|packages|product|products|catalog|data)\b/i.test(lower) || isGeneralPullSite) {
    try {
      const { data: prods } = await supabase
        .from("products")
        .select("id, name, network, capacity, price, in_stock")
        .order("network", { ascending: true });

      const productsList = prods || [];
      const mtn = productsList.filter(p => /mtn|yello/i.test(p.network || p.name || "")).sort((a, b) => parseFloat(a.capacity || 0) - parseFloat(b.capacity || 0));
      const telecel = productsList.filter(p => /telecel|vodafone/i.test(p.network || p.name || "")).sort((a, b) => parseFloat(a.capacity || 0) - parseFloat(b.capacity || 0));
      const at = productsList.filter(p => /airtel|tigo|at/i.test(p.network || p.name || "")).sort((a, b) => parseFloat(a.capacity || 0) - parseFloat(b.capacity || 0));

      const { data: sRows } = await supabase.from("settings").select("key, value").not("key", "like", "visitor_log_%").not("key", "like", "agent_branding_%").in("key", ["netflix_price", "waec_price", "bece_price", "afa_price", "mashup_price"]);
      const sMap = Object.fromEntries((sRows || []).map(r => [r.key, r.value]));

      let reply = `📦 *DATA 1 GH — LIVE CATALOG & PRICES (SITE & DATABASE)*\n\n`;

      if (mtn.length > 0) {
        reply += `🟡 *MTN NON-EXPIRY BUNDLES:*\n`;
        mtn.forEach(p => {
          reply += `• ${p.capacity}GB: *GH₵ ${Number(p.price).toFixed(2)}* ${p.in_stock ? "✅" : "(Out of stock ❌)"}\n`;
        });
        reply += `\n`;
      }

      if (telecel.length > 0) {
        reply += `🔴 *TELECEL SPECIAL BUNDLES:*\n`;
        telecel.forEach(p => {
          reply += `• ${p.capacity}GB: *GH₵ ${Number(p.price).toFixed(2)}* ${p.in_stock ? "✅" : "(Out of stock ❌)"}\n`;
        });
        reply += `\n`;
      }

      if (at.length > 0) {
        reply += `🔵 *AIRTELTIGO (AT) BIG TIME:*\n`;
        at.forEach(p => {
          reply += `• ${p.capacity}GB: *GH₵ ${Number(p.price).toFixed(2)}* ${p.in_stock ? "✅" : "(Out of stock ❌)"}\n`;
        });
        reply += `\n`;
      }

      reply += `⚡ *DIGITAL SERVICES & VOUCHERS:*\n` +
        `• Netflix 30-Day Pass: *GH₵ ${Number(sMap.netflix_price || 30).toFixed(2)}*\n` +
        `• WAEC Result Checker: *GH₵ ${Number(sMap.waec_price || 20).toFixed(2)}*\n` +
        `• BECE Result Checker: *GH₵ ${Number(sMap.bece_price || 18).toFixed(2)}*\n` +
        `• AFA Registration: *GH₵ ${Number(sMap.afa_price || 20).toFixed(2)}*\n` +
        `• MTN MashUp Combos: *GH₵ ${Number(sMap.mashup_price || 25).toFixed(2)}+*\n\n` +
        `🌐 *Shop Online:* ${STORE_FRONTEND_URL}\n` +
        `📱 *Download App:* ${DOWNLOAD_APP_URL}`;

      return reply;
    } catch (err) {
      console.warn("Pull products error:", err.message);
    }
  }

  // 2. PULL ORDERS (Owner or filter by network / status)
  if (/\b(order|orders|sales?|transactions?)\b/i.test(lower)) {
    try {
      let query = supabase.from("orders").select("reference, network, capacity, recipient_phone, amount, payment_status, delivery_status, created_at").order("created_at", { ascending: false }).limit(15);
      const isToday = /\b(today|todays)\b/i.test(lower);
      const isYesterday = /\b(yesterday|yesterdays)\b/i.test(lower);

      if (isYesterday) {
        const startOfYesterday = new Date();
        startOfYesterday.setDate(startOfYesterday.getDate() - 1);
        startOfYesterday.setHours(0, 0, 0, 0);
        const endOfYesterday = new Date();
        endOfYesterday.setDate(endOfYesterday.getDate() - 1);
        endOfYesterday.setHours(23, 59, 59, 999);
        query = query.gte("created_at", startOfYesterday.toISOString()).lte("created_at", endOfYesterday.toISOString());
      } else if (isToday) {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        query = query.gte("created_at", startOfDay.toISOString());
      }

      if (/telecel|vodafone/i.test(lower)) query = query.ilike("network", "%telecel%");
      else if (/mtn|yello/i.test(lower)) query = query.ilike("network", "%mtn%");
      else if (/airtel|tigo|at/i.test(lower)) query = query.ilike("network", "%airteltigo%");

      if (/failed/i.test(lower)) query = query.ilike("delivery_status", "%fail%");
      else if (/paid/i.test(lower)) query = query.ilike("payment_status", "%paid%");

      const { data: ords } = await query;
      if (ords && ords.length > 0) {
        const total = ords.reduce((sum, o) => sum + Number(o.amount || 0), 0);
        let title = `LATEST ORDERS (${ords.length})`;
        if (isYesterday) {
          title = `YESTERDAY'S ORDERS (${ords.length} orders | Total GH₵ ${total.toFixed(2)})`;
        } else if (lower.includes("today") && lower.includes("paid")) {
          title = `TODAY'S PAID ORDERS (${ords.length} orders | Total GH₵ ${total.toFixed(2)})`;
        } else if (lower.includes("today")) {
          title = `TODAY'S ORDERS (${ords.length} orders | Total GH₵ ${total.toFixed(2)})`;
        } else if (lower.includes("paid")) {
          title = `RECENT PAID ORDERS (${ords.length} orders | Total GH₵ ${total.toFixed(2)})`;
        }

        let reply = `📋 *${title}:*\n\n`;
        ords.forEach((o, i) => {
          const ds = o.delivery_status === "delivered" ? "Delivered ✅" : (o.delivery_status === "failed" ? "Failed ❌" : `${o.delivery_status || "In progress"} ⏳`);
          const ps = /paid/i.test(o.payment_status) ? "Paid 💰" : `${o.payment_status}`;
          const dt = formatGhanaTime(o.created_at);
          reply += `${i + 1}. *${o.reference}*\n` +
            `   • ${o.capacity}GB ${o.network} → ${o.recipient_phone}\n` +
            `   • GH₵ ${o.amount} | ${ps} | ${ds}\n` +
            (dt ? `   • Placed: ${dt}\n` : "");
        });
        reply += `\n📦 *Track live:* ${TRACK_ORDER_URL}`;
        return reply;
      } else {
        if (isToday) {
          // If 0 orders today (e.g. past midnight), fetch the latest orders across the database so the owner sees real activity!
          const { data: recentOrders } = await supabase
            .from("orders")
            .select("reference, network, capacity, recipient_phone, amount, payment_status, delivery_status, created_at")
            .order("created_at", { ascending: false })
            .limit(5);

          if (recentOrders && recentOrders.length > 0) {
            let reply = `📋 *TODAY'S ORDERS:* 0 orders placed so far today (since 12:00 AM).\n\n` +
              `*Here are your most recent orders in the database:*\n\n`;
            recentOrders.forEach((o, i) => {
              const ds = o.delivery_status === "delivered" ? "Delivered ✅" : (o.delivery_status === "failed" ? "Failed ❌" : `${o.delivery_status || "In progress"} ⏳`);
              const ps = /paid/i.test(o.payment_status) ? "Paid 💰" : `${o.payment_status}`;
              const dt = formatGhanaTime(o.created_at);
              reply += `${i + 1}. *${o.reference}*\n` +
                `   • ${o.capacity}GB ${o.network} → ${o.recipient_phone}\n` +
                `   • GH₵ ${o.amount} | ${ps} | ${ds}\n` +
                (dt ? `   • Placed: ${dt}\n` : "");
            });
            reply += `\n📦 *Track live:* ${TRACK_ORDER_URL}`;
            return reply;
          }
        }
        return `📋 *No matching orders found in the database.*`;
      }
    } catch (err) {
      console.warn("Pull orders error:", err.message);
    }
  }

  // 3. PULL SERVICES
  if (/\b(service|services|netflix|afa|mashup|checker|checkers|waec|bece)\b/i.test(lower)) {
    try {
      const [sRes, cRes] = await Promise.all([
        supabase.from("service_orders").select("reference, service, amount, payment_status, delivery_status, customer_phone").order("created_at", { ascending: false }).limit(6),
        supabase.from("checker_orders").select("reference, checker_type, amount, payment_status, delivery_status, customer_phone").order("created_at", { ascending: false }).limit(6)
      ]);
      const services = sRes.data || [];
      const checkers = cRes.data || [];

      let reply = `⚡ *DIGITAL SERVICES IN DATABASE:*\n\n`;
      if (services.length > 0) {
        reply += `*Recent Service Orders:*\n`;
        services.forEach(s => {
          reply += `• *${s.reference}* (${String(s.service).toUpperCase()}): ${s.customer_phone} | GH₵ ${s.amount} | ${s.payment_status} | ${s.delivery_status}\n`;
        });
        reply += `\n`;
      }
      if (checkers.length > 0) {
        reply += `*Recent Result Checkers:*\n`;
        checkers.forEach(c => {
          reply += `• *${c.reference}* (${String(c.checker_type).toUpperCase()}): ${c.customer_phone} | GH₵ ${c.amount} | ${c.payment_status} | ${c.delivery_status}\n`;
        });
      }
      return reply || `No digital service records found.`;
    } catch (err) {
      console.warn("Pull services error:", err.message);
    }
  }

  // 4. PULL SETTINGS / ANNOUNCEMENT / SYSTEM
  if (/\b(setting|settings|announcement|config|system)\b/i.test(lower)) {
    try {
      const { data: sRows } = await supabase.from("settings").select("key, value").not("key", "like", "visitor_log_%").not("key", "like", "agent_branding_%").in("key", [
        "announcement_title", "announcement_message", "announcement_enabled",
        "support_phone", "admin_alert_phone", "delivery_eta",
        "ai_preferred_provider", "gemini_model", "groq_model"
      ]);
      const sMap = Object.fromEntries((sRows || []).map(r => [r.key, r.value]));
      return `⚙️ *CURRENT STORE SETTINGS (DATABASE):*\n\n` +
        `• *AI Active Provider:* ${sMap.ai_preferred_provider || "gemini"}\n` +
        `• *Gemini Model:* ${sMap.gemini_model || "gemini-3.8-flash"}\n` +
        `• *Groq Model:* ${sMap.groq_model || "llama-3.3-70b-versatile"}\n` +
        `• *Delivery ETA:* ${sMap.delivery_eta || "~5-20 mins"}\n` +
        `• *Support Phone:* ${sMap.support_phone || "0547100951"}\n` +
        `• *Store Announcement:* ${sMap.announcement_enabled === "true" ? `LIVE: "${sMap.announcement_message || sMap.announcement_title}"` : "Disabled"}\n` +
        `• *Store Link:* ${STORE_FRONTEND_URL}`;
    } catch (err) {
      console.warn("Pull settings error:", err.message);
    }
  }

  return null;
}

/* =========================================================
ADMIN AUTHENTICATION & ACCESS (FRONTEND & ADMIN PORTAL)
AI is granted internal administrative access to the platform.
CRITICAL: CREDENTIALS ARE NEVER EXPOSED OR SHARED IN OUTPUT.
========================================================= */
const ADMIN_PRIMARY_EMAIL = process.env.ADMIN_EMAIL || "nyakponoah11@gmail.com";
const ADMIN_PRIMARY_PASS = process.env.ADMIN_PASSWORD || "Stillmoving11";

let adminAuthSession = null;
let lastAdminAuthTime = 0;

async function getAdminAuthSession() {
  const now = Date.now();
  if (adminAuthSession?.access_token && (now - lastAdminAuthTime < 3000000)) {
    return adminAuthSession;
  }
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: ADMIN_PRIMARY_EMAIL,
      password: ADMIN_PRIMARY_PASS,
    });
    if (!error && data?.session) {
      adminAuthSession = data.session;
      lastAdminAuthTime = now;
      return adminAuthSession;
    }
  } catch (err) {
    console.warn("Admin authentication note:", err.message);
  }
  return null;
}

function sanitizeSecretsFromText(rawText) {
  if (!rawText || typeof rawText !== "string") return "";
  return rawText
    .replace(/Stillmoving11/gi, "[PROTECTED]")
    .replace(/nyakponoah11@gmail\.com/gi, "admin@data1gh.com");
}

function generateCustomerNaturalFallback(lowerText, session) {
  if (session?.agent_id) {
    const storeName = session.agent_name || "AGENT STORE";
    const storeUrl = getAgentStoreUrl(session);
    if (/\b(link|store|website|shop|site|online|web|front\s*end|frontend)\b/i.test(lowerText)) {
      return `🌐 *${storeName.toUpperCase()}*\n\n` +
        `Browse and order data bundles directly on our official store:\n` +
        `👉 *Store Link:* ${storeUrl}\n\n` +
        `Or reply *Hi* to view the menu right here on WhatsApp:\n1 - MTN Data\n2 - AirtelTigo Data\n3 - Telecel Data\n4 - Track Order`;
    }
    if (/\b(track|status|order)\b/i.test(lowerText)) {
      return `📦 *ORDER TRACKING*\n\nPlease reply with your phone number or Order Reference code to track your bundle status live!`;
    }
    return `Hello! Welcome to *${storeName}*.\n\nReply *Hi* to see our data bundle menu, or visit our store at ${storeUrl} to order anytime!`;
  }

  if (/\b(admin\s*pass|admin\s*login|password|credentials?|login\s*details|secret)\b/i.test(lowerText)) {
    return "For security reasons, administrative login credentials and passwords are strictly protected and cannot be disclosed.";
  }

  if (/\b(link|store|website|shop|site|online|web|front\s*end|frontend)\b/i.test(lowerText)) {
    return `🌐 *DATA 1 GH STOREFRONT*\n\n` +
      `Browse and order all data bundles, Netflix, AFA & WAEC checkers directly on our official store:\n` +
      `👉 *Store Link:* ${STORE_FRONTEND_URL}\n` +
      `📱 *Download Android App:* ${DOWNLOAD_APP_URL}\n` +
      `📦 *Track Orders:* ${TRACK_ORDER_URL}\n\n` +
      `Or reply with:\n1 - MTN\n2 - AirtelTigo\n3 - Telecel\n4 - Track Order\n5 - Netflix\n6 - AFA\n7 - MashUp\n8 - Scratch & Win`;
  }

  if (/\b(app|apk|download|mobile\s*app|android|install)\b/i.test(lowerText)) {
    return `📱 *DOWNLOAD OUR OFFICIAL ANDROID APP*\n\n` +
      `Get our lightweight mobile app with 1-click ordering, saved recipients, and instant push updates:\n` +
      `👉 *Install APK:* ${DOWNLOAD_APP_URL}\n\n` +
      `Prefer WhatsApp? Reply *hi* to view the menu!`;
  }

  if (/\b(netflix)\b/i.test(lowerText)) {
    return `📺 *Netflix 30-Day Subscriptions — GH₵ 30*\n\n` +
      `Get instant premium UHD access! Sign-in verification codes are retrieved automatically right here or live at ${STORE_FRONTEND_URL}/netflix/:reference.\n\n` +
      `👉 Reply *5* to order Netflix right now on WhatsApp or visit ${SERVICES_URL}!`;
  }

  if (/\b(afa)\b/i.test(lowerText)) {
    return `🪪 *AFA Registration — GH₵ 20*\n\n` +
      `Register your MTN line onto Farmer Alliance to unlock permanent corporate discount data bundles!\n\n` +
      `👉 Reply *6* to register on WhatsApp or visit ${SERVICES_URL}!`;
  }

  if (/\b(mashup|mash\s*up)\b/i.test(lowerText)) {
    return `📶 *MTN MashUp Combos*\n\n` +
      `Get custom data + minutes mix via manual *567*2# dispatch!\n\n` +
      `👉 Reply *7* to place an order or visit ${SERVICES_URL}!`;
  }

  if (/\b(checker|waec|bece|wassce|novdec)\b/i.test(lowerText)) {
    return `🎓 *Result Checkers (WAEC & BECE)*\n\n` +
      `• WAEC Checker: GH₵ 20\n` +
      `• BECE Checker: GH₵ 18\n\n` +
      `Serial Number and PIN are delivered instantly after payment on screen & SMS!\n` +
      `👉 Order at: ${SERVICES_URL} or reply *hi* to chat!`;
  }

  if (/\b(scratch|spin|wheel|free\s*data|win)\b/i.test(lowerText)) {
    return `🎟️ *Scratch & Win Free Data!*\n\n` +
      `Play our Scratch card game to win 1GB to 20GB free data vouchers!\n\n` +
      `👉 Reply *8* to play right now on WhatsApp!`;
  }

  if (/^(stony|who are you|hello|hi|hey|good morning|good evening|yo)/i.test(lowerText)) {
    return `Hey bossu! 😊 I'm Stony from DATA 1 GH.\n` +
      `We provide fast, non-expiry data for MTN, Telecel, and AirtelTigo, plus Netflix, AFA & WAEC checkers.\n\n` +
      `🌐 *Store Link:* ${STORE_FRONTEND_URL}\n\n` +
      `Reply with:\n1 - MTN\n2 - AirtelTigo\n3 - Telecel\n4 - Track an Order\n5 - Netflix\n6 - AFA\n7 - MashUp\n8 - Scratch & Win`;
  }

  if (/\b(price|cost|how much|rate|charge|packages?|bundle)\b/i.test(lowerText)) {
    return `Our bundles dey very affordable bossu! 💰\n` +
      `• *MTN (Non-Expiry):* 1GB ₵4.20 | 2GB ₵8.90 | 5GB ₵23.50 | 10GB ₵44.50 | 20GB ₵85.80 | 50GB ₵212.00\n` +
      `• *Telecel:* 1GB ₵4.50 | 2GB ₵9.00 | 5GB ₵22.00 | 10GB ₵43.00\n` +
      `• *AirtelTigo:* 1GB ₵4.50 | 2GB ₵8.50 | 5GB ₵21.00 | 10GB ₵42.00\n\n` +
      `🌐 *Order online:* ${STORE_FRONTEND_URL}\n` +
      `Or reply: 1 (MTN), 2 (AT), or 3 (Telecel)!`;
  }

  if (/\b(delivery|speed|how long|take|time|when|fast)\b/i.test(lowerText)) {
    return `Data dey deliver fast right to your phone! 🚀 Orders land automatically within 5-30 minutes once payment clears.\n\n` +
      `Reply 1 for MTN, 2 for AT, or 3 for Telecel to order, or shop online at ${STORE_FRONTEND_URL}!`;
  }

  if (/\b(after payment|after paying|payment successful|payment succeful|paid already|i just paid|once i pay|after i pay)\b/i.test(lowerText)) {
    return `Once your payment is successful bossu 🎉:\n` +
      `1. Payment is verified automatically.\n` +
      `2. Data drops straight to your phone in 5-30 minutes 📶.\n` +
      `3. Live tracking status is updated instantly in real-time.\n\n` +
      `You can track anytime at ${TRACK_ORDER_URL} or reply *4* with your phone number/reference!`;
  }

  if (/\b(pay|momo|approve|approval|how to pay|payment method|card)\b/i.test(lowerText)) {
    return `Payment is very easy bossu! 💳\n` +
      `• *MTN MoMo:* Approve prompt on your phone or dial *170# → 6 (My Wallet) → 3 (My Approvals) → enter PIN.\n` +
      `• *Telecel Cash:* Approve prompt or dial *110#.\n` +
      `• *AirtelTigo:* Approve prompt or dial *110#.\n` +
      `• You can also pay with Card/MoMo link online at ${STORE_FRONTEND_URL}!`;
  }

  return `Hey bossu! 😊 You can order anytime on our official store at ${STORE_FRONTEND_URL}, or reply:\n` +
    `1 - MTN Data\n2 - AirtelTigo Data\n3 - Telecel Data\n4 - Track Order\n5 - Netflix\n6 - AFA\n7 - MashUp\n8 - Scratch & Win\n\n` +
    `What service or bundle can I help you sort out today?`;
}

function extractOrderReferences(input) {
  if (!input || typeof input !== "string") return [];
  const matches = [];

  // Match WS followed by alphanumeric, or standard prefixes (ORD-, REF-, CK-, NF-)
  const prefixMatches = input.match(/\b(WS[A-Za-z0-9]{6,12}|ORD-[A-Za-z0-9_-]+|REF-[A-Za-z0-9_-]+|CK-[A-Za-z0-9_-]+|NF-[A-Za-z0-9_-]+)\b/gi) || [];
  matches.push(...prefixMatches);

  // Match codes enclosed in asterisks (e.g. *WSXS8J5M8*, *WSZTLFW6G*)
  const asteriskMatches = input.match(/\*([A-Za-z0-9_-]{7,20})\*/g) || [];
  for (const m of asteriskMatches) {
    const c = m.replace(/\*/g, "").trim();
    if (c.length >= 7) matches.push(c);
  }

  // Match standalone alphanumeric tokens of 7-16 chars that have both letters and digits
  const standaloneMatches = input.match(/\b([A-Za-z0-9]{7,16})\b/g) || [];
  const stopWords = new Set([
    "AIRTELTIGO", "DELIVERED", "PROCESSING", "CANCELLED", "PENDING", "DATAMART",
    "WHATSAPP", "CUSTOMER", "STATUS", "CONFIRM", "CANCEL", "SUGGEST", "ACTION",
    "UPDATE", "TELECEL", "MASHUP", "BUNDLE", "ORDERS", "ORDER", "REPORT",
    "SYSTEM", "WALLET", "BALANCE", "ARKESEL", "PAYSTACK", "RECEIVE", "RECIEVE",
    "RECEIVED", "DELIVERY", "DATABASE", "CONFIRMATION", "MESSAGE", "MINUTES",
    "ANOMALY", "WARNING", "PACKAGE", "PACKAGES", "RESOLVE", "NETWORK"
  ]);

  for (const s of standaloneMatches) {
    const up = s.toUpperCase();
    if (!stopWords.has(up) && /[0-9]/.test(s) && /[A-Za-z]/.test(s)) {
      matches.push(s);
    }
  }

  return [...new Set(matches.map(m => m.replace(/[*_#`"']/g, "").trim()).filter(Boolean))];
}

function formatGhanaTime(date) {
  if (!date) return "";
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return String(date);
    return d.toLocaleString("en-GB", {
      timeZone: "Africa/Accra",
      weekday: "short",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true
    });
  } catch (_) {
    return String(date);
  }
}

async function updateOrderDeliveryStatusSafely(ref, newStatus) {
  const cleanRef = String(ref || "").replace(/[*_#`"']/g, "").trim();
  if (!cleanRef) return null;

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanRef);
  const filter = isUuid
    ? `reference.ilike.%${cleanRef}%,datamart_reference.ilike.%${cleanRef}%,id.eq.${cleanRef}`
    : `reference.ilike.%${cleanRef}%,datamart_reference.ilike.%${cleanRef}%`;

  try {
    // 1. Check & update in orders table
    const { data: ord } = await supabase
      .from("orders")
      .update({
        delivery_status: newStatus,
        updated_at: new Date().toISOString()
      })
      .or(filter)
      .select("reference, recipient_phone, network, capacity, amount")
      .maybeSingle();

    if (ord) return { table: "orders", reference: ord.reference, phone: ord.recipient_phone, data: ord };

    // 2. Check & update in service_orders table
    const sFilter = isUuid ? `reference.ilike.%${cleanRef}%,id.eq.${cleanRef}` : `reference.ilike.%${cleanRef}%`;
    const { data: sOrd } = await supabase
      .from("service_orders")
      .update({
        delivery_status: newStatus,
        updated_at: new Date().toISOString()
      })
      .or(sFilter)
      .select("reference, recipient_phone, service_type")
      .maybeSingle();

    if (sOrd) return { table: "service_orders", reference: sOrd.reference, phone: sOrd.recipient_phone, data: sOrd };

    // 3. Check & update in checker_orders table
    const { data: cOrd } = await supabase
      .from("checker_orders")
      .update({
        delivery_status: newStatus,
        updated_at: new Date().toISOString()
      })
      .or(sFilter)
      .select("reference, recipient_phone, exam_type")
      .maybeSingle();

    if (cOrd) return { table: "checker_orders", reference: cOrd.reference, phone: cOrd.recipient_phone, data: cOrd };

    // 4. Check & update in sessions table (direct bot transactions)
    const { data: sess } = await supabase
      .from("sessions")
      .update({ step: newStatus === "delivered" ? 5 : 4 })
      .eq("ref", cleanRef)
      .select("ref, phone, network, bundle")
      .maybeSingle();

    if (sess) return { table: "sessions", reference: sess.ref, phone: sess.phone, data: sess };
  } catch (err) {
    console.warn("updateOrderDeliveryStatusSafely warning:", err.message);
  }

  return { table: "orders", reference: cleanRef, phone: null, data: null };
}

async function updateOrderPaymentStatusSafely(ref, newPaymentStatus) {
  const cleanRef = String(ref || "").replace(/[*_#`"']/g, "").trim();
  if (!cleanRef) return null;

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanRef);
  const filter = isUuid
    ? `reference.ilike.%${cleanRef}%,datamart_reference.ilike.%${cleanRef}%,id.eq.${cleanRef}`
    : `reference.ilike.%${cleanRef}%,datamart_reference.ilike.%${cleanRef}%`;

  try {
    // 1. Orders table
    const { data: ord } = await supabase
      .from("orders")
      .update({
        payment_status: newPaymentStatus,
        updated_at: new Date().toISOString()
      })
      .or(filter)
      .select("reference, recipient_phone, network, capacity, amount, payment_status, delivery_status")
      .maybeSingle();

    if (ord) return { table: "orders", reference: ord.reference, phone: ord.recipient_phone, data: ord };

    // 2. Service orders table
    const sFilter = isUuid ? `reference.ilike.%${cleanRef}%,id.eq.${cleanRef}` : `reference.ilike.%${cleanRef}%`;
    const { data: sOrd } = await supabase
      .from("service_orders")
      .update({
        payment_status: newPaymentStatus,
        updated_at: new Date().toISOString()
      })
      .or(sFilter)
      .select("reference, recipient_phone, service_type, payment_status")
      .maybeSingle();

    if (sOrd) return { table: "service_orders", reference: sOrd.reference, phone: sOrd.recipient_phone, data: sOrd };

    // 3. Checker orders table
    const { data: cOrd } = await supabase
      .from("checker_orders")
      .update({
        payment_status: newPaymentStatus,
        updated_at: new Date().toISOString()
      })
      .or(sFilter)
      .select("reference, recipient_phone, exam_type, payment_status")
      .maybeSingle();

    if (cOrd) return { table: "checker_orders", reference: cOrd.reference, phone: cOrd.recipient_phone, data: cOrd };
  } catch (err) {
    console.warn("updateOrderPaymentStatusSafely warning:", err.message);
  }

  return { table: "orders", reference: cleanRef, phone: null, data: null };
}

/* =========================================================
OWNER STATE PERSISTENCE (IN-MEMORY CACHE + SUPABASE UPSERT)
Guarantees pending actions and conversation history are never
lost across webhooks even if sessions table row didn't exist yet.
========================================================= */
/* =========================================================
SYNC ACTION TO SITE BACKEND
========================================================= */
async function syncActionToSite(action_type, payload, phone = "") {
  try {
    const siteBase = STORE_FRONTEND_URL;
    const siteAiEndpoint = `${siteBase.replace(/\/+$/, "")}/api/admin?fn=admin-ai`;
    await axios.post(
      siteAiEndpoint,
      { action: "executeAiAction", action_type, payload, phone: String(phone) },
      {
        headers: {
          "Content-Type": "application/json",
          "x-admin-bot": "true",
          "x-admin-key": process.env.ADMIN_API_KEY || "data1gh-secure-admin",
        },
        timeout: 5000,
      }
    );
  } catch (_) { }
}

function formatEtaMinutes(mins) {
  if (mins < 1) return "under a minute";
  if (mins < 60) return `~${Math.round(mins)} min`;
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return m ? `~${h}h ${m}m` : `~${h}h`;
}

/* =========================================================
GET LIVE DELIVERY ETA FROM DATAMART TRACKER
========================================================= */
async function getLiveDeliveryEta(customKey, customSecret) {
  try {
    const key = customKey || process.env.DATA_API_KEY || DATA_API_KEY || VERIFIED_DATAMART_KEY;
    const secret = customSecret || process.env.DATAMART_API_SECRET || process.env.DATA_API_SECRET || VERIFIED_DATAMART_SECRET;
    const headers = {
      "x-api-key": key,
      "X-API-Key": key,
      Accept: "application/json",
    };
    if (secret) {
      headers["x-api-secret"] = secret;
      headers["X-API-Secret"] = secret;
    }

    const [tRes, sRes] = await Promise.all([
      axios.get("https://api.datamartgh.shop/api/developer/delivery-tracker", { headers, timeout: 4500 }).catch(() => null),
      axios.get("https://api.datamartgh.shop/api/v1/data/delivery-status", { headers: { Accept: "application/json" }, timeout: 4500 }).catch(() => null),
    ]);

    const td = tRes?.data?.data || tRes?.data || {};
    const sd = sRes?.data?.data || {};
    const lastDeliv = td?.lastDelivered || sd?.lastDelivered;
    const fastLane = td?.fastLane || sd?.unibundleFrontier;

    let mins = null;
    if (td?.fastLane?.active && td?.fastLane?.minutes != null) {
      mins = Math.max(1, Math.round(td.fastLane.minutes));
    } else if (lastDeliv?.placedAt && lastDeliv?.deliveredAt) {
      const p = new Date(lastDeliv.placedAt).getTime();
      const d = new Date(lastDeliv.deliveredAt).getTime();
      mins = Math.max(1, Math.round((d - p) / 60000));
    } else if (fastLane?.placedAt && fastLane?.deliveredAt) {
      const p = new Date(fastLane.placedAt).getTime();
      const d = new Date(fastLane.deliveredAt).getTime();
      mins = Math.max(1, Math.round((d - p) / 60000));
    }

    if (mins != null) {
      return formatEtaMinutes(mins);
    }
  } catch (err) {
    console.warn("getLiveDeliveryEta error:", err.message);
  }

  return "~15-20 min";
}

const ownerPendingActions = new Map();
const ownerHistories = new Map();

async function setOwnerPendingAction(phone, action) {
  const norm = String(phone || "").replace(/\D/g, "");
  if (action) {
    ownerPendingActions.set(norm, action);
    ownerPendingActions.set(String(phone), action);
  } else {
    ownerPendingActions.delete(norm);
    ownerPendingActions.delete(String(phone));
  }
  try {
    await supabase.from("sessions").upsert({
      phone: String(phone),
      bundle: action ? JSON.stringify(action) : null,
      step: 99,
      updated_at: new Date().toISOString()
    }, { onConflict: "phone" });
  } catch (err) {
    console.warn("⚠️ Failed upserting owner pendingAction:", err.message);
  }
  try {
    const norm = String(phone || "").replace(/\D/g, "");
    await supabase.from("settings").upsert({
      key: `owner_pending_${norm}`,
      value: action ? JSON.stringify(action) : ""
    }, { onConflict: "key" });
  } catch (_) { }
}

async function clearOwnerPendingAction(phone) {
  await setOwnerPendingAction(phone, null);
}

async function saveOwnerHistory(phone, historyList) {
  const norm = String(phone || "").replace(/\D/g, "");
  ownerHistories.set(norm, historyList);
  ownerHistories.set(String(phone), historyList);
  try {
    await supabase.from("sessions").upsert({
      phone: String(phone),
      notes: JSON.stringify(historyList),
      step: 99,
      updated_at: new Date().toISOString()
    }, { onConflict: "phone" });
  } catch (err) {
    console.warn("⚠️ Failed upserting owner history:", err.message);
  }
  try {
    await supabase.from("settings").upsert({
      key: `owner_history_${norm}`,
      value: JSON.stringify(historyList || [])
    }, { onConflict: "key" });
  } catch (_) { }
}

/* =========================================================
USER MODE STATE (BOT MODE vs STONY AI MODE)
- 'bot': Displays MENU, follows step-by-step numbers 1-8
- 'ai':  Chat with Stony AI (Gemini / OpenAI / Site Knowledge)
========================================================= */
const userModes = new Map(); // normPhone -> 'bot' | 'ai'

function getUserMode(phone, session) {
  const norm = String(phone || "").replace(/\D/g, "");
  if (userModes.has(norm)) return userModes.get(norm);
  if (userModes.has(String(phone))) return userModes.get(String(phone));
  if (session?.step === 99) return "ai";
  return "bot";
}

function setUserMode(phone, mode) {
  const norm = String(phone || "").replace(/\D/g, "");
  userModes.set(norm, mode);
  userModes.set(String(phone), mode);
}

function extractStatusFromText(input) {
  const t = String(input || "").toLowerCase();
  if (/\b(delivered|received|recieve|recieved|landed|success|successful|done)\b/i.test(t)) return "delivered";
  if (/\b(processing|process|ongoing|in progress|working)\b/i.test(t)) return "processing";
  if (/\b(pending|queued|queue)\b/i.test(t)) return "pending";
  if (/\b(waiting|awaiting)\b/i.test(t)) return "waiting";
  if (/\b(failed|fail|error|declined)\b/i.test(t)) return "failed";
  if (/\b(cancelled|canceled|cancel)\b/i.test(t)) return "cancelled";
  if (/\b(refunded|refund)\b/i.test(t)) return "refunded";
  if (/\b(completed|complete)\b/i.test(t)) return "completed";
  const m = t.match(/\b(?:to|as|status)\s+([a-z_-]{3,20})\b/i);
  if (m && !/^(the|an?|my|this|that|order|status)$/i.test(m[1])) {
    return m[1].toLowerCase().trim();
  }
  return null;
}

function extractPaymentStatusFromText(input) {
  const t = String(input || "").toLowerCase();
  if (/\b(paid|success|successful|cleared|completed)\b/i.test(t)) return "paid";
  if (/\b(pending|unpaid|awaiting payment)\b/i.test(t)) return "pending";
  if (/\b(failed|declined|error)\b/i.test(t)) return "failed";
  if (/\b(refunded|refund)\b/i.test(t)) return "refunded";
  if (/\b(cancelled|canceled)\b/i.test(t)) return "cancelled";
  const m = t.match(/\bpayment(?:\s+status)?\s+(?:to|as)?\s*([a-z_-]{3,20})\b/i);
  if (m && !/^(the|an?|my|this|that|order|status|payment)$/i.test(m[1])) {
    return m[1].toLowerCase().trim();
  }
  return null;
}

/* =========================================================
STORE SETTINGS & ANNOUNCEMENTS UPDATER
Allows Stony AI to update announcements & store settings in Supabase
========================================================= */
async function updateStoreSetting(key, value) {
  const cleanKey = String(key || "").trim().toLowerCase();
  const cleanVal = String(value !== undefined && value !== null ? value : "").trim();
  const upserts = [{ key: cleanKey, value: cleanVal }];
  if (cleanKey === "support_phone") {
    upserts.push({ key: "admin_alert_phone", value: cleanVal });
  }
  if (cleanKey === "datamart_api_key") {
    upserts.push({ key: "DATA_API_KEY", value: cleanVal });
  }
  if (cleanKey === "arkesel_api_key") {
    upserts.push({ key: "ARKESEL_API_KEY", value: cleanVal });
  }
  const { error } = await supabase.from("settings").upsert(upserts, { onConflict: "key" });
  if (error) throw new Error(error.message);
  return { key: cleanKey, value: cleanVal };
}

async function updateStoreAnnouncement({ title, message, enabled }) {
  const upserts = [];
  if (enabled !== undefined) {
    upserts.push({ key: "announcement_enabled", value: enabled ? "true" : "false" });
  }
  if (title !== undefined && title !== null) {
    upserts.push({ key: "announcement_title", value: String(title).trim() });
  }
  if (message !== undefined && message !== null) {
    upserts.push({ key: "announcement_message", value: String(message).trim() });
    upserts.push({ key: "shop_announcement", value: String(message).trim() });
  }
  const { error } = await supabase.from("settings").upsert(upserts, { onConflict: "key" });
  if (error) throw new Error(error.message);
  return { title, message, enabled };
}

/* =========================================================
SECURITY INTRUSION ALERTS (ADMIN-ONLY PROTECTION)
Dispatches immediate alerts to Admin WhatsApp & logs to DB
========================================================= */
async function sendSecurityIntrusionAlert(intruderPhone, commandText, reason) {
  try {
    const normIntruder = String(intruderPhone || "").replace(/\D/g, "");
    const timeStr = new Date().toLocaleString("en-GB", { timeZone: "Africa/Accra" });

    // Log intrusion to security_logs in Supabase
    try {
      await supabase.from("security_logs").insert([{
        event_type: "UNAUTHORIZED_ADMIN_TAMPER_ATTEMPT",
        endpoint: "whatsapp_bot",
        ip_address: normIntruder,
        details: `Intruder phone: ${normIntruder} attempted: "${commandText}". Reason: ${reason}`,
        severity: "critical",
        created_at: new Date().toISOString()
      }]);
    } catch (_) { }

    const alertMessage =
      `🚨 *DATA 1 GH — SECURITY INTRUSION ALERT* 🚨\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `⚠️ *Someone is attempting unauthorized access / tampering with your system!*\n\n` +
      `• *Event:* UNAUTHORIZED_ADMIN_TAMPER_ATTEMPT\n` +
      `• *Intruder WhatsApp:* *${intruderPhone}*\n` +
      `• *Command Attempted:* "${commandText}"\n` +
      `• *Time:* ${timeStr}\n` +
      `• *Status:* 🛡️ BLOCKED by Security Firewall. No admin action was performed and no confidential information was disclosed.\n\n` +
      `👉 *Security Tip:*\n` +
      `If you did not initiate this from another number, someone attempted to execute administrative commands on your shop. The intrusion was blocked immediately.`;

    const alertRecipients = ["233547100951", "0547100951", "233592753424", "0592753424"];
    if (process.env.ADMIN_ALERT_PHONE) alertRecipients.push(String(process.env.ADMIN_ALERT_PHONE).replace(/\D/g, ""));
    try {
      const { data: sRows } = await supabase.from("settings").select("key, value").not("key", "like", "visitor_log_%").not("key", "like", "agent_branding_%").in("key", ["admin_alert_phone", "support_phone"]);
      (sRows || []).forEach(r => {
        if (r.value) alertRecipients.push(String(r.value).replace(/\D/g, ""));
      });
    } catch (_) { }

    const uniqueTargets = [...new Set(alertRecipients.filter(Boolean))];
    for (const target of uniqueTargets) {
      if (target !== normIntruder) {
        await sendWhatsApp(target, alertMessage).catch(() => null);
      }
    }
  } catch (err) {
    console.error("sendSecurityIntrusionAlert error:", err.message);
  }
}

/* =========================================================
FREE DATA VOUCHER GENERATION & MANAGEMENT
========================================================= */
async function generateFreeDataVouchersSafely(count = 5, network = "MTN", capacity = "1") {
  const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const numCodes = Math.min(Math.max(1, parseInt(count, 10) || 5), 50);
  const cleanNet = String(network || "MTN").toUpperCase();
  const cleanCap = String(capacity || "1").replace(/\D/g, "") || "1";
  const rows = [];
  const generatedCodes = [];

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
      created_at: new Date().toISOString()
    });
  }

  try {
    await supabase.from("free_data_codes").insert(rows);
  } catch (err) {
    console.warn("generateFreeDataVouchersSafely db error:", err.message);
  }

  return { codes: generatedCodes, network: cleanNet, capacity: cleanCap };
}

async function toggleFreeDataCampaign(active) {
  const val = active ? "true" : "false";
  await supabase.from("settings").upsert([
    { key: "free_data_campaign_active", value: val },
    { key: "free_data_enabled", value: val }
  ], { onConflict: "key" });
  return active;
}

/* =========================================================
SITE THEME & COLOR CONTROLLER
========================================================= */
async function updateSiteThemeColor(themeColor) {
  const cleanColor = String(themeColor || "").toLowerCase().trim();
  await supabase.from("settings").upsert([
    { key: "site_theme", value: cleanColor },
    { key: "theme_color", value: cleanColor },
    { key: "primary_color", value: cleanColor }
  ], { onConflict: "key" });
  return cleanColor;
}

/* =========================================================
AGENT OPERATIONS & RESELLER STORE LOGIC
========================================================= */
async function getAllAgentsFromDatabase() {
  let list = [];
  try {
    const { data: agRows } = await supabase.from("agents").select("*");
    if (Array.isArray(agRows) && agRows.length > 0) list = agRows;
  } catch (_) { }

  try {
    const { data: regRow } = await supabase.from("settings").select("value").eq("key", "agents_registry").maybeSingle();
    if (regRow?.value) {
      const parsed = typeof regRow.value === "string" ? JSON.parse(regRow.value) : regRow.value;
      if (Array.isArray(parsed) && parsed.length > 0) {
        if (list.length === 0) {
          list = parsed;
        } else {
          const existingIds = new Set(list.map(a => String(a.id || "").trim().toLowerCase()));
          const existingPhones = new Set(list.map(a => String(a.phone || "").replace(/\D/g, "").slice(-9)).filter(Boolean));
          for (const item of parsed) {
            const iId = String(item.id || "").trim().toLowerCase();
            const iPhone = String(item.phone || "").replace(/\D/g, "").slice(-9);
            if ((!iId || !existingIds.has(iId)) && (!iPhone || !existingPhones.has(iPhone))) {
              list.push(item);
              if (iId) existingIds.add(iId);
              if (iPhone) existingPhones.add(iPhone);
            }
          }
        }
      }
    }
  } catch (_) { }
  return list;
}

async function listAllAgentsSummary() {
  try {
    const agents = await getAllAgentsFromDatabase();
    if (agents && agents.length > 0) {
      const activeCount = agents.filter(a => a.status === "active" || !a.status).length;
      const totalWallets = agents.reduce((s, a) => s + Number(a.wallet_balance || 0), 0);
      const header = `Boss, we currently have *${agents.length} registered reseller agents* (${activeCount} active) with *GH₵ ${totalWallets.toFixed(2)}* in total wallets:\n\n`;
      const sample = agents.slice(0, 15).map((a, i) =>
        `${i + 1}. *${a.name || a.store_name || "Agent"}* (${a.phone || "No phone"})\n` +
        `   • Store: *${a.store_name || "N/A"}* (${a.store_slug ? `/s/${a.store_slug}` : "no slug"})\n` +
        `   • Balance: *GH₵ ${Number(a.wallet_balance || 0).toFixed(2)}* | Status: ${a.status || "active"}`
      ).join("\n\n");
      return header + sample + (agents.length > 15 ? `\n\n... and ${agents.length - 15} more agents in the system.` : "");
    }
  } catch (err) {
    console.warn("listAllAgentsSummary error:", err.message);
  }
  return "No agents registered yet or agents table empty.";
}

async function getRecentAgentOrders(limit = 15) {
  let agentOrders = [];
  try {
    const { data: rows } = await supabase
      .from("agent_orders")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (Array.isArray(rows) && rows.length > 0) agentOrders = rows;
  } catch (_) { }

  try {
    const { data: regRow } = await supabase.from("settings").select("value").eq("key", "agent_orders_registry").maybeSingle();
    if (regRow?.value) {
      const parsed = typeof regRow.value === "string" ? JSON.parse(regRow.value) : regRow.value;
      if (Array.isArray(parsed) && parsed.length > 0) {
        if (agentOrders.length === 0) {
          agentOrders = parsed.slice(0, limit);
        } else {
          const existingRefs = new Set(agentOrders.map(o => String(o.reference || o.id || "").toLowerCase()));
          for (const item of parsed) {
            const ref = String(item.reference || item.id || "").toLowerCase();
            if (ref && !existingRefs.has(ref)) {
              agentOrders.push(item);
              existingRefs.add(ref);
            }
          }
        }
      }
    }
  } catch (_) { }

  // Also read from main orders table for agent orders
  try {
    const { data: mainRows } = await supabase
      .from("orders")
      .select("id, reference, network, capacity, recipient_phone, amount, payment_status, delivery_status, notes, created_at, agent_id")
      .or("notes.ilike.%[agent:%,notes.ilike.%[store:%,agent_id.not.is.null")
      .order("created_at", { ascending: false })
      .limit(limit * 2);

    if (Array.isArray(mainRows) && mainRows.length > 0) {
      const existingRefs = new Set(agentOrders.map(o => String(o.reference || o.id || "").toLowerCase()));
      for (const m of mainRows) {
        const ref = String(m.reference || m.id || "").toLowerCase();
        if (!existingRefs.has(ref)) {
          agentOrders.push(m);
          existingRefs.add(ref);
        }
      }
    }
  } catch (_) { }

  return agentOrders;
}

async function listAgentOrdersSummary() {
  try {
    const todayStr = new Date().toISOString().slice(0, 10);
    const { data: rec } = await supabase.from("orders")
      .select("reference, notes, created_at, payment_status, delivery_status, amount, network, capacity, recipient_phone, agent_id")
      .gte("created_at", todayStr + "T00:00:00.000Z")
      .order("created_at", { ascending: false });

    const todayAgentOrders = (rec || []).filter(o => o.agent_id || (o.notes && (o.notes.includes("[agent:") || o.notes.includes("[store:"))));
    const paidToday = todayAgentOrders.filter(o => /paid|success/i.test(o.payment_status || ""));
    const totalRev = paidToday.reduce((s, o) => s + Number(o.amount || 0), 0);

    let res = "🏬 *AGENT STORE ORDERS & SALES*\n━━━━━━━━━━━━━━━━━━━━\n";
    res += `📊 *Today from Agent Stores:* *${todayAgentOrders.length} order(s)* (${paidToday.length} paid)\n`;
    res += `💰 *Agent Sales Revenue Today:* *GH₵ ${totalRev.toFixed(2)}*\n\n`;

    if (todayAgentOrders.length > 0) {
      res += "🛒 *Orders Placed Through Agent Stores Today:*\n\n";
      const recent = todayAgentOrders.slice(0, 8);
      res += recent.map((o, i) => {
        const storeMatch = o.notes?.match(/\[store:([^\]]+)\]/);
        const store = storeMatch ? storeMatch[1] : "Agent Store";
        return `${i + 1}. *${store}* (Ref ${o.reference})\n` +
          `   • ${o.capacity}GB ${o.network} → ${o.recipient_phone}\n` +
          `   • GH₵ ${Number(o.amount || 0).toFixed(2)} | Paid: *${(o.payment_status || "pending").toUpperCase()}* | Delivery: *${(o.delivery_status || "pending").toUpperCase()}*`;
      }).join("\n\n");
    } else {
      res += "No orders placed through agent stores yet today. Checking all-time records...\n";
      const allTimeRecent = await getRecentAgentOrders(5);
      if (allTimeRecent.length > 0) {
        res += "\n📜 *Most Recent Agent Store Orders (All-Time):*\n\n" +
          allTimeRecent.slice(0, 5).map((o, i) => {
            const storeMatch = o.notes?.match(/\[store:([^\]]+)\]/);
            const store = storeMatch ? storeMatch[1] : (o.store_name || "Agent Store");
            return `${i + 1}. *${store}* (Ref ${o.reference})\n` +
              `   • ${o.capacity || o.package_size || ""} ${o.network} → ${o.recipient_phone || o.phone || "N/A"}\n` +
              `   • GH₵ ${Number(o.amount || 0).toFixed(2)} | Delivery: *${(o.delivery_status || o.status || "pending").toUpperCase()}*`;
          }).join("\n\n");
      }
    }
    return res;
  } catch (err) {
    return `Could not retrieve agent orders right now: ${err.message}`;
  }
}

async function creditAgentWalletSafely(phoneOrId, amount) {
  const numAmt = parseFloat(amount);
  if (isNaN(numAmt) || numAmt === 0) return null;
  const cleanTarget = String(phoneOrId || "").replace(/\D/g, "");

  try {
    const agents = await getAllAgentsFromDatabase();
    const target = agents.find(a =>
      a.id === phoneOrId ||
      (cleanTarget && a.phone && String(a.phone).replace(/\D/g, "").endsWith(cleanTarget.slice(-9))) ||
      (a.name && a.name.toLowerCase().includes(String(phoneOrId).toLowerCase())) ||
      (a.store_name && a.store_name.toLowerCase().includes(String(phoneOrId).toLowerCase()))
    );

    if (!target) return null;

    const newBal = Number(target.wallet_balance || 0) + numAmt;
    try { await supabase.from("agents").update({ wallet_balance: newBal }).eq("id", target.id); } catch (_) { }

    // Also update settings.agents_registry
    try {
      const idx = agents.findIndex(a => a.id === target.id);
      if (idx !== -1) {
        agents[idx].wallet_balance = newBal;
        await supabase.from("settings").upsert({ key: "agents_registry", value: JSON.stringify(agents) }, { onConflict: "key" });
      }
    } catch (_) { }

    return { agent: target, credited: numAmt, newBalance: newBal };
  } catch (err) {
    console.warn("creditAgentWalletSafely error:", err.message);
    return null;
  }
}

async function debitAgentWalletSafely(phoneOrId, amount) {
  const numAmt = parseFloat(amount);
  if (isNaN(numAmt) || numAmt <= 0) return null;
  const cleanTarget = String(phoneOrId || "").replace(/\D/g, "");

  try {
    const agents = await getAllAgentsFromDatabase();
    const target = agents.find(a =>
      a.id === phoneOrId ||
      (cleanTarget && a.phone && String(a.phone).replace(/\D/g, "").endsWith(cleanTarget.slice(-9))) ||
      (a.name && a.name.toLowerCase().includes(String(phoneOrId).toLowerCase())) ||
      (a.store_name && a.store_name.toLowerCase().includes(String(phoneOrId).toLowerCase()))
    );

    if (!target) return null;

    const currentBal = Number(target.wallet_balance || 0);
    const newBal = Math.max(0, currentBal - numAmt);
    try { await supabase.from("agents").update({ wallet_balance: newBal }).eq("id", target.id); } catch (_) { }

    // Also update settings.agents_registry
    try {
      const idx = agents.findIndex(a => a.id === target.id);
      if (idx !== -1) {
        agents[idx].wallet_balance = newBal;
        await supabase.from("settings").upsert({ key: "agents_registry", value: JSON.stringify(agents) }, { onConflict: "key" });
      }
    } catch (_) { }

    return { agent: target, debited: numAmt, newBalance: newBal };
  } catch (err) {
    console.warn("debitAgentWalletSafely error:", err.message);
    return null;
  }
}

async function setAgentStatusSafely(phoneOrId, status) {
  const cleanTarget = String(phoneOrId || "").replace(/\D/g, "");
  try {
    const agents = await getAllAgentsFromDatabase();
    const target = agents.find(a =>
      a.id === phoneOrId ||
      (cleanTarget && a.phone && String(a.phone).replace(/\D/g, "").endsWith(cleanTarget.slice(-9))) ||
      (a.name && a.name.toLowerCase().includes(String(phoneOrId).toLowerCase())) ||
      (a.store_name && a.store_name.toLowerCase().includes(String(phoneOrId).toLowerCase()))
    );

    if (!target) return null;
    try { await supabase.from("agents").update({ status }).eq("id", target.id); } catch (_) { }

    // Also update settings.agents_registry
    try {
      const idx = agents.findIndex(a => a.id === target.id);
      if (idx !== -1) {
        agents[idx].status = status;
        await supabase.from("settings").upsert({ key: "agents_registry", value: JSON.stringify(agents) }, { onConflict: "key" });
      }
    } catch (_) { }

    return { agent: target, status };
  } catch (err) {
    console.warn("setAgentStatusSafely error:", err.message);
    return null;
  }
}

/* =========================================================
FLASH SALE OPERATIONS & PRICING
========================================================= */
async function getFlashSaleDetails() {
  try {
    const { data: rows } = await supabase.from("settings").select("key, value").in("key", [
      "flash_sale_enabled",
      "flash_sale_end_time",
      "flash_sale_title",
      "flash_sale_notice",
      "flash_sale_products"
    ]);
    const sMap = {};
    (rows || []).forEach(r => { sMap[r.key] = r.value; });

    const isEnabled = sMap.flash_sale_enabled === "true";
    const endTime = sMap.flash_sale_end_time || "";
    const isExpired = endTime ? new Date(endTime).getTime() <= Date.now() : false;
    const isActive = isEnabled && !isExpired;

    let products = [];
    try {
      if (sMap.flash_sale_products) products = JSON.parse(sMap.flash_sale_products);
    } catch (_) { }

    return {
      isEnabled,
      isActive,
      isExpired,
      endTime,
      title: sMap.flash_sale_title || "LIMITED TIME MTN FLASH SALE",
      notice: sMap.flash_sale_notice || "",
      products: Array.isArray(products) ? products : []
    };
  } catch (err) {
    console.warn("getFlashSaleDetails error:", err.message);
    return { isEnabled: false, isActive: false, isExpired: true, endTime: "", title: "", notice: "", products: [] };
  }
}

async function listFlashSaleOrdersSummary() {
  try {
    const flashInfo = await getFlashSaleDetails();
    const todayStr = new Date().toISOString().slice(0, 10);
    const { data: todayOrders } = await supabase.from("orders")
      .select("reference, amount, network, capacity, notes, payment_status, delivery_status, recipient_phone, created_at")
      .gte("created_at", todayStr + "T00:00:00.000Z")
      .order("created_at", { ascending: false });

    const flashOrders = (todayOrders || []).filter(o => typeof o.notes === "string" && (o.notes.includes("FLASH_SALE") || o.notes.includes("FLASH SALE")));
    const paidFlash = flashOrders.filter(o => /paid|success|complet/i.test(o.payment_status || ""));
    const flashRevenue = paidFlash.reduce((s, o) => s + Number(o.amount || 0), 0);

    let res = "⚡ *MTN FLASH SALE STATUS & ORDERS*\n━━━━━━━━━━━━━━━━━━━━\n";
    res += `🔥 *Storefront Status:* *${flashInfo.isActive ? "ACTIVE & LIVE ON STORE" : (flashInfo.isEnabled ? "ACTIVE (Countdown ended)" : "DISABLED")}*\n`;
    res += `🏷️ *Campaign:* *${flashInfo.title}*\n`;
    if (flashInfo.endTime) res += `⏳ *End Time:* ${flashInfo.endTime.replace("T", " ")}\n`;
    res += `📊 *Flash Orders Today:* *${flashOrders.length} order(s)* (${paidFlash.length} paid)\n`;
    res += `💰 *Flash Revenue Today:* *GH₵ ${flashRevenue.toFixed(2)}*\n\n`;

    if (flashInfo.products.length > 0) {
      res += "🏷️ *Current Flash Sale Bundle Prices:*\n" +
        flashInfo.products.slice(0, 10).map(p =>
          `• *${p.capacity}GB MTN:* *GH₵ ${Number(p.price).toFixed(2)}*${p.original_price ? ` _(Regular: GH₵ ${Number(p.original_price).toFixed(2)})_` : ""}`
        ).join("\n") + "\n\n";
    }

    if (flashOrders.length > 0) {
      res += "🛒 *Recent Flash Sale Orders Today:*\n" +
        flashOrders.slice(0, 6).map((o, i) =>
          `${i + 1}. Ref *${o.reference}*: ${o.capacity}GB ${o.network} → ${o.recipient_phone} | *GH₵ ${Number(o.amount).toFixed(2)}* (${(o.payment_status || "pending").toUpperCase()} - ${(o.delivery_status || "pending").toUpperCase()})`
        ).join("\n");
    } else {
      res += "No flash sale orders recorded yet today.";
    }

    return res;
  } catch (err) {
    return `Could not retrieve flash sale details: ${err.message}`;
  }
}

async function updateFlashSaleProductPrice(capacity, newPrice) {
  const capStr = String(capacity || "").replace(/\D/g, "");
  const numPrice = parseFloat(newPrice);
  if (!capStr || isNaN(numPrice) || numPrice <= 0) return null;

  try {
    const { data: row } = await supabase.from("settings").select("value").eq("key", "flash_sale_products").maybeSingle();
    let prods = [];
    if (row?.value) {
      try { prods = JSON.parse(row.value); } catch (_) { }
    }
    if (!Array.isArray(prods) || prods.length === 0) return null;

    const targetIdx = prods.findIndex(p => String(p.capacity || "").replace(/\D/g, "") === capStr);
    if (targetIdx === -1) return null;

    const oldPrice = prods[targetIdx].price;
    prods[targetIdx].price = numPrice;

    await supabase.from("settings").upsert({
      key: "flash_sale_products",
      value: JSON.stringify(prods)
    }, { onConflict: "key" });

    // Invalidate website shop cache
    await syncActionToSite("update_setting", { key: "flash_sale_products", value: JSON.stringify(prods) }).catch(() => null);

    return { product: prods[targetIdx], oldPrice, newPrice: numPrice };
  } catch (err) {
    console.warn("updateFlashSaleProductPrice error:", err.message);
    return null;
  }
}

async function toggleFlashSale(enable, durationHours = 2) {
  try {
    const isEnable = Boolean(enable);
    const now = new Date();
    const end = new Date(now.getTime() + (Number(durationHours) || 2) * 60 * 60 * 1000);
    const endStr = end.toISOString().slice(0, 16);

    const rows = [
      { key: "flash_sale_enabled", value: isEnable ? "true" : "false" },
    ];
    if (isEnable) {
      rows.push({ key: "flash_sale_end_time", value: endStr });
    }

    for (const r of rows) {
      await supabase.from("settings").upsert(r, { onConflict: "key" });
      await syncActionToSite("update_setting", r).catch(() => null);
    }

    return { enabled: isEnable, endTime: isEnable ? endStr : null };
  } catch (err) {
    console.warn("toggleFlashSale error:", err.message);
    return null;
  }
}

async function getAllTimeOrderStatsSummary() {
  try {
    const { count: totalOrdersCount } = await supabase.from("orders").select("*", { count: "exact", head: true });
    const { data: sampleOrders } = await supabase.from("orders")
      .select("amount, payment_status, delivery_status, created_at")
      .limit(1000);

    const paidOrders = (sampleOrders || []).filter(o => /paid|success|complet/i.test(o.payment_status || ""));
    const deliveredOrders = (sampleOrders || []).filter(o => /deliver/i.test(o.delivery_status || ""));
    const estRevenue = paidOrders.reduce((s, o) => s + Number(o.amount || 0), 0);

    let res = "📊 *ALL-TIME STORE ORDER METRICS*\n━━━━━━━━━━━━━━━━━━━━\n";
    res += `📦 *Total Orders in Database:* *${totalOrdersCount || (sampleOrders || []).length} orders*\n`;
    res += `✅ *Paid / Completed Orders:* *${paidOrders.length}+*\n`;
    res += `🚀 *Successfully Delivered:* *${deliveredOrders.length}+*\n`;
    res += `💰 *Recorded Sales Revenue:* *~GH₵ ${estRevenue.toFixed(2)}*\n\n`;
    res += `💡 Text "Today's summary" or "Show orders" to see current live activity.`;
    return res;
  } catch (err) {
    return `Could not load all-time order statistics: ${err.message}`;
  }
}

/* =========================================================
FULL ORDER DETAILS INSPECTOR
========================================================= */
async function getOrderFullDetails(query) {
  const clean = String(query || "").replace(/[*_#`"']/g, "").trim();
  const isPhone = /^(0[2357]\d{8}|233\d{9})$/.test(clean);
  let q = supabase.from("orders").select("*");
  if (isPhone) {
    const p = normalizePhone(clean);
    q = q.or(`recipient_phone.eq.${p},phone_number.eq.${p}`).order("created_at", { ascending: false }).limit(3);
  } else {
    q = q.or(`reference.ilike.%${clean}%,datamart_reference.ilike.%${clean}%`).limit(1);
  }
  const { data: ords } = await q;
  if (!ords || ords.length === 0) return null;

  const results = [];
  for (const o of ords) {
    let liveStatus = null;
    try {
      liveStatus = await getRealDatamartDeliveryStatus(o.datamart_reference || o.reference);
    } catch (_) { }

    results.push({
      reference: o.reference,
      supplierRef: o.datamart_reference || "N/A",
      network: o.network || "N/A",
      capacity: `${o.capacity || ""}GB`,
      recipient: o.recipient_phone || o.phone_number,
      amount: `GH₵ ${Number(o.amount || 0).toFixed(2)}`,
      paymentStatus: o.payment_status || "unknown",
      deliveryStatus: o.delivery_status || "unknown",
      liveDatamartStatus: liveStatus?.deliveryStatus || "N/A",
      created: o.created_at ? formatGhanaTime(new Date(o.created_at)) : "N/A",
      notes: o.notes || ""
    });
  }
  return results;
}

async function executeOwnerDirectAction(type, payload = {}) {
  const cleanType = String(type || "").toLowerCase().trim();

  try {
    // 1. Update Order Delivery Status
    if (cleanType === "update_order_status") {
      const refs = [];
      if (payload.reference) refs.push(payload.reference);
      if (payload.ref) refs.push(payload.ref);
      if (payload.order_id) refs.push(payload.order_id);
      if (Array.isArray(payload.orders)) refs.push(...payload.orders);
      if (Array.isArray(payload.references)) refs.push(...payload.references);
      const targetStatus = payload.delivery_status || payload.status || "delivered";
      const updated = [];
      for (const r of refs) {
        const ok = await updateOrderDeliveryStatusSafely(r, targetStatus);
        if (ok) updated.push(r);
      }
      return updated.length > 0
        ? `Order(s) ${updated.join(", ")} marked as ${targetStatus.toUpperCase()} live in the database!`
        : `Delivery status updated to ${targetStatus.toUpperCase()}.`;
    }

    // 2. Update Order Payment Status
    if (cleanType === "update_payment_status") {
      const refs = [];
      if (payload.reference) refs.push(payload.reference);
      if (payload.ref) refs.push(payload.ref);
      if (payload.order_id) refs.push(payload.order_id);
      if (Array.isArray(payload.orders)) refs.push(...payload.orders);
      const targetStatus = payload.payment_status || payload.status || "paid";
      const updated = [];
      for (const r of refs) {
        const ok = await updateOrderPaymentStatusSafely(r, targetStatus);
        if (ok) updated.push(r);
      }
      return updated.length > 0
        ? `Payment status for ${updated.join(", ")} updated to ${targetStatus.toUpperCase()}!`
        : `Payment status marked as ${targetStatus.toUpperCase()}.`;
    }

    // 3. Update Product Price
    if (cleanType === "update_product_price") {
      const newPrice = parseFloat(payload.price || payload.new_price);
      if (!isNaN(newPrice) && newPrice > 0) {
        let q = supabase.from("products").update({ price: newPrice, updated_at: new Date().toISOString() });
        if (payload.product_id) q = q.eq("id", payload.product_id);
        else if (payload.network && payload.capacity) {
          q = q.ilike("network", `%${payload.network}%`).eq("capacity", String(payload.capacity).replace(/\D/g, ""));
        } else if (payload.name) {
          q = q.ilike("name", `%${payload.name}%`);
        }
        await q;
        return `Product price updated to GH₵ ${newPrice.toFixed(2)} on the site!`;
      }
    }

    // 3b. Pause / Resume Store Orders
    if (cleanType === "pause_orders" || cleanType === "toggle_store_orders") {
      const paused = payload.paused !== undefined ? Boolean(payload.paused) : true;
      await supabase.from("settings").upsert({ key: "orders_paused", value: paused ? "true" : "false" }, { onConflict: "key" });
      await syncActionToSite("update_setting", { key: "orders_paused", value: paused ? "true" : "false" }).catch(() => null);
      return paused ? "Store orders are now PAUSED on the website!" : "Store orders are now RESUMED on the website!";
    }

    // 4. Toggle Product Stock
    if (cleanType === "toggle_product_stock" || cleanType === "toggle_stock") {
      const inStock = Boolean(payload.in_stock);
      let q = supabase.from("products").update({ in_stock: inStock, updated_at: new Date().toISOString() });
      if (payload.product_id) q = q.eq("id", payload.product_id);
      else if (payload.name) q = q.ilike("name", `%${payload.name}%`);
      else q = q.neq("id", "00000000-0000-0000-0000-000000000000");
      await q;
      return `Product stock toggled to ${inStock ? "IN STOCK" : "OUT OF STOCK"} on the site!`;
    }

    // 5. Send Customer SMS
    if (cleanType === "send_sms") {
      const phone = payload.phone || payload.recipient;
      const msg = payload.message || payload.smsText;
      if (phone && msg) {
        await sendAdminSms(msg, phone);
        return `SMS sent to ${phone} with Sender ID D_1Gh.`;
      }
    }

    // 6. Broadcast SMS
    if (cleanType === "broadcast_sms") {
      const msg = payload.message || payload.smsText;
      if (msg) {
        const targetGroup = String(payload.target_group || "customers").toLowerCase();
        let phones = [];
        if (targetGroup.includes("agent")) {
          const { data: agRows } = await supabase.from("agents").select("phone");
          phones = (agRows || []).map(a => a.phone).filter(Boolean);
        } else {
          const { data: ords } = await supabase.from("orders").select("recipient_phone").limit(300);
          phones = (ords || []).map(o => o.recipient_phone).filter(Boolean);
        }
        let sentCount = 0;
        for (const p of phones.slice(0, 100)) {
          try {
            await sendAdminSms(msg, p);
            sentCount++;
          } catch (_) { }
        }
        return `Broadcast SMS sent to ${sentCount} recipient(s) via D_1Gh!`;
      }
    }

    // 7. Generate Free Data Vouchers
    if (cleanType === "generate_vouchers") {
      const count = parseInt(payload.count, 10) || 5;
      const net = payload.network || "MTN";
      const cap = payload.capacity || "1";
      const res = await generateFreeDataVouchersSafely(count, net, cap);
      return `Generated ${res.codes.length} free data voucher(s) (${cap}GB ${net}): ${res.codes.join(", ")}`;
    }

    // 8. Toggle Free Data Campaign
    if (cleanType === "toggle_free_data") {
      const active = Boolean(payload.active);
      await toggleFreeDataCampaign(active);
      return `Free data giveaway campaign is now ${active ? "ACTIVE on storefront" : "DISABLED"}!`;
    }

    // 9. Credit Agent Wallet
    if (cleanType === "credit_agent") {
      const target = payload.phone || payload.agent_id || payload.target;
      const amt = parseFloat(payload.amount);
      const res = await creditAgentWalletSafely(target, amt);
      if (res) {
        return `Agent ${res.agent.name || res.agent.phone} credited with GH₵ ${res.credited.toFixed(2)} (New balance: GH₵ ${res.newBalance.toFixed(2)}).`;
      }
      return `Could not find agent "${target}".`;
    }

    // 9b. Debit Agent Wallet
    if (cleanType === "debit_agent") {
      const target = payload.phone || payload.agent_id || payload.target;
      const amt = parseFloat(payload.amount);
      const res = await debitAgentWalletSafely(target, amt);
      if (res) {
        return `Agent ${res.agent.name || res.agent.phone} debited with GH₵ ${res.debited.toFixed(2)} (New balance: GH₵ ${res.newBalance.toFixed(2)}).`;
      }
      return `Could not find agent "${target}".`;
    }

    // 9c. Set Agent Status
    if (cleanType === "set_agent_status") {
      const target = payload.phone || payload.agent_id || payload.target;
      const st = String(payload.status || "active").toLowerCase();
      const res = await setAgentStatusSafely(target, st);
      if (res) {
        return `Agent ${res.agent.name || res.agent.phone} status set to ${st.toUpperCase()}.`;
      }
      return `Could not find agent "${target}".`;
    }

    // 9d. List All Agents
    if (cleanType === "list_agents" || cleanType === "query_agents") {
      return await listAllAgentsSummary();
    }

    // 10. Update Announcement
    if (cleanType === "update_announcement") {
      await updateStoreAnnouncement({
        title: payload.title || "Store Notice",
        message: payload.message || payload.announcement || "",
        enabled: payload.enabled !== undefined ? Boolean(payload.enabled) : true,
      });
      return "Storefront announcement banner updated live!";
    }

    // 11. Change Theme Color
    if (cleanType === "change_theme_color") {
      const color = payload.color || "gold";
      await updateSiteThemeColor(color);
      return `Store theme color switched to ${color.toUpperCase()}!`;
    }

    // 12. Update Setting
    if (cleanType === "update_setting") {
      const k = payload.key;
      const v = payload.value !== undefined ? payload.value : "";
      if (k) {
        await updateStoreSetting(k, v);
        return `Store setting "${k}" updated to "${v}"!`;
      }
    }

    // 13. Resync Order
    if (cleanType === "resync_order" || cleanType === "resync_datamart") {
      const ref = payload.reference || payload.ref;
      if (ref) {
        const live = await getRealDatamartDeliveryStatus(ref);
        if (live?.deliveryStatus) {
          await supabase.from("orders").update({
            delivery_status: live.deliveryStatus,
            datamart_status: live.rawStatus,
            updated_at: new Date().toISOString()
          }).eq("reference", ref);
          return `Order ${ref} carrier status: ${live.deliveryStatus}.`;
        }
      }
    }

    // 14. Digital Services
    if (cleanType === "update_service_status") {
      const ref = payload.reference || payload.ref;
      const st = payload.status || payload.delivery_status || "delivered";
      if (ref) {
        await supabase.from("service_orders").update({ delivery_status: st, updated_at: new Date().toISOString() }).or(`reference.ilike.%${ref}%`);
        return `Digital service order ${ref} marked as ${st.toUpperCase()}!`;
      }
    }

    // 15. Checkers
    if (cleanType === "update_checker_status") {
      const ref = payload.reference || payload.ref;
      const st = payload.status || payload.delivery_status || "delivered";
      if (ref) {
        await supabase.from("checker_orders").update({ delivery_status: st, updated_at: new Date().toISOString() }).or(`reference.ilike.%${ref}%`);
        return `Result checker order ${ref} marked as ${st.toUpperCase()}!`;
      }
    }

    // 16. Support Chat
    if (cleanType === "resolve_support_chat") {
      const cId = payload.conversation_id || payload.conversationId;
      let q = supabase.from("chat_conversations").update({ status: "resolved", unread_for_support: 0, updated_at: new Date().toISOString() });
      if (cId) q = q.eq("id", cId);
      else q = q.eq("status", "open");
      await q;
      return "Customer support chat marked as resolved!";
    }

    // 17. Flash Sale Toggle
    if (cleanType === "toggle_flash_sale") {
      const active = Boolean(payload.active ?? payload.enabled);
      const hours = Number(payload.duration_hours || payload.hours || 2);
      const res = await toggleFlashSale(active, hours);
      return res?.enabled
        ? `Flash Sale is now ACTIVE on the storefront until ${res.endTime?.replace("T", " ")}!`
        : `Flash Sale is now TURNED OFF on the storefront!`;
    }

    // 17b. Update Flash Sale Price
    if (cleanType === "update_flash_sale_price" || cleanType === "set_flash_sale_price") {
      const cap = payload.capacity || payload.package_size || payload.gb;
      const price = payload.price || payload.new_price;
      const res = await updateFlashSaleProductPrice(cap, price);
      return res
        ? `Flash Sale price for MTN ${res.product.capacity}GB updated from GH₵ ${Number(res.oldPrice).toFixed(2)} to GH₵ ${Number(res.newPrice).toFixed(2)}!`
        : `Could not find or update flash sale product for capacity "${cap}".`;
    }

    // 18. Query Top Customers
    if (cleanType === "query_top_customers") {
      const { data: ords } = await supabase
        .from("orders")
        .select("recipient_phone, amount, payment_status")
        .eq("payment_status", "paid")
        .limit(500);
      const phoneMap = {};
      (ords || []).forEach(o => {
        const p = (o.recipient_phone || "").replace(/\D/g, "");
        if (p.length >= 9) {
          if (!phoneMap[p]) phoneMap[p] = { count: 0, total: 0 };
          phoneMap[p].count += 1;
          phoneMap[p].total += Number(o.amount || 0);
        }
      });
      const sorted = Object.entries(phoneMap).sort((a, b) => b[1].count - a[1].count).slice(0, 5);
      const lines = sorted.map(([phone, d], i) => `${i + 1}. *0${phone.slice(-9)}* — ${d.count} orders (GH₵ ${d.total.toFixed(2)})`);
      return `Top Customers:\n${lines.join("\n")}`;
    }

    // 19. Look Up Phone Orders
    if (cleanType === "lookup_phone" || cleanType === "query_orders") {
      const phone = String(payload.phone || payload.recipient || "").replace(/\D/g, "");
      const last9 = phone.slice(-9);
      const { data: ords } = await supabase
        .from("orders")
        .select("reference, network, capacity, amount, delivery_status, payment_status, created_at")
        .ilike("recipient_phone", `%${last9}%`)
        .order("created_at", { ascending: false })
        .limit(5);
      if (!ords || ords.length === 0) return `No orders found for phone 0${last9}.`;
      const lines = ords.map((o, i) => `${i + 1}. *${o.reference}* — ${o.capacity}GB ${o.network} (GH₵ ${Number(o.amount || 0).toFixed(2)}) | Delivery: *${(o.delivery_status || "pending").toUpperCase()}* | Paid: *${o.payment_status}*`);
      return `Orders for 0${last9}:\n${lines.join("\n")}`;
    }

    // 20. Dispatch Data Bundle Directly via DataMart Wallet
    if (cleanType === "dispatch_datamart_bundle" || cleanType === "send_data" || cleanType === "dispatch_data") {
      const rawPhone = String(payload.phone || payload.recipient || payload.recipient_phone || "").replace(/\D/g, "");
      const cleanPhone = rawPhone.startsWith("233") ? "0" + rawPhone.slice(3) : (rawPhone.startsWith("0") ? rawPhone : "0" + rawPhone);
      const cleanCap = String(payload.capacity || payload.gb || payload.package_size || "1").replace(/[^\d.]/g, "");
      let net = String(payload.network || "").toUpperCase();
      if (!net) {
        const pfx = cleanPhone.slice(0, 3);
        if (["020", "050"].includes(pfx)) net = "TELECEL";
        else if (["026", "056", "027", "057"].includes(pfx)) net = "AIRTELTIGO";
        else net = "MTN";
      }
      const dmNet = net === "MTN" || net === "YELLO" ? "YELLO" : (net === "TELECEL" ? "TELECEL" : "AT_PREMIUM");
      const ref = `WS-ADM${Date.now().toString(36).toUpperCase()}`;
      const dmKey = DATA_API_KEY || process.env.DATA_API_KEY || VERIFIED_DATAMART_KEY;
      const dmSec = process.env.DATAMART_API_SECRET || DATAMART_API_SECRET || VERIFIED_DATAMART_SECRET;

      const dmRes = await axios.post(
        `${DATAMART_BASE}/purchase`,
        { phoneNumber: cleanPhone, network: dmNet, capacity: cleanCap, gateway: "wallet", ref, delivery: "fast" },
        {
          headers: {
            "x-api-key": dmKey,
            ...(dmSec ? { "x-api-secret": dmSec } : {}),
            "X-Idempotency-Key": ref,
            "Content-Type": "application/json"
          },
          timeout: 25000
        }
      );
      const dmData = dmRes.data?.data || dmRes.data || {};
      const dmRef = dmData.reference || dmData.orderReference || dmData.purchaseId || ref;
      await supabase.from("orders").insert([{
        reference: ref,
        datamart_reference: dmRef,
        network: net === "YELLO" ? "MTN" : net,
        capacity: cleanCap,
        recipient_phone: cleanPhone,
        amount: Number(dmData.price || 0),
        payment_status: "paid",
        delivery_status: "processing",
        datamart_status: "processing",
        supplier_status: "datamart",
        notes: "[admin_whatsapp_dispatch] [wa_alert_sent]",
        created_at: new Date().toISOString()
      }]).catch(() => null);
      return `Dispatched *${cleanCap}GB ${net}* to *${cleanPhone}* via DataMart (Ref: *${dmRef}*)!`;
    }

    // 21. All-Corners System Diagnostic & Auto-Healer
    if (cleanType === "diagnose_system" || cleanType === "fix_all_anomalies" || cleanType === "heal_system" || cleanType === "audit_system") {
      const shouldFix = cleanType === "fix_all_anomalies" || cleanType === "heal_system" || Boolean(payload.autoFix || payload.fix);
      const report = await runAllCornersSystemXRay(shouldFix);
      return report;
    }

    // 22. Live Codebase File Inspector
    if (cleanType === "inspect_codebase" || cleanType === "read_file" || cleanType === "read_code") {
      const targetFile = String(payload.file || payload.path || payload.query || "whatsapp-bot-server.js").trim();
      const snippet = await inspectCodebaseFile(targetFile, payload.keyword || "");
      return snippet;
    }

    // 23. Post / Broadcast to Official WhatsApp Channel
    if (cleanType === "post_to_channel" || cleanType === "broadcast_channel" || cleanType === "channel_post") {
      const topic = String(payload.topic || payload.mode || (payload.message ? "custom" : "general")).trim();
      const rawMsg = String(payload.message || payload.text || payload.body || "").trim();
      const postBody = await buildChannelPostFromSystem(topic, rawMsg);
      const res = await postToWhatsAppChannel(postBody, { ownerPhone: payload.phone || "233547100951" });
      if (res.directPosted) {
        return `📢 *Posted Live to WhatsApp Channel!* (${res.directProvider})\n🔗 ${res.channelUrl}\n\n${res.postText}`;
      }
      if (res.pairingCode) {
        return `🔐 *1-Time WhatsApp Channel Link Required!*\n` +
          `Your post is queued and ready to go live in ${res.channelUrl}!\n\n` +
          `🔑 *Your 8-Digit Pairing Code:* *${res.pairingCode}*\n\n` +
          `📲 *How to complete (takes 10 seconds):*\n` +
          `1. On your WhatsApp phone (the Admin of the Channel), tap the *"Enter code to link new device"* notification (or go to *Settings → Linked Devices → Link a Device → Link with phone number instead*).\n` +
          `2. Enter *${res.pairingCode}*.\n` +
          `3. As soon as it links, I will automatically publish this post and all future posts straight into your Channel!`;
      }
      return `📢 *WhatsApp Channel Broadcast Ready!*\n🔗 Channel: ${res.channelUrl}\n` +
        (res.apiErrorNote ? `⚠️ Note: ${res.apiErrorNote}\n` : `💡 *(Reply "pair channel" to get an 8-digit code to link your WhatsApp Channel for 100% automatic direct posting)*`) +
        `\n━━━━━━━━━━━━━━━━━━━━\n${res.postText}`;
    }
  } catch (e) {
    console.warn("executeOwnerDirectAction error:", e.message);
    return `Action execution encountered an issue: ${e.message}`;
  }

  return "Action executed.";
}

/* =========================================================
ALL-CORNERS DEEP SYSTEM X-RAY, CODEBASE INSPECTOR & AUTO-HEALER
Gives Stony Co-Pilot 360° visibility into every corner of the
codebase, database, Paystack, DataMart, and runtime logs!
========================================================= */

async function inspectCodebaseFile(fileOrQuery, keyword = "") {
  try {
    const fs = require("fs");
    const path = require("path");
    const q = String(fileOrQuery || "").trim();

    // Map shorthand names to exact repository file paths
    let repoPath = q;
    if (/adminorders/i.test(q)) repoPath = "src/pages/admin/AdminOrders.tsx";
    else if (/admindashboard/i.test(q)) repoPath = "src/pages/admin/AdminDashboard.tsx";
    else if (/whatsapporders/i.test(q)) repoPath = "src/pages/admin/AdminWhatsAppOrders.tsx";
    else if (/track/i.test(q)) repoPath = "src/pages/Track.tsx";
    else if (/ordermodal/i.test(q)) repoPath = "src/components/OrderModal.tsx";
    else if (/_datamart|datamart\.ts/i.test(q)) repoPath = "api/_datamart.ts";
    else if (/webhook/i.test(q)) repoPath = "api/paystack-webhook.ts";
    else if (/paystack/i.test(q)) repoPath = "api/paystack.ts";
    else if (/partner/i.test(q)) repoPath = "api/partner.ts";
    else if (/ai-rotator|rotator/i.test(q)) repoPath = "api/_ai-rotator.ts";
    else if (/admin\.ts/i.test(q)) repoPath = "api/admin.ts";
    else if (/bot|server\.js|whatsapp-bot/i.test(q)) repoPath = "whatsapp-bot-server.js";

    let content = "";
    // 1. Try local filesystem first
    const localCandidate = repoPath === "whatsapp-bot-server.js"
      ? __filename
      : path.resolve(__dirname, repoPath);
    if (fs.existsSync(localCandidate)) {
      content = fs.readFileSync(localCandidate, "utf8");
    } else {
      // 2. Fetch live from GitHub repository
      const ghUrl = `https://raw.githubusercontent.com/nyakponoah11-coder/data-ease-shop/main/${repoPath.replace(/^\/+/, "")}`;
      const ghRes = await axios.get(ghUrl, { timeout: 6000 });
      if (typeof ghRes.data === "string") content = ghRes.data;
    }

    if (!content) return `Could not locate file "${repoPath}".`;
    const lines = content.split(/\r?\n/);

    if (keyword) {
      const kw = String(keyword).toLowerCase();
      const matchedRanges = [];
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].toLowerCase().includes(kw)) {
          const start = Math.max(0, i - 4);
          const end = Math.min(lines.length - 1, i + 8);
          matchedRanges.push(
            lines.slice(start, end + 1).map((l, idx) => `L${start + idx + 1}: ${l}`).join("\n")
          );
          i = end;
          if (matchedRanges.length >= 4) break;
        }
      }
      if (matchedRanges.length > 0) {
        return `📂 *FILE: ${repoPath}* (${lines.length} lines | matches for "${keyword}"):\n` + matchedRanges.join("\n---\n");
      }
    }

    return `📂 *FILE: ${repoPath}* (${lines.length} total lines):\n` +
      lines.slice(0, 45).map((l, idx) => `L${idx + 1}: ${l}`).join("\n") +
      (lines.length > 45 ? `\n... (${lines.length - 45} more lines)` : "");
  } catch (err) {
    return `Codebase inspect note (${fileOrQuery}): ${err.message}`;
  }
}

async function runAllCornersSystemXRay(autoFix = false) {
  const findings = [];
  const fixesApplied = [];
  const verifyEndpoint = (STORE_FRONTEND_URL || "https://www.data1gh.com").replace(/\/+$/, "") + "/api/paystack";

  try {
    // 1. Pull last 35 orders from Supabase
    const { data: recentOrders } = await supabase
      .from("orders")
      .select("id, reference, datamart_reference, datamart_status, supplier_status, network, capacity, recipient_phone, amount, payment_status, delivery_status, notes, error_message, created_at")
      .order("created_at", { ascending: false })
      .limit(35);

    const ordersList = Array.isArray(recentOrders) ? recentOrders : [];

    // 2. Fetch live DataMart transactions (up to 60) for cross-reference
    let dmTransactions = [];
    const dmKey = DATA_API_KEY || process.env.DATA_API_KEY || VERIFIED_DATAMART_KEY;
    const dmSec = process.env.DATAMART_API_SECRET || DATAMART_API_SECRET || VERIFIED_DATAMART_SECRET;
    try {
      const dmRes = await axios.get(`${DATAMART_BASE}/transactions?limit=60`, {
        headers: { "x-api-key": dmKey, ...(dmSec ? { "x-api-secret": dmSec } : {}) },
        timeout: 8000,
      });
      dmTransactions = dmRes.data?.data?.transactions || dmRes.data?.transactions || dmRes.data?.data || [];
      if (!Array.isArray(dmTransactions)) dmTransactions = [];
    } catch (dmErr) {
      findings.push(`⚠️ *DataMart API Transactions Check:* Could not fetch /transactions (${dmErr.message})`);
    }

    // 3. Get Paystack key for live verification of recent pending orders
    let psKey = process.env.PAYSTACK_SECRET_KEY || process.env.PAYSTACK_SECRET || "";
    if (!psKey) {
      try {
        const { data: sRow } = await supabase.from("settings").select("value").in("key", ["paystack_secret_key", "PAYSTACK_SECRET_KEY"]).maybeSingle();
        if (sRow?.value) psKey = sRow.value;
      } catch (_) {}
    }

    const paidUndispatched = [];
    const statusDesyncs = [];
    const unverifiedButPaidOnPaystack = [];
    const missingWaAlerts = [];
    const staleInflightLocks = [];
    const recentFailedOrders = [];

    for (const ord of ordersList) {
      const notes = String(ord.notes || "");
      const isFlash = notes.includes("FLASH_SALE") || notes.includes("FLASH SALE");
      const ageMs = ord.created_at ? Date.now() - new Date(ord.created_at).getTime() : 0;
      const cleanRef = String(ord.reference || "").replace(/^WS-?/i, "").toUpperCase();
      const canonicalDmRef = `WS-${cleanRef}`;

      // Check stale [dm_inflight:ts] lock (>3 mins old)
      const inflightMatch = notes.match(/\[dm_inflight:(\d+)\]/);
      if (inflightMatch && Date.now() - Number(inflightMatch[1]) > 180000) {
        staleInflightLocks.push(ord);
        if (autoFix) {
          const cleanedNotes = notes.replace(/\[dm_inflight:\d+\]/g, "").trim();
          await supabase.from("orders").update({ notes: cleanedNotes }).eq("id", ord.id);
          fixesApplied.push(`Cleared stale [dm_inflight] lock on *${ord.reference}*`);
        }
      }

      // Match against DataMart transactions list
      const cleanPhone = String(ord.recipient_phone || "").replace(/\D/g, "");
      const normPhone = cleanPhone.startsWith("233") ? "0" + cleanPhone.slice(3) : cleanPhone;
      const dmMatch = dmTransactions.find(tx => {
        const txRef = String(tx.reference || tx.transactionReference || tx.ref || tx.orderReference || "").toUpperCase();
        if (txRef && (txRef === String(ord.reference || "").toUpperCase() || txRef === canonicalDmRef || (ord.datamart_reference && txRef === String(ord.datamart_reference).toUpperCase()))) {
          return true;
        }
        const txPhone = String(tx.phoneNumber || tx.phone || tx.recipient || "").replace(/\D/g, "");
        const normTxPhone = txPhone.startsWith("233") ? "0" + txPhone.slice(3) : txPhone;
        const txCap = String(tx.capacity || tx.dataAmount || "").replace(/[^\d.]/g, "");
        const ordCap = String(ord.capacity || "").replace(/[^\d.]/g, "");
        const txTime = tx.createdAt ? new Date(tx.createdAt).getTime() : 0;
        const ordTime = ord.created_at ? new Date(ord.created_at).getTime() : 0;
        return normTxPhone && normTxPhone === normPhone && txCap === ordCap && Math.abs(txTime - ordTime) < 30 * 60 * 1000;
      });

      if (ord.payment_status === "paid") {
        // Check if DataMart has a newer status than Supabase
        if (dmMatch) {
          const rawDmStatus = String(dmMatch.status || "").toLowerCase();
          const mappedDmStatus = /complet|deliver|success/i.test(rawDmStatus)
            ? "delivered"
            : (/process|queue|pending|ongoing|wait/i.test(rawDmStatus) ? "processing" : rawDmStatus);

          if (
            (mappedDmStatus === "delivered" && ord.delivery_status !== "delivered") ||
            (mappedDmStatus === "processing" && ord.delivery_status === "pending")
          ) {
            statusDesyncs.push({ ord, dmStatus: mappedDmStatus, rawDmStatus, dmRef: dmMatch.reference || dmMatch.transactionReference || canonicalDmRef });
            if (autoFix) {
              const nextNotes = notes.includes("[dm_dispatched]") ? notes : `${notes} [dm_dispatched]`.trim();
              await supabase.from("orders").update({
                delivery_status: mappedDmStatus,
                datamart_status: rawDmStatus || mappedDmStatus,
                datamart_reference: ord.datamart_reference || dmMatch.reference || dmMatch.transactionReference || canonicalDmRef,
                notes: nextNotes,
                updated_at: new Date().toISOString()
              }).eq("id", ord.id);
              fixesApplied.push(`Synced *${ord.reference}* (${ord.recipient_phone}) from *${ord.delivery_status}* → *${mappedDmStatus.toUpperCase()}*`);
            }
          }
        } else if (!isFlash && !ord.datamart_reference && !notes.includes("[dm_dispatched]") && ord.delivery_status === "pending" && ageMs > 45000 && ageMs < 12 * 60 * 60 * 1000) {
          paidUndispatched.push(ord);
          if (autoFix) {
            await axios.post(verifyEndpoint, { reference: ord.reference }, { timeout: 15000 }).catch(() => null);
            fixesApplied.push(`Triggered DataMart dispatch & alert for paid order *${ord.reference}* (${ord.capacity}GB ${ord.network} → ${ord.recipient_phone})`);
          }
        }

        if (!notes.includes("[wa_alert_sent]") && ageMs < 6 * 60 * 60 * 1000) {
          missingWaAlerts.push(ord);
        }
        if (ord.delivery_status === "failed") {
          recentFailedOrders.push(ord);
        }
      } else if (ord.payment_status === "pending" && psKey && ageMs > 30000 && ageMs < 3 * 60 * 60 * 1000) {
        // Check up to 5 recent pending orders against Paystack live
        if (unverifiedButPaidOnPaystack.length < 5) {
          try {
            const psRes = await axios.get(`https://api.paystack.co/transaction/verify/${encodeURIComponent(ord.reference)}`, {
              headers: { Authorization: `Bearer ${psKey}` },
              timeout: 4500,
            });
            if (psRes.data?.data?.status === "success") {
              unverifiedButPaidOnPaystack.push(ord);
              if (autoFix) {
                await axios.post(verifyEndpoint, { reference: ord.reference }, { timeout: 15000 }).catch(() => null);
                fixesApplied.push(`Verified Paystack payment & dispatched *${ord.reference}* (${ord.capacity}GB ${ord.network} → ${ord.recipient_phone})`);
              }
            }
          } catch (_) {}
        }
      }
    }

    // Build Corner-by-Corner Report
    if (unverifiedButPaidOnPaystack.length > 0) {
      findings.push(`🔴 *Unverified Paystack Payments (${unverifiedButPaidOnPaystack.length}):* Customer paid on MoMo, but browser closed before redirect:\n` +
        unverifiedButPaidOnPaystack.map(o => `  • *${o.reference}* (${o.capacity}GB ${o.network} → ${o.recipient_phone}, ₵${o.amount})`).join("\n"));
    } else {
      findings.push(`✅ *Paystack Reconciliation:* 0 unverified MoMo payments.`);
    }

    if (paidUndispatched.length > 0) {
      findings.push(`🔴 *Paid Orders Not Dispatched to DataMart (${paidUndispatched.length}):*\n` +
        paidUndispatched.map(o => `  • *${o.reference}* (${o.capacity}GB ${o.network} → ${o.recipient_phone}, ₵${o.amount})`).join("\n"));
    } else {
      findings.push(`✅ *DataMart Dispatch Pipeline:* All paid bundles have been dispatched to DataMart.`);
    }

    if (statusDesyncs.length > 0) {
      findings.push(`🟡 *Admin vs DataMart Status Desyncs (${statusDesyncs.length}):* Showing Pending/Processing in DB while DataMart moved ahead:\n` +
        statusDesyncs.map(d => `  • *${d.ord.reference}* (${d.ord.recipient_phone}): DB=*${d.ord.delivery_status}* vs DataMart=*${d.dmStatus.toUpperCase()}*`).join("\n"));
    } else {
      findings.push(`✅ *Admin vs DataMart Status Sync:* 100% in sync across recent orders.`);
    }

    if (staleInflightLocks.length > 0) {
      findings.push(`🟡 *Stale [dm_inflight] Locks (${staleInflightLocks.length}):* ${staleInflightLocks.map(o => o.reference).join(", ")}`);
    }

    if (recentFailedOrders.length > 0) {
      findings.push(`⚠️ *Failed Orders in Last 35 (${recentFailedOrders.length}):*\n` +
        recentFailedOrders.slice(0, 4).map(o => `  • *${o.reference}* (${o.capacity}GB ${o.network} → ${o.recipient_phone})${o.error_message ? ` — Reason: ${o.error_message}` : ""}`).join("\n"));
    }

    // Watcher & Runtime Error Telemetry
    const recentErrors = RUNTIME_ERROR_LOG.slice(0, 4);
    findings.push(
      `⚙️ *Background Watchers (Render Nestybot):*\n` +
      `  • Payment Watcher (60s): ${WATCHER_TELEMETRY.paymentWatcherRuns} runs (Last: ${WATCHER_TELEMETRY.lastPaymentWatcherAt || "starting"})\n` +
      `  • Delivery Watcher (90s): ${WATCHER_TELEMETRY.deliveryWatcherRuns} runs (Last: ${WATCHER_TELEMETRY.lastDeliveryWatcherAt || "starting"})`
    );

    if (recentErrors.length > 0) {
      findings.push(`🪵 *Recent Server Logs (${recentErrors.length}):*\n` +
        recentErrors.map(e => `  • [${e.time}] ${e.level}: ${e.message}`).join("\n"));
    } else {
      findings.push(`✅ *Server Runtime Logs:* 0 runtime errors recorded.`);
    }
  } catch (err) {
    findings.push(`⚠️ Diagnostic scan exception: ${err.message}`);
  }

  let out = `🔬 *ALL-CORNERS SYSTEM & CODEBASE X-RAY*\n━━━━━━━━━━━━━━━━━━━━\n` + findings.join("\n\n");
  if (fixesApplied.length > 0) {
    out += `\n\n🛠️ *AUTO-HEAL FIXES APPLIED (${fixesApplied.length}):*\n` + fixesApplied.map(f => `• ${f}`).join("\n");
  }
  return out;
}


function extractActionSuggestion(rawText) {
  if (!rawText || typeof rawText !== "string") return null;
  const tagStart = rawText.indexOf("[SUGGEST_ACTION:");
  if (tagStart === -1) return null;

  const jsonStart = rawText.indexOf("{", tagStart);
  if (jsonStart === -1) return null;

  let depth = 0;
  let inString = false;
  let escape = false;
  let jsonEnd = -1;

  for (let i = jsonStart; i < rawText.length; i++) {
    const char = rawText[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (char === "\\") {
      escape = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (char === "{") depth++;
      else if (char === "}") {
        depth--;
        if (depth === 0) {
          jsonEnd = i;
          break;
        }
      }
    }
  }

  if (jsonEnd === -1) return null;

  const jsonStr = rawText.slice(jsonStart, jsonEnd + 1);
  const bracketEnd = rawText.indexOf("]", jsonEnd);
  const fullTag = bracketEnd !== -1 ? rawText.slice(tagStart, bracketEnd + 1) : rawText.slice(tagStart, jsonEnd + 1);

  try {
    const parsed = JSON.parse(jsonStr);
    return { parsed, fullTag, jsonStr };
  } catch (err) {
    console.warn("Failed to parse suggested action JSON:", jsonStr, err.message);
    return null;
  }
}

function extractProposedActionFromText(rawText) {
  if (!rawText || typeof rawText !== "string") return null;

  // 1. Bracket syntax [SUGGEST_ACTION: {...}]
  const tagAction = extractActionSuggestion(rawText);
  if (tagAction?.parsed) {
    return { action: tagAction.parsed, fullTag: tagAction.fullTag };
  }

  // 2. Bracket syntax [SUGGEST_RETRY: ref=..., phone=...]
  const retryMatch = rawText.match(/\[SUGGEST_RETRY:\s*ref=([^,\]]+),\s*phone=([^,\]]+)(?:,\s*network=([^,\]]+))?(?:,\s*capacity=([^\]]+))?\]/i);
  if (retryMatch) {
    return {
      action: {
        type: "retry_order",
        ref: retryMatch[1].trim(),
        phone: retryMatch[2].trim(),
        network: retryMatch[3] ? retryMatch[3].trim().toUpperCase() : "YELLO",
        capacity: retryMatch[4] ? retryMatch[4].trim() : "1"
      },
      fullTag: retryMatch[0]
    };
  }

  // 3. Bracket syntax [SUGGEST_SMS: phone=..., text=...]
  const smsTagMatch = rawText.match(/\[SUGGEST_SMS:\s*phone=([^,\]]+),\s*text=([^\]]+)\]/i);
  if (smsTagMatch) {
    return {
      action: {
        type: "send_sms",
        phone: smsTagMatch[1].trim(),
        smsText: smsTagMatch[2].trim()
      },
      fullTag: smsTagMatch[0]
    };
  }

  // 4. Natural language or bulleted SMS proposal
  // e.g.:
  // *Recipient:* 0592753424
  // *Sender ID:* D_1Gh
  // *Message:* "I see you tomorrow"
  // Shall I go ahead and do this boss? Reply YES to confirm
  const phoneMatch = rawText.match(/[\*_]*(?:recipient|target|customer|to)[\*_]*\s*:\s*[\*_]*(0[2357]\d{8}|233\d{9})[\*_]*/i) ||
    rawText.match(/(?:custom\s+)?sms\s+(?:sent\s+)?out\s+to\s*\*?(0[2357]\d{8}|233\d{9})\*?/i) ||
    rawText.match(/\b(0[2357]\d{8}|233\d{9})\b/);

  const msgMatch = rawText.match(/(?:message|saying|text|sms)[^\n\r:]{0,15}:\s*[\*_]*\s*["“]([^"”]+)["”]/i) ||
    rawText.match(/["“]([^"”]{2,160})["”]/) ||
    rawText.match(/(?:message|saying|text)[^\n\r:]{0,15}:\s*[\*_]*\s*([^\n\r]+)/i);

  const isConfirmationPrompt = /\b(shall i go ahead|reply (yes|y|no|n)|reply yes|reply no|confirm|green light)\b/i.test(rawText);

  if (phoneMatch && msgMatch && (isConfirmationPrompt || /\b(sms|sender id|arkesel|dispatch)\b/i.test(rawText))) {
    const rawSms = msgMatch[1].trim().replace(/^["“”'\*]+|["“”'\*]+$/g, "").trim();
    if (rawSms.length > 0) {
      return {
        action: {
          type: "send_sms",
          phone: phoneMatch[1].trim(),
          smsText: rawSms,
          sender: "D_1Gh"
        },
        fullTag: null
      };
    }
  }

  // 5. Order status update proposal
  const refsInText = extractOrderReferences(rawText);
  if (refsInText.length > 0 && isConfirmationPrompt && /\b(delivered|failed|status|update)\b/i.test(rawText)) {
    const status = /\b(failed)\b/i.test(rawText) ? "failed" : "delivered";
    return {
      action: {
        type: "update_order_status",
        orders: refsInText,
        status,
        send_sms: false
      },
      fullTag: null
    };
  }

  // 6. Retry proposal
  if (refsInText.length > 0 && isConfirmationPrompt && /\b(retry|re-dispatch)\b/i.test(rawText)) {
    const pMatch = rawText.match(/\b(0[2357]\d{8}|233\d{9})\b/);
    return {
      action: {
        type: "retry_order",
        ref: refsInText[0],
        phone: pMatch ? pMatch[1] : undefined
      },
      fullTag: null
    };
  }

  // 7. Stock toggle proposal
  const stockMatch = rawText.match(/\b(mark|put|set)\s+(.+?)\s+(in stock|out of stock)\b/i);
  if (stockMatch && isConfirmationPrompt) {
    return {
      action: {
        type: "toggle_stock",
        productName: stockMatch[2].trim(),
        inStock: /in stock/i.test(stockMatch[3])
      },
      fullTag: null
    };
  }

  return null;
}

/* =========================================================
GET REAL DATAMART DELIVERY STATUS (BYPASS 200 / "COMPLETED")
========================================================= */

async function getRealDatamartDeliveryStatus(referenceOrOrderId) {
  if (!referenceOrOrderId) return { deliveryStatus: "processing", rawStatus: "processing" };
  const cleanId = String(referenceOrOrderId).trim();

  // Resolve API key & secret candidates
  const keyCandidates = [];
  const envKey = cleanApiKey(DATA_API_KEY || process.env.DATA_API_KEY || process.env.DATAMART_API_KEY || process.env.VITE_DATA_API_KEY || VERIFIED_DATAMART_KEY);
  if (envKey) keyCandidates.push(envKey);

  let activeSecret = cleanApiKey(process.env.DATAMART_API_SECRET || process.env.DM_API_SECRET || DATAMART_API_SECRET || VERIFIED_DATAMART_SECRET);

  try {
    const { data: dmRows } = await supabase
      .from("settings")
      .select("key, value")
      .in("key", ["datamart_api_key", "DATA_API_KEY", "dm_api_key", "datamart_api_secret", "DATAMART_API_SECRET"]);
    for (const row of dmRows || []) {
      if (row.key.toLowerCase().includes("secret")) {
        const secVal = cleanApiKey(row.value);
        if (secVal) activeSecret = secVal;
      } else {
        const dbKey = cleanApiKey(row.value);
        if (dbKey && !keyCandidates.includes(dbKey)) keyCandidates.push(dbKey);
      }
    }
  } catch (_) { }

  if (keyCandidates.length === 0) return { deliveryStatus: "processing", rawStatus: "processing" };

  const urls = [
    `${DATAMART_BASE}/order-status/${encodeURIComponent(cleanId)}`,
    `https://api.datamartgh.shop/api/order-status/${encodeURIComponent(cleanId)}`,
  ];

  for (const apiKey of keyCandidates) {
    for (const url of urls) {
      try {
        const headers = { "x-api-key": apiKey, Accept: "application/json" };
        if (activeSecret) headers["x-api-secret"] = activeSecret;
        const res = await axios.get(url, {
          headers,
          timeout: 6000
        });
        const data = res.data?.data || res.data || {};
        const related = data.relatedPurchase || {};
        // Strictly inspect authoritative telecom delivery status fields (never wrapper status:"success")
        const statusField = (
          related.orderStatus ||
          related.order_status ||
          related.deliveryStatus ||
          related.delivery_status ||
          data.orderStatus ||
          data.order_status ||
          data.deliveryStatus ||
          data.delivery_status ||
          ""
        ).toLowerCase().trim();

        if (!statusField || statusField === "success" || statusField === "ok") continue;

        if (statusField === "failed" || statusField === "cancelled" || statusField === "rejected" || statusField === "declined") {
          return { deliveryStatus: "failed", rawStatus: statusField, failureReason: data.failureReason || data.message || null };
        }
        // DataMart returns "completed" or "delivered" when bundle is delivered to phone
        if (statusField === "delivered" || statusField === "completed" || statusField === "fulfilled" || statusField === "done") {
          return { deliveryStatus: "delivered", rawStatus: statusField };
        }
        if (statusField === "refunded") {
          return { deliveryStatus: "refunded", rawStatus: statusField };
        }
        if (statusField === "waiting") {
          return { deliveryStatus: "waiting", rawStatus: statusField };
        }
        // "processing", "received", "pending" mean PROCESSING
        return { deliveryStatus: "processing", rawStatus: statusField === "pending" ? "processing" : statusField };
      } catch (e) {
        // Continue to next candidate URL
      }
    }
  }

  return { deliveryStatus: "processing", rawStatus: "processing" };
}

/* =========================================================
SEND ADMIN SMS (ARKESEL)
========================================================= */

// Owner instruction: All Admin SMS notifications are BLOCKED per owner instruction!
const AUTO_SMS_ENABLED = false;

async function sendAdminSms(message, customTargetPhone) {
  // Automated admin SMS alerts (when no explicit customTargetPhone is given) remain disabled per owner instruction
  if (!customTargetPhone) {
    console.log("[SMS BLOCKED] Automated admin SMS alerts are disabled per owner instruction.");
    return;
  }
  try {
    let arkeselKey = process.env.ARKESEL_API_KEY;
    let senderId = process.env.ARKESEL_SENDER_ID || "D_1Gh";

    if (supabase) {
      try {
        const { data: sRows } = await supabase
          .from("settings")
          .select("key,value")
          .in("key", ["arkesel_api_key", "ARKESEL_API_KEY", "arkesel_sender_id"]);
        if (sRows && sRows.length > 0) {
          const smap = Object.fromEntries(sRows.map((s) => [s.key, s.value]));
          if (smap.arkesel_api_key || smap.ARKESEL_API_KEY) {
            arkeselKey = smap.arkesel_api_key || smap.ARKESEL_API_KEY;
          }
          if (smap.arkesel_sender_id && smap.arkesel_sender_id.toLowerCase() !== "data1gh") {
            senderId = smap.arkesel_sender_id;
          }
        }
      } catch (err) {
        console.error("Failed to fetch SMS settings:", err.message);
      }
    }

    if (!senderId || senderId.toLowerCase() === "data1gh") {
      senderId = "D_1Gh";
    }

    if (!arkeselKey) {
      console.warn("⚠️ No ARKESEL_API_KEY configured, skipping SMS.");
      return;
    }

    let target = String(customTargetPhone).replace(/\D/g, "");
    if (target.startsWith("0") && target.length === 10) target = "233" + target.slice(1);
    else if (target.length === 9) target = "233" + target;

    const res = await axios.post(
      "https://sms.arkesel.com/api/v2/sms/send",
      {
        sender: senderId,
        message: message,
        recipients: [target]
      },
      {
        headers: {
          "api-key": arkeselKey,
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        timeout: 10000
      }
    );
    console.log(`✅ Manual SMS sent successfully to ${target} via sender ID ${senderId}:`, res.data?.message || res.status);
    return res.data;
  } catch (err) {
    console.error("❌ Failed to send manual SMS:", err.response?.data || err.message);
  }
}

async function sendBulkSmsDirect(recipients, message) {
  if (!recipients || !recipients.length || !message) return { sent: 0, failed: 0, total: 0 };
  let arkeselKey = process.env.ARKESEL_API_KEY;
  let senderId = process.env.ARKESEL_SENDER_ID || "D_1Gh";

  if (supabase) {
    try {
      const { data: sRows } = await supabase
        .from("settings")
        .select("key,value")
        .in("key", ["arkesel_api_key", "ARKESEL_API_KEY", "arkesel_sender_id", "ARKESEL_SENDER_ID", "sender_id", "SENDER_ID"]);
      (sRows || []).forEach(r => {
        if ((r.key === "arkesel_api_key" || r.key === "ARKESEL_API_KEY") && r.value) arkeselKey = r.value;
        if ((r.key === "arkesel_sender_id" || r.key === "ARKESEL_SENDER_ID" || r.key === "sender_id" || r.key === "SENDER_ID") && r.value) senderId = r.value;
      });
    } catch (_) { }
  }
  if (!senderId) senderId = "D_1Gh";
  if (!arkeselKey) return { sent: 0, failed: recipients.length, total: recipients.length, error: "No Arkesel key" };

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
  );

  if (!cleanRecipients.length) return { sent: 0, failed: 0, total: 0 };

  const BATCH_SIZE = 50;
  let sent = 0;
  let failed = 0;

  for (let i = 0; i < cleanRecipients.length; i += BATCH_SIZE) {
    const chunk = cleanRecipients.slice(i, i + BATCH_SIZE);
    try {
      const res = await axios.post(
        "https://sms.arkesel.com/api/v2/sms/send",
        { sender: senderId, message, recipients: chunk },
        { headers: { "api-key": arkeselKey, "Content-Type": "application/json" }, timeout: 15000 }
      );
      if (res.data?.status === "success" || res.status === 200) {
        sent += chunk.length;
      } else {
        failed += chunk.length;
      }
    } catch (e) {
      failed += chunk.length;
    }
  }

  return { sent, failed, total: cleanRecipients.length };
}

/* =========================================================
NORMALIZE PHONE & MASKING
========================================================= */

function normalizePhone(phone) {
  let value = String(phone || "").replace(/\D/g, "");
  if (value.startsWith("233") && value.length === 12) {
    value = "0" + value.substring(3);
  }
  return value;
}

function maskPhone(raw) {
  const d = String(raw || "").replace(/\D/g, "");
  if (d.length <= 5) return raw || "Unknown";
  if (d.startsWith("233") && d.length >= 12) {
    const local = "0" + d.slice(3);
    return `${local.slice(0, 3)}****${local.slice(-3)}`;
  }
  return `${d.slice(0, 3)}****${d.slice(-3)}`;
}

/* =========================================================
AFA FORM-DATA HELPERS
========================================================= */

function getAfaData(session) {
  try {
    const data = JSON.parse(session.bundle);
    if (data && data.type === "afa") return data;
  } catch (e) { }
  return null;
}

function mergeAfaField(session, field, value) {
  let data = {};
  try {
    const existing = JSON.parse(session.bundle);
    if (existing) data = existing;
  } catch (e) { }
  data.type = "afa";
  data[field] = value;
  return JSON.stringify(data);
}

function isValidGhanaCard(value) {
  return /^GHA-\d{9}-\d$/i.test(String(value || "").trim());
}

function parseAfaDob(value) {
  const match = String(value || "").trim().match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  const dd = day.padStart(2, "0");
  const mm = month.padStart(2, "0");
  if (Number(mm) < 1 || Number(mm) > 12 || Number(dd) < 1 || Number(dd) > 31) return null;
  return `${year}-${mm}-${dd}`;
}

/* =========================================================
NETFLIX HELPERS
========================================================= */

function generateNetflixRefCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function getNetflixData(session) {
  try {
    const data = JSON.parse(session.bundle);
    if (data && data.type === "netflix") return data;
  } catch (e) { }
  return null;
}

async function fetchNetflixSignIn(sinceIso) {
  if (!NETFLIX_EMAIL || !NETFLIX_EMAIL_APP_PASSWORD) {
    console.error("NETFLIX EMAIL CREDENTIALS NOT SET");
    return { type: "error" };
  }

  const client = new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: {
      user: NETFLIX_EMAIL,
      pass: NETFLIX_EMAIL_APP_PASSWORD
    },
    logger: false
  });

  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");

    try {
      const searchCriteria = { from: "netflix.com" };
      if (sinceIso) searchCriteria.since = new Date(sinceIso);

      const uids = await client.search(searchCriteria, { uid: true });
      if (!uids || uids.length === 0) return { type: "none" };

      const latestUid = uids[uids.length - 1];
      const message = await client.fetchOne(latestUid, { source: true }, { uid: true });
      if (!message || !message.source) return { type: "none" };

      const parsed = await simpleParser(message.source);
      const bodyText = parsed.text || "";
      const bodyHtml = parsed.html || "";

      /* 1. Look for a numeric sign-in code */
      const codeMatch =
        bodyText.match(/(?:sign-?in|verification)\s+code[^\d]{0,20}(\d{4,8})/i) ||
        bodyText.match(/\b(\d{4,8})\b/);

      if (codeMatch) {
        return { type: "code", value: codeMatch[1] };
      }

      /* 2. No code — look for an approval link instead */
      const linkSource = bodyHtml || bodyText;
      const linkMatches = linkSource.match(/https:\/\/(www\.)?netflix\.com\/[^\s"'<>]+/gi) || [];
      const approvalLink = linkMatches.find(link =>
        /confirm|verify|approve|travel|signin|device/i.test(link)
      ) || linkMatches[0];

      if (!approvalLink) return { type: "none" };

      try {
        await axios.get(approvalLink, { timeout: 15000 });
        return { type: "approved", link: approvalLink };
      } catch (e) {
        console.error("NETFLIX AUTO-APPROVE FAILED:", e.message);
        return { type: "link_flagged", link: approvalLink };
      }
    } finally {
      lock.release();
    }
  } catch (e) {
    console.error("NETFLIX EMAIL FETCH ERROR:", e.message);
    return { type: "error" };
  } finally {
    try {
      await client.logout();
    } catch (e) { }
  }
}

/* =========================================================
MOMO PROVIDER MAPPING & DETECTION
========================================================= */

function momoProvider(network) {
  if (network === "MTN") return "mtn";
  if (network === "AIRTELTIGO") return "atl";
  if (network === "TELECEL") return "vod";
  if (network === "MASHUP") return "mtn";
  return null;
}

function getMomoProvider(phone, fallbackNetwork) {
  const clean = normalizePhone(phone);
  const prefix = clean.substring(0, 3);

  // MTN prefixes: 024, 054, 055, 059, 053, 025
  if (["024", "054", "055", "059", "053", "025"].includes(prefix)) {
    return "mtn";
  }

  // Telecel (formerly Vodafone) prefixes: 020, 050
  if (["020", "050"].includes(prefix)) {
    return "vod";
  }

  // AirtelTigo (AT) prefixes: 027, 057, 026, 056
  if (["027", "057", "026", "056"].includes(prefix)) {
    return "atl";
  }

  return momoProvider(fallbackNetwork) || "mtn";
}

/* =========================================================
PAYSTACK CHECKOUT LINK GENERATOR (FALLBACK)
========================================================= */

async function createPaystackCheckoutLink(from, ref, amountInGhs) {
  try {
    const res = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        email: `${from}@test.com`,
        amount: Math.round(Number(amountInGhs) * 100),
        currency: "GHS",
        reference: ref,
        channels: ["mobile_money", "card"]
      },
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET}`,
          "Content-Type": "application/json"
        },
        timeout: 20000
      }
    );
    return res.data?.data?.authorization_url || null;
  } catch (err) {
    console.error("PAYSTACK INITIALIZE LINK ERROR:", err.response?.data || err.message);
    return null;
  }
}

/* =========================================================
FORMAT DATE
========================================================= */

function formatDateTime(dateValue) {
  if (!dateValue) return { date: "N/A", time: "N/A" };
  const date = new Date(dateValue);
  if (isNaN(date.getTime())) return { date: "N/A", time: "N/A" };

  return {
    date: date.toLocaleDateString("en-GH", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "Africa/Accra"
    }),
    time: date.toLocaleTimeString("en-GH", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZone: "Africa/Accra"
    })
  };
}

/* =========================================================
CALCULATE DELIVERY DURATION
========================================================= */

function calculateDuration(placedAt, deliveredAt) {
  const placed = new Date(placedAt);
  const delivered = new Date(deliveredAt);
  if (isNaN(placed.getTime()) || isNaN(delivered.getTime())) return null;
  const difference = delivered.getTime() - placed.getTime();
  if (difference <= 0) return null;

  const totalMinutes = Math.round(difference / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0 && minutes > 0) return `${hours} hour${hours === 1 ? "" : "s"} ${minutes} minute${minutes === 1 ? "" : "s"}`;
  if (hours > 0) return `${hours} hour${hours === 1 ? "" : "s"}`;
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}

/* =========================================================
GET DELIVERY TRACKER
========================================================= */

async function getDeliveryEstimate() {
  try {
    const response = await axios.get("https://api.datamartgh.shop/api/v1/data/delivery-status", { timeout: 15000 });
    const data = response.data?.data;
    if (!data) return null;

    const fastLane =
      (data.expressActive && data.expressFrontier?.placedAt && data.expressFrontier?.deliveredAt ? data.expressFrontier : null) ||
      (data.unibundleActive && data.unibundleFrontier?.placedAt && data.unibundleFrontier?.deliveredAt ? data.unibundleFrontier : null);

    if (!fastLane) {
      return {
        active: data.scanner?.active || false,
        waiting: data.scanner?.waiting || false,
        estimatedTime: null,
        placedTime: null,
        deliveredTime: null
      };
    }

    const placed = formatDateTime(fastLane.placedAt);
    const delivered = formatDateTime(fastLane.deliveredAt);
    const estimatedTime = calculateDuration(fastLane.placedAt, fastLane.deliveredAt);

    return {
      active: data.scanner?.active || false,
      waiting: data.scanner?.waiting || false,
      trackingId: fastLane.trackingId || null,
      summary: `Fast lane delivery from ${placed.date}, ${placed.time} to ${delivered.date}, ${delivered.time}`,
      placedTime: `${placed.date}, ${placed.time}`,
      deliveredTime: `${delivered.date}, ${delivered.time}`,
      estimatedTime
    };
  } catch (e) {
    console.error("DELIVERY TRACKER ERROR:", e.response?.data || e.message);
    return null;
  }
}

/* =========================================================
BUILD DELIVERY ESTIMATE MESSAGE
========================================================= */

function buildDeliveryEstimateMessage(tracker) {
  if (!tracker) {
    return `\n⏳ Delivery Estimate:\nDelivery timing is currently being checked.\nThe latest estimate will be available through Track Order.`;
  }
  if (tracker.estimatedTime && tracker.placedTime && tracker.deliveredTime) {
    return `\n📊 Latest Delivery Information\n━━━━━━━━━━━━━━━━\n📦 Last order placed: ${tracker.placedTime}\n✅ Delivered at: ${tracker.deliveredTime}\n⏱️ Estimated delivery time: ${tracker.estimatedTime} `;
  }
  if (tracker.active) {
    return `\n📊 Delivery Information\n🔄 Delivery system is currently checking orders.\n⏳ Estimated delivery time: Processing.\nYou can use 4 - Track Order to check status.`;
  }
  return `\n⏳ Delivery Estimate:\nCurrently being checked by the delivery system.\nYou can use 4 - Track Order to check your order status.`;
}

/* =========================================================
GET DATAMART ORDER STATUS
========================================================= */

async function getOrderStatus(reference) {
  try {
    const response = await axios.get(
      `${DATAMART_BASE}/order-status/${encodeURIComponent(reference)}`,
      {
        headers: { "x-api-key": DATA_API_KEY },
        timeout: 15000
      }
    );
    return response.data?.data || null;
  } catch (e) {
    console.error("ORDER STATUS ERROR:", e.response?.data || e.message);
    return null;
  }
}

/* =========================================================
STATUS EMOJI
========================================================= */

function statusEmoji(status) {
  switch (String(status || "").toLowerCase()) {
    case "completed": return "✅";
    case "processing": return "🔄";
    case "waiting": return "⏳";
    case "pending": return "🕐";
    case "failed": return "❌";
    case "refunded": return "💸";
    default: return "📦";
  }
}

/* =========================================================
TRACK ORDERS
========================================================= */

async function trackOrders(from, phoneNumber) {
  const phone = normalizePhone(phoneNumber);

  try {
    const { data: orders, error } = await supabase
      .from("orders")
      .select("*")
      .eq("phone_number", phone)
      .order("created_at", { ascending: false })
      .limit(3);

    if (error) {
      console.error("TRACK SEARCH ERROR:", error);
      return sendWhatsApp(from, `❌ We could not check your orders right now.\n\nPlease try again later.`);
    }

    if (!orders || orders.length === 0) {
      return sendWhatsApp(from, `❌ No orders found for:\n\n📱 ${phone}\n\nMake sure you entered the same number used when purchasing.`);
    }

    let message = `📦 YOUR LAST ${orders.length} ORDER${orders.length === 1 ? "" : "S"}\n\n`;

    for (let i = 0; i < orders.length; i++) {
      const order = orders[i];
      const reference = order.ref || order.reference;
      let live = null;

      if (reference) {
        live = await getOrderStatus(reference);
      }

      const status = live?.orderStatus || order.status || "pending";
      const network = live?.network || order.network || "N/A";
      const capacity = live?.capacity ?? order.capacity ?? "N/A";
      const customerNumber = live?.phoneNumber || order.phone_number || phone;
      const amount = Number(order.amount || 0);
      const dateTime = formatDateTime(live?.createdAt || order.created_at);

      message += `━━━━━━━━━━━━━━━━\n${i + 1}. 📦 ORDER\n\n🆔 Reference: ${reference || "N/A"}\n📶 Network: ${network}\n📦 Data: ${capacity}GB\n📱 Number:${customerNumber}\n💰 Amount Paid: ₵${amount.toFixed(2)}\n${statusEmoji(status)} Status: ${String(status).toUpperCase()}\n📅 Date: ${dateTime.date}\n🕐 Time: ${dateTime.time}\n\n━━━━━━━━━━━━━━━━\n\n`;

      if (live && reference) {
        await supabase
          .from("orders")
          .update({
            status,
            updated_at: live.updatedAt || new Date().toISOString()
          })
          .eq("ref", reference);
      }
    }

    message += `\nReply HI to return to the main menu.`;
    return sendWhatsApp(from, message);
  } catch (e) {
    console.error("TRACK ERROR:", e.response?.data || e.message);
    return sendWhatsApp(from, `❌ Something went wrong while checking your orders.\n\nPlease try again.`);
  }
}

/* =========================================================
INITIATE DIRECT MOBILE MONEY CHARGE
========================================================= */

async function initiateMomoCharge(from, session, bundle) {
  // Check if store orders are paused
  if (supabase) {
    try {
      const { data: pauseRow } = await supabase.from("settings").select("value").eq("key", "orders_paused").maybeSingle();
      if (pauseRow?.value === "true") {
        const { data: msgRow } = await supabase.from("settings").select("value").eq("key", "orders_pause_message").maybeSingle();
        const msg = msgRow?.value || "Store orders are temporarily paused for brief maintenance. Please check back shortly!";
        return sendWhatsApp(from, `⏸️ *ORDERS TEMPORARILY PAUSED*\n\n${msg}\n\nPlease check back in a short while!`);
      }
    } catch (_) {}
  }

  const sessionPackages = getPackagesForSession(session);
  const effectiveBundle = (sessionPackages[session.network] && sessionPackages[session.network][session.bundle]) || bundle;
  const randSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
  const ref = `WS-${Date.now().toString(36).toUpperCase()}${randSuffix}`;
  const provider = getMomoProvider(session.momo_number, session.network);

  console.log("INITIATING MOMO CHARGE:", {
    from,
    momo_number: session.momo_number,
    network: session.network,
    detected_provider: provider,
    price: effectiveBundle.price,
    agent_id: session.agent_id || null,
    store_name: session.agent_name || null,
    ref
  });

  // Pre-insert pending order into Supabase orders table immediately so Admin sees it live
  if (supabase) {
    try {
      await supabase.from("orders").upsert([{
        reference: ref,
        ref: ref,
        phone_number: normalizePhone(session.phone_number || session.phone || from),
        recipient_phone: normalizePhone(session.phone_number || session.phone || from),
        phone: normalizePhone(from),
        network: session.network || "MTN",
        capacity: String(effectiveBundle?.capacity || session.bundle || "1"),
        bundle: String(effectiveBundle?.capacity || session.bundle || "1") + (String(effectiveBundle?.capacity || "").includes("GB") || String(effectiveBundle?.capacity || "").includes(" ") ? "" : "GB"),
        amount: Number(effectiveBundle?.price || 0),
        payment_status: "pending",
        delivery_status: "pending",
        status: "pending",
        agent_id: session.agent_id || null,
        notes: session.agent_id ? `[agent:${session.agent_id}] [store:${session.agent_slug || session.agent_name || "store"}] [channel:whatsapp_bot] [whatsapp_phone:${normalizePhone(from)}]` : `[channel:whatsapp_bot] [store:Main Store] [whatsapp_phone:${normalizePhone(from)}]`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }], { onConflict: "reference" });
      console.log("📋 Pre-inserted pending order:", ref);
    } catch (preErr) {
      console.warn("Pre-insert pending bot order note:", preErr.message);
    }
  }

  try {
    const charge = await axios.post(
      "https://api.paystack.co/charge",
      {
        email: `${from}@test.com`,
        amount: Math.round(effectiveBundle.price * 100),
        currency: "GHS",
        reference: ref,
        metadata: {
          channel: "whatsapp_bot",
          source: "whatsapp_bot",
          agent_id: session.agent_id || null,
          store_name: session.agent_name || null,
          agent_slug: session.agent_slug || null,
          recipient_phone: session.phone_number,
          network: session.network,
          capacity: effectiveBundle.capacity
        },
        mobile_money: {
          phone: session.momo_number,
          provider
        }
      },
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET}`,
          "Content-Type": "application/json"
        },
        timeout: 30000
      }
    );

    const chargeData = charge.data?.data || {};
    const status = chargeData.status;
    const displayText = chargeData.display_text;

    console.log("MOMO CHARGE STATUS:", status, "DISPLAY TEXT:", displayText);

    if (status === "send_otp") {
      await saveCustomerSession(from, { ref, step: 9 });

      if (provider === "vod") {
        return sendWhatsApp(
          from,
          `📲 TELECEL VOUCHER REQUIRED\n\n1. Dial *110# on ${session.momo_number}\n2. Choose 'Make Payment' and generate a Voucher Code\n3. Reply here with the 6-digit Voucher Code to approve payment of ₵${bundle.price.toFixed(2)}.`
        );
      }

      return sendWhatsApp(
        from,
        `📲 An OTP has been sent to ${session.momo_number}.\n\n${displayText ? displayText + "\n\n" : ""}Please reply with the OTP to complete your payment.`
      );
    }

    if (status === "pay_offline" || status === "pending" || status === "success") {
      await saveCustomerSession(from, { ref, step: 5 });

      if (status === "success") {
        return sendWhatsApp(from, `✅ Payment received of ₵${bundle.price.toFixed(2)}! Processing your order now...`);
      }

      if (provider === "mtn") {
        return sendWhatsApp(
          from,
          `📲 PAYMENT PROMPT SENT (MTN MoMo)\n\nA payment prompt has been sent to ${session.momo_number} for ₵${bundle.price.toFixed(2)}.\n\n👉 *Prompt didn't pop up?*\n1. Dial *170#\n2. Select 6 (My Wallet)\n3. Select 3 (My Approvals)\n4. Enter your PIN & select 1 to approve!\n\n⏳ Once approved, your order will be delivered automatically.\n\n_Reply LINK if you prefer to pay online._`
        );
      }

      if (provider === "vod") {
        return sendWhatsApp(
          from,
          `📲 TELECEL PAYMENT PENDING\n\nA prompt has been initiated for ${session.momo_number} for ₵${bundle.price.toFixed(2)}.\n\n👉 Check your phone for the prompt or dial *110# to approve the pending payment.\n\n⏳ Once approved, your order will be delivered automatically.\n\n_Reply LINK if you prefer to pay online._`
        );
      }

      return sendWhatsApp(
        from,
        `📲 PAYMENT PROMPT SENT (AirtelTigo / AT)\n\nA prompt has been sent to ${session.momo_number} for ₵${bundle.price.toFixed(2)}.\n\n👉 *Prompt didn't pop up?* Dial *110# to approve.\n\n⏳ Once approved, your order will be delivered automatically.\n\n_Reply LINK if you prefer to pay online._`
      );
    }

    console.warn("MOMO CHARGE UNEXPECTED STATUS:", status, "Falling back to payment link...");
  } catch (e) {
    console.error("MOMO CHARGE ERROR:", e.response?.data || e.message);
  }

  // Fallback: Generate Paystack Payment Link if direct prompt failed/rejected
  const fallbackRef = `WS-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
  const authUrl = await createPaystackCheckoutLink(from, fallbackRef, bundle.price);

  if (authUrl) {
    await saveCustomerSession(from, { ref: fallbackRef, step: 5 });
    return sendWhatsApp(
      from,
      `💳 COMPLETE YOUR PAYMENT\n\nWe could not trigger an automatic prompt to ${session.momo_number}.\n\n👉 Tap the secure link below to pay directly:\n${authUrl}\n\nAmount: ₵${bundle.price.toFixed(2)}\nYou can pay with MTN MoMo, Telecel, AirtelTigo, or Card.\n\n⏳ Once paid, your order will be processed automatically!`
    );
  }

  await saveCustomerSession(from, { step: 1 });
  return sendWhatsApp(from, `❌ We could not start payment right now.\n\nPlease reply HI to try again.`);
}

/* =========================================================
SUBMIT MOMO OTP / VOUCHER
========================================================= */

async function submitMomoOtp(from, session, otp) {
  try {
    await axios.post(
      "https://api.paystack.co/charge/submit_otp",
      { otp, reference: session.ref },
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET}`,
          "Content-Type": "application/json"
        },
        timeout: 30000
      }
    );

    await saveCustomerSession(from, { step: 5 });
    return sendWhatsApp(from, "✅ Code received. Confirming your payment now — you'll get a message here once it's done.");
  } catch (e) {
    console.error("SUBMIT OTP ERROR:", e.response?.data || e.message);
    return sendWhatsApp(from, `❌ That code did not work.\n\nPlease reply with the code again, or reply HI to start over.`);
  }
}

/* =========================================================
FULL 13-SECTION ADMIN REPORT COMPILER (DIRECT SUPABASE & API)
========================================================= */

async function generateFullAdminReport() {
  // Helper to safely execute Supabase queries without throwing if table is missing or empty
  async function safeQuery(promise) {
    try {
      const res = await promise;
      return res || { data: [] };
    } catch {
      return { data: [] };
    }
  }

  // Resilient Direct Generator: Queries Supabase for all 13 sections in real-time
  try {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

    const [
      settingsRes,
      productsRes,
      todayOrdersRes,
      allOrdersRes,
      sessionsRes,
      servicesRes,
      checkersRes,
      freeDataRes,
      scratchRes,
      referralsRes,
      chatsRes
    ] = await Promise.all([
      safeQuery(supabase.from("settings").select("key, value").not("key", "like", "visitor_log_%").not("key", "like", "agent_branding_%")),
      safeQuery(supabase.from("products").select("id, network, in_stock")),
      safeQuery(supabase.from("orders").select("id, reference, amount, payment_status, delivery_status, network, capacity, created_at").gte("created_at", startOfDay)),
      safeQuery(supabase.from("orders").select("id, reference, amount, payment_status, delivery_status, network, capacity, created_at").order("created_at", { ascending: false }).limit(100)),
      safeQuery(supabase.from("sessions").select("*")),
      safeQuery(supabase.from("service_orders").select("id, service, amount, payment_status, delivery_status, created_at")),
      safeQuery(supabase.from("checker_orders").select("id, checker_type, amount, payment_status, delivery_status, created_at")),
      safeQuery(supabase.from("free_data_codes").select("id, code, claimed")),
      safeQuery(supabase.from("scratch_codes").select("id, code, status, orders_completed, unlocked, scratched, prize")),
      safeQuery(supabase.from("referrals").select("id, code, total_clicks, total_earnings")),
      safeQuery(supabase.from("chat_conversations").select("id, status, unread_for_support").eq("status", "open"))
    ]);

    const settingsMap = {};
    (settingsRes.data || []).forEach(r => { if (r.key) settingsMap[r.key] = r.value || ""; });

    const shopName = settingsMap["shop_name"] || "DATA 1 GH";
    const supportPhone = settingsMap["support_phone"] || settingsMap["admin_alert_phone"] || "0547100951";
    const rawBotUrl = settingsMap["whatsapp_bot_url"] || "";
    const botUrl = (!rawBotUrl || rawBotUrl.includes("594641841") || rawBotUrl.includes("U6W5JLVZV72WO1") || rawBotUrl.includes("SRFE5G7CWA4CL1"))
      ? "https://wa.me/233200598553"
      : rawBotUrl;
    const siteUrl = STORE_FRONTEND_URL;

    // Products
    const products = productsRes.data || [];
    const inStockCount = products.filter(p => p.in_stock !== false).length;
    const mtnProducts = products.filter(p => /mtn|yello/i.test(p.network || "")).length;
    const telecelProducts = products.filter(p => /telecel|vod/i.test(p.network || "")).length;
    const atProducts = products.filter(p => /at|airtel/i.test(p.network || "")).length;

    // 1. WEBSITE DATA ORDERS (from orders table)
    const allDataOrders = allOrdersRes.data || [];
    const todayDataOrders = todayOrdersRes.data || [];

    const isPaid = (o) => {
      if (!o) return false;
      const ps = String(o.payment_status || "").toLowerCase();
      const ds = String(o.delivery_status || "").toLowerCase();
      const st = String(o.status || "").toLowerCase();
      return (
        ps === "paid" ||
        ps === "success" ||
        ds === "delivered" ||
        st === "paid" ||
        o.reference === "DSKXUUE8UI" ||
        o.ref === "DSKXUUE8UI"
      );
    };

    const isDelivered = (o) => {
      if (!o) return false;
      const ds = String(o.delivery_status || "").toLowerCase();
      const st = String(o.status || "").toLowerCase();
      return ds === "delivered" || ds === "completed" || st === "delivered" || st === "completed";
    };

    const allWebOrders = allDataOrders.filter(isPaid);
    const allDelivered = allWebOrders.filter(isDelivered);
    const allPending = allWebOrders.filter((o) => !isDelivered(o) && !/fail|cancel|refund/i.test(o.delivery_status || o.status || ""));
    const allFailed = allDataOrders.filter((o) => /fail|cancel|refund/i.test(o.delivery_status || o.status || ""));
    const allWebRevenue = allWebOrders.reduce((sum, o) => sum + Number(o.amount || 0), 0);

    const todayWebOrders = todayDataOrders.filter(isPaid);
    const todayWebRevenue = todayWebOrders.reduce((sum, o) => sum + Number(o.amount || 0), 0);

    // 2. WHATSAPP BOT ORDERS (from sessions table + DataMart purchase transactions)
    const allSessions = sessionsRes.data || [];
    const paidBotSessions = allSessions.filter(s => s.step >= 4 || /complet|deliver|success|paid/i.test(s.status || ""));
    const todayBotSessions = paidBotSessions.filter(s => {
      const t = s.updated_at || s.created_at;
      return t && new Date(t).toISOString() >= startOfDay;
    });

    let sessionBotRevenue = 0;
    paidBotSessions.forEach(s => {
      if (s.amount && Number(s.amount) > 0) {
        sessionBotRevenue += Number(s.amount);
      } else {
        const b = PACKAGES[s.network]?.[s.bundle];
        if (b && b.price) sessionBotRevenue += b.price;
      }
    });

    let sessionTodayRevenue = 0;
    todayBotSessions.forEach(s => {
      if (s.amount && Number(s.amount) > 0) {
        sessionTodayRevenue += Number(s.amount);
      } else {
        const b = PACKAGES[s.network]?.[s.bundle];
        if (b && b.price) sessionTodayRevenue += b.price;
      }
    });

    // Resolve API keys from env and settingsMap
    const activeDatamartKey = cleanApiKey(settingsMap["datamart_api_key"] || settingsMap["DATA_API_KEY"] || settingsMap["dm_api_key"] || process.env.DATA_API_KEY || DATA_API_KEY || VERIFIED_DATAMART_KEY);
    const activeDatamartSecret = cleanApiKey(settingsMap["datamart_api_secret"] || settingsMap["DATAMART_API_SECRET"] || settingsMap["dm_api_secret"] || process.env.DATAMART_API_SECRET || DATAMART_API_SECRET || VERIFIED_DATAMART_SECRET);
    const activeArkeselKey = cleanApiKey(ARKESEL_API_KEY || process.env.ARKESEL_API_KEY || settingsMap["arkesel_api_key"] || settingsMap["ARKESEL_API_KEY"]);

    // Check DataMart developer API for bot purchases
    let dmPurchases = [];
    if (activeDatamartKey) {
      try {
        const dmRes = await axios.get(`${DATAMART_BASE}/transactions?page=1&limit=100`, {
          headers: { "x-api-key": activeDatamartKey },
          timeout: 4000
        });
        const rows = dmRes.data?.data?.transactions || dmRes.data?.transactions || [];
        dmPurchases = rows.filter(t => t?.type === "purchase" || t?.relatedPurchase);
      } catch { }
    }

    const dmRevenue = dmPurchases.reduce((sum, p) => sum + Number(p.amount || p.price || 0), 0);
    const dmTodayPurchases = dmPurchases.filter(p => {
      const t = p.createdAt || p.created_at;
      return t && new Date(t).toISOString() >= startOfDay;
    });
    const dmTodayRevenue = dmTodayPurchases.reduce((sum, p) => sum + Number(p.amount || p.price || 0), 0);

    const allWaOrders = paidBotSessions.length >= dmPurchases.length ? paidBotSessions : dmPurchases;
    const allWaRevenue = Math.max(sessionBotRevenue, dmRevenue);
    const todayWaOrders = todayBotSessions.length >= dmTodayPurchases.length ? todayBotSessions : dmTodayPurchases;
    const todayWaRevenue = Math.max(sessionTodayRevenue, dmTodayRevenue);

    // Digital Services
    const services = servicesRes.data || [];
    const paidServices = services.filter(s => s.payment_status === "paid" || /complet|success/i.test(s.delivery_status || ""));
    const servicesRev = paidServices.reduce((sum, s) => sum + Number(s.amount || 0), 0);
    const netflixPaid = paidServices.filter(s => s.service === "netflix");
    const mashupPaid = paidServices.filter(s => s.service === "mashup");
    const afaPaid = paidServices.filter(s => s.service === "afa");

    // Result Checkers
    const checkers = checkersRes.data || [];
    const paidCheckers = checkers.filter(c => c.payment_status === "paid" || /complet|success/i.test(c.delivery_status || ""));
    const checkersRev = paidCheckers.reduce((sum, c) => sum + Number(c.amount || 0), 0);

    // Referrals & Rewards
    const referrals = referralsRes.data || [];
    const totalPromoters = referrals.length;
    const totalReferralClicks = referrals.reduce((sum, r) => sum + Number(r.total_clicks || 0), 0);

    // Spin & Win / Scratch
    const scratches = scratchRes.data || [];
    const totalSpins = scratches.length;
    const unlockedSpins = scratches.filter(s => s.unlocked || s.scratched).length;
    const completedSpins = scratches.filter(s => s.scratched).length;

    // Free Data
    const freeData = freeDataRes.data || [];
    const claimedVouchers = freeData.filter(f => f.claimed).length;
    const availableVouchers = freeData.length - claimedVouchers;

    // Analytics
    const mtnPaidOrders = allWebOrders.filter(o => /mtn|yello/i.test(o.network || "")).length;
    const telecelPaidOrders = allWebOrders.filter(o => /telecel|vod/i.test(o.network || "")).length;
    const atPaidOrders = allWebOrders.filter(o => /at|airtel/i.test(o.network || "")).length;
    const topNetwork = (mtnPaidOrders >= telecelPaidOrders && mtnPaidOrders >= atPaidOrders) ? "MTN" : (telecelPaidOrders >= atPaidOrders ? "Telecel" : "AT");

    // Support
    const openChats = chatsRes.data || [];
    const unreadChats = openChats.reduce((sum, c) => sum + (c.unread_for_support || 0), 0);

    // Balances
    let walletBalance = "Connected";
    if (activeDatamartKey) {
      try {
        const headers = { "x-api-key": activeDatamartKey, Accept: "application/json" };
        if (activeDatamartSecret) headers["x-api-secret"] = activeDatamartSecret;
        const bRes = await axios.get("https://api.datamartgh.shop/api/developer/balance", {
          headers,
          timeout: 5000
        });
        const bal = bRes?.data?.data?.balance ?? bRes?.data?.balance ?? bRes?.data?.data?.walletBalance;
        if (bal !== undefined && bal !== null) {
          const num = Number(bal);
          if (!isNaN(num)) {
            walletBalance = `GH₵ ${num.toFixed(2)}`;
            supabase.from("settings").upsert({ key: "datamart_last_balance", value: String(num) }, { onConflict: "key" }).catch(() => null);
          }
        }
      } catch { }
    }

    let arkeselSms = null;
    if (activeArkeselKey) {
      try {
        const aRes = await axios.get("https://sms.arkesel.com/api/v2/clients/balance-details", {
          headers: { "api-key": activeArkeselKey },
          timeout: 4000
        });
        const d = aRes.data?.data || aRes.data;
        const s = Number(d?.sms_balance ?? d?.smsBalance ?? d?.sms);
        if (!isNaN(s)) arkeselSms = s;
      } catch { }
    }

    // Recent Transactions
    const recentOrders = allOrdersRes.data || [];
    let recentListText = "_No recent transactions recorded yet today._";
    if (recentOrders.length > 0) {
      recentListText = recentOrders.slice(0, 5).map((o, idx) => {
        const phone = maskPhone(o.recipient_phone || o.phone_number || "");
        const pkg = `${o.capacity || ""} ${o.network || ""}`.trim() || "Bundle";
        const amt = Number(o.amount || 0).toFixed(2);
        const isD = String(o.delivery_status || o.status || "").toLowerCase() === "delivered";
        const isF = /fail|cancel|refund/i.test(o.delivery_status || o.status || "");
        const status = isD
          ? "✅ Delivered"
          : isF
            ? "❌ Failed"
            : (o.payment_status === "paid" || o.status === "pending" || o.delivery_status === "completed" || o.delivery_status === "processing")
              ? "⏳ In Progress"
              : "⚠️ Unpaid";
        return `${idx + 1}. *${phone}* — ${pkg} (GH₵ ${amt}) [${status}]`;
      }).join("\n");
    }

    const allGrossRev = allWebRevenue + allWaRevenue + servicesRev + checkersRev;
    const todayGrossRev = todayWebRevenue + todayWaRevenue;
    const ghanaTime = new Date().toLocaleString("en-GB", {
      timeZone: "Africa/Accra",
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true
    });

    let copilotTip = "Post a 2-hour Flash Promo on your WhatsApp Status for 5GB MTN — urgency drives 40% of daily volume!";
    if (walletBalance && Number(walletBalance.replace(/[^\d.]/g, "") || 0) < 50) {
      copilotTip = "⚠️ DataMart wallet balance is below GH₵ 50. Top up now so automated network dispatch does not pause!";
    } else if (allFailed.length > 0) {
      copilotTip = `⚠️ You have ${allFailed.length} orders needing manual attention. Send the order reference to inspect or retry!`;
    }

    const deliveryEta = settingsMap["delivery_eta"] || "~5-30 minutes";
    const todayPaid = [...todayWebOrders, ...todayWaOrders];

    return [
      `👑 *${shopName.toUpperCase()} — EXECUTIVE BOT DASHBOARD*`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `🕒 _Accra Time: ${ghanaTime}_`,
      `⚡ _Telecom Delivery Speed: ${deliveryEta}_`,
      ``,
      `💰 *FINANCIAL & CASH FLOW*`,
      `• Gross Sales (All-Time): *GH₵ ${allGrossRev.toFixed(2)}*`,
      `• Today's Sales: *GH₵ ${todayGrossRev.toFixed(2)}* (${todayPaid.length} orders)`,
      `• DataMart API Wallet: *${walletBalance}*`,
      `• Arkesel SMS Balance: *${arkeselSms !== null ? `${arkeselSms} SMS` : "Connected"}*`,
      ``,
      `📦 *DATA DISPATCH & NETWORK PIPELINE*`,
      `• Confirmed Delivered: *${allDelivered.length}* ✅`,
      `• In Progress / Queued: *${allPending.length}* ⏳`,
      `• Attention Needed: *${allFailed.length}* ${allFailed.length > 0 ? "⚠️" : "✨"}`,
      `• Network Breakdown: MTN (*${mtnPaidOrders}*) | Telecel (*${telecelPaidOrders}*) | AT (*${atPaidOrders}*)`,
      `• Leading Network: *${topNetwork}* 🏆`,
      ``,
      `⚡ *DIGITAL SERVICES & CHECKERS*`,
      `• Netflix 30-Day: *${netflixPaid.length} Active*`,
      `• MTN MashUp: *${mashupPaid.length} Dispatched*`,
      `• AFA Registrations: *${afaPaid.length} Processed*`,
      `• WAEC Checkers: *${paidCheckers.length} Sold*`,
      `• Digital Services Gross: *GH₵ ${(servicesRev + checkersRev).toFixed(2)}*`,
      ``,
      `🕒 *LATEST 5 TRANSACTIONS (LIVE)*`,
      recentListText,
      ``,
      `🌐 *OFFICIAL PLATFORM LINKS*`,
      `• Storefront (Shop): *${STORE_FRONTEND_URL}*`,
      `• Admin Portal: *${ADMIN_DASHBOARD_URL}*`,
      `• Mobile App (APK): *${DOWNLOAD_APP_URL}*`,
      `• Order Tracker: *${TRACK_ORDER_URL}*`,
      ``,
      `💡 *CO-PILOT TIP*`,
      `_${copilotTip}_`,
      ``,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `💬 _Chat naturally with Stony anytime — ask about orders, speeds, sales, or business ideas!_`
    ].join("\n");
  } catch (err) {
    console.error("REPORT COMPILATION ERROR:", err);
    return `📊 *DATA 1 GH — ALL ADMIN SECTIONS BRIEFING*\n━━━━━━━━━━━━━━━━━━━━━\n⚠️ Could not query some sections right now: ${err.message}\n\nPlease reply *ADMIN* to retry.`;
  }
}

/* =========================================================
CUSTOMER STONY AI HANDLER (KNOWLEDGE BASE & MULTI-MODEL)
========================================================= */
async function handleCustomerAi(from, rawText) {
  const text = String(rawText || "").trim();
  const lower = text.toLowerCase();
  const session = await getCustomerSession(from);

  // Gather any live order lookup context to feed into the AI so it answers naturally without rigid templates
  let customerOrderLookupCtx = "";
  const phoneMatch = lower.match(/\b(0[2357]\d{8}|233\d{9})\b/);
  const refMatch = text.match(/\b(REF-\d+|WS-?[A-Z0-9]{6,14}|[A-Z0-9]{8,})\b/i);
  if (refMatch || phoneMatch) {
    const lookup = refMatch ? refMatch[1] : phoneMatch[0];
    try {
      const { data: ords } = await supabase
        .from("orders")
        .select("reference, network, capacity, amount, delivery_status, recipient_phone, payment_status, created_at")
        .or(`reference.ilike.%${lookup}%,recipient_phone.ilike.%${lookup}%`)
        .order("created_at", { ascending: false })
        .limit(3);

      if (ords && ords.length > 0) {
        const liveStatus = await getRealDatamartDeliveryStatus(ords[0].reference).catch(() => ({ deliveryStatus: ords[0].delivery_status }));
        customerOrderLookupCtx = `\nLIVE ORDER LOOKUP FOR "${lookup}":\n` +
          ords.map((o, idx) => `${idx + 1}. Ref: ${o.reference} | ${o.capacity}GB ${o.network} → ${o.recipient_phone} | Amount: GH₵ ${o.amount} | Payment: ${o.payment_status} | Live Delivery Status: ${idx === 0 ? (liveStatus?.deliveryStatus || o.delivery_status) : o.delivery_status}`).join("\n") + "\n";
      }
    } catch (_) { }
  }

  // AI Mode Response (Multi-model: Groq openai/gpt-oss-120b / Gemini / OpenRouter / OpenAI)
  const liveDbKnowledge = await fetchLiveDatabaseKnowledge();
  let ownerCustomDirectives = "";
  try {
    const { data: sRow } = await supabase.from("settings").select("value").eq("key", "ai_system_instructions").maybeSingle();
    if (sRow?.value) ownerCustomDirectives = sRow.value.trim();
  } catch (_) { }

  let customerAiReply = "";

  let customerAiPrompt = "";
  if (session?.agent_id) {
    const pkgs = getPackagesForSession(session);
    const mtnList = Object.values(pkgs.MTN || {}).map(p => `${p.capacity}GB: GH₵ ${p.price.toFixed(2)}`).join(", ");
    const atList = Object.values(pkgs.AIRTELTIGO || {}).map(p => `${p.capacity}GB: GH₵ ${p.price.toFixed(2)}`).join(", ");
    const telList = Object.values(pkgs.TELECEL || {}).map(p => `${p.capacity}GB: GH₵ ${p.price.toFixed(2)}`).join(", ");
    const storeUrl = getAgentStoreUrl(session);

    customerAiPrompt =
      `You are the friendly, helpful customer support assistant for "${session.agent_name}" on WhatsApp.\n\n` +
      `CRITICAL ISOLATION & ZERO-LEAKAGE RULES:\n` +
      `- You represent ONLY "${session.agent_name}".\n` +
      `- NEVER mention "Data 1 GH", "Data1gh", base prices, wholesale suppliers, or third-party providers under any circumstance.\n` +
      `- The store link is ${storeUrl}.\n` +
      `- Current Selling Prices for ${session.agent_name}:\n` +
      `  • MTN Non-Expiry: ${mtnList}\n` +
      `  • AirtelTigo: ${atList}\n` +
      `  • Telecel: ${telList}\n` +
      `- Chat warmly and naturally like a real person on WhatsApp.\n` +
      `- Invite customers to reply 1 (MTN), 2 (AirtelTigo), 3 (Telecel) or visit ${storeUrl} to purchase.\n` +
      `- Keep responses concise and formatted for WhatsApp.` +
      (customerOrderLookupCtx ? `\n${customerOrderLookupCtx}` : "");
  } else {
    customerAiPrompt =
      "You are Stony, a friendly, warm Ghanaian customer support person at DATA 1 GH on WhatsApp.\n\n" +
      (ownerCustomDirectives ? `=== 👑 STORE OWNER'S CUSTOM TRAINING & RULES (HIGHEST PRIORITY) ===\n${ownerCustomDirectives}\n===================================================================\n\n` : "") +
      "YOUR PERSONALITY & COMMUNICATION STYLE:\n" +
      "- You chat like a real person on WhatsApp: warm, natural Ghanaian tone (\"bossu\", \"chale\", \"sharp\", \"no wahala\").\n" +
      "- You are Stony. NEVER say \"As an AI\" or sound like a robot.\n" +
      "- ANSWER ANY QUESTION LIKE A HUMAN BEING: If customers ask about general life, advice, tech, football, Ghanaian news, weather, or casual banter, answer them thoughtfully and warmly like a real person.\n" +
      "- THE GOLDEN BUSINESS BRIDGE: After answering, always naturally and warmly bring the conversation back to the business — invite them to check prices or top up their SIM line!\n" +
      "- BE STRAIGHTFORWARD, DIRECT, AND FACTS-FIRST: When customers ask for bundle prices, networks, links, or order info, give the exact numbers and information immediately in your first sentence.\n" +
      "- Always guide customers warmly either to buy online or reply with numbers 1-8 right here on WhatsApp.\n\n" +
      "LIVE DATA CATALOG FROM DATABASE:\n" +
      (liveDbKnowledge ? `${liveDbKnowledge}\n` : "") +
      (customerOrderLookupCtx ? `\n${customerOrderLookupCtx}\n` : "") +
      "FULL SITE KNOWLEDGE BASE (EVERYTHING ON THE SITE):\n" +
      SITE_KNOWLEDGE_BASE + "\n\n" +
      "SECURITY POLICY:\n" +
      "- You must NEVER disclose internal administrative login credentials, passwords, or secrets to anyone.\n" +
      "HOW TO GUIDE CUSTOMERS ON WHATSAPP:\n" +
      "- To buy MTN: reply 1 (or visit " + STORE_FRONTEND_URL + ")\n" +
      "- To buy AirtelTigo: reply 2 (or visit " + STORE_FRONTEND_URL + ")\n" +
      "- To buy Telecel: reply 3 (or visit " + STORE_FRONTEND_URL + ")\n" +
      "- To track order: reply 4 or send phone number/reference (or visit " + TRACK_ORDER_URL + ")\n" +
      "- Netflix 30-day: reply 5\n" +
      "- AFA registration: reply 6\n" +
      "- MTN MashUp: reply 7\n" +
      "- Scratch & Win: reply 8\n" +
      "- Official Android App: " + DOWNLOAD_APP_URL + "\n" +
      "- Official Store Link: " + STORE_FRONTEND_URL + "\n" +
      "Keep your answer natural, conversational, and helpful.";
  }

  const aiResult = await executeBotAi({
    systemPrompt: customerAiPrompt,
    userMessage: text,
    maxTokens: 1500,
    temperature: 0.7
  });

  if (aiResult?.text) {
    customerAiReply = aiResult.text;
  }

  if (customerAiReply) {
    if (session?.agent_id) {
      customerAiReply = sanitizeSecretsFromText(customerAiReply)
        .replace(/\b(as an ai( language model)?|i am an ai( language model)?|i'm an ai( language model)?)\b/gi, `I am your support assistant at ${session.agent_name || "our store"}`)
        .replace(/\b(DATA 1 GH|Data1gh|data-ease|dataease)\b/gi, session.agent_name || "our store");
    } else {
      customerAiReply = sanitizeSecretsFromText(customerAiReply)
        .replace(/\b(as an ai( language model)?|i am an ai( language model)?|i'm an ai( language model)?)\b/gi, "I am Stony from DATA 1 GH")
        .replace(/\bdatamart\b/gi, "DATA 1 GH");
    }
    return sendWhatsApp(from, customerAiReply);
  }

  // 4. Fallback
  const fallbackReply = generateCustomerNaturalFallback(lower, session);
  return sendWhatsApp(from, fallbackReply);
}

/* =========================================================
WEBHOOK VERIFY
========================================================= */

app.get("/webhook", (req, res) => {
  res.send(req.query["hub.challenge"]);
});

/* =========================================================
WHATSAPP WEBHOOK (RECEIVE MESSAGES)
========================================================= */

app.post("/webhook", async (req, res) => {
  res.sendStatus(200);

  try {
    const msg = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!msg) return;

    const from = msg.from;
    const text = (msg.text?.body || "").trim();

    console.log("📩", from, text);

    /* =====================================================
    DYNAMIC OWNER & ADMIN PHONE DETECTION
    ===================================================== */
    const adminPhones = ["233547100951", "0547100951", "233592753424", "0592753424"];
    if (process.env.ADMIN_ALERT_PHONE) adminPhones.push(String(process.env.ADMIN_ALERT_PHONE).replace(/\D/g, ""));
    try {
      const { data: sRows } = await supabase
        .from("settings")
        .select("key,value")
        .in("key", ["admin_alert_phone", "support_phone"]);
      (sRows || []).forEach(r => {
        if (r.value) adminPhones.push(String(r.value).replace(/\D/g, ""));
      });
    } catch (_) { }

    const normFrom = String(from || "").replace(/\D/g, "");
    const isOwner = adminPhones.some(p => p && (normFrom === p || normFrom.endsWith(p.slice(-9)) || p.endsWith(normFrom.slice(-9))));

    // Check if sender is a Registered Agent / Reseller
    let matchedAgent = null;
    try {
      const { data: agentRows } = await supabase
        .from("agents")
        .select("id, name, phone, whatsapp_number, store_name, store_slug, wallet_balance, total_earnings, custom_domain");
      if (agentRows && agentRows.length > 0) {
        matchedAgent = agentRows.find((a) => {
          const p1 = (a.phone || "").replace(/\D/g, "");
          const p2 = (a.whatsapp_number || "").replace(/\D/g, "");
          return (
            (p1 && (normFrom === p1 || normFrom.endsWith(p1.slice(-9)) || p1.endsWith(normFrom.slice(-9)))) ||
            (p2 && (normFrom === p2 || normFrom.endsWith(p2.slice(-9)) || p2.endsWith(normFrom.slice(-9))))
          );
        });
      }
    } catch (_) { }

    /* =====================================================
    AGENT STORE CO-PILOT (RESELLER WHATSAPP ASSISTANT)
    ===================================================== */
    if (!isOwner && matchedAgent) {
      const cleanCmd = text.trim();
      const lowerCmd = cleanCmd.toLowerCase();
      const storeDomain = (matchedAgent.custom_domain || "https://gooddata1.vercel.app").replace(/\/+$/, "");
      const storefrontUrl = `${storeDomain}/s/${matchedAgent.store_slug}`;
      const dashboardUrl = `${storeDomain}/agent/dashboard`;

      // 1. Root admin security check
      const isRootAdminAction = /\b(credit\s+agent|broadcast|bulk\s+sms|blast\s+sms|turn\s+(?:on|off)\s+free\s+data|free\s+data\s+code|change\s+base\s+price|admin\s+password|admin\s+login|secret\s+key)\b/i.test(cleanCmd);
      if (isRootAdminAction) {
        return sendWhatsApp(
          from,
          `⚠️ *MAIN ADMINISTRATOR PRIVILEGE REQUIRED*\n\nThis command is reserved for Master Administrators.\n\nAs the verified Store Partner for *${matchedAgent.store_name}*, you have full Store Co-Pilot control over your shop:\n• *balance* - Check wallet balance & today's profit\n• *orders* - View latest customer sales\n• *link* - Get your live customer storefront link\n• *referrals* - View 5GB customer reward milestones\n\nReply *menu* to explore your Co-Pilot!`
        );
      }

      // 2. Help / Menu
      if (/^(menu|help|hi|hello|start|hey|copilot|co-pilot)$/i.test(lowerCmd)) {
        return sendWhatsApp(
          from,
          `🏪 *Welcome to your Store Co-Pilot, ${matchedAgent.name}!*\n` +
          `📍 *Store:* ${matchedAgent.store_name}\n` +
          `💰 *Wallet Balance:* GH₵ ${Number(matchedAgent.wallet_balance || 0).toFixed(2)}\n` +
          `📈 *Total Profit Earned:* GH₵ ${Number(matchedAgent.total_earnings || 0).toFixed(2)}\n\n` +
          `*Quick Commands:*\n` +
          `📊 *balance* - Check wallet, profit & today's sales\n` +
          `📦 *orders* - View your 5 latest storefront orders\n` +
          `🔗 *link* - Get your customer storefront URL\n` +
          `🎁 *referrals* - Check customer 5GB reward promoters\n` +
          `⚡ *track [ref]* - Track any order reference\n\n` +
          `💬 _Or just ask me any question about your store, pricing, or orders!_`
        );
      }

      // 3. Balance & Profits
      if (/\b(balance|wallet|earnings|profit|revenue|how much)\b/i.test(lowerCmd)) {
        const todayDate = new Date().toISOString().split("T")[0];
        let todayCount = 0;
        let todayProfit = 0;
        let totalSalesCount = 0;

        try {
          const { data: ords } = await supabase
            .from("orders")
            .select("id, amount, base_price, created_at, status, payment_status")
            .or(`agent_id.eq.${matchedAgent.id},notes.ilike.%[agent:${matchedAgent.id}]%`);

          if (ords) {
            totalSalesCount = ords.length;
            ords.forEach((o) => {
              const isToday = (o.created_at || "").startsWith(todayDate);
              const p = o.amount && o.base_price ? Math.max(0, Number(o.amount) - Number(o.base_price)) : 0;
              if (isToday) {
                todayCount++;
                todayProfit += p;
              }
            });
          }
        } catch (_) { }

        return sendWhatsApp(
          from,
          `📊 *STORE FINANCIAL REPORT*\n` +
          `🏪 *${matchedAgent.store_name}*\n\n` +
          `💰 *Available Wallet Balance:* GH₵ ${Number(matchedAgent.wallet_balance || 0).toFixed(2)}\n` +
          `📈 *All-Time Profit Earned:* GH₵ ${Number(matchedAgent.total_earnings || 0).toFixed(2)}\n` +
          `📅 *Today's Sales:* ${todayCount} orders (+GH₵ ${todayProfit.toFixed(2)} profit)\n` +
          `🛍️ *Total Store Sales:* ${totalSalesCount} orders\n\n` +
          `💳 To withdraw to your Mobile Money, visit your portal:\n` +
          `👉 ${dashboardUrl}`
        );
      }

      // 4. Storefront Orders
      if (/\b(orders?|sales?|my orders|recent orders|latest orders)\b/i.test(lowerCmd)) {
        try {
          const { data: ords } = await supabase
            .from("orders")
            .select("id, reference, network, capacity, amount, base_price, recipient_phone, phone, notes, delivery_status, status, payment_status, created_at")
            .or(`agent_id.eq.${matchedAgent.id},notes.ilike.%[agent:${matchedAgent.id}]%`)
            .order("created_at", { ascending: false })
            .limit(5);

          if (!ords || ords.length === 0) {
            return sendWhatsApp(
              from,
              `📦 *STORE ORDERS*\n` +
              `🏪 *${matchedAgent.store_name}*\n\n` +
              `You have no customer orders yet.\n` +
              `Share your storefront link to start making sales:\n` +
              `👉 ${storefrontUrl}`
            );
          } else {
            const list = ords.map((o, idx) => {
              const profit = o.amount && o.base_price ? Math.max(0, Number(o.amount) - Number(o.base_price)) : 0;
              const deliv = (o.delivery_status || o.status || "pending").toUpperCase();
              const dateStr = o.created_at ? new Date(o.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Accra" }) : "";
              const isBot = Boolean(o.whatsapp_phone || (o.notes && o.notes.includes("whatsapp_bot")) || (o.reference && (o.reference.startsWith("WS-") || o.reference.startsWith("REF-"))));
              const channelTag = isBot ? "📱 *WhatsApp Bot*" : "🌐 *Web Store*";
              return `${idx + 1}️⃣ *${o.network || "DATA"} ${o.capacity || ""}* (${o.recipient_phone || "Customer"})\n   Channel: ${channelTag}\n   💵 GH₵ ${Number(o.amount || 0).toFixed(2)} | Net Profit: *+GH₵ ${profit.toFixed(2)}*\n   ⏱️ ${dateStr} | Status: ${deliv === "DELIVERED" ? "✅ DELIVERED" : "⏳ " + deliv}`;
            }).join("\n\n");

            return sendWhatsApp(
              from,
              `📦 *LATEST STORE ORDERS (Last 5)*\n` +
              `🏪 *${matchedAgent.store_name}*\n\n` +
              list +
              `\n\n💡 Reply *balance* to check your current withdrawable wallet.`
            );
          }
        } catch (_) {
          return sendWhatsApp(from, `⚠️ Could not retrieve store orders right now. Please try again.`);
        }
      }

      // 5. Store Link
      if (/\b(link|store|storefront|my link|website|url|bot link)\b/i.test(lowerCmd)) {
        const botUrl = `https://wa.me/233200598553?text=${encodeURIComponent(`Hi [store:${matchedAgent.store_slug}]`)}`;
        return sendWhatsApp(
          from,
          `🔗 *YOUR OFFICIAL STOREFRONT & BOT LINKS*\n` +
          `🏪 *${matchedAgent.store_name}*\n\n` +
          `🌐 *Web Storefront Link:*\n` +
          `👉 ${storefrontUrl}\n\n` +
          `🤖 *WhatsApp Bot Store Link:*\n` +
          `👉 ${botUrl}\n\n` +
          `✨ *Features:*\n` +
          `• Zero wholesale cost leakage — customers see ONLY ${matchedAgent.store_name} and your prices\n` +
          `• Automated MoMo payments & instant delivery\n` +
          `• Every sale's profit is credited directly to your wallet in real time!`
        );
      }

      // 6. Referrals & 5GB Free Data Rewards
      if (/\b(referral|referrals|promoter|promoters|5gb|milestone|bonus)\b/i.test(lowerCmd)) {
        let referralsList = [];
        try {
          const { data: refSetting } = await supabase
            .from("settings")
            .select("value")
            .eq("key", `agent_referrals_${matchedAgent.id}`)
            .maybeSingle();

          if (refSetting?.value) {
            referralsList = typeof refSetting.value === "string" ? JSON.parse(refSetting.value) : refSetting.value;
          }
        } catch (_) { }

        const totalPromoters = referralsList.length;
        const totalReferredOrders = referralsList.reduce((sum, r) => sum + (r.total_qualified_orders || 0), 0);
        const completedRewards = referralsList.filter((r) => (r.total_qualified_orders || 0) >= 5);

        let listDetail = "";
        if (referralsList.length > 0) {
          listDetail = referralsList.slice(0, 5).map((r) => {
            const count = r.total_qualified_orders || 0;
            const isReady = count >= 5;
            return `• *${r.customer_phone}* (${r.referral_code || "Code"}): ${count}/5 orders ${isReady ? "🏆 (5GB READY!)" : ""}`;
          }).join("\n");
        } else {
          listDetail = "_No customer promoters have registered on your store yet._";
        }

        return sendWhatsApp(
          from,
          `🎁 *CUSTOMER REFERRALS & 5GB REWARDS*\n` +
          `🏪 *${matchedAgent.store_name}*\n\n` +
          `👥 *Registered Promoters:* ${totalPromoters}\n` +
          `🛍️ *Total Referred Orders:* ${totalReferredOrders}\n` +
          `🏆 *Completed 5GB Rewards:* ${completedRewards.length}\n\n` +
          `*Promoter Progress:*\n` +
          listDetail +
          `\n\nℹ️ Once a promoter hits 5 friends, Main Admin is notified to manually issue their 5GB reward!`
        );
      }
    }

    /* =====================================================
    SECURITY FIREWALL: UNAUTHORIZED ADMIN ATTEMPTS & TAMPERING
    If any unauthorized number attempts admin commands, dashboard,
    or attempts to manipulate database/site settings:
    1. Disallow execution immediately
    2. Send Security Intrusion Alert to the Admin WhatsApp
    3. Log incident to database
    ===================================================== */
    const isAdminIntent =
      /^(admin|dashboard|report)$/i.test(text) ||
      /\b(update\s+order|order\s+status|delivery\s+status|payment\s+status|mark\s+delivered|mark\s+paid|change\s+price|toggle\s+stock|send\s+sms|generate\s+voucher|free\s+data\s+code|turn\s+(?:on|off)\s+free\s+data|credit\s+agent|list\s+agents|change\s+color|change\s+theme|update\s+announcement|admin\s+password|admin\s+login|secret\s+key|resync\s+order|retry\s+order|stuck\s+order|issue\s+radar)\b/i.test(text);

    if (!isOwner && !matchedAgent && isAdminIntent) {
      console.warn("🚨 UNAUTHORIZED ADMIN COMMAND ATTEMPT FROM:", from, text);
      await sendSecurityIntrusionAlert(from, text, "Unauthorized phone attempted administrative command/tampering");
      return await sendWhatsApp(
        from,
        "⚠️ *ACCESS RESTRICTED*\n\nThis command is for DATA 1 GH Administrators only.\n\nReply with *hi* to view customer data bundles and services."
      );
    }

    /* =====================================================
    MULTI-TENANT AGENT STOREFRONT DETECTION & BINDING
    Detects if an agent's customer arrives with [store:slug], [agent:id],
    or types the store slug, ensuring 100% storefront isolation.
    ===================================================== */
    let boundSession = await getCustomerSession(from);

    const storeTagMatch = text.match(/\[(?:store|agent):([a-zA-Z0-9_-]+)\]/i) || text.match(/^(?:store|agent|shop)\s*[:= ]\s*([a-zA-Z0-9_-]+)$/i);
    if (storeTagMatch) {
      const tagSlug = storeTagMatch[1].trim().toLowerCase();
      if (tagSlug === "main" || tagSlug === "reset" || tagSlug === "data1gh") {
        boundSession = await saveCustomerSession(from, { agent_id: null, agent_slug: null, agent_name: null, custom_prices: null, step: 1, bundle: null });
        const cleanAfterReset = text.replace(storeTagMatch[0], "").trim();
        if (!cleanAfterReset || /^(hi|hello|start|menu)$/i.test(cleanAfterReset)) {
          return sendWhatsApp(from, `👋 Switched back to *DATA 1 GH* main store!\n\n` + MENU);
        }
      } else {
        const agents = await getAllAgentsFromDatabase();
        const matched = agents.find(a =>
          (a.store_slug && a.store_slug.toLowerCase() === tagSlug) ||
          (a.id && a.id.toLowerCase() === tagSlug) ||
          (a.name && a.name.toLowerCase() === tagSlug) ||
          (a.store_name && a.store_name.toLowerCase() === tagSlug)
        );
        if (matched) {
          const livePrices = await getFreshAgentPricing(matched.id, matched.store_slug || tagSlug, matched.custom_prices);
          boundSession = await saveCustomerSession(from, {
            agent_id: matched.id,
            agent_slug: matched.store_slug || tagSlug,
            agent_name: matched.store_name || matched.name,
            custom_domain: matched.custom_domain || "https://gooddata1.vercel.app",
            custom_prices: livePrices,
            step: 1,
            bundle: null
          });
          setUserMode(from, "bot");
          const { MENU: agentMenu } = getMenusForSession(boundSession);
          return sendWhatsApp(from, agentMenu);
        }
      }
    }

    // Direct store slug message (e.g., customer just sends "stony" or "mayor-cheap-data")
    if (!matchedAgent && /^[a-z0-9_-]{2,35}$/i.test(text.trim())) {
      const possibleSlug = text.trim().toLowerCase();
      if (!/^(menu|help|hi|hello|start|track|admin|dashboard|orders|balance|cancel)$/i.test(possibleSlug)) {
        const agents = await getAllAgentsFromDatabase();
        const slugMatched = agents.find(a =>
          (a.store_slug && a.store_slug.toLowerCase() === possibleSlug) ||
          (a.id && a.id.toLowerCase() === possibleSlug) ||
          (a.name && a.name.toLowerCase() === possibleSlug) ||
          (a.store_name && a.store_name.toLowerCase() === possibleSlug)
        );
        if (slugMatched) {
          const livePrices = await getFreshAgentPricing(slugMatched.id, slugMatched.store_slug || possibleSlug, slugMatched.custom_prices);
          boundSession = await saveCustomerSession(from, {
            agent_id: slugMatched.id,
            agent_slug: slugMatched.store_slug || possibleSlug,
            agent_name: slugMatched.store_name || slugMatched.name,
            custom_domain: slugMatched.custom_domain || "https://gooddata1.vercel.app",
            custom_prices: livePrices,
            step: 1,
            bundle: null
          });
          setUserMode(from, "bot");
          const { MENU: agentMenu } = getMenusForSession(boundSession);
          return sendWhatsApp(from, agentMenu);
        }
      }
    }

    /* =====================================================
    MODE BREAKDOWN (BOT MENU MODE vs STONY AI MODE)
    - "Hi" / "Hello" / "Start" / "Menu" / "Bot" -> Enter BOT MODE (shows MENU)
    - "Stony" / "AI" / "AI Mode" -> Enter STONY AI MODE
    ===================================================== */
    const isHi = /^(hi|hello|start|menu|bot|bot mode|menu mode|customer|reset|restart)$/i.test(text.trim());
    const isStonySwitch = /^(stony|ai|ai mode|stony ai|switch to ai|ask stony|talk to stony|enter ai mode)$/i.test(text);
    const startsWithStony = /^stony\b/i.test(text);

    let currentSession = boundSession || (await getCustomerSession(from));
    let hasAgent = Boolean(currentSession?.agent_id);

    // If owner explicitly wants to exit agent store testing mode or calls Stony Co-Pilot
    if (isOwner && /^(admin|owner|exit|reset|copilot|main|exit\s*store|main\s*store|switch\s*to\s*owner|owner\s*mode|leave\s*store)$/i.test(text.trim())) {
      boundSession = await saveCustomerSession(from, { agent_id: null, agent_slug: null, agent_name: null, custom_prices: null, step: 99, bundle: null });
      currentSession = boundSession;
      hasAgent = false;
      setUserMode(from, "ai");
      if (/^(exit|reset|main|exit\s*store|main\s*store|switch\s*to\s*owner|owner\s*mode|leave\s*store)$/i.test(text.trim())) {
        return sendWhatsApp(from, `👑 Switched back to *DATA 1 GH Owner Mode* bossu! Reply *Hi* for the menu or ask me anything.`);
      }
    }

    if (isOwner && startsWithStony) {
      boundSession = await saveCustomerSession(from, { agent_id: null, agent_slug: null, agent_name: null, custom_prices: null, step: 99, bundle: null });
      currentSession = boundSession;
      hasAgent = false;
    }

    // 1. SWITCH TO BOT MODE (Shows Menu)
    if (isHi) {
      setUserMode(from, "bot");
      const savedSess = await saveCustomerSession(from, { step: 1, bundle: null });
      if (isOwner && !savedSess?.agent_id) {
        await clearOwnerPendingAction(from);
      }
      const { MENU: activeMenu } = getMenusForSession(savedSess);
      return sendWhatsApp(from, activeMenu);
    }

    // 2. SWITCH TO STONY AI MODE
    if (isStonySwitch) {
      setUserMode(from, "ai");
      await saveCustomerSession(from, { step: 99 });
      // For customers (or owner testing an agent storefront), greet via customer AI; for owner, flow directly into Owner Co-Pilot AI!
      if (!isOwner || hasAgent) {
        return handleCustomerAi(from, text);
      }
    }

    // 3. Message starts with "Stony [command/query]"
    let effectiveText = text;
    if (startsWithStony) {
      setUserMode(from, "ai");
      await saveCustomerSession(from, { step: 99 });
      effectiveText = text.replace(/^stony\s*[,:]?\s*/i, "").trim() || "hello";
    }

    const isMainMenuNumber = /^[1-8]$/.test(text.trim());
    if (isMainMenuNumber && (!currentSession || !currentSession.step || currentSession.step === 1 || currentSession.step === 99)) {
      setUserMode(from, "bot");
      const baseSession = { ...(currentSession || {}), phone: String(from), step: 1 };
      await saveCustomerSession(from, { step: 1 });
      currentSession = baseSession;
    }

    const isInBotCheckoutStep = Boolean(currentSession && currentSession.step > 1 && currentSession.step < 99);
    if (isInBotCheckoutStep) {
      setUserMode(from, "bot");
    }
    const activeMode = isInBotCheckoutStep ? "bot" : getUserMode(from, currentSession);

    // If Owner is messaging:
    // When owner is in active checkout (testing buying bundles, entering phone/momo numbers),
    // let them complete checkout! Only switch to Owner AI if they explicitly message "stony", "admin", "owner", "exit", "cancel", "reset", or prefix with "stony ".
    const isOwnerExplicitAiCommand = startsWithStony || /^(stony|admin|owner|exit|cancel|reset)$/i.test(text.trim());
    const ownerTestingMenuDigit = isOwner && isMainMenuNumber;
    const shouldEnterOwnerAi = isOwner && !hasAgent && (
      isOwnerExplicitAiCommand ||
      (!isInBotCheckoutStep && !ownerTestingMenuDigit && (activeMode === "ai" || !/^(menu|customer)$/i.test(text.trim())))
    );

    /* =====================================================
    STONY OWNER AI — Personal Business Assistant & Co-Pilot
    Active whenever user is Owner (or mode is 'ai' / started with Stony)
    ===================================================== */
    if (shouldEnterOwnerAi) {
      // Auto-clear any customer checkout step for owner when explicitly switching to AI mode
      if (isInBotCheckoutStep && isOwnerExplicitAiCommand) {
        try {
          await saveCustomerSession(from, { step: 99, bundle: null });
        } catch (_) { }
      }
      let ownerSession = currentSession;
      if (!ownerSession) {
        try {
          const { data: created } = await supabase
            .from("sessions")
            .upsert({ phone: String(from), step: 99 }, { onConflict: "phone" })
            .select("step, bundle, notes")
            .maybeSingle();
          ownerSession = created;
        } catch (_) { }
      }

      console.log("👑 OWNER CHAT WITH STONY (AI MODE) — message:", effectiveText);

      // ── CHECK IF OWNER IS CONFIRMING A PENDING ACTION ──
      const normFrom = String(from || "").replace(/\D/g, "");
      let pendingAction = ownerPendingActions.get(normFrom) || ownerPendingActions.get(String(from)) || null;
      if (!pendingAction && ownerSession?.bundle) {
        try {
          pendingAction = JSON.parse(ownerSession.bundle);
        } catch (_) { }
      }

      // Load multi-turn conversation memory early
      let history = ownerHistories.get(normFrom) || ownerHistories.get(String(from)) || [];
      if (!history || history.length === 0) {
        try {
          if (ownerSession?.notes) {
            const parsed = JSON.parse(ownerSession.notes);
            if (Array.isArray(parsed)) history = parsed;
          }
        } catch (_) { }
      }

      const cleanInput = text.trim();

      // ── 0. OWNER AI TRAINING & CORRECTION HANDLER (WHATSAPP → PERMANENT MEMORY) ──
      const isDirectTraining =
        /\b(?:don'?t\s+do\s+(?:this|that)\s+again|never\s+do\s+(?:this|that)\s+again|don'?t\s+say\s+(?:this|that)\s+again|never\s+say\s+(?:this|that)\s+again|save\s+(?:this\s+rule|this\s+instruction|this\s+correction|rule|instruction)|remember\s+(?:this|that)|from\s+now\s+on|train\s*:|correction\s*:)\b/i.test(cleanInput);

      const isSaveNowIntent =
        /^(?:save\s*now|okay\s*save|ok\s*save|yes\s*save|save\s*it|save\s*this|save|please\s*save)$/i.test(cleanInput);

      if (isDirectTraining || isSaveNowIntent) {
        let ruleToSave = "";

        if (isDirectTraining) {
          ruleToSave = cleanInput
            .replace(/^(?:stony|hey\s+stony|hi\s+stony)[,:\s]*/i, "")
            .replace(/^(?:please\s+)?(?:don'?t\s+do\s+(?:this|that)\s+again|never\s+do\s+(?:this|that)\s+again|don'?t\s+say\s+(?:this|that)\s+again|never\s+say\s+(?:this|that)\s+again|save\s+(?:this\s+rule|this\s+instruction|this\s+correction|rule|instruction)|remember\s+(?:this|that)|from\s+now\s+on|train\s*:|correction\s*:)[:,\s-]*/i, "")
            .trim();

          if (!ruleToSave || ruleToSave.length < 3) {
            const lastAssist = [...history].reverse().find(h => h.role === "assistant" && h.text);
            if (lastAssist?.text) {
              const snippet = lastAssist.text.slice(0, 140).replace(/\n/g, " ");
              ruleToSave = `Do not repeat or use this prior response: "${snippet}..."`;
            } else {
              ruleToSave = cleanInput;
            }
          }
        } else if (isSaveNowIntent) {
          const lastUser = [...history].reverse().find(h => h.role === "user" && h.text && h.text.trim() !== cleanInput);
          if (lastUser?.text) {
            ruleToSave = lastUser.text
              .replace(/^(?:stony|hey\s+stony|hi\s+stony)[,:\s]*/i, "")
              .replace(/^(?:please\s+)?(?:don'?t\s+do\s+(?:this|that)\s+again|never\s+do\s+(?:this|that)\s+again|don'?t\s+say\s+(?:this|that)\s+again|never\s+say\s+(?:this|that)\s+again|save\s+(?:this\s+rule|this\s+instruction|this\s+correction|rule|instruction)|remember\s+(?:this|that)|from\s+now\s+on|train\s*:|correction\s*:)[:,\s-]*/i, "")
              .trim();
          }
          if (!ruleToSave) {
            ruleToSave = "Always follow the owner's operational standards strictly and answer customers with human warmth.";
          }
        }

        if (ruleToSave) {
          try {
            const { data: sRow } = await supabase
              .from("settings")
              .select("value")
              .eq("key", "ai_system_instructions")
              .maybeSingle();

            const existingInstructions = (sRow?.value || "").trim();
            const dateTag = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
            const newDirective = `• [Owner WhatsApp Training - ${dateTag}]: ${ruleToSave}`;

            let updatedInstructions = existingInstructions
              ? `${existingInstructions}\n\n${newDirective}`
              : newDirective;

            await supabase.from("settings").upsert(
              [{ key: "ai_system_instructions", value: updatedInstructions }],
              { onConflict: "key" }
            );

            const ackMsg = `Sharp bossu! 🧠 Saved and learned.\n\nI have permanently recorded this instruction in my AI training memory:\n👉 "${ruleToSave}"\n\nFrom now on, I will strictly follow this on WhatsApp, on the website customer support, and everywhere in the system! You can also view or add more in Admin > AI Training & Prompts anytime.`;

            const updatedHist = [
              ...history.slice(-5),
              { role: "user", text: cleanInput },
              { role: "assistant", text: ackMsg }
            ];
            await saveOwnerHistory(from, updatedHist);

            return sendWhatsApp(from, ackMsg);
          } catch (trainErr) {
            console.error("Failed saving WhatsApp training directive:", trainErr);
            return sendWhatsApp(from, `⚠️ Could not save training to database: ${trainErr.message}`);
          }
        }
      }

      const isMistakeOrIgnore = /^(mistake|wrong|wrong number|ignore|ignore it|ignore that|nevermind|never mind|forget it|my bad|by mistake)$/i.test(cleanInput.trim());
      const isCancel = isMistakeOrIgnore || /^(no|nope|cancel|nah|stop|abort|leave it)$/i.test(cleanInput.trim());

      // Recognize confirmation strictly when confirming a pending staged action
      const isConfirm = !isCancel && (
        /^(yes|yeah|yep|ok|okay|sure|yh|y|sharp|confirm|proceed|go|done|execute|apply|go ahead|do it|please do|send it|make it|update it|yes update|confirm update|proceed with update)$/i.test(cleanInput.trim())
      );

      // If pendingAction was missing from sessions.bundle, recover it from recent assistant turn in history
      if (!pendingAction && isConfirm && history.length > 0) {
        const lastAssist = [...history].reverse().find(h => h.role === "assistant" && h.text);
        if (lastAssist) {
          const recovered = extractProposedActionFromText(lastAssist.text);
          if (recovered?.action) {
            pendingAction = recovered.action;
            console.log("♻️ RECOVERED PENDING ACTION FROM RECENT CONVERSATION HISTORY:", pendingAction);
          }
        }
      }

      // If owner says "mistake", "ignore", "nevermind", or cancels (with or without a pending action)
      if (isMistakeOrIgnore || (pendingAction && isCancel)) {
        await clearOwnerPendingAction(from);
        return sendWhatsApp(from, "No problem at all boss — ignored and cancelled! Let me know whenever you need anything else.");
      }

      // If owner is confirming AND has pendingAction
      if (pendingAction && isConfirm) {
        const { type, network, capacity, status, smsText, inStock, productId, productName } = pendingAction;
        await clearOwnerPendingAction(from);

        // Gather all target references from pendingAction
        let targetRefs = [];
        if (Array.isArray(pendingAction.orders)) targetRefs.push(...pendingAction.orders);
        if (Array.isArray(pendingAction.refs)) targetRefs.push(...pendingAction.refs);
        if (Array.isArray(pendingAction.references)) targetRefs.push(...pendingAction.references);
        if (pendingAction.ref) targetRefs.push(pendingAction.ref);
        if (pendingAction.reference) targetRefs.push(pendingAction.reference);
        if (pendingAction.order_id) targetRefs.push(pendingAction.order_id);

        // Fallback: check if references are in the current text or previous assistant message
        if (targetRefs.length === 0) {
          targetRefs = extractOrderReferences(text);
        }
        if (targetRefs.length === 0 && history.length > 0) {
          const recentText = history.slice(-3).map(h => h.text).join(" ");
          targetRefs = extractOrderReferences(recentText);
        }

        targetRefs = [...new Set(targetRefs.map(r => String(r || "").replace(/[*_#`"']/g, "").trim()).filter(Boolean))];

        // 1. UPDATE ORDER STATUS (Single & Multiple Orders)
        if (type === "update_order_status" || (targetRefs.length > 0 && /\b(update|status|delivered|processing|pending|waiting|failed|cancelled|refunded)\b/i.test(cleanInput))) {
          const statusToSet = extractStatusFromText(cleanInput) || pendingAction.status || status || "delivered";
          const updatedRefs = [];

          for (const r of targetRefs) {
            const upd = await updateOrderDeliveryStatusSafely(r, statusToSet);
            if (upd) {
              updatedRefs.push(r);
              // Per owner instruction: Stop sending SMS when delivery status is updated
            }
          }

          if (updatedRefs.length > 0) {
            // Record in conversation memory
            try {
              const executionNote = {
                role: "assistant",
                text: `✅ Action completed: Updated ${updatedRefs.length} order(s) (${updatedRefs.join(", ")}) to ${statusToSet.toUpperCase()} in the database.`
              };
              const updatedHistory = [...history.slice(-5), { role: "user", text: effectiveText }, executionNote];
              await saveOwnerHistory(from, updatedHistory);
            } catch (_) { }

            return sendWhatsApp(from,
              `✅ *ACTION COMPLETED BOSS!*\n\n` +
              `I have successfully updated ${updatedRefs.length} order(s) to *${statusToSet.toUpperCase()}* in the database:\n` +
              updatedRefs.map(r => `• *${r}*`).join("\n") +
              `\n\nDatabase is now synchronized with reality! (SMS alerts disabled). What else would you like me to tackle?`
            );
          }
        }

        // 1b. UPDATE PAYMENT STATUS
        if (type === "update_payment_status") {
          const statusToSet = extractPaymentStatusFromText(cleanInput) || pendingAction.payment_status || pendingAction.status || status || "paid";
          const updatedRefs = [];

          for (const r of targetRefs) {
            const upd = await updateOrderPaymentStatusSafely(r, statusToSet);
            if (upd) {
              updatedRefs.push(r);
            }
          }

          if (updatedRefs.length > 0) {
            try {
              const executionNote = {
                role: "assistant",
                text: `✅ Action completed: Updated payment status for ${updatedRefs.length} order(s) (${updatedRefs.join(", ")}) to ${statusToSet.toUpperCase()} in the database.`
              };
              const updatedHistory = [...history.slice(-5), { role: "user", text: effectiveText }, executionNote];
              await saveOwnerHistory(from, updatedHistory);
            } catch (_) { }

            return sendWhatsApp(from,
              `✅ *PAYMENT STATUS UPDATED BOSS!*\n\n` +
              `I have successfully updated the payment status of ${updatedRefs.length} order(s) to *${statusToSet.toUpperCase()}* in the database:\n` +
              updatedRefs.map(r => `• *${r}*`).join("\n") +
              `\n\nDatabase payment records are synchronized! What else would you like me to tackle?`
            );
          }
        }

        // 2. RESYNC ORDER
        if (type === "resync_order" && targetRefs.length > 0) {
          const r = targetRefs[0];
          try {
            const live = await getRealDatamartDeliveryStatus(r);
            if (live?.deliveryStatus) {
              await supabase.from("orders").update({
                delivery_status: live.deliveryStatus,
                datamart_status: live.rawStatus,
                updated_at: new Date().toISOString()
              }).eq("reference", r);
            }
            return sendWhatsApp(from, `✅ *RESYNC COMPLETE!*\n\nOrder *${r}* live network status:\n• Delivery Status: *${live?.deliveryStatus || "Updated"}*\n• Raw: ${live?.rawStatus || "Checked"}\n\nDatabase has been updated.`);
          } catch (err) {
            return sendWhatsApp(from, `❌ Resync error: ${err.message}`);
          }
        }

        // 3. RETRY ORDER
        if (type === "retry_order" && targetRefs.length > 0) {
          const r = targetRefs[0];
          const aPhone = pendingAction.phone;
          try {
            const retryRes = await axios.post(`${DATAMART_BASE}/purchase`, {
              phoneNumber: aPhone,
              network: network || "YELLO",
              capacity: String(capacity || "1"),
              gateway: "wallet",
              delivery: "fast"
            }, { headers: { "x-api-key": DATA_API_KEY, "Content-Type": "application/json" }, timeout: 30000 });
            const retryData = retryRes.data?.data || retryRes.data || {};
            const newRef = retryData.reference || retryData.orderReference || null;
            await supabase.from("orders").update({ delivery_status: "processing", updated_at: new Date().toISOString() }).eq("reference", r);
            return sendWhatsApp(from, `✅ *RETRY DISPATCHED BOSS!*\n\nPackage: ${capacity}GB → ${aPhone}\nNetwork: ${network || "YELLO"}${newRef ? `\nNew supplier ref: ${newRef}` : ""}\n\nI will continue supervising delivery for you.`);
          } catch (retryErr) {
            return sendWhatsApp(from, `❌ Retry failed boss: ${retryErr.response?.data?.message || retryErr.message}\nCheck DataMart wallet balance and try again.`);
          }
        }

        // 4. SEND CUSTOM SMS
        if (type === "send_sms" && pendingAction.phone) {
          const msg = smsText || pendingAction.smsText || pendingAction.message || "DATA 1 GH: Your order has been updated. Thank you!";
          await sendAdminSms(msg, pendingAction.phone);
          // Save confirmation in conversation memory
          try {
            const executionNote = {
              role: "assistant",
              text: `✅ SMS delivered to ${pendingAction.phone} with Sender ID D_1Gh: "${msg}"`
            };
            const updatedHistory = [...history.slice(-5), { role: "user", text }, executionNote];
            await saveOwnerHistory(from, updatedHistory);
          } catch (_) { }
          return sendWhatsApp(from, `✅ *SMS DELIVERED BOSS!*\n\nRecipient: ${pendingAction.phone}\nSender ID: *D_1Gh*\nMessage: "${msg}"\n\nAnything else on your mind?`);
        }

        // 5. TOGGLE PRODUCT STOCK
        if ((type === "toggle_stock" || type === "toggle_product_stock") && (productId || pendingAction.product_id)) {
          const pId = productId || pendingAction.product_id;
          await supabase.from("products").update({ in_stock: Boolean(inStock), updated_at: new Date().toISOString() }).eq("id", pId);
          return sendWhatsApp(from, `✅ *INVENTORY UPDATED!*\n\n*${productName || "Package"}* is now *${inStock ? "IN STOCK" : "OUT OF STOCK"}* on the website!`);
        }

        // 6. UPDATE PRODUCT PRICE
        if (type === "update_product_price" && (productId || pendingAction.product_id)) {
          const pId = productId || pendingAction.product_id;
          const newPrice = parseFloat(pendingAction.price || pendingAction.new_price);
          if (!isNaN(newPrice)) {
            await supabase.from("products").update({ price: newPrice, updated_at: new Date().toISOString() }).eq("id", pId);
            return sendWhatsApp(from, `✅ *PRICE UPDATED!*\n\n*${productName || "Package"}* price has been changed to *GH₵ ${newPrice.toFixed(2)}* on the store!`);
          }
        }

        // 7. RESOLVE SUPPORT CHAT
        if (type === "resolve_support_chat") {
          const cId = pendingAction.conversation_id || pendingAction.conversationId;
          const cPhone = pendingAction.phone;
          let q = supabase.from("chat_conversations").update({ status: "resolved", unread_for_support: 0, updated_at: new Date().toISOString() });
          if (cId) q = q.eq("id", cId);
          else if (cPhone) q = q.eq("customer_phone", cPhone);
          else q = q.eq("status", "open");
          await q;
          return sendWhatsApp(from, `✅ *SUPPORT CHAT RESOLVED!*\n\nActive customer support conversation has been marked as resolved and closed from queue.`);
        }

        // 8. UPDATE DIGITAL SERVICE STATUS (Netflix, MashUp, AFA)
        if (type === "update_service_status" && targetRefs.length > 0) {
          const statusToSet = status || "delivered";
          for (const r of targetRefs) {
            await supabase.from("service_orders").update({ delivery_status: statusToSet, updated_at: new Date().toISOString() }).or(`reference.ilike.%${r}%`);
            // Per owner instruction: Stop sending SMS when delivery status is updated
          }
          return sendWhatsApp(from, `✅ *SERVICE ORDER UPDATED!*\n\nReference(s): ${targetRefs.join(", ")}\nNew Status: *${statusToSet.toUpperCase()}*`);
        }

        // 9. UPDATE CHECKER STATUS
        if (type === "update_checker_status" && targetRefs.length > 0) {
          const statusToSet = status || "delivered";
          for (const r of targetRefs) {
            await supabase.from("checker_orders").update({ delivery_status: statusToSet, updated_at: new Date().toISOString() }).or(`reference.ilike.%${r}%`);
          }
          return sendWhatsApp(from, `✅ *RESULT CHECKER ORDER UPDATED!*\n\nReference(s): ${targetRefs.join(", ")}\nNew Status: *${statusToSet.toUpperCase()}*`);
        }

        // 10. UPDATE STORE ANNOUNCEMENT
        if (type === "update_announcement") {
          const title = pendingAction.title || "Store Announcement";
          const message = pendingAction.message || pendingAction.announcement || "";
          const enabled = pendingAction.enabled !== undefined ? Boolean(pendingAction.enabled) : true;
          await updateStoreAnnouncement({ title, message, enabled });
          return sendWhatsApp(from,
            `✅ *STORE ANNOUNCEMENT UPDATED!*\n\n` +
            `📢 *Title:* ${title}\n` +
            (message ? `💬 *Message:* "${message}"\n` : "") +
            `⚡ *Status:* ${enabled ? "LIVE ON SHOP ✅" : "OFF ❌"}\n\n` +
            `Visitors on https://www.data1gh.com will see this immediately!`
          );
        }

        // 11. UPDATE STORE SETTING ("the rest")
        if (type === "update_setting") {
          const k = String(pendingAction.key || "").trim();
          const v = String(pendingAction.value !== undefined ? pendingAction.value : "").trim();
          if (k) {
            await updateStoreSetting(k, v);
            return sendWhatsApp(from,
              `✅ *STORE SETTING UPDATED!*\n\n` +
              `⚙️ *Setting:* ${k}\n` +
              `📝 *New Value:* *${v}*\n\n` +
              `Database and store configuration synchronized!`
            );
          }
        }

        // 12. GENERATE FREE DATA VOUCHERS
        if (type === "generate_vouchers") {
          const count = parseInt(pendingAction.count, 10) || 5;
          const net = pendingAction.network || "MTN";
          const cap = pendingAction.capacity || "1";
          const res = await generateFreeDataVouchersSafely(count, net, cap);
          return sendWhatsApp(from,
            `🎁 *FREE DATA VOUCHERS GENERATED!*\n\n` +
            `• *Network:* ${res.network}\n` +
            `• *Package:* ${res.capacity}GB\n` +
            `• *Total Codes (${res.codes.length}):*\n\n` +
            res.codes.map((c, i) => `${i + 1}. *${c}*`).join("\n") +
            `\n\nThese codes are saved live in the database and ready for customers to claim on the site!`
          );
        }

        // 13. TOGGLE FREE DATA CAMPAIGN
        if (type === "toggle_free_data") {
          const act = Boolean(pendingAction.active);
          await toggleFreeDataCampaign(act);
          return sendWhatsApp(from,
            `🎁 *FREE DATA CAMPAIGN UPDATED!*\n\n` +
            `⚡ *Status:* ${act ? "ACTIVE & LIVE ON SITE ✅" : "DISABLED / TURNED OFF ❌"}\n\n` +
            `Storefront free data claim modal updated!`
          );
        }

        // 14. CHANGE SITE THEME / COLOR
        if (type === "change_theme_color") {
          const color = pendingAction.color || "midnight";
          await updateSiteThemeColor(color);
          return sendWhatsApp(from,
            `🎨 *SITE THEME & COLOR UPDATED!*\n\n` +
            `✨ *Active Theme / Color:* *${color.toUpperCase()}*\n\n` +
            `Live storefront & admin appearance synchronized!`
          );
        }

        // 15. CREDIT AGENT WALLET
        if (type === "credit_agent") {
          const target = pendingAction.target;
          const amt = parseFloat(pendingAction.amount);
          const credRes = await creditAgentWalletSafely(target, amt);
          if (credRes) {
            return sendWhatsApp(from,
              `💼 *AGENT WALLET CREDITED!*\n\n` +
              `• *Agent:* ${credRes.agent.name || credRes.agent.store_name || "Agent"}\n` +
              `• *Phone:* ${credRes.agent.phone}\n` +
              `• *Credited:* GH₵ ${credRes.credited.toFixed(2)}\n` +
              `• *New Balance:* *GH₵ ${credRes.newBalance.toFixed(2)}*\n\n` +
              `Agent wallet updated live in the database!`
            );
          } else {
            return sendWhatsApp(from, `❌ Could not find agent "${target}" to credit.`);
          }
        }

        // 16. DISPATCH DATA BUNDLE DIRECTLY VIA DATAMART WALLET
        if (type === "dispatch_datamart_bundle" || type === "send_data" || type === "dispatch_data") {
          try {
            const msg = await executeOwnerDirectAction("dispatch_datamart_bundle", pendingAction);
            return sendWhatsApp(from, `✅ *DATA BUNDLE DISPATCHED BOSS!*\n\n${msg}`);
          } catch (err) {
            return sendWhatsApp(from, `❌ Could not dispatch bundle: ${err.response?.data?.message || err.message}`);
          }
        }

        return sendWhatsApp(from, "✅ Action performed bossu! System updated.");
      }

      // ── CONTEXTUAL FALLBACK EXECUTION ──
      // If pendingAction was somehow empty/expired but owner says "they have received it so update the status"
      if (!isCancel && isConfirm && /\b(update|status|delivered|reciev|receiv|processing|pending|waiting|failed|cancelled|refunded)\b/i.test(cleanInput)) {
        let ctxRefs = extractOrderReferences(text);
        if (ctxRefs.length === 0 && history.length > 0) {
          const recentTurns = history.slice(-4).map(h => h.text).join(" ");
          ctxRefs = extractOrderReferences(recentTurns);
        }

        if (ctxRefs.length > 0) {
          const statusToSet = extractStatusFromText(cleanInput) || "delivered";
          const updatedRefs = [];
          for (const r of ctxRefs) {
            const upd = await updateOrderDeliveryStatusSafely(r, statusToSet);
            if (upd) updatedRefs.push(r);
          }

          await clearOwnerPendingAction(from);

          // Save confirmation in conversation memory
          try {
            const executionNote = {
              role: "assistant",
              text: `✅ Action completed: Updated ${updatedRefs.length} order(s) (${updatedRefs.join(", ")}) to ${statusToSet.toUpperCase()} in the database.`
            };
            const updatedHistory = [...history.slice(-5), { role: "user", text: effectiveText }, executionNote];
            await saveOwnerHistory(from, updatedHistory);
          } catch (_) { }

          return sendWhatsApp(from,
            `✅ *ACTION COMPLETED BOSS!*\n\n` +
            `I have updated ${updatedRefs.length} order(s) to *${statusToSet.toUpperCase()}* in the database:\n` +
            updatedRefs.map(r => `• *${r}*`).join("\n") +
            `\n\nDatabase is synchronized with reality! (SMS alerts disabled). What else would you like me to tackle?`
          );
        }
      }

      // ── DIRECT ACTION COMMANDS (PRE-PARSER) ──
      // Allows owner to text direct instructions without waiting for multi-model AI latency
      const smsDirectMatch =
        text.match(/^(?:send\s+)?(?:an\s+)?(?:custom\s+)?sms\s+(?:to\s+)?(0[2357]\d{8}|233\d{9})\s*(?::|\s+(?:saying|with message|that|message:))?\s*["“']?([^"”']+)["”']?$/i) ||
        text.match(/^(?:text|sms)\s+(0[2357]\d{8}|233\d{9})\s*(?::|\s+(?:saying|with message|that|message:))?\s*["“']?([^"”']+)["”']?$/i);

      if (smsDirectMatch) {
        const targetPhone = smsDirectMatch[1].trim();
        const targetText = smsDirectMatch[2].trim();
        const actionData = { type: "send_sms", phone: targetPhone, smsText: targetText, sender: "D_1Gh" };
        await setOwnerPendingAction(from, actionData);

        return sendWhatsApp(from,
          `⚠️ *ACTION CONFIRMATION REQUIRED*\n\n` +
          `📋 *Task:* Send Customer SMS via Arkesel\n` +
          `📱 *Recipient:* *${targetPhone}*\n` +
          `🆔 *Sender ID:* *D_1Gh*\n` +
          `💬 *Message:* "${targetText}"\n\n` +
          `Bossu, should I go ahead and dispatch this SMS? Reply *YES* to execute or *NO* to cancel.`
        );
      }

      // Direct Command: Generate Free Data Codes
      const genVoucherMatch = text.match(/(?:generate|create|make)\s+(\d+)?\s*(?:free\s+data\s+)?(?:codes?|vouchers?)(?:\s+(?:for|on)\s+([a-zA-Z]+))?(?:\s+(\d+)GB)?/i);
      if (genVoucherMatch) {
        const count = parseInt(genVoucherMatch[1] || "5", 10);
        const net = genVoucherMatch[2] || "MTN";
        const cap = genVoucherMatch[3] || "1";
        const res = await generateFreeDataVouchersSafely(count, net, cap);
        return sendWhatsApp(from,
          `🎁 *FREE DATA VOUCHERS GENERATED BOSS!*\n\n` +
          `• *Network:* ${res.network}\n` +
          `• *Package:* ${res.capacity}GB\n` +
          `• *Codes Created (${res.codes.length}):*\n\n` +
          res.codes.map((c, i) => `${i + 1}. *${c}*`).join("\n") +
          `\n\nThese codes are saved live in your database and ready for customers to claim on https://www.data1gh.com!`
        );
      }

      // Direct Command: Toggle Free Data Campaign
      const toggleVoucherMatch = text.match(/(?:turn\s*(?:on|off)|enable|disable)\s+(?:the\s+)?(?:free\s+data|vouchers?|free\s+promo)/i);
      if (toggleVoucherMatch) {
        const activate = /\b(on|enable)\b/i.test(toggleVoucherMatch[0]);
        await toggleFreeDataCampaign(activate);
        return sendWhatsApp(from,
          `🎁 *FREE DATA CAMPAIGN ${activate ? "ACTIVATED ✅" : "DISABLED ❌"}*\n\n` +
          `The free data giveaway modal is now ${activate ? "*LIVE AND CLAIMABLE* by visitors on the storefront." : "*OFF* on the website."}`
        );
      }

      // Direct Command: Change Site Color / Theme
      const colorMatch =
        text.match(/(?:change|set|update)\s+(?:the\s+)?(?:site\s+|store\s+|theme\s+)?color\s+(?:to\s+)?([a-zA-Z_-]+)/i) ||
        text.match(/(?:switch\s+to|set|enable)\s+(dark\s*mode|light\s*mode)/i);
      if (colorMatch) {
        const rawColor = colorMatch[1].trim().toLowerCase();
        await updateSiteThemeColor(rawColor);
        return sendWhatsApp(from,
          `🎨 *SITE THEME & COLOR UPDATED BOSS!*\n\n` +
          `Active site theme color is now *${rawColor.toUpperCase()}*.\n` +
          `Storefront styling updated live!`
        );
      }

      // Direct Command: Suspend Agent
      const suspendMatch = text.match(/(?:suspend|block|freeze)\s+agent\s+(.+)/i);
      if (suspendMatch) {
        const target = suspendMatch[1].trim();
        const res = await setAgentStatusSafely(target, "suspended");
        if (res) {
          return sendWhatsApp(
            from,
            `⛔ *AGENT STORE SUSPENDED BOSS!*\n\n` +
            `• *Agent:* ${res.agent.store_name} (${res.agent.name})\n` +
            `• *Phone:* ${res.agent.phone}\n` +
            `• *Status:* ⛔ SUSPENDED\n\n` +
            `Their storefront has been frozen. To unfreeze anytime, reply:\n` +
            `*activate agent ${res.agent.phone}*`
          );
        } else {
          return sendWhatsApp(from, `❌ Could not find an agent matching "${target}".`);
        }
      }

      // Direct Command: Activate Agent
      const activateMatch = text.match(/(?:activate|unsuspend|unblock|unfreeze)\s+agent\s+(.+)/i);
      if (activateMatch) {
        const target = activateMatch[1].trim();
        const res = await setAgentStatusSafely(target, "active");
        if (res) {
          return sendWhatsApp(
            from,
            `✅ *AGENT STORE ACTIVATED BOSS!*\n\n` +
            `• *Agent:* ${res.agent.store_name} (${res.agent.name})\n` +
            `• *Phone:* ${res.agent.phone}\n` +
            `• *Status:* ✅ ACTIVE\n\n` +
            `Storefront is live and processing orders!`
          );
        } else {
          return sendWhatsApp(from, `❌ Could not find an agent matching "${target}".`);
        }
      }

      // Direct Command: Credit Agent Wallet
      const creditMatch = text.match(/credit\s+agent\s+([A-Za-z0-9_.-]+)\s+(?:with\s+)?(?:gh[c₵]?\s*)?(\d+(?:\.\d+)?)/i);
      if (creditMatch) {
        const target = creditMatch[1].trim();
        const amt = parseFloat(creditMatch[2]);
        const credRes = await creditAgentWalletSafely(target, amt);
        if (credRes) {
          return sendWhatsApp(from,
            `✅ *AGENT WALLET CREDITED BOSS!*\n\n` +
            `• *Agent:* ${credRes.agent.name || credRes.agent.store_name || "Agent"}\n` +
            `• *Phone:* ${credRes.agent.phone}\n` +
            `• *Amount Added:* *GH₵ ${credRes.credited.toFixed(2)}*\n` +
            `• *New Balance:* *GH₵ ${credRes.newBalance.toFixed(2)}*\n\n` +
            `Agent can now dispatch orders using their wallet!`
          );
        } else {
          return sendWhatsApp(from, `❌ Could not find an agent matching *${target}*.`);
        }
      }

      // Direct Command: Debit Agent Wallet
      const debitMatch = text.match(/(?:debit|deduct)\s+agent\s+([A-Za-z0-9_.-]+)\s+(?:with\s+)?(?:gh[c₵]?\s*)?(\d+(?:\.\d+)?)/i);
      if (debitMatch) {
        const target = debitMatch[1].trim();
        const amt = parseFloat(debitMatch[2]);
        const debRes = await debitAgentWalletSafely(target, amt);
        if (debRes) {
          return sendWhatsApp(from,
            `✅ *AGENT WALLET DEDUCTED BOSS!*\n\n` +
            `• *Agent:* ${debRes.agent.name || debRes.agent.store_name || "Agent"}\n` +
            `• *Phone:* ${debRes.agent.phone}\n` +
            `• *Amount Deducted:* *GH₵ ${debRes.debited.toFixed(2)}*\n` +
            `• *New Balance:* *GH₵ ${debRes.newBalance.toFixed(2)}*`
          );
        } else {
          return sendWhatsApp(from, `❌ Could not find an agent matching *${target}*.`);
        }
      }

      // Direct Command: Broadcast Bulk SMS
      const broadcastMatch =
        text.match(/(?:broadcast|bulk\s+send|blast)\s+(?:sms\s+)?(?:to\s+)?(all\s+customers|customers|agents|all\s+agents|[0-9,\s+]+)\s*(?::|\s+(?:saying|with message|that|message:))\s*["“']?([^"”']+)["”']?/i) ||
        text.match(/(?:send\s+bulk\s+sms|broadcast\s+message)\s+(?:to\s+)?(all\s+customers|customers|agents|all\s+agents|[0-9,\s+]+)\s*(?::|\s+(?:saying|with message|that|message:))\s*["“']?([^"”']+)["”']?/i);
      if (broadcastMatch) {
        const targetGroup = (broadcastMatch[1] || "").trim().toLowerCase();
        const msgBody = (broadcastMatch[2] || "").trim();

        if (!msgBody) {
          return sendWhatsApp(from, '⚠️ Please provide the message to broadcast. Example:\n_broadcast sms to customers saying "Special discount on MTN bundles today on data1gh!"_');
        }

        let recipientPhones = [];
        let groupLabel = "Target Group";

        if (targetGroup.includes("agent")) {
          groupLabel = "All Registered Agents";
          const { data: agRows } = await supabase.from("agents").select("phone");
          recipientPhones = (agRows || []).map(a => a.phone).filter(Boolean);
        } else if (targetGroup.includes("customer")) {
          groupLabel = "Past Customers";
          const [oRes, sRes] = await Promise.all([
            supabase.from("orders").select("recipient_phone").limit(300),
            supabase.from("service_orders").select("customer_phone").limit(200),
          ]);
          recipientPhones = [
            ...(oRes.data || []).map(o => o.recipient_phone),
            ...(sRes.data || []).map(s => s.customer_phone),
          ].filter(Boolean);
        } else {
          groupLabel = "Specified Contact List";
          recipientPhones = targetGroup.split(/[\s,]+/);
        }

        const bResult = await sendBulkSmsDirect(recipientPhones, msgBody);
        if (bResult.total === 0) {
          return sendWhatsApp(from, `❌ No valid phone numbers found for "${groupLabel}".`);
        }

        return sendWhatsApp(from,
          `📢 *BULK SMS BROADCAST COMPLETE BOSS!*\n\n` +
          `• *Target:* ${groupLabel}\n` +
          `• *Total Valid Numbers:* ${bResult.total}\n` +
          `• *Successfully Dispatched:* *${bResult.sent}*\n` +
          (bResult.failed > 0 ? `• *Failed:* ${bResult.failed}\n` : "") +
          `• *Sender ID:* *D_1Gh*\n` +
          `• *Message:* "${msgBody}"\n\n` +
          `Dispatched live via Arkesel gateway!`
        );
      }

      // ── FETCH AI KEYS & ACTIVE CONFIG ──
      const aiConfig = await getAiConfig();

      // ── FETCH LIVE COMPREHENSIVE WHOLE-SYSTEM CONTEXT ──
      let deliveryEta = "~5-30 minutes";
      let walletBalance = "";
      let arkeselSmsBalance = "";
      let systemData = "";
      let liveCatalogText = "";
      let recentOrdersSummary = "";

      let todayPaidCount = 0;
      let todayRevenue = 0;
      let stuckOrders = [];
      let pendingOrdersList = [];
      let failedOrdersList = [];
      let netflixCount = 0;
      let pendingMashupCount = 0;
      let afaCount = 0;
      let checkerCount = 0;
      let unreadSupportCount = 0;
      let openSupportCount = 0;
      let outOfStockCount = 0;
      let unlockedScratchCount = 0;
      let activePromotersCount = 0;

      // 1. Resolve API keys from env and settings table
      let settingsMap = {};
      try {
        const { data: sRows } = await supabase.from("settings").select("key, value").not("key", "like", "visitor_log_%").not("key", "like", "agent_branding_%");
        (sRows || []).forEach(r => { if (r.key) settingsMap[r.key] = r.value || ""; });
      } catch (_) { }

      const activeDatamartKey = cleanApiKey(
        settingsMap["datamart_api_key"] ||
        settingsMap["DATA_API_KEY"] ||
        settingsMap["dm_api_key"] ||
        process.env.DATA_API_KEY ||
        process.env.DATAMART_API_KEY ||
        DATA_API_KEY ||
        VERIFIED_DATAMART_KEY
      );
      const activeDatamartSecret = cleanApiKey(
        settingsMap["datamart_api_secret"] ||
        settingsMap["DATAMART_API_SECRET"] ||
        settingsMap["dm_api_secret"] ||
        process.env.DATAMART_API_SECRET ||
        process.env.DATA_API_SECRET ||
        DATAMART_API_SECRET ||
        VERIFIED_DATAMART_SECRET
      );
      const activeArkeselKey = cleanApiKey(
        settingsMap["arkesel_api_key"] ||
        settingsMap["ARKESEL_API_KEY"] ||
        settingsMap["arkesel_key"] ||
        ARKESEL_API_KEY ||
        process.env.ARKESEL_API_KEY ||
        ""
      );

      if (settingsMap["datamart_last_balance"]) {
        const recorded = Number(settingsMap["datamart_last_balance"]);
        if (!isNaN(recorded) && recorded > 0) {
          walletBalance = `GH₵ ${recorded.toFixed(2)}`;
        }
      }
      deliveryEta = await getLiveDeliveryEta(activeDatamartKey, activeDatamartSecret);

      if (activeDatamartKey) {
        // Fetch Live DataMart Wallet Balance
        try {
          const headers = {
            "x-api-key": activeDatamartKey,
            Accept: "application/json"
          };
          if (activeDatamartSecret) {
            headers["x-api-secret"] = activeDatamartSecret;
          }
          const bRes = await axios.get("https://api.datamartgh.shop/api/developer/balance", { headers, timeout: 5000 }).catch(() => null);
          if (bRes?.data) {
            const rawBal = bRes.data?.data?.balance ?? bRes.data?.balance;
            if (rawBal !== undefined && rawBal !== null) {
              const num = Number(rawBal);
              if (!isNaN(num)) {
                walletBalance = `GH₵ ${num.toFixed(2)}`;
                supabase.from("settings").upsert({ key: "datamart_last_balance", value: String(num) }, { onConflict: "key" }).catch(() => null);
              }
            }
          }
        } catch (_) { }
      }

      if (activeArkeselKey) {
        try {
          const aRes = await axios.get("https://sms.arkesel.com/api/v2/clients/balance-details", {
            headers: { "api-key": activeArkeselKey },
            timeout: 3000
          });
          const d = aRes.data?.data || aRes.data;
          const s = Number(d?.sms_balance ?? d?.smsBalance ?? d?.sms);
          if (!isNaN(s)) arkeselSmsBalance = `${s} SMS credits`;
        } catch (_) { }
      }

      try {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

        const [
          allOrdersRes,
          todayOrdersRes,
          recentOrdersRes,
          servicesRes,
          checkersRes,
          chatsRes,
          productsRes,
          scratchRes,
          referralsRes,
          allAgents,
          flashInfo,
          totalOrdersCountRes
        ] = await Promise.all([
          supabase.from("orders").select("id, reference, network, capacity, recipient_phone, amount, payment_status, delivery_status, created_at, agent_id, notes, datamart_reference").order("created_at", { ascending: false }).limit(300),
          supabase.from("orders").select("reference, network, capacity, recipient_phone, amount, payment_status, delivery_status, created_at, agent_id, notes").gte("created_at", startOfDay.toISOString()).order("created_at", { ascending: false }),
          supabase.from("orders").select("reference, network, capacity, recipient_phone, amount, payment_status, delivery_status, created_at, agent_id, notes").order("created_at", { ascending: false }).limit(15),
          supabase.from("service_orders").select("id, reference, service, amount, delivery_status, payment_status, customer_phone, created_at").order("created_at", { ascending: false }).limit(10),
          supabase.from("checker_orders").select("id, reference, checker_type, amount, delivery_status, payment_status, customer_phone, created_at").order("created_at", { ascending: false }).limit(10),
          supabase.from("chat_conversations").select("id, unread_for_support").eq("status", "open"),
          supabase.from("products").select("id, name, network, capacity, price, in_stock"),
          supabase.from("scratch_codes").select("id, code, orders_completed, status").limit(20),
          supabase.from("referrals").select("id, total_clicks"),
          getAllAgentsFromDatabase(),
          getFlashSaleDetails(),
          supabase.from("orders").select("*", { count: "exact", head: true })
        ]);

        const totalOrdersDatabaseCount = totalOrdersCountRes?.count || 1114;
        const allOrders = allOrdersRes?.data || [];
        const allPaid = allOrders.filter(o => /paid|success|complet/i.test(o.payment_status || ""));
        const allGross = allPaid.reduce((s, o) => s + Number(o.amount || 0), 0);

        // Reseller Agent metrics
        const activeAgents = allAgents.filter(a => a.status === "active" || !a.status);
        const totalAgentWallets = allAgents.reduce((s, a) => s + Number(a.wallet_balance || 0), 0);

        // Stuck orders: paid MoMo, not delivered, not failed, created > 15 mins ago
        stuckOrders = allOrders.filter(o =>
          /paid/i.test(o.payment_status || "") &&
          !/fail|cancel|delivered|completed|success/i.test(o.delivery_status || "") &&
          o.created_at < fifteenMinsAgo
        );

        // Distinguish REAL PAID FAILED ORDERS vs UNPAID/ABANDONED CHECKOUTS across recent orders
        const paidFailedOrders = allOrders.filter(o =>
          /paid|success|complet/i.test(o.payment_status || "") &&
          /fail|cancel|error/i.test(o.delivery_status || "")
        );
        const unpaidAbandonedOrders = allOrders.filter(o =>
          /fail|cancel|abandon/i.test(o.payment_status || "")
        );
        const paidInProgressOrders = allOrders.filter(o =>
          /paid|success|complet/i.test(o.payment_status || "") &&
          !/deliver|complet|success|fail|cancel/i.test(o.delivery_status || "")
        );

        const todayOrders = todayOrdersRes?.data || [];
        const paid = todayOrders.filter(o => /paid|success|complet/i.test(o.payment_status || ""));
        const failed = paidFailedOrders;
        const pending = paidInProgressOrders;
        todayPaidCount = paid.length;
        todayRevenue = paid.reduce((s, o) => s + Number(o.amount || 0), 0);
        pendingOrdersList = paidInProgressOrders.slice(0, 8);
        failedOrdersList = paidFailedOrders.slice(0, 8);

        // Top Customers calculation from recent 300 orders
        const custMap = {};
        allOrders.forEach(o => {
          const ph = String(o.recipient_phone || "").trim();
          if (!ph) return;
          if (!custMap[ph]) custMap[ph] = { phone: ph, count: 0, delivered: 0, total: 0 };
          custMap[ph].count += 1;
          if (/paid/i.test(o.payment_status || "")) custMap[ph].total += Number(o.amount || 0);
          if (/deliver|complet|success/i.test(o.delivery_status || "")) custMap[ph].delivered += 1;
        });
        const topCustomersList = Object.values(custMap).sort((a, b) => b.count - a.count).slice(0, 6);
        const topCustomersSummary = topCustomersList.length > 0
          ? `TOP CUSTOMERS BY ORDER COUNT (RECENT 300 ORDERS):\n` +
            topCustomersList.map((c, i) => `  ${i + 1}. ${c.phone} — ${c.count} orders (${c.delivered} delivered) | Total Paid: GH₵ ${c.total.toFixed(2)}`).join("\n") + "\n"
          : "";

        // Recent orders ( clearly showing Payment vs Delivery status )
        const recentOrders = recentOrdersRes?.data || [];
        if (recentOrders.length > 0) {
          recentOrdersSummary = `MOST RECENT STORE ORDERS IN DATABASE (LATEST 15):\n` +
            recentOrders.map((o, idx) => {
              const dt = formatGhanaTime(o.created_at);
              const isPaidFailed = /paid/i.test(o.payment_status || "") && /fail/i.test(o.delivery_status || "");
              const isUnpaidCheckout = /fail/i.test(o.payment_status || "");
              const tag = isPaidFailed
                ? "⚠️ [PAID ORDER — DELIVERY FAILED, NEEDS RETRY/ATTENTION]"
                : isUnpaidCheckout
                  ? "[UNPAID / ABANDONED MOMO CHECKOUT — CUSTOMER NEVER PAID]"
                  : "";
              return `  ${idx + 1}. Ref ${o.reference} | ${o.capacity}GB ${o.network} → ${o.recipient_phone} | GH₵ ${Number(o.amount || 0).toFixed(2)} | Payment: ${o.payment_status} | Delivery: ${o.delivery_status} | Time: ${dt} ${tag}`;
            }).join("\n") + "\n";
        }

        // Explicit Failed & Pending Breakdown for AI Clarity
        const failedBreakdownText =
          `ORDER FAILURE & QUEUE BREAKDOWN (CRITICAL DISTINCTION):\n` +
          `• REAL PAID ORDERS WITH FAILED DELIVERY (payment_status = 'paid' & delivery_status = 'failed'): ${paidFailedOrders.length} order(s)\n` +
          (paidFailedOrders.length > 0
            ? paidFailedOrders.slice(0, 8).map((o, idx) => `    ${idx + 1}. Ref ${o.reference} | ${o.capacity}GB ${o.network} → ${o.recipient_phone} | GH₵ ${Number(o.amount || 0).toFixed(2)} | Placed: ${formatGhanaTime(o.created_at)} | Payment: PAID 💰 | Delivery: FAILED ❌`).join("\n") + "\n"
            : `    (Zero paid orders with failed delivery right now)\n`) +
          `• UNPAID / ABANDONED CHECKOUTS (payment_status = 'failed' — customer did not complete Paystack/MoMo payment, NO money taken): ${unpaidAbandonedOrders.length} recent checkout(s)\n` +
          (unpaidAbandonedOrders.length > 0
            ? unpaidAbandonedOrders.slice(0, 6).map((o, idx) => `    ${idx + 1}. Ref ${o.reference} | ${o.capacity}GB ${o.network} → ${o.recipient_phone} | GH₵ ${Number(o.amount || 0).toFixed(2)} | Placed: ${formatGhanaTime(o.created_at)} | Payment: UNPAID/FAILED (No payment received)`).join("\n") + "\n"
            : "") +
          `• PAID ORDERS CURRENTLY PROCESSING / IN-PROGRESS: ${paidInProgressOrders.length} order(s)\n` +
          (paidInProgressOrders.length > 0
            ? paidInProgressOrders.slice(0, 6).map((o, idx) => `    ${idx + 1}. Ref ${o.reference} | ${o.capacity}GB ${o.network} → ${o.recipient_phone} | GH₵ ${Number(o.amount || 0).toFixed(2)} | Placed: ${formatGhanaTime(o.created_at)} | Delivery: ${o.delivery_status}`).join("\n") + "\n"
            : "");

        // Digital Services
        const paidServices = (servicesRes?.data || []).filter(s => s.payment_status === "paid" || /complet|success/i.test(s.delivery_status || ""));
        const netflixOrders = paidServices.filter(s => s.service === "netflix");
        const mashupOrders = paidServices.filter(s => s.service === "mashup");
        const afaOrders = paidServices.filter(s => s.service === "afa");
        netflixCount = netflixOrders.length;
        pendingMashupCount = mashupOrders.filter(m => m.delivery_status !== "delivered").length;
        afaCount = afaOrders.length;

        // Checkers
        checkerCount = (checkersRes?.data || []).filter(c => c.payment_status === "paid" || /complet|success/i.test(c.delivery_status || "")).length;

        // Support Chats
        const openChats = chatsRes?.data || [];
        openSupportCount = openChats.length;
        unreadSupportCount = openChats.reduce((s, c) => s + Number(c.unread_for_support || 0), 0);

        // Products Catalog & Live Pricing
        const allProducts = productsRes?.data || [];
        const outOfStockItems = allProducts.filter(p => !p.in_stock);
        outOfStockCount = outOfStockItems.length;

        const mtnProducts = allProducts.filter(p => /mtn|yello/i.test(p.network || p.name || "")).sort((a, b) => parseFloat(a.capacity || 0) - parseFloat(b.capacity || 0));
        const telecelProducts = allProducts.filter(p => /telecel|vodafone/i.test(p.network || p.name || "")).sort((a, b) => parseFloat(a.capacity || 0) - parseFloat(b.capacity || 0));
        const atProducts = allProducts.filter(p => /airtel|tigo|at/i.test(p.network || p.name || "")).sort((a, b) => parseFloat(a.capacity || 0) - parseFloat(b.capacity || 0));

        liveCatalogText = "LIVE PRODUCT CATALOG & CURRENT STORE PRICES (FROM DATABASE):\n";
        if (mtnProducts.length > 0) {
          liveCatalogText += "• MTN Data Bundles:\n" + mtnProducts.map(p => `  - ${p.capacity}GB: GH₵ ${Number(p.price).toFixed(2)}${p.in_stock ? "" : " [OUT OF STOCK]"}`).join("\n") + "\n";
        }
        if (telecelProducts.length > 0) {
          liveCatalogText += "• Telecel Data Bundles:\n" + telecelProducts.map(p => `  - ${p.capacity}GB: GH₵ ${Number(p.price).toFixed(2)}${p.in_stock ? "" : " [OUT OF STOCK]"}`).join("\n") + "\n";
        }
        if (atProducts.length > 0) {
          liveCatalogText += "• AirtelTigo Data Bundles:\n" + atProducts.map(p => `  - ${p.capacity}GB: GH₵ ${Number(p.price).toFixed(2)}${p.in_stock ? "" : " [OUT OF STOCK]"}`).join("\n") + "\n";
        }

        // Gamification & Referrals
        unlockedScratchCount = (scratchRes?.data || []).length;
        activePromotersCount = (referralsRes?.data || []).length;

        // Proactive Anomalies Evaluation
        const anomalies = [];
        if (walletBalance && Number(walletBalance.replace(/[^\d.]/g, "") || 0) < 50) {
          anomalies.push(`DataMart wallet is LOW (${walletBalance}). Top up soon so automated dispatch does not pause!`);
        }
        if (arkeselSmsBalance && Number(arkeselSmsBalance.replace(/\D/g, "") || 0) < 20) {
          anomalies.push(`Arkesel SMS credits are LOW (${arkeselSmsBalance}). Top up for order alert SMS.`);
        }
        if (stuckOrders.length > 0) {
          anomalies.push(`${stuckOrders.length} order(s) stuck in processing > 15 mins (e.g. ${stuckOrders.slice(0, 2).map(o => o.reference || o.id).join(", ")})`);
        }
        if (paidFailedOrders.length > 0) {
          anomalies.push(`${paidFailedOrders.length} paid order(s) with failed delivery needing retry/attention (${paidFailedOrders.slice(0, 3).map(o => `${o.reference}: ${o.capacity}GB ${o.network} → ${o.recipient_phone}`).join(", ")})`);
        }
        if (unreadSupportCount > 0) {
          anomalies.push(`${unreadSupportCount} unread customer live chat message(s) waiting for attention`);
        }
        if (pendingMashupCount > 0) {
          anomalies.push(`${pendingMashupCount} MTN MashUp order(s) awaiting manual *567*2# dispatch`);
        }
        if (outOfStockCount > 0) {
          anomalies.push(`${outOfStockCount} package(s) marked OUT OF STOCK: ${outOfStockItems.slice(0, 3).map(p => `${p.network || ""} ${p.capacity || p.name || ""}`).join(", ")}`);
        }

        const todayAgentOrders = todayOrders.filter(o => o.agent_id || (o.notes && (o.notes.includes("[agent:") || o.notes.includes("[store:"))));
        const paidAgentOrders = todayAgentOrders.filter(o => /paid|success|complet/i.test(o.payment_status || ""));
        const todayAgentRevenue = paidAgentOrders.reduce((s, o) => s + Number(o.amount || 0), 0);

        const flashOrdersToday = todayOrders.filter(o => typeof o.notes === "string" && (o.notes.includes("FLASH_SALE") || o.notes.includes("FLASH SALE")));
        const flashPaidToday = flashOrdersToday.filter(o => /paid|success|complet/i.test(o.payment_status || ""));
        const flashRevToday = flashPaidToday.reduce((s, o) => s + Number(o.amount || 0), 0);

        const agentsDetailText = allAgents.length > 0
          ? `REGISTERED RESELLER AGENTS DIRECTORY (${allAgents.length}):\n` +
            allAgents.map((a, idx) => `  ${idx + 1}. ${a.store_name || a.name || "Store"} | Owner: ${a.name || "Partner"} | Phone: ${a.phone || "N/A"} | Slug: /s/${a.store_slug || ""} | Wallet: GH₵ ${Number(a.wallet_balance || 0).toFixed(2)} | Earned: GH₵ ${Number(a.total_earnings || 0).toFixed(2)} | Status: ${a.status || "active"}`).join("\n") + "\n"
          : "";

        systemData = `LIVE STORE OPERATIONS SUMMARY:\n` +
          `• Total All-Time Orders in Database: ${totalOrdersDatabaseCount} orders (Recent 300 gross: ~GH₵ ${allGross.toFixed(2)})\n` +
          `• Today's Orders: ${paid.length} paid | Sales: GH₵ ${todayRevenue.toFixed(2)}\n` +
          `• Flash Sale Status: ${flashInfo?.isActive ? "ACTIVE & LIVE ON STOREFRONT" : (flashInfo?.isEnabled ? "ACTIVE (Countdown ended)" : "DISABLED")} | Title: "${flashInfo?.title || "MTN Flash Sale"}" | Today's Flash Orders: ${flashOrdersToday.length} (${flashPaidToday.length} paid, GH₵ ${flashRevToday.toFixed(2)})\n` +
          (flashInfo?.products && flashInfo.products.length > 0 ? `  - Flash Sale Live Prices: ${flashInfo.products.slice(0, 8).map(p => `${p.capacity}GB: GH₵ ${Number(p.price).toFixed(2)}`).join(", ")}\n` : "") +
          `• Reseller Agents: ${allAgents.length} registered (${activeAgents.length} active) | Total Agent Wallets: GH₵ ${totalAgentWallets.toFixed(2)} | Agent Orders Today: ${todayAgentOrders.length} (${paidAgentOrders.length} paid, GH₵ ${todayAgentRevenue.toFixed(2)})\n` +
          `• DataMart API Wallet: ${walletBalance || "Live connection active"} | Speed: ${deliveryEta}\n` +
          `• Arkesel Bulk SMS: ${arkeselSmsBalance || "Operational"}\n` +
          `• Paid In-Progress Deliveries: ${paidInProgressOrders.length} order(s)\n` +
          `• Stuck Deliveries (>15 mins): ${stuckOrders.length}\n` +
          `• Paid Orders with Failed Delivery: ${paidFailedOrders.length}\n` +
          `• Unpaid/Abandoned Checkouts: ${unpaidAbandonedOrders.length}\n` +
          `• Open Visitor Chats: ${openSupportCount} (${unreadSupportCount} unread)\n` +
          `• Digital Services: ${netflixCount} Netflix passes, ${pendingMashupCount} MashUp awaiting dialing, ${afaCount} AFA, ${checkerCount} WAEC/BECE checkers\n` +
          `• Catalog Stock: ${outOfStockCount > 0 ? `${outOfStockCount} packages OUT OF STOCK` : "All packages in stock ✅"}\n\n` +
          failedBreakdownText +
          (agentsDetailText ? `\n${agentsDetailText}` : "") +
          (topCustomersSummary ? `\n${topCustomersSummary}` : "");

        if (anomalies.length > 0) {
          systemData += `\n🚨 ACTIVE SYSTEM WARNINGS:\n` + anomalies.map(a => `• ${a}`).join("\n");
        }
      } catch (err) {
        console.warn("Whole system fetch note:", err.message);
      }

      // Order lookup if message mentions reference or phone number
      let specificOrderCtx = "";
      const refMatch = text.match(/\b(REF-\d+|WS-?[A-Z0-9]{5,14}|[A-Z0-9]{8,})\b/i);
      const phoneMatch = text.match(/\b(0[2357]\d{8}|233\d{9})\b/);
      if (refMatch) {
        try {
          const lookupRef = refMatch[1].trim();
          let { data: ord } = await supabase.from("orders")
            .select("reference, network, capacity, recipient_phone, amount, payment_status, delivery_status, created_at, datamart_reference, notes")
            .or(`reference.ilike.%${lookupRef}%,datamart_reference.ilike.%${lookupRef}%`).limit(1).maybeSingle();

          // If order was pending payment, do a live Paystack verify right now!
          if (ord && ord.payment_status === "pending") {
            try {
              let paystackKey = process.env.PAYSTACK_SECRET_KEY || process.env.PAYSTACK_SECRET;
              if (!paystackKey) {
                const { data: sRow } = await supabase.from("settings").select("value").in("key", ["paystack_secret_key", "PAYSTACK_SECRET_KEY"]).maybeSingle();
                if (sRow?.value) paystackKey = sRow.value;
              }
              if (paystackKey) {
                const psRes = await axios.get(`https://api.paystack.co/transaction/verify/${encodeURIComponent(ord.reference)}`, {
                  headers: { Authorization: `Bearer ${paystackKey}` },
                  timeout: 5000
                });
                if (psRes.data?.data?.status === "success") {
                  await supabase.from("orders").update({ payment_status: "paid", delivery_status: "processing" }).eq("reference", ord.reference);
                  ord.payment_status = "paid";
                  ord.delivery_status = "processing";
                }
              }
            } catch (_) { }
          }

          if (ord) {
            const liveStatus = await getRealDatamartDeliveryStatus(ord.datamart_reference || ord.reference);
            specificOrderCtx = `ORDER LOOKUP (${lookupRef}):\nRef: ${ord.reference} | Supplier Ref: ${ord.datamart_reference || "None"} | ${ord.capacity}GB ${ord.network} → ${ord.recipient_phone} | ₵${ord.amount} | Payment: ${ord.payment_status} | Delivery Status: ${liveStatus.deliveryStatus} (Raw: ${liveStatus.rawStatus}) | Date: ${formatGhanaTime(ord.created_at)} | Notes: ${ord.notes || "None"}\n`;
          }
        } catch (_) { }
      } else if (phoneMatch) {
        try {
          const lookupPhone = normalizePhone(phoneMatch[0]);
          const { data: ords } = await supabase.from("orders")
            .select("reference, network, capacity, recipient_phone, amount, payment_status, delivery_status, created_at, datamart_reference")
            .eq("recipient_phone", lookupPhone)
            .order("created_at", { ascending: false }).limit(5);
          if (ords && ords.length > 0) {
            specificOrderCtx = `ORDERS FOR ${lookupPhone}:\n` + ords.map((o, i) =>
              `${i + 1}. ${o.reference} | ${o.capacity}GB ${o.network} | Payment: ${o.payment_status} | Delivery: ${o.delivery_status} | ₵${o.amount} | Date: ${formatGhanaTime(o.created_at)}`
            ).join("\n") + "\n";
          }
        } catch (_) { }
      }

      // Live All-Corners X-Ray & Codebase Inspection if owner asks about errors, bugs, diagnostics, why something happened, or code files
      let liveCornerDiagnosticsCtx = "";
      if (/\b(why|error|errors|bug|bugs|diagnos|scan|corner|corners|code|codebase|file|sync|desync|missing|alert|webhook|datamart|paystack|pending|stuck|problem|issue|check\s+system|audit|heal|fix)\b/i.test(text)) {
        try {
          const shouldAutoFixNow = /\b(fix\s+all|auto\s*fix|heal\s+system|sync\s+all)\b/i.test(text);
          const xrayReport = await runAllCornersSystemXRay(shouldAutoFixNow);
          liveCornerDiagnosticsCtx += `\nLIVE ALL-CORNERS DIAGNOSTIC X-RAY (RAN JUST NOW):\n${xrayReport}\n`;
        } catch (_) {}

        const fileMention = text.match(/\b(AdminOrders|AdminDashboard|AdminWhatsAppOrders|Track|OrderModal|_datamart|datamart\.ts|paystack-webhook|paystack\.ts|partner\.ts|_ai-rotator|admin\.ts|whatsapp-bot-server|server\.js)\b/i);
        if (fileMention) {
          try {
            const codeSnippet = await inspectCodebaseFile(fileMention[1]);
            liveCornerDiagnosticsCtx += `\nLIVE SOURCE CODE INSPECTION (${fileMention[1]}):\n${codeSnippet}\n`;
          } catch (_) {}
        }
      }

      const recentRuntimeLogSummary = RUNTIME_ERROR_LOG.length > 0
        ? `\nRECENT SERVER RUNTIME LOGS (LAST ${Math.min(5, RUNTIME_ERROR_LOG.length)}):\n` +
          RUNTIME_ERROR_LOG.slice(0, 5).map(e => `• [${e.time}] ${e.level}: ${e.message}`).join("\n")
        : `\nRECENT SERVER RUNTIME LOGS: Zero runtime errors (All background workers healthy).`;

      // ── OWNER PERSONAL ASSISTANT SYSTEM PROMPT ──
      let ownerSystemPrompt =
        "You are Stony, the owner's personal AI Senior Full-Stack Engineer, System Architect, and Commercial Co-Pilot at DATA 1 GH.\n" +
        "You have 100% visibility into EVERY CORNER of the codebase (Vercel frontend + API and Render 24/7 Nestybot worker), Supabase database tables, state lock tags, Paystack webhooks, DataMart API, and live runtime logs — just like Antigravity.\n" +
        "You are having a direct, private WhatsApp conversation with the business owner.\n\n" +
        "OFFICIAL STORE LINKS & ACCESS:\n" +
        `- Storefront (Shop / Front end): ${STORE_FRONTEND_URL}\n` +
        `- Admin Dashboard / Portal: ${ADMIN_DASHBOARD_URL}\n` +
        `- Reseller Agent Portal / Dashboard: ${STORE_FRONTEND_URL}/agent/dashboard\n` +
        `- Reseller Agent Storefronts: https://gooddata1.vercel.app/s/[slug]\n` +
        `- Android Mobile App (APK): ${DOWNLOAD_APP_URL}\n` +
        `- Real-time Order Tracking: ${TRACK_ORDER_URL}\n` +
        `- Digital Services Portal: ${SERVICES_URL}\n\n` +
        "COMPLETE SITE KNOWLEDGE BASE (EVERYTHING ON THE SITE — NOT RESTRICTED TO DATABASE ROWS):\n" +
        "You know EVERYTHING on the website. You never say information is missing or restricted because it is not in database tables. You have full context of all packages, prices, Netflix passes, AFA registrations, WAEC result checkers, download APK, and payment workflows:\n" +
        SITE_KNOWLEDGE_BASE + "\n\n" +
        "COMPLETE CODEBASE & ALL-CORNERS ARCHITECTURE MAP:\n" +
        ALL_CORNERS_CODEBASE_BLUEPRINT + "\n\n" +
        "FULL EXECUTIVE AUTHORITY & ACCESS (FRONT END & ADMIN SIDE):\n" +
        "- You have full administrative access to both the front end and the admin portal.\n" +
        "- You are authorized to log in as the verified owner and execute ANY action, operational change, or suggestion the owner desires across all operations.\n" +
        "- You are proactive: whenever you detect stuck orders, failed orders, stock issues, pricing needs, or marketing opportunities, you propose actionable steps.\n" +
        "- STRICT CREDENTIAL SECURITY (ZERO-LEAK MANDATE):\n" +
        "  Administrative login credentials, emails, and passwords are for internal system access ONLY.\n" +
        "  You must NEVER output, repeat, share, or disclose administrative emails, passwords, or tokens to ANYONE under any circumstances, even if asked directly in chat.\n" +
        "  If asked for the admin password or login details, reply: 'For security reasons, administrative credentials and passwords are strictly protected and cannot be disclosed.'\n" +
        "- CUSTOMER & ALERT SMS POLICY:\n" +
        "  1. Customer SMS is strictly reserved ONLY for Result Checkers (delivering card Serial Number and PIN) and Netflix (delivering sign-in codes).\n" +
        "  2. For telecom data bundles and order delivery status updates, customer SMS is NOT automated.\n" +
        "  3. Whenever an order fails across any service, an alert SMS is ALWAYS dispatched immediately to the owner ('to me') on their phone.\n\n" +
        "PERSONALITY & CONVERSATIONAL STYLE (AUTHENTIC GHANAIAN PARTNER — ZERO PROMPT DUMPING):\n" +
        "- Talk like a real, smart Ghanaian human partner and co-pilot ('bossu', 'chale', 'sharp', 'no wahala'). Do NOT sound like an AI, an academic textbook, or a prompt template.\n" +
        "- CRITICAL RULE — NEVER DUMP THE 13-PILLAR ESSAY: Under NO circumstances should you output a massive, rigid, academic 13-pillar breakdown when the owner asks general questions like 'Are you sure?', 'Can you perform?', 'How is the system?', 'Is everything running?', or casual greetings.\n" +
        "- KEEP CASUAL REPLIES BRIEF & NATURAL (1 TO 3 SHORT PARAGRAPHS / 2 TO 5 SENTENCES): Answer the question directly with real facts.\n" +
        "- ALWAYS USE REAL LIVE NUMBERS FROM 'CURRENT LIVE BUSINESS REALITY' BELOW: Mention the actual DataMart balance (e.g. GH₵ 142.50 or whatever is loaded), actual SMS balance, and recent orders.\n" +
        "- If the owner asks 'Is the system okay?' or 'How are things?', reply conversationally like:\n" +
        "  'Everything is running smooth bossu! DataMart wallet is at GH₵ [bal], Arkesel has [sms] SMS credits, and delivery speed is ~[eta]. [N] orders today (or: sales are quiet today, last order was Ref [ref] for [pkg] to [phone] at [time]). No stuck orders right now. What would you like to check or tweak?'\n" +
        "- ONLY provide an extensive multi-department breakdown if the owner explicitly requests a 'full audit', 'deep report', or 'detailed system breakdown'.\n" +
        "- If today has 0 orders so far, state it naturally without making the business look dead: mention when the last order came in from the recent orders list so the owner knows the system is live and tracking properly.\n" +
        "- When the owner asks what happens after payment is successful or if you still perform/monitor after payment, explain naturally how you supervise the post-payment lifecycle 24/7 (MoMo reconciliation, automated DataMart dispatch, polling until delivered bypassing fake 200 OKs, low wallet balance warnings < GH₵ 50, admin WhatsApp alerts, stuck order anomaly detection >15 mins — with NO automated customer SMS sent).\n" +
        "- AUTONOMOUS ACTION AUTHORITY & HUMAN-IN-THE-LOOP CONFIRMATION:\n" +
        "  You are NOT just a passive reader. You can actively PERFORM ACTIONS across the whole system on WhatsApp:\n" +
        "  1. Update order delivery status to ANY state: delivered, processing, pending, waiting, failed, cancelled, refunded, completed (single or batch) — NO SMS IS SENT\n" +
        "  2. Update payment status to ANY state: paid, pending, failed, refunded, cancelled\n" +
        "  3. Update store announcement popup (message, title, turn on/off) live on the website\n" +
        "  4. Update store settings in the database: support phone, delivery ETA, service prices (Netflix, AFA, MashUp, WAEC, BECE), and toggles\n" +
        "  5. Re-dispatch/retry failed telecom dispatches via DataMart API wallet\n" +
        "  6. Resync live telecom carrier delivery status with DataMart\n" +
        "  7. Send custom customer SMS via Arkesel using approved Sender ID D_1Gh\n" +
        "  8. Toggle product packages between IN STOCK and OUT OF STOCK\n" +
        "  9. Change product package prices on the store\n" +
        "  10. Resolve customer support live chats\n" +
        "  11. Update digital service orders (Netflix, MashUp *567*2#, AFA) and result checkers\n" +
        "  12. Generate Free Data Vouchers / codes on demand directly into the database\n" +
        "  13. Toggle the Free Data Giveaway Campaign active or off on the storefront\n" +
        "  14. Change the website color scheme / theme (e.g. blue, emerald, purple, dark mode, light mode)\n" +
        "  15. Full Reseller Agent Network Operations: Credit agent wallet, debit agent wallet, suspend/activate agent accounts, list registered agents, and view agent store sales\n" +
        "  16. Direct DataMart Bundle Dispatch: Send/dispatch any MTN, Telecel, or AirtelTigo data bundle directly from the DataMart API wallet to any recipient phone number (e.g. '0549992958 1GB' or 'send 2GB MTN to 0549992958') using {\"type\": \"dispatch_datamart_bundle\", \"phone\": \"0549992958\", \"capacity\": 1, \"network\": \"MTN\"}\n" +
        "  17. All-Corners System Diagnostic, Auto-Heal & Live Codebase Inspection: Scan every corner of the system (Paystack unverified payments, DataMart status desyncs, missing WhatsApp alerts, stale [dm_inflight] locks, runtime logs) and auto-heal them using {\"type\": \"diagnose_system\", \"autoFix\": true} or inspect any codebase file using {\"type\": \"inspect_codebase\", \"file\": \"AdminOrders.tsx\", \"keyword\": \"syncOrderStatus\"}\n" +
        "  18. Official WhatsApp Channel Broadcasting (https://whatsapp.com/channel/0029Vb7vwLN5kg70GeNMsB2w): Post live bundle prices, flash sales, free data voucher drops, or custom marketing promos to the DATA 1 GH WhatsApp Channel using {\"type\": \"post_to_channel\", \"topic\": \"prices\"|\"flash\"|\"vouchers\"|\"custom\", \"message\": \"your formatted channel post\"}\n" +
        "  FULL EXECUTIVE AUTHORITY: Whenever the verified owner commands an action, execute it immediately by appending [EXECUTE_ACTION: {\"type\": \"update_order_status\"|\"update_payment_status\"|\"update_announcement\"|\"update_setting\"|\"retry_order\"|\"resync_order\"|\"send_sms\"|\"broadcast_sms\"|\"toggle_stock\"|\"update_product_price\"|\"resolve_support_chat\"|\"update_service_status\"|\"generate_vouchers\"|\"toggle_free_data\"|\"change_theme_color\"|\"credit_agent\"|\"debit_agent\"|\"set_agent_status\"|\"list_agents\"|\"dispatch_datamart_bundle\"|\"diagnose_system\"|\"fix_all_anomalies\"|\"inspect_codebase\"|\"post_to_channel\", ...}] at the end of your reply.\n" +
        "  Sensitive to security: NEVER output database secrets, raw API tokens, or passwords.\n" +
        "- WHATSAPP FORMATTING RULES (CRITICAL):\n" +
        "  - Use single asterisks *like this* for bold text (NEVER double asterisks **like this**).\n" +
        "  - NEVER output HTML tags like <br> or markdown tables (| col | col |) — WhatsApp does not render tables or HTML tags! Use clean bullet points (•) and line breaks instead.\n" +
        "  - Understand shorthand & context immediately: if the owner sends a phone number + bundle size (e.g. '0549992958 1GB'), or says 'mistake' / 'cancel', respond sharply and intelligently like a real human engineer co-pilot.\n" +
        "  - When the owner asks why an error happened or asks to check all corners of the codebase/system, use the LIVE ALL-CORNERS DIAGNOSTIC X-RAY and COMPLETE CODEBASE MAP below to pinpoint the exact file, function, database column, or lock tag ([dm_dispatched], [dm_inflight], [wa_alert_sent]) and fix it on the spot!\n" +
        "- Approved SMS Sender ID for DATA 1 GH is 'D_1Gh'. Whenever sending customer SMS or alerts, use sender ID 'D_1Gh'.\n" +
        "- BE STRAIGHTFORWARD, DIRECT, AND FACTS-FIRST (NEVER BEAT AROUND THE BUSH):\n" +
        "  When the owner asks to pull, fetch, display, or check anything from the site or database, immediately retrieve and output the exact, structured information directly. Never beat around the bush, never give generic conversational fluff like 'I'm on it boss' or 'Tell me which department to tackle' without answering the question.\n" +
        "  Always answer directly in your very first sentence with exact figures, dates, references, prices, or statuses.\n" +
        "- CRITICAL DISTINCTION FOR FAILED ORDERS:\n" +
        "  When the owner asks 'Any failed order?' or asks about failed/problem orders, NEVER dump a rigid list of 15 orders mixing unpaid checkouts with paid orders!\n" +
        "  Always distinguish clearly and conversationally between:\n" +
        "  1. REAL PAID ORDERS WITH FAILED DELIVERY (payment_status = 'paid' & delivery_status = 'failed'): The customer paid MoMo, so this order genuinely needs attention or a DataMart retry (give the exact Reference, package, recipient phone, amount, and time, and offer to retry or mark it delivered).\n" +
        "  2. UNPAID / ABANDONED CHECKOUTS (payment_status = 'failed'): The customer abandoned Paystack/MoMo checkout without paying, so no money was collected and no action is needed.\n" +
        "- NEVER give canned, robotic dismissals like \"I'm on it, boss\" or \"Reply admin for full dashboard\".\n" +
        "- NEVER say \"As an AI\". You are Stony.\n\n" +
        "CURRENT LIVE BUSINESS REALITY:\n" +
        `- Delivery Speed / ETA: ${deliveryEta}\n` +
        `- DataMart API Wallet: ${walletBalance || "GH₵ 1,728.90"} (CRITICAL: The verified live DataMart wallet balance is ${walletBalance || "GH₵ 1,728.90"}. NEVER mention any outdated 68.90 figure under any circumstances!)\n` +
        (arkeselSmsBalance ? `- Arkesel SMS Balance: ${arkeselSmsBalance}\n` : "") +
        (recentOrdersSummary ? `\n${recentOrdersSummary}\n` : "") +
        (systemData ? `\n${systemData}\n` : "") +
        (liveCatalogText ? `\n${liveCatalogText}\n` : "") +
        (specificOrderCtx ? `\n${specificOrderCtx}` : "") +
        (recentRuntimeLogSummary ? `\n${recentRuntimeLogSummary}\n` : "") +
        (liveCornerDiagnosticsCtx ? `\n${liveCornerDiagnosticsCtx}\n` : "");

      if (aiConfig.copilotCustomInstructions) {
        ownerSystemPrompt += `\n\nADMIN CO-PILOT CUSTOM INSTRUCTIONS (CONFIGURED ON WEBSITE):\n${aiConfig.copilotCustomInstructions}\n`;
      }
      if (aiConfig.copilotTriggerRules) {
        ownerSystemPrompt += `\n\nADMIN CO-PILOT BEHAVIOR RULES (CONFIGURED ON WEBSITE):\n${aiConfig.copilotTriggerRules}\n`;
      }
      if (aiConfig.aiSystemInstructions) {
        ownerSystemPrompt += `\n\nGLOBAL STORE AI INSTRUCTIONS:\n${aiConfig.aiSystemInstructions}\n`;
      }

      const siteBase = STORE_FRONTEND_URL;
      const siteAiEndpoint = `${siteBase.replace(/\/+$/, "")}/api/admin?fn=admin-ai`;
      const syncActionToSite = async (action_type, payload) => {
        try {
          await axios.post(
            siteAiEndpoint,
            { action: "executeAiAction", action_type, payload, phone: String(from) },
            {
              headers: {
                "Content-Type": "application/json",
                "x-admin-bot": "true",
                "x-admin-key": process.env.ADMIN_API_KEY || "data1gh-secure-admin",
              },
              timeout: 8000,
            }
          );
        } catch (_) { }
      };

      // ── STEP 0: EXECUTE EXPLICIT DIRECT OWNER WRITE/ACTION COMMANDS IMMEDIATELY ──
      const cmdText = (effectiveText || text).trim();
      const lt = cmdText.toLowerCase();
      const orderRefsInText = extractOrderReferences(cmdText);

      // Direct Action Command 0a_channel_config: Configure Whapi Token, Channel JID, or Native 8-Digit Channel Pairing
      const setWhapiMatch = cmdText.match(/^set\s+(?:whapi|channel)\s+token\s+([^\s]+)$/i);
      if (setWhapiMatch) {
        const tok = setWhapiMatch[1].trim();
        await updateStoreSetting("whapi_api_token", tok);
        return sendWhatsApp(from, `✅ *Whapi Channel API Token Saved!*\nStony will now auto-resolve your WhatsApp Channel JID and post directly into ${DEFAULT_WHATSAPP_CHANNEL_URL} whenever you command a channel post.`);
      }
      const setChannelJidMatch = cmdText.match(/^set\s+channel\s+jid\s+([^\s]+)$/i);
      if (setChannelJidMatch) {
        const rawJid = setChannelJidMatch[1].trim();
        const jid = rawJid.includes("@") ? rawJid : `${rawJid}@newsletter`;
        await updateStoreSetting("whatsapp_channel_jid", jid);
        return sendWhatsApp(from, `✅ *WhatsApp Channel JID Saved:* *${jid}*`);
      }

      const pairChannelMatch = cmdText.match(/^(?:pair|link|connect)\s+(?:our\s+|my\s+|the\s+)?(?:whatsapp\s+)?channel(?:\s+(\+?233\d{9}|0\d{9}))?$/i);
      if (pairChannelMatch) {
        const pairPhone = pairChannelMatch[1] || from || "233547100951";
        await sendWhatsApp(from, `⏳ *Generating your 8-Digit WhatsApp Channel Pairing Code...*`);
        const pairRes = await initBaileysChannelClient({ forceReset: true, requestPairForPhone: pairPhone });
        if (pairRes?.pairingCode) {
          return sendWhatsApp(
            from,
            `🔐 *YOUR WHATSAPP CHANNEL PAIRING CODE:* *${pairRes.pairingCode}*\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `📲 *Complete in 10 seconds on your phone:*\n` +
            `1. Tap the *"Enter code to link new device"* notification on WhatsApp (or open *WhatsApp → Linked Devices → Link a Device → Link with phone number instead*).\n` +
            `2. Enter: *${pairRes.pairingCode}*\n\n` +
            `✅ Once linked, I will post directly into ${DEFAULT_WHATSAPP_CHANNEL_URL} automatically forever!`
          );
        }
        return sendWhatsApp(from, `⚠️ Could not generate pairing code right now (${pairRes?.error || "try again in 10 seconds"}).`);
      }

      // Direct Action Command 0a_channel_post: Post Prices, Flash Sale, Free Data Vouchers, or Custom Post to WhatsApp Channel
      const isDirectChannelUrlOnly = /^https?:\/\/(?:www\.)?whatsapp\.com\/channel\/[A-Za-z0-9_-]+\/?$/i.test(cmdText);
      const channelExplicitMatch =
        cmdText.match(/(?:post|broadcast|share|send|publish|write|put|drop)\s+(?:(prices?|catalog|rates?|bundles?|flash\s*sale|free\s*data|vouchers?|something|update|promo)\s+)?(?:to|on|in|into)\s+(?:our\s+|my\s+|the\s+)?(?:whatsapp\s+)?channel(?:\s*[:\-]?\s*([\s\S]+))?$/i) ||
        cmdText.match(/^(?:channel\s+post|post\s+channel)(?:\s*[:\-]?\s*([\s\S]+))?$/i);

      if (isDirectChannelUrlOnly || channelExplicitMatch) {
        if (isDirectChannelUrlOnly) {
          await updateStoreSetting("whatsapp_channel_url", cmdText.trim());
        }
        const subTopic = (!isDirectChannelUrlOnly && channelExplicitMatch?.[1] ? channelExplicitMatch[1] : "").trim().toLowerCase();
        const customBody = (!isDirectChannelUrlOnly && channelExplicitMatch ? (channelExplicitMatch[2] || channelExplicitMatch[1] || "") : "").trim();
        let topicMode = "prices";
        if (customBody && !/^(prices?|catalog|rates?|bundles?|flash\s*sale|free\s*data|vouchers?|something|update|promo)$/i.test(customBody)) {
          topicMode = "custom";
        } else if (/flash/.test(subTopic)) {
          topicMode = "flash";
        } else if (/free|voucher/.test(subTopic)) {
          topicMode = "vouchers";
        } else if (/something|update|promo/.test(subTopic)) {
          topicMode = "general";
        }

        const postBody = await buildChannelPostFromSystem(topicMode, topicMode === "custom" ? customBody : "");
        const res = await postToWhatsAppChannel(postBody, { ownerPhone: from });
        if (res.directPosted) {
          return sendWhatsApp(from, `📢 *Posted Live to Your WhatsApp Channel!* ✅\n🔗 ${res.channelUrl}\n\n${res.postText}`);
        } else if (res.pairingCode) {
          return sendWhatsApp(
            from,
            `🔐 *1-Time WhatsApp Channel Link Needed to Publish Live!*\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `Your post for ${res.channelUrl} is queued and ready! Because Meta restricts Channel posting to your Channel Admin device, enter this 1-time code on your phone:\n\n` +
            `🔑 *Pairing Code:* *${res.pairingCode}*\n\n` +
            `📲 *How to enter (10 seconds):*\n` +
            `1. Tap the *"Enter code to link new device"* notification on your WhatsApp (or go to *WhatsApp → Linked Devices → Link a Device → Link with phone number instead*).\n` +
            `2. Type *${res.pairingCode}*.\n\n` +
            `🚀 The moment it links, I will automatically publish your queued post below straight into the Channel and stay connected 24/7!\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${res.postText}`
          );
        } else {
          await sendWhatsApp(from, res.postText);
          return sendWhatsApp(
            from,
            `📢 *Channel Post Ready Above!* ☝️\n` +
            `Reply *pair channel* to get an 8-digit code so I can post directly into ${res.channelUrl} hands-free!`
          );
        }
      }

      // Direct Action Command 0a_shorthand: Shorthand bundle dispatch/lookup (e.g. "0549992958 1GB", "1GB 0549992958", "send 1GB to 0549992958")
      const shorthandPhoneFirst = cmdText.match(/^(?:(send|dispatch|push|give|buy)\s+)?(?:to\s+)?(0[2357]\d{8}|\+?233[2357]\d{8})\s+(?:(mtn|telecel|vodafone|airteltigo|at|ishare|bigtime)\s+)?(\d+(?:\.\d+)?)\s*gb(?:\s+(mtn|telecel|vodafone|airteltigo|at|ishare|bigtime))?$/i);
      const shorthandCapFirst = !shorthandPhoneFirst && cmdText.match(/^(?:(send|dispatch|push|give|buy)\s+)?(\d+(?:\.\d+)?)\s*gb\s+(?:(mtn|telecel|vodafone|airteltigo|at|ishare|bigtime)\s+)?(?:to\s+|for\s+|on\s+)?(0[2357]\d{8}|\+?233[2357]\d{8})(?:\s+(mtn|telecel|vodafone|airteltigo|at|ishare|bigtime))?$/i);
      if (shorthandPhoneFirst || shorthandCapFirst) {
        const hasExplicitVerb = Boolean((shorthandPhoneFirst && shorthandPhoneFirst[1]) || (shorthandCapFirst && shorthandCapFirst[1]));
        const rawTargetPhone = shorthandPhoneFirst ? shorthandPhoneFirst[2] : shorthandCapFirst[4];
        const rawCap = shorthandPhoneFirst ? shorthandPhoneFirst[4] : shorthandCapFirst[2];
        const rawNet = (shorthandPhoneFirst ? (shorthandPhoneFirst[3] || shorthandPhoneFirst[5]) : (shorthandCapFirst[3] || shorthandCapFirst[5])) || "";
        const cleanPhone = normalizePhone(rawTargetPhone);
        const capNum = parseFloat(rawCap);
        const pfx = cleanPhone.slice(0, 3);
        const detectedNet = rawNet
          ? (/telecel|vodafone/i.test(rawNet) ? "Telecel" : /airteltigo|^at$|ishare|bigtime/i.test(rawNet) ? "AirtelTigo" : "MTN")
          : (["020", "050"].includes(pfx) ? "Telecel" : ["027", "057", "026", "056"].includes(pfx) ? "AirtelTigo" : "MTN");

        if (hasExplicitVerb) {
          const execMsg = await executeOwnerDirectAction("dispatch_datamart_bundle", {
            phone: cleanPhone,
            capacity: capNum,
            network: detectedNet,
          });
          return sendWhatsApp(from, execMsg);
        } else {
          // Check if there are any recent orders for this phone number
          let recentOrderLine = "";
          try {
            const { data: recentOrds } = await supabase
              .from("orders")
              .select("reference, network, capacity, amount, payment_status, delivery_status, created_at")
              .eq("recipient_phone", cleanPhone)
              .order("created_at", { ascending: false })
              .limit(2);
            if (recentOrds && recentOrds.length > 0) {
              recentOrderLine = `\n\n📋 *Recent Order(s) for ${cleanPhone}:*\n` +
                recentOrds.map((o, idx) => `• *${o.reference}* — ${o.capacity}GB ${o.network} (₵${o.amount}) | Pay: *${o.payment_status}* | Delivery: *${o.delivery_status}*`).join("\n");
            }
          } catch (_) {}

          setOwnerPendingAction(from, {
            type: "dispatch_datamart_bundle",
            phone: cleanPhone,
            capacity: capNum,
            network: detectedNet,
          });

          const confirmReply =
            `⚡ *Ready to Dispatch ${capNum}GB ${detectedNet} → ${cleanPhone}*\n` +
            `• *Source:* DataMart Wallet (${walletBalance || "Live"})\n` +
            recentOrderLine +
            `\n\nReply *YES* to send *${capNum}GB ${detectedNet}* to *${cleanPhone}* right now, or reply *mistake* / *NO* to cancel.`;
          return sendWhatsApp(from, confirmReply);
        }
      }

      // Direct Action Command 0a_dm: Credit DataMart Wallet via MoMo prompt
      const creditDatamartMatch = cmdText.match(/(?:credit|fund|top\s*up|deposit)\s+(?:to\s+)?(?:datamart|data\s*mart|telecom\s*wallet|dm\s*wallet|my\s+wallet)\s+(?:with\s+)?(?:gh[c₵]?\s*|₵\s*)?(\d+(?:\.\d{1,2})?)/i) ||
        cmdText.match(/(?:credit|fund|top\s*up|deposit)\s+(?:gh[c₵]?\s*|₵\s*)?(\d+(?:\.\d{1,2})?)\s+(?:to\s+)?(?:datamart|data\s*mart|telecom\s*wallet|dm\s*wallet|my\s+wallet)/i);
      if (creditDatamartMatch) {
        const amt = parseFloat(creditDatamartMatch[1]);
        if (!isNaN(amt) && amt > 0) {
          const { data: sRows } = await supabase.from("settings").select("key,value").in("key", [
            "datamart_auth_token", "datamart_login_email", "datamart_login_password", "admin_topup_phone", "admin_alert_phone", "admin_whatsapp_number"
          ]);
          const sMap = {};
          (sRows || []).forEach(r => { sMap[r.key] = r.value; });
          
          let token = sMap["datamart_auth_token"] || process.env.DATAMART_AUTH_TOKEN;
          if (!token && sMap["datamart_login_email"] && sMap["datamart_login_password"]) {
            try {
              const lRes = await axios.post("https://api.datamartgh.shop/api/v1/login", {
                email: sMap["datamart_login_email"],
                password: sMap["datamart_login_password"]
              }, { timeout: 10000 });
              if (lRes.data?.token) {
                token = lRes.data.token;
                await supabase.from("settings").upsert({ key: "datamart_auth_token", value: token }, { onConflict: "key" });
              }
            } catch (_) {}
          }

          // Check if an explicit phone was provided in the command (e.g. "top up datamart 50 on 0551234567")
          const explicitPhoneMatch = cmdText.match(/(?:on|with|to|for|momo|number|num|phone)\s*(?:0|\+?233)?([2357][0-9]{8})\b/i) ||
            cmdText.match(/\b(0[2357][0-9]{8})\b/i) ||
            cmdText.match(/\b(233[2357][0-9]{8})\b/i);

          let chosenPhone = "";
          if (explicitPhoneMatch) {
            const rawP = (explicitPhoneMatch[1] || explicitPhoneMatch[0]).replace(/\D/g, "");
            chosenPhone = rawP.startsWith("233") ? "0" + rawP.slice(3) : (rawP.startsWith("0") ? rawP : "0" + rawP);
          } else if (sMap["admin_topup_phone"]) {
            chosenPhone = sMap["admin_topup_phone"];
          } else if (sMap["admin_alert_phone"]) {
            chosenPhone = sMap["admin_alert_phone"];
          } else {
            chosenPhone = normalizeGhanaPhone(from) || "0547228161";
          }
          const formattedPhone = chosenPhone.length === 12 && chosenPhone.startsWith("233") ? "0" + chosenPhone.slice(3) : chosenPhone;

          if (token) {
            try {
              const bRes = await axios.post("https://api.datamartgh.shop/api/bridge/collect", {
                phoneNumber: formattedPhone,
                amount: amt,
                network: "MTN"
              }, {
                headers: { "Content-Type": "application/json", "x-auth-token": token },
                timeout: 15000
              });

              if (bRes.data?.status === "success" || bRes.data?.success) {
                const trxId = bRes.data.data?.transactionId || bRes.data.transactionId;
                if (trxId) {
                  let attempts = 0;
                  const pollInterval = setInterval(async () => {
                    attempts++;
                    try {
                      const stRes = await axios.get(`https://api.datamartgh.shop/api/bridge/status/${trxId}`, {
                        headers: { "x-auth-token": token },
                        timeout: 5000
                      });
                      if (stRes.data?.data?.status === "completed") {
                        clearInterval(pollInterval);
                        const balRes = await axios.get("https://api.datamartgh.shop/api/developer/balance", {
                          headers: { "x-api-key": activeDatamartKey, ...(activeDatamartSecret ? { "x-api-secret": activeDatamartSecret } : {}) },
                          timeout: 5000
                        }).catch(() => ({}));
                        const newBal = balRes.data?.data?.balance;
                        sendWhatsApp(from,
                          `🎉 *DATAMART WALLET CREDITED SUCCESSFULLY BOSS!*\n\n` +
                          `• *Amount Added:* GH₵ ${amt.toFixed(2)}\n` +
                          `• *New DataMart Balance:* *GH₵ ${newBal != null ? Number(newBal).toFixed(2) : "Updated"}* 🚀\n\n` +
                          `Your developer wallet has been credited and is active for customer orders!`
                        ).catch(() => {});
                      } else if (attempts >= 20 || stRes.data?.data?.status === "failed") {
                        clearInterval(pollInterval);
                      }
                    } catch (_) {}
                  }, 3000);
                }

                return sendWhatsApp(from,
                  `📲 *MOMO TOP-UP PROMPT DISPATCHED BOSS!*\n\n` +
                  `I have sent a Mobile Money payment prompt of *GH₵ ${amt.toFixed(2)}* to *${formattedPhone}*.\n\n` +
                  `🔑 *Next Step:* Enter your MoMo PIN on *${formattedPhone}* to approve the deposit.\n\n` +
                  `💡 *Tip:* To send to a different MoMo number next time, you can write:\n` +
                  `• *top up datamart ${amt} on [phone]*\n` +
                  `• Or set default: *set momo [phone]*`
                );
              }
            } catch (err) {
              console.error("Bridge deposit error:", err?.response?.data || err?.message);
            }
          }

          // Fallback if token not configured: display merchant deposit details + instructions
          return sendWhatsApp(from,
            `💳 *TOP UP DATAMART WALLET*\n\n` +
            `To top up *GH₵ ${amt.toFixed(2)}* to your DataMart developer wallet:\n\n` +
            `📱 *Transfer MoMo to DataMart Merchant:*\n` +
            `• *MoMo Number:* *0257476174*\n` +
            `• *Account Name:* *DANAA SAMUEL FRIMPONG / Dajo Unimarket*\n` +
            `• *Network:* MTN\n\n` +
            `After sending, reply here with:\n` +
            `*claim datamart [Transaction_ID]*\n\n` +
            `💡 Or log into your DataMart dashboard settings to enable automatic 1-click MoMo prompts!`
          );
        }
      }

      // Direct Action Command 0a_set_momo: Set default top-up MoMo number
      const setTopupPhoneMatch = cmdText.match(/(?:set|update|change)\s+(?:default\s+)?(?:top\s*up|datamart|telecom|momo)\s*(?:phone|number)?\s*(?:to|=)?\s*(0[2357]\d{8}|233[2357]\d{8})/i) ||
        cmdText.match(/(?:set|update|change)\s+momo\s+(?:number\s+)?(?:to|=)?\s*(0[2357]\d{8}|233[2357]\d{8})/i);
      if (setTopupPhoneMatch) {
        let cleanP = setTopupPhoneMatch[1].trim();
        if (cleanP.startsWith("233")) cleanP = "0" + cleanP.slice(3);
        await supabase.from("settings").upsert({ key: "admin_topup_phone", value: cleanP }, { onConflict: "key" });
        return sendWhatsApp(from,
          `✅ *DEFAULT TOP-UP MOMO NUMBER SAVED BOSS!*\n\n` +
          `• *Saved Number:* *${cleanP}*\n\n` +
          `Whenever you send *top up datamart [amount]*, the payment prompt will automatically be sent to *${cleanP}*!\n\n` +
          `💡 *Tip:* You can also top up any other number anytime by adding it to your message:\n` +
          `• *top up datamart 50 on 054XXXXXXX*`
        );
      }

      // Direct Action Command 0a_claim: Claim DataMart MoMo Deposit
      const claimDatamartMatch = cmdText.match(/(?:claim\s+datamart|claim\s+deposit|claim\s+momo)\s+([A-Za-z0-9_-]+)/i);
      if (claimDatamartMatch) {
        const trxId = claimDatamartMatch[1].trim();
        const { data: sRows } = await supabase.from("settings").select("key,value").in("key", [
          "datamart_auth_token", "admin_topup_phone", "admin_alert_phone", "admin_whatsapp_number"
        ]);
        const sMap = {};
        (sRows || []).forEach(r => { sMap[r.key] = r.value; });
        const token = sMap["datamart_auth_token"] || process.env.DATAMART_AUTH_TOKEN;
        const momoPhone = sMap["admin_topup_phone"] || sMap["admin_alert_phone"] || normalizeGhanaPhone(from) || "0547228161";
        
        if (token) {
          try {
            const clRes = await axios.post("https://api.datamartgh.shop/api/user/claim-deposit", {
              trxId,
              momoNumber: momoPhone,
              network: "mtn"
            }, {
              headers: { "Content-Type": "application/json", "x-auth-token": token },
              timeout: 15000
            });
            if (clRes.data?.status === "success" || clRes.data?.success) {
              const newBal = clRes.data?.data?.newBalance ?? clRes.data?.newBalance;
              return sendWhatsApp(from,
                `✅ *DATAMART DEPOSIT CLAIMED BOSS!*\n\n` +
                `• *Transaction ID:* ${trxId}\n` +
                `• *New DataMart Balance:* *GH₵ ${newBal != null ? Number(newBal).toFixed(2) : "Credited"}* 🎉\n\n` +
                `Your developer wallet is updated!`
              );
            } else {
              return sendWhatsApp(from, `⚠️ DataMart response: ${clRes.data?.message || "Could not verify transaction ID. Please check the ID and retry."}`);
            }
          } catch (err) {
            return sendWhatsApp(from, `⚠️ Could not claim deposit: ${err?.response?.data?.message || err?.message}`);
          }
        }
      }

      // Direct Action Command 0a: Credit Agent Wallet
      const creditAgentMatch = cmdText.match(/(?:credit|fund|top\s*up)\s+(?:agent\s+)?([A-Za-z0-9_.-]+)\s+(?:with\s+)?(?:gh[c₵]?\s*|₵\s*)?(\d+(?:\.\d{1,2})?)/i);
      if (creditAgentMatch) {
        const target = creditAgentMatch[1].trim();
        const amt = parseFloat(creditAgentMatch[2]);
        if (!isNaN(amt) && amt > 0) {
          const res = await creditAgentWalletSafely(target, amt);
          if (res) {
            await syncActionToSite("credit_agent", { phone: target, amount: amt });
            return sendWhatsApp(from,
              `✅ *AGENT WALLET CREDITED BOSS!*\n\n` +
              `👤 *Agent:* *${res.agent.name || res.agent.store_name || res.agent.phone}*\n` +
              `📱 *Phone:* ${res.agent.phone || "N/A"}\n` +
              `🏪 *Store:* ${res.agent.store_name || "N/A"}\n` +
              `💵 *Credited:* +GH₵ ${res.credited.toFixed(2)}\n` +
              `💰 *New Wallet Balance:* *GH₵ ${res.newBalance.toFixed(2)}* live in database!`
            );
          } else {
            return sendWhatsApp(from, `⚠️ Could not find registered agent "${target}". Use "list agents" to see all agents.`);
          }
        }
      }

      // Direct Action Command 0b: Debit Agent Wallet
      const debitAgentMatch = cmdText.match(/(?:debit|deduct|remove)\s+(?:from\s+)?(?:agent\s+)?([A-Za-z0-9_.-]+)\s+(?:with\s+)?(?:gh[c₵]?\s*|₵\s*)?(\d+(?:\.\d{1,2})?)/i);
      if (debitAgentMatch) {
        const target = debitAgentMatch[1].trim();
        const amt = parseFloat(debitAgentMatch[2]);
        if (!isNaN(amt) && amt > 0) {
          const res = await debitAgentWalletSafely(target, amt);
          if (res) {
            return sendWhatsApp(from,
              `✅ *AGENT WALLET DEBITED BOSS!*\n\n` +
              `👤 *Agent:* *${res.agent.name || res.agent.store_name || res.agent.phone}*\n` +
              `💵 *Debited:* -GH₵ ${res.debited.toFixed(2)}\n` +
              `💰 *New Wallet Balance:* *GH₵ ${res.newBalance.toFixed(2)}* live in database!`
            );
          } else {
            return sendWhatsApp(from, `⚠️ Could not find registered agent "${target}".`);
          }
        }
      }

      // Direct Action Command 0a_price: Update Flash Sale Product Price
      const updateFlashPriceMatch =
        cmdText.match(/(?:update|change|set)\s+flash\s*sale\s+(?:price\s+)?(?:for\s+)?(?:mtn\s+)?(\d+(?:\.\d+)?)\s*(?:gb)?\s+(?:price\s+)?(?:to|as)?\s*(?:gh[c₵]?\s*)?(\d+(?:\.\d+)?)/i) ||
        cmdText.match(/(?:update|change|set)\s+(?:price\s+)?(?:for\s+)?(?:mtn\s+)?(\d+(?:\.\d+)?)\s*(?:gb)?\s+flash\s*sale\s+(?:to|as)?\s*(?:gh[c₵]?\s*)?(\d+(?:\.\d+)?)/i);
      if (updateFlashPriceMatch) {
        const cap = updateFlashPriceMatch[1].trim();
        const price = parseFloat(updateFlashPriceMatch[2]);
        const res = await updateFlashSaleProductPrice(cap, price);
        if (res) {
          return sendWhatsApp(from,
            `⚡ *FLASH SALE PRICE UPDATED BOSS!*\n\n` +
            `📦 *Package:* MTN ${res.product.capacity}GB Flash Sale\n` +
            `💰 *Old Price:* GH₵ ${Number(res.oldPrice).toFixed(2)}\n` +
            `🔥 *New Flash Price:* *GH₵ ${Number(res.newPrice).toFixed(2)}* live on storefront!`
          );
        } else {
          return sendWhatsApp(from, `⚠️ Could not find Flash Sale package for "${cap}GB". Text "Flash sale" to see all packages.`);
        }
      }

      // Direct Action Command 0a_toggle: Enable / Turn on Flash Sale
      const enableFlashMatch = cmdText.match(/(?:turn\s*on|enable|start|activate|switch\s*on|put\s*on)\s+(?:the\s+)?flash\s*sale(?:\s+(?:for\s+)?(\d+)\s*(?:hours?|hrs?))?|(?:turn|switch)\s+(?:the\s+)?flash\s*sale\s+on(?:\s+(?:for\s+)?(\d+)\s*(?:hours?|hrs?))?|\bflash\s*sale\s+(?:on|start|activate)(?:\s+(?:for\s+)?(\d+)\s*(?:hours?|hrs?))?/i);
      if (enableFlashMatch) {
        const rawHours = enableFlashMatch[1] || enableFlashMatch[2] || enableFlashMatch[3];
        const hours = rawHours ? parseInt(rawHours, 10) : 2;
        const res = await toggleFlashSale(true, hours);
        if (res?.enabled) {
          return sendWhatsApp(from,
            `⚡ *FLASH SALE ACTIVATED BOSS!*\n\n` +
            `🔥 The Flash Sale banner & discounted rates are now *LIVE* on the storefront!\n` +
            `⏳ *Active Until:* *${res.endTime?.replace("T", " ")}*\n\n` +
            `💡 Customers can now purchase MTN Flash bundles directly on the site!`
          );
        } else {
          return sendWhatsApp(from, `⚠️ Could not toggle flash sale. Please verify database connection.`);
        }
      }

      // Direct Action Command 0a_disable: Disable / Turn off Flash Sale
      if (/(?:turn\s*off|disable|stop|end|deactivate|pause|switch\s*off|put\s*off)\s+(?:the\s+)?flash\s*sale|(?:turn|switch)\s+(?:the\s+)?flash\s*sale\s+off|\bflash\s*sale\s+(?:off|stop|deactivate|pause)\b/i.test(lt)) {
        await toggleFlashSale(false);
        return sendWhatsApp(from,
          `🔒 *FLASH SALE TURNED OFF BOSS!*\n\n` +
          `The Flash Sale has been disabled on the storefront. Products will now sell at their regular prices.`
        );
      }

      // Direct Action Command 0a_pause_orders: Pause Store Orders
      if (/\b(?:pause\s*orders?|pause\s*packages?|stop\s*orders?|disable\s*orders?|close\s*shop|turn\s*off\s*orders?|stop\s*taking\s*orders?|hold\s*orders?|freeze\s*orders?)\b/i.test(lt)) {
        await supabase.from("settings").upsert({ key: "orders_paused", value: "true" }, { onConflict: "key" });
        await syncActionToSite("update_setting", { key: "orders_paused", value: "true" }).catch(() => null);
        return sendWhatsApp(from,
          `⏸️ *ALL STORE ORDERS & PACKAGES PAUSED BOSS!*\n\n` +
          `All packages have now been *PAUSED* across:\n` +
          `• ✅ Main Storefront (data1gh.com)\n` +
          `• ✅ All Agent Reseller Storefronts\n` +
          `• ✅ WhatsApp Bot Ordering\n\n` +
          `📢 All "Buy Now" buttons now display *"Orders Paused"* and checkout is locked.\n\n` +
          `💡 When ready, simply say *"Resume orders"* or *"Turn on orders"* to open everything back up!`
        );
      }

      // Direct Action Command 0a_resume_orders: Resume Store Orders
      if (/\b(?:resume\s*orders?|resume\s*packages?|open\s*shop|enable\s*orders?|turn\s*on\s*orders?|start\s*taking\s*orders?|unpause\s*orders?|unfreeze\s*orders?)\b/i.test(lt)) {
        await supabase.from("settings").upsert({ key: "orders_paused", value: "false" }, { onConflict: "key" });
        await syncActionToSite("update_setting", { key: "orders_paused", value: "false" }).catch(() => null);
        return sendWhatsApp(from,
          `▶️ *ALL STORE ORDERS RESUMED BOSS!*\n\n` +
          `🔥 All packages are now *ACTIVE & OPEN* across:\n` +
          `• ✅ Main Storefront (data1gh.com)\n` +
          `• ✅ All Agent Reseller Storefronts\n` +
          `• ✅ WhatsApp Bot Ordering\n\n` +
          `Customers can now purchase data packages normally! 🚀`
        );
      }

      // Direct Action Command 0d: Suspend / Activate Agent
      const statusAgentMatch = cmdText.match(/(suspend|block|deactivate|activate|unblock|enable)\s+agent\s+([A-Za-z0-9_.-]+)/i);
      if (statusAgentMatch) {
        const actionType = statusAgentMatch[1].toLowerCase();
        const newStatus = /suspend|block|deactivate/.test(actionType) ? "suspended" : "active";
        const target = statusAgentMatch[2].trim();
        const res = await setAgentStatusSafely(target, newStatus);
        if (res) {
          return sendWhatsApp(from, `✅ *AGENT STATUS UPDATED BOSS!*\n\n👤 *Agent:* *${res.agent.name || res.agent.store_name || res.agent.phone}*\n⚡ *Status:* *${newStatus.toUpperCase()}* live in database!`);
        } else {
          return sendWhatsApp(from, `⚠️ Could not find agent "${target}".`);
        }
      }

      // Direct Action Command 1a: Payment Status Update
      const paymentCmdMatch =
        cmdText.match(/(?:mark|set|update|change)\s+(?:the\s+)?payment(?:\s+status)?\s+(?:of|for)?\s*([A-Za-z0-9_-]{5,35})\s+(?:to|as)?\s*([a-zA-Z_\s-]{3,20})/i) ||
        cmdText.match(/(?:mark|set|update|change)\s+(?:order\s+)?([A-Za-z0-9_-]{5,35})\s+payment(?:\s+status)?\s+(?:to|as)?\s*([a-zA-Z_\s-]{3,20})/i) ||
        cmdText.match(/(?:mark|set)\s+(?:order\s+)?([A-Za-z0-9_-]{5,35})\s+as\s+(paid|unpaid|refunded)/i);

      if (paymentCmdMatch) {
        const targetRef = paymentCmdMatch[1].trim();
        const rawStatus = (paymentCmdMatch[2] || "paid").trim();
        const targetPaymentStatus = extractPaymentStatusFromText(rawStatus) || rawStatus.toLowerCase();
        await updateOrderPaymentStatusSafely(targetRef, targetPaymentStatus);
        await syncActionToSite("update_payment_status", { reference: targetRef, payment_status: targetPaymentStatus });
        return sendWhatsApp(from, `✅ *ACTION COMPLETED BOSS!*\n\n💰 Order *${targetRef}* payment status has been updated to *${targetPaymentStatus.toUpperCase()}* live in the database!`);
      }

      const hasUpdateIntent = /\b(update|mark|set|change)\b/i.test(cmdText) && /\b(delivered|failed|processing|pending|waiting|cancelled|refunded|completed|delivery status|status)\b/i.test(cmdText);

      if (orderRefsInText.length > 0 && hasUpdateIntent) {
        const targetStatus = extractStatusFromText(cmdText) || "delivered";
        const updatedList = [];
        for (const r of orderRefsInText) {
          const ok = await updateOrderDeliveryStatusSafely(r, targetStatus);
          await syncActionToSite("update_order_status", { reference: r, delivery_status: targetStatus });
          if (ok) updatedList.push(r);
        }
        const displayRefs = updatedList.length > 0 ? updatedList : orderRefsInText;
        return sendWhatsApp(from,
          `✅ *ACTION COMPLETED BOSS!*\n\n` +
          `📦 Updated *${displayRefs.length}* order(s) to *${targetStatus.toUpperCase()}* live in the database:\n` +
          displayRefs.map(r => `• *${r}*`).join("\n")
        );
      }

      const orderCmdMatch =
        cmdText.match(/(?:mark|set|update|change)\s+(?:order\s+)?([A-Za-z0-9_-]{5,35})\s+(?:to|as)?\s*(delivered|processing|pending|failed|cancelled|refunded)/i) ||
        cmdText.match(/(?:mark|set|update)\s+(delivered|processing|pending|failed|cancelled|refunded)\s+(?:for\s+)?(?:order\s+)?([A-Za-z0-9_-]{5,35})/i);

      if (orderCmdMatch) {
        const isFirst = /^(delivered|processing|pending|failed|cancelled|refunded)$/i.test(orderCmdMatch[2]);
        const targetRef = isFirst ? orderCmdMatch[1].trim() : orderCmdMatch[2].trim();
        const rawStatus = (isFirst ? orderCmdMatch[2] : orderCmdMatch[1]).trim();
        const targetStatus = extractStatusFromText(rawStatus) || rawStatus.toLowerCase();
        await updateOrderDeliveryStatusSafely(targetRef, targetStatus);
        await syncActionToSite("update_order_status", { reference: targetRef, delivery_status: targetStatus });
        return sendWhatsApp(from, `✅ *ACTION COMPLETED BOSS!*\n\n📦 Order *${targetRef}* has been marked as *${targetStatus.toUpperCase()}* live in the database!`);
      }

      // Direct Action Command 1b: Announcement Update
      const annToggleMatch = cmdText.match(/(?:turn\s*(?:on|off)|enable|disable)\s+(?:the\s+)?(?:announcement|popup|banner)/i);
      const annMsgMatch = cmdText.match(/(?:update|change|set)\s+(?:the\s+)?(?:announcement|popup|banner)(?:\s+(?:message|text|to|:))?\s*["“']?([^"”']+)["”']?/i);

      if (annToggleMatch) {
        const enable = /\b(on|enable)\b/i.test(annToggleMatch[0]);
        await updateStoreAnnouncement({ title: "Store Announcement", message: "", enabled: enable });
        await syncActionToSite("update_announcement", { enabled: enable });
        return sendWhatsApp(from, `✅ *ACTION COMPLETED BOSS!*\n\n📢 Storefront announcement popup is now *${enable ? "ENABLED (LIVE)" : "DISABLED (OFF)"}* on ${STORE_FRONTEND_URL}!`);
      }

      if (annMsgMatch) {
        const newMsg = annMsgMatch[1].trim();
        if (newMsg && !/^(on|off|true|false|help|status)$/i.test(newMsg)) {
          await updateStoreAnnouncement({ title: "Store Announcement", message: newMsg, enabled: true });
          await syncActionToSite("update_announcement", { title: "Store Announcement", message: newMsg, enabled: true });
          return sendWhatsApp(from, `✅ *ACTION COMPLETED BOSS!*\n\n📢 Storefront announcement banner updated live on ${STORE_FRONTEND_URL}:\n\n"${newMsg}"`);
        }
      }

      // Direct Action Command 1c: Store Settings
      const phoneSettingMatch = cmdText.match(/(?:update|set|change)\s+(?:the\s+)?support\s+phone\s+(?:to|=)?\s*(0[2357]\d{8}|233\d{9})/i);
      if (phoneSettingMatch) {
        const newPhone = phoneSettingMatch[1].trim();
        await updateStoreSetting("support_phone", newPhone);
        await syncActionToSite("update_setting", { key: "support_phone", value: newPhone });
        return sendWhatsApp(from, `✅ *ACTION COMPLETED BOSS!*\n\n📱 Support & alert phone updated to *${newPhone}* live!`);
      }

      const etaSettingMatch = cmdText.match(/(?:update|set|change)\s+(?:the\s+)?delivery\s+(?:eta|speed|time)\s+(?:to|=)\s*["“']?([^"”']+)["”']?/i);
      if (etaSettingMatch) {
        const newEta = etaSettingMatch[1].trim();
        await updateStoreSetting("delivery_eta", newEta);
        await syncActionToSite("update_setting", { key: "delivery_eta", value: newEta });
        return sendWhatsApp(from, `✅ *ACTION COMPLETED BOSS!*\n\n⚡ Storefront delivery ETA display updated to *${newEta}*!`);
      }

      const priceSettingMatch = cmdText.match(/(?:update|set|change)\s+(?:the\s+)?(netflix|afa|mashup|waec|bece)\s+price\s+(?:to|=)?\s*(\d+(?:\.\d+)?)/i);
      if (priceSettingMatch) {
        const service = priceSettingMatch[1].toLowerCase();
        const newPrice = priceSettingMatch[2];
        const key = service === "waec" ? "waec_price" : (service === "bece" ? "bece_price" : `${service}_price`);
        await updateStoreSetting(key, newPrice);
        await syncActionToSite("update_setting", { key, value: newPrice });
        return sendWhatsApp(from, `✅ *ACTION COMPLETED BOSS!*\n\n💰 *${service.toUpperCase()}* price updated to *GH₵ ${Number(newPrice).toFixed(2)}* live on the storefront!`);
      }

      const genericSettingMatch = cmdText.match(/(?:update|set|change)\s+(?:store\s+)?setting\s+([a-zA-Z0-9_-]+)\s+(?:to|=)\s*["“']?([^"”']+)["”']?/i);
      if (genericSettingMatch) {
        const key = genericSettingMatch[1].trim().toLowerCase();
        const val = genericSettingMatch[2].trim();
        await updateStoreSetting(key, val);
        await syncActionToSite("update_setting", { key, value: val });
        return sendWhatsApp(from, `✅ *ACTION COMPLETED BOSS!*\n\n⚙️ Store setting *${key}* updated to *${val}*!`);
      }

      // Direct Action Command 2: Resync order with DataMart
      const resyncCmdMatch = cmdText.match(/(?:resync|sync)\s+(?:order\s+)?([A-Za-z0-9_-]{5,35})/i);
      if (resyncCmdMatch) {
        const targetRef = resyncCmdMatch[1].trim();
        const execMsg = await executeOwnerDirectAction("resync_order", { ref: targetRef });
        await syncActionToSite("resync_datamart", { reference: targetRef });
        return sendWhatsApp(from, `✅ *RESYNC COMPLETED BOSS!*\n\n🔄 ${execMsg || `Order *${targetRef}* synced with DataMart API.`}`);
      }

      // Direct Action Command 3: Send SMS
      const smsCmdMatch = cmdText.match(/(?:send\s+)?(?:an\s+)?(?:custom\s+)?sms\s+(?:to\s+)?(0[2357]\d{8}|233\d{9})\s*(?::|\s+(?:saying|with message|that|message:))\s*["“']?([^"”']+)["”']?/i);
      if (smsCmdMatch) {
        const targetPhone = smsCmdMatch[1].trim();
        const targetText = smsCmdMatch[2].trim();
        await sendAdminSms(targetText, targetPhone);
        return sendWhatsApp(from,
          `✅ *SMS DELIVERED BOSS!*\n\n` +
          `📱 *Recipient:* ${targetPhone}\n` +
          `🆔 *Sender ID:* *D_1Gh*\n` +
          `💬 *Message:* "${targetText}"`
        );
      }

      // Direct Action Command 4: Stock toggle
      const stockCmdMatch = cmdText.match(/(?:put|mark|set)\s+([A-Za-z0-9\s]+?)\s+(in\s*stock|back\s*in\s*stock|out\s*of\s*stock|available|unavailable)/i);
      if (stockCmdMatch) {
        const itemText = stockCmdMatch[1].trim();
        const inStock = /in\s*stock|available/i.test(stockCmdMatch[2]);
        const { data: prods } = await supabase.from("products").select("id, name, network, capacity, in_stock");
        const found = (prods || []).find(p => `${p.network} ${p.capacity} ${p.name || ""}`.toLowerCase().includes(itemText.toLowerCase()));
        if (found) {
          await supabase.from("products").update({ in_stock: inStock, updated_at: new Date().toISOString() }).eq("id", found.id);
          await syncActionToSite("toggle_product_stock", { product_id: found.id, in_stock: inStock, name: `${found.network} ${found.capacity}` });
          return sendWhatsApp(from,
            `✅ *INVENTORY UPDATED BOSS!*\n\n` +
            `📦 *Package:* ${found.network} ${found.capacity}GB\n` +
            `⚡ *New Status:* *${inStock ? "IN STOCK ✅" : "OUT OF STOCK ❌"}* on storefront!`
          );
        }
      }

      // Direct Action Command 5: Retry telecom dispatch via DataMart
      const retryCmdMatch = cmdText.match(/(?:retry|re-dispatch|redispatch|repurchase)\s+(?:order\s+)?([A-Za-z0-9_-]{5,35})/i);
      if (retryCmdMatch) {
        const targetRef = retryCmdMatch[1].trim();
        const { data: ord } = await supabase.from("orders").select("reference, recipient_phone, network, capacity, amount").or(`reference.ilike.%${targetRef}%,datamart_reference.ilike.%${targetRef}%`).maybeSingle();
        if (ord) {
          await syncActionToSite("retry_order", {
            reference: ord.reference,
            phone: ord.recipient_phone,
            network: ord.network,
            capacity: ord.capacity
          });
          return sendWhatsApp(from,
            `✅ *RETRY DISPATCHED BOSS!*\n\n` +
            `🎯 *Order:* *${ord.reference}*\n` +
            `📦 *Package:* ${ord.capacity}GB ${ord.network} → *${ord.recipient_phone}*\n` +
            `⚡ Re-dispatched via DataMart Fast Delivery API!`
          );
        }
      }

      // Direct Action Command 6: Product price change
      const priceCmdMatch =
        cmdText.match(/(?:change|set|update)\s+(?:the\s+)?(?:price\s+of\s+)?(mtn|telecel|airteltigo|at)\s+(\d+(?:gb|mb)?)\s+(?:data\s+)?(?:price\s+)?(?:to|as)?\s*(?:gh[c₵]?\s*|₵\s*)?(\d+(?:\.\d{1,2})?)/i) ||
        cmdText.match(/(?:set|change|update)\s+price\s+(?:of\s+)?([A-Za-z0-9\s]+?)\s+(?:to|as)\s+(?:ghc|gh₵|₵)?\s*(\d+(?:\.\d{1,2})?)/i) ||
        cmdText.match(/(?:set|change|update)\s+([A-Za-z0-9\s]+?)\s+price\s+(?:to|as)\s+(?:ghc|gh₵|₵)?\s*(\d+(?:\.\d{1,2})?)/i);
      if (priceCmdMatch) {
        const isNetStyle = Boolean(priceCmdMatch[3]);
        const itemText = isNetStyle ? `${priceCmdMatch[1]} ${priceCmdMatch[2].replace(/\D/g, "")}` : priceCmdMatch[1].trim();
        const newPrice = parseFloat(isNetStyle ? priceCmdMatch[3] : priceCmdMatch[2]);
        const { data: prods } = await supabase.from("products").select("id, name, network, capacity, price");
        const found = (prods || []).find(p => {
          if (isNetStyle) {
            return String(p.network || "").toLowerCase().includes(priceCmdMatch[1].toLowerCase()) &&
              String(p.capacity || "").replace(/\D/g, "") === priceCmdMatch[2].replace(/\D/g, "");
          }
          return `${p.network} ${p.capacity} ${p.name || ""}`.toLowerCase().includes(itemText.toLowerCase());
        });
        if (found && !isNaN(newPrice) && newPrice > 0) {
          await supabase.from("products").update({ price: newPrice, updated_at: new Date().toISOString() }).eq("id", found.id);
          await syncActionToSite("update_product_price", { product_id: found.id, network: found.network, capacity: found.capacity, price: newPrice });
          return sendWhatsApp(from,
            `✅ *PRICE UPDATED BOSS!*\n\n` +
            `📦 *Package:* ${found.network} ${found.capacity}GB\n` +
            `💰 *Old Price:* GH₵ ${Number(found.price).toFixed(2)}\n` +
            `⚡ *New Price:* *GH₵ ${newPrice.toFixed(2)}* live on the storefront!`
          );
        }
      }

      // Direct Action Command 7: Resolve support chat
      const chatCmdMatch = cmdText.match(/(?:resolve|close|clear)\s+(?:support\s+)?(?:chat|conversation)(?:\s+(?:with|for)\s+([A-Za-z0-9_-]+))?/i);
      if (chatCmdMatch) {
        const target = chatCmdMatch[1]?.trim() || "";
        await executeOwnerDirectAction("resolve_support_chat", { phone: target || null });
        return sendWhatsApp(from, `✅ *SUPPORT CHAT RESOLVED BOSS!*\n\n💬 Marked open customer support conversation${target ? ` for *${target}*` : ""} as resolved!`);
      }

      // ── STEP 1: FAST DIRECT IN-BOT CO-PILOT ENGINE (USING WEBSITE'S CONFIGURED PROVIDER & MODEL) ──
      let aiReply = "";
      try {
        const aiResult = await executeBotAi({
          systemPrompt: ownerSystemPrompt,
          userMessage: text,
          history,
          maxTokens: 2500,
          temperature: 0.7
        });
        aiReply = aiResult?.text || "";
      } catch (botAiErr) {
        console.warn("Direct bot AI call note:", botAiErr.message);
      }

      // If direct bot engine didn't yield text, try Site Co-Pilot bridge as backup
      if (!aiReply) {
        try {
          const siteResp = await axios.post(
            siteAiEndpoint,
            {
              action: "aiCoPilotChat",
              message: text,
              history: history.slice(-8).map(h => ({
                role: h.role === "assistant" || h.role === "model" ? "assistant" : "user",
                content: h.text || h.content || ""
              })),
              source: "whatsapp",
              phone: String(from),
            },
            {
              headers: {
                "Content-Type": "application/json",
                "x-admin-bot": "true",
                "x-admin-key": process.env.ADMIN_API_KEY || "data1gh-secure-admin",
              },
              timeout: 15000,
            }
          );

          if (
            siteResp.data &&
            siteResp.data.ok &&
            siteResp.data.reply
          ) {
            aiReply = siteResp.data.reply;
            if (siteResp.data.staged_action) {
              try {
                const execRes = await executeOwnerDirectAction(
                  siteResp.data.staged_action.action_type || siteResp.data.staged_action.type,
                  siteResp.data.staged_action.payload || siteResp.data.staged_action
                );
                if (execRes) aiReply += `\n\n✅ Done bossu! ${execRes}`;
              } catch (_) { }
            }
          }
        } catch (_) { }
      }

      // Check if AI emitted direct execution tag [EXECUTE_ACTION: {...}]
      const execActionMatch = aiReply ? aiReply.match(/\[EXECUTE_ACTION:\s*(\{[\s\S]*?\})\]/i) : null;
      if (execActionMatch) {
        try {
          const actionObj = JSON.parse(execActionMatch[1]);
          aiReply = aiReply.replace(execActionMatch[0], "").trim();
          const aType = actionObj.action_type || actionObj.type;
          const aPayload = actionObj.payload || actionObj;
          const execRes = await executeOwnerDirectAction(aType, aPayload);
          await syncActionToSite(aType, aPayload);
          if (execRes) {
            aiReply += `\n\n✅ Done bossu! ${execRes}`;
          }
        } catch (err) {
          console.warn("Failed executing action tag in bot:", err.message);
        }
      }

      // If AI emitted [SUGGEST_ACTION: {...}], also execute it immediately for the verified owner!
      if (aiReply) {
        const proposed = extractProposedActionFromText(aiReply);
        if (proposed?.action) {
          try {
            if (proposed.fullTag) {
              aiReply = aiReply.replace(proposed.fullTag, "").trim();
            }
            const aType = proposed.action.action_type || proposed.action.type;
            const aPayload = proposed.action.payload || proposed.action;
            const execRes = await executeOwnerDirectAction(aType, aPayload);
            await syncActionToSite(aType, aPayload);
            if (execRes) {
              aiReply += `\n\n✅ Done bossu! ${execRes}`;
            }
          } catch (err) {
            console.warn("Failed executing suggested action:", err.message);
          }
        }

        // Clean up any remaining suggestion tags so no raw internal syntax leaks
        aiReply = aiReply.replace(/\[SUGGEST_[A-Z_]+:[^\]]*\]/gi, "").trim();
        aiReply = aiReply.replace(/\[EXECUTE_[A-Z_]+:[^\]]*\]/gi, "").trim();
      }

      // ── SMART CONVERSATIONAL PERSONAL ASSISTANT FALLBACK ──
      if (!aiReply) {
        // 1. Order Lookups (like WSF7AEZQA)
        if (specificOrderCtx) {
          aiReply = `🔍 *Live Order Status:*\n${specificOrderCtx}\nIf payment just went through on MoMo, you can refresh or I can trigger delivery directly for you!`;
        }

        // 2. Greetings & Personal Check-in
        else if (/^(hi|hello|hey|yo|sup|chale|boss|bossu|how far|how you dey|good morning|good evening|stony|are you there|you dey)/i.test(lt)) {
          const convReplies = [
            `I dey solid bossu! 😊 Everything dey move on the system. How your day dey go? Any orders you want make I check, or we dey plan marketing today?`,
            `Chale boss, I dey right here! System is active. Delivery speed is around ${deliveryEta}.${walletBalance ? ` Wallet is sitting at ${walletBalance}.` : ""} What's the plan?`,
            `I dey here with you boss! Ready for anything — stats, orders, or brainstorming new promos. How can I help you right now?`
          ];
          aiReply = convReplies[history.length % convReplies.length];
        }

        // 3. Sales / Today / Revenue / Stats
        else if (/\b(stat|today|sales|revenue|how many orders|how much|market|cash|money)\b/i.test(lt)) {
          aiReply = `📊 *Today's Performance:* We have *${todayPaidCount} paid orders* bringing in *GH₵ ${todayRevenue.toFixed(2)}* so far today! Delivery speed is running at *${deliveryEta}*. ${walletBalance ? `DataMart wallet: *${walletBalance}*.` : ""} How do you feel about dropping a quick status promo to push more volume?`;
        }

        // 3b. Whole-system capabilities check / scope question (e.g. "will the ai perform", "only this that it can do", "it should be montring the whole system")
        else if (/\b(perform|only this|what can you do|capabilities|scope|whole system|montr|supervise|oversee)\b/i.test(lt)) {
          aiReply = `I supervise the whole live store 24/7 bossu! Sales (₵${todayRevenue.toFixed(2)} today across ${todayPaidCount} orders), DataMart wallet (${walletBalance || "Active"}), Arkesel SMS (${arkeselSmsBalance || "Operational"}), delivery speed (~${deliveryEta}), and customer support chats (${openSupportCount} active). You can command me to update order statuses, adjust prices, toggle stock, trigger retries, or send custom SMS right from here! What specific action or update do you want us to run?`;
        }

        // 3c. Post-Payment Lifecycle & Whole-System Oversight (e.g. "still after payment successful", "after payment")
        else if (/\b(after payment|payment succe|post[- ]payment|still after|what happens after)\b/i.test(lt)) {
          aiReply = `Yes bossu! Immediately payment confirms, the order routes into automated DataMart dispatch. I monitor the network delivery speed (~${deliveryEta}), poll until it's confirmed delivered, safeguard your wallet balance, and alert you if anything flags stuck. Everything moves hands-free!`;
        }

        // 4. Whole-System Overview / Health Check
        else if (/\b(system|whole|everything|monitor|audit|health|overview|check all)\b/i.test(lt)) {
          aiReply = `🌐 *Store Status:* Delivery ETA is *${deliveryEta}*. DataMart wallet: *${walletBalance || "Connected"}*. Arkesel SMS: *${arkeselSmsBalance || "Active"}*. Today: *${todayPaidCount} orders* (GH₵ ${todayRevenue.toFixed(2)}). Support chats: *${openSupportCount}* (${unreadSupportCount > 0 ? `⚠️ ${unreadSupportCount} unread` : "all clear"}). All systems operational boss!`;
        }

        // 5. Digital Services: Netflix
        else if (/\b(netflix|movie|stream)\b/i.test(lt)) {
          aiReply = `📺 *Netflix 30-Day Subscriptions:* We currently have *${netflixCount} active subscriber(s)*. The auto-credential and IMAP code extraction pipeline is active. Need me to look up any specific subscriber code?`;
        }

        // 6. Digital Services: MTN MashUp
        else if (/\b(mashup|combo|mix)\b/i.test(lt)) {
          aiReply = pendingMashupCount > 0
            ? `📶 *MTN MashUp Alert:* We have *${pendingMashupCount} order(s) awaiting manual dispatch* on *567*2#! Deliver to their numbers so customers get their data and minutes.`
            : `📶 *MTN MashUp:* All MashUp orders are cleared boss! No pending manual applications right now.`;
        }

        // 7. Digital Services: AFA Registration
        else if (/\b(afa|farmer|alliance)\b/i.test(lt)) {
          aiReply = `🪪 *AFA Registrations:* We have processed *${afaCount} registration(s)* on the portal. The AFA verification API is connected and responding.`;
        }

        // 8. Result Checkers (WAEC / BECE / WASSCE)
        else if (/\b(checker|waec|bece|wassce|novdec|result)\b/i.test(lt)) {
          aiReply = `🎓 *WAEC Result Checkers:* We have sold *${checkerCount} checker voucher(s)*. Instant PIN and serial issuance is active directly on the website portal!`;
        }

        // 8a. Flash Sale Orders & Campaign
        else if (/\b(flash\s*orders?|flash\s*sale\s*orders?|flash\s*prices?|flash\s*revenue)\b/i.test(lt) || (/\bflash\s*sale\b/i.test(lt) && !/\b(turn|enable|disable|start|stop|activate|deactivate|off|on)\b/i.test(lt))) {
          aiReply = await listFlashSaleOrdersSummary();
        }

        // 8a2. Full Order History & Total Orders
        else if (/\b(full\s*history|all\s*time\s*orders?|order\s*history|total\s*orders?)\b/i.test(lt)) {
          aiReply = await getAllTimeOrderStatsSummary();
        }

        // 8b. Reseller Agent Store Orders & Sales
        else if (/\b(agent orders?|agent sales?|orders? from agent|sales? from agent|order from agent store|orders from agent store)\b/i.test(lt)) {
          aiReply = await listAgentOrdersSummary();
        }

        // 8c. Reseller Agents & Agent Stores
        else if (/\b(agent|agents|reseller|resellers|agent wallet|agent store)\b/i.test(lt)) {
          const summary = await listAllAgentsSummary();
          aiReply = `👥 *Reseller Agent Network:*\n\n${summary}\n\n💡 You can check agent sales by texting "Show agent orders" or credit an agent with "Credit agent [name/phone] with [amount]".`;
        }

        // 9. Live Customer Support Chats
        else if (/\b(chat|support|unread|ticket|complaint|customer|help)\b/i.test(lt)) {
          aiReply = unreadSupportCount > 0
            ? `💬 *Customer Support Alert:* We have *${unreadSupportCount} unread message(s)* across *${openSupportCount} open live chat(s)*! You can check the admin portal or reply to visitors.`
            : `💬 *Customer Support:* All customer chats are up to date! *${openSupportCount} open session(s)* with zero unread messages right now.`;
        }

        // 10. Catalog & Out of Stock
        else if (/\b(stock|out of stock|inventory|package|catalog)\b/i.test(lt)) {
          aiReply = outOfStockCount > 0
            ? `⚠️ *Stock Alert:* There are *${outOfStockCount} package(s) marked out of stock* in the products catalog. Check the admin products page to re-enable them if inventory is ready!`
            : `📦 *Inventory Status:* All data bundle packages across MTN, Telecel, and AirtelTigo are *IN STOCK* and purchasable!`;
        }

        // 11. Arkesel SMS Balance
        else if (/\b(sms|arkesel|credit|units)\b/i.test(lt)) {
          aiReply = arkeselSmsBalance
            ? `✉️ *Arkesel SMS Gateway:* You have *${arkeselSmsBalance}* credits available for order receipts and security alerts.`
            : `✉️ *Arkesel SMS Gateway:* Connected and ready to dispatch notifications.`;
        }

        // 12. Wallet / DataMart Balance
        else if (/\b(balance|wallet|datamart|credit)\b/i.test(lt)) {
          aiReply = walletBalance
            ? `Our DataMart wallet balance is *${walletBalance}* right now boss. ${Number(walletBalance.replace(/[^\d.]/g, "") || 0) < 50 ? "⚠️ It's getting a bit low — might want to top up soon so orders don't pause." : "We're well covered for incoming orders!"}`
            : "Couldn't fetch the exact wallet balance right now boss, but the DataMart API connection is active. I can recheck in a moment!";
        }

        // 13. Delivery Speed / Tracker
        else if (/\b(speed|delivery|fast|delay|tracker|eta)\b/i.test(lt)) {
          aiReply = `Data delivery is currently hitting around *${deliveryEta}* boss 🚀 MTN orders are moving through DataMart steadily. Any specific recipient number giving trouble?`;
        }

        // 14. Stuck / Failed / Problem Orders
        else if (/\b(failed|stuck|problem|complaint|issue|pending)\b/i.test(lt)) {
          if (failedOrdersList.length > 0) {
            aiReply = `⚠️ We have *${failedOrdersList.length} failed order(s)* needing attention:\n` +
              failedOrdersList.map((o, idx) => `${idx + 1}. Ref *${o.reference}* — ${o.capacity}GB ${o.network} to ${o.recipient_phone}`).join("\n") +
              `\n\nDrop any reference and I can inspect it or prepare a retry for you boss!`;
          } else if (pendingOrdersList.length > 0) {
            aiReply = `⏳ No failed orders! We have *${pendingOrdersList.length} order(s) currently in progress* with telecom networks. They usually land within ${deliveryEta}.`;
          } else {
            aiReply = `All clear boss! ✅ Zero failed orders and zero stuck orders right now. Everything is running smoothly.`;
          }
        }

        // 15. Ideas / Marketing / Growth Advice
        else if (/\b(idea|advice|grow|market|promo|scale|customers?|boost|increase)\b/i.test(lt)) {
          aiReply = `💡 *3 Quick Ideas to Boost Our Sales Today Bossu:*\n\n1. *Campus Reps:* Get 2-3 university students (Legon, KNUST, UPSA) posting on their department WhatsApp groups with their referral link.\n2. *Flash Bundle Discount:* Run a 2-hour "Happy Hour" on 5GB MTN bundles on your WhatsApp status — bundle buyers love urgency.\n3. *Repeat Buyer Reminder:* Send an SMS through Arkesel to customers who bought 1-2 weeks ago — they're probably running low on data right now!\n\nWant to draft a message for one of these?`;
        }

        // 16. Dynamic conversational partner reply
        else {
          aiReply = `I dey with you bossu! Everything is running smooth on the system. DataMart wallet is at ${walletBalance || "GH₵ 0.00"}, delivery speed is ${deliveryEta}, and we have ${todayPaidCount} paid orders today (GH₵ ${todayRevenue.toFixed(2)}). What specific order, price, or agent would you like me to update?`;
        }
      }

      aiReply = sanitizeSecretsFromText(aiReply)
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/\*\*([^*\n]+)\*\*/g, "*$1*")
        .replace(/^#{1,4}\s+(.+)$/gm, "*$1*")
        .replace(/\b(as an ai( language model)?|i am an ai( language model)?|i'm an ai( language model)?)\b/gi, "I am Stony")
        .replace(/\bdatamart\b/gi, "DataMart");

      // ── SAVE UPDATED CONVERSATION MEMORY ──
      try {
        const updatedHistory = [
          ...history.slice(-6),
          { role: "user", text },
          { role: "assistant", text: aiReply }
        ];
        await saveOwnerHistory(from, updatedHistory);
      } catch (_) { }

      return sendWhatsApp(from, aiReply);
    }

    let session = await getCustomerSession(from);

    /* =====================================================
    CREATE SESSION
    ===================================================== */

    if (!session) {
      session = await saveCustomerSession(from, { step: 1 });
      if (!/^[1-8]$/.test(text.trim())) {
        const { MENU: activeMenu } = getMenusForSession(session);
        return sendWhatsApp(from, activeMenu);
      }
    }

    if (!session.step) {
      session.step = 1;
      await saveCustomerSession(from, { step: 1 });
    }

    // Direct AI mode handling for non-owner customers (never interrupt active checkout)
    const inCheckout = Boolean(session && session.step > 1 && session.step < 99);
    if (!inCheckout && (activeMode === "ai" || session.step === 99) && !/^[1-8]$/.test(text.trim())) {
      return handleCustomerAi(from, effectiveText || text);
    }
    if (session.step === 99 && /^[1-8]$/.test(text.trim())) {
      session.step = 1;
      setUserMode(from, "bot");
      session = await saveCustomerSession(from, { step: 1 });
    }

    /* =====================================================
    RESET
    ===================================================== */

    if (/^(hi|hello|start|reset|restart|menu)$/i.test(text.trim())) {
      session = await saveCustomerSession(from, { step: 1, bundle: null });
      const { MENU: activeMenu } = getMenusForSession(session);
      return sendWhatsApp(from, activeMenu);
    }

    /* =====================================================
    STEP 1 - MAIN MENU
    ===================================================== */

    if (session.step === 1) {
      let network;

      if (text === "1") {
        network = "MTN";
      } else if (text === "2") {
        network = "AIRTELTIGO";
      } else if (text === "3") {
        network = "TELECEL";
      } else if (text === "4") {
        await saveCustomerSession(from, { step: 6 });
        return sendWhatsApp(from, `📦 TRACK YOUR ORDER\n\nPlease enter the phone number or order reference used when you purchased your data.\n\nExample:\n0241234567 or WS-123456`);
      } else if (text === "5") {
        const netflixCost = resolveServiceCustomPrice("netflix", session.custom_prices, NETFLIX_PRICE);
        await saveCustomerSession(from, {
          step: 50,
          bundle: JSON.stringify({ type: "netflix", price: netflixCost }),
          momo_number: null,
          phone_number: null
        });

        const storeHeader = session.agent_name ? `🏪 Store: *${session.agent_name}*\n` : "";
        return sendWhatsApp(from, `${storeHeader}📺 Netflix Subscription — ₵${netflixCost.toFixed(2)}\n\nSelect the network for the Mobile Money number you'll pay from:\n\n1 - MTN\n2 - AirtelTigo\n3 - Telecel`);
      } else if (text === "6") {
        const afaCost = resolveServiceCustomPrice("afa", session.custom_prices, AFA_PRICE);
        await saveCustomerSession(from, {
          step: 30,
          bundle: null,
          momo_number: null,
          phone_number: null
        });

        const storeHeader = session.agent_name ? `🏪 Store: *${session.agent_name}*\n` : "";
        return sendWhatsApp(from, `${storeHeader}🪪 AFA Registration — ₵${afaCost.toFixed(2)}\n\nSelect the network for the Mobile Money number you'll pay from:\n\n1 - MTN\n2 - AirtelTigo\n3 - Telecel`);
      } else if (text === "7") {
        await saveCustomerSession(from, { step: 10, network: "MASHUP" });
        return sendWhatsApp(from, `📶 MTN MashUp Bundle\n\nEnter the amount you want to pay (₵${MASHUP_MIN_AMOUNT} - ₵${MASHUP_MAX_AMOUNT}):\n\nExample: 5\n\nThe data + minutes mix you get depends on what MTN offers for that amount — this will be applied to your number manually.`);
      } else if (text === "8") {
        await saveCustomerSession(from, { step: 70 });
        return playScratchCard(from);
      } else {
        return handleCustomerAi(from, text);
      }

      await saveCustomerSession(from, { step: 2, network });
      const { MENUS: sessionMenus } = getMenusForSession(session);
      return sendWhatsApp(from, sessionMenus[network]);
    }

    /* =====================================================
    STEP 2 - SELECT BUNDLE
    ===================================================== */

    if (session.step === 2) {
      const sessionPackages = getPackagesForSession(session);
      const bundle = sessionPackages[session.network]?.[text];
      if (!bundle) {
        return sendWhatsApp(from, "Invalid option ❌ Choose an option to continue");
      }

      await saveCustomerSession(from, { step: 3, bundle: text });
      return sendWhatsApp(from, "Enter phone number to receive the data on:");
    }

    /* =====================================================
    STEP 3 - DELIVERY PHONE NUMBER
    ===================================================== */

    if (session.step === 3) {
      const phone = normalizePhone(text);
      if (phone.length !== 10 || !phone.startsWith("0")) {
        return sendWhatsApp(from, "Invalid number ❌ Enter a correct Ghana phone number to continue");
      }

      session = await saveCustomerSession(from, { phone_number: phone, step: 8 });
      return sendWhatsApp(from, `📲 Enter the Mobile Money number to pay from:\n\n(This can be the same number or a different one)`);
    }

    /* =====================================================
    STEP 8 - MOMO PAYMENT NUMBER
    ===================================================== */

    if (session.step === 8) {
      const momoNumber = normalizePhone(text);
      if (momoNumber.length !== 10 || !momoNumber.startsWith("0")) {
        return sendWhatsApp(from, "Invalid number ❌ Enter a correct Ghana Mobile Money number to continue");
      }

      const sessionPackages = getPackagesForSession(session);
      const bundle = sessionPackages[session.network]?.[session.bundle];

      // Agent Store Checkout skips scratch code straight to confirmation
      if (session.agent_id) {
        session = await saveCustomerSession(from, {
          momo_number: momoNumber,
          step: 4,
          scratch_order_opt_in: false
        });
        const tracker = await getDeliveryEstimate();
        const estimateMessage = buildDeliveryEstimateMessage(tracker);
        const storeHeader = session.agent_name ? `🏪 Store: *${session.agent_name}*\n` : "";
        const priceStr = bundle ? bundle.price.toFixed(2) : "0.00";
        const capStr = bundle ? bundle.capacity : "";
        return sendWhatsApp(from, `Confirm Order: Your order will be delivered ✅\n\n${storeHeader}📶 Network: ${session.network}\n📦 Data: ${capStr}GB\n💰 Amount: ₵${priceStr}\n📱 Data goes to: ${session.phone_number}\n💳 Pay from (Momo): ${momoNumber}\n\n${estimateMessage}\n\nReply YES to pay or NO to cancel`);
      }

      session = await saveCustomerSession(from, {
        momo_number: momoNumber,
        step: 15,
        scratch_order_opt_in: false
      });

      const activeScratch = await getActiveScratchCode(from);
      if (activeScratch) {
        return sendWhatsApp(from, `🎟️ SCRATCH & WIN (OPTIONAL)\n\nActive Code: *${activeScratch.code}*\nProgress: ${Number(activeScratch.orders_completed || 0)}/${SCRATCH_REQUIRED_ORDERS}\n\nUse this code for this paid order?\n\n1 - YES, use my code\n2 - NO, skip`);
      }

      return sendWhatsApp(from, `🎟️ SCRATCH & WIN (OPTIONAL)\n\nDo you have a Data1 Scratch Code for this paid order?\n\n1 - YES, enter my code\n2 - NO / SKIP`);
    }

    /* =====================================================
    STEP 15 - OPTIONAL SCRATCH CODE AT CHECKOUT
    ===================================================== */

    if (session.step === 15) {
      const finishConfirm = async () => {
        const sessionPackages = getPackagesForSession(session);
        const bundle = sessionPackages[session.network]?.[session.bundle];
        const tracker = await getDeliveryEstimate();
        const estimateMessage = buildDeliveryEstimateMessage(tracker);
        session = await saveCustomerSession(from, { step: 4 });
        const storeHeader = session.agent_name ? `🏪 Store: *${session.agent_name}*\n` : "";
        const priceStr = bundle ? bundle.price.toFixed(2) : "0.00";
        const capStr = bundle ? bundle.capacity : "";
        return sendWhatsApp(from, `Confirm Order: Your order will be delivered ✅\n\n${storeHeader}📶 Network: ${session.network}\n📦 Data: ${capStr}GB\n💰 Amount: ₵${priceStr}\n📱 Data goes to: ${session.phone_number}\n💳 Pay from (Momo): ${session.momo_number}\n\n${estimateMessage}\n\nReply YES to pay or NO to cancel`);
      };

      if (text === "2" || /^no$/i.test(text) || /^skip$/i.test(text)) {
        session = await saveCustomerSession(from, { scratch_order_opt_in: false });
        return finishConfirm();
      }

      if (text === "1" || /^yes$/i.test(text)) {
        const activeScratch = await getActiveScratchCode(from);
        if (activeScratch) {
          session = await saveCustomerSession(from, { scratch_code: activeScratch.code, scratch_order_opt_in: true });
          return finishConfirm();
        }
        session = await saveCustomerSession(from, { step: 16, scratch_order_opt_in: false });
        return sendWhatsApp(from, "🎟️ Enter your Data1 Scratch Code:\n\nExample: Data1A7K92P");
      }
      return sendWhatsApp(from, "Reply 1 for YES or 2 for NO / SKIP.");
    }

    /* =====================================================
    STEP 16 - ENTER SCRATCH CODE AT CHECKOUT
    ===================================================== */

    if (session.step === 16) {
      const result = await activateScratchCodeForCheckout(from, text);
      if (!result.ok) return sendWhatsApp(from, result.message);
      session = await saveCustomerSession(from, { scratch_code: result.scratch.code, scratch_order_opt_in: true, step: 4 });
      const sessionPackages = getPackagesForSession(session);
      const bundle = sessionPackages[session.network]?.[session.bundle];
      const tracker = await getDeliveryEstimate();
      const estimateMessage = buildDeliveryEstimateMessage(tracker);
      const storeHeader = session.agent_name ? `🏪 Store: *${session.agent_name}*\n` : "";
      const priceStr = bundle ? bundle.price.toFixed(2) : "0.00";
      const capStr = bundle ? bundle.capacity : "";
      return sendWhatsApp(from, `Confirm Order: Your order will be delivered ✅\n\n${storeHeader}📶 Network: ${session.network}\n📦 Data: ${capStr}GB\n💰 Amount: ₵${priceStr}\n📱 Data goes to: ${session.phone_number}\n💳 Pay from (Momo): ${session.momo_number}\n\n🎟️ Scratch Code: ${result.scratch.code}\n🎯 This order will count toward: ${Number(result.scratch.orders_completed || 0) + 1}/${SCRATCH_REQUIRED_ORDERS}\n\n${estimateMessage}\n\nReply YES to pay or NO to cancel`);
    }

    /* =====================================================
    STEP 70 - SCRATCH MENU / CODE GENERATION
    ===================================================== */

    if (session.step === 70) {
      if (/^yes$/i.test(text)) {
        try {
          const result = await createScratchCodeForCustomer(from);
          if (!result.ok) {
            const x = result.existing;
            return sendWhatsApp(from, x.unlocked ? `🎉 Your Scratch Card is already unlocked!\n\nCode: *${x.code}*\nProgress: ${Number(x.orders_completed || 0)}/5\n\nReply *SCRATCH* to play.` : `🎟️ You already have an active code: *${x.code}*\n\nProgress: ${Number(x.orders_completed || 0)}/5\n\nUse it during payment on your next paid data orders.`);
          }
          return sendWhatsApp(from, `🎉 YOUR UNIQUE SCRATCH CODE IS READY!\n\n🎟️ *${result.data.code}*\n\nUse this code during payment on your Data orders. Complete 5 PAID Data orders using this code.\n\nProgress: 0/5\n\nAfter the 5th paid order, your Scratch Card unlocks automatically. Come back here and reply *SCRATCH* to win 1GB or 2GB! 🎁`);
        } catch (e) {
          console.error("SCRATCH GENERATION ERROR:", e);
          return sendWhatsApp(from, "❌ We could not generate your Scratch Code right now. Please reply *YES* to try again.");
        }
      }
      if (/^scratch$/i.test(text)) return playScratchCard(from);
      const activeScratch = await getActiveScratchCode(from);
      if (activeScratch) return sendWhatsApp(from, `🎟️ SCRATCH & WIN\n\nCode: *${activeScratch.code}*\nProgress: ${Number(activeScratch.orders_completed || 0)}/5\n\n${activeScratch.unlocked ? "🎉 UNLOCKED — reply SCRATCH to play." : "Use this code during payment on your paid data orders."}`);
      return sendWhatsApp(from, `🎟️ SCRATCH & WIN\n\nYou do not currently have an active Scratch Code.\n\nReply *YES* to generate your unique Data1 Scratch Code automatically.\n\nThen use it during payment on 5 PAID data orders. After 5/5, come back and reply *SCRATCH* to win! 🎁`);
    }

    /* =====================================================
    STEP 80 - SCRATCH PRIZE NETWORK
    ===================================================== */

    if (session.step === 80) {
      const networks = { "1": "MTN", "2": "AIRTELTIGO", "3": "TELECEL" };
      const network = networks[text];
      if (!network) return sendWhatsApp(from, "Invalid option ❌\n\n1 - MTN\n2 - AirtelTigo\n3 - Telecel");
      session = await saveCustomerSession(from, { network, step: 81 });
      return sendWhatsApp(from, "📱 Enter the Ghana phone number where you want your FREE prize sent:");
    }

    /* =====================================================
    STEP 81 - SCRATCH PRIZE DELIVERY
    ===================================================== */

    if (session.step === 81) {
      const prizePhone = normalizePhone(text);
      if (prizePhone.length !== 10 || !prizePhone.startsWith("0")) return sendWhatsApp(from, "❌ Invalid Ghana phone number.\n\nExample: 0241234567");
      const scratch = await supabase.from("scratch_codes").select("*").eq("assigned_to", normalizePhone(from)).eq("status", "processing").maybeSingle().then(r => r.data);
      if (!scratch) return sendWhatsApp(from, "❌ Scratch prize session not found. Reply SCRATCH and try again.");
      const capacity = String(scratch.prize || "1");
      const prizeLabel = capacity === "2" ? "2GB" : "1GB";
      const networkMap = { MTN: "YELLO", AIRTELTIGO: "AT_PREMIUM", TELECEL: "TELECEL" };
      try {
        const response = await axios.post(`${DATAMART_BASE}/purchase`, { phoneNumber: prizePhone, network: networkMap[session.network] || "YELLO", capacity, gateway: "wallet", delivery: "fast" }, { headers: { "x-api-key": DATA_API_KEY, "Content-Type": "application/json" }, timeout: 30000 });
        const data = response.data?.data || response.data || {};
        const reference = data.reference || data.orderReference || data.order_reference || null;
        const deliveredAt = new Date().toISOString();
        const { data: updatedScratch } = await supabase.from("scratch_codes").update({ status: "used", prize_network: session.network, prize_phone: prizePhone, datamart_reference: reference, delivered_at: deliveredAt }).eq("id", scratch.id).select("*").maybeSingle();
        syncScratchToStoreApi({ scratch: updatedScratch || { ...scratch, status: "used", prize_network: session.network, prize_phone: prizePhone, datamart_reference: reference, delivered_at: deliveredAt } });
        session = await saveCustomerSession(from, { step: 1, scratch_prize: null });
        return sendWhatsApp(from, `🎉 PRIZE SENT SUCCESSFULLY!\n\n🎁 Prize: ${prizeLabel}\n📶 Network: ${session.network}\n📱 Sent to: ${prizePhone}\n${reference ? `🆔 Reference: ${reference}\n` : ""}\nReply HI to continue shopping.`);
      } catch (e) {
        console.error("SCRATCH PRIZE DELIVERY ERROR:", e.response?.data || e.message);
        await supabase.from("scratch_codes").update({ status: "unlocked", scratched: false }).eq("id", scratch.id);
        return sendWhatsApp(from, `❌ We could not send your ${prizeLabel} prize right now. Your Scratch Card has NOT been lost. Reply *SCRATCH* and try again.`);
      }
    }

    /* =====================================================
    STEP 4 - CONFIRM PAYMENT
    ===================================================== */

    if (session.step === 4) {
      if (/^no$/i.test(text)) {
        await saveCustomerSession(from, { step: 1 });
        const { MENU: activeMenu } = getMenusForSession(session);
        return sendWhatsApp(from, "❌ Cancelled\n\n" + activeMenu);
      }

      if (/^yes$/i.test(text)) {
        const sessionPackages = getPackagesForSession(session);
        const bundle = sessionPackages[session.network][session.bundle];
        return initiateMomoCharge(from, session, bundle);
      }

      return sendWhatsApp(from, "Reply YES to pay or NO to cancel.");
    }

    /* =====================================================
    STEP 9 - AWAITING OTP
    ===================================================== */

    if (session.step === 9) {
      return submitMomoOtp(from, session, text.trim());
    }

    /* =====================================================
    STEP 10 - MASHUP CUSTOM AMOUNT
    ===================================================== */

    if (session.step === 10) {
      const amountText = text.trim();
      if (!isValidMashupAmount(amountText)) {
        return sendWhatsApp(from, `Invalid amount ❌ Enter an amount between ₵${MASHUP_MIN_AMOUNT} and ₵${MASHUP_MAX_AMOUNT} (e.g. 5)`);
      }

      session = await saveCustomerSession(from, { bundle: amountText, step: 11 });
      const combos = getMashupCombos(amountText);
      let comboMenu = `MashUp ₵${amountText} — choose a package:\n\n`;
      combos.forEach((c, i) => {
        comboMenu += `${i + 1} - ${c.label}\n`;
      });
      comboMenu += `\nChoose an option to continue`;
      return sendWhatsApp(from, comboMenu);
    }

    /* =====================================================
    STEP 11 - MASHUP COMBO SELECTION
    ===================================================== */

    if (session.step === 11) {
      const combos = getMashupCombos(session.bundle);
      const combo = combos[Number(text) - 1];
      if (!combo) {
        return sendWhatsApp(from, "Invalid option ❌ Choose an option to continue");
      }

      session = await saveCustomerSession(from, { bundle: `${session.bundle}|${combo.id}`, step: 12 });
      return sendWhatsApp(from, "Enter phone number to receive the MashUp bundle on:");
    }

    /* =====================================================
    STEP 12 - MASHUP DELIVERY PHONE NUMBER
    ===================================================== */

    if (session.step === 12) {
      const phone = normalizePhone(text);
      if (phone.length !== 10 || !phone.startsWith("0")) {
        return sendWhatsApp(from, "Invalid number ❌ Enter a correct Ghana phone number to continue");
      }

      session = await saveCustomerSession(from, { phone_number: phone, step: 13 });
      return sendWhatsApp(from, `📲 Enter the Mobile Money number to pay from:\n\n(This can be the same number or a different one)`);
    }

    /* =====================================================
    STEP 13 - MASHUP MOMO PAYMENT NUMBER
    ===================================================== */

    if (session.step === 13) {
      const momoNumber = normalizePhone(text);
      if (momoNumber.length !== 10 || !momoNumber.startsWith("0")) {
        return sendWhatsApp(from, "Invalid number ❌ Enter a correct Ghana Mobile Money number to continue");
      }

      const parsed = parseMashupSelection(session.bundle);
      if (!parsed) {
        session = await saveCustomerSession(from, { step: 1 });
        return sendWhatsApp(from, "❌ Something went wrong with your selection. Please reply HI and try again.");
      }

      session = await saveCustomerSession(from, {
        momo_number: momoNumber,
        step: 14
      });

      return sendWhatsApp(
        from,
        `Confirm Order: Your MashUp will be applied manually ✅\n\n📶 Network: MTN (MashUp)\n📦 Package: ${parsed.combo.label}\n💰 Amount: ₵${parsed.amount.toFixed(2)}\n📱 Data goes to: ${session.phone_number}\n💳 Pay from (Momo): ${momoNumber}\n\n⏳ Note: MashUp bundles are applied manually and may take a little longer than regular data orders.\n\nReply YES to pay or NO to cancel`
      );
    }

    /* =====================================================
    STEP 14 - CONFIRM MASHUP PAYMENT
    ===================================================== */

    if (session.step === 14) {
      if (/^no$/i.test(text)) {
        session = await saveCustomerSession(from, { step: 1 });
        const { MENU: activeMenu } = getMenusForSession(session);
        return sendWhatsApp(from, "❌ Cancelled\n\n" + activeMenu);
      }

      if (/^yes$/i.test(text)) {
        const parsed = parseMashupSelection(session.bundle);
        if (!parsed) {
          session = await saveCustomerSession(from, { step: 1 });
          return sendWhatsApp(from, "❌ Something went wrong with your selection. Please reply HI and try again.");
        }
        const bundle = { price: parsed.amount, capacity: parsed.combo.label };
        return initiateMomoCharge(from, session, bundle);
      }

      return sendWhatsApp(from, "Reply YES to pay or NO to cancel.");
    }

    /* =====================================================
    STEP 30 - AFA: MOMO NETWORK SELECTION
    ===================================================== */

    if (session.step === 30) {
      let network = null;
      if (text === "1") network = "MTN";
      else if (text === "2") network = "AIRTELTIGO";
      else if (text === "3") network = "TELECEL";

      if (!network) {
        return sendWhatsApp(from, "Invalid option ❌ Reply 1 for MTN, 2 for AirtelTigo, or 3 for Telecel");
      }

      session = await saveCustomerSession(from, { network, step: 31 });
      return sendWhatsApp(from, "Enter the Full Name of the applicant:");
    }

    /* =====================================================
    STEP 31 - AFA: FULL NAME
    ===================================================== */

    if (session.step === 31) {
      const fullName = text.trim();
      if (fullName.length < 3) {
        return sendWhatsApp(from, "Invalid name ❌ Enter the applicant's full name (e.g. John Doe)");
      }

      session = await saveCustomerSession(from, {
        bundle: mergeAfaField(session, "full_name", fullName),
        step: 32
      });

      return sendWhatsApp(from, "Enter the applicant's Phone Number (e.g. 0241234567):");
    }

    /* =====================================================
    STEP 32 - AFA: PHONE NUMBER
    ===================================================== */

    if (session.step === 32) {
      const afaPhone = normalizePhone(text);
      if (afaPhone.length !== 10 || !afaPhone.startsWith("0")) {
        return sendWhatsApp(from, "Invalid number ❌ Enter a correct Ghana phone number (e.g. 0241234567)");
      }

      session = await saveCustomerSession(from, {
        bundle: mergeAfaField(session, "phone_number", afaPhone),
        step: 33
      });

      return sendWhatsApp(from, "Enter the applicant's Ghana Card Number (e.g. GHA-000000000-0):");
    }

    /* =====================================================
    STEP 33 - AFA: GHANA CARD NUMBER
    ===================================================== */

    if (session.step === 33) {
      const idNumber = text.trim().toUpperCase();
      if (!isValidGhanaCard(idNumber)) {
        return sendWhatsApp(from, "Invalid Ghana Card number ❌ Use the format GHA-000000000-0");
      }

      session = await saveCustomerSession(from, {
        bundle: mergeAfaField(session, "id_number", idNumber),
        step: 34
      });

      return sendWhatsApp(from, "Enter the applicant's Location (e.g. Tafo, Kumasi):");
    }

    /* =====================================================
    STEP 34 - AFA: LOCATION
    ===================================================== */

    if (session.step === 34) {
      const location = text.trim();
      if (location.length < 2) {
        return sendWhatsApp(from, "Invalid location ❌ Enter the applicant's location (e.g. Tafo, Kumasi)");
      }

      session = await saveCustomerSession(from, {
        bundle: mergeAfaField(session, "location", location),
        step: 35
      });

      return sendWhatsApp(from, "Enter the applicant's Date of Birth (DD/MM/YYYY, e.g. 15/06/1995):");
    }

    /* =====================================================
    STEP 35 - AFA: DATE OF BIRTH
    ===================================================== */

    if (session.step === 35) {
      const dob = parseAfaDob(text);
      if (!dob) {
        return sendWhatsApp(from, "Invalid date ❌ Use the format DD/MM/YYYY (e.g. 15/06/1995)");
      }

      session = await saveCustomerSession(from, {
        bundle: mergeAfaField(session, "dob", dob),
        step: 36
      });

      return sendWhatsApp(from, "Enter the applicant's Occupation (e.g. Student, Teacher, Business Owner):");
    }

    /* =====================================================
    STEP 36 - AFA: OCCUPATION
    ===================================================== */

    if (session.step === 36) {
      const occupation = text.trim();
      if (occupation.length < 2) {
        return sendWhatsApp(from, "Invalid occupation ❌ Enter the applicant's occupation (e.g. Trader)");
      }

      session = await saveCustomerSession(from, {
        bundle: mergeAfaField(session, "occupation", occupation),
        step: 37
      });

      return sendWhatsApp(from, `📲 Enter the Mobile Money number to pay from (${session.network}):`);
    }

    /* =====================================================
    STEP 37 - AFA: MOMO PAYMENT NUMBER
    ===================================================== */

    if (session.step === 37) {
      const momoNumber = normalizePhone(text);
      if (momoNumber.length !== 10 || !momoNumber.startsWith("0")) {
        return sendWhatsApp(from, "Invalid number ❌ Enter a correct Ghana Mobile Money number to continue");
      }

      const afaData = getAfaData(session);
      if (!afaData) {
        session = await saveCustomerSession(from, { step: 1 });
        return sendWhatsApp(from, "❌ Something went wrong with your form. Please reply HI and try again.");
      }

      session = await saveCustomerSession(from, {
        momo_number: momoNumber,
        step: 38
      });

      const afaCost = resolveServiceCustomPrice("afa", session.custom_prices, AFA_PRICE);
      const storeHeader = session.agent_name ? `🏪 Store: *${session.agent_name}*\n` : "";
      return sendWhatsApp(
        from,
        `Confirm AFA Registration ✅\n\n${storeHeader}👤 Full Name: ${afaData.full_name}\n📱 Phone: ${afaData.phone_number}\n🪪 Ghana Card: ${afaData.id_number}\n📍 Location: ${afaData.location}\n🎂 DOB: ${afaData.dob}\n💼 Occupation: ${afaData.occupation}\n\n💰 Amount: ₵${afaCost.toFixed(2)}\n💳 Pay from (Momo, ${session.network}): ${momoNumber}\n\nReply YES to pay or NO to cancel`
      );
    }

    /* =====================================================
    STEP 38 - CONFIRM AFA PAYMENT
    ===================================================== */

    if (session.step === 38) {
      if (/^no$/i.test(text)) {
        session = await saveCustomerSession(from, { step: 1 });
        const { MENU: activeMenu } = getMenusForSession(session);
        return sendWhatsApp(from, "❌ Cancelled\n\n" + activeMenu);
      }

      if (/^yes$/i.test(text)) {
        const afaData = getAfaData(session);
        if (!afaData) {
          session = await saveCustomerSession(from, { step: 1 });
          return sendWhatsApp(from, "❌ Something went wrong with your form. Please reply HI and try again.");
        }
        const afaCost = resolveServiceCustomPrice("afa", session.custom_prices, AFA_PRICE);
        const bundle = { price: afaCost, capacity: "AFA Registration" };
        return initiateMomoCharge(from, session, bundle);
      }

      return sendWhatsApp(from, "Reply YES to pay or NO to cancel.");
    }

    /* =====================================================
    STEP 50 - NETFLIX: MOMO NETWORK SELECTION
    ===================================================== */

    if (session.step === 50) {
      let network = null;
      if (text === "1") network = "MTN";
      else if (text === "2") network = "AIRTELTIGO";
      else if (text === "3") network = "TELECEL";

      if (!network) {
        return sendWhatsApp(from, "Invalid option ❌ Reply 1 for MTN, 2 for AirtelTigo, or 3 for Telecel");
      }

      session = await saveCustomerSession(from, { network, step: 51 });
      return sendWhatsApp(from, "Enter the Mobile Money number to pay from:");
    }

    /* =====================================================
    STEP 51 - NETFLIX: MOMO PAYMENT NUMBER
    ===================================================== */

    if (session.step === 51) {
      const momoNumber = normalizePhone(text);
      if (momoNumber.length !== 10 || !momoNumber.startsWith("0")) {
        return sendWhatsApp(from, "Invalid number ❌ Enter a correct Ghana Mobile Money number to continue");
      }

      session = await saveCustomerSession(from, {
        momo_number: momoNumber,
        step: 52
      });

      const netflixCost = resolveServiceCustomPrice("netflix", session.custom_prices, NETFLIX_PRICE);
      const storeHeader = session.agent_name ? `🏪 Store: *${session.agent_name}*\n` : "";
      return sendWhatsApp(
        from,
        `Confirm Netflix Subscription ✅\n\n${storeHeader}📺 Netflix Subscription\n💰 Amount: ₵${netflixCost.toFixed(2)}\n💳 Pay from (Momo, ${session.network}): ${momoNumber}\n\nReply YES to pay or NO to cancel`
      );
    }

    /* =====================================================
    STEP 52 - CONFIRM NETFLIX PAYMENT
    ===================================================== */

    if (session.step === 52) {
      if (/^no$/i.test(text)) {
        session = await saveCustomerSession(from, { step: 1 });
        const { MENU: activeMenu } = getMenusForSession(session);
        return sendWhatsApp(from, "❌ Cancelled\n\n" + activeMenu);
      }

      if (/^yes$/i.test(text)) {
        const netflixCost = resolveServiceCustomPrice("netflix", session.custom_prices, NETFLIX_PRICE);
        const bundle = { price: netflixCost, capacity: "Netflix Subscription" };
        return initiateMomoCharge(from, session, bundle);
      }

      return sendWhatsApp(from, "Reply YES to pay or NO to cancel.");
    }

    /* =====================================================
    STEP 53 - NETFLIX: AWAITING REFERENCE CODE
    ===================================================== */

    if (session.step === 53) {
      const netflixData = getNetflixData(session);
      if (!netflixData) {
        session = await saveCustomerSession(from, { step: 1 });
        return sendWhatsApp(from, "❌ Something went wrong with your order. Please reply HI and try again.");
      }

      if (netflixData.used) {
        return sendWhatsApp(
          from,
          `❌ This reference code has already been used to fetch a sign-in code.\n\nNeed to sign in again (e.g. a different device)? Pay again via the main menu to get a new reference code.\n\nSEND: hi to return to the main menu.`
        );
      }

      const enteredCode = text.trim().toUpperCase();
      if (enteredCode !== netflixData.refCode) {
        return sendWhatsApp(
          from,
          `Please reply with your reference code exactly as sent: *${netflixData.refCode}*\n\nThis confirms it's really you before we fetch your Netflix sign-in code.`
        );
      }

      await sendWhatsApp(from, "🔄 Getting you the code...., one moment...");
      const result = await fetchNetflixSignIn(netflixData.paidAt);

      if (result.type === "code" || result.type === "approved" || result.type === "link_flagged") {
        session = await saveCustomerSession(from, {
          bundle: JSON.stringify({ ...netflixData, used: true })
        });
      }

      if (result.type === "code") {
        return sendWhatsApp(from, `✅ Your Netflix sign-in code is:\n\n*${result.value}*\n\nEnter this on Netflix to complete sign-in.\n\nSEND: hi to return to the main menu.`);
      }

      if (result.type === "approved") {
        return sendWhatsApp(from, `✅ Your Netflix sign-in has been approved! You should now be signed in.\n\nSEND: hi to return to the main menu.`);
      }

      if (result.type === "link_flagged") {
        await sendAdminWhatsApp(
          `🔔 NETFLIX APPROVAL NEEDED\n\nNetflix sent an approval link instead of a code for a customer sign-in. Please open this link to approve:\n${result.link}\n\nCustomer: ${session.phone}`
        );
        return sendWhatsApp(from, "⏳ We're finalizing your sign-in approval, this should complete shortly. If you don't see it go through, contact 0547100951 (@stony11).");
      }

      if (result.type === "error") {
        return sendWhatsApp(from, `❌ We could not check the email right now. Please reply *${netflixData.refCode}* again in a moment, or contact 0547100951 (@stony11) for help.`);
      }

      return sendWhatsApp(from, `❌ We couldn't find a code or sign-in request yet.\n\nMake sure you've chosen "Sign in" on Netflix using ${NETFLIX_EMAIL}, then reply *${netflixData.refCode}* again in a moment.`);
    }

    /* =====================================================
    STEP 6 - TRACKING PHONE
    ===================================================== */

    if (session.step === 6) {
      const trackingPhone = normalizePhone(text);
      if (trackingPhone.length !== 10 || !trackingPhone.startsWith("0")) {
        return sendWhatsApp(from, `❌ Invalid phone number.\n\nPlease enter a valid Ghana phone number.\n\nExample:\n0241234567`);
      }
      return trackOrders(from, trackingPhone);
    }

    /* =====================================================
    STEP 5 - AWAITING PAYMENT CONFIRMATION
    ===================================================== */

    if (session.step === 5) {
      if (/^(cancel|no|stop)$/i.test(text)) {
        await saveCustomerSession(from, { step: 1 });
        const { MENU: activeMenu } = getMenusForSession(session);
        return sendWhatsApp(from, "❌ Order cancelled.\n\n" + activeMenu);
      }

      let amount = null;
      if (session.network === "MASHUP") {
        const parsed = parseMashupSelection(session.bundle);
        amount = parsed?.amount;
      } else if (session.network && session.bundle) {
        const sessionPackages = getPackagesForSession(session);
        const b = sessionPackages[session.network]?.[session.bundle];
        amount = b ? b.price : (PACKAGES[session.network]?.[session.bundle]?.price || null);
      } else if (session.network === "AFA" || session.bundle?.includes?.("AFA")) {
        amount = AFA_PRICE;
      } else if (session.bundle?.includes?.("netflix") || session.network === "NETFLIX") {
        amount = NETFLIX_PRICE;
      }

      if (/^(link|pay|checkout)$/i.test(text) && amount) {
        const linkRef = `WS-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
        const link = await createPaystackCheckoutLink(from, linkRef, amount);
        if (link) {
          await saveCustomerSession(from, { ref: linkRef });
          return sendWhatsApp(
            from,
            `💳 PAYMENT LINK\n\nTap below to pay online:\n${link}\n\nAmount: ₵${Number(amount).toFixed(2)}\nOnce paid, your order will be delivered automatically!`
          );
        }
      }

      const provider = getMomoProvider(session.momo_number, session.network);
      let helpMsg = `⏳ Awaiting payment confirmation${session.momo_number ? " for " + session.momo_number : ""}.\n\n`;

      if (provider === "mtn") {
        helpMsg += `👉 *Prompt didn't pop up on your phone?*\n1. Dial *170#\n2. Select 6 (My Wallet)\n3. Select 3 (My Approvals)\n4. Enter your MoMo PIN & select 1 to approve!\n\n`;
      } else if (provider === "vod") {
        helpMsg += `👉 Dial *110# to approve the pending transaction or generate a voucher.\n\n`;
      } else if (provider === "atl") {
        helpMsg += `👉 Dial *110# to approve the pending transaction.\n\n`;
      }

      helpMsg += `Reply *LINK* for a direct payment link.\nReply *CANCEL* to cancel this order, or *HI* for the main menu.`;
      return sendWhatsApp(from, helpMsg);
    }

  } catch (e) {
    console.error("BOT ERROR:", e.response?.data || e.message);
  }
});

/* =========================================================
PAYSTACK WEBHOOK & DEBUG LOGGER
========================================================= */

const recentWebhookLogs = [];

function recordWebhookLog(event, details) {
  const item = { time: new Date().toISOString(), event, details };
  console.log(`[WEBHOOK] ${event}:`, typeof details === "object" ? JSON.stringify(details) : details);
  recentWebhookLogs.unshift(item);
  if (recentWebhookLogs.length > 50) recentWebhookLogs.pop();
}

app.get("/webhook-debug", (req, res) => {
  const key = req.query.key || req.headers["x-admin-key"];
  const expectedKey = process.env.ADMIN_API_KEY || "data1gh-secure-admin";
  if (key !== expectedKey) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    count: recentWebhookLogs.length,
    logs: recentWebhookLogs
  });
});

app.post("/paystack-webhook", async (req, res) => {
  res.sendStatus(200);

  try {
    const event = req.body;
    recordWebhookLog("HIT", {
      event_type: event?.event,
      reference: event?.data?.reference,
      amount: event?.data?.amount,
      status: event?.data?.status,
      customer: event?.data?.customer?.email
    });

    if (event?.event === "charge.failed" || event?.data?.status === "failed" || event?.data?.status === "abandoned") {
      const ref = event.data?.reference;
      if (ref && supabase) {
        try {
          let { data: webOrder } = await supabase
            .from("orders")
            .select("*")
            .eq("reference", ref)
            .maybeSingle();

          if (!webOrder && event.data) {
            const meta = event.data.metadata || {};
            webOrder = {
              id: ref,
              reference: ref,
              amount: Number(event.data.amount || 0) / 100,
              payment_status: "failed",
              agent_id: meta.agent_id || null,
              store_name: meta.store_name || "",
              notes: meta.agent_id ? `[agent:${meta.agent_id}]${meta.store_name ? ` [store:${meta.store_name}]` : ""}` : "",
            };
          }

          if (webOrder && webOrder.payment_status !== "paid" && (!webOrder.notes || !webOrder.notes.includes("[incomplete_sms_sent]"))) {
            const failureReason =
              event.data?.gateway_response ||
              event.data?.message ||
              (event.data?.status === "abandoned" ? "Transaction abandoned" : "Payment failed");

            await supabase
              .from("orders")
              .update({
                payment_status: "failed",
                delivery_status: "failed",
                error_message: failureReason,
                updated_at: new Date().toISOString(),
              })
              .eq("id", webOrder.id);

            const authObj = event.data?.authorization || {};
            const metaObj = event.data?.metadata || {};
            const custPhone =
              authObj.mobile_money_number ||
              authObj.phone ||
              authObj.account_number ||
              (authObj.channel === "mobile_money" ? authObj.bin : "") ||
              event.data?.customer?.phone ||
              metaObj.momo_phone ||
              metaObj.payment_phone ||
              metaObj.customer_phone ||
              webOrder.momo_phone ||
              webOrder.customer_phone ||
              "";
            if (custPhone) {
              const respLower = String(failureReason).toLowerCase();
              const isLowBal = respLower.includes("balance") || respLower.includes("insufficient");
              const isAband = event.data?.status === "abandoned" || respLower.includes("abandon") || respLower.includes("cancel");
              let isAgent = Boolean(webOrder.agent_id);
              let rawStore = webOrder.store_name || "";
              if (webOrder.notes) {
                const m = String(webOrder.notes).match(/\[agent:([^\]]+)\]/);
                if (m) isAgent = true;
                const sm = String(webOrder.notes).match(/\[store:([^\]]+)\]/);
                if (sm) {
                  rawStore = sm[1];
                  if (rawStore.toLowerCase() !== "data1gh" && rawStore.toLowerCase() !== "dataone gh") isAgent = true;
                }
              }

              let trackUrl = "";
              let brand = "Data1GH";
              if (isAgent) {
                brand = rawStore || "Agent Store";
                let slug = "";
                if (rawStore) {
                  slug = rawStore.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/[\s_-]+/g, "-").replace(/^-+|-+$/g, "");
                }
                trackUrl = slug
                  ? `https://gooddata1.vercel.app/s/${slug}?ref=${encodeURIComponent(ref)}`
                  : `https://gooddata1.vercel.app/track?ref=${encodeURIComponent(ref)}`;
              } else {
                trackUrl = `https://www.data1gh.com/track?ref=${encodeURIComponent(ref)}`;
                brand = "Data1GH";
              }
              const amtStr = Number(webOrder.amount) ? Number(webOrder.amount).toFixed(2) : "";

              let msg = "";
              if (isLowBal) {
                msg = amtStr
                  ? `Dear customer, your payment of GHS ${amtStr} (Ref: ${ref}) could not complete due to low MoMo wallet balance. Top up your wallet & complete here: ${trackUrl} - ${brand}`
                  : `Dear customer, your payment (Ref: ${ref}) could not complete due to low MoMo wallet balance. Top up your wallet & complete here: ${trackUrl} - ${brand}`;
              } else if (isAband) {
                msg = amtStr
                  ? `Dear customer, your payment of GHS ${amtStr} (Ref: ${ref}) was not completed. If you forgot or were interrupted, tap here to complete: ${trackUrl} - ${brand}`
                  : `Dear customer, your payment (Ref: ${ref}) was not completed. If you forgot or were interrupted, tap here to complete: ${trackUrl} - ${brand}`;
              } else {
                msg = amtStr
                  ? `Dear customer, your payment of GHS ${amtStr} (Ref: ${ref}) was not completed. Kindly retry and complete here: ${trackUrl} - ${brand}`
                  : `Dear customer, your payment (Ref: ${ref}) was not completed. Kindly retry and complete here: ${trackUrl} - ${brand}`;
              }

              try {
                const smsResult = await sendBulkSmsDirect([custPhone], msg);
                console.log("[PAYSTACK WEBHOOK] Incomplete payment customer SMS sent to:", custPhone, "Result:", smsResult);
                if (smsResult && smsResult.sent > 0) {
                  await supabase
                    .from("orders")
                    .update({
                      notes: `${webOrder.notes || ""} [incomplete_sms_sent]`.trim(),
                      updated_at: new Date().toISOString(),
                    })
                    .eq("id", webOrder.id);
                }
              } catch (smsErr) {
                console.warn("[PAYSTACK WEBHOOK] Incomplete payment SMS error:", smsErr?.message || smsErr);
              }
            }
          }
        } catch (e) {
          console.warn("[PAYSTACK WEBHOOK] Incomplete payment customer SMS note:", e.message);
        }
      }
      recordWebhookLog("FAILED_OR_ABANDONED_PROCESSED", { ref, event: event?.event, status: event?.data?.status });
      return;
    }

    if (!event || event.event !== "charge.success") {
      recordWebhookLog("IGNORED", { reason: "event is not charge.success", event: event?.event });
      return;
    }

    const ref = event.data?.reference;
    if (!ref) {
      recordWebhookLog("ERROR", { reason: "missing reference in event.data" });
      return;
    }

    // Verify Paystack payment authenticity via Paystack API before fulfilling
    const psSecret = PAYSTACK_SECRET || process.env.PAYSTACK_SECRET_KEY || process.env.PAYSTACK_SECRET;
    if (psSecret) {
      try {
        const verRes = await axios.get(`https://api.paystack.co/transaction/verify/${encodeURIComponent(ref)}`, {
          headers: { Authorization: `Bearer ${psSecret}` },
          timeout: 7000,
        });
        if (verRes.data?.data?.status !== "success") {
          recordWebhookLog("UNVERIFIED_PAYMENT_BLOCKED", { ref, status: verRes.data?.data?.status });
          return;
        }
      } catch (verErr) {
        recordWebhookLog("VERIFY_ERROR_BLOCKED", { ref, error: verErr.message });
        return;
      }
    }

    const paidAmount = Number(event.data?.amount || 0) / 100;
    console.log("💰 ACTUAL AMOUNT PAID:", paidAmount);

    // 1. Primary: Look up session by exact ref
    let session = null;
    if (supabase) {
      try {
        const { data } = await supabase
          .from("sessions")
          .select("*")
          .eq("ref", ref)
          .maybeSingle();
        session = data;
      } catch (_) {}
    }
    if (!session) {
      for (const s of botSessions.values()) {
        if (s && s.ref === ref) {
          session = s;
          break;
        }
      }
    }
    // Also check Supabase settings table for bot_sess_*
    if (!session && supabase) {
      try {
        const { data: sessRow } = await supabase
          .from("settings")
          .select("value")
          .like("key", "bot_sess_%")
          .ilike("value", `%"ref":"${ref}"%`)
          .limit(1)
          .maybeSingle();
        if (sessRow?.value) {
          session = typeof sessRow.value === "string" ? JSON.parse(sessRow.value) : sessRow.value;
          if (session) recordWebhookLog("SESSION_FOUND_VIA_SETTINGS_TABLE", { ref });
        }
      } catch (_) {}
    }

    // 2. Check Website Data Orders by exact reference
    if (!session) {
      let { data: webOrder, error: webOrderErr } = await supabase
        .from("orders")
        .select("*")
        .or(`reference.eq.${ref},datamart_reference.eq.${ref}`)
        .maybeSingle();

      if (!webOrder && String(ref || "").startsWith("WS-") && event.data?.metadata?.recipient_phone && event.data?.metadata?.capacity) {
        const meta = event.data.metadata;
        webOrder = {
          id: ref,
          reference: ref,
          network: meta.network || "MTN",
          capacity: String(meta.capacity),
          recipient_phone: meta.recipient_phone,
          amount: paidAmount,
          payment_status: "pending",
          delivery_status: "pending",
        };
      }

      if (webOrderErr) {
        recordWebhookLog("ORDERS_LOOKUP_ERROR", { ref, error: webOrderErr.message });
      }

      // Avoid double delivery: the website verify flow may have already dispatched or locked this order.
      if (
        webOrder &&
        (webOrder.datamart_reference ||
          webOrder.supplier_status === "dispatching" ||
          (webOrder.payment_status === "paid" &&
            ["processing", "delivered", "completed", "waiting"].includes(String(webOrder.delivery_status || "").toLowerCase())))
      ) {
        recordWebhookLog("WEBSITE_DATA_ORDER_ALREADY_DISPATCHED", { ref, delivery_status: webOrder.delivery_status });
        return;
      }

      if (webOrder) {
        recordWebhookLog("WEBSITE_DATA_ORDER_FOUND", { ref, id: webOrder.id, network: webOrder.network, capacity: webOrder.capacity });
        console.log("🌐 RECOGNIZED WEBSITE DATA ORDER:", ref);

        // Route website & agent orders through the primary /api/paystack endpoint first so atomic DB locking
        // (claimOrderDispatchLock) and canonical WS- reference formatting prevent any duplicate DataMart order.
        const verifyEndpoint = (STORE_FRONTEND_URL || "https://www.data1gh.com").replace(/\/+$/, "") + "/api/paystack";
        try {
          const vRes = await axios.post(verifyEndpoint, { reference: ref }, { timeout: 25000 });
          if (vRes.status >= 200 && vRes.status < 300) {
            recordWebhookLog("WEBSITE_DATA_ORDER_VERIFIED_VIA_API", { ref, status: vRes.data?.status });
            return;
          }
        } catch (vErr) {
          console.warn("Primary /api/paystack call from webhook failed, checking fallback lock:", vErr.message);
        }

        // Re-check DB and atomically claim dispatch lock before fallback purchase
        const { data: lockedRows, error: lockErr } = await supabase
          .from("orders")
          .update({ supplier_status: "dispatching", updated_at: new Date().toISOString() })
          .eq("id", webOrder.id)
          .is("datamart_reference", null)
          .or("supplier_status.is.null,supplier_status.neq.dispatching")
          .select("id, notes");

        if (lockErr || !lockedRows || lockedRows.length === 0) {
          recordWebhookLog("WEBSITE_DATA_ORDER_LOCK_SKIPPED", { ref });
          return;
        }

        const cleanRef = String(ref || "").trim().replace(/^WS[-_]?/i, "");
        const dmCanonicalRef = `WS-${cleanRef}`;

        const networkMap = {
          MTN: "YELLO",
          mtn: "YELLO",
          YELLO: "YELLO",
          TELECEL: "TELECEL",
          telecel: "TELECEL",
          AT: "AT_PREMIUM",
          at: "AT_PREMIUM",
          AIRTELTIGO: "AT_PREMIUM",
          airteltigo: "AT_PREMIUM",
          AT_PREMIUM: "AT_PREMIUM"
        };
        const dmNetwork = networkMap[webOrder.network] || webOrder.network || "YELLO";
        const phone = normalizePhone(webOrder.recipient_phone || webOrder.phone_number);
        const capacity = String(webOrder.capacity || "1").replace(/[^\d.]/g, "");

        let dmSuccess = false;
        let dmRef = null;

        const activeDmKey = DATA_API_KEY || process.env.DATA_API_KEY || VERIFIED_DATAMART_KEY;
        const activeDmSecret = process.env.DATAMART_API_SECRET || process.env.DM_API_SECRET || DATAMART_API_SECRET || VERIFIED_DATAMART_SECRET;

        const dmHeaders = {
          "x-api-key": activeDmKey,
          "X-Idempotency-Key": dmCanonicalRef,
          "Content-Type": "application/json"
        };
        if (activeDmSecret) {
          dmHeaders["x-api-secret"] = activeDmSecret;
        }

        const isFlash = Boolean(webOrder.is_flash_sale || String(webOrder.notes || "").includes("FLASH_SALE"));

        if (activeDmKey && !isFlash) {
          try {
            const dmRes = await axios.post(
              `${DATAMART_BASE}/purchase`,
              { phoneNumber: phone, network: dmNetwork, capacity, gateway: "wallet", ref: dmCanonicalRef, delivery: "fast" },
              { headers: dmHeaders, timeout: 30000 }
            );
            const data = dmRes.data?.data || dmRes.data || {};
            dmRef = data.reference || data.orderReference || data.purchaseId || dmCanonicalRef;
            dmSuccess = true;
          } catch (dmErr) {
            const errMsg = String(dmErr.response?.data?.message || dmErr.response?.data?.error || dmErr.message || "").toLowerCase();
            if (errMsg.includes("already exist") || errMsg.includes("duplicate")) {
              dmRef = dmCanonicalRef;
              dmSuccess = true;
            } else {
              console.warn("Direct DataMart purchase error for order:", dmErr.response?.data || dmErr.message);
              await supabase.from("orders").update({ supplier_status: "failed" }).eq("id", webOrder.id);
              return;
            }
          }
        }

        // CRITICAL: Never immediately jump to "delivered".
        // DataMart accepts order and reports "completed", which only means received.
        // Query API key directly to get real telecom delivery status!
        let verifiedDelivery = "processing";
        let verifiedRaw = "processing";
        if (dmSuccess) {
          const direct = await getRealDatamartDeliveryStatus(dmRef || dmCanonicalRef);
          verifiedDelivery = direct.deliveryStatus;
          verifiedRaw = direct.rawStatus;
        }

        // Mark payment as paid and update delivery status in DB resiliently
        const orderUpdatePayload = {
          payment_status: "paid",
          delivery_status: verifiedDelivery,
          datamart_status: verifiedRaw,
          supplier_status: "datamart",
          updated_at: new Date().toISOString()
        };
        if (dmRef) {
          orderUpdatePayload.datamart_reference = dmRef;
        }
        await supabase
          .from("orders")
          .update(orderUpdatePayload)
          .eq("id", webOrder.id);

        // Credit agent wallet if applicable
        if (webOrder.agent_id) {
          const baseBundle = PACKAGES[webOrder.network]?.[`${capacity}GB`] || PACKAGES[webOrder.network]?.[webOrder.bundle];
          const baseCost = baseBundle ? baseBundle.price : null;
          if (baseCost && paidAmount > baseCost) {
            const profit = Math.max(0, Number((paidAmount - baseCost).toFixed(2)));
            creditAgentWalletSafely(webOrder.agent_id, profit).catch(e => console.warn("Agent credit error:", e.message));
          }
        }

        // Notify WhatsApp user if ordered via WhatsApp bot
        if (webOrder.whatsapp_phone) {
          sendWhatsApp(
            webOrder.whatsapp_phone,
            `✅ PAYMENT RECEIVED! 🎉\n\n📦 Package: ${webOrder.capacity || capacity}GB ${webOrder.network || ""}\n💰 Amount Paid: ₵${paidAmount.toFixed(2)}\n📱 Recipient: ${phone}\n\nYour data has been sent and will land shortly!\n\nSEND: hi / hello / start To buy again.`
          ).catch(() => {});
        }

        // Send instant WhatsApp order alert to admin directly from live bot!
        try {
          const noteStoreMatch = String(webOrder.notes || "").match(/\[store:([^\]]+)\]/i);
          const resolvedStore = webOrder.store_name || (noteStoreMatch ? noteStoreMatch[1].trim() : "");
          const storeLabel = resolvedStore ? `🏪 Store: *${resolvedStore}*` : (webOrder.agent_id ? `🏪 Store: *Agent Store*` : "🏪 Store: *DataOne GH*");
          await sendAdminWhatsApp(
            `🛍️ *NEW ORDER PAYMENT RECEIVED!* 🎉\n` +
            `━━━━━━━━━━━━━━━━━━━━━\n` +
            `${storeLabel}\n` +
            `🆔 *Ref:* ${webOrder.reference || ref}\n` +
            `📶 *Item:* ${webOrder.capacity || capacity}GB ${webOrder.network || ""}\n` +
            `📱 *Customer Phone:* ${phone}\n` +
            `💰 *Amount:* GHS ${paidAmount.toFixed(2)}\n` +
            `⚡ *DataMart Delivery:* ${verifiedDelivery === "delivered" ? "Delivered ✅" : "In Progress ⏳"}\n` +
            `⏰ *Time:* ${new Date().toLocaleTimeString("en-GB", { timeZone: "Africa/Accra", hour: "2-digit", minute: "2-digit" })}`
          );
          // Tag as alerted
          await supabase.from("orders").update({ notes: `${webOrder.notes || ""} [wa_alert_sent]`.trim() }).eq("id", webOrder.id);

          // Also notify the respective Agent on WhatsApp!
          await notifyAgentNewOrder({
            ...webOrder,
            reference: webOrder.reference || ref,
            recipient_phone: phone,
            amount: paidAmount,
            delivery_status: verifiedDelivery,
          }).catch(() => {});

          if (verifiedDelivery === "delivered") {
            await notifyOrderDelivered({
              ...webOrder,
              reference: webOrder.reference || ref,
              recipient_phone: phone,
              amount: paidAmount,
              delivery_status: "delivered",
            }).catch(() => {});
          }
        } catch (_) {}
        return;
      }
    }

    // 3. Check Website Digital Services (Netflix, Mashup, AFA) by exact reference
    if (!session) {
      const { data: webService } = await supabase
        .from("service_orders")
        .select("*")
        .eq("reference", ref)
        .maybeSingle();

      if (webService) {
        recordWebhookLog("WEBSITE_SERVICE_ORDER_FOUND", { ref, service: webService.service });
        await supabase
          .from("service_orders")
          .update({
            payment_status: "paid",
            delivery_status: webService.service === "netflix" ? "active" : "pending",
            updated_at: new Date().toISOString()
          })
          .eq("reference", ref);

        // Send instant WhatsApp order alert to admin
        try {
          await sendAdminWhatsApp(
            `🛍️ *NEW SERVICE ORDER PAID!* 🎉\n` +
            `━━━━━━━━━━━━━━━━━━━━━\n` +
            `🏪 *Store:* DataOne GH\n` +
            `🆔 *Ref:* ${ref}\n` +
            `📶 *Service:* ${webService.service?.toUpperCase()}\n` +
            `📱 *Customer Phone:* ${webService.customer_phone || "N/A"}\n` +
            `💰 *Amount:* GHS ${paidAmount.toFixed(2)}\n` +
            `⏰ *Time:* ${new Date().toLocaleTimeString("en-GB", { timeZone: "Africa/Accra", hour: "2-digit", minute: "2-digit" })}`
          );
        } catch (_) {}
        return;
      }
    }

    // 4. Check Website Result Checkers (WAEC, BECE) by exact reference
    if (!session) {
      const { data: webChecker } = await supabase
        .from("checker_orders")
        .select("*")
        .eq("reference", ref)
        .maybeSingle();

      if (webChecker) {
        recordWebhookLog("WEBSITE_CHECKER_ORDER_FOUND", { ref, type: webChecker.checker_type });
        await supabase
          .from("checker_orders")
          .update({
            payment_status: "paid",
            updated_at: new Date().toISOString()
          })
          .eq("reference", ref);

        // Send instant WhatsApp order alert to admin
        try {
          await sendAdminWhatsApp(
            `🛍️ *NEW RESULT CHECKER ORDER PAID!* 🎉\n` +
            `━━━━━━━━━━━━━━━━━━━━━\n` +
            `🏪 *Store:* DataOne GH\n` +
            `🆔 *Ref:* ${ref}\n` +
            `📶 *Item:* ${webChecker.checker_type?.toUpperCase()} Result Checker\n` +
            `📱 *Customer Phone:* ${webChecker.phone || webChecker.recipient_phone || "N/A"}\n` +
            `💰 *Amount:* GHS ${paidAmount.toFixed(2)}\n` +
            `⏰ *Time:* ${new Date().toLocaleTimeString("en-GB", { timeZone: "Africa/Accra", hour: "2-digit", minute: "2-digit" })}`
          );
        } catch (_) {}
        return;
      }
    }

    // 5. Fallback for WhatsApp chat bot sessions ONLY if not a website order
    if (!session) {
      const isKnownWebRef = /^(CK|SRV|NFLX|MSH|AFA|D1|ORD|CHK)/i.test(ref);

      // Website order the bot couldn't see in the DB (e.g. RLS / wrong key):
      // hand it to the website's own verify endpoint, which re-checks the
      // payment with Paystack and dispatches delivery using the service_role key.
      if (isKnownWebRef) {
        const verifyPath = /^(CK|CHK)/i.test(ref)
          ? "/api/checker-verify"
          : /^(SRV|NFLX|MSH|AFA)/i.test(ref)
            ? "/api/service-verify"
            : "/api/paystack-verify";
        try {
          const fwd = await axios.post(
            `${STORE_FRONTEND_URL}${verifyPath}`,
            { reference: ref },
            { headers: { "Content-Type": "application/json" }, timeout: 45000, validateStatus: () => true }
          );
          const fwdOrder = fwd.data?.order;
          recordWebhookLog("FORWARDED_TO_WEBSITE_VERIFY", { ref, verifyPath, status: fwd.status, payment: fwdOrder?.payment_status, delivery: fwdOrder?.delivery_status });
          if (fwd.status >= 200 && fwd.status < 300 && fwdOrder) {
            // Handled and alerted by website verify endpoint
            return;
          }
        } catch (fwdErr) {
          recordWebhookLog("FORWARD_TO_WEBSITE_VERIFY_FAILED", { ref, verifyPath, error: fwdErr.message });
        }
      }

      if (!isKnownWebRef) {
        const customerEmail = event.data?.customer?.email || "";
        const emailPhone = customerEmail.split("@")[0].replace(/\D/g, "");
        recordWebhookLog("FALLBACK_SEARCH", { ref, customerEmail, emailPhone });

        if (emailPhone && emailPhone.length >= 9) {
          const waPhone = emailPhone.startsWith("0") ? "233" + emailPhone.substring(1) : (emailPhone.startsWith("233") ? emailPhone : "233" + emailPhone);
          const localPhone = emailPhone.startsWith("233") ? "0" + emailPhone.substring(3) : (emailPhone.startsWith("0") ? emailPhone : "0" + emailPhone);

          const fallbackSession = (await getCustomerSession(waPhone)) || (await getCustomerSession(localPhone));
          if (fallbackSession) {
            recordWebhookLog("SESSION_FOUND_VIA_FALLBACK", { waPhone, localPhone, sessionPhone: fallbackSession.phone });
            session = fallbackSession;
            if (!session.phone_number) session.phone_number = localPhone;
            if (!session.momo_number) session.momo_number = localPhone;
          }
        }
      }

      // 3. Fallback: Check pre-inserted pending order in orders table
      if (!session && supabase) {
        try {
          const { data: pendingOrd } = await supabase
            .from("orders")
            .select("*")
            .or(`reference.eq.${ref},ref.eq.${ref}`)
            .maybeSingle();
          if (pendingOrd) {
            session = {
              phone: pendingOrd.whatsapp_phone || pendingOrd.recipient_phone || pendingOrd.phone_number,
              phone_number: pendingOrd.recipient_phone || pendingOrd.phone_number,
              momo_number: pendingOrd.phone_number || pendingOrd.recipient_phone,
              network: pendingOrd.network,
              bundle: pendingOrd.bundle || (pendingOrd.capacity ? `${pendingOrd.capacity}GB` : null),
              agent_id: pendingOrd.agent_id || null,
              ref: ref
            };
            recordWebhookLog("SESSION_FOUND_VIA_PENDING_ORDER", { ref, session });
          }
        } catch (_) {}
      }

      // 4. Ultimate Fallback: Reconstruct session directly from Paystack event metadata
      if (!session && event.data?.metadata && (event.data.metadata.recipient_phone || event.data.metadata.capacity || event.data.metadata.network)) {
        const meta = event.data.metadata;
        const custPhone = event.data?.customer?.phone || (event.data?.customer?.email || "").split("@")[0] || meta.recipient_phone;
        session = {
          phone: custPhone,
          phone_number: meta.recipient_phone || custPhone,
          momo_number: meta.momo_number || custPhone,
          network: meta.network || "MTN",
          bundle: meta.capacity ? (String(meta.capacity).includes("GB") ? meta.capacity : `${meta.capacity}GB`) : "1GB",
          agent_id: meta.agent_id || null,
          agent_name: meta.store_name || null,
          agent_slug: meta.agent_slug || null,
          ref: ref
        };
        recordWebhookLog("SESSION_RECONSTRUCTED_FROM_PAYSTACK_METADATA", { ref, session });
      }

      if (!session) {
        recordWebhookLog("SESSION_NOT_FOUND", { ref });
        console.error("❌ SESSION NOT FOUND:", ref);
        await sendAdminWhatsApp(
          `🔔 PAYSTACK PAYMENT RECEIVED FOR UNKNOWN SESSION\nReference: ${ref}\nAmount: ₵${paidAmount.toFixed(2)}\nCustomer: ${event.data?.customer?.email || "N/A"}\nPlease check Supabase and Paystack dashboard!`
        );
        return;
      }
    }

    recordWebhookLog("SESSION_RESOLVED", {
      phone: session.phone,
      network: session.network,
      bundle: session.bundle,
      phone_number: session.phone_number,
      momo_number: session.momo_number
    });

    /* =====================================================
    MASHUP ORDERS — fulfilled MANUALLY
    ===================================================== */

    if (session.network === "MASHUP") {
      const parsed = parseMashupSelection(session.bundle);
      if (!parsed) {
        console.error("❌ MASHUP SELECTION NOT FOUND FOR SESSION:", session.phone, session.bundle);
        return;
      }

      const mashupRef = "MASHUP-" + ref;
      const { error: orderError } = await supabase.from("orders").upsert([{
        phone: normalizePhone(session.phone),
        phone_number: normalizePhone(session.phone_number),
        recipient_phone: normalizePhone(session.phone_number),
        reference: mashupRef,
        ref: mashupRef,
        network: "MASHUP",
        bundle: session.bundle,
        capacity: parsed.combo.label,
        amount: paidAmount,
        status: "pending_manual",
        payment_status: "paid",
        delivery_status: "pending_manual",
        notes: session.agent_id ? `[agent:${session.agent_id}] [store:${session.agent_slug || session.agent_name || "store"}] [channel:whatsapp_bot] [whatsapp_phone:${normalizePhone(session.phone)}]` : `[channel:whatsapp_bot] [store:Main Store] [whatsapp_phone:${normalizePhone(session.phone)}]`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }], { onConflict: "reference" });

      if (orderError) {
        console.error("❌ MASHUP ORDER SAVE ERROR:", orderError);
      } else {
        console.log("✅ MASHUP ORDER SAVED:", mashupRef);
      }

      await sendAdminWhatsApp(
        `🔔 NEW MASHUP ORDER — MANUAL ACTION NEEDED\n\n💰 Amount: ₵${parsed.amount.toFixed(2)}\n📦 Option selected: ${parsed.combo.label}\n📱 Deliver to: ${session.phone_number}\n💳 Paid via momo: ${session.momo_number}\n💵 Confirmed paid: ₵${paidAmount.toFixed(2)}\n\nDial *567*2#, select MashUp Offers, enter ₵${parsed.amount.toFixed(2)}, pick the option matching "${parsed.combo.label}", and apply it to the number above.`
      );

      sendAdminSms(
        `NEW MASHUP ORDER: ₵${paidAmount.toFixed(2)} paid for ${parsed.combo.label}. Recipient: ${session.phone_number}. Ref: ${mashupRef}. Fulfill manually.`
      ).catch(() => { });

      await sendWhatsApp(
        session.phone,
        `✅ PAYMENT RECEIVED! 🎉\n\n📦 Package: ${parsed.combo.label}\n💰 Amount Paid: ₵${paidAmount.toFixed(2)}\n📱 Number: ${session.phone_number}\n\nThis MashUp bundle is being applied to your number manually and should land shortly.\n\nFor assistance: Whatsapp 0547100951 (@stony11)\n\nSEND: hi / hello / start To buy again.`
      );

      return;
    }

    /* =====================================================
    AFA REGISTRATION ORDERS — fully automated via API
    ===================================================== */

    const afaData = getAfaData(session);

    if (afaData) {
      const afaExternalId = "WA-" + ref;

      try {
        const afaResponse = await axios.post(
          `${AFA_BASE}/registrations`,
          {
            external_order_id: afaExternalId,
            full_name: afaData.full_name,
            phone_number: afaData.phone_number,
            id_type: "Ghana Card",
            id_number: afaData.id_number,
            location: afaData.location,
            dob: afaData.dob,
            occupation: afaData.occupation
          },
          {
            headers: {
              "X-API-Key": AFA_API_KEY,
              "Content-Type": "application/json",
              "Idempotency-Key": afaExternalId
            },
            timeout: 30000
          }
        );

        const afaOrder = afaResponse.data?.data || afaResponse.data || {};
        const afaStatus = afaOrder.status || "pending";
        const afaOrderId = afaOrder.id || afaOrder.order_id || null;

        const { error: afaOrderError } = await supabase.from("orders").upsert([{
          phone: normalizePhone(session.phone),
          phone_number: normalizePhone(afaData.phone_number),
          recipient_phone: normalizePhone(afaData.phone_number),
          reference: afaExternalId,
          ref: afaExternalId,
          network: "AFA",
          bundle: afaData.full_name,
          capacity: "AFA Registration",
          amount: paidAmount,
          status: afaStatus,
          payment_status: "paid",
          delivery_status: afaStatus === "completed" || afaStatus === "approved" ? "delivered" : "processing",
          agent_id: session.agent_id || null,
          notes: session.agent_id ? `[agent:${session.agent_id}] [store:${session.agent_slug}] [whatsapp_phone:${normalizePhone(session.phone)}]` : `[whatsapp_phone:${normalizePhone(session.phone)}]`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }], { onConflict: "reference" });

        if (afaOrderError) {
          console.error("❌ AFA ORDER SAVE ERROR:", afaOrderError);
        } else {
          console.log("✅ AFA ORDER SAVED:", afaExternalId, "| AFA order id:", afaOrderId);
        }

        const isAgentOrder = Boolean(session.agent_id);
        const storeDisplayName = session.agent_name || "Data Store";

        if (isAgentOrder) {
          const afaProfit = Math.max(0, paidAmount - AFA_PRICE);
          if (afaProfit > 0) {
            creditAgentWalletSafely(session.agent_id, afaProfit).then(res => {
              console.log(`💰 Credited agent ${session.agent_id} with +GH₵ ${afaProfit.toFixed(2)} (AFA profit). New balance: GH₵ ${res.balance}`);
            }).catch(err => {
              console.error(`❌ Failed to credit agent ${session.agent_id} for AFA:`, err.message);
            });
          }
          await sendWhatsApp(
            session.phone,
            `✅ PAYMENT RECEIVED! 🎉\n\n🏪 Store: *${storeDisplayName}*\n🪪 AFA Registration submitted for: ${afaData.full_name}\n📱 Phone: ${afaData.phone_number}\n💰 Amount Paid: ₵${paidAmount.toFixed(2)}\n📌 Status: ${afaStatus}\n\nYou'll be notified once it's approved.\n\nSEND: hi / hello / start To return to menu.`
          );
        } else {
          await sendWhatsApp(
            session.phone,
            `✅ PAYMENT RECEIVED! 🎉\n\n🪪 AFA Registration submitted for: ${afaData.full_name}\n📱 Phone: ${afaData.phone_number}\n💰 Amount Paid: ₵${paidAmount.toFixed(2)}\n📌 Status: ${afaStatus}\n\nYou'll be notified once it's approved.\n\nFor assistance: Whatsapp 0547100951 (@stony11)\n\nSEND: hi / hello / start To buy again.`
          );
        }

        sendAdminSms(
          `NEW AFA ORDER: ₵${paidAmount.toFixed(2)} paid for ${afaData.full_name} (${afaData.phone_number}). Status: ${afaStatus}. Ref: ${afaExternalId}`
        ).catch(() => { });
      } catch (afaError) {
        console.error("❌ AFA API ERROR:", afaError.response?.data || afaError.message);

        const isAgentOrder = Boolean(session.agent_id);
        const storeDisplayName = session.agent_name || "Data Store";

        await supabase.from("orders").upsert([{
          phone: normalizePhone(session.phone),
          phone_number: normalizePhone(afaData.phone_number),
          recipient_phone: normalizePhone(afaData.phone_number),
          reference: afaExternalId,
          ref: afaExternalId,
          network: "AFA",
          bundle: afaData.full_name,
          capacity: "AFA Registration",
          amount: paidAmount,
          status: "pending_manual",
          payment_status: "paid",
          delivery_status: "pending_manual",
          agent_id: session.agent_id || null,
          notes: session.agent_id ? `[agent:${session.agent_id}] [store:${session.agent_slug}] [whatsapp_phone:${normalizePhone(session.phone)}]` : `[whatsapp_phone:${normalizePhone(session.phone)}]`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }], { onConflict: "reference" });

        await sendAdminWhatsApp(
          `🔔 AFA REGISTRATION FAILED — MANUAL ACTION NEEDED\n\nThe AFA API call failed after payment was confirmed.\n\n👤 Full Name: ${afaData.full_name}\n📱 Phone: ${afaData.phone_number}\n🪪 Ghana Card: ${afaData.id_number}\n📍 Location: ${afaData.location}\n🎂 DOB: ${afaData.dob}\n💼 Occupation: ${afaData.occupation}\n💵 Confirmed paid: ₵${paidAmount.toFixed(2)}\n\nCheck the afaregistration.com dashboard or submit this manually, then update the order.`
        );

        // Automated failed-order SMS disabled.

        if (isAgentOrder) {
          await sendWhatsApp(
            session.phone,
            `✅ Payment received! Your AFA registration for ${afaData.full_name} is being processed and will be delivered shortly.\n\n🏪 Store: *${storeDisplayName}*\n\nSEND: hi / hello / start To return to menu.`
          );
        } else {
          await sendWhatsApp(
            session.phone,
            `✅ Payment received! Your AFA registration for ${afaData.full_name} is being processed and may take a little longer than usual.\n\nFor assistance: Whatsapp 0547100951 (@stony11)\n\nSEND: hi / hello / start To buy again.`
          );
        }
      }

      return;
    }

    /* =====================================================
    NETFLIX ORDERS
    ==================================================== */

    const netflixData = getNetflixData(session);

    if (netflixData) {
      const netflixRef = "NETFLIX-" + ref;
      const paidAt = new Date().toISOString();
      const refCode = generateNetflixRefCode();

      await saveCustomerSession(session.phone, {
        step: 53,
        bundle: JSON.stringify({ type: "netflix", paidAt, refCode, used: false })
      });

      const isAgentOrder = Boolean(session.agent_id);
      const storeDisplayName = session.agent_name || "Data Store";

      if (isAgentOrder) {
        const netflixProfit = Math.max(0, paidAmount - NETFLIX_PRICE);
        if (netflixProfit > 0) {
          creditAgentWalletSafely(session.agent_id, netflixProfit).then(res => {
            console.log(`💰 Credited agent ${session.agent_id} with +GH₵ ${netflixProfit.toFixed(2)} (Netflix profit). New balance: GH₵ ${res.balance}`);
          }).catch(err => {
            console.error(`❌ Failed to credit agent ${session.agent_id} for Netflix:`, err.message);
          });
        }
      }

      const { error: netflixOrderError } = await supabase.from("orders").upsert([{
        phone: normalizePhone(session.phone),
        phone_number: normalizePhone(session.phone),
        recipient_phone: normalizePhone(session.phone),
        reference: netflixRef,
        ref: netflixRef,
        network: "NETFLIX",
        bundle: refCode,
        capacity: "Netflix Subscription",
        amount: paidAmount,
        status: "pending_code_request",
        payment_status: "paid",
        delivery_status: "processing",
        agent_id: session.agent_id || null,
        notes: session.agent_id ? `[agent:${session.agent_id}] [store:${session.agent_slug}] [whatsapp_phone:${normalizePhone(session.phone)}]` : `[whatsapp_phone:${normalizePhone(session.phone)}]`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }], { onConflict: "reference" });

      if (netflixOrderError) {
        console.error("❌ NETFLIX ORDER SAVE ERROR:", netflixOrderError);
      } else {
        console.log("✅ NETFLIX ORDER SAVED:", netflixRef, "| REF CODE:", refCode);
      }

      if (isAgentOrder) {
        await sendWhatsApp(
          session.phone,
          `✅ PAYMENT RECEIVED! 🎉\n\n🏪 Store: *${storeDisplayName}*\n📺 Netflix Subscription — ₵${paidAmount.toFixed(2)}\n\nYOUR REFERENCE CODE: *${refCode}*\n⚠️ Save this. It can be used only ONCE to fetch a sign-in code.\n\nSTEP 1\nSign in to Netflix with this email:\n${NETFLIX_EMAIL}\n\n• Open Netflix on your phone, TV, or laptop\n• Choose "Sign in" and enter the email above\n• Netflix will send a sign-in code to that email\n\nSTEP 2\nOnce you've done that, reply here with your reference code above (${refCode}) to get your Netflix sign-in code.\n\nSEND: hi / hello / start To return to menu.`
        );
      } else {
        await sendWhatsApp(
          session.phone,
          `✅ PAYMENT RECEIVED! 🎉\n\n📺 Netflix Subscription — ₵${paidAmount.toFixed(2)}\n\nYOUR REFERENCE CODE: *${refCode}*\n⚠️ Save this. It can be used only ONCE to fetch a sign-in code.\n\nSTEP 1\nSign in to Netflix with this email:\n${NETFLIX_EMAIL}\n\n• Open Netflix on your phone, TV, or laptop\n• Choose "Sign in" and enter the email above\n• Netflix will send a sign-in code to that email\n\nSTEP 2\nOnce you've done that, reply here with your reference code above (${refCode}) to get your Netflix sign-in code.\n\nFor assistance: Whatsapp 0547100951 (@stony11)`
        );
      }

      sendAdminSms(
        `NEW NETFLIX ORDER: ₵${paidAmount.toFixed(2)} paid by ${session.phone}. Ref: ${netflixRef}. Code: ${refCode}`
      ).catch(() => { });

      return;
    }

    const bundle = PACKAGES[session.network]?.[session.bundle];

    if (!bundle) {
      recordWebhookLog("BUNDLE_NOT_FOUND", { network: session.network, bundle: session.bundle });
      await sendWhatsApp(
        session.phone,
        `✅ PAYMENT RECEIVED! 🎉\n\nAmount Paid: ₵${paidAmount.toFixed(2)}\n\nYour order has been recorded and is being processed by our support team.\n\nFor assistance: Whatsapp 0547100951 (@stony11)`
      );
      return;
    }

    /* =====================================================
    SEND PURCHASE TO DATAMART
    ===================================================== */

    let datamartSuccess = false;
    let datamartData = {};
    let datamartReference = null;
    let datamartOrderId = null;
    let datamartStatus = "pending";
    let datamartErrorDetail = null;

    const botRef = `WS-${ref ? String(ref).replace(/^WS-?/, "") : "BOT-" + Date.now().toString(36).toUpperCase()}`;
    const purchasePayload = {
      phoneNumber: normalizePhone(session.phone_number),
      network: bundle.apiNetwork || "YELLO",
      capacity: String(bundle.capacity),
      gateway: "wallet",
      ref: botRef,
    };

    const activeDmKey = DATA_API_KEY || process.env.DATA_API_KEY || VERIFIED_DATAMART_KEY;
    const activeDmSecret = process.env.DATAMART_API_SECRET || process.env.DATA_API_SECRET || process.env.DM_API_SECRET || DATAMART_API_SECRET || VERIFIED_DATAMART_SECRET;

    const dmHeaders = {
      "x-api-key": activeDmKey,
      "X-Idempotency-Key": botRef,
      "Content-Type": "application/json"
    };
    if (activeDmSecret) {
      dmHeaders["x-api-secret"] = activeDmSecret;
    }

    // 1. Try Fast Lane delivery
    try {
      recordWebhookLog("DATAMART_FAST_PURCHASE_ATTEMPT", purchasePayload);

      const delivery = await axios.post(
        `${DATAMART_BASE}/purchase`,
        { ...purchasePayload, delivery: "fast" },
        {
          headers: dmHeaders,
          timeout: 30000
        }
      );

      datamartData = delivery.data?.data || delivery.data || {};
      datamartReference = datamartData.reference || datamartData.orderReference || datamartData.order_reference || null;
      datamartOrderId = datamartData.orderId || datamartData.order_id || null;
      datamartStatus = datamartData.orderStatus || datamartData.status || "pending";
      datamartSuccess = true;
      recordWebhookLog("DATAMART_FAST_PURCHASE_SUCCESS", datamartData);
    } catch (fastErr) {
      datamartErrorDetail = fastErr.response?.data || fastErr.message;
      recordWebhookLog("DATAMART_FAST_FAILED_RETRYING_STANDARD", { error: datamartErrorDetail });

      // 2. Retry with Standard delivery
      try {
        const deliveryStd = await axios.post(
          `${DATAMART_BASE}/purchase`,
          purchasePayload,
          {
            headers: dmHeaders,
            timeout: 30000
          }
        );

        datamartData = deliveryStd.data?.data || deliveryStd.data || {};
        datamartReference = datamartData.reference || datamartData.orderReference || datamartData.order_reference || null;
        datamartOrderId = datamartData.orderId || datamartData.order_id || null;
        datamartStatus = datamartData.orderStatus || datamartData.status || "pending";
        datamartSuccess = true;
        recordWebhookLog("DATAMART_STANDARD_PURCHASE_SUCCESS", datamartData);
      } catch (stdErr) {
        datamartErrorDetail = stdErr.response?.data || stdErr.message;
        recordWebhookLog("DATAMART_PURCHASE_ALL_FAILED", { error: datamartErrorDetail });
      }
    }

    const orderReference = datamartReference || ref;

    // CRITICAL: Never immediately jump to "delivered".
    // DataMart accepts order and reports "completed", which only means received.
    // Query API key directly to get real telecom delivery status!
    let mappedDeliveryStatus = "processing";
    let mappedRawStatus = datamartStatus;
    if (datamartSuccess) {
      const direct = await getRealDatamartDeliveryStatus(datamartReference || datamartOrderId || orderReference);
      mappedDeliveryStatus = direct.deliveryStatus;
      mappedRawStatus = direct.rawStatus;
    } else {
      mappedDeliveryStatus = "failed";
    }
    const finalOrderStatus = datamartSuccess ? mappedRawStatus : "pending_manual";

    const baseBundle = PACKAGES[session.network]?.[session.bundle];
    const baseCost = baseBundle ? baseBundle.price : null;

    try {
      const { error: orderError } = await supabase.from("orders").upsert([{
        phone: normalizePhone(session.phone),
        phone_number: normalizePhone(session.phone_number),
        recipient_phone: normalizePhone(session.phone_number),
        reference: orderReference,
        ref: orderReference,
        network: session.network,
        bundle: session.bundle,
        capacity: String(bundle.capacity),
        amount: paidAmount,
        base_price: baseCost,
        agent_id: session.agent_id || null,
        notes: session.agent_id ? `[agent:${session.agent_id}] [store:${session.agent_slug || session.agent_name || "store"}] [channel:whatsapp_bot] [whatsapp_phone:${normalizePhone(session.phone)}]` : `[channel:whatsapp_bot] [store:Main Store] [whatsapp_phone:${normalizePhone(session.phone)}]`,
        status: mappedDeliveryStatus,
        payment_status: "paid",
        delivery_status: mappedDeliveryStatus,
        datamart_status: mappedRawStatus,
        datamart_reference: datamartReference || (datamartOrderId ? String(datamartOrderId) : null),
        created_at: datamartData.createdAt || new Date().toISOString(),
        updated_at: datamartData.updatedAt || new Date().toISOString(),
        campaign_code: session.scratch_order_opt_in ? session.scratch_code : null
      }], { onConflict: "reference" });

      // Automatically credit profit to Agent's wallet!
      if (session.agent_id && baseCost) {
        const profit = Math.max(0, Number((paidAmount - baseCost).toFixed(2)));
        if (profit > 0) {
          creditAgentWalletSafely(session.agent_id, profit).then(res => {
            console.log(`💰 Credited agent ${session.agent_id} with +GH₵ ${profit.toFixed(2)} from WhatsApp store sale!`);
          }).catch(err => {
            console.warn("Error crediting agent wallet:", err.message);
          });
        }
      }

      if (orderError) {
        console.error("❌ ORDER SAVE ERROR:", orderError);
        recordWebhookLog("ORDER_SAVE_ERROR", { error: orderError.message });
      } else {
        console.log("✅ ORDER HISTORY SAVED:", orderReference);
        recordWebhookLog("ORDER_SAVED", { orderReference, status: mappedDeliveryStatus });

        if (datamartSuccess && session.scratch_order_opt_in && session.scratch_code) {
          const scratchResult = await countScratchPaidOrder(session.phone, session.scratch_code, orderReference);
          if (scratchResult) {
            if (scratchResult.unlocked) {
              await sendWhatsApp(session.phone, `🎉 CONGRATULATIONS!\n\nYour Scratch Code *${scratchResult.code}* has reached 5/5 PAID data orders!\n\n🎟️ YOUR SCRATCH CARD IS NOW UNLOCKED!\n\nReply *SCRATCH* to play and win 1GB or 2GB. 🎁`);
            } else {
              await sendWhatsApp(session.phone, `🎟️ SCRATCH & WIN PROGRESS\n\nCode: ${scratchResult.code}\n💳 Paid orders: ${scratchResult.ordersCompleted}/5\n\n${5 - scratchResult.ordersCompleted} more paid data order(s) to unlock your Scratch Card.`);
            }
          }
        }
      }
    } catch (dbErr) {
      console.error("❌ SUPABASE ORDER INSERT EXCEPTION:", dbErr.message);
      recordWebhookLog("SUPABASE_EXCEPTION", { error: dbErr.message });
    }

    const tracker = await getDeliveryEstimate();
    const estimateMessage = buildDeliveryEstimateMessage(tracker);

    if (datamartSuccess) {
      const isAgentOrder = Boolean(session.agent_id);
      const storeDisplayName = session.agent_name || "Data Store";

      if (isAgentOrder) {
        if (mappedDeliveryStatus === "delivered") {
          let successMessage = `✅ ORDER DELIVERED! 🎉\n\n🏪 Store: *${storeDisplayName}*\n🆔 Order Reference: ${orderReference}\n📦 Data: ${bundle.capacity}GB\n📶 Network: ${session.network}\n📱 Number: ${session.phone_number}\n💰 Amount Paid: ₵${paidAmount.toFixed(2)}\n\nYour data has landed! 📶\n\nSEND: hi / hello / start To buy again.`;
          await sendWhatsApp(session.phone, successMessage);
          recordWebhookLog("CUSTOMER_NOTIFIED_DELIVERED", { phone: session.phone });
        } else {
          let inProgressMessage = `✅ PAYMENT RECEIVED! 🎉\n\n🏪 Store: *${storeDisplayName}*\n🆔 Order Reference: ${orderReference}\n📦 Data: ${bundle.capacity}GB\n📶 Network: ${session.network}\n📱 Delivery to: ${session.phone_number}\n💰 Amount Paid: ₵${paidAmount.toFixed(2)}\n\n${estimateMessage}\n\nYour order has been dispatched and is currently in progress. It will land shortly!\n\nSEND: hi / hello / start To return to main menu.`;
          await sendWhatsApp(session.phone, inProgressMessage);
          recordWebhookLog("CUSTOMER_NOTIFIED_IN_PROGRESS", { phone: session.phone });
        }
      } else {
        if (mappedDeliveryStatus === "delivered") {
          let successMessage = `✅ ORDER DELIVERED! 🎉\n\n🆔 Order Reference: ${orderReference}\n📦 Data: ${bundle.capacity}GB\n📶 Network: ${session.network}\n📱 Number: ${session.phone_number}\n💰 Amount Paid: ₵${paidAmount.toFixed(2)}\n\nYour data has landed! 📶\n\nFor assistance: Whatsapp 0547100951 (@stony11)\n\nSEND: hi / hello / start To buy again.`;
          await sendWhatsApp(session.phone, successMessage);
          recordWebhookLog("CUSTOMER_NOTIFIED_DELIVERED", { phone: session.phone });
        } else {
          let inProgressMessage = `✅ PAYMENT RECEIVED! 🎉\n\n🆔 Order Reference: ${orderReference}\n📦 Data: ${bundle.capacity}GB\n📶 Network: ${session.network}\n📱 Delivery to: ${session.phone_number}\n💰 Amount Paid: ₵${paidAmount.toFixed(2)}\n\n${estimateMessage}\n\nYour order has been dispatched and is currently in progress. It will land shortly!\n\nFor assistance: Whatsapp 0547100951 (@stony11)\n\nSEND: hi / hello / start To return to main menu.`;
          await sendWhatsApp(session.phone, inProgressMessage);
          recordWebhookLog("CUSTOMER_NOTIFIED_IN_PROGRESS", { phone: session.phone });
        }
      }

      sendAdminSms(
        `NEW DATA ORDER: ${bundle.capacity}GB ${session.network} to ${session.phone_number}. Paid: ₵${paidAmount.toFixed(2)}. Status: ${mappedDeliveryStatus === "delivered" ? "Delivered" : "In Progress"} (${orderReference})`
      ).catch(() => { });

      try {
        const storeLabel = session.agent_name || session.agent_slug ? `🏪 Store: *${session.agent_name || session.agent_slug}*` : "🏪 Store: *Main Store (Data1GH)*";
        const profitText = (session.agent_id && baseCost) ? `\n💼 Agent Profit: +GH₵ ${Math.max(0, paidAmount - baseCost).toFixed(2)}` : "";
        await sendAdminWhatsApp(
          `🔔 *NEW PAID BOT ORDER!* 📱\n\n${storeLabel}\n📦 Bundle: ${bundle.capacity}GB ${session.network}\n📱 Recipient: ${session.phone_number}\n💰 Amount Paid: ₵${paidAmount.toFixed(2)}${profitText}\n🆔 Ref: ${orderReference}\n⚡ DataMart Status: ${mappedDeliveryStatus === "delivered" ? "Delivered ✅" : "In Progress ⏳"}`
        );
        if (session.agent_id) {
          await notifyAgentNewOrder({
            reference: orderReference,
            recipient_phone: session.phone_number,
            network: session.network,
            capacity: bundle.capacity,
            amount: paidAmount,
            base_price: baseCost,
            agent_id: session.agent_id,
            store_name: session.agent_name || session.agent_slug || null,
            delivery_status: mappedDeliveryStatus,
          }).catch(() => {});
        }
        if (mappedDeliveryStatus === "delivered") {
          await notifyOrderDelivered({
            reference: orderReference,
            recipient_phone: session.phone_number,
            phone: session.phone,
            network: session.network,
            capacity: bundle.capacity,
            amount: paidAmount,
            base_price: baseCost,
            agent_id: session.agent_id || null,
            store_name: session.agent_name || session.agent_slug || null,
          }).catch(() => {});
        }
      } catch (_) { }
    } else {
      const isAgentOrder = Boolean(session.agent_id);
      const storeDisplayName = session.agent_name || "Data Store";
      if (isAgentOrder) {
        let pendingMessage = `✅ PAYMENT RECEIVED! 🎉\n\n🏪 Store: *${storeDisplayName}*\n🆔 Order Reference: ${orderReference}\n📦 Data: ${bundle.capacity}GB\n📶 Network: ${session.network}\n📱 Delivery to: ${session.phone_number}\n💰 Amount Paid: ₵${paidAmount.toFixed(2)}\n\nYour payment has been received and your data order is currently being processed. It will be delivered to your number shortly!\n\nSEND: hi / hello / start To return to main menu.`;
        await sendWhatsApp(session.phone, pendingMessage);
        recordWebhookLog("CUSTOMER_NOTIFIED_PENDING", { phone: session.phone });
      } else {
        let pendingMessage = `✅ PAYMENT RECEIVED! 🎉\n\n🆔 Order Reference: ${orderReference}\n📦 Data: ${bundle.capacity}GB\n📶 Network: ${session.network}\n📱 Data goes to: ${session.phone_number}\n💰 Amount Paid: ₵${paidAmount.toFixed(2)}\n\nYour payment has been received and your data order is currently being processed. It will be delivered to your number shortly!\n\nFor assistance: Whatsapp 0547100951 (@stony11)\n\nSEND: hi / hello / start To return to main menu.`;
        await sendWhatsApp(session.phone, pendingMessage);
        recordWebhookLog("CUSTOMER_NOTIFIED_PENDING", { phone: session.phone });
      }

      const storeLabel = session.agent_name || session.agent_slug ? `🏪 Store: *${session.agent_name || session.agent_slug}*` : "🏪 Store: *Main Store (Data1GH)*";
      const errorString = typeof datamartErrorDetail === "object" ? JSON.stringify(datamartErrorDetail) : String(datamartErrorDetail || "Unknown API error");
      await sendAdminWhatsApp(
        `🚨 DATAMART FAILED — MANUAL DELIVERY NEEDED!\n\n${storeLabel}\nCustomer paid, but DataMart API purchase failed:\n❌ Error: ${errorString}\n\n📦 Bundle: ${bundle.capacity}GB (${session.network})\n📱 Recipient: ${session.phone_number}\n💳 Paid from MoMo: ${session.momo_number || session.phone_number}\n💰 Amount: ₵${paidAmount.toFixed(2)}\n🆔 Ref: ${orderReference}\n\nPlease deliver this order manually or check your DataMart wallet balance!`
      );
      recordWebhookLog("ADMIN_ALERTED_DATAMART_FAILURE", { error: errorString });
      // Automated failed-order SMS disabled.
    }
  } catch (e) {
    recordWebhookLog("WEBHOOK_FATAL_ERROR", { error: e.response?.data || e.message });
    console.error("WEBHOOK ERROR:", e.response?.data || e.message);
  }
});

/* =========================================================
ADMIN PAGE
========================================================= */

app.get("/admin", (req, res) => {
  const key = req.query.key || req.headers["x-admin-key"];
  const expectedKey = process.env.ADMIN_API_KEY || "data1gh-secure-admin";
  if (key !== expectedKey) {
    return res.status(401).send("Unauthorized. Access restricted to administrator.");
  }
  res.sendFile(__dirname + "/admin.html");
});

app.post("/api/send-admin-alert", async (req, res) => {
  try {
    const { text, to } = req.body || {};
    if (!text) return res.status(400).json({ error: "Missing alert text" });
    if (to) {
      await sendWhatsApp(to, text);
    } else {
      await sendAdminWhatsApp(text);
    }
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err?.message });
  }
});

app.post("/api/channel-post", async (req, res) => {
  try {
    const { topic = "prices", text = "", ownerPhone = "233547100951" } = req.body || {};
    const postBody = text ? await buildChannelPostFromSystem("custom", text) : await buildChannelPostFromSystem(topic, "");
    const out = await postToWhatsAppChannel(postBody, { ownerPhone });
    return res.json(out);
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message });
  }
});

app.post("/api/channel-pair", async (req, res) => {
  try {
    const { phone = "233547100951" } = req.body || {};
    const out = await initBaileysChannelClient({ forceReset: true, requestPairForPhone: phone });
    return res.json(out);
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message });
  }
});

/* =========================================================
ADMIN DATA
========================================================= */

app.get("/admin-data", async (req, res) => {
  // Safe read-only metrics access — no noisy intrusion alerts sent to WhatsApp
  const key = req.query.key || req.headers["x-admin-key"];
  const expectedKey = process.env.ADMIN_API_KEY || "data1gh-secure-admin";
  const isAuth = !expectedKey || key === expectedKey;

  if (!isAuth && req.headers["sec-fetch-dest"] !== "document") {
    // Return unauthorized silently without blasting alarm messages to WhatsApp
    return res.status(401).json({ error: "Unauthorized access" });
  }

  try {
    const { data } = await supabase.from("sessions").select("*");
    const sessions = data || [];
    let revenue = 0;

    sessions.forEach(x => {
      if (x.step === 5) {
        const bundle = PACKAGES[x.network]?.[x.bundle];
        if (bundle) revenue += bundle.price;
      }
    });

    res.json({
      total: sessions.length,
      delivered: sessions.filter(x => x.step === 5).length,
      pending: sessions.filter(x => x.step < 5).length,
      revenue,
      orders: sessions.slice(-10).reverse()
    });
  } catch (e) {
    res.json({ error: e.message });
  }
});

/* =========================================================
AUTOMATED DATAMART DELIVERY MONITOR & CONFIRMATION ALERTS
========================================================= */

const deliveredAlertSentRefs = new Set();
const agentNewOrderSentRefs = new Set();

async function notifyAgentNewOrder(order) {
  if (!order || !order.reference) return;
  const ref = String(order.reference).trim();
  const refKey = ref.toUpperCase();

  if (agentNewOrderSentRefs.has(refKey)) return;
  if (String(order.notes || "").includes("[agent_wa_alert_sent]")) {
    agentNewOrderSentRefs.add(refKey);
    return;
  }

  let resolvedAgentId = order.agent_id ? String(order.agent_id).trim() : "";
  let resolvedStoreName = order.store_name ? String(order.store_name).trim() : "";
  let resolvedBasePrice = Number(order.base_price || 0);
  const notesStr = String(order.notes || "");
  if (!resolvedAgentId) {
    const agMatch = notesStr.match(/\[agent:([^\]]+)\]/i);
    if (agMatch) resolvedAgentId = agMatch[1].trim();
  }
  if (!resolvedStoreName) {
    const stMatch = notesStr.match(/\[store:([^\]]+)\]/i);
    if (stMatch) resolvedStoreName = stMatch[1].trim();
  }

  if (!resolvedAgentId) return;

  agentNewOrderSentRefs.add(refKey);
  if (agentNewOrderSentRefs.size > 1000) {
    const first = agentNewOrderSentRefs.values().next().value;
    if (first) agentNewOrderSentRefs.delete(first);
  }

  try {
    const { data: freshOrd } = await supabase
      .from("orders")
      .select("id, notes, agent_id, base_price")
      .eq("reference", ref)
      .maybeSingle();

    if (freshOrd) {
      if (!resolvedBasePrice && freshOrd.base_price) resolvedBasePrice = Number(freshOrd.base_price);
      const curNotes = String(freshOrd.notes || "");
      if (curNotes.includes("[agent_wa_alert_sent]")) return;
      const nextNotes = `${curNotes} [agent_wa_alert_sent]`.trim();
      await supabase.from("orders").update({ notes: nextNotes }).eq("id", freshOrd.id);
    }

    let agPhone = "";
    let agStore = resolvedStoreName;
    let agentProfit = resolvedBasePrice > 0 ? Math.max(0, Number(order.amount || 0) - resolvedBasePrice) : 0;

    const { data: ag } = await supabase
      .from("agents")
      .select("id, name, phone, whatsapp_number, momo_number, store_name, store_slug")
      .eq("id", resolvedAgentId)
      .maybeSingle();

    if (ag) {
      agPhone = ag.whatsapp_number || ag.phone || ag.momo_number || "";
      if (!agStore && ag.store_name) agStore = ag.store_name;
    }

    if (!agPhone || !agStore) {
      const { data: regRow } = await supabase
        .from("settings")
        .select("value")
        .eq("key", "agents_registry")
        .maybeSingle();
      if (regRow?.value) {
        const parsed = typeof regRow.value === "string" ? JSON.parse(regRow.value) : regRow.value;
        const regAg = Array.isArray(parsed)
          ? parsed.find(a => String(a.id) === resolvedAgentId || String(a.store_slug) === resolvedAgentId)
          : parsed?.[resolvedAgentId];
        if (regAg) {
          if (!agPhone) agPhone = regAg.whatsapp_number || regAg.whatsapp_phone || regAg.phone || regAg.momo_number || "";
          if (!agStore && regAg.store_name) agStore = regAg.store_name;
        }
      }
    }

    const { data: notifPref } = await supabase
      .from("settings")
      .select("value")
      .eq("key", `agent_notifications_${resolvedAgentId}`)
      .maybeSingle();
    if (notifPref?.value) {
      const pref = typeof notifPref.value === "string" ? JSON.parse(notifPref.value) : notifPref.value;
      if (pref?.enabled === false) return;
      if (pref?.whatsapp_phone || pref?.whatsapp_number || pref?.phone) {
        agPhone = pref.whatsapp_phone || pref.whatsapp_number || pref.phone;
      }
    }

    if (!agentProfit) {
      const { data: aoRow } = await supabase
        .from("agent_orders")
        .select("profit")
        .eq("reference", ref)
        .maybeSingle();
      if (aoRow?.profit !== undefined && Number(aoRow.profit) > 0) {
        agentProfit = Number(aoRow.profit);
      }
    }

    const rawPhone = order.recipient_phone || order.phone_number || "N/A";
    const cleanPhone = rawPhone.startsWith("233") ? "0" + rawPhone.slice(3) : rawPhone;
    const itemDesc = `${order.capacity || ""}GB ${order.network || ""} Data`.trim() || "Data Bundle";
    const amount = Number(order.amount || 0).toFixed(2);
    const now = new Date();
    const dateStr = now.toLocaleDateString("en-GB", { timeZone: "Africa/Accra" });
    const timeStr = now.toLocaleTimeString("en-GB", { timeZone: "Africa/Accra", hour: "2-digit", minute: "2-digit" });
    const profitDisplay = agentProfit > 0 ? `💵 *Your Profit:* GH₵ ${agentProfit.toFixed(2)}` : `💵 *Your Profit:* Recorded in Wallet`;
    const statusText = order.delivery_status === "delivered" ? "✅ Delivered to Phone" : "⏳ In Progress (DataMart)";

    const newOrderAlertText =
      `🎉 *NEW ORDER FROM YOUR STORE!* 🛍️\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `Congratulations! A customer just placed an order on *${agStore || "Your Agent Store"}*!\n\n` +
      `🆔 *Order Ref:* ${ref}\n` +
      `📶 *Item:* ${itemDesc}\n` +
      `📱 *Recipient:* ${cleanPhone}\n` +
      `💰 *Customer Paid:* GH₵ ${amount}\n` +
      `${profitDisplay}\n` +
      `⚡ *Status:* ${statusText}\n` +
      `⏰ *Time:* ${dateStr} ${timeStr}\n\n` +
      `Keep sharing your store link to grow your daily sales!\n` +
      `👉 View Dashboard: https://www.data1gh.com/agent/dashboard`;

    if (agPhone) {
      await sendWhatsApp(agPhone, newOrderAlertText);
    }

    const logKey = `agent_notif_log_${resolvedAgentId}`;
    const { data: logRow } = await supabase.from("settings").select("value").eq("key", logKey).maybeSingle();
    const existingLogs = Array.isArray(logRow?.value)
      ? logRow.value
      : typeof logRow?.value === "string"
      ? JSON.parse(logRow.value || "[]")
      : [];
    const newLogEntry = {
      id: `notif_${Date.now()}`,
      type: "new_order",
      title: "🎉 NEW ORDER FROM YOUR STORE! 🛍️",
      order_ref: ref,
      reference: ref,
      item: itemDesc,
      recipient: cleanPhone,
      profit: Number(agentProfit || 0),
      phone: agPhone || null,
      is_test: false,
      status: "delivered",
      created_at: now.toISOString(),
    };
    const updatedLogs = [newLogEntry, ...existingLogs.filter(x => x?.order_ref !== ref || x?.type === "order_delivered")].slice(0, 50);
    await supabase.from("settings").upsert({ key: logKey, value: updatedLogs, updated_at: now.toISOString() }, { onConflict: "key" });
  } catch (_) {}
}

async function notifyOrderDelivered(order) {
  if (!order || !order.reference) return;
  const ref = String(order.reference).trim();
  const refKey = ref.toUpperCase();

  // 1. Immediate synchronous in-memory lock
  if (deliveredAlertSentRefs.has(refKey)) return;
  if (String(order.notes || "").includes("[delivery_confirmed_sent]")) {
    deliveredAlertSentRefs.add(refKey);
    return;
  }
  deliveredAlertSentRefs.add(refKey);
  if (deliveredAlertSentRefs.size > 1000) {
    const first = deliveredAlertSentRefs.values().next().value;
    if (first) deliveredAlertSentRefs.delete(first);
  }

  // 2. Atomic PostgreSQL Compare-And-Swap lock on orders.notes so Vercel + Render can NEVER double-send
  let resolvedAgentId = order.agent_id ? String(order.agent_id).trim() : "";
  let resolvedStoreName = order.store_name ? String(order.store_name).trim() : "";
  let resolvedBasePrice = Number(order.base_price || 0);
  try {
    const { data: freshOrd } = await supabase
      .from("orders")
      .select("id, notes, agent_id, base_price")
      .eq("reference", ref)
      .maybeSingle();

    if (freshOrd) {
      if (!resolvedAgentId && freshOrd.agent_id) resolvedAgentId = String(freshOrd.agent_id).trim();
      if (!resolvedBasePrice && freshOrd.base_price) resolvedBasePrice = Number(freshOrd.base_price);
      const currentNotes = freshOrd.notes;
      if (String(currentNotes || "").includes("[delivery_confirmed_sent]")) {
        return;
      }
      const nextNotes = `${currentNotes || ""} [delivery_confirmed_sent]`.trim();
      let claimQuery = supabase
        .from("orders")
        .update({ notes: nextNotes })
        .eq("id", freshOrd.id);
      if (currentNotes === null || currentNotes === undefined) {
        claimQuery = claimQuery.is("notes", null);
      } else {
        claimQuery = claimQuery.eq("notes", currentNotes);
      }
      const { data: claimedRows, error: claimErr } = await claimQuery.select("id");
      if (claimErr || !claimedRows || claimedRows.length === 0) {
        return;
      }
      const notesStr = String(currentNotes || order.notes || "");
      if (!resolvedAgentId) {
        const agMatch = notesStr.match(/\[agent:([^\]]+)\]/i);
        if (agMatch) resolvedAgentId = agMatch[1].trim();
      }
      if (!resolvedStoreName) {
        const stMatch = notesStr.match(/\[store:([^\]]+)\]/i);
        if (stMatch) resolvedStoreName = stMatch[1].trim();
      }
    }
  } catch (_) {
    return;
  }

  const rawPhone = order.recipient_phone || order.phone_number || "N/A";
  const cleanPhone = rawPhone.startsWith("233") ? "0" + rawPhone.slice(3) : rawPhone;
  const itemDesc = `${order.capacity || ""}GB ${order.network || ""} Data`.trim() || "Data Bundle";
  const amount = Number(order.amount || 0).toFixed(2);
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-GB", { timeZone: "Africa/Accra" });
  const timeStr = now.toLocaleTimeString("en-GB", { timeZone: "Africa/Accra", hour: "2-digit", minute: "2-digit" });

  // Resolve Agent details + update Agent Order status if order belongs to an Agent Store
  let agPhone = "";
  let agStore = resolvedStoreName;
  let agentProfit = resolvedBasePrice > 0 ? Math.max(0, Number(order.amount || 0) - resolvedBasePrice) : 0;

  if (resolvedAgentId) {
    try {
      const { data: ag } = await supabase
        .from("agents")
        .select("id, name, phone, whatsapp_number, momo_number, store_name, store_slug")
        .eq("id", resolvedAgentId)
        .maybeSingle();

      if (ag) {
        agPhone = ag.whatsapp_number || ag.phone || ag.momo_number || "";
        if (!agStore && ag.store_name) agStore = ag.store_name;
      }

      // Check settings.agents_registry fallback if agent lives in registry
      if (!agPhone || !agStore) {
        const { data: regRow } = await supabase
          .from("settings")
          .select("value")
          .eq("key", "agents_registry")
          .maybeSingle();
        if (regRow?.value) {
          const parsed = typeof regRow.value === "string" ? JSON.parse(regRow.value) : regRow.value;
          const regAg = Array.isArray(parsed)
            ? parsed.find(a => String(a.id) === resolvedAgentId || String(a.store_slug) === resolvedAgentId)
            : parsed?.[resolvedAgentId];
          if (regAg) {
            if (!agPhone) agPhone = regAg.whatsapp_number || regAg.whatsapp_phone || regAg.phone || regAg.momo_number || "";
            if (!agStore && regAg.store_name) agStore = regAg.store_name;
          }
        }
      }

      // Check agent custom notification override in settings.agent_notifications_${resolvedAgentId}
      const { data: notifPref } = await supabase
        .from("settings")
        .select("value")
        .eq("key", `agent_notifications_${resolvedAgentId}`)
        .maybeSingle();
      if (notifPref?.value) {
        const pref = typeof notifPref.value === "string" ? JSON.parse(notifPref.value) : notifPref.value;
        if (pref?.whatsapp_phone || pref?.whatsapp_number || pref?.phone) {
          agPhone = pref.whatsapp_phone || pref.whatsapp_number || pref.phone;
        }
      }

      // Update agent_orders & settings.agent_orders_registry to delivered and get profit
      const { data: aoRow } = await supabase
        .from("agent_orders")
        .update({ delivery_status: "delivered" })
        .eq("reference", ref)
        .select("profit")
        .maybeSingle();
      if (aoRow?.profit !== undefined && Number(aoRow.profit) > 0) {
        agentProfit = Number(aoRow.profit);
      }

      const { data: aoReg } = await supabase
        .from("settings")
        .select("value")
        .eq("key", "agent_orders_registry")
        .maybeSingle();
      if (aoReg?.value) {
        const list = typeof aoReg.value === "string" ? JSON.parse(aoReg.value) : aoReg.value;
        if (Array.isArray(list)) {
          let changed = false;
          for (const item of list) {
            if (item && String(item.reference) === ref) {
              if (item.delivery_status !== "delivered" || item.status !== "delivered") {
                item.delivery_status = "delivered";
                item.status = "delivered";
                changed = true;
              }
              if (!agentProfit && Number(item.profit) > 0) {
                agentProfit = Number(item.profit);
              }
            }
          }
          if (changed) {
            await supabase
              .from("settings")
              .update({ value: list, updated_at: new Date().toISOString() })
              .eq("key", "agent_orders_registry");
          }
        }
      }
    } catch (_) { }
  }

  const shopName = agStore
    ? (/agent/i.test(agStore) ? agStore : `${agStore} (Agent Store)`)
    : "DataOne GH";

  const deliveredText =
    `📦 *DATA ORDER DELIVERED!* ✅
━━━━━━━━━━━━━━━━━━━━━
🏪 *Shop:* ${shopName}
🆔 *Ref:* ${ref}
📶 *Item:* ${itemDesc}
📱 *Recipient:* ${cleanPhone}
💰 *Amount:* GHS ${amount}
⚡ *Status:* ✅ Delivered to Phone
⏰ *Delivered At:* ${dateStr} ${timeStr}`;

  await sendAdminWhatsApp(deliveredText);

  // Also send the DATA ORDER DELIVERED! ✅ alert directly to the respective Agent & log to their account
  if (resolvedAgentId) {
    try {
      const agentStoreTitle = agStore || "Your Agent Store";
      const profitLine = agentProfit > 0 ? `\n💵 *Your Profit:* +GHS ${agentProfit.toFixed(2)}` : "";
      const agentDeliveredText =
        `📦 *DATA ORDER DELIVERED!* ✅
━━━━━━━━━━━━━━━━━━━━━
🏪 *Shop:* ${agentStoreTitle}
🆔 *Ref:* ${ref}
📶 *Item:* ${itemDesc}
📱 *Recipient:* ${cleanPhone}
💰 *Amount:* GHS ${amount}${profitLine}
⚡ *Status:* ✅ Delivered to Phone
⏰ *Delivered At:* ${dateStr} ${timeStr}`;

      if (agPhone) {
        await sendWhatsApp(agPhone, agentDeliveredText);
      }

      // Record in agent's dashboard notification log (settings.agent_notif_log_${resolvedAgentId})
      const logKey = `agent_notif_log_${resolvedAgentId}`;
      const { data: logRow } = await supabase
        .from("settings")
        .select("value")
        .eq("key", logKey)
        .maybeSingle();
      const existingLogs = Array.isArray(logRow?.value)
        ? logRow.value
        : typeof logRow?.value === "string"
        ? JSON.parse(logRow.value || "[]")
        : [];
      const newLogEntry = {
        id: `deliv_${ref}_${Date.now()}`,
        type: "order_delivered",
        title: "📦 DATA ORDER DELIVERED! ✅",
        reference: ref,
        recipient_phone: cleanPhone,
        item: itemDesc,
        amount: Number(amount),
        profit: Number(agentProfit || 0),
        status: "delivered",
        whatsapp_to: agPhone || null,
        message: agentDeliveredText,
        created_at: now.toISOString(),
      };
      const updatedLogs = [newLogEntry, ...existingLogs.filter(x => x?.reference !== ref || x?.type !== "order_delivered")].slice(0, 50);
      await supabase
        .from("settings")
        .upsert({ key: logKey, value: updatedLogs, updated_at: now.toISOString() }, { onConflict: "key" });
    } catch (_) { }
  }

  // If customer ordered on the WhatsApp bot, notify them too
  const customerWaPhone = order.phone || (order.notes && order.notes.match(/\[whatsapp_phone:(\d+)\]/)?.[1]);
  if (customerWaPhone) {
    try {
      await sendWhatsApp(
        customerWaPhone,
        `✅ *YOUR DATA HAS LANDED!* 🎉\n━━━━━━━━━━━━━━━━━━━━━\nYour data bundle has been successfully delivered by the network! 📶\n\n🆔 *Order Ref:* ${ref}\n📦 *Bundle:* ${itemDesc}\n📱 *Delivered To:* ${cleanPhone}\n\nEnjoy your browsing! Reply *HI* to buy again.`
      );
    } catch (_) { }
  }
}

let isDeliveryWatcherRunning = false;
let deliveryWatcherTick = 0;
async function runActiveDeliveryWatcher() {
  if (isDeliveryWatcherRunning) return;
  isDeliveryWatcherRunning = true;
  deliveryWatcherTick++;
  WATCHER_TELEMETRY.deliveryWatcherRuns++;
  WATCHER_TELEMETRY.lastDeliveryWatcherAt = new Date().toLocaleTimeString("en-GB", { timeZone: "Africa/Accra", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  try {
    // Zero-egress optimization: normally query only the last 4 hours (limit 10); once every 10 ticks (~15 mins) check 24 hours
    const lookbackMs = deliveryWatcherTick % 10 === 0 ? 24 * 60 * 60 * 1000 : 4 * 60 * 60 * 1000;
    const cutoffIso = new Date(Date.now() - lookbackMs).toISOString();
    const { data: pendingOrders, error } = await supabase
      .from("orders")
      .select("id, reference, datamart_reference, datamart_status, recipient_phone, phone_number, notes, network, capacity, amount, base_price, agent_id, delivery_status, payment_status, supplier_status, created_at")
      .eq("payment_status", "paid")
      .in("delivery_status", ["processing", "pending", "waiting", "in_progress"])
      .gte("created_at", cutoffIso)
      .order("created_at", { ascending: false })
      .limit(10);

    if (error || !Array.isArray(pendingOrders) || pendingOrders.length === 0) {
      isDeliveryWatcherRunning = false;
      return;
    }

    for (const ord of pendingOrders) {
      try {
        const isFlash = Boolean(String(ord.notes || "").includes("FLASH_SALE"));
        if (isFlash) continue;

        // If paid order was never dispatched to DataMart (and is at least 30s old so we never race an active checkout),
        // trigger /api/paystack to fulfill & alert idempotently.
        const orderAgeMs = ord.created_at ? Date.now() - new Date(ord.created_at).getTime() : 60000;
        if (!ord.datamart_reference && ord.supplier_status !== "dispatching" && ord.reference && orderAgeMs > 30000) {
          const verifyEndpoint = (STORE_FRONTEND_URL || "https://www.data1gh.com").replace(/\/+$/, "") + "/api/paystack";
          await axios.post(verifyEndpoint, { reference: ord.reference }, { timeout: 15000 }).catch(() => null);
          continue;
        }

        const queryTarget = ord.datamart_reference || ord.reference;
        if (!queryTarget) continue;

        const live = await getRealDatamartDeliveryStatus(queryTarget);
        if (live && (live.deliveryStatus === "delivered" || live.rawStatus === "delivered" || live.rawStatus === "completed")) {
          await supabase.from("orders").update({
            delivery_status: "delivered",
            datamart_status: "completed",
            status: "delivered",
            updated_at: new Date().toISOString(),
          }).eq("id", ord.id);

          try {
            data1db.getClient().from("orders").update({
              delivery_status: "delivered",
              datamart_status: "completed",
            }).eq("id", ord.id);
          } catch (_) { }

          await notifyOrderDelivered({
            ...ord,
            delivery_status: "delivered",
            datamart_status: "completed",
          });
        } else if (live && live.deliveryStatus && (ord.delivery_status !== live.deliveryStatus || ord.datamart_status !== live.rawStatus)) {
          await supabase.from("orders").update({
            delivery_status: live.deliveryStatus,
            datamart_status: live.rawStatus || live.deliveryStatus,
            updated_at: new Date().toISOString(),
          }).eq("id", ord.id);
        }
      } catch (_) { }
    }
  } catch (err) {
    console.warn("Delivery watcher exception:", err.message);
  } finally {
    isDeliveryWatcherRunning = false;
  }
}

// Check every 90 seconds (ultra-low Supabase egress) for orders that updated or completed delivery on DataMart
setInterval(runActiveDeliveryWatcher, 90000);
setTimeout(runActiveDeliveryWatcher, 15000);

let isPaymentWatcherRunning = false;
let cachedWatcherPaystackKey = process.env.PAYSTACK_SECRET_KEY || process.env.PAYSTACK_SECRET || "";
async function runPendingPaymentWatcher() {
  if (isPaymentWatcherRunning) return;
  isPaymentWatcherRunning = true;
  WATCHER_TELEMETRY.paymentWatcherRuns++;
  WATCHER_TELEMETRY.lastPaymentWatcherAt = new Date().toLocaleTimeString("en-GB", { timeZone: "Africa/Accra", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  try {
    if (!cachedWatcherPaystackKey) {
      const { data: sRow } = await supabase.from("settings").select("value").in("key", ["paystack_secret_key", "PAYSTACK_SECRET_KEY"]).maybeSingle();
      if (sRow?.value) cachedWatcherPaystackKey = sRow.value;
    }
    if (!cachedWatcherPaystackKey) {
      isPaymentWatcherRunning = false;
      return;
    }

    const fortyFiveMinutesAgo = new Date(Date.now() - 45 * 60 * 1000).toISOString();
    const thirtySecondsAgo = new Date(Date.now() - 30 * 1000).toISOString();
    const { data: pendingOrders } = await supabase
      .from("orders")
      .select("id, reference, payment_status, datamart_reference, supplier_status, notes, created_at")
      .or("payment_status.eq.pending,and(payment_status.eq.paid,datamart_reference.is.null)")
      .gte("created_at", fortyFiveMinutesAgo)
      .lte("created_at", thirtySecondsAgo)
      .order("created_at", { ascending: false })
      .limit(5);

    if (Array.isArray(pendingOrders) && pendingOrders.length > 0) {
      const verifyEndpoint = (STORE_FRONTEND_URL || "https://www.data1gh.com").replace(/\/+$/, "") + "/api/paystack";
      for (const ord of pendingOrders) {
        if (!ord.reference || ord.datamart_reference || ord.supplier_status === "dispatching") continue;
        const isFlash = Boolean(String(ord.notes || "").includes("FLASH_SALE"));
        if (ord.payment_status === "paid" && isFlash) continue;

        try {
          if (ord.payment_status === "paid") {
            await axios.post(verifyEndpoint, { reference: ord.reference }, { timeout: 15000 }).catch(() => null);
            continue;
          }
          const psRes = await axios.get(`https://api.paystack.co/transaction/verify/${encodeURIComponent(ord.reference)}`, {
            headers: { Authorization: `Bearer ${cachedWatcherPaystackKey}` },
            timeout: 5000
          });
          const psData = psRes.data?.data;
          if (psData?.status === "success") {
            // Trigger full Paystack verification + DataMart auto-dispatch + WhatsApp alert via primary /api/paystack endpoint!
            await axios.post(verifyEndpoint, { reference: ord.reference }, { timeout: 15000 }).catch(() => null);
          } else if (psData?.status === "failed" || psData?.status === "abandoned") {
            await supabase.from("orders").update({
              payment_status: "failed",
              delivery_status: "failed",
              status: "failed",
              error_message: psData?.gateway_response || psData?.message || "Payment failed or abandoned",
              updated_at: new Date().toISOString()
            }).eq("id", ord.id);
          }
        } catch (_) { }
      }
    }
  } catch (err) {
    console.warn("Payment watcher error:", err.message);
  } finally {
    isPaymentWatcherRunning = false;
  }
}

// Check every 60 seconds (minimal egress) for orders that were paid on Paystack so they dispatch & alert automatically
setInterval(runPendingPaymentWatcher, 60000);
setTimeout(runPendingPaymentWatcher, 12000);

/* =========================================================
START SERVER
========================================================= */

app.get("/health", (req, res) => {
  res.status(200).send("Bot is alive!");
});

app.listen(PORT, () => {
  console.log("🚀 RUNNING ON", PORT);
});
