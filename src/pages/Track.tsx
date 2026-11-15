import { useEffect, useState, useMemo } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { invokeApiFunction } from "@/integrations/supabase/client";
import { getCacheMeta, setCache, createSmartInterval } from "@/lib/localCache";
import { Card } from "@/components/ui/card";
import { brandText } from "@/lib/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Loader2,
  Search,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  Play,
  IdCard,
  Copy,
  RefreshCw,
  Receipt,
  History,
  Check,
  ExternalLink,
  MessageCircle,
  HelpCircle,
  FileCheck2,
  Rocket,
} from "lucide-react";
import { NETWORK_LABEL, formatGHS, networkClass } from "@/lib/networks";
import {
  getSavedOrders,
  getSavedPhone,
  saveOrderToHistory,
  updateOrderInHistory,
  SavedOrder,
} from "@/lib/orderHistory";
import { toast } from "sonner";
import { DeliveryTracker } from "@/components/DeliveryTracker";

const isPhone = (v: string) => /^\d{8,15}$/.test(v.replace(/[\s\-().+]/g, ""));

const maskPhone = (p: string) => {
  if (!p) return p;
  const s = String(p);
  if (s.length <= 5) return s;
  return s.slice(0, 4) + "*".repeat(Math.max(1, s.length - 6)) + s.slice(-2);
};

