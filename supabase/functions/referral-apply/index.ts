// Apply a referral code after a friend's successful first-time purchase.
// Rules:
//   - The order must exist, be paid, and belong to the friend's phone.
//   - The friend's phone must be NEW: only this one paid order in the system.
//   - The friend can only redeem ONCE across the whole program.
//   - When a referrer reaches 5 unique redemptions, auto-send MTN 5GB to their phone.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DATAMART_BASE = "https://api.datamartgh.shop/api/developer";
const REWARD_THRESHOLD = 5;
const REWARD_CAPACITY = "5"; // 5GB
const REWARD_NETWORK = "YELLO"; // MTN on Datamart

const SPIN_THRESHOLD = 5; // 5 orders must use the spin code before delivery

// Apply a spin-game winning code to a paid order.
async function applySpin(supabase: any, spin: any, ref: string) {
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  const { data: order } = await supabase
    .from("orders").select("*").eq("reference", ref).maybeSingle();
  if (!order) return json({ error: "Order not found" }, 404);
  if (order.payment_status !== "paid") return json({ error: "Order has not been paid yet" }, 400);
  if (spin.reward_sent) return json({ error: "This code has already been rewarded" }, 400);

  const { data: already } = await supabase
    .from("spin_redemptions").select("id").eq("order_reference", ref).maybeSingle();
  if (already) return json({ error: "This order already used a code" }, 400);

  const { error: insErr } = await supabase.from("spin_redemptions").insert({
    spin_id: spin.id,
    order_reference: ref,
    buyer_phone: String(order.recipient_phone),
  });
  if (insErr) return json({ error: insErr.message }, 400);

  const newCount = (spin.orders_count ?? 0) + 1;
  await supabase.from("spin_wins").update({ orders_count: newCount }).eq("id", spin.id);

  let rewardSent = false;
  let rewardError: string | null = null;
  if (newCount >= SPIN_THRESHOLD) {
    const DATAMART_API_KEY = Deno.env.get("DATAMART_API_KEY");
    if (!DATAMART_API_KEY) {
      rewardError = "Reward pending — please contact support";
    } else {
      const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
      const tail = Date.now().toString(36).slice(-4).toUpperCase();
      const rewardRef = `SW${tail}${rand}`;
      try {
        const dmRes = await fetch(`${DATAMART_BASE}/purchase`, {
          method: "POST",
          headers: { "X-API-Key": DATAMART_API_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({
            phoneNumber: spin.owner_phone,
            network: REWARD_NETWORK,
            capacity: spin.prize_capacity,
            gateway: "wallet",
            ref: rewardRef,
          }),
        });
        const dmData = await dmRes.json();
        if (dmRes.ok && dmData.status === "success") {
          await supabase.from("spin_wins").update({
            reward_sent: true,
            reward_reference: rewardRef,
            reward_sent_at: new Date().toISOString(),
          }).eq("id", spin.id);
          rewardSent = true;
        } else {
          rewardError = dmData.message || "Reward delivery failed — support will assist";
        }
      } catch (e) {
        rewardError = e instanceof Error ? e.message : "Reward delivery error";
      }
    }
  }

  return json({
    ok: true,
    kind: "spin",
    prize: `${spin.prize_capacity}GB`,
    orders_count: newCount,
    threshold: SPIN_THRESHOLD,
    remaining: Math.max(0, SPIN_THRESHOLD - newCount),
    reward_sent: rewardSent,
    reward_error: rewardError,
  });
}


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { code, order_reference } = await req.json();
    const cleanCode = String(code || "").trim().toUpperCase();
    const ref = String(order_reference || "").trim();
    if (!cleanCode || !ref) {
      return new Response(JSON.stringify({ error: "Missing code or order reference" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Find referral — if not found, try a spin-game code (SPxxxxxx)
    const { data: referral } = await supabase
      .from("referrals").select("*").eq("code", cleanCode).maybeSingle();
    if (!referral) {
      const { data: spin } = await supabase
        .from("spin_wins").select("*").eq("code", cleanCode).maybeSingle();
      if (spin) return await applySpin(supabase, spin, ref);
      return new Response(JSON.stringify({ error: "Invalid code" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }


    // 2. Find friend's order
    const { data: order } = await supabase
      .from("orders").select("*").eq("reference", ref).maybeSingle();
    if (!order) {
      return new Response(JSON.stringify({ error: "Order not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (order.payment_status !== "paid") {
      return new Response(JSON.stringify({ error: "Order has not been paid yet" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const friendPhone = String(order.recipient_phone);

    // Owner cannot redeem their own code
    if (friendPhone === referral.owner_phone) {
      return new Response(JSON.stringify({ error: "You cannot use your own referral code" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Friend must be FIRST-TIME: only 1 paid order on this number
    const { count: paidCount } = await supabase
      .from("orders")
      .select("reference", { count: "exact", head: true })
      .eq("recipient_phone", friendPhone)
      .eq("payment_status", "paid");
    if ((paidCount ?? 0) > 1) {
      return new Response(JSON.stringify({
        error: "Referral codes are only valid on a friend's first purchase",
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 4. Friend hasn't redeemed anywhere yet (friend_phone is UNIQUE in table)
    const { data: existingRedemption } = await supabase
      .from("referral_redemptions")
      .select("id").eq("friend_phone", friendPhone).maybeSingle();
    if (existingRedemption) {
      return new Response(JSON.stringify({ error: "This number has already used a referral code" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 5. Insert redemption
    const { error: insErr } = await supabase.from("referral_redemptions").insert({
      referral_id: referral.id,
      friend_phone: friendPhone,
      order_reference: ref,
    });
    if (insErr) {
      return new Response(JSON.stringify({ error: insErr.message }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 6. Increment count
    const newCount = (referral.redemptions_count ?? 0) + 1;
    await supabase.from("referrals")
      .update({ redemptions_count: newCount })
      .eq("id", referral.id);

    // 7. Send reward if threshold hit (and not already sent)
    let rewardSent = false;
    let rewardError: string | null = null;
    if (newCount >= REWARD_THRESHOLD && !referral.reward_sent) {
      const DATAMART_API_KEY = Deno.env.get("DATAMART_API_KEY");
      if (!DATAMART_API_KEY) {
        rewardError = "Reward pending — please contact support";
      } else {
        const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
        const tail = Date.now().toString(36).slice(-4).toUpperCase();
        const rewardRef = `RW${tail}${rand}`;
        try {
          const dmRes = await fetch(`${DATAMART_BASE}/purchase`, {
            method: "POST",
            headers: { "X-API-Key": DATAMART_API_KEY, "Content-Type": "application/json" },
            body: JSON.stringify({
              phoneNumber: referral.owner_phone,
              network: REWARD_NETWORK,
              capacity: REWARD_CAPACITY,
              gateway: "wallet",
              ref: rewardRef,
            }),
          });
          const dmData = await dmRes.json();
          if (dmRes.ok && dmData.status === "success") {
            await supabase.from("referrals").update({
              reward_sent: true,
              reward_reference: rewardRef,
              reward_sent_at: new Date().toISOString(),
            }).eq("id", referral.id);
            rewardSent = true;
          } else {
            rewardError = dmData.message || "Reward delivery failed — support will assist";
          }
        } catch (e) {
          rewardError = e instanceof Error ? e.message : "Reward delivery error";
        }
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      redemptions_count: newCount,
      threshold: REWARD_THRESHOLD,
      remaining: Math.max(0, REWARD_THRESHOLD - newCount),
      reward_sent: rewardSent,
      reward_error: rewardError,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
