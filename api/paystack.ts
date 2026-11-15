import { data1db } from './_data1db.js';
import { createClient } from "@supabase/supabase-js";
import { verifyAdminUser, getSupabase, setCorsHeaders, parseBody } from "./_supabase.js";
import { detectAndBlockIntrusion } from "./_firewall.js";
import {
  sendPaymentReceivedNotification,
  checkAndAlertLowDatamartBalance,
  sendAdminLowBalanceOrderFailedAlert,
  isDatamartLowBalanceError,
  sendPaymentIncompleteCustomerSms,
  extractPaystackMomoPhone,
} from "./_notifications.js";
import { DEFAULT_PRODUCTS } from "../src/lib/networks.js";
import {
  syncOrderWithDatamart,
  mapDatamartStatus,
  extractDataMartOrderStatus,
  extractDataMartReference,
  verifyDatamartOrderStatusDirect,
  resolveDatamartKeys,
  resolveDatamartSecret,
  getDatamartAuthHeaders,
  executeDatamartPurchase,
  claimOrderDispatchLock,
  releaseOrderDispatchLock,
} from "./_datamart.js";
function cleanApiKey(raw: any): string {
  if (!raw || typeof raw !== "string") return "";
  let k = raw.trim();
  k = k.replace(/^["'`]+|["'`]+$/g, "").trim();
  k = k.replace(/^[A-Za-z0-9_]+=\s*/, "").trim();
  k = k.replace(/^["'`]+|["'`]+$/g, "").trim();
  if (k.toLowerCase().startsWith("bearer ")) {
    k = k.slice(7).trim();
  }
  k = k.replace(/[\r\n\t\u200B-\u200D\uFEFF]/g, "").trim();
  return k;
}

function getEnvVar(patterns: string[]): string {
  for (const p of patterns) {
    if (process.env[p]) {
      const c = cleanApiKey(process.env[p]);
      if (c && c.length > 3) return c;
    }
  }
  const normPatterns = patterns.map((p) => p.toLowerCase().replace(/[^a-z0-9]/g, ""));
  for (const [key, val] of Object.entries(process.env)) {
    const normKey = key.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (normPatterns.includes(normKey)) {
      const c = cleanApiKey(val);
      if (c && c.length > 3) return c;
    }
  }
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

const PAYSTACK_BASE = "https://api.paystack.co";
const DATAMART_BASE = "https://api.datamartgh.shop/api/developer";

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

function readDataMartOrderStatus(payload: any): string | null {
  const data = payload?.data && typeof payload.data === "object" ? payload.data : payload;
  const explicitStatus = data?.orderStatus ?? data?.deliveryStatus ?? data?.delivery_status;
  const value = explicitStatus ?? data?.status;
  if (value === undefined || value === null) return null;
  const status = String(value).toLowerCase().trim();
  if (!status) return null;
  if (explicitStatus === undefined && ["success", "error", "ok"].includes(status)) return null;
  return status;
}

function isCompletedDelivery(status: string | undefined | null): boolean {
  const s = String(status || "").toLowerCase().trim();
  return s === "delivered" || s === "completed" || s === "fulfilled" || s === "done" || s === "successful";
}

function isActiveDelivery(status: string | undefined | null): boolean {
  return status === "pending" || status === "waiting" || status === "processing";
}

/**
 * Returns the raw normalised DataMart status string for a given order ID.
 * Stores raw DataMart status for internal/admin use, while mapping to customer delivery status.
 */
async function queryDatamartStatus(
  id: string,
  candidates: string[],
  order?: any
): Promise<{ rawStatus: string; deliveryStatus: string; error?: string }> {
  const endpoints = [
    `https://api.datamartgh.shop/api/developer/order-status/${encodeURIComponent(id)}`,
    `https://api.datamartgh.shop/api/order-status/${encodeURIComponent(id)}`,
    `https://api.datamartgh.shop/api/developer/orders/${encodeURIComponent(id)}`,
    `https://api.datamartgh.shop/api/orders/${encodeURIComponent(id)}`,
  ];

  let lastError = candidates.length ? "Delivery provider returned no status" : "DATAMART_API_KEY is not configured";
  for (const url of endpoints) {
    for (const key of candidates) {
      try {
        let r = await fetch(url, {
          headers: { ...getDatamartAuthHeaders(key), Accept: "application/json" },
          signal: AbortSignal.timeout(5000),
        });
        if (!r.ok && r.status === 401) {
          r = await fetch(url, {
            headers: { ...getDatamartAuthHeaders(key), Authorization: `Bearer ${key}`, Accept: "application/json" },
            signal: AbortSignal.timeout(5000),
          });
        }
        if (!r.ok) {
          const errorBody = await r.json().catch(() => ({}));
          lastError = String(errorBody?.message || errorBody?.error || `Status request failed (HTTP ${r.status})`).slice(0, 180);
          continue;
        }
        if (r.ok) {
          const j = await r.json().catch(() => null);
          const raw =
            j?.data?.orderStatus ??
            j?.data?.deliveryStatus ??
            j?.data?.delivery_status ??
            j?.orderStatus ??
            j?.deliveryStatus;
          if (raw && !["success", "ok", "true", "false"].includes(String(raw).toLowerCase())) {
            const rawStatus = String(raw).toLowerCase().trim();
            return {
              rawStatus,
              deliveryStatus: mapDatamartStatus(rawStatus),
            };
          }
        }
      } catch (error) {
        lastError = error instanceof Error && error.name === "TimeoutError"
          ? "Status request timed out"
          : "Could not connect to status service";
      }
    }
  }

  // Fallback: check transactions list if order reference or recipient phone is available
  if (order) {
    try {
      const rawPhone = String(order.recipient_phone || "").replace(/\D/g, "");
      for (const key of candidates) {
        const trRes = await fetch("https://api.datamartgh.shop/api/developer/transactions?limit=25", {
          headers: { ...getDatamartAuthHeaders(key), Accept: "application/json" },
          signal: AbortSignal.timeout(5000),
        });
        if (trRes.ok) {
          const trJson = await trRes.json().catch(() => null);
          const list = trJson?.data?.transactions || trJson?.data || trJson?.transactions || (Array.isArray(trJson) ? trJson : []);
          if (Array.isArray(list)) {
            const match = list.find((t: any) =>
              (order.reference && (t.reference === order.reference || t.ext_ref === order.reference || t.ref === order.reference)) ||
              (id && (t.reference === id || t.purchaseId === id || t.orderId === id)) ||
              (rawPhone && String(t.recipient || t.phone || t.phoneNumber || t.description || "").includes(rawPhone.slice(-9)))
            );
            if (match) {
              const explicit = match.relatedPurchase?.orderStatus || match.relatedPurchase?.deliveryStatus || match.orderStatus || match.delivery_status;
              const rawStatus = explicit ? String(explicit).toLowerCase().trim() : "processing";
              return { rawStatus, deliveryStatus: mapDatamartStatus(rawStatus) };
            }
          }
        }
      }
    } catch {}
  }

  return { rawStatus: "unknown", deliveryStatus: "unknown", error: lastError };
}

function publicOrder(o: Record<string, any> | null | undefined) {
  if (!o) return null;
  // NEVER leak datamart_reference, datamart_status, or provider-internal error details to customers
  let cleanErrorMessage: string | undefined = undefined;
  if (["failed", "unknown"].includes(o.delivery_status) && o.error_message) {
    const lower = String(o.error_message).toLowerCase();
    if (lower.includes("datamart") || lower.includes("api key") || lower.includes("wallet") || lower.includes("gateway")) {
      cleanErrorMessage = "Delivery could not be completed automatically. Our support team has been notified.";
    } else {
      cleanErrorMessage = o.error_message;
    }
  }

  return {
    id: o.id,
    reference: o.reference,
    network: o.network,
    capacity: o.capacity,
    mb: o.mb,
    amount: o.amount,
    recipient_phone: o.recipient_phone,
    payment_status: o.payment_status,
    delivery_status: o.delivery_status,
    error_message: cleanErrorMessage,
    agent_id: o.agent_id || null,
    created_at: o.created_at,
  };
}

export default async function handler(req: any, res: any) {
  setCorsHeaders(res);
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const supabase = getSupabase();
    if (await detectAndBlockIntrusion(req, res, supabase)) return;

    const body = parseBody(req);
    const fn = (req.query?.fn || req.headers?.["x-function-name"] || body?.fn || "").toLowerCase();

    const isInit =
      fn === "paystack-init" ||
      fn === "init" ||
      req.url?.includes("paystack-init") ||
      (body?.product_id && !body?.reference && body?.recipient_phone);

    let PAYSTACK_SECRET_KEY = cleanApiKey(
      getEnvVar([
        "PAYSTACK_SECRET_KEY",
        "VITE_PAYSTACK_SECRET_KEY",
        "PAYSTACK_KEY",
        "paystack_secret_key",
        "paystack_secret",
        "PAYSTACK_SECRET",
      ])
    );

    if (!PAYSTACK_SECRET_KEY) {
      const { data: psRows } = await supabase
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
          PAYSTACK_SECRET_KEY = c;
          break;
        } else if (c && !PAYSTACK_SECRET_KEY) {
          PAYSTACK_SECRET_KEY = c;
        }
      }
    }

    const adminAuth = await verifyAdminUser(req, supabase).catch(() => ({ authorized: false }));
    const isAdmin = Boolean(adminAuth?.authorized);

    // ----------------------------------------------------
    // 1. Paystack Init Flow
    // ----------------------------------------------------
    if (isInit) {
      // Check if store orders are paused
      if (!isAdmin) {
        const { data: pauseSetting } = await supabase
          .from("settings")
          .select("value")
          .eq("key", "orders_paused")
          .maybeSingle();

        if (pauseSetting?.value === "true") {
          const { data: pauseMsgSetting } = await supabase
            .from("settings")
            .select("value")
            .eq("key", "orders_pause_message")
            .maybeSingle();
          const msg = pauseMsgSetting?.value || "Store orders are temporarily paused for brief maintenance. Please check back shortly!";
          return res.status(400).json({ error: msg });
        }
      }

      const { product_id, recipient_phone, customer_email, callback_url, agent_id, store_name, amount } = body;

      if (!product_id || !recipient_phone) {
        return res.status(400).json({ error: "Missing required fields (product_id or recipient_phone)" });
      }

      const rawPhone = String(recipient_phone).replace(/\s+/g, "");
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

      const cleanProductId = String(product_id || "").trim();
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanProductId);
      let product: any = null;
      let pErr: any = null;

      // 1. Direct lookup by ID (supports both UUIDs and string IDs like "p-mtn-1" or "rec_...")
      if (cleanProductId) {
        const { data, error } = await supabase
          .from("products")
          .select("*")
          .eq("id", cleanProductId)
          .maybeSingle();
        if (!error && data) {
          product = data;
        } else if (error) {
          pErr = error;
        }
      }

      // 2. If not found by ID, check explicit network & capacity in request body
      if (!product && body?.network && body?.capacity) {
        const reqNet = String(body.network).trim().toUpperCase();
        const reqCap = String(body.capacity).replace(/[^0-9.]/g, "");
        if (reqNet && reqCap) {
          const { data: dbMatch } = await supabase
            .from("products")
            .select("*")
            .ilike("network", reqNet)
            .eq("capacity", reqCap)
            .maybeSingle();
          if (dbMatch) {
            product = dbMatch;
            pErr = null;
          } else {
            const defMatch = DEFAULT_PRODUCTS.find(
              (p) => p.network.toUpperCase() === reqNet && String(p.capacity) === reqCap
            );
            if (defMatch) {
              product = { ...defMatch, in_stock: defMatch.in_stock !== false };
              pErr = null;
            } else if (Number(amount) > 0) {
              product = {
                id: cleanProductId,
                network: reqNet,
                capacity: reqCap,
                mb: Number(body.mb) || Number(reqCap) * 1024,
                price: Number(amount),
                name: `${reqNet} ${reqCap}GB Data`,
                in_stock: true,
              };
              pErr = null;
            }
          }
        }
      }

      // 3. Look up in DEFAULT_PRODUCTS or parse non-UUID slug (e.g. "p-mtn-1")
      if (!product) {
        const defaultMatch = DEFAULT_PRODUCTS.find((p) => p.id === cleanProductId);
        const pLower = cleanProductId.toLowerCase();
        const matchNetwork =
          defaultMatch?.network ||
          (/mtn/i.test(pLower) ? "MTN" : /telecel|tel/i.test(pLower) ? "TELECEL" : /at|airtel/i.test(pLower) ? "AT" : "");
        const matchCap = defaultMatch?.capacity || (!isUuid ? cleanProductId.replace(/[^0-9.]/g, "") : "");

        if (matchNetwork && matchCap) {
          const { data: dbMatch } = await supabase
            .from("products")
            .select("*")
            .ilike("network", matchNetwork)
            .eq("capacity", matchCap)
            .maybeSingle();
          if (dbMatch) {
            product = dbMatch;
            pErr = null;
          }
        }

        if (!product && defaultMatch) {
          product = {
            id: defaultMatch.id,
            network: defaultMatch.network,
            capacity: defaultMatch.capacity,
            mb: defaultMatch.mb,
            price: defaultMatch.price,
            name: defaultMatch.name,
            in_stock: defaultMatch.in_stock !== false,
          };
          pErr = null;
        }
      }

      // 4. Stale browser cache UUID fallback: match by price/amount against products catalogue
      if (!product && Number(amount) > 0) {
        const targetAmt = Number(amount);
        const { data: allProds } = await supabase.from("products").select("*");
        const candidates = Array.isArray(allProds) && allProds.length > 0 ? allProds : DEFAULT_PRODUCTS;
        // Try exact price match first, then closest price within 2 GHS
        let bestMatch = candidates.find((p: any) => Math.abs(Number(p.price) - targetAmt) < 0.05);
        if (!bestMatch) {
          const sorted = [...candidates].sort(
            (a: any, b: any) => Math.abs(Number(a.price) - targetAmt) - Math.abs(Number(b.price) - targetAmt)
          );
          if (sorted[0] && Math.abs(Number(sorted[0].price) - targetAmt) <= 3.0) {
            bestMatch = sorted[0];
          }
        }
        if (bestMatch) {
          product = {
            ...bestMatch,
            price: targetAmt,
            in_stock: bestMatch.in_stock !== false,
          };
          pErr = null;
        }
      }

      // 5. Ultimate Fallback: never fail checkout if customer requested a bundle
      if (!product) {
        const net = String(body?.network || "MTN").toUpperCase().trim() || "MTN";
        const cap = String(body?.capacity || "1").replace(/[^0-9.]/g, "") || "1";
        const customAmt = Number(amount) > 0 ? Number(amount) : (net === "MTN" && cap === "1" ? 4.30 : 5.00);
        product = {
          id: cleanProductId || `p-${net.toLowerCase()}-${cap}`,
          network: net,
          capacity: cap,
          mb: Number(body?.mb) || Number(cap) * 1024,
          price: customAmt,
          name: `${net} ${cap}GB Data`,
          in_stock: true,
        };
        pErr = null;
      }

      if (!product) {
        return res.status(404).json({ error: "Product not found: " + (pErr?.message || "Invalid product ID") });
      }
      if (product.in_stock === false) {
        return res.status(400).json({ error: "Product is out of stock" });
      }

      const customAmount = Number(amount) > 0 ? Number(amount) : Number(product.price);
      const amountGhs = customAmount;
      if (!amountGhs || amountGhs <= 0) {
        return res.status(500).json({ error: "Invalid product price configured" });
      }
      const amountKobo = Math.round(amountGhs * 100);

      const reference = `WS-${Math.random().toString(36).slice(2, 9).toUpperCase().padEnd(7, "0")}`;

      const validProductId = product.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(product.id) ? product.id : null;
      const isFlashSale = Boolean(body?.is_flash_sale);

      const orderPayload: Record<string, any> = {
        reference,
        ref: reference,
        product_id: validProductId,
        network: product.network,
        capacity: product.capacity,
        bundle: `${product.capacity}GB`,
        mb: product.mb,
        amount: amountGhs,
        recipient_phone: phone,
        phone_number: phone,
        phone: phone,
        customer_email: email,
        status: "pending",
        payment_status: "pending",
        delivery_status: "pending",
        notes: isFlashSale
          ? `[FLASH_SALE]${agent_id ? ` [agent:${agent_id}]` : ""}`
          : (agent_id ? `[agent:${agent_id}]${store_name ? ` [store:${store_name}]` : ""}` : null),
        is_flash_sale: isFlashSale,
      };
      if (agent_id) orderPayload.agent_id = agent_id;

      let { error: insErr } = await supabase.from("orders").insert(orderPayload);
      while (
        insErr &&
        insErr.message &&
        insErr.message.includes("Could not find the '") &&
        insErr.message.includes("' column of 'orders'")
      ) {
        const match = insErr.message.match(/Could not find the '([^']+)' column/);
        if (match && match[1]) {
          delete orderPayload[match[1]];
          const retry = await supabase.from("orders").insert(orderPayload);
          insErr = retry.error;
        } else {
          break;
        }
      }
      if (insErr && insErr.message?.includes("agent_id")) {
        // If agent_id column does not exist in schema, retry without it (preserved in notes!)
        delete orderPayload.agent_id;
        const retry = await supabase.from("orders").insert(orderPayload);
        insErr = retry.error;
      }
      if (insErr && (insErr.message?.includes("product_id") || insErr.message?.includes("foreign key"))) {
        delete orderPayload.product_id;
        const retry = await supabase.from("orders").insert(orderPayload);
        insErr = retry.error;
      }

      if (insErr) {
        console.error("Order insertion warning:", insErr.message);
      } else {
        try {
          data1db.getClient().from("orders").upsert(orderPayload);
        } catch (_) {}
      }

      const verifiedCallback = safeCallbackUrl(callback_url);

      const paystackPayload: Record<string, any> = {
        email,
        amount: amountKobo,
        reference,
        currency: "GHS",
        channels: ["mobile_money", "card"],
        metadata: {
          reference,
          product_id: product.id,
          network: product.network,
          capacity: product.capacity,
          recipient_phone: phone,
          agent_id: agent_id || null,
          store_name: store_name || null,
          agent_referral_code: body?.agent_referral_code || body?.referral_code || null,
          is_flash_sale: isFlashSale,
          custom_fields: [
            { display_name: "Recipient Phone", variable_name: "recipient_phone", value: phone },
            { display_name: "Network", variable_name: "network", value: product.network },
            { display_name: "Bundle", variable_name: "capacity", value: product.capacity },
          ],
        },
      };

      if (verifiedCallback) {
        paystackPayload.callback_url = verifiedCallback;
      }

      if (!PAYSTACK_SECRET_KEY) {
        const finalCallback = verifiedCallback || `${req.headers.origin || "http://localhost:3000"}/payment/callback`;
        const testAuthUrl = `${finalCallback}${finalCallback.includes("?") ? "&" : "?"}reference=${encodeURIComponent(reference)}&trxref=${encodeURIComponent(reference)}`;

        await supabase
          .from("orders")
          .update({ payment_status: "paid", delivery_status: "delivered" })
          .eq("reference", reference);

        return res.status(200).json({
          authorization_url: testAuthUrl,
          access_code: `sim_${Date.now()}`,
          reference,
          status: "success",
        });
      }

      const paystackRes = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(paystackPayload),
      });

      const paystackData = await paystackRes.json().catch(() => ({}));

      if (!paystackRes.ok || !paystackData.status) {
        await supabase
          .from("orders")
          .update({ payment_status: "failed", delivery_status: "failed", error_message: paystackData.message || "Paystack initialization failed" })
          .eq("reference", reference);

        return res.status(502).json({
          error: paystackData.message || "Payment provider failed to initialize transaction",
        });
      }

      return res.status(200).json({
        authorization_url: paystackData.data.authorization_url,
        access_code: paystackData.data.access_code,
        reference,
      });
    }

    // ----------------------------------------------------
    // 2. Paystack Verify Flow
    // ----------------------------------------------------
    const isRetry = body?.retry === true || req.query?.retry === "true";
    const dmCandidates = await resolveDatamartKeys(supabase, isRetry);

    const rawRef = body?.reference || req.query?.reference;
    if (!rawRef || typeof rawRef !== "string" || !rawRef.trim()) {
      return res.status(400).json({ error: "Missing or invalid reference" });
    }
    const reference = rawRef.trim();

    let order: any = null;
    let orderErr: any = null;
    try {
      const d1Res = await data1db.getClient().from("orders").select("*").eq("reference", reference).maybeSingle();
      if (d1Res?.data) order = d1Res.data;
    } catch (_) {}

    if (!order) {
      const res = await supabase
        .from("orders")
        .select("*")
        .eq("reference", reference)
        .maybeSingle();
      order = res.data;
      orderErr = res.error;
    }

    if (!order) {
      const { data: oByRef } = await supabase.from("orders").select("*").eq("ref", reference).maybeSingle();
      if (oByRef) order = oByRef;
    }

    if (!order) {
      const { data: oByDm } = await supabase.from("orders").select("*").eq("datamart_reference", reference).maybeSingle();
      if (oByDm) order = oByDm;
    }

    if (!order) {
      const { data: oOr } = await supabase
        .from("orders")
        .select("*")
        .or(`reference.ilike.${reference},datamart_reference.ilike.${reference}`)
        .maybeSingle();
      if (oOr) order = oOr;
    }

    if (!order && (/^[0-9a-fA-F-]{8,}$/.test(reference) || /^\d+$/.test(reference))) {
      const { data: orderById } = await supabase.from("orders").select("*").eq("id", reference).maybeSingle();
      if (orderById) order = orderById;
    }

    if (orderErr) {
      console.warn("Database order lookup error:", orderErr.message);
    }

    if (!order && PAYSTACK_SECRET_KEY) {
      try {
        const psRes = await fetch(
          `${PAYSTACK_BASE}/transaction/verify/${encodeURIComponent(reference)}`,
          { headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` } }
        );
        const psData = await psRes.json().catch(() => ({}));
        if (psRes.ok && psData.status && psData.data?.status === "success") {
          const meta = psData.data.metadata || {};
          const custom = Array.isArray(meta.custom_fields) ? meta.custom_fields : [];
          const findCust = (k: string) => custom.find((c: any) => c.variable_name === k)?.value;
          const phone = meta.recipient_phone || findCust("recipient_phone") || psData.data.customer?.phone || "";
          const network = meta.network || findCust("network") || "MTN";
          const capacity = meta.capacity || findCust("capacity") || "1";
          const amountGhs = Number(psData.data.amount) / 100;

          const newOrderPayload: Record<string, any> = {
            reference: psData.data.reference || reference,
            ref: psData.data.reference || reference,
            network,
            capacity: String(capacity),
            bundle: `${capacity}GB`,
            amount: amountGhs,
            recipient_phone: phone,
            phone_number: phone,
            customer_email: psData.data.customer?.email || "",
            payment_status: "paid",
            delivery_status: "processing",
            status: "processing",
            paid_at: psData.data.paid_at || new Date().toISOString(),
          };

          let { data: newOrder, error: newOrdErr } = await supabase
            .from("orders")
            .insert(newOrderPayload)
            .select("*")
            .maybeSingle();

          while (
            newOrdErr &&
            newOrdErr.message &&
            newOrdErr.message.includes("Could not find the '") &&
            newOrdErr.message.includes("' column of 'orders'")
          ) {
            const match = newOrdErr.message.match(/Could not find the '([^']+)' column/);
            if (match && match[1]) {
              delete newOrderPayload[match[1]];
              const retry = await supabase.from("orders").insert(newOrderPayload).select("*").maybeSingle();
              newOrdErr = retry.error;
              newOrder = retry.data;
            } else {
              break;
            }
          }

          if (newOrder) {
            order = newOrder;
          }
        }
      } catch (recoveryErr) {
        console.warn("Paystack transaction recovery lookup note:", recoveryErr);
      }
    }

    if (!order) {
      // Check directly on DataMart in case order is tracked by DataMart ID
      for (const candidateKey of dmCandidates) {
        try {
          const urls = [
            `https://api.datamartgh.shop/api/developer/order-status/${encodeURIComponent(reference)}`,
            `https://api.datamartgh.shop/api/order-status/${encodeURIComponent(reference)}`,
          ];
          for (const u of urls) {
            const r = await fetch(u, {
              headers: { "x-api-key": candidateKey, Accept: "application/json" },
            });
            if (r.ok) {
              const j = await r.json().catch(() => null);
              const dmData = j?.data || j;
              const rawDmStatus = readDataMartOrderStatus(j) || "";
              if (rawDmStatus) {
                const mappedStatus = mapDatamartStatus(rawDmStatus);
                return res.status(200).json({
                  status: "success",
                  message: `Delivery status: ${rawDmStatus}`,
                  order: isAdmin
                    ? {
                        reference,
                        delivery_status: mappedStatus,
                        datamart_status: rawDmStatus,
                        status: mappedStatus,
                        payment_status: "paid",
                      }
                    : {
                        reference,
                        delivery_status: mappedStatus,
                        status: mappedStatus,
                        payment_status: "paid",
                      },
                });
              }
            }
          }
        } catch {}
      }

      return res.status(404).json({ error: `Order with reference ${reference} not found.` });
    }

    let targetOrder = { ...order };

    // WhatsApp bot orders are only recorded after payment verification
    if (
      targetOrder.whatsapp_phone ||
      targetOrder.network === "MASHUP" ||
      (targetOrder.ref && String(targetOrder.ref).startsWith("MASHUP"))
    ) {
      targetOrder.payment_status = "paid";
    }

    let paystackVerified = false;
    let dispatchPaymentNotification: ((ds?: string, dms?: string, err?: string) => void) | null = null;

    // Also verify if payment is paid but delivery_status is pending (corrupted by stale DataMart sync)
    const needsPaystackVerification = targetOrder.payment_status !== "paid" || 
      (targetOrder.payment_status === "paid" && targetOrder.delivery_status === "pending");

    if (needsPaystackVerification) {
      if (!PAYSTACK_SECRET_KEY) {
        targetOrder.payment_status = "paid";
        if (targetOrder.delivery_status === "pending" || !targetOrder.delivery_status) {
          targetOrder.delivery_status = "delivered";
        }
        await supabase
          .from("orders")
          .update({ payment_status: "paid", delivery_status: targetOrder.delivery_status })
          .eq("reference", reference);
        paystackVerified = true;
      } else {
      const psRes = await fetch(
        `${PAYSTACK_BASE}/transaction/verify/${encodeURIComponent(reference)}`,
        { headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` } }
      );
      const psData = await psRes.json().catch(() => ({}));

      if (psRes.ok && psData.status && psData.data?.status === "success") {
        const expectedKobo = Math.round(Number(targetOrder.amount) * 100);
        const actualKobo = Number(psData.data.amount);

        if (actualKobo < expectedKobo - 2) {
          const underpayMsg = "Amount paid was less than required";
          await supabase
            .from("orders")
            .update({
              payment_status: "failed",
              delivery_status: "failed",
              error_message: underpayMsg,
              updated_at: new Date().toISOString(),
            })
            .eq("id", targetOrder.id);

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
                reason: "failed",
                gatewayResponse: underpayMsg,
                storeName: targetOrder.store_name,
                agentId: targetOrder.agent_id,
              },
              supabase
            ).catch(() => {});
          }

          return res.status(400).json({ error: underpayMsg });
        }

        const baseUpdates: Record<string, any> = {
          payment_status: "paid",
          delivery_status: "processing",
          status: "processing",
          error_message: null,
          updated_at: new Date().toISOString(),
        };

        let updatedOrder = null;
        try {
          const fullUpdates = {
            ...baseUpdates,
            paid_at: psData.data.paid_at || new Date().toISOString(),
            channel: psData.data.channel || undefined,
            ip_address: psData.data.ip_address || undefined,
          };
          const { data: uData, error: uErr } = await supabase
            .from("orders")
            .update(fullUpdates)
            .eq("id", targetOrder.id)
            .select("*")
            .maybeSingle();

          if (!uErr && uData) {
            updatedOrder = uData;
          } else {
            const { data: bData } = await supabase
              .from("orders")
              .update(baseUpdates)
              .eq("id", targetOrder.id)
              .select("*")
              .maybeSingle();
            if (bData) updatedOrder = bData;
          }
        } catch (_) {
          const { data: bData } = await supabase
            .from("orders")
            .update(baseUpdates)
            .eq("id", targetOrder.id)
            .select("*")
            .maybeSingle();
          if (bData) updatedOrder = bData;
        }

        if (updatedOrder) {
          targetOrder = updatedOrder;
        } else {
          targetOrder = { ...targetOrder, ...baseUpdates, payment_status: "paid" };
        }
        try {
          data1db.getClient().from("orders").upsert(targetOrder);
        } catch (_) {}
        paystackVerified = true;

        // If order belongs to an Agent Store, attribute order & profit to the agent!
        // ⚡ FLASH SALE CHECK: Agents get NO profit and NO order history / referral reward for Flash Sale!
        const isFlashSaleOrder =
          targetOrder?.is_flash_sale === true ||
          psData.data?.metadata?.is_flash_sale === true ||
          (typeof targetOrder?.notes === "string" && (targetOrder.notes.includes("FLASH_SALE") || targetOrder.notes.includes("FLASH SALE")));

        const agentNotesMatch = targetOrder.notes?.match(/\[agent:([^\]]+)\]/);
        const agentId = targetOrder.agent_id || psData.data?.metadata?.agent_id || (agentNotesMatch ? agentNotesMatch[1] : null);
        const agentStoreName = psData.data?.metadata?.store_name || targetOrder.store_name;
        let agentProfit = 0;

        if (agentId && !isFlashSaleOrder) {
          try {
            const { recordAgentOrder, loadBasePrices, resolveOrderBasePrice } = await import("./agent.js");
            const basePrices = await loadBasePrices(supabase);
            const baseCost = resolveOrderBasePrice(targetOrder, basePrices);
            agentProfit = Math.max(0, Number((Number(targetOrder.amount) - baseCost).toFixed(2)));
            await recordAgentOrder(supabase, {
              agent_id: agentId,
              reference: targetOrder.reference,
              network: targetOrder.network,
              package_size: `${targetOrder.capacity || ""}GB`,
              phone: targetOrder.recipient_phone,
              amount: Number(targetOrder.amount),
              base_price: baseCost,
              agent_profit: agentProfit,
              paystack_ref: psData.data?.reference || targetOrder.reference,
              status: targetOrder.delivery_status || "processing",
            });

            const refCode = psData.data?.metadata?.agent_referral_code || (targetOrder as any)?.referral_code;
            if (refCode) {
              try {
                const { recordAgentReferralReward } = await import("./agent.js");
                await recordAgentReferralReward(supabase, {
                  agent_id: agentId,
                  agent_name: agentStoreName || "Agent Store",
                  referral_code: refCode,
                  buyer_phone: targetOrder.recipient_phone,
                  order_ref: targetOrder.reference,
                  amount: Number(targetOrder.amount),
                });
              } catch (refErr) {
                console.warn("Agent referral recording note:", refErr);
              }
            }
          } catch (agentErr) {
            console.warn("Agent order recording note:", agentErr);
          }
        }

        // Unified payment alert dispatcher: sent with real authoritative DataMart status!
        dispatchPaymentNotification = (deliveryStatus?: string, datamartStatus?: string, errMsg?: string) => {
          sendPaymentReceivedNotification({
            reference: targetOrder.reference,
            amount: targetOrder.amount,
            itemDescription: `${targetOrder.capacity || ""}GB ${targetOrder.network || ""} Data`,
            recipientPhone: targetOrder.recipient_phone,
            customerPhone: targetOrder.customer_phone || targetOrder.recipient_phone,
            network: targetOrder.network,
            channel: psData.data?.channel,
            orderType: "data",
            agentId: isFlashSaleOrder ? undefined : (agentId || undefined),
            agentStoreName: isFlashSaleOrder ? undefined : (agentStoreName || undefined),
            deliveryStatus: deliveryStatus || targetOrder.delivery_status,
            datamartStatus: datamartStatus || targetOrder.datamart_status,
            errorMessage: errMsg || targetOrder.error_message,
          }, supabase).catch((notifyErr) => {
            console.warn("Payment notification dispatch note:", notifyErr);
          });

          if (agentId && !isFlashSaleOrder) {
            try {
              import("./_notifications.js").then(({ sendAgentOrderWhatsAppAlert }) => {
                sendAgentOrderWhatsAppAlert({
                  agentId,
                  orderReference: targetOrder.reference,
                  itemDescription: `${targetOrder.capacity || ""}GB ${targetOrder.network || ""} Data`,
                  recipientPhone: targetOrder.recipient_phone,
                  sellingPrice: Number(targetOrder.amount),
                  agentProfit: agentProfit,
                  deliveryStatus: deliveryStatus || targetOrder.delivery_status || "processing",
                  agentStoreName: agentStoreName,
                }, supabase).catch((err) => console.warn("Agent WhatsApp alert warning:", err));
              }).catch(() => {});
            } catch (_) {}
          }
        };

        // ⚡ INSTANT ALERT DISPATCH: Send order payment alert to Admin & Agent immediately without delay!
        dispatchPaymentNotification("processing", "fastlane");
      } else if (psData.data?.status === "failed" || psData.data?.status === "abandoned") {
        const failureReason =
          psData.data.gateway_response ||
          psData.data.message ||
          (psData.data.status === "abandoned" ? "Transaction abandoned" : "Payment failed");

        if (targetOrder.payment_status !== "paid") {
          await supabase
            .from("orders")
            .update({
              payment_status: "failed",
              delivery_status: "failed",
              error_message: failureReason,
              updated_at: new Date().toISOString(),
            })
            .eq("id", targetOrder.id);
          targetOrder.payment_status = "failed";
          targetOrder.delivery_status = "failed";
          targetOrder.error_message = failureReason;

          // Dispatch customer SMS alert explaining low balance / abandonment / failure strictly to the MoMo number
          try {
            const momoFail = extractPaystackMomoPhone(psData.data, targetOrder);
            if (momoFail) {
              await sendPaymentIncompleteCustomerSms(
                {
                  reference: targetOrder.reference,
                  momoPhone: momoFail,
                  customerPhone: momoFail,
                  recipientPhone: targetOrder.recipient_phone,
                  amount: targetOrder.amount,
                  itemDescription: `${targetOrder.capacity || ""}GB ${targetOrder.network || ""} Data`,
                  network: targetOrder.network,
                  capacity: targetOrder.capacity,
                  reason: psData.data.status,
                  gatewayResponse: failureReason,
                  storeName: targetOrder.store_name,
                  agentId: targetOrder.agent_id,
                },
                supabase
              );
            }
          } catch (e: any) {
            console.warn("Payment incomplete SMS dispatch note:", e);
          }
        }

        return res.status(200).json({
          status: "failed",
          message: failureReason,
          order: isAdmin ? targetOrder : publicOrder(targetOrder),
        });
      }
      }
    }

    // 1. Sync live DataMart status ONLY if this order was already dispatched to DataMart
    // (Never sync before dispatching, to avoid matching unrelated historical orders by phone!)
    // Skip if we just did a fresh Paystack verification (avoids overwriting fresh status with stale DataMart data)
    let foundOnDataMart = false;
    if (!paystackVerified && dmCandidates.length > 0 && targetOrder.payment_status === "paid" && targetOrder.datamart_reference) {
      const synced = await syncOrderWithDatamart(targetOrder, supabase, dmCandidates);
      if (synced) targetOrder = synced;

      if (targetOrder.datamart_reference || targetOrder.delivery_status !== "pending") {
        foundOnDataMart = true;
        const ds = (targetOrder.delivery_status || "").toLowerCase();
        const statusMsg =
          ds === "delivered" || ds === "completed"
            ? "Order delivery confirmed delivered!"
            : ds === "waiting" || ds === "pending"
            ? "Queued & Waiting for Delivery..."
            : ds === "processing" || ds === "in_progress"
            ? "Delivery is in progress. Usually arrives within minutes."
            : ds === "failed"
            ? "Delivery could not be completed automatically."
            : ds === "refunded"
            ? "Order marked as refunded."
            : `Delivery status: ${targetOrder.datamart_status || targetOrder.delivery_status}`;

        // If order already processed or failed on DataMart and retry is not requested, return now
        if (body?.retry !== true) {
          return res.status(200).json({
            status: ds === "failed" ? "failed" : "success",
            message: statusMsg,
            order: isAdmin ? targetOrder : publicOrder(targetOrder),
          });
        }
      }
    }

    if (
      targetOrder.payment_status === "paid" &&
      (targetOrder.datamart_reference || isCompletedDelivery(targetOrder.delivery_status)) &&
      body?.retry !== true
    ) {
      if (paystackVerified && dispatchPaymentNotification) {
      dispatchPaymentNotification(targetOrder.delivery_status, targetOrder.datamart_status, targetOrder.error_message);
    }

    return res.status(200).json({ order: isAdmin ? targetOrder : publicOrder(targetOrder) });
    }

    if (targetOrder.payment_status === "paid" && !isCompletedDelivery(targetOrder.delivery_status)) {
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
      if (cleanPhone.startsWith("233") && cleanPhone.length === 12) {
        cleanPhone = "0" + cleanPhone.slice(3);
      } else if (cleanPhone.length === 9) {
        cleanPhone = "0" + cleanPhone;
      }

      let cleanCapacity = String(targetOrder.capacity || "").trim();
      const capMatch = cleanCapacity.match(/^(\d+(?:\.\d+)?)/);
      if (capMatch) cleanCapacity = capMatch[1];

      // ⚡ FLASH SALE CHECK:
      // If order is tagged as Flash Sale, DO NOT send to DataMart API!
      const isFlashSale =
        targetOrder?.is_flash_sale === true ||
        (typeof targetOrder?.notes === "string" && targetOrder.notes.includes("FLASH_SALE"));

      if (isFlashSale) {
        targetOrder.delivery_status = "processing";
        targetOrder.payment_status = "paid";
        targetOrder.status = "paid";
        targetOrder.supplier_status = "manual_flash_sale";
        if (!targetOrder.notes?.includes("FLASH_SALE")) {
          targetOrder.notes = `[FLASH_SALE] ${targetOrder.notes || ""}`.trim();
        }

        await supabase
          .from("orders")
          .update({
            delivery_status: "processing",
            payment_status: "paid",
            status: "paid",
            supplier_status: "manual_flash_sale",
            notes: targetOrder.notes,
            updated_at: new Date().toISOString(),
          })
          .eq("reference", reference);

        try {
          data1db.getClient().from("orders").update({
            delivery_status: "processing",
            payment_status: "paid",
            status: "paid",
            notes: targetOrder.notes,
          }).eq("reference", reference);
        } catch (_) {}

        if (dispatchPaymentNotification) {
          dispatchPaymentNotification("processing", "manual_flash_sale");
        }

        return res.status(200).json({
          status: "processing",
          payment_status: "paid",
          delivery_status: "processing",
          message: "Payment confirmed! Your Flash Sale order is currently processing.",
          order: targetOrder,
        });
      }

      let fulfilled = false;
      let lastErrMsg = "";

      if (dmCandidates.length > 0) {
        // 🔒 ATOMIC DISPATCH LOCK: Prevent race condition between Webhook and Browser Verify
        const claimedLock = await claimOrderDispatchLock(targetOrder.id || reference, supabase);
        if (!claimedLock) {
          const { data: freshOrder } = await supabase
            .from("orders")
            .select("*")
            .eq("reference", reference)
            .maybeSingle();

          const curOrder = freshOrder || targetOrder;
          return res.status(200).json({
            status: curOrder.delivery_status || "processing",
            payment_status: "paid",
            delivery_status: curOrder.delivery_status || "processing",
            message: "Payment confirmed! Your order is currently processing.",
            order: isAdmin ? curOrder : publicOrder(curOrder),
          });
        }

        const dmSecret = await resolveDatamartSecret(supabase);
        for (const candidateKey of dmCandidates) {
          try {
            const purchaseResult = await executeDatamartPurchase({
              apiKey: candidateKey,
              secret: dmSecret,
              phoneNumber: cleanPhone,
              network: dmNetwork,
              capacity: cleanCapacity,
              reference: reference,
              skipLock: true,
            });

            if (purchaseResult.success) {
              const pId = purchaseResult.reference || reference;
              const dmData = purchaseResult.data;
              const remainingBal = dmData?.data?.walletBalance ?? dmData?.walletBalance ?? dmData?.data?.balance ?? dmData?.balance;
              if (remainingBal != null && !isNaN(Number(remainingBal))) {
                checkAndAlertLowDatamartBalance(remainingBal, supabase).catch(() => null);
              }

              // Authoritative delivery status from DataMart purchase response
              const dmRawStatus = extractDataMartOrderStatus(purchaseResult.data) || "processing";
              const verifiedDelivery = mapDatamartStatus(dmRawStatus);
              const verifiedRaw = dmRawStatus;

              // Minimal egress update (no redundant full-row download)
              await supabase
                .from("orders")
                .update({
                  delivery_status: verifiedDelivery,
                  datamart_status: verifiedRaw,
                  datamart_reference: String(pId),
                  supplier_status: "datamart",
                  error_message: null,
                })
                .eq("id", targetOrder.id);

              targetOrder.delivery_status = verifiedDelivery;
              targetOrder.datamart_status = verifiedRaw;
              targetOrder.datamart_reference = String(pId);
              targetOrder.supplier_status = "datamart";
              targetOrder.error_message = null;
              try {
                data1db.getClient().from("orders").upsert(targetOrder);
              } catch (_) {}
              fulfilled = true;

              if (dispatchPaymentNotification) {
                dispatchPaymentNotification(verifiedDelivery, verifiedRaw);
              }
              break;
            } else {
              lastErrMsg = purchaseResult.error || `Delivery returned status ${purchaseResult.status}`;
              if (purchaseResult.isLowBalance) {
                break;
              }
            }
          } catch (err: any) {
            lastErrMsg = err?.message || "Delivery dispatch error";
            console.error("Delivery dispatch error for ref", reference, err?.message);
          }
        }

        if (!fulfilled) {
          await releaseOrderDispatchLock(targetOrder.id || reference, supabase, "failed");
        }

        // Only mark order as failed if dispatch truly failed across all candidates
        // and the order does not already have a valid datamart_reference
        if (!fulfilled && !targetOrder.datamart_reference) {
          const isTimeoutOrGateway = /timeout|aborted|503|502|504|econnreset|network/i.test(lastErrMsg);

          if (isTimeoutOrGateway) {
            // DataMart received the request but timed out responding. Keep order as processing with reference registered!
            const dmRef = reference.startsWith("WS-") ? reference : `WS-${reference}`;
            await supabase
              .from("orders")
              .update({
                delivery_status: "processing",
                status: "processing",
                datamart_reference: dmRef,
                supplier_status: "datamart",
                error_message: null,
                updated_at: new Date().toISOString(),
              })
              .eq("id", targetOrder.id);

            targetOrder.delivery_status = "processing";
            targetOrder.status = "processing";
            targetOrder.datamart_reference = dmRef;
            targetOrder.supplier_status = "datamart";
            targetOrder.error_message = null;
          } else {
            await supabase
              .from("orders")
              .update({ delivery_status: "failed", error_message: lastErrMsg || "Delivery dispatch error" })
              .eq("id", targetOrder.id);

            targetOrder.delivery_status = "failed";
            targetOrder.error_message = lastErrMsg || "Delivery dispatch error";

            if (dispatchPaymentNotification) {
              dispatchPaymentNotification("failed", "failed", lastErrMsg);
            }
          }

          // Check if failure is due to low provider balance
          let isLowBal = isDatamartLowBalanceError(lastErrMsg);
          if (!isLowBal && dmCandidates.length > 0) {
            try {
              const bRes = await fetch("https://api.datamartgh.shop/api/developer/user/balance", {
                headers: { "x-api-key": dmCandidates[0] },
                signal: AbortSignal.timeout(3000),
              });
              const bData = await bRes.json().catch(() => ({}));
              const bal = Number(bData?.data?.walletBalance ?? bData?.walletBalance ?? bData?.data?.balance);
              if (!isNaN(bal) && bal < Math.max(5, Number(targetOrder.amount || 0))) {
                isLowBal = true;
              }
            } catch (_) {}
          }

          if (isLowBal) {
            sendAdminLowBalanceOrderFailedAlert(
              {
                reference: targetOrder.reference,
                recipientPhone: targetOrder.recipient_phone || targetOrder.phone_number,
                network: targetOrder.network,
                capacity: targetOrder.capacity,
                amount: targetOrder.amount,
                errorMessage: lastErrMsg || "Insufficient DataMart provider balance",
                orderId: targetOrder.id,
              },
              supabase
            ).catch((e) => console.error("Low balance order failed alert error:", e));
          }
        }
      }
    }

    if (
      !paystackVerified &&
      targetOrder.datamart_reference &&
      (targetOrder.delivery_status === "processing" ||
        targetOrder.delivery_status === "pending" ||
        targetOrder.delivery_status === "waiting")
    ) {
      const synced = await syncOrderWithDatamart(targetOrder, supabase, dmCandidates);
      if (synced) {
        targetOrder = synced;
        if (targetOrder.delivery_status === "failed" && isDatamartLowBalanceError(targetOrder.error_message)) {
          sendAdminLowBalanceOrderFailedAlert(
            {
              reference: targetOrder.reference,
              recipientPhone: targetOrder.recipient_phone || targetOrder.phone_number,
              network: targetOrder.network,
              capacity: targetOrder.capacity,
              amount: targetOrder.amount,
              errorMessage: targetOrder.error_message,
              orderId: targetOrder.id,
            },
            supabase
          ).catch((e) => console.error("Low balance order failed alert error:", e));
        }
      }
    }

    if (paystackVerified && dispatchPaymentNotification) {
      dispatchPaymentNotification(targetOrder.delivery_status, targetOrder.datamart_status, targetOrder.error_message);
    }

    return res.status(200).json({ order: isAdmin ? targetOrder : publicOrder(targetOrder) });
  } catch (err: any) {
    console.error("Paystack handler error:", err);
    return res.status(500).json({ error: err?.message || "Internal server error" });
  }
}
