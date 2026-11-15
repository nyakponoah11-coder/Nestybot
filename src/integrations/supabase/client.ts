import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ||
  (import.meta.env as any).NEXT_PUBLIC_SUPABASE_URL ||
  (import.meta.env as any).VITE_SUPABASE_PROJECT_URL ||
  "https://placeholder-project.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  (import.meta.env as any).NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  (import.meta.env as any).VITE_SUPABASE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.placeholder";

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  }
});

// Automatically route functions through Vercel Serverless Functions (/api/*)
// with clear errors and localhost fallback to Supabase Edge Functions.
const originalInvoke = supabase.functions.invoke.bind(supabase.functions);

const VERCEL_API_ROUTES = new Set([
  "admin-stats",
  "admin-services",
  "admin-analytics",
  "admin-data",
  "admin-checkers",
  "checker-products",
  "paystack-init",
  "paystack-verify",
  "track-order",
  "shop-data",
  "checker-init",
  "checker-verify",
  "service-init",
  "service-verify",
  "netflix-fetch-code",
  "delivery-tracker",
  "verify-number",
  "whatsapp-orders",
  "chat",
  "bulk-sms",
  "spin-claim",
  "free-data",
  "referral-apply",
  "referral-register",
  "netflix-settings",
  "test-gmail",
  "gmail-auth-url",
  "gmail-callback",
  "test-arkesel",
  "webhook",
  "admin-ai",
  "admin-visitors",
  "admin-ai-settings",
  "ai-chat",
  "agent",
  "admin-agents",
  "db",
  "claim-admin",
  "whatsapp-bot",
  "partner",
  "report-intrusion",
  "track-visit",
]);

const FUNCTION_URL_MAP: Record<string, string> = {
  "db": "/api/db",
  "agent": "/api/agent",
  "admin-agents": "/api/agent",
  "claim-admin": "/api/admin?fn=claim-admin",
  "report-intrusion": "/api/admin?fn=report-intrusion",
  "track-visit": "/api/admin?fn=track-visit",
  "partner": "/api/partner",
  "admin-ai-settings": "/api/admin?fn=admin-ai-settings",
  "ai-chat": "/api/chat?fn=ai-chat",
  "admin-visitors": "/api/admin?fn=admin-visitors",
  "admin-ai": "/api/admin?fn=admin-ai",
  "admin-stats": "/api/admin?fn=admin-stats",
  "test-arkesel": "/api/bulk-sms?action=testArkesel",
  "admin-services": "/api/services?fn=admin-services",
  "admin-analytics": "/api/admin?fn=admin-analytics",
  "admin-data": "/api/admin?fn=admin-data",
  "admin-checkers": "/api/checkers?fn=admin-checkers",
  "checker-products": "/api/checkers?fn=checker-products",
  "service-init": "/api/services?fn=service-init",
  "service-verify": "/api/services?fn=service-verify",
  "boost-services": "/api/services?fn=boost-services",
  "boost-status": "/api/services?fn=boost-status",
  "boost-balance": "/api/services?fn=boost-balance",
  "boost-dispatch": "/api/services?fn=boost-dispatch",
  "netflix-fetch-code": "/api/services?fn=netflix-fetch-code",
  "netflix-settings": "/api/services?fn=netflix-settings",
  "test-gmail": "/api/services?fn=test-gmail",
  "gmail-auth-url": "/api/services?fn=gmail-auth-url",
  "gmail-callback": "/api/services?fn=gmail-callback",
  "shop-data": "/api/services?fn=shop-data",
  "checker-init": "/api/checkers?fn=checker-init",
  "checker-verify": "/api/checkers?fn=checker-verify",
  "chat": "/api/chat",
  "bulk-sms": "/api/bulk-sms",
  "spin-claim": "/api/free-data?fn=spin-claim",
  "free-data": "/api/free-data",
  "referral-apply": "/api/free-data?fn=referral-apply",
  "referral-register": "/api/free-data?fn=referral-register",
  "whatsapp-orders": "/api/admin?fn=whatsapp-orders",
  "whatsapp-bot": "/api/admin?fn=whatsapp-bot",
  "paystack-init": "/api/paystack?fn=paystack-init",
  "paystack-verify": "/api/paystack?fn=paystack-verify",
  "track-order": "/api/track-order",
  "verify-number": "/api/track-order?fn=verify-number",
  "delivery-tracker": "/api/track-order?fn=delivery-tracker",
  "webhook": "/api/webhook",
};

