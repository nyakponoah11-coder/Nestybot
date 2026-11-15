import { useEffect, useMemo, useState } from "react";
import { supabase, invokeApiFunction } from "@/integrations/supabase/client";
import { getCacheMeta, setCache, invalidateCache } from "@/lib/localCache";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Users,
  Gift,
  Sparkles,
  ChevronDown,
  ChevronRight,
  Store,
  CheckCircle2,
  Clock,
  MessageSquare,
  Copy,
  Check,
  RefreshCw,
  ExternalLink,
  Search,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneLink } from "@/components/PhoneLink";

interface Referral {
  id: string;
  code: string;
  owner_phone: string;
  redemptions_count: number;
  reward_sent: boolean;
  reward_sent_at: string | null;
  created_at: string;
}

interface Redemption {
  id: string;
  referral_id: string;
  friend_phone: string;
  order_reference: string;
  created_at: string;
}

interface AgentPromoter {
  id: string;
  agent_id: string;
  agent_name: string;
  agent_slug: string;
  customer_phone: string;
  referral_code: string;
  referred_buyers: Array<{
    buyer_phone: string;
    order_reference: string;
    amount: number;
    created_at: string;
  }>;
  total_qualified_orders: number;
  reward_claimed: boolean;
  reward_status: "in_progress" | "pending_fulfillment" | "fulfilled";
  reward_sent?: boolean;
  reward_sent_at?: string | null;
  notified_admin: boolean;
  created_at: string;
  updated_at: string;
}

