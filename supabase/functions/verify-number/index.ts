// Pre-checks a recipient number against the delivery network (non-charging).
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const normalize = (raw: string) => {
  const d = String(raw || "").replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("233")) return "0" + d.slice(3);
  if (d.length === 9) return "0" + d;
  return d;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const key = Deno.env.get("DATAMART_API_KEY");
    if (!key) throw new Error("DATAMART_API_KEY not configured");

    const body = await req.json().catch(() => ({}));
    const phoneNumber = normalize(body?.phoneNumber ?? body?.phone ?? "");
    if (!/^0\d{9}$/.test(phoneNumber)) {
      return new Response(JSON.stringify({ status: "error", code: "INVALID_NUMBER", message: "Enter a valid 10-digit Ghana number." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // The upstream check pastes into live vendor carts and can hang; cap the wait.
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 20000);
    let res: Response;
    try {
      res = await fetch("https://api.datamartgh.shop/api/developer/verify-number", {
        method: "POST",
        headers: { "X-API-Key": key, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ phoneNumber }),
        signal: ac.signal,
      });
    } catch (_e) {
      return new Response(JSON.stringify({
        status: "error",
        code: "VERIFY_UNAVAILABLE",
        message: "The network check is busy right now. You can skip verification and continue.",
      }), { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } finally {
      clearTimeout(timer);
    }
    const text = await res.text();
    return new Response(text, {
      status: res.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ status: "error", message: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
