import React, { useState, useEffect, useMemo } from "react";
import { invokeApiFunction, supabase } from "@/integrations/supabase/client";
import { invalidateShopCache } from "@/lib/storeCache";
import { getSavedOrders } from "@/lib/orderHistory";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Zap,
  Clock,
  Save,
  Copy,
  Check,
  RefreshCw,
  ShoppingBag,
  Flame,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  FileSpreadsheet,
  Download,
  Search,
  Filter,
} from "lucide-react";

export interface FlashSaleProduct {
  id: string;
  network: "MTN";
  capacity: string;
  mb: number;
  price: number;
  original_price?: number;
  in_stock: boolean;
  sort_order: number;
}

const DEFAULT_FLASH_SALE_PRODUCTS: FlashSaleProduct[] = [
  { id: "fs-mtn-1", network: "MTN", capacity: "1", mb: 1000, price: 4.5, original_price: 6.0, in_stock: true, sort_order: 1 },
  { id: "fs-mtn-2", network: "MTN", capacity: "2", mb: 2000, price: 8.5, original_price: 11.0, in_stock: true, sort_order: 2 },
  { id: "fs-mtn-3", network: "MTN", capacity: "3", mb: 3000, price: 12.5, original_price: 16.0, in_stock: true, sort_order: 3 },
  { id: "fs-mtn-4", network: "MTN", capacity: "4", mb: 4000, price: 16.5, original_price: 21.0, in_stock: true, sort_order: 4 },
  { id: "fs-mtn-5", network: "MTN", capacity: "5", mb: 5000, price: 20.0, original_price: 26.0, in_stock: true, sort_order: 5 },
  { id: "fs-mtn-6", network: "MTN", capacity: "6", mb: 6000, price: 24.5, original_price: 31.0, in_stock: true, sort_order: 6 },
  { id: "fs-mtn-8", network: "MTN", capacity: "8", mb: 8000, price: 32.5, original_price: 41.0, in_stock: true, sort_order: 8 },
  { id: "fs-mtn-10", network: "MTN", capacity: "10", mb: 10000, price: 40.0, original_price: 50.0, in_stock: true, sort_order: 10 },
  { id: "fs-mtn-15", network: "MTN", capacity: "15", mb: 15000, price: 60.0, original_price: 75.0, in_stock: true, sort_order: 15 },
  { id: "fs-mtn-20", network: "MTN", capacity: "20", mb: 20000, price: 78.0, original_price: 98.0, in_stock: true, sort_order: 20 },
  { id: "fs-mtn-25", network: "MTN", capacity: "25", mb: 25000, price: 98.0, original_price: 125.0, in_stock: true, sort_order: 25 },
  { id: "fs-mtn-30", network: "MTN", capacity: "30", mb: 30000, price: 118.0, original_price: 150.0, in_stock: true, sort_order: 30 },
  { id: "fs-mtn-40", network: "MTN", capacity: "40", mb: 40000, price: 156.0, original_price: 198.0, in_stock: true, sort_order: 40 },
  { id: "fs-mtn-50", network: "MTN", capacity: "50", mb: 50000, price: 195.0, original_price: 245.0, in_stock: true, sort_order: 50 },
  { id: "fs-mtn-100", network: "MTN", capacity: "100", mb: 100000, price: 380.0, original_price: 490.0, in_stock: true, sort_order: 100 },
];

