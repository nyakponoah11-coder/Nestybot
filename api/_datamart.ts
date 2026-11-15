import { data1db } from './_data1db.js';
import { cleanApiKey, getEnvVar, getCachedSettings } from "./_supabase.js";

export const VERIFIED_DATAMART_KEY = "836d191d47c4c1a6ac0fa47eaab4d5da550034056732db23e80f38632a889ee8";
export const VERIFIED_DATAMART_SECRET = "5CNIgdcHstmB2vAvePCTm5RpCg3sodoK";

export interface DatamartSyncResult {
  found: boolean;
  rawStatus?: string;
  deliveryStatus?: string;
  datamart_reference?: string;
  datamart_status?: string;
  error?: string;
}

export function resolveDatamartKeysSync(): string[] {
  const keys: string[] = [];
  const add = (v: any) => {
    const c = cleanApiKey(v);
    if (c && c.length > 3 && !keys.includes(c)) keys.push(c);
  };

  const envKey = cleanApiKey(
    getEnvVar([
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
      "datamart_api_key",
      "datamart_key",
      "data_api_key",
      "dm_api_key",
      "dm_key",
      "SUPPLIER_API_KEY",
      "PROVIDER_API_KEY",
    ])
  );
  if (envKey) add(envKey);

  // Scan ALL process.env keys (case-insensitive, normalized) for any key containing datamart or dm
  for (const [k, v] of Object.entries(process.env)) {
    const lower = k.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (lower.includes("secret")) continue;
    if (
      (lower.includes("datamart") || lower.includes("datamt") || lower.startsWith("dm")) &&
      (lower.includes("key") || lower.includes("token") || lower.includes("api"))
    ) {
      add(v);
    }
  }

  // Ensure authoritative verified DataMart developer key is always present
  add(VERIFIED_DATAMART_KEY);

  return keys;
}

let cachedDmSecret = "";

export function getDatamartSecret(): string {
  const envSec = cleanApiKey(
    getEnvVar([
      "DATAMART_API_SECRET",
      "DATAMART_SECRET",
      "DATAMART_SECRET_KEY",
      "DATAMART_API_SECRET_KEY",
      "DM_API_SECRET",
      "DM_SECRET",
      "DM_SECRET_KEY",
      "datamart_api_secret",
      "datamart_secret",
      "datamart_secret_key",
      "VITE_DATAMART_API_SECRET",
      "VITE_DATAMART_SECRET",
      "X_API_SECRET",
      "x_api_secret",
    ])
  );
  if (envSec) {
    cachedDmSecret = envSec;
    return envSec;
  }

  // Scan ALL process.env keys for any matching datamart and secret
  for (const [k, v] of Object.entries(process.env)) {
    const lower = k.toLowerCase().replace(/[^a-z0-9]/g, "");
    if ((lower.includes("datamart") || lower.includes("datamt") || lower.startsWith("dm")) && lower.includes("secret")) {
      const c = cleanApiKey(v);
      if (c && c.length > 2) {
        cachedDmSecret = c;
        return c;
      }
    }
  }
  try {
    const rows = data1db.loadTable("settings");
    for (const r of rows) {
      const k = String(r?.key || "").toLowerCase();
      if (
        k === "datamart_api_secret" ||
        k === "datamart_secret" ||
        k === "dm_api_secret" ||
        k === "datamart_secret_key"
      ) {
        const c = cleanApiKey(r.value);
        if (c && c.length > 2) {
          cachedDmSecret = c;
          return c;
        }
      }
    }
  } catch {}
  return cachedDmSecret || VERIFIED_DATAMART_SECRET;
}

export async function resolveDatamartSecret(supabase?: any): Promise<string> {
  const syncSec = getDatamartSecret();
  if (syncSec) return syncSec;
  try {
    const sMap = await getCachedSettings(supabase);
    for (const [key, val] of Object.entries(sMap)) {
      const k = key.toLowerCase();
      if (
        k === "datamart_api_secret" ||
        k === "datamart_secret" ||
        k === "dm_api_secret" ||
        k === "datamart_secret_key"
      ) {
        const c = cleanApiKey(val);
        if (c && c.length > 2) {
          cachedDmSecret = c;
          return c;
        }
      }
    }
  } catch {}
  return cachedDmSecret || getDatamartSecret() || VERIFIED_DATAMART_SECRET;
}

export function getDatamartAuthHeaders(apiKey: string, secret?: string): Record<string, string> {
  const clean = cleanApiKey(apiKey);
  const sec = cleanApiKey(secret !== undefined ? secret : getDatamartSecret());
  // IMPORTANT: Set only single lowercase header names to prevent Node.js fetch from joining duplicates into "key, key"
  const headers: Record<string, string> = {
    "x-api-key": clean,
    Accept: "application/json",
  };
  if (sec) {
    headers["x-api-secret"] = sec;
  }
  return headers;
}

