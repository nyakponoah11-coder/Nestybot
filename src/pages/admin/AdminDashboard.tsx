import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { invokeApiFunction, supabase as typedSupabase } from "@/integrations/supabase/client";
import { getCacheMeta, setCache, createSmartInterval } from "@/lib/localCache";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = typedSupabase as any;
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DeliveryTracker } from "@/components/DeliveryTracker";
import { PhoneLink } from "@/components/PhoneLink";
import { NETWORK_LABEL, networkClass, formatGHS } from "@/lib/networks";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Loader2,
  Wallet,
  PlusCircle,
  ShoppingBag,
  CheckCircle2,
  Clock,
  MessageSquareText,
  Store,
  Package,
  MessageCircle,
  Sparkles,
  Gift,
  GraduationCap,
  BarChart3,
  MessageSquare,
  Settings,
  ExternalLink,
  ArrowUpRight,
  Zap,
  RefreshCw,
  AlertTriangle,
  Send,
  Users,
  Copy,
  Check,
  Bot,
  Terminal,
  Eye,
  CalendarDays,
} from "lucide-react";

type OrderFilter = "all" | "data" | "whatsapp" | "services" | "checkers";

const AdminDashboard = () => {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [orderFilter, setOrderFilter] = useState<OrderFilter>("all");

  // WhatsApp Bot Admin Command state
  const [botModalOpen, setBotModalOpen] = useState(false);
  const [botSnippetOpen, setBotSnippetOpen] = useState(false);
  const [botReportText, setBotReportText] = useState("");
  const [loadingReport, setLoadingReport] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  // DataMart Developer Wallet Top Up State
  const [dmTopupModalOpen, setDmTopupModalOpen] = useState(false);
  const [dmTopupAmount, setDmTopupAmount] = useState("50");
  const [dmTopupPhone, setDmTopupPhone] = useState("0547228161");
  const [dmTopupNetwork, setDmTopupNetwork] = useState("MTN");
  const [dmTopupSubmitting, setDmTopupSubmitting] = useState(false);
  const [dmTopupStatusText, setDmTopupStatusText] = useState("");
  const [dmClaimTrxId, setDmClaimTrxId] = useState("");
  const [dmClaimSubmitting, setDmClaimSubmitting] = useState(false);
  const [dmInfo, setDmInfo] = useState<any>(null);

  const loadDmTopupInfo = async () => {
    try {
      const res = await invokeApiFunction("admin-data", { body: { action: "getDatamartTopupInfo" } });
      if (res.data?.ok) {
        setDmInfo(res.data);
        if (res.data.topupPhone) setDmTopupPhone(res.data.topupPhone);
      }
    } catch {}
  };

  const handleInitiateDmTopup = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(dmTopupAmount);
    if (isNaN(amt) || amt <= 0) {
      toast.error("Please enter a valid deposit amount.");
      return;
    }
    setDmTopupSubmitting(true);
    setDmTopupStatusText("Dispatching MoMo prompt to your phone...");
    try {
      const res = await invokeApiFunction("admin-data", {
        body: {
          action: "initiateDatamartTopup",
          amount: amt,
          phone: dmTopupPhone,
          network: dmTopupNetwork,
        },
      });

      if (!res.data?.ok) {
        toast.error(res.data?.error || "Failed to trigger top-up prompt.");
        setDmTopupStatusText("");
        setDmTopupSubmitting(false);
        return;
      }

      const trxId = res.data.transactionId;
      toast.success(res.data.message || `Prompt sent to ${dmTopupPhone}! Approve on your phone.`);
      setDmTopupStatusText("Prompt sent! Please approve on your phone with your MoMo PIN...");

      // Poll for approval status
      let attempts = 0;
      const poll = setInterval(async () => {
        attempts++;
        try {
          const stRes = await invokeApiFunction("admin-data", {
            body: { action: "checkDatamartTopupStatus", transactionId: trxId },
          });
          if (stRes.data?.status === "completed") {
            clearInterval(poll);
            setDmTopupSubmitting(false);
            setDmTopupStatusText("Deposit completed! Wallet credited.");
            const newBal = stRes.data.newBalance;
            if (newBal != null) {
              setStats((prev: any) => ({ ...prev, wallet_balance: newBal }));
            }
            toast.success(`🎉 DataMart Wallet Credited with GH₵ ${amt.toFixed(2)}! New Balance: GH₵ ${newBal != null ? Number(newBal).toFixed(2) : "Updated"}`);
            setTimeout(() => setDmTopupModalOpen(false), 2000);
          } else if (attempts >= 25 || stRes.data?.status === "failed") {
            clearInterval(poll);
            setDmTopupSubmitting(false);
            if (stRes.data?.status === "failed") {
              setDmTopupStatusText("Transaction failed or declined on phone.");
              toast.error("Deposit declined or failed.");
            } else {
              setDmTopupStatusText("Awaiting network response. If approved, funds reflect shortly.");
            }
          }
        } catch {}
      }, 3000);
    } catch (err: any) {
      toast.error(err?.message || "Failed to contact top-up bridge.");
      setDmTopupStatusText("");
      setDmTopupSubmitting(false);
    }
  };

  const handleClaimDmDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dmClaimTrxId.trim()) {
      toast.error("Please enter the MoMo Transaction ID from your SMS receipt.");
      return;
    }
    setDmClaimSubmitting(true);
    try {
      const res = await invokeApiFunction("admin-data", {
        body: {
          action: "claimDatamartDeposit",
          trxId: dmClaimTrxId.trim(),
          phone: dmTopupPhone,
          network: "mtn",
        },
      });
      if (res.data?.ok) {
        const newBal = res.data.newBalance;
        if (newBal != null) {
          setStats((prev: any) => ({ ...prev, wallet_balance: newBal }));
        }
        toast.success(`🎉 ${res.data.message || "Deposit successfully claimed!"}`);
        setDmClaimTrxId("");
        setTimeout(() => setDmTopupModalOpen(false), 1500);
      } else {
        toast.error(res.data?.error || "Could not claim deposit. Check Transaction ID.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to submit claim.");
    } finally {
      setDmClaimSubmitting(false);
    }
  };

  const [aiIssues, setAiIssues] = useState<any[]>([]);
  const [executingAiAction, setExecutingAiAction] = useState<string | null>(null);

  const loadAiIssues = async () => {
    try {
      const res = await invokeApiFunction("admin-ai", { body: { action: "getAiIssuesAndProposals" } });
      if (res.data?.issues) {
        setAiIssues(res.data.issues);
      }
    } catch {}
  };

  const handleExecuteDashboardAction = async (issueId: string, action: any) => {
    setExecutingAiAction(issueId);
    try {
      const res = await invokeApiFunction("admin-ai", {
        body: {
          action: "executeAiAction",
          action_type: action.action_type,
          payload: action.payload,
        },
      });
      if (res.data?.ok) {
        toast.success(res.data.message || "Action executed successfully!");
        setAiIssues((prev) => prev.filter((i) => i.id !== issueId));
        await loadData(true, true);
      } else {
        toast.error(res.data?.error || "Failed to execute action");
      }
    } catch (err: any) {
      toast.error(err?.message || "Execution error");
    } finally {
      setExecutingAiAction(null);
    }
  };

  const fetchBotReport = async () => {
    setLoadingReport(true);
    try {
      const res = await fetch("/api/whatsapp-bot");
      if (res.ok) {
        const data = await res.json();
        setBotReportText(data.reply || data.text || "");
      } else {
        const { data } = await invokeApiFunction("admin-stats", { query: { fn: "whatsapp-bot" } });
        if (data?.reply) setBotReportText(data.reply);
      }
    } catch {
      toast.error("Could not fetch report preview.");
    } finally {
      setLoadingReport(false);
      setBotModalOpen(true);
    }
  };

  useEffect(() => {
    document.title = "Admin · All-in-One Dashboard";
  }, []);

  const loadData = async (silent = false, force = false) => {
    if (!silent) setRefreshing(true);
    let loaded = false;
    loadAiIssues().catch(() => {});

    // Check local cache first to avoid redundant Supabase egress
    if (!force) {
      const cached = getCacheMeta<any>("admin_dashboard_stats");
      if (cached.exists && cached.data) {
        setStats(cached.data);
        setLoading(false);
        // If cache is fresh (< 60s), avoid network call entirely
        if (!cached.isStale) {
          if (!silent) setRefreshing(false);
          return;
        }
      }
    }

    // 1. Try backend admin-stats API
    try {
      const { data, error } = await invokeApiFunction("admin-stats", { body: { force } });
      if (data && !error && !data.error) {
        setStats(data);
        setCache("admin_dashboard_stats", data, 120 * 1000);
        loaded = true;
        setLoading(false);
        setRefreshing(false);
        if (force) {
          toast.success("Balances and metrics refreshed live!");
        }
        return;
      }
    } catch (_) {}

    // 2. Direct client fallback across all tables
    try {
      const [
        ordersRes,
        serviceRes,
        checkerRes,
        productsRes,
        chatsRes,
        freeDataRes,
        referralsRes,
        settingsRes,
      ] = await Promise.all([
        supabase.from("orders").select("id, reference, amount, payment_status, delivery_status, network, capacity, bundle, recipient_phone, phone_number, whatsapp_phone, momo_number, customer_phone, phone, created_at, notes, status, datamart_status").order("created_at", { ascending: false }).limit(60),
        supabase.from("service_orders").select("id, reference, service, notes, customer_phone, amount, payment_status, delivery_status, created_at").order("created_at", { ascending: false }).limit(40),
        supabase.from("checker_orders").select("id, reference, checker_type, customer_phone, amount, payment_status, delivery_status, created_at").order("created_at", { ascending: false }).limit(40),
        supabase.from("products").select("id, in_stock, network"),
        supabase.from("chat_conversations").select("id, status, unread_for_support"),
        supabase.from("free_data_codes").select("id, code, claimed").limit(100),
        supabase.from("referrals").select("id", { count: "exact" }),
        supabase.from("settings").select("key, value").in("key", [
          "datamart_last_balance",
          "arkesel_last_balance",
          "arkesel_main_balance",
          "akwaaba_last_balance",
          "arkesel_api_key",
          "ARKESEL_API_KEY",
          "arkesel_sender_id",
          "shop_name",
          "whatsapp_bot_url",
          "whatsapp_channel_url",
          "support_phone",
          "ai_support_enabled",
        ]),
      ]);

      const ordersList = ordersRes.data || [];
      const serviceList = serviceRes.data || [];
      const checkerList = checkerRes.data || [];
      const prods = productsRes.data || [];
      const chats = chatsRes.data || [];
      const freeCodes = freeDataRes.data || [];

      const settingsMap: Record<string, string> = {};
      (settingsRes.data || []).forEach((r: any) => (settingsMap[r.key] = r.value || ""));

      const isOrderPaid = (o: any) =>
        o?.payment_status === "paid" ||
        o?.status === "paid" ||
        o?.status === "delivered" ||
        o?.status === "completed" ||
        o?.delivery_status === "delivered" ||
        o?.delivery_status === "completed" ||
        Boolean(o?.whatsapp_phone);

      const isOrderDelivered = (o: any) => {
        const del = String(o?.delivery_status || "").toLowerCase().trim();
        const dm = String(o?.datamart_status || "").toLowerCase().trim();
        if (del === "delivered" || del === "completed" || dm === "completed" || dm === "delivered") {
          return true;
        }
        return o?.status === "delivered" || o?.status === "completed";
      };

      const now = new Date();
      const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));

      const paidData = ordersList.filter(isOrderPaid);
      const deliveredData = paidData.filter(isOrderDelivered);
      const pendingData = paidData.filter((o: any) => !isOrderDelivered(o) && !["failed", "refunded"].includes(o.delivery_status));
      const failedData = ordersList.filter((o: any) => o.delivery_status === "failed");

      const paidServices = serviceList.filter((s: any) => s.payment_status === "paid" || s.status === "paid");
      const paidCheckers = checkerList.filter((c: any) => c.payment_status === "paid" || c.status === "paid");

      const paidTodayData = paidData.filter((o: any) => o.created_at && new Date(o.created_at) >= startOfDay);
      const deliveredTodayData = paidTodayData.filter(isOrderDelivered);
      const paidTodayServices = paidServices.filter((s: any) => s.created_at && new Date(s.created_at) >= startOfDay);
      const paidTodayCheckers = paidCheckers.filter((c: any) => c.created_at && new Date(c.created_at) >= startOfDay);

      const todayOrdersCount = paidTodayData.length + paidTodayServices.length + paidTodayCheckers.length;
      const todayRev =
        paidTodayData.reduce((s, o: any) => s + Number(o.amount || 0), 0) +
        paidTodayServices.reduce((s, o: any) => s + Number(o.amount || 0), 0) +
        paidTodayCheckers.reduce((s, o: any) => s + Number(o.amount || 0), 0);
      const todayDeliveredCount = deliveredTodayData.length;

      const dataRev = paidData.reduce((s, o: any) => s + Number(o.amount || 0), 0);
      const servRev = paidServices.reduce((s, o: any) => s + Number(o.amount || 0), 0);
      const checkRev = paidCheckers.reduce((s, o: any) => s + Number(o.amount || 0), 0);
      const totalRev = dataRev + servRev + checkRev;

      // Group by network for data
      const byNet: Record<string, { orders: number; revenue: number; delivered: number }> = {};
      for (const o of ordersList) {
        const k = o.network || "UNKNOWN";
        byNet[k] ||= { orders: 0, revenue: 0, delivered: 0 };
        byNet[k].orders += 1;
        if (o.payment_status === "paid") byNet[k].revenue += Number(o.amount || 0);
        if (o.payment_status === "paid" && (o.delivery_status === "delivered" || o.delivery_status === "completed")) byNet[k].delivered += 1;
      }

      // Build unified recent list
      const unified: any[] = [];
      ordersList.forEach((o: any) => {
        const isWa = Boolean(o.notes && String(o.notes).toLowerCase().includes("whatsapp")) || Boolean(o.whatsapp_phone) || String(o.network || "").toUpperCase() === "MASHUP";
        const phone = o.recipient_phone || o.phone_number || o.whatsapp_phone || o.momo_number || o.customer_phone || o.phone || "—";
        unified.push({
          id: o.id,
          reference: o.reference || o.ref || o.id,
          type: isWa ? "whatsapp" : "data",
          category_label: isWa ? "WhatsApp Bot" : "Data Bundle",
          network: o.network,
          capacity: o.capacity ? `${o.capacity}GB` : (o.bundle || "Data"),
          recipient: phone,
          amount: Number(o.amount || 0),
          payment_status: o.payment_status || (o.status === "pending_manual" ? "paid" : o.status) || "pending",
          delivery_status: o.delivery_status || o.status || "pending",
          datamart_status: o.datamart_status,
          created_at: o.created_at,
        });
      });

      serviceList.forEach((s: any) => {
        unified.push({
          id: s.id,
          reference: s.reference,
          type: s.service || "service",
          category_label: s.service === "netflix" ? "Netflix Pass" : s.service === "mashup" ? "MTN Mashup" : "Service",
          network: s.service === "netflix" ? "Netflix" : "MTN",
          capacity: s.notes || (s.service === "netflix" ? "30-Day Pass" : "Combo"),
          recipient: s.customer_phone || "—",
          amount: Number(s.amount || 0),
          payment_status: s.payment_status,
          delivery_status: s.delivery_status,
          created_at: s.created_at,
        });
      });

      checkerList.forEach((c: any) => {
        unified.push({
          id: c.id,
          reference: c.reference,
          type: "checker",
          category_label: `${String(c.checker_type || "WAEC").toUpperCase()} Checker`,
          network: "WAEC",
          capacity: `${String(c.checker_type || "WAEC").toUpperCase()} PIN`,
          recipient: c.customer_phone || "—",
          amount: Number(c.amount || 0),
          payment_status: c.payment_status,
          delivery_status: c.delivery_status,
          created_at: c.created_at,
        });
      });

      unified.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      const lastDm = Number(settingsMap["datamart_last_balance"]);
      const lastArkeselSms = Number(settingsMap["arkesel_last_balance"]);
      const lastArkeselMain = settingsMap["arkesel_main_balance"] || null;
      const lastAkwaaba = Number(settingsMap["akwaaba_last_balance"]);

      const hasArkeselKey = Boolean(
        settingsMap["arkesel_api_key"] ||
        settingsMap["ARKESEL_API_KEY"] ||
        Object.keys(settingsMap).some(k => k.toLowerCase().includes("arkesel") && k.toLowerCase().includes("key"))
      );

      const builtStats = {
        totals: {
          revenue: totalRev,
          orders: paidData.length + paidServices.length + paidCheckers.length,
          delivered: deliveredData.length,
          pending: pendingData.length + paidServices.filter((s: any) => s.delivery_status !== "delivered").length,
          failed: failedData.length,
        },
        today: {
          orders: todayOrdersCount,
          count: todayOrdersCount,
          paid_orders: todayOrdersCount,
          revenue: todayRev,
          delivered: todayDeliveredCount,
          pending: Math.max(0, todayOrdersCount - todayDeliveredCount),
        },
        wallet_balance: !isNaN(lastDm) ? lastDm : null,
        akwaaba_balance: !isNaN(lastAkwaaba) ? lastAkwaaba : null,
        arkesel_sms_balance: !isNaN(lastArkeselSms) ? lastArkeselSms : null,
        arkesel_main_balance: lastArkeselMain,
        arkesel_status: {
          configured: hasArkeselKey,
          sms_balance: !isNaN(lastArkeselSms) ? lastArkeselSms : null,
          main_balance: lastArkeselMain,
          error: hasArkeselKey ? null : "Arkesel API key not configured in Settings",
        },
        by_network: byNet,
        unified_recent_orders: unified,
        sections: {
          products: { total: prods.length, in_stock: prods.filter((p: any) => p.in_stock !== false).length },
          orders: { total: ordersList.length, paid: paidData.length, delivered: deliveredData.length, pending: pendingData.length, failed: failedData.length, revenue: dataRev },
          services: { total: serviceList.length, paid: paidServices.length, revenue: servRev, pending: paidServices.filter((s: any) => s.delivery_status !== "delivered").length },
          checkers: { total: checkerList.length, paid: paidCheckers.length, revenue: checkRev, pending: 0 },
          free_data: { total: freeCodes.length, claimed: freeCodes.filter((f: any) => f.claimed).length },
          support: { open_chats: chats.filter((c: any) => c.status === "open").length, unread: chats.reduce((sum, c: any) => sum + Number(c.unread_for_support || 0), 0) },
          referrals: { total: referralsRes.count ?? 0 },
          bulk_sms: { sms_balance: !isNaN(lastArkeselSms) ? lastArkeselSms : null, sender_id: settingsMap["arkesel_sender_id"] || "D_1Gh" },
          settings: {
            shop_name: settingsMap["shop_name"] || "Data One",
            bot_url: settingsMap["whatsapp_bot_url"] || "",
            channel_url: settingsMap["whatsapp_channel_url"] || "",
            support_phone: settingsMap["support_phone"] || "",
            ai_support_enabled: settingsMap["ai_support_enabled"] !== "false",
          },
        },
      };

      setStats(builtStats);
      setCache("admin_dashboard_stats", builtStats, 5 * 60 * 1000);
      loaded = true;
    } catch (_) {}

    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    loadData();
    // Smart interval pauses automatically when tab is inactive/hidden, polling every 60s
    const stopPolling = createSmartInterval(() => loadData(true), 1200000);
    return () => stopPolling();
  }, []);

  const rawTotals = stats?.totals || {};
  const rawToday = stats?.today || {};
  const totals = {
    revenue: Number(rawTotals.revenue || 0),
    orders: Number(rawTotals.orders ?? rawTotals.total_orders ?? rawTotals.paid_orders ?? 0),
    delivered: Number(rawTotals.delivered ?? rawTotals.delivered_orders ?? 0),
    pending: Number(rawTotals.pending ?? rawTotals.pending_delivery ?? 0),
    failed: Number(rawTotals.failed ?? rawTotals.failed_orders ?? 0),
    todayOrders: Number(rawToday.orders ?? rawToday.paid_orders ?? rawToday.count ?? 0),
    todayRevenue: Number(rawToday.revenue || 0),
    todayDelivered: Number(rawToday.delivered || 0),
  };

  const sections = stats?.sections || {};
  const unifiedOrders: any[] = useMemo(() => {
    if (Array.isArray(stats?.unified_recent_orders) && stats.unified_recent_orders.length > 0) {
      return stats.unified_recent_orders;
    }
    return (stats?.recent_orders || []).map((o: any) => ({
      id: o.id,
      reference: o.reference,
      type: "data",
      category_label: "Data Bundle",
      network: o.network,
      capacity: o.capacity ? `${o.capacity}GB` : "Data",
      recipient: o.recipient_phone,
      amount: Number(o.amount || 0),
      payment_status: o.payment_status,
      delivery_status: o.delivery_status,
      datamart_status: o.datamart_status,
      created_at: o.created_at,
    }));
  }, [stats]);

  const filteredOrders = useMemo(() => {
    if (orderFilter === "all") return unifiedOrders.slice(0, 20);
    if (orderFilter === "data") return unifiedOrders.filter(o => o.type === "data").slice(0, 20);
    if (orderFilter === "whatsapp") return unifiedOrders.filter(o => o.type === "whatsapp").slice(0, 20);
    if (orderFilter === "services") return unifiedOrders.filter(o => o.type === "netflix" || o.type === "mashup" || o.type === "service").slice(0, 20);
    if (orderFilter === "checkers") return unifiedOrders.filter(o => o.type === "checker").slice(0, 20);
    return unifiedOrders.slice(0, 20);
  }, [unifiedOrders, orderFilter]);

  if (loading) {
    return (
      <div className="grid place-items-center py-24">
        <Loader2 className="size-8 animate-spin text-accent" />
        <p className="text-xs text-muted-foreground mt-2">Connecting all admin sections...</p>
      </div>
    );
  }

  const shopName = sections.settings?.shop_name || "Data One";
  const unreadSupportCount = sections.support?.unread || 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* 1. Header Command Banner */}
      <div className="relative overflow-hidden rounded-3xl p-6 md:p-8 bg-gradient-to-r from-indigo-700 via-purple-700 to-amber-600 text-white shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-xs font-semibold backdrop-blur-sm mb-2">
              <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
              All Admin Services Connected & Live
            </div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight">{shopName} Command Center</h1>
            <p className="text-sm md:text-base opacity-90 mt-1 max-w-2xl">
              Unified control panel linking your Storefront, Orders, WhatsApp Bot, Services, WAEC Checkers, Free Data & Live Support.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              asChild
              className="bg-white text-indigo-900 font-bold hover:bg-white/90 shadow-md rounded-xl"
            >
              <Link to="/" target="_blank" rel="noopener noreferrer">
                <Store className="size-4 mr-1.5" /> View Shop <ExternalLink className="size-3.5 ml-1 opacity-70" />
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadData(false, true)}
              disabled={refreshing}
              className="bg-white/10 hover:bg-white/20 text-white border-white/20 rounded-xl"
            >
              <RefreshCw className={`size-3.5 mr-1.5 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* 2. Automated Delivery Tracker */}
      <DeliveryTracker />

      {/* 2b. Stony AI Autonomous Action Center */}
      <div className="rounded-2xl border bg-card p-4 sm:p-5 shadow-sm transition-all hover:border-emerald-500/40">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 flex items-center justify-center font-bold shadow-sm">
              <Bot className="size-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base flex items-center gap-2">
                  Stony AI Action Center
                  <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30 text-[10px] px-2 py-0.5">
                    Human Confirmation Active
                  </Badge>
                </h3>
              </div>
              <p className="text-xs text-muted-foreground">
                Autonomous system diagnostics & suggested tasks. Stony never executes without your confirmation.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              asChild
              variant="outline"
              size="sm"
              className="text-xs h-8 border-emerald-500/30 hover:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold"
            >
              <Link to="/admin/ai-assistant">
                <Sparkles className="size-3.5 mr-1 text-emerald-500" /> Open Full AI Co-Pilot
              </Link>
            </Button>
          </div>
        </div>

        {aiIssues.length > 0 ? (
          <div className="space-y-2.5 mt-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-500">
              <AlertTriangle className="size-3.5" />
              <span>{aiIssues.length} system {aiIssues.length === 1 ? "issue" : "issues"} detected requiring your attention:</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {aiIssues.slice(0, 4).map((issue: any) => (
                <div
                  key={issue.id}
                  className="rounded-xl border border-border/80 bg-muted/30 p-3 flex flex-col justify-between gap-2.5 text-xs shadow-xs"
                >
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Badge
                        variant={issue.severity === "high" ? "destructive" : "secondary"}
                        className="text-[9px] uppercase font-bold px-1.5 py-0"
                      >
                        {issue.severity}
                      </Badge>
                      <span className="font-semibold text-foreground truncate">{issue.title}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground line-clamp-2">{issue.description}</p>
                  </div>

                  {issue.suggested_actions && issue.suggested_actions[0] && (
                    <div className="pt-2 border-t border-border/50 flex items-center justify-between gap-2">
                      <span className="text-[10px] text-muted-foreground truncate">
                        Proposal: {issue.suggested_actions[0].action_label}
                      </span>
                      <Button
                        size="sm"
                        disabled={executingAiAction === issue.id}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] h-7 px-2.5 shrink-0 font-bold"
                        onClick={() => handleExecuteDashboardAction(issue.id, issue.suggested_actions[0])}
                      >
                        {executingAiAction === issue.id ? (
                          <>
                            <Loader2 className="size-3 animate-spin mr-1" /> Executing...
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="size-3 mr-1" /> Confirm & Execute
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/20 p-3 flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
              <span>All 13 system pillars operating cleanly. No stuck orders or anomalies detected.</span>
            </div>
            <Link to="/admin/ai-assistant" className="text-emerald-500 hover:underline font-medium text-[11px] shrink-0">
              Chat with Stony →
            </Link>
          </div>
        )}
      </div>

      {/* 3. Live Balances & Core Metrics */}
      {/* 3. Live Balances & Core Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
        <StatCard
          icon={<Wallet className="size-4 text-emerald-400" />}
          label="Telecom Wallet"
          value={
            stats?.wallet_balance !== null && stats?.wallet_balance !== undefined
              ? formatGHS(stats.wallet_balance)
              : stats?.akwaaba_balance !== null && stats?.akwaaba_balance !== undefined
              ? formatGHS(stats.akwaaba_balance)
              : "Unavailable"
          }
          hint={
            stats?.wallet_balance !== null && stats?.wallet_balance !== undefined
              ? "DataMart • Click to Top Up ⚡"
              : stats?.akwaaba_balance !== null && stats?.akwaaba_balance !== undefined
              ? "Akwaaba delivery wallet"
              : stats?.datamart_status?.error || "Automated delivery balance"
          }
          cls="bg-gradient-to-br from-emerald-950/40 via-slate-900 to-slate-950 text-white border border-emerald-500/30 hover:border-emerald-400/60"
          onClick={() => {
            loadDmTopupInfo();
            setDmTopupModalOpen(true);
          }}
        />
        <StatCard
          icon={<Wallet className="size-4" />}
          label="Arkesel Balance"
          to="/admin/settings"
          value={
            stats?.arkesel_status?.configured === false
              ? "Key Not Set"
              : stats?.arkesel_main_balance && stats?.arkesel_main_balance !== "0" && stats?.arkesel_main_balance !== "0.00"
              ? (stats.arkesel_main_balance.startsWith("GH") ? stats.arkesel_main_balance : `GH₵ ${stats.arkesel_main_balance}`)
              : stats?.arkesel_sms_balance !== null && stats?.arkesel_sms_balance !== undefined
              ? (stats.arkesel_main_balance ? `GH₵ ${stats.arkesel_main_balance}` : `${stats.arkesel_sms_balance} SMS`)
              : stats?.arkesel_main_balance
              ? `GH₵ ${stats.arkesel_main_balance}`
              : stats?.arkesel_status?.error
              ? "Check Key"
              : "GH₵ 0.00"
          }
          hint={
            stats?.arkesel_status?.configured === false
              ? "Click to configure in Settings →"
              : stats?.arkesel_status?.error
              ? `Error: ${stats.arkesel_status.error.slice(0, 28)} →`
              : stats?.arkesel_main_balance && stats?.arkesel_sms_balance !== null && stats?.arkesel_sms_balance !== undefined
              ? `${stats.arkesel_sms_balance} SMS · ${stats?.sections?.bulk_sms?.sender_id || "D_1Gh"}`
              : `Sender: ${stats?.sections?.bulk_sms?.sender_id || "D_1Gh"}`
          }
          cls="bg-gradient-to-br from-emerald-700 to-teal-900 text-white border border-emerald-600/40 hover:border-emerald-400"
        />
        <StatCard
          icon={<MessageSquareText className="size-4" />}
          label="SMS Credits"
          to="/admin/settings"
          value={
            stats?.arkesel_status?.configured === false
              ? "Key Not Set"
              : stats?.arkesel_sms_balance !== null && stats?.arkesel_sms_balance !== undefined
              ? `${stats.arkesel_sms_balance} SMS`
              : stats?.arkesel_main_balance
              ? `GH₵ ${stats.arkesel_main_balance}`
              : stats?.arkesel_status?.error
              ? "Check Key"
              : "0 SMS"
          }
          hint={
            stats?.arkesel_status?.configured === false
              ? "Click to configure in Settings →"
              : stats?.arkesel_status?.error
              ? "Click to verify API key →"
              : "Order & OTP Alerts"
          }
          cls="bg-gradient-to-br from-teal-700 to-cyan-900 text-white border border-teal-600/40 hover:border-teal-400"
        />
        <StatCard
          icon={<ShoppingBag className="size-4" />}
          label="Today's Orders"
          value={`${totals.todayOrders} Orders`}
          hint={`${formatGHS(totals.todayRevenue)} today`}
          cls="bg-gradient-to-br from-sky-600 to-blue-900 text-white border border-sky-500/40"
        />
        <StatCard
          icon={<Zap className="size-4" />}
          label="Gross Revenue"
          value={formatGHS(totals.revenue)}
          hint="All completed streams"
          cls="bg-gradient-to-br from-indigo-600 to-indigo-900 text-white border border-indigo-500/40"
        />
        <StatCard
          icon={<ShoppingBag className="size-4" />}
          label="Total Orders"
          value={String(totals.orders)}
          hint="All historical orders"
          cls="bg-gradient-to-br from-purple-600 to-purple-900 text-white border border-purple-500/40"
        />
        <StatCard
          icon={<CheckCircle2 className="size-4" />}
          label="Delivered / Queue"
          value={`${totals.delivered} / ${totals.pending}`}
          hint={`${totals.failed} issues`}
          cls="bg-gradient-to-br from-amber-600 to-rose-900 text-white border border-amber-500/40"
        />
      </div>

      {/* 3.5 WhatsApp Bot "ADMIN" Command Hub Card */}
      <Card className="p-5 md:p-6 rounded-3xl bg-gradient-to-r from-emerald-950/90 via-slate-900 to-teal-950/90 border-2 border-emerald-500/40 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 size-48 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 relative z-10">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400">
                <Bot className="size-3.5 mr-1" /> WhatsApp Bot Admin Ready
              </Badge>
              <span className="text-xs text-emerald-300 font-mono bg-emerald-500/15 px-2 py-0.5 rounded-full border border-emerald-500/30">
                Type "Admin" in WhatsApp
              </span>
            </div>
            <h3 className="text-lg md:text-xl font-bold flex items-center gap-2">
              <MessageCircle className="size-5 text-emerald-400" />
              WhatsApp Bot "ADMIN" Live Reply Connected
            </h3>
            <p className="text-xs md:text-sm text-slate-300 max-w-2xl leading-relaxed">
              When you open your bot chat and text <strong className="text-emerald-400">Admin</strong>, your bot hosted on Render calls your store's live endpoint and immediately returns everything from this dashboard (revenue, balances, orders, delivery queue & support chats).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              onClick={fetchBotReport}
              disabled={loadingReport}
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold shadow-md rounded-xl"
              size="sm"
            >
              {loadingReport ? (
                <Loader2 className="size-4 animate-spin mr-1.5" />
              ) : (
                <Eye className="size-4 mr-1.5" />
              )}
              Preview Bot Reply
            </Button>
            <Button
              onClick={() => setBotSnippetOpen(true)}
              variant="outline"
              size="sm"
              className="border-emerald-500/50 bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-200 rounded-xl"
            >
              <Terminal className="size-4 mr-1.5" />
              Render Bot Code Snippet
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const url = `${window.location.origin}/api/whatsapp-bot`;
                navigator.clipboard.writeText(url);
                setCopiedUrl(true);
                toast.success("Bot Endpoint URL copied to clipboard!");
                setTimeout(() => setCopiedUrl(false), 2500);
              }}
              className="text-emerald-300 hover:text-white hover:bg-emerald-500/20 rounded-xl text-xs"
            >
              {copiedUrl ? <Check className="size-3.5 mr-1 text-emerald-400" /> : <Copy className="size-3.5 mr-1" />}
              {copiedUrl ? "Copied URL" : "Copy API URL"}
            </Button>
          </div>
        </div>
      </Card>

      {/* 4. Complete Section Hub: Connects Every Section from Dashboard to View Shop */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-accent" />
            Admin Sections Hub
          </h2>
          <span className="text-xs text-muted-foreground font-medium">13 connected portals & tools</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
          {/* A. Products */}
          <HubCard
            to="/admin/products"
            icon={<Package className="size-5 text-indigo-400" />}
            title="Products & Packages"
            badge={`${sections.products?.in_stock ?? 0} In Stock`}
            description="Manage MTN, Telecel, and AT data packages, set prices, and stock statuses."
            actionText="Manage Packages"
          />

          {/* B. All Orders */}
          <HubCard
            to="/admin/orders"
            icon={<ShoppingBag className="size-5 text-purple-400" />}
            title="Website Orders"
            badge={`${sections.orders?.paid ?? totals.orders} Paid`}
            description="Inspect all direct Paystack data orders, track live statuses, or manually re-deliver."
            actionText="View Orders"
          />

          {/* C. WhatsApp Orders */}
          <HubCard
            to="/admin/whatsapp-orders"
            icon={<MessageCircle className="size-5 text-emerald-400" />}
            title="WhatsApp Bot Orders"
            badge="Live Feed"
            description="Customer orders placed directly through the WhatsApp automated chat bot."
            actionText="View Bot Orders"
          />

          {/* D. Bulk SMS */}
          <HubCard
            to="/admin/bulk-sms"
            icon={<Send className="size-5 text-cyan-400" />}
            title="Bulk SMS Broadcast"
            badge={sections.bulk_sms?.sender_id || "D_1Gh"}
            description="Send promotional broadcast messages to all store customers using your Sender ID."
            actionText="Broadcast SMS"
          />

          {/* E. Services (Netflix & Mashup) */}
          <HubCard
            to="/admin/services"
            icon={<Sparkles className="size-5 text-pink-400" />}
            title="Services & Netflix"
            badge={`${sections.services?.total ?? 0} Orders`}
            description="Netflix 30-day screen passes, MTN Mashup voice/data combos, and AFA registrations."
            actionText="Manage Services"
          />

          {/* F. Result Checkers */}
          <HubCard
            to="/admin/checkers"
            icon={<GraduationCap className="size-5 text-amber-400" />}
            title="Result Checkers"
            badge={`${sections.checkers?.total ?? 0} Sold`}
            description="WAEC, BECE, WASSCE & NovDec checkers with instant serial & PIN delivery."
            actionText="Checkers Inventory"
          />

          {/* G. Free Data Vouchers */}
          <HubCard
            to="/admin/free-data"
            icon={<Gift className="size-5 text-violet-400" />}
            title="Free Data Vouchers"
            badge={`${sections.free_data?.claimed ?? 0} Claimed`}
            description="Generate promotional claim codes, review claimed numbers, and deliver in bulk."
            actionText="Voucher Codes"
          />

          {/* H. Spin & Win */}
          <HubCard
            to="/admin/spin-report"
            icon={<Sparkles className="size-5 text-rose-400" />}
            title="Spin & Win Game"
            badge="Lucky Wheel"
            description="Track lucky wheel players, free 1GB/2GB data prizes won, and claim validation."
            actionText="Spin Reports"
          />

          {/* I. Referrals */}
          <HubCard
            to="/admin/referrals"
            icon={<Users className="size-5 text-teal-400" />}
            title="Referrals & Rewards"
            badge={`${sections.referrals?.total ?? 0} Referrers`}
            description="Monitor customer referral links, friend purchases, and reward bundle payouts."
            actionText="Referral Program"
          />

          {/* J. Analytics */}
          <HubCard
            to="/admin/analytics"
            icon={<BarChart3 className="size-5 text-blue-400" />}
            title="Sales Analytics"
            badge="Charts & Trends"
            description="Deep dive into daily turnover, top selling data tiers, and payment channel insights."
            actionText="View Analytics"
          />

          {/* Visitor Calendar & Traffic */}
          <HubCard
            to="/admin/visitors"
            icon={<CalendarDays className="size-5 text-sky-400" />}
            title="Visitor Calendar"
            badge="Traffic"
            description="Select any date to see how many people opened your link, their source (WhatsApp, social), and hourly opens."
            actionText="Open Visitor Calendar"
          />

          {/* K. Live Support */}
          <HubCard
            to="/admin/support"
            icon={<MessageSquare className="size-5 text-yellow-400" />}
            title="Customer Support & AI"
            badge={unreadSupportCount > 0 ? `${unreadSupportCount} UNREAD` : "24/7 AI Ready"}
            badgeClass={unreadSupportCount > 0 ? "bg-rose-500 text-white animate-pulse" : undefined}
            description="Chat live with store visitors, review AI bot conversations, and resolve inquiries."
            actionText="Open Support Inbox"
          />

          {/* L. Settings */}
          <HubCard
            to="/admin/settings"
            icon={<Settings className="size-5 text-slate-400" />}
            title="Store & AI Settings"
            badge="Config"
            description="Manage bot links, WhatsApp channel URL, SMS alert number, and Groq & Gemini AI keys with multi-model fallback."
            actionText="Configure Settings"
          />

          {/* M. View Shop */}
          <HubCard
            to="/"
            target="_blank"
            icon={<Store className="size-5 text-emerald-400" />}
            title="Storefront Preview"
            badge="Live Shop"
            description="Open the customer-facing storefront in a new tab to test bundles, wheel, and chat."
            actionText="Open Storefront ↗"
            highlight
          />
        </div>
      </div>

      {/* 5. Network Sales Breakdown */}
      <Card className="p-5 md:p-6 bg-gradient-card border">
        <h2 className="font-bold text-lg mb-3 flex items-center gap-2">
          <span>By Telecom Network</span>
          <span className="text-xs text-muted-foreground font-normal">(Today's Data Orders)</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {Object.entries(stats?.by_network || {}).length === 0 && (
            <p className="text-sm text-muted-foreground col-span-3 py-4 text-center">No network orders recorded yet today.</p>
          )}
          {Object.entries(stats?.by_network || {} as Record<string, any>).map(([net, v]: any) => (
            <div key={net} className="rounded-2xl border p-4 bg-muted/40 hover:bg-muted/60 transition">
              <div className="flex items-center justify-between">
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${networkClass(net)}`}>
                  {NETWORK_LABEL[net] || net}
                </span>
                <span className="text-xs text-muted-foreground font-medium">{v.orders} orders</span>
              </div>
              <div className="mt-3 text-2xl font-black">{formatGHS(v.revenue)}</div>
              <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5 text-emerald-500" />
                <span>{v.delivered} delivered successfully</span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* 6. Multi-Stream Unified Recent Orders Table */}
      <Card className="p-5 md:p-6 bg-gradient-card border">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="font-bold text-lg">Multi-Stream Unified Activity</h2>
            <p className="text-xs text-muted-foreground">
              Combined live stream across Data Bundles, WhatsApp Bot, Services (Netflix/Mashup), and Result Checkers.
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: "all", label: "All Streams" },
                { id: "data", label: "Data Bundles" },
                { id: "whatsapp", label: "WhatsApp Bot" },
                { id: "services", label: "Netflix & Mashup" },
                { id: "checkers", label: "Checkers" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setOrderFilter(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                  orderFilter === tab.id
                    ? "bg-accent text-accent-foreground shadow-sm"
                    : "bg-muted/80 text-muted-foreground hover:bg-muted"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/70 text-left text-xs text-muted-foreground uppercase tracking-wider border-b">
              <tr>
                <th className="py-3 px-3.5">Time</th>
                <th className="py-3 px-3.5">Stream</th>
                <th className="py-3 px-3.5">Package</th>
                <th className="py-3 px-3.5">Recipient</th>
                <th className="py-3 px-3.5">Amount</th>
                <th className="py-3 px-3.5">Payment</th>
                <th className="py-3 px-3.5">Delivery</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredOrders.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted-foreground">
                    No orders found under this stream filter.
                  </td>
                </tr>
              )}
              {filteredOrders.map((o: any) => (
                <tr key={`${o.type}-${o.id || o.reference}`} className="hover:bg-muted/30 transition">
                  <td className="py-3 px-3.5 whitespace-nowrap text-xs text-muted-foreground">
                    {o.created_at ? new Date(o.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
                  </td>
                  <td className="py-3 px-3.5 whitespace-nowrap">
                    <StreamBadge type={o.type} label={o.category_label} network={o.network} />
                  </td>
                  <td className="py-3 px-3.5 font-medium text-foreground">
                    {o.capacity || "Item"}
                  </td>
                  <td className="py-3 px-3.5 whitespace-nowrap">
                    <PhoneLink value={o.recipient} />
                  </td>
                  <td className="py-3 px-3.5 font-bold whitespace-nowrap">
                    {formatGHS(o.amount)}
                  </td>
                  <td className="py-3 px-3.5 whitespace-nowrap">
                    <StatusBadge s={o.payment_status} />
                  </td>
                  <td className="py-3 px-3.5 whitespace-nowrap">
                    <StatusBadge
                      s={
                        o.delivery_status === "delivered" ||
                        o.delivery_status === "completed" ||
                        o.datamart_status === "completed" ||
                        o.datamart_status === "delivered"
                          ? "delivered"
                          : o.delivery_status === "processing" || o.datamart_status === "processing"
                          ? "processing"
                          : o.datamart_status || o.delivery_status
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Dialog: Top Up DataMart Developer Wallet */}
      <Dialog open={dmTopupModalOpen} onOpenChange={setDmTopupModalOpen}>
        <DialogContent className="max-w-md bg-card border-border text-foreground p-6 rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <PlusCircle className="size-5 text-emerald-400" />
              <span>Credit DataMart Wallet</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Fund your DataMart developer balance directly to ensure seamless automated customer data deliveries.
            </DialogDescription>
          </DialogHeader>

          {/* Balance Preview Card */}
          <div className="p-3.5 rounded-2xl bg-muted/50 border border-border/60 text-xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-muted-foreground">Current Developer Balance:</span>
              <span className="text-emerald-400 font-mono font-black text-sm">
                {stats?.wallet_balance != null ? formatGHS(stats.wallet_balance) : "Loading..."}
              </span>
            </div>
            <div className="text-[11px] text-muted-foreground flex items-center justify-between pt-0.5">
              <span>Provider:</span>
              <span className="font-mono font-medium">DataMart Ghana (Yello / Telecel / AT)</span>
            </div>
          </div>

          {/* Quick preset amount chips */}
          <div>
            <Label className="text-xs font-semibold mb-1.5 block">Quick Amount</Label>
            <div className="grid grid-cols-4 gap-2">
              {["50", "100", "200", "500"].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setDmTopupAmount(preset)}
                  className={`py-1.5 px-2 rounded-xl text-xs font-bold font-mono transition border ${
                    dmTopupAmount === preset
                      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/50"
                      : "bg-muted/50 text-foreground border-border/60 hover:bg-muted"
                  }`}
                >
                  +GH₵ {preset}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleInitiateDmTopup} className="space-y-3.5">
            <div className="space-y-1.5">
              <Label htmlFor="dm_amt" className="text-xs font-semibold">
                Amount to Deposit (GH₵)
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">GH₵</span>
                <Input
                  id="dm_amt"
                  type="number"
                  step="0.01"
                  min="1"
                  required
                  placeholder="50.00"
                  value={dmTopupAmount}
                  onChange={(e) => setDmTopupAmount(e.target.value)}
                  className="pl-12 font-mono font-bold rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="dm_phone" className="text-xs font-semibold">
                Your Mobile Money Phone Number
              </Label>
              <Input
                id="dm_phone"
                type="tel"
                required
                placeholder="0547228161"
                value={dmTopupPhone}
                onChange={(e) => setDmTopupPhone(e.target.value)}
                className="font-mono font-bold rounded-xl text-xs"
              />
              <p className="text-[11px] text-muted-foreground">
                You will receive a prompt on this phone to enter your MoMo PIN.
              </p>
            </div>

            {dmTopupStatusText && (
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                {dmTopupSubmitting ? <Loader2 className="size-4 animate-spin shrink-0" /> : <CheckCircle2 className="size-4 shrink-0" />}
                <span>{dmTopupStatusText}</span>
              </div>
            )}

            <DialogFooter className="gap-2 sm:gap-0 pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDmTopupModalOpen(false)}
                className="rounded-xl text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={dmTopupSubmitting}
                className="rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs gap-1.5"
              >
                {dmTopupSubmitting ? <Loader2 className="size-3.5 animate-spin" /> : <Zap className="size-3.5" />}
                <span>Send MoMo Prompt</span>
              </Button>
            </DialogFooter>
          </form>

          {/* Alternative: Direct Merchant Transfer & Claim */}
          <div className="mt-2 pt-3 border-t border-border/60">
            <details className="text-xs group">
              <summary className="cursor-pointer text-[11px] font-semibold text-muted-foreground hover:text-foreground list-none flex items-center justify-between">
                <span>Or transfer manually & claim with Transaction ID</span>
                <span className="text-xs group-open:rotate-180 transition">▼</span>
              </summary>
              <form onSubmit={handleClaimDmDeposit} className="mt-2.5 space-y-2.5 bg-muted/40 p-3 rounded-2xl border border-border/50">
                <div className="text-[11px] leading-relaxed text-muted-foreground">
                  Send MoMo to <strong>0257476174</strong> (DANAA SAMUEL FRIMPONG / Dajo Unimarket, MTN), then enter your Transaction ID below:
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g. 29384729103"
                    value={dmClaimTrxId}
                    onChange={(e) => setDmClaimTrxId(e.target.value)}
                    className="font-mono text-xs rounded-xl"
                  />
                  <Button
                    type="submit"
                    disabled={dmClaimSubmitting}
                    variant="outline"
                    className="rounded-xl text-xs shrink-0 font-bold"
                  >
                    {dmClaimSubmitting ? <Loader2 className="size-3 animate-spin" /> : "Claim"}
                  </Button>
                </div>
              </form>
            </details>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog 1: WhatsApp Bot Report Live Preview */}
      <Dialog open={botModalOpen} onOpenChange={setBotModalOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col bg-slate-950 border-emerald-500/40 text-slate-100">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-400">
              <MessageCircle className="size-5" />
              Live WhatsApp Bot "ADMIN" Reply
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs">
              This is the exact real-time snapshot your Render WhatsApp bot will send when you type <strong>Admin</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto my-2 p-4 rounded-xl bg-slate-900/90 border border-emerald-500/20 font-mono text-xs whitespace-pre-wrap text-emerald-200 leading-relaxed select-text shadow-inner">
            {botReportText || "Loading live dashboard snapshot..."}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(botReportText);
                toast.success("WhatsApp report copied to clipboard!");
              }}
              className="border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200"
            >
              <Copy className="size-3.5 mr-1.5" /> Copy Text
            </Button>

            <Button
              size="sm"
              asChild
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold shadow-md"
            >
              <a
                href={`https://wa.me/?text=${encodeURIComponent(botReportText)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Send className="size-3.5 mr-1.5" /> Send to WhatsApp Now
              </a>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog 2: Render Bot Integration Snippet */}
      <Dialog open={botSnippetOpen} onOpenChange={setBotSnippetOpen}>
        <DialogContent className="max-w-xl max-h-[85vh] flex flex-col bg-slate-950 border-emerald-500/40 text-slate-100">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-400">
              <Terminal className="size-5" />
              Connect "ADMIN" Command to Your Render Bot
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs">
              Add this simple check into your bot's message handler on Render. When anyone texts <strong>Admin</strong>, it replies with the live dashboard!
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto my-2 p-3.5 rounded-xl bg-slate-900 border border-slate-800 font-mono text-xs text-sky-300 whitespace-pre-wrap leading-relaxed select-all">
{`// 1. In your Render WhatsApp Bot message handler:
const cleanText = (messageText || "").trim().toLowerCase();

if (cleanText === "admin") {
  try {
    // Call your live Data One store endpoint
    const response = await fetch("${window.location.origin}/api/whatsapp-bot");
    const result = await response.json();

    // Send formatted dashboard report back to the sender
    await sendWhatsAppMessage(senderPhone, result.reply);
  } catch (error) {
    console.error("Failed to fetch admin report:", error);
    await sendWhatsAppMessage(senderPhone, "⚠️ Unable to load admin dashboard right now.");
  }
  return;
}`}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800">
            <span className="text-[11px] text-slate-400">
              Endpoint: <code className="text-emerald-400">{window.location.origin}/api/whatsapp-bot</code>
            </span>
            <Button
              size="sm"
              onClick={() => {
                const snippet = `// 1. In your Render WhatsApp Bot message handler:
const cleanText = (messageText || "").trim().toLowerCase();

if (cleanText === "admin") {
  try {
    // Call your live Data One store endpoint
    const response = await fetch("${window.location.origin}/api/whatsapp-bot");
    const result = await response.json();

    // Send formatted dashboard report back to the sender
    await sendWhatsAppMessage(senderPhone, result.reply);
  } catch (error) {
    console.error("Failed to fetch admin report:", error);
    await sendWhatsAppMessage(senderPhone, "⚠️ Unable to load admin dashboard right now.");
  }
  return;
}`;
                navigator.clipboard.writeText(snippet);
                setCopiedSnippet(true);
                toast.success("Snippet copied to clipboard!");
                setTimeout(() => setCopiedSnippet(false), 2500);
              }}
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold"
            >
              {copiedSnippet ? <Check className="size-3.5 mr-1" /> : <Copy className="size-3.5 mr-1" />}
              {copiedSnippet ? "Copied Snippet" : "Copy Code Snippet"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const StatCard = ({
  label,
  value,
  icon,
  cls,
  hint,
  to,
  onClick,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  cls?: string;
  hint?: string;
  to?: string;
  onClick?: () => void;
}) => {
  const card = (
    <Card
      className={`p-4 rounded-2xl shadow-md transition-all h-full flex flex-col justify-between ${
        to || onClick ? "cursor-pointer hover:scale-[1.02] hover:shadow-lg" : ""
      } ${cls ?? "bg-gradient-card"}`}
      onClick={onClick}
    >
      <div>
        <div className="text-[11px] font-bold uppercase tracking-wider opacity-85 flex items-center justify-between">
          <div className="flex items-center gap-1.5 min-w-0">
            {icon}
            <span className="truncate">{label}</span>
          </div>
          {(to || onClick) && <ArrowUpRight className="size-3 shrink-0 opacity-70" />}
        </div>
        <div className="mt-2 text-2xl font-black tracking-tight">{value}</div>
      </div>
      {hint && <div className="text-[11px] opacity-80 mt-1 truncate" title={hint}>{hint}</div>}
    </Card>
  );

  if (to) {
    return <Link to={to} className="block h-full">{card}</Link>;
  }
  return card;
};

const HubCard = ({
  to,
  icon,
  title,
  badge,
  badgeClass,
  description,
  actionText,
  target,
  highlight,
}: {
  to: string;
  icon: React.ReactNode;
  title: string;
  badge?: string;
  badgeClass?: string;
  description: string;
  actionText: string;
  target?: string;
  highlight?: boolean;
}) => (
  <Link
    to={to}
    target={target}
    rel={target === "_blank" ? "noopener noreferrer" : undefined}
    className={`group relative rounded-2xl p-4 md:p-5 border transition-all duration-200 flex flex-col justify-between ${
      highlight
        ? "bg-gradient-to-br from-emerald-500/15 via-teal-500/10 to-indigo-500/10 border-emerald-500/40 hover:border-emerald-400 shadow-md hover:shadow-lg"
        : "bg-gradient-card hover:bg-muted/50 border-border hover:border-accent/40 shadow-sm hover:shadow-md"
    }`}
  >
    <div>
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <div className="size-9 rounded-xl bg-muted/80 flex items-center justify-center group-hover:scale-105 transition">
          {icon}
        </div>
        {badge && (
          <span
            className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
              badgeClass || "bg-muted text-muted-foreground border border-border/80"
            }`}
          >
            {badge}
          </span>
        )}
      </div>
      <h3 className="font-bold text-base text-foreground group-hover:text-accent transition flex items-center gap-1">
        {title}
      </h3>
      <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
        {description}
      </p>
    </div>

    <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between text-xs font-bold text-foreground/80 group-hover:text-accent transition">
      <span>{actionText}</span>
      <ArrowUpRight className="size-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition" />
    </div>
  </Link>
);

