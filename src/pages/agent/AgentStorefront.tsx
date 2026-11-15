import React, { useState, useEffect, useMemo } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import { invokeApiFunction } from "@/integrations/supabase/client";
import { getCacheMeta, setCache, invalidateCache } from "@/lib/localCache";
import { fetchShopDataCached } from "@/lib/storeCache";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckoutDialog } from "@/components/CheckoutDialog";
import { ServiceCheckoutDialog } from "@/components/ServiceCheckoutDialog";
import { CheckerCheckoutDialog } from "@/components/ResultCheckerSection";
import { DeliveryTracker } from "@/components/DeliveryTracker";
import ArcadeSection from "@/components/ArcadeSection";
import { StoreGuideNote } from "@/components/StoreGuideNote";
import { AgentReferralWidget } from "@/components/AgentReferralWidget";
import { AgentStoreAnnouncementModal } from "@/components/AgentStoreAnnouncementModal";
import { NetworkLogo } from "@/components/NetworkLogo";
import { saveOrderToHistory } from "@/lib/orderHistory";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Store,
  MessageCircle,
  Zap,
  Flame,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  Clock,
  AlertCircle,
  Loader2,
  Sparkles,
  ExternalLink,
  Phone,
  Search,
  Radio,
  Truck,
  ArrowRight,
  Copy,
  Check,
  Package,
  Play,
  IdCard,
  GraduationCap,
  ScrollText,
  RefreshCw,
  Megaphone,
  X,
  Bell,
  Users,
  Headphones,
  MessageSquare,
  Rocket,
} from "lucide-react";
import { formatGHS, NETWORK_LABEL, networkClass, type ProductItem } from "@/lib/networks";
import { formatWhatsAppBotUrl } from "@/lib/whatsapp";
import { toast } from "sonner";
import { SocialBoostDialog } from "@/components/SocialBoostDialog";
import { SocialPlatformIcon } from "@/components/SocialPlatformIcon";

export interface StorefrontThemeConfig {
  containerBg: string;
  heroGlowStyle: React.CSSProperties;
  headerBg: string;
  headerBorder: string;
  logoBorder: string;
  logoGlow: string;
  badgeContainer: string;
  badgeText: string;
  badgeBorder: string;
  badgeDot: string;
  trackBtn: string;
  networkTabsContainer: string;
  networkTabActive: {
    MTN: string;
    TELECEL: string;
    AT: string;
  };
  trackerBox: string;
  trackerBorder: string;
  trackerPulse: string;
  trackerLink: string;
  productCard: string;
  priceText: string;
  buyButton: string;
  floatingWaBtn: string;
  floatingWaPulse: string;
  footerIcon: string;
}

export const THEME_CONFIGS: Record<string, StorefrontThemeConfig> = {
  cyber: {
    containerBg: "bg-[#070b12] text-white selection:bg-cyan-500 selection:text-black",
    heroGlowStyle: {
      backgroundImage: "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(6,182,212,0.18), transparent)",
    },
    headerBg: "bg-[#070b12]/85 backdrop-blur-xl",
    headerBorder: "border-cyan-500/20",
    logoBorder: "border-cyan-500/40",
    logoGlow: "shadow-[0_0_20px_rgba(6,182,212,0.35)]",
    badgeContainer: "bg-cyan-500/15 border-cyan-500/30 text-cyan-300",
    badgeText: "text-cyan-300",
    badgeBorder: "border-cyan-500/30",
    badgeDot: "bg-emerald-400",
    trackBtn: "border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300",
    networkTabsContainer: "bg-white/[0.05] border-white/10",
    networkTabActive: {
      MTN: "bg-[#FFCC00] text-black shadow-lg shadow-yellow-500/20",
      TELECEL: "bg-[#E60000] text-white shadow-lg shadow-red-500/20",
      AT: "bg-[#002B7F] text-white shadow-lg shadow-blue-500/20",
    },
    trackerBox: "bg-zinc-900/40 border-cyan-500/20",
    trackerBorder: "border-cyan-500/20",
    trackerPulse: "text-emerald-400",
    trackerLink: "text-cyan-400 hover:text-cyan-300",
    productCard: "border-white/10 bg-zinc-900/60 hover:border-cyan-500/50 hover:bg-zinc-900/90 shadow-lg shadow-cyan-950/20",
    priceText: "text-cyan-300",
    buyButton: "bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400 text-black hover:opacity-95 shadow-md shadow-cyan-500/25",
    floatingWaBtn: "bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white shadow-[0_10px_25px_rgba(6,182,212,0.35)] border-cyan-400/40",
    floatingWaPulse: "bg-cyan-300",
    footerIcon: "text-cyan-400",
  },
  gold: {
    containerBg: "bg-[#080705] text-white selection:bg-amber-400 selection:text-black",
    heroGlowStyle: {
      backgroundImage: "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(245,158,11,0.22), transparent)",
    },
    headerBg: "bg-[#080705]/90 backdrop-blur-xl",
    headerBorder: "border-amber-500/25",
    logoBorder: "border-amber-500/40",
    logoGlow: "shadow-[0_0_20px_rgba(245,158,11,0.35)]",
    badgeContainer: "bg-amber-500/15 border-amber-500/40 text-amber-300",
    badgeText: "text-amber-300",
    badgeBorder: "border-amber-500/40",
    badgeDot: "bg-amber-400",
    trackBtn: "border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300",
    networkTabsContainer: "bg-[#140f09] border-amber-500/20",
    networkTabActive: {
      MTN: "bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-black shadow-lg shadow-amber-500/30 font-black",
      TELECEL: "bg-[#DC2626] text-white shadow-lg shadow-red-500/25",
      AT: "bg-[#1E3A8A] text-white shadow-lg shadow-blue-500/25",
    },
    trackerBox: "bg-[#120F0A]/70 border-amber-500/25",
    trackerBorder: "border-amber-500/25",
    trackerPulse: "text-amber-400",
    trackerLink: "text-amber-400 hover:text-amber-300",
    productCard: "border-amber-500/20 bg-[#120F0A]/80 hover:border-amber-400/60 hover:bg-[#1a140d] shadow-lg shadow-amber-950/20",
    priceText: "text-amber-400",
    buyButton: "bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-black font-black hover:opacity-95 shadow-md shadow-amber-500/30",
    floatingWaBtn: "bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 text-black shadow-[0_10px_25px_rgba(245,158,11,0.4)] border-amber-300/80 font-bold",
    floatingWaPulse: "bg-amber-200",
    footerIcon: "text-amber-400",
  },
  frost: {
    containerBg: "bg-[#090b16] text-white selection:bg-violet-500 selection:text-white",
    heroGlowStyle: {
      backgroundImage: "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(139,92,246,0.24), transparent)",
    },
    headerBg: "bg-[#090b16]/85 backdrop-blur-2xl",
    headerBorder: "border-violet-500/25",
    logoBorder: "border-violet-500/40",
    logoGlow: "shadow-[0_0_20px_rgba(168,85,247,0.35)]",
    badgeContainer: "bg-violet-500/15 border-violet-500/40 text-violet-300",
    badgeText: "text-violet-300",
    badgeBorder: "border-violet-500/40",
    badgeDot: "bg-violet-400",
    trackBtn: "border-violet-500/30 bg-violet-500/15 hover:bg-violet-500/25 text-violet-300",
    networkTabsContainer: "bg-[#11162d]/80 border-violet-500/20",
    networkTabActive: {
      MTN: "bg-[#FFCC00] text-black shadow-lg shadow-yellow-500/20",
      TELECEL: "bg-[#E60000] text-white shadow-lg shadow-red-500/20",
      AT: "bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/30 font-black",
    },
    trackerBox: "bg-[#0e1329]/70 border-violet-500/25",
    trackerBorder: "border-violet-500/25",
    trackerPulse: "text-violet-400",
    trackerLink: "text-violet-400 hover:text-violet-300",
    productCard: "border-slate-800 bg-[#0f142b]/80 hover:border-violet-400/60 hover:bg-[#151c3c] shadow-lg shadow-violet-950/25",
    priceText: "text-violet-300",
    buyButton: "bg-gradient-to-r from-violet-500 via-purple-500 to-indigo-500 text-white hover:opacity-95 shadow-md shadow-violet-500/30 font-black",
    floatingWaBtn: "bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 text-white shadow-[0_10px_25px_rgba(147,51,234,0.4)] border-violet-400/50",
    floatingWaPulse: "bg-violet-200",
    footerIcon: "text-violet-400",
  },
  sunset: {
    containerBg: "bg-[#0d070b] text-white selection:bg-rose-500 selection:text-white",
    heroGlowStyle: {
      backgroundImage: "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(244,63,94,0.22), transparent)",
    },
    headerBg: "bg-[#0d070b]/90 backdrop-blur-xl",
    headerBorder: "border-rose-500/25",
    logoBorder: "border-rose-500/40",
    logoGlow: "shadow-[0_0_20px_rgba(244,63,94,0.35)]",
    badgeContainer: "bg-rose-500/15 border-rose-500/40 text-rose-300",
    badgeText: "text-rose-300",
    badgeBorder: "border-rose-500/40",
    badgeDot: "bg-rose-400",
    trackBtn: "border-rose-500/30 bg-rose-500/15 hover:bg-rose-500/25 text-rose-300",
    networkTabsContainer: "bg-[#180a13] border-rose-500/20",
    networkTabActive: {
      MTN: "bg-[#FFCC00] text-black shadow-lg shadow-yellow-500/20",
      TELECEL: "bg-gradient-to-r from-rose-500 to-red-600 text-white shadow-lg shadow-rose-500/30 font-black",
      AT: "bg-[#002B7F] text-white shadow-lg shadow-blue-500/20",
    },
    trackerBox: "bg-[#160b13]/70 border-rose-500/25",
    trackerBorder: "border-rose-500/25",
    trackerPulse: "text-rose-400",
    trackerLink: "text-rose-400 hover:text-rose-300",
    productCard: "border-rose-950/60 bg-[#160b13]/80 hover:border-rose-400/60 hover:bg-[#20101b] shadow-lg shadow-rose-950/25",
    priceText: "text-rose-400",
    buyButton: "bg-gradient-to-r from-rose-500 via-pink-500 to-amber-400 text-black font-black hover:opacity-95 shadow-md shadow-rose-500/30",
    floatingWaBtn: "bg-gradient-to-r from-rose-600 via-pink-600 to-rose-500 text-white shadow-[0_10px_25px_rgba(244,63,94,0.4)] border-rose-400/50",
    floatingWaPulse: "bg-rose-200",
    footerIcon: "text-rose-400",
  },
  emerald: {
    containerBg: "bg-[#050d08] text-white selection:bg-emerald-400 selection:text-black",
    heroGlowStyle: {
      backgroundImage: "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(16,185,129,0.22), transparent)",
    },
    headerBg: "bg-[#050d08]/90 backdrop-blur-xl",
    headerBorder: "border-emerald-500/25",
    logoBorder: "border-emerald-500/40",
    logoGlow: "shadow-[0_0_20px_rgba(16,185,129,0.35)]",
    badgeContainer: "bg-emerald-500/15 border-emerald-500/40 text-emerald-300",
    badgeText: "text-emerald-300",
    badgeBorder: "border-emerald-500/40",
    badgeDot: "bg-emerald-400",
    trackBtn: "border-emerald-500/30 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300",
    networkTabsContainer: "bg-[#09170e] border-emerald-500/20",
    networkTabActive: {
      MTN: "bg-[#FFCC00] text-black shadow-lg shadow-yellow-500/20",
      TELECEL: "bg-[#E60000] text-white shadow-lg shadow-red-500/20",
      AT: "bg-[#002B7F] text-white shadow-lg shadow-blue-500/20",
    },
    trackerBox: "bg-[#08170e]/70 border-emerald-500/25",
    trackerBorder: "border-emerald-500/25",
    trackerPulse: "text-emerald-400",
    trackerLink: "text-emerald-400 hover:text-emerald-300",
    productCard: "border-emerald-950/60 bg-[#08170e]/80 hover:border-emerald-400/60 hover:bg-[#0d2215] shadow-lg shadow-emerald-950/30",
    priceText: "text-emerald-400",
    buyButton: "bg-gradient-to-r from-emerald-400 via-teal-400 to-emerald-300 text-black font-black hover:opacity-95 shadow-md shadow-emerald-500/30",
    floatingWaBtn: "bg-gradient-to-r from-emerald-600 via-green-600 to-teal-600 text-white shadow-[0_10px_25px_rgba(16,185,129,0.45)] border-emerald-300/80",
    floatingWaPulse: "bg-emerald-200",
    footerIcon: "text-emerald-400",
  },
};