const AdminReferrals = () => {
  const [activeTab, setActiveTab] = useState<"agents" | "main">("agents");

  // Main shop referrals
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [promoEnabled, setPromoEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  // Agent Promoters State
  const [agentPromoters, setAgentPromoters] = useState<AgentPromoter[]>([]);
  const [agentLoading, setAgentLoading] = useState(true);
  const [agentStats, setAgentStats] = useState({
    total_promoters: 0,
    total_completed: 0,
    pending_manual: 0,
    fulfilled: 0,
    total_referred_orders: 0,
  });
  const [agentFilter, setAgentFilter] = useState<"all" | "completed" | "pending" | "fulfilled">("all");
  const [agentSearch, setAgentSearch] = useState("");
  const [openAgentId, setOpenAgentId] = useState<string | null>(null);
  const [fulfillingPhone, setFulfillingPhone] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success(`Copied ${text}`);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const loadMainReferrals = async (force = false) => {
    if (!force) {
      const cached = getCacheMeta<any>("admin_referrals_cache");
      if (cached.exists && cached.data) {
        if (cached.data.referrals) setReferrals(cached.data.referrals);
        if (cached.data.redemptions) setRedemptions(cached.data.redemptions);
        if (cached.data.promoEnabled !== undefined) setPromoEnabled(cached.data.promoEnabled);
        setLoading(false);
        if (!cached.isStale) return;
      }
    }

    let loaded = false;
    let freshRefs: Referral[] = [];
    let freshReds: Redemption[] = [];
    let curPromo = promoEnabled;

    try {
      const { data, error } = await invokeApiFunction("admin-services", { body: { action: "overview" } });
      if (!error && data && (data.referrals || data.promo_enabled !== undefined)) {
        freshRefs = data?.referrals || [];
        freshReds = data?.redemptions || [];
        curPromo = !!data?.promo_enabled;
        setReferrals(freshRefs);
        setRedemptions(freshReds);
        setPromoEnabled(curPromo);
        setCache("admin_referrals_cache", { referrals: freshRefs, redemptions: freshReds, promoEnabled: curPromo }, 60 * 1000);
        loaded = true;
      }
    } catch (_) {}

    if (!loaded) {
      try {
        const [refRes, redRes, setRes] = await Promise.all([
          supabase.from("referrals").select("id, code, owner_phone, redemptions_count, reward_sent, reward_sent_at, created_at").order("created_at", { ascending: false }).limit(100),
          supabase.from("referral_redemptions").select("id, referral_id, referral_code, user_phone, created_at").order("created_at", { ascending: false }).limit(100),
          supabase.from("settings").select("key, value").eq("key", "promo_enabled").maybeSingle(),
        ]);
        if (refRes.data) { freshRefs = refRes.data as unknown as Referral[]; setReferrals(freshRefs); }
        if (redRes.data) { freshReds = redRes.data as unknown as Redemption[]; setRedemptions(freshReds); }
        if (setRes.data) { curPromo = setRes.data.value !== "false"; setPromoEnabled(curPromo); }
        setCache("admin_referrals_cache", { referrals: freshRefs, redemptions: freshReds, promoEnabled: curPromo }, 60 * 1000);
      } catch (_) {}
    }
    setLoading(false);
  };

  const loadAgentPromoters = async () => {
    setAgentLoading(true);
    try {
      const res = await invokeApiFunction("agent", {
        body: { action: "adminGetAgentCustomerReferrals" },
      });
      if (res?.data?.ok) {
        setAgentPromoters(res.data.promoters || []);
        if (res.data.stats) setAgentStats(res.data.stats);
      }
    } catch (err: any) {
      console.error("Failed loading agent referrals:", err);
      toast.error("Failed loading agent storefront customer referrals");
    } finally {
      setAgentLoading(false);
    }
  };

  useEffect(() => {
    loadAgentPromoters();
    loadMainReferrals();
  }, []);

  const togglePromo = async (enabled: boolean) => {
    setSaving(true);
    setPromoEnabled(enabled);
    let success = false;
    try {
      const { data, error } = await invokeApiFunction("admin-services", {
        body: { action: "togglePromo", enabled },
      });
      if (!error && !data?.error) success = true;
    } catch (_) {}

    if (!success) {
      try {
        const { error } = await supabase.from("settings").upsert(
          { key: "promo_enabled", value: enabled ? "true" : "false" },
          { onConflict: "key" }
        );
        if (!error) success = true;
      } catch (_) {}
    }

    setSaving(false);
    if (!success) {
      toast.error("Failed to update promo");
      setPromoEnabled(!enabled);
    } else {
      toast.success(enabled ? "Promo turned ON" : "Promo turned OFF");
    }
  };

  const handleFulfillReward = async (promoter: AgentPromoter, markAsFulfilled: boolean) => {
    setFulfillingPhone(promoter.customer_phone);
    try {
      const res = await invokeApiFunction("agent", {
        body: {
          action: "adminFulfillAgentReferral",
          agent_id: promoter.agent_id,
          customer_phone: promoter.customer_phone,
          fulfilled: markAsFulfilled,
        },
      });
      if (res?.data?.ok) {
        toast.success(
          markAsFulfilled
            ? `Marked 5GB reward for ${promoter.customer_phone} as Fulfilled!`
            : `Reverted reward status for ${promoter.customer_phone} to Pending`
        );
        await loadAgentPromoters();
      } else {
        toast.error(res?.error?.message || res?.data?.error || "Failed to update reward status");
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to update reward status");
    } finally {
      setFulfillingPhone(null);
    }
  };

  const friendsByReferral = useMemo(() => {
    const map: Record<string, Redemption[]> = {};
    for (const r of redemptions) {
      (map[r.referral_id] ||= []).push(r);
    }
    return map;
  }, [redemptions]);

  // Filter agent promoters
  const filteredAgentPromoters = useMemo(() => {
    return agentPromoters.filter((p) => {
      const isCompleted = (p.total_qualified_orders || 0) >= 5;
      const isFulfilled = p.reward_sent || p.reward_status === "fulfilled";
      const isPending = isCompleted && !isFulfilled;

      if (agentFilter === "completed" && !isCompleted) return false;
      if (agentFilter === "pending" && !isPending) return false;
      if (agentFilter === "fulfilled" && !isFulfilled) return false;

      if (agentSearch.trim()) {
        const q = agentSearch.trim().toLowerCase();
        const phone = (p.customer_phone || "").toLowerCase();
        const store = (p.agent_name || "").toLowerCase();
        const slug = (p.agent_slug || "").toLowerCase();
        const code = (p.referral_code || "").toLowerCase();
        return phone.includes(q) || store.includes(q) || slug.includes(q) || code.includes(q);
      }

      return true;
    });
  }, [agentPromoters, agentFilter, agentSearch]);

  const pendingRewardPromoters = useMemo(() => {
    return agentPromoters.filter(
      (p) => (p.total_qualified_orders || 0) >= 5 && !p.reward_sent && p.reward_status !== "fulfilled"
    );
  }, [agentPromoters]);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-3xl p-6 bg-gradient-to-r from-amber-500 via-orange-600 to-rose-700 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none text-9xl">🎁</div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/20 text-xs font-bold uppercase tracking-wider backdrop-blur-md">
              <Gift className="size-3.5 text-amber-300" />
              Referrals &amp; 5GB Rewards Hub
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight">Referral &amp; 5GB Promo Center</h1>
            <p className="text-sm opacity-90 max-w-xl">
              Track customer promoters across Agent storefronts and the main shop. When customers refer 5 friends, dispatch their 5GB data reward manually.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={() => {
                loadAgentPromoters();
                loadMainReferrals(true);
              }}
              variant="outline"
              size="sm"
              className="bg-white/10 hover:bg-white/20 text-white border-white/25 rounded-xl font-bold backdrop-blur-md"
            >
              <RefreshCw className="size-4 mr-1.5" /> Refresh Live Data
            </Button>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex gap-2 mt-5 pt-4 border-t border-white/20">
          <button
            onClick={() => setActiveTab("agents")}
            className={`px-4 py-2 rounded-xl text-xs md:text-sm font-black transition-all flex items-center gap-2 ${
              activeTab === "agents"
                ? "bg-white text-slate-950 shadow-lg scale-105"
                : "bg-white/15 text-white hover:bg-white/25"
            }`}
          >
            <Store className="size-4" />
            Agent Customer Promoters (5GB Rewards)
            {agentStats.pending_manual > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-black animate-pulse">
                {agentStats.pending_manual} ACTION REQUIRED
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("main")}
            className={`px-4 py-2 rounded-xl text-xs md:text-sm font-black transition-all flex items-center gap-2 ${
              activeTab === "main"
                ? "bg-white text-slate-950 shadow-lg scale-105"
                : "bg-white/15 text-white hover:bg-white/25"
            }`}
          >
            <Sparkles className="size-4" />
            Main Shop Referral Promo
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: AGENT CUSTOMER PROMOTERS (5GB REWARDS) */}
      {/* ========================================================================= */}
      {activeTab === "agents" && (
        <div className="space-y-6">
          {/* Action Required Banner if someone reached 5 referrals! */}
          {pendingRewardPromoters.length > 0 && (
            <div className="p-5 rounded-2xl border-2 border-amber-500 bg-gradient-to-r from-amber-950/80 via-slate-900 to-orange-950/70 shadow-2xl space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 text-amber-300 font-black text-sm uppercase tracking-wider">
                  <span className="size-3 rounded-full bg-amber-400 animate-ping" />
                  <AlertTriangle className="size-5 text-amber-400" />
                  Action Required: {pendingRewardPromoters.length} Customer{pendingRewardPromoters.length > 1 ? "s" : ""} Reached 5 Referrals!
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  Manual 5GB Dispatch Needed
                </span>
              </div>
              <p className="text-xs md:text-sm text-foreground/90">
                These promoters successfully referred 5 paying friends to their agent's storefront. Per your configuration, rewards are <strong>NOT dispatched automatically</strong>. Please send 5GB data to them manually, then click "Mark 5GB Sent".
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                {pendingRewardPromoters.map((p) => (
                  <div
                    key={p.id}
                    className="p-4 rounded-xl border border-amber-500/40 bg-slate-950/90 text-left space-y-3"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="text-base font-black text-white flex items-center gap-2">
                          <span>{p.customer_phone}</span>
                          <button
                            onClick={() => handleCopy(p.customer_phone, p.id)}
                            className="p-1 hover:bg-slate-800 rounded text-muted-foreground hover:text-white"
                            title="Copy Phone"
                          >
                            {copiedKey === p.id ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
                          </button>
                        </div>
                        <div className="text-xs text-amber-400 font-bold flex items-center gap-1.5 mt-0.5">
                          <Store className="size-3.5" />
                          Store: {p.agent_name || "Agent Store"} {p.agent_slug ? `(@${p.agent_slug})` : ""}
                        </div>
                      </div>
                      <Badge className="bg-emerald-600 text-white font-black text-xs">
                        5 / 5 Complete
                      </Badge>
                    </div>

                    <div className="text-xs text-muted-foreground">
                      Promoter reached 5 orders on <strong>{p.agent_name}</strong>. Ready for manual 5GB data send.
                    </div>

                    <div className="flex items-center gap-2 pt-1 flex-wrap">
                      <Button
                        size="sm"
                        disabled={fulfillingPhone === p.customer_phone}
                        onClick={() => handleFulfillReward(p, true)}
                        className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs rounded-xl shadow-md"
                      >
                        {fulfillingPhone === p.customer_phone ? (
                          <Loader2 className="size-3.5 animate-spin mr-1.5" />
                        ) : (
                          <CheckCircle2 className="size-3.5 mr-1.5" />
                        )}
                        Mark 5GB Sent
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        asChild
                        className="border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/20 text-xs font-bold rounded-xl"
                      >
                        <a
                          href={`https://wa.me/233${p.customer_phone.replace(/^0/, "")}?text=${encodeURIComponent(
                            `Hello! Congratulations from ${p.agent_name || "Data1"}! You have successfully referred 5 friends to our store! Your 5GB Free Data reward has been manually processed. Thank you for promoting with us!`
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <MessageSquare className="size-3.5 mr-1.5" />
                          Chat WhatsApp
                        </a>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Metric Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat
              cls="from-blue-600 to-indigo-800"
              icon={<Users className="size-5" />}
              label="Registered Promoters"
              value={agentStats.total_promoters}
            />
            <Stat
              cls="from-amber-500 to-orange-700"
              icon={<Gift className="size-5" />}
              label="5GB Rewards Ready (5/5)"
              value={agentStats.total_completed}
            />
            <Stat
              cls={agentStats.pending_manual > 0 ? "from-rose-600 to-red-800" : "from-slate-700 to-slate-900"}
              icon={<Clock className="size-5" />}
              label="Pending Manual Dispatch"
              value={agentStats.pending_manual}
            />
            <Stat
              cls="from-emerald-600 to-teal-800"
              icon={<CheckCircle2 className="size-5" />}
              label="5GB Rewards Fulfilled"
              value={agentStats.fulfilled}
            />
          </div>

          {/* Search & Filter Bar */}
          <Card className="p-4 bg-slate-900/80 border-slate-800 flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="relative w-full md:w-80">
              <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search promoter phone or store..."
                value={agentSearch}
                onChange={(e) => setAgentSearch(e.target.value)}
                className="pl-9 bg-slate-950 border-slate-800 text-sm rounded-xl"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto">
              {(["all", "completed", "pending", "fulfilled"] as const).map((filterKey) => (
                <button
                  key={filterKey}
                  onClick={() => setAgentFilter(filterKey)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition-all ${
                    agentFilter === filterKey
                      ? "bg-amber-500 text-slate-950 shadow-md font-black"
                      : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  {filterKey === "all"
                    ? `All Promoters (${agentPromoters.length})`
                    : filterKey === "completed"
                    ? `Completed 5/5 (${agentStats.total_completed})`
                    : filterKey === "pending"
                    ? `Pending Manual (${agentStats.pending_manual})`
                    : `Fulfilled (${agentStats.fulfilled})`}
                </button>
              ))}
            </div>
          </Card>

          {/* Promoters Table */}
          {agentLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="size-8 animate-spin text-amber-400" />
            </div>
          ) : filteredAgentPromoters.length === 0 ? (
            <Card className="p-12 text-center text-muted-foreground border-slate-800 bg-slate-900/60 rounded-3xl">
              <Gift className="size-12 mx-auto text-muted-foreground/40 mb-3" />
              <h3 className="text-base font-bold text-foreground">No customer promoters match your filter</h3>
              <p className="text-xs text-muted-foreground mt-1">
                When customers on an agent's store click "Refer 5 Friends &amp; Get 5GB Free Data", they will appear here.
              </p>
            </Card>
          ) : (
            <Card className="overflow-x-auto border-slate-800 bg-slate-900/80 rounded-2xl shadow-xl">
              <table className="w-full text-sm">
                <thead className="bg-slate-950/80 border-b border-slate-800 text-muted-foreground text-xs uppercase tracking-wider">
                  <tr className="text-left">
                    <th className="p-3.5 w-10"></th>
                    <th className="p-3.5">Customer Promoter</th>
                    <th className="p-3.5">Agent Store</th>
                    <th className="p-3.5">Referred Orders</th>
                    <th className="p-3.5">Progress</th>
                    <th className="p-3.5">5GB Reward Status</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredAgentPromoters.map((p) => {
                    const isCompleted = (p.total_qualified_orders || 0) >= 5;
                    const isFulfilled = p.reward_sent || p.reward_status === "fulfilled";
                    const isPending = isCompleted && !isFulfilled;
                    const open = openAgentId === p.id;
                    const buyers = Array.isArray(p.referred_buyers) ? p.referred_buyers : [];

                    return (
                      <>
                        <tr
                          key={p.id}
                          className={`hover:bg-slate-800/40 transition-colors cursor-pointer ${
                            isPending ? "bg-amber-500/5 font-medium" : ""
                          }`}
                          onClick={() => setOpenAgentId(open ? null : p.id)}
                        >
                          <td className="p-3.5 text-muted-foreground">
                            {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                          </td>

                          {/* Promoter Phone */}
                          <td className="p-3.5">
                            <div className="font-bold text-foreground flex items-center gap-1.5">
                              <span>{p.customer_phone}</span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCopy(p.customer_phone, p.id);
                                }}
                                className="p-1 hover:bg-slate-800 rounded text-muted-foreground hover:text-white"
                                title="Copy Phone"
                              >
                                {copiedKey === p.id ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
                              </button>
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              Registered: {new Date(p.created_at).toLocaleDateString()}
                            </div>
                          </td>

                          {/* Agent Store */}
                          <td className="p-3.5">
                            <div className="font-bold text-amber-300 flex items-center gap-1.5">
                              <Store className="size-3.5 text-amber-400" />
                              <span>{p.agent_name || "Agent Store"}</span>
                            </div>
                            {p.agent_slug && (
                              <div className="text-[11px] text-muted-foreground font-mono">
                                @{p.agent_slug}
                              </div>
                            )}
                          </td>

                          {/* Referred Orders Count */}
                          <td className="p-3.5 font-bold">
                            <span className="text-base font-black text-foreground">
                              {p.total_qualified_orders || 0}
                            </span>
                            <span className="text-xs text-muted-foreground"> / 5</span>
                          </td>

                          {/* Visual Progress Bar */}
                          <td className="p-3.5">
                            <div className="w-28 h-2 rounded-full bg-slate-800 overflow-hidden">
                              <div
                                className={`h-full ${
                                  isCompleted
                                    ? "bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                                    : "bg-gradient-to-r from-amber-500 to-orange-400"
                                }`}
                                style={{ width: `${Math.min(100, ((p.total_qualified_orders || 0) / 5) * 100)}%` }}
                              />
                            </div>
                            <div className="text-[10px] text-muted-foreground mt-1">
                              {isCompleted ? "Goal Reached!" : `${5 - (p.total_qualified_orders || 0)} more friend order needed`}
                            </div>
                          </td>

                          {/* Reward Status */}
                          <td className="p-3.5">
                            {isFulfilled ? (
                              <Badge className="bg-emerald-600/90 text-white border border-emerald-400 text-xs font-bold gap-1">
                                <CheckCircle2 className="size-3" />
                                5GB Sent {p.reward_sent_at ? `(${new Date(p.reward_sent_at).toLocaleDateString()})` : ""}
                              </Badge>
                            ) : isPending ? (
                              <Badge className="bg-amber-500 text-slate-950 font-black text-xs border border-amber-300 animate-pulse gap-1">
                                <Clock className="size-3" />
                                Pending Manual 5GB
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-muted-foreground border-slate-700 text-xs">
                                In Progress ({p.total_qualified_orders || 0}/5)
                              </Badge>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="p-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1.5 flex-wrap">
                              {isCompleted && (
                                <Button
                                  size="sm"
                                  disabled={fulfillingPhone === p.customer_phone}
                                  onClick={() => handleFulfillReward(p, !isFulfilled)}
                                  className={`text-xs font-bold rounded-xl h-8 ${
                                    isFulfilled
                                      ? "bg-slate-800 hover:bg-slate-700 text-slate-300"
                                      : "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black shadow-md"
                                  }`}
                                >
                                  {fulfillingPhone === p.customer_phone ? (
                                    <Loader2 className="size-3 animate-spin mr-1" />
                                  ) : isFulfilled ? (
                                    "Undo Sent"
                                  ) : (
                                    <>
                                      <CheckCircle2 className="size-3 mr-1" />
                                      Mark 5GB Sent
                                    </>
                                  )}
                                </Button>
                              )}

                              <Button
                                size="sm"
                                variant="outline"
                                asChild
                                className="border-slate-700 text-emerald-400 hover:bg-emerald-500/10 text-xs h-8 rounded-xl"
                              >
                                <a
                                  href={`https://wa.me/233${p.customer_phone.replace(/^0/, "")}?text=${encodeURIComponent(
                                    isCompleted
                                      ? `Hello! Congratulations from ${p.agent_name || "Data1"}! You completed 5 referrals! Your 5GB reward is processed. Thank you!`
                                      : `Hello from ${p.agent_name || "Data1"}! Keep sharing your link to reach 5 referrals and claim your 5GB free data!`
                                  )}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title="WhatsApp Customer"
                                >
                                  <MessageSquare className="size-3.5" />
                                </a>
                              </Button>
                            </div>
                          </td>
                        </tr>

                        {/* Expanded Friend Orders Breakdown */}
                        {open && (
                          <tr className="bg-slate-950/60 border-t border-slate-800/80">
                            <td colSpan={7} className="p-5">
                              <div className="space-y-3">
                                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                                  <span className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                    <Users className="size-3.5 text-amber-400" />
                                    Friends Referred by {p.customer_phone} on {p.agent_name} ({buyers.length} total)
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    Referral Code: <strong className="font-mono text-white">{p.referral_code}</strong>
                                  </span>
                                </div>

                                {buyers.length === 0 ? (
                                  <div className="text-xs text-muted-foreground py-2">
                                    No friends have placed a completed order through this promoter's link yet.
                                  </div>
                                ) : (
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                                    {buyers.map((b, idx) => (
                                      <div
                                        key={idx}
                                        className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs"
                                      >
                                        <div className="space-y-0.5">
                                          <div className="font-bold text-white flex items-center gap-1">
                                            <span>#{idx + 1}</span>
                                            <span>{b.buyer_phone}</span>
                                          </div>
                                          <div className="text-[10px] text-muted-foreground font-mono">
                                            {b.order_reference}
                                          </div>
                                        </div>
                                        <div className="text-right">
                                          <div className="font-bold text-emerald-400">
                                            GH₵ {Number(b.amount || 0).toFixed(2)}
                                          </div>
                                          <div className="text-[10px] text-muted-foreground">
                                            {b.created_at ? new Date(b.created_at).toLocaleDateString() : "Confirmed"}
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: MAIN SHOP REFERRAL PROMO */}
      {/* ========================================================================= */}
      {activeTab === "main" && (
        <div className="space-y-6">
          <Card className="p-5 flex items-center justify-between gap-3 border-2 border-accent/30 bg-gradient-card">
            <div>
              <div className="font-bold">Main Shop Promo Status</div>
              <div className="text-sm text-muted-foreground">
                Turn the "Invite friends, win 5GB" banner on or off across the main shop.
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant={promoEnabled ? "default" : "secondary"} className={promoEnabled ? "bg-emerald-600" : ""}>
                {promoEnabled ? "ON" : "OFF"}
              </Badge>
              <Switch checked={promoEnabled} onCheckedChange={togglePromo} disabled={saving} />
            </div>
          </Card>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Stat
              cls="from-fuchsia-500 to-purple-700"
              icon={<Users className="size-5" />}
              label="Numbers registered"
              value={referrals.length}
            />
            <Stat
              cls="from-amber-500 to-orange-600"
              icon={<Users className="size-5" />}
              label="Friends referred"
              value={redemptions.length}
            />
            <Stat
              cls="from-emerald-500 to-emerald-800"
              icon={<Gift className="size-5" />}
              label="Rewards sent"
              value={referrals.filter((r) => r.reward_sent).length}
            />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-14">
              <Loader2 className="size-6 animate-spin" />
            </div>
          ) : referrals.length === 0 ? (
            <Card className="p-10 text-center text-muted-foreground">No one has joined the promo yet.</Card>
          ) : (
            <Card className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr className="text-left">
                    <th className="p-3"></th>
                    <th className="p-3">Owner phone</th>
                    <th className="p-3">Code</th>
                    <th className="p-3">Friends</th>
                    <th className="p-3">Progress</th>
                    <th className="p-3">Reward</th>
                    <th className="p-3">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {referrals.map((r) => {
                    const friends = friendsByReferral[r.id] || [];
                    const open = openId === r.id;
                    return (
                      <>
                        <tr
                          key={r.id}
                          className="border-t hover:bg-muted/30 cursor-pointer"
                          onClick={() => setOpenId(open ? null : r.id)}
                        >
                          <td className="p-3">
                            {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                          </td>
                          <td className="p-3">
                            <PhoneLink value={r.owner_phone} />
                          </td>
                          <td className="p-3">
                            <span className="font-mono font-bold text-accent-foreground bg-accent px-2 py-0.5 rounded">
                              {r.code}
                            </span>
                          </td>
                          <td className="p-3 font-bold">{friends.length}</td>
                          <td className="p-3">
                            <div className="w-32 h-2 rounded-full bg-muted overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-amber-400 to-emerald-500"
                                style={{ width: `${Math.min(100, (friends.length / 5) * 100)}%` }}
                              />
                            </div>
                            <div className="text-[11px] text-muted-foreground mt-1">
                              {Math.min(friends.length, 5)}/5
                            </div>
                          </td>
                          <td className="p-3">
                            {r.reward_sent ? (
                              <Badge className="bg-emerald-600">
                                Sent {r.reward_sent_at ? new Date(r.reward_sent_at).toLocaleDateString() : ""}
                              </Badge>
                            ) : (
                              <Badge variant="secondary">Pending</Badge>
                            )}
                          </td>
                          <td className="p-3 whitespace-nowrap">{new Date(r.created_at).toLocaleDateString()}</td>
                        </tr>
                        {open && (
                          <tr>
                            <td colSpan={7} className="bg-muted/20 p-4">
                              {friends.length === 0 ? (
                                <div className="text-xs text-muted-foreground">
                                  No friends have used this code yet.
                                </div>
                              ) : (
                                <div className="space-y-1">
                                  <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                                    Friends referred
                                  </div>
                                  {friends.map((f) => (
                                    <div
                                      key={f.id}
                                      className="flex items-center justify-between text-xs bg-background rounded px-3 py-2 border"
                                    >
                                      <PhoneLink value={f.friend_phone} compact />
                                      <span className="text-muted-foreground">
                                        {new Date(f.created_at).toLocaleString()}
                                      </span>
                                      <span className="font-mono text-muted-foreground">{f.order_reference}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};

const Stat = ({ label, value, cls, icon }: { label: string; value: number; cls: string; icon: React.ReactNode }) => (
  <div className={`rounded-2xl p-4 text-white bg-gradient-to-br ${cls} shadow-md`}>
    <div className="flex items-center justify-between">
      <span className="text-xs font-medium opacity-90">{label}</span>
      {icon}
    </div>
    <div className="text-2xl md:text-3xl font-black mt-1">{value}</div>
  </div>
);

export default AdminReferrals;
