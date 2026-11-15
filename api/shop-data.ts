import { createClient } from "@supabase/supabase-js";
import { getSupabase } from "./_supabase.js";

let cachedData: { products: any[]; settings: any[] } | null = null;
let cachedAt = 0;
const MEMORY_TTL = 60 * 1000; // 1 minute in-memory cache

const PUBLIC_SETTING_KEYS = [
  "shop_name",
  "store_name",
  "whatsapp_bot_url",
  "whatsapp_channel_url",
  "support_chat_url",
  "announcement_enabled",
  "announcement_title",
  "announcement_message",
  "promo_enabled",
  "spin_game_enabled",
  "free_data_enabled",
  "apk_download_url",
  "netflix_price",
  "afa_price",
  "mashup_price",
  "support_phone",
  "admin_alert_phone",
  "flash_sale_enabled",
  "flash_sale_end_time",
  "flash_sale_title",
  "flash_sale_notice",
  "flash_sale_products",
];

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "authorization, x-client-info, apikey, content-type"
  );
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Edge CDN Cache Header:
  // Browser caches 60s, Vercel Edge CDN caches for 5 minutes, stale-while-revalidate 10 minutes.
  // 10,000 visitors hitting this will hit Vercel Edge with 0 queries to Supabase!
  res.setHeader("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=600");

  const now = Date.now();
  if (cachedData && now - cachedAt < MEMORY_TTL && !req.body?.refresh) {
    return res.status(200).json(cachedData);
  }

  try {
    const supabase = getSupabase();

    const [productsRes, settingsRes] = await Promise.all([
      supabase
        .from("products")
        .select("id, network, capacity, mb, price, name, in_stock, sort_order")
        .eq("in_stock", true)
        .order("network")
        .order("sort_order"),
      supabase
        .from("settings")
        .select("key, value")
        .in("key", PUBLIC_SETTING_KEYS),
    ]);

    const payload = {
      products: productsRes.data || [],
      settings: settingsRes.data || [],
    };

    if (payload.products.length > 0) {
      cachedData = payload;
      cachedAt = now;
    }

    return res.status(200).json(payload);
  } catch (err: any) {
    if (cachedData) {
      return res.status(200).json(cachedData);
    }
    return res.status(500).json({ error: err?.message || "Failed to load shop catalog" });
  }
}
