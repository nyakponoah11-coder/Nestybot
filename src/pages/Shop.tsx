import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { fetchShopDataCached, getCachedShopData, invalidateShopCache } from "@/lib/storeCache";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { NETWORK_ORDER, NETWORK_LABEL, DEFAULT_PRODUCTS } from "@/lib/networks";
import { NetworkLogo } from "@/components/NetworkLogo";
import { Loader2, Zap, ShieldCheck, MessageCircle, Search, Sparkles, Wallet, Clock, BarChart3, Receipt, Download, Smartphone, Bot, RotateCcw, Flame } from "lucide-react";
import { toast } from "sonner";
import { AnnouncementModal } from "@/components/AnnouncementModal";
import { ReferralRegisterDialog } from "@/components/ReferralRegisterDialog";
import { SpinGameDialog } from "@/components/SpinGameDialog";
import { FreeDataDialog } from "@/components/FreeDataDialog";
import { InstallAppModal } from "@/components/InstallAppModal";
import { SocialProofPopup } from "@/components/SocialProofPopup";
import { SocialProofMarquee } from "@/components/SocialProofMarquee";
import { formatWhatsAppBotUrl } from "@/lib/whatsapp";
import { isAppInstalled } from "@/utils/appInstall";
import { CheckoutDialog } from "@/components/CheckoutDialog";
import { VoiceCallAssistant } from "@/components/VoiceCallAssistant";
import { Mic, Gift, PhoneCall, Film } from "lucide-react";
import shopBgMp4 from "@/assets/shop-bg.mp4";
import shopBgWebm from "@/assets/shop-bg.webm";
import { AgentPromoModal } from "@/components/AgentPromoModal";
import ArcadeSection from "@/components/ArcadeSection";
import { SiteMenuDrawer } from "@/components/SiteMenuDrawer";
import { StoreGuideNote } from "@/components/StoreGuideNote";
import { Menu } from "lucide-react";


interface Product {
  id: string; network: string; capacity: string; mb: number;
  price: number; name: string | null; in_stock: boolean; sort_order: number;
}

const normalizeWhatsApp = (raw: string) => {
  if (!raw) return { display: null as string | null, href: null as string | null };
  const trimmed = raw.trim();
  if (trimmed.startsWith("http")) return { display: trimmed, href: trimmed };
  let digits = trimmed.replace(/\D/g, "");
  if (digits.startsWith("0") && digits.length === 10) digits = "233" + digits.slice(1);
  else if (digits.length === 9) digits = "233" + digits;
  const display = digits.startsWith("233") && digits.length === 12
    ? `+233 ${digits.slice(3, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`
    : digits;
  return { display, href: `https://wa.me/${digits}` };
};

const LiveClock = () => {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const dateStr = now.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  const timeStr = now.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <div className="flex items-center gap-1.5 sm:gap-2 rounded-full bg-emerald-950/80 border border-emerald-500/40 px-2.5 sm:px-3 py-1.5 shadow-sm">
      <span className="relative flex size-2 shrink-0">
        <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
        <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
      </span>
      <span className="text-[11px] sm:text-xs font-semibold text-emerald-300/90 whitespace-nowrap">
        {dateStr}
      </span>
      <span className="text-[10px] text-emerald-500 font-bold hidden sm:inline">·</span>
      <span className="text-[11px] sm:text-xs font-mono font-bold text-white tabular-nums drop-shadow-sm tracking-wide whitespace-nowrap">
        {timeStr}
      </span>
    </div>
  );
};