export const AgentStorefront: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();

  const [loading, setLoading] = useState(true);
  const [store, setStore] = useState<{
    id: string;
    store_name: string;
    store_slug: string;
    description?: string;
    whatsapp_number?: string;
    whatsapp_group_url?: string;
    logo_url?: string;
    store_theme?: string;
    other_services?: Record<string, number>;
    custom_prices?: Record<string, number>;
    announcement?: string;
    announcement_enabled?: boolean;
    announcement_type?: "promo" | "info" | "warning" | string;
    announcement_popup_enabled?: boolean;
    announcement_popup_title?: string;
    announcement_popup_message?: string;
    announcement_popup_badge?: string;
    announcement_popup_cta_text?: string;
    announcement_popup_cta_url?: string;
  } | null>(null);

  const getServicePrice = (idOrKey: string, fallback: number): number => {
    if (!store) return fallback;
    const s = store as any;
    const cleanKey = String(idOrKey || "").toLowerCase().replace(/^(service|checker)[-_]/, "");
    const aliases = [
      idOrKey,
      cleanKey,
      `service-${cleanKey}`,
      `checker-${cleanKey}`,
      `service_${cleanKey}`,
      `checker_${cleanKey}`,
    ];

    if (cleanKey === "waec") aliases.push("checker-waec", "waec", "wassce");
    if (cleanKey === "bece") aliases.push("checker-bece", "bece");
    if (cleanKey === "netflix") aliases.push("service-netflix", "netflix", "netflix_1month");
    if (cleanKey === "afa") aliases.push("service-afa", "afa");
    if (cleanKey === "mashup") aliases.push("service-mashup", "mashup", "mtn_mashup");

    for (const key of aliases) {
      const val = s.custom_prices?.[key] ?? s.other_services?.[key];
      const n = Number(val);
      if (!isNaN(n) && n > 0) return n;
    }
    return fallback;
  };

  const [products, setProducts] = useState<ProductItem[]>([]);
  const [mainCategory, setMainCategory] = useState<"data" | "boost" | "services" | "checkers">("data");
  const [boostDialogOpen, setBoostDialogOpen] = useState(false);
  const [selectedBoostPlatform, setSelectedBoostPlatform] = useState("tiktok");
  const [selectedNetwork, setSelectedNetwork] = useState<string>("MTN");
  const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [isFlashSaleCheckout, setIsFlashSaleCheckout] = useState(false);

  // ⏸️ Live Orders Paused States (Synchronized with Admin & Bot Commands)
  const [ordersPaused, setOrdersPaused] = useState<boolean>(() => {
    try {
      const local = localStorage.getItem("data1gh_orders_paused");
      if (local !== null) return local === "true";
      const cached = getCachedShopData();
      return cached?.settings?.orders_paused === "true";
    } catch {
      return false;
    }
  });
  const [ordersPauseMessage, setOrdersPauseMessage] = useState<string>(() => {
    try {
      const local = localStorage.getItem("data1gh_orders_pause_message");
      if (local) return local;
      const cached = getCachedShopData();
      return cached?.settings?.orders_pause_message || "";
    } catch {
      return "";
    }
  });

  // ⚡ Live Flash Sale States (Synchronized with Admin Flash Sale)
  const [flashSaleEnabled, setFlashSaleEnabled] = useState(() => {
    try {
      const local = localStorage.getItem("data1gh_flash_sale_enabled");
      if (local !== null) return local === "true";
    } catch (_) { }
    return false;
  });
  const [flashSaleEndTime, setFlashSaleEndTime] = useState(() => {
    try {
      return localStorage.getItem("data1gh_flash_sale_end_time") || "";
    } catch (_) { }
    return "";
  });
  const [flashSaleTitle, setFlashSaleTitle] = useState(() => {
    try {
      return localStorage.getItem("data1gh_flash_sale_title") || "⚡ LIMITED TIME MTN FLASH SALE ⚡";
    } catch (_) { }
    return "⚡ LIMITED TIME MTN FLASH SALE ⚡";
  });
  const [flashSaleNotice, setFlashSaleNotice] = useState(() => {
    try {
      return localStorage.getItem("data1gh_flash_sale_notice") || "Exclusive discounted MTN bundles! Grab yours before time runs out.";
    } catch (_) { }
    return "Exclusive discounted MTN bundles! Grab yours before time runs out.";
  });
  const [flashSaleProducts, setFlashSaleProducts] = useState<any[]>(() => {
    try {
      const local = localStorage.getItem("data1gh_flash_sale_products");
      if (local) {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (_) { }
    return [
      { id: "fs-1", capacity: 1, price: 4.5, original_price: 5.5, in_stock: true, mb: 1000 },
      { id: "fs-2", capacity: 2, price: 8.5, original_price: 10.0, in_stock: true, mb: 2000 },
      { id: "fs-3", capacity: 3, price: 12.5, original_price: 15.0, in_stock: true, mb: 3000 },
      { id: "fs-4", capacity: 5, price: 20.0, original_price: 25.0, in_stock: true, mb: 5000 },
      { id: "fs-5", capacity: 10, price: 38.0, original_price: 48.0, in_stock: true, mb: 10000 },
    ];
  });
  const [storeNow, setStoreNow] = useState(() => Date.now());

  // Real-time 1-second countdown ticker
  useEffect(() => {
    const timer = setInterval(() => setStoreNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const isFlashSaleActive = useMemo(() => {
    if (!flashSaleEnabled) return false;
    if (!flashSaleEndTime) return false;
    const endMs = new Date(flashSaleEndTime).getTime();
    return !isNaN(endMs) && endMs > storeNow;
  }, [flashSaleEnabled, flashSaleEndTime, storeNow]);

  const flashSaleCountdown = useMemo(() => {
    if (!flashSaleEndTime) return { hours: "00", mins: "00", secs: "00", isExpired: true };
    const endMs = new Date(flashSaleEndTime).getTime();
    if (isNaN(endMs)) return { hours: "00", mins: "00", secs: "00", isExpired: true };
    const diff = Math.max(0, endMs - storeNow);
    if (diff <= 0) return { hours: "00", mins: "00", secs: "00", isExpired: true };

    const totalSecs = Math.floor(diff / 1000);
    const hours = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    return {
      hours: String(hours).padStart(2, "0"),
      mins: String(mins).padStart(2, "0"),
      secs: String(secs).padStart(2, "0"),
      isExpired: false,
    };
  }, [flashSaleEndTime, storeNow]);

  // Other Services & Checkers checkout modal state
  const [selectedService, setSelectedService] = useState<"netflix" | "afa" | "mashup" | null>(null);
  const [selectedChecker, setSelectedChecker] = useState<{
    type: "WAEC" | "BECE";
    price: number;
    inStock: boolean;
    stockCount: number | null;
  } | null>(null);

  const [errorMsg, setErrorMsg] = useState("");
  const [announcementDismissed, setAnnouncementDismissed] = useState(false);
  const [announcementPopupOpen, setAnnouncementPopupOpen] = useState(false);

  // Customer Order Tracking State
  const [trackOpen, setTrackOpen] = useState(false);
  const [trackQuery, setTrackQuery] = useState("");
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [trackResults, setTrackResults] = useState<any[] | null>(null);
  const [selectedTrackOrder, setSelectedTrackOrder] = useState<any | null>(null);
  const [refreshingTrackOrder, setRefreshingTrackOrder] = useState(false);
  const [copiedTrackRef, setCopiedTrackRef] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [channelModalOpen, setChannelModalOpen] = useState(false);

  const copyTrackCode = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedTrackRef(text);
      toast.success("Order reference copied!");
      setTimeout(() => setCopiedTrackRef(null), 2000);
    } catch {
      toast.error("Could not copy reference");
    }
  };

  const handleRefreshTrackOrder = async (ref: string) => {
    if (!ref) return;
    setRefreshingTrackOrder(true);
    try {
      const res = await invokeApiFunction("track-order", {
        body: { reference: ref },
      });
      const updated = res?.data?.order;
      if (updated) {
        setSelectedTrackOrder(updated);
        setTrackResults((prev) =>
          prev ? prev.map((o) => (o.reference === ref || o.id === ref ? { ...o, ...updated } : o)) : [updated]
        );
        toast.success(`Delivery status: ${updated.delivery_status || "updated"}`);
      } else {
        toast.info("Status is up to date");
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed to refresh status");
    } finally {
      setRefreshingTrackOrder(false);
    }
  };

  // Post-Payment Order Confirmation State
  const [searchParams] = useSearchParams();
  const incomingRef = searchParams.get("reference") || searchParams.get("trxref");
  const [placedOrder, setPlacedOrder] = useState<any | null>(null);
  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [verifyingOrder, setVerifyingOrder] = useState(false);
  const [copiedRef, setCopiedRef] = useState(false);

  // Netflix live code & Checker cards state for storefront post-payment
  const [storeNetflixCode, setStoreNetflixCode] = useState<string | null>(null);
  const [storeNetflixEmail, setStoreNetflixEmail] = useState<string>("stillmoving11@gmail.com");
  const [storeNetflixCodeAt, setStoreNetflixCodeAt] = useState<string | null>(null);
  const [fetchingStoreNetflix, setFetchingStoreNetflix] = useState(false);
  const [storeNetflixError, setStoreNetflixError] = useState<string | null>(null);
  const [copiedNetflixCode, setCopiedNetflixCode] = useState(false);
  const [checkerResult, setCheckerResult] = useState<{ serial?: string; pin?: string } | null>(null);
  const [copiedPin, setCopiedPin] = useState(false);
  const [copiedSerial, setCopiedSerial] = useState(false);

  const fetchStoreNetflixCode = async (ref: string, force = false) => {
    setFetchingStoreNetflix(true);
    setStoreNetflixError(null);
    try {
      const res = await invokeApiFunction("netflix-fetch-code", {
        body: { reference: ref, force },
      });
      if (res?.data?.netflix_email) {
        setStoreNetflixEmail(res.data.netflix_email);
      }
      if (res?.data?.code) {
        setStoreNetflixCode(res.data.code);
        setStoreNetflixCodeAt(res.data.email_at || new Date().toISOString());
        toast.success("Netflix sign-in code retrieved!");
      } else if (res?.data?.error) {
        setStoreNetflixError(res.data.error);
      }
    } catch (e: any) {
      setStoreNetflixError(e?.message || "Could not retrieve sign-in code");
    } finally {
      setFetchingStoreNetflix(false);
    }
  };

  // Automatically handle return from Paystack directly on the agent storefront
  useEffect(() => {
    if (!incomingRef) return;

    let cancelled = false;
    setVerifyingOrder(true);
    setOrderModalOpen(true);

    const verifyStoreOrder = async () => {
      try {
        const ref = incomingRef;
        const isNetflix = ref.startsWith("NF");
        const isService = isNetflix || ref.startsWith("AF") || ref.startsWith("MU") || ref.startsWith("SRV");
        const isChecker = ref.startsWith("CK");

        if (isService) {
          const res = await invokeApiFunction("service-verify", {
            body: { reference: ref },
          });
          const curOrder = res?.data?.order;
          if (!cancelled && curOrder) {
            setPlacedOrder(curOrder);
            if (curOrder.netflix_last_code) {
              setStoreNetflixCode(curOrder.netflix_last_code);
              setStoreNetflixCodeAt(curOrder.netflix_last_code_at || new Date().toISOString());
            }
            if (res?.data?.netflix_email) {
              setStoreNetflixEmail(res.data.netflix_email);
            }
            toast.success("Payment confirmed! Your order is active.");
            saveOrderToHistory({
              reference: curOrder.reference,
              recipient_phone: curOrder.recipient_phone,
              network: curOrder.network || "SERVICE",
              capacity: curOrder.package_size || curOrder.service || "Service",
              amount: curOrder.amount,
              payment_status: curOrder.payment_status || "paid",
              delivery_status: curOrder.delivery_status || "completed",
              type: "service",
            });

            if (isNetflix) {
              fetchStoreNetflixCode(ref, false);
            }
          }
        } else if (isChecker) {
          const res = await invokeApiFunction("checker-verify", {
            body: { reference: ref },
          });
          const curOrder = res?.data?.order;
          if (!cancelled && curOrder) {
            setPlacedOrder(curOrder);
            if (res?.data?.card) {
              setCheckerResult(res.data.card);
            }
            toast.success("Result checker ready! Serial & PIN generated.");
            saveOrderToHistory({
              reference: curOrder.reference,
              recipient_phone: curOrder.recipient_phone,
              network: "CHECKER",
              capacity: curOrder.package_size || curOrder.type || "Checker",
              amount: curOrder.amount,
              payment_status: "paid",
              delivery_status: "completed",
              type: "checker",
            });
          }
        } else {
          const res = await invokeApiFunction("paystack-verify", {
            body: { reference: incomingRef },
          });

          const curOrder = res?.data?.order;
          if (!cancelled && curOrder) {
            setPlacedOrder(curOrder);
            toast.success("Payment confirmed! Your order has been placed.");
            saveOrderToHistory({
              reference: curOrder.reference,
              recipient_phone: curOrder.recipient_phone,
              network: curOrder.network,
              capacity: curOrder.capacity,
              amount: curOrder.amount,
              payment_status: curOrder.payment_status || "paid",
              delivery_status: curOrder.delivery_status || "processing",
              type: "data",
            });

            // Poll up to 6 times to track live DataMart delivery completion
            for (let i = 0; i < 6; i++) {
              if (cancelled) break;
              const ds = (curOrder.delivery_status || "").toLowerCase();
              if (ds === "delivered" || ds === "completed" || ds === "failed") break;

              await new Promise((r) => setTimeout(r, 2500));
              if (cancelled) break;

              const pollRes = await invokeApiFunction("paystack-verify", {
                body: { reference: incomingRef },
              });
              if (!cancelled && pollRes?.data?.order) {
                setPlacedOrder(pollRes.data.order);
                if (["delivered", "completed"].includes(pollRes.data.order.delivery_status)) {
                  toast.success("Data bundle successfully delivered!");
                  break;
                }
              }
            }
          }
        }
      } catch (e: any) {
        console.warn("Storefront order verification notice:", e);
      } finally {
        if (!cancelled) setVerifyingOrder(false);
        try {
          const cleanPath = window.location.pathname;
          window.history.replaceState({}, document.title, cleanPath);
        } catch (_) { }
      }
    };

    verifyStoreOrder();

    return () => {
      cancelled = true;
    };
  }, [incomingRef]);

  const [refreshing, setRefreshing] = useState(false);

  const fetchStorefront = async (forceRefresh = false) => {
    if (!slug) return;
    const cacheKey = `agent_public_store_${slug.toLowerCase()}`;
    if (forceRefresh) {
      setRefreshing(true);
      invalidateCache(cacheKey);
      try {
        localStorage.removeItem(cacheKey);
        localStorage.removeItem(`cache_${cacheKey}`);
      } catch (_) { }
    }

    try {
      const res = await invokeApiFunction("agent", {
        body: { action: "getPublicStore", slug },
      });

      if (res?.data?.ok && res.data.store) {
        const s = res.data.store;
        const flatServices = {
          ...(res.data.other_services || {}),
          ...(s.other_services || {}),
          ...(s.custom_prices || {}),
        };
        s.other_services = flatServices;
        s.custom_prices = {
          ...(s.custom_prices || {}),
          ...(res.data.store?.custom_prices || {}),
          ...flatServices,
        };

        const prods = res.data.products || [];
        setStore(s);
        document.title = `${s.store_name} · Automated Data Store`;
        setProducts(prods);
        setCache(cacheKey, { store: s, products: prods }, 60 * 1000);

        // Flash sale sync from backend
        if (res.data.flash_sale) {
          const fs = res.data.flash_sale;
          if (fs.enabled !== undefined) setFlashSaleEnabled(Boolean(fs.enabled));
          if (fs.end_time) setFlashSaleEndTime(fs.end_time);
          if (fs.title) setFlashSaleTitle(fs.title);
          if (fs.notice) setFlashSaleNotice(fs.notice);
          if (Array.isArray(fs.products) && fs.products.length > 0) setFlashSaleProducts(fs.products);
        }

        if (forceRefresh) {
          toast.success("Store pricing updated!");
        }

        // Update OG tags & favicon dynamically for the agent store
        try {
          const ogTitle = document.querySelector('meta[property="og:title"]');
          if (ogTitle) ogTitle.setAttribute("content", `${s.store_name} · Buy MTN, Telecel & AT Data Bundles`);
          const twTitle = document.querySelector('meta[name="twitter:title"]');
          if (twTitle) twTitle.setAttribute("content", `${s.store_name} · Buy MTN, Telecel & AT Data Bundles`);
          const fallbackBanner = `${window.location.origin}/store-banner.jpg`;
          const imageToUse = s.logo_url || fallbackBanner;

          const ogImg = document.querySelector('meta[property="og:image"]');
          if (ogImg) ogImg.setAttribute("content", imageToUse);
          const twImg = document.querySelector('meta[name="twitter:image"]');
          if (twImg) twImg.setAttribute("content", imageToUse);
          const iconLink = document.querySelector('link[rel="icon"]');
          if (iconLink) iconLink.setAttribute("href", s.logo_url || "/store-banner.jpg");
          const appleIcon = document.querySelector('link[rel="apple-touch-icon"]');
          if (appleIcon) appleIcon.setAttribute("href", s.logo_url || "/store-banner.jpg");
        } catch (_) { }
      } else {
        if (forceRefresh) {
          toast.error(res?.data?.error || "Could not refresh store.");
        } else {
          setErrorMsg(res?.data?.error || "Store not found.");
        }
      }
    } catch (e: any) {
      if (forceRefresh) {
        toast.error(e?.message || "Could not refresh prices.");
      } else {
        setErrorMsg(e?.message || "Could not load store.");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!slug) return;
    document.title = `${slug.toUpperCase()} Store · Automated Data Delivery`;

    const cacheKey = `agent_public_store_${slug.toLowerCase()}`;
    const cached = getCacheMeta<{ store: any; products: ProductItem[] }>(cacheKey);

    if (cached.exists && cached.data?.store) {
      setStore(cached.data.store);
      setProducts(cached.data.products || []);
      setLoading(false);
      document.title = `${cached.data.store.store_name} · Automated Data Store`;
    } else {
      setLoading(true);
    }

    setErrorMsg("");
    fetchStorefront(false);
  }, [slug]);

  // Trigger Agent Storefront Announcement Pop-up Modal on the screen if configured and not dismissed
  useEffect(() => {
    if (!store?.id) return;
    const hasPopupConfig =
      store.announcement_popup_enabled &&
      (store.announcement_popup_title || store.announcement_popup_message);
    const hasLegacyConfig = store.announcement_enabled && store.announcement;

    if (hasPopupConfig || hasLegacyConfig) {
      try {
        const storageKey = `data1_agent_popup_dismissed_${store.id}`;
        const dismissed = sessionStorage.getItem(storageKey);
        if (!dismissed) {
          const timer = setTimeout(() => {
            setAnnouncementPopupOpen(true);
          }, 600);
          return () => clearTimeout(timer);
        }
      } catch (_) { }
    }
  }, [
    store?.id,
    store?.announcement_popup_enabled,
    store?.announcement_popup_title,
    store?.announcement_popup_message,
    store?.announcement_enabled,
    store?.announcement,
  ]);

  // Synchronize Flash Sale & Orders Paused settings from store cache and invalidation events
  useEffect(() => {
    fetchShopDataCached()
      .then(({ settings }) => {
        if (!settings) return;
        if (settings.orders_paused !== undefined) {
          setOrdersPaused(settings.orders_paused === "true");
        }
        if (settings.orders_pause_message) {
          setOrdersPauseMessage(settings.orders_pause_message);
        }
        if (settings.flash_sale_enabled !== undefined) {
          setFlashSaleEnabled(settings.flash_sale_enabled === "true");
        }
        if (settings.flash_sale_end_time) {
          setFlashSaleEndTime(settings.flash_sale_end_time);
        }
        if (settings.flash_sale_title) {
          setFlashSaleTitle(settings.flash_sale_title);
        }
        if (settings.flash_sale_notice) {
          setFlashSaleNotice(settings.flash_sale_notice);
        }
        if (settings.flash_sale_products) {
          try {
            const parsed = JSON.parse(settings.flash_sale_products);
            if (Array.isArray(parsed) && parsed.length > 0) setFlashSaleProducts(parsed);
          } catch (_) { }
        }
      })
      .catch(() => { });

    const handleInvalidate = () => {
      try {
        const localPaused = localStorage.getItem("data1gh_orders_paused");
        if (localPaused !== null) setOrdersPaused(localPaused === "true");
        const localPauseMsg = localStorage.getItem("data1gh_orders_pause_message");
        if (localPauseMsg) setOrdersPauseMessage(localPauseMsg);
        const local = localStorage.getItem("data1gh_flash_sale_enabled");
        if (local !== null) setFlashSaleEnabled(local === "true");
        const end = localStorage.getItem("data1gh_flash_sale_end_time");
        if (end) setFlashSaleEndTime(end);
      } catch (_) { }
      fetchStorefront(true);
    };
    window.addEventListener("shop-cache-invalidated", handleInvalidate);
    return () => window.removeEventListener("shop-cache-invalidated", handleInvalidate);
  }, [slug]);

  const handleTrackOrder = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const q = trackQuery.trim();
    if (!q) {
      toast.error("Please enter your recipient phone number or order reference");
      return;
    }
    setTrackingLoading(true);
    setHasSearched(true);
    try {
      const isPhoneNumber = /^\d{8,}$/.test(q.replace(/\s+/g, ""));
      const res = await invokeApiFunction("track-order", {
        body: isPhoneNumber ? { phone: q.replace(/\s+/g, "") } : { reference: q },
      });
      let results: any[] = [];
      if (res?.data?.orders && Array.isArray(res.data.orders)) {
        results = res.data.orders;
      } else if (res?.data?.order) {
        results = [res.data.order];
      }
      setTrackResults(results);
      if (results.length === 1) {
        setSelectedTrackOrder(results[0]);
      } else {
        setSelectedTrackOrder(null);
      }
    } catch {
      setTrackResults([]);
      setSelectedTrackOrder(null);
    } finally {
      setTrackingLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-3">
        <Loader2 className="size-8 animate-spin text-cyan-400" />
        <span className="text-xs text-zinc-400">Loading storefront...</span>
      </div>
    );
  }

  if (errorMsg || !store) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 text-center space-y-4">
        <div className="size-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center text-2xl mx-auto">
          ⚠️
        </div>
        <h1 className="text-xl font-black">Store Not Found</h1>
        <p className="text-xs text-zinc-400 max-w-sm mx-auto">
          {errorMsg || "The requested store does not exist or may have been renamed."}
        </p>
        <Button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-xl bg-cyan-500 text-black font-bold"
        >
          Refresh Page
        </Button>
      </div>
    );
  }

  const filteredProducts = products.filter(
    (p) => (p.network || "").toUpperCase() === selectedNetwork
  );

  const waBotNumber = "233200598553";
  const waBotOrderUrl = `https://wa.me/${waBotNumber}?text=${encodeURIComponent(
    `Hi [store:${store.store_slug}]`
  )}`;

  const rawSupportNumber = store.whatsapp_number || store.phone || "";
  const cleanSupportNumber = String(rawSupportNumber).replace(/\D/g, "");
  const formattedSupportNumber = cleanSupportNumber.startsWith("0")
    ? "233" + cleanSupportNumber.slice(1)
    : cleanSupportNumber;
  const customerSupportWaUrl = formattedSupportNumber
    ? `https://wa.me/${formattedSupportNumber}?text=${encodeURIComponent(
      `Hello ${store.store_name}, I am a customer on your store and I need some assistance.`
    )}`
    : null;

  const channelGroupUrl =
    store.whatsapp_group_url || (store as any).whatsapp_channel_url || null;

  const waHref = customerSupportWaUrl || waBotOrderUrl;

  const activeThemeKey = (store?.store_theme || "cyber").toLowerCase();
  const theme = THEME_CONFIGS[activeThemeKey] || THEME_CONFIGS.cyber;

  return (
    <div className={`min-h-screen ${theme.containerBg}`} style={theme.heroGlowStyle}>
      {/* Top Banner Bar */}
      <header className={`sticky top-0 z-40 ${theme.headerBg} border-b ${theme.headerBorder} px-4 md:px-8 py-3.5 flex items-center justify-between`}>
        <div className="flex items-center gap-3">
          {store.logo_url ? (
            <img
              src={store.logo_url}
              alt={store.store_name}
              className={`size-10 rounded-2xl object-cover border ${theme.logoBorder} bg-zinc-900 ${theme.logoGlow} shrink-0`}
              onError={(e) => {
                // hide broken image and show parent fallback
                (e.currentTarget as any).style.display = "none";
              }}
            />
          ) : (
            <div className={`size-10 rounded-2xl bg-white/5 border ${theme.logoBorder} ${theme.badgeText} flex items-center justify-center ${theme.logoGlow} shrink-0`}>
              <Store className="size-5" />
            </div>
          )}
          <div>
            <div className="font-black text-base md:text-lg tracking-tight leading-none text-white">
              {store.store_name}
            </div>
            <div className={`flex items-center gap-2 text-xs ${theme.badgeText} font-semibold mt-0.5`}>
              <span className={`size-1.5 rounded-full ${theme.badgeDot} animate-pulse`} />
              <span>Instant 24/7 Automated Delivery</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Refresh Prices Button */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fetchStorefront(true)}
            disabled={refreshing}
            title="Refresh prices"
            className={`h-9 w-9 p-0 rounded-xl ${theme.trackBtn} flex items-center justify-center`}
          >
            <RefreshCw className={`size-3.5 ${refreshing ? "animate-spin text-cyan-400" : ""}`} />
          </Button>

          {/* Track Order Button */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setTrackOpen(true)}
            className={`h-9 px-3 rounded-xl ${theme.trackBtn} text-xs font-bold flex items-center gap-1.5`}
          >
            <Search className="size-3.5" />
            <span className="hidden sm:inline">Track Order</span>
          </Button>

          {/* Announcement Pop-Up Trigger Button */}
          {((store.announcement_popup_enabled && (store.announcement_popup_title || store.announcement_popup_message)) ||
            (store.announcement_enabled && store.announcement)) && (
              <button
                type="button"
                onClick={() => setAnnouncementPopupOpen(true)}
                className="h-9 px-3 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/40 text-purple-300 text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs"
                title="View Store Announcement"
              >
                <Megaphone className="size-3.5 animate-bounce" />
                <span className="hidden sm:inline">Notice</span>
              </button>
            )}

          {/* Channel Button */}
          <a
            href={channelGroupUrl || "#"}
            onClick={(e) => {
              if (!channelGroupUrl) {
                e.preventDefault();
                setChannelModalOpen(true);
              }
            }}
            target={channelGroupUrl ? "_blank" : undefined}
            rel={channelGroupUrl ? "noopener noreferrer" : undefined}
            className="h-9 px-3 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 text-purple-300 text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs"
            title="Join Official WhatsApp Channel"
          >
            <Users className="size-3.5 text-purple-400" />
            <span className="hidden md:inline">Channel</span>
          </a>

          {/* Customer Support WhatsApp Button */}
          {customerSupportWaUrl && (
            <a
              href={customerSupportWaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="h-9 px-3 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs"
              title={`Chat with ${store.store_name} Customer Support on WhatsApp`}
            >
              <Headphones className="size-3.5 text-emerald-400" />
              <span className="hidden md:inline">Support</span>
            </a>
          )}

          {/* Order on WhatsApp Bot */}
          <a
            href={waBotOrderUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="h-9 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
            title={`Order from ${store.store_name} on WhatsApp`}
          >
            <MessageCircle className="size-4" />
            <span className="hidden sm:inline">Order on WhatsApp</span>
          </a>
        </div>
      </header>

      {/* Hero Section */}
      <div className="max-w-4xl mx-auto px-4 pt-6 pb-2 text-center space-y-3.5">
        <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full ${theme.badgeContainer} text-xs font-bold uppercase tracking-wider`}>
          <Sparkles className="size-3.5" />
          <span>Non-Expiry High Speed Delivery</span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
          {mainCategory === "data" && "Buy Instant Data Bundles"}
          {mainCategory === "boost" && "Social Media Growth & Boost 🚀"}
          {mainCategory === "services" && "Other Digital Services"}
          {mainCategory === "checkers" && "Official Result Checkers"}
        </h1>

        <p className="text-xs sm:text-sm text-zinc-400 max-w-lg mx-auto">
          {mainCategory === "data" && (store.description || "Choose your network, select your bundle size, and receive automated delivery in seconds.")}
          {mainCategory === "boost" && "Boost TikTok, Instagram, YouTube, Facebook, X & Telegram with genuine high-retention engagement and instant start."}
          {mainCategory === "services" && "Get 1-month Netflix TV sign-in codes, MTN Pulse Mashup bundles, and AFA registrations delivered instantly."}
          {mainCategory === "checkers" && "Buy WAEC and BECE result checkers online. Your official Serial Number and PIN show up immediately after payment."}
        </p>

        {/* Quick Contact & Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-2 pt-1 pb-1">
          {/* Customer WhatsApp Support */}
          {customerSupportWaUrl && (
            <a
              href={customerSupportWaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="h-9 px-3.5 rounded-full bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs hover:scale-105 active:scale-95 group"
            >
              <div className="relative">
                <Headphones className="size-3.5 text-emerald-400 group-hover:scale-110 transition-transform" />
                <span className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-emerald-400 animate-ping" />
              </div>
              <span>WhatsApp Support</span>
            </a>
          )}

          {/* Join WhatsApp Channel */}
          <a
            href={channelGroupUrl || "#"}
            onClick={(e) => {
              if (!channelGroupUrl) {
                e.preventDefault();
                setChannelModalOpen(true);
              }
            }}
            target={channelGroupUrl ? "_blank" : undefined}
            rel={channelGroupUrl ? "noopener noreferrer" : undefined}
            className="h-9 px-3.5 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-95 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-md hover:scale-105 active:scale-95 group"
          >
            <Users className="size-3.5 text-purple-200 group-hover:scale-110 transition-transform" />
            <span>Join WhatsApp Channel</span>
          </a>

          {/* Order on WhatsApp Bot */}
          <a
            href={waBotOrderUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="h-9 px-3.5 rounded-full bg-zinc-900/90 hover:bg-zinc-800 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs hover:scale-105 active:scale-95 group"
          >
            <Sparkles className="size-3.5 text-emerald-400 group-hover:rotate-12 transition-transform" />
            <span>Order on WhatsApp Bot</span>
          </a>
        </div>

        {/* Main Category Selector Tabs */}
        <div className="flex items-center justify-center gap-1.5 p-1 rounded-2xl bg-white/[0.06] border border-white/10 max-w-xl mx-auto flex-wrap sm:flex-nowrap">
          <button
            type="button"
            onClick={() => setMainCategory("data")}
            className={`flex-1 py-2 px-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${mainCategory === "data"
              ? `${theme.badgeContainer} font-black shadow-sm`
              : "text-zinc-400 hover:text-white"
              }`}
          >
            <Package className="size-3.5" />
            <span>Data Bundles</span>
          </button>
          <button
            type="button"
            onClick={() => setMainCategory("boost")}
            className={`flex-1 py-2 px-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${mainCategory === "boost"
              ? "bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white font-black shadow-lg shadow-fuchsia-600/30"
              : "text-zinc-400 hover:text-white"
              }`}
          >
            <Rocket className="size-3.5 text-fuchsia-300" />
            <span>Social Boost 🚀</span>
          </button>
          <button
            type="button"
            onClick={() => setMainCategory("services")}
            className={`flex-1 py-2 px-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${mainCategory === "services"
              ? `${theme.badgeContainer} font-black shadow-sm`
              : "text-zinc-400 hover:text-white"
              }`}
          >
            <Play className="size-3.5 fill-current" />
            <span>Services</span>
          </button>
          <button
            type="button"
            onClick={() => setMainCategory("checkers")}
            className={`flex-1 py-2 px-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${mainCategory === "checkers"
              ? `${theme.badgeContainer} font-black shadow-sm`
              : "text-zinc-400 hover:text-white"
              }`}
          >
            <GraduationCap className="size-3.5" />
            <span>Checkers</span>
          </button>
        </div>

        {/* Network Selector Tabs (When Data Bundles Active) */}
        {mainCategory === "data" && (
          <div className={`grid grid-cols-3 max-w-md mx-auto p-1.5 rounded-2xl ${theme.networkTabsContainer} gap-1.5 pt-1`}>
            {["MTN", "TELECEL", "AT"].map((net) => (
              <button
                key={net}
                type="button"
                onClick={() => setSelectedNetwork(net)}
                className={`py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all ${selectedNetwork === net
                  ? theme.networkTabActive[net as keyof typeof theme.networkTabActive] || "bg-white text-black"
                  : "text-zinc-400 hover:text-white"
                  }`}
              >
                {NETWORK_LABEL[net] || net}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* LIVE DELIVERY TRACKER WIDGET ON STOREFRONT */}
      <div className="max-w-4xl mx-auto px-4 pt-4">
        <div className={`p-4 rounded-3xl border ${theme.trackerBorder} ${theme.trackerBox} backdrop-blur-md space-y-3`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Radio className={`size-4 ${theme.trackerPulse} animate-pulse`} />
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Live Delivery Network Status
              </span>
            </div>
            <button
              type="button"
              onClick={() => setTrackOpen(true)}
              className={`text-xs font-bold ${theme.trackerLink} flex items-center gap-1 hover:underline`}
            >
              <span>Track My Delivery</span>
              <ArrowRight className="size-3" />
            </button>
          </div>

          <DeliveryTracker />
        </div>

        {/* Arcade Games Showcase */}
        <ArcadeSection className="mt-4" />
      </div>

      {/* Main Content Grid */}
      <main className="max-w-5xl mx-auto p-4 sm:p-6 pb-20">
        {/* ⏸️ ORDERS PAUSED BANNER (STOREWIDE PAUSE ACROSS MAIN & AGENT STOREFRONTS) */}
        {ordersPaused && (
          <div className="mb-6 p-4 rounded-2xl bg-amber-500/15 border-2 border-amber-500/50 text-amber-200 shadow-lg flex items-center gap-3 animate-in fade-in-50">
            <span className="text-2xl shrink-0">⏸️</span>
            <div>
              <h3 className="font-bold text-sm md:text-base text-amber-300">Orders Temporarily Paused</h3>
              <p className="text-xs text-amber-200/90 mt-0.5">
                {ordersPauseMessage || "Store orders are temporarily paused for brief maintenance. Please check back shortly!"}
              </p>
            </div>
          </div>
        )}

        {/* Customer Referral 5GB Reward Widget */}
        <AgentReferralWidget
          agentSlug={slug || store.store_slug}
          agentStoreName={store.store_name}
          agentId={store.id}
          theme={theme}
        />

        {/* ⚡ LIVE FLASH SALE SHOWCASE (EXTENDED TO AGENT STOREFRONT) */}
        {mainCategory === "data" && isFlashSaleActive && (
          <div className="mb-6 space-y-4 animate-in fade-in-50 duration-300">
            {/* Flash Sale Hero Banner & Live Countdown */}
            <div className="relative overflow-hidden rounded-3xl border-2 border-amber-500/80 bg-gradient-to-br from-amber-500/20 via-zinc-950/90 to-orange-500/20 p-5 md:p-6 shadow-[0_10px_40px_rgba(245,158,11,0.25)]">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="text-center md:text-left space-y-1.5">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider shadow-sm animate-pulse">
                    <Flame className="size-4 fill-slate-950" />
                    <span>Live Flash Sale</span>
                  </div>
                  <h2 className="text-xl md:text-2xl font-black text-white tracking-tight">
                    {flashSaleTitle}
                  </h2>
                  <p className="text-xs md:text-sm text-zinc-300 max-w-xl">
                    {flashSaleNotice}
                  </p>
                </div>

                {/* Countdown Timer Block */}
                <div className="flex items-center gap-2 bg-slate-950/90 border border-amber-500/40 px-4 py-3 rounded-2xl shadow-inner shrink-0">
                  <div className="flex flex-col items-center">
                    <span className="font-mono text-xl md:text-2xl font-black text-amber-400 tabular-nums">
                      {flashSaleCountdown.hours}
                    </span>
                    <span className="text-[10px] uppercase font-bold text-zinc-400">Hours</span>
                  </div>
                  <span className="font-mono text-xl font-black text-amber-500">:</span>
                  <div className="flex flex-col items-center">
                    <span className="font-mono text-xl md:text-2xl font-black text-amber-400 tabular-nums">
                      {flashSaleCountdown.mins}
                    </span>
                    <span className="text-[10px] uppercase font-bold text-zinc-400">Mins</span>
                  </div>
                  <span className="font-mono text-xl font-black text-amber-500">:</span>
                  <div className="flex flex-col items-center">
                    <span className="font-mono text-xl md:text-2xl font-black text-amber-400 tabular-nums">
                      {flashSaleCountdown.secs}
                    </span>
                    <span className="text-[10px] uppercase font-bold text-zinc-400">Secs</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Flash Sale Bundles Grid (MTN Flash Deals) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {flashSaleProducts
                .filter((p) => p.in_stock !== false)
                .map((prod) => (
                  <div
                    key={prod.id || prod.capacity}
                    className="group relative flex flex-col justify-between p-4 rounded-2xl border-2 border-amber-500/40 bg-zinc-900/90 hover:border-amber-400 hover:shadow-[0_8px_25px_rgba(245,158,11,0.25)] transition-all hover:-translate-y-0.5"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <NetworkLogo network="MTN" className="size-8 text-sm" />
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500 text-slate-950">
                        MTN
                      </span>
                    </div>

                    <div className="my-2">
                      <div className="text-xl md:text-2xl font-black font-mono text-white">
                        {prod.capacity} GB
                      </div>
                      <div className="flex items-baseline gap-1.5 mt-1">
                        <span className="text-base md:text-lg font-black font-mono text-amber-400">
                          GH₵ {Number(prod.price).toFixed(2)}
                        </span>
                        {prod.original_price && prod.original_price > prod.price && (
                          <span className="text-xs text-zinc-400 line-through font-mono">
                            GH₵ {Number(prod.original_price).toFixed(2)}
                          </span>
                        )}
                      </div>
                    </div>

                    <Button
                      type="button"
                      disabled={ordersPaused}
                      onClick={() => {
                        if (ordersPaused) {
                          toast.error(ordersPauseMessage || "Orders are currently paused. Please check back shortly!");
                          return;
                        }
                        setSelectedProduct({
                          id: prod.id || `fs-mtn-${prod.capacity}`,
                          network: "MTN",
                          capacity: String(prod.capacity),
                          mb: prod.mb || Number(prod.capacity) * 1000,
                          price: Number(prod.price),
                          name: `MTN ${prod.capacity}GB Flash Sale`,
                          in_stock: true,
                          sort_order: Number(prod.capacity) || 0,
                          is_flash_sale: true,
                        } as any);
                        setIsFlashSaleCheckout(true);
                        setCheckoutOpen(true);
                      }}
                      className="w-full mt-2 h-9 text-xs font-black rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 hover:opacity-95 shadow-md gap-1 disabled:opacity-50"
                    >
                      <Zap className="size-3.5 fill-slate-950" />
                      <span>{ordersPaused ? "Orders Paused" : "Buy Now"}</span>
                    </Button>
                  </div>
                ))}
            </div>

            <div className="pt-2 flex items-center justify-between text-xs text-zinc-400 font-semibold border-b border-white/10 pb-3">
              <span>Standard Data Bundles</span>
              <span className="text-[11px] text-zinc-500">Regular bundles & all networks</span>
            </div>
          </div>
        )}

        {mainCategory === "data" && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
            {filteredProducts.map((p) => (
              <Card
                key={p.id}
                className={`p-4 rounded-3xl border ${theme.productCard} transition-all text-center flex flex-col justify-between group shadow-lg`}
              >
                <div className="space-y-2">
                  <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${networkClass(p.network)}`}>
                    {p.network}
                  </span>

                  <div className="text-xl sm:text-2xl font-black text-white tracking-tight">
                    {p.capacity} <span className="text-xs font-bold text-zinc-400">GB</span>
                  </div>

                  <div className="text-[11px] text-zinc-400 font-medium">
                    Non-Expiry
                  </div>
                </div>

                <div className="pt-3 border-t border-white/5 space-y-2.5 mt-3">
                  <div className={`text-lg font-black ${theme.priceText} font-mono`}>
                    {formatGHS(p.price)}
                  </div>

                  <Button
                    type="button"
                    disabled={ordersPaused}
                    onClick={() => {
                      if (ordersPaused) {
                        toast.error(ordersPauseMessage || "Orders are currently paused. Please check back shortly!");
                        return;
                      }
                      setSelectedProduct(p);
                      setCheckoutOpen(true);
                    }}
                    className={`w-full h-9 rounded-xl ${theme.buyButton} font-black text-xs uppercase tracking-wider active:scale-95 transition-all disabled:opacity-50`}
                  >
                    {ordersPaused ? "Orders Paused" : "Buy Now"}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* SOCIAL MEDIA BOOST CATEGORY */}
        {mainCategory === "boost" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Boost Showcase Banner */}
            <div className="p-5 md:p-6 rounded-3xl border border-fuchsia-500/30 bg-gradient-to-br from-fuchsia-950/40 via-zinc-950 to-black text-white relative overflow-hidden shadow-xl">
              <div className="absolute top-0 right-0 -mr-16 -mt-16 size-48 rounded-full bg-fuchsia-500/20 blur-3xl pointer-events-none" />
              <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="space-y-1.5 max-w-xl">
                  <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/30 text-xs font-black uppercase">
                    <Rocket className="size-3.5 text-fuchsia-300" /> Instant Growth Network
                  </div>
                  <h3 className="text-xl md:text-2xl font-black text-white tracking-tight">
                    Grow Your Social Reach &amp; Authority
                  </h3>
                  <p className="text-xs md:text-sm text-zinc-300 leading-relaxed">
                    Select a platform below to order high-retention followers, likes, reel views, subscribers, or comments.
                    Fulfillment starts automatically within 2–5 minutes. 100% safe — no password or account login required!
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                  <Button
                    type="button"
                    onClick={() => {
                      setSelectedBoostPlatform("tiktok");
                      setBoostDialogOpen(true);
                    }}
                    className="h-10 px-5 rounded-2xl bg-gradient-to-r from-fuchsia-500 to-pink-500 hover:opacity-95 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-fuchsia-500/30"
                  >
                    <Rocket className="size-3.5 mr-1.5" /> Start Order Now
                  </Button>
                </div>
              </div>

              {/* Quality & Safety Badges */}
              <div className="mt-5 pt-4 border-t border-white/10 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-zinc-300">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="size-4 text-emerald-400 shrink-0" />
                  <span>100% Safe (Only Link/Username Needed)</span>
                </div>
                <div className="flex items-center gap-2">
                  <Zap className="size-4 text-amber-400 shrink-0" />
                  <span>Instant Start &amp; Live Tracking</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-cyan-400 shrink-0" />
                  <span>0% Drop Permanent Packages Available</span>
                </div>
              </div>
            </div>

            {/* Platform Selection Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                {
                  id: "tiktok",
                  name: "TikTok",
                  badge: "Popular 🔥",
                  tagline: "Followers, Likes, Views, Shares & Saves",
                  description: "Skyrocket your viral reach, get on the For You page, and build creator authority.",
                  borderGlow: "border-cyan-500/30 hover:border-cyan-400 hover:shadow-[0_0_25px_rgba(6,182,212,0.25)]",
                  bgGradient: "from-zinc-900 via-zinc-950 to-black",
                },
                {
                  id: "instagram",
                  name: "Instagram",
                  badge: "Trending ⚡",
                  tagline: "Followers, Likes, Reel Views, Comments",
                  description: "Boost your personal brand, explore page presence, and profile social proof.",
                  borderGlow: "border-pink-500/30 hover:border-pink-400 hover:shadow-[0_0_25px_rgba(236,72,153,0.25)]",
                  bgGradient: "from-pink-950/30 via-zinc-950 to-black",
                },
                {
                  id: "facebook",
                  name: "Facebook",
                  badge: "High Retention 👥",
                  tagline: "Page Followers, Likes, Reel Views",
                  description: "Grow your business page followers and build an active engaged community.",
                  borderGlow: "border-blue-500/30 hover:border-blue-400 hover:shadow-[0_0_25px_rgba(59,130,246,0.25)]",
                  bgGradient: "from-blue-950/30 via-zinc-950 to-black",
                },
                {
                  id: "youtube",
                  name: "YouTube",
                  badge: "Monetizable 🎬",
                  tagline: "Subscribers, Watch-Time Views, Likes",
                  description: "Hit partner monetization goals faster with high-retention views and organic subscribers.",
                  borderGlow: "border-red-500/30 hover:border-red-400 hover:shadow-[0_0_25px_rgba(239,68,68,0.25)]",
                  bgGradient: "from-red-950/30 via-zinc-950 to-black",
                },
                {
                  id: "twitter",
                  name: "Twitter (X)",
                  badge: "Fast ⚡",
                  tagline: "Followers, Retweets, Likes, Quotes",
                  description: "Establish strong thought leadership and spark trending viral discussions on X.",
                  borderGlow: "border-zinc-500/30 hover:border-zinc-400 hover:shadow-[0_0_25px_rgba(255,255,255,0.2)]",
                  bgGradient: "from-zinc-900 via-zinc-950 to-black",
                },
                {
                  id: "telegram",
                  name: "Telegram",
                  badge: "Non-Drop 🛡️",
                  tagline: "Channel Members, Group Members, Post Views",
                  description: "Expand public and private channel subscriber counts with permanent active retention.",
                  borderGlow: "border-sky-500/30 hover:border-sky-400 hover:shadow-[0_0_25px_rgba(14,165,233,0.25)]",
                  bgGradient: "from-sky-950/30 via-zinc-950 to-black",
                },
              ].map((platform) => (
                <Card
                  key={platform.id}
                  onClick={() => {
                    setSelectedBoostPlatform(platform.id);
                    setBoostDialogOpen(true);
                  }}
                  className={`cursor-pointer p-5 rounded-3xl bg-gradient-to-br ${platform.bgGradient} border ${platform.borderGlow} transition-all duration-300 hover:-translate-y-1 relative group overflow-hidden shadow-lg flex flex-col justify-between`}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <SocialPlatformIcon platform={platform.id} className="size-11 shrink-0 drop-shadow-md group-hover:scale-105 transition-transform" />
                      <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-white/10 text-zinc-200 border border-white/10">
                        {platform.badge}
                      </span>
                    </div>

                    <div>
                      <h4 className="text-lg font-black text-white group-hover:text-fuchsia-300 transition-colors">
                        {platform.name}
                      </h4>
                      <p className="text-xs font-semibold text-zinc-300 mt-0.5 line-clamp-1">
                        {platform.tagline}
                      </p>
                      <p className="text-[11px] text-zinc-400 mt-2 leading-relaxed">
                        {platform.description}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs font-black text-fuchsia-400 group-hover:text-fuchsia-300">
                    <span>Order {platform.name} Boost</span>
                    <ArrowRight className="size-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {mainCategory === "services" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Netflix Card */}
            <Card className="p-5 rounded-3xl border border-red-500/30 bg-gradient-to-br from-red-950/40 via-zinc-900 to-black text-white shadow-xl flex flex-col justify-between relative overflow-hidden group">
              <div className="absolute top-0 right-0 -mr-10 -mt-10 size-28 rounded-full bg-red-600/20 blur-2xl pointer-events-none" />
              <div className="space-y-3 relative z-10">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded-md text-[10px] font-black uppercase bg-red-600/20 text-red-400 border border-red-500/40 flex items-center gap-1">
                    <Play className="size-3 fill-red-400" /> Netflix
                  </span>
                  <span className="text-[10px] font-mono text-zinc-400 bg-white/5 px-2 py-0.5 rounded-full border border-white/10">
                    1 Month
                  </span>
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">Netflix Premium Account</h3>
                  <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                    1-Month subscription for TV and Mobile. Receive your login email and temporary sign-in code automatically.
                  </p>
                </div>
                <div className="space-y-1 text-[11px] text-zinc-300">
                  <div className="flex items-center gap-1.5 text-zinc-400">
                    <Check className="size-3 text-red-400" />
                    <span>Instant TV sign-in code via netflix.com/tv8</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-zinc-400">
                    <Check className="size-3 text-red-400" />
                    <span>Ultra HD 4K Streaming</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-white/10 space-y-3 mt-4 relative z-10">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-zinc-400 font-semibold">Price</span>
                  <span className="text-2xl font-black text-white font-mono">
                    {formatGHS(getServicePrice("service-netflix", 30))}
                  </span>
                </div>
                <Button
                  type="button"
                  disabled={ordersPaused}
                  onClick={() => {
                    if (ordersPaused) {
                      toast.error(ordersPauseMessage || "Orders are currently paused. Please check back shortly!");
                      return;
                    }
                    setSelectedService("netflix");
                  }}
                  className="w-full h-10 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:opacity-95 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-red-600/30 disabled:opacity-50"
                >
                  {ordersPaused ? "Orders Paused" : "Buy Netflix Access"}
                </Button>
              </div>
            </Card>

            {/* AFA Registration Card */}
            <Card className="p-5 rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/40 via-zinc-900 to-black text-white shadow-xl flex flex-col justify-between relative overflow-hidden group">
              <div className="absolute top-0 right-0 -mr-10 -mt-10 size-28 rounded-full bg-emerald-600/20 blur-2xl pointer-events-none" />
              <div className="space-y-3 relative z-10">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded-md text-[10px] font-black uppercase bg-emerald-600/20 text-emerald-400 border border-emerald-500/40 flex items-center gap-1">
                    <IdCard className="size-3" /> MTN AFA
                  </span>
                  <span className="text-[10px] font-mono text-zinc-400 bg-white/5 px-2 py-0.5 rounded-full border border-white/10">
                    Official
                  </span>
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">AFA Registration</h3>
                  <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                    Official Ghana Farmers Association registration for reduced MTN bundle rates and special discounts.
                  </p>
                </div>
                <div className="space-y-1 text-[11px] text-zinc-300">
                  <div className="flex items-center gap-1.5 text-zinc-400">
                    <Check className="size-3 text-emerald-400" />
                    <span>Unlocks lowest MTN bundle pricing</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-zinc-400">
                    <Check className="size-3 text-emerald-400" />
                    <span>Fast WhatsApp agent onboarding</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-white/10 space-y-3 mt-4 relative z-10">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-zinc-400 font-semibold">Price</span>
                  <span className="text-2xl font-black text-white font-mono">
                    {formatGHS(getServicePrice("service-afa", 20))}
                  </span>
                </div>
                <Button
                  type="button"
                  disabled={ordersPaused}
                  onClick={() => {
                    if (ordersPaused) {
                      toast.error(ordersPauseMessage || "Orders are currently paused. Please check back shortly!");
                      return;
                    }
                    setSelectedService("afa");
                  }}
                  className="w-full h-10 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:opacity-95 text-black font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/30 disabled:opacity-50"
                >
                  {ordersPaused ? "Orders Paused" : "Register AFA"}
                </Button>
              </div>
            </Card>

            {/* MTN Pulse Mashup Card */}
            <Card className="p-5 rounded-3xl border border-amber-500/30 bg-gradient-to-br from-amber-950/40 via-zinc-900 to-black text-white shadow-xl flex flex-col justify-between relative overflow-hidden group">
              <div className="absolute top-0 right-0 -mr-10 -mt-10 size-28 rounded-full bg-amber-600/20 blur-2xl pointer-events-none" />
              <div className="space-y-3 relative z-10">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded-md text-[10px] font-black uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                    <Zap className="size-3" /> MTN Mashup
                  </span>
                  <span className="text-[10px] font-mono text-zinc-400 bg-white/5 px-2 py-0.5 rounded-full border border-white/10">
                    Flexible
                  </span>
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">MTN Pulse Mashup</h3>
                  <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                    Voice + Data combo packages. Choose any amount from GH₵ 1.00 upwards delivered straight to your MTN SIM.
                  </p>
                </div>
                <div className="space-y-1 text-[11px] text-zinc-300">
                  <div className="flex items-center gap-1.5 text-zinc-400">
                    <Check className="size-3 text-amber-400" />
                    <span>Custom voice minutes &amp; high speed data</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-zinc-400">
                    <Check className="size-3 text-amber-400" />
                    <span>Instant delivery to MTN numbers</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-white/10 space-y-3 mt-4 relative z-10">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-zinc-400 font-semibold">Starting at</span>
                  <span className="text-2xl font-black text-white font-mono">
                    GH₵ 1.00+
                  </span>
                </div>
                <Button
                  type="button"
                  disabled={ordersPaused}
                  onClick={() => {
                    if (ordersPaused) {
                      toast.error(ordersPauseMessage || "Orders are currently paused. Please check back shortly!");
                      return;
                    }
                    setSelectedService("mashup");
                  }}
                  className="w-full h-10 rounded-xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:opacity-95 text-black font-black text-xs uppercase tracking-wider shadow-lg shadow-amber-500/30 disabled:opacity-50"
                >
                  {ordersPaused ? "Orders Paused" : "Buy Mashup"}
                </Button>
              </div>
            </Card>
          </div>
        )}

        {mainCategory === "checkers" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* WAEC Card */}
            <Card className="p-6 rounded-3xl border border-blue-500/30 bg-gradient-to-br from-blue-950/40 via-zinc-900 to-black text-white shadow-xl flex flex-col justify-between relative overflow-hidden group">
              <div className="absolute top-0 right-0 -mr-10 -mt-10 size-28 rounded-full bg-blue-600/20 blur-2xl pointer-events-none" />
              <div className="space-y-3 relative z-10">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded-md text-[10px] font-black uppercase bg-blue-600/20 text-blue-400 border border-blue-500/40 flex items-center gap-1">
                    <GraduationCap className="size-3.5" /> WAEC WASSCE
                  </span>
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 font-bold">
                    In Stock
                  </span>
                </div>
                <div>
                  <h3 className="text-xl font-black text-white">WAEC Result Checker</h3>
                  <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                    Official card for checking WASSCE and NovDec results on the WAEC Direct Ghana portal.
                  </p>
                </div>
                <div className="space-y-1 text-xs text-zinc-300">
                  <div className="flex items-center gap-1.5 text-zinc-400">
                    <Check className="size-3.5 text-blue-400" />
                    <span>Instant card Serial Number and PIN</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-zinc-400">
                    <Check className="size-3.5 text-blue-400" />
                    <span>Usable up to 3 times per student</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-white/10 space-y-3 mt-5 relative z-10">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-zinc-400 font-semibold">Card Price</span>
                  <span className="text-2xl font-black text-white font-mono">
                    {formatGHS(getServicePrice("checker-waec", 20))}
                  </span>
                </div>
                <Button
                  type="button"
                  disabled={ordersPaused}
                  onClick={() => {
                    if (ordersPaused) {
                      toast.error(ordersPauseMessage || "Orders are currently paused. Please check back shortly!");
                      return;
                    }
                    setSelectedChecker({ type: "WAEC", price: getServicePrice("checker-waec", 20), inStock: true, stockCount: 50 });
                  }}
                  className="w-full h-11 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:opacity-95 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-blue-600/30 disabled:opacity-50"
                >
                  {ordersPaused ? "Orders Paused" : "Buy WAEC Checker"}
                </Button>
              </div>
            </Card>

            {/* BECE Card */}
            <Card className="p-6 rounded-3xl border border-orange-500/30 bg-gradient-to-br from-orange-950/40 via-zinc-900 to-black text-white shadow-xl flex flex-col justify-between relative overflow-hidden group">
              <div className="absolute top-0 right-0 -mr-10 -mt-10 size-28 rounded-full bg-orange-600/20 blur-2xl pointer-events-none" />
              <div className="space-y-3 relative z-10">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded-md text-[10px] font-black uppercase bg-orange-600/20 text-orange-400 border border-orange-500/40 flex items-center gap-1">
                    <GraduationCap className="size-3.5" /> BECE School
                  </span>
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 font-bold">
                    In Stock
                  </span>
                </div>
                <div>
                  <h3 className="text-xl font-black text-white">BECE Result Checker</h3>
                  <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                    Official card for checking BECE (Junior High School) examination results online.
                  </p>
                </div>
                <div className="space-y-1 text-xs text-zinc-300">
                  <div className="flex items-center gap-1.5 text-zinc-400">
                    <Check className="size-3.5 text-orange-400" />
                    <span>Instant card Serial Number and PIN</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-zinc-400">
                    <Check className="size-3.5 text-orange-400" />
                    <span>Valid for direct portal verification</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-white/10 space-y-3 mt-5 relative z-10">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-zinc-400 font-semibold">Card Price</span>
                  <span className="text-2xl font-black text-white font-mono">
                    {formatGHS(getServicePrice("checker-bece", 18))}
                  </span>
                </div>
                <Button
                  type="button"
                  disabled={ordersPaused}
                  onClick={() => {
                    if (ordersPaused) {
                      toast.error(ordersPauseMessage || "Orders are currently paused. Please check back shortly!");
                      return;
                    }
                    setSelectedChecker({ type: "BECE", price: getServicePrice("checker-bece", 18), inStock: true, stockCount: 50 });
                  }}
                  className="w-full h-11 rounded-xl bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 hover:opacity-95 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-orange-500/30 disabled:opacity-50"
                >
                  {ordersPaused ? "Orders Paused" : "Buy BECE Checker"}
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* Important Store Notice & Guide */}
        <StoreGuideNote
          storeName={store.store_name || "Agent Store"}
          supportPhone={store.whatsapp_number || store.phone}
          whatsappLink={customerSupportWaUrl || (store.whatsapp_number ? `https://wa.me/${store.whatsapp_number.replace(/\D/g, "")}` : undefined)}
          isAgentStore={true}
        />

        {/* Clean White-Label Footer */}
        <footer className="mt-14 pt-8 pb-12 border-t border-white/10 text-center space-y-4">
          <div className="flex flex-wrap items-center justify-center gap-3 text-xs">
            {customerSupportWaUrl && (
              <a
                href={customerSupportWaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-300 font-semibold transition-all"
              >
                <Headphones className="size-3.5 text-emerald-400" />
                <span>Customer Support: WhatsApp</span>
              </a>
            )}
            <a
              href={channelGroupUrl || "#"}
              onClick={(e) => {
                if (!channelGroupUrl) {
                  e.preventDefault();
                  setChannelModalOpen(true);
                }
              }}
              target={channelGroupUrl ? "_blank" : undefined}
              rel={channelGroupUrl ? "noopener noreferrer" : undefined}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 text-purple-300 font-semibold transition-all"
            >
              <Users className="size-3.5 text-purple-400" />
              <span>Join WhatsApp Channel</span>
            </a>
            <a
              href={waBotOrderUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 font-semibold transition-all"
            >
              <MessageCircle className="size-3.5 text-emerald-400" />
              <span>Order on WhatsApp Bot</span>
            </a>
            <button
              type="button"
              onClick={() => setTrackOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 font-semibold transition-all"
            >
              <Search className="size-3.5 text-cyan-400" />
              <span>Track Live Order</span>
            </button>
          </div>

          <div className="text-[11px] text-zinc-500 flex items-center justify-center gap-1.5 pt-2">
            <ShieldCheck className={`size-3.5 ${theme.footerIcon}`} />
            <span>Encrypted &amp; Automated Data Delivery Network &bull; 24/7 Automated Fulfillment</span>
          </div>
        </footer>
      </main>

      {/* Customer Order Tracker Modal */}
      <Dialog
        open={trackOpen}
        onOpenChange={(open) => {
          setTrackOpen(open);
          if (!open) {
            setSelectedTrackOrder(null);
          }
        }}
      >
        <DialogContent className="max-w-xl bg-zinc-950 border border-white/15 text-white p-5 md:p-6 rounded-3xl shadow-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between gap-2">
              <DialogTitle className="text-base md:text-lg font-black flex items-center gap-2">
                <Search className={`size-4 ${theme.footerIcon}`} />
                <span>Track Your Order Status</span>
              </DialogTitle>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border uppercase tracking-wider ${theme.badgeContainer}`}>
                {store.store_name}
              </span>
            </div>
            <DialogDescription className="text-xs text-zinc-400">
              Live automated telecom delivery telemetry for {store.store_name} orders.
            </DialogDescription>
          </DialogHeader>

          {/* Telemetry Status Ticker */}
          <div className={`mt-2 p-2.5 rounded-2xl border text-xs flex items-center justify-between gap-2 ${theme.trackerBox} ${theme.trackerBorder}`}>
            <div className="flex items-center gap-2">
              <Radio className={`size-3.5 animate-pulse ${theme.trackerPulse}`} />
              <span className="text-zinc-300 font-medium">Automated Dispatch Gateway: <strong className="text-emerald-400">Active</strong></span>
            </div>
            <span className="text-[11px] text-zinc-400 font-mono">Avg: ~2-5 mins</span>
          </div>

          <form onSubmit={handleTrackOrder} className="space-y-3 mt-3">
            <div className="space-y-1.5">
              <label htmlFor="t_query" className="text-xs font-semibold text-zinc-300">
                Recipient Phone Number or Order Reference
              </label>
              <div className="flex gap-2">
                <Input
                  id="t_query"
                  placeholder="e.g. 0541234567 or D1-XXXXX"
                  value={trackQuery}
                  onChange={(e) => setTrackQuery(e.target.value)}
                  className="bg-black/60 border-white/15 text-white font-mono text-xs rounded-xl"
                />
                <Button
                  type="submit"
                  disabled={trackingLoading}
                  className={`rounded-xl font-bold text-xs shrink-0 ${theme.buyButton}`}
                >
                  {trackingLoading ? <Loader2 className="size-3.5 animate-spin" /> : "Track"}
                </Button>
              </div>
            </div>
          </form>

          {/* Results Area */}
          <div className="mt-4 space-y-3">
            {trackingLoading && (
              <div className="py-10 text-center text-xs text-zinc-400 flex flex-col items-center justify-center gap-2">
                <Loader2 className={`size-6 animate-spin ${theme.trackerPulse}`} />
                <span>Checking live telecom network gateway...</span>
              </div>
            )}

            {!trackingLoading && hasSearched && (!trackResults || trackResults.length === 0) && (
              <div className="py-8 text-center space-y-2 rounded-2xl border border-white/10 bg-white/[0.02]">
                <AlertCircle className="size-7 text-zinc-500 mx-auto" />
                <p className="text-xs text-zinc-300">
                  No orders found for <strong className="text-white font-mono">{trackQuery}</strong>.
                </p>
                <p className="text-[11px] text-zinc-500 max-w-xs mx-auto">
                  Please verify the recipient phone number or order reference code.
                </p>
              </div>
            )}

            {/* SINGLE ORDER DETAILED VIEW (Matches Main Store Track.tsx with Agent Brand) */}
            {!trackingLoading && selectedTrackOrder && (() => {
              const ord = selectedTrackOrder;
              const ds = (ord.delivery_status || ord.status || "").toLowerCase();
              const ps = (ord.payment_status || "").toLowerCase();
              const paid = ps === "paid" || ds === "delivered" || ds === "processing" || ds === "completed";
              const paymentFailed = ps === "failed";
              const deliveryFailed = ds === "failed" || ds === "cancelled" || ds === "rejected" || ds === "declined";
              const delivered = paid && (ds === "delivered" || ds === "completed");
              const waiting = paid && (ds === "waiting" || ds === "pending");
              const processing = paid && (ds === "processing" || ds === "in_progress");

              const StatusIcon = paymentFailed || deliveryFailed
                ? XCircle
                : delivered
                  ? CheckCircle2
                  : waiting || processing
                    ? Clock
                    : CheckCircle2;

              const tone = paymentFailed || deliveryFailed
                ? "text-rose-400 border-rose-500/30 bg-rose-500/10"
                : delivered
                  ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
                  : waiting || processing
                    ? "text-cyan-400 border-cyan-500/30 bg-cyan-500/10"
                    : "text-amber-400 border-amber-500/30 bg-amber-500/10";

              let title = "Awaiting Payment";
              let subtitle = "Complete payment to have your order delivered.";

              if (!paid) {
                if (paymentFailed) {
                  title = "Payment Failed";
                  subtitle = ord.error_message || "The payment transaction could not be completed. Please try again.";
                } else {
                  title = "Awaiting Payment Confirmation";
                  subtitle = "Waiting to confirm Mobile Money payment. If approved, click 'Refresh Live Status' below.";
                }
              } else {
                if (deliveryFailed) {
                  title = "Delivery Issue";
                  subtitle = ord.error_message || "Payment was received, but automated delivery could not be completed. Support has been notified.";
                } else if (delivered) {
                  title = "Bundle Delivered Successfully!";
                  subtitle = "The data bundle has been credited to your recipient line.";
                } else if (waiting) {
                  title = "Payment Received · Queued for Delivery ⏳";
                  subtitle = "Payment received. Your order is queued for fast automated delivery.";
                } else if (processing) {
                  title = "Payment Received · Order is in Processing ⚡";
                  subtitle = `Payment received. Telecom gateway is actively delivering this bundle to ${ord.recipient_phone || ord.phone || 'recipient'}.`;
                } else {
                  title = "Payment Received · In Processing";
                  subtitle = "Your order is confirmed and currently in processing.";
                }
              }

              const targetRef = ord.reference || ord.id || "";
              const waOrderText = `Hello ${store.store_name}, I need assistance with my order ${targetRef}`;
              const customWaHref = waHref ? `${waHref.split("?")[0]}?text=${encodeURIComponent(waOrderText)}` : "";

              return (
                <div className="space-y-4">
                  {trackResults && trackResults.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedTrackOrder(null)}
                      className="text-xs text-zinc-400 hover:text-white p-0 h-auto font-medium flex items-center gap-1"
                    >
                      <ChevronLeft className="size-3.5" />
                      <span>Back to search results ({trackResults.length} orders)</span>
                    </Button>
                  )}

                  {/* Status Banner */}
                  <div className={`rounded-2xl border p-4 space-y-3.5 ${tone}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <StatusIcon className="size-6 shrink-0 mt-0.5" />
                        <div>
                          <div className="font-bold text-sm md:text-base leading-tight">{title}</div>
                          <div className="text-xs opacity-90 mt-1">{subtitle}</div>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRefreshTrackOrder(targetRef)}
                        disabled={refreshingTrackOrder}
                        className="h-7 px-2 text-[11px] font-bold text-white bg-white/10 hover:bg-white/20 rounded-lg shrink-0 gap-1"
                      >
                        <RefreshCw className={`size-3 ${refreshingTrackOrder ? "animate-spin" : ""}`} />
                        <span>{refreshingTrackOrder ? "Checking..." : "Refresh"}</span>
                      </Button>
                    </div>

                    {/* 3-Step Visual Progress Pipeline */}
                    {paid && (
                      <div className="pt-2 border-t border-white/10 grid grid-cols-3 gap-2 text-center">
                        <div className="flex flex-col items-center">
                          <div className="size-6 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center mb-1 text-[11px] font-black">
                            ✓
                          </div>
                          <span className="text-[10px] font-bold text-emerald-400">Payment</span>
                          <span className="text-[9px] text-zinc-400">Received</span>
                        </div>
                        <div className="flex flex-col items-center">
                          <div className={`size-6 rounded-full flex items-center justify-center mb-1 text-[11px] font-black ${delivered
                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                            : "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 animate-pulse"
                            }`}>
                            {delivered ? "✓" : "⚡"}
                          </div>
                          <span className={`text-[10px] font-bold ${delivered ? "text-emerald-400" : "text-cyan-300"}`}>Order</span>
                          <span className="text-[9px] text-zinc-400">In Processing</span>
                        </div>
                        <div className="flex flex-col items-center">
                          <div className={`size-6 rounded-full flex items-center justify-center mb-1 text-[11px] font-black ${delivered
                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                            : "bg-white/5 text-zinc-500 border border-white/10"
                            }`}>
                            {delivered ? "✓" : "•"}
                          </div>
                          <span className={`text-[10px] font-bold ${delivered ? "text-emerald-400" : "text-zinc-500"}`}>Delivery</span>
                          <span className="text-[9px] text-zinc-400">{delivered ? "Delivered" : "~2-5 min"}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Details Card */}
                  <div className="p-4 rounded-2xl border border-white/10 bg-white/[0.03] space-y-2.5 text-xs">
                    <div className="flex items-center justify-between pb-2 border-b border-white/10">
                      <span className="text-zinc-400 font-medium">Order Reference</span>
                      <div className="flex items-center gap-1.5 font-mono font-bold text-cyan-300">
                        <span>{targetRef}</span>
                        <button
                          type="button"
                          onClick={() => copyTrackCode(targetRef)}
                          className="p-1 rounded-md bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white"
                          title="Copy reference"
                        >
                          {copiedTrackRef === targetRef ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between py-1 border-b border-white/5">
                      <span className="text-zinc-400 font-medium">Network &amp; Package</span>
                      <div className="flex items-center gap-1.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${networkClass(ord.network)}`}>
                          {ord.network || "DATA"}
                        </span>
                        <strong className="text-white font-bold">{ord.capacity || ord.package_size || "Bundle"}</strong>
                      </div>
                    </div>

                    <div className="flex items-center justify-between py-1 border-b border-white/5">
                      <span className="text-zinc-400 font-medium">Recipient Phone</span>
                      <strong className="text-white font-mono font-bold">{ord.recipient_phone || ord.phone || "N/A"}</strong>
                    </div>

                    {ord.amount !== undefined && (
                      <div className="flex items-center justify-between py-1 border-b border-white/5">
                        <span className="text-zinc-400 font-medium">Amount Paid</span>
                        <strong className="text-white font-bold">{formatGHS(Number(ord.amount || 0))}</strong>
                      </div>
                    )}

                    {ord.created_at && (
                      <div className="flex items-center justify-between py-1 border-b border-white/5">
                        <span className="text-zinc-400 font-medium">Date Placed</span>
                        <span className="text-zinc-300 font-mono text-[11px]">
                          {new Date(ord.created_at).toLocaleString("en-GB")}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-zinc-400 font-medium">Delivery Status</span>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${delivered
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                        : processing
                          ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 animate-pulse"
                          : deliveryFailed
                            ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                            : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                        }`}>
                        {ord.delivery_status || ord.status || "Pending"}
                      </span>
                    </div>
                  </div>

                  {/* Netflix Live Code If Available */}
                  {ord.netflix_last_code && (
                    <div className="p-3.5 rounded-2xl bg-red-950/30 border border-red-500/30 flex items-center justify-between gap-3 text-xs">
                      <div>
                        <span className="text-[10px] text-red-400 font-bold uppercase block">Netflix Sign-In Code</span>
                        <span className="font-mono text-base font-black text-red-200 tracking-wider">
                          {ord.netflix_last_code}
                        </span>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => copyTrackCode(ord.netflix_last_code)}
                        className="h-8 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs gap-1"
                      >
                        <Copy className="size-3" />
                        <span>Copy Code</span>
                      </Button>
                    </div>
                  )}

                  {/* Dedicated WhatsApp Support Action */}
                  {customWaHref && (
                    <a
                      href={customWaHref}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full py-2.5 px-4 rounded-2xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 font-bold text-xs flex items-center justify-center gap-2 transition-colors"
                    >
                      <MessageCircle className="size-4 text-emerald-400" />
                      <span>Need Help? Chat with {store.store_name} on WhatsApp</span>
                    </a>
                  )}
                </div>
              );
            })()}

            {/* MULTI-ORDER LIST VIEW (When searching by phone number) */}
            {!trackingLoading && !selectedTrackOrder && Array.isArray(trackResults) && trackResults.length > 0 && (
              <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                <div className="text-[11px] text-zinc-400 font-medium px-1 flex items-center justify-between">
                  <span>Found {trackResults.length} orders for this search:</span>
                  <span className="text-[10px] text-cyan-400 font-bold">Click any order to view full tracker</span>
                </div>

                {trackResults.map((ord: any) => {
                  const isDelivered = ord.delivery_status === "delivered" || ord.status === "completed";
                  const isProcessing = ord.delivery_status === "processing" || ord.payment_status === "paid" || ord.status === "paid";
                  const isFailed = ord.delivery_status === "failed";

                  return (
                    <div
                      key={ord.id || ord.reference}
                      onClick={() => setSelectedTrackOrder(ord)}
                      className="p-3.5 rounded-2xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] hover:border-cyan-500/40 cursor-pointer transition-all space-y-2 group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-cyan-300 group-hover:text-cyan-200 flex items-center gap-1.5">
                          <span>{ord.reference || ord.id}</span>
                          <ArrowRight className="size-3 text-cyan-400 group-hover:translate-x-0.5 transition-transform" />
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${isDelivered
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                          : isProcessing
                            ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 animate-pulse"
                            : isFailed
                              ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                              : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                          }`}>
                          {ord.delivery_status || ord.status || "Pending"}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs text-zinc-300">
                        <div>
                          <span className="text-zinc-500 text-[10px] uppercase block">Package</span>
                          <strong className="text-white">{ord.network} &bull; {ord.capacity || ord.package_size}</strong>
                        </div>
                        <div>
                          <span className="text-zinc-500 text-[10px] uppercase block">Recipient</span>
                          <strong className="text-white font-mono">{ord.recipient_phone || ord.phone}</strong>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-zinc-500 pt-1 border-t border-white/5">
                        <span>{ord.created_at ? new Date(ord.created_at).toLocaleString("en-GB") : ""}</span>
                        <span className="text-cyan-400 font-bold group-hover:underline">View Live Timeline →</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {waHref && (
            <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs">
              <span className="text-zinc-400">Questions about your order?</span>
              <a
                href={waHref}
                target="_blank"
                rel="noreferrer"
                className="text-emerald-400 font-bold hover:underline flex items-center gap-1"
              >
                <MessageCircle className="size-3.5" />
                <span>Chat with {store.store_name}</span>
              </a>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Checkout Modal for Data Bundles */}
      {selectedProduct && checkoutOpen && (
        <CheckoutDialog
          onOpenChange={(open) => {
            setCheckoutOpen(open);
            if (!open) {
              setSelectedProduct(null);
              setIsFlashSaleCheckout(false);
            }
          }}
          product={selectedProduct}
          isFlashSale={isFlashSaleCheckout || Boolean((selectedProduct as any)?.is_flash_sale)}
          agentId={store.id}
          storeName={store.store_name}
        />
      )}

      {/* Checkout Modal for Other Services (Netflix, AFA, Mashup) */}
      <ServiceCheckoutDialog
        service={selectedService}
        netflixPrice={getServicePrice("service-netflix", 30)}
        afaPrice={getServicePrice("service-afa", 20)}
        mashupPrice={getServicePrice("service-mashup", 25)}
        agentId={store.id}
        agentSlug={store.store_slug}
        onOpenChange={(open) => !open && setSelectedService(null)}
      />

      {/* Checkout Modal for Result Checkers (WAEC, BECE) */}
      <CheckerCheckoutDialog
        checker={selectedChecker}
        agentId={store.id}
        agentSlug={store.store_slug}
        onOpenChange={(open) => !open && setSelectedChecker(null)}
      />

      {/* Post-Payment Order Confirmation Modal */}
      <Dialog open={orderModalOpen} onOpenChange={setOrderModalOpen}>
        <DialogContent className="sm:max-w-md bg-zinc-950/95 border border-cyan-500/30 text-white backdrop-blur-2xl p-6 rounded-3xl shadow-[0_10px_50px_rgba(6,182,212,0.25)]">
          <DialogHeader className="text-center space-y-2">
            <div className={`size-14 rounded-2xl ${placedOrder?.payment_status === "failed" ? "bg-amber-500/20 border-amber-500/40 text-amber-400" : "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"} border flex items-center justify-center mx-auto shadow-[0_0_25px_rgba(16,185,129,0.3)]`}>
              {verifyingOrder ? (
                <Loader2 className="size-7 animate-spin text-cyan-400" />
              ) : placedOrder?.payment_status === "failed" ? (
                <AlertCircle className="size-7 text-amber-400" />
              ) : (
                <CheckCircle2 className="size-7 text-emerald-400" />
              )}
            </div>
            <DialogTitle className="text-xl sm:text-2xl font-black tracking-tight text-white">
              {verifyingOrder
                ? "Confirming Order..."
                : placedOrder?.payment_status === "failed"
                  ? "Payment Incomplete / Failed"
                  : "Order Placed Successfully! 🎉"}
            </DialogTitle>
            <p className="text-xs text-zinc-400">
              {store?.store_name} &bull; {placedOrder?.payment_status === "failed" ? "Mobile Money Payment Issue" : "Instant Automated Delivery"}
            </p>
          </DialogHeader>

          <div className="space-y-3.5 mt-2">
            {/* Status Banner */}
            <div className={`p-3.5 rounded-2xl ${placedOrder?.payment_status === "failed" ? "bg-amber-500/10 border-amber-500/30" : "bg-cyan-500/10 border-cyan-500/30"} border flex items-center justify-between`}>
              <div className="flex items-center gap-2">
                <span className={`size-2 rounded-full ${placedOrder?.payment_status === "failed" ? "bg-amber-400" : "bg-emerald-400 animate-ping"}`} />
                <span className={`text-xs font-bold ${placedOrder?.payment_status === "failed" ? "text-amber-300" : "text-cyan-300"}`}>
                  {placedOrder?.payment_status === "failed"
                    ? "Payment Incomplete (Low Balance / Declined)"
                    : String(placedOrder?.reference || incomingRef || "").startsWith("NF")
                      ? "Netflix Order Confirmed"
                      : String(placedOrder?.reference || incomingRef || "").startsWith("CK")
                        ? "Result Checker Delivered"
                        : placedOrder?.delivery_status === "delivered" || placedOrder?.delivery_status === "completed"
                          ? "Delivered Successfully"
                          : "Sent to Delivery Gateway"}
                </span>
              </div>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md font-bold uppercase ${placedOrder?.payment_status === "failed" ? "bg-amber-500/20 text-amber-300 border border-amber-500/40" : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"}`}>
                {placedOrder?.payment_status === "failed" ? "FAILED" : "PAID"}
              </span>
            </div>

            {/* Error explanation for failed payment */}
            {placedOrder?.payment_status === "failed" && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 leading-relaxed">
                {placedOrder?.error_message || "Your payment could not complete due to low MoMo wallet balance or timeout. Please top up your wallet and tap retry below."}
              </div>
            )}

            {/* NETFLIX CODE BOX (IF NETFLIX ORDER) */}
            {(String(placedOrder?.reference || incomingRef || "").startsWith("NF") ||
              placedOrder?.service === "netflix" ||
              storeNetflixCode) && (
                <div className="p-4 rounded-2xl bg-gradient-to-br from-red-950/40 via-zinc-900 to-black border border-red-500/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-black tracking-wider text-red-400 flex items-center gap-1">
                      <Play className="size-3 fill-red-400" /> Netflix Sign-In Code
                    </span>
                    {storeNetflixCodeAt && (
                      <span className="text-[10px] font-mono text-zinc-500">
                        {new Date(storeNetflixCodeAt).toLocaleTimeString("en-GB")}
                      </span>
                    )}
                  </div>

                  {/* Account Email */}
                  <div className="p-2.5 rounded-xl bg-black/60 border border-white/10 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-zinc-500 uppercase block font-semibold">Account Email</span>
                      <span className="text-xs font-mono font-bold text-white break-all">{storeNetflixEmail}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(storeNetflixEmail);
                        toast.success("Netflix email copied!");
                      }}
                      className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white"
                    >
                      <Copy className="size-3.5" />
                    </button>
                  </div>

                  {/* Big Code Box */}
                  <div className="p-3.5 rounded-xl bg-black/80 border border-red-500/30 text-center">
                    <span className="text-[10px] uppercase font-bold text-zinc-400 block mb-1">
                      Temporary 8-Digit TV Code
                    </span>
                    {(storeNetflixCode || placedOrder?.netflix_last_code) ? (
                      <div className="flex items-center justify-center gap-3">
                        <div className="text-3xl font-mono font-black tracking-widest text-white">
                          {storeNetflixCode || placedOrder?.netflix_last_code}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const c = storeNetflixCode || placedOrder?.netflix_last_code;
                            if (c) navigator.clipboard.writeText(c);
                            setCopiedNetflixCode(true);
                            setTimeout(() => setCopiedNetflixCode(false), 2000);
                            toast.success("Netflix code copied!");
                          }}
                          className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white"
                        >
                          {copiedNetflixCode ? <Check className="size-4 text-emerald-400" /> : <Copy className="size-4" />}
                        </button>
                      </div>
                    ) : fetchingStoreNetflix ? (
                      <div className="py-2 flex items-center justify-center gap-2 text-xs text-zinc-400">
                        <Loader2 className="size-4 animate-spin text-red-500" />
                        <span>Retrieving code from Gmail...</span>
                      </div>
                    ) : (
                      <div className="py-1 text-xs text-zinc-400">
                        Code not generated yet. Request it on your TV, then click Fetch below.
                      </div>
                    )}
                  </div>

                  {storeNetflixError && (
                    <div className="text-[11px] text-red-400 bg-red-500/10 p-2 rounded-lg border border-red-500/20">
                      {storeNetflixError}
                    </div>
                  )}

                  <Button
                    type="button"
                    size="sm"
                    onClick={() => fetchStoreNetflixCode(placedOrder?.reference || incomingRef || "", true)}
                    disabled={fetchingStoreNetflix}
                    className="w-full h-9 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:opacity-95 text-white font-black text-xs gap-1.5 shadow-md shadow-red-600/20"
                  >
                    {fetchingStoreNetflix ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
                    <span>{fetchingStoreNetflix ? "Checking Gmail..." : "Fetch Latest Code Live"}</span>
                  </Button>

                  <p className="text-[11px] text-zinc-400 leading-snug">
                    Go to <strong className="text-red-400">netflix.com/tv8</strong> on your browser and enter this code to link your TV screen.
                  </p>
                </div>
              )}

            {/* CHECKER SERIAL & PIN (IF CHECKER ORDER) */}
            {(String(placedOrder?.reference || incomingRef || "").startsWith("CK") || checkerResult) && (
              <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-950/40 via-zinc-900 to-black border border-blue-500/40 space-y-3">
                <span className="text-[10px] uppercase font-black tracking-wider text-blue-400 flex items-center gap-1">
                  <GraduationCap className="size-3.5" /> Result Checker Card Credentials
                </span>

                <div className="p-3 rounded-xl bg-black/60 border border-white/10 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-400">Serial Number:</span>
                    <button
                      type="button"
                      onClick={() => {
                        const s = checkerResult?.serial || placedOrder?.serial || "";
                        if (s) {
                          navigator.clipboard.writeText(s);
                          setCopiedSerial(true);
                          setTimeout(() => setCopiedSerial(false), 2000);
                          toast.success("Serial copied!");
                        }
                      }}
                      className="font-mono font-bold text-white flex items-center gap-1 hover:text-cyan-300"
                    >
                      <span>{checkerResult?.serial || placedOrder?.serial || "Generating..."}</span>
                      {copiedSerial ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3 text-zinc-400" />}
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1 border-t border-white/5">
                    <span className="text-zinc-400">Card PIN:</span>
                    <button
                      type="button"
                      onClick={() => {
                        const p = checkerResult?.pin || placedOrder?.pin || "";
                        if (p) {
                          navigator.clipboard.writeText(p);
                          setCopiedPin(true);
                          setTimeout(() => setCopiedPin(false), 2000);
                          toast.success("PIN copied!");
                        }
                      }}
                      className="font-mono font-bold text-emerald-400 flex items-center gap-1 hover:text-emerald-300"
                    >
                      <span>{checkerResult?.pin || placedOrder?.pin || "Generating..."}</span>
                      {copiedPin ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3 text-zinc-400" />}
                    </button>
                  </div>
                </div>

                <p className="text-[11px] text-zinc-400 leading-snug">
                  Use your Serial Number and PIN on the official WAEC direct results checking portal.
                </p>
              </div>
            )}

            {/* AFA REGISTRATION NOTICE (IF AFA ORDER) */}
            {String(placedOrder?.reference || incomingRef || "").startsWith("AF") && (
              <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-950/40 via-zinc-900 to-black border border-emerald-500/40 space-y-2.5">
                <span className="text-[10px] uppercase font-black tracking-wider text-emerald-400 flex items-center gap-1">
                  <IdCard className="size-3.5" /> AFA Registration Details
                </span>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  Your payment is confirmed. Please send your full name and Ghana Card number via WhatsApp to finalize your registration.
                </p>
                {waHref && (
                  <a
                    href={`${waHref}&text=${encodeURIComponent(
                      `Hello, I just paid for AFA Registration with Order Ref: ${placedOrder?.reference || incomingRef}`
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full h-9 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <MessageCircle className="size-3.5" />
                    <span>Complete on WhatsApp</span>
                  </a>
                )}
              </div>
            )}

            {/* Standard Order Details Card */}
            <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">Order Reference</span>
                <button
                  type="button"
                  onClick={() => {
                    const ref = placedOrder?.reference || incomingRef || "";
                    if (ref) {
                      navigator.clipboard.writeText(ref);
                      setCopiedRef(true);
                      setTimeout(() => setCopiedRef(false), 2000);
                      toast.success("Reference copied!");
                    }
                  }}
                  className="font-mono font-bold text-cyan-300 hover:text-cyan-200 flex items-center gap-1.5 transition-colors"
                >
                  <span>{placedOrder?.reference || incomingRef}</span>
                  {copiedRef ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3 text-zinc-400" />}
                </button>
              </div>

              {(placedOrder?.network || placedOrder?.package_size) && (
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Service / Package</span>
                  <span className="font-bold text-white">
                    {placedOrder.network ? `${placedOrder.network} ` : ""}
                    {placedOrder.capacity ? `${placedOrder.capacity}GB Data` : placedOrder.package_size || "Service"}
                  </span>
                </div>
              )}

              {(placedOrder?.recipient_phone || placedOrder?.phone) && (
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Phone Number</span>
                  <span className="font-mono font-bold text-white">
                    {placedOrder.recipient_phone || placedOrder.phone}
                  </span>
                </div>
              )}

              {placedOrder?.amount && (
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Amount Paid</span>
                  <span className="font-bold text-emerald-400">
                    GH₵ {Number(placedOrder.amount).toFixed(2)}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between pt-1 border-t border-white/10">
                <span className="text-zinc-400">Status</span>
                <span className="font-semibold capitalize text-amber-300">
                  {placedOrder?.delivery_status === "delivered" || placedOrder?.delivery_status === "completed"
                    ? "Delivered"
                    : placedOrder?.delivery_status || "Completed"}
                </span>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setOrderModalOpen(false);
                  if (placedOrder?.reference || incomingRef) {
                    setTrackQuery(placedOrder?.reference || incomingRef || "");
                    setTrackOpen(true);
                    handleTrackOrder();
                  }
                }}
                className="flex-1 rounded-xl border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 text-xs font-bold h-10"
              >
                Track Live Status
              </Button>
              <Button
                type="button"
                onClick={() => setOrderModalOpen(false)}
                className="flex-1 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 hover:opacity-90 text-black font-black text-xs h-10"
              >
                Done / Buy More
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* WhatsApp Channel Info / Join Modal */}
      <Dialog open={channelModalOpen} onOpenChange={setChannelModalOpen}>
        <DialogContent className="max-w-md bg-zinc-950 border border-purple-500/30 text-white rounded-3xl p-6 shadow-2xl">
          <DialogHeader className="space-y-2 text-center">
            <div className="size-12 rounded-2xl bg-purple-500/20 border border-purple-500/40 text-purple-300 flex items-center justify-center mx-auto">
              <Users className="size-6" />
            </div>
            <DialogTitle className="text-lg font-black text-white">
              {store.store_name}'s WhatsApp Channel
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              Stay connected with exclusive promo bundles, network speed alerts, and flash sales!
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {channelGroupUrl ? (
              <a
                href={channelGroupUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full h-11 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md"
              >
                <Users className="size-4" />
                <span>Join Official WhatsApp Channel</span>
              </a>
            ) : (
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 text-center space-y-3">
                <p className="text-xs text-zinc-300 leading-relaxed">
                  The official invite link for <strong>{store.store_name}</strong> will be updated soon. In the meantime, you can reach out directly via customer support on WhatsApp:
                </p>
                {customerSupportWaUrl && (
                  <a
                    href={customerSupportWaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-sm"
                  >
                    <MessageCircle className="size-3.5" />
                    <span>Chat with {store.store_name}</span>
                  </a>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Customer Announcement Pop-Up Dialog */}
      {store && (
        <AgentStoreAnnouncementModal
          open={announcementPopupOpen}
          onOpenChange={(open) => {
            setAnnouncementPopupOpen(open);
            if (!open && store?.id) {
              try {
                sessionStorage.setItem(`data1_agent_popup_dismissed_${store.id}`, "true");
              } catch (_) { }
            }
          }}
          title={
            store.announcement_popup_title ||
            (store.announcement ? `${store.store_name} Special Announcement` : undefined)
          }
          message={store.announcement_popup_message || store.announcement}
          badge={
            store.announcement_popup_badge ||
            (store.announcement_type === "warning" ? "⚠️ Store Notice" : "⚡ Special Announcement")
          }
          ctaText={store.announcement_popup_cta_text || "Shop Bundles Now"}
          ctaUrl={store.announcement_popup_cta_url}
          storeName={store.store_name}
          logoUrl={store.logo_url}
          themeId={store.store_theme}
        />
      )}

      {/* Social Media Boost Order Dialog */}
      <SocialBoostDialog
        open={boostDialogOpen}
        onOpenChange={setBoostDialogOpen}
        agentId={store?.id}
        agentSlug={store?.store_slug}
      />
    </div>
  );
};

export default AgentStorefront;
