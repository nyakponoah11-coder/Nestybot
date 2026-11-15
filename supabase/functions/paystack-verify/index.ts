// Verifies a Paystack transaction by reference. If paid and the order has not
// yet been delivered, calls Datamart to deliver the data bundle. When a
// datamart_reference already exists, it polls Datamart's order-status endpoint
// so we always reflect Datamart's true status (pending / processing / completed
// / failed) rather than optimistically marking it "delivered".
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PAYSTACK_BASE = "https://api.paystack.co";
const DATAMART_BASE = "https://api.datamartgh.shop/api/developer";

// Map Datamart's orderStatus to our internal delivery_status.
// Datamart values seen: "pending", "processing", "completed", "failed", "refunded".
function mapDatamartStatus(s: string | undefined | null): string {
  const v = (s || "").toLowerCase().trim();
  if (v === "failed" || v === "cancelled" || v === "canceled" || v === "rejected" || v === "declined") return "failed";
  if (v === "delivered" || v === "completed" || v === "fulfilled" || v === "done" || v === "successful") return "delivered";
  if (v === "refunded") return "refunded";
  if (v === "waiting") return "waiting";
  return "processing";
}

async function fetchDatamartStatus(reference: string, apiKey: string, apiSecret?: string) {
  try {
    const res = await fetch(`${DATAMART_BASE}/order-status/${encodeURIComponent(reference)}`, {
      headers: { "X-API-Key": apiKey, ...(apiSecret ? { "X-API-Secret": apiSecret } : {}) },
    });
    const json = await res.json().catch(() => null);
    if (!json) return null;
    const data = json.data && typeof json.data === "object" ? json.data : json;
    const rawCandidate =
      data.orderStatus ||
      data.order_status ||
      data.deliveryStatus ||
      data.delivery_status ||
      data.status ||
      json.status;

    let orderStatus: string | undefined = undefined;
    if (rawCandidate && typeof rawCandidate === "string") {
      const lower = rawCandidate.toLowerCase().trim();
      if (!["ok", "success", "true"].includes(lower)) {
        orderStatus = lower;
      } else if (data.orderStatus || data.deliveryStatus) {
        orderStatus = lower;
      }
    }

    return {
      orderStatus,
      orderId: (data.orderReference || data.reference || data.orderId || data.purchaseId || data.trackingId) as string | undefined,
    };
  } catch (_) {
    return null;
  }
}

