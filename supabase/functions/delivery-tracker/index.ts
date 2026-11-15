// Proxies Datamart's /delivery-tracker endpoint so we can call it from the browser
// without exposing the API key or hitting CORS. Also merges the public
// delivery-status feed which carries the FAST LANE (unibundle) frontier,
// so the widget can show fast-lane delivery times.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const key = Deno.env.get("DATAMART_API_KEY");
    if (!key) throw new Error("DATAMART_API_KEY not configured");

    const [trackerRes, statusRes] = await Promise.all([
      fetch("https://api.datamartgh.shop/api/developer/delivery-tracker", {
        headers: { "X-API-Key": key, Accept: "application/json" },
      }),
      fetch("https://api.datamartgh.shop/api/v1/data/delivery-status", {
        headers: { Accept: "application/json" },
      }).catch(() => null),
    ]);

    let trackerText = "";
    try {
      trackerText = await trackerRes.text();
    } catch {
      trackerText = "";
    }
    let payload: any;
    try {
      payload = trackerText ? JSON.parse(trackerText) : { status: "error", message: "Empty tracker response" };
    } catch {
      payload = { status: "error", message: trackerText.slice(0, 500) };
    }

    // Merge fast lane info from the public delivery-status endpoint.
    if (statusRes && statusRes.ok) {
      try {
        const statusJson = await statusRes.json();
        const s = statusJson?.data;
        if (s?.unibundleActive && s?.unibundleFrontier?.placedAt && s?.unibundleFrontier?.deliveredAt) {
          const placed = new Date(s.unibundleFrontier.placedAt).getTime();
          const delivered = new Date(s.unibundleFrontier.deliveredAt).getTime();
          if (payload?.data) {
            payload.data.fastLane = {
              active: true,
              trackingId: s.unibundleFrontier.trackingId,
              placedAt: s.unibundleFrontier.placedAt,
              deliveredAt: s.unibundleFrontier.deliveredAt,
              minutes: Math.max(1, Math.round((delivered - placed) / 60000)),
            };
          }
        } else if (payload?.data) {
          payload.data.fastLane = { active: false };
        }
      } catch {
        // ignore fast-lane merge failures
      }
    }

    return new Response(JSON.stringify(payload), {
      status: trackerRes.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ status: "error", message: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
