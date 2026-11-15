import { useEffect, useState } from "react";
import { supabase, invokeApiFunction } from "@/integrations/supabase/client";
import { invalidateShopCache } from "@/lib/storeCache";
import { getCacheMeta, setCache, invalidateCache } from "@/lib/localCache";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Play,
  IdCard,
  Save,
  Search,
  Edit2,
  Trash2,
  RefreshCw,
  Mail,
  Key,
  CheckCircle2,
  AlertTriangle,
  Zap,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Copy,
  Eye,
  EyeOff,
  Globe,
  Check,
  Terminal,
  UserPlus,
  Plus,
  Minus,
  Users,
  Wallet,
  Sparkles,
  Rocket,
} from "lucide-react";
import { toast } from "sonner";
import { PhoneLink } from "@/components/PhoneLink";

interface ServiceOrder {
  id: string;
  service: "netflix" | "afa" | "mashup" | "boost";
  customer_email: string;
  customer_phone: string;
  customer_name: string | null;
  amount: number;
  reference: string;
  payment_status: string;
  delivery_status: string;
  netflix_login_expires_at: string | null;
  netflix_last_code: string | null;
  netflix_last_code_at: string | null;
  created_at: string;
  notes?: string | null;
  boost_service_id?: string | number | null;
  boost_service_name?: string | null;
  boost_platform?: string | null;
  boost_link?: string | null;
  boost_quantity?: number | null;
  boost_order_id?: string | null;
  boost_status?: string | null;
  boost_dispatch_error?: string | null;
}

