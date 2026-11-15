import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { invokeApiFunction, supabase } from "@/integrations/supabase/client";
import { getCacheMeta, setCache, createSmartInterval } from "@/lib/localCache";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, MessageCircle } from "lucide-react";
import { PhoneLink } from "@/components/PhoneLink";
import { NETWORK_LABEL, networkClass, formatGHS } from "@/lib/networks";

interface WaOrder {
  id: string;
  reference: string;
  network: string;
  capacity: string;
  phone: string;
  amount: number;
  status: string;
  payment_status?: string;
  created_at: string | null;
}

interface Totals { count: number; revenue: number; completed: number; pending: number; failed: number }

const statusTone = (s: string) => {
  if (/complet|deliver|success|paid/i.test(s)) return "bg-emerald-100 text-emerald-800 border-emerald-300";
  if (/fail|cancel|refund|abandon/i.test(s)) return "bg-rose-100 text-rose-800 border-rose-300";
  if (/unknown/i.test(s)) return "bg-muted text-muted-foreground border-border";
  return "bg-amber-100 text-amber-900 border-amber-300";
};

export const WhatsAppOrdersSummary = () => {
  const [orders, setOrders] = useState<WaOrder[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (force = false) => {
    // Check shared cache first
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

    const { data, error } = await invokeApiFunction("whatsapp-orders");
    if (error || data?.error || data?.upstream_down) {
      setError(data?.message || "Could not load WhatsApp bot orders.");
    } else {
      setError(null);
      setOrders(data.orders || []);
      setTotals(data.totals || null);
      setCache("admin_whatsapp_orders", { orders: data.orders || [], totals: data.totals || null }, 45 * 1000);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const stopPolling = createSmartInterval(() => load(false), 900000);
    return () => stopPolling();
  }, [load]);

  return (
    <Card className="p-4 md:p-6">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <h2 className="font-bold flex items-center gap-2">
          <MessageCircle className="size-5 text-emerald-600" /> WhatsApp bot orders
        </h2>
        <Button asChild variant="outline" size="sm"><Link to="/admin/whatsapp-orders">View all</Link></Button>
      </div>

      {loading ? (
        <div className="grid place-items-center py-8"><Loader2 className="size-5 animate-spin" /></div>
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : (
        <>
          {totals && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <Card className="p-3 border-0 bg-gradient-to-br from-emerald-500 to-teal-700 text-white shadow-sm">
                <div className="text-xs font-bold uppercase tracking-wider opacity-90">Today's Orders</div>
                <div className="text-xl font-black mt-1">{totals.count}</div>
              </Card>
              <Card className="p-3 border-0 bg-gradient-to-br from-amber-400 to-orange-600 text-white shadow-sm">
                <div className="text-xs font-bold uppercase tracking-wider opacity-90">Amount Paid</div>
                <div className="text-xl font-black mt-1">{formatGHS(totals.revenue)}</div>
              </Card>
              <Card className="p-3 border-0 bg-gradient-to-br from-sky-500 to-indigo-700 text-white shadow-sm">
                <div className="text-xs font-bold uppercase tracking-wider opacity-90">Delivered</div>
                <div className="text-xl font-black mt-1">{totals.completed}</div>
              </Card>
              <Card className="p-3 border-0 bg-gradient-to-br from-violet-500 to-purple-800 text-white shadow-sm">
                <div className="text-xs font-bold uppercase tracking-wider opacity-90">Paid</div>
                <div className="text-xl font-black mt-1">{totals.paid ?? totals.count}</div>
              </Card>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground border-b">
                <tr>
                  <th className="py-2 pr-3">Time</th>
                  <th className="py-2 pr-3">Network</th>
                  <th className="py-2 pr-3">Bundle</th>
                  <th className="py-2 pr-3">Phone</th>
                  <th className="py-2 pr-3">Amount</th>
                  <th className="py-2 pr-3">Payment</th>
                  <th className="py-2 pr-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 && (
                  <tr><td colSpan={7} className="py-6 text-center text-muted-foreground">No WhatsApp orders yet.</td></tr>
                )}
                {orders.slice(0, 8).map(o => (
                  <tr key={o.id} className="border-b last:border-0">
                    <td className="py-2 pr-3 whitespace-nowrap">{o.created_at ? new Date(o.created_at).toLocaleString() : "—"}</td>
                    <td className="py-2 pr-3"><span className={`px-2 py-0.5 rounded text-xs ${networkClass(o.network)}`}>{NETWORK_LABEL[o.network] || o.network}</span></td>
                    <td className="py-2 pr-3 font-medium">{o.capacity}GB</td>
                    <td className="py-2 pr-3"><PhoneLink value={o.phone} /></td>
                    <td className="py-2 pr-3">{formatGHS(o.amount)}</td>
                    <td className="py-2 pr-3">
                      <span className={`px-2 py-0.5 rounded border text-xs capitalize ${statusTone(o.payment_status || "unknown")}`}>
                        {o.payment_status === "paid" ? "Paid" : o.payment_status || "unknown"}
                      </span>
                    </td>
                    <td className="py-2 pr-3">
                      <span className={`px-2 py-0.5 rounded border text-xs capitalize ${statusTone(o.status)}`}>{o.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Card>
  );
};

export default WhatsAppOrdersSummary;
