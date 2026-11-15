// Admin-only data API for product, settings, and order management.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const NetworkSchema = z.enum(["MTN", "TELECEL", "AT"]);
const CapacitySchema = z.string().trim().min(1).max(20).refine((value) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0;
}, "Capacity must be a positive number");
const PriceSchema = z.coerce.number().positive().max(100000);
const SortSchema = z.coerce.number().int().min(0).max(100000);
const ProductIdSchema = z.string().uuid();
const SettingsKeySchema = z.string().min(1).max(80);

const BodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("listProducts") }),
  z.object({ action: z.literal("createProduct"), product: z.object({
    network: NetworkSchema,
    capacity: CapacitySchema,
    price: PriceSchema,
  }) }),
  z.object({ action: z.literal("updateProduct"), product: z.object({
    id: ProductIdSchema,
    price: PriceSchema,
    name: z.string().trim().max(80).nullable().optional(),
    in_stock: z.boolean(),
    sort_order: SortSchema,
  }) }),
  z.object({ action: z.literal("deleteProduct"), id: ProductIdSchema }),
  z.object({ action: z.literal("getSettings") }),
  z.object({ action: z.literal("saveSettings"), settings: z.array(z.object({
    key: SettingsKeySchema,
    value: z.string().max(500).nullable().optional(),
  })).max(30) }),
  z.object({ action: z.literal("listOrders") }),
]);

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);
    const token = authHeader.replace("Bearer ", "");

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await userClient.auth.getUser(token);
    if (!userData.user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: roleRow, error: roleError } = await admin.from("user_roles")
      .select("id").eq("user_id", userData.user.id).eq("role", "admin").maybeSingle();
    if (roleError) return json({ error: roleError.message }, 500);
    if (!roleRow) return json({ error: "Forbidden" }, 403);

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) return json({ error: "Invalid request", details: parsed.error.flatten() }, 400);

    switch (parsed.data.action) {
      case "listProducts": {
        const { data, error } = await admin.from("products").select("*").order("network").order("sort_order");
        if (error) return json({ error: error.message }, 500);
        return json({ products: data || [] });
      }
      case "createProduct": {
        const cap = parsed.data.product.capacity.trim();
        const mb = Math.round(Number(cap) * 1000);
        const row = { ...parsed.data.product, capacity: cap, mb, in_stock: true, sort_order: Number(cap) || 0 };
        const { error } = await admin.from("products").insert(row);
        if (error) {
          if ((error as any).code === "23505") {
            return json({ error: `A product for ${row.network} ${cap}GB already exists. Edit the existing one instead.` }, 409);
          }
          return json({ error: error.message }, 500);
        }
        return json({ ok: true });
      }
      case "updateProduct": {
        const { id, ...updates } = parsed.data.product;
        const { error } = await admin.from("products").update(updates).eq("id", id);
        if (error) return json({ error: error.message }, 500);
        return json({ ok: true });
      }
      case "deleteProduct": {
        const { error } = await admin.from("products").delete().eq("id", parsed.data.id);
        if (error) return json({ error: error.message }, 500);
        return json({ ok: true });
      }
      case "getSettings": {
        const { data, error } = await admin.from("settings").select("key,value");
        if (error) return json({ error: error.message }, 500);
        return json({ settings: data || [] });
      }
      case "saveSettings": {
        const rows = parsed.data.settings.map((setting) => ({ key: setting.key, value: setting.value ?? "" }));
        const { error } = await admin.from("settings").upsert(rows, { onConflict: "key" });
        if (error) return json({ error: error.message }, 500);
        return json({ ok: true });
      }
      case "listOrders": {
        const { data, error } = await admin.from("orders").select("*").order("created_at", { ascending: false }).limit(500);
        if (error) return json({ error: error.message }, 500);
        const [allOrders, services, checkers, referrals, redemptions, conversations, spinWins, spinRedemptions] = await Promise.all([
          admin.from("orders").select("recipient_phone").limit(20000),
          admin.from("service_orders").select("customer_phone"),
          admin.from("checker_orders").select("customer_phone"),
          admin.from("referrals").select("owner_phone"),
          admin.from("referral_redemptions").select("friend_phone"),
          admin.from("chat_conversations").select("visitor_phone"),
          admin.from("spin_wins").select("owner_phone"),
          admin.from("spin_redemptions").select("buyer_phone"),
        ]);
        const phoneNumbers = [
          ...(allOrders.data || []).map((o: any) => o.recipient_phone),
          ...(services.data || []).map((o: any) => o.customer_phone),
          ...(checkers.data || []).map((o: any) => o.customer_phone),
          ...(referrals.data || []).map((o: any) => o.owner_phone),
          ...(redemptions.data || []).map((o: any) => o.friend_phone),
          ...(conversations.data || []).map((o: any) => o.visitor_phone),
          ...(spinWins.data || []).map((o: any) => o.owner_phone),
          ...(spinRedemptions.data || []).map((o: any) => o.buyer_phone),
        ].filter((phone): phone is string => typeof phone === "string" && phone.trim().length > 0);
        return json({ orders: data || [], phone_numbers: [...new Set(phoneNumbers)] });
      }
    }
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unknown" }, 500);
  }
});