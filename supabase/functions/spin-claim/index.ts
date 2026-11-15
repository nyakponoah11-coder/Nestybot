// Claim a spin-the-wheel prize: creates a unique code tied to the winner's phone.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ALLOWED_PRIZES = ["1", "2"];

function genCode(len = 6) {
  let s = "SP";
  for (let i = 0; i < len; i++) s += ALPHA[Math.floor(Math.random() * ALPHA.length)];
  return s;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { phone, prize } = await req.json();
    const p = String(phone || "").replace(/\s+/g, "");
    const prizeCapacity = String(prize || "");
    if (!/^(0\d{9}|233\d{9})$/.test(p)) {
      return new Response(JSON.stringify({ error: "Invalid Ghana phone number" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!ALLOWED_PRIZES.includes(prizeCapacity)) {
      return new Response(JSON.stringify({ error: "Invalid prize" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // One active (undelivered) spin code per phone number
    const { data: existing } = await supabase
      .from("spin_wins").select("*")
      .eq("owner_phone", p).eq("reward_sent", false)
      .order("created_at", { ascending: false })
      .maybeSingle();
    if (existing) {
      return new Response(JSON.stringify({ spin: existing, existing: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    for (let attempt = 0; attempt < 6; attempt++) {
      const code = genCode(6);
      const { data, error } = await supabase.from("spin_wins")
        .insert({ code, owner_phone: p, prize_capacity: prizeCapacity })
        .select("*").maybeSingle();
      if (!error && data) {
        return new Response(JSON.stringify({ spin: data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }
    throw new Error("Could not generate a code");
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