const Track = () => {
  const [params, setParams] = useSearchParams();
  const initialQuery = params.get("q") || params.get("ref") || params.get("phone") || "";
  const [query, setQuery] = useState(initialQuery);
  const [order, setOrder] = useState<any>(null);
  const [serviceOrder, setServiceOrder] = useState<any>(null);
  const [checkerOrder, setCheckerOrder] = useState<any>(null);
  const [orders, setOrders] = useState<any[] | null>(null);
  const [serviceOrders, setServiceOrders] = useState<any[] | null>(null);
  const [checkerOrders, setCheckerOrders] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("history");
  const [savedOrders, setSavedOrders] = useState<SavedOrder[]>(() => getSavedOrders());

  const savedPhone = useMemo(() => getSavedPhone(), []);

  const copyToClipboard = (v: string, key?: string) => {
    navigator.clipboard.writeText(v);
    if (key) {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    }
    toast.success("Copied to clipboard");
  };

  const copyAllOrderDetails = (o: Order) => {
    const lines = [
      "📦 ORDER DETAILS",
      "────────────────────",
      `• Reference: ${o.reference}`,
      `• Network: ${NETWORK_LABEL[o.network] || o.network}`,
      `• Package: ${o.capacity} GB`,
      `• Recipient Phone: ${o.recipient_phone}`,
      `• Amount Paid: ${formatGHS(o.amount)}`,
      `• Payment Status: ${o.payment_status ? o.payment_status.charAt(0).toUpperCase() + o.payment_status.slice(1) : "Pending"}`,
      `• Delivery Status: ${o.delivery_status === "completed" ? "Processing" : (o.delivery_status ? o.delivery_status.charAt(0).toUpperCase() + o.delivery_status.slice(1) : "Pending")}`,
      o.created_at ? `• Date Placed: ${new Date(o.created_at).toLocaleString()}` : "",
      o.datamart_reference ? `• Gateway Ref: ${o.datamart_reference}` : "",
      "────────────────────",
      `Track online: https://www.data1gh.com/track?ref=${encodeURIComponent(o.reference)}`,
    ].filter(Boolean).join("\n");

    copyToClipboard(lines, "all_details");
  };

  const copyAllCheckerDetails = (co: any) => {
    const lines = [
      `🎓 ${co.checker_type || "WASSCE/BECE"} RESULT CHECKER`,
      "────────────────────",
      `• Reference: ${co.reference}`,
      `• Phone: ${co.customer_phone}`,
      `• Amount: ${formatGHS(co.amount)}`,
      `• Status: ${co.delivery_status || "Pending"}`,
      co.serial_number ? `• Serial Number: ${co.serial_number}` : "",
      co.pin ? `• PIN: ${co.pin}` : "",
      co.created_at ? `• Date Placed: ${new Date(co.created_at).toLocaleString()}` : "",
      "────────────────────",
      `Track online: https://www.data1gh.com/track?ref=${encodeURIComponent(co.reference)}`,
    ].filter(Boolean).join("\n");

    copyToClipboard(lines, "all_checker_details");
  };

  const copyAllServiceDetails = (so: any) => {
    const lines = [
      `✨ ${so.service === "netflix" ? "NETFLIX 1-MONTH SUBSCRIPTION" : "AFA REGISTRATION"}`,
      "────────────────────",
      `• Reference: ${so.reference}`,
      `• Phone: ${so.customer_phone}`,
      `• Amount: GH₵ ${Number(so.amount).toFixed(2)}`,
      `• Payment Status: ${so.payment_status}`,
      `• Delivery Status: ${so.delivery_status}`,
      so.netflix_last_code ? `• Sign-In Code: ${so.netflix_last_code}` : "",
      so.netflix_login_expires_at ? `• Expires: ${new Date(so.netflix_login_expires_at).toLocaleString()}` : "",
      "────────────────────",
      `Track online: https://www.data1gh.com/track?ref=${encodeURIComponent(so.reference)}`,
    ].filter(Boolean).join("\n");

    copyToClipboard(lines, "all_service_details");
  };

  const reloadSavedOrders = () => {
    setSavedOrders(getSavedOrders());
  };

  useEffect(() => {
    const handleHistoryUpdate = () => reloadSavedOrders();
    window.addEventListener("order-history-updated", handleHistoryUpdate);
    return () => window.removeEventListener("order-history-updated", handleHistoryUpdate);
  }, []);

  const lookup = async (raw: string, isSilent = false) => {
    const v = raw.trim();
    if (!v) {
      if (!isSilent) toast.error("Enter an order reference or phone number");
      return;
    }
    setLoading(true);
    setOrder(null);
    setServiceOrder(null);
    setCheckerOrder(null);
    setOrders(null);
    setServiceOrders(null);
    setCheckerOrders(null);

    try {
      if (isPhone(v)) {
        const phone = v.replace(/\s+/g, "");

        // 0. Check local device cache
        const cached = getCacheMeta<{ orders: any[]; service_orders: any[]; checker_orders: any[] }>(`track_phone_${phone}`);
        if (cached.exists && cached.data) {
          const hasCachedOrders =
            (cached.data.orders?.length || 0) > 0 ||
            (cached.data.service_orders?.length || 0) > 0 ||
            (cached.data.checker_orders?.length || 0) > 0;
          if (hasCachedOrders) {
            setOrders(cached.data.orders || []);
            setServiceOrders(cached.data.service_orders || []);
            setCheckerOrders(cached.data.checker_orders || []);
            setLoading(false);
            if (!cached.isStale) return;
          }
        }

        let list: any[] = [];
        let sList: any[] = [];
        let cList: any[] = [];

        try {
          const { data, error } = await invokeApiFunction("track-order", {
            body: { phone },
          });
          if (!error && data) {
            list = (data as any)?.orders || [];
            sList = (data as any)?.service_orders || [];
            cList = (data as any)?.checker_orders || [];
          }
        } catch (_) {}

        // Direct client fallback removed to shield Supabase egress
        setLoading(false);

        if (list.length === 0 && sList.length === 0 && cList.length === 0) {
          if (!isSilent) toast.error("No orders found for this phone number.");
          return;
        }

        setOrders(list);
        setServiceOrders(sList);
        setCheckerOrders(cList);
        setCache(`track_phone_${phone}`, { orders: list, service_orders: sList, checker_orders: cList }, 2 * 60 * 1000);

        // Update local order history with any newly found data orders
        list.forEach((item: any) => {
          saveOrderToHistory({
            reference: item.reference,
            recipient_phone: item.recipient_phone,
            network: item.network,
            capacity: item.capacity,
            amount: item.amount,
            payment_status: item.payment_status,
            delivery_status: item.delivery_status,
            created_at: item.created_at,
            type: "data",
          });
        });
        reloadSavedOrders();
      } else {
        const rawRef = v.trim();
        const cleanRef = rawRef.replace(/[*_#`"']/g, "").trim();
        const cleanNoHyphen = cleanRef.replace(/[\s-]+/g, "").toUpperCase();
        const withoutWs = cleanNoHyphen.replace(/^WS/i, "");
        const withDash = `WS-${withoutWs}`;
        const refVariants = Array.from(new Set([rawRef, cleanRef, cleanNoHyphen, withDash, withoutWs, `WS${withoutWs}`].filter(Boolean)));

        // 0. Check local device cache
        const cached = getCacheMeta<{ order: any; service_order: any; checker_order: any }>(`track_ref_${cleanNoHyphen}`);
        if (cached.exists && cached.data && (cached.data.order || cached.data.service_order || cached.data.checker_order)) {
          if (cached.data.order) setOrder(cached.data.order);
          setServiceOrder(cached.data.service_order || null);
          setCheckerOrder(cached.data.checker_order || null);
          setLoading(false);
          if (!cached.isStale) return;
        }

        let o: any = null;
        let so: any = null;
        let co: any = null;

        try {
          const { data, error } = await invokeApiFunction("track-order", {
            body: { reference: v },
          });
          if (!error && data) {
            o = (data as any)?.order;
            so = (data as any)?.service_order;
            co = (data as any)?.checker_order;

            const resList = (data as any)?.orders || [];
            if (!o && !so && !co && resList.length > 0) {
              setOrders(resList);
              setServiceOrders((data as any)?.service_orders || []);
              setCheckerOrders((data as any)?.checker_orders || []);
              setLoading(false);

              // Auto-verify pending order in the background so customer sees up-to-date live status
              const pendingItem = resList.find((item: any) => item.payment_status === "pending" || item.delivery_status === "processing");
              if (pendingItem?.reference) {
                invokeApiFunction("paystack-verify", { body: { reference: pendingItem.reference } })
                  .then((pRes) => {
                    const upOrder = pRes?.data?.order;
                    if (upOrder) {
                      setOrders((prev) => prev ? prev.map((ord) => ord.reference === upOrder.reference ? { ...ord, ...upOrder } : ord) : prev);
                    }
                  })
                  .catch(() => {});
              }
              return;
            }
          }
        } catch (_) {}

        // Direct client fallback removed to shield Supabase egress
        setLoading(false);

        if (!o && !so && !co) {
          if (!isSilent) toast.error("Order reference not found. Please double-check your code.");
          return;
        }

        setCache(`track_ref_${cleanNoHyphen}`, { order: o, service_order: so, checker_order: co }, 2 * 60 * 1000);

        if (o) {
          setOrder(o);
          updateOrderInHistory(o.reference, {
            payment_status: o.payment_status,
            delivery_status: o.delivery_status,
            amount: o.amount,
            recipient_phone: o.recipient_phone,
            network: o.network,
            capacity: o.capacity,
            created_at: o.created_at,
            type: "data",
          });
          // Auto-verify payment & sync live delivery status immediately so customer sees up-to-date status
          if (o.payment_status === "pending" || o.delivery_status === "processing" || o.delivery_status === "waiting") {
            refreshDelivery(o.reference);
          }
        }
        setServiceOrder(so || null);
        setCheckerOrder(co || null);
        reloadSavedOrders();
      }
    } catch (err: any) {
      setLoading(false);
      if (!isSilent) toast.error(err?.message || "Could not fetch order details");
    }
  };

  useEffect(() => {
    document.title = "Order History & Tracking";
    const q = params.get("q") || params.get("ref") || params.get("phone");
    if (q) {
      setActiveTab("search");
      lookup(q, true);
    } else if (savedOrders.length === 0 && savedPhone) {
      // If no local history but phone is known, automatically lookup
      setQuery(savedPhone);
      lookup(savedPhone, true);
    }
    // eslint-disable-next-line
  }, []);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setParams({ q: query.trim() });
    lookup(query.trim());
  };

  const openOrder = (o: any) => {
    setOrder(o);
    setServiceOrder(null);
    setCheckerOrder(null);
    setOrders(null);
    setServiceOrders(null);
    setCheckerOrders(null);
    setQuery(o.reference);
    setParams({ q: o.reference });
    if (o.reference) {
      refreshDelivery(o.reference);
    }
  };

  const openServiceOrder = (o: any) => {
    setServiceOrder(o);
    setOrder(null);
    setCheckerOrder(null);
    setOrders(null);
    setServiceOrders(null);
    setCheckerOrders(null);
    setQuery(o.reference);
    setParams({ q: o.reference });
  };

  const openCheckerOrder = (o: any) => {
    setCheckerOrder(o);
    setOrder(null);
    setServiceOrder(null);
    setOrders(null);
    setServiceOrders(null);
    setCheckerOrders(null);
    setQuery(o.reference);
    setParams({ q: o.reference });
  };

  const refreshDelivery = async (referenceToRefresh?: string) => {
    const targetRef = referenceToRefresh || order?.reference || query;
    if (!targetRef) return;
    setRefreshing(true);
    try {
      const isChecker = targetRef.startsWith("CK");
      const isService = targetRef.startsWith("NF") || targetRef.startsWith("AF");

      let updatedOrder: any = null;

      if (isChecker || isService) {
        // Use the verify endpoint for checker/service orders
        const fn = isChecker ? "checker-verify" : "service-verify";
        const { data, error } = await invokeApiFunction(fn, {
          body: { reference: targetRef },
        });
        if (error || data?.error) {
          toast.error(data?.error || "Could not refresh status");
          return;
        }
        updatedOrder = data?.order || null;
        if (updatedOrder) {
          if (isChecker) setCheckerOrder(updatedOrder);
          else setServiceOrder(updatedOrder);
        }
      } else {
        // If order was pending payment, verify with Paystack first!
        if (!order || order.payment_status === "pending") {
          try {
            const { data: vData } = await invokeApiFunction("paystack-verify", {
              body: { reference: targetRef },
            });
            if (vData?.order) {
              updatedOrder = vData.order;
              if (vData.order.payment_status === "paid" && (!order || order.payment_status !== "paid")) {
                toast.success("Payment confirmed! Dispatched for delivery.");
              }
            }
          } catch (_) {}
        }

        // Query track-order to sync real live delivery status
        try {
          const { data, error } = await invokeApiFunction("track-order", {
            body: { reference: targetRef },
          });
          if (data?.order) {
            // Merge so we preserve confirmed paid status
            updatedOrder = {
              ...(updatedOrder || {}),
              ...data.order,
              payment_status: updatedOrder?.payment_status === "paid" ? "paid" : data.order.payment_status,
            };
          } else if (error && !updatedOrder) {
            toast.error(data?.error || "Could not refresh status");
            return;
          }
        } catch (_) {}

        if (updatedOrder) setOrder(updatedOrder);
      }

      if (updatedOrder) {
        updateOrderInHistory(targetRef, {
          payment_status: updatedOrder.payment_status,
          delivery_status: updatedOrder.delivery_status,
          error_message: updatedOrder.error_message,
        });
        reloadSavedOrders();
        toast.success(`Status: ${updatedOrder.delivery_status || "updated"}`);
      } else {
        toast.info("Delivery status is up to date.");
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed to update status");
    } finally {
      setRefreshing(false);
    }
  };

  // Automated live polling for open orders that are processing/waiting/pending
  useEffect(() => {
    if (!order?.reference) return;
    const ds = (order.delivery_status || "").toLowerCase();
    const ps = (order.payment_status || "").toLowerCase();
    if (ds === "delivered" || ds === "failed" || ds === "cancelled" || ps === "failed") return;

    // Fast 6s polling when awaiting payment approval, 15s when waiting for telecom delivery
    const pollTime = ps === "pending" ? 25000 : 45000;
    const stopPolling = createSmartInterval(() => {
      refreshDelivery(order.reference);
    }, pollTime);
    return () => stopPolling();
  }, [order?.reference, order?.delivery_status, order?.payment_status]);

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-2xl py-8 px-4">
        <div className="flex items-center justify-between mb-6">
          <Button asChild variant="ghost" size="sm" className="hover:bg-muted">
            <Link to="/">
              <ArrowLeft className="size-4 mr-1.5" /> Back to Shop
            </Link>
          </Button>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-accent/15 text-accent border border-accent/25 flex items-center gap-1.5">
            <Receipt className="size-3.5" /> Customer Portal
          </span>
        </div>

        <div className="mb-6">
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-foreground flex items-center gap-2">
            Order History & Tracking
          </h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1.5">
            Check live delivery status, track references, and review all your past bundle and service purchases.
          </p>
        </div>

                {/* Important Broadcast Alert: MTN 24h Verification Notice */}
        <div className="mb-6 p-4 md:p-5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-300 dark:border-amber-500/40 text-amber-950 dark:text-amber-100 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="flex size-8 items-center justify-center rounded-xl bg-amber-500 text-slate-950 font-black shrink-0 shadow-sm mt-0.5">
              📢
            </span>
            <div className="space-y-2 text-xs md:text-sm">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-black text-amber-900 dark:text-amber-300 text-sm tracking-wide uppercase">
                  IMPORTANT UPDATE 📢
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200 text-amber-950 border border-amber-400 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/40">
                  MTN Verification Notice
                </span>
              </div>
              <p className="text-zinc-800 dark:text-zinc-200 leading-relaxed font-medium">
                If you track your order and your delivery status shows <strong className="text-amber-950 dark:text-amber-200 font-black bg-amber-200/90 dark:bg-amber-500/30 px-1.5 py-0.5 rounded border border-amber-300 dark:border-amber-500/40">PENDING</strong> after 24 hours of payment confirmation, please note:
              </p>
              <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
                This happens when the recipient number is new to the system and is placing an order for the first time. Such numbers require verification by MTN.
              </p>
              <div className="p-3 rounded-xl bg-amber-100/90 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-500/30 text-amber-950 dark:text-amber-200 text-xs leading-relaxed">
                <strong className="text-zinc-950 dark:text-white font-black">Kindly note that your money is safe.</strong> Your order will be processed successfully after the verification. Our biggest challenge is that MTN does not provide a specific time frame for this verification, but we expect it to be completed within 7 days.
              </div>
              <p className="text-[11px] text-zinc-600 dark:text-zinc-400 italic">
                We sincerely apologize for the inconvenience and kindly ask you to bear with us. Thank you for your understanding.
              </p>
            </div>
          </div>
        </div>

        {/* Real Data1gh Live Delivery Tracker */}
        <DeliveryTracker />

        <Tabs
          value={activeTab}
          onValueChange={(val) => {
            setActiveTab(val);
            if (val === "history") {
              setOrder(null);
              setServiceOrder(null);
              setCheckerOrder(null);
            }
          }}
          className="w-full mb-6"
        >
          <TabsList className="grid w-full grid-cols-2 p-1 bg-muted/60 rounded-xl">
            <TabsTrigger value="history" className="rounded-lg font-semibold flex items-center gap-2">
              <History className="size-4" /> My Orders ({savedOrders.length})
            </TabsTrigger>
            <TabsTrigger value="search" className="rounded-lg font-semibold flex items-center gap-2">
              <Search className="size-4" /> Search Any Order
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: LOCAL ORDER HISTORY */}
          <TabsContent value="history" className="mt-4 space-y-4">
            {savedOrders.length === 0 ? (
              <Card className="p-8 text-center bg-gradient-card border-dashed">
                <Receipt className="size-12 mx-auto text-muted-foreground/50 mb-3" />
                <h3 className="font-bold text-lg">No orders saved on this device yet</h3>
                <p className="text-sm text-muted-foreground mt-1 mb-5 max-w-sm mx-auto">
                  When you make a purchase, it will appear here automatically. You can also search using your phone number to find past orders.
                </p>
                <Button
                  onClick={() => {
                    setActiveTab("search");
                    if (savedPhone) setQuery(savedPhone);
                  }}
                  variant="outline"
                  className="rounded-xl border-accent/40"
                >
                  <Search className="size-4 mr-2" /> Search by Phone Number
                </Button>
              </Card>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                  <span>Showing {savedOrders.length} saved order{savedOrders.length > 1 ? "s" : ""} on this browser</span>
                  {savedPhone && (
                    <span className="font-mono">Phone: {savedPhone}</span>
                  )}
                </div>

                {savedOrders.map((so) => {
                  const ds = (so.delivery_status || "").toLowerCase();
                  const isFailed = ds === "failed" || ds === "cancelled" || ds === "rejected" || so.payment_status === "failed";
                  const isDelivered = !isFailed && (ds === "delivered" || ds === "completed");
                  const isProcessing = !isFailed && (ds === "processing" || ds === "waiting");
                  const isRefunded = ds === "refunded";
                  const isPaid = so.payment_status === "paid";

                  return (
                    <Card
                      key={so.reference}
                      className="p-4 bg-gradient-card border hover:border-accent/50 transition-all cursor-pointer shadow-sm hover:shadow"
                      onClick={() => {
                        setQuery(so.reference);
                        lookup(so.reference);
                      }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-bold text-sm text-foreground">
                              {so.reference}
                            </span>
                            {so.network && (
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${networkClass(
                                  so.network
                                )}`}
                              >
                                {NETWORK_LABEL[so.network] || so.network}
                              </span>
                            )}
                            {so.capacity && (
                              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-muted text-foreground">
                                {so.capacity}GB
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1.5 flex items-center gap-2 flex-wrap">
                            <span>To: {so.recipient_phone}</span>
                            {so.created_at && (
                              <>
                                <span>•</span>
                                <span>{new Date(so.created_at).toLocaleDateString()}</span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="font-bold text-sm text-foreground">
                            {so.amount ? formatGHS(so.amount) : "—"}
                          </div>
                          <div className="mt-1 flex items-center justify-end gap-1">
                            {isFailed ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-destructive bg-destructive/10 px-2 py-0.5 rounded-full">
                                <XCircle className="size-3" /> Failed
                              </span>
                            ) : isDelivered ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-success bg-success/10 px-2 py-0.5 rounded-full">
                                <CheckCircle2 className="size-3" /> Delivered
                              </span>
                            ) : isProcessing ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-warning bg-warning/10 px-2 py-0.5 rounded-full animate-pulse">
                                <Clock className="size-3" /> {so.delivery_status === "waiting" ? "Waiting" : "Processing"}
                              </span>
                            ) : isRefunded ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-orange-400 bg-orange-400/10 px-2 py-0.5 rounded-full">
                                <XCircle className="size-3" /> Refunded
                              </span>
                            ) : isPaid ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded-full">
                                <CheckCircle2 className="size-3" /> Paid
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                                <Clock className="size-3" /> Pending
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* TAB 2: SEARCH */}
          <TabsContent value="search" className="mt-4">
            <Card className="p-5 bg-gradient-card">
              <form onSubmit={onSubmit} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="q" className="font-semibold text-sm">
                    Enter Order Reference or Phone Number
                  </Label>
                  <div className="relative">
                    <Input
                      id="q"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="DS... / CK... / NF... or 0541234567"
                      className="pr-10 h-11 text-base font-mono"
                    />
                    {query && (
                      <button
                        type="button"
                        onClick={() => setQuery("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 bg-gradient-gold text-accent-foreground font-bold hover:opacity-90 shadow-md"
                >
                  {loading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <>
                      <Search className="size-4 mr-2" /> Find Order Details
                    </>
                  )}
                </Button>
              </form>
            </Card>
          </TabsContent>
        </Tabs>

        {/* SEARCH RESULTS: LIST OF DATA BUNDLES */}
        {orders && orders.length > 0 && (
          <div className="mb-6 space-y-2">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Receipt className="size-4 text-accent" /> Data Bundles Found ({orders.length})
            </h3>
            {orders.map((o) => (
              <Card
                key={o.id}
                onClick={() => openOrder(o)}
                className="p-3.5 bg-gradient-card border hover:border-accent transition cursor-pointer"
              >
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0">
                    <div className="font-mono font-bold text-sm">{o.reference}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {NETWORK_LABEL[o.network] || o.network} • {o.capacity}GB •{" "}
                      {new Date(o.created_at).toLocaleString()}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-bold text-sm">{formatGHS(o.amount)}</div>
                    <div className="mt-1">
                      {(() => {
                        const ds = (o.delivery_status || "").toLowerCase();
                        const isFailed = ds === "failed" || ds === "cancelled" || ds === "rejected" || o.payment_status === "failed";
                        const isDelivered = !isFailed && (ds === "delivered" || ds === "completed");
                        const isProcessing = !isFailed && (ds === "processing" || ds === "waiting");
                        const isRefunded = ds === "refunded";
                        if (isRefunded) {
                          return (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-orange-400 bg-orange-400/10 px-2 py-0.5 rounded-full">
                              <XCircle className="size-3" /> Refunded
                            </span>
                          );
                        }
                        if (isFailed) {
                          return (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-destructive bg-destructive/10 px-2 py-0.5 rounded-full">
                              <XCircle className="size-3" /> Failed
                            </span>
                          );
                        }
                        if (isDelivered) {
                          return (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-success bg-success/10 px-2 py-0.5 rounded-full">
                              <CheckCircle2 className="size-3" /> Delivered
                            </span>
                          );
                        }
                        if (isProcessing) {
                          return (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-warning bg-warning/10 px-2 py-0.5 rounded-full">
                              <Clock className="size-3" /> {ds === "waiting" ? "Waiting" : "Processing"}
                            </span>
                          );
                        }
                        return (
                          <div className="text-xs font-semibold capitalize text-muted-foreground">
                            {o.delivery_status || "Pending"}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* SEARCH RESULTS: LIST OF OTHER SERVICES */}
        {serviceOrders && serviceOrders.length > 0 && (
          <div className="mb-6 space-y-2">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Play className="size-4 text-red-500" /> Other Services ({serviceOrders.length})
            </h3>
            {serviceOrders.map((o) => (
              <Card
                key={o.id}
                onClick={() => openServiceOrder(o)}
                className={`p-3.5 bg-gradient-card border-2 transition cursor-pointer ${
                  o.service === "netflix"
                    ? "border-red-500/40"
                    : o.service === "boost"
                      ? "border-violet-500/40"
                      : "border-emerald-500/40"
                }`}
              >
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0 flex items-center gap-2">
                    {o.service === "netflix" ? (
                      <Play className="size-4 text-red-600 fill-red-600 shrink-0" />
                    ) : o.service === "boost" ? (
                      <Rocket className="size-4 text-violet-600 shrink-0" />
                    ) : (
                      <IdCard className="size-4 text-emerald-600 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className="font-bold truncate text-sm">
                        {o.service === "netflix"
                          ? "Netflix 1-Month"
                          : o.service === "boost"
                            ? "Social Media Boost"
                            : o.service === "mashup"
                              ? "MTN Mashup"
                              : "AFA Registration"}{" "}
                        • <span className="font-mono">{o.reference}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(o.created_at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-bold text-sm">GH₵ {Number(o.amount).toFixed(2)}</div>
                    <div className="text-xs text-muted-foreground capitalize">{o.delivery_status}</div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* SEARCH RESULTS: LIST OF CHECKER ORDERS */}
        {checkerOrders && checkerOrders.length > 0 && (
          <div className="mb-6 space-y-2">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <FileCheck2 className="size-4 text-blue-500" /> Result Checkers ({checkerOrders.length})
            </h3>
            {checkerOrders.map((co) => (
              <Card
                key={co.id}
                onClick={() => openCheckerOrder(co)}
                className="p-3.5 bg-gradient-card border hover:border-blue-500/50 transition cursor-pointer"
              >
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0">
                    <div className="font-bold text-sm">
                      {co.checker_type} Checker • <span className="font-mono">{co.reference}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(co.created_at).toLocaleString()}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-bold text-sm">GH₵ {Number(co.amount).toFixed(2)}</div>
                    <div className="text-xs text-muted-foreground capitalize">{co.delivery_status}</div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* SINGLE DATA ORDER DETAIL CARD */}
        {order && (
          <Card className="p-6 bg-gradient-card border-2 border-accent/40 shadow-xl space-y-5 animate-in fade-in-50">
            <div className="flex items-center justify-between pb-3 border-b border-border/50 flex-wrap gap-2">
              <span className="text-xs font-bold text-muted-foreground tracking-wider uppercase">
                Order Details
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyAllOrderDetails(order)}
                  className="h-8 text-xs font-bold gap-1.5 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300"
                >
                  {copiedKey === "all_details" ? (
                    <>
                      <Check className="size-3.5 text-emerald-400" /> Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="size-3.5" /> Copy All Details
                    </>
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => refreshDelivery(order.reference)}
                  disabled={refreshing}
                  className="h-8 text-xs font-semibold gap-1 text-accent hover:text-accent"
                >
                  <RefreshCw className={`size-3.5 ${refreshing ? "animate-spin" : ""}`} />
                  {refreshing ? "Checking..." : "Refresh Live Status"}
                </Button>
              </div>
            </div>

            {/* Status Header Banner */}
            {(() => {
              const ds = order.delivery_status?.toLowerCase() || "";
              const paid = order.payment_status === "paid";
              const paymentFailed = order.payment_status === "failed";
              const deliveryFailed = ds === "failed" || ds === "cancelled" || ds === "rejected" || ds === "declined";
              const delivered = paid && (ds === "delivered" || ds === "completed");
              const waiting = paid && (ds === "waiting" || ds === "pending");
              const processing = paid && (ds === "processing" || ds === "in_progress");
              const refunded = ds === "refunded";

              const Icon = paymentFailed || deliveryFailed
                ? XCircle
                : delivered
                ? CheckCircle2
                : refunded
                ? XCircle
                : !paid
                ? Clock
                : waiting || processing
                ? Clock
                : CheckCircle2;

              const tone = paymentFailed || deliveryFailed
                ? "text-destructive border-destructive/30 bg-destructive/10"
                : delivered
                ? "text-success border-success/30 bg-success/10"
                : refunded
                ? "text-orange-400 border-orange-400/30 bg-orange-400/10"
                : !paid
                ? "text-amber-400 border-amber-500/30 bg-amber-500/10"
                : waiting || processing
                ? "text-warning border-warning/30 bg-warning/10"
                : "text-blue-500 border-blue-500/30 bg-blue-500/10";

              let title = "Awaiting Payment";
              let subtitle = "Complete payment to have your data delivered.";

              if (!paid) {
                if (paymentFailed) {
                  title = "Payment Failed";
                  subtitle = brandText(order.error_message) || "The payment transaction could not be completed. Please try again.";
                } else {
                  title = "Awaiting Payment Confirmation";
                  subtitle = "We are waiting to confirm your Mobile Money payment. If you approved the MoMo prompt on your phone, click 'Check / Refresh Status Now' below.";
                }
              } else {
                if (deliveryFailed) {
                  title = "Delivery Issue";
                  subtitle = brandText(order.error_message) || "Payment was received, but automated delivery could not be completed. Our team has been notified.";
                } else if (delivered) {
                  title = "Bundle Delivered Successfully!";
                  subtitle = "The data bundle has been credited to your recipient line.";
                } else if (refunded) {
                  title = "Order Refunded";
                  subtitle = "Your payment has been refunded. Contact support if you have questions.";
                } else if (waiting) {
                  title = "Payment Received · Order is in Processing ⏳";
                  subtitle = `Payment of ${formatGHS(order.amount)} received. Your order is currently in processing and queued for fast delivery.`;
                } else if (processing) {
                  title = "Payment Received · Order is in Processing ⚡";
                  subtitle = `Payment of ${formatGHS(order.amount)} received. Telecom gateway is actively delivering this bundle to ${order.recipient_phone}.`;
                } else {
                  title = "Payment Received · Order is in Processing";
                  subtitle = "Payment received. Your order is currently in processing for delivery.";
                }
              }

              return (
                <div className={`rounded-xl border p-4 space-y-3 ${tone}`}>
                  <div className="flex items-start gap-3">
                    <Icon className="size-6 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <div className="font-bold text-base leading-tight">{title}</div>
                      <div className="text-xs opacity-90 mt-1">{subtitle}</div>
                    </div>
                  </div>

                  {paid && (
                    <div className="pt-2 border-t border-border/30 grid grid-cols-3 gap-2 text-center">
                      <div className="flex flex-col items-center">
                        <div className="size-6 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center mb-1 text-[11px] font-bold">
                          ✓
                        </div>
                        <span className="text-[10px] font-bold text-emerald-400">Payment</span>
                        <span className="text-[9px] text-muted-foreground">Received</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <div className={`size-6 rounded-full flex items-center justify-center mb-1 text-[11px] font-bold ${
                          delivered ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40" : "bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse"
                        }`}>
                          {delivered ? "✓" : "⚡"}
                        </div>
                        <span className={`text-[10px] font-bold ${delivered ? "text-emerald-400" : "text-amber-300"}`}>Order</span>
                        <span className="text-[9px] text-muted-foreground">In Processing</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <div className={`size-6 rounded-full flex items-center justify-center mb-1 text-[11px] font-bold ${
                          delivered ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40" : "bg-muted text-muted-foreground border border-border"
                        }`}>
                          {delivered ? "✓" : "•"}
                        </div>
                        <span className={`text-[10px] font-bold ${delivered ? "text-emerald-400" : "text-muted-foreground"}`}>Delivery</span>
                        <span className="text-[9px] text-muted-foreground">{delivered ? "Delivered" : "~2-5 min"}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {order.payment_status === "paid" && (order.delivery_status === "pending" || order.delivery_status === "waiting") && (
              <PendingNotice placedAt={order.created_at} />
            )}

            {/* Field Rows */}
            <div className="space-y-2.5 text-sm divide-y divide-border/30">
              <div className="pt-2 flex justify-between items-center gap-3">
                <span className="text-muted-foreground">Order Reference</span>
                <div className="flex items-center gap-1.5 font-mono font-bold">
                  <span>{order.reference}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6 text-muted-foreground hover:text-foreground"
                    onClick={() => copyToClipboard(order.reference, "ref")}
                  >
                    {copiedKey === "ref" ? <Check className="size-3 text-success" /> : <Copy className="size-3" />}
                  </Button>
                </div>
              </div>

              <div className="pt-2 flex justify-between items-center gap-3">
                <span className="text-muted-foreground">Network</span>
                <span className={`px-2 py-0.5 rounded font-bold text-xs ${networkClass(order.network)}`}>
                  {NETWORK_LABEL[order.network] || order.network}
                </span>
              </div>

              <div className="pt-2 flex justify-between items-center gap-3">
                <span className="text-muted-foreground">Package</span>
                <span className="font-bold">{order.capacity} GB</span>
              </div>

              <div className="pt-2 flex justify-between items-center gap-3">
                <span className="text-muted-foreground">Recipient Phone</span>
                <span className="font-mono font-medium">{order.recipient_phone}</span>
              </div>

              <div className="pt-2 flex justify-between items-center gap-3">
                <span className="text-muted-foreground">Amount Paid</span>
                <span className="font-bold text-foreground">{formatGHS(order.amount)}</span>
              </div>

              <div className="pt-2 flex justify-between items-center gap-3">
                <span className="text-muted-foreground">Payment Status</span>
                <span className="font-semibold capitalize">{order.payment_status?.charAt(0).toUpperCase() + order.payment_status?.slice(1) || "Pending"}</span>
              </div>

              <div className="pt-2 flex justify-between items-center gap-3">
                <span className="text-muted-foreground">Delivery Status</span>
                <span
                  className={`font-semibold capitalize ${
                    order.delivery_status === "delivered"
                      ? "text-success font-bold"
                      : order.delivery_status === "failed" || order.delivery_status === "cancelled"
                      ? "text-destructive font-bold"
                      : order.delivery_status === "refunded"
                      ? "text-orange-400 font-bold"
                      : "text-amber-500 font-medium"
                  }`}
                >
                  {order.delivery_status === "completed" ? "Processing" : order.delivery_status}
                </span>
              </div>

              {order.created_at && (
                <div className="pt-2 flex justify-between items-center gap-3">
                  <span className="text-muted-foreground">Date Placed</span>
                  <span className="text-muted-foreground text-xs">
                    {new Date(order.created_at).toLocaleString()}
                  </span>
                </div>
              )}
            </div>

            {order.payment_status === "pending" && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-left space-y-2">
                <p className="text-xs text-amber-400 font-medium">
                  If you just approved the MoMo prompt on your phone, tap below to confirm your payment and trigger delivery.
                </p>
                <Button
                  onClick={() => refreshDelivery(order.reference)}
                  disabled={refreshing}
                  className="w-full bg-accent text-accent-foreground font-semibold rounded-lg text-xs h-9"
                >
                  <RefreshCw className={`size-3.5 mr-1.5 ${refreshing ? "animate-spin" : ""}`} />
                  {refreshing ? "Confirming with MoMo..." : "Confirm Payment Now"}
                </Button>
              </div>
            )}

            {/* Action Buttons */}
            <div className="pt-2 flex flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                className="w-full rounded-xl border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 font-bold"
                onClick={() => copyAllOrderDetails(order)}
              >
                {copiedKey === "all_details" ? (
                  <>
                    <Check className="size-4 mr-2 text-emerald-400" /> Details Copied!
                  </>
                ) : (
                  <>
                    <Copy className="size-4 mr-2" /> Copy All Details
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                className="w-full rounded-xl border-accent/40 font-semibold"
                onClick={() => refreshDelivery(order.reference)}
                disabled={refreshing}
              >
                <RefreshCw className={`size-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
                {refreshing ? "Checking status..." : "Refresh Live Status"}
              </Button>
              <Button
                asChild
                variant="secondary"
                className="w-full rounded-xl"
              >
                <a
                  href={`https://wa.me/233547100951?text=${encodeURIComponent(
                    `Hello Data One support, I would like to check on my order reference ${order.datamart_reference || order.reference}.`
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MessageCircle className="size-4 mr-2 text-success" /> Need Help?
                </a>
              </Button>
            </div>
          </Card>
        )}

        {/* CHECKER ORDER DETAIL CARD */}
        {checkerOrder && (
          <Card className="p-6 bg-gradient-card border-2 border-blue-500/40 shadow-xl space-y-4 animate-in fade-in-50">
            <div className="flex items-center justify-between pb-3 border-b border-border/50 flex-wrap gap-2">
              <span className="text-xs font-bold text-muted-foreground tracking-wider uppercase">
                {checkerOrder.checker_type} Result Checker Details
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyAllCheckerDetails(checkerOrder)}
                  className="h-8 text-xs font-bold gap-1.5 border-blue-500/40 text-blue-400 hover:bg-blue-500/10"
                >
                  {copiedKey === "all_checker_details" ? <Check className="size-3.5 text-blue-400" /> : <Copy className="size-3.5" />}
                  {copiedKey === "all_checker_details" ? "Copied!" : "Copy All Details"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => refreshDelivery(checkerOrder.reference)}
                  disabled={refreshing}
                  className="h-8 text-xs font-semibold gap-1"
                >
                  <RefreshCw className={`size-3.5 ${refreshing ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-xl border p-4 bg-blue-500/10 border-blue-500/30 text-blue-400">
              <FileCheck2 className="size-6 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <div className="font-bold text-base">
                  {checkerOrder.delivery_status === "delivered"
                    ? "Checker Card Ready"
                    : checkerOrder.payment_status === "paid"
                    ? "Card being issued..."
                    : "Payment Pending"}
                </div>
                <div className="text-xs opacity-90 mt-0.5">
                  {checkerOrder.delivery_status === "delivered"
                    ? "Your serial number and PIN are available below."
                    : "Please wait while we fetch your card."}
                </div>
              </div>
            </div>

            {checkerOrder.delivery_status === "delivered" && (
              <div className="rounded-xl border-2 border-accent/50 bg-accent/10 p-4 space-y-3">
                <div>
                  <div className="text-xs text-muted-foreground font-semibold">Serial Number</div>
                  <div className="font-mono text-lg font-black tracking-wider break-all text-foreground">
                    {checkerOrder.serial_number}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground font-semibold">PIN</div>
                  <div className="font-mono text-lg font-black tracking-wider break-all text-foreground">
                    {checkerOrder.pin}
                  </div>
                </div>
                <Button
                  variant="outline"
                  className="w-full font-bold"
                  onClick={() =>
                    copyToClipboard(
                      `Serial: ${checkerOrder.serial_number}  PIN: ${checkerOrder.pin}`,
                      "checker_card"
                    )
                  }
                >
                  <Copy className="size-4 mr-2" /> Copy Serial & PIN
                </Button>
              </div>
            )}

            <div className="space-y-2 text-sm">
              <Row label="Reference" value={checkerOrder.reference} />
              <Row label="Phone" value={checkerOrder.customer_phone} />
              <Row label="Amount" value={formatGHS(checkerOrder.amount)} />
              <Row label="Status" value={checkerOrder.delivery_status} />
              {checkerOrder.created_at && (
                <Row label="Placed" value={new Date(checkerOrder.created_at).toLocaleString()} />
              )}
            </div>
          </Card>
        )}

        {/* SERVICE ORDER DETAIL CARD */}
        {serviceOrder && (
          <Card
            className="p-6 bg-gradient-card border-2 shadow-xl space-y-4 animate-in fade-in-50"
            style={{
              borderColor:
                serviceOrder.service === "netflix"
                  ? "hsl(0 84% 60% / 0.5)"
                  : serviceOrder.service === "boost"
                    ? "hsl(280 84% 60% / 0.5)"
                    : "hsl(160 84% 40% / 0.5)",
            }}
          >
            <div className="flex items-center justify-between pb-3 border-b border-border/50 flex-wrap gap-2">
              <span className="text-xs font-bold text-muted-foreground tracking-wider uppercase">
                {serviceOrder.service === "netflix"
                  ? "Netflix 1-Month Sign-In"
                  : serviceOrder.service === "boost"
                    ? "Social Media Boost"
                    : serviceOrder.service === "mashup"
                      ? "MTN Mashup"
                      : "AFA Registration"}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyAllServiceDetails(serviceOrder)}
                  className="h-8 text-xs font-bold gap-1.5 border-rose-500/40 text-rose-400 hover:bg-rose-500/10"
                >
                  {copiedKey === "all_service_details" ? <Check className="size-3.5 text-rose-400" /> : <Copy className="size-3.5" />}
                  {copiedKey === "all_service_details" ? "Copied!" : "Copy All Details"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => refreshDelivery(serviceOrder.reference)}
                  disabled={refreshing}
                  className="h-8 text-xs font-semibold gap-1"
                >
                  <RefreshCw className={`size-3.5 ${refreshing ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </div>
            </div>

            <div className="space-y-2 text-sm">
              <Row label="Reference" value={serviceOrder.reference} />
              {serviceOrder.boost_service_name && (
                <Row label="Package" value={serviceOrder.boost_service_name} />
              )}
              <Row label="Phone" value={maskPhone(serviceOrder.customer_phone)} />
              <Row label="Amount" value={`GH₵ ${Number(serviceOrder.amount).toFixed(2)}`} />
              <Row label="Payment Status" value={serviceOrder.payment_status} />
              <Row label="Delivery" value={serviceOrder.delivery_status} />
              {serviceOrder.netflix_login_expires_at && (
                <Row
                  label="Expires"
                  value={new Date(serviceOrder.netflix_login_expires_at).toLocaleString()}
                />
              )}
            </div>

            {serviceOrder.service === "netflix" && serviceOrder.netflix_last_code && (
              <div className="rounded-xl bg-gradient-to-br from-red-600 to-red-900 p-4 text-white text-center">
                <div className="text-[10px] uppercase tracking-widest opacity-80">Your Sign-In Code</div>
                <div className="text-3xl font-black tracking-[0.35em] my-1 font-mono">
                  {serviceOrder.netflix_last_code}
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  className="mt-2"
                  onClick={() => copyToClipboard(serviceOrder.netflix_last_code)}
                >
                  <Copy className="size-3 mr-1" /> Copy Code
                </Button>
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
};

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between gap-3 text-sm">
    <span className="text-muted-foreground">{label}</span>
    <span className="font-medium text-right break-all">{value}</span>
  </div>
);

export const PendingNotice = ({ placedAt }: { placedAt?: string }) => {
  const when = placedAt ? new Date(placedAt).toLocaleString() : "";
  return (
    <div className="rounded-lg border-2 border-warning/50 bg-warning/10 p-3 space-y-2 text-xs">
      <div className="font-bold text-warning flex items-center gap-1.5">
        <Clock className="size-4" /> Sent for verification{when && ` on ${when}`}
      </div>
      <p className="text-foreground/90 leading-relaxed">
        This number has been submitted for network verification. Once cleared, data is delivered automatically.
      </p>
    </div>
  );
};

export default Track;