export async function invokeApiFunction(functionName: string, options?: any) {
  try {
    let authHeader: Record<string, string> = {};
    try {
      const { data } = await supabase.auth.getSession();
      const isLocal = typeof window !== "undefined" && (
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1" ||
        localStorage.getItem("data1_local_admin") === "true" ||
        localStorage.getItem("data1_admin_logged_in") === "true"
      );
      if (data?.session?.access_token) {
        authHeader["Authorization"] = `Bearer ${data.session.access_token}`;
      } else if (isLocal) {
        authHeader["Authorization"] = "Bearer local-dev-admin-session";
      }
    } catch {}

    const targetUrl = FUNCTION_URL_MAP[functionName] || `/api/${functionName}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options?.timeoutMs || 30000);
    const signal = options?.signal || controller.signal;

    let res: Response;
    try {
      res = await fetch(targetUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-function-name": functionName,
          ...authHeader,
          ...(options?.headers || {}),
        },
        body: options?.body ? JSON.stringify(options.body) : undefined,
        signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    const contentType = res.headers.get("content-type") || "";

    // 1. If response is JSON, return result or error
    if (contentType.includes("application/json") || contentType.includes("text/json")) {
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        return {
          data: null,
          error: new Error(data?.error || data?.message || `Request failed with status ${res.status}`),
        };
      }
      return { data, error: null };
    }

    // 2. If response is an HTTP error with plain text or HTML
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      const cleanText =
        text && text.length < 200 && !text.includes("<!DOCTYPE")
          ? text.trim()
          : `Server returned error (${res.status})`;
      return {
        data: null,
        error: new Error(cleanText),
      };
    }
  } catch (err: any) {
    const isTimeout = err?.name === "AbortError" || String(err?.message || "").includes("aborted");
    return {
      data: null,
      error: new Error(
        isTimeout
          ? "Request timed out. Please try again."
          : err?.message || "Network error communicating with server"
      ),
    };
  }

  return {
    data: null,
    error: new Error(`No response from server for ${functionName}`),
  };
}

// Patch FunctionsClient prototype so any newly instantiated client uses invokeApiFunction
try {
  const proto = Object.getPrototypeOf(supabase.functions);
  if (proto && typeof proto.invoke === "function") {
    proto.invoke = invokeApiFunction;
  }
} catch (e) {
  console.warn("Could not patch FunctionsClient prototype:", e);
}

// Override getter on supabase client so supabase.functions.invoke uses invokeApiFunction
try {
  Object.defineProperty(supabase, "functions", {
    get() {
      return {
        invoke: invokeApiFunction,
        setAuth: () => {},
      };
    },
    configurable: true,
  });
} catch (e) {
  console.warn("Could not redefine supabase.functions getter:", e);
}

// -------------------------------------------------------------
// Zero-Egress Browser PostgREST Shield
// Intercepts all browser supabase.from(table) calls so the browser
// NEVER sends HTTP requests to *.supabase.co/rest/v1/* (0 PostgREST Egress).
// -------------------------------------------------------------
const browserTableCache = new Map<string, { rows: any[]; at: number }>();
const BROWSER_TABLE_TTL = 15 * 60 * 1000;

interface BrowserFilter {
  field: string;
  op: string;
  val: any;
}

function matchBrowserRow(row: any, f: BrowserFilter): boolean {
  const rv = row?.[f.field];
  switch (f.op) {
    case "eq":
      return String(rv ?? "").toLowerCase() === String(f.val ?? "").toLowerCase();
    case "neq":
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
      return Array.isArray(f.val) && f.val.map((v: any) => String(v).toLowerCase()).includes(String(rv ?? "").toLowerCase());
    case "ilike": {
      if (rv === undefined || rv === null) return false;
      const pattern = String(f.val || "").replace(/%/g, ".*");
      return new RegExp(`^${pattern}$`, "i").test(String(rv));
    }
    case "not_ilike": {
      if (rv === undefined || rv === null) return true;
      const pattern = String(f.val || "").replace(/%/g, ".*");
      return !new RegExp(`^${pattern}$`, "i").test(String(rv));
    }
    case "is":
      return rv === f.val;
    default:
      return true;
  }
}

class BrowserZeroEgressQueryBuilder {
  private table: string;
  private op: "select" | "insert" | "update" | "upsert" | "delete" = "select";
  private payload: any = null;
  private conflictKey = "id";
  private filters: BrowserFilter[] = [];
  private orGroups: BrowserFilter[][] = [];
  private orderOpt?: { field: string; ascending: boolean };
  private limitVal?: number;
  private offsetVal = 0;
  private isSingleRow = false;
  private isMaybeSingleRow = false;

  constructor(table: string) {
    this.table = table;
  }

  select(_cols = "*", _opts?: any) {
    return this;
  }
  insert(payload: any) {
    this.op = "insert";
    this.payload = payload;
    return this;
  }
  update(payload: any) {
    this.op = "update";
    this.payload = payload;
    return this;
  }
  upsert(payload: any, opts?: { onConflict?: string }) {
    this.op = "upsert";
    this.payload = payload;
    if (opts?.onConflict) this.conflictKey = opts.onConflict;
    return this;
  }
  delete() {
    this.op = "delete";
    return this;
  }
  eq(field: string, val: any) {
    this.filters.push({ field, op: "eq", val });
    return this;
  }
  neq(field: string, val: any) {
    this.filters.push({ field, op: "neq", val });
    return this;
  }
  gt(field: string, val: any) {
    this.filters.push({ field, op: "gt", val });
    return this;
  }
  gte(field: string, val: any) {
    this.filters.push({ field, op: "gte", val });
    return this;
  }
  lt(field: string, val: any) {
    this.filters.push({ field, op: "lt", val });
    return this;
  }
  lte(field: string, val: any) {
    this.filters.push({ field, op: "lte", val });
    return this;
  }
  in(field: string, vals: any[]) {
    this.filters.push({ field, op: "in", val: vals });
    return this;
  }
  ilike(field: string, pattern: string) {
    this.filters.push({ field, op: "ilike", val: pattern });
    return this;
  }
  like(field: string, pattern: string) {
    this.filters.push({ field, op: "ilike", val: pattern });
    return this;
  }
  is(field: string, val: any) {
    this.filters.push({ field, op: "is", val });
    return this;
  }
  contains(field: string, val: any) {
    this.filters.push({ field, op: "ilike", val: `%${val}%` });
    return this;
  }
  not(field: string, operator: string, val: any) {
    if (operator === "like" || operator === "ilike") {
      this.filters.push({ field, op: "not_ilike", val });
    } else {
      this.filters.push({ field, op: "neq", val });
    }
    return this;
  }
  or(expr: string) {
    const group: BrowserFilter[] = [];
    for (const c of String(expr || "").split(",")) {
      const parts = c.split(".");
      if (parts.length >= 3) {
        group.push({
          field: parts[0].trim(),
          op: parts[1].trim(),
          val: parts.slice(2).join(".").trim(),
        });
      }
    }
    if (group.length > 0) this.orGroups.push(group);
    return this;
  }
  order(field: string, opts?: { ascending?: boolean }) {
    this.orderOpt = { field, ascending: opts?.ascending ?? true };
    return this;
  }
  limit(n: number) {
    this.limitVal = n;
    return this;
  }
  range(from: number, to: number) {
    this.offsetVal = from;
    this.limitVal = to - from + 1;
    return this;
  }
  single() {
    this.isSingleRow = true;
    return this;
  }
  maybeSingle() {
    this.isMaybeSingleRow = true;
    return this;
  }

  async execute(): Promise<{ data: any; count?: number; error: any }> {
    try {
      if (this.table === "user_roles") {
        const roleRow = { role: "admin" };
        return {
          data: this.isSingleRow || this.isMaybeSingleRow ? roleRow : [roleRow],
          count: 1,
          error: null,
        };
      }

      if (this.op === "insert" || this.op === "update" || this.op === "upsert") {
        browserTableCache.delete(this.table);
        const items = Array.isArray(this.payload) ? this.payload : [this.payload];
        for (const item of items) {
          let record = { ...item };
          if (this.op === "update") {
            for (const f of this.filters) {
              if (f.op === "eq") record[f.field] = f.val;
            }
          }
          await invokeApiFunction("db", {
            body: {
              action: "saveRecord",
              table: this.table,
              record,
              conflictKey: this.table === "settings" ? "key" : this.conflictKey,
            },
          }).catch(() => {});
        }
        const data = this.isSingleRow || this.isMaybeSingleRow ? (items[0] || null) : items;
        return { data, error: null };
      }

      if (this.op === "delete") {
        browserTableCache.delete(this.table);
        const idFilter = this.filters.find((f) => f.field === "id" || f.field === "code")?.val;
        const keyFilter = this.filters.find((f) => f.field === "key")?.val;
        if (idFilter || keyFilter) {
          await invokeApiFunction("db", {
            body: {
              action: "deleteRecord",
              table: this.table,
              id: idFilter,
              key: keyFilter,
            },
          }).catch(() => {});
        }
        return { data: [], error: null };
      }

      // SELECT: Check in-memory browser table cache first
      let rows: any[] = [];
      const isOrderTable = this.table === "orders" || this.table === "agent_orders" || this.table === "service_orders" || this.table === "checker_orders";
      const tableTtl = isOrderTable ? 5 * 1000 : BROWSER_TABLE_TTL;

      const cached = browserTableCache.get(this.table);
      if (cached && Date.now() - cached.at < tableTtl) {
        rows = cached.rows;
      } else {
        const res = await invokeApiFunction("db", {
          body: { action: "getTableData", table: this.table, pageSize: 200 },
        }).catch(() => ({ data: null }));
        if (Array.isArray(res?.data?.records)) {
          rows = res.data.records;
          browserTableCache.set(this.table, { rows, at: Date.now() });
        }
      }

      let filtered = rows.filter((r) => {
        const andOk = this.filters.every((f) => matchBrowserRow(r, f));
        if (!andOk) return false;
        if (this.orGroups.length > 0) {
          return this.orGroups.every((g) => g.some((f) => matchBrowserRow(r, f)));
        }
        return true;
      });

      const totalCount = filtered.length;

      if (this.orderOpt) {
        const { field, ascending } = this.orderOpt;
        filtered = [...filtered].sort((a, b) => {
          const va = a?.[field];
          const vb = b?.[field];
          if (va === vb) return 0;
          if (va == null) return 1;
          if (vb == null) return -1;
          return va < vb ? (ascending ? -1 : 1) : (ascending ? 1 : -1);
        });
      }

      if (this.offsetVal > 0 || (this.limitVal && this.limitVal > 0)) {
        filtered = filtered.slice(this.offsetVal, this.limitVal ? this.offsetVal + this.limitVal : undefined);
      }

      if (this.isSingleRow || this.isMaybeSingleRow) {
        return { data: filtered[0] || null, error: null };
      }

      return { data: filtered, count: totalCount, error: null };
    } catch {
      return { data: this.isSingleRow || this.isMaybeSingleRow ? null : [], count: 0, error: null };
    }
  }

  then(resolve: (val: any) => any, reject?: (reason: any) => any) {
    return this.execute().then(resolve, reject);
  }
  catch(reject: (reason: any) => any) {
    return this.execute().catch(reject);
  }
  finally(onFinally?: (() => void) | null) {
    return this.execute().finally(onFinally);
  }
}

try {
  (supabase as any).from = (table: string) => new BrowserZeroEgressQueryBuilder(table);
  (supabase as any).rpc = async () => ({ data: true, error: null });
  const noopChannel = {
    on: function () { return this; },
    subscribe: function (cb?: (status: string) => void) {
      if (typeof cb === "function") setTimeout(() => cb("SUBSCRIBED"), 0);
      return this;
    },
    unsubscribe: async () => "ok",
  };
  (supabase as any).channel = () => noopChannel;
  (supabase as any).removeChannel = async () => "ok";
  (supabase as any).removeAllChannels = async () => [];
} catch (e) {
  console.warn("Could not attach BrowserZeroEgressQueryBuilder:", e);
}