// Public-safe projection: strips PII, internal error diagnostics,
// and any provider references/statuses so customers never see DataMart.
function publicOrder(o: Record<string, unknown> | null | undefined) {
  if (!o) return null;
  return {
    reference: o.reference,
    network: o.network,
    capacity: o.capacity,
    mb: o.mb,
    amount: o.amount,
    recipient_phone: o.recipient_phone,
    payment_status: o.payment_status,
    delivery_status: o.delivery_status,
    created_at: o.created_at,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");
    const DATAMART_API_KEY = Deno.env.get("DATAMART_API_KEY");
    if (!PAYSTACK_SECRET_KEY) throw new Error("PAYSTACK_SECRET_KEY not configured in Supabase Secrets");
    const DATAMART_API_SECRET = Deno.env.get("DATAMART_API_SECRET");

    const { reference } = await req.json();
    if (!reference || typeof reference !== "string") {
      return new Response(JSON.stringify({ error: "Missing reference" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: order, error: oErr } = await supabase
      .from("orders").select("*").eq("reference", reference).maybeSingle();
    if (oErr || !order) {
      return new Response(JSON.stringify({ error: "Order not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If a provider reference exists, sync status. Otherwise retry delivery using
    // the same idempotency key after correcting a transient API configuration error.
    if (order.payment_status === "paid" && order.datamart_reference) {
      const dm = DATAMART_API_KEY
        ? await fetchDatamartStatus(order.datamart_reference, DATAMART_API_KEY, DATAMART_API_SECRET)
        : null;
      if (dm?.orderStatus) {
        const mapped = mapDatamartStatus(dm.orderStatus);
        await supabase.from("orders").update({
          delivery_status: mapped,
          datamart_status: String(dm.orderStatus).toLowerCase(),
          datamart_reference: order.datamart_reference || dm.orderId || null,
        }).eq("reference", reference);
      }
      const { data: o2 } = await supabase.from("orders").select("*").eq("reference", reference).maybeSingle();
      return new Response(JSON.stringify({ order: publicOrder(o2) }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (order.payment_status !== "paid") {
      // Verify with Paystack
      const verRes = await fetch(`${PAYSTACK_BASE}/transaction/verify/${encodeURIComponent(reference)}`, {
        headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
      });
      const verData = await verRes.json();
      if (!verRes.ok || !verData.status) {
        console.error("Paystack verify failed", verData);
        return new Response(JSON.stringify({ error: "Verify failed" }), {
          status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const status = verData.data?.status; // 'success' | 'failed' | 'abandoned' | ...
      if (status !== "success") {
        // NEVER revert a confirmed payment - once paid, always paid
        // Only update if payment_status is not already "paid"
        if (order.payment_status !== "paid") {
          await supabase.from("orders").update({
            payment_status: "failed",
            delivery_status: "failed",
            status: "failed",
            error_message: verData.data?.gateway_response || verData.data?.message || (status === "abandoned" ? "Transaction abandoned" : "Payment failed"),
            updated_at: new Date().toISOString(),
          }).eq("reference", reference);
        }
        const { data: o2 } = await supabase.from("orders").select("*").eq("reference", reference).maybeSingle();
        return new Response(JSON.stringify({ order: publicOrder(o2) }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Persist confirmed payment even if the supplier key is unavailable.
      await supabase.from("orders").update({
        payment_status: "paid",
        delivery_status: "processing",
      }).eq("reference", reference);
    }

    // Mark processing before submitting or retrying the idempotent purchase.
    await supabase.from("orders").update({
      delivery_status: "processing",
    }).eq("reference", reference);

    // Submit to Supplier (Datamart or Akwaaba Sale).
    const networkMap: Record<string, string> = { MTN: "YELLO", TELECEL: "TELECEL", AT: "AT_PREMIUM" };
    const dmNetwork = networkMap[order.network] ?? order.network;

    const AKWAABA_API_KEY = Deno.env.get("AKWAABA_API_KEY") || Deno.env.get("AKWAABA_SALE_API_KEY");
    const AKWAABA_API_URL = Deno.env.get("AKWAABA_API_URL") || Deno.env.get("AKWAABA_URL") || "https://akwaabasale.com/api";

    let fulfilled = false;

    // 1. Try DataMart if configured
    if (DATAMART_API_KEY) {
      try {
        const dmRes = await fetch(`${DATAMART_BASE}/purchase`, {
          method: "POST",
          headers: {
            "X-API-Key": DATAMART_API_KEY,
            ...(DATAMART_API_SECRET ? { "X-API-Secret": DATAMART_API_SECRET } : {}),
            "X-Idempotency-Key": reference,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            phoneNumber: order.recipient_phone,
            network: dmNetwork,
            capacity: String(order.capacity),
            gateway: "wallet",
            ref: reference,
          }),
        });
        const dmData = await dmRes.json();
        if (dmRes.ok && dmData.status === "success") {
          const reported = dmData.data?.orderStatus || dmData.data?.deliveryStatus || dmData.data?.delivery_status;
          const rawStatus = String(reported || "unknown").toLowerCase().trim();
          const mapped = mapDatamartStatus(rawStatus);
          await supabase.from("orders").update({
            delivery_status: mapped,
            datamart_status: rawStatus,
            datamart_reference: dmData.data?.orderReference || dmData.data?.reference || dmData.data?.purchaseId || dmData.data?.orderId || null,
          }).eq("reference", reference);
          fulfilled = true;
        } else {
          console.error("Datamart purchase failed", dmData);
        }
      } catch (dErr) {
        console.error("Datamart call error", dErr);
      }
    }

    // 2. Try Akwaaba Sale if DataMart not configured or failed
    if (!fulfilled && AKWAABA_API_KEY) {
      try {
        const akRes = await fetch(`${AKWAABA_API_URL.replace(/\/+$/, '')}/purchase`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${AKWAABA_API_KEY}`,
            "X-API-Key": AKWAABA_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            phone: order.recipient_phone,
            phoneNumber: order.recipient_phone,
            network: order.network,
            capacity: String(order.capacity),
            reference: reference,
          }),
        });
        const akData = await akRes.json();
        if (akRes.ok && (akData.status === "success" || akData.success)) {
          await supabase.from("orders").update({
            delivery_status: "processing",
            datamart_reference: akData.reference || akData.order_id || akData.id || null,
          }).eq("reference", reference);
          fulfilled = true;
        }
      } catch (akErr) {
        console.error("Akwaaba Sale call error", akErr);
      }
    }

    if (!fulfilled && !DATAMART_API_KEY && !AKWAABA_API_KEY) {
      // Both keys missing from environment — keep order paid and mark pending fulfillment
      await supabase.from("orders").update({
        delivery_status: "pending",
        error_message: "Payment received. Waiting for supplier API key configuration.",
      }).eq("reference", reference);
    } else if (!fulfilled) {
      await supabase.from("orders").update({
        delivery_status: "failed",
        error_message: "Supplier order submission failed",
      }).eq("reference", reference);
    }

    const { data: finalOrder } = await supabase.from("orders").select("*").eq("reference", reference).maybeSingle();
    return new Response(JSON.stringify({ order: publicOrder(finalOrder) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
