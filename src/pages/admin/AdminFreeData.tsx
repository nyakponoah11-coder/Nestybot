import { useEffect, useState, useMemo } from "react";
import { invokeApiFunction, supabase as typedSupabase } from "@/integrations/supabase/client";
import { getCacheMeta, setCache, invalidateCache } from "@/lib/localCache";
import { invalidateShopCache } from "@/lib/storeCache";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = typedSupabase as any;
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PhoneLink } from "@/components/PhoneLink";
import {
  Gift,
  Loader2,
  RefreshCw,
  Copy,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Send,
  Zap,
  Clock,
  Trash2,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

interface VoucherCode {
  id: string;
  code: string;
  capacity: string;
  network: string;
  expires_at: string | null;
  is_claimed: boolean;
  claimed_by_phone: string | null;
  claimed_at: string | null;
  delivery_status: string;
  datamart_ref: string | null;
  notes: string | null;
  created_at: string;
}

const CAPACITIES = ["1GB", "2GB", "3GB", "5GB", "10GB", "15GB", "20GB"];
const NETWORKS = ["MTN", "TELECEL", "AIRTELTIGO"];

const AdminFreeData = () => {
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [codes, setCodes] = useState<VoucherCode[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const [hasApiKey, setHasApiKey] = useState(true);
  const [tableExists, setTableExists] = useState(true);

  // Generator form state
  const [genCapacity, setGenCapacity] = useState("1GB");
  const [genNetwork, setGenNetwork] = useState("MTN");
  const [genCount, setGenCount] = useState("10");
  const [genExpiryHours, setGenExpiryHours] = useState("24");
  const [generating, setGenerating] = useState(false);
  const [recentGenerated, setRecentGenerated] = useState<VoucherCode[]>([]);

  // Direct purchase state
  const [directPhone, setDirectPhone] = useState("");
  const [directNetwork, setDirectNetwork] = useState("MTN");
  const [directCapacity, setDirectCapacity] = useState("1GB");
  const [directSending, setDirectSending] = useState(false);

  // Table selection & bulk actions - default to "claimed" if any claimed exist, else "all"
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filterTab, setFilterTab] = useState<"all" | "claimed" | "pending" | "delivered" | "unclaimed">("all");
  const [deliveringBulk, setDeliveringBulk] = useState(false);

  const normalizeCodeRow = (c: any): VoucherCode => {
    const isClaimed = !!(
      c.is_claimed ??
      c.claimed ??
      c.scratched ??
      (c.status === "claimed" || c.status === "used" || c.status === "processing" || !!c.claimed_by_phone || !!c.assigned_to)
    );
    const claimedPhone = c.claimed_by_phone || c.assigned_to || c.phone || c.customer_phone || c.prize_phone || null;
    let delivStatus = c.delivery_status || (c.status === "used" || c.datamart_ref || c.datamart_reference ? "delivered" : isClaimed ? "pending" : "pending");
    return {
      id: String(c.id || c.code),
      code: String(c.code || "").toUpperCase(),
      capacity: String(c.capacity || (c.prize ? `${c.prize}GB` : "1GB")),
      network: String(c.network || c.prize_network || "MTN").toUpperCase(),
      expires_at: c.expires_at || null,
      is_claimed: isClaimed,
      claimed_by_phone: claimedPhone,
      claimed_at: c.claimed_at || c.scratched_at || (isClaimed ? c.created_at : null),
      delivery_status: delivStatus,
      datamart_ref: c.datamart_ref || c.datamart_reference || null,
      notes: c.notes || null,
      created_at: c.created_at || new Date().toISOString(),
    };
  };

  const mergeCodeRows = (a: VoucherCode, b: VoucherCode): VoucherCode => {
    const isClaimed = Boolean(a.is_claimed || b.is_claimed);
    const claimedByPhone = a.claimed_by_phone || b.claimed_by_phone || null;
    const claimedAt = a.claimed_at || b.claimed_at || (isClaimed ? (a.created_at || b.created_at) : null);
    const delivStatus =
      a.delivery_status === "delivered" || b.delivery_status === "delivered"
        ? "delivered"
        : a.delivery_status === "failed" || b.delivery_status === "failed"
        ? "failed"
        : isClaimed
        ? (a.delivery_status || b.delivery_status || "pending")
        : "pending";

    return {
      ...b,
      ...a,
      is_claimed: isClaimed,
      claimed_by_phone: claimedByPhone,
      claimed_at: claimedAt,
      delivery_status: delivStatus,
      datamart_ref: a.datamart_ref || b.datamart_ref || null,
      notes: a.notes || b.notes || null,
    };
  };

  const loadData = async (force = false) => {
    if (force) {
      invalidateCache("admin_free_data_cache");
    } else {
      const cached = getCacheMeta<any>("admin_free_data_cache");
      if (cached.exists && cached.data) {
        setEnabled(!!cached.data.enabled);
        setCodes(cached.data.codes || []);
        setBalance(cached.data.balance ?? null);
        setHasApiKey(cached.data.hasApiKey !== false);
        setTableExists(cached.data.tableExists !== false);
        setLoading(false);
        if (!cached.isStale) return;
      }
    }

    setLoading(true);
    let loaded = false;
    try {
      const { data, error } = await invokeApiFunction("free-data", {
        body: { action: "getOverview" },
      });
      if (!error && data && Array.isArray(data.codes)) {
        setEnabled(!!data.enabled);
        setCodes(data.codes || []);
        setBalance(data.balance ?? null);
        setHasApiKey(data.hasApiKey !== false);
        setTableExists(data.tableExists !== false);
        setCache("admin_free_data_cache", {
          enabled: !!data.enabled,
          codes: data.codes || [],
          balance: data.balance ?? null,
          hasApiKey: data.hasApiKey !== false,
          tableExists: data.tableExists !== false,
        }, 60 * 1000);
        loaded = true;
      }
    } catch (err: any) {
      console.warn("API free-data getOverview note:", err);
    }

    if (!loaded) {
      try {
        const [codesRes, settingRes, scratchRes] = await Promise.all([
          supabase.from("free_data_codes").select("id, code, capacity, network, expires_at, is_claimed, claimed, scratched, status, claimed_by_phone, assigned_to, phone, customer_phone, prize_phone, created_at, delivery_status, datamart_ref, datamart_reference, notes").order("created_at", { ascending: false }).limit(500),
          supabase.from("settings").select("key, value").in("key", ["free_data_enabled", "free_data_codes_store", "datamart_api_key", "DATA_API_KEY"]),
          supabase.from("scratch_codes").select("id, code, capacity, prize, network, prize_network, scratched, phone, customer_phone, prize_phone, status, delivery_status, datamart_ref, datamart_reference, created_at").order("id", { ascending: false }).limit(300),
        ]);

        const sMap = Object.fromEntries((settingRes.data || []).map((s: any) => [s.key, s.value]));
        const isEn = sMap.free_data_enabled === "true";
        const hasKey = !!(sMap.datamart_api_key || sMap.DATA_API_KEY);
        setEnabled(isEn);
        setHasApiKey(hasKey);

        const codeMap = new Map<string, VoucherCode>();
        const addOrMerge = (c: any) => {
          if (!c?.code) return;
          const key = String(c.code).toUpperCase().trim();
          const row = normalizeCodeRow(c);
          const existing = codeMap.get(key);
          if (existing) {
            codeMap.set(key, mergeCodeRows(existing, row));
          } else {
            codeMap.set(key, row);
          }
        };

        if (scratchRes.data && Array.isArray(scratchRes.data)) {
          for (const s of scratchRes.data) addOrMerge(s);
        }

        if (sMap.free_data_codes_store) {
          try {
            const parsed = JSON.parse(sMap.free_data_codes_store);
            if (Array.isArray(parsed)) {
              for (const s of parsed) addOrMerge(s);
            }
          } catch (_) {}
        }

        if (codesRes.data && Array.isArray(codesRes.data)) {
          for (const c of codesRes.data) addOrMerge(c);
        }

        const merged = Array.from(codeMap.values()).sort(
          (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
        );

        setCodes(merged);
        const tblExists = merged.length > 0 || !codesRes.error;
        setTableExists(tblExists);
        setCache("admin_free_data_cache", {
          enabled: isEn,
          codes: merged,
          balance: null,
          hasApiKey: hasKey,
          tableExists: tblExists,
        }, 60 * 1000);
        loaded = true;
      } catch (err: any) {
        console.error("Direct fallback loadData error:", err);
      }
    }

    setLoading(false);
  };

  const copySetupSql = () => {
    const sql = `-- Run this in your Supabase SQL Editor:
CREATE TABLE IF NOT EXISTS public.free_data_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  capacity text NOT NULL DEFAULT '1GB',
  network text NOT NULL DEFAULT 'MTN',
  expires_at timestamptz,
  is_claimed boolean NOT NULL DEFAULT false,
  claimed_by_phone text,
  claimed_at timestamptz,
  delivery_status text NOT NULL DEFAULT 'pending',
  datamart_ref text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_free_data_codes_code ON public.free_data_codes(code);
CREATE INDEX IF NOT EXISTS idx_free_data_codes_status ON public.free_data_codes(is_claimed, delivery_status);

ALTER TABLE public.free_data_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can claim and view free data codes" ON public.free_data_codes;
CREATE POLICY "Public can claim and view free data codes" ON public.free_data_codes
  FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true);
`;
    navigator.clipboard.writeText(sql);
    toast.success("Setup SQL copied! Paste & Run in Supabase SQL Editor anytime.");
  };

  useEffect(() => {
    document.title = "Admin · Free Data & Direct DataMart";
    loadData();
  }, []);

  const handleToggleStorefront = async (newVal: boolean) => {
    setEnabled(newVal);
    let success = false;
    try {
      const { error } = await invokeApiFunction("free-data", {
        body: { action: "toggleStorefront", enabled: newVal },
      });
      if (!error) success = true;
    } catch (_) {}

    if (!success) {
      try {
        const { error: upsertErr } = await supabase
          .from("settings")
          .upsert({ key: "free_data_enabled", value: newVal ? "true" : "false" }, { onConflict: "key" });
        if (!upsertErr) success = true;
      } catch (_) {}
    }

    if (success) {
      invalidateCache("admin_free_data_cache");
      invalidateShopCache();
      window.dispatchEvent(new CustomEvent("shop-cache-invalidated"));
      // Bust server-side memory cache on services endpoint
      fetch("/api/services?fn=shop-data&refresh=true", { method: "GET" }).catch(() => {});
      toast.success(
        newVal
          ? "Free Data button is now ON and visible on the storefront!"
          : "Free Data button is now OFF and hidden from the storefront."
      );
    } else {
      setEnabled(!newVal);
      toast.error("Failed to update storefront status");
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenerating(true);
    let success = false;
    let generatedList: VoucherCode[] = [];

    try {
      const { data, error } = await invokeApiFunction("free-data", {
        body: {
          action: "generateCodes",
          capacity: genCapacity,
          network: genNetwork,
          count: parseInt(genCount, 10) || 10,
          expires_in_hours: parseInt(genExpiryHours, 10) || null,
        },
      });

      if (!error && !data?.error && data?.codes) {
        success = true;
        generatedList = data.codes;
        toast.success(`Successfully generated ${data.generatedCount || data.codes.length} free data voucher codes!`);
      }
    } catch (_) {}

    if (!success) {
      // Direct client generation fallback
      try {
        const count = Math.min(Math.max(parseInt(genCount, 10) || 10, 1), 100);
        const expiresInHours = parseInt(genExpiryHours, 10) || null;
        let expiresAt: string | null = null;
        if (expiresInHours && expiresInHours > 0) {
          expiresAt = new Date(Date.now() + expiresInHours * 3600 * 1000).toISOString();
        }

        const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        const newRows: any[] = [];
        for (let i = 0; i < count; i++) {
          let code = "FD";
          for (let j = 0; j < 8; j++) code += CODE_CHARS.charAt(Math.floor(Math.random() * CODE_CHARS.length));
          newRows.push({
            code,
            capacity: genCapacity,
            network: genNetwork,
            expires_at: expiresAt,
            is_claimed: false,
            delivery_status: "pending",
            created_at: new Date().toISOString(),
          });
        }

        // Try inserting to free_data_codes
        const { data: insData, error: insErr } = await supabase.from("free_data_codes").insert(newRows).select("*");
        if (!insErr && insData) {
          success = true;
          generatedList = insData as VoucherCode[];
          toast.success(`Successfully generated ${insData.length} voucher codes!`);
        } else {
          // If column is named claimed, try alt
          const altRows = newRows.map((r) => ({ ...r, claimed: false }));
          const { data: altData, error: altErr } = await supabase.from("free_data_codes").insert(altRows).select("*");
          if (!altErr && altData) {
            success = true;
            generatedList = altData as VoucherCode[];
            toast.success(`Successfully generated ${altData.length} voucher codes!`);
          } else {
            // Save to settings fallback
            const { data: sRow } = await supabase.from("settings").select("value").eq("key", "free_data_codes_store").maybeSingle();
            const existing = sRow?.value ? JSON.parse(sRow.value) : [];
            const combined = [...newRows, ...(Array.isArray(existing) ? existing : [])];
            await supabase.from("settings").upsert({ key: "free_data_codes_store", value: JSON.stringify(combined.slice(0, 1000)) }, { onConflict: "key" });
            success = true;
            generatedList = newRows as VoucherCode[];
            toast.success(`Successfully generated ${newRows.length} voucher codes!`);
          }
        }
      } catch (err: any) {
        toast.error(err.message || "Failed to generate codes");
      }
    }

    if (success) {
      setRecentGenerated(generatedList);
      invalidateCache("admin_free_data_cache");
      loadData(true);
    }
    setGenerating(false);
  };

  const copyRecentCodes = () => {
    if (!recentGenerated.length) return;
    const text = recentGenerated.map((c) => c.code).join("\n");
    navigator.clipboard.writeText(text);
    toast.success(`${recentGenerated.length} codes copied to clipboard!`);
  };

  // Direct purchase from DataMart
  const handleDirectPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!directPhone.trim()) {
      toast.error("Enter a recipient phone number");
      return;
    }

    setDirectSending(true);
    try {
      const { data, error } = await invokeApiFunction("free-data", {
        body: {
          action: "directPurchase",
          phoneNumber: directPhone.trim(),
          network: directNetwork,
          capacity: directCapacity,
        },
      });

      if (error || data?.error) {
        throw new Error(data?.error || error?.message || "DataMart dispatch failed");
      }

      toast.success(data.message || `Successfully sent ${directCapacity} ${directNetwork} to ${directPhone}!`);
      setDirectPhone("");
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Direct purchase failed on DataMart");
    } finally {
      setDirectSending(false);
    }
  };

  // Bulk deliver claimed codes via DataMart
  const handleBulkDeliver = async (targetIds?: string[]) => {
    const idsToSend = targetIds || Array.from(selectedIds);
    if (!idsToSend.length && filterTab !== "pending") {
      toast.error("Select at least one claimed voucher to deliver");
      return;
    }

    setDeliveringBulk(true);
    try {
      const { data, error } = await invokeApiFunction("free-data", {
        body: {
          action: "bulkDeliverDataMart",
          ids: idsToSend.length > 0 ? idsToSend : undefined,
        },
      });

      if (error || data?.error) {
        throw new Error(data?.error || error?.message || "Bulk dispatch failed");
      }

      toast.success(
        `Bulk delivery completed: ${data.delivered} delivered successfully, ${data.failed} failed.`
      );
      setSelectedIds(new Set());
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Bulk delivery failed");
    } finally {
      setDeliveringBulk(false);
    }
  };

  const handleDeleteCode = async (id: string, codeStr?: string) => {
    const codeObj = codes.find((c) => c.id === id || c.code === id);
    const codeName = codeStr || codeObj?.code || id;
    if (!confirm(`Are you sure you want to delete voucher code ${codeName}?`)) return;

    try {
      await invokeApiFunction("free-data", {
        body: { action: "deleteCode", id, code: codeName },
      });
    } catch (_) {}

    try {
      if (codeName) {
        await supabase.from("free_data_codes").delete().eq("code", codeName);
        await supabase.from("scratch_codes").delete().eq("code", codeName);
      }
      if (id && /^[0-9a-f-]{36}$/i.test(id)) {
        await supabase.from("free_data_codes").delete().eq("id", id);
      }
      if (id && /^\d+$/.test(id)) {
        await supabase.from("scratch_codes").delete().eq("id", Number(id));
      }
    } catch (_) {}

    invalidateCache("admin_free_data_cache");
    invalidateCache("admin_orders_cache");
    toast.success(`Voucher ${codeName} deleted`);
    setCodes((prev) => prev.filter((c) => c.id !== id && c.code !== codeName));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const handleDeleteBulk = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Are you sure you want to permanently delete the ${selectedIds.size} selected voucher(s)?`)) return;

    const idsToDelete = Array.from(selectedIds);
    const codesToDelete = codes.filter((c) => selectedIds.has(c.id)).map((c) => c.code);

    try {
      await invokeApiFunction("free-data", {
        body: { action: "deleteCodes", ids: idsToDelete, codes: codesToDelete },
      });
    } catch (_) {}

    for (const code of codesToDelete) {
      try {
        await supabase.from("free_data_codes").delete().eq("code", code);
        await supabase.from("scratch_codes").delete().eq("code", code);
      } catch (_) {}
    }

    invalidateCache("admin_free_data_cache");
    invalidateCache("admin_orders_cache");
    toast.success(`Successfully deleted ${selectedIds.size} voucher(s)`);
    setCodes((prev) => prev.filter((c) => !selectedIds.has(c.id) && !codesToDelete.includes(c.code)));
    setSelectedIds(new Set());
  };

  // Filtered table rows
  const filteredCodes = useMemo(() => {
    if (filterTab === "claimed") return codes.filter((c) => c.is_claimed || !!c.claimed_by_phone);
    if (filterTab === "pending") return codes.filter((c) => (c.is_claimed || !!c.claimed_by_phone) && c.delivery_status === "pending");
    if (filterTab === "delivered") return codes.filter((c) => c.delivery_status === "delivered");
    if (filterTab === "unclaimed") return codes.filter((c) => !c.is_claimed && !c.claimed_by_phone);
    return codes;
  }, [codes, filterTab]);

  const claimedCount = codes.filter((c) => c.is_claimed || !!c.claimed_by_phone).length;
  const pendingCount = codes.filter((c) => (c.is_claimed || !!c.claimed_by_phone) && c.delivery_status === "pending").length;
  const deliveredCount = codes.filter((c) => c.delivery_status === "delivered").length;
  const unclaimedCount = codes.filter((c) => !c.is_claimed && !c.claimed_by_phone).length;

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredCodes.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredCodes.map((c) => c.id)));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-6 max-w-6xl pb-16">
      {/* Top Header Banner */}
      <div className="rounded-2xl p-5 md:p-6 bg-gradient-to-r from-amber-500 via-rose-600 to-indigo-700 text-white shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Gift className="size-6 text-amber-200" />
            <h1 className="text-2xl md:text-3xl font-black">Free Data Vouchers & Direct DataMart</h1>
          </div>
          <p className="text-sm opacity-90">
            Generate promotional data codes, review claimed numbers, and deliver bundles in bulk directly via DataMart without Paystack.
          </p>
        </div>

        <div className="flex items-center gap-3 bg-black/25 backdrop-blur-md rounded-2xl p-3 border border-white/20 shrink-0">
          <div className="text-right">
            <div className="text-xs text-white/80 font-medium">DataMart Balance</div>
            <div className="text-lg font-black text-amber-300">
              {balance !== null ? `GHS ${balance.toFixed(2)}` : "Connected"}
            </div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => loadData(true)}
            disabled={loading}
            className="text-white hover:bg-white/20 size-9 p-0"
          >
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Database storage notice if table not yet run */}
      {!tableExists && (
        <Card className="p-4 border-amber-500/40 bg-amber-500/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-foreground">
            <span className="text-amber-400 font-bold">💡 Instant Storage Active:</span>
            <span className="text-xs sm:text-sm">Codes and claims are saved safely in your database settings! (Optional: Click "Copy SQL" to create the dedicated Supabase table anytime).</span>
          </div>
          <Button size="sm" variant="outline" onClick={copySetupSql} className="shrink-0 gap-1.5 border-amber-500/50 hover:bg-amber-500/20">
            <Copy className="size-3.5" /> Copy Supabase SQL
          </Button>
        </Card>
      )}

      {/* Storefront Button Toggle Card */}
      <Card className="p-4 md:p-6 bg-gradient-card border-2 border-accent/40 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Sparkles className="size-5 text-accent" />
            <h2 className="font-bold text-lg">Storefront "Free Data" Side Button</h2>
            <span
              className={`px-2.5 py-0.5 text-xs font-bold rounded-full ${
                enabled
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                  : "bg-muted text-muted-foreground border border-border"
              }`}
            >
              {enabled ? "● Button Visible on Storefront" : "○ Button Hidden"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {enabled
              ? "The floating 'Free Data' button is active on the middle side of the storefront. Customers can tap it to type their code and claim their bundle."
              : "The floating 'Free Data' button is currently turned off and hidden from customers."}
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0 bg-background/80 border border-accent/40 rounded-xl px-4 py-2.5">
          <Label htmlFor="free-data-toggle" className="text-xs font-bold cursor-pointer">
            {enabled ? "Status: ON" : "Status: OFF"}
          </Label>
          <Switch
            id="free-data-toggle"
            checked={enabled}
            onCheckedChange={handleToggleStorefront}
          />
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Section 1: Generate Voucher Codes */}
        <Card className="p-5 md:p-6 bg-gradient-card border border-border shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b pb-3">
            <Gift className="size-5 text-accent" />
            <div>
              <h2 className="font-bold text-base">Generate Free Data Voucher Codes</h2>
              <p className="text-xs text-muted-foreground">
                Create 10-digit codes to share with customers on WhatsApp, TikTok, etc.
              </p>
            </div>
          </div>

          <form onSubmit={handleGenerate} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Data Size</Label>
                <Select value={genCapacity} onValueChange={setGenCapacity}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select size" />
                  </SelectTrigger>
                  <SelectContent>
                    {CAPACITIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold">Network</Label>
                <Select value={genNetwork} onValueChange={setGenNetwork}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select network" />
                  </SelectTrigger>
                  <SelectContent>
                    {NETWORKS.map((n) => (
                      <SelectItem key={n} value={n}>
                        {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Quantity of Codes</Label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={genCount}
                  onChange={(e) => setGenCount(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Expiry Duration</Label>
                <Select value={genExpiryHours} onValueChange={setGenExpiryHours}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select expiry" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2">2 Hours</SelectItem>
                    <SelectItem value="6">6 Hours</SelectItem>
                    <SelectItem value="24">24 Hours (1 Day)</SelectItem>
                    <SelectItem value="48">48 Hours (2 Days)</SelectItem>
                    <SelectItem value="168">7 Days (1 Week)</SelectItem>
                    <SelectItem value="0">Never Expires</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              type="submit"
              disabled={generating}
              className="w-full bg-gradient-gold text-accent-foreground font-bold shadow-sm"
            >
              {generating ? <Loader2 className="size-4 animate-spin mr-2" /> : <Sparkles className="size-4 mr-2" />}
              Generate {genCount} Voucher Codes
            </Button>
          </form>

          {recentGenerated.length > 0 && (
            <div className="rounded-xl border border-accent/40 bg-accent/10 p-3.5 space-y-2 mt-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-accent">
                  Batch Generated ({recentGenerated.length} Codes):
                </span>
                <Button size="sm" variant="outline" onClick={copyRecentCodes} className="h-7 text-xs font-bold gap-1">
                  <Copy className="size-3" /> Copy All Codes
                </Button>
              </div>
              <div className="max-h-28 overflow-y-auto font-mono text-xs space-y-1 bg-background/80 p-2 rounded-lg border">
                {recentGenerated.map((c) => (
                  <div key={c.id} className="flex items-center justify-between text-foreground">
                    <span className="font-bold">{c.code}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {c.capacity} · {c.network}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* Section 2: Direct Purchase from DataMart (No Paystack) */}
        <Card className="p-5 md:p-6 bg-gradient-card border border-border shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b pb-3">
            <Zap className="size-5 text-emerald-400" />
            <div>
              <h2 className="font-bold text-base">Direct DataMart Top-Up (No Paystack)</h2>
              <p className="text-xs text-muted-foreground">
                Purchase and send data directly from your DataMart wallet balance without paying.
              </p>
            </div>
          </div>

          <form onSubmit={handleDirectPurchase} className="space-y-4">
            <div>
              <Label className="text-xs font-semibold">Recipient Phone Number</Label>
              <Input
                type="tel"
                value={directPhone}
                onChange={(e) => setDirectPhone(e.target.value)}
                placeholder="0541234567"
                className="mt-1 font-bold text-base"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Network</Label>
                <Select value={directNetwork} onValueChange={setDirectNetwork}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Network" />
                  </SelectTrigger>
                  <SelectContent>
                    {NETWORKS.map((n) => (
                      <SelectItem key={n} value={n}>
                        {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold">Capacity</Label>
                <Select value={directCapacity} onValueChange={setDirectCapacity}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Capacity" />
                  </SelectTrigger>
                  <SelectContent>
                    {CAPACITIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              type="submit"
              disabled={directSending || !directPhone.trim()}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-sm"
            >
              {directSending ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-2" /> Sending Bundle…
                </>
              ) : (
                <>
                  <Send className="size-4 mr-2" /> Send Data Directly via DataMart
                </>
              )}
            </Button>
            <p className="text-[11px] text-muted-foreground text-center">
              Deducts directly from your DataMart developer API balance. Paystack is completely bypassed.
            </p>
          </form>
        </Card>
      </div>

      {/* KPI Stats Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          type="button"
          onClick={() => setFilterTab("all")}
          className={`p-3.5 rounded-xl border text-left transition-all ${
            filterTab === "all" ? "bg-accent/15 border-accent shadow-sm" : "bg-card border-border hover:bg-muted/30"
          }`}
        >
          <div className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">Total Vouchers</div>
          <div className="text-xl font-black mt-1 text-foreground">{codes.length}</div>
        </button>

        <button
          type="button"
          onClick={() => setFilterTab("claimed")}
          className={`p-3.5 rounded-xl border text-left transition-all ${
            filterTab === "claimed" ? "bg-amber-500/15 border-amber-500 shadow-sm" : "bg-card border-border hover:bg-muted/30"
          }`}
        >
          <div className="text-[11px] text-amber-500 font-semibold uppercase tracking-wider flex items-center justify-between">
            <span>Claimed Codes</span>
            {claimedCount > 0 && <span className="size-2 rounded-full bg-amber-500 animate-ping" />}
          </div>
          <div className="text-xl font-black mt-1 text-amber-500">{claimedCount}</div>
        </button>

        <button
          type="button"
          onClick={() => setFilterTab("pending")}
          className={`p-3.5 rounded-xl border text-left transition-all ${
            filterTab === "pending" ? "bg-rose-500/15 border-rose-500 shadow-sm" : "bg-card border-border hover:bg-muted/30"
          }`}
        >
          <div className="text-[11px] text-rose-500 font-semibold uppercase tracking-wider">Pending Delivery</div>
          <div className="text-xl font-black mt-1 text-rose-500">{pendingCount}</div>
        </button>

        <button
          type="button"
          onClick={() => setFilterTab("delivered")}
          className={`p-3.5 rounded-xl border text-left transition-all ${
            filterTab === "delivered" ? "bg-emerald-500/15 border-emerald-500 shadow-sm" : "bg-card border-border hover:bg-muted/30"
          }`}
        >
          <div className="text-[11px] text-emerald-500 font-semibold uppercase tracking-wider">Delivered</div>
          <div className="text-xl font-black mt-1 text-emerald-500">{deliveredCount}</div>
        </button>
      </div>

      {/* Section 3: Claimed Codes & Delivery Queue */}
      <Card className="overflow-hidden border border-border shadow-sm">
        <div className="p-4 md:p-5 border-b flex flex-col md:flex-row md:items-center justify-between gap-3 bg-muted/30">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-lg">Claimed Free Data Queue</h2>
              {pendingCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40 text-xs font-bold animate-pulse">
                  {pendingCount} Pending Delivery
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Review all customer-claimed numbers. Verify the list and dispatch them in bulk via DataMart.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {pendingCount > 0 && (
              <Button
                onClick={() => handleBulkDeliver()}
                disabled={deliveringBulk}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-glow"
              >
                {deliveringBulk ? (
                  <Loader2 className="size-3.5 animate-spin mr-1.5" />
                ) : (
                  <Zap className="size-3.5 mr-1.5" />
                )}
                ⚡ Deliver All Pending via DataMart ({pendingCount})
              </Button>
            )}

            {selectedIds.size > 0 && (
              <Button
                size="sm"
                variant="destructive"
                onClick={handleDeleteBulk}
                className="text-xs font-bold h-8 shadow-sm"
              >
                <Trash2 className="size-3.5 mr-1.5" /> Delete Selected ({selectedIds.size})
              </Button>
            )}

            <Button size="sm" variant="outline" onClick={() => loadData(true)} disabled={loading}>
              <RefreshCw className={`size-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} /> Refresh
            </Button>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="px-4 py-2.5 border-b bg-muted/10 flex items-center gap-2 text-xs overflow-x-auto">
          {[
            { key: "all", label: `All Codes (${codes.length})` },
            {
              key: "claimed",
              label: `Claimed Codes (${claimedCount})`,
              badge: claimedCount > 0 ? "bg-amber-500/20 text-amber-500 border border-amber-500/30" : "",
            },
            { key: "pending", label: `Pending Delivery (${pendingCount})` },
            { key: "delivered", label: `Delivered (${deliveredCount})` },
            { key: "unclaimed", label: `Unclaimed (${unclaimedCount})` },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilterTab(tab.key as any)}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                filterTab === tab.key
                  ? "bg-accent text-accent-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
              }`}
            >
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Table */}
        {loading ? (
          <div className="py-16 grid place-items-center">
            <Loader2 className="size-6 animate-spin text-accent" />
          </div>
        ) : filteredCodes.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground text-sm">
            No voucher codes found in this filter tab.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr className="text-left border-b">
                  <th className="p-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === filteredCodes.length && filteredCodes.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded"
                    />
                  </th>
                  <th className="p-3">Voucher Code</th>
                  <th className="p-3">Package</th>
                  <th className="p-3">Claimed Phone</th>
                  <th className="p-3">Claim Date</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">DataMart Ref</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredCodes.map((code) => {
                  const isSelected = selectedIds.has(code.id);
                  return (
                    <tr
                      key={code.id}
                      className={`border-b hover:bg-muted/20 transition-colors ${
                        isSelected ? "bg-accent/10" : ""
                      }`}
                    >
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectOne(code.id)}
                          className="rounded"
                        />
                      </td>
                      <td className="p-3 font-mono font-bold text-accent">{code.code}</td>
                      <td className="p-3 font-semibold">
                        {code.capacity} {code.network}
                      </td>
                      <td className="p-3">
                        {code.claimed_by_phone ? (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <PhoneLink value={code.claimed_by_phone} />
                            <a
                              href={`https://wa.me/233${code.claimed_by_phone.replace(/\D/g, "").replace(/^0/, "")}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[10px] text-emerald-500 hover:text-emerald-400 px-1.5 py-0.5 rounded bg-emerald-500/10 font-bold border border-emerald-500/20"
                              title="Chat on WhatsApp"
                            >
                              WA
                            </a>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground/60 italic">Not claimed yet</span>
                        )}
                      </td>
                      <td className="p-3 text-xs text-muted-foreground">
                        {code.claimed_at ? new Date(code.claimed_at).toLocaleString() : "—"}
                      </td>
                      <td className="p-3">
                        {code.delivery_status === "delivered" ? (
                          <Badge className="bg-emerald-600 font-bold">Delivered</Badge>
                        ) : code.delivery_status === "failed" ? (
                          <Badge variant="destructive">Failed</Badge>
                        ) : code.is_claimed ? (
                          <Badge className="bg-amber-600 font-bold animate-pulse">Pending Delivery</Badge>
                        ) : (
                          <Badge variant="secondary">Ready / Unclaimed</Badge>
                        )}
                      </td>
                      <td className="p-3 font-mono text-xs text-muted-foreground">
                        {code.datamart_ref || "—"}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {code.is_claimed && code.delivery_status === "pending" && (
                            <Button
                              size="sm"
                              onClick={() => handleBulkDeliver([code.id])}
                              disabled={deliveringBulk}
                              className="h-8 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
                            >
                              Deliver
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteCode(code.id, code.code)}
                            className="size-8 p-0 text-muted-foreground hover:text-destructive"
                            title={`Delete voucher ${code.code}`}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};

export default AdminFreeData;
