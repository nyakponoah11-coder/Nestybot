import { useEffect, useState } from "react";
import { supabase, invokeApiFunction } from "@/integrations/supabase/client";
import { Clock, CheckCircle2, Loader2, Zap, Radio } from "lucide-react";

interface TrackerData {
  message?: string;
  scanner?: { active?: boolean; waiting?: boolean; waitSeconds?: number; pendingBatches?: number };
  stats?: { checked?: number; delivered?: number; partial?: number; pending?: number; failed?: number };
  lastDelivered?: { trackingId?: string; summary?: string; placedAt?: string; deliveredAt?: string } | null;
  checkingNow?: { summary?: string } | null;
  fastLane?: { active?: boolean; trackingId?: number | string; placedAt?: string; deliveredAt?: string; minutes?: number } | null;
}

const formatDuration = (mins: number) => {
  if (mins < 1) return "under a minute";
  if (mins < 60) return `~${Math.round(mins)} min`;
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return m ? `~${h}h ${m}m` : `~${h}h`;
};

const formatTime = (iso?: string) => {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const TRACKER_STORAGE_KEY = "data1gh_delivery_tracker_session";
const TRACKER_TTL = 3 * 60 * 1000; // 3 minutes

export const DeliveryTracker = () => {
  const [data, setData] = useState<TrackerData | null>(() => {
    try {
      const saved = sessionStorage.getItem(TRACKER_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.data && Date.now() - (parsed.time || 0) < TRACKER_TTL) {
          return parsed.data;
        }
      }
    } catch {}
    return null;
  });
  const [loading, setLoading] = useState(!data);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      // Check session cache first
      try {
        const saved = sessionStorage.getItem(TRACKER_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed?.data && Date.now() - (parsed.time || 0) < TRACKER_TTL) {
            if (!cancelled) {
              setData(parsed.data);
              setLoading(false);
            }
            return;
          }
        }
      } catch {}

      try {
        let payload: any = null;
        try {
          const { data: res, error } = await invokeApiFunction("delivery-tracker");
          if (!error && res) {
            payload = (res as any)?.data || (res as any);
          }
        } catch (_) {}

        if (!payload || payload.status === "error") {
          const { data: res } = await supabase.functions.invoke("delivery-tracker");
          payload = (res as any)?.data || (res as any);
        }

        if (cancelled) return;
        if (payload && typeof payload === "object" && (payload as any).status !== "error") {
          setData(payload);
          try {
            sessionStorage.setItem(
              TRACKER_STORAGE_KEY,
              JSON.stringify({ data: payload, time: Date.now() })
            );
          } catch {}
        }
      } catch {
        // keep widget hidden on failure instead of crashing the page
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading && !data) {
    return (
      <div className="mb-5 rounded-2xl border border-border bg-card/50 p-4 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin text-accent" /> Loading live delivery tracker…
      </div>
    );
  }
  if (!data) return null;

  const active = data.scanner?.active ?? true;
  const inQueue = data.scanner?.pendingBatches ?? 0;

  // ETA: prefer the FAST LANE (unibundle) measured delivery time.
  // Calculate delivery turnaround time from (deliveredAt - placedAt).
  const fastLane = data.fastLane?.active ? data.fastLane : null;
  let etaText: string | null = null;
  if (fastLane?.minutes != null) {
    etaText = formatDuration(fastLane.minutes);
  } else if (data.lastDelivered?.placedAt && data.lastDelivered?.deliveredAt) {
    const placed = new Date(data.lastDelivered.placedAt).getTime();
    const delivered = new Date(data.lastDelivered.deliveredAt).getTime();
    const diffMin = Math.max(1, (delivered - placed) / 60000);
    etaText = formatDuration(diffMin);
  } else {
    etaText = "~15-20 min";
  }

  return (
    <div
      className="mb-5 rounded-2xl border border-accent/40 bg-gradient-to-br from-[hsl(220_50%_8%)] to-[hsl(220_50%_12%)] p-4 md:p-5 shadow-[0_10px_40px_-15px_hsl(var(--accent)/0.5)] ring-1 ring-accent/20 animate-in fade-in slide-in-from-bottom-2"
    >
      <div className="flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          <div className="relative shrink-0">
            <Clock className="size-5 text-accent" />
            {active && (
              <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-success animate-pulse" />
            )}
          </div>
          <div>
            <p className="text-sm md:text-base font-black uppercase tracking-wider text-accent leading-snug">
              Live Delivery Tracker
            </p>
            <p className="text-[11px] text-muted-foreground">Real-time telecom dispatch pipeline</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-success bg-success/15 px-2.5 py-1 rounded-full border border-success/30">
          <Radio className="size-3 animate-pulse" /> Live Tracker
        </span>
      </div>

      {data.stats && (
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <Stat label="Delivered" value={data.stats.delivered ?? 0} tone="success" />
          <Stat label="Pending" value={data.stats.pending ?? 0} tone="warning" />
          <Stat label="Checked" value={data.stats.checked ?? 0} tone="success" />
        </div>
      )}

      {fastLane && (
        <div className="mt-3 rounded-xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 p-[1.5px] shadow-[0_8px_30px_-10px_hsl(45_100%_50%/0.6)]">
          <div className="rounded-[10px] bg-[hsl(220_50%_10%)] px-3 py-2.5">
            <div className="flex items-center gap-2 text-xs md:text-sm">
              <Zap className="size-4 shrink-0 text-yellow-400 fill-yellow-400 animate-pulse" />
              <span className="font-black uppercase tracking-wider text-yellow-400">Fast lane</span>
              {fastLane.minutes != null && (
                <span className="ml-auto font-black text-yellow-300">~{fastLane.minutes} min</span>
              )}
            </div>
            {fastLane.trackingId != null && (
              <p className="mt-1 ml-6 text-[11px] md:text-xs text-yellow-200/80">
                #{fastLane.trackingId} · placed {formatTime(fastLane.placedAt)} → delivered {formatTime(fastLane.deliveredAt)}
              </p>
            )}
          </div>
        </div>
      )}

      {data.lastDelivered?.summary && (
        <div className="mt-3 space-y-1.5">
          <div className="flex items-start gap-2 text-xs md:text-sm text-emerald-400">
            <CheckCircle2 className="size-4 shrink-0 mt-0.5" />
            <span className="leading-snug break-words">Network dispatch active · Recent telecom batch #{data.lastDelivered.trackingId || ""} delivered</span>
          </div>
          {etaText && (
            <div className="ml-6 rounded-lg bg-accent px-3 py-2 text-xs md:text-sm text-accent-foreground shadow-sm">
              <span className="font-semibold">
                {fastLane ? "Fast lane delivery time is " : "Estimated network delivery time is "}
              </span>
              <span className="font-black">{etaText}</span>
            </div>
          )}
        </div>
      )}


      {data.checkingNow?.summary && (
        <div className="mt-2 flex items-start gap-2 text-xs md:text-sm text-primary">
          <span className="relative flex size-2 mt-1.5 shrink-0">
            <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-75 animate-ping" />
            <span className="relative inline-flex size-2 rounded-full bg-primary" />
          </span>
          <span className="leading-snug break-words">{data.checkingNow.summary}</span>
        </div>
      )}
    </div>
  );
};


const Stat = ({ label, value, tone }: { label: string; value: number; tone: "success" | "warning" | "muted" | "accent" }) => {
  const styles =
    tone === "success"
      ? "bg-success/15 border-success/40 text-success"
      : tone === "warning"
      ? "bg-warning/15 border-warning/40 text-warning"
      : tone === "accent"
      ? "bg-accent/15 border-accent/40 text-accent"
      : "bg-primary/15 border-primary/40 text-primary";
  return (
    <div className={`rounded-lg border py-2 ${styles}`}>
      <div className="text-xl font-black">{value}</div>
      <div className="text-[10px] uppercase tracking-wider font-bold opacity-90">{label}</div>
    </div>
  );
};