const AdminServices = () => {
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("netflix");
  const [netflixPrice, setNetflixPrice] = useState("30");
  const [afaPrice, setAfaPrice] = useState("20");
  const [mashupPrice, setMashupPrice] = useState("25");
  const [boostMarkupPercent, setBoostMarkupPercent] = useState("20");
  const [agentBoostDefaultPercent, setAgentBoostDefaultPercent] = useState("25");
  const [applyingBoostToAll, setApplyingBoostToAll] = useState(false);
  const [boostUpApiKey, setBoostUpApiKey] = useState("");
  const [boostUpBalance, setBoostUpBalance] = useState<string | null>(null);
  const [loadingBoostBalance, setLoadingBoostBalance] = useState(false);
  const [savingBoostSettings, setSavingBoostSettings] = useState(false);
  const [dispatchingOrderRef, setDispatchingOrderRef] = useState<string | null>(null);
  const [showBoostKey, setShowBoostKey] = useState(false);
  const [savingPrices, setSavingPrices] = useState(false);
  const [search, setSearch] = useState("");

  // Netflix & Gmail Integration state
  const [netflixEmail, setNetflixEmail] = useState("stillmoving11@gmail.com");
  const [gmailEmail, setGmailEmail] = useState("");
  const [gmailClientId, setGmailClientId] = useState(
    "695163322385-grjddchnib6ambq30ojrc1581ck6s180.apps.googleusercontent.com"
  );
  const [gmailClientSecret, setGmailClientSecret] = useState("");
  const [hasClientSecret, setHasClientSecret] = useState(false);
  const [gmailRefreshToken, setGmailRefreshToken] = useState("");
  const [gmailAccessToken, setGmailAccessToken] = useState("");
  const [gmailConnected, setGmailConnected] = useState(false);
  const [savingGmailSettings, setSavingGmailSettings] = useState(false);
  const [testingGmail, setTestingGmail] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [showManualTokens, setShowManualTokens] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);

  // Partner / Reseller API state
  const [partnerApiKey, setPartnerApiKey] = useState("");
  const [partnerPrice, setPartnerPrice] = useState("25");
  const [partnerWallet, setPartnerWallet] = useState("0");
  const [requireWallet, setRequireWallet] = useState(true);
  const [topupAmount, setTopupAmount] = useState("");
  const [showPartnerKey, setShowPartnerKey] = useState(false);
  const [savingPartnerSettings, setSavingPartnerSettings] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedDoc, setCopiedDoc] = useState(false);

  // Multi-Partner Accounts state
  const [partners, setPartners] = useState<{
    id: string;
    name: string;
    phone?: string;
    website?: string;
    api_key: string;
    wholesale_price: number;
    wallet_balance: number;
    status: "active" | "disabled";
    total_orders?: number;
    created_at: string;
  }[]>([]);
  const [addPartnerOpen, setAddPartnerOpen] = useState(false);
  const [newPartnerName, setNewPartnerName] = useState("");
  const [newPartnerPhone, setNewPartnerPhone] = useState("");
  const [newPartnerPrice, setNewPartnerPrice] = useState("25");
  const [newPartnerWallet, setNewPartnerWallet] = useState("100");
  const [topupTargetPartner, setTopupTargetPartner] = useState<any | null>(null);
  const [partnerTopupInput, setPartnerTopupInput] = useState("");
  const [walletActionMode, setWalletActionMode] = useState<"add" | "deduct">("add");
  const [savingNewPartner, setSavingNewPartner] = useState(false);

  // Edit Partner state
  const [editingPartner, setEditingPartner] = useState<any | null>(null);
  const [editPartnerName, setEditPartnerName] = useState("");
  const [editPartnerPhone, setEditPartnerPhone] = useState("");
  const [editPartnerPrice, setEditPartnerPrice] = useState("25");
  const [savingEditPartner, setSavingEditPartner] = useState(false);

  // Edit dialog state
  const [editOrder, setEditOrder] = useState<ServiceOrder | null>(null);
  const [editCode, setEditCode] = useState("");
  const [editDeliveryStatus, setEditDeliveryStatus] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // Quick code dialog state
  const [quickCodeOrder, setQuickCodeOrder] = useState<ServiceOrder | null>(null);
  const [quickCodeInput, setQuickCodeInput] = useState("");
  const [savingQuickCode, setSavingQuickCode] = useState(false);

  const load = async (force = false) => {
    if (!force) {
      const cached = getCacheMeta<any>("admin_services_cache");
      if (cached.exists && cached.data) {
        if (cached.data.orders) setOrders(cached.data.orders);
        if (cached.data.netflixPrice) setNetflixPrice(cached.data.netflixPrice);
        if (cached.data.afaPrice) setAfaPrice(cached.data.afaPrice);
        if (cached.data.mashupPrice) setMashupPrice(cached.data.mashupPrice);
        setLoading(false);
        if (!cached.isStale) return;
      }
    }

    setLoading(true);
    let loaded = false;
    let freshOrders: ServiceOrder[] = [];
    let curNf = netflixPrice;
    let curAfa = afaPrice;
    let curMashup = mashupPrice;

    try {
      const { data, error } = await invokeApiFunction("admin-services", {
        body: { action: "overview" },
      });
      if (!error && !data?.error && data?.services) {
        freshOrders = data.services || [];
        setOrders(freshOrders);
        if (data?.netflix_price) { curNf = String(data.netflix_price); setNetflixPrice(curNf); }
        if (data?.afa_price) { curAfa = String(data.afa_price); setAfaPrice(curAfa); }
        if (data?.mashup_price) { curMashup = String(data.mashup_price); setMashupPrice(curMashup); }
        if (data?.boost_markup_percent) { setBoostMarkupPercent(String(data.boost_markup_percent)); }
        if (data?.default_agent_boost_markup_percent !== undefined) { setAgentBoostDefaultPercent(String(data.default_agent_boost_markup_percent)); }
        if (data?.boostupgh_api_key) { setBoostUpApiKey(String(data.boostupgh_api_key)); }
        if (data?.boost_balance) { setBoostUpBalance(`${data.boost_balance} GHS`); }
        setCache("admin_services_cache", { orders: freshOrders, netflixPrice: curNf, afaPrice: curAfa, mashupPrice: curMashup }, 60 * 1000);
        loaded = true;
      }
    } catch (_) {}

    // Resilient fallback: Query service_orders & settings directly from Supabase
    if (!loaded) {
      try {
        const [ordersRes, settingsRes] = await Promise.all([
          supabase.from("service_orders").select("id, reference, service_type, package_type, customer_phone, phone, amount, payment_status, delivery_status, created_at, status, notes").order("created_at", { ascending: false }).limit(100),
          supabase.from("settings").select("key, value").in("key", ["netflix_price", "afa_price", "mashup_price"]),
        ]);
        if (ordersRes.data) {
          freshOrders = ordersRes.data as unknown as ServiceOrder[];
          setOrders(freshOrders);
        }
        (settingsRes.data || []).forEach((row: any) => {
          if (row.key === "netflix_price" && row.value) { curNf = String(row.value); setNetflixPrice(curNf); }
          if (row.key === "afa_price" && row.value) { curAfa = String(row.value); setAfaPrice(curAfa); }
          if (row.key === "mashup_price" && row.value) { curMashup = String(row.value); setMashupPrice(curMashup); }
        });
        setCache("admin_services_cache", { orders: freshOrders, netflixPrice: curNf, afaPrice: curAfa, mashupPrice: curMashup }, 60 * 1000);
      } catch (err: any) {
        console.error("Direct fallback load error:", err);
      }
    }
    setLoading(false);
  };

  const loadGmailSettings = async () => {
    let loaded = false;
    try {
      const { data, error } = await invokeApiFunction("netflix-settings", {
        body: { action: "get" },
      });
      if (!error && data && !data?.error) {
        if (data.netflix_account_email) setNetflixEmail(data.netflix_account_email);
        if (data.gmail_account_email) setGmailEmail(data.gmail_account_email);
        if (data.netflix_partner_api_key) setPartnerApiKey(data.netflix_partner_api_key);
        if (data.netflix_partner_price) setPartnerPrice(String(data.netflix_partner_price));
        if (data.netflix_partner_wallet !== undefined) setPartnerWallet(String(data.netflix_partner_wallet));
        if (data.netflix_partner_require_wallet !== undefined) setRequireWallet(Boolean(data.netflix_partner_require_wallet));
        if (data.netflix_partners && Array.isArray(data.netflix_partners)) {
          setPartners(data.netflix_partners);
        }
        if (data.gmail_client_id) {
          setGmailClientId(String(data.gmail_client_id).trim().replace(/\s+/g, "-"));
        } else {
          setGmailClientId("695163322385-grjddchnib6ambq30ojrc1581ck6s180.apps.googleusercontent.com");
        }
        setHasClientSecret(Boolean(data.has_client_secret || (typeof window !== "undefined" && localStorage.getItem("gmail_saved_client_secret"))));
        const isConn = Boolean(
          data.is_connected ||
          data.has_refresh_token ||
          data.has_access_token ||
          data.gmail_account_email
        );
        setGmailConnected(isConn);
        loaded = true;
      }
    } catch (e) {
      console.error("Failed to load Netflix/Gmail settings:", e);
    }

    if (!loaded) {
      try {
        const { data: sRows } = await supabase
          .from("settings")
          .select("key, value")
          .in("key", ["netflix_account_email", "gmail_account_email", "gmail_client_id", "gmail_client_secret", "gmail_refresh_token", "gmail_access_token", "netflix_price", "afa_price", "mashup_price", "netflix_partner_api_key", "netflix_partner_price", "netflix_partner_wallet", "netflix_partner_require_wallet", "netflix_partners"]);
        const smap: Record<string, string> = {};
        (sRows || []).forEach((r: any) => { if (r?.key) smap[r.key] = r.value; });
        if (smap.netflix_account_email) setNetflixEmail(smap.netflix_account_email);
        if (smap.gmail_account_email) setGmailEmail(smap.gmail_account_email);
        if (smap.netflix_partner_api_key) setPartnerApiKey(smap.netflix_partner_api_key);
        if (smap.netflix_partner_price) setPartnerPrice(String(smap.netflix_partner_price));
        if (smap.netflix_partner_wallet !== undefined) setPartnerWallet(String(smap.netflix_partner_wallet));
        if (smap.netflix_partner_require_wallet !== undefined) setRequireWallet(smap.netflix_partner_require_wallet === "true");
        if (smap.netflix_partners) {
          try { setPartners(JSON.parse(smap.netflix_partners)); } catch (_) {}
        }
        if (smap.gmail_client_id) {
          setGmailClientId(String(smap.gmail_client_id).trim().replace(/\s+/g, "-"));
        } else {
          setGmailClientId("695163322385-grjddchnib6ambq30ojrc1581ck6s180.apps.googleusercontent.com");
        }
        setHasClientSecret(Boolean(smap.gmail_client_secret || (typeof window !== "undefined" && localStorage.getItem("gmail_saved_client_secret"))));
        const isConn = Boolean(
          smap.gmail_refresh_token ||
          smap.gmail_access_token ||
          smap.gmail_account_email
        );
        setGmailConnected(isConn);
      } catch (directErr) {
        console.warn("Direct settings fallback error:", directErr);
      }
    }
  };

  // Detect Google OAuth redirect callback (?code=...)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const googleCode = urlParams.get("code");
    const googleError = urlParams.get("error");

    if (googleError) {
      window.history.replaceState({}, document.title, window.location.pathname);
      toast.error(`Google authorization error: ${googleError}`);
      setActiveTab("gmail");
      return;
    }

    if (googleCode) {
      (async () => {
        toast.info("Exchanging Google authorization code for Gmail access…");
        try {
          const redirectUri = `${window.location.origin}/admin/services`;
          const storedClientId = (typeof window !== "undefined" && sessionStorage.getItem("gmail_pending_client_id")) || undefined;
          let storedClientSecret = (typeof window !== "undefined" && sessionStorage.getItem("gmail_pending_client_secret")) || undefined;
          if (!storedClientSecret && typeof window !== "undefined") {
            storedClientSecret = localStorage.getItem("gmail_saved_client_secret") || undefined;
          }

          const { data, error } = await invokeApiFunction("gmail-callback", {
            body: {
              code: googleCode,
              redirect_uri: redirectUri,
              client_id: storedClientId,
              client_secret: storedClientSecret,
            },
          });

          // Clean URL params cleanly without reloading
          window.history.replaceState({}, document.title, window.location.pathname);

          if (error || data?.error) {
            const msg = data?.error || error?.message || "Failed to link Gmail with Google";
            toast.error(msg);
            setActiveTab("gmail");
          } else {
            toast.success(data?.message || `Gmail connected as ${data?.email || "Netflix admin"}!`);
            setGmailConnected(true);
            if (data?.email) {
              setGmailEmail(data.email);
              setNetflixEmail(data.email);
            }
            setActiveTab("gmail");
            await loadGmailSettings();
          }
        } catch (err: any) {
          toast.error(err.message || "OAuth exchange failed");
          setActiveTab("gmail");
        }
      })();
    }
  }, []);

  useEffect(() => {
    load();
    loadGmailSettings();
  }, []);

  const savePrices = async () => {
    const n = Number(netflixPrice);
    const a = Number(afaPrice);
    const m = Number(mashupPrice);
    if (!(n > 0) || !(a > 0) || !(m > 0)) {
      toast.error("Prices must be positive numbers");
      return;
    }
    setSavingPrices(true);
    let success = false;
    let lastError = "";

    // 1. Try admin-services API first (uses backend service role to bypass client RLS)
    try {
      const { data, error } = await invokeApiFunction("admin-services", {
        body: { action: "setPrices", netflix_price: n, afa_price: a, mashup_price: m },
      });
      if (!error && (data?.ok || (!data?.error && (data?.netflix_price !== undefined || data?.afa_price !== undefined)))) {
        success = true;
      } else if (error || data?.error) {
        lastError = data?.error || error?.message || "";
      }
    } catch (err: any) {
      lastError = err?.message || "";
    }

    // 2. Direct Supabase client upsert fallback
    if (!success) {
      try {
        const { error: upsertErr } = await supabase.from("settings").upsert([
          { key: "netflix_price", value: String(n) },
          { key: "afa_price", value: String(a) },
          { key: "mashup_price", value: String(m) },
        ], { onConflict: "key" });
        if (!upsertErr) {
          success = true;
        } else {
          lastError = upsertErr.message || lastError;
        }
      } catch (e: any) {
        lastError = e?.message || lastError;
      }
    }

    // 3. Fallback to admin-data API
    if (!success) {
      try {
        const { data, error } = await invokeApiFunction("admin-data", {
          body: {
            action: "saveSettings",
            settings: [
              { key: "netflix_price", value: String(n) },
              { key: "afa_price", value: String(a) },
              { key: "mashup_price", value: String(m) },
            ],
          },
        });
        if (!error && (data?.ok || !data?.error)) {
          success = true;
        } else if (error || data?.error) {
          lastError = data?.error || error?.message || lastError;
        }
      } catch (err: any) {
        lastError = err?.message || lastError;
      }
    }

    setSavingPrices(false);
    if (!success) {
      toast.error(lastError ? `Could not save prices: ${lastError}` : "Could not save prices. Please verify connection.");
      return;
    }

    // Update local React state
    setNetflixPrice(String(n));
    setAfaPrice(String(a));
    setMashupPrice(String(m));

    // Overwrite the local cache with the newly saved values so re-renders NEVER bounce back
    const currentCached = getCacheMeta<any>("admin_services_cache")?.data || {};
    setCache("admin_services_cache", {
      ...currentCached,
      orders: orders,
      netflixPrice: String(n),
      afaPrice: String(a),
      mashupPrice: String(m),
    }, 60 * 1000);

    invalidateCache("admin_services_cache");
    invalidateShopCache();
    window.dispatchEvent(new CustomEvent("shop-cache-invalidated"));
    toast.success("Prices updated successfully!");
  };

  const fetchBoostBalance = async () => {
    setLoadingBoostBalance(true);
    try {
      const { data, error } = await invokeApiFunction("boost-balance");
      if (error || data?.error) {
        toast.error(data?.error || error?.message || "Failed to fetch BoostUpGH balance");
      } else {
        const balValue = data?.balance !== undefined ? data.balance : data?.data?.balance;
        const curValue = data?.currency || data?.data?.currency || "GHS";
        const cleanBalStr = balValue !== undefined && balValue !== null ? String(balValue).trim() : "";
        if (cleanBalStr !== "" && cleanBalStr !== "undefined" && cleanBalStr !== "null") {
          const displayBal = `${cleanBalStr} ${curValue}`;
          setBoostUpBalance(displayBal);
          toast.success(`BoostUpGH Balance: ${displayBal}`);
        } else {
          toast.error("Could not parse balance from BoostUpGH response");
        }
      }
    } catch (e: any) {
      toast.error(e?.message || "Error fetching BoostUpGH balance");
    } finally {
      setLoadingBoostBalance(false);
    }
  };

  const handleSaveBoostSettings = async () => {
    setSavingBoostSettings(true);
    try {
      const { data, error } = await invokeApiFunction("admin-services", {
        body: {
          action: "saveBoostSettings",
          boost_markup_percent: Number(boostMarkupPercent) || 20,
          default_agent_boost_markup_percent: Number(agentBoostDefaultPercent) || 25,
          boostupgh_api_key: boostUpApiKey.trim() || undefined,
        },
      });
      if (error || data?.error) {
        toast.error(data?.error || error?.message || "Failed to save BoostUpGH settings");
      } else {
        toast.success("BoostUpGH settings saved successfully!");
        if (boostUpApiKey.trim()) {
          fetchBoostBalance();
        }
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed to save settings");
    } finally {
      setSavingBoostSettings(false);
    }
  };

  const handleApplyBoostToAllAgentsNow = async () => {
    const num = Number(agentBoostDefaultPercent);
    if (isNaN(num) || num < 0 || num > 500) {
      toast.error("Please enter a valid percentage (0-500%)");
      return;
    }
    if (!confirm(`Are you sure you want to set +${num}% Social Boost margin on ALL reseller stores?`)) {
      return;
    }
    setApplyingBoostToAll(true);
    try {
      const res = await invokeApiFunction("agent", {
        body: {
          action: "setAllAgentsBoostMarkup",
          boost_markup_percent: num,
        },
      });
      if (res?.data?.ok) {
        toast.success(`🎉 Applied +${num}% Social Boost margin to all ${res?.data?.updated_count || ""} resellers!`);
      } else {
        toast.error(res?.data?.error || "Failed to update all agents.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to apply margin.");
    } finally {
      setApplyingBoostToAll(false);
    }
  };

  const handleDispatchBoostOrder = async (order: ServiceOrder) => {
    setDispatchingOrderRef(order.reference);
    try {
      const { data, error } = await invokeApiFunction("boost-dispatch", {
        body: { reference: order.reference },
      });
      if (error || data?.error) {
        toast.error(data?.error || error?.message || "Dispatch failed");
      } else {
        toast.success(`Dispatched to BoostUpGH! Order ID: #${data.boost_order_id}`);
        load(true);
      }
    } catch (e: any) {
      toast.error(e?.message || "Dispatch error");
    } finally {
      setDispatchingOrderRef(null);
    }
  };

  const handleSaveNetflixEmail = async () => {
    if (!netflixEmail.trim() || !netflixEmail.includes("@")) {
      toast.error("Please enter a valid email address");
      return;
    }
    setSavingGmailSettings(true);
    const { data, error } = await invokeApiFunction("netflix-settings", {
      body: {
        action: "save",
        netflix_account_email: netflixEmail.trim(),
      },
    });
    setSavingGmailSettings(false);
    if (error || data?.error) {
      toast.error(data?.error || error?.message || "Failed to save email");
      return;
    }
    toast.success("Netflix account email saved successfully");
  };

  const handleSaveGmailCredentials = async () => {
    setSavingGmailSettings(true);
    const body: Record<string, any> = {
      action: "save",
      netflix_account_email: netflixEmail.trim(),
    };
    const cleanSecret = gmailClientSecret.trim();
    if (gmailClientId.trim()) body.gmail_client_id = gmailClientId.trim();
    if (cleanSecret) {
      body.gmail_client_secret = cleanSecret;
      if (typeof window !== "undefined") {
        localStorage.setItem("gmail_saved_client_secret", cleanSecret);
      }
    }
    if (gmailRefreshToken.trim()) body.gmail_refresh_token = gmailRefreshToken.trim();
    if (gmailAccessToken.trim()) body.gmail_access_token = gmailAccessToken.trim();

    const { data, error } = await invokeApiFunction("netflix-settings", { body });
    setSavingGmailSettings(false);
    if (error || data?.error) {
      toast.error(data?.error || error?.message || "Failed to save credentials");
      return;
    }
    toast.success("Gmail credentials saved successfully!");
    setHasClientSecret(true);
    const isConn = Boolean(
      data?.is_connected ||
      data?.has_refresh_token ||
      data?.has_access_token ||
      gmailRefreshToken.trim() ||
      gmailAccessToken.trim()
    );
    setGmailConnected(isConn);
  };

  const handleStartGoogleOAuth = async () => {
    let clientId = gmailClientId.trim().replace(/^["'`]+|["'`]+$/g, "").trim().replace(/\s+/g, "-");
    let secret = gmailClientSecret.trim().replace(/^["'`]+|["'`]+$/g, "").trim();

    if (!secret && typeof window !== "undefined") {
      secret = localStorage.getItem("gmail_saved_client_secret") || "";
    }

    if (!clientId) {
      toast.error("Please enter your Google Client ID below first");
      setActiveTab("gmail");
      return;
    }

    if (clientId.startsWith("GOCSPX-")) {
      toast.error("You pasted the Client Secret into the Client ID box! Google Client ID must end with .apps.googleusercontent.com");
      setActiveTab("gmail");
      return;
    }

    if (!clientId.endsWith(".apps.googleusercontent.com")) {
      toast.error("Google Client ID must end with .apps.googleusercontent.com (e.g. 695163322385-...apps.googleusercontent.com)");
      setActiveTab("gmail");
      return;
    }

    if (secret && secret.endsWith(".apps.googleusercontent.com")) {
      toast.error("You pasted the Client ID into the Client Secret box! Client Secret usually starts with GOCSPX-");
      setActiveTab("gmail");
      return;
    }

    if (!secret && !hasClientSecret) {
      toast.error("Please paste your Google Client Secret (starts with GOCSPX-) in box #2 below before connecting!");
      setActiveTab("gmail");
      return;
    }

    try {
      if (typeof window !== "undefined") {
        sessionStorage.setItem("gmail_pending_client_id", clientId);
        if (secret) {
          sessionStorage.setItem("gmail_pending_client_secret", secret);
          localStorage.setItem("gmail_saved_client_secret", secret);
        }
      }

      // Persist in settings table before redirect
      await invokeApiFunction("netflix-settings", {
        body: {
          action: "save",
          gmail_client_id: clientId,
          gmail_client_secret: secret || undefined,
          netflix_account_email: netflixEmail.trim(),
        },
      });

      const redirectUri = `${window.location.origin}/admin/services`;
      const { data, error } = await invokeApiFunction("gmail-auth-url", {
        body: { client_id: clientId, redirect_uri: redirectUri },
      });

      if (error || data?.error || !data?.auth_url) {
        // Fallback to building directly with prompt=consent so Google forces refresh_token
        const scope = encodeURIComponent(
          "https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/userinfo.email"
        );
        const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(
          clientId
        )}&redirect_uri=${encodeURIComponent(
          redirectUri
        )}&response_type=code&scope=${scope}&access_type=offline&prompt=consent&include_granted_scopes=true`;
        window.location.href = url;
        return;
      }

      window.location.href = data.auth_url;
      return;
    } catch (e: any) {
      toast.error(e.message || "Failed to initiate Google authorization");
    }
  };

  const handleTestGmail = async () => {
    setTestingGmail(true);
    setTestResult(null);
    try {
      const { data, error } = await invokeApiFunction("test-gmail");
      if (error) throw error;
      setTestResult(data);
      if (data?.ok) {
        toast.success(`Connected as ${data.email}! Found ${data.netflix_emails_found} Netflix emails.`);
        setGmailConnected(true);
        if (data.email) setGmailEmail(data.email);
      } else {
        toast.error(data?.error || "Gmail test failed");
      }
    } catch (e: any) {
      toast.error(e.message || "Gmail test failed");
      setTestResult({ ok: false, error: e.message });
    } finally {
      setTestingGmail(false);
    }
  };

  const handleSavePartnerSettings = async (customWallet?: string, customRequire?: boolean) => {
    setSavingPartnerSettings(true);
    try {
      const walletToSave = customWallet !== undefined ? customWallet : partnerWallet;
      const requireToSave = customRequire !== undefined ? customRequire : requireWallet;
      const { data, error } = await invokeApiFunction("netflix-settings", {
        body: {
          action: "save",
          netflix_partner_api_key: partnerApiKey.trim(),
          netflix_partner_price: partnerPrice.trim(),
          netflix_partner_wallet: walletToSave,
          netflix_partner_require_wallet: String(requireToSave),
        },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message || "Failed to save");
      toast.success("Partner settings saved successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to save partner settings");
    } finally {
      setSavingPartnerSettings(false);
    }
  };

  const handleTopupPartnerWallet = async () => {
    const amt = parseFloat(topupAmount);
    if (isNaN(amt) || amt <= 0) {
      toast.error("Please enter a valid top-up amount");
      return;
    }
    const currentBal = parseFloat(partnerWallet) || 0;
    const newBal = (currentBal + amt).toFixed(2);
    setPartnerWallet(newBal);
    setTopupAmount("");
    await handleSavePartnerSettings(newBal);
    toast.success(`Successfully credited GH₵ ${amt.toFixed(2)} to partner wallet! New Balance: GH₵ ${newBal}`);
  };

  const handleCreateNewPartner = async () => {
    if (!newPartnerName.trim()) {
      toast.error("Please enter a partner name");
      return;
    }
    setSavingNewPartner(true);
    try {
      const cleanSlug = newPartnerName.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
      const randomHex = Math.random().toString(36).substring(2, 8) + Math.random().toString(36).substring(2, 8);
      const newKey = `d1_live_nf_${cleanSlug || "p"}_${randomHex}`;
      const partnerObj = {
        id: `partner_${Date.now()}`,
        name: newPartnerName.trim(),
        phone: newPartnerPhone.trim() || undefined,
        api_key: newKey,
        wholesale_price: Number(newPartnerPrice) || 25,
        wallet_balance: Number(newPartnerWallet) || 0,
        status: "active" as const,
        total_orders: 0,
        created_at: new Date().toISOString(),
      };
      const updated = [...partners, partnerObj];
      setPartners(updated);
      await invokeApiFunction("netflix-settings", {
        body: {
          action: "save",
          netflix_partners: updated,
        },
      });
      toast.success(`Partner "${partnerObj.name}" created! API Key generated.`);
      setAddPartnerOpen(false);
      setNewPartnerName("");
      setNewPartnerPhone("");
    } catch (err: any) {
      toast.error(err.message || "Failed to create partner");
    } finally {
      setSavingNewPartner(false);
    }
  };

  const handleTopupSpecificPartner = async () => {
    if (!topupTargetPartner) return;
    const amt = parseFloat(partnerTopupInput);
    if (isNaN(amt) || amt <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    const isDeduct = walletActionMode === "deduct";
    const currentBal = Number(topupTargetPartner.wallet_balance || 0);
    const newBal = isDeduct ? Math.max(0, Number((currentBal - amt).toFixed(2))) : Number((currentBal + amt).toFixed(2));

    const updated = partners.map((p) => {
      if (p.id === topupTargetPartner.id) {
        return {
          ...p,
          wallet_balance: newBal,
        };
      }
      return p;
    });
    setPartners(updated);
    try {
      await invokeApiFunction("netflix-settings", {
        body: {
          action: "save",
          netflix_partners: updated,
        },
      });
      if (isDeduct) {
        toast.success(`Deducted GH₵ ${amt.toFixed(2)} from ${topupTargetPartner.name}! New Balance: GH₵ ${newBal.toFixed(2)}${newBal === 0 ? " (Now OUT OF STOCK)" : ""}`);
      } else {
        toast.success(`Credited GH₵ ${amt.toFixed(2)} to ${topupTargetPartner.name}! New Balance: GH₵ ${newBal.toFixed(2)}`);
      }
      setTopupTargetPartner(null);
      setPartnerTopupInput("");
    } catch (e: any) {
      toast.error(e.message || "Failed to update partner wallet");
    }
  };

  const handleTogglePartnerStatus = async (partnerId: string) => {
    const updated = partners.map((p) => {
      if (p.id === partnerId) {
        return {
          ...p,
          status: p.status === "active" ? ("disabled" as const) : ("active" as const),
        };
      }
      return p;
    });
    setPartners(updated);
    try {
      await invokeApiFunction("netflix-settings", {
        body: { action: "save", netflix_partners: updated },
      });
      toast.success("Partner status updated");
    } catch (e: any) {
      toast.error(e.message || "Failed to update status");
    }
  };

  const handleOpenEditPartner = (p: any) => {
    setEditingPartner(p);
    setEditPartnerName(p.name || "");
    setEditPartnerPhone(p.phone || "");
    setEditPartnerPrice(String(p.wholesale_price ?? 25));
  };

  const handleSaveEditedPartner = async () => {
    if (!editingPartner) return;
    if (!editPartnerName.trim()) {
      toast.error("Please enter a partner name");
      return;
    }
    const priceNum = parseFloat(editPartnerPrice);
    if (isNaN(priceNum) || priceNum < 0) {
      toast.error("Please enter a valid wholesale price (GH₵)");
      return;
    }

    setSavingEditPartner(true);
    try {
      const updated = partners.map((p) => {
        if (p.id === editingPartner.id) {
          return {
            ...p,
            name: editPartnerName.trim(),
            phone: editPartnerPhone.trim() || undefined,
            wholesale_price: priceNum,
          };
        }
        return p;
      });
      setPartners(updated);
      await invokeApiFunction("netflix-settings", {
        body: { action: "save", netflix_partners: updated },
      });
      toast.success(`Partner "${editPartnerName.trim()}" updated! Wholesale rate set to GH₵ ${priceNum}.`);
      setEditingPartner(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to update partner");
    } finally {
      setSavingEditPartner(false);
    }
  };

  const handleDeletePartner = async (partnerId: string, partnerName: string) => {
    if (!confirm(`Are you sure you want to permanently delete partner "${partnerName}"? Their API key will stop working immediately.`)) {
      return;
    }
    const updated = partners.filter((p) => p.id !== partnerId);
    setPartners(updated);
    try {
      await invokeApiFunction("netflix-settings", {
        body: { action: "save", netflix_partners: updated },
      });
      toast.success(`Partner "${partnerName}" has been deleted.`);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete partner");
    }
  };

  const handleRegenerateSpecificPartnerKey = async (partnerId: string) => {
    if (!confirm("Are you sure you want to regenerate this partner's API key? Their old key will immediately stop working.")) return;
    const randomHex = Math.random().toString(36).substring(2, 8) + Math.random().toString(36).substring(2, 8);
    const updated = partners.map((p) => {
      if (p.id === partnerId) {
        const cleanSlug = p.name.toLowerCase().replace(/[^a-z0-9]/g, "");
        return {
          ...p,
          api_key: `d1_live_nf_${cleanSlug || "p"}_${randomHex}`,
        };
      }
      return p;
    });
    setPartners(updated);
    try {
      await invokeApiFunction("netflix-settings", {
        body: { action: "save", netflix_partners: updated },
      });
      toast.success("New API key generated and saved!");
    } catch (e: any) {
      toast.error(e.message || "Failed to update key");
    }
  };

  const copySpecificPartnerDocs = (p: any) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "https://data1.shop";
    const docText = `# Data1 — Netflix Reseller API Documentation
### Partner: ${p.name}
### Wholesale Rate: GH₵ ${p.wholesale_price} per 30-day access

### Base URL:
${origin}/api/partner/netflix

### Authentication:
Pass your API key in every request using the header:
x-api-key: ${p.api_key}

---

## 1. Create Netflix 30-Day Order
Call this when a customer buys Netflix on your website.

- **Method**: POST
- **Endpoint**: ${origin}/api/partner/netflix/order
- **Headers**:
  x-api-key: ${p.api_key}
  Content-Type: application/json
- **Request Body (JSON)**:
{
  "customer_name": "Customer Name",
  "customer_phone": "0541234567",
  "customer_email": "customer@gmail.com",
  "partner_reference": "YOUR_INTERNAL_ORDER_ID",
  "duration_days": 30
}

- **Response**:
{
  "status": "success",
  "message": "Netflix 30-Day access created successfully.",
  "order": {
    "reference": "NF-P-XXXXXX",
    "partner_reference": "YOUR_INTERNAL_ORDER_ID",
    "netflix_email": "${netflixEmail}",
    "status": "active",
    "duration_days": 30,
    "expires_at": "..."
  }
}

---

## 2. Fetch Netflix Sign-In Code
Call this when your customer clicks "Get Code" on your website to log in.

- **Method**: POST
- **Endpoint**: ${origin}/api/partner/netflix/fetch-code
- **Headers**:
  x-api-key: ${p.api_key}
  Content-Type: application/json
- **Request Body (JSON)**:
{
  "reference": "NF-P-XXXXXX"
}

- **Success Response**:
{
  "status": "success",
  "code": "4820",
  "netflix_email": "${netflixEmail}",
  "expires_in": "15 minutes"
}

---

## 3. Check Stock / Availability
Call this to verify if Netflix is currently in stock for your API key.
*Note: If your partner wallet balance is zero or below wholesale rate, this returns OUT OF STOCK.*

- **Method**: GET
- **Endpoint**: ${origin}/api/partner/netflix/stock
- **Headers**:
  x-api-key: ${p.api_key}

- **Response (When In Stock)**:
{
  "status": "success",
  "in_stock": true,
  "service": "netflix",
  "wallet_balance": 100,
  "wholesale_price": ${p.wholesale_price}
}

- **Response (When Balance is Zero / Out of Stock)**:
{
  "status": "out_of_stock",
  "in_stock": false,
  "error": "Out of stock. Partner wallet balance is zero or insufficient.",
  "wallet_balance": 0
}

---

## 4. Check Order Status
- **Method**: GET
- **Endpoint**: ${origin}/api/partner/netflix/status?reference=NF-P-XXXXXX
`;

    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(docText);
      toast.success(`API documentation copied for ${p.name}! Ready to send.`);
    }
  };

  const handleRegeneratePartnerKey = async () => {
    if (!confirm("Are you sure you want to regenerate the Partner API Key? The old key will stop working immediately.")) return;
    const randomHex = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
    const newKey = `bj_live_nf_${randomHex}`;
    setPartnerApiKey(newKey);
    setSavingPartnerSettings(true);
    try {
      await invokeApiFunction("netflix-settings", {
        body: {
          action: "save",
          netflix_partner_api_key: newKey,
          netflix_partner_price: partnerPrice.trim(),
          netflix_partner_wallet: partnerWallet,
          netflix_partner_require_wallet: String(requireWallet),
        },
      });
      toast.success("New Partner API Key generated and saved!");
    } catch (err: any) {
      toast.error(err.message || "Failed to save new key");
    } finally {
      setSavingPartnerSettings(false);
    }
  };

  const copyPartnerDocumentation = () => {
    const origin = typeof window !== "undefined" ? window.location.origin : "https://data1.shop";
    const docText = `# Data1 — Netflix Reseller API Documentation

### Base URL:
${origin}/api/partner/netflix

### Authentication:
Pass your API key in every request using the header:
x-api-key: ${partnerApiKey || "YOUR_PARTNER_API_KEY"}

---

## 1. Create Netflix 30-Day Order
Call this when a customer buys Netflix on your website.

- **Method**: POST
- **Endpoint**: ${origin}/api/partner/netflix/order
- **Headers**:
  x-api-key: ${partnerApiKey || "YOUR_PARTNER_API_KEY"}
  Content-Type: application/json
- **Request Body (JSON)**:
{
  "customer_name": "Customer Name",
  "customer_phone": "0541234567",
  "customer_email": "customer@gmail.com",
  "partner_reference": "YOUR_INTERNAL_ORDER_ID",
  "duration_days": 30
}

- **Response**:
{
  "status": "success",
  "message": "Netflix 30-Day access created successfully.",
  "order": {
    "reference": "NF-P-XXXXXX",
    "netflix_email": "${netflixEmail}",
    "status": "active",
    "duration_days": 30,
    "expires_at": "..."
  }
}

---

## 2. Fetch Netflix Sign-In Code
Call this when your customer clicks "Get Code" on your website to log in.

- **Method**: POST
- **Endpoint**: ${origin}/api/partner/netflix/fetch-code
- **Headers**:
  x-api-key: ${partnerApiKey || "YOUR_PARTNER_API_KEY"}
  Content-Type: application/json
- **Request Body (JSON)**:
{
  "reference": "NF-P-XXXXXX"
}

- **Success Response**:
{
  "status": "success",
  "code": "4820",
  "netflix_email": "${netflixEmail}",
  "expires_in": "15 minutes"
}

- **Pending Response (if code email has not arrived yet)**:
{
  "status": "pending",
  "code": null,
  "error": "No sign-in code email found in mailbox yet. Enter email on Netflix, tap 'Send sign-in code', wait 20 seconds, and request again.",
  "retryable": true
}

---

## 3. Check Stock / Availability
Call this to verify if Netflix is currently in stock for your API key.
*Note: If your partner wallet balance is zero or below wholesale rate, this returns OUT OF STOCK.*

- **Method**: GET
- **Endpoint**: ${origin}/api/partner/netflix/stock
- **Headers**:
  x-api-key: ${partnerApiKey || "YOUR_PARTNER_API_KEY"}

- **Response (When In Stock)**:
{
  "status": "success",
  "in_stock": true,
  "service": "netflix",
  "wallet_balance": 100
}

- **Response (When Balance is Zero / Out of Stock)**:
{
  "status": "out_of_stock",
  "in_stock": false,
  "error": "Out of stock. Partner wallet balance is zero or insufficient."
}

---

## 4. Check Order Status
- **Method**: GET
- **Endpoint**: ${origin}/api/partner/netflix/status?reference=NF-P-XXXXXX
`;

    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(docText);
      setCopiedDoc(true);
      toast.success("Complete Partner API Documentation copied to clipboard!");
      setTimeout(() => setCopiedDoc(false), 3000);
    }
  };

  const handleOpenEdit = (o: ServiceOrder) => {
    setEditOrder(o);
    setEditCode(o.netflix_last_code || "");
    setEditDeliveryStatus(o.delivery_status || "pending");
  };

  const handleSaveEdit = async () => {
    if (!editOrder) return;
    setSavingEdit(true);
    try {
      const { data, error } = await invokeApiFunction("admin-services", {
        body: {
          action: "updateOrder",
          id: editOrder.id,
          reference: editOrder.reference,
          delivery_status: editDeliveryStatus,
          netflix_last_code: editCode.trim() || null,
        },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message || "Update failed");
      toast.success("Order updated");
      setOrders((prev) =>
        prev.map((o) =>
          o.id === editOrder.id
            ? {
                ...o,
                delivery_status: editDeliveryStatus,
                netflix_last_code: editCode.trim() || null,
                netflix_last_code_at: editCode.trim() ? new Date().toISOString() : o.netflix_last_code_at,
              }
            : o
        )
      );
      setEditOrder(null);
    } catch (e: any) {
      toast.error(e.message || "Failed to update order");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleOpenQuickCode = (o: ServiceOrder) => {
    setQuickCodeOrder(o);
    setQuickCodeInput(o.netflix_last_code || "");
  };

  const handleSaveQuickCode = async () => {
    if (!quickCodeOrder) return;
    const code = quickCodeInput.trim();
    if (!code) {
      toast.error("Please enter a code");
      return;
    }
    setSavingQuickCode(true);
    try {
      const { data, error } = await invokeApiFunction("admin-services", {
        body: {
          action: "updateOrder",
          id: quickCodeOrder.id,
          reference: quickCodeOrder.reference,
          delivery_status: "active",
          netflix_last_code: code,
        },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message || "Failed to set code");
      toast.success(`Code ${code} saved! Delivered to customer.`);
      setOrders((prev) =>
        prev.map((o) =>
          o.id === quickCodeOrder.id
            ? {
                ...o,
                delivery_status: "active",
                netflix_last_code: code,
                netflix_last_code_at: new Date().toISOString(),
              }
            : o
        )
      );
      setQuickCodeOrder(null);
    } catch (e: any) {
      toast.error(e.message || "Failed to save code");
    } finally {
      setSavingQuickCode(false);
    }
  };

  const [fetchingCodeRef, setFetchingCodeRef] = useState<string | null>(null);

  const handleFetchCodeFromGmail = async (order: ServiceOrder) => {
    setFetchingCodeRef(order.reference);
    try {
      const { data, error } = await invokeApiFunction("netflix-fetch-code", {
        body: { reference: order.reference, force: true, resend_sms: true },
      });
      if (error || data?.error) {
        throw new Error(data?.error || error?.message || "Failed to fetch code");
      }
      if (data?.code) {
        toast.success(`Netflix Code fetched: ${data.code} (Delivered via SMS)`);
        setOrders((prev) =>
          prev.map((o) =>
            o.reference === order.reference
              ? {
                  ...o,
                  delivery_status: "active",
                  netflix_last_code: data.code,
                  netflix_last_code_at: data.email_at || new Date().toISOString(),
                }
              : o
          )
        );
      } else {
        toast.info(data?.message || "No sign-in code email found in recent Netflix emails yet.");
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to fetch code from Gmail");
    } finally {
      setFetchingCodeRef(null);
    }
  };

  const handleDelete = async (id: string, ref: string) => {
    if (!confirm(`Are you sure you want to delete order ${ref}?`)) return;
    try {
      const { data, error } = await invokeApiFunction("admin-services", {
        body: { action: "deleteOrder", id, reference: ref },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message || "Delete failed");
      toast.success("Order deleted");
      setOrders((prev) => prev.filter((o) => o.id !== id));
    } catch (e: any) {
      toast.error(e.message || "Failed to delete order");
    }
  };

  const q = search.trim().toLowerCase();
  const filtered = orders.filter((o) => {
    if (!q) return true;
    return (
      o.reference.toLowerCase().includes(q) ||
      o.customer_phone.includes(q) ||
      (o.customer_name && o.customer_name.toLowerCase().includes(q)) ||
      (o.customer_email && o.customer_email.toLowerCase().includes(q))
    );
  });

  const netflix = filtered.filter((o) => o.service === "netflix");
  const boost = filtered.filter((o) => o.service === "boost");
  const mashup = filtered.filter((o) => o.service === "mashup");
  const afa = filtered.filter((o) => o.service === "afa");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl p-5 bg-gradient-to-r from-red-600 via-pink-600 to-emerald-600 text-white shadow-lg flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black">Netflix & Other Services</h1>
          <p className="text-sm opacity-90">
            Manage Netflix sign-ins, Gmail auto-code linking, and AFA registrations.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => {
              load(true);
              loadGmailSettings();
            }}
            variant="secondary"
            size="sm"
            className="bg-white/20 hover:bg-white/30 text-white border-white/20"
          >
            <RefreshCw className={`size-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
      </div>

      {/* Service Prices Card */}
      <Card className="p-4 md:p-5 bg-gradient-card border-2 border-accent/40">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="font-bold text-lg">Service Prices</h2>
            <p className="text-xs text-muted-foreground">
              Prices displayed on the storefront for instant customer checkout.
            </p>
          </div>
          <Button
            onClick={savePrices}
            disabled={savingPrices}
            className="bg-gradient-gold text-accent-foreground hover:opacity-90"
          >
            {savingPrices ? <Loader2 className="size-4 animate-spin mr-1" /> : <Save className="size-4 mr-1" />}
            Save Prices
          </Button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
          <div>
            <Label htmlFor="np">Netflix Price (GH₵)</Label>
            <Input
              id="np"
              inputMode="decimal"
              value={netflixPrice}
              onChange={(e) => setNetflixPrice(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="mp">MTN Mashup Price (GH₵)</Label>
            <Input
              id="mp"
              inputMode="decimal"
              value={mashupPrice}
              onChange={(e) => setMashupPrice(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="ap">AFA Registration Price (GH₵)</Label>
            <Input
              id="ap"
              inputMode="decimal"
              value={afaPrice}
              onChange={(e) => setAfaPrice(e.target.value)}
            />
          </div>
        </div>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-2.5">
        <Stat
          label="Netflix — total"
          value={orders.filter((o) => o.service === "netflix").length}
          cls="from-red-500 to-red-800"
          icon={<Play className="size-4" />}
        />
        <Stat
          label="Netflix — paid"
          value={orders.filter((o) => o.service === "netflix" && o.payment_status === "paid").length}
          cls="from-rose-500 to-red-700"
          icon={<Play className="size-4" />}
        />
        <Stat
          label="Boost — total"
          value={orders.filter((o) => o.service === "boost").length}
          cls="from-violet-500 to-purple-800"
          icon={<Rocket className="size-4" />}
        />
        <Stat
          label="Boost — paid"
          value={orders.filter((o) => o.service === "boost" && o.payment_status === "paid").length}
          cls="from-purple-600 to-indigo-900"
          icon={<Rocket className="size-4" />}
        />
        <Stat
          label="Mashup — total"
          value={orders.filter((o) => o.service === "mashup").length}
          cls="from-amber-500 to-yellow-700"
          icon={<Zap className="size-4" />}
        />
        <Stat
          label="Mashup — paid"
          value={orders.filter((o) => o.service === "mashup" && o.payment_status === "paid").length}
          cls="from-amber-600 to-yellow-800"
          icon={<Zap className="size-4" />}
        />
        <Stat
          label="AFA — total"
          value={orders.filter((o) => o.service === "afa").length}
          cls="from-emerald-500 to-teal-700"
          icon={<IdCard className="size-4" />}
        />
        <Stat
          label="AFA — paid"
          value={orders.filter((o) => o.service === "afa" && o.payment_status === "paid").length}
          cls="from-emerald-600 to-emerald-900"
          icon={<IdCard className="size-4" />}
        />
      </div>

      {/* Search Input */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search phone or reference…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-14">
          <Loader2 className="size-6 animate-spin text-accent" />
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 mb-4 gap-1">
            <TabsTrigger value="netflix">Netflix ({netflix.length})</TabsTrigger>
            <TabsTrigger value="boost" className="relative flex items-center justify-center gap-1">
              <Rocket className="size-3 text-violet-500" />
              <span>Boost ({boost.length})</span>
            </TabsTrigger>
            <TabsTrigger value="mashup">Mashup ({mashup.length})</TabsTrigger>
            <TabsTrigger value="afa">AFA ({afa.length})</TabsTrigger>
            <TabsTrigger value="gmail" className="relative">
              <span>Gmail &amp; Netflix</span>
              {gmailConnected ? (
                <span className="ml-1.5 size-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
              ) : (
                <span className="ml-1.5 size-2 rounded-full bg-amber-500 inline-block" />
              )}
            </TabsTrigger>
            <TabsTrigger value="boost_setup" className="relative flex items-center justify-center gap-1.5">
              <Rocket className="size-3.5 text-violet-500" />
              <span>BoostUpGH Setup</span>
            </TabsTrigger>
            <TabsTrigger value="partner" className="relative flex items-center justify-center gap-1.5">
              <Key className="size-3.5 text-accent" />
              <span>Partner API</span>
            </TabsTrigger>
          </TabsList>

          {/* NETFLIX ORDERS TAB */}
          <TabsContent value="netflix" className="space-y-4">
            {/* Quick Gmail status alert on top of Netflix orders */}
            <div
              className={`p-3.5 rounded-xl border flex items-center justify-between flex-wrap gap-2 text-xs md:text-sm ${
                gmailConnected
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                  : "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300"
              }`}
            >
              <div className="flex items-center gap-2">
                {gmailConnected ? (
                  <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
                ) : (
                  <AlertTriangle className="size-4 shrink-0 text-amber-500" />
                )}
                <span>
                  {gmailConnected ? (
                    <>
                      Gmail auto-fetch is <b>active</b> for <b>{gmailEmail || netflixEmail}</b>. Codes are fetched
                      automatically when customers tap &ldquo;Get sign-in code&rdquo;.
                    </>
                  ) : (
                    <>
                      Gmail is <b>not connected yet</b>. Customers cannot auto-fetch sign-in codes until you link
                      your Gmail account or enter codes manually.
                    </>
                  )}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {gmailConnected && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleTestGmail}
                    disabled={testingGmail}
                    className="h-7 text-xs bg-emerald-500/20 border-emerald-500/40 hover:bg-emerald-500/30"
                  >
                    {testingGmail ? <Loader2 className="size-3 animate-spin mr-1" /> : null}
                    Test Live
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setActiveTab("gmail")}
                  className="h-7 text-xs font-semibold"
                >
                  {gmailConnected ? "Configure" : "Link Gmail Now"}
                </Button>
              </div>
            </div>

            <OrdersTable
              rows={netflix}
              service="netflix"
              onEdit={handleOpenEdit}
              onQuickCode={handleOpenQuickCode}
              onDelete={handleDelete}
              fetchingCodeRef={fetchingCodeRef}
              onFetchGmailCode={handleFetchCodeFromGmail}
            />
          </TabsContent>

          {/* SOCIAL BOOST ORDERS TAB */}
          <TabsContent value="boost" className="space-y-4">
            <div className="p-3.5 rounded-xl border flex items-center justify-between flex-wrap gap-2 text-xs md:text-sm bg-violet-500/10 border-violet-500/30 text-violet-700 dark:text-violet-300">
              <div className="flex items-center gap-2">
                <Rocket className="size-4 shrink-0 text-violet-500" />
                <span>
                  Social Media Boost orders are auto-dispatched to BoostUpGH upon successful payment.
                  {boostUpBalance && <span className="ml-2 bg-violet-500/20 px-2 py-0.5 rounded font-mono font-bold">Live Provider Balance: {boostUpBalance}</span>}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={fetchBoostBalance}
                  disabled={loadingBoostBalance}
                  className="h-7 text-xs bg-violet-500/20 border-violet-500/40 hover:bg-violet-500/30"
                >
                  {loadingBoostBalance ? <Loader2 className="size-3 animate-spin mr-1" /> : null}
                  Refresh Balance
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setActiveTab("boost_setup")}
                  className="h-7 text-xs font-semibold"
                >
                  Configure BoostUpGH
                </Button>
              </div>
            </div>

            <OrdersTable
              rows={boost}
              service="boost"
              onEdit={handleOpenEdit}
              onQuickCode={handleOpenQuickCode}
              onDelete={handleDelete}
              onDispatchBoost={handleDispatchBoostOrder}
              dispatchingOrderRef={dispatchingOrderRef}
            />
          </TabsContent>

          {/* MASHUP ORDERS TAB */}
          <TabsContent value="mashup">
            <OrdersTable
              rows={mashup}
              service="mashup"
              onEdit={handleOpenEdit}
              onQuickCode={handleOpenQuickCode}
              onDelete={handleDelete}
            />
          </TabsContent>

          {/* AFA REGISTRATIONS TAB */}
          <TabsContent value="afa">
            <OrdersTable
              rows={afa}
              service="afa"
              onEdit={handleOpenEdit}
              onQuickCode={handleOpenQuickCode}
              onDelete={handleDelete}
            />
          </TabsContent>

          {/* GMAIL & NETFLIX INTEGRATION SETUP TAB */}
          <TabsContent value="gmail" className="space-y-5">
            {/* Card 1: Active Netflix Account Email */}
            <Card className="p-5 bg-gradient-card border shadow-sm">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="font-bold text-base flex items-center gap-2">
                    <Mail className="size-4 text-red-500" />
                    Netflix Account Sign-in Email
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    This is the email address shown to customers on the code retrieval page. Customers type this
                    email on Netflix to request a temporary sign-in code.
                  </p>
                </div>
                <Badge variant={netflixEmail ? "default" : "secondary"}>
                  {netflixEmail ? "Configured" : "Not Set"}
                </Badge>
              </div>

              <div className="mt-4 flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                  <Input
                    placeholder="e.g. yournetflix@gmail.com"
                    value={netflixEmail}
                    onChange={(e) => setNetflixEmail(e.target.value)}
                    className="font-mono text-sm"
                  />
                </div>
                <Button
                  onClick={handleSaveNetflixEmail}
                  disabled={savingGmailSettings}
                  className="bg-primary text-primary-foreground font-semibold"
                >
                  {savingGmailSettings ? <Loader2 className="size-4 animate-spin mr-1" /> : <Save className="size-4 mr-1" />}
                  Save Email
                </Button>
              </div>
            </Card>

            {/* Card 2: Link Gmail with Google OAuth */}
            <Card className="p-5 bg-gradient-card border shadow-sm space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="font-bold text-base flex items-center gap-2">
                    <Key className="size-4 text-accent" />
                    Link Gmail Inbox (Auto-Retrieve Netflix Codes)
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Connect your Gmail account so the system can automatically read the temporary sign-in code email
                    sent by Netflix when a customer pays.
                  </p>
                </div>
                <Badge
                  className={
                    gmailConnected
                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                      : "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
                  }
                  variant={gmailConnected ? "default" : "secondary"}
                >
                  {gmailConnected ? "Connected" : "Not Connected"}
                </Badge>
              </div>

              {/* Status & Quick Actions */}
              <div className="p-4 rounded-xl bg-muted/40 border space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground text-xs block">Connected Gmail Account</span>
                    <span className="font-mono font-bold text-sm">
                      {gmailEmail || (gmailConnected ? "Google Account Connected" : "No account connected")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={handleTestGmail}
                      disabled={testingGmail}
                      variant="outline"
                      size="sm"
                      className="font-semibold"
                    >
                      {testingGmail ? <Loader2 className="size-3.5 animate-spin mr-1" /> : null}
                      Test Connection
                    </Button>
                  </div>
                </div>

                {/* Test results banner */}
                {testResult && (
                  <div
                    className={`p-3 rounded-lg text-xs space-y-1 ${
                      testResult.ok
                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                        : "bg-destructive/10 text-destructive border border-destructive/30"
                    }`}
                  >
                    <div className="font-semibold flex items-center gap-1.5">
                      {testResult.ok ? (
                        <>
                          <CheckCircle2 className="size-3.5" /> Connection Verified Successfully!
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="size-3.5" /> Connection Failed
                        </>
                      )}
                    </div>
                    {testResult.ok ? (
                      <div className="space-y-0.5 pt-1">
                        <div>Account email: <b>{testResult.email}</b></div>
                        <div>Total inbox messages: <b>{testResult.total_messages}</b></div>
                        <div>Netflix emails in last 7 days: <b>{testResult.netflix_emails_found}</b></div>
                        {testResult.latest_netflix_subject && (
                          <div>Latest subject: &ldquo;{testResult.latest_netflix_subject}&rdquo; ({testResult.latest_netflix_date})</div>
                        )}
                      </div>
                    ) : (
                      <div>{testResult.error}</div>
                    )}
                  </div>
                )}
              </div>

              {/* 1-Click Google OAuth Connection */}
              <div className="space-y-4 pt-2">
                <div className="p-4 rounded-xl bg-card border shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-sm">Google Cloud Credentials</h4>
                      <p className="text-xs text-muted-foreground">
                        Connect once with your Google account to enable automatic Netflix sign-in code retrieval.
                      </p>
                    </div>
                    {gmailConnected ? (
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 flex items-center gap-1.5">
                        <CheckCircle2 className="size-3.5" /> Gmail Linked
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/30 flex items-center gap-1.5">
                        <AlertTriangle className="size-3.5" /> Not Connected
                      </span>
                    )}
                  </div>

                  <div className="space-y-3">
                    {/* Field 1: Client ID */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <Label htmlFor="gid" className="text-xs font-semibold">
                          1. Google Client ID
                        </Label>
                        <span className="text-[10px] text-muted-foreground font-mono">From Web client 1</span>
                      </div>
                      <Input
                        id="gid"
                        placeholder="695163322385-grjddchnib6ambq30ojrc1581ck6s180.apps.googleusercontent.com"
                        value={gmailClientId}
                        onChange={(e) => setGmailClientId(e.target.value.replace(/\s+/g, "-"))}
                        className="font-mono text-xs"
                      />
                    </div>

                    {/* Field 2: Client Secret */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <Label htmlFor="gsec" className="text-xs font-semibold">
                          2. Google Client Secret
                        </Label>
                        {hasClientSecret && (
                          <span className="text-[10px] text-emerald-500 font-semibold flex items-center gap-1">
                            <CheckCircle2 className="size-3" /> Secret already saved
                          </span>
                        )}
                      </div>
                      <Input
                        id="gsec"
                        type="text"
                        placeholder={
                          hasClientSecret
                            ? "Client Secret is saved (paste new GOCSPX- to update)"
                            : "Paste your Client Secret here (starts with GOCSPX-...)"
                        }
                        value={gmailClientSecret}
                        onChange={(e) => setGmailClientSecret(e.target.value)}
                        className="font-mono text-xs"
                      />
                      <p className="text-[11px] text-muted-foreground mt-1">
                        This is the secret starting with <code className="font-mono font-bold text-foreground">GOCSPX-</code> from Google Cloud Console.
                      </p>
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-col sm:flex-row gap-2 pt-2">
                      <Button
                        onClick={handleStartGoogleOAuth}
                        className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold h-10 shadow-sm"
                      >
                        <ExternalLink className="size-4 mr-2" />
                        Connect with Google (stillmoving11@gmail.com)
                      </Button>
                      <Button
                        onClick={handleSaveGmailCredentials}
                        disabled={savingGmailSettings}
                        variant="outline"
                        className="font-semibold h-10"
                      >
                        {savingGmailSettings ? (
                          <Loader2 className="size-4 animate-spin mr-1.5" />
                        ) : (
                          <Save className="size-4 mr-1.5" />
                        )}
                        Save Credentials
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Redirect URI Reminder */}
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs space-y-2">
                  <div className="font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                    <AlertTriangle className="size-4 shrink-0" />
                    Authorized Redirect URI (must be in Google Cloud Console):
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Make sure this exact URL is added under <b>Authorized redirect URIs</b> in your Google Cloud Console credentials:
                  </p>
                  <div className="flex items-center gap-2 bg-black/40 p-2 rounded-lg border border-white/10 font-mono text-[11px] select-all overflow-x-auto">
                    <span className="text-amber-300 font-bold flex-1 truncate">
                      {typeof window !== "undefined" ? `${window.location.origin}/admin/services` : "/admin/services"}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        if (typeof window !== "undefined") {
                          navigator.clipboard.writeText(`${window.location.origin}/admin/services`);
                          toast.success("Copied redirect URI to clipboard!");
                        }
                      }}
                      className="h-7 px-2.5 text-xs bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/30 shrink-0 font-semibold"
                    >
                      <Copy className="size-3 mr-1" /> Copy URI
                    </Button>
                  </div>
                </div>
              </div>

              {/* Collapsible: Manual token entry */}
              <div className="pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowManualTokens(!showManualTokens)}
                  className="text-xs font-semibold text-accent hover:underline flex items-center gap-1"
                >
                  {showManualTokens ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                  {showManualTokens ? "Hide" : "Show"} Advanced Tokens (Refresh Token, Access Token)
                </button>

                {showManualTokens && (
                  <div className="mt-3 p-4 rounded-xl bg-muted/30 border space-y-3">
                    <div>
                      <Label htmlFor="gref" className="text-xs">
                        Google Refresh Token (auto-obtained when you click Connect with Google)
                      </Label>
                      <Input
                        id="gref"
                        type="password"
                        placeholder="1//0xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                        value={gmailRefreshToken}
                        onChange={(e) => setGmailRefreshToken(e.target.value)}
                        className="font-mono text-xs mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="gacc" className="text-xs">
                        Direct Access Token (temporary fallback)
                      </Label>
                      <Input
                        id="gacc"
                        type="password"
                        placeholder="ya29.a0xxxxxxxxxxxxxxxxxxxxxxxx"
                        value={gmailAccessToken}
                        onChange={(e) => setGmailAccessToken(e.target.value)}
                        className="font-mono text-xs mt-1"
                      />
                    </div>
                    <Button
                      onClick={handleSaveGmailCredentials}
                      disabled={savingGmailSettings}
                      size="sm"
                      className="font-semibold"
                    >
                      {savingGmailSettings ? <Loader2 className="size-3.5 animate-spin mr-1" /> : <Save className="size-3.5 mr-1" />}
                      Save Tokens
                    </Button>
                  </div>
                )}
              </div>

              {/* Setup Guide Accordion */}
              <div className="pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowInstructions(!showInstructions)}
                  className="text-xs font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  {showInstructions ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                  How to get Google Client ID &amp; Secret (Google Cloud Console Guide)
                </button>

                {showInstructions && (
                  <div className="mt-3 p-4 rounded-xl bg-muted/50 border text-xs space-y-2 leading-relaxed">
                    <ol className="list-decimal list-inside space-y-1.5 text-muted-foreground">
                      <li>
                        Go to{" "}
                        <a
                          href="https://console.cloud.google.com"
                          target="_blank"
                          rel="noreferrer"
                          className="text-accent underline font-semibold"
                        >
                          Google Cloud Console
                        </a>{" "}
                        and create or select a project.
                      </li>
                      <li>
                        Search for <b>Gmail API</b> in the search bar and click <b>Enable</b>.
                      </li>
                      <li>
                        Go to <b>APIs &amp; Services &gt; Credentials &gt; Create Credentials &gt; OAuth client ID</b>.
                      </li>
                      <li>Select <b>Web application</b> as Application type.</li>
                      <li>
                        Under <b>Authorized JavaScript origins</b>, add:{" "}
                        <code className="bg-background px-1.5 py-0.5 rounded font-mono text-[11px]">
                          {window.location.origin}
                        </code>
                      </li>
                      <li>
                        Under <b>Authorized redirect URIs</b>, add:{" "}
                        <code className="bg-background px-1.5 py-0.5 rounded font-mono text-[11px]">
                          {window.location.origin}/admin/services
                        </code>
                      </li>
                      <li>
                        Copy the generated <b>Client ID</b> and <b>Client Secret</b>, paste them above, and click{" "}
                        <b>Connect with Google</b>.
                      </li>
                    </ol>
                  </div>
                )}
              </div>
            </Card>
          </TabsContent>

          {/* BOOSTUPGH INTEGRATION SETUP TAB */}
          <TabsContent value="boost_setup" className="space-y-5">
            <Card className="p-5 bg-gradient-card border shadow-sm">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="font-bold text-base flex items-center gap-2">
                    <Rocket className="size-4 text-violet-500" />
                    BoostUpGH API Integration
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Connect your BoostUpGH account to auto-fulfill followers, likes, views, comments, and subscribers.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={fetchBoostBalance}
                  disabled={loadingBoostBalance}
                  className="bg-violet-500/10 border-violet-500/30 text-violet-600 dark:text-violet-400"
                >
                  <RefreshCw className={`size-3.5 mr-1.5 ${loadingBoostBalance ? "animate-spin" : ""}`} />
                  Check Provider Balance
                </Button>
              </div>

              {boostUpBalance && (
                <div className="mt-4 p-3.5 rounded-xl bg-violet-500/10 border border-violet-500/30 flex items-center justify-between">
                  <span className="text-xs text-violet-700 dark:text-violet-300 font-medium">Available BoostUpGH Wallet Balance:</span>
                  <span className="font-mono font-black text-base text-violet-700 dark:text-violet-200">{boostUpBalance}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div>
                  <Label htmlFor="bkey">BoostUpGH API Key</Label>
                  <div className="relative mt-1">
                    <Input
                      id="bkey"
                      type={showBoostKey ? "text" : "password"}
                      placeholder="e.g. 9ede02...7a7c"
                      value={boostUpApiKey}
                      onChange={(e) => setBoostUpApiKey(e.target.value)}
                      className="font-mono text-xs pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowBoostKey((prev) => !prev)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showBoostKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    You can enter your API key here or configure it in Vercel as <code className="bg-muted px-1 rounded">BOOSTUPGH_API_KEY</code>.
                  </p>
                </div>

                <div>
                  <Label htmlFor="bmarkup">Admin Wholesale Markup Percentage (%)</Label>
                  <div className="mt-1">
                    <Input
                      id="bmarkup"
                      type="number"
                      min="0"
                      max="500"
                      placeholder="e.g. 20"
                      value={boostMarkupPercent}
                      onChange={(e) => setBoostMarkupPercent(e.target.value)}
                      className="font-mono text-sm"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Markup added on top of wholesale provider prices (e.g. 20% markup on a GH₵ 10 service charges customer GH₵ 12).
                  </p>
                </div>

                <div className="pt-4 border-t border-border/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="agent-boost-markup" className="font-bold flex items-center gap-1.5 text-fuchsia-400">
                        <Rocket className="size-4" /> Default Agent Profit Margin % (Reseller Stores)
                      </Label>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Set the profit margin percentage for all agent storefronts in one place.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <div className="relative w-full sm:w-36">
                      <Input
                        id="agent-boost-markup"
                        type="number"
                        min="0"
                        max="500"
                        placeholder="25"
                        value={agentBoostDefaultPercent}
                        onChange={(e) => setAgentBoostDefaultPercent(e.target.value)}
                        className="font-mono text-base font-bold pr-8 text-center border-fuchsia-500/40"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono font-bold text-fuchsia-400 text-sm pointer-events-none">
                        %
                      </span>
                    </div>

                    <Button
                      type="button"
                      onClick={handleApplyBoostToAllAgentsNow}
                      disabled={applyingBoostToAll}
                      className="bg-gradient-to-r from-fuchsia-600 to-violet-600 hover:from-fuchsia-500 hover:to-violet-500 text-white font-bold text-xs h-10 px-4 shadow-md shadow-fuchsia-600/30 gap-2 shrink-0"
                    >
                      {applyingBoostToAll ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="size-3.5" />
                      )}
                      <span>Apply to ALL Agents Now ⚡</span>
                    </Button>
                  </div>
                </div>
              </div>

              <div className="mt-5 flex justify-end">
                <Button
                  onClick={handleSaveBoostSettings}
                  disabled={savingBoostSettings}
                  className="bg-violet-600 hover:bg-violet-700 text-white font-semibold"
                >
                  {savingBoostSettings ? <Loader2 className="size-4 animate-spin mr-1.5" /> : <Save className="size-4 mr-1.5" />}
                  Save BoostUpGH Settings
                </Button>
              </div>
            </Card>
          </TabsContent>

          {/* PARTNER RESELLER API TAB */}
          <TabsContent value="partner" className="space-y-4">
            <Card className="p-5 md:p-6 bg-gradient-card border-2 border-accent/40 space-y-6">
              {/* Header */}
              <div className="flex items-start justify-between gap-4 flex-wrap pb-4 border-b border-border/50">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-accent/10 text-accent">
                      <Users className="size-5" />
                    </div>
                    <h2 className="text-xl font-bold">Netflix Partner Reseller Accounts (White-Label)</h2>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
                    Create unique accounts for your partner websites. Each partner gets their own API key, their own wholesale price, and their own prepaid wallet balance.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => setAddPartnerOpen(true)}
                    className="bg-accent text-accent-foreground font-bold shadow-md"
                  >
                    <UserPlus className="size-4 mr-1.5" /> + Add New Partner
                  </Button>
                </div>
              </div>

              {/* Multi-Partner Accounts Table */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm flex items-center gap-2">
                    <Key className="size-4 text-accent" />
                    Active Partner Accounts ({partners.length})
                  </h3>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground">Prepaid Wallet Enforcement:</span>
                    <button
                      type="button"
                      onClick={() => {
                        const next = !requireWallet;
                        setRequireWallet(next);
                        handleSavePartnerSettings(partnerWallet, next);
                      }}
                      className={`px-2.5 py-0.5 rounded-full text-xs font-bold border transition-colors ${
                        requireWallet
                          ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                          : "bg-muted text-muted-foreground border-border"
                      }`}
                    >
                      {requireWallet ? "Active (Required)" : "Disabled (Post-Paid)"}
                    </button>
                  </div>
                </div>

                {partners.length === 0 ? (
                  <div className="p-8 text-center rounded-xl bg-muted/20 border border-border/50 text-muted-foreground text-sm">
                    No partner accounts created yet. Click <b>+ Add New Partner</b> above to create one.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3">
                    {partners.map((p) => (
                      <div
                        key={p.id}
                        className={`p-4 rounded-xl border transition-all ${
                          p.status === "disabled"
                            ? "bg-muted/20 border-border/40 opacity-70"
                            : "bg-muted/40 border-border hover:border-accent/40"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          {/* Partner Info */}
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-base text-foreground">{p.name}</span>
                              <Badge
                                variant={p.status === "active" ? "default" : "secondary"}
                                className={`text-[10px] uppercase font-bold ${
                                  p.status === "active"
                                    ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
                                    : "bg-muted text-muted-foreground"
                                }`}
                              >
                                {p.status}
                              </Badge>
                              {/* Stock status badge */}
                              {Number(p.wallet_balance || 0) < Number(p.wholesale_price || 25) ? (
                                <Badge variant="destructive" className="text-[10px] uppercase font-bold bg-red-500/15 text-red-400 border border-red-500/30">
                                  Out of Stock
                                </Badge>
                              ) : (
                                <Badge className="text-[10px] uppercase font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                  In Stock
                                </Badge>
                              )}
                              {p.phone && (
                                <span className="text-xs text-muted-foreground font-mono">
                                  📞 {p.phone}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
                              <span>Wholesale Rate: <b className="text-foreground text-sm font-black">GH₵ {p.wholesale_price}</b> / 30-days</span>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => handleOpenEditPartner(p)}
                                className="h-5 px-1.5 text-[11px] text-accent hover:text-accent/80 hover:bg-accent/10 underline font-semibold"
                              >
                                <Edit2 className="size-3 mr-1" /> Edit Rate
                              </Button>
                              <span>Total Orders: <b className="text-foreground">{p.total_orders || 0}</b></span>
                              <span>Created: {new Date(p.created_at).toLocaleDateString()}</span>
                            </div>
                          </div>

                          {/* Wallet & Topup/Deduct Buttons */}
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <div className="text-[10px] text-muted-foreground uppercase font-bold">Wallet Balance</div>
                              <div className={`text-lg font-black font-mono ${Number(p.wallet_balance || 0) >= Number(p.wholesale_price || 25) ? "text-emerald-400" : "text-amber-500"}`}>
                                GH₵ {Number(p.wallet_balance || 0).toFixed(2)}
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Button
                                size="sm"
                                onClick={() => {
                                  setTopupTargetPartner(p);
                                  setWalletActionMode("add");
                                  setPartnerTopupInput("");
                                }}
                                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-8 text-xs"
                              >
                                <Plus className="size-3 mr-1" /> Add Funds
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setTopupTargetPartner(p);
                                  setWalletActionMode("deduct");
                                  setPartnerTopupInput("");
                                }}
                                className="border-red-500/40 text-red-400 hover:bg-red-500/10 h-8 text-xs font-bold"
                              >
                                <Minus className="size-3 mr-1" /> Deduct
                              </Button>
                            </div>
                          </div>
                        </div>

                        {/* API Key Box & Action Buttons */}
                        <div className="mt-3 pt-3 border-t border-border/40 flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2 flex-1 min-w-[260px]">
                            <span className="text-[11px] text-muted-foreground font-semibold">API Key:</span>
                            <code className="text-xs font-mono bg-black/40 px-2.5 py-1 rounded border border-white/10 text-accent select-all flex-1 truncate">
                              {p.api_key}
                            </code>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                navigator.clipboard.writeText(p.api_key);
                                toast.success(`API key for "${p.name}" copied!`);
                              }}
                              className="h-7 px-2 text-xs"
                              title="Copy Key"
                            >
                              <Copy className="size-3 mr-1" /> Copy Key
                            </Button>
                          </div>

                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenEditPartner(p)}
                              className="h-7 px-2 text-xs font-semibold"
                              title="Edit Wholesale Rate & Details"
                            >
                              <Edit2 className="size-3 mr-1" /> Edit
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              onClick={() => copySpecificPartnerDocs(p)}
                              className="h-7 px-2 text-xs font-semibold"
                            >
                              <Terminal className="size-3 mr-1" /> Docs
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => handleRegenerateSpecificPartnerKey(p.id)}
                              className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                            >
                              Regen Key
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => handleTogglePartnerStatus(p.id)}
                              className={`h-7 px-2 text-[11px] ${
                                p.status === "active" ? "text-amber-500" : "text-emerald-500"
                              }`}
                            >
                              {p.status === "active" ? "Disable" : "Enable"}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeletePartner(p.id, p.name)}
                              className="h-7 px-2 text-[11px] text-red-500 hover:text-red-400 hover:bg-red-500/10 font-bold"
                              title="Delete Partner Account"
                            >
                              <Trash2 className="size-3 mr-1" /> Delete
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* White-Label Assurance Note */}
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs flex items-start gap-2.5">
                <CheckCircle2 className="size-4 text-emerald-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-bold text-emerald-600 dark:text-emerald-400">
                    100% White-Label &amp; Automated
                  </div>
                  <p className="text-muted-foreground leading-relaxed text-[11px]">
                    Responses sent through this API contain pure JSON data. Zero Data1 branding, logos, or pages are reflected to your partner&rsquo;s customers. Your server handles Gmail OTP code extraction securely in the background.
                  </p>
                </div>
              </div>

              {/* Endpoints Documentation & Examples */}
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm flex items-center gap-2">
                    <Terminal className="size-4 text-accent" />
                    API Endpoints Guide (Send to Partner)
                  </h3>
                  <Button
                    onClick={copyPartnerDocumentation}
                    variant="ghost"
                    size="sm"
                    className="text-xs text-accent hover:underline h-7 p-0"
                  >
                    <Copy className="size-3 mr-1" /> Copy All for WhatsApp / Email
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Endpoint 1: Create Order */}
                  <div className="p-4 rounded-xl bg-black/40 border border-white/10 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 font-mono text-xs">
                        <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 font-bold">POST</span>
                        <span className="font-bold text-foreground">/api/partner/netflix/order</span>
                      </div>
                      <Badge variant="outline" className="text-[10px]">1. Create Access</Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Called when their customer pays on their website. Creates 30-day Netflix access and returns the Netflix email.
                    </p>
                    <div className="bg-black/60 p-2.5 rounded-lg border border-white/5 font-mono text-[10px] text-emerald-400 space-y-1 overflow-x-auto">
                      <div className="text-muted-foreground">// Request Headers</div>
                      <div>x-api-key: {partnerApiKey || "YOUR_API_KEY"}</div>
                      <div className="text-muted-foreground pt-1">// Request Body (JSON)</div>
                      <div>&#123;</div>
                      <div className="pl-3">&quot;customer_name&quot;: &quot;Kwame Mensah&quot;,</div>
                      <div className="pl-3">&quot;customer_phone&quot;: &quot;0541234567&quot;,</div>
                      <div className="pl-3">&quot;partner_reference&quot;: &quot;PARTNER-ORD-101&quot;,</div>
                      <div className="pl-3">&quot;duration_days&quot;: 30</div>
                      <div>&#125;</div>
                    </div>
                  </div>

                  {/* Endpoint 2: Fetch Code */}
                  <div className="p-4 rounded-xl bg-black/40 border border-white/10 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 font-mono text-xs">
                        <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold">POST</span>
                        <span className="font-bold text-foreground">/api/partner/netflix/fetch-code</span>
                      </div>
                      <Badge variant="outline" className="text-[10px]">2. Fetch Sign-In Code</Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Called when their customer clicks &ldquo;Get Code&rdquo;. Automatically triggers your Gmail connection to extract the OTP code.
                    </p>
                    <div className="bg-black/60 p-2.5 rounded-lg border border-white/5 font-mono text-[10px] text-emerald-400 space-y-1 overflow-x-auto">
                      <div className="text-muted-foreground">// Request Headers</div>
                      <div>x-api-key: {partnerApiKey || "YOUR_API_KEY"}</div>
                      <div className="text-muted-foreground pt-1">// Request Body (JSON)</div>
                      <div>&#123;</div>
                      <div className="pl-3">&quot;reference&quot;: &quot;NF-P-XXXXXX&quot;</div>
                      <div>&#125;</div>
                      <div className="text-muted-foreground pt-1">// Response (JSON)</div>
                      <div>&#123; &quot;status&quot;: &quot;success&quot;, &quot;code&quot;: &quot;5821&quot; &#125;</div>
                    </div>
                  </div>

                  {/* Endpoint 3: Check Stock & Availability */}
                  <div className="p-4 rounded-xl bg-black/40 border border-white/10 space-y-2.5 md:col-span-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 font-mono text-xs">
                        <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-bold">GET</span>
                        <span className="font-bold text-foreground">/api/partner/netflix/stock</span>
                      </div>
                      <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-400">3. Live Stock & Balance Check</Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Checks live inventory availability. <strong className="text-foreground">Immediately returns OUT OF STOCK</strong> if this partner&apos;s wallet balance is GH₵ 0 or below their wholesale price, and <strong className="text-foreground">IN STOCK</strong> once funded.
                    </p>
                    <div className="bg-black/60 p-2.5 rounded-lg border border-white/5 font-mono text-[10px] text-amber-400 space-y-1 overflow-x-auto">
                      <div className="text-muted-foreground">// Request Headers</div>
                      <div>x-api-key: {partnerApiKey || "YOUR_API_KEY"}</div>
                      <div className="text-muted-foreground pt-1">// Response when balance is 0:</div>
                      <div>&#123; &quot;status&quot;: &quot;out_of_stock&quot;, &quot;in_stock&quot;: false, &quot;wallet_balance&quot;: 0 &#125;</div>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* Edit Order Dialog */}
      <Dialog open={!!editOrder} onOpenChange={(open) => !open && setEditOrder(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Update Order — {editOrder?.reference}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs text-muted-foreground">Customer</Label>
              <div className="font-semibold text-sm">
                {editOrder?.customer_phone} ({editOrder?.customer_name || editOrder?.customer_email})
              </div>
            </div>

            <div>
              <Label htmlFor="del-status">Delivery Status</Label>
              <Select value={editDeliveryStatus} onValueChange={setEditDeliveryStatus}>
                <SelectTrigger id="del-status">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="awaiting_whatsapp">Awaiting WhatsApp</SelectItem>
                  <SelectItem value="completed">Completed / Delivered</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {editOrder?.service === "netflix" && (
              <div>
                <Label htmlFor="ncode">Netflix Sign-in Code</Label>
                <Input
                  id="ncode"
                  placeholder="Enter 4 or 6-digit code"
                  value={editCode}
                  onChange={(e) => setEditCode(e.target.value)}
                  className="font-mono text-lg font-bold tracking-widest"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Entering a code manually allows the customer to view it on their sign-in page immediately.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOrder(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={savingEdit} className="bg-primary text-primary-foreground">
              {savingEdit ? <Loader2 className="size-4 animate-spin mr-1" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Code Dialog */}
      <Dialog open={!!quickCodeOrder} onOpenChange={(open) => !open && setQuickCodeOrder(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="size-5 text-amber-500 fill-amber-500" />
              Enter Netflix Code
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="p-3 rounded-lg bg-muted text-xs space-y-1">
              <div>Customer: <b>{quickCodeOrder?.customer_phone}</b></div>
              <div>Ref: <span className="font-mono">{quickCodeOrder?.reference}</span></div>
            </div>

            <div>
              <Label htmlFor="qcode">Netflix Sign-in Code</Label>
              <Input
                id="qcode"
                autoFocus
                placeholder="e.g. 7492"
                value={quickCodeInput}
                onChange={(e) => setQuickCodeInput(e.target.value)}
                className="font-mono text-2xl font-black tracking-widest text-center h-14"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Saving will instantly deliver this code to the customer&apos;s retrieval page.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuickCodeOrder(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveQuickCode}
              disabled={savingQuickCode}
              className="bg-red-600 hover:bg-red-500 text-white font-bold"
            >
              {savingQuickCode ? <Loader2 className="size-4 animate-spin mr-1" /> : <Save className="size-4 mr-1" />}
              Save &amp; Deliver Code
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Partner Account Dialog */}
      <Dialog open={addPartnerOpen} onOpenChange={setAddPartnerOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="size-5 text-accent" />
              Create New Reseller Partner Account
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="pn">Partner / Website Name *</Label>
              <Input
                id="pn"
                placeholder="e.g. Apex Media, StreamGH"
                value={newPartnerName}
                onChange={(e) => setNewPartnerName(e.target.value)}
                className="font-semibold"
              />
            </div>

            <div>
              <Label htmlFor="pph">Phone / WhatsApp Number (Optional)</Label>
              <Input
                id="pph"
                placeholder="e.g. 0541234567"
                value={newPartnerPhone}
                onChange={(e) => setNewPartnerPhone(e.target.value)}
                className="font-mono text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="pprice">Wholesale Rate (GH₵)</Label>
                <Input
                  id="pprice"
                  inputMode="decimal"
                  placeholder="25"
                  value={newPartnerPrice}
                  onChange={(e) => setNewPartnerPrice(e.target.value)}
                  className="font-bold font-mono"
                />
              </div>
              <div>
                <Label htmlFor="pbal">Initial Wallet (GH₵)</Label>
                <Input
                  id="pbal"
                  inputMode="decimal"
                  placeholder="100"
                  value={newPartnerWallet}
                  onChange={(e) => setNewPartnerWallet(e.target.value)}
                  className="font-bold font-mono"
                />
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground leading-relaxed">
              A unique secret API key (<code className="font-mono text-accent">d1_live_nf_...</code>) will be generated automatically for this partner.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddPartnerOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateNewPartner}
              disabled={savingNewPartner || !newPartnerName.trim()}
              className="bg-accent text-accent-foreground font-bold"
            >
              {savingNewPartner ? <Loader2 className="size-4 animate-spin mr-1" /> : <Save className="size-4 mr-1" />}
              Create Partner
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Top-up / Deduct Specific Partner Dialog */}
      <Dialog open={!!topupTargetPartner} onOpenChange={(open) => !open && setTopupTargetPartner(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className={`size-5 ${walletActionMode === "add" ? "text-emerald-500" : "text-red-500"}`} />
              {walletActionMode === "add" ? "Credit Wallet" : "Deduct From Wallet"} — {topupTargetPartner?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Action Mode Toggle (Credit vs Deduct) */}
            <div className="grid grid-cols-2 p-1 bg-muted rounded-xl border border-border">
              <button
                type="button"
                onClick={() => setWalletActionMode("add")}
                className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  walletActionMode === "add"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Plus className="size-3.5" /> Credit (Add)
              </button>
              <button
                type="button"
                onClick={() => setWalletActionMode("deduct")}
                className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  walletActionMode === "deduct"
                    ? "bg-red-600 text-white shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Minus className="size-3.5" /> Deduct (Debit)
              </button>
            </div>

            <div className="p-3 bg-muted/40 rounded-xl border border-border flex items-baseline justify-between">
              <span className="text-xs text-muted-foreground">Current Balance:</span>
              <span className="text-xl font-black font-mono text-foreground">
                GH₵ {Number(topupTargetPartner?.wallet_balance || 0).toFixed(2)}
              </span>
            </div>

            <div>
              <Label htmlFor="topamt">
                {walletActionMode === "add" ? "Amount to Add (GH₵)" : "Amount to Deduct (GH₵)"}
              </Label>
              <Input
                id="topamt"
                autoFocus
                inputMode="decimal"
                placeholder={walletActionMode === "add" ? "e.g. 100" : "e.g. 50"}
                value={partnerTopupInput}
                onChange={(e) => setPartnerTopupInput(e.target.value)}
                className="font-mono text-xl font-bold text-center h-12"
              />
            </div>

            {/* Quick buttons */}
            <div className="grid grid-cols-3 gap-2">
              {[String(topupTargetPartner?.wholesale_price || 15), "50", "100"].map((quickVal) => (
                <button
                  key={quickVal}
                  type="button"
                  onClick={() => setPartnerTopupInput(quickVal)}
                  className="py-1 px-2 rounded-lg bg-muted text-xs font-bold hover:bg-accent/20 transition-colors border border-border"
                >
                  {walletActionMode === "add" ? `+ GH₵ ${quickVal}` : `- GH₵ ${quickVal}`}
                </button>
              ))}
            </div>

            {walletActionMode === "deduct" && Number(topupTargetPartner?.wallet_balance || 0) > 0 && (
              <button
                type="button"
                onClick={() => setPartnerTopupInput(String(Number(topupTargetPartner?.wallet_balance || 0)))}
                className="w-full py-1.5 px-3 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 text-xs font-semibold border border-red-500/30 transition-colors flex items-center justify-center gap-1.5"
              >
                <Trash2 className="size-3" /> Deduct All Funds (Set Balance to 0 — Out of Stock)
              </button>
            )}

            {walletActionMode === "deduct" ? (
              <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-[11px] text-red-400">
                ⚠️ If the balance drops below <strong>GH₵ {topupTargetPartner?.wholesale_price || 25}</strong>, Netflix will automatically go <strong>OUT OF STOCK</strong> for this partner&apos;s API key.
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                Adding funds will allow this partner&apos;s site to generate accounts automatically.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTopupTargetPartner(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleTopupSpecificPartner}
              disabled={!partnerTopupInput || parseFloat(partnerTopupInput) <= 0}
              className={
                walletActionMode === "add"
                  ? "bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                  : "bg-red-600 hover:bg-red-500 text-white font-bold"
              }
            >
              {walletActionMode === "add" ? "Add Funds" : "Deduct Funds"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Partner Details & Wholesale Price Dialog */}
      <Dialog open={!!editingPartner} onOpenChange={(open) => !open && setEditingPartner(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="size-5 text-accent" />
              Edit Partner — {editingPartner?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="edit-pname">Partner Business / Display Name</Label>
              <Input
                id="edit-pname"
                placeholder="Partner Business or Name"
                value={editPartnerName}
                onChange={(e) => setEditPartnerName(e.target.value)}
                className="font-semibold"
              />
            </div>

            <div>
              <Label htmlFor="edit-pprice">
                Wholesale Price per 30-Day Netflix (GH₵)
              </Label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-2.5 text-xs font-bold text-muted-foreground">
                  GH₵
                </span>
                <Input
                  id="edit-pprice"
                  inputMode="decimal"
                  placeholder="15"
                  value={editPartnerPrice}
                  onChange={(e) => setEditPartnerPrice(e.target.value)}
                  className="pl-12 font-mono text-lg font-bold"
                />
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Any order request coming from this partner will automatically deduct this exact wholesale price from their wallet balance (e.g. set to 15 to deduct GH₵ 15 per order).
              </p>
            </div>

            <div>
              <Label htmlFor="edit-pphone">Phone / WhatsApp Number (Optional)</Label>
              <Input
                id="edit-pphone"
                placeholder="e.g. 0541234567"
                value={editPartnerPhone}
                onChange={(e) => setEditPartnerPhone(e.target.value)}
                className="font-mono text-sm"
              />
            </div>

            <div className="p-3 bg-muted/40 rounded-xl border border-border text-xs flex justify-between items-center">
              <span className="text-muted-foreground">Current Wallet Balance:</span>
              <span className={`font-mono font-bold ${Number(editingPartner?.wallet_balance || 0) >= Number(editPartnerPrice || 25) ? "text-emerald-400" : "text-amber-500"}`}>
                GH₵ {Number(editingPartner?.wallet_balance || 0).toFixed(2)}
              </span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingPartner(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveEditedPartner}
              disabled={savingEditPartner || !editPartnerName.trim()}
              className="bg-accent text-accent-foreground font-bold"
            >
              {savingEditPartner ? <Loader2 className="size-4 animate-spin mr-1" /> : <Save className="size-4 mr-1" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const Stat = ({
  label,
  value,
  cls,
  icon,
}: {
  label: string;
  value: number;
  cls: string;
  icon: React.ReactNode;
}) => (
  <div className={`rounded-xl p-4 text-white bg-gradient-to-br ${cls} shadow-md`}>
    <div className="flex items-center justify-between">
      <span className="text-xs font-medium opacity-90">{label}</span>
      {icon}
    </div>
    <div className="text-2xl md:text-3xl font-black mt-1">{value}</div>
  </div>
);

const OrdersTable = ({
  rows,
  service,
  onEdit,
  onQuickCode,
  onDelete,
  fetchingCodeRef,
  onFetchGmailCode,
  onDispatchBoost,
  dispatchingOrderRef,
}: {
  rows: ServiceOrder[];
  service: "netflix" | "afa" | "mashup" | "boost";
  onEdit: (o: ServiceOrder) => void;
  onQuickCode: (o: ServiceOrder) => void;
  onDelete: (id: string, ref: string) => void;
  fetchingCodeRef?: string | null;
  onFetchGmailCode?: (o: ServiceOrder) => void;
  onDispatchBoost?: (o: ServiceOrder) => void;
  dispatchingOrderRef?: string | null;
}) => {
  if (!rows.length) return <p className="text-muted-foreground py-8 text-center">No {service} orders yet.</p>;
  const copy = (v: string) => {
    navigator.clipboard.writeText(v);
    toast.success("Copied");
  };
  return (
    <Card className="overflow-x-auto shadow-sm">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr className="text-left">
            <th className="p-3">Date / time</th>
            <th className="p-3">Customer</th>
            <th className="p-3">Phone</th>
            <th className="p-3">Amount</th>
            {service === "mashup" && <th className="p-3">Package / Combo</th>}
            {service === "boost" && <th className="p-3">Boost Service</th>}
            {service === "boost" && <th className="p-3">Quantity</th>}
            {service === "boost" && <th className="p-3">Target Link</th>}
            <th className="p-3">Payment</th>
            <th className="p-3">{service === "netflix" ? "Expires" : "Delivery"}</th>
            <th className="p-3">Reference</th>
            {service === "netflix" && <th className="p-3">Code delivered</th>}
            {service === "boost" && <th className="p-3">BoostUpGH Status</th>}
            <th className="p-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((o) => (
            <tr key={o.id} className="border-t hover:bg-muted/30">
              <td className="p-3 whitespace-nowrap">{new Date(o.created_at).toLocaleString()}</td>
              <td className="p-3">
                <div className="font-medium">{o.customer_name || o.customer_email || "Customer"}</div>
                {o.customer_email && o.customer_name && (
                  <div className="text-[11px] text-muted-foreground truncate max-w-[180px]">{o.customer_email}</div>
                )}
                {(() => {
                  const partnerMatch = o.notes?.match(/\[partner:[^:]+:([^\]]+)\]/);
                  if (!partnerMatch) return null;
                  return (
                    <div className="mt-1">
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30">
                        <Key className="size-2.5" /> Partner: {partnerMatch[1]}
                      </span>
                    </div>
                  );
                })()}
              </td>
              <td className="p-3">
                <PhoneLink value={o.customer_phone} />
              </td>
              <td className="p-3 font-semibold">GH₵ {Number(o.amount).toFixed(2)}</td>
              {service === "mashup" && (
                <td className="p-3">
                  <span className="font-semibold text-amber-700 dark:text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2.5 py-1 rounded-md text-xs inline-block">
                    {o.notes || "Standard Combo"}
                  </span>
                </td>
              )}
              {service === "boost" && (
                <td className="p-3">
                  <div className="flex flex-col gap-1 max-w-[200px]">
                    <span className="font-bold text-xs truncate">
                      {o.boost_service_name || o.notes || "Social Boost"}
                    </span>
                    {o.boost_platform && (
                      <Badge variant="secondary" className="w-fit text-[10px] uppercase font-bold py-0">
                        {o.boost_platform}
                      </Badge>
                    )}
                  </div>
                </td>
              )}
              {service === "boost" && (
                <td className="p-3 font-mono font-bold text-xs">
                  {o.boost_quantity ? Number(o.boost_quantity).toLocaleString() : "—"}
                </td>
              )}
              {service === "boost" && (
                <td className="p-3">
                  {o.boost_link ? (
                    <a
                      href={o.boost_link.startsWith("http") ? o.boost_link : `https://${o.boost_link}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-blue-500 hover:underline max-w-[150px] truncate"
                      title={o.boost_link}
                    >
                      <ExternalLink className="size-3 shrink-0" />
                      <span className="truncate">{o.boost_link}</span>
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
              )}
              <td className="p-3">
                <Badge
                  className={
                    o.payment_status === "paid"
                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                      : ""
                  }
                  variant={o.payment_status === "paid" ? "default" : "secondary"}
                >
                  {o.payment_status}
                </Badge>
              </td>
              <td className="p-3">
                {service === "netflix" ? (
                  o.netflix_login_expires_at ? (
                    <span className="text-xs">
                      {new Date(o.netflix_login_expires_at).toLocaleDateString()}
                    </span>
                  ) : (
                    "—"
                  )
                ) : (
                  <Badge variant="outline">{o.delivery_status}</Badge>
                )}
              </td>
              <td className="p-3 font-mono text-xs">
                <button onClick={() => copy(o.reference)} className="hover:underline" title="Copy">
                  {o.reference}
                </button>
              </td>
              {service === "netflix" && (
                <td className="p-3">
                  {o.netflix_last_code ? (
                    <div className="flex items-center gap-2">
                      <div className="flex flex-col gap-0.5">
                        <button
                          onClick={() => copy(o.netflix_last_code!)}
                          className="font-mono font-black text-base tracking-widest text-red-600 hover:underline text-left"
                          title="Click to copy code"
                        >
                          {o.netflix_last_code}
                        </button>
                        {o.netflix_last_code_at && (
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(o.netflix_last_code_at).toLocaleString()}
                          </span>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={fetchingCodeRef === o.reference}
                        onClick={() => onFetchGmailCode?.(o)}
                        title="Re-fetch newest code from Gmail"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600 hover:bg-red-500/10"
                      >
                        <RefreshCw className={`size-3 ${fetchingCodeRef === o.reference ? "animate-spin text-red-600" : ""}`} />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Button
                        size="sm"
                        disabled={fetchingCodeRef === o.reference}
                        onClick={() => onFetchGmailCode?.(o)}
                        className="h-7 text-xs bg-red-600 hover:bg-red-700 text-white font-bold shadow-sm"
                        title="Auto-fetch latest sign-in code from connected Gmail"
                      >
                        {fetchingCodeRef === o.reference ? (
                          <Loader2 className="size-3 animate-spin mr-1" />
                        ) : (
                          <Sparkles className="size-3 mr-1 text-amber-300" />
                        )}
                        Fetch from Gmail
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onQuickCode(o)}
                        className="h-7 text-xs border-dashed text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
                        title="Enter code manually"
                      >
                        <Zap className="size-3 mr-1 fill-amber-500" /> Manual
                      </Button>
                    </div>
                  )}
                </td>
              )}
              {service === "boost" && (
                <td className="p-3">
                  {o.boost_order_id ? (
                    <div className="flex flex-col gap-0.5">
                      <span className="inline-flex items-center gap-1 text-xs font-mono font-bold text-violet-600 dark:text-violet-400">
                        <Rocket className="size-3" /> #{o.boost_order_id}
                      </span>
                      <span className="text-[10px] text-muted-foreground uppercase">{o.boost_status || o.delivery_status}</span>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      disabled={dispatchingOrderRef === o.reference || o.payment_status !== "paid"}
                      onClick={() => onDispatchBoost?.(o)}
                      className="h-7 text-xs bg-violet-600 hover:bg-violet-700 text-white font-medium"
                      title={o.payment_status !== "paid" ? "Awaiting customer payment" : "Dispatch to BoostUpGH"}
                    >
                      {dispatchingOrderRef === o.reference ? (
                        <Loader2 className="size-3 animate-spin mr-1" />
                      ) : (
                        <Rocket className="size-3 mr-1" />
                      )}
                      Dispatch Now
                    </Button>
                  )}
                </td>
              )}
              <td className="p-3 text-right whitespace-nowrap">
                <div className="flex items-center justify-end gap-1">
                  {service === "netflix" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onQuickCode(o)}
                      title="Quick enter/update code"
                      className="text-amber-600"
                    >
                      <Zap className="size-3.5 fill-amber-500" />
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onEdit(o)}
                    title="Edit order or code"
                  >
                    <Edit2 className="size-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => onDelete(o.id, o.reference)}
                    title="Delete order"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
};

export default AdminServices;