export async function resolveDatamartKeys(supabase: any, force = false): Promise<string[]> {
  const keys = resolveDatamartKeysSync();
  try {
    let sMap = await getCachedSettings(supabase, force);
    const hasDmInMap = Object.keys(sMap).some(k => k.toLowerCase().includes("datamart") || k.toLowerCase().includes("data_api"));
    if (!hasDmInMap && keys.length === 0) {
      sMap = await getCachedSettings(supabase, true);
    }
    for (const [key, val] of Object.entries(sMap)) {
      const k = key.toLowerCase();
      if (
        k === "datamart_api_secret" ||
        k === "datamart_secret" ||
        k === "dm_api_secret" ||
        k === "datamart_secret_key"
      ) {
        const secVal = cleanApiKey(val);
        if (secVal && secVal.length > 2) cachedDmSecret = secVal;
        continue;
      }
      if (
        k === "datamart_api_key" ||
        k === "data_api_key" ||
        k === "datamart_key" ||
        k === "dm_api_key" ||
        k === "dm_key" ||
        (k.includes("datamart") && k.includes("key") && !k.includes("secret"))
      ) {
        const c = cleanApiKey(val);
        if (c && !keys.includes(c)) keys.push(c);
      }
    }
  } catch {}
  return keys;
}

/**
 * Maps DataMart API orderStatus values to internal delivery_status.
 * DataMart values: completed | delivered | failed | cancelled | rejected | refunded | waiting | processing | pending
 * Internal statuses: completed | failed | refunded | waiting | processing
 *
 * CRITICAL: "success" or "ok" is an HTTP/API response wrapper flag, NOT a delivery status!
 * An order whose delivery status has not explicitly completed is still "processing".
 */
export function mapDatamartStatus(s: string | undefined | null): string {
  const v = (s || "").toLowerCase().trim();
  if (!v) return "processing";

  // Explicit failure
  if (
    v === "failed" ||
    v === "failure" ||
    v === "cancelled" ||
    v === "canceled" ||
    v === "rejected" ||
    v === "declined"
  ) {
    return "failed";
  }

  // Refunded
  if (v === "refunded" || v === "refund") {
    return "refunded";
  }

  // Telecom delivery completion:
  if (
    v === "delivered" ||
    v === "completed" ||
    v === "fulfilled" ||
    v === "done"
  ) {
    return "delivered";
  }

  // Waiting in queue / Pending
  if (v === "waiting" || v === "pending" || v === "queued") {
    return "pending";
  }

  // In-progress states
  if (
    v === "processing" ||
    v === "in_progress" ||
    v === "in-progress" ||
    v === "initiated"
  ) {
    return "processing";
  }

  return "processing";
}

/**
 * Reads explicit delivery orderStatus from DataMart API payloads.
 * Strictly ignores top-level HTTP/wrapper "status": "success" and wallet ledger status: "completed".
 */
export function extractDataMartOrderStatus(json: any): string | null {
  if (!json) return null;
  const d = json.data && typeof json.data === "object" ? json.data : json;

  // Authoritative telecom delivery fields ONLY
  const candidate =
    d.orderStatus ??
    d.order_status ??
    d.deliveryStatus ??
    d.delivery_status ??
    d.relatedPurchase?.orderStatus ??
    d.relatedPurchase?.order_status ??
    d.relatedPurchase?.deliveryStatus ??
    d.relatedPurchase?.delivery_status;

  if (candidate === undefined || candidate === null) return null;
  const str = String(candidate).toLowerCase().trim();
  if (!str) return null;

  // Generic HTTP flags or ledger flags must never masquerade as telecom delivery statuses
  if (["success", "ok", "true", "false", "completed"].includes(str)) {
    // Only accept "completed" if it comes explicitly from orderStatus / deliveryStatus
    if (d.orderStatus || d.order_status || d.deliveryStatus || d.delivery_status || d.relatedPurchase?.orderStatus) {
      return str;
    }
    return null;
  }

  return str;
}

export function extractDataMartReference(json: any): string | null {
  if (!json) return null;
  const d = json.data && typeof json.data === "object" ? json.data : json;
  const rp = d.relatedPurchase;

  const candidate =
    d.reference ??
    d.orderReference ??
    d.order_reference ??
    d.trackingId ??
    d.track ??
    d.purchaseId ??
    d.orderId ??
    rp?.orderReference ??
    rp?.reference ??
    rp?.trackingId ??
    d.id;

  if (candidate !== undefined && candidate !== null && String(candidate).trim()) {
    return String(candidate).trim();
  }
  return null;
}

/**
 * Checks and confirms order status DIRECTLY from the DataMart API key.
 * Bypasses any optimistic 200 OK wrapper responses.
 */
