import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { invokeApiFunction } from "@/integrations/supabase/client";
import { invalidateCache, clearCachePrefix } from "@/lib/localCache";
import { AgentStoreAnnouncementModal } from "@/components/AgentStoreAnnouncementModal";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Store,
  Wallet,
  TrendingUp,
  Package,
  ShoppingBag,
  Clock,
  Calendar,
  ExternalLink,
  Copy,
  Check,
  Share2,
  LogOut,
  Loader2,
  Sparkles,
  ArrowRight,
  ArrowUpRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Search,
  MessageCircle,
  DollarSign,
  ChevronRight,
  Sliders,
  Filter,
  Menu,
  X,
  Radio,
  Truck,
  Upload,
  Image as ImageIcon,
  Users,
  Gift,
  Trash2,
  Palette,
  Crown,
  Eye,
  Play,
  Zap,
  IdCard,
  GraduationCap,
  Info,
  Megaphone,
  Bell,
  Volume2,
  Rocket,
} from "lucide-react";
import { toast } from "sonner";
import { formatGHS, NETWORK_LABEL, networkClass } from "@/lib/networks";
import { SocialPlatformIcon } from "@/components/SocialPlatformIcon";
import { DeliveryTracker } from "@/components/DeliveryTracker";

export interface StoreThemeOption {
  id: string;
  name: string;
  tagline: string;
  badge: string;
  primaryColor: string;
  secondaryColor: string;
  bgPreviewClass: string;
  cardBorder: string;
  accentText: string;
  btnGradient: string;
  description: string;
}

export const STORE_THEMES: StoreThemeOption[] = [
  {
    id: "cyber",
    name: "Cyber Neon",
    tagline: "High-Tech Electric Cyan & Emerald Glow",
    badge: "Futuristic",
    primaryColor: "#06B6D4",
    secondaryColor: "#10B981",
    bgPreviewClass: "bg-gradient-to-br from-cyan-950/80 via-zinc-950 to-black",
    cardBorder: "border-cyan-500/50 hover:border-cyan-400",
    accentText: "text-cyan-400",
    btnGradient: "from-cyan-400 to-emerald-400",
    description: "Electric cyan ambient lighting, glowing neon badges, and sharp obsidian contrast.",
  },
  {
    id: "gold",
    name: "Royal Luxury",
    tagline: "Noir Velvet & 24K Liquid Gold",
    badge: "VIP Prestige",
    primaryColor: "#F59E0B",
    secondaryColor: "#FBBF24",
    bgPreviewClass: "bg-gradient-to-br from-amber-950/80 via-[#100c06] to-black",
    cardBorder: "border-amber-500/50 hover:border-amber-400",
    accentText: "text-amber-400",
    btnGradient: "from-amber-400 via-yellow-400 to-amber-500",
    description: "Deep velvet noir with warm molten gold accents and royal champagne highlight glows.",
  },
  {
    id: "frost",
    name: "Frost Sapphire",
    tagline: "Nordic Glass & Royal Violet Aurora",
    badge: "Ultra Clean",
    primaryColor: "#A855F7",
    secondaryColor: "#6366F1",
    bgPreviewClass: "bg-gradient-to-br from-violet-950/80 via-[#0a0d1e] to-black",
    cardBorder: "border-violet-500/50 hover:border-violet-400",
    accentText: "text-violet-400",
    btnGradient: "from-violet-500 via-purple-500 to-indigo-500",
    description: "Frosted glass container reflections with sapphire and royal violet aurora ambient lighting.",
  },
  {
    id: "sunset",
    name: "Radiant Sunset",
    tagline: "Warm Coral Rose & Ruby Flame",
    badge: "Vibrant Energy",
    primaryColor: "#FB7185",
    secondaryColor: "#F43F5E",
    bgPreviewClass: "bg-gradient-to-br from-rose-950/80 via-[#12070e] to-black",
    cardBorder: "border-rose-500/50 hover:border-rose-400",
    accentText: "text-rose-400",
    btnGradient: "from-rose-500 via-pink-500 to-amber-400",
    description: "Fiery coral rose gradients, warm dusk twilight aura, and high-impact magenta buttons.",
  },
  {
    id: "emerald",
    name: "Midnight Emerald",
    tagline: "Lightning Mint & Jade Forest",
    badge: "Speed & Trust",
    primaryColor: "#10B981",
    secondaryColor: "#34D399",
    bgPreviewClass: "bg-gradient-to-br from-emerald-950/80 via-[#040e08] to-black",
    cardBorder: "border-emerald-500/50 hover:border-emerald-400",
    accentText: "text-emerald-400",
    btnGradient: "from-emerald-400 via-teal-400 to-emerald-300",
    description: "Deep jade midnight with lightning mint glows and clean eco-speed delivery telemetry.",
  },
];

interface AgentProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  store_name: string;
  store_slug: string;
  description?: string;
  whatsapp_number?: string;
  whatsapp_group_url?: string;
  logo_url?: string;
  store_theme?: string;
  momo_number?: string;
  momo_network?: string;
  momo_name?: string;
  wallet_balance?: number;
  walletBalance?: number;
  today_orders_count?: number;
  todayOrdersCount?: number;
  today_profit?: number;
  todayProfit?: number;
  total_profit?: number;
  totalProfit?: number;
  total_withdrawn?: number;
  totalWithdrawn?: number;
  pending_withdrawal?: number;
  custom_prices?: Record<string, number>;
  custom_domain?: string;
  announcement?: string;
  announcement_enabled?: boolean;
  announcement_type?: "promo" | "info" | "warning";
  announcement_popup_enabled?: boolean;
  announcement_popup_title?: string;
  announcement_popup_message?: string;
  announcement_popup_badge?: string;
  announcement_popup_cta_text?: string;
  announcement_popup_cta_url?: string;
}

