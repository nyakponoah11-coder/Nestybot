// Initialize a Paystack transaction for a data bundle purchase.
// Creates a pending order and returns Paystack authorization_url.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PAYSTACK_BASE = "https://api.paystack.co";

// Only allow post-payment redirects back to our own origins. Anything else is
// dropped (Paystack then falls back to the dashboard-configured callback).
function safeCallbackUrl(raw: unknown): string | undefined {
  if (typeof raw !== "string" || !raw) return undefined;
  let u: URL;
  try { u = new URL(raw); } catch { return undefined; }
  if (u.protocol !== "https:" && u.hostname !== "localhost") return undefined;
  return u.toString();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!PAYSTACK_SECRET_KEY) {
      return new Response(JSON.stringify({
        error: "Paystack secret key is not configured in Supabase. Please add PAYSTACK_SECRET_KEY under Project Settings -> Edge Functions -> Secrets in Supabase."
      }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { product_id, recipient_phone, customer_email, callback_url } = await req.json();

    if (!product_id || !recipient_phone) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const phone = String(recipient_phone).replace(/\s+/g, "");
    if (!/^(0\d{9}|233\d{9})$/.test(phone)) {
      return new Response(JSON.stringify({ error: "Invalid Ghana phone number" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Email is optional now — Paystack still requires one for the receipt,
    // so synthesize a placeholder from the phone number when not provided.
    const email = (customer_email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer_email))
      ? customer_email.trim()
      : `${phone}@datashop-receipts.com`;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: product, error: pErr } = await supabase
      .from("products").select("*").eq("id", product_id).maybeSingle();
    if (pErr || !product) {
      return new Response(JSON.stringify({ error: "Product not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!product.in_stock) {
      return new Response(JSON.stringify({ error: "Product is out of stock" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rand = Math.random().toString(36).slice(2, 5).toUpperCase();
    const tail = Date.now().toString(36).slice(-4).toUpperCase();
    const reference = `WS${tail}${rand}`;
    const amountKobo = Math.round(Number(product.price) * 100);

    // Initialize Paystack
    const psRes = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        amount: amountKobo,
        currency: "GHS",
        reference,
        callback_url: safeCallbackUrl(callback_url),
        metadata: {
          product_id, recipient_phone: phone, network: product.network, capacity: product.capacity,
        },
      }),
    });
    const psData = await psRes.json();
    if (!psRes.ok || !psData.status) {
      console.error("Paystack init failed", psData);
      return new Response(JSON.stringify({ error: psData.message || "Payment init failed" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert pending order
    const orderPayload: Record<string, any> = {
      reference,
      ref: reference,
      product_id: product.id,
      network: product.network,
      capacity: product.capacity,
      mb: product.mb,
      recipient_phone: phone,
      phone_number: phone,
      phone: phone,
      customer_email: email,
      amount: product.price,
      payment_status: "pending",
      delivery_status: "pending",
    };

    let { error: oErr } = await supabase.from("orders").insert(orderPayload);
    while (oErr && oErr.message && oErr.message.includes("Could not find the '") && oErr.message.includes("' column of 'orders'")) {
      const match = oErr.message.match(/Could not find the '([^']+)' column/);
      if (match && match[1]) {
        delete orderPayload[match[1]];
        const retry = await supabase.from("orders").insert(orderPayload);
        oErr = retry.error;
      } else {
        break;
      }
    }
    if (oErr) {
      console.error("Order insert failed", oErr);
      return new Response(JSON.stringify({ error: "Could not create order: " + oErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      authorization_url: psData.data.authorization_url,
      access_code: psData.data.access_code,
      reference,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
