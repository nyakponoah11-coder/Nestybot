// Public order lookup by reference or recipient phone.
// Returns minimal order fields so customers can track without auth.
// Also returns "Other services" (Netflix / AFA) history so customers can
// review past service purchases (including their one-time Netflix code).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PUBLIC_FIELDS =
  "id, reference, network, capacity, recipient_phone, amount, payment_status, delivery_status, error_message, created_at";

const SERVICE_FIELDS =
  "id, service, service_type, reference, customer_phone, customer_email, amount, status, delivery_status, notes, created_at";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { reference, phone } = await req.json();
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    if (reference && typeof reference === "string") {
      const ref = reference.trim();
      // Service references start with NF (Netflix) or AF (AFA)
      if (/^(NF|AF)/i.test(ref)) {
        const { data, error } = await supabase
          .from("service_orders").select(SERVICE_FIELDS).eq("reference", ref).maybeSingle();
        if (error) throw error;
        return new Response(JSON.stringify({ service_order: data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data, error } = await supabase
        .from("orders").select(PUBLIC_FIELDS).eq("reference", ref).maybeSingle();
      if (error) throw error;
      return new Response(JSON.stringify({ order: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (phone && typeof phone === "string") {
      const p = phone.replace(/\s+/g, "");
      const candidates = new Set<string>([p]);
      if (/^0\d{9}$/.test(p)) {
        candidates.add("233" + p.slice(1));
        candidates.add("+233" + p.slice(1));
      } else if (/^233\d{9}$/.test(p)) {
        candidates.add("0" + p.slice(3));
        candidates.add("+" + p);
      } else if (/^\+233\d{9}$/.test(p)) {
        candidates.add(p.slice(1));
        candidates.add("0" + p.slice(4));
      }
      const list = Array.from(candidates);
      const [ordersRes, servicesRes] = await Promise.all([
        supabase.from("orders").select(PUBLIC_FIELDS)
          .in("recipient_phone", list).order("created_at", { ascending: false }).limit(50),
        supabase.from("service_orders").select(SERVICE_FIELDS)
          .in("customer_phone", list).order("created_at", { ascending: false }).limit(50),
      ]);
      if (ordersRes.error) throw ordersRes.error;
      if (servicesRes.error) throw servicesRes.error;
      return new Response(JSON.stringify({
        orders: ordersRes.data || [],
        service_orders: servicesRes.data || [],
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Provide reference or phone" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