const StreamBadge = ({ type, label, network }: { type: string; label: string; network?: string }) => {
  if (type === "whatsapp") {
    return (
      <Badge className="bg-emerald-600 text-white font-medium hover:bg-emerald-600 text-xs">
        <MessageCircle className="size-3 mr-1" /> WhatsApp Bot
      </Badge>
    );
  }
  if (type === "netflix") {
    return (
      <Badge className="bg-red-600 text-white font-medium hover:bg-red-600 text-xs">
        Netflix
      </Badge>
    );
  }
  if (type === "mashup") {
    return (
      <Badge className="bg-yellow-500 text-black font-semibold hover:bg-yellow-500 text-xs">
        MTN Mashup
      </Badge>
    );
  }
  if (type === "checker") {
    return (
      <Badge className="bg-amber-600 text-white font-medium hover:bg-amber-600 text-xs">
        <GraduationCap className="size-3 mr-1" /> {label}
      </Badge>
    );
  }
  return (
    <Badge className={`text-xs font-semibold ${networkClass(network || "")}`}>
      {NETWORK_LABEL[network || ""] || network || "Data"}
    </Badge>
  );
};

const StatusBadge = ({ s }: { s: string }) => {
  const status = (s || "unknown").toLowerCase();
  const cls =
    status === "delivered" || status === "completed" || status === "paid"
      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
      : status === "failed" || status === "cancelled" || status === "rejected"
      ? "bg-rose-500/20 text-rose-400 border border-rose-500/40"
      : status === "processing" || status === "in_progress"
      ? "bg-blue-500/20 text-blue-400 border border-blue-500/40"
      : status === "waiting" || status === "pending"
      ? "bg-orange-500/20 text-orange-400 border border-orange-500/40"
      : status === "refunded"
      ? "bg-orange-500/20 text-orange-400 border border-orange-500/40"
      : "bg-muted text-muted-foreground border border-border";
  const label =
    status === "delivered" || status === "completed"
      ? "Delivered ✓"
      : status === "paid"
      ? "Paid"
      : status;
  return <Badge className={`${cls} hover:${cls} capitalize text-xs font-medium`}>{label}</Badge>;
};

export default AdminDashboard;
