import { useCallback, useEffect, useState, useMemo } from "react";
import { invokeApiFunction, supabase as typedSupabase } from "@/integrations/supabase/client";
import { getCacheMeta, setCache, createSmartInterval } from "@/lib/localCache";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = typedSupabase as any;
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, MessageCircle, RefreshCw, Store } from "lucide-react";
import { PhoneLink } from "@/components/PhoneLink";
import { toast } from "sonner";

const BOT_LINK = "https://wa.me/233200598553";

interface WaOrder {
  id: string;
  reference: string;
  display_reference?: string;
  datamart_reference?: string | null;
  network: string;
  capacity: string;
  phone: string;
  delivery_status?: string;
  amount: number;
  status: string;
  payment_status?: string;
  paid_at?: string | null;
  created_at: string | null;
  store_name?: string;
  agent_id?: string;
}

interface Totals { count: number; revenue: number; completed: number; pending: number; failed: number; paid?: number; payment_pending?: number }

const statusTone = (s: string) => {
  if (/complet|deliver|success|paid/i.test(s)) return "bg-emerald-100 text-emerald-800 border-emerald-300";
  if (/fail|cancel|refund|abandon/i.test(s)) return "bg-rose-100 text-rose-800 border-rose-300";
  if (/unknown/i.test(s)) return "bg-muted text-muted-foreground border-border";
  return "bg-amber-100 text-amber-900 border-amber-300";
};


