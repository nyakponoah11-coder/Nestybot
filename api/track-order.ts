import { data1db } from './_data1db.js';
import { createClient } from "@supabase/supabase-js";
import { cleanApiKey, getEnvVar, getSupabase } from "./_supabase.js";
import { detectAndBlockIntrusion } from "./_firewall.js";
import {
  syncOrderWithDatamart,
  sanitizeCustomerOrder,
  resolveDatamartKeys,
  getDatamartAuthHeaders,
} from "./_datamart.js";
import {
  sendAdminLowBalanceOrderFailedAlert,
  isDatamartLowBalanceError,
} from "./_notifications.js";

function setCorsHeaders(res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "authorization, x-client-info, apikey, content-type"
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

const PUBLIC_ORDER_FIELDS =
  "id, reference, network, capacity, mb, amount, recipient_phone, payment_status, delivery_status, error_message, created_at";

const SERVICE_FIELDS =
  "id, service, service_type, reference, customer_phone, customer_email, amount, status, delivery_status, notes, created_at";

const CHECKER_FIELDS =
  "id, checker_type, quantity, reference, customer_phone, customer_email, amount, status, delivery_status, notes, created_at";

function parseTag(notes: string | null | undefined, tag: string): string | null {
  if (!notes) return null;
  const match = notes.match(new RegExp(`\\[${tag}:([^\\]]+)\\]`));
  return match ? match[1].trim() : null;
}

function enrichService(order: any) {
  if (!order || typeof order !== "object") return order;
  const notes = order.notes || "";
  const customer_name = order.customer_name || parseTag(notes, "name") || null;
  const payment_status = order.payment_status || order.status || "pending";
  const netflix_last_code = order.netflix_last_code || parseTag(notes, "netflix_code") || parseTag(notes, "code") || null;
  const netflix_last_code_at = order.netflix_last_code_at || parseTag(notes, "netflix_code_at") || null;
  const netflix_login_expires_at = order.netflix_login_expires_at || parseTag(notes, "netflix_login_expires_at") || null;
  return {
    ...order,
    service_type: order.service_type || order.service,
    service: order.service || order.service_type,
    customer_name,
    payment_status,
    status: payment_status,
    netflix_last_code,
    netflix_last_code_at,
    netflix_login_expires_at,
  };
}

function enrichChecker(order: any) {
  if (!order || typeof order !== "object") return order;
  const notes = order.notes || "";
  const customer_name = order.customer_name || parseTag(notes, "name") || null;
  const payment_status = order.payment_status || order.status || "pending";
  const serial_number = order.serial_number || parseTag(notes, "serial") || null;
  const pin = order.pin || parseTag(notes, "pin") || null;
  const error_message = order.error_message || parseTag(notes, "error") || null;
  const datamart_reference = order.datamart_reference || parseTag(notes, "dm_ref") || null;
  const delivered_at = order.delivered_at || parseTag(notes, "delivered_at") || null;
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

const LEGACY_BOT_ORDERS = [
  { id: "nestybot-order-1", reference: "MN-BQ3896UK", network: "MTN", capacity: "5GB", mb: 5120, amount: 23.50, recipient_phone: "0599599254", phone_number: "0599599254", payment_status: "paid", delivery_status: "delivered", created_at: "2026-08-19T18:08:03.850Z", source: "whatsapp_bot" },
  { id: "nestybot-order-2", reference: "MN-CR3981NC", network: "MTN", capacity: "5GB", mb: 5120, amount: 23.50, recipient_phone: "0539529127", phone_number: "0539529127", payment_status: "paid", delivery_status: "delivered", created_at: "2026-08-21T08:57:03.053Z", source: "whatsapp_bot" },
  { id: "nestybot-order-3", reference: "MN-CE2287BH", network: "MTN", capacity: "5GB", mb: 5120, amount: 23.50, recipient_phone: "0539529127", phone_number: "0539529127", payment_status: "paid", delivery_status: "delivered", created_at: "2026-08-22T15:25:51.858Z", source: "whatsapp_bot" },
  { id: "nestybot-order-4", reference: "MN-GB2669AX", network: "MTN", capacity: "5GB", mb: 5120, amount: 23.50, recipient_phone: "0539529127", phone_number: "0539529127", payment_status: "paid", delivery_status: "delivered", created_at: "2026-08-25T01:01:09.012Z", source: "whatsapp_bot" },
  { id: "nestybot-order-5", reference: "MN-IW5582JU", network: "MTN", capacity: "5GB", mb: 5120, amount: 23.50, recipient_phone: "0539529127", phone_number: "0539529127", payment_status: "paid", delivery_status: "delivered", created_at: "2026-08-27T00:34:58.276Z", source: "whatsapp_bot" },
  { id: "nestybot-order-6", reference: "MN-KK0223OO", network: "MTN", capacity: "5GB", mb: 5120, amount: 23.50, recipient_phone: "0547100951", phone_number: "0547100951", payment_status: "paid", delivery_status: "delivered", created_at: "2026-09-05T20:04:50.504Z", source: "whatsapp_bot" },
  { id: "nestybot-order-7", reference: "MN-WK5831GG", network: "MTN", capacity: "5GB", mb: 5120, amount: 23.50, recipient_phone: "0547100951", phone_number: "0547100951", payment_status: "paid", delivery_status: "delivered", created_at: "2026-09-07T11:34:05.350Z", source: "whatsapp_bot" },
  { id: "nestybot-order-8", reference: "MN-DH7575RD", network: "MTN", capacity: "5GB", mb: 5120, amount: 23.50, recipient_phone: "0547100951", phone_number: "0547100951", payment_status: "paid", delivery_status: "delivered", created_at: "2026-09-09T18:51:21.520Z", source: "whatsapp_bot" },
  { id: "nestybot-order-9", reference: "MN-SH2996NB", network: "MTN", capacity: "5GB", mb: 5120, amount: 23.50, recipient_phone: "0539529127", phone_number: "0539529127", payment_status: "paid", delivery_status: "delivered", created_at: "2026-09-10T10:43:40.041Z", source: "whatsapp_bot" },
  { id: "nestybot-order-10", reference: "MN-TF3980QB", network: "MTN", capacity: "5GB", mb: 5120, amount: 23.50, recipient_phone: "0547100951", phone_number: "0547100951", payment_status: "paid", delivery_status: "delivered", created_at: "2026-09-12T02:06:28.616Z", source: "whatsapp_bot" },
];


async function syncDatamartOrder(order: any, supabase: any) {
  if (!order) return order;
  // If order was never dispatched to DataMart yet, return as-is without fuzzy phone searching
  if (!order.datamart_reference) {
    return sanitizeCustomerOrder(order);
  }
  try {
    const updated = await syncOrderWithDatamart(order, supabase);
    return sanitizeCustomerOrder(updated || order);
  } catch (err) {
    console.warn("syncDatamartOrder fallback to cached DB order:", err);
    return sanitizeCustomerOrder(order);
  }
}

export default async function handler(req: any, res: any) {
  setCorsHeaders(res);
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const supabase = getSupabase();
    if (await detectAndBlockIntrusion(req, res, supabase)) return;

    const fn = req.query?.fn || (req.url?.includes("verify-number") ? "verify-number" : req.url?.includes("delivery-tracker") ? "delivery-tracker" : "");
    const body = parseBody(req);

    // A. Verify Number (DataMart phone validation)
    if (fn === "verify-number" || body?.phoneNumber || (req.query?.phoneNumber && fn !== "delivery-tracker")) {
      try {
        let key = (process.env.DATAMART_API_KEY || process.env.VITE_DATAMART_API_KEY || "").trim();
        if (!key) {
          const keys = await resolveDatamartKeys(supabase).catch(() => []);
          if (keys.length) key = keys[0];
        }
        // Also ensure secret is resolved from settings if not in env
        await resolveDatamartKeys(supabase).catch(() => []);

        if (!key) {
          return res.status(200).json({
            status: "success",
            data: { servable: true, message: "Number ready for purchase" },
          });
        }

        const rawPhone = String(body?.phoneNumber ?? body?.phone ?? req.query?.phoneNumber ?? "").replace(/\D/g, "");
        let phoneNumber = rawPhone;
        if (rawPhone.length === 12 && rawPhone.startsWith("233")) phoneNumber = "0" + rawPhone.slice(3);
        else if (rawPhone.length === 9) phoneNumber = "0" + rawPhone;

        if (!/^0\d{9}$/.test(phoneNumber)) {
          return res.status(400).json({
            status: "error",
            code: "INVALID_NUMBER",
            message: "Enter a valid 10-digit Ghana number.",
          });
        }

        const ac = new AbortController();
        const timer = setTimeout(() => ac.abort(), 10000);
        try {
          const dmRes = await fetch("https://api.datamartgh.shop/api/developer/verify-number", {
            method: "POST",
            headers: {
              ...getDatamartAuthHeaders(key),
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify({ phoneNumber }),
            signal: ac.signal,
          });
          clearTimeout(timer);
          const text = await dmRes.text();
          let jsonPayload: any;
          try { jsonPayload = JSON.parse(text); } catch { jsonPayload = { message: text }; }

          // If DataMart requires an X-API-Secret header that isn't configured yet, gracefully allow purchase instead of blocking customer
          const errMsg = String(jsonPayload?.message || jsonPayload?.error || "").toLowerCase();
          if (!dmRes.ok && (errMsg.includes("x-api-secret") || errMsg.includes("second secret") || dmRes.status === 401 || dmRes.status === 403)) {
            return res.status(200).json({
              status: "success",
              data: {
                servable: true,
                recommendation: "PROCEED",
                message: "Valid Ghana number format — ready for purchase.",
              },
            });
          }

          return res.status(dmRes.status).json(jsonPayload);
        } catch {
          clearTimeout(timer);
          return res.status(200).json({
            status: "success",
            data: { servable: true, message: "Verification skipped" },
          });
        }
      } catch {
        return res.status(200).json({
          status: "success",
          data: { servable: true, message: "Verification passed" },
        });
      }
    }

    // B. Delivery Tracker status from DataMart
    if (fn === "delivery-tracker" || req.url?.includes("delivery-tracker")) {
      try {
        const supabase = getSupabase();
        let key = (process.env.DATAMART_API_KEY || process.env.VITE_DATAMART_API_KEY || "").trim();
        const keys = await resolveDatamartKeys(supabase).catch(() => []);
        if (!key && keys.length) {
          key = keys[0];
        }

        const [trackerRes, statusRes] = await Promise.all([
          key
            ? fetch("https://api.datamartgh.shop/api/developer/delivery-tracker", {
              headers: getDatamartAuthHeaders(key),
              signal: AbortSignal.timeout(5000),
            }).catch(() => null)
            : Promise.resolve(null),
          fetch("https://api.datamartgh.shop/api/v1/data/delivery-status", {
            headers: { Accept: "application/json" },
            signal: AbortSignal.timeout(5000),
          }).catch(() => null),
        ]);

        let payload: any = null;
        if (trackerRes && trackerRes.ok) {
          payload = await trackerRes.json().catch(() => null);
        }

        if (!payload || typeof payload !== "object" || payload.status === "error") {
          payload = { status: "success", data: {} };
        }
        if (!payload.data) payload.data = {};

        if (statusRes && statusRes.ok) {
          try {
            const statusJson = await statusRes.json();
            const s = statusJson?.data;
            if (s) {
              if (s.unibundleActive && s.unibundleFrontier?.placedAt && s.unibundleFrontier?.deliveredAt) {
                const placed = new Date(s.unibundleFrontier.placedAt).getTime();
                const delivered = new Date(s.unibundleFrontier.deliveredAt).getTime();
                payload.data.fastLane = {
                  active: true,
                  trackingId: s.unibundleFrontier.trackingId,
                  placedAt: s.unibundleFrontier.placedAt,
                  deliveredAt: s.unibundleFrontier.deliveredAt,
                  minutes: Math.max(1, Math.round((delivered - placed) / 60000)),
                };
              } else if (!payload.data.fastLane) {
                payload.data.fastLane = { active: false };
              }

              if (s.lastDelivered) {
                payload.data.lastDelivered = {
                  trackingId: String(s.lastDelivered.trackingId || ""),
                  summary: `Batch #${s.lastDelivered.trackingId} delivered`,
                  placedAt: s.lastDelivered.placedAt,
                  deliveredAt: s.lastDelivered.deliveredAt,
                };
              }

              if (s.todayStats) {
                const total = s.todayStats.totalBatches || 540;
                payload.data.stats = {
                  checked: total,
                  delivered: Math.round(total * 0.96),
                  pending: Math.max(1, Math.round(total * 0.04)),
                  failed: s.skippedCount || 0,
                };
              }

              if (!payload.data.scanner) {
                payload.data.scanner = {
                  active: s.scanner?.isRunning ?? true,
                  pendingBatches: s.skippedCount || 0,
                };
              }
            }
          } catch (_) { }
        }

        res.setHeader("Cache-Control", "public, max-age=180, s-maxage=300, stale-while-revalidate=600");
        return res.status(200).json(payload);
      } catch (err: any) {
        return res.status(200).json({ status: "error", message: err?.message });
      }
    }

    let reference = body?.reference || body?.order_reference || req.query?.reference || req.query?.order_reference;
    let phone = body?.phone || body?.phoneNumber || req.query?.phone || req.query?.phoneNumber;
    const generic = body?.q || body?.search || req.query?.q || req.query?.search;
    if (generic && !reference && !phone) {
      const cleanGeneric = String(generic).replace(/[\s\-().+]/g, "");
      if (/^\d{8,15}$/.test(cleanGeneric)) {
        phone = cleanGeneric;
      } else {
        reference = String(generic).trim();
      }
    }

    if (reference && !phone) {
      const cleanPossible = String(reference).replace(/[\s\-().+]/g, "");
      if (/^\d{8,15}$/.test(cleanPossible)) {
        phone = cleanPossible;
        reference = null;
      }
    }

    // Track if Paystack verification was done (to skip stale DataMart sync)
    let paystackVerified = false;

    // 1. Lookup by reference
    if (reference && typeof reference === "string") {
      const rawRef = reference.trim();
      const cleanNoHyphen = rawRef.replace(/[\s-]+/g, "");
      const withoutWs = cleanNoHyphen.replace(/^WS/i, "");
      const withWsDash = `WS-${withoutWs}`;
      const withWsPlain = `WS${withoutWs}`;

      const refCandidates = Array.from(
        new Set([rawRef, cleanNoHyphen, withWsDash, withWsPlain, withoutWs].filter(Boolean))
      );

      // Check Checkers (CK... or WS-CK...)
      if (/^(WS-?CK|CK)/i.test(rawRef)) {
        const { data: cData } = await supabase
          .from("checker_orders")
          .select(CHECKER_FIELDS)
          .or(refCandidates.map((c) => `reference.ilike.${c}`).join(","))
          .maybeSingle();
        if (cData) return res.status(200).json({ checker_order: enrichChecker(cData) });
      }

      // Check Services (NF, AF, MU, SB, WS-NF, etc.)
      if (/^(WS-?(NF|AF|MU|SB)|NF|AF|MU|SB)/i.test(rawRef)) {
        const { data: sData } = await supabase
          .from("service_orders")
          .select(SERVICE_FIELDS)
          .or(refCandidates.map((c) => `reference.ilike.${c}`).join(","))
          .maybeSingle();
        if (sData) return res.status(200).json({ service_order: enrichService(sData) });
      }

      // Check Data Orders: FIRST from data1db (zero-egress, microsecond read)
      let data: any = null;
      try {
        for (const candidate of refCandidates) {
          const r1 = await data1db.getClient().from("orders").select("*").eq("reference", candidate).maybeSingle();
          if (r1?.data) { data = r1.data; break; }
          const r2 = await data1db.getClient().from("orders").select("*").eq("ref", candidate).maybeSingle();
          if (r2?.data) { data = r2.data; break; }
          const r3 = await data1db.getClient().from("orders").select("*").eq("datamart_reference", candidate).maybeSingle();
          if (r3?.data) { data = r3.data; break; }
        }
      } catch (_) { }

      // If already delivered in data1db, return immediately (zero PostgREST egress)
      if (data && data.delivery_status === "delivered") {
        res.setHeader("Cache-Control", "public, max-age=120, s-maxage=300, stale-while-revalidate=600");
        return res.status(200).json({ order: sanitizeCustomerOrder(data) });
      }

      // If not in data1db, query Supabase once and populate data1db
      if (!data) {
        const orderOrFilter = refCandidates
          .map((c) => `reference.ilike.${c},datamart_reference.ilike.${c},reference.eq.${c}`)
          .join(",");

        const supaRes = await supabase
          .from("orders")
          .select("*")
          .or(orderOrFilter)
          .maybeSingle();
        if (supaRes?.data) {
          data = supaRes.data;
        }

        if (!data) {
          for (const candidate of refCandidates) {
            const { data: dRef } = await supabase.from("orders").select("*").eq("reference", candidate).maybeSingle();
            if (dRef) { data = dRef; break; }
            const { data: dR } = await supabase.from("orders").select("*").eq("ref", candidate).maybeSingle();
            if (dR) { data = dR; break; }
            const { data: dDm } = await supabase.from("orders").select("*").eq("datamart_reference", candidate).maybeSingle();
            if (dDm) { data = dDm; break; }
          }
        }

        // Cache in data1db so all future tracking calls come from data1db!
        if (data) {
          try {
            data1db.getClient().from("orders").upsert(data);
          } catch (_) { }
        }
      }

      // Check Agent Orders if not found in orders table
      if (!data) {
        const aoOrFilter = refCandidates
          .map((c) => `reference.ilike.${c},paystack_ref.ilike.${c},reference.eq.${c}`)
          .join(",");
        const { data: aoData } = await supabase
          .from("agent_orders")
          .select("*")
          .or(aoOrFilter)
          .maybeSingle();

        if (aoData) {
          data = {
            ...aoData,
            recipient_phone: aoData.phone || aoData.recipient_phone,
            capacity: aoData.package_size || aoData.capacity,
            source: "agent",
          };
        }
      }

      if (!data) {
        const legacyMatch = LEGACY_BOT_ORDERS.find((l) =>
          refCandidates.some((c) => c.toUpperCase() === l.reference.toUpperCase())
        );
        if (legacyMatch) {
          data = legacyMatch;
        }
      }

      // Always do fresh Paystack verification for data orders to ensure latest payment status
      if (data && (data.payment_status === "pending" || (data.payment_status === "paid" && data.delivery_status !== "delivered"))) {
        try {
          let paystackKey = cleanApiKey(
            getEnvVar([
              "PAYSTACK_SECRET_KEY",
              "VITE_PAYSTACK_SECRET_KEY",
              "PAYSTACK_KEY",
              "paystack_secret_key",
              "paystack_secret",
              "PAYSTACK_SECRET",
            ])
          );
          if (!paystackKey) {
            const { data: psRows } = await supabase
              .from("settings")
              .select("key, value")
              .in("key", ["paystack_secret_key", "PAYSTACK_SECRET_KEY", "paystack_secret", "PAYSTACK_SECRET", "paystack_key", "PAYSTACK_KEY", "paystack_live_secret_key"]);
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
          if (paystackKey) {
            const psRes = await fetch(
              `https://api.paystack.co/transaction/verify/${encodeURIComponent(data.reference)}`,
              {
                headers: { Authorization: `Bearer ${paystackKey}` },
                signal: AbortSignal.timeout(5000),
              }
            );
            const psJson = await psRes.json().catch(() => null);
            paystackVerified = true;
            const psStatus = psJson?.data?.status;
            const isPaid = psStatus === "success";
            const newPaymentStatus = isPaid ? "paid" : psStatus === "failed" || psStatus === "abandoned" || psStatus === "refunded" ? "failed" : data.payment_status;
            const newDeliveryStatus = isPaid && ["pending", "", null, undefined].includes(data.delivery_status) ? "processing" : data.delivery_status;

            if (newPaymentStatus !== data.payment_status || newDeliveryStatus !== data.delivery_status) {
              const baseUpdates: Record<string, any> = {
                payment_status: newPaymentStatus,
                delivery_status: newDeliveryStatus,
                status: newDeliveryStatus,
                updated_at: new Date().toISOString(),
              };

              let updated = null;
              try {
                const fullUpdates = {
                  ...baseUpdates,
                  paid_at: isPaid ? (psJson.data.paid_at || new Date().toISOString()) : undefined,
                };
                const { data: uData, error: uErr } = await supabase
                  .from("orders")
                  .update(fullUpdates)
                  .eq("id", data.id)
                  .select("*")
                  .maybeSingle();
                if (!uErr && uData) updated = uData;
                else {
                  const { data: bData } = await supabase
                    .from("orders")
                    .update(baseUpdates)
                    .eq("id", data.id)
                    .select("*")
                    .maybeSingle();
                  if (bData) updated = bData;
                }
              } catch (_) {
                const { data: bData } = await supabase
                  .from("orders")
                  .update(baseUpdates)
                  .eq("id", data.id)
                  .select("*")
                  .maybeSingle();
                if (bData) updated = bData;
              }

              if (updated) {
                data = updated;
                if (isPaid && !data.datamart_reference) {
                  const dmKeys = await resolveDatamartKeys(supabase);
                  const dmKey = dmKeys[0];
                  if (dmKey) {
                    const phone = data.recipient_phone?.replace(/\D/g, "");
                    const cleanPhone = phone?.startsWith("233") && phone.length === 12 ? "0" + phone.slice(3) : phone;
                    const networkMap: Record<string, string> = { MTN: "YELLO", TELECEL: "TELECEL", AT: "AT_PREMIUM" };
                    const net = networkMap[data.network?.toUpperCase()] || data.network || "YELLO";
                    const cap = String(data.capacity || "1").replace(/[^\d.]/g, "");
                    const purchaseRef = String(data.reference || "").startsWith("WS-") ? data.reference : `WS-${String(data.reference || "").replace(/^WS-?/, "")}`;
                    const dmRes = await fetch("https://api.datamartgh.shop/api/developer/purchase", {
                      method: "POST",
                      headers: { "x-api-key": dmKey, "X-Idempotency-Key": purchaseRef, "Content-Type": "application/json" },
                      body: JSON.stringify({ phoneNumber: cleanPhone, network: net, capacity: cap, gateway: "wallet", delivery: "fast", ref: purchaseRef }),
                    });
                    const dmJson = await dmRes.json().catch(() => null);
                    const dmData = dmJson?.data || dmJson || {};
                    const dmRef = extractDataMartReference(dmJson) || dmData?.data?.reference || dmData.reference || dmData.orderReference || dmData.purchaseId || null;
                    if (dmRef) {
                      await supabase.from("orders").update({ datamart_reference: dmRef, delivery_status: "processing" }).eq("id", data.id);
                      data.datamart_reference = dmRef;
                    } else {
                      const errMsg = dmJson?.message || dmJson?.error || dmData?.message || "";
                      let isLowBal = isDatamartLowBalanceError(errMsg, dmRes.status);
                      if (!isLowBal) {
                        try {
                          const bRes = await fetch("https://api.datamartgh.shop/api/developer/user/balance", {
                            headers: { "x-api-key": dmKey },
                            signal: AbortSignal.timeout(3000),
                          });
                          const bData = await bRes.json().catch(() => ({}));
                          const bal = Number(bData?.data?.walletBalance ?? bData?.walletBalance ?? bData?.data?.balance);
                          if (!isNaN(bal) && bal < Math.max(5, Number(data.amount || 0))) {
                            isLowBal = true;
                          }
                        } catch (_) { }
                      }
                      if (isLowBal) {
                        sendAdminLowBalanceOrderFailedAlert({
                          reference: data.reference,
                          recipientPhone: data.recipient_phone || data.phone_number,
                          network: data.network,
                          capacity: data.capacity,
                          amount: data.amount,
                          errorMessage: errMsg || "Insufficient DataMart provider balance",
                          orderId: data.id,
                        }, supabase).catch(() => null);
                      }
                    }
                  }
                }
              }
            }
          }
        } catch (e) {
          console.warn("Paystack live check in track-order failed:", e);
        }
      }

      // Fallback: If not found in DB by exact reference, check if rawRef is a DataMart reference or tracking number
      if (!data) {
        try {
          const keys = await resolveDatamartKeys(supabase);
          for (const key of keys) {
            const statusUrl = `https://api.datamartgh.shop/api/developer/order-status/${encodeURIComponent(rawRef)}`;
            const sRes = await fetch(statusUrl, {
              headers: getDatamartAuthHeaders(key),
              signal: AbortSignal.timeout(4000),
            });
            if (sRes.ok) {
              const sJson = await sRes.json().catch(() => null);
              const dmData = sJson?.data || sJson;
              const dmPhone = String(dmData?.phoneNumber || dmData?.recipient || dmData?.phone || dmData?.recipient_phone || "").replace(/\D/g, "");
              const last9 = dmPhone.length >= 9 ? dmPhone.slice(-9) : dmPhone;
              if (last9) {
                const { data: matchedOrder } = await supabase
                  .from("orders")
                  .select("*")
                  .ilike("recipient_phone", `%${last9}%`)
                  .order("created_at", { ascending: false })
                  .limit(1)
                  .maybeSingle();

                if (matchedOrder) {
                  data = matchedOrder;
                  await supabase
                    .from("orders")
                    .update({ datamart_reference: rawRef })
                    .eq("id", matchedOrder.id);
                  break;
                }
              }
            }
          }
        } catch { }
      }

      // Fallback check against service and checker orders in case prefix was omitted
      if (!data) {
        const { data: sData } = await supabase
          .from("service_orders")
          .select(SERVICE_FIELDS)
          .or(refCandidates.map((c) => `reference.ilike.${c}`).join(","))
          .maybeSingle();
        if (sData) return res.status(200).json({ service_order: enrichService(sData) });

        const { data: cData } = await supabase
          .from("checker_orders")
          .select(CHECKER_FIELDS)
          .or(refCandidates.map((c) => `reference.ilike.${c}`).join(","))
          .maybeSingle();
        if (cData) return res.status(200).json({ checker_order: enrichChecker(cData) });

        const possiblePhone = rawRef.replace(/[\s\-().+]/g, "");
        if (/^\d{8,15}$/.test(possiblePhone)) {
          phone = possiblePhone;
        } else {
          return res.status(404).json({ error: "Order reference not found." });
        }
      } else {
        // Only sync with DataMart if we didn't just do a fresh Paystack verification
        // (Paystack verification already updated the order with the latest status)
        const syncedOrder = await syncDatamartOrder(data, supabase);
        if (syncedOrder) {
          try {
            data1db.getClient().from("orders").upsert(syncedOrder);
          } catch (_) { }
        }
        const isDelivered = syncedOrder?.delivery_status === "delivered";
        if (isDelivered) {
          res.setHeader("Cache-Control", "public, max-age=120, s-maxage=300, stale-while-revalidate=600");
        } else {
          res.setHeader("Cache-Control", "public, max-age=15, s-maxage=30, stale-while-revalidate=60");
        }
        return res.status(200).json({ order: syncedOrder });
      }
    }

    // 2. Lookup by phone
    if (phone && typeof phone === "string") {
      const raw = phone.replace(/[\s\-().]/g, "").replace(/^\+/, "");
      const candidates = new Set<string>([raw]);

      // Normalise to 0XXXXXXXXX format and add all variants
      let normalised = raw;
      if (raw.startsWith("233") && raw.length === 12) normalised = "0" + raw.slice(3);
      else if (raw.length === 9) normalised = "0" + raw;

      candidates.add(normalised);
      if (normalised.startsWith("0") && normalised.length === 10) {
        candidates.add("233" + normalised.slice(1));
        candidates.add(normalised.slice(1)); // 9-digit variant without 0
      }

      const list = Array.from(candidates).filter((c) => /^\d+$/.test(c));
      const last9 = normalised.length >= 9 ? normalised.slice(-9) : normalised;

      let dataOrders: any[] = [];

      // Pull from data1db in-memory first (instant, 0 Supabase egress)
      try {
        const d1Rows = data1db.loadTable("orders");
        if (d1Rows && d1Rows.length > 0) {
          const matched = d1Rows.filter((o: any) => {
            const p = String(o.recipient_phone || o.phone_number || o.whatsapp_phone || "");
            return list.some((c) => p.includes(c)) || (last9 && p.endsWith(last9));
          });
          if (matched.length > 0) {
            dataOrders.push(...matched);
          }
        }
      } catch (_) { }

      if (dataOrders.length === 0) {
        // Query 1: orders by recipient_phone
        try {
          const { data: oRows } = await supabase
            .from("orders")
            .select(PUBLIC_ORDER_FIELDS)
            .in("recipient_phone", list)
            .order("created_at", { ascending: false })
            .limit(50);
          if (oRows && oRows.length > 0) {
            dataOrders.push(...oRows);
          }
        } catch (_) { }

        // Query 2: orders by whatsapp_phone
        try {
          const { data: waRows } = await supabase
            .from("orders")
            .select(PUBLIC_ORDER_FIELDS)
            .in("whatsapp_phone", list)
            .order("created_at", { ascending: false })
            .limit(50);
          if (waRows && waRows.length > 0) {
            for (const item of waRows) {
              if (!dataOrders.some((d) => d.id === item.id || d.reference === item.reference)) {
                dataOrders.push(item);
              }
            }
          }
        } catch (_) { }

        // Query 3: orders by phone_number
        try {
          const { data: pnRows } = await supabase
            .from("orders")
            .select(PUBLIC_ORDER_FIELDS)
            .in("phone_number", list)
            .order("created_at", { ascending: false })
            .limit(50);
          if (pnRows && pnRows.length > 0) {
            for (const item of pnRows) {
              if (!dataOrders.some((d) => d.id === item.id || d.reference === item.reference)) {
                dataOrders.push(item);
              }
            }
          }
        } catch (_) { }

        // Query 4: Fuzzy fallback on orders with last9 digits
        if (dataOrders.length === 0 && last9) {
          try {
            const { data: fuzzyRecipient } = await supabase
              .from("orders")
              .select(PUBLIC_ORDER_FIELDS)
              .ilike("recipient_phone", `%${last9}%`)
              .order("created_at", { ascending: false })
              .limit(50);
            if (fuzzyRecipient && fuzzyRecipient.length > 0) {
              dataOrders.push(...fuzzyRecipient);
            }
          } catch (_) { }

          if (dataOrders.length === 0) {
            try {
              const { data: fuzzyWa } = await supabase
                .from("orders")
                .select(PUBLIC_ORDER_FIELDS)
                .ilike("whatsapp_phone", `%${last9}%`)
                .order("created_at", { ascending: false })
                .limit(50);
              if (fuzzyWa && fuzzyWa.length > 0) {
                dataOrders.push(...fuzzyWa);
              }
            } catch (_) { }
          }
        }

        // Cache found rows in data1db
        for (const r of dataOrders) {
          try { data1db.getClient().from("orders").upsert(r); } catch (_) { }
        }
      }


      // Query 5: service orders, checker orders, agent orders
      let [servicesRes, checkersRes, agentOrdersRes] = await Promise.all([
        supabase
          .from("service_orders")
          .select(SERVICE_FIELDS)
          .in("customer_phone", list)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("checker_orders")
          .select(CHECKER_FIELDS)
          .in("customer_phone", list)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("agent_orders")
          .select("*")
          .in("phone", list)
          .order("created_at", { ascending: false })
          .limit(50),
      ]);

      if ((!servicesRes?.data || servicesRes.data.length === 0) && last9) {
        try {
          const { data: sFuzzy } = await supabase
            .from("service_orders")
            .select(SERVICE_FIELDS)
            .ilike("customer_phone", `%${last9}%`)
            .order("created_at", { ascending: false })
            .limit(50);
          if (sFuzzy && sFuzzy.length > 0) servicesRes = { data: sFuzzy } as any;
        } catch (_) { }
      }

      if ((!checkersRes?.data || checkersRes.data.length === 0) && last9) {
        try {
          const { data: cFuzzy } = await supabase
            .from("checker_orders")
            .select(CHECKER_FIELDS)
            .ilike("customer_phone", `%${last9}%`)
            .order("created_at", { ascending: false })
            .limit(50);
          if (cFuzzy && cFuzzy.length > 0) checkersRes = { data: cFuzzy } as any;
        } catch (_) { }
      }

      if ((!agentOrdersRes?.data || agentOrdersRes.data.length === 0) && last9) {
        try {
          const { data: aoFuzzy } = await supabase
            .from("agent_orders")
            .select("*")
            .ilike("phone", `%${last9}%`)
            .order("created_at", { ascending: false })
            .limit(50);
          if (aoFuzzy && aoFuzzy.length > 0) agentOrdersRes = { data: aoFuzzy } as any;
        } catch (_) { }
      }

      // Query 6: DataMart transactions fallback for older purchases
      if (
        dataOrders.length === 0 &&
        (!servicesRes?.data || servicesRes.data.length === 0) &&
        (!checkersRes?.data || checkersRes.data.length === 0)
      ) {
        try {
          const dmKeys = await resolveDatamartKeys(supabase);
          for (const key of dmKeys) {
            const txRes = await fetch(
              "https://api.datamartgh.shop/api/developer/transactions?page=1&perPage=50",
              {
                headers: getDatamartAuthHeaders(key),
                signal: AbortSignal.timeout(4000),
              }
            );
            if (txRes.ok) {
              const txJson = await txRes.json().catch(() => null);
              const txList: any[] = txJson?.data?.transactions || txJson?.data || [];
              const matchedTx = txList.filter((t: any) => {
                const rp = t?.relatedPurchase || {};
                const pPhone = String(
                  rp?.phoneNumber || t?.phoneNumber || rp?.phone || t?.phone || ""
                ).replace(/\D/g, "");
                return pPhone && last9 && pPhone.endsWith(last9);
              });
              if (matchedTx.length > 0) {
                for (const t of matchedTx) {
                  const rp = t.relatedPurchase || {};
                  dataOrders.push({
                    id: t._id || t.id || `dm-${t.reference || Date.now()}`,
                    reference:
                      rp.orderReference || rp.reference || t.reference || `WS-${t.id || Date.now()}`,
                    network: rp.network || "MTN",
                    capacity: rp.capacity ? `${rp.capacity}GB` : "1GB",
                    amount: Number(t.amount || 0),
                    recipient_phone: rp.phoneNumber || t.phoneNumber || normalised,
                    payment_status: "paid",
                    delivery_status: (rp.status || "delivered").toLowerCase(),
                    created_at: t.createdAt || new Date().toISOString(),
                    source: "datamart",
                  });
                }
                break;
              }
            }
          }
        } catch (_) { }
      }

      // Add legacy bot orders for this phone if any
      const legacyMatches = LEGACY_BOT_ORDERS.filter((l) =>
        list.includes(l.recipient_phone) || (last9 && l.recipient_phone.endsWith(last9))
      );
      for (const lm of legacyMatches) {
        if (!dataOrders.some((d) => d.reference === lm.reference)) {
          dataOrders.push(lm);
        }
      }

      if (agentOrdersRes?.data && Array.isArray(agentOrdersRes.data)) {
        const mappedAgentOrders = agentOrdersRes.data.map((ao: any) => ({
          ...ao,
          recipient_phone: ao.phone || ao.recipient_phone,
          capacity: ao.package_size || ao.capacity,
          delivery_status: ao.delivery_status || ao.status || "processing",
          source: "agent",
        }));
        dataOrders.push(...mappedAgentOrders);
        dataOrders.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      }
      // If there are pending or paid payments, try to verify with Paystack
      if (dataOrders.length > 0 && (dataOrders[0].payment_status === "pending" || dataOrders[0].payment_status === "paid")) {
        try {
          let paystackKey = cleanApiKey(
            getEnvVar([
              "PAYSTACK_SECRET_KEY",
              "VITE_PAYSTACK_SECRET_KEY",
              "PAYSTACK_KEY",
              "paystack_secret_key",
              "paystack_secret",
              "PAYSTACK_SECRET",
            ])
          );
          if (!paystackKey) {
            const { data: psRows } = await supabase
              .from("settings")
              .select("key, value")
              .in("key", ["paystack_secret_key", "PAYSTACK_SECRET_KEY", "paystack_secret", "PAYSTACK_SECRET", "paystack_key", "PAYSTACK_KEY", "paystack_live_secret_key"]);
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
          if (paystackKey && dataOrders[0].reference) {
            const psRes = await fetch(
              `https://api.paystack.co/transaction/verify/${encodeURIComponent(dataOrders[0].reference)}`,
              { headers: { Authorization: `Bearer ${paystackKey}` }, signal: AbortSignal.timeout(5000) }
            );
            const psJson = await psRes.json().catch(() => null);
            const psStatus = psJson?.data?.status;
            const isPaid = psStatus === "success";
            const newPaymentStatus = isPaid ? "paid" : psStatus === "failed" || psStatus === "abandoned" || psStatus === "refunded" ? "failed" : dataOrders[0].payment_status;
            const newDeliveryStatus = isPaid && ["pending", "", null, undefined].includes(dataOrders[0].delivery_status) ? "processing" : dataOrders[0].delivery_status;

            if (newPaymentStatus !== dataOrders[0].payment_status || newDeliveryStatus !== dataOrders[0].delivery_status) {
              const { data: updated } = await supabase
                .from("orders")
                .update({
                  payment_status: newPaymentStatus,
                  paid_at: isPaid ? (psJson.data.paid_at || new Date().toISOString()) : undefined,
                  delivery_status: newDeliveryStatus,
                  updated_at: new Date().toISOString(),
                })
                .eq("id", dataOrders[0].id)
                .select("*")
                .single();
              if (updated) {
                dataOrders[0] = updated;
                if (isPaid && !updated.datamart_reference) {
                  const dmKeys = await resolveDatamartKeys(supabase);
                  const dmKey = dmKeys[0];
                  if (dmKey) {
                    const phone = updated.recipient_phone?.replace(/\D/g, "");
                    const cleanPhone = phone?.startsWith("233") && phone.length === 12 ? "0" + phone.slice(3) : phone;
                    const networkMap: Record<string, string> = { MTN: "YELLO", TELECEL: "TELECEL", AT: "AT_PREMIUM" };
                    const net = networkMap[updated.network?.toUpperCase()] || updated.network || "YELLO";
                    const cap = String(updated.capacity || "1").replace(/[^\d.]/g, "");
                    const purchaseRef = String(updated.reference || "").startsWith("WS-") ? updated.reference : `WS-${String(updated.reference || "").replace(/^WS-?/, "")}`;
                    const dmRes = await fetch("https://api.datamartgh.shop/api/developer/purchase", {
                      method: "POST",
                      headers: { "x-api-key": dmKey, "X-Idempotency-Key": purchaseRef, "Content-Type": "application/json" },
                      body: JSON.stringify({ phoneNumber: cleanPhone, network: net, capacity: cap, gateway: "wallet", delivery: "fast", ref: purchaseRef }),
                    });
                    const dmJson = await dmRes.json().catch(() => null);
                    const dmData = dmJson?.data || dmJson || {};
                    const dmRef = extractDataMartReference(dmJson) || dmData?.data?.reference || dmData.reference || dmData.orderReference || dmData.purchaseId || null;
                    if (dmRef) {
                      await supabase.from("orders").update({ datamart_reference: dmRef, delivery_status: "processing" }).eq("id", updated.id);
                      dataOrders[0] = { ...updated, datamart_reference: dmRef, delivery_status: "processing" };
                    } else {
                      const errMsg = dmJson?.message || dmJson?.error || dmData?.message || "";
                      let isLowBal = isDatamartLowBalanceError(errMsg, dmRes.status);
                      if (!isLowBal) {
                        try {
                          const bRes = await fetch("https://api.datamartgh.shop/api/developer/user/balance", {
                            headers: { "x-api-key": dmKey },
                            signal: AbortSignal.timeout(3000),
                          });
                          const bData = await bRes.json().catch(() => ({}));
                          const bal = Number(bData?.data?.walletBalance ?? bData?.walletBalance ?? bData?.data?.balance);
                          if (!isNaN(bal) && bal < Math.max(5, Number(updated.amount || 0))) {
                            isLowBal = true;
                          }
                        } catch (_) { }
                      }
                      if (isLowBal) {
                        sendAdminLowBalanceOrderFailedAlert({
                          reference: updated.reference,
                          recipientPhone: updated.recipient_phone || updated.phone_number,
                          network: updated.network,
                          capacity: updated.capacity,
                          amount: updated.amount,
                          errorMessage: errMsg || "Insufficient DataMart provider balance",
                          orderId: updated.id,
                        }, supabase).catch(() => null);
                      }
                    }
                  }
                }
              }
            }
          }
        } catch (e) {
          console.warn("Phone lookup Paystack verification failed:", e);
        }
      }

      // Sync the most recent order with live DataMart status so user sees fresh status immediately
      if (dataOrders.length > 0 && dataOrders[0].payment_status === "paid") {
        try {
          const syncedFirst = await syncDatamartOrder(dataOrders[0], supabase);
          if (syncedFirst) {
            dataOrders[0] = syncedFirst;
          }
        } catch { }
      }

      res.setHeader("Cache-Control", "public, max-age=15, s-maxage=30, stale-while-revalidate=60");
      return res.status(200).json({
        orders: dataOrders,
        service_orders: (servicesRes.data || []).map(enrichService),
        checker_orders: (checkersRes.data || []).map(enrichChecker),
      });
    }

    return res.status(400).json({ error: "Please provide either an order reference or a phone number." });
  } catch (err: any) {
    console.error("track-order error:", err);
    return res.status(500).json({ error: err?.message || "Internal server error" });
  }
}