export async function verifyDatamartOrderStatusDirect(
  queryId: string,
  keys: string[]
): Promise<DatamartSyncResult> {
  const cleanId = String(queryId || "").trim();
  if (!cleanId || !keys.length) {
    return { found: false, error: "Missing query ID or API keys" };
  }

  // Only query authoritative order status endpoints
  const urls = [
    `https://api.datamartgh.shop/api/developer/order-status/${encodeURIComponent(cleanId)}`,
    `https://api.datamartgh.shop/api/order-status/${encodeURIComponent(cleanId)}`,
  ];

  for (const url of urls) {
    for (const key of keys) {
      try {
        let res = await fetch(url, {
          headers: getDatamartAuthHeaders(key),
          signal: AbortSignal.timeout(5000),
        });
        if (res.ok) {
          const json = await res.json().catch(() => null);
          const rawStatus = extractDataMartOrderStatus(json);
          const foundRef = extractDataMartReference(json) || cleanId;
          if (rawStatus) {
            const deliveryStatus = mapDatamartStatus(rawStatus);
            return {
              found: true,
              rawStatus,
              deliveryStatus,
              datamart_status: rawStatus,
              datamart_reference: foundRef,
              error: json?.data?.failureReason || json?.data?.message || json?.message,
            };
          }
        }
      } catch {}
    }
  }

  // 2. Query /developer/transactions directly if order-status 404s
  for (const key of keys) {
    try {
      const url = `https://api.datamartgh.shop/api/developer/transactions?limit=25&search=${encodeURIComponent(cleanId)}`;
      let res = await fetch(url, {
        headers: getDatamartAuthHeaders(key),
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const json = await res.json().catch(() => null);
        const items =
          json?.data?.transactions ||
          json?.transactions ||
          (Array.isArray(json?.data) ? json.data : []) ||
          [];
        for (const item of items) {
          const tRef = String(item.reference || item.ref || "").trim();
          const desc = String(item.description || "");
          if (tRef === cleanId || desc.includes(cleanId)) {
            const rp = item.relatedPurchase || {};
            // In transactions, item.status represents the wallet debit ("completed"), NOT telecom bundle delivery.
            // Telecom bundle delivery status exists ONLY in relatedPurchase.orderStatus or relatedPurchase.deliveryStatus.
            const explicit = rp.orderStatus || rp.deliveryStatus || item.orderStatus || item.deliveryStatus;
            const rawStatus = explicit ? String(explicit).toLowerCase().trim() : "processing";
            const deliveryStatus = mapDatamartStatus(rawStatus);
            return {
              found: true,
              rawStatus,
              deliveryStatus,
              datamart_status: rawStatus,
              datamart_reference: tRef || cleanId,
            };
          }
        }
      }
    } catch {}
  }

  return { found: false, error: "Direct API status query returned no valid status" };
}

/**
 * Queries DataMart for the real live status of an order.
 * Queries /developer/order-status with merchant ref first, then checks /developer/transactions.
 */
export async function queryDatamartLiveStatus(
  order: any,
  keys: string[]
): Promise<DatamartSyncResult> {
  if (!order || !keys.length) {
    return { found: false, error: "Missing order or DataMart API keys" };
  }

  const orderDatamartRef = String(order.datamart_reference || "").trim();
  const orderRef = String(order.reference || "").trim();
  const rawPhone = String(order.recipient_phone || order.phone_number || "").replace(/\D/g, "");
  const last9 = rawPhone.length >= 9 ? rawPhone.slice(-9) : rawPhone;
  const orderPhone = last9 ? ("0" + last9) : "";
  const orderCreatedAt = order.created_at ? new Date(order.created_at).getTime() : Date.now();

  let orderCapGb = parseFloat(String(order.capacity || "0").replace(/[^0-9.]/g, ""));
  if (orderCapGb >= 100) orderCapGb = orderCapGb / 1000;

  // 1. Direct query /developer/order-status/:id first
  // CRITICAL: The merchant order reference (WS-...) MUST be queried FIRST because DataMart's
  // order-status endpoint is indexed strictly by the purchase reference (WS-...).
  // Internal wallet ledger references (TRX-...) return 404 on order-status!
  const directRefs = [
    orderRef.startsWith("WS-") ? orderRef : null,
    orderRef,
    orderDatamartRef.startsWith("WS-") ? orderDatamartRef : null,
    orderDatamartRef,
  ].filter(Boolean) as string[];
  const uniqueDirectRefs = [...new Set(directRefs)];

  for (const refCandidate of uniqueDirectRefs) {
    const directResult = await verifyDatamartOrderStatusDirect(refCandidate, keys);
    if (directResult.found) {
      return directResult;
    }
  }

  // 2. Search queries to check against /developer/transactions
  const searchQueries: string[] = [];
  if (orderRef) searchQueries.push(orderRef);
  if (orderDatamartRef) searchQueries.push(orderDatamartRef);
  // Only search by phone if order was actually dispatched or if strict phone matching
  if (orderDatamartRef && orderPhone) searchQueries.push(orderPhone);

  for (const key of keys) {
    for (const q of searchQueries) {
      try {
        const url = `https://api.datamartgh.shop/api/developer/transactions?limit=50${q ? `&search=${encodeURIComponent(q)}` : ""}`;
        let res = await fetch(url, {
          headers: getDatamartAuthHeaders(key),
          signal: AbortSignal.timeout(6000),
        });
        if (res.ok) {
          const json = await res.json().catch(() => null);
          const items: any[] =
            json?.data?.transactions ||
            json?.transactions ||
            (Array.isArray(json?.data) ? json.data : []) ||
            [];

          for (const item of items) {
            const rp = item.relatedPurchase || {};
            const tRef = String(item.reference || item.ref || "").trim();
            const tId = String(item._id || item.id || "").trim();
            const rpId = String(rp._id || rp.id || "").trim();
            const rpRef = String(rp.orderReference || rp.reference || "").trim();

            const isRefMatch = Boolean(
              (orderDatamartRef && (tRef === orderDatamartRef || tId === orderDatamartRef || rpId === orderDatamartRef || rpRef === orderDatamartRef)) ||
              (orderRef && (tRef === orderRef || rpRef === orderRef))
            );

            // Extract unmasked phone from item.description (e.g. "Data purchase: 2GB YELLO for 0594975420")
            const descPhoneMatch = (item.description || "").match(/(?:0|\+?233)?(\d{9})/);
            const descPhone = descPhoneMatch ? descPhoneMatch[1] : "";
            const tCap = Number(rp.capacity ?? 0);
            const tTime = new Date(item.createdAt || item.created_at || Date.now()).getTime();

            // Phone matching must be STRICT:
            // 1. Transaction must have occurred AFTER or right around the order creation time (+/- 2 minutes to 30 minutes after).
            // 2. It must NEVER match an old transaction that was created hours before the customer placed this new order!
            const isPhoneMatch = Boolean(
              last9 &&
              (descPhone.endsWith(last9) || String(item.description || "").includes(last9)) &&
              (!orderCapGb || !tCap || Math.abs(orderCapGb - tCap) < 0.15) &&
              (tTime >= orderCreatedAt - 120000 && tTime <= orderCreatedAt + 30 * 60 * 1000)
            );

            if (isRefMatch || isPhoneMatch) {
              // item.status is only wallet debit ("completed").
              // Telecom bundle delivery status is strictly in rp.orderStatus or rp.deliveryStatus.
              const explicit = rp.orderStatus || rp.deliveryStatus || item.orderStatus || item.deliveryStatus;
              const rawStatus = explicit ? String(explicit).toLowerCase().trim() : "processing";
              const deliveryStatus = mapDatamartStatus(rawStatus);
              const foundRef = tRef || rpRef || orderDatamartRef || tId;

              return {
                found: true,
                rawStatus,
                deliveryStatus,
                datamart_status: rawStatus,
                datamart_reference: foundRef,
              };
            }
          }
        }
      } catch {}
    }
  }

  return { found: false, error: "Order not found on DataMart status endpoints" };
}

/**
 * Syncs the given order with DataMart and saves the real live status to the database.
 * Returns the updated order object.
 */
export async function syncOrderWithDatamart(
  order: any,
  supabase: any,
  keys?: string[]
): Promise<any> {
  if (!order) return order;

  // WhatsApp bot orders are already paid
  if (
    order.whatsapp_phone ||
    order.network === "MASHUP" ||
    (order.ref && String(order.ref).startsWith("MASHUP"))
  ) {
    order.payment_status = "paid";
  }

  // Only sync paid orders
  if (order.payment_status !== "paid") {
    return order;
  }

  // If already delivered, no need to query provider API repeatedly
  if (order.delivery_status === "delivered") {
    try {
      data1db.getClient().from("orders").upsert(order);
    } catch (_) {}
    return order;
  }

  const resolvedKeys = keys && keys.length ? keys : await resolveDatamartKeys(supabase);
  if (!resolvedKeys.length) {
    return order;
  }

  const live = await queryDatamartLiveStatus(order, resolvedKeys);
  if (live.found && live.deliveryStatus) {
    const updates: Record<string, any> = {
      delivery_status: live.deliveryStatus,
      updated_at: new Date().toISOString(),
    };
    if (live.datamart_reference) {
      updates.datamart_reference = live.datamart_reference;
    }

    if (live.deliveryStatus === "failed") {
      updates.error_message =
        live.error ||
        order.error_message ||
        "Delivery could not be completed by network supplier";
    } else {
      updates.error_message = null;
    }

    try {
      const { data: updated } = await supabase
        .from("orders")
        .update(updates)
        .eq("id", order.id)
        .select("*")
        .maybeSingle();

      const merged = {
        ...order,
        ...updates,
        ...(updated || {}),
        datamart_status: live.datamart_status,
      };
      try {
        data1db.getClient().from("orders").upsert(merged);
      } catch (_) {}

      // Fire delivery alert if order just transitioned from processing to delivered!
      if (
        live.deliveryStatus === "delivered" &&
        order.delivery_status !== "delivered" &&
        !String(order.notes || "").includes("[delivery_confirmed_sent]")
      ) {
        try {
          const { sendOrderDeliveredNotification } = await import("./_notifications.js");
          await sendOrderDeliveredNotification({
            reference: order.reference,
            amount: order.amount,
            capacity: order.capacity,
            network: order.network,
            recipientPhone: order.recipient_phone,
            agentId: order.agent_id,
            agentStoreName: order.store_name,
            whatsappPhone: order.whatsapp_phone,
          }, supabase);
        } catch (_) {}
      }

      if (updated) {
        return merged;
      }
    } catch (dbErr) {
      console.warn("Could not save delivery status update to Supabase orders:", dbErr);
    }

    const fallbackMerged = {
      ...order,
      ...updates,
      datamart_status: live.datamart_status,
    };
    try {
      data1db.getClient().from("orders").upsert(fallbackMerged);
    } catch (_) {}
    return fallbackMerged;
  }

  return order;
}

/**
 * Strips all internal DataMart details from orders returned to customers.
 * Customers should see real statuses (processing, completed, failed, refunded)
 * but NEVER provider names, provider refs, or supplier error notes.
 */
export function sanitizeCustomerOrder(order: any) {
  if (!order) return null;
  let cleanErrorMessage: string | undefined = undefined;

  if (["failed", "unknown"].includes(order.delivery_status) && order.error_message) {
    const lower = String(order.error_message).toLowerCase();
    if (
      lower.includes("datamart") ||
      lower.includes("api key") ||
      lower.includes("wallet") ||
      lower.includes("gateway") ||
      lower.includes("supplier") ||
      lower.includes("provider") ||
      lower.includes("dispatch")
    ) {
      cleanErrorMessage = "Delivery could not be completed automatically. Our support team has been notified.";
    } else {
      cleanErrorMessage = order.error_message;
    }
  }

  return {
    id: order.id,
    reference: order.reference,
    network: order.network,
    capacity: order.capacity,
    mb: order.mb,
    amount: order.amount,
    recipient_phone: order.recipient_phone || order.phone_number,
    payment_status: order.payment_status,
    delivery_status: order.delivery_status,
    error_message: cleanErrorMessage,
    created_at: order.created_at,
  };
}

export interface DatamartPurchaseResult {
  success: boolean;
  status: number;
  data: any;
  reference?: string;
  error?: string;
  isLowBalance?: boolean;
}

// 🔒 In-memory dispatch lock tracker (keyed by normalized reference or phone+capacity)
const activeDispatchLocks = new Map<string, number>();

export function isDispatchLocked(reference: string): boolean {
  if (!reference) return false;
  const key = reference.trim().toUpperCase();
  const lockedAt = activeDispatchLocks.get(key);
  if (!lockedAt) return false;
  // Locks expire after 45 seconds to prevent deadlock
  if (Date.now() - lockedAt > 45000) {
    activeDispatchLocks.delete(key);
    return false;
  }
  return true;
}

export function acquireDispatchLock(reference: string): boolean {
  if (!reference) return false;
  const key = reference.trim().toUpperCase();
  if (isDispatchLocked(key)) return false;
  activeDispatchLocks.set(key, Date.now());
  return true;
}

export function releaseDispatchLock(reference: string): void {
  if (!reference) return;
  activeDispatchLocks.delete(reference.trim().toUpperCase());
}

/**
 * Atomically claim order dispatch in the Supabase database.
 * Sets supplier_status = 'dispatching'.
 * Returns true if this thread/process acquired the lock.
 * Returns false if the order is already dispatched or another process is dispatching it right now.
 */
export async function claimOrderDispatchLock(
  orderIdOrRef: string,
  supabase: any
): Promise<boolean> {
  if (!orderIdOrRef || !supabase) return false;

  const now = new Date().toISOString();
  const cleanId = String(orderIdOrRef).trim();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanId);

  try {
    // 1. In-memory check first (fastest rejection on same instance)
    const memKey = cleanId.toUpperCase();
    if (!acquireDispatchLock(memKey)) {
      return false;
    }

    // 2. Database atomic check
    let checkQ = supabase
      .from("orders")
      .select("id, reference, datamart_reference, supplier_status, delivery_status, updated_at");
    checkQ = isUuid ? checkQ.eq("id", cleanId) : checkQ.eq("reference", cleanId);
    const { data: row } = await checkQ.maybeSingle();

    if (!row) {
      releaseDispatchLock(memKey);
      return false;
    }

    // Already dispatched to DataMart!
    if (row.datamart_reference) {
      return false;
    }

    // Already marked delivered or completed!
    const ds = (row.delivery_status || "").toLowerCase();
    if (ds === "delivered" || ds === "completed") {
      return false;
    }

    // Check if another concurrent process is currently dispatching
    if (row.supplier_status === "dispatching") {
      const updatedAt = row.updated_at ? new Date(row.updated_at).getTime() : 0;
      // If locked less than 90 seconds ago, respect the lock!
      if (Date.now() - updatedAt < 90000) {
        return false;
      }
    }

    // Atomically set supplier_status = 'dispatching' ONLY IF datamart_reference IS NULL
    let updateQ = supabase
      .from("orders")
      .update({
        supplier_status: "dispatching",
        updated_at: now,
      })
      .eq("id", row.id)
      .is("datamart_reference", null);

    // If previous status wasn't expired dispatching, ensure we don't overwrite another concurrent dispatch
    if (row.supplier_status !== "dispatching") {
      updateQ = updateQ.or("supplier_status.is.null,supplier_status.neq.dispatching");
    }

    const { data: claimed, error } = await updateQ.select("id");
    if (error || !claimed || claimed.length === 0) {
      releaseDispatchLock(memKey);
      return false;
    }

    return true;
  } catch (err) {
    console.warn("claimOrderDispatchLock error:", err);
    return false;
  }
}