const AdminWhatsAppOrders = () => {
  const [orders, setOrders] = useState<WaOrder[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [timeFilter, setTimeFilter] = useState<"today" | "all">("today");

  const todayOrders = useMemo(() => {
    const startOfToday = new Date();
    startOfToday.setUTCHours(0, 0, 0, 0);
    return orders.filter((o) => new Date(o.created_at || 0).getTime() >= startOfToday.getTime());
  }, [orders]);

  const displayedOrders = useMemo(() => {
    return timeFilter === "today" ? todayOrders : orders;
  }, [timeFilter, todayOrders, orders]);

  const displayTotals = useMemo(() => {
    const list = displayedOrders;
    return {
      count: list.length,
      revenue: list.reduce((s, o) => s + (o.amount || 0), 0),
      completed: list.filter((o) => /deliv|success/i.test(o.status || o.delivery_status || "")).length,
      paid: list.filter((o) => o.payment_status === "paid" || /paid/i.test(o.status || "")).length,
      pending: list.filter((o) => /pend|wait|process/i.test(o.status || o.delivery_status || "")).length,
      failed: list.filter((o) => /fail|cancel|refund/i.test(o.status || o.delivery_status || "")).length,
    };
  }, [displayedOrders]);

  const retryOrder = async (o: WaOrder) => {
    setRetrying(o.id);
    const { data, error } = await invokeApiFunction("paystack-verify", {
      body: { reference: o.datamart_reference || o.reference, retry: true },
    });
    setRetrying(null);
    if (error || data?.error) {
      toast.error(error?.message || data?.error || "Retry failed");
      return;
    }
    toast.success(data?.message || "Order retried & synced with DataMart");
    load();
  };

  const load = useCallback(async (force = false) => {
    // Check local cache first to avoid redundant Supabase egress
    if (!force) {
      const cached = getCacheMeta<{ orders: WaOrder[]; totals: Totals | null }>("admin_whatsapp_orders");
      if (cached.exists && cached.data) {
        setOrders(cached.data.orders || []);
        setTotals(cached.data.totals || null);
        setLoading(false);
        setError(null);
        if (!cached.isStale) return;
      }
    }

    let success = false;
    try {
      const { data, error } = await invokeApiFunction("whatsapp-orders");
      if (!error && data && !data.error && Array.isArray(data.orders)) {
        setError(null);
        setOrders(data.orders || []);
        setTotals(data.totals || null);
        setCache("admin_whatsapp_orders", { orders: data.orders || [], totals: data.totals || null }, 120 * 1000);
        success = true;
      }
    } catch (_) {}

    // Resilient fallback: Query database orders table directly
    if (!success) {
      try {
        const { data: dbOrders } = await supabase
          .from("orders")
          .select("id, reference, datamart_reference, datamart_status, delivery_status, status, amount, created_at, network, capacity, bundle, recipient_phone, phone_number, phone, notes, ref, agent_id")
          .order("created_at", { ascending: false })
          .limit(150);

        if (dbOrders) {
          const list: WaOrder[] = [];
          for (const o of dbOrders) {
            const isWa =
              Boolean(o.notes && String(o.notes).toLowerCase().includes("channel:whatsapp_bot")) ||
              Boolean(o.notes && String(o.notes).toLowerCase().includes("whatsapp_bot")) ||
              Boolean(o.notes && String(o.notes).toLowerCase().includes("whatsapp_phone:")) ||
              String(o.network || "").toUpperCase() === "MASHUP" ||
              String(o.ref || o.reference || "").startsWith("MASHUP-") ||
              o.source === "whatsapp" ||
              o.source === "whatsapp_bot";
            if (isWa) {
              const phone = o.recipient_phone || o.phone_number || o.phone || "—";
              const deliveryStatus = String(o.datamart_status || o.delivery_status || o.status || "unknown").toLowerCase().trim();
              let storeName = "Main Store";
              if (o.notes) {
                const sm = String(o.notes).match(/\[store:([^\]]+)\]/i);
                if (sm && sm[1]) storeName = sm[1];
              }
              list.push({
                id: String(o.id || o.reference || o.ref),
                reference: String(o.reference || o.ref || o.id),
                display_reference: String(o.datamart_reference || o.reference || o.ref || o.id),
                datamart_reference: o.datamart_reference || null,
                network: o.network || "MTN",
                capacity: String(o.capacity || o.bundle || "").replace(/GB/i, ""),
                phone,
                amount: Number(o.amount || 0),
                status: deliveryStatus,
                delivery_status: deliveryStatus,
                payment_status: o.payment_status || "paid",
                paid_at: o.created_at,
                created_at: o.created_at,
                store_name: storeName,
                agent_id: o.agent_id || null,
              });
            }
          }
          if (list.length > 0) {
            const calculatedTotals = {
              count: list.length,
              revenue: list.reduce((s, o) => s + (o.amount || 0), 0),
              completed: list.filter((o) => /deliv|success/i.test(o.status)).length,
              pending: list.filter((o) => /pend|wait|process/i.test(o.status)).length,
              failed: list.filter((o) => /fail|cancel|refund/i.test(o.status)).length,
              paid: list.filter((o) => o.payment_status === "paid").length,
              payment_pending: list.filter((o) => /pend/i.test(o.payment_status)).length,
            };
            setOrders(list);
            setTotals(calculatedTotals);
            setCache("admin_whatsapp_orders", { orders: list, totals: calculatedTotals }, 45 * 1000);
            setError(null);
            success = true;
          }
        }
      } catch (err: any) {
        console.warn("Direct bot orders fallback error:", err);
      }
    }

    if (!success) {
      setError("Waiting for data provider or new bot orders. Retrying automatically…");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    // Smart interval polls every 45s and pauses when tab is hidden
    const stopPolling = createSmartInterval(() => load(false), 900000);
    return () => stopPolling();
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MessageCircle className="size-6 text-emerald-600" /> WhatsApp orders
          </h1>
          <p className="text-sm text-muted-foreground">
            Orders placed through the WhatsApp bot — auto-paused when tab is hidden.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Time range selector: defaults to Today */}
          <div className="flex items-center gap-1 bg-muted p-1 rounded-lg border text-xs font-semibold">
            <button
              type="button"
              onClick={() => setTimeFilter("today")}
              className={`px-3 py-1.5 rounded-md transition-all ${
                timeFilter === "today"
                  ? "bg-primary text-primary-foreground shadow-sm font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Today ({todayOrders.length})
            </button>
            <button
              type="button"
              onClick={() => setTimeFilter("all")}
              className={`px-3 py-1.5 rounded-md transition-all ${
                timeFilter === "all"
                  ? "bg-primary text-primary-foreground shadow-sm font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              All Time ({orders.length})
            </button>
          </div>

          <Button asChild variant="outline" size="sm">
            <a href={BOT_LINK} target="_blank" rel="noreferrer">Open bot chat</a>
          </Button>
          <Button size="sm" onClick={() => load(true)}><RefreshCw className="size-4 mr-2" /> Refresh</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4 bg-gradient-to-br from-emerald-500 to-teal-700 text-white border-0 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-wider opacity-90">
            {timeFilter === "today" ? "Today's Orders" : "Total Orders"}
          </div>
          <div className="text-2xl md:text-3xl font-black mt-1">{displayTotals.count}</div>
          <div className="text-[11px] opacity-80 mt-0.5">
            {timeFilter === "today" ? "New orders today" : "All-time bot orders"}
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-amber-400 to-orange-600 text-white border-0 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-wider opacity-90">Amount Paid</div>
          <div className="text-2xl md:text-3xl font-black mt-1">GHS {displayTotals.revenue.toFixed(2)}</div>
          <div className="text-[11px] opacity-80 mt-0.5">
            {timeFilter === "today" ? "Revenue collected today" : "Total lifetime revenue"}
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-sky-500 to-indigo-700 text-white border-0 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-wider opacity-90">Delivered</div>
          <div className="text-2xl md:text-3xl font-black mt-1">{displayTotals.completed}</div>
          <div className="text-[11px] opacity-80 mt-0.5">Landed successfully on phone</div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-violet-500 to-purple-800 text-white border-0 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-wider opacity-90">Paid</div>
          <div className="text-2xl md:text-3xl font-black mt-1">{displayTotals.paid}</div>
          <div className="text-[11px] opacity-80 mt-0.5">
            {displayTotals.pending > 0 ? `${displayTotals.pending} in progress` : "All payments confirmed"}
          </div>
        </Card>
      </div>

      <Card className="p-0 overflow-hidden">
        {loading ? (
          <div className="p-10 grid place-items-center"><Loader2 className="size-6 animate-spin" /></div>
        ) : error && orders.length === 0 ? (
          <div className="p-6 text-sm text-destructive break-words">{error}</div>
        ) : displayedOrders.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground space-y-2">
            <div>No WhatsApp orders recorded for {timeFilter === "today" ? "today" : "this store"}.</div>
            {timeFilter === "today" && orders.length > 0 && (
              <Button variant="outline" size="sm" onClick={() => setTimeFilter("all")}>
                View All Time Orders ({orders.length})
              </Button>
            )}
          </div>
        ) : (
          <>
            {error && <div className="border-b bg-amber-50 px-4 py-3 text-sm text-amber-900">{error}</div>}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="text-left">
                  <th className="p-3">Track ID</th>
                  <th className="p-3">Store</th>
                  <th className="p-3">Network</th>
                  <th className="p-3">Bundle</th>
                  <th className="p-3">Recipient</th>
                  <th className="p-3">Amount</th>
                  <th className="p-3">Payment</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Date</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayedOrders.map((o) => (
                  <tr key={o.id} className="border-t">
                    <td className="p-3 font-mono text-xs">{o.datamart_reference || o.display_reference || o.reference || "—"}</td>
                    <td className="p-3">
                      <Badge className="bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 gap-1 text-[11px] font-bold">
                        <Store className="size-3" /> {o.store_name || "Main Store"}
                      </Badge>
                    </td>
                    <td className="p-3 font-semibold">{o.network}</td>
                    <td className="p-3">{o.capacity ? `${o.capacity}GB` : "—"}</td>
                    <td className="p-3"><PhoneLink value={o.phone} /></td>
                    <td className="p-3">GHS {Number(o.amount || 0).toFixed(2)}</td>
                    <td className="p-3">
                      <Badge variant="outline" className={statusTone(o.payment_status || "paid")}>
                        {o.payment_status === "paid" || !o.payment_status || o.payment_status === "unknown" ? "Paid" : o.payment_status}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <Badge variant="outline" className={statusTone(o.status)}>{o.status}</Badge>
                    </td>

                    <td className="p-3 text-xs text-muted-foreground">
                      {o.created_at ? new Date(o.created_at).toLocaleString() : "—"}
                    </td>

                    <td className="p-3 text-right">
                      {!/complet|deliver|success/i.test(o.status) && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={retrying === o.id}
                          onClick={() => retryOrder(o)}
                          className="h-7 text-xs px-2.5"
                        >
                          {retrying === o.id ? <Loader2 className="size-3 animate-spin" /> : "Retry / Sync"}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              </table>
            </div>
          </>
        )}
      </Card>
    </div>
  );
};

export default AdminWhatsAppOrders;