export const AgentDashboard: React.FC = () => {
  const navigate = useNavigate();

  const [agent, setAgent] = useState<AgentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    "orders" | "bot_store" | "pricing" | "withdrawals" | "referrals" | "announcement" | "notifications" | "tracker" | "settings"
  >("orders");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Notification Center State
  const [notifPhone, setNotifPhone] = useState("");
  const [notifEnabled, setNotifEnabled] = useState(true);
  const [notifLogs, setNotifLogs] = useState<any[]>([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const [savingNotif, setSavingNotif] = useState(false);
  const [testingNotif, setTestingNotif] = useState(false);

  const loadNotificationSettings = async () => {
    if (!agent?.id) return;
    setNotifLoading(true);
    try {
      const res = await invokeApiFunction("agent", {
        body: { action: "getAgentNotificationSettings", agent_id: agent.id },
      });
      if (res?.data?.ok) {
        if (res.data.settings?.whatsapp_number) {
          setNotifPhone(res.data.settings.whatsapp_number);
        } else if (agent.whatsapp_number || agent.phone) {
          setNotifPhone(agent.whatsapp_number || agent.phone);
        }
        setNotifEnabled(res.data.settings?.enabled !== false);
        setNotifLogs(res.data.logs || []);
      }
    } catch (err) {
      console.error("Failed loading notification settings:", err);
    } finally {
      setNotifLoading(false);
    }
  };

  const saveNotificationSettings = async () => {
    if (!agent?.id) return;
    const clean = notifPhone.replace(/\D/g, "");
    if (notifEnabled && clean.length < 9) {
      toast.error("Please enter a valid WhatsApp phone number (e.g. 054XXXXXXX)");
      return;
    }
    setSavingNotif(true);
    try {
      const res = await invokeApiFunction("agent", {
        body: {
          action: "updateAgentNotificationSettings",
          agent_id: agent.id,
          whatsapp_number: clean,
          enabled: notifEnabled,
        },
      });
      if (res?.data?.ok) {
        toast.success("WhatsApp alert settings saved successfully!");
        setAgent((prev) => (prev ? { ...prev, whatsapp_number: clean } : null));
      } else {
        toast.error(res?.data?.error || "Failed to save notification settings");
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to save settings");
    } finally {
      setSavingNotif(false);
    }
  };

  const testNotificationAlert = async () => {
    if (!agent?.id) return;
    const clean = notifPhone.replace(/\D/g, "");
    if (clean.length < 9) {
      toast.error("Please enter a valid WhatsApp number to test.");
      return;
    }
    setTestingNotif(true);
    try {
      const res = await invokeApiFunction("agent", {
        body: {
          action: "testAgentNotification",
          agent_id: agent.id,
          whatsapp_number: clean,
        },
      });
      if (res?.data?.ok) {
        toast.success(res.data.message || "Test WhatsApp alert sent! Check your phone.");
        await loadNotificationSettings();
      } else {
        toast.error(res?.data?.error || "Could not dispatch WhatsApp alert.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Test alert failed");
    } finally {
      setTestingNotif(false);
    }
  };


  // Customer Referrals State
  const [customerReferrals, setCustomerReferrals] = useState<any[]>([]);
  const [referralStats, setReferralStats] = useState<{ total_promoters: number; total_referred_orders: number; total_completed_rewards: number }>({
    total_promoters: 0,
    total_referred_orders: 0,
    total_completed_rewards: 0,
  });
  const [referralsLoading, setReferralsLoading] = useState(false);
  const [referralSearch, setReferralSearch] = useState("");

  const loadCustomerReferrals = async () => {
    if (!agent?.id && !agent?.store_slug) return;
    setReferralsLoading(true);
    try {
      const res = await invokeApiFunction("agent", {
        body: {
          action: "getAgentCustomerReferrals",
          agent_id: agent?.id,
          agent_slug: agent?.store_slug,
        },
      });
      if (res?.data?.ok) {
        setCustomerReferrals(res.data.referrals || []);
        if (res.data.stats) setReferralStats(res.data.stats);
      }
    } catch (err) {
      console.error("Failed to load customer referrals:", err);
    } finally {
      setReferralsLoading(false);
    }
  };

  // Orders State
  const [orders, setOrders] = useState<any[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [dateFilter, setDateFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [networkFilter, setNetworkFilter] = useState<string>("all");
  const [deliveryFilter, setDeliveryFilter] = useState<string>("all");
  const [paymentFilter, setPaymentFilter] = useState<string>("all");
  const [copiedRef, setCopiedRef] = useState<string | null>(null);
  const [syncingOrderRef, setSyncingOrderRef] = useState<string | null>(null);
  const [orderStats, setOrderStats] = useState<{
    today_orders_count?: number;
    today_profit?: number;
    filtered_orders_count?: number;
    filtered_profit?: number;
    total_orders_count?: number;
  }>({});

  const copyOrderRef = async (ref: string) => {
    if (!ref) return;
    try {
      await navigator.clipboard.writeText(ref);
      setCopiedRef(ref);
      toast.success("Order reference copied!");
      setTimeout(() => setCopiedRef(null), 2000);
    } catch {
      toast.error("Could not copy reference");
    }
  };

  const syncOrderLive = async (o: any) => {
    const ref = o.reference || o.id;
    if (!ref) return;
    setSyncingOrderRef(ref);
    try {
      const res = await invokeApiFunction("track-order", {
        body: { reference: ref },
      });
      const updated = res?.data?.order;
      if (updated) {
        setOrders((prev) =>
          prev.map((item) =>
            item.reference === ref || item.id === ref
              ? {
                ...item,
                delivery_status: updated.delivery_status || item.delivery_status,
                payment_status: updated.payment_status || item.payment_status,
                status: updated.delivery_status || item.status,
                error_message: updated.error_message !== undefined ? updated.error_message : item.error_message,
              }
              : item
          )
        );
        toast.success(`Order ${ref}: status is ${updated.delivery_status || "updated"}`);
      } else {
        toast.info("Status is up to date");
      }
    } catch (e: any) {
      toast.error(e?.message || "Could not check live status");
    } finally {
      setSyncingOrderRef(null);
    }
  };

  const filteredOrders = React.useMemo(() => {
    return orders.filter((o) => {
      if (networkFilter !== "all" && (o.network || "").toUpperCase() !== networkFilter.toUpperCase()) {
        return false;
      }
      if (paymentFilter !== "all") {
        const ps = (o.payment_status || (o.delivery_status === "delivered" ? "paid" : "pending")).toLowerCase();
        const isPaid = ps === "paid" || ps === "success" || ps === "completed";
        if (paymentFilter === "paid" && !isPaid) return false;
        if (paymentFilter === "pending" && (isPaid || ps === "failed" || ps === "cancelled" || ps === "abandoned")) return false;
        if (paymentFilter === "failed" && ps !== "failed" && ps !== "cancelled" && ps !== "abandoned") return false;
      }
      if (deliveryFilter !== "all") {
        const ds = (o.delivery_status || o.status || "").toLowerCase();
        if (deliveryFilter === "delivered" && ds !== "delivered" && ds !== "completed") return false;
        if (deliveryFilter === "processing" && ds !== "processing" && ds !== "in_progress") return false;
        if (deliveryFilter === "pending" && ds !== "pending" && ds !== "waiting") return false;
        if (deliveryFilter === "failed" && ds !== "failed" && ds !== "cancelled" && ds !== "rejected") return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const ref = String(o.reference || o.id || "").toLowerCase();
        const phone = String(o.phone || o.recipient_phone || "").toLowerCase();
        const net = String(o.network || "").toLowerCase();
        const pkg = String(o.package_size || o.capacity || "").toLowerCase();
        const st = String(o.delivery_status || o.status || "").toLowerCase();
        const err = String(o.error_message || "").toLowerCase();
        if (!ref.includes(q) && !phone.includes(q) && !net.includes(q) && !pkg.includes(q) && !st.includes(q) && !err.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [orders, networkFilter, deliveryFilter, paymentFilter, searchQuery]);

  // WhatsApp Bot Store & Profit Transaction State
  const [botSubTab, setBotSubTab] = useState<"orders" | "profit_history">("orders");
  const [botSearchQuery, setBotSearchQuery] = useState("");
  const [botDeliveryFilter, setBotDeliveryFilter] = useState("all");

  const isBotOrder = (o: any) => {
    if (!o) return false;
    const notes = String(o.notes || "").toLowerCase();
    if (notes.includes("whatsapp_bot") || notes.includes("[channel:bot]") || notes.includes("whatsapp bot") || notes.includes("[channel:whatsapp_bot]")) return true;
    if (o.whatsapp_phone && String(o.whatsapp_phone).trim().length > 0) return true;
    const ref = String(o.reference || o.id || "");
    if (ref.startsWith("WS-") || ref.startsWith("REF-")) return true;
    if (o.source === "whatsapp" || o.source === "whatsapp_bot" || o.channel === "whatsapp" || o.channel === "whatsapp_bot") return true;
    return false;
  };

  const botOrders = React.useMemo(() => {
    return orders.filter(isBotOrder);
  }, [orders]);

  const filteredBotOrders = React.useMemo(() => {
    return botOrders.filter((o) => {
      if (botDeliveryFilter !== "all") {
        const ds = (o.delivery_status || o.status || "").toLowerCase();
        if (botDeliveryFilter === "delivered" && ds !== "delivered" && ds !== "completed") return false;
        if (botDeliveryFilter === "processing" && ds !== "processing" && ds !== "in_progress") return false;
        if (botDeliveryFilter === "pending" && ds !== "pending" && ds !== "waiting") return false;
        if (botDeliveryFilter === "failed" && ds !== "failed" && ds !== "cancelled" && ds !== "rejected") return false;
      }
      if (botSearchQuery.trim()) {
        const q = botSearchQuery.toLowerCase().trim();
        const ref = String(o.reference || o.id || "").toLowerCase();
        const phone = String(o.phone || o.recipient_phone || o.whatsapp_phone || "").toLowerCase();
        const net = String(o.network || "").toLowerCase();
        const pkg = String(o.package_size || o.capacity || "").toLowerCase();
        const ds = String(o.delivery_status || o.status || "").toLowerCase();
        if (!ref.includes(q) && !phone.includes(q) && !net.includes(q) && !pkg.includes(q) && !ds.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [botOrders, botDeliveryFilter, botSearchQuery]);

  // Products & Pricing State
  const [products, setProducts] = useState<any[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [customPrices, setCustomPrices] = useState<Record<string, number>>({});
  const [savingPrices, setSavingPrices] = useState(false);
  const [selectedNetwork, setSelectedNetwork] = useState<string>("ALL");
  const [pricingCategory, setPricingCategory] = useState<"data" | "services" | "boost">("data");
  const [servicesPricing, setServicesPricing] = useState<any[]>([]);
  const [boostMarkupPercent, setBoostMarkupPercent] = useState<number>(() => {
    try {
      const saved = localStorage.getItem("data1_agent_profile");
      if (saved) {
        const ag = JSON.parse(saved);
        const raw = ag?.custom_prices?.boost_markup_percent;
        if (Number.isFinite(Number(raw))) return Number(raw);
      }
    } catch (_) { }
    return 25;
  });

  const handleBoostMarkupChange = (newVal: number) => {
    const val = Math.max(0, Math.min(500, Number(newVal) || 0));
    setBoostMarkupPercent(val);
    setCustomPrices((prev) => ({
      ...prev,
      boost_markup_percent: val,
    }));
  };

  // Payment Failure Reason Modal State
  const [failureModalOpen, setFailureModalOpen] = useState(false);
  const [selectedFailureOrder, setSelectedFailureOrder] = useState<any>(null);

  const formatPaymentFailureReason = (raw?: string | null): string => {
    if (!raw) return "Payment was not completed by customer";
    const r = raw.toLowerCase();
    if (r.includes("insufficient") || r.includes("low balance") || r.includes("not enough") || r.includes("balance is not sufficient")) {
      return "Insufficient MoMo Balance";
    }
    if (r.includes("abandon") || r.includes("abandoned")) {
      return "Prompt Expired / Ignored";
    }
    if (r.includes("cancel") || r.includes("declined") || r.includes("rejected")) {
      return "Declined by Customer";
    }
    if (r.includes("pin") || r.includes("wrong pin")) {
      return "Wrong MoMo PIN Entered";
    }
    if (r.includes("timeout") || r.includes("timed out") || r.includes("expired")) {
      return "Authorization Timed Out";
    }
    if (r.includes("less than required") || r.includes("underpay")) {
      return "Underpaid Amount";
    }
    if (r.includes("duplicate") || r.includes("already")) {
      return "Duplicate Reference";
    }
    return raw;
  };

  // Netflix Code Modal State
  const [netflixModalOpen, setNetflixModalOpen] = useState(false);
  const [selectedNetflixOrder, setSelectedNetflixOrder] = useState<any>(null);
  const [netflixEmail, setNetflixEmail] = useState("stillmoving11@gmail.com");
  const [netflixCode, setNetflixCode] = useState<string | null>(null);
  const [netflixCodeAt, setNetflixCodeAt] = useState<string | null>(null);
  const [copiedNetflixCode, setCopiedNetflixCode] = useState(false);

  // Withdrawals State
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [withdrawAmount, setWithdrawAmount] = useState<string>("");
  const [momoNumber, setMomoNumber] = useState<string>("");
  const [momoNetwork, setMomoNetwork] = useState<string>("MTN");
  const [momoName, setMomoName] = useState<string>("");
  const [withdrawalCode, setWithdrawalCode] = useState<string>("");
  const [sendingWithdrawalCode, setSendingWithdrawalCode] = useState(false);
  const [codeCountdown, setCodeCountdown] = useState<number>(0);
  const [codeSentMessage, setCodeSentMessage] = useState<string>("");
  const [submittingWithdrawal, setSubmittingWithdrawal] = useState(false);

  // Store Settings State
  const [storeName, setStoreName] = useState("");
  const [storeSlug, setStoreSlug] = useState("");
  const [storeDesc, setStoreDesc] = useState("");
  const [whatsappNum, setWhatsappNum] = useState("");
  const [whatsappGroupUrl, setWhatsappGroupUrl] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [storeTheme, setStoreTheme] = useState<string>("cyber");
  const [announcement, setAnnouncement] = useState("");
  const [announcementEnabled, setAnnouncementEnabled] = useState(false);
  const [announcementType, setAnnouncementType] = useState<"promo" | "info" | "warning">("promo");
  const [announcementPopupEnabled, setAnnouncementPopupEnabled] = useState(false);
  const [announcementPopupTitle, setAnnouncementPopupTitle] = useState("");
  const [announcementPopupMessage, setAnnouncementPopupMessage] = useState("");
  const [announcementPopupBadge, setAnnouncementPopupBadge] = useState("");
  const [announcementPopupCtaText, setAnnouncementPopupCtaText] = useState("");
  const [announcementPopupCtaUrl, setAnnouncementPopupCtaUrl] = useState("");
  const [testPopupOpen, setTestPopupOpen] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [customDomain, setCustomDomain] = useState<string>(() => {
    const saved = localStorage.getItem("gooddata_agent_domain") || localStorage.getItem("bjd_agent_domain");
    if (saved && !saved.toLowerCase().includes("data1gh") && !saved.toLowerCase().includes("bigjay")) return saved;
    return "https://gooddata1.vercel.app";
  });
  const [savingSettings, setSavingSettings] = useState(false);

  // Copy state
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedBotLink, setCopiedBotLink] = useState(false);

  // Load Agent on mount
  useEffect(() => {
    document.title = "Agent Dashboard · Data1gh";
    const raw = localStorage.getItem("data1_agent_profile");
    if (!raw) {
      navigate("/agent/login", { replace: true });
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      if (!parsed?.id) {
        navigate("/agent/login", { replace: true });
        return;
      }
      setAgent(parsed);
      setStoreName(parsed.store_name || "");
      setStoreSlug(parsed.store_slug || "");
      setStoreDesc(parsed.description || "");
      setWhatsappNum(parsed.whatsapp_number || parsed.phone || "");
      setWhatsappGroupUrl(parsed.whatsapp_group_url || parsed.whatsapp_channel_url || "");
      const cachedLogo = localStorage.getItem(`data1_agent_logo_${parsed.id}`);
      setLogoUrl(parsed.logo_url || cachedLogo || "");
      setStoreTheme(parsed.store_theme || "cyber");
      setAnnouncement(parsed.announcement || "");
      setAnnouncementEnabled(Boolean(parsed.announcement_enabled));
      setAnnouncementType(parsed.announcement_type || "promo");
      setAnnouncementPopupEnabled(Boolean(parsed.announcement_popup_enabled));
      setAnnouncementPopupTitle(parsed.announcement_popup_title || "");
      setAnnouncementPopupMessage(parsed.announcement_popup_message || "");
      setAnnouncementPopupBadge(parsed.announcement_popup_badge || "");
      setAnnouncementPopupCtaText(parsed.announcement_popup_cta_text || "");
      setAnnouncementPopupCtaUrl(parsed.announcement_popup_cta_url || "");
      setMomoNumber(parsed.momo_number || parsed.phone || "");
      setMomoNetwork(parsed.momo_network || "MTN");
      setMomoName(parsed.momo_name || parsed.name || "");
      refreshProfile(parsed.id);

      // Check if URL requests instant reset to 0.00
      const searchParams = new URLSearchParams(window.location.search);
      if (
        searchParams.get("reset") === "true" ||
        searchParams.get("reset") === "all" ||
        searchParams.get("reset") === "0"
      ) {
        invokeApiFunction("agent", {
          body: { action: "resetMyStats", agent_id: parsed.id },
        })
          .then(() => {
            refreshProfile(parsed.id);
            toast.success("All metrics reset to GH₵ 0.00 successfully!");
            window.history.replaceState({}, document.title, window.location.pathname);
          })
          .catch(() => { });
      }
    } catch {
      navigate("/agent/login", { replace: true });
    }
  }, [navigate]);

  const refreshProfile = async (agentId: string) => {
    try {
      setLoading(true);
      const res = await invokeApiFunction("agent", {
        body: { action: "getProfile", agent_id: agentId },
      });

      if (res?.data?.ok && res.data.agent) {
        const ag = res.data.agent;
        const cachedLogo = localStorage.getItem(`data1_agent_logo_${agentId}`) || "";
        const finalLogo = ag.logo_url || cachedLogo || "";
        const enriched = { ...ag, logo_url: finalLogo };
        setAgent(enriched);
        localStorage.setItem("data1_agent_profile", JSON.stringify(enriched));
        setCustomPrices(ag.custom_prices || {});
        if (ag.custom_prices && Number.isFinite(Number(ag.custom_prices.boost_markup_percent))) {
          setBoostMarkupPercent(Number(ag.custom_prices.boost_markup_percent));
        }
        if (finalLogo) {
          setLogoUrl(finalLogo);
          localStorage.setItem(`data1_agent_logo_${agentId}`, finalLogo);
        }
        if (ag.store_theme) {
          setStoreTheme(ag.store_theme);
        }
        if (ag.whatsapp_group_url || ag.whatsapp_channel_url) {
          setWhatsappGroupUrl(ag.whatsapp_group_url || ag.whatsapp_channel_url || "");
        }
        if (ag.announcement !== undefined) {
          setAnnouncement(ag.announcement || "");
        }
        if (ag.announcement_enabled !== undefined) {
          setAnnouncementEnabled(Boolean(ag.announcement_enabled));
        }
        if (ag.announcement_type) {
          setAnnouncementType(ag.announcement_type);
        }
        if (ag.announcement_popup_enabled !== undefined) {
          setAnnouncementPopupEnabled(Boolean(ag.announcement_popup_enabled));
        }
        if (ag.announcement_popup_title !== undefined) {
          setAnnouncementPopupTitle(ag.announcement_popup_title || "");
        }
        if (ag.announcement_popup_message !== undefined) {
          setAnnouncementPopupMessage(ag.announcement_popup_message || "");
        }
        if (ag.announcement_popup_badge !== undefined) {
          setAnnouncementPopupBadge(ag.announcement_popup_badge || "");
        }
        if (ag.announcement_popup_cta_text !== undefined) {
          setAnnouncementPopupCtaText(ag.announcement_popup_cta_text || "");
        }
        if (ag.announcement_popup_cta_url !== undefined) {
          setAnnouncementPopupCtaUrl(ag.announcement_popup_cta_url || "");
        }
      }
    } catch (e) {
      console.warn("Could not refresh agent profile:", e);
    } finally {
      setLoading(false);
    }
  };

  // Load Orders
  const fetchOrders = async (dateVal?: string) => {
    if (!agent?.id) return;
    setOrdersLoading(true);
    try {
      const res = await invokeApiFunction("agent", {
        body: { action: "getOrders", agent_id: agent.id, date: dateVal ?? dateFilter },
      });
      if (res?.data?.ok) {
        const rawOrders = Array.isArray(res.data.orders) ? res.data.orders : [];
        const isPaidOrder = (o: any) => {
          const payStatus = String(o.payment_status || o.status || "").toLowerCase();
          return payStatus === "paid" || payStatus === "success" || payStatus === "completed";
        };
        const paidOrders = rawOrders.filter(isPaidOrder);
        const seen = new Set<string>();
        const dedupedOrders = paidOrders.filter((o: any) => {
          const k = String(o.reference || o.id || "").replace(/^agord-/, "").trim().toLowerCase();
          if (!k || seen.has(k)) return false;
          seen.add(k);
          return true;
        });
        setOrders(dedupedOrders);
        setOrderStats({
          today_orders_count: res.data.today_orders_count,
          today_profit: res.data.today_profit,
          filtered_orders_count: dedupedOrders.length,
          filtered_profit: res.data.filtered_profit,
          total_orders_count: res.data.total_orders_count,
        });
      }
    } catch (e) {
      console.warn("Could not fetch orders:", e);
    } finally {
      setOrdersLoading(false);
    }
  };

  // Load Products
  const fetchProducts = async () => {
    if (!agent?.id) return;
    setProductsLoading(true);
    try {
      const res = await invokeApiFunction("agent", {
        body: { action: "getProducts", agent_id: agent.id },
      });
      if (res?.data?.ok) {
        if (Array.isArray(res.data.products)) {
          setProducts(res.data.products);
          const map: Record<string, number> = {};
          res.data.products.forEach((p: any) => {
            map[p.id] = Number(p.selling_price);
          });
          if (Array.isArray(res.data.services)) {
            setServicesPricing(res.data.services);
            res.data.services.forEach((s: any) => {
              map[s.id] = Number(s.selling_price);
            });
          }
          if (res.data.custom_prices) {
            Object.assign(map, res.data.custom_prices);
            if (Number.isFinite(Number(res.data.custom_prices.boost_markup_percent))) {
              setBoostMarkupPercent(Number(res.data.custom_prices.boost_markup_percent));
            }
          }
          setCustomPrices(map);
        }
      }
    } catch (e) {
      console.warn("Could not fetch products:", e);
    } finally {
      setProductsLoading(false);
    }
  };

  const handleOpenNetflixModal = (order: any) => {
    setSelectedNetflixOrder(order);
    setNetflixModalOpen(true);
    setCopiedNetflixCode(false);
    setNetflixCode(order.netflix_last_code || null);
    setNetflixCodeAt(order.netflix_last_code_at || null);
  };

  // Load Withdrawals
  const fetchWithdrawals = async () => {
    if (!agent?.id) return;
    try {
      const res = await invokeApiFunction("agent", {
        body: { action: "getWithdrawals", agent_id: agent.id },
      });
      if (res?.data?.ok && Array.isArray(res.data.withdrawals)) {
        setWithdrawals(res.data.withdrawals);
      }
    } catch (e) {
      console.warn("Could not fetch withdrawals:", e);
    }
  };

  // Effect to load tab data
  useEffect(() => {
    if (!agent?.id) return;
    if (activeTab === "orders" || activeTab === "bot_store") {
      fetchOrders(dateFilter);
    } else if (activeTab === "pricing") {
      fetchProducts();
    } else if (activeTab === "withdrawals") {
      fetchWithdrawals();
    } else if (activeTab === "referrals") {
      loadCustomerReferrals();
    } else if (activeTab === "notifications") {
      loadNotificationSettings();
    }
  }, [activeTab, agent?.id]);

  const getStorefrontUrl = () => {
    if (!agent?.store_slug) return "";
    const activeDomain = (customDomain || agent.custom_domain || "https://gooddata1.vercel.app").trim().replace(/\/+$/, "");
    const cleanDomain = (activeDomain.toLowerCase().includes("data1gh") || activeDomain.toLowerCase().includes("bigjay"))
      ? "https://gooddata1.vercel.app"
      : activeDomain;
    return `${cleanDomain}/s/${agent.store_slug}`;
  };

  const handleCopyStoreLink = () => {
    const link = getStorefrontUrl();
    if (!link) return;
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    toast.success("Store link copied to clipboard!");
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const getWhatsAppBotStoreUrl = () => {
    const slug = agent?.store_slug || storeSlug;
    if (!slug) return "";
    return `https://wa.me/233200598553?text=${encodeURIComponent(`Hi [store:${slug}]`)}`;
  };

  const handleCopyBotLink = () => {
    const link = getWhatsAppBotStoreUrl();
    if (!link) return;
    navigator.clipboard.writeText(link);
    setCopiedBotLink(true);
    toast.success("WhatsApp Bot Store link copied to clipboard!");
    setTimeout(() => setCopiedBotLink(false), 2000);
  };

  const handleShareBotWhatsApp = () => {
    const link = getWhatsAppBotStoreUrl();
    if (!link) return;
    const store = agent?.store_name || storeName || "our store";
    const text = `Buy high-speed data bundles directly on WhatsApp from ${store}! Instant MoMo checkout: ${link}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  const handleTestBotWhatsApp = () => {
    const link = getWhatsAppBotStoreUrl();
    if (!link) return;
    window.open(link, "_blank");
  };

  const handleShareWhatsApp = () => {
    const link = getStorefrontUrl();
    if (!link) return;
    const text = `Buy high-speed, instant non-expiry MTN, Telecel & AT data bundles on my store: ${link}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  const handlePriceChange = (productId: string, val: string) => {
    const num = parseFloat(val);
    setCustomPrices((prev) => ({
      ...prev,
      [productId]: isNaN(num) ? 0 : num,
    }));
  };

  const handleSavePrices = async () => {
    if (!agent?.id) return;
    setSavingPrices(true);
    try {
      const res = await invokeApiFunction("agent", {
        body: {
          action: "updateProducts",
          agent_id: agent.id,
          custom_prices: customPrices,
        },
      });
      if (res?.data?.ok) {
        toast.success("Custom selling prices saved!");
        if (agent.store_slug) {
          try {
            invalidateCache(`agent_public_store_${agent.store_slug.toLowerCase()}`);
            invalidateCache(`agent_public_store_${agent.id.toLowerCase()}`);
            localStorage.removeItem(`agent_public_store_${agent.store_slug.toLowerCase()}`);
            localStorage.removeItem(`agent_public_store_${agent.id.toLowerCase()}`);
            localStorage.removeItem(`cache_agent_public_store_${agent.store_slug.toLowerCase()}`);
            localStorage.removeItem(`cache_agent_public_store_${agent.id.toLowerCase()}`);
          } catch (_) { }
        }
        clearCachePrefix("agent_public_store");
        const updatedAgent = {
          ...agent,
          custom_prices: res.data.custom_prices || customPrices,
        };
        setAgent(updatedAgent);
        localStorage.setItem("data1_agent_profile", JSON.stringify(updatedAgent));
        fetchProducts();
      } else {
        toast.error(res?.data?.error || "Failed to update prices.");
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed to save prices.");
    } finally {
      setSavingPrices(false);
    }
  };

  useEffect(() => {
    if (codeCountdown <= 0) return;
    const interval = setInterval(() => {
      setCodeCountdown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [codeCountdown]);

  const handleSendWithdrawalCode = async () => {
    if (!agent?.id) return;
    const currentBal = Number(agent.wallet_balance ?? (agent as any).walletBalance ?? 0);
    const amt = parseFloat(withdrawAmount);
    if (isNaN(amt) || amt <= 0) {
      toast.error("Please enter your withdrawal amount first.");
      return;
    }
    if (amt < 5) {
      toast.error("Minimum withdrawal amount is GH₵ 5.00.");
      return;
    }
    if (amt > currentBal) {
      toast.error(`Insufficient balance. Available: GH₵ ${currentBal.toFixed(2)}.`);
      return;
    }

    setSendingWithdrawalCode(true);
    try {
      const res = await invokeApiFunction("agent", {
        body: {
          action: "sendWithdrawalOtp",
          agent_id: agent.id,
        },
      });
      if (res?.data?.ok) {
        toast.success(res.data.message || "Verification code sent to your email & SMS!");
        setCodeSentMessage(res.data.message || "Code sent!");
        setCodeCountdown(60);
      } else {
        toast.error(res?.data?.error || "Failed to send verification code.");
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed to send verification code.");
    } finally {
      setSendingWithdrawalCode(false);
    }
  };

  const handleWithdrawalRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agent?.id) return;

    const currentBal = Number(agent.wallet_balance ?? (agent as any).walletBalance ?? 0);
    const amt = parseFloat(withdrawAmount);
    if (isNaN(amt) || amt <= 0) {
      toast.error("Please enter a valid withdrawal amount.");
      return;
    }
    if (amt < 5) {
      toast.error("Minimum withdrawal amount is GH₵ 5.00.");
      return;
    }
    if (amt > currentBal) {
      toast.error(`Insufficient balance. Available: GH₵ ${currentBal.toFixed(2)}.`);
      return;
    }
    if (!withdrawalCode.trim()) {
      toast.error("Please enter the verification code sent to your email or SMS.");
      return;
    }

    setSubmittingWithdrawal(true);
    try {
      const res = await invokeApiFunction("agent", {
        body: {
          action: "requestWithdrawal",
          agent_id: agent.id,
          amount: amt,
          momo_name: momoName.trim() || agent.momo_name || agent.name || "",
          momo_number: momoNumber.trim() || agent.phone,
          momo_network: momoNetwork,
          verification_code: withdrawalCode.trim(),
        },
      });
      if (res?.data?.ok) {
        toast.success(res.data.message || "Withdrawal request submitted! Admin has received an alert on WhatsApp.");
        setWithdrawAmount("");
        setWithdrawalCode("");
        setCodeSentMessage("");
        if (res.data.financials) {
          setAgent((prev) => (prev ? { ...prev, ...res.data.financials } : prev));
        }
        fetchWithdrawals();
        refreshProfile(agent.id);
      } else {
        toast.error(res?.data?.error || "Withdrawal request failed.");
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed to request withdrawal.");
    } finally {
      setSubmittingWithdrawal(false);
    }
  };

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select a valid image file (PNG, JPG, WebP).");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image file is too large. Please select an image under 5MB.");
      return;
    }

    setUploadingLogo(true);
    const reader = new FileReader();
    reader.onload = (readerEvent) => {
      const img = new Image();
      img.onload = () => {
        // Optimize and compress image using canvas (120px webp/jpeg to prevent egress bloat)
        const canvas = document.createElement("canvas");
        const MAX_DIM = 120;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_DIM) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          }
        } else {
          if (height > MAX_DIM) {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          let compressed = canvas.toDataURL("image/webp", 0.75);
          if (!compressed.startsWith("data:image/webp")) {
            compressed = canvas.toDataURL("image/jpeg", 0.75);
          }
          setLogoUrl(compressed);
          if (agent?.id) {
            localStorage.setItem(`data1_agent_logo_${agent.id}`, compressed);
          }
          toast.success("Logo optimized (<15KB) & ready! Click 'Save Storefront Settings' to publish.");
        }
        setUploadingLogo(false);
      };
      img.onerror = () => {
        toast.error("Could not process image file.");
        setUploadingLogo(false);
      };
      img.src = readerEvent.target?.result as string;
    };
    reader.onerror = () => {
      toast.error("Could not read image file.");
      setUploadingLogo(false);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agent?.id) return;
    setSavingSettings(true);
    localStorage.setItem("gooddata_agent_domain", customDomain.trim());
    if (logoUrl) {
      localStorage.setItem(`data1_agent_logo_${agent.id}`, logoUrl);
    }
    try {
      const res = await invokeApiFunction("agent", {
        body: {
          action: "updateProfile",
          agent_id: agent.id,
          store_name: storeName.trim(),
          store_slug: storeSlug.trim(),
          description: storeDesc.trim(),
          whatsapp_number: whatsappNum.trim(),
          whatsapp_group_url: whatsappGroupUrl.trim(),
          logo_url: logoUrl.trim(),
          momo_number: momoNumber.trim(),
          momo_network: momoNetwork,
          momo_name: momoName.trim(),
          custom_domain: customDomain.trim(),
          store_theme: storeTheme,
          announcement: announcement.trim(),
          announcement_enabled: announcementEnabled,
          announcement_type: announcementType,
          announcement_popup_enabled: announcementPopupEnabled,
          announcement_popup_title: announcementPopupTitle.trim(),
          announcement_popup_message: announcementPopupMessage.trim(),
          announcement_popup_badge: announcementPopupBadge.trim(),
          announcement_popup_cta_text: announcementPopupCtaText.trim(),
          announcement_popup_cta_url: announcementPopupCtaUrl.trim(),
        },
      });
      if (res?.data?.ok) {
        toast.success("Store settings updated successfully!");
        if (storeSlug) {
          invalidateCache(`agent_public_store_${storeSlug.toLowerCase().trim()}`);
        }
        if (agent?.id) {
          invalidateCache(`agent_public_store_${agent.id.toLowerCase().trim()}`);
        }
        const updatedAg = {
          ...agent,
          store_name: storeName.trim(),
          store_slug: storeSlug.trim(),
          description: storeDesc.trim(),
          whatsapp_number: whatsappNum.trim(),
          whatsapp_group_url: whatsappGroupUrl.trim(),
          logo_url: logoUrl.trim(),
          momo_number: momoNumber.trim(),
          momo_network: momoNetwork,
          momo_name: momoName.trim(),
          custom_domain: customDomain.trim(),
          store_theme: storeTheme,
          announcement: announcement.trim(),
          announcement_enabled: announcementEnabled,
          announcement_type: announcementType,
          announcement_popup_enabled: announcementPopupEnabled,
          announcement_popup_title: announcementPopupTitle.trim(),
          announcement_popup_message: announcementPopupMessage.trim(),
          announcement_popup_badge: announcementPopupBadge.trim(),
          announcement_popup_cta_text: announcementPopupCtaText.trim(),
          announcement_popup_cta_url: announcementPopupCtaUrl.trim(),
        };
        setAgent(updatedAg);
        localStorage.setItem("data1_agent_profile", JSON.stringify(updatedAg));
        if (logoUrl.trim()) {
          localStorage.setItem(`data1_agent_logo_${agent.id}`, logoUrl.trim());
        }
        refreshProfile(agent.id);
      } else {
        toast.error(res?.data?.error || "Failed to save settings.");
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed to update settings.");
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSignOut = () => {
    localStorage.removeItem("data1_agent_token");
    localStorage.removeItem("data1_agent_profile");
    toast.info("Signed out from agent dashboard.");
    navigate("/agent/login");
  };

  if (!agent) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
        <Loader2 className="size-8 animate-spin text-cyan-400" />
      </div>
    );
  }

  const publicStoreUrl = getStorefrontUrl();

  const walletBal = Number(agent.wallet_balance ?? (agent as any).walletBalance ?? 0);
  const lifetimeProfit = Number(agent.total_profit ?? (agent as any).totalProfit ?? 0);
  const totalWithdrawn = Number(agent.total_withdrawn ?? (agent as any).totalWithdrawn ?? 0);
  const pendingWithdrawal = Number(agent.pending_withdrawal ?? (agent as any).pendingWithdrawal ?? 0);
  const todayProfit = Number(agent.today_profit ?? (agent as any).todayProfit ?? orderStats.today_profit ?? 0);
  const todayOrders = Number(agent.today_orders_count ?? (agent as any).todayOrdersCount ?? orderStats.today_orders_count ?? 0);

  // Filter products by selected network
  const filteredProducts = products.filter((p) => {
    if (selectedNetwork === "ALL") return true;
    return (p.network || "").toUpperCase() === selectedNetwork;
  });

  const navItems = [
    {
      id: "orders",
      label: "Orders & Sales",
      icon: ShoppingBag,
      badge: (orderStats.filtered_orders_count ?? orders.length) > 0 ? (orderStats.filtered_orders_count ?? orders.length) : undefined,
    },
    {
      id: "bot_store",
      label: "WhatsApp Bot Store",
      icon: MessageCircle,
      badge: botOrders.length > 0 ? `${botOrders.length} Bot` : undefined,
    },
    { id: "pricing", label: "Products & Pricing", icon: Sliders },
    {
      id: "withdrawals",
      label: "Wallet & MoMo",
      icon: Wallet,
      badge: walletBal > 0 ? formatGHS(walletBal) : undefined,
    },
    {
      id: "referrals",
      label: "Customer Referrals",
      icon: Gift,
      badge: referralStats.total_completed_rewards > 0 ? `${referralStats.total_completed_rewards} Ready` : undefined,
    },
    {
      id: "announcement",
      label: "Store Announcement",
      icon: Megaphone,
      badge: (announcementPopupEnabled || announcementEnabled) ? "Active" : undefined,
    },
    {
      id: "notifications",
      label: "Notification Center",
      icon: Bell,
      badge: "WhatsApp",
    },
    { id: "tracker", label: "Live Delivery Tracker", icon: Radio },
    { id: "settings", label: "Storefront Settings", icon: Store },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col md:flex-row selection:bg-cyan-500 selection:text-black">
      {/* 1. Mobile Top Bar: ONLY Store info on Left and Menu Button on Right (Matching AdminLayout) */}
      <header className="md:hidden sticky top-0 z-30 bg-zinc-900/95 backdrop-blur-md border-b border-white/10 px-4 py-2.5 flex items-center justify-between shadow-md">
        {/* Left: Store info */}
        <div className="flex items-center gap-2.5">
          <div className="size-8 rounded-lg bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 flex items-center justify-center shrink-0">
            <Store className="size-4" />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-black text-sm tracking-tight text-white">{agent.store_name}</span>
            <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
              Agent
            </span>
          </div>
        </div>

        {/* Right: Menu Button */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setMobileMenuOpen((prev) => !prev)}
          className="text-white hover:bg-white/15 px-3 py-1.5 h-9 rounded-xl flex items-center gap-1.5 border border-white/20 bg-white/10 shadow-xs active:scale-95 transition-all"
          aria-label="Toggle Agent Menu"
        >
          {mobileMenuOpen ? <X className="size-5 text-cyan-400" /> : <Menu className="size-5 text-cyan-400" />}
          <span className="text-xs font-black uppercase tracking-wider">
            {mobileMenuOpen ? "Close" : "Menu"}
          </span>
        </Button>
      </header>

      {/* 2. Mobile Right-Side Drawer Overlay & Menu */}
      <div
        className={`fixed inset-0 bg-black/80 backdrop-blur-xs z-50 transition-opacity duration-300 md:hidden ${mobileMenuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
          }`}
        onClick={() => setMobileMenuOpen(false)}
        aria-hidden="true"
      />

      <aside
        className={`fixed inset-y-0 right-0 w-72 max-w-[85vw] bg-zinc-900 border-l border-white/10 text-white z-50 flex flex-col shadow-2xl transition-transform duration-300 ease-out md:hidden ${mobileMenuOpen ? "translate-x-0" : "translate-x-full"
          }`}
      >
        {/* Drawer Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between shrink-0 bg-black/30">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-lg bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 flex items-center justify-center shrink-0">
              <Store className="size-4" />
            </div>
            <div>
              <span className="font-black text-sm text-white block leading-tight">{agent.store_name}</span>
              <span className="text-[11px] text-zinc-400 font-medium">Agent Portal</span>
            </div>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setMobileMenuOpen(false)}
            className="size-8 rounded-lg text-white hover:bg-white/10"
            aria-label="Close menu"
          >
            <X className="size-5" />
          </Button>
        </div>

        {/* Drawer Vertical Nav List */}
        <nav className="p-3 space-y-1 overflow-y-auto flex-1">
          <div className="text-[10px] uppercase font-black tracking-wider text-zinc-500 px-3 py-1">
            Agent Menu
          </div>
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setActiveTab(item.id as any);
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${activeTab === item.id
                  ? "bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40 shadow-xs"
                  : "hover:bg-white/5 text-zinc-300"
                }`}
            >
              <div className="flex items-center gap-3">
                <item.icon className={`size-4 shrink-0 ${activeTab === item.id ? "text-cyan-400" : "text-zinc-400"}`} />
                <span>{item.label}</span>
              </div>
              {item.badge !== undefined && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Drawer Footer Actions */}
        <div className="p-3 border-t border-white/10 space-y-1.5 shrink-0 bg-black/40">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              handleCopyStoreLink();
              setMobileMenuOpen(false);
            }}
            className="w-full justify-start h-9 text-xs font-semibold rounded-xl border-cyan-500/30 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20"
          >
            {copiedLink ? <Check className="size-4 mr-2.5 text-emerald-400" /> : <Copy className="size-4 mr-2.5" />}
            <span>{copiedLink ? "Link Copied!" : "Copy Store Link"}</span>
          </Button>

          <Button
            asChild
            variant="ghost"
            size="sm"
            className="w-full justify-start text-zinc-300 hover:bg-white/10 hover:text-white h-9 text-xs font-semibold"
            onClick={() => setMobileMenuOpen(false)}
          >
            <a href={publicStoreUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="size-4 mr-2.5 text-cyan-400" /> View Storefront
            </a>
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setMobileMenuOpen(false);
              handleSignOut();
            }}
            className="w-full justify-start text-rose-400 hover:bg-rose-500/15 hover:text-rose-300 h-9 text-xs font-semibold"
          >
            <LogOut className="size-4 mr-2.5 text-rose-400" /> Sign Out
          </Button>
        </div>
      </aside>

      {/* 3. Desktop Permanent Sidebar (Menu Bar At The Side! Matching AdminLayout) */}
      <aside className="hidden md:flex md:w-64 md:h-screen md:sticky md:top-0 bg-zinc-900/95 border-r border-white/10 flex-col shrink-0 text-white shadow-xl z-20">
        {/* Sidebar Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 flex items-center justify-center shadow-xs shrink-0">
              <Store className="size-5" />
            </div>
            <div className="min-w-0">
              <span className="font-black text-sm tracking-tight text-white block truncate">{agent.store_name}</span>
              <span className="text-[10px] uppercase font-bold text-cyan-400 flex items-center gap-1">
                <span className="size-1.5 rounded-full bg-cyan-400 animate-pulse" />
                Official Reseller
              </span>
            </div>
          </div>
        </div>

        {/* Sidebar Nav Links - Vertical list at the side */}
        <nav className="p-3 space-y-1 overflow-y-auto flex-1">
          <div className="text-[10px] uppercase font-black tracking-wider text-zinc-500 px-3 py-1">
            Agent Menu
          </div>
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id as any)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${activeTab === item.id
                  ? "bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40 shadow-xs"
                  : "hover:bg-white/5 text-zinc-400 hover:text-white"
                }`}
            >
              <div className="flex items-center gap-3">
                <item.icon className={`size-4 shrink-0 ${activeTab === item.id ? "text-cyan-400" : "text-zinc-400"}`} />
                <span>{item.label}</span>
              </div>
              {item.badge !== undefined && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Sidebar Footer Actions */}
        <div className="p-3 border-t border-white/10 space-y-1.5 shrink-0 bg-black/30">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopyStoreLink}
            className="w-full justify-start h-9 text-xs font-semibold rounded-xl border-cyan-500/30 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20"
          >
            {copiedLink ? <Check className="size-4 mr-2.5 text-emerald-400" /> : <Copy className="size-4 mr-2.5" />}
            <span>{copiedLink ? "Link Copied!" : "Copy Store Link"}</span>
          </Button>

          <Button
            asChild
            variant="ghost"
            size="sm"
            className="w-full justify-start text-zinc-300 hover:bg-white/10 hover:text-white h-9 text-xs font-semibold"
          >
            <a href={publicStoreUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="size-4 mr-2.5 text-cyan-400" /> View Storefront
            </a>
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
            className="w-full justify-start text-rose-400 hover:bg-rose-500/15 hover:text-rose-300 h-9 text-xs font-semibold"
          >
            <LogOut className="size-4 mr-2.5 text-rose-400" /> Sign Out
          </Button>
        </div>
      </aside>

      {/* 4. Main Content Area */}
      <main className="flex-1 min-w-0 overflow-y-auto max-w-7xl p-4 md:p-8 space-y-6">
        {/* TOP STATS CARDS: Specially Featuring Today's Orders & Today's Profit */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
          {/* 1. TODAY'S PROFIT (Key Highlight) */}
          <Card className="p-3 sm:p-5 rounded-2xl sm:rounded-3xl border border-emerald-500/40 bg-gradient-to-br from-emerald-950/60 via-zinc-900 to-black text-white shadow-[0_4px_20px_rgba(16,185,129,0.15)] relative overflow-hidden flex flex-col justify-between">
            <div className="absolute top-0 right-0 -mr-6 -mt-6 sm:-mr-10 sm:-mt-10 size-16 sm:size-28 rounded-full bg-emerald-500/20 blur-xl sm:blur-2xl pointer-events-none" />
            <div className="flex items-center justify-between gap-1 pb-1 sm:pb-3">
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1 sm:gap-1.5 truncate">
                <Sparkles className="size-3 sm:size-3.5 shrink-0" /> Today&apos;s Profit
              </span>
              <span className="text-[9px] sm:text-[11px] font-mono text-emerald-300/80 bg-emerald-500/15 border border-emerald-500/30 px-1.5 sm:px-2 py-0.5 rounded-full shrink-0">
                Accra
              </span>
            </div>
            <div className="text-xl sm:text-3xl font-black tracking-tight text-white my-0.5 sm:my-0">
              {formatGHS(todayProfit)}
            </div>
            <div className="text-[10px] sm:text-xs text-emerald-200/80 mt-0.5 sm:mt-1 font-medium truncate">
              Today&apos;s sales profit
            </div>
          </Card>

          {/* 2. TODAY'S ORDERS (Key Highlight) */}
          <Card className="p-3 sm:p-5 rounded-2xl sm:rounded-3xl border border-cyan-500/40 bg-gradient-to-br from-cyan-950/60 via-zinc-900 to-black text-white shadow-[0_4px_20px_rgba(6,182,212,0.15)] relative overflow-hidden flex flex-col justify-between">
            <div className="absolute top-0 right-0 -mr-6 -mt-6 sm:-mr-10 sm:-mt-10 size-16 sm:size-28 rounded-full bg-cyan-500/20 blur-xl sm:blur-2xl pointer-events-none" />
            <div className="flex items-center justify-between gap-1 pb-1 sm:pb-3">
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1 sm:gap-1.5 truncate">
                <ShoppingBag className="size-3 sm:size-3.5 shrink-0" /> Today&apos;s Orders
              </span>
              <span className="text-[9px] sm:text-[11px] font-mono text-cyan-300/80 bg-cyan-500/15 border border-cyan-500/30 px-1.5 sm:px-2 py-0.5 rounded-full shrink-0">
                Live
              </span>
            </div>
            <div className="text-xl sm:text-3xl font-black tracking-tight text-white my-0.5 sm:my-0">
              {todayOrders}
            </div>
            <div className="text-[10px] sm:text-xs text-cyan-200/80 mt-0.5 sm:mt-1 font-medium truncate">
              Orders placed today
            </div>
          </Card>

          {/* 3. WALLET BALANCE (Available for withdrawal) */}
          <Card className="p-3 sm:p-5 rounded-2xl sm:rounded-3xl border border-amber-500/40 bg-gradient-to-br from-amber-950/50 via-zinc-900 to-black text-white shadow-[0_4px_20px_rgba(245,158,11,0.15)] relative overflow-hidden flex flex-col justify-between">
            <div className="absolute top-0 right-0 -mr-6 -mt-6 sm:-mr-10 sm:-mt-10 size-16 sm:size-28 rounded-full bg-amber-500/20 blur-xl sm:blur-2xl pointer-events-none" />
            <div className="flex items-center justify-between gap-1 pb-1 sm:pb-3">
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1 sm:gap-1.5 truncate">
                <Wallet className="size-3 sm:size-3.5 shrink-0" /> Balance
              </span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setActiveTab("withdrawals")}
                className="h-5 sm:h-6 px-1.5 sm:px-2 text-[10px] sm:text-[11px] font-bold text-amber-300 hover:text-white hover:bg-amber-500/20 rounded-md sm:rounded-lg shrink-0"
              >
                Withdraw &rarr;
              </Button>
            </div>
            <div className="text-xl sm:text-3xl font-black tracking-tight text-amber-300 my-0.5 sm:my-0">
              {formatGHS(walletBal)}
            </div>
            <div className="text-[10px] sm:text-xs text-amber-200/70 mt-0.5 sm:mt-1 font-medium truncate">
              {pendingWithdrawal > 0
                ? `${formatGHS(pendingWithdrawal)} pending`
                : "Instant payout"}
            </div>
          </Card>

          {/* 4. TOTAL EARNED LIFETIME */}
          <Card className="p-3 sm:p-5 rounded-2xl sm:rounded-3xl border border-purple-500/40 bg-gradient-to-br from-purple-950/50 via-zinc-900 to-black text-white shadow-[0_4px_20px_rgba(168,85,247,0.15)] relative overflow-hidden flex flex-col justify-between">
            <div className="absolute top-0 right-0 -mr-6 -mt-6 sm:-mr-10 sm:-mt-10 size-16 sm:size-28 rounded-full bg-purple-500/20 blur-xl sm:blur-2xl pointer-events-none" />
            <div className="flex items-center justify-between gap-1 pb-1 sm:pb-3">
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1 sm:gap-1.5 truncate">
                <TrendingUp className="size-3 sm:size-3.5 shrink-0" /> Lifetime
              </span>
              <span className="text-[9px] sm:text-[11px] font-mono text-purple-300/80 bg-purple-500/15 border border-purple-500/30 px-1.5 sm:px-2 py-0.5 rounded-full shrink-0">
                Total
              </span>
            </div>
            <div className="text-xl sm:text-3xl font-black tracking-tight text-white my-0.5 sm:my-0">
              {formatGHS(lifetimeProfit)}
            </div>
            <div className="text-[10px] sm:text-xs text-purple-200/70 mt-0.5 sm:mt-1 font-medium truncate">
              Paid: {formatGHS(totalWithdrawn)}
            </div>
          </Card>
        </div>

        {/* Shareable Storefront Banner */}
        <div className="p-4 rounded-3xl border border-cyan-500/30 bg-gradient-to-r from-cyan-950/40 via-zinc-900 to-emerald-950/40 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-center sm:text-left">
            <div className="size-11 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 flex items-center justify-center shrink-0">
              <Share2 className="size-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-white flex items-center justify-center sm:justify-start gap-1.5">
                <span>Your Customer Storefront Link</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold">Active</span>
              </div>
              <div className="text-xs text-zinc-400 font-mono mt-0.5 break-all">
                {publicStoreUrl}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopyStoreLink}
              className="flex-1 sm:flex-initial h-9 rounded-xl border-white/20 bg-white/5 hover:bg-white/10 text-xs font-bold gap-1.5"
            >
              {copiedLink ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
              <span>{copiedLink ? "Copied" : "Copy Link"}</span>
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={handleShareWhatsApp}
              className="flex-1 sm:flex-initial h-9 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold gap-1.5 shadow-sm"
            >
              <MessageCircle className="size-3.5" />
              <span>Share WhatsApp</span>
            </Button>

            <a
              href={publicStoreUrl}
              target="_blank"
              rel="noreferrer"
              className="size-9 rounded-xl border border-white/20 bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-300 hover:text-white transition-all shrink-0"
              title="Open storefront preview"
            >
              <ExternalLink className="size-4" />
            </a>
          </div>
        </div>

        {/* Active Section Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase tracking-wider text-cyan-400">
              {activeTab === "orders" && "📦 Customer Orders & Daily Sales"}
              {activeTab === "bot_store" && "🤖 WhatsApp Bot Store, Orders & Profit"}
              {activeTab === "pricing" && "⚡ Products & Custom Markup Pricing"}
              {activeTab === "withdrawals" && "💰 Wallet Balance & MoMo Payouts"}
              {activeTab === "referrals" && "🎁 Customer Referrals & 5GB Free Data Rewards"}
              {activeTab === "announcement" && "📢 Storefront Pop-Up Announcement"}
              {activeTab === "notifications" && "🔔 Notification Center & WhatsApp Bot Order Alerts"}
              {activeTab === "tracker" && "📡 Live Network Delivery Tracker"}
              {activeTab === "settings" && "⚙️ Storefront Branding & Link Settings"}
            </span>
          </div>

          <div className="text-[11px] text-zinc-500 font-medium">
            Data1gh Reseller Network
          </div>
        </div>

        {/* TAB 1: ORDERS & DAILY PERFORMANCE (With Search & Status Filters) */}
        {activeTab === "orders" && (
          <div className="space-y-4">
            {/* Top 4 Quick Metric Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-2xl bg-zinc-900/60 border border-white/10 space-y-1">
                <div className="text-[11px] font-bold text-zinc-400 flex items-center justify-between">
                  <span>Total Orders</span>
                  <ShoppingBag className="size-3.5 text-zinc-500" />
                </div>
                <div className="text-xl font-black text-white">{orders.length}</div>
                <div className="text-[10px] text-zinc-500">All customer orders</div>
              </div>

              <div className="p-3.5 rounded-2xl bg-zinc-900/60 border border-emerald-500/20 space-y-1">
                <div className="text-[11px] font-bold text-emerald-400 flex items-center justify-between">
                  <span>Delivered</span>
                  <CheckCircle2 className="size-3.5 text-emerald-400" />
                </div>
                <div className="text-xl font-black text-emerald-300">
                  {orders.filter((o) => {
                    const ds = (o.delivery_status || o.status || "").toLowerCase();
                    return ds === "delivered" || ds === "completed";
                  }).length}
                </div>
                <div className="text-[10px] text-zinc-500">Credited to customer</div>
              </div>

              <div className="p-3.5 rounded-2xl bg-zinc-900/60 border border-cyan-500/20 space-y-1">
                <div className="text-[11px] font-bold text-cyan-400 flex items-center justify-between">
                  <span>Processing</span>
                  <Radio className="size-3.5 text-cyan-400 animate-pulse" />
                </div>
                <div className="text-xl font-black text-cyan-300">
                  {orders.filter((o) => {
                    const ds = (o.delivery_status || o.status || "").toLowerCase();
                    return ds === "processing" || ds === "waiting" || ds === "pending";
                  }).length}
                </div>
                <div className="text-[10px] text-zinc-500">Telecom dispatch queue</div>
              </div>

              <div className="p-3.5 rounded-2xl bg-zinc-900/60 border border-emerald-500/30 bg-emerald-950/10 space-y-1">
                <div className="text-[11px] font-bold text-emerald-400 flex items-center justify-between">
                  <span>Period Profit</span>
                  <TrendingUp className="size-3.5 text-emerald-400" />
                </div>
                <div className="text-xl font-black text-emerald-300">
                  {formatGHS(orderStats.filtered_profit ?? 0)}
                </div>
                <div className="text-[10px] text-zinc-500">Net earned earnings</div>
              </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="p-4 rounded-2xl bg-zinc-900/60 border border-white/10 space-y-3">
              <div className="flex flex-col md:flex-row gap-2.5 items-stretch md:items-center justify-between">
                {/* Search Input */}
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <Input
                    className="pl-9 bg-black/60 border-white/15 text-white placeholder:text-zinc-500 text-xs rounded-xl focus:border-cyan-400"
                    placeholder="Search reference, customer phone, network or package..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                {/* Network Select */}
                <Select value={networkFilter} onValueChange={setNetworkFilter}>
                  <SelectTrigger className="w-full md:w-[130px] bg-black/60 border-white/15 text-white text-xs rounded-xl">
                    <SelectValue placeholder="All Networks" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-white/15 text-white text-xs">
                    <SelectItem value="all">All Networks</SelectItem>
                    <SelectItem value="MTN">MTN</SelectItem>
                    <SelectItem value="TELECEL">Telecel</SelectItem>
                    <SelectItem value="AT">AirtelTigo</SelectItem>
                  </SelectContent>
                </Select>

                {/* Payment Status Select */}
                <Select value={paymentFilter} onValueChange={setPaymentFilter}>
                  <SelectTrigger className="w-full md:w-[135px] bg-black/60 border-white/15 text-white text-xs rounded-xl">
                    <SelectValue placeholder="All Payments" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-white/15 text-white text-xs">
                    <SelectItem value="all">All Payments</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="failed">Failed / Unpaid</SelectItem>
                  </SelectContent>
                </Select>

                {/* Delivery Status Select */}
                <Select value={deliveryFilter} onValueChange={setDeliveryFilter}>
                  <SelectTrigger className="w-full md:w-[140px] bg-black/60 border-white/15 text-white text-xs rounded-xl">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-white/15 text-white text-xs">
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="delivered">Delivered</SelectItem>
                    <SelectItem value="processing">Processing</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Date Filter & Quick Actions */}
              <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-white/10 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-zinc-400 font-semibold flex items-center gap-1.5 text-xs">
                    <Calendar className="size-3.5 text-cyan-400" />
                    Date:
                  </span>

                  <input
                    type="date"
                    value={dateFilter}
                    onChange={(e) => {
                      setDateFilter(e.target.value);
                      fetchOrders(e.target.value);
                    }}
                    className="bg-black/60 border border-white/20 rounded-xl px-2.5 py-1 text-xs text-white focus:outline-none focus:border-cyan-400"
                  />

                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      setDateFilter("");
                      fetchOrders("");
                    }}
                    className={`h-7 rounded-xl text-[11px] font-bold transition-all ${!dateFilter
                        ? "bg-cyan-500 text-black hover:bg-cyan-400 font-black shadow-sm"
                        : "border border-white/15 bg-white/5 text-zinc-300 hover:bg-white/10"
                      }`}
                  >
                    All Orders ({orderStats.total_orders_count ?? orders.length})
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Accra" });
                      setDateFilter(todayStr);
                      fetchOrders(todayStr);
                    }}
                    className={`h-7 rounded-xl text-[11px] font-bold transition-all ${dateFilter
                        ? "bg-emerald-500 text-black hover:bg-emerald-400 font-black shadow-sm"
                        : "border border-white/15 bg-white/5 text-zinc-300 hover:bg-white/10"
                      }`}
                  >
                    Today ({orderStats.today_orders_count ?? 0})
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-zinc-400 text-xs">
                    Showing <strong className="text-white">{filteredOrders.length}</strong> of {orders.length} orders
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => fetchOrders(dateFilter)}
                    className="size-7 rounded-lg text-zinc-400 hover:text-white"
                    title="Refresh orders"
                  >
                    <RefreshCw className={`size-3.5 ${ordersLoading ? "animate-spin" : ""}`} />
                  </Button>
                </div>
              </div>
            </div>

            {/* Orders Table */}
            {ordersLoading ? (
              <div className="p-12 text-center text-zinc-500 flex flex-col items-center justify-center gap-2">
                <Loader2 className="size-6 animate-spin text-cyan-400" />
                <span className="text-xs">Loading orders...</span>
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="p-12 rounded-3xl border border-white/10 bg-zinc-900/30 text-center space-y-3">
                <div className="size-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-zinc-500 mx-auto">
                  <ShoppingBag className="size-6" />
                </div>
                <div className="font-bold text-sm text-zinc-300">
                  {searchQuery || networkFilter !== "all" || paymentFilter !== "all" || deliveryFilter !== "all"
                    ? "No orders match your filter criteria"
                    : dateFilter
                      ? `No orders found for ${dateFilter}`
                      : "No customer orders placed yet"}
                </div>
                {searchQuery || networkFilter !== "all" || deliveryFilter !== "all" ? (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      setSearchQuery("");
                      setNetworkFilter("all");
                      setPaymentFilter("all");
                      setDeliveryFilter("all");
                    }}
                    className="rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold"
                  >
                    Reset Search Filters
                  </Button>
                ) : dateFilter && Number(orderStats.total_orders_count || 0) > 0 ? (
                  <div className="space-y-3">
                    <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                      You have <strong>{orderStats.total_orders_count}</strong> customer orders across other dates.
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        setDateFilter("");
                        fetchOrders("");
                      }}
                      className="rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-bold"
                    >
                      View All {orderStats.total_orders_count} Orders
                    </Button>
                  </div>
                ) : (
                  <>
                    <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                      Share your custom storefront link with friends, groups, or on your WhatsApp status to start receiving orders and earning profit automatically!
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleShareWhatsApp}
                      className="rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white gap-1.5"
                    >
                      <MessageCircle className="size-3.5" />
                      <span>Share Storefront on WhatsApp</span>
                    </Button>
                  </>
                )}
              </div>
            ) : (
              <div className="rounded-3xl border border-white/10 bg-zinc-900/40 overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-white/[0.03] border-b border-white/10 text-zinc-400 uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="p-3.5 font-bold">Date / Time</th>
                        <th className="p-3.5 font-bold">Reference / Code</th>
                        <th className="p-3.5 font-bold">Network &amp; Package</th>
                        <th className="p-3.5 font-bold">Customer Phone</th>
                        <th className="p-3.5 font-bold">Selling Price</th>
                        <th className="p-3.5 font-bold">Base Cost</th>
                        <th className="p-3.5 font-bold text-emerald-400">Your Profit</th>
                        <th className="p-3.5 font-bold">Payment</th>
                        <th className="p-3.5 font-bold">Delivery</th>
                        <th className="p-3.5 font-bold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {filteredOrders.map((o) => {
                        const dateFormatted = o.created_at
                          ? new Date(o.created_at).toLocaleString("en-GB", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                          : "N/A";

                        const isNetflix =
                          String(o.reference || "").startsWith("NF") ||
                          String(o.package_size || "").toLowerCase().includes("netflix") ||
                          String(o.network || "").toUpperCase() === "NETFLIX";

                        const refCode = o.reference || o.id || "";
                        const ds = (o.delivery_status || o.status || "processing").toLowerCase();
                        const isDelivered = ds === "delivered" || ds === "completed";
                        const isProcessing = ds === "processing" || ds === "in_progress";
                        const isPending = ds === "pending" || ds === "waiting";
                        const isFailed = ds === "failed" || ds === "cancelled" || ds === "rejected";

                        const rawPhone = String(o.phone || o.recipient_phone || "").replace(/\D/g, "");
                        const waCustomerHref = rawPhone
                          ? `https://wa.me/${rawPhone.startsWith("0") ? "233" + rawPhone.slice(1) : rawPhone}?text=${encodeURIComponent(
                            `Hello! Thank you for ordering ${o.network || ""} ${o.package_size || ""} from ${storeName}. Your order reference is ${refCode}.`
                          )}`
                          : "";

                        return (
                          <tr key={o.id || o.reference} className="hover:bg-white/[0.02] transition-colors">
                            {/* Date / Time */}
                            <td className="p-3.5 font-mono text-[11px] text-zinc-400 whitespace-nowrap">
                              {dateFormatted}
                            </td>

                            {/* Reference with 1-click Copy */}
                            <td className="p-3.5">
                              <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold text-cyan-300">
                                <span className="max-w-[120px] truncate" title={refCode}>
                                  {refCode}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => copyOrderRef(refCode)}
                                  className="p-1 rounded-md bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
                                  title="Copy reference code"
                                >
                                  {copiedRef === refCode ? (
                                    <Check className="size-3 text-emerald-400" />
                                  ) : (
                                    <Copy className="size-3" />
                                  )}
                                </button>
                              </div>
                            </td>

                            {/* Network & Package */}
                            <td className="p-3.5 whitespace-nowrap">
                              <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase mr-1.5 ${networkClass(o.network)}`}>
                                {o.network}
                              </span>
                              <span className="font-bold text-white">{o.package_size || "Data"}</span>
                              {isNetflix && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenNetflixModal(o)}
                                  className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 text-[10px] font-black transition-colors"
                                >
                                  <Play className="size-2.5 fill-red-400 text-red-400" />
                                  <span>{o.netflix_last_code ? `Code: ${o.netflix_last_code}` : "View Code"}</span>
                                </button>
                              )}
                            </td>

                            {/* Customer Phone */}
                            <td className="p-3.5 font-mono text-zinc-300 whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <span>{o.phone || o.recipient_phone || "N/A"}</span>
                                {waCustomerHref && (
                                  <a
                                    href={waCustomerHref}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="p-1 rounded-md text-emerald-400 hover:bg-emerald-500/10"
                                    title="Chat with customer on WhatsApp"
                                  >
                                    <MessageCircle className="size-3" />
                                  </a>
                                )}
                              </div>
                            </td>

                            {/* Selling Price */}
                            <td className="p-3.5 font-bold text-white whitespace-nowrap">
                              {formatGHS(o.amount || 0)}
                            </td>

                            {/* Base Cost */}
                            <td className="p-3.5 text-zinc-400 whitespace-nowrap">
                              {formatGHS(o.base_price || 0)}
                            </td>

                            {/* Your Profit */}
                            <td className="p-3.5 font-bold text-emerald-400 whitespace-nowrap">
                              +{formatGHS(o.agent_profit || 0)}
                            </td>

                            {/* Payment Status & Failure Reason */}
                            <td className="p-3.5 whitespace-nowrap">
                              {(() => {
                                const ps = String(o.payment_status || (isDelivered ? "paid" : "pending")).toLowerCase();
                                const isPaid = ps === "paid" || ps === "success" || ps === "completed" || isDelivered;
                                const isPayFailed = ps === "failed" || ps === "cancelled" || ps === "abandoned";
                                const hasFailureReason = Boolean(o.error_message);
                                const failureReasonText = formatPaymentFailureReason(o.error_message);

                                return (
                                  <div className="flex flex-col gap-1 items-start">
                                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${isPaid
                                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30 font-black"
                                        : isPayFailed
                                          ? "bg-rose-500/20 text-rose-300 border-rose-500/30"
                                          : "bg-amber-500/20 text-amber-300 border-amber-500/30"
                                      }`}>
                                      {isPaid ? "Paid ✓" : isPayFailed ? "Failed ✕" : "Pending ⏳"}
                                    </span>

                                    {/* Failure Reason Pill */}
                                    {(isPayFailed || hasFailureReason) && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setSelectedFailureOrder(o);
                                          setFailureModalOpen(true);
                                        }}
                                        className="group inline-flex items-center gap-1 max-w-[200px] text-left px-2 py-0.5 rounded-md bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 transition-colors cursor-pointer"
                                        title={`Payment failure reason: ${o.error_message || failureReasonText} (Click for details)`}
                                      >
                                        <AlertCircle className="size-3 text-rose-400 shrink-0 group-hover:scale-110 transition-transform" />
                                        <span className="text-[10px] font-medium text-rose-200 truncate">
                                          {failureReasonText}
                                        </span>
                                        <Info className="size-2.5 text-rose-400/80 shrink-0 ml-0.5" />
                                      </button>
                                    )}
                                  </div>
                                );
                              })()}
                            </td>

                            {/* Delivery Status */}
                            <td className="p-3.5 whitespace-nowrap">
                              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${isDelivered
                                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                                  : isProcessing
                                    ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/30 animate-pulse"
                                    : isPending
                                      ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                                      : isFailed
                                        ? "bg-rose-500/20 text-rose-300 border-rose-500/30"
                                        : "bg-zinc-700/40 text-zinc-300 border-zinc-600/30"
                                }`}>
                                {o.delivery_status || o.status || "processing"}
                              </span>
                            </td>

                            {/* Actions */}
                            <td className="p-3.5 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => syncOrderLive(o)}
                                  disabled={syncingOrderRef === refCode}
                                  className="h-7 px-2 text-[10px] font-bold rounded-lg bg-white/5 hover:bg-white/10 text-cyan-300 hover:text-cyan-200 border border-white/10 gap-1"
                                  title="Check live telecom delivery status"
                                >
                                  <RefreshCw className={`size-3 ${syncingOrderRef === refCode ? "animate-spin text-cyan-400" : ""}`} />
                                  <span>{syncingOrderRef === refCode ? "Checking..." : "Sync Status"}</span>
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB: WHATSAPP BOT STORE, ORDERS & PROFIT HISTORY */}
        {activeTab === "bot_store" && (
          <div className="space-y-6">
            {/* 1. Header & Dedicated WhatsApp Bot Store Link Card */}
            <div className="p-5 md:p-6 rounded-3xl bg-gradient-to-br from-emerald-950/60 via-zinc-900/90 to-black border border-emerald-500/40 shadow-2xl space-y-4 relative overflow-hidden">
              <div className="absolute -top-12 -right-12 size-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="space-y-1.5 max-w-2xl">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-[11px] font-black uppercase tracking-wider border border-emerald-500/40">
                    <MessageCircle className="size-3.5 text-emerald-400" />
                    <span>Dedicated WhatsApp Bot Store</span>
                  </div>
                  <h3 className="text-xl md:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                    <span>Sell Seamlessly on WhatsApp</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold">24/7 Automated</span>
                  </h3>
                  <p className="text-xs md:text-sm text-zinc-300 leading-relaxed">
                    Share your dedicated bot link with customers. When they message this link, our automated bot displays <strong className="text-emerald-400">{agent.store_name}</strong>, your custom retail prices, and processes instant MoMo checkout. <em className="text-emerald-300">Zero wholesale cost leakage!</em>
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto shrink-0">
                  <Button
                    type="button"
                    onClick={handleCopyBotLink}
                    className="flex-1 md:flex-none h-10 px-4 text-xs font-bold rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black shadow-lg shadow-emerald-500/20 transition-all"
                  >
                    {copiedBotLink ? (
                      <>
                        <Check className="size-4 mr-1.5" />
                        <span>Link Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="size-4 mr-1.5" />
                        <span>Copy Bot Link</span>
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleShareBotWhatsApp}
                    className="flex-1 md:flex-none h-10 px-4 text-xs font-bold rounded-xl border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/15"
                  >
                    <Share2 className="size-4 mr-1.5" />
                    <span>Share on WhatsApp</span>
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleTestBotWhatsApp}
                    className="flex-1 md:flex-none h-10 px-4 text-xs font-bold rounded-xl bg-white/5 hover:bg-white/10 text-zinc-200"
                  >
                    <ArrowUpRight className="size-4 mr-1.5 text-emerald-400" />
                    <span>Test Bot</span>
                  </Button>
                </div>
              </div>

              {/* Bot Link Box */}
              <div className="p-3 rounded-2xl bg-black/60 border border-white/10 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 px-2 py-0.5 rounded bg-white/5 shrink-0">Bot URL</span>
                  <span className="text-xs font-mono text-emerald-300 truncate select-all">{getWhatsAppBotStoreUrl()}</span>
                </div>
                <div className="text-[11px] text-zinc-400 font-medium shrink-0 flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Bot Tag: <code className="text-emerald-400 font-bold">[store:{agent.store_slug}]</code></span>
                </div>
              </div>
            </div>

            {/* 2. Bot Performance & Profit Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-4 rounded-2xl bg-zinc-900/60 border border-white/10 space-y-1">
                <div className="text-[11px] font-bold text-zinc-400 flex items-center justify-between">
                  <span>Total Bot Orders</span>
                  <MessageCircle className="size-4 text-emerald-400" />
                </div>
                <div className="text-2xl font-black text-white">{botOrders.length}</div>
                <div className="text-[10px] text-zinc-500">Orders placed on WhatsApp</div>
              </div>

              <div className="p-4 rounded-2xl bg-zinc-900/60 border border-emerald-500/20 space-y-1">
                <div className="text-[11px] font-bold text-emerald-400 flex items-center justify-between">
                  <span>Delivered &amp; Fulfilled</span>
                  <CheckCircle2 className="size-4 text-emerald-400" />
                </div>
                <div className="text-2xl font-black text-emerald-300">
                  {botOrders.filter((o) => {
                    const ds = (o.delivery_status || o.status || "").toLowerCase();
                    return ds === "delivered" || ds === "completed";
                  }).length}
                </div>
                <div className="text-[10px] text-zinc-500">Credited to customer lines</div>
              </div>

              <div className="p-4 rounded-2xl bg-zinc-900/60 border border-cyan-500/20 space-y-1">
                <div className="text-[11px] font-bold text-cyan-400 flex items-center justify-between">
                  <span>Bot Gross Sales</span>
                  <ShoppingBag className="size-4 text-cyan-400" />
                </div>
                <div className="text-2xl font-black text-cyan-300">
                  {formatGHS(botOrders.reduce((sum, o) => sum + (Number(o.amount) || Number(o.selling_price) || 0), 0))}
                </div>
                <div className="text-[10px] text-zinc-500">Customer payments collected</div>
              </div>

              <div className="p-4 rounded-2xl bg-emerald-950/20 border border-emerald-500/40 space-y-1 relative overflow-hidden">
                <div className="text-[11px] font-bold text-emerald-400 flex items-center justify-between">
                  <span>Net Bot Profit Earned</span>
                  <TrendingUp className="size-4 text-emerald-400" />
                </div>
                <div className="text-2xl font-black text-emerald-400">
                  {formatGHS(botOrders.reduce((sum, o) => sum + (Number(o.agent_profit) || 0), 0))}
                </div>
                <div className="text-[10px] text-emerald-400/80 font-semibold">Credited to wallet</div>
              </div>
            </div>

            {/* 3. Sub-Navigation Tabs & Search Bar */}
            <div className="p-4 rounded-3xl bg-zinc-900/60 border border-white/10 space-y-3">
              <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                {/* Segmented Sub Tabs */}
                <div className="inline-flex p-1 rounded-2xl bg-black/60 border border-white/10 shrink-0">
                  <button
                    type="button"
                    onClick={() => setBotSubTab("orders")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${botSubTab === "orders"
                        ? "bg-emerald-500 text-black shadow font-black"
                        : "text-zinc-400 hover:text-white"
                      }`}
                  >
                    <MessageCircle className="size-3.5" />
                    <span>Orders from Bot ({botOrders.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setBotSubTab("profit_history")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${botSubTab === "profit_history"
                        ? "bg-emerald-500 text-black shadow font-black"
                        : "text-zinc-400 hover:text-white"
                      }`}
                  >
                    <TrendingUp className="size-3.5" />
                    <span>Profit Transaction History ({botOrders.length})</span>
                  </button>
                </div>

                {/* Filters */}
                <div className="flex items-center gap-2 flex-1 md:max-w-md">
                  <div className="relative flex-1">
                    <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <Input
                      className="pl-8 bg-black/60 border-white/15 text-white placeholder:text-zinc-500 text-xs rounded-xl focus:border-emerald-400 h-9"
                      placeholder="Search ref, customer phone, network..."
                      value={botSearchQuery}
                      onChange={(e) => setBotSearchQuery(e.target.value)}
                    />
                  </div>
                  <Select value={botDeliveryFilter} onValueChange={setBotDeliveryFilter}>
                    <SelectTrigger className="w-[130px] bg-black/60 border-white/15 text-white text-xs rounded-xl h-9">
                      <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-white/15 text-white text-xs">
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="delivered">Delivered</SelectItem>
                      <SelectItem value="processing">Processing</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* 4. SUB-TAB 1: ORDERS FROM THE BOT */}
            {botSubTab === "orders" && (
              <div className="space-y-4">
                {filteredBotOrders.length === 0 ? (
                  <div className="p-8 md:p-12 rounded-3xl border border-emerald-500/20 bg-gradient-to-b from-zinc-900/60 to-black text-center space-y-4">
                    <div className="size-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto">
                      <MessageCircle className="size-7" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-black text-base text-white">
                        {botOrders.length === 0 ? "No WhatsApp Bot Orders Yet" : "No orders match your filter criteria"}
                      </h4>
                      <p className="text-xs text-zinc-400 max-w-md mx-auto leading-relaxed">
                        {botOrders.length === 0
                          ? "Share your custom WhatsApp bot link with your customers or status viewers. When they message the bot, orders appear here automatically with real-time profit tracking!"
                          : "Try searching with a different keyword or resetting your delivery status filter."}
                      </p>
                    </div>

                    {botOrders.length === 0 ? (
                      <div className="pt-2 flex flex-wrap items-center justify-center gap-2.5">
                        <Button
                          type="button"
                          onClick={handleCopyBotLink}
                          className="h-9 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold gap-1.5"
                        >
                          <Copy className="size-3.5" />
                          <span>Copy WhatsApp Bot Link</span>
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleShareBotWhatsApp}
                          className="h-9 px-4 rounded-xl border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10 text-xs font-bold gap-1.5"
                        >
                          <Share2 className="size-3.5" />
                          <span>Share on WhatsApp</span>
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={handleTestBotWhatsApp}
                          className="h-9 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 text-xs font-bold gap-1.5"
                        >
                          <ArrowUpRight className="size-3.5 text-emerald-400" />
                          <span>Test Bot Now</span>
                        </Button>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => {
                          setBotSearchQuery("");
                          setBotDeliveryFilter("all");
                        }}
                        className="rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold"
                      >
                        Reset Search Filters
                      </Button>
                    )}

                    {/* How It Works Explainer */}
                    {botOrders.length === 0 && (
                      <div className="pt-6 border-t border-white/10 max-w-2xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
                        <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1">
                          <div className="text-[10px] font-black uppercase text-emerald-400">Step 1</div>
                          <div className="text-xs font-bold text-white">Share Your Link</div>
                          <div className="text-[11px] text-zinc-400">Customers click your WhatsApp bot link directly.</div>
                        </div>
                        <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1">
                          <div className="text-[10px] font-black uppercase text-emerald-400">Step 2</div>
                          <div className="text-xs font-bold text-white">Automated MoMo</div>
                          <div className="text-[11px] text-zinc-400">Bot shows your custom prices and initiates prompt.</div>
                        </div>
                        <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1">
                          <div className="text-[10px] font-black uppercase text-emerald-400">Step 3</div>
                          <div className="text-xs font-bold text-white">Profit Credited</div>
                          <div className="text-[11px] text-zinc-400">Bundle is delivered and net profit hits your wallet!</div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="rounded-3xl border border-white/10 bg-zinc-900/40 overflow-hidden shadow-xl">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-white/[0.03] border-b border-white/10 text-zinc-400 uppercase tracking-wider text-[10px]">
                          <tr>
                            <th className="p-3.5 font-bold">Date / Time</th>
                            <th className="p-3.5 font-bold">Reference</th>
                            <th className="p-3.5 font-bold">Customer (WhatsApp)</th>
                            <th className="p-3.5 font-bold">Network &amp; Package</th>
                            <th className="p-3.5 font-bold">Selling Price</th>
                            <th className="p-3.5 font-bold">Base Cost</th>
                            <th className="p-3.5 font-bold text-emerald-400">Your Profit</th>
                            <th className="p-3.5 font-bold">Delivery Status</th>
                            <th className="p-3.5 font-bold text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {filteredBotOrders.map((o) => {
                            const dateFormatted = o.created_at
                              ? new Date(o.created_at).toLocaleString("en-GB", {
                                day: "2-digit",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                              : "N/A";

                            const refCode = o.reference || o.id || "";
                            const ds = (o.delivery_status || o.status || "processing").toLowerCase();
                            const isDelivered = ds === "delivered" || ds === "completed";
                            const isProcessing = ds === "processing" || ds === "in_progress";
                            const isPending = ds === "pending" || ds === "waiting";
                            const isFailed = ds === "failed" || ds === "cancelled" || ds === "rejected";

                            const customerPhone = o.whatsapp_phone || o.recipient_phone || o.phone || "";
                            const cleanPhone = String(customerPhone).replace(/\D/g, "");
                            const waChatUrl = cleanPhone
                              ? `https://wa.me/${cleanPhone.startsWith("0") ? "233" + cleanPhone.slice(1) : cleanPhone}?text=${encodeURIComponent(
                                `Hello! Thank you for ordering ${o.network || ""} ${o.package_size || o.capacity || ""} from ${agent.store_name} via our WhatsApp Bot. Your order reference is ${refCode}.`
                              )}`
                              : "";

                            return (
                              <tr key={o.id || o.reference} className="hover:bg-white/[0.02] transition-colors">
                                {/* Date / Time */}
                                <td className="p-3.5 font-mono text-[11px] text-zinc-400 whitespace-nowrap">
                                  {dateFormatted}
                                </td>

                                {/* Reference */}
                                <td className="p-3.5">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-mono text-[11px] font-semibold text-zinc-200">
                                      {refCode}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => copyOrderRef(refCode)}
                                      className="text-zinc-500 hover:text-white transition-colors"
                                      title="Copy reference"
                                    >
                                      {copiedRef === refCode ? (
                                        <Check className="size-3 text-emerald-400" />
                                      ) : (
                                        <Copy className="size-3" />
                                      )}
                                    </button>
                                  </div>
                                  <span className="inline-flex items-center gap-1 text-[9px] text-emerald-400/90 font-bold uppercase tracking-wider">
                                    <MessageCircle className="size-2.5" />
                                    <span>WhatsApp Bot</span>
                                  </span>
                                </td>

                                {/* Customer WhatsApp */}
                                <td className="p-3.5">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-mono text-zinc-300 font-semibold">{customerPhone || "N/A"}</span>
                                    {waChatUrl && (
                                      <a
                                        href={waChatUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-1 rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 transition-all"
                                        title="Chat Customer on WhatsApp"
                                      >
                                        <MessageCircle className="size-3" />
                                      </a>
                                    )}
                                  </div>
                                </td>

                                {/* Network & Package */}
                                <td className="p-3.5">
                                  <div className="font-bold text-white flex items-center gap-1.5">
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-black uppercase ${networkClass(o.network || "")}`}>
                                      {o.network || "DATA"}
                                    </span>
                                    <span>{o.package_size || o.capacity || o.bundle || "Data Bundle"}</span>
                                  </div>
                                </td>

                                {/* Selling Price */}
                                <td className="p-3.5 font-bold text-white whitespace-nowrap">
                                  {formatGHS(Number(o.amount) || Number(o.selling_price) || 0)}
                                </td>

                                {/* Base Cost */}
                                <td className="p-3.5 font-mono text-[11px] text-zinc-400 whitespace-nowrap">
                                  {formatGHS(Number(o.base_price) || 0)}
                                </td>

                                {/* Profit */}
                                <td className="p-3.5 whitespace-nowrap">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-black text-xs">
                                    +{formatGHS(Number(o.agent_profit) || 0)}
                                  </span>
                                </td>

                                {/* Delivery Status */}
                                <td className="p-3.5 whitespace-nowrap">
                                  <span
                                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${isDelivered
                                        ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                                        : isProcessing
                                          ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/30"
                                          : isPending
                                            ? "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                                            : isFailed
                                              ? "bg-rose-500/15 text-rose-300 border border-rose-500/30"
                                              : "bg-white/10 text-zinc-300 border border-white/15"
                                      }`}
                                  >
                                    {isDelivered && <CheckCircle2 className="size-3" />}
                                    {isProcessing && <Radio className="size-3 animate-pulse" />}
                                    {isPending && <Clock className="size-3" />}
                                    {isFailed && <AlertCircle className="size-3" />}
                                    <span>{ds || "Pending"}</span>
                                  </span>
                                </td>

                                {/* Actions */}
                                <td className="p-3.5 text-right whitespace-nowrap">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    disabled={syncingOrderRef === refCode}
                                    onClick={() => syncOrderLive(o)}
                                    className="h-7 px-2.5 rounded-lg border-white/10 bg-white/5 hover:bg-white/10 text-zinc-300 text-[11px] font-semibold gap-1"
                                  >
                                    <RefreshCw className={`size-3 ${syncingOrderRef === refCode ? "animate-spin text-cyan-400" : ""}`} />
                                    <span>{syncingOrderRef === refCode ? "Checking..." : "Sync"}</span>
                                  </Button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 5. SUB-TAB 2: PROFIT TRANSACTION HISTORY LEDGER */}
            {botSubTab === "profit_history" && (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-zinc-900/60 border border-emerald-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <h4 className="text-sm font-black text-white flex items-center gap-1.5">
                      <TrendingUp className="size-4 text-emerald-400" />
                      <span>Bot Profit Transaction History</span>
                    </h4>
                    <p className="text-xs text-zinc-400">
                      Itemized breakdown of wholesale base costs, customer retail prices, and net profits credited to your wallet from WhatsApp bot orders.
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setActiveTab("withdrawals")}
                    className="h-8 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold shrink-0 gap-1.5"
                  >
                    <Wallet className="size-3.5" />
                    <span>Go to Wallet &amp; Payouts</span>
                  </Button>
                </div>

                {filteredBotOrders.length === 0 ? (
                  <div className="p-8 md:p-12 rounded-3xl border border-white/10 bg-zinc-900/40 text-center space-y-3">
                    <div className="size-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-zinc-500 mx-auto">
                      <TrendingUp className="size-6 text-zinc-400" />
                    </div>
                    <div className="font-bold text-sm text-zinc-300">No Profit Transactions Yet</div>
                    <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                      As soon as customers purchase data bundles through your WhatsApp bot, every profit credit transaction will appear here in your ledger.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="rounded-3xl border border-white/10 bg-zinc-900/40 overflow-hidden shadow-xl">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-white/[0.03] border-b border-white/10 text-zinc-400 uppercase tracking-wider text-[10px]">
                            <tr>
                              <th className="p-3.5 font-bold">Date / Time</th>
                              <th className="p-3.5 font-bold">Order Reference</th>
                              <th className="p-3.5 font-bold">Customer Phone</th>
                              <th className="p-3.5 font-bold">Data Bundle</th>
                              <th className="p-3.5 font-bold">Retail Paid</th>
                              <th className="p-3.5 font-bold">Wholesale Cost</th>
                              <th className="p-3.5 font-bold text-emerald-400">Net Profit Credited</th>
                              <th className="p-3.5 font-bold">Wallet Credit Status</th>
                              <th className="p-3.5 font-bold">Delivery</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {filteredBotOrders.map((o) => {
                              const dateFormatted = o.created_at
                                ? new Date(o.created_at).toLocaleString("en-GB", {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                                : "N/A";

                              const refCode = o.reference || o.id || "";
                              const profitVal = Number(o.agent_profit) || 0;
                              const retailVal = Number(o.amount) || Number(o.selling_price) || 0;
                              const baseCostVal = Number(o.base_price) || 0;
                              const customerPhone = o.whatsapp_phone || o.recipient_phone || o.phone || "N/A";
                              const ds = (o.delivery_status || o.status || "processing").toLowerCase();
                              const isDelivered = ds === "delivered" || ds === "completed";

                              return (
                                <tr key={`profit-${o.id || o.reference}`} className="hover:bg-white/[0.02] transition-colors">
                                  {/* Date / Time */}
                                  <td className="p-3.5 font-mono text-[11px] text-zinc-400 whitespace-nowrap">
                                    {dateFormatted}
                                  </td>

                                  {/* Reference */}
                                  <td className="p-3.5 font-mono text-[11px] font-bold text-zinc-200 whitespace-nowrap">
                                    {refCode}
                                  </td>

                                  {/* Customer Phone */}
                                  <td className="p-3.5 font-mono text-zinc-300">
                                    {customerPhone}
                                  </td>

                                  {/* Data Bundle */}
                                  <td className="p-3.5">
                                    <div className="font-bold text-white flex items-center gap-1.5">
                                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${networkClass(o.network || "")}`}>
                                        {o.network || "DATA"}
                                      </span>
                                      <span>{o.package_size || o.capacity || o.bundle || "Data Bundle"}</span>
                                    </div>
                                  </td>

                                  {/* Retail Paid */}
                                  <td className="p-3.5 font-bold text-zinc-200 whitespace-nowrap">
                                    {formatGHS(retailVal)}
                                  </td>

                                  {/* Base Cost */}
                                  <td className="p-3.5 font-mono text-zinc-400 whitespace-nowrap">
                                    {formatGHS(baseCostVal)}
                                  </td>

                                  {/* Net Profit Credited */}
                                  <td className="p-3.5 whitespace-nowrap">
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-black text-xs shadow-sm">
                                      +{formatGHS(profitVal)}
                                    </span>
                                  </td>

                                  {/* Wallet Status */}
                                  <td className="p-3.5 whitespace-nowrap">
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 font-bold text-[10px]">
                                      <CheckCircle2 className="size-3" />
                                      <span>Credited to Wallet</span>
                                    </span>
                                  </td>

                                  {/* Delivery */}
                                  <td className="p-3.5 whitespace-nowrap">
                                    <span className={`text-[10px] font-bold uppercase tracking-wider ${isDelivered ? "text-emerald-400" : "text-cyan-400"}`}>
                                      {ds}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Financial Ledger Summary Footer */}
                    <div className="p-4 rounded-3xl bg-gradient-to-r from-zinc-900 via-emerald-950/30 to-zinc-900 border border-emerald-500/30 flex flex-col md:flex-row items-center justify-between gap-4">
                      <div className="flex flex-wrap items-center gap-6 text-xs">
                        <div>
                          <div className="text-[10px] uppercase font-bold text-zinc-500">Total Bot Revenue</div>
                          <div className="text-base font-black text-white">
                            {formatGHS(filteredBotOrders.reduce((sum, o) => sum + (Number(o.amount) || Number(o.selling_price) || 0), 0))}
                          </div>
                        </div>
                        <div className="h-8 w-px bg-white/10 hidden sm:block" />
                        <div>
                          <div className="text-[10px] uppercase font-bold text-zinc-500">Total Base Cost</div>
                          <div className="text-base font-black text-zinc-400">
                            {formatGHS(filteredBotOrders.reduce((sum, o) => sum + (Number(o.base_price) || 0), 0))}
                          </div>
                        </div>
                        <div className="h-8 w-px bg-white/10 hidden sm:block" />
                        <div>
                          <div className="text-[10px] uppercase font-bold text-emerald-400">Total Net Profit Credited</div>
                          <div className="text-base font-black text-emerald-300">
                            +{formatGHS(filteredBotOrders.reduce((sum, o) => sum + (Number(o.agent_profit) || 0), 0))}
                          </div>
                        </div>
                      </div>

                      <Button
                        type="button"
                        size="sm"
                        onClick={() => setActiveTab("withdrawals")}
                        className="h-9 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold gap-1.5 shadow-md shadow-emerald-500/20"
                      >
                        <Wallet className="size-3.5" />
                        <span>Withdraw Profit to MoMo</span>
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: PRODUCTS & PRICING */}
        {activeTab === "pricing" && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-zinc-900/60 border border-white/10 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <Sliders className="size-4 text-cyan-400" />
                  Customize Your Customer Selling Prices
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Set the price your customers pay. Your profit is calculated automatically: (Customer Price &minus; Base Cost).
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Category Switcher */}
                <div className="flex items-center p-1 rounded-xl bg-black/60 border border-white/10 gap-1">
                  <button
                    type="button"
                    onClick={() => setPricingCategory("data")}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${pricingCategory === "data"
                        ? "bg-cyan-500 text-black shadow-sm"
                        : "text-zinc-400 hover:text-white"
                      }`}
                  >
                    <Package className="size-3" />
                    <span>Data Bundles</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPricingCategory("services")}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${pricingCategory === "services"
                        ? "bg-cyan-500 text-black shadow-sm"
                        : "text-zinc-400 hover:text-white"
                      }`}
                  >
                    <Zap className="size-3" />
                    <span>Other Services &amp; Checkers</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPricingCategory("boost")}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${pricingCategory === "boost"
                        ? "bg-gradient-to-r from-fuchsia-500 to-pink-500 text-white shadow-sm font-black"
                        : "text-zinc-400 hover:text-white"
                      }`}
                  >
                    <Rocket className="size-3 text-fuchsia-300" />
                    <span>Social Media Boost 🚀</span>
                  </button>
                </div>

                {pricingCategory === "data" && (
                  <div className="flex items-center gap-1">
                    {["ALL", "MTN", "TELECEL", "AT"].map((net) => (
                      <button
                        key={net}
                        type="button"
                        onClick={() => setSelectedNetwork(net)}
                        className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all ${selectedNetwork === net
                            ? "bg-white/20 text-white shadow-sm"
                            : "bg-white/5 text-zinc-400 hover:text-white"
                          }`}
                      >
                        {net}
                      </button>
                    ))}
                  </div>
                )}

                <Button
                  type="button"
                  size="sm"
                  disabled={savingPrices}
                  onClick={handleSavePrices}
                  className="rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 hover:opacity-95 text-black font-black text-xs gap-1.5 shadow-md shadow-cyan-500/20"
                >
                  {savingPrices ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                  <span>Save Pricing</span>
                </Button>
              </div>
            </div>

            {/* Products Grid */}
            {productsLoading ? (
              <div className="p-12 text-center text-zinc-500 flex flex-col items-center justify-center gap-2">
                <Loader2 className="size-6 animate-spin text-cyan-400" />
                <span className="text-xs">Loading pricing list...</span>
              </div>
            ) : pricingCategory === "data" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {filteredProducts.map((p) => {
                  const currentPrice = customPrices[p.id] ?? p.selling_price;
                  const profit = Math.max(0, Number((currentPrice - p.base_price).toFixed(2)));

                  return (
                    <Card
                      key={p.id}
                      className="p-4 rounded-2xl border border-white/10 bg-zinc-900/60 hover:border-cyan-500/30 transition-all space-y-3"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${networkClass(p.network)}`}>
                            {p.network}
                          </span>
                          <div className="font-bold text-sm text-white mt-1.5">
                            {p.name || `${p.network} ${p.capacity}GB`}
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-[10px] text-zinc-500 uppercase tracking-wider block font-semibold">Base Cost</span>
                          <span className="text-xs font-mono font-bold text-zinc-300">
                            {formatGHS(p.base_price)}
                          </span>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-white/5 space-y-2">
                        <div className="flex items-center justify-between">
                          <Label htmlFor={`price-${p.id}`} className="text-xs font-semibold text-zinc-300">
                            Your Selling Price (GH₵):
                          </Label>
                          <span className="text-[11px] font-bold text-emerald-400 font-mono">
                            Profit: +{formatGHS(profit)}
                          </span>
                        </div>

                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-xs font-bold">
                            GH₵
                          </span>
                          <Input
                            id={`price-${p.id}`}
                            type="number"
                            step="0.10"
                            min={p.base_price}
                            value={currentPrice || ""}
                            onChange={(e) => handlePriceChange(p.id, e.target.value)}
                            className="bg-black/60 border-white/15 focus-visible:ring-cyan-500 font-mono text-sm text-white pl-12 rounded-xl h-10"
                          />
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            ) : pricingCategory === "services" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {(servicesPricing.length > 0 ? servicesPricing : [
                  { id: "service-netflix", name: "Netflix 1-Month Sign-In", category: "services", base_price: 25, selling_price: 30 },
                  { id: "service-afa", name: "AFA Registration", category: "services", base_price: 15, selling_price: 20 },
                  { id: "service-mashup", name: "MTN Pulse Mashup", category: "services", base_price: 22, selling_price: 25 },
                  { id: "checker-waec", name: "WAEC Result Checker", category: "checkers", base_price: 16, selling_price: 20 },
                  { id: "checker-bece", name: "BECE Result Checker", category: "checkers", base_price: 14, selling_price: 18 },
                ]).map((s) => {
                  const currentPrice = customPrices[s.id] ?? s.selling_price;
                  const profit = Math.max(0, Number((currentPrice - s.base_price).toFixed(2)));
                  const isNetflix = s.id === "service-netflix";
                  const isAfa = s.id === "service-afa";
                  const isMashup = s.id === "service-mashup";
                  const isChecker = s.id.startsWith("checker-");

                  return (
                    <Card
                      key={s.id}
                      className="p-4 rounded-2xl border border-white/10 bg-zinc-900/60 hover:border-cyan-500/30 transition-all space-y-3"
                    >
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            {isNetflix && (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-red-600/20 text-red-400 border border-red-500/30 flex items-center gap-1">
                                <Play className="size-2.5 fill-red-400" /> Netflix
                              </span>
                            )}
                            {isAfa && (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                                <IdCard className="size-2.5" /> AFA
                              </span>
                            )}
                            {isMashup && (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                                <Zap className="size-2.5" /> MTN Pulse
                              </span>
                            )}
                            {isChecker && (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center gap-1">
                                <GraduationCap className="size-2.5" /> Result Checker
                              </span>
                            )}
                          </div>
                          <div className="font-bold text-sm text-white">
                            {s.name}
                          </div>
                          <p className="text-[11px] text-zinc-400">
                            {isNetflix && "1-Month TV / Mobile account with live code retrieval"}
                            {isAfa && "AFA registration for reduced MTN bundle rates"}
                            {isMashup && "MTN Mashup combo voice & data direct fulfillment"}
                            {isChecker && "Instant card serial number & PIN delivered immediately"}
                          </p>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-[10px] text-zinc-500 uppercase tracking-wider block font-semibold">Base Cost</span>
                          <span className="text-xs font-mono font-bold text-zinc-300">
                            {formatGHS(s.base_price)}
                          </span>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-white/5 space-y-2">
                        <div className="flex items-center justify-between">
                          <Label htmlFor={`price-${s.id}`} className="text-xs font-semibold text-zinc-300">
                            Your Selling Price (GH₵):
                          </Label>
                          <span className="text-[11px] font-bold text-emerald-400 font-mono">
                            Profit: +{formatGHS(profit)}
                          </span>
                        </div>

                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-xs font-bold">
                            GH₵
                          </span>
                          <Input
                            id={`price-${s.id}`}
                            type="number"
                            step="0.50"
                            min={s.base_price}
                            value={currentPrice || ""}
                            onChange={(e) => handlePriceChange(s.id, e.target.value)}
                            className="bg-black/60 border-white/15 focus-visible:ring-cyan-500 font-mono text-sm text-white pl-12 rounded-xl h-10"
                          />
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            ) : (
              /* SOCIAL MEDIA BOOST PROFIT MARGINS */
              <div className="space-y-6">
                <Card className="p-5 md:p-6 rounded-3xl border border-fuchsia-500/30 bg-gradient-to-br from-fuchsia-950/40 via-zinc-900 to-black space-y-5 shadow-xl shadow-fuchsia-950/20">
                  <div className="flex items-start justify-between flex-wrap gap-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="px-3 py-0.5 rounded-full text-[11px] font-black uppercase bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/30 flex items-center gap-1.5 shadow-xs">
                          <Rocket className="size-3 text-fuchsia-300" /> Reseller Profit Percentage
                        </span>
                        <span className="text-xs text-zinc-400 font-medium">Automatic Wholesale Markup</span>
                      </div>
                      <h3 className="text-lg md:text-xl font-black text-white tracking-tight">
                        Social Media Boost Reseller Profit Margin
                      </h3>
                      <p className="text-xs md:text-sm text-zinc-300 max-w-2xl leading-relaxed">
                        Set your percentage profit margin for all social media growth services (TikTok, Instagram, Facebook, YouTube, Twitter/X, Telegram).
                        Your storefront customers will see your marked-up retail prices, and your profit is automatically credited to your wallet whenever an order completes.
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-black/60 border border-fuchsia-500/30 text-center min-w-[150px] shadow-inner">
                      <span className="text-[10px] text-zinc-400 uppercase tracking-wider block font-bold">Your Profit Margin</span>
                      <span className="text-3xl font-black text-fuchsia-400 font-mono">
                        +{boostMarkupPercent}%
                      </span>
                      <span className="text-[10px] text-emerald-400 font-semibold block mt-0.5">
                        +{boostMarkupPercent}% Above Wholesale
                      </span>
                    </div>
                  </div>

                  {/* Preset Margin Buttons & Custom Input */}
                  <div className="pt-4 border-t border-white/10 space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <Label className="text-xs font-bold text-zinc-200">
                        Choose or Customize Your Profit Percentage:
                      </Label>
                      <span className="text-[11px] text-zinc-400">
                        Higher percentage = more profit per order. Lower percentage = cheaper customer prices.
                      </span>
                    </div>

                    <div className="flex items-center flex-wrap gap-2">
                      {[10, 15, 20, 25, 30, 40, 50, 75, 100].map((pct) => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => handleBoostMarkupChange(pct)}
                          className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all ${boostMarkupPercent === pct
                              ? "bg-gradient-to-r from-fuchsia-500 to-pink-500 text-white shadow-lg shadow-fuchsia-500/30 scale-105"
                              : "bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 border border-zinc-700/80"
                            }`}
                        >
                          +{pct}%
                        </button>
                      ))}

                      <div className="flex items-center gap-1.5 bg-black/70 border border-fuchsia-500/30 px-3 py-1.5 rounded-xl ml-auto">
                        <span className="text-xs text-zinc-300 font-bold">Custom %:</span>
                        <input
                          type="number"
                          min="0"
                          max="500"
                          value={boostMarkupPercent}
                          onChange={(e) => handleBoostMarkupChange(Number(e.target.value) || 0)}
                          className="w-16 bg-transparent text-right font-mono font-black text-xs text-fuchsia-300 focus:outline-none"
                        />
                        <span className="text-xs text-zinc-300 font-bold">%</span>
                      </div>
                    </div>
                  </div>

                  {/* Live Profit Calculation Preview Banner */}
                  <div className="p-4 rounded-2xl bg-black/50 border border-white/10 grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
                    <div className="space-y-1">
                      <span className="text-[11px] text-zinc-400 font-medium block">Wholesale Base Cost (Admin)</span>
                      <span className="text-base font-bold text-zinc-200 font-mono">GH₵ 10.00</span>
                      <span className="text-[10px] text-zinc-500 block">Cost to you</span>
                    </div>
                    <div className="space-y-1 border-t sm:border-t-0 sm:border-x border-white/10 pt-2 sm:pt-0">
                      <span className="text-[11px] text-zinc-400 font-medium block">Customer Pays On Your Store</span>
                      <span className="text-base font-black text-white font-mono">
                        GH₵ {(10 * (1 + boostMarkupPercent / 100)).toFixed(2)}
                      </span>
                      <span className="text-[10px] text-zinc-400 block">Wholesale + {boostMarkupPercent}%</span>
                    </div>
                    <div className="space-y-1 border-t sm:border-t-0 border-white/10 pt-2 sm:pt-0">
                      <span className="text-[11px] text-emerald-400 font-bold block">Your Instant Wallet Profit</span>
                      <span className="text-base font-black text-emerald-400 font-mono">
                        +GH₵ {(10 * (boostMarkupPercent / 100)).toFixed(2)}
                      </span>
                      <span className="text-[10px] text-emerald-400/80 block">Credited per order</span>
                    </div>
                  </div>
                </Card>

                {/* Live Sample Catalog Preview Across Platforms */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                        <Sparkles className="size-4 text-fuchsia-400" />
                        Sample Live Pricing On Your Storefront (+{boostMarkupPercent}% Applied)
                      </h4>
                      <p className="text-xs text-zinc-400">
                        Here is what customers will see and what you will earn on popular packages.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                    {[
                      { platform: "tiktok", name: "TikTok Followers (1,000)", base: 8.50, badge: "Popular 🔥" },
                      { platform: "tiktok", name: "TikTok High-Retention Views (1,000)", base: 1.20, badge: "Instant ⚡" },
                      { platform: "instagram", name: "Instagram Real Likes (1,000)", base: 4.00, badge: "Trending 🚀" },
                      { platform: "instagram", name: "Instagram Non-Drop Followers (1,000)", base: 9.50, badge: "Non-Drop 🛡️" },
                      { platform: "youtube", name: "YouTube Monetizable Views (1,000)", base: 12.00, badge: "Monetizable 🎬" },
                      { platform: "facebook", name: "Facebook Page Followers (1,000)", base: 10.00, badge: "High Retention 👥" },
                      { platform: "twitter", name: "Twitter (X) Retweets & Likes (1,000)", base: 6.50, badge: "Fast ⚡" },
                      { platform: "telegram", name: "Telegram Channel Members (1,000)", base: 8.00, badge: "Non-Drop 🛡️" },
                      { platform: "whatsapp", name: "WhatsApp Channel Followers (1,000)", base: 11.00, badge: "Active 📱" },
                    ].map((item, idx) => {
                      const customerPrice = Math.max(1, Number((item.base * (1 + boostMarkupPercent / 100)).toFixed(2)));
                      const profit = Math.max(0, Number((customerPrice - item.base).toFixed(2)));

                      return (
                        <Card
                          key={idx}
                          className="p-4 rounded-2xl border border-white/10 bg-zinc-900/60 hover:border-fuchsia-500/30 transition-all space-y-3"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2.5">
                              <SocialPlatformIcon platform={item.platform} className="size-8 shrink-0 drop-shadow" />
                              <div>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-zinc-300">
                                  {item.badge}
                                </span>
                                <h5 className="font-bold text-xs text-white mt-1 leading-snug">
                                  {item.name}
                                </h5>
                              </div>
                            </div>
                          </div>

                          <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs">
                            <div>
                              <span className="text-[10px] text-zinc-500 block">Base Cost</span>
                              <span className="font-mono text-zinc-300 font-semibold">GH₵ {item.base.toFixed(2)}</span>
                            </div>
                            <div className="text-center">
                              <span className="text-[10px] text-zinc-400 block">Storefront Price</span>
                              <span className="font-mono text-white font-bold">GH₵ {customerPrice.toFixed(2)}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-[10px] text-emerald-400 block font-semibold">Your Profit</span>
                              <span className="font-mono text-emerald-400 font-bold">+GH₵ {profit.toFixed(2)}</span>
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: WALLET & MOMO WITHDRAWALS */}
        {activeTab === "withdrawals" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Request Payout Form */}
            <Card className="lg:col-span-1 p-6 rounded-3xl border border-amber-500/40 bg-zinc-900/60 text-white space-y-5">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Wallet className="size-4 text-amber-400" />
                  Request MoMo Withdrawal
                </h3>
                <p className="text-xs text-zinc-400 mt-1">
                  Cash out your earned profits directly to your Mobile Money account.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 space-y-1">
                <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider block">Available to Withdraw</span>
                <span className="text-2xl font-black font-mono">{formatGHS(walletBal)}</span>
                <span className="text-[10px] text-amber-400/80 block">Minimum withdrawal: GH₵ 5.00</span>
              </div>

              <form onSubmit={handleWithdrawalRequest} className="space-y-3.5">
                <div className="space-y-1.5">
                  <Label htmlFor="w_amount" className="text-xs font-semibold text-zinc-300">
                    Withdrawal Amount (GH₵)
                  </Label>
                  <Input
                    id="w_amount"
                    type="number"
                    step="0.50"
                    min="5"
                    max={walletBal}
                    required
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    placeholder="e.g. 50.00"
                    className="bg-black/60 border-white/15 focus-visible:ring-amber-500 text-white font-mono rounded-xl"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="w_network" className="text-xs font-semibold text-zinc-300">
                    MoMo Network
                  </Label>
                  <Select value={momoNetwork} onValueChange={setMomoNetwork}>
                    <SelectTrigger id="w_network" className="bg-black/60 border-white/15 text-white rounded-xl">
                      <SelectValue placeholder="Select Network" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MTN">MTN Mobile Money</SelectItem>
                      <SelectItem value="TELECEL">Telecel Cash</SelectItem>
                      <SelectItem value="AT">AT Money</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="w_number" className="text-xs font-semibold text-zinc-300">
                    MoMo Number
                  </Label>
                  <Input
                    id="w_number"
                    required
                    value={momoNumber}
                    onChange={(e) => setMomoNumber(e.target.value)}
                    placeholder="e.g. 0541234567"
                    className="bg-black/60 border-white/15 focus-visible:ring-amber-500 text-white font-mono rounded-xl"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="w_momo_name" className="text-xs font-semibold text-zinc-300">
                    MoMo Account Name
                  </Label>
                  <Input
                    id="w_momo_name"
                    required
                    value={momoName}
                    onChange={(e) => setMomoName(e.target.value)}
                    placeholder="e.g. Kwame Mensah"
                    className="bg-black/60 border-white/15 focus-visible:ring-amber-500 text-white rounded-xl"
                  />
                  <span className="text-[10px] text-zinc-400 block">
                    Must match the registered name on your Mobile Money SIM.
                  </span>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="w_code" className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                      <ShieldCheck className="size-3.5 text-cyan-400" />
                      Verification Code (Email &amp; SMS)
                    </Label>
                    <button
                      type="button"
                      disabled={sendingWithdrawalCode || codeCountdown > 0}
                      onClick={handleSendWithdrawalCode}
                      className="text-xs font-bold text-amber-400 hover:text-amber-300 disabled:opacity-50 hover:underline"
                    >
                      {sendingWithdrawalCode
                        ? "Sending..."
                        : codeCountdown > 0
                          ? `Resend in ${codeCountdown}s`
                          : "Send Code to Email & SMS"}
                    </button>
                  </div>
                  <Input
                    id="w_code"
                    required
                    maxLength={6}
                    value={withdrawalCode}
                    onChange={(e) => setWithdrawalCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="Enter 6-digit code"
                    className="bg-black/60 border-white/15 focus-visible:ring-amber-500 text-white font-mono tracking-widest text-center text-base rounded-xl h-11"
                  />
                  {codeSentMessage ? (
                    <p className="text-[11px] text-emerald-400 font-medium">✓ {codeSentMessage}</p>
                  ) : (
                    <p className="text-[11px] text-zinc-500">Tap "Send Code to Email &amp; SMS" to receive your authorization OTP.</p>
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={submittingWithdrawal || walletBal < 5}
                  className="w-full h-11 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 hover:opacity-95 text-black font-black text-xs uppercase tracking-wider shadow-lg shadow-amber-500/20"
                >
                  {submittingWithdrawal ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin mr-1.5" />
                      Submitting...
                    </>
                  ) : (
                    "Submit Withdrawal Request"
                  )}
                </Button>
              </form>
            </Card>

            {/* Right: Withdrawal History */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <Clock className="size-4 text-cyan-400" />
                  Withdrawal History
                </h3>
                <span className="text-xs text-zinc-400">
                  Total Disbursed: <strong className="text-white">{formatGHS(totalWithdrawn)}</strong>
                </span>
              </div>

              {withdrawals.length === 0 ? (
                <div className="p-12 rounded-3xl border border-white/10 bg-zinc-900/30 text-center space-y-2">
                  <Wallet className="size-8 text-zinc-600 mx-auto" />
                  <div className="text-sm font-bold text-zinc-400">No withdrawal requests yet</div>
                  <p className="text-xs text-zinc-500">Your requested payouts will appear here with live status updates.</p>
                </div>
              ) : (
                <div className="rounded-3xl border border-white/10 bg-zinc-900/40 overflow-hidden shadow-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-white/[0.03] border-b border-white/10 text-zinc-400 uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="p-3.5 font-bold">Date</th>
                        <th className="p-3.5 font-bold">Network &amp; Number</th>
                        <th className="p-3.5 font-bold">Account Name</th>
                        <th className="p-3.5 font-bold">Amount</th>
                        <th className="p-3.5 font-bold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {withdrawals.map((w) => (
                        <tr key={w.id} className="hover:bg-white/[0.02]">
                          <td className="p-3.5 font-mono text-[11px] text-zinc-400">
                            {w.created_at ? new Date(w.created_at).toLocaleDateString("en-GB") : "N/A"}
                          </td>
                          <td className="p-3.5">
                            <span className="font-bold text-white">{w.momo_network}</span> &bull; <span className="font-mono text-zinc-300">{w.momo_number}</span>
                          </td>
                          <td className="p-3.5 text-zinc-300">{w.momo_name || "N/A"}</td>
                          <td className="p-3.5 font-bold text-amber-400 font-mono">
                            {formatGHS(w.amount)}
                          </td>
                          <td className="p-3.5">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${w.status === "completed" || w.status === "approved"
                                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                                : w.status === "rejected"
                                  ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                                  : "bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse"
                              }`}>
                              {w.status || "pending"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: CUSTOMER REFERRALS & 5GB REWARDS PROGRESS */}
        {activeTab === "referrals" && (
          <div className="space-y-6">
            {/* Top 3 Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-5 rounded-3xl bg-zinc-900/60 border border-amber-500/20 space-y-1.5">
                <div className="text-xs font-bold text-amber-400 flex items-center justify-between">
                  <span>Registered Promoters</span>
                  <Users className="size-4 text-amber-400" />
                </div>
                <div className="text-2xl font-black text-white">{referralStats.total_promoters}</div>
                <div className="text-[11px] text-zinc-400">Customers sharing your store link</div>
              </div>

              <div className="p-5 rounded-3xl bg-zinc-900/60 border border-cyan-500/20 space-y-1.5">
                <div className="text-xs font-bold text-cyan-400 flex items-center justify-between">
                  <span>Referred Customer Orders</span>
                  <ShoppingBag className="size-4 text-cyan-400" />
                </div>
                <div className="text-2xl font-black text-cyan-300">{referralStats.total_referred_orders}</div>
                <div className="text-[11px] text-zinc-400">Total orders placed via promo links</div>
              </div>

              <div className="p-5 rounded-3xl bg-zinc-900/60 border border-emerald-500/20 space-y-1.5">
                <div className="text-xs font-bold text-emerald-400 flex items-center justify-between">
                  <span>5GB Rewards Ready</span>
                  <Gift className="size-4 text-emerald-400" />
                </div>
                <div className="text-2xl font-black text-emerald-300">{referralStats.total_completed_rewards}</div>
                <div className="text-[11px] text-zinc-400">Promoters who reached 5 friends</div>
              </div>
            </div>

            {/* Filter & Live Refresh Controls */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 rounded-3xl bg-zinc-900/60 border border-white/10">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-zinc-500" />
                <Input
                  value={referralSearch}
                  onChange={(e) => setReferralSearch(e.target.value)}
                  placeholder="Search promoter phone or referral code..."
                  className="pl-10 h-10 rounded-2xl bg-zinc-950/60 border-white/10 text-white placeholder:text-zinc-500 text-xs focus-visible:ring-amber-500"
                />
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={() => loadCustomerReferrals()}
                disabled={referralsLoading}
                className="h-10 px-4 rounded-2xl border-white/10 bg-white/5 hover:bg-white/10 text-zinc-300 text-xs font-bold gap-2 shrink-0"
              >
                <RefreshCw className={`size-3.5 ${referralsLoading ? "animate-spin text-amber-400" : ""}`} />
                <span>Refresh Live Progress</span>
              </Button>
            </div>

            {/* Promoters & Progress List */}
            <div className="rounded-3xl bg-zinc-900/60 border border-white/10 overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-white flex items-center gap-2">
                    <Gift className="size-4 text-amber-400" />
                    <span>Customer Referral Network</span>
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Customers who generated a referral link on your store and the friends who bought from them.
                  </p>
                </div>
              </div>

              {referralsLoading && customerReferrals.length === 0 ? (
                <div className="p-12 text-center text-zinc-500 space-y-3">
                  <Loader2 className="size-6 animate-spin mx-auto text-amber-400" />
                  <p className="text-xs">Loading customer promoters and referral progress...</p>
                </div>
              ) : customerReferrals.length === 0 ? (
                <div className="p-12 text-center text-zinc-500 space-y-2">
                  <Gift className="size-8 mx-auto text-zinc-600" />
                  <p className="text-xs font-bold text-zinc-400">No customer promoters registered yet.</p>
                  <p className="text-[11px] text-zinc-500 max-w-sm mx-auto">
                    When customers on your storefront tap "Refer 5 Friends &amp; Get 5GB Free Data", their phone numbers and friend order counts will appear here in real time.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {customerReferrals
                    .filter((r) => {
                      if (!referralSearch.trim()) return true;
                      const q = referralSearch.toLowerCase().trim();
                      return (
                        String(r.customer_phone || "").includes(q) ||
                        String(r.referral_code || "").toLowerCase().includes(q)
                      );
                    })
                    .map((refItem) => {
                      const count = refItem.total_qualified_orders || 0;
                      const isComplete = count >= 5;
                      const pct = Math.min(100, Math.round((count / 5) * 100));
                      const buyers = Array.isArray(refItem.referred_buyers) ? refItem.referred_buyers : [];

                      return (
                        <div key={refItem.id || refItem.customer_phone} className="p-4 sm:p-5 hover:bg-white/[0.02] transition-colors space-y-3">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-sm font-black text-white">
                                  {refItem.customer_phone}
                                </span>
                                {isComplete ? (
                                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                                    🎉 5GB REWARD READY
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                    In Progress ({count}/5)
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-zinc-400 flex items-center gap-2">
                                <span>Code: <strong className="font-mono text-zinc-300">{refItem.referral_code || refItem.customer_phone}</strong></span>
                                <span>•</span>
                                <span>Registered: {new Date(refItem.created_at || Date.now()).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <Button
                                asChild
                                size="sm"
                                variant="outline"
                                className="h-8 text-xs font-bold rounded-xl border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 gap-1.5"
                              >
                                <a
                                  href={`https://wa.me/233${refItem.customer_phone.replace(/\D/g, "").slice(-9)}?text=${encodeURIComponent(
                                    `Hello! From ${agent?.store_name || "Data One"}: You currently have ${count} of 5 friend orders completed for your 5GB Free Data Reward!`
                                  )}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <MessageCircle className="size-3.5" />
                                  <span>Message on WhatsApp</span>
                                </a>
                              </Button>
                            </div>
                          </div>

                          {/* Visual Progress Bar */}
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-zinc-400">Progress towards 5GB MTN reward:</span>
                              <span className={`font-black font-mono ${isComplete ? "text-emerald-400" : "text-amber-400"}`}>
                                {count} / 5 Friends Completed ({pct}%)
                              </span>
                            </div>
                            <div className="h-2 w-full rounded-full bg-zinc-800 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${isComplete ? "bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_12px_rgba(16,185,129,0.5)]" : "bg-gradient-to-r from-amber-500 to-orange-400"}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>

                          {/* Buyers List if any */}
                          {buyers.length > 0 && (
                            <div className="mt-2 p-3 rounded-2xl bg-zinc-950/40 border border-white/5 space-y-1.5">
                              <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                                Friends Who Bought via this Link ({buyers.length})
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {buyers.map((b: any, bIdx: number) => (
                                  <div key={bIdx} className="text-[11px] font-mono px-2.5 py-1 rounded-lg bg-zinc-900 border border-white/10 text-zinc-300 flex items-center gap-1.5">
                                    <span className="size-1.5 rounded-full bg-emerald-400" />
                                    <span>{b.buyer_phone}</span>
                                    {b.order_reference && (
                                      <span className="text-[9px] text-zinc-500">({b.order_reference})</span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB: NOTIFICATION CENTER (WHATSAPP BOT ALERTS) */}
        {activeTab === "notifications" && (
          <div className="space-y-6">
            {/* Header Banner */}
            <div className="rounded-3xl p-6 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-700 text-white shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none text-9xl">🔔</div>
              <div className="relative z-10 space-y-1">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/20 text-xs font-bold uppercase tracking-wider backdrop-blur-md">
                  <Bell className="size-3.5 text-emerald-300" />
                  Agent WhatsApp Notification Center
                </div>
                <h2 className="text-xl md:text-2xl font-black">Instant WhatsApp Store Order Alerts</h2>
                <p className="text-xs md:text-sm opacity-90 max-w-xl">
                  Connect your WhatsApp number to receive an instant alert from our WhatsApp bot the second a customer buys from your store!
                </p>
              </div>
            </div>

            {/* Notification Settings Card */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <div className="p-6 rounded-3xl bg-zinc-900/60 border border-white/10 space-y-5">
                  <div className="flex items-center justify-between border-b border-white/10 pb-4">
                    <div>
                      <h3 className="text-base font-black text-white flex items-center gap-2">
                        <MessageCircle className="size-4 text-emerald-400" />
                        <span>WhatsApp Order Alerts</span>
                      </h3>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        Get a WhatsApp message whenever a customer places and pays for an order on your store.
                      </p>
                    </div>
                    <Switch
                      checked={notifEnabled}
                      onCheckedChange={setNotifEnabled}
                      disabled={savingNotif}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="agent-notif-phone" className="text-xs font-bold text-zinc-300">
                      Your WhatsApp Number for Alerts
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        id="agent-notif-phone"
                        type="tel"
                        placeholder="e.g. 0541234567 or 0535436932"
                        value={notifPhone}
                        onChange={(e) => setNotifPhone(e.target.value)}
                        className="rounded-xl bg-zinc-950/80 border-white/10 text-white font-mono text-sm h-11"
                      />
                      <Button
                        type="button"
                        onClick={saveNotificationSettings}
                        disabled={savingNotif}
                        className="h-11 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shrink-0 shadow-md"
                      >
                        {savingNotif ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4 mr-1.5" />}
                        Save Number
                      </Button>
                    </div>
                    <p className="text-[11px] text-zinc-500">
                      Standard Ghanaian phone number format (024, 054, 055, 059, 020, 050, 026, 057, etc.).
                    </p>
                  </div>

                  {/* Test Alert Button */}
                  <div className="p-4 rounded-2xl bg-zinc-950/80 border border-white/10 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Sparkles className="size-3.5 text-amber-400" />
                        <span>Test Your WhatsApp Connection</span>
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-0.5">
                        Send a free test notification right now to confirm your WhatsApp number is working.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={testNotificationAlert}
                      disabled={testingNotif || !notifPhone}
                      className="h-9 px-4 rounded-xl border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/20 text-xs font-bold shrink-0"
                    >
                      {testingNotif ? (
                        <>
                          <Loader2 className="size-3.5 animate-spin mr-1.5" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Share2 className="size-3.5 mr-1.5" />
                          Send Test WhatsApp Alert
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Recent Notifications Feed */}
                <div className="p-6 rounded-3xl bg-zinc-900/60 border border-white/10 space-y-4">
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <div>
                      <h3 className="text-sm font-black text-white flex items-center gap-2">
                        <Clock className="size-4 text-cyan-400" />
                        <span>Recent Notification History</span>
                      </h3>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        Live log of alerts sent to your WhatsApp by the bot.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={loadNotificationSettings}
                      disabled={notifLoading}
                      className="text-xs text-zinc-400 hover:text-white"
                    >
                      <RefreshCw className={`size-3.5 mr-1 ${notifLoading ? "animate-spin text-cyan-400" : ""}`} />
                      Refresh
                    </Button>
                  </div>

                  {notifLoading && notifLogs.length === 0 ? (
                    <div className="py-8 text-center text-zinc-500">
                      <Loader2 className="size-6 animate-spin mx-auto text-emerald-400" />
                      <p className="text-xs mt-2">Loading alert logs...</p>
                    </div>
                  ) : notifLogs.length === 0 ? (
                    <div className="py-10 text-center text-zinc-500 space-y-1.5">
                      <Bell className="size-8 mx-auto text-zinc-700" />
                      <p className="text-xs font-bold text-zinc-400">No alerts sent yet.</p>
                      <p className="text-[11px] text-zinc-500">
                        When an order is completed on your storefront, your bot notification will appear here and on WhatsApp.
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-white/5">
                      {notifLogs.map((log) => (
                        <div key={log.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                          <div className="space-y-0.5">
                            <div className="font-bold text-white flex items-center gap-2">
                              <span>{log.item || "Data Bundle"}</span>
                              {log.is_test && (
                                <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold">
                                  TEST
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-zinc-400 flex items-center gap-2">
                              <span>Ref: <strong className="font-mono text-zinc-300">{log.order_ref}</strong></span>
                              <span>&bull;</span>
                              <span>To: {log.recipient}</span>
                            </div>
                          </div>
                          <div className="text-right space-y-0.5 shrink-0">
                            <div className="font-black text-emerald-400">
                              +GH₵ {Number(log.profit || 0).toFixed(2)}
                            </div>
                            <div className="text-[10px] text-zinc-500">
                              {log.created_at ? new Date(log.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Delivered"}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: WhatsApp Mockup Preview */}
              <div className="space-y-4">
                <div className="text-xs font-bold uppercase tracking-wider text-zinc-400 px-1">
                  WhatsApp Alert Preview
                </div>
                <div className="p-4 rounded-3xl bg-[#0b141a] border border-[#202c33] text-white shadow-2xl relative space-y-3 font-sans">
                  {/* WhatsApp chat header */}
                  <div className="flex items-center gap-2.5 pb-2 border-b border-[#202c33]">
                    <div className="size-8 rounded-full bg-emerald-600 flex items-center justify-center font-bold text-xs text-white">
                      🤖
                    </div>
                    <div>
                      <div className="font-bold text-xs text-zinc-100 flex items-center gap-1">
                        <span>Data1 GH Bot</span>
                        <CheckCircle2 className="size-3 text-emerald-400 inline" />
                      </div>
                      <div className="text-[10px] text-zinc-400">Official Order Notification</div>
                    </div>
                  </div>

                  {/* WhatsApp chat bubble */}
                  <div className="p-3.5 rounded-2xl bg-[#005c4b] text-white text-xs space-y-2 shadow-md">
                    <div className="font-black text-emerald-200 flex items-center gap-1.5">
                      <span>🎉 NEW ORDER FROM YOUR STORE! 🛍️</span>
                    </div>
                    <div className="text-[11px] opacity-90 border-t border-emerald-400/20 pt-1.5 space-y-1">
                      <div>🏪 <strong>Store:</strong> {agent?.store_name || "Your Store"}</div>
                      <div>🆔 <strong>Ref:</strong> WS-9M2K8P</div>
                      <div>📶 <strong>Item:</strong> 5GB MTN Data</div>
                      <div>📱 <strong>Recipient:</strong> 0541234567</div>
                      <div>💰 <strong>Customer Paid:</strong> GH₵ 24.50</div>
                      <div className="text-emerald-200 font-bold">💵 <strong>Your Profit:</strong> GH₵ 4.50</div>
                      <div>⚡ <strong>Status:</strong> Delivered</div>
                      <div>⏰ <strong>Time:</strong> Just now</div>
                    </div>
                    <div className="text-[9px] text-emerald-200/70 text-right pt-0.5">
                      ✓✓ Delivered
                    </div>
                  </div>

                  <p className="text-[11px] text-zinc-400 p-2 text-center bg-zinc-900/60 rounded-xl border border-white/5">
                    This is the exact notification our WhatsApp bot will send directly to your phone (<strong>{notifPhone || agent?.whatsapp_number || "your number"}</strong>) whenever an order is completed!
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: LIVE DELIVERY TRACKER */}
        {activeTab === "tracker" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-3xl bg-zinc-900/60 border border-white/10">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 flex items-center justify-center">
                  <Radio className="size-5 animate-pulse text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-base font-black text-white flex items-center gap-2">
                    <span>Live Order &amp; Delivery Network Monitor</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Realtime
                    </span>
                  </h2>
                  <p className="text-xs text-zinc-400">
                    Live telemetry for fast-lane data deliveries, pending batches, and network gateway status.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveTab("orders")}
                  className="h-8 rounded-xl border-cyan-500/30 bg-cyan-500/10 text-cyan-300 text-xs font-bold gap-1.5"
                >
                  <ShoppingBag className="size-3.5" />
                  <span>View Today&apos;s Orders</span>
                </Button>
              </div>
            </div>

            <DeliveryTracker />
          </div>
        )}

        {/* TAB: STOREFRONT ANNOUNCEMENT POP-UP (DEDICATED MENU VIEW) */}
        {activeTab === "announcement" && (
          <Card className="max-w-3xl mx-auto p-6 md:p-8 rounded-3xl border border-purple-500/30 bg-gradient-to-b from-zinc-900/90 via-zinc-950/80 to-black text-white shadow-2xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
              <div className="flex items-start gap-3">
                <div className="size-11 rounded-2xl bg-gradient-to-br from-purple-500/30 to-cyan-500/30 border border-purple-400/40 text-purple-300 flex items-center justify-center shrink-0 shadow-lg shadow-purple-500/20">
                  <Megaphone className="size-6 text-purple-300 animate-bounce" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-white flex items-center gap-2">
                    Storefront Announcement Pop-Up
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Configure a high-converting announcement modal that automatically pops up in the center of the screen when customers open your store.
                  </p>
                </div>
              </div>

              {/* Status & Live Toggle */}
              <div className="flex items-center gap-3 p-3 rounded-2xl bg-black/60 border border-white/10 shrink-0">
                <div className="text-right">
                  <div className="text-xs font-black text-white flex items-center gap-1.5 justify-end">
                    <span>{announcementPopupEnabled ? "Pop-Up Active" : "Pop-Up Off"}</span>
                    <span className={`size-2 rounded-full ${announcementPopupEnabled ? "bg-emerald-400 animate-pulse" : "bg-zinc-500"}`} />
                  </div>
                  <div className="text-[10px] text-zinc-400">
                    {announcementPopupEnabled ? "Shown to visitors" : "Hidden"}
                  </div>
                </div>
                <Switch
                  checked={announcementPopupEnabled}
                  onCheckedChange={setAnnouncementPopupEnabled}
                  className="data-[state=checked]:bg-purple-500"
                />
              </div>
            </div>

            {/* Announcement Form */}
            <form onSubmit={handleSaveSettings} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                    <span>Pop-Up Headline / Title</span>
                    <span className="text-[10px] text-purple-400 font-mono">*</span>
                  </Label>
                  <Input
                    value={announcementPopupTitle}
                    onChange={(e) => setAnnouncementPopupTitle(e.target.value)}
                    placeholder="e.g. ⚡ Weekend Special: 10GB for GH₵49 Only!"
                    className="bg-black/60 border-white/15 focus-visible:ring-purple-500 text-white rounded-xl text-xs h-10"
                  />
                  <p className="text-[10px] text-zinc-500">Big bold gradient headline shown at the top of the modal.</p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                    <span>Header Tag / Badge Text</span>
                  </Label>
                  <Input
                    value={announcementPopupBadge}
                    onChange={(e) => setAnnouncementPopupBadge(e.target.value)}
                    placeholder="e.g. ⚡ Special Promo or 📢 Store Notice"
                    className="bg-black/60 border-white/15 focus-visible:ring-purple-500 text-white rounded-xl text-xs h-10"
                  />
                  <p className="text-[10px] text-zinc-500">Highlighted pill above the title.</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                  <span>Announcement Message / Description</span>
                  <span className="text-[10px] text-purple-400 font-mono">*</span>
                </Label>
                <Textarea
                  rows={4}
                  value={announcementPopupMessage}
                  onChange={(e) => setAnnouncementPopupMessage(e.target.value)}
                  placeholder="e.g. Welcome to our official store! Grab our cheapest non-expiry data packages today with instant automated network delivery directly to your phone."
                  className="bg-black/60 border-white/15 focus-visible:ring-purple-500 text-white rounded-xl text-xs leading-relaxed"
                />
                <p className="text-[10px] text-zinc-500">Main announcement body shown to customers. Supports paragraphs and emojis.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-zinc-300">
                    Action Button (CTA) Text
                  </Label>
                  <Input
                    value={announcementPopupCtaText}
                    onChange={(e) => setAnnouncementPopupCtaText(e.target.value)}
                    placeholder="e.g. Shop Deals Now"
                    className="bg-black/60 border-white/15 focus-visible:ring-purple-500 text-white rounded-xl text-xs h-10"
                  />
                  <p className="text-[10px] text-zinc-500">Label of the main glowing action button.</p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-zinc-300">
                    Button Action Link (Optional)
                  </Label>
                  <Input
                    value={announcementPopupCtaUrl}
                    onChange={(e) => setAnnouncementPopupCtaUrl(e.target.value)}
                    placeholder="Leave blank to scroll to bundles, or enter URL"
                    className="bg-black/60 border-white/15 focus-visible:ring-purple-500 text-white rounded-xl text-xs h-10 font-mono"
                  />
                  <p className="text-[10px] text-zinc-500">Custom target link or leave blank to smoothly scroll to products.</p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setTestPopupOpen(true)}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-purple-400/40 bg-purple-500/15 hover:bg-purple-500/25 text-purple-200 text-xs font-bold transition-all"
                >
                  <Eye className="size-4" />
                  <span>Test Live Pop-Up on Screen</span>
                </button>

                <div className="flex items-center gap-2.5 w-full sm:w-auto">
                  <a
                    href={publicStoreUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-zinc-300 text-xs font-bold transition-all"
                  >
                    <ExternalLink className="size-3.5" />
                    <span>View Store</span>
                  </a>

                  <Button
                    type="submit"
                    disabled={savingSettings}
                    className="w-full sm:w-auto px-6 py-2.5 rounded-xl font-black text-xs bg-gradient-to-r from-purple-500 via-fuchsia-500 to-cyan-500 hover:from-purple-400 hover:to-cyan-400 text-white shadow-lg shadow-purple-500/30 flex items-center justify-center gap-2 h-10"
                  >
                    {savingSettings ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                    <span>{savingSettings ? "Publishing Pop-Up..." : "Save & Publish Pop-Up"}</span>
                  </Button>
                </div>
              </div>
            </form>
          </Card>
        )}

        {/* TAB 4: STOREFRONT SETTINGS */}
        {activeTab === "settings" && (
          <Card className="max-w-2xl mx-auto p-6 md:p-8 rounded-3xl border border-cyan-500/30 bg-zinc-900/60 text-white space-y-6">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Store className="size-5 text-cyan-400" />
                Storefront Branding &amp; Contact Settings
              </h3>
              <p className="text-xs text-zinc-400 mt-1">
                Customize your store name, clean storefront link domain, description, and WhatsApp contact link for your customers.
              </p>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-4">
              {/* Storefront Logo Upload */}
              <div className="space-y-2 p-4 rounded-2xl bg-black/40 border border-white/10">
                <Label className="text-xs font-semibold text-zinc-300 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <ImageIcon className="size-4 text-cyan-400" />
                    Store Logo & Preview Image
                  </span>
                  <span className="text-[10px] text-zinc-400 font-mono">PNG, JPG, WebP</span>
                </Label>

                <div className="flex flex-col sm:flex-row items-center gap-4 pt-1">
                  {/* Logo Preview */}
                  <div className="size-20 rounded-2xl border-2 border-dashed border-white/20 bg-zinc-900/80 flex items-center justify-center overflow-hidden shrink-0 shadow-inner relative group">
                    {logoUrl ? (
                      <img
                        src={logoUrl}
                        alt="Store Logo Preview"
                        className="size-full object-cover"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-zinc-500">
                        <Store className="size-6 mb-1 text-zinc-600" />
                        <span className="text-[9px] uppercase font-bold tracking-wider">No Logo</span>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 space-y-2 w-full">
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/25 text-xs font-bold transition-all shadow-xs">
                        {uploadingLogo ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Upload className="size-3.5" />
                        )}
                        <span>{uploadingLogo ? "Processing..." : logoUrl ? "Change Logo" : "Upload Logo"}</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleLogoFileChange}
                          className="hidden"
                        />
                      </label>

                      {logoUrl && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setLogoUrl("");
                            if (agent?.id) {
                              localStorage.removeItem(`data1_agent_logo_${agent.id}`);
                            }
                          }}
                          className="h-8 px-2 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 text-xs font-semibold gap-1"
                        >
                          <Trash2 className="size-3.5" />
                          <span>Remove</span>
                        </Button>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-relaxed">
                      Upload your official store logo or avatar. This image will appear on your storefront and in WhatsApp link previews when sharing your store link.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="s_name" className="text-xs font-semibold text-zinc-300">
                  Store / Brand Name
                </Label>
                <Input
                  id="s_name"
                  required
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  className="bg-black/60 border-white/15 focus-visible:ring-cyan-500 text-white rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="s_domain" className="text-xs font-semibold text-zinc-300 flex items-center justify-between">
                  <span>Store Domain Prefix (Dedicated Agent Domain)</span>
                  <span className="text-[10px] text-emerald-400 font-semibold">Separate from Main Shop</span>
                </Label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setCustomDomain("https://gooddata1.vercel.app")}
                    className={`py-2 px-3 rounded-xl text-xs font-mono border transition-all text-left ${customDomain === "https://gooddata1.vercel.app"
                        ? "border-cyan-400 bg-cyan-500/20 text-cyan-300 font-bold"
                        : "border-white/10 bg-black/40 text-zinc-400 hover:text-white"
                      }`}
                  >
                    https://gooddata1.vercel.app
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomDomain("https://gooddata.shop")}
                    className={`py-2 px-3 rounded-xl text-xs font-mono border transition-all text-left ${customDomain === "https://gooddata.shop"
                        ? "border-cyan-400 bg-cyan-500/20 text-cyan-300 font-bold"
                        : "border-white/10 bg-black/40 text-zinc-400 hover:text-white"
                      }`}
                  >
                    https://gooddata.shop
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomDomain("https://gooddatagh.com")}
                    className={`py-2 px-3 rounded-xl text-xs font-mono border transition-all text-left ${customDomain === "https://gooddatagh.com"
                        ? "border-cyan-400 bg-cyan-500/20 text-cyan-300 font-bold"
                        : "border-white/10 bg-black/40 text-zinc-400 hover:text-white"
                      }`}
                  >
                    https://gooddatagh.com
                  </button>
                </div>
                <Input
                  id="s_domain"
                  value={customDomain}
                  onChange={(e) => setCustomDomain(e.target.value)}
                  placeholder="https://gooddata1.vercel.app or your custom domain"
                  className="bg-black/60 border-white/15 focus-visible:ring-cyan-500 text-cyan-300 font-mono rounded-xl text-xs mt-1"
                />
                <p className="text-[11px] text-zinc-500">
                  Select your dedicated agent domain or enter your custom domain configured on Vercel (e.g. <code>gooddata1.vercel.app</code>). Your customer link will never expose Data One.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="s_slug" className="text-xs font-semibold text-zinc-300 flex items-center justify-between">
                  <span>Store URL Slug</span>
                  <span className="text-[10px] font-mono text-cyan-400">{publicStoreUrl}</span>
                </Label>
                <Input
                  id="s_slug"
                  required
                  value={storeSlug}
                  onChange={(e) => setStoreSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "-"))}
                  className="bg-black/60 border-white/15 focus-visible:ring-cyan-500 text-cyan-300 font-mono rounded-xl text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="s_desc" className="text-xs font-semibold text-zinc-300">
                  Store Description
                </Label>
                <Textarea
                  id="s_desc"
                  rows={2}
                  value={storeDesc}
                  onChange={(e) => setStoreDesc(e.target.value)}
                  placeholder="Tell your customers about your speed and automated delivery..."
                  className="bg-black/60 border-white/15 focus-visible:ring-cyan-500 text-white rounded-xl text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="s_wa" className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                  <MessageCircle className="size-3.5 text-emerald-400" />
                  Your Customer WhatsApp Support Number
                </Label>
                <Input
                  id="s_wa"
                  value={whatsappNum}
                  onChange={(e) => setWhatsappNum(e.target.value)}
                  placeholder="e.g. 0541234567"
                  className="bg-black/60 border-white/15 focus-visible:ring-cyan-500 text-white rounded-xl"
                />
                <p className="text-[11px] text-zinc-500">
                  Customers on your storefront can click this button to chat with you directly.
                </p>
              </div>

              {/* WhatsApp Channel / Community Group Link */}
              <div className="space-y-1.5">
                <Label htmlFor="s_wa_group" className="text-xs font-semibold text-zinc-300 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Users className="size-3.5 text-emerald-400" />
                    WhatsApp Channel / Group Link
                  </span>
                  <span className="text-[10px] text-emerald-400 font-bold">Floating Button on Storefront</span>
                </Label>
                <Input
                  id="s_wa_group"
                  value={whatsappGroupUrl}
                  onChange={(e) => setWhatsappGroupUrl(e.target.value)}
                  placeholder="e.g. https://chat.whatsapp.com/XXXXX or https://whatsapp.com/channel/XXXXX"
                  className="bg-black/60 border-white/15 focus-visible:ring-emerald-500 text-white font-mono text-xs rounded-xl"
                />
                <p className="text-[11px] text-zinc-500">
                  Paste your WhatsApp Group or Channel invite link here. Customers visiting your storefront will see a floating WhatsApp button to join your community directly!
                </p>
              </div>

              {/* Dedicated WhatsApp Bot Store Link */}
              <div className="space-y-1.5 p-3.5 rounded-2xl bg-emerald-950/20 border border-emerald-500/30">
                <Label className="text-xs font-semibold text-emerald-300 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <MessageCircle className="size-3.5 text-emerald-400" />
                    Dedicated WhatsApp Bot Store Link
                  </span>
                  <span className="text-[10px] text-emerald-400 font-bold uppercase">Automated Store</span>
                </Label>
                <div className="flex items-center gap-2 pt-1">
                  <Input
                    readOnly
                    value={getWhatsAppBotStoreUrl()}
                    className="bg-black/60 border-white/10 text-zinc-300 font-mono rounded-xl text-xs flex-1 select-all"
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleCopyBotLink}
                    className="h-9 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shrink-0"
                  >
                    {copiedBotLink ? <Check className="size-3.5 mr-1" /> : <Copy className="size-3.5 mr-1" />}
                    <span>{copiedBotLink ? "Copied" : "Copy"}</span>
                  </Button>
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed pt-1">
                  Customers who tap this link will chat with our automated bot branded as <strong>{storeName || agent.store_name}</strong> and see only your custom selling prices.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="space-y-1.5">
                  <Label htmlFor="s_momo" className="text-xs font-semibold text-zinc-300">
                    Default Payout MoMo Number
                  </Label>
                  <Input
                    id="s_momo"
                    value={momoNumber}
                    onChange={(e) => setMomoNumber(e.target.value)}
                    placeholder="054xxxxxxx"
                    className="bg-black/60 border-white/15 focus-visible:ring-cyan-500 text-white rounded-xl font-mono text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="s_momo_net" className="text-xs font-semibold text-zinc-300">
                    Default Payout Network
                  </Label>
                  <Select value={momoNetwork} onValueChange={setMomoNetwork}>
                    <SelectTrigger id="s_momo_net" className="bg-black/60 border-white/15 text-white rounded-xl text-xs">
                      <SelectValue placeholder="Network" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MTN">MTN</SelectItem>
                      <SelectItem value="TELECEL">Telecel</SelectItem>
                      <SelectItem value="AT">AT</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* 5 STOREFRONT DESIGN THEMES SELECTOR */}
              <div className="space-y-3 pt-4 border-t border-white/10">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <Label className="text-sm font-black text-white flex items-center gap-2">
                      <Palette className="size-4 text-cyan-400" />
                      <span>Storefront Design Theme &amp; Layout (5 Styles)</span>
                    </Label>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      Select your preferred store appearance. Changing this immediately customizes your customer-facing storefront's aura, colors, glow, and layout!
                    </p>
                  </div>

                  <a
                    href={publicStoreUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white text-xs font-bold transition-all w-fit shrink-0"
                  >
                    <Eye className="size-3.5 text-cyan-400" />
                    <span>View Live Store</span>
                  </a>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
                  {STORE_THEMES.map((th) => {
                    const isSelected = storeTheme === th.id;
                    return (
                      <div
                        key={th.id}
                        onClick={() => setStoreTheme(th.id)}
                        className={`relative rounded-2xl p-4 cursor-pointer transition-all border text-left flex flex-col justify-between overflow-hidden group ${isSelected
                            ? `${th.cardBorder} ring-2 ring-offset-2 ring-offset-zinc-950 ring-cyan-400 bg-zinc-900/90 shadow-xl`
                            : "border-white/10 bg-black/40 hover:border-white/25 hover:bg-zinc-900/40"
                          }`}
                      >
                        {/* Background aura snippet */}
                        <div
                          className="absolute -top-10 -right-10 size-24 rounded-full blur-2xl opacity-20 pointer-events-none transition-all group-hover:opacity-35"
                          style={{ backgroundColor: th.primaryColor }}
                        />

                        <div className="space-y-2 relative z-10">
                          {/* Top Row: Theme Badge & Selection Radio */}
                          <div className="flex items-center justify-between">
                            <span
                              className="px-2 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase border"
                              style={{
                                color: th.primaryColor,
                                borderColor: `${th.primaryColor}55`,
                                backgroundColor: `${th.primaryColor}15`,
                              }}
                            >
                              {th.badge}
                            </span>

                            <div
                              className={`size-5 rounded-full flex items-center justify-center border transition-all ${isSelected
                                  ? "border-cyan-400 bg-cyan-400 text-black shadow-[0_0_10px_rgba(6,182,212,0.6)]"
                                  : "border-white/20 bg-black/60 group-hover:border-white/40"
                                }`}
                            >
                              {isSelected && <Check className="size-3 stroke-[3]" />}
                            </div>
                          </div>

                          {/* Theme Name & Tagline */}
                          <div>
                            <div className="text-sm font-black text-white flex items-center gap-1.5">
                              <span>{th.name}</span>
                              {th.id === "gold" && <Crown className="size-3 text-amber-400" />}
                            </div>
                            <div className="text-[11px] text-zinc-400 font-medium leading-snug">
                              {th.tagline}
                            </div>
                          </div>

                          {/* Color Palette Preview Swatches */}
                          <div className="flex items-center gap-1.5 pt-1">
                            <span
                              className="size-4 rounded-full shadow-xs border border-white/20"
                              style={{ backgroundColor: th.primaryColor }}
                              title="Primary accent"
                            />
                            <span
                              className="size-4 rounded-full shadow-xs border border-white/20"
                              style={{ backgroundColor: th.secondaryColor }}
                              title="Secondary glow"
                            />
                            <div className="h-1 flex-1 rounded-full bg-white/10 overflow-hidden ml-1">
                              <div
                                className={`h-full bg-gradient-to-r ${th.btnGradient}`}
                                style={{ width: "100%" }}
                              />
                            </div>
                          </div>

                          <p className="text-[11px] text-zinc-400 leading-relaxed pt-1">
                            {th.description}
                          </p>
                        </div>

                        {/* Interactive Mini UI Preview Card */}
                        <div className="mt-3 pt-2.5 border-t border-white/10 relative z-10">
                          <div className="flex items-center justify-between text-[11px] font-bold">
                            <span className="text-zinc-400">Preview:</span>
                            <span
                              className="font-mono font-black"
                              style={{ color: th.primaryColor }}
                            >
                              GH₵ 12.00
                            </span>
                          </div>
                          <div
                            className={`mt-1.5 w-full py-1 text-center rounded-lg text-[10px] font-black uppercase tracking-wider bg-gradient-to-r ${th.btnGradient} ${th.id === "frost" || th.id === "sunset" ? "text-white" : "text-black"
                              }`}
                          >
                            Buy Bundle
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <Button
                type="submit"
                disabled={savingSettings}
                className="w-full h-11 rounded-xl bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400 hover:opacity-95 text-black font-black text-xs uppercase tracking-wider shadow-md shadow-cyan-500/20 mt-3"
              >
                {savingSettings ? <Loader2 className="size-4 animate-spin mr-2" /> : <Check className="size-4 mr-1.5" />}
                <span>Save Storefront Settings</span>
              </Button>
            </form>
          </Card>
        )}

        {/* PAYMENT FAILURE DETAILS DIALOG */}
        <Dialog open={failureModalOpen} onOpenChange={setFailureModalOpen}>
          <DialogContent className="sm:max-w-md bg-zinc-950 border border-rose-500/30 text-white p-6 rounded-3xl shadow-[0_10px_50px_rgba(244,63,94,0.25)]">
            <DialogHeader className="text-center space-y-2">
              <div className="size-14 rounded-2xl bg-rose-600/20 border border-rose-500/40 text-rose-400 flex items-center justify-center mx-auto shadow-[0_0_25px_rgba(244,63,94,0.3)]">
                <AlertCircle className="size-7 text-rose-400" />
              </div>
              <DialogTitle className="text-xl sm:text-2xl font-black tracking-tight text-white">
                Payment Failure Reason
              </DialogTitle>
              <DialogDescription className="text-xs text-zinc-400">
                Order Reference: <span className="font-mono text-cyan-300 font-bold">{selectedFailureOrder?.reference}</span>
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 mt-2">
              {/* Reason Explanation Card */}
              <div className="p-4 rounded-2xl bg-rose-950/20 border border-rose-500/30 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-rose-300">
                  <AlertCircle className="size-4 text-rose-400" />
                  <span>Why Payment Could Not Complete:</span>
                </div>
                <p className="text-sm font-black text-rose-100 leading-snug">
                  {formatPaymentFailureReason(selectedFailureOrder?.error_message)}
                </p>
                {selectedFailureOrder?.error_message && (
                  <p className="text-[11px] font-mono text-zinc-400 pt-1 border-t border-rose-500/20">
                    Gateway Response: &quot;{selectedFailureOrder.error_message}&quot;
                  </p>
                )}
              </div>

              {/* Order Metadata */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-3 rounded-2xl bg-white/[0.04] border border-white/10 space-y-0.5">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 block">
                    Customer Phone
                  </span>
                  <span className="font-mono font-bold text-white">
                    {selectedFailureOrder?.phone || selectedFailureOrder?.recipient_phone || "N/A"}
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-white/[0.04] border border-white/10 space-y-0.5">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 block">
                    Order Package
                  </span>
                  <span className="font-bold text-white">
                    {selectedFailureOrder?.network} &bull; {selectedFailureOrder?.package_size || "Data"}
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-white/[0.04] border border-white/10 space-y-0.5">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 block">
                    Expected Amount
                  </span>
                  <span className="font-bold text-white">
                    {formatGHS(selectedFailureOrder?.amount || 0)}
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-white/[0.04] border border-white/10 space-y-0.5">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 block">
                    Date &amp; Time
                  </span>
                  <span className="font-mono text-[11px] text-zinc-300">
                    {selectedFailureOrder?.created_at ? new Date(selectedFailureOrder.created_at).toLocaleString("en-GB") : "N/A"}
                  </span>
                </div>
              </div>

              {/* What Agent Can Do */}
              <div className="p-3.5 rounded-2xl bg-zinc-900 border border-white/10 text-xs text-zinc-300 space-y-1.5">
                <span className="text-[10px] uppercase font-bold tracking-wider text-cyan-400 block">
                  How To Recover This Sale:
                </span>
                <p className="text-[11px] leading-relaxed text-zinc-400">
                  Customers often just need to top up their MoMo wallet or enter their correct PIN. You can reach out directly on WhatsApp to assist them with retrying their order.
                </p>
              </div>

              {/* WhatsApp Customer Action Button */}
              {(() => {
                const rawPhone = String(selectedFailureOrder?.phone || selectedFailureOrder?.recipient_phone || "").replace(/\D/g, "");
                const waPhone = rawPhone.startsWith("0") ? "233" + rawPhone.slice(1) : rawPhone;
                const failureMsg = formatPaymentFailureReason(selectedFailureOrder?.error_message);
                const waText = `Hello! Thank you for ordering from ${storeName}. We noticed your payment for order ${selectedFailureOrder?.reference || ""} did not go through (${failureMsg}). Would you like assistance to complete your purchase?`;
                const waHref = waPhone ? `https://wa.me/${waPhone}?text=${encodeURIComponent(waText)}` : "";

                return waHref ? (
                  <Button
                    asChild
                    className="w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs gap-2 shadow-lg shadow-emerald-950/30"
                  >
                    <a href={waHref} target="_blank" rel="noreferrer">
                      <MessageCircle className="size-4" />
                      <span>Contact Customer on WhatsApp to Recover Sale</span>
                    </a>
                  </Button>
                ) : null;
              })()}
            </div>
          </DialogContent>
        </Dialog>

        {/* NETFLIX SIGN-IN CODE DIALOG */}
        <Dialog open={netflixModalOpen} onOpenChange={setNetflixModalOpen}>
          <DialogContent className="sm:max-w-md bg-zinc-950 border border-red-500/30 text-white p-6 rounded-3xl shadow-[0_10px_50px_rgba(239,68,68,0.25)]">
            <DialogHeader className="text-center space-y-2">
              <div className="size-14 rounded-2xl bg-red-600/20 border border-red-500/40 text-red-500 flex items-center justify-center mx-auto shadow-[0_0_25px_rgba(239,68,68,0.3)]">
                <Play className="size-7 fill-red-500 text-red-500" />
              </div>
              <DialogTitle className="text-xl sm:text-2xl font-black tracking-tight text-white">
                Netflix Sign-In Code
              </DialogTitle>
              <DialogDescription className="text-xs text-zinc-400">
                Order Ref: <span className="font-mono text-zinc-200">{selectedNetflixOrder?.reference}</span>
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 mt-2">
              {/* Customer & Order Details */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-3 rounded-2xl bg-white/[0.04] border border-white/10 space-y-0.5">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 block">
                    Customer Phone
                  </span>
                  <span className="font-mono font-bold text-white">
                    {selectedNetflixOrder?.phone || selectedNetflixOrder?.customer_phone || "N/A"}
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-white/[0.04] border border-white/10 space-y-0.5">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 block">
                    Your Profit
                  </span>
                  <span className="font-mono font-bold text-emerald-400">
                    +{formatGHS(selectedNetflixOrder?.agent_profit || 0)}
                  </span>
                </div>
              </div>

              {/* Account Email */}
              <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/10 space-y-1">
                <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 block">
                  Netflix Account Email
                </span>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-mono font-bold text-white break-all">
                    {netflixEmail}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(netflixEmail);
                      toast.success("Account email copied!");
                    }}
                    className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
                    title="Copy email"
                  >
                    <Copy className="size-4" />
                  </button>
                </div>
              </div>

              {/* Code Display */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-red-950/40 via-zinc-900 to-black border border-red-500/30 text-center space-y-2">
                <span className="text-[10px] uppercase font-bold tracking-wider text-red-400 block">
                  Sign-In Code Delivered
                </span>
                {netflixCode ? (
                  <div className="flex items-center justify-center gap-3">
                    <div className="text-3xl sm:text-4xl font-mono font-black tracking-widest text-white py-1">
                      {netflixCode}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(netflixCode);
                        setCopiedNetflixCode(true);
                        setTimeout(() => setCopiedNetflixCode(false), 2000);
                        toast.success("Netflix code copied!");
                      }}
                      className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all active:scale-95"
                    >
                      {copiedNetflixCode ? <Check className="size-5 text-emerald-400" /> : <Copy className="size-5" />}
                    </button>
                  </div>
                ) : (
                  <div className="py-2 text-xs text-zinc-400">
                    No sign-in code assigned yet. The code will appear here once delivered.
                  </div>
                )}

                {netflixCodeAt && (
                  <div className="text-[10px] text-zinc-500 font-mono">
                    Delivered: {new Date(netflixCodeAt).toLocaleTimeString("en-GB")}
                  </div>
                )}
              </div>

              <div className="text-[11px] text-zinc-400 leading-relaxed space-y-1 bg-black/40 p-3 rounded-xl border border-white/5">
                <div className="font-bold text-zinc-300">Order Information:</div>
                <div>• Customer receives the sign-in code via SMS automatically once generated.</div>
                <div>• For code inquiries or account support, please contact the master administrator.</div>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Storefront Announcement Pop-Up Test Preview */}
        <AgentStoreAnnouncementModal
          open={testPopupOpen}
          onOpenChange={setTestPopupOpen}
          title={announcementPopupTitle}
          message={announcementPopupMessage}
          badge={announcementPopupBadge}
          ctaText={announcementPopupCtaText}
          ctaUrl={announcementPopupCtaUrl}
          storeName={storeName || agent?.store_name || "Your Store"}
          logoUrl={logoUrl || agent?.logo_url}
          themeId={storeTheme}
          isDashboardPreview={true}
        />
      </main>
    </div>
  );
};

export default AgentDashboard;
