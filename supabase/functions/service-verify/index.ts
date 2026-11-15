// Verifies a Paystack transaction for a service order (netflix / afa).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PAYSTACK_BASE = "https://api.paystack.co";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!PAYSTACK_SECRET_KEY) throw new Error("PAYSTACK_SECRET_KEY not configured");

    const { reference } = await req.json();
    if (!reference || typeof reference !== "string") return json({ error: "Missing reference" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: order } = await supabase
      .from("service_orders").select("*").eq("reference", reference).maybeSingle();
    if (!order) return json({ error: "Order not found" }, 404);

    if (order.payment_status === "paid") return json({ order });

    const verRes = await fetch(`${PAYSTACK_BASE}/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
    });
    const verData = await verRes.json();
    if (!verRes.ok || !verData.status) return json({ error: "Verify failed" }, 502);

    const status = verData.data?.status;
    if (status !== "success") {
      // NEVER revert a confirmed payment - once paid, always paid
      if (order.payment_status !== "paid") {
        await supabase.from("service_orders").update({
          payment_status: status === "abandoned" ? "pending" : "failed",
        }).eq("reference", reference);
      }
      const { data: o2 } = await supabase.from("service_orders").select("*").eq("reference", reference).maybeSingle();
      return json({ order: o2 });
    }

    const updates: Record<string, unknown> = {
      payment_status: "paid",
      delivery_status: order.service === "netflix" ? "active" : "awaiting_whatsapp",
    };
    if (order.service === "netflix") {
      updates.netflix_login_expires_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    }
    await supabase.from("service_orders").update(updates).eq("reference", reference);

    // Also update main orders table mirror
    await supabase.from("orders").update({
      payment_status: "paid",
      delivery_status: order.service === "netflix" ? "delivered" : "active",
    }).eq("reference", reference).catch?.(() => {});

    const { data: finalOrder } = await supabase.from("service_orders").select("*").eq("reference", reference).maybeSingle();
    return json({ order: finalOrder });
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