const Shop = () => {
  const navigate = useNavigate();
  const initialCache = getCachedShopData();
  const [products, setProducts] = useState<Product[]>(() => (initialCache?.products as Product[]) || (DEFAULT_PRODUCTS as Product[]));
  const [loading, setLoading] = useState(!initialCache);
  const [shopName, setShopName] = useState(initialCache?.settings?.shop_name || "Data Shop");
  const [whatsappBotUrl, setWhatsappBotUrl] = useState(initialCache?.settings?.whatsapp_bot_url || "");
  const [whatsappUrl, setWhatsappUrl] = useState(initialCache?.settings?.whatsapp_channel_url || "");
  const [whatsappChannelUrl, setWhatsappChannelUrl] = useState(initialCache?.settings?.whatsapp_channel_url || "");
  const [supportChatUrl, setSupportChatUrl] = useState(initialCache?.settings?.support_chat_url || "");
  const [announcement, setAnnouncement] = useState({
    enabled: initialCache?.settings?.announcement_enabled === "true",
    title: initialCache?.settings?.announcement_title || "",
    message: initialCache?.settings?.announcement_message || "",
  });
  const [activeNetwork, setActiveNetwork] = useState<string>("MTN");
  const [selected, setSelected] = useState<Product | null>(null);
  const [chatUnread, setChatUnread] = useState(0);
  const [aiChatOpen, setAiChatOpen] = useState(false);
  const [referralOpen, setReferralOpen] = useState(false);
  const [spinOpen, setSpinOpen] = useState(false);
  const [spinEnabled, setSpinEnabled] = useState(false);
  const [freeDataOpen, setFreeDataOpen] = useState(false);
  const [freeDataEnabled, setFreeDataEnabled] = useState(
    () => initialCache?.settings?.free_data_enabled === "true"
  );
  const [appModalOpen, setAppModalOpen] = useState(false);
  const [voiceAssistantOpen, setVoiceAssistantOpen] = useState(false);
  const [voicePhone, setVoicePhone] = useState("");
  const [apkUrl, setApkUrl] = useState("");
  const [appInstalled, setAppInstalled] = useState(isAppInstalled());
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [agentPromoOpen, setAgentPromoOpen] = useState(false);

  // Flash Sale States
  const [flashSaleEnabled, setFlashSaleEnabled] = useState(() => {
    if (typeof window !== "undefined") {
      const local = localStorage.getItem("data1gh_flash_sale_enabled");
      if (local !== null) return local === "true";
    }
    return initialCache?.settings?.flash_sale_enabled === "true";
  });
  const [flashSaleEndTime, setFlashSaleEndTime] = useState(() => {
    if (typeof window !== "undefined") {
      const local = localStorage.getItem("data1gh_flash_sale_end_time");
      if (local) return local;
    }
    return initialCache?.settings?.flash_sale_end_time || "";
  });
  const [flashSaleTitle, setFlashSaleTitle] = useState(() => {
    if (typeof window !== "undefined") {
      const local = localStorage.getItem("data1gh_flash_sale_title");
      if (local) return local;
    }
    return initialCache?.settings?.flash_sale_title || "⚡ LIMITED TIME MTN FLASH SALE ⚡";
  });
  const [flashSaleNotice, setFlashSaleNotice] = useState(() => {
    if (typeof window !== "undefined") {
      const local = localStorage.getItem("data1gh_flash_sale_notice");
      if (local) return local;
    }
    return initialCache?.settings?.flash_sale_notice || "Exclusive discounted MTN bundles! Grab yours before time runs out.";
  });
  const [ordersPaused, setOrdersPaused] = useState<boolean>(() => {
    return initialCache?.settings?.orders_paused === "true";
  });
  const [ordersPauseMessage, setOrdersPauseMessage] = useState<string>(() => {
    return initialCache?.settings?.orders_pause_message || "";
  });
  const [flashSaleProducts, setFlashSaleProducts] = useState<any[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const local = localStorage.getItem("data1gh_flash_sale_products");
        if (local) {
          const parsed = JSON.parse(local);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch (_) {}
    }
    try {
      if (initialCache?.settings?.flash_sale_products) {
        return JSON.parse(initialCache.settings.flash_sale_products);
      }
    } catch (_) {}
    return [
      { id: "fs-1", network: "MTN", capacity: "1", mb: 1000, price: 4.5, in_stock: true },
      { id: "fs-2", network: "MTN", capacity: "2", mb: 2000, price: 8.5, in_stock: true },
      { id: "fs-3", network: "MTN", capacity: "3", mb: 3000, price: 12.5, in_stock: true },
      { id: "fs-4", network: "MTN", capacity: "4", mb: 4000, price: 16.5, in_stock: true },
      { id: "fs-5", network: "MTN", capacity: "5", mb: 5000, price: 20.0, in_stock: true },
      { id: "fs-6", network: "MTN", capacity: "6", mb: 6000, price: 24.5, in_stock: true },
      { id: "fs-8", network: "MTN", capacity: "8", mb: 8000, price: 32.5, in_stock: true },
      { id: "fs-10", network: "MTN", capacity: "10", mb: 10000, price: 40.0, in_stock: true },
      { id: "fs-15", network: "MTN", capacity: "15", mb: 15000, price: 60.0, in_stock: true },
      { id: "fs-20", network: "MTN", capacity: "20", mb: 20000, price: 78.0, in_stock: true },
      { id: "fs-25", network: "MTN", capacity: "25", mb: 25000, price: 98.0, in_stock: true },
      { id: "fs-30", network: "MTN", capacity: "30", mb: 30000, price: 118.0, in_stock: true },
      { id: "fs-40", network: "MTN", capacity: "40", mb: 40000, price: 156.0, in_stock: true },
      { id: "fs-50", network: "MTN", capacity: "50", mb: 50000, price: 195.0, in_stock: true },
      { id: "fs-100", network: "MTN", capacity: "100", mb: 100000, price: 380.0, in_stock: true },
    ];
  });
  const [isFlashSaleCheckout, setIsFlashSaleCheckout] = useState(false);

  // Real-time flash sale countdown ticker
  const [shopNow, setShopNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setShopNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const isFlashSaleActive = useMemo(() => {
    // If explicitly turned off, Flash Sale is NEVER active
    if (!flashSaleEnabled) return false;
    if (!flashSaleEndTime) return false;
    const endMs = new Date(flashSaleEndTime).getTime();
    return !isNaN(endMs) && endMs > shopNow;
  }, [flashSaleEnabled, flashSaleEndTime, shopNow]);

  const flashSaleCountdown = useMemo(() => {
    if (!flashSaleEndTime) return { hours: "00", mins: "00", secs: "00", isExpired: true };
    const endMs = new Date(flashSaleEndTime).getTime();
    const diff = endMs - shopNow;
    if (isNaN(diff) || diff <= 0) return { hours: "00", mins: "00", secs: "00", isExpired: true };
    const h = Math.floor(diff / (1000 * 60 * 60)).toString().padStart(2, "0");
    const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)).toString().padStart(2, "0");
    const s = Math.floor((diff % (1000 * 60)) / 1000).toString().padStart(2, "0");
    return { hours: h, mins: m, secs: s, isExpired: false };
  }, [flashSaleEndTime, shopNow]);

  useEffect(() => {
    if (!sessionStorage.getItem("data1_agent_promo_seen")) {
      const timer = setTimeout(() => {
        setAgentPromoOpen(true);
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    const handleVoice = () => setVoiceAssistantOpen(true);
    window.addEventListener("open-voice-assistant", handleVoice);
    return () => window.removeEventListener("open-voice-assistant", handleVoice);
  }, []);

  const [promoEnabled, setPromoEnabled] = useState(true);
  const [netflixPrice, setNetflixPrice] = useState(30);
  const [afaPrice, setAfaPrice] = useState(20);
  const botHref = useMemo(() => formatWhatsAppBotUrl(whatsappBotUrl || whatsappUrl), [whatsappBotUrl, whatsappUrl]);
  const tickerHref = useMemo(() => {
    if (botHref.includes("?text=") || botHref.includes("&text=")) return botHref;
    return botHref.includes("?") ? `${botHref}&text=hi` : `${botHref}?text=hi`;
  }, [botHref]);
  const channelHref = useMemo(() => {
    const raw = (whatsappChannelUrl || whatsappUrl || "").trim();
    if (!raw) return botHref;
    if (/^https?:\/\//i.test(raw)) return raw;
    if (raw.startsWith("whatsapp.com") || raw.startsWith("chat.whatsapp.com")) return `https://${raw}`;
    return formatWhatsAppBotUrl(raw);
  }, [whatsappChannelUrl, whatsappUrl, botHref]);
  const { display: waDisplay, href: waHref } = useMemo(() => normalizeWhatsApp(whatsappUrl), [whatsappUrl]);

  // Capture incoming ?ref= so we can pre-fill on PaymentCallback later
  useEffect(() => {
    const url = new URL(window.location.href);
    const r = url.searchParams.get("ref");
    if (r) localStorage.setItem("incoming_ref", r.toUpperCase());
  }, []);

  // Spin & win game — auto-opens only when enabled by admin
  useEffect(() => {
    if (!spinEnabled) {
      setSpinOpen(false);
      return;
    }
    const nextSpinTime = Number(localStorage.getItem("spin_next_available") || 0);
    if (Date.now() < nextSpinTime) {
      return; // Under 4-hour cooldown after Try Again
    }
    const alreadySeen = sessionStorage.getItem("spin_popup_shown");
    if (!alreadySeen) {
      const t = setTimeout(() => {
        setSpinOpen(true);
        sessionStorage.setItem("spin_popup_shown", "true");
      }, 1500);
      return () => clearTimeout(t);
    }
  }, [spinEnabled]);



  useEffect(() => {
    const h = (e: Event) => setChatUnread((e as CustomEvent).detail ?? 0);
    const openChatHandler = () => setAiChatOpen(true);
    window.addEventListener("support-unread", h);
    window.addEventListener("open-support-chat", openChatHandler);
    window.addEventListener("open-ai-chat", openChatHandler);
    return () => {
      window.removeEventListener("support-unread", h);
      window.removeEventListener("open-support-chat", openChatHandler);
      window.removeEventListener("open-ai-chat", openChatHandler);
    };
  }, []);

  useEffect(() => {
    const handleOpenApp = () => setAppModalOpen(true);
    const handleAppInstalled = () => setAppInstalled(true);
    window.addEventListener("open-app-download", handleOpenApp);
    window.addEventListener("data1gh-app-installed", handleAppInstalled);
    window.addEventListener("appinstalled", handleAppInstalled);
    return () => {
      window.removeEventListener("open-app-download", handleOpenApp);
      window.removeEventListener("data1gh-app-installed", handleAppInstalled);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  useEffect(() => {
    document.title = `${shopName} – Buy MTN, Telecel & AirtelTigo Data`;
  }, [shopName]);

  useEffect(() => {
    let cancelled = false;

    const load = async (force = false) => {
      try {
        const { products: prods, settings: map } = await fetchShopDataCached({ forceRefresh: force });
        if (cancelled) return;

        setProducts(prods as Product[]);
        if (map.shop_name) setShopName(map.shop_name);
        if (map.whatsapp_bot_url) setWhatsappBotUrl(map.whatsapp_bot_url);
        if (map.whatsapp_channel_url) {
          setWhatsappChannelUrl(map.whatsapp_channel_url);
          setWhatsappUrl(map.whatsapp_channel_url);
        }
        setSupportChatUrl(map.support_chat_url || map.whatsapp_channel_url || "");
        setAnnouncement({
          enabled: map.announcement_enabled === "true",
          title: map.announcement_title || "",
          message: map.announcement_message || "",
        });
        setPromoEnabled(map.promo_enabled !== "false");
        setSpinEnabled(map.spin_game_enabled === "true");
        setFreeDataEnabled(map.free_data_enabled === "true");
        if (map.apk_download_url) setApkUrl(map.apk_download_url);
        const np = Number(map.netflix_price);
        if (!isNaN(np) && np > 0) setNetflixPrice(np);
        else setNetflixPrice(30);

        const ap = Number(map.afa_price);
        if (!isNaN(ap) && ap > 0) setAfaPrice(ap);
        else setAfaPrice(20);

        if (map.orders_paused !== undefined) setOrdersPaused(map.orders_paused === "true");
        if (map.orders_pause_message !== undefined) setOrdersPauseMessage(map.orders_pause_message);
        if (map.flash_sale_enabled !== undefined) setFlashSaleEnabled(map.flash_sale_enabled === "true");
        if (map.flash_sale_end_time) setFlashSaleEndTime(map.flash_sale_end_time);
        if (map.flash_sale_title) setFlashSaleTitle(map.flash_sale_title);
        if (map.flash_sale_notice) setFlashSaleNotice(map.flash_sale_notice);
        if (map.flash_sale_products) {
          try {
            const parsed = JSON.parse(map.flash_sale_products);
            if (Array.isArray(parsed) && parsed.length > 0) setFlashSaleProducts(parsed);
          } catch (_) {}
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    // Load from local storage session first; only contacts DB if cache is expired
    load(false);

    // Listen for manual cache bust or admin edits
    const handleInvalidate = () => {
      try {
        const local = localStorage.getItem("data1gh_flash_sale_enabled");
        if (local !== null) setFlashSaleEnabled(local === "true");
        const end = localStorage.getItem("data1gh_flash_sale_end_time");
        if (end) setFlashSaleEndTime(end);
      } catch (_) {}
      load(true);
    };
    window.addEventListener("shop-cache-invalidated", handleInvalidate);

    return () => {
      cancelled = true;
      window.removeEventListener("shop-cache-invalidated", handleInvalidate);
    };
  }, []);

  const grouped = (net: string) => products.filter(p => p.network === net);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good Morning";
    if (h < 17) return "Good Afternoon";
    return "Good Evening";
  })();

  return (
    <div className="dark relative min-h-screen bg-background/0 text-foreground">
      {/* Video background */}
      <video
        className="fixed inset-0 h-full w-full object-cover -z-10"
        autoPlay
        loop
        muted
        playsInline
        aria-hidden="true"
      >
        <source src={shopBgWebm} type="video/webm" />
        <source src={shopBgMp4} type="video/mp4" />
      </video>
      <div className="fixed inset-0 -z-10 bg-background/45" aria-hidden="true" />
      {/* Top nav */}
      <header className="sticky top-0 z-40 bg-background/70 backdrop-blur-xl border-b border-border/50 text-foreground">
        <div className="w-full px-4 py-3 flex items-center justify-between gap-2 sm:gap-4">
          <Link to="/" className="flex items-center gap-2.5 shrink-0 hover:opacity-90 transition-opacity">
            <img
              src="/logo.png"
              alt={shopName}
              className="size-9 rounded-xl object-contain bg-white p-1 border border-border/50 shadow-sm"
            />
            <span className="font-bold text-base sm:text-lg tracking-tight truncate max-w-[130px] sm:max-w-none">
              {shopName}
            </span>
          </Link>

          {/* Right: Live Date/Time + Menu button */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <LiveClock />

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsMenuOpen(prev => !prev)}
              aria-label={isMenuOpen ? "Close menu" : "Open menu"}
              className="h-9 px-3 rounded-xl border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-foreground font-bold gap-1.5 text-xs shadow-sm hover:border-emerald-400 active:scale-95 transition-all"
            >
              <Menu className="size-4 text-emerald-400" />
              <span className="font-black text-xs">Menu</span>
            </Button>
          </div>
        </div>
      </header>

      {/* WhatsApp order ticker */}
      <a
        href={tickerHref}
        target="_blank"
        rel="noreferrer"
        role="button"
        aria-label="Place your orders through WhatsApp"
        className="block w-full overflow-hidden relative text-white py-2.5 shadow-md animate-rainbow-shift focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white/70 cursor-pointer"
        style={{
          backgroundImage: "linear-gradient(115deg, #f43f5e, #f59e0b, #eab308, #22c55e, #3b82f6, #8b5cf6, #ec4899, #f43f5e)",
          backgroundSize: "300% 300%",
        }}
      >
        <div className="flex animate-marquee whitespace-nowrap">
          <span className="flex items-center gap-2 px-8">
            <MessageCircle className="size-4 shrink-0" />
            <span className="font-bold text-sm">Place your orders through our whatsapp bot easy with less data Tap here to send hi and get started</span>
          </span>
          <span className="flex items-center gap-2 px-8">
            <MessageCircle className="size-4 shrink-0" />
            <span className="font-bold text-sm">Place your orders through our whatsapp bot easy with less data Tap here to send hi and get started</span>
          </span>
        </div>
      </a>

      {/* Big channel CTA across the top */}
      <div className="w-full px-4 pt-4">
        <a
          href={channelHref}
          target="_blank"
          rel="noreferrer"
          role="button"
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-success text-success-foreground font-bold text-base md:text-lg py-4 shadow-glow hover:opacity-95 transition"
        >
          <MessageCircle className="size-5" /> Join our channel
        </a>
      </div>

      {/* Social Proof Marquee - Customer Reviews */}
      <SocialProofMarquee />

      {/* Hero greeting card */}
      <section className="w-full px-4 pt-4">
        <Card className="bg-gradient-gold border-0 text-accent-foreground p-6 md:p-8 rounded-3xl shadow-[0_20px_60px_-15px_hsl(45_100%_50%/0.55),0_8px_25px_-8px_hsl(45_100%_45%/0.45)] ring-1 ring-accent/30">
          <h1 className="text-3xl md:text-5xl font-black leading-tight">
            Akwaaba, welcome!
          </h1>
          <p className="mt-2 text-sm md:text-base font-medium opacity-90">
            {greeting}! Buy MTN, Telecel & AirtelTigo bundles in seconds.
          </p>
          <span className="inline-block mt-3 px-4 py-1.5 rounded-full bg-primary text-primary-foreground text-xs md:text-sm font-bold">
            Pay via MOMO or Card · Powered by Paystack
          </span>
          <div className="mt-5 grid grid-cols-3 gap-2 md:gap-3">
            <div className="rounded-xl bg-primary/90 text-primary-foreground px-3 py-2.5 flex items-center gap-2">
              <Zap className="size-4 text-accent" />
              <span className="text-xs md:text-sm font-semibold">Fast delivery</span>
            </div>
            <div className="rounded-xl bg-primary/90 text-primary-foreground px-3 py-2.5 flex items-center gap-2">
              <ShieldCheck className="size-4 text-accent" />
              <span className="text-xs md:text-sm font-semibold">Secure payment</span>
            </div>
            <div className="rounded-xl bg-primary/90 text-primary-foreground px-3 py-2.5 flex items-center gap-2">
              <span className="text-sm">📞</span>
              <span className="text-xs md:text-sm font-semibold">24/7 support</span>
            </div>
          </div>
        </Card>
      </section>

      {/* Bundles */}
      <main className="w-full px-4 py-8">
        <div className="grid grid-cols-2 gap-2.5 mb-4">
          <Button
            asChild
            variant="outline"
            className="h-12 rounded-xl border-2 border-accent/40 bg-gradient-card font-bold text-foreground hover:border-accent shadow-sm"
          >
            <Link to="/track">
              <Receipt className="size-4 mr-2 text-accent" /> Order History
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="h-12 rounded-xl border-2 border-border/70 bg-gradient-card font-bold text-foreground hover:border-accent shadow-sm"
          >
            <Link to="/track?tab=search">
              <Search className="size-4 mr-2 text-accent" /> Track Order
            </Link>
          </Button>
        </div>

        <ArcadeSection />

        {/* Mobile App Download Banner */}
        {!appInstalled && (
          <div className="mb-4 p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/15 via-primary/20 to-purple-500/15 border border-amber-500/30 flex items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-3 min-w-0">
              <div className="size-10 rounded-xl bg-white p-1 border border-border/50 shadow-sm flex items-center justify-center shrink-0">
                <img
                  src="/logo.png"
                  alt={shopName}
                  className="size-full object-contain rounded-lg"
                />
              </div>
              <div className="min-w-0">
                <div className="font-bold text-xs md:text-sm text-foreground flex items-center gap-1.5">
                  <span>{shopName} Mobile App</span>
                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-mono font-bold">Free</span>
                </div>
                <div className="text-[11px] text-muted-foreground truncate">
                  Faster orders, 1-tap checkout & live tracking.
                </div>
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={() => setAppModalOpen(true)}
              className="h-9 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-black font-extrabold text-xs shrink-0 shadow gap-1"
            >
              <Download className="size-3.5" />
              <span>Install App</span>
            </Button>
          </div>
        )}

        {ordersPaused && (
          <div className="mb-4 p-4 rounded-2xl bg-amber-500/15 border-2 border-amber-500/50 text-amber-200 shadow-lg flex items-center gap-3">
            <span className="text-2xl shrink-0">⏸️</span>
            <div>
              <h3 className="font-bold text-sm md:text-base text-amber-300">Orders Temporarily Paused</h3>
              <p className="text-xs text-amber-200/90 mt-0.5">
                {ordersPauseMessage || "We are currently restocking our data wallet and undergoing brief maintenance. New orders will resume shortly!"}
              </p>
            </div>
          </div>
        )}

        {isFlashSaleActive ? (
          /* ======================================================== */
          /* ⚡ FLASH SALE SHOWCASE (OVERRIDE DEFAULT SYSTEM)          */
          /* ======================================================== */
          <div className="space-y-5 animate-in fade-in-50 duration-300">
            {/* Flash Sale Hero Banner & Live Countdown */}
            <div className="relative overflow-hidden rounded-3xl border-2 border-amber-500/80 bg-gradient-to-br from-amber-500/20 via-card to-orange-500/20 p-5 md:p-6 shadow-[0_10px_40px_rgba(245,158,11,0.3)]">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="text-center md:text-left space-y-1.5">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider shadow-sm animate-pulse">
                    <Flame className="size-4 fill-slate-950" />
                    <span>Live Flash Sale</span>
                  </div>
                  <h2 className="text-xl md:text-3xl font-black text-foreground tracking-tight">
                    {flashSaleTitle}
                  </h2>
                  <p className="text-xs md:text-sm text-muted-foreground max-w-xl">
                    {flashSaleNotice}
                  </p>
                </div>

                {/* Countdown Timer Block */}
                <div className="flex items-center gap-2 bg-slate-950/80 border border-amber-500/40 px-4 py-3 rounded-2xl shadow-inner shrink-0">
                  <div className="flex flex-col items-center">
                    <span className="font-mono text-xl md:text-2xl font-black text-amber-400 tabular-nums">
                      {flashSaleCountdown.hours}
                    </span>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">Hours</span>
                  </div>
                  <span className="font-mono text-xl font-black text-amber-500">:</span>
                  <div className="flex flex-col items-center">
                    <span className="font-mono text-xl md:text-2xl font-black text-amber-400 tabular-nums">
                      {flashSaleCountdown.mins}
                    </span>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">Mins</span>
                  </div>
                  <span className="font-mono text-xl font-black text-amber-500">:</span>
                  <div className="flex flex-col items-center">
                    <span className="font-mono text-xl md:text-2xl font-black text-amber-400 tabular-nums">
                      {flashSaleCountdown.secs}
                    </span>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">Secs</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Flash Sale Bundles Grid (MTN Only) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {flashSaleProducts
                .filter((p) => p.in_stock !== false)
                .map((prod) => {
                  return (
                    <div
                      key={prod.id || prod.capacity}
                      className="group relative flex flex-col justify-between p-4 rounded-2xl border-2 border-amber-500/40 bg-card/90 hover:border-amber-400 hover:shadow-[0_8px_25px_rgba(245,158,11,0.25)] transition-all hover:-translate-y-0.5"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <NetworkLogo network="MTN" className="size-8 text-sm" />
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500 text-slate-950">
                          MTN
                        </span>
                      </div>

                      <div className="my-2">
                        <div className="text-xl md:text-2xl font-black font-mono text-foreground">
                          {prod.capacity} GB
                        </div>
                        <div className="flex items-baseline gap-1.5 mt-1">
                          <span className="text-base md:text-lg font-black font-mono text-amber-500">
                            GH₵ {Number(prod.price).toFixed(2)}
                          </span>
                          {prod.original_price && prod.original_price > prod.price && (
                            <span className="text-xs text-muted-foreground line-through font-mono">
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
                          setSelected({
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
                        }}
                        className="w-full mt-2 h-9 text-xs font-black rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 hover:opacity-95 shadow-md gap-1 disabled:opacity-50"
                      >
                        <Zap className="size-3.5 fill-slate-950" />
                        <span>{ordersPaused ? "Orders Paused" : "Buy Now"}</span>
                      </Button>
                    </div>
                  );
                })}
            </div>
          </div>
        ) : (
          /* ======================================================== */
          /* DEFAULT SYSTEM (NORMAL STORE NETWORK SELECTION)          */
          /* ======================================================== */
          <>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Select Network</span>
              <button
                type="button"
                onClick={() => {
                  invalidateShopCache();
                  toast.success("Checking latest bundle packages...");
                }}
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-1 px-2.5 rounded-lg hover:bg-muted/60 border border-transparent hover:border-border"
                title="Refresh bundle packages from network"
              >
                <RotateCcw className="size-3 text-accent" />
                <span>Refresh</span>
              </button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20"><Loader2 className="size-6 animate-spin" /></div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {NETWORK_ORDER.map(n => (
                  <Link
                    key={n}
                    to={`/network/${n}`}
                    className="flex flex-col items-center gap-3 py-5 rounded-2xl border-2 border-border bg-card/80 backdrop-blur-sm hover:border-accent hover:shadow-glow hover:-translate-y-0.5 transition-all"
                  >
                    <NetworkLogo network={n} className="size-16 md:size-20 text-3xl md:text-4xl" />
                    <span className="font-bold text-sm md:text-base">{NETWORK_LABEL[n]}</span>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}

        {/* Other services banner placed right under network cards */}
        <Link
          to="/services"
          className="group relative w-full mt-4 rounded-2xl p-[2px] block bg-gradient-to-r from-red-600 via-pink-500 to-emerald-500 shadow-[0_10px_40px_-10px_hsl(var(--primary)/0.5)] hover:-translate-y-0.5 transition-all"
        >
          <div className="relative flex items-center gap-3 rounded-[14px] bg-card/80 backdrop-blur-sm px-4 py-3.5 text-left">
            <div className="shrink-0 grid place-items-center size-11 rounded-full bg-gradient-to-br from-red-600 via-pink-500 to-emerald-500 text-white shadow-lg">
              <Sparkles className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-bold text-sm md:text-base">Other services</div>
              <div className="text-xs text-muted-foreground">Netflix, AFA registration & more</div>
            </div>
            <span className="shrink-0 text-xs font-bold text-accent-foreground bg-accent px-3 py-1.5 rounded-full">
              Open
            </span>
          </div>
        </Link>

        {/* Important Store Notice & Guide */}
        <StoreGuideNote storeName={shopName} supportPhone={waDisplay || undefined} whatsappLink={waHref || botHref || undefined} />

        {/* Why choose us */}
        <section className="mt-10">
          <h2 className="text-2xl md:text-3xl font-black text-center">Why Choose {shopName}</h2>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            We make buying data bundles fast, simple, and reliable
          </p>
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { icon: Zap, title: "Fast Delivery", desc: "Most bundles arrive within a few minutes. Failed orders are refunded.", tone: "from-amber-400 to-orange-500", interactive: false },
              { icon: ShieldCheck, title: "Secure Checkout", desc: "Payments processed securely via Paystack. Your details stay protected.", tone: "from-sky-400 to-blue-600", interactive: false },
              { icon: Wallet, title: "Genuinely Cheaper", desc: `${shopName} prices are much cheaper than buying direct from MTN, Telecel or AirtelTigo.`, tone: "from-emerald-400 to-green-600", interactive: false },
              { icon: MessageCircle, title: "Live Chat Support", desc: "Talk to our team right here in the app, any time.", tone: "from-pink-500 to-rose-500", interactive: true, action: () => window.dispatchEvent(new CustomEvent("open-support-chat")) },
              { icon: Clock, title: "24/7 Availability", desc: "Our platform is always online. Buy data bundles anytime, anywhere.", tone: "from-violet-500 to-purple-600", interactive: false },
              { icon: BarChart3, title: "Order Tracking", desc: "Track every order with your reference or phone number.", tone: "from-cyan-400 to-indigo-500", interactive: true, action: () => navigate("/track") },
            ].map(({ icon: Icon, title, desc, tone, interactive, action }) => {
              const content = (
                <>
                  <div className={`size-12 rounded-xl bg-gradient-to-br ${tone} text-white grid place-items-center shadow-lg`}>
                    <Icon className="size-5" />
                  </div>
                  <div className="mt-4 font-bold text-lg">{title}</div>
                  <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
                </>
              );
              if (interactive) {
                return (
                  <button
                    key={title}
                    type="button"
                    onClick={action}
                    className="text-left rounded-2xl border-2 border-border bg-card/80 backdrop-blur-sm p-5 hover:border-accent hover:shadow-glow hover:-translate-y-0.5 transition-all"
                  >
                    {content}
                  </button>
                );
              }
              return (
                <div
                  key={title}
                  className="rounded-2xl border-2 border-border bg-card/80 backdrop-blur-sm p-5 shadow-sm"
                >
                  {content}
                </div>
              );
            })}

          </div>
        </section>
      </main>


      <footer className="border-t mt-10">
        <div className="w-full px-4 py-6 text-sm text-muted-foreground flex flex-wrap items-center justify-between gap-3">
          <span>© 2020 {shopName}_Stony</span>
          <span>Powered by Paystack</span>
        </div>
      </footer>

      {/* Floating 24/7 Live Support Chat Button */}
      <aside aria-label="Live Customer Support" className="fixed bottom-6 right-5 z-40">
        <button
          type="button"
          onClick={() => {
            window.dispatchEvent(new CustomEvent("open-support-chat"));
            setAiChatOpen(true);
          }}
          className="group relative flex items-center justify-center size-14 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white shadow-xl hover:shadow-emerald-500/50 hover:scale-105 active:scale-95 transition-all duration-300 border border-emerald-400/40"
          title="Chat with 24/7 Live AI Support"
          aria-label="Open 24/7 Live Support Chat"
        >
          {/* Subtle pulse aura */}
          <span className="absolute -inset-1 rounded-full bg-emerald-400 opacity-30 animate-pulse pointer-events-none" />

          {/* WhatsApp / Support Chat Icon */}
          <MessageCircle className="size-7 fill-white text-emerald-500 transition-transform group-hover:scale-110" />

          {/* Red Alert / Notification Badge */}
          <span className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-gradient-to-tr from-rose-600 to-red-500 text-[11px] font-black text-white ring-2 ring-background shadow-md">
            !
          </span>
        </button>
      </aside>



      {/* Floating Free Data side button (middle of page edge) */}
      {freeDataEnabled && (
        <button
          type="button"
          onClick={() => setFreeDataOpen(true)}
          className="fixed right-0 top-1/2 -translate-y-1/2 z-40 flex items-center gap-2 rounded-l-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-white font-bold shadow-2xl shadow-orange-500/40 hover:shadow-orange-500/60 hover:-translate-x-1 transition-all duration-300 py-3 px-3.5 border-y border-l border-white/30 backdrop-blur-md group"
          title="Claim Free Data voucher"
          aria-label="Free Data"
        >
          <div className="size-7 rounded-full bg-white/20 grid place-items-center group-hover:scale-110 transition-transform">
            <Gift className="size-4 text-white animate-bounce" />
          </div>
          <div className="flex flex-col text-left leading-tight pr-0.5">
            <span className="text-[10px] uppercase font-black tracking-wider text-amber-200">Bonus</span>
            <span className="text-xs sm:text-sm font-extrabold whitespace-nowrap">Free Data</span>
          </div>
        </button>
      )}

      <SiteMenuDrawer
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        shopName={shopName}
        botHref={botHref}
        channelHref={channelHref}
        onPlayIntro={() => {
          setIntroForcePlay(true);
          setIntroActive(true);
        }}
        onOpenCall={() => setVoiceAssistantOpen(true)}
        onOpenSupport={() => {
          window.dispatchEvent(new CustomEvent("open-support-chat"));
          setAiChatOpen(true);
        }}
        onOpenReferral={() => setReferralOpen(true)}
        onOpenSpin={() => setSpinOpen(true)}
        spinEnabled={spinEnabled}
        onOpenFreeData={() => setFreeDataOpen(true)}
        freeDataEnabled={freeDataEnabled}
        onOpenAppDownload={() => setAppModalOpen(true)}
        appInstalled={appInstalled}
      />

      <AnnouncementModal enabled={announcement.enabled} title={announcement.title} message={announcement.message} />
      <ReferralRegisterDialog open={referralOpen} onOpenChange={setReferralOpen} />
      <SpinGameDialog open={spinOpen} onOpenChange={setSpinOpen} />
      <FreeDataDialog open={freeDataOpen} onOpenChange={setFreeDataOpen} />
      <InstallAppModal open={appModalOpen} onOpenChange={setAppModalOpen} apkUrl={apkUrl} shopName={shopName} />
      <SocialProofPopup />

      <VoiceCallAssistant
        open={voiceAssistantOpen}
        onOpenChange={setVoiceAssistantOpen}
        onSelectProductAndPhone={(prod, ph) => {
          setSelected(prod as Product);
          setVoicePhone(ph);
        }}
      />

      <CheckoutDialog
        product={selected}
        initialPhone={voicePhone}
        isFlashSale={isFlashSaleCheckout}
        onOpenChange={(o) => {
          if (!o) {
            setSelected(null);
            setVoicePhone("");
            setIsFlashSaleCheckout(false);
          }
        }}
      />

      {/* Agent Reseller Invitation Pop-up Modal */}
      <AgentPromoModal
        isOpen={agentPromoOpen}
        onClose={() => {
          setAgentPromoOpen(false);
          sessionStorage.setItem("data1_agent_promo_seen", "true");
        }}
      />

    </div>
  );
};

export default Shop;