/**
 * Release an atomic dispatch lock in Supabase if dispatch failed or needs reset.
 */
export async function releaseOrderDispatchLock(
  orderIdOrRef: string,
  supabase: any,
  finalSupplierStatus: string = "pending"
): Promise<void> {
  if (!orderIdOrRef || !supabase) return;
  const cleanId = String(orderIdOrRef).trim();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanId);

  try {
    releaseDispatchLock(cleanId.toUpperCase());

    let q = supabase
      .from("orders")
      .update({
        supplier_status: finalSupplierStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("supplier_status", "dispatching");

    q = isUuid ? q.eq("id", cleanId) : q.eq("reference", cleanId);
    await q;
  } catch (_) {}
}

/**
 * Robust multi-tier DataMart purchase executor.
 * 1. Clean single x-api-key header (prevents Node fetch duplicate header bug)
 * 2. Optional x-api-secret if configured
 * 3. Fallback without x-api-secret if 401/403 or invalid key returned
 * 4. Fallback with Authorization: Bearer <key>
 * 5. Fallback without 'ref' in payload if reference causes rejection
 */
export async function executeDatamartPurchase(params: {
  apiKey?: string;
  secret?: string;
  phoneNumber: string;
  network: string;
  capacity: string;
  reference: string;
  skipLock?: boolean;
}): Promise<DatamartPurchaseResult> {
  const cleanKey = cleanApiKey(params.apiKey) || VERIFIED_DATAMART_KEY;
  const passedSec = cleanApiKey(params.secret);
  let cleanSec = passedSec || getDatamartSecret() || VERIFIED_DATAMART_SECRET;
  if (cleanKey === VERIFIED_DATAMART_KEY) {
    cleanSec = VERIFIED_DATAMART_SECRET;
  }
  const cleanPhone = params.phoneNumber;
  const dmNetwork = params.network;
  const cleanCapacity = params.capacity;
  const rawRef = String(params.reference || "").trim();
  const cleanRef = rawRef.replace(/^WS[-_]?/i, "");
  const dmRef = `WS-${cleanRef || Math.random().toString(36).slice(2, 10).toUpperCase()}`;

  const memKey = (dmRef || rawRef).toUpperCase();
  if (!params.skipLock && isDispatchLocked(memKey)) {
    return {
      success: false,
      status: 409,
      data: { message: "Dispatch already in progress for this reference" },
      error: "Dispatch already in progress for this reference",
    };
  }
  if (!params.skipLock) {
    acquireDispatchLock(memKey);
  }

  try {
    const basePayload = {
      phoneNumber: cleanPhone,
      network: dmNetwork,
      capacity: cleanCapacity,
      gateway: "wallet",
      delivery: "fast",
      ref: dmRef,
    };

    const url = "https://api.datamartgh.shop/api/developer/purchase";

    const attempts: Array<{
      headers: Record<string, string>;
      includeRef: boolean;
      label: string;
    }> = [];

    // Always include ref: dmRef in every attempt so DataMart enforces strict reference idempotency
    // and never creates a duplicate order if an earlier attempt timed out.
    if (cleanSec) {
      attempts.push({
        headers: {
          "x-api-key": cleanKey,
          "x-api-secret": cleanSec,
          "X-Idempotency-Key": dmRef,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        includeRef: true,
        label: "x-api-key + x-api-secret",
      });

      attempts.push({
        headers: {
          Authorization: `Bearer ${cleanKey}`,
          "x-api-key": cleanKey,
          "x-api-secret": cleanSec,
          "X-Idempotency-Key": dmRef,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        includeRef: true,
        label: "Bearer + x-api-secret",
      });
    } else {
      // Attempts without secret (only for accounts that do not require an API secret)
      attempts.push({
        headers: {
          "x-api-key": cleanKey,
          "X-Idempotency-Key": dmRef,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        includeRef: true,
        label: "x-api-key standard",
      });

      attempts.push({
        headers: {
          Authorization: `Bearer ${cleanKey}`,
          "x-api-key": cleanKey,
          "X-Idempotency-Key": dmRef,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        includeRef: true,
        label: "Bearer token",
      });
    }

    let lastStatus = 0;
    let lastData: any = {};
    let lastError = "";

    for (const attempt of attempts) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: attempt.headers,
          body: JSON.stringify(basePayload),
          signal: AbortSignal.timeout(25000),
        });

        lastStatus = res.status;
        const data = await res.json().catch(() => ({}));
        lastData = data;

        const errText = String(data?.message || data?.error || "").toLowerCase();
        const isAlreadyExists =
          errText.includes("already exist") ||
          errText.includes("duplicate") ||
          errText.includes("reference already");

        const isSuccess =
          isAlreadyExists ||
          (res.ok &&
            (data.status === "success" ||
              data.success === true ||
              data.data?.orderStatus === "completed" ||
              Boolean(
                data.data?.purchaseId ||
                data.purchaseId ||
                data.data?.reference ||
                data.reference ||
                data.data?.orderReference ||
                data.orderReference ||
                data.data?.id ||
                data.id
              )));

        if (isSuccess) {
          const foundRef =
            extractDataMartReference(data) ||
            data?.data?.reference ||
            data?.reference ||
            data?.data?.orderReference ||
            data?.orderReference ||
            data?.data?.purchaseId ||
            dmRef;

          return {
            success: true,
            status: res.status || 200,
            data,
            reference: String(foundRef),
          };
        }

        lastError = data?.message || data?.error || `HTTP ${res.status}`;
        const lower = lastError.toLowerCase();
        const isLowBal =
          res.status === 402 ||
          lower.includes("insufficient") ||
          lower.includes("low balance") ||
          lower.includes("not enough balance") ||
          lower.includes("balance too low") ||
          lower.includes("wallet balance") ||
          lower.includes("top up") ||
          lower.includes("fund your wallet");

        if (isLowBal) {
          return {
            success: false,
            status: res.status,
            data,
            error: lastError,
            isLowBalance: true,
          };
        }

        // If DataMart returns a definitive validation error (e.g., invalid phone or wrong network),
        // stop immediately instead of waiting through more attempts.
        if (
          res.status === 400 &&
          (lower.includes("phone") ||
            lower.includes("network") ||
            lower.includes("capacity") ||
            lower.includes("recipient"))
        ) {
          return {
            success: false,
            status: res.status,
            data,
            error: lastError,
          };
        }
      } catch (e: any) {
        lastError = e?.message || "DataMart dispatch request failed";
        // If an attempt timed out or aborted, check immediately if DataMart already accepted dmRef before trying another attempt!
        try {
          const midCheck = await verifyDatamartOrderStatusDirect(
            {
              reference: dmRef,
              datamart_reference: dmRef,
              recipient_phone: cleanPhone,
              phone_number: cleanPhone,
              capacity: cleanCapacity,
              created_at: new Date().toISOString(),
            },
            [cleanKey]
          );
          if (midCheck.found) {
            const foundRef = midCheck.datamart_reference || dmRef;
            return {
              success: true,
              status: 200,
              data: {
                status: "success",
                message: "Order located and active on DataMart",
                reference: foundRef,
                orderStatus: midCheck.rawStatus,
              },
              reference: String(foundRef),
            };
          }
        } catch (_) {}
      }
    }

    // Safety check: If dispatch timed out, aborted, or reported an error, DataMart may have
    // ALREADY received and processed the initial request. Check DataMart live before reporting failure.
    if (!lastError || lastError.toLowerCase().includes("timeout") || lastError.toLowerCase().includes("abort") || lastError.toLowerCase().includes("secret") || lastStatus >= 500) {
      try {
        const verifyCheck = await verifyDatamartOrderStatusDirect(
          {
            reference: dmRef,
            datamart_reference: dmRef,
            recipient_phone: cleanPhone,
            phone_number: cleanPhone,
            capacity: cleanCapacity,
            created_at: new Date().toISOString(),
          },
          [cleanKey]
        );
        if (verifyCheck.found) {
          const foundRef = verifyCheck.datamart_reference || dmRef;
          return {
            success: true,
            status: 200,
            data: {
              status: "success",
              message: "Order located and active on DataMart",
              reference: foundRef,
              orderStatus: verifyCheck.rawStatus,
            },
            reference: String(foundRef),
          };
        }
      } catch (_) {}
    }

    return {
      success: false,
      status: lastStatus,
      data: lastData,
      error: lastError || "DataMart delivery dispatch failed",
    };
  } finally {
    // Keep in-memory lock for 15 seconds after dispatch finishes to prevent rapid double-fire
    setTimeout(() => releaseDispatchLock(memKey), 15000);
  }
}

/**
 * Resolves or fetches an authoritative DataMart account session token (x-auth-token).
 */
export async function getDatamartAuthToken(supabase: any, forceRefresh = false): Promise<string | null> {
  try {
    const sMap = await getCachedSettings(supabase);
    let token = sMap["datamart_auth_token"] || process.env.DATAMART_AUTH_TOKEN || "";
    if (token && !forceRefresh) return token;

    // If missing or force refresh, attempt login if email & password are saved
    const email = sMap["datamart_login_email"] || process.env.DATAMART_EMAIL || "";
    const password = sMap["datamart_login_password"] || process.env.DATAMART_PASSWORD || "";
    if (email && password) {
      const res = await fetch("https://api.datamartgh.shop/api/v1/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password: password.trim() }),
        signal: AbortSignal.timeout(10000),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.token) {
        token = data.token;
        await supabase.from("settings").upsert({ key: "datamart_auth_token", value: token }, { onConflict: "key" });
        return token;
      }
    }
    return token || null;
  } catch (e) {
    console.warn("Could not get DataMart auth token:", e);
    return null;
  }
}

/**
 * Initiates an instant Bridge Pay Mobile Money deposit prompt via DataMart.
 */
export async function initiateDatamartBridgeDeposit(params: {
  phoneNumber: string;
  amount: number;
  network?: string;
  supabase: any;
  token?: string;
}): Promise<{ success: boolean; transactionId?: string; status?: string; message?: string; error?: string }> {
  const token = params.token || (await getDatamartAuthToken(params.supabase));
  if (!token) {
    return {
      success: false,
      error: "DataMart login session token missing. Please save your DataMart login credentials or auth token.",
    };
  }

  const cleanPhone = String(params.phoneNumber || "").replace(/\D/g, "");
  const formattedPhone = cleanPhone.length === 12 && cleanPhone.startsWith("233") ? "0" + cleanPhone.slice(3) : cleanPhone;
  const net = (params.network || "MTN").toUpperCase();

  try {
    const res = await fetch("https://api.datamartgh.shop/api/bridge/collect", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-auth-token": token,
      },
      body: JSON.stringify({
        phoneNumber: formattedPhone,
        amount: Number(params.amount),
        network: net,
      }),
      signal: AbortSignal.timeout(15000),
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok && (data.status === "success" || data.success === true)) {
      return {
        success: true,
        transactionId: data.data?.transactionId || data.transactionId,
        status: data.data?.status || "pending",
        message: data.message || "MoMo PIN prompt sent to your phone! Please approve to top up your DataMart wallet.",
      };
    }

    return {
      success: false,
      error: data.message || data.error || `DataMart returned status ${res.status}`,
    };
  } catch (e: any) {
    return {
      success: false,
      error: e?.message || "Failed to initiate DataMart MoMo top-up prompt",
    };
  }
}

