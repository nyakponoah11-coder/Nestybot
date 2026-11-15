import { useEffect, useMemo, useState } from "react";
import { supabase, invokeApiFunction } from "@/integrations/supabase/client";
import { getCacheMeta, setCache, invalidateCache } from "@/lib/localCache";
import { invalidateShopCache } from "@/lib/storeCache";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ChevronDown, ChevronRight, Eye, Gift, Loader2, RefreshCw, Sparkles, Users, CheckCircle2, Check } from "lucide-react";
import { PhoneLink } from "@/components/PhoneLink";
import { toast } from "sonner";
import { SpinGameDialog } from "@/components/SpinGameDialog";

const REWARD_THRESHOLD = 5;

// Snapshot from Nestybot. This is intentionally local data: the admin app does
// not connect to the separate Nestybot Supabase project.
const NESTYBOT_WINS: SpinWin[] = [
  { id: "nestybot-2", code: "DATA12WZ7Z8", owner_phone: "0243682726", prize_capacity: "5", orders_count: 0, reward_sent: false, reward_reference: null, reward_sent_at: null, created_at: null },
  { id: "nestybot-3", code: "DATA1JWQKXN", owner_phone: "0599599254", prize_capacity: "5", orders_count: 1, reward_sent: false, reward_reference: null, reward_sent_at: null, created_at: null },
  { id: "nestybot-4", code: "DATA1JJSNPF", owner_phone: "0539529127", prize_capacity: "5", orders_count: 5, reward_sent: true, reward_reference: null, reward_sent_at: null, created_at: null },
  { id: "nestybot-1", code: "DATA1JCGLL9", owner_phone: "0547100951", prize_capacity: "5", orders_count: 4, reward_sent: false, reward_reference: null, reward_sent_at: null, created_at: null },
];

const NESTYBOT_REDEMPTIONS: SpinRedemption[] = [
  { id: "nestybot-order-10", spin_id: "nestybot-1", order_reference: "MN-TF3980QB", buyer_phone: "0547100951", created_at: "2026-09-12T02:06:28.616Z" },
  { id: "nestybot-order-9", spin_id: "nestybot-4", order_reference: "MN-SH2996NB", buyer_phone: "0539529127", created_at: "2026-09-10T10:43:40.041Z" },
  { id: "nestybot-order-8", spin_id: "nestybot-1", order_reference: "MN-DH7575RD", buyer_phone: "0547100951", created_at: "2026-09-09T18:51:21.520Z" },
  { id: "nestybot-order-7", spin_id: "nestybot-1", order_reference: "MN-WK5831GG", buyer_phone: "0547100951", created_at: "2026-09-07T11:34:05.350Z" },
  { id: "nestybot-order-6", spin_id: "nestybot-1", order_reference: "MN-KK0223OO", buyer_phone: "0547100951", created_at: "2026-09-05T20:04:50.504Z" },
  { id: "nestybot-order-5", spin_id: "nestybot-4", order_reference: "MN-IW5582JU", buyer_phone: "0539529127", created_at: "2026-08-27T00:34:58.276Z" },
  { id: "nestybot-order-4", spin_id: "nestybot-4", order_reference: "MN-GB2669AX", buyer_phone: "0539529127", created_at: "2026-08-25T01:01:09.012Z" },
  { id: "nestybot-order-3", spin_id: "nestybot-4", order_reference: "MN-CE2287BH", buyer_phone: "0539529127", created_at: "2026-08-22T15:25:51.858Z" },
  { id: "nestybot-order-2", spin_id: "nestybot-4", order_reference: "MN-CR3981NC", buyer_phone: "0539529127", created_at: "2026-08-21T08:57:03.053Z" },
  { id: "nestybot-order-1", spin_id: "nestybot-3", order_reference: "MN-BQ3896UK", buyer_phone: "0599599254", created_at: "2026-08-19T18:08:03.850Z" },
];

type SpinWin = {
  id: string;
  code: string;
  owner_phone: string;
  prize_capacity: string;
  orders_count: number;
  reward_sent: boolean;
  reward_reference: string | null;
  reward_sent_at: string | null;
  created_at: string | null;
};

type SpinRedemption = {
  id: string;
  spin_id: string;
  order_reference: string;
  buyer_phone: string;
  created_at: string;
};

