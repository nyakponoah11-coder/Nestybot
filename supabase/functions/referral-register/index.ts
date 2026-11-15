// Register (or fetch) a referral code for a visitor's phone number.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function genCode(len = 6) {
  let s = "";
  for (let i = 0; i < len; i++) s += ALPHA[Math.floor(Math.random() * ALPHA.length)];
  return s;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { phone } = await req.json();
    const p = String(phone || "").replace(/\s+/g, "");
    if (!/^(0\d{9}|233\d{9})$/.test(p)) {
      return new Response(JSON.stringify({ error: "Invalid Ghana phone number" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Return existing referral if this phone already has one
    const { data: existing } = await supabase
      .from("referrals").select("*").eq("owner_phone", p).maybeSingle();
    if (existing) {
      return new Response(JSON.stringify({ referral: existing }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create new with unique code (retry a few times on collision)
    for (let attempt = 0; attempt < 6; attempt++) {
      const code = genCode(6);
      const { data, error } = await supabase
        .from("referrals")
        .insert({ owner_phone: p, code })
        .select("*").maybeSingle();
      if (!error && data) {
        return new Response(JSON.stringify({ referral: data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }
    throw new Error("Could not generate referral code");
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