/**
 * Checks the status of an active Bridge Pay deposit transaction.
 */
export async function checkDatamartBridgeStatus(
  transactionId: string,
  supabase: any
): Promise<{ status: string; balance?: number; error?: string }> {
  const token = await getDatamartAuthToken(supabase);
  if (!token) {
    return { status: "unknown", error: "Missing DataMart session token" };
  }

  try {
    const res = await fetch(`https://api.datamartgh.shop/api/bridge/status/${encodeURIComponent(transactionId)}`, {
      headers: { "x-auth-token": token },
      signal: AbortSignal.timeout(8000),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      const status = data?.data?.status || data?.status || "pending";
      return { status };
    }
    return { status: "pending" };
  } catch (e: any) {
    return { status: "pending", error: e?.message };
  }
}

/**
 * Claims a direct Mobile Money deposit sent to DataMart's merchant number (0257476174).
 */
export async function claimDatamartMomoDeposit(params: {
  trxId: string;
  momoNumber: string;
  network?: string;
  supabase: any;
}): Promise<{ success: boolean; newBalance?: number; message?: string; error?: string }> {
  const token = await getDatamartAuthToken(params.supabase);
  if (!token) {
    return {
      success: false,
      error: "DataMart session token missing. Please configure your DataMart login.",
    };
  }

  const cleanPhone = String(params.momoNumber || "").replace(/\D/g, "");
  const formattedPhone = cleanPhone.length === 12 && cleanPhone.startsWith("233") ? "0" + cleanPhone.slice(3) : cleanPhone;
  const net = (params.network || "mtn").toLowerCase();

  try {
    const res = await fetch("https://api.datamartgh.shop/api/user/claim-deposit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-auth-token": token,
      },
      body: JSON.stringify({
        trxId: String(params.trxId).trim(),
        momoNumber: formattedPhone,
        network: net,
      }),
      signal: AbortSignal.timeout(15000),
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok && (data.status === "success" || data.success === true)) {
      return {
        success: true,
        newBalance: data?.data?.newBalance ?? data?.newBalance,
        message: data.message || "Deposit claimed successfully! Wallet credited.",
      };
    }

    return {
      success: false,
      error: data.message || data.error || "Failed to claim deposit with DataMart",
    };
  } catch (e: any) {
    return {
      success: false,
      error: e?.message || "Failed to claim deposit",
    };
  }
}
