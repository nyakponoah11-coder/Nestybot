// Verify the payment for a result checker order, then buy the card and store serial + PIN.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, "Content-Type": "application/json" },
});

const PAYSTACK_BASE = "https://api.paystack.co";
const CHECKERS_BASE = "https://api.datamartgh.shop/api/checkers";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!PAYSTACK_SECRET_KEY) throw new Error("PAYSTACK_SECRET_KEY not configured");
    const DATAMART_API_KEY = Deno.env.get("DATAMART_API_KEY");

    const { reference } = await req.json();
    if (!reference || typeof reference !== "string") return json({ error: "Missing reference" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: order } = await supabase.from("checker_orders")
      .select("*").eq("reference", reference).maybeSingle();
    if (!order) return json({ error: "Order not found" }, 404);
    if (order.delivery_status === "delivered") return json({ order });

    if (order.payment_status !== "paid") {
      const verRes = await fetch(`${PAYSTACK_BASE}/transaction/verify/${encodeURIComponent(reference)}`, {
        headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
      });
      const verData = await verRes.json();
      if (!verRes.ok || !verData.status) return json({ error: "Verify failed" }, 502);
      const status = verData.data?.status;
      if (status !== "success") {
        // NEVER revert a confirmed payment - once paid, always paid
        if (order.payment_status !== "paid") {
          await supabase.from("checker_orders").update({
            payment_status: status === "abandoned" ? "pending" : "failed",
          }).eq("reference", reference);
        }
        const { data: o2 } = await supabase.from("checker_orders").select("*").eq("reference", reference).maybeSingle();
        return json({ order: o2 });
      }
      await supabase.from("checker_orders").update({ payment_status: "paid", delivery_status: "processing" })
        .eq("reference", reference);
    }

    if (!DATAMART_API_KEY) {
      await supabase.from("checker_orders").update({
        delivery_status: "failed", error_message: "Checker API key not configured",
      }).eq("reference", reference);
      const { data: o3 } = await supabase.from("checker_orders").select("*").eq("reference", reference).maybeSingle();
      return json({ order: o3 });
    }

    // Buy the card
    let updates: Record<string, unknown>;
    try {
      const buyRes = await fetch(`${CHECKERS_BASE}/purchase`, {
        method: "POST",
        headers: { "X-API-Key": DATAMART_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({
          checkerType: order.checker_type,
          phoneNumber: order.customer_phone,
          ref: reference,
          skipSms: false,
        }),
      });
      const buyBody = await buyRes.json();
      if (!buyRes.ok || buyBody?.status !== "success") {
        updates = {
          delivery_status: "failed",
          error_message: buyBody?.message || `Purchase failed (${buyRes.status})`,
        };
      } else {
        const d = buyBody.data || {};
        updates = {
          delivery_status: "delivered",
          serial_number: d.serialNumber || null,
          pin: d.pin || null,
          datamart_reference: d.reference || null,
          error_message: null,
        };
      }
    } catch (e) {
      updates = { delivery_status: "failed", error_message: e instanceof Error ? e.message : "Purchase error" };
    }

    await supabase.from("checker_orders").update(updates).eq("reference", reference);

    if (updates.delivery_status === "delivered" && (updates.pin || updates.serial_number)) {
      try {
        const rawPhone = String(order.customer_phone || "").replace(/\D/g, "");
        const formatted = rawPhone.startsWith("233") && rawPhone.length === 12
          ? rawPhone
          : rawPhone.startsWith("0") && rawPhone.length === 10
          ? `233${rawPhone.slice(1)}`
          : rawPhone.length === 9
          ? `233${rawPhone}`
          : rawPhone;

        let arkeselKey = Deno.env.get("ARKESEL_API_KEY");
        let sender = (Deno.env.get("ARKESEL_SENDER_ID") || "Data1gh").slice(0, 11);
        if (!arkeselKey) {
          const { data: sRows } = await supabase.from("settings").select("key,value")
            .in("key", ["arkesel_api_key", "ARKESEL_API_KEY", "arkesel_key", "arkesel_sender_id", "ARKESEL_SENDER_ID"]);
          for (const row of sRows || []) {
            const k = (row?.key || "").toLowerCase();
            if (k.includes("key") && !arkeselKey && row?.value) arkeselKey = String(row.value).trim();
            if (k.includes("sender") && row?.value) sender = String(row.value).trim().slice(0, 11);
          }
        }

        // Automatic SMS blocked per owner instruction.
        const AUTO_SMS_ENABLED = false;
        if (AUTO_SMS_ENABLED && arkeselKey && formatted) {
          const serial = updates.serial_number || "N/A";
          const pin = updates.pin || "N/A";
          const type = order.checker_type || "Result Checker";
          const smsMsg = `Data1gh: Your ${type} Result Checker Details:\nSerial: ${serial}\nPIN: ${pin}\nRef: ${reference}\nCheck results at the official WAEC/BECE portal. Thank you for choosing Data1gh!`;
          await fetch("https://sms.arkesel.com/api/v2/sms/send", {
            method: "POST",
            headers: { "api-key": arkeselKey, "Content-Type": "application/json" },
            body: JSON.stringify({ sender: sender || "Data1gh", message: smsMsg, recipients: [formatted] }),
          }).catch(() => {});
        }
      } catch (_) {}
    }

    const { data: finalOrder } = await supabase.from("checker_orders").select("*").eq("reference", reference).maybeSingle();
    return json({ order: finalOrder });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unknown" }, 500);
  }
});
