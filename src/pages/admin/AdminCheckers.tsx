import { useCallback, useEffect, useState } from "react";
import { supabase, invokeApiFunction } from "@/integrations/supabase/client";
import { getCacheMeta, setCache, invalidateCache } from "@/lib/localCache";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { PhoneLink } from "@/components/PhoneLink";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Loader2, RefreshCw, Wallet, MessageSquare } from "lucide-react";

interface CheckerOrder {
  id: string;
  checker_type: string;
  customer_name: string | null;
  customer_phone: string;
  customer_email: string | null;
  amount: number;
  reference: string;
  serial_number: string | null;
  pin: string | null;
  payment_status: string;
  delivery_status: string;
  error_message: string | null;
  created_at: string;
}

const statusTone = (s: string) =>
  s === "delivered" || s === "paid" ? "bg-success/15 text-success border-success/40"
    : s === "failed" ? "bg-destructive/15 text-destructive border-destructive/40"
    : "bg-muted text-muted-foreground";

const AdminCheckers = () => {
  const [orders, setOrders] = useState<CheckerOrder[]>([]);
  const [waec, setWaec] = useState("20");
  const [bece, setBece] = useState("20");
  const [stock, setStock] = useState<any[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingSmsId, setSendingSmsId] = useState<string | null>(null);
  const [retryingRef, setRetryingRef] = useState<string | null>(null);
  const [fulfillOrder, setFulfillOrder] = useState<CheckerOrder | null>(null);
  const [manualSerial, setManualSerial] = useState("");
  const [manualPin, setManualPin] = useState("");
  const [fulfilling, setFulfilling] = useState(false);

  const retryPurchase = async (o: CheckerOrder) => {
    setRetryingRef(o.reference);
    try {
      const { data, error } = await invokeApiFunction("admin-checkers", {
        body: { action: "retryPurchase", reference: o.reference },
      });
      if (error || data?.error) {
        toast.error(data?.error || error?.message || "Retry purchase failed");
      } else {
        toast.success(`Checker order ${o.reference} fulfilled successfully!`);
        invalidateCache("admin_checkers_cache");
        load(true);
      }
    } catch (e: any) {
      toast.error(e?.message || "Retry purchase failed");
    } finally {
      setRetryingRef(null);
    }
  };

  const submitManualFulfill = async () => {
    if (!fulfillOrder) return;
    if (!manualSerial.trim() && !manualPin.trim()) {
      toast.error("Please provide at least a PIN or Serial number");
      return;
    }
    setFulfilling(true);
    try {
      const { data, error } = await invokeApiFunction("admin-checkers", {
        body: {
          action: "manualFulfill",
          reference: fulfillOrder.reference,
          serial_number: manualSerial.trim(),
          pin: manualPin.trim(),
        },
      });
      if (error || data?.error) {
        toast.error(data?.error || error?.message || "Manual fulfillment failed");
      } else {
        toast.success(`Checker order ${fulfillOrder.reference} fulfilled and SMS dispatched!`);
        setFulfillOrder(null);
        setManualSerial("");
        setManualPin("");
        invalidateCache("admin_checkers_cache");
        load(true);
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed to fulfill");
    } finally {
      setFulfilling(false);
    }
  };

  const resendSms = async (o: CheckerOrder) => {
    setSendingSmsId(o.id);
    try {
      const { data, error } = await invokeApiFunction("admin-checkers", {
        body: {
          action: "resendSms",
          reference: o.reference,
          phone: o.customer_phone,
          serial_number: o.serial_number,
          pin: o.pin,
          checker_type: o.checker_type,
        },
      });
      if (error || data?.error) {
        toast.error(data?.error || error?.message || "Failed to send SMS");
      } else {
        toast.success(`SMS dispatched to ${o.customer_phone}`);
      }
    } catch (e: any) {
      toast.error(e?.message || "SMS failed");
    } finally {
      setSendingSmsId(null);
    }
  };

  const load = useCallback(async (force = false) => {
    if (!force) {
      const cached = getCacheMeta<any>("admin_checkers_cache");
      if (cached.exists && cached.data) {
        if (cached.data.orders) setOrders(cached.data.orders);
        if (cached.data.waec) setWaec(cached.data.waec);
        if (cached.data.bece) setBece(cached.data.bece);
        if (cached.data.stock) setStock(cached.data.stock);
        if (cached.data.balance !== undefined) setBalance(cached.data.balance);
        setLoading(false);
        if (!cached.isStale && cached.data.stock && cached.data.stock.length > 0) return;
      }
    }

    let loaded = false;
    try {
      const { data, error } = await invokeApiFunction("admin-checkers", { body: { action: "overview" } });
      if (!error && !data?.error && data) {
        setOrders(data.orders || []);
        if (data.waec_price) setWaec(String(data.waec_price));
        if (data.bece_price) setBece(String(data.bece_price));
        setStock(data.stock || []);
        setBalance(data.balance ?? null);
        setCache("admin_checkers_cache", {
          orders: data.orders || [],
          waec: data.waec_price ? String(data.waec_price) : waec,
          bece: data.bece_price ? String(data.bece_price) : bece,
          stock: data.stock || [],
          balance: data.balance ?? null,
        }, 60 * 1000);
        loaded = true;
      }
    } catch (_) {}

    if (!loaded) {
      try {
        const [ordersRes, settingsRes] = await Promise.all([
          supabase.from("checker_orders").select("id, checker_type, customer_name, customer_phone, customer_email, amount, reference, serial_number, pin, payment_status, delivery_status, created_at").order("created_at", { ascending: false }).limit(100),
          supabase.from("settings").select("key,value").in("key", ["waec_checker_price", "waec_price", "bece_checker_price", "bece_price"]),
        ]);
        let oList: CheckerOrder[] = [];
        if (ordersRes.data) {
          oList = ordersRes.data as CheckerOrder[];
          setOrders(oList);
          loaded = true;
        }
        const sMap = Object.fromEntries((settingsRes.data || []).map((s: any) => [s.key, s.value]));
        let curW = waec;
        let curB = bece;
        if (sMap.waec_checker_price || sMap.waec_price) { curW = String(sMap.waec_checker_price || sMap.waec_price); setWaec(curW); }
        if (sMap.bece_checker_price || sMap.bece_price) { curB = String(sMap.bece_checker_price || sMap.bece_price); setBece(curB); }
        setCache("admin_checkers_cache", { orders: oList, waec: curW, bece: curB, stock: [], balance: null }, 60 * 1000);
      } catch (err: any) {
        console.warn("Direct checkers fallback notice:", err);
      }
    }

    setLoading(false);
  }, [waec, bece]);

  useEffect(() => { document.title = "Result checkers – Admin"; load(); }, [load]);

  const savePrices = async () => {
    const w = Number(waec);
    const b = Number(bece);
    if (!(w > 0) || !(b > 0)) {
      toast.error("Prices must be valid positive numbers");
      return;
    }
    setSaving(true);
    let success = false;
    try {
      const { data, error } = await invokeApiFunction("admin-checkers", {
        body: { action: "setPrices", waec_price: w, bece_price: b },
      });
      if (!error && !data?.error) {
        success = true;
      }
    } catch (_) {}

    if (!success) {
      try {
        const { error: upsertErr } = await supabase.from("settings").upsert([
          { key: "waec_price", value: String(w) },
          { key: "waec_checker_price", value: String(w) },
          { key: "bece_price", value: String(b) },
          { key: "bece_checker_price", value: String(b) },
        ], { onConflict: "key" });
        if (!upsertErr) {
          success = true;
        }
      } catch (err: any) {
        console.error("Direct fallback error saving checker prices:", err);
      }
    }

    setSaving(false);
    if (!success) {
      toast.error("Could not save prices. Please check connection.");
      return;
    }
    toast.success("Prices updated successfully");
  };

  if (loading) return <div className="grid place-items-center py-20"><Loader2 className="size-6 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Result checkers</h1>
          <p className="text-sm text-muted-foreground">WAEC & BECE card sales, prices and stock.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => load(true)}><RefreshCw className="size-4 mr-2" /> Refresh</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-5">
          <h2 className="font-bold mb-3">Selling prices (GH₵)</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="waecp">WAEC</Label>
              <Input id="waecp" inputMode="decimal" value={waec} onChange={e => setWaec(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="becep">BECE</Label>
              <Input id="becep" inputMode="decimal" value={bece} onChange={e => setBece(e.target.value)} />
            </div>
          </div>
          <Button className="mt-4 w-full" disabled={saving} onClick={savePrices}>
            {saving ? <Loader2 className="size-4 mr-2 animate-spin" /> : null} Save prices
          </Button>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold flex items-center gap-2"><Wallet className="size-4" /> Supplier stock & wallet</h2>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => {
                invalidateCache("admin_checkers_cache");
                load(true);
              }}
              title="Re-check DataMart stock and wallet balance"
            >
              <RefreshCw className="size-3 mr-1" /> Check Live
            </Button>
          </div>
          {balance !== null && (
            <div className="text-sm mb-2">Wallet balance: <span className="font-bold">GH₵ {balance.toFixed(2)}</span></div>
          )}
          <div className="space-y-2 text-sm">
            {stock.length === 0 && (
              <div className="p-3 rounded-lg bg-card/60 border border-border/50 text-xs flex items-center justify-between">
                <span className="text-muted-foreground">Automated Supplier Fulfillment Active (Instant PIN & Serial via SMS)</span>
                <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 bg-emerald-500/10 text-[10px]">Active</Badge>
              </div>
            )}
            {stock.map((s: any) => (
              <div key={s.id || s.name} className="flex items-center justify-between border rounded-lg px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{s.name}</span>
                  <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-400 bg-emerald-500/10">In Stock</Badge>
                </div>
                <span className="text-muted-foreground text-xs">
                  {typeof s.stockCount === "string" ? s.stockCount : s.inStock ? `${s.stockCount} left` : "out of stock"}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="p-4 border-b font-bold">Purchases ({orders.length})</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="p-3">Date</th>
                <th className="p-3">Type</th>
                <th className="p-3">Buyer</th>
                <th className="p-3">Phone</th>
                <th className="p-3">Amount</th>
                <th className="p-3">Serial</th>
                <th className="p-3">PIN</th>
                <th className="p-3">Payment</th>
                <th className="p-3">Delivery</th>
                <th className="p-3">Reference</th>
                <th className="p-3 text-right">SMS</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 && (
                <tr><td colSpan={11} className="p-6 text-center text-muted-foreground">No purchases yet.</td></tr>
              )}
              {orders.map(o => (
                <tr key={o.id} className="border-t">
                  <td className="p-3 whitespace-nowrap">{new Date(o.created_at).toLocaleString()}</td>
                  <td className="p-3 font-semibold">{o.checker_type}</td>
                  <td className="p-3">{o.customer_name || "—"}</td>
                  <td className="p-3 whitespace-nowrap"><PhoneLink value={o.customer_phone} /></td>
                  <td className="p-3">GH₵ {Number(o.amount).toFixed(2)}</td>
                  <td className="p-3 font-mono">{o.serial_number || "—"}</td>
                  <td className="p-3 font-mono">{o.pin || "—"}</td>
                  <td className="p-3"><Badge variant="outline" className={statusTone(o.payment_status)}>{o.payment_status}</Badge></td>
                  <td className="p-3">
                    <Badge variant="outline" className={statusTone(o.delivery_status)}>{o.delivery_status}</Badge>
                    {o.error_message && <div className="text-xs text-destructive mt-1">{o.error_message}</div>}
                  </td>
                  <td className="p-3 font-mono text-xs">{o.reference}</td>
                  <td className="p-3 text-right space-x-1 whitespace-nowrap">
                    {(o.pin || o.serial_number) && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-xs"
                        disabled={sendingSmsId === o.id}
                        onClick={() => resendSms(o)}
                        title="Send / Resend SMS with card serial & PIN"
                      >
                        {sendingSmsId === o.id ? (
                          <Loader2 className="size-3 animate-spin mr-1" />
                        ) : (
                          <MessageSquare className="size-3 mr-1 text-emerald-500" />
                        )}
                        SMS
                      </Button>
                    )}

                    {o.delivery_status !== "delivered" && o.payment_status === "paid" && (
                      <>
                        <Button
                          size="sm"
                          variant="default"
                          className="h-7 px-2 text-xs bg-primary hover:bg-primary/90"
                          disabled={retryingRef === o.reference}
                          onClick={() => retryPurchase(o)}
                          title="Retry purchasing card from DataMart"
                        >
                          {retryingRef === o.reference ? (
                            <Loader2 className="size-3 animate-spin mr-1" />
                          ) : (
                            <RefreshCw className="size-3 mr-1" />
                          )}
                          Retry
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs border-amber-500/50 text-amber-500 hover:bg-amber-500/10 font-bold"
                          onClick={() => {
                            setFulfillOrder(o);
                            setManualSerial(o.serial_number || "");
                            setManualPin(o.pin || "");
                          }}
                          title="Manually enter PIN & Serial"
                        >
                          Fulfill
                        </Button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default AdminCheckers;