export const AdminFlashSale = () => {
  const [enabled, setEnabled] = useState(false);
  const [endTime, setEndTime] = useState<string>("");
  const [title, setTitle] = useState("⚡ LIMITED TIME MTN FLASH SALE ⚡");
  const [notice, setNotice] = useState("Special mega-discounted MTN data bundles! Delivery starts immediately after payment.");
  const [products, setProducts] = useState<FlashSaleProduct[]>(DEFAULT_FLASH_SALE_PRODUCTS);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [searchOrder, setSearchOrder] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "processing" | "completed">("all");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Remaining time ticker
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const isTimerActive = useMemo(() => {
    if (!enabled || !endTime) return false;
    const endMs = new Date(endTime).getTime();
    return !isNaN(endMs) && endMs > now;
  }, [enabled, endTime, now]);

  const remainingFormatted = useMemo(() => {
    if (!endTime) return "No timer set";
    const endMs = new Date(endTime).getTime();
    const diff = endMs - now;
    if (isNaN(diff) || diff <= 0) return "Expired (Default store active)";
    const h = Math.floor(diff / (1000 * 60 * 60));
    const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const s = Math.floor((diff % (1000 * 60)) / 1000);
    return `${h.toString().padStart(2, "0")}h : ${m.toString().padStart(2, "0")}m : ${s.toString().padStart(2, "0")}s remaining`;
  }, [endTime, now]);

  // Load Settings and Products
  const loadData = async () => {
    setLoading(true);

    // 0. Instant LocalStorage fallback
    try {
      const localEnabled = localStorage.getItem("data1gh_flash_sale_enabled");
      const localEnd = localStorage.getItem("data1gh_flash_sale_end_time");
      const localTitle = localStorage.getItem("data1gh_flash_sale_title");
      const localNotice = localStorage.getItem("data1gh_flash_sale_notice");
      const localProds = localStorage.getItem("data1gh_flash_sale_products");

      if (localEnabled !== null) setEnabled(localEnabled === "true");
      if (localEnd) setEndTime(localEnd);
      if (localTitle) setTitle(localTitle);
      if (localNotice) setNotice(localNotice);
      if (localProds) {
        try {
          const p = JSON.parse(localProds);
          if (Array.isArray(p) && p.length > 0) setProducts(p);
        } catch (_) {}
      }
    } catch (_) {}

    try {
      let map: Record<string, string> = {};
      const res = await invokeApiFunction("admin-data", {
        body: { action: "getSettings" },
      });
      const settingsList = res?.data?.settings || [];
      settingsList.forEach((s: any) => {
        if (s?.key) map[s.key] = s.value || "";
      });

      if (!map.flash_sale_enabled) {
        // Fallback directly to Supabase query
        const { data: sbSettings } = await supabase
          .from("settings")
          .select("key, value")
          .like("key", "flash_sale%");
        if (Array.isArray(sbSettings)) {
          sbSettings.forEach((s: any) => {
            if (s?.key) map[s.key] = s.value || "";
          });
        }
      }

      if (map.flash_sale_enabled !== undefined) {
        setEnabled(map.flash_sale_enabled === "true");
        localStorage.setItem("data1gh_flash_sale_enabled", map.flash_sale_enabled);
      }
      if (map.flash_sale_end_time) {
        setEndTime(map.flash_sale_end_time);
        localStorage.setItem("data1gh_flash_sale_end_time", map.flash_sale_end_time);
      }
      if (map.flash_sale_title) {
        setTitle(map.flash_sale_title);
        localStorage.setItem("data1gh_flash_sale_title", map.flash_sale_title);
      }
      if (map.flash_sale_notice) {
        setNotice(map.flash_sale_notice);
        localStorage.setItem("data1gh_flash_sale_notice", map.flash_sale_notice);
      }
      if (map.flash_sale_products) {
        try {
          const parsed = JSON.parse(map.flash_sale_products);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setProducts(parsed);
            localStorage.setItem("data1gh_flash_sale_products", map.flash_sale_products);
          }
        } catch (_) { }
      }
    } catch (err: any) {
      console.warn("Flash sale settings read note:", err?.message);
    } finally {
      setLoading(false);
    }
  };

  // Load Flash Sale Orders
  const loadOrders = async () => {
    setOrdersLoading(true);
    try {
      let loaded: any[] = [];
      const res = await invokeApiFunction("admin-data", {
        body: { action: "getFlashSaleOrders" },
      });
      if (res?.data?.ok && Array.isArray(res.data.orders) && res.data.orders.length > 0) {
        loaded = res.data.orders;
      } else {
        // Fallback: Query Supabase safely without failing if is_flash_sale column is missing
        try {
          const { data: noteMatches } = await supabase
            .from("orders")
            .select("*")
            .ilike("notes", "%FLASH_SALE%")
            .order("created_at", { ascending: false })
            .limit(200);
          if (Array.isArray(noteMatches)) {
            loaded.push(...noteMatches);
          }
        } catch (_) {}

        try {
          const { data: recentOrders } = await supabase
            .from("orders")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(200);
          if (Array.isArray(recentOrders)) {
            const isFlash = (o: any) =>
              o?.is_flash_sale === true ||
              o?.is_flash_sale === "true" ||
              (typeof o?.notes === "string" && (o.notes.includes("FLASH_SALE") || o.notes.includes("FLASH SALE"))) ||
              (typeof o?.product_id === "string" && (o.product_id.startsWith("fs-") || o.product_id.toLowerCase().includes("flash"))) ||
              (typeof o?.bundle === "string" && o.bundle.toLowerCase().includes("flash"));

            for (const r of recentOrders) {
              if (isFlash(r) && !loaded.some((x: any) => (x.id && x.id === r.id) || (x.reference && x.reference === r.reference))) {
                loaded.push(r);
              }
            }
          }
        } catch (_) {}
      }

      // Also merge any local browser saved orders that were flash sale
      try {
        const local = getSavedOrders();
        if (Array.isArray(local)) {
          const isFlash = (o: any) =>
            (o as any)?.is_flash_sale === true ||
            (typeof (o as any)?.notes === "string" && (o as any).notes.includes("FLASH_SALE")) ||
            (typeof (o as any)?.product_id === "string" && (o as any).product_id.startsWith("fs-"));
          for (const l of local) {
            if (isFlash(l) && !loaded.some((x: any) => x.reference === l.reference)) {
              loaded.push(l);
            }
          }
        }
      } catch (_) {}

      // Normalize phone and fields
      const formatted = loaded.map((o: any) => {
        const phone = o.recipient_phone || o.phone_number || o.customer_phone || o.phone || "—";
        return {
          ...o,
          recipient_phone: phone,
          reference: o.reference || o.ref || o.id,
          delivery_status: o.delivery_status || "processing",
          payment_status: o.payment_status || "paid",
        };
      });

      formatted.sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
      setOrders(formatted);
    } catch (err: any) {
      console.warn("Error loading flash sale orders:", err?.message);
    } finally {
      setOrdersLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    loadOrders();
  }, []);

  // Instant Auto-Save on Toggle
  const handleToggleSwitch = async (newVal: boolean) => {
    setEnabled(newVal);
    try {
      localStorage.setItem("data1gh_flash_sale_enabled", newVal ? "true" : "false");
      const rows = [{ key: "flash_sale_enabled", value: newVal ? "true" : "false" }];
      await Promise.allSettled([
        invokeApiFunction("admin-data", { body: { action: "saveSettings", settings: rows } }),
        supabase.from("settings").upsert(rows, { onConflict: "key" }),
      ]);
      invalidateShopCache();
      window.dispatchEvent(new Event("shop-cache-invalidated"));
      if (newVal) {
        toast.success("⚡ Flash Sale switched ON!");
      } else {
        toast.success("⚪ Flash Sale turned OFF. Store reverted to normal!");
      }
    } catch (_) {
      toast.error("Failed to update status");
    }
  };

  // Quick preset timer buttons (adds hours from now)
  const setQuickTimer = (hours: number) => {
    const d = new Date(Date.now() + hours * 60 * 60 * 1000);
    // Format to YYYY-MM-DDTHH:mm
    const tzOffset = d.getTimezoneOffset() * 60000;
    const localISOTime = new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
    setEndTime(localISOTime);
    setEnabled(true);
    toast.success(`Timer set for ${hours >= 1 ? `${hours} hour(s)` : `${hours * 60} mins`} from now!`);
  };

  // Save Settings & Products
  const handleSave = async () => {
    setSavingSettings(true);
    try {
      const prodsJson = JSON.stringify(products);
      const rows = [
        { key: "flash_sale_enabled", value: enabled ? "true" : "false" },
        { key: "flash_sale_end_time", value: endTime || "" },
        { key: "flash_sale_title", value: title.trim() },
        { key: "flash_sale_notice", value: notice.trim() },
        { key: "flash_sale_products", value: prodsJson },
      ];

      // 1. Instant local persistence
      try {
        localStorage.setItem("data1gh_flash_sale_enabled", enabled ? "true" : "false");
        localStorage.setItem("data1gh_flash_sale_end_time", endTime || "");
        localStorage.setItem("data1gh_flash_sale_title", title.trim());
        localStorage.setItem("data1gh_flash_sale_notice", notice.trim());
        localStorage.setItem("data1gh_flash_sale_products", prodsJson);
      } catch (_) {}

      // 2. Multi-channel database push
      await Promise.allSettled([
        invokeApiFunction("admin-data", { body: { action: "saveSettings", settings: rows } }),
        supabase.from("settings").upsert(rows, { onConflict: "key" }),
      ]);

      invalidateShopCache();
      window.dispatchEvent(new Event("shop-cache-invalidated"));

      toast.success(
        enabled && isTimerActive
          ? "⚡ Flash Sale is now LIVE on the storefront!"
          : "Flash Sale configuration saved successfully!"
      );
    } catch (err: any) {
      toast.error(err?.message || "Failed to save Flash Sale settings");
    } finally {
      setSavingSettings(false);
    }
  };

  // Update product price
  const updateProductPrice = (id: string, newPrice: number) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, price: Number(newPrice) || 0 } : p))
    );
  };

  // Toggle in_stock
  const toggleProductStock = (id: string) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, in_stock: !p.in_stock } : p))
    );
  };

  // Add custom size
  const addCustomSize = () => {
    const cap = prompt("Enter bundle capacity in GB (e.g. 7 or 12):");
    if (!cap) return;
    const cleanCap = cap.replace(/[^0-9.]/g, "");
    if (!cleanCap) return;
    const priceStr = prompt(`Enter price for MTN ${cleanCap}GB (in GH₵):`, "25");
    const numPrice = Number(priceStr) || 0;
    const newProd: FlashSaleProduct = {
      id: `fs-mtn-${cleanCap.replace(".", "_")}-${Date.now().toString().slice(-4)}`,
      network: "MTN",
      capacity: cleanCap,
      mb: Math.round(Number(cleanCap) * 1000),
      price: numPrice,
      original_price: Math.round(numPrice * 1.25),
      in_stock: true,
      sort_order: Number(cleanCap) || 50,
    };
    setProducts((prev) => [...prev, newProd].sort((a, b) => Number(a.capacity) - Number(b.capacity)));
    toast.success(`Added MTN ${cleanCap}GB! Remember to click Save.`);
  };

  // Delete product
  const deleteProduct = (id: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== id));
  };

  // Mark order status
  const handleUpdateOrderStatus = async (order: any, newStatus: string) => {
    try {
      await invokeApiFunction("admin-data", {
        body: {
          action: "updateOrderStatus",
          reference: order.reference,
          id: order.id,
          delivery_status: newStatus,
        },
      });
      setOrders((prev) =>
        prev.map((o) =>
          o.reference === order.reference || o.id === order.id
            ? { ...o, delivery_status: newStatus }
            : o
        )
      );
      toast.success(`Order marked as ${newStatus}`);
    } catch (_) {
      toast.error("Failed to update order");
    }
  };

  // Copy helper
  const copyText = (text: string, key: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success(`${label} copied!`);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Bulk copy operations
  const copyAllNumbersAndGig = (onlyProcessing = false) => {
    const list = filteredOrders.filter((o) =>
      onlyProcessing ? o.delivery_status !== "completed" : true
    );
    if (list.length === 0) {
      toast.error("No orders to copy");
      return;
    }
    const text = list
      .map((o) => {
        const phone = o.recipient_phone || o.phone_number || "";
        const cap = o.capacity || "";
        return `${phone} ${cap}GB`.trim();
      })
      .join("\n");
    copyText(text, "bulk-all-num-gb", `Copied ${list.length} orders (Number + GB)`);
  };

  const copyAllNumbersOnly = (onlyProcessing = false) => {
    const list = filteredOrders.filter((o) =>
      onlyProcessing ? o.delivery_status !== "completed" : true
    );
    if (list.length === 0) {
      toast.error("No numbers to copy");
      return;
    }
    const text = list
      .map((o) => o.recipient_phone || o.phone_number || "")
      .filter(Boolean)
      .join("\n");
    copyText(text, "bulk-all-num", `Copied ${list.length} numbers`);
  };

  const copyCsvFormat = () => {
    if (filteredOrders.length === 0) {
      toast.error("No orders to export");
      return;
    }
    const header = "Phone,Capacity,Amount,Reference,Status,Date";
    const rows = filteredOrders.map((o) =>
      `"${o.recipient_phone || o.phone_number || ""}","${o.capacity || ""}GB","GH₵ ${o.amount || ""}","${o.reference}","${o.delivery_status || "processing"}","${new Date(o.created_at || Date.now()).toLocaleString()}"`
    );
    const csv = [header, ...rows].join("\n");
    copyText(csv, "bulk-csv", "Copied CSV table to clipboard");
  };

  // Filter orders
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (statusFilter === "processing" && o.delivery_status === "completed") return false;
      if (statusFilter === "completed" && o.delivery_status !== "completed") return false;
      if (searchOrder) {
        const s = searchOrder.toLowerCase().trim();
        const p = (o.recipient_phone || o.phone_number || "").toLowerCase();
        const ref = (o.reference || "").toLowerCase();
        const cap = (o.capacity || "").toLowerCase();
        if (!p.includes(s) && !ref.includes(s) && !cap.includes(s)) return false;
      }
      return true;
    });
  }, [orders, statusFilter, searchOrder]);

  // Order stats
  const stats = useMemo(() => {
    const totalOrders = orders.length;
    const processingCount = orders.filter((o) => o.delivery_status !== "completed").length;
    const completedCount = orders.filter((o) => o.delivery_status === "completed").length;
    const totalGhs = orders.reduce((sum, o) => sum + (Number(o.amount) || 0), 0);
    const totalGb = orders.reduce((sum, o) => {
      const match = String(o.capacity || "").match(/(\d+(?:\.\d+)?)/);
      return sum + (match ? Number(match[1]) : 0);
    }, 0);
    return { totalOrders, processingCount, completedCount, totalGhs, totalGb };
  }, [orders]);

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-16">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="size-10 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center font-black shadow-lg">
              <Zap className="size-6 fill-slate-950" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black tracking-tight text-foreground">
                ⚡ MTN Flash Sale Control Center
              </h1>
              <p className="text-xs md:text-sm text-muted-foreground">
                Turn on Flash Sale to override the store with exclusive discounted MTN bundles.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            onClick={handleSave}
            disabled={savingSettings}
            className="h-11 px-5 rounded-xl font-bold bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 hover:opacity-95 shadow-lg gap-2"
          >
            <Save className="size-4" />
            <span>{savingSettings ? "Saving..." : "Save Settings & Prices"}</span>
          </Button>
        </div>
      </div>

      {/* Live Status Card */}
      <Card
        className={`overflow-hidden border-2 rounded-3xl p-5 md:p-6 transition-all ${isTimerActive
          ? "border-amber-500/80 bg-gradient-to-br from-amber-500/15 via-card to-orange-500/10 shadow-[0_10px_40px_rgba(245,158,11,0.25)]"
          : "border-border/80 bg-card"
          }`}
      >
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <Badge
                className={`px-3 py-1 text-xs font-black uppercase tracking-wider rounded-full ${isTimerActive
                  ? "bg-amber-500 text-slate-950 animate-pulse"
                  : "bg-muted text-muted-foreground"
                  }`}
              >
                {isTimerActive ? "🔥 FLASH SALE IS CURRENTLY LIVE ON FRONTEND" : "⚪ FLASH SALE IS INACTIVE"}
              </Badge>
              {isTimerActive && (
                <span className="text-xs font-bold text-amber-500 flex items-center gap-1 font-mono">
                  <Flame className="size-4 animate-bounce" />
                  {remainingFormatted}
                </span>
              )}
            </div>

            <p className="text-xs md:text-sm text-muted-foreground leading-relaxed max-w-2xl">
              {isTimerActive
                ? "When Flash Sale is active, the entire default system (normal network options) is hidden at the main store frontend, and ONLY your Flash Sale MTN products are displayed."
                : "The main store is currently showing the normal default catalog. Switch the toggle ON and set a timer below to launch the Flash Sale!"}
            </p>
          </div>

          {/* Master Switch */}
          <div className="flex items-center gap-3 bg-muted/60 p-3.5 rounded-2xl border border-border shrink-0">
            <Label htmlFor="master-toggle" className="text-sm font-black cursor-pointer">
              {enabled ? "⚡ Turn OFF Flash Sale" : "🚀 Turn ON Flash Sale"}
            </Label>
            <Switch
              id="master-toggle"
              checked={enabled}
              onCheckedChange={handleToggleSwitch}
              className="data-[state=checked]:bg-amber-500"
            />
          </div>
        </div>
      </Card>

      {/* Control Section: Timer & Banners */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: Timer Settings */}
        <Card className="rounded-3xl border border-border p-5 md:p-6 space-y-4">
          <div className="flex items-center gap-2 text-foreground font-black text-base">
            <Clock className="size-5 text-amber-500" />
            <span>Countdown Timer Settings</span>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-bold">Quick Preset Timers (From Now):</Label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setQuickTimer(0.5)} className="text-xs font-bold rounded-xl">
                30 Mins
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setQuickTimer(1)} className="text-xs font-bold rounded-xl">
                1 Hour
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setQuickTimer(2)} className="text-xs font-bold rounded-xl">
                2 Hours
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setQuickTimer(4)} className="text-xs font-bold rounded-xl">
                4 Hours
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setQuickTimer(8)} className="text-xs font-bold rounded-xl">
                8 Hours
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setQuickTimer(24)} className="text-xs font-bold rounded-xl">
                24 Hours
              </Button>
            </div>
          </div>

          <div className="space-y-1.5 pt-1">
            <Label htmlFor="custom-end-time" className="text-xs font-bold">
              Custom End Date &amp; Time:
            </Label>
            <Input
              id="custom-end-time"
              type="datetime-local"
              value={endTime ? (endTime.length === 16 ? endTime : endTime.slice(0, 16)) : ""}
              onChange={(e) => setEndTime(e.target.value)}
              className="rounded-xl font-mono text-sm"
            />
            <p className="text-[11px] text-muted-foreground">
              Once this time arrives, the store automatically reverts to normal default products.
            </p>
          </div>
        </Card>

        {/* Card 2: Headline & Notice */}
        <Card className="rounded-3xl border border-border p-5 md:p-6 space-y-4">
          <div className="flex items-center gap-2 text-foreground font-black text-base">
            <Flame className="size-5 text-orange-500" />
            <span>Flash Sale Banner Texts</span>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="fs-title" className="text-xs font-bold">
              Flash Sale Headline:
            </Label>
            <Input
              id="fs-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="⚡ LIMITED TIME MTN FLASH SALE ⚡"
              className="rounded-xl font-bold text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="fs-notice" className="text-xs font-bold">
              Announcement Message:
            </Label>
            <Input
              id="fs-notice"
              value={notice}
              onChange={(e) => setNotice(e.target.value)}
              placeholder="Special discounted MTN data bundles!"
              className="rounded-xl text-xs"
            />
          </div>
        </Card>
      </div>

      {/* Product Pricing Matrix (MTN Only) */}
      <Card className="rounded-3xl border border-border p-5 md:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg md:text-xl font-black text-foreground flex items-center gap-2">
              <ShoppingBag className="size-5 text-amber-500" />
              <span>MTN Flash Sale Packages &amp; Prices</span>
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Set your discounted prices. These will display on the store during the Flash Sale.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addCustomSize}
              className="rounded-xl text-xs font-bold gap-1.5"
            >
              <Plus className="size-3.5" />
              <span>Add Package</span>
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={savingSettings}
              className="rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 gap-1.5"
            >
              <Save className="size-3.5" />
              <span>Save Prices</span>
            </Button>
          </div>
        </div>

        {/* Pricing Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {products.map((p) => (
            <div
              key={p.id}
              className={`p-3.5 rounded-2xl border-2 transition-all ${p.in_stock ? "border-border bg-card" : "border-muted bg-muted/30 opacity-60"
                }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-black text-base text-foreground font-mono">
                  {p.capacity} GB
                </span>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400">
                  MTN
                </span>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[11px] font-bold text-muted-foreground">Sale Price (GH₵):</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
                    GH₵
                  </span>
                  <Input
                    type="number"
                    step="0.10"
                    min="0"
                    value={p.price}
                    onChange={(e) => updateProductPrice(p.id, Number(e.target.value))}
                    className="pl-12 font-mono font-bold text-sm h-9 rounded-xl"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/60 text-xs">
                <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-semibold text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={p.in_stock}
                    onChange={() => toggleProductStock(p.id)}
                    className="rounded border-border"
                  />
                  <span>In Stock</span>
                </label>

                <button
                  type="button"
                  onClick={() => deleteProduct(p.id)}
                  className="text-muted-foreground hover:text-red-500 transition-colors p-1"
                  title="Remove size"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Orders Section (Fast Sale Orders) */}
      <Card className="rounded-3xl border border-border p-5 md:p-6 space-y-5">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg md:text-xl font-black text-foreground">
                📦 Flash Sale Orders ({filteredOrders.length})
              </h2>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={loadOrders}
                disabled={ordersLoading}
                className="h-8 w-8 p-0 rounded-xl"
              >
                <RefreshCw className={`size-3.5 ${ordersLoading ? "animate-spin" : ""}`} />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Flash Sale orders bypass DataMart API and show as <strong>processing</strong> so you can deliver them manually.
            </p>
          </div>

          {/* Bulk Copy Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => copyAllNumbersAndGig(true)}
              className="rounded-xl text-xs font-bold gap-1.5 border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
              title="Copies e.g. 0241234567 5GB for pending/processing orders"
            >
              <Copy className="size-3.5" />
              <span>Copy Processing (Num + GB)</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => copyAllNumbersAndGig(false)}
              className="rounded-xl text-xs font-bold gap-1.5"
            >
              <Copy className="size-3.5" />
              <span>Copy All (Num + GB)</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => copyAllNumbersOnly(false)}
              className="rounded-xl text-xs font-bold gap-1.5"
            >
              <Copy className="size-3.5" />
              <span>Copy Numbers Only</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={copyCsvFormat}
              className="rounded-xl text-xs font-bold gap-1.5"
            >
              <FileSpreadsheet className="size-3.5" />
              <span>Copy CSV</span>
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-2xl bg-muted/40 border border-border">
            <div className="text-xs font-bold text-muted-foreground">Total Orders</div>
            <div className="text-xl font-black text-foreground font-mono mt-0.5">{stats.totalOrders}</div>
          </div>
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30">
            <div className="text-xs font-bold text-amber-700 dark:text-amber-300">Processing (Pending)</div>
            <div className="text-xl font-black text-amber-600 dark:text-amber-400 font-mono mt-0.5">
              {stats.processingCount}
            </div>
          </div>
          <div className="p-3.5 rounded-2xl bg-muted/40 border border-border">
            <div className="text-xs font-bold text-muted-foreground">Total Data Ordered</div>
            <div className="text-xl font-black text-foreground font-mono mt-0.5">{stats.totalGb} GB</div>
          </div>
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30">
            <div className="text-xs font-bold text-emerald-700 dark:text-emerald-300">Total Revenue</div>
            <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
              GH₵ {stats.totalGhs.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
          <div className="relative w-full sm:w-72">
            <Search className="size-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              placeholder="Search phone or reference..."
              value={searchOrder}
              onChange={(e) => setSearchOrder(e.target.value)}
              className="pl-9 h-9 text-xs rounded-xl"
            />
          </div>

          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            <Button
              type="button"
              variant={statusFilter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("all")}
              className="h-8 text-xs font-bold rounded-xl"
            >
              All ({orders.length})
            </Button>
            <Button
              type="button"
              variant={statusFilter === "processing" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("processing")}
              className="h-8 text-xs font-bold rounded-xl"
            >
              Processing ({stats.processingCount})
            </Button>
            <Button
              type="button"
              variant={statusFilter === "completed" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("completed")}
              className="h-8 text-xs font-bold rounded-xl"
            >
              Completed ({stats.completedCount})
            </Button>
          </div>
        </div>

        {/* Orders Table */}
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/70 text-muted-foreground font-bold uppercase tracking-wider">
              <tr>
                <th className="p-3">Recipient Phone</th>
                <th className="p-3">Bundle</th>
                <th className="p-3">Amount</th>
                <th className="p-3">Status</th>
                <th className="p-3">Reference</th>
                <th className="p-3">Date / Time</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    {ordersLoading ? "Loading orders..." : "No Flash Sale orders found yet."}
                  </td>
                </tr>
              ) : (
                filteredOrders.map((o) => {
                  const pNum = o.recipient_phone || o.phone_number || "—";
                  const cap = `${o.capacity || ""}GB`;
                  const isCompleted = o.delivery_status === "completed";

                  return (
                    <tr key={o.id || o.reference} className="hover:bg-muted/30 transition-colors">
                      {/* Recipient Phone with Copy */}
                      <td className="p-3 font-mono font-bold text-foreground">
                        <div className="flex items-center gap-1.5">
                          <span>{pNum}</span>
                          <button
                            type="button"
                            onClick={() => copyText(pNum, `phone-${o.reference}`, "Phone")}
                            className="p-1 hover:text-amber-500 rounded text-muted-foreground"
                            title="Copy number"
                          >
                            {copiedKey === `phone-${o.reference}` ? (
                              <Check className="size-3 text-emerald-500" />
                            ) : (
                              <Copy className="size-3" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Bundle Capacity with Copy */}
                      <td className="p-3 font-mono font-bold text-amber-600 dark:text-amber-400">
                        <div className="flex items-center gap-1.5">
                          <span>{cap}</span>
                          <button
                            type="button"
                            onClick={() => copyText(cap, `cap-${o.reference}`, "Gig")}
                            className="p-1 hover:text-amber-500 rounded text-muted-foreground"
                            title="Copy gig"
                          >
                            {copiedKey === `cap-${o.reference}` ? (
                              <Check className="size-3 text-emerald-500" />
                            ) : (
                              <Copy className="size-3" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Amount */}
                      <td className="p-3 font-mono font-semibold">GH₵ {Number(o.amount || 0).toFixed(2)}</td>

                      {/* Status */}
                      <td className="p-3">
                        <Badge
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase ${isCompleted
                            ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                            : "bg-amber-500/20 text-amber-700 dark:text-amber-300 animate-pulse"
                            }`}
                        >
                          {o.delivery_status || "processing"}
                        </Badge>
                      </td>

                      {/* Reference */}
                      <td className="p-3 font-mono text-[11px] text-muted-foreground">{o.reference}</td>

                      {/* Date */}
                      <td className="p-3 text-[11px] text-muted-foreground whitespace-nowrap">
                        {new Date(o.created_at || Date.now()).toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>

                      {/* Actions */}
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => copyText(`${pNum} ${cap}`, `both-${o.reference}`, "Number + Gig")}
                            className="px-2 py-1 rounded-lg border border-border text-[11px] font-bold hover:bg-muted"
                            title="Copy Number + Gig"
                          >
                            Copy Both
                          </button>

                          {isCompleted ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleUpdateOrderStatus(o, "processing")}
                              className="h-7 px-2 text-[10px] rounded-lg"
                            >
                              Mark Processing
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => handleUpdateOrderStatus(o, "completed")}
                              className="h-7 px-2.5 text-[10px] rounded-lg font-bold bg-emerald-600 hover:bg-emerald-500 text-white"
                            >
                              <CheckCircle2 className="size-3 mr-1" />
                              Mark Delivered
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default AdminFlashSale;

