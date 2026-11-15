// Start a Paystack payment for a WAEC/BECE result checker card.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, "Content-Type": "application/json" },
});

const PAYSTACK_BASE = "https://api.paystack.co";
const DEFAULT_PRICE = 20;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!PAYSTACK_SECRET_KEY) throw new Error("PAYSTACK_SECRET_KEY not configured");

    const { checker_type, customer_phone, customer_email, customer_name, callback_url } = await req.json();

    const type = String(checker_type || "").toUpperCase();
    if (type !== "WAEC" && type !== "BECE") return json({ error: "Invalid checker type" }, 400);

    const phone = String(customer_phone || "").replace(/\s+/g, "");
    if (!/^(0\d{9}|233\d{9})$/.test(phone)) return json({ error: "Invalid Ghana phone" }, 400);

    const name = customer_name ? String(customer_name).trim().slice(0, 120) : null;
    const email = (customer_email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer_email))
      ? String(customer_email).trim()
      : `${phone}@datashop-receipts.com`;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const settingKey = type === "WAEC" ? "waec_price" : "bece_price";
    const { data: priceRow } = await supabase.from("settings").select("value").eq("key", settingKey).maybeSingle();
    const parsed = Number(priceRow?.value);
    const amount = Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_PRICE;

    const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
    const tail = Date.now().toString(36).slice(-4).toUpperCase();
    const reference = `CK${tail}${rand}`;

    const psRes = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
      method: "POST",
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        amount: Math.round(amount * 100),
        currency: "GHS",
        reference,
        callback_url: callback_url || undefined,
        metadata: { checker_type: type, customer_phone: phone },
      }),
    });
    const psData = await psRes.json();
    if (!psRes.ok || !psData.status) return json({ error: psData.message || "Payment init failed" }, 502);

    const { error } = await supabase.from("checker_orders").insert({
      checker_type: type,
      customer_name: name,
      customer_phone: phone,
      customer_email: email,
      amount,
      reference,
      payment_status: "pending",
      delivery_status: "pending",
    });
    if (error) return json({ error: error.message }, 500);

    return json({ authorization_url: psData.data.authorization_url, reference });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unknown" }, 500);
  }
});
