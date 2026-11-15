import { invokeApiFunction, supabase } from "@/integrations/supabase/client";
import { DEFAULT_PRODUCTS, type ProductItem } from "@/lib/networks";

export interface ShopDataCache {
  products: ProductItem[];
  settings: Record<string, string>;
  timestamp: number;
}

const LOCAL_STORAGE_KEY = "data1gh_shop_catalog_cache_v3";
const SESSION_STORAGE_KEY = "data1gh_session_catalog_v3";
const CACHE_TTL_MS = 60 * 1000; // 1 minute client-side device cache for fast updates

// Fast in-memory cache to avoid repeated JSON.parse across component mounts
let memoryCache: ShopDataCache | null = null;

// Allow listening to external cache invalidations (e.g. from admin updates)
if (typeof window !== "undefined") {
  window.addEventListener("shop-cache-invalidated", () => {
    memoryCache = null;
    try {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    } catch {}
  });
}

/**
 * Reads shop catalog and public settings from in-memory or device localStorage.
 * Returns null if cache does not exist or has expired.
 */
export function getCachedShopData(): { products: ProductItem[]; settings: Record<string, string> } | null {
  const now = Date.now();

  // 1. Check in-memory cache
  if (memoryCache && now - memoryCache.timestamp < CACHE_TTL_MS) {
    if (memoryCache.products?.length) {
      return { products: memoryCache.products, settings: memoryCache.settings };
    }
  }

  // 2. Check sessionStorage (active tab session)
  try {
    const rawSession = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (rawSession) {
      const parsed = JSON.parse(rawSession) as ShopDataCache;
      if (parsed && parsed.timestamp && now - parsed.timestamp < CACHE_TTL_MS) {
        if (Array.isArray(parsed.products) && parsed.products.length > 0) {
          memoryCache = parsed;
          return { products: parsed.products, settings: parsed.settings || {} };
        }
      }
    }
  } catch {}

  // 3. Check persistent localStorage on this device
  try {
    const rawLocal = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (rawLocal) {
      const parsed = JSON.parse(rawLocal) as ShopDataCache;
      if (parsed && parsed.timestamp && now - parsed.timestamp < CACHE_TTL_MS) {
        if (Array.isArray(parsed.products) && parsed.products.length > 0) {
          memoryCache = parsed;
          return { products: parsed.products, settings: parsed.settings || {} };
        }
      }
    }
  } catch {}

  return null;
}

/**
 * Persists shop catalog and public settings to device localStorage and active session.
 */
export function setCachedShopData(data: { products: ProductItem[]; settings: Record<string, string> }) {
  const entry: ShopDataCache = {
    products: data.products,
    settings: data.settings,
    timestamp: Date.now(),
  };

  memoryCache = entry;

  try {
    const serialized = JSON.stringify(entry);
    sessionStorage.setItem(SESSION_STORAGE_KEY, serialized);
    localStorage.setItem(LOCAL_STORAGE_KEY, serialized);
  } catch (e) {
    console.warn("Storage quota exceeded or storage disabled:", e);
  }
}

/**
 * Clears the cached catalog so the next read fetches fresh data from the server.
 */
export function invalidateShopCache() {
  memoryCache = null;
  try {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    window.dispatchEvent(new CustomEvent("shop-cache-invalidated"));
  } catch {}
}

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

/**
 * Loads shop data with zero-egress device caching.
 * If cached on this device, it returns IMMEDIATELY without calling the database.
 * Database is only contacted when cache is empty, expired, or when forceRefresh=true.
 */
export async function fetchShopDataCached(options?: {
  forceRefresh?: boolean;
}): Promise<{ products: ProductItem[]; settings: Record<string, string> }> {
  if (options?.forceRefresh) {
    memoryCache = null;
    try {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    } catch {}
  }

  // If not forcing a refresh, return cached data from device session immediately
  if (!options?.forceRefresh) {
    const cached = getCachedShopData();
    if (cached && cached.products.length > 0) {
      return cached;
    }
  }

  let prods: ProductItem[] = [];
  let settingsMap: Record<string, string> = {};

  // 1. Try serverless shop-data endpoint (which applies lightweight public projection)
  try {
    const { data, error } = await invokeApiFunction("shop-data", {
      body: options?.forceRefresh ? { refresh: true } : undefined,
    });
    if (!error && data?.products && Array.isArray(data.products) && data.products.length > 0) {
      prods = data.products as ProductItem[];
      if (data.settings && typeof data.settings === "object" && !Array.isArray(data.settings)) {
        settingsMap = data.settings;
      } else if (Array.isArray(data.settings)) {
        settingsMap = Object.fromEntries(data.settings.map((s: any) => [s.key, s.value]));
      }
    }
  } catch {}

  // 2. Fallback to default bundled products (zero egress)
  if (!prods.length) {
    prods = DEFAULT_PRODUCTS as ProductItem[];
  }

  // Save to device storage session
  setCachedShopData({ products: prods, settings: settingsMap });

  return { products: prods, settings: settingsMap };
}

/**
 * Determines whether a visitor tracking ping should be sent.
 * Enforces strict per-session deduplication in sessionStorage to avoid egress on every page click.
 */
export function shouldTrackVisitThisSession(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const SESSION_TRACKED_KEY = "data1gh_visit_session_tracked";
    const alreadyTracked = sessionStorage.getItem(SESSION_TRACKED_KEY);
    if (alreadyTracked) {
      return false;
    }
    sessionStorage.setItem(SESSION_TRACKED_KEY, String(Date.now()));
    return true;
  } catch {
    return false;
  }
}
