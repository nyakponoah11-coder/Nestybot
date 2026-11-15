// Initialize a Paystack transaction for an "Other Service" purchase (Netflix / AFA).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PAYSTACK_BASE = "https://api.paystack.co";

const DEFAULTS: Record<string, { amount: number; label: string; prefix: string; settingKey: string }> = {
  netflix: { amount: 30, label: "Netflix 1-month sign-in", prefix: "NF", settingKey: "netflix_price" },
  afa: { amount: 20, label: "AFA registration", prefix: "AF", settingKey: "afa_price" },
  mashup: { amount: 25, label: "MTN Mashup", prefix: "MU", settingKey: "mashup_price" },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!PAYSTACK_SECRET_KEY) throw new Error("PAYSTACK_SECRET_KEY not configured");

    const { service, customer_phone, customer_email, customer_name, callback_url } = await req.json();

    const cfg = DEFAULTS[String(service || "").toLowerCase()];
    if (!cfg) return json({ error: "Invalid service" }, 400);

    const phone = String(customer_phone || "").replace(/\s+/g, "");
    if (!/^(0\d{9}|233\d{9})$/.test(phone)) return json({ error: "Invalid Ghana phone" }, 400);

    const email = (customer_email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer_email))
      ? customer_email.trim()
      : `${phone}@datashop-receipts.com`;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Load admin-configurable price from settings; fallback to default
    const { data: priceRow } = await supabase.from("settings").select("value").eq("key", cfg.settingKey).maybeSingle();
    const parsedPrice = Number(priceRow?.value);
    const amount = Number.isFinite(parsedPrice) && parsedPrice > 0 ? parsedPrice : cfg.amount;

    const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
    const tail = Date.now().toString(36).slice(-4).toUpperCase();
    const reference = `${cfg.prefix}${tail}${rand}`;
    const amountKobo = Math.round(amount * 100);

    const psRes = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
      method: "POST",
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        amount: amountKobo,
        currency: "GHS",
        reference,
        callback_url: callback_url || undefined,
        metadata: { service, customer_phone: phone, label: cfg.label },
      }),
    });
    const psData = await psRes.json();
    if (!psRes.ok || !psData.status) {
      return json({ error: psData.message || "Payment init failed" }, 502);
    }

    const sKey = String(service).toLowerCase();
    const orderNotes = customer_name ? `[name:${String(customer_name).trim()}]` : null;

    const { error: sErr } = await supabase.from("service_orders").insert({
      service: sKey,
      service_type: sKey,
      customer_email: email,
      customer_phone: phone,
      amount,
      reference,
      status: "pending",
      delivery_status: "pending",
      notes: orderNotes,
    });
    if (sErr) return json({ error: sErr.message }, 500);

    // Also register in main orders table so external bots recognize it
    await supabase.from("orders").insert({
      reference,
      network: String(service).toUpperCase(),
      capacity: cfg.label,
      recipient_phone: phone,
      phone_number: phone,
      customer_email: email,
      amount,
      payment_status: "pending",
      delivery_status: "pending",
    }).catch?.(() => {});

    return json({
      authorization_url: psData.data.authorization_url,
      reference,
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unknown" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