const AdminSpinReport = () => {
  const [wins, setWins] = useState<SpinWin[]>([]);
  const [redemptions, setRedemptions] = useState<SpinRedemption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [spinEnabled, setSpinEnabled] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [markingId, setMarkingId] = useState<string | null>(null);

  const markAsSent = async (win: SpinWin) => {
    if (markingId) return;
    setMarkingId(win.id);
    try {
      const { data, error } = await invokeApiFunction("free-data", {
        body: { action: "markSpinSent", id: win.id, code: win.code },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setWins((prev) =>
        prev.map((w) =>
          w.id === win.id ? { ...w, reward_sent: true, reward_sent_at: new Date().toISOString() } : w
        )
      );
      try {
        const rawList = localStorage.getItem("data1_local_spin_wins");
        if (rawList) {
          const parsed: SpinWin[] = JSON.parse(rawList);
          const updated = parsed.map((w) =>
            w.code === win.code || w.id === win.id
              ? { ...w, reward_sent: true, reward_sent_at: new Date().toISOString(), reward_reference: "MANUAL" }
              : w
          );
          localStorage.setItem("data1_local_spin_wins", JSON.stringify(updated));
        }
      } catch (_) { }
      invalidateCache("admin_spin_report");
      toast.success(`Reward marked as sent to ${win.owner_phone} (${win.prize_capacity}GB)!`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to mark as sent");
    } finally {
      setMarkingId(null);
    }
  };


  const mergeWinsAndRedemptions = (apiWins: SpinWin[], apiRedemptions: SpinRedemption[]) => {
    let localWins: SpinWin[] = [];
    try {
      const raw = localStorage.getItem("data1_local_spin_wins");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) localWins = parsed;
      }
    } catch (_) { }

    const byCode = new Map<string, SpinWin>();
    for (const w of [...apiWins, ...localWins, ...NESTYBOT_WINS]) {
      if (!w || !w.code) continue;
      const key = String(w.code).toUpperCase();
      const prev = byCode.get(key);
      if (!prev) {
        byCode.set(key, w);
      } else {
        byCode.set(key, {
          ...prev,
          ...w,
          orders_count: Math.max(Number(prev.orders_count || 0), Number(w.orders_count || 0)),
          reward_sent: Boolean(prev.reward_sent || w.reward_sent),
          created_at: prev.created_at || w.created_at,
        });
      }
    }

    const byRedId = new Map<string, SpinRedemption>();
    for (const r of [...apiRedemptions, ...NESTYBOT_REDEMPTIONS]) {
      if (!r) continue;
      const key = String(r.id || `${r.spin_id}_${r.order_reference}`);
      if (!byRedId.has(key)) byRedId.set(key, r);
    }

    return {
      wins: Array.from(byCode.values()),
      redemptions: Array.from(byRedId.values()),
    };
  };

  const load = async (force = false) => {
    if (!force) {
      const cached = getCacheMeta<{ wins: SpinWin[]; redemptions: SpinRedemption[]; spinEnabled: boolean }>("admin_spin_report");
      if (cached.exists && cached.data && Array.isArray(cached.data.wins) && cached.data.wins.length > 0) {
        const mergedCached = mergeWinsAndRedemptions(cached.data.wins, cached.data.redemptions || []);
        setWins(mergedCached.wins);
        setRedemptions(mergedCached.redemptions);
        setSpinEnabled(!!cached.data.spinEnabled);
        setLoading(false);
        if (!cached.isStale) return;
      }
    }

    setLoading(true);
    let loaded = false;
    let finalWins: SpinWin[] = [];
    let finalRedemptions: SpinRedemption[] = [];
    let isSpinOn = spinEnabled;

    // 1. Primary: Fetch directly from free-data (same function handling spin-claim, markSpinSent & WhatsApp Scratch sync)
    try {
      const { data, error: freeErr } = await invokeApiFunction("free-data", {
        body: { action: "getSpinReport", force: Boolean(force) },
      });
      if (!freeErr && !data?.error && data) {
        setError(null);
        const merged = mergeWinsAndRedemptions(data.spin_wins || [], data.spin_redemptions || []);
        finalWins = merged.wins;
        finalRedemptions = merged.redemptions;
        setWins(finalWins);
        setRedemptions(finalRedemptions);
        if (data.spin_game_enabled !== undefined) {
          isSpinOn = !!data.spin_game_enabled;
          setSpinEnabled(isSpinOn);
        }
        loaded = true;
      }
    } catch (_) { }

    // 2. Fallback: admin-services overview
    if (!loaded) {
      try {
        const { data, error: invokeError } = await invokeApiFunction("admin-services", { body: { action: "overview" } });
        if (!invokeError && !data?.error && data) {
          setError(null);
          const merged = mergeWinsAndRedemptions(data?.spin_wins || [], data?.spin_redemptions || []);
          finalWins = merged.wins;
          finalRedemptions = merged.redemptions;
          setWins(finalWins);
          setRedemptions(finalRedemptions);
          if (data?.spin_game_enabled !== undefined) {
            isSpinOn = !!data.spin_game_enabled;
            setSpinEnabled(isSpinOn);
          }
          loaded = true;
        }
      } catch (_) { }
    }

    // 3. Final fallback: ensure local + Nestybot records are always shown
    if (!loaded) {
      const merged = mergeWinsAndRedemptions([], []);
      finalWins = merged.wins;
      finalRedemptions = merged.redemptions;
      setWins(finalWins);
      setRedemptions(finalRedemptions);
      setError(null);
    }

    setCache("admin_spin_report", { wins: finalWins, redemptions: finalRedemptions, spinEnabled: isSpinOn }, 2 * 60 * 1000);
    setLoading(false);
  };

  const toggleSpin = async (enabled: boolean) => {
    setToggling(true);
    setSpinEnabled(enabled);
    let ok = false;
    try {
      const [r1, r2] = await Promise.allSettled([
        invokeApiFunction("free-data", { body: { action: "toggleSpin", enabled } }),
        invokeApiFunction("admin-services", { body: { action: "toggleSpin", enabled } }),
      ]);
      if (
        (r1.status === "fulfilled" && !r1.value.error && !r1.value.data?.error) ||
        (r2.status === "fulfilled" && !r2.value.error && !r2.value.data?.error)
      ) {
        ok = true;
      }
    } catch (_) { }

    if (!ok) {
      try {
        const { error: sbErr } = await supabase
          .from("settings")
          .upsert({ key: "spin_game_enabled", value: enabled ? "true" : "false" }, { onConflict: "key" });
        if (!sbErr) ok = true;
      } catch (_) { }
    }

    setToggling(false);
    if (ok) {
      invalidateCache("admin_spin_report");
      invalidateShopCache();
      toast.success(
        enabled
          ? "Spin & Win wheel is now ON and working on the storefront!"
          : "Spin & Win wheel is now OFF and hidden from the storefront."
      );
    } else {
      setSpinEnabled(!enabled); // revert
      toast.error("Failed to update Spin & Win status.");
    }
  };

  useEffect(() => { load(); }, []);

  const redemptionsBySpin = useMemo(() => {
    const map: Record<string, SpinRedemption[]> = {};
    for (const redemption of redemptions) (map[redemption.spin_id] ||= []).push(redemption);
    return map;
  }, [redemptions]);

  const completed = wins.filter((win) => win.orders_count >= REWARD_THRESHOLD).length;
  const rewardsSent = wins.filter((win) => win.reward_sent).length;
  const active = wins.filter((win) => win.orders_count > 0 && !win.reward_sent).length;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl p-5 md:p-6 bg-gradient-to-r from-fuchsia-600 via-pink-600 to-amber-500 text-white shadow-lg">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="size-5" />
          <h1 className="text-2xl md:text-3xl font-black">Spin & win report</h1>
        </div>
        <p className="text-sm opacity-90">Manage storefront spin wheel status, track player registrations, progress, and reward delivery.</p>
      </div>

      {/* Prominent Admin On/Off Switch Button */}
      <Card className="p-4 md:p-6 bg-gradient-card border-2 border-accent/40 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sparkles className="size-5 text-accent" />
              <h2 className="font-bold text-lg">Storefront Spin & Win Status</h2>
              <span
                className={`px-2.5 py-0.5 text-xs font-bold rounded-full ${spinEnabled
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                  : "bg-muted text-muted-foreground border border-border"
                  }`}
              >
                {spinEnabled ? "● Active on storefront" : "○ Turned off (hidden)"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {spinEnabled
                ? "The Spin & Win wheel is ON and actively running on the customer shop UI. Customers can spin and win free data."
                : "The Spin & Win wheel is currently OFF and hidden from customers on the shop UI. Turn it on when you're ready."}
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setTestDialogOpen(true)}
              className="border-accent/40 hover:border-accent text-xs font-bold gap-1.5"
            >
              <Eye className="size-3.5 text-accent" /> Preview wheel
            </Button>

            <div className="flex items-center gap-2.5 bg-background/70 border border-accent/30 rounded-xl px-3.5 py-2 shadow-sm">
              <Label htmlFor="spin-main-toggle" className="text-xs font-bold cursor-pointer select-none">
                {spinEnabled ? "Enabled (ON)" : "Disabled (OFF)"}
              </Label>
              <Switch
                id="spin-main-toggle"
                checked={spinEnabled}
                disabled={toggling}
                onCheckedChange={toggleSpin}
              />
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat icon={<Users className="size-5" />} label="Numbers registered" value={wins.length} cls="from-fuchsia-500 to-purple-700" />
        <Stat icon={<Sparkles className="size-5" />} label="In progress" value={active} cls="from-amber-500 to-orange-600" />
        <Stat icon={<Gift className="size-5" />} label="Reached 5 orders" value={completed} cls="from-sky-500 to-indigo-700" />
        <Stat icon={<Gift className="size-5" />} label="Rewards sent" value={rewardsSent} cls="from-emerald-500 to-emerald-800" />
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="flex items-center justify-between gap-3 p-4 border-b">
          <div>
            <h2 className="font-bold">Registered players</h2>
            <p className="text-xs text-muted-foreground">Each player needs {REWARD_THRESHOLD} paid orders using their code.</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => load(true)} disabled={loading}>
            <RefreshCw className={`size-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
        {loading ? (
          <div className="grid place-items-center py-14"><Loader2 className="size-6 animate-spin" /></div>
        ) : error ? (
          <div className="p-6 text-sm text-destructive">{error}</div>
        ) : wins.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">No scratch and win registrations yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="text-left">
                  <th className="p-3"></th>
                  <th className="p-3">Registered number</th>
                  <th className="p-3">Code</th>
                  <th className="p-3">Prize</th>
                  <th className="p-3">Progress</th>
                  <th className="p-3">Reward Status</th>
                  <th className="p-3">Manual Action</th>
                  <th className="p-3">Registered</th>
                </tr>
              </thead>
              <tbody>
                {wins.map((win) => {
                  const rows = redemptionsBySpin[win.id] || [];
                  const open = openId === win.id;
                  const progress = Math.min(win.orders_count, REWARD_THRESHOLD);
                  return (
                    <>
                      <tr key={win.id} className="border-t hover:bg-muted/30 cursor-pointer" onClick={() => setOpenId(open ? null : win.id)}>
                        <td className="p-3">{open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}</td>
                        <td className="p-3"><PhoneLink value={win.owner_phone} /></td>
                        <td className="p-3"><span className="font-mono font-bold text-accent-foreground bg-accent px-2 py-0.5 rounded">{win.code}</span></td>
                        <td className="p-3">{win.prize_capacity}GB</td>
                        <td className="p-3 min-w-40">
                          <div className="h-2 rounded-full bg-muted overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-amber-400 to-emerald-500" style={{ width: `${(progress / REWARD_THRESHOLD) * 100}%` }} />
                          </div>
                          <div className="text-[11px] text-muted-foreground mt-1">{progress}/{REWARD_THRESHOLD} orders</div>
                        </td>
                        <td className="p-3">
                          {win.reward_sent ? <Badge className="bg-emerald-600">Sent</Badge> : win.orders_count >= REWARD_THRESHOLD ? <Badge className="bg-amber-600">Ready</Badge> : <Badge variant="secondary">Pending</Badge>}
                        </td>
                        <td className="p-3" onClick={(e) => e.stopPropagation()}>
                          {win.reward_sent ? (
                            <span className="inline-flex items-center gap-1 text-xs text-emerald-500 font-semibold">
                              <CheckCircle2 className="size-3.5" /> Delivered
                            </span>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={markingId === win.id}
                              onClick={() => markAsSent(win)}
                              className="h-7 px-2.5 text-xs font-bold border-emerald-500/40 text-emerald-500 hover:bg-emerald-500/10"
                            >
                              {markingId === win.id ? <Loader2 className="size-3 animate-spin mr-1" /> : <Check className="size-3 mr-1" />}
                              Mark Sent
                            </Button>
                          )}
                        </td>
                        <td className="p-3 whitespace-nowrap">{win.created_at ? new Date(win.created_at).toLocaleDateString() : "Nestybot"}</td>
                      </tr>
                      {open && (
                        <tr key={`${win.id}-details`}>
                          <td colSpan={8} className="bg-muted/20 p-4">
                            {rows.length === 0 ? (
                              <div className="text-xs text-muted-foreground">No orders have used this code yet.</div>
                            ) : (
                              <div className="space-y-1">
                                <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Orders using this code</div>
                                {rows.map((row) => (
                                  <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 text-xs bg-background rounded px-3 py-2 border">
                                    <PhoneLink value={row.buyer_phone} compact />
                                    <span className="font-mono text-muted-foreground">{row.order_reference}</span>
                                    <span className="text-muted-foreground">{new Date(row.created_at).toLocaleString()}</span>
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
          </div>
        )}
      </Card>

      <SpinGameDialog open={testDialogOpen} onOpenChange={setTestDialogOpen} onClaimSuccess={() => load(true)} />
    </div>
  );
};

const Stat = ({ label, value, cls, icon }: { label: string; value: number; cls: string; icon: React.ReactNode }) => (
  <div className={`rounded-xl p-4 text-white bg-gradient-to-br ${cls} shadow-md`}>
    <div className="flex items-center justify-between"><span className="text-xs font-medium opacity-90">{label}</span>{icon}</div>
    <div className="text-2xl md:text-3xl font-black mt-1">{value}</div>
  </div>
);

export default AdminSpinReport;
