import { useState, useEffect } from "react";
import { Headphones, Loader2, RefreshCw, Trash2, Phone, MessageSquare, Mic } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AudioPlayer } from "@/components/AudioPlayer";
import { PhoneLink } from "@/components/PhoneLink";
import { invokeApiFunction } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface VoiceCallRecord {
  id: string;
  created_at: string;
  customer_phone?: string | null;
  visitor_name?: string;
  audio_url?: string | null;
  duration_seconds?: number;
  network?: string | null;
  capacity?: string | null;
  price?: number;
}

export default function AdminVoiceNotes() {
  const [calls, setCalls] = useState<VoiceCallRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadCalls = async () => {
    setLoading(true);
    try {
      const res = await invokeApiFunction("chat", { body: { action: "listVoiceCalls" } });
      if (res.data?.calls && Array.isArray(res.data.calls)) {
        setCalls(res.data.calls);
      } else {
        setCalls([]);
      }
    } catch (e: any) {
      console.warn("Could not load voice calls:", e);
      toast.error("Failed to load voice notes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    document.title = "Admin · Voice Notes";
    loadCalls();
  }, []);

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this voice note?")) return;
    setDeletingId(id);
    try {
      const res = await invokeApiFunction("chat", { body: { action: "deleteVoiceCall", id } });
      if (res.data?.calls) {
        setCalls(res.data.calls);
      } else {
        setCalls((prev) => prev.filter((c) => c.id !== id));
      }
      toast.success("Voice note deleted");
    } catch (e: any) {
      toast.error("Failed to delete voice note");
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteAll = async () => {
    if (!window.confirm("Are you sure you want to delete ALL voice notes? This cannot be undone.")) return;
    setDeletingId("all");
    try {
      const res = await invokeApiFunction("chat", { body: { action: "deleteVoiceCall", id: "all" } });
      if (res.data?.calls) {
        setCalls(res.data.calls);
      } else {
        setCalls([]);
      }
      toast.success("All voice notes cleared");
    } catch (e: any) {
      toast.error("Failed to clear voice notes");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl bg-zinc-950 border border-emerald-500/30 text-white shadow-xl">
        <div className="flex items-center gap-3">
          <div className="size-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
            <Mic className="size-6 animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight flex items-center gap-2">
              Customer Voice Notes
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono font-bold border border-emerald-500/40">
                {calls.length} {calls.length === 1 ? "Note" : "Notes"}
              </span>
            </h1>
            <p className="text-xs text-zinc-400 mt-0.5">
              Listen to recorded customer voice notes and delete them when resolved.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={loadCalls}
            disabled={loading}
            className="h-9 px-3 rounded-xl border-zinc-700 bg-zinc-900 text-white hover:bg-zinc-800 gap-1.5"
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </Button>

          {calls.length > 0 && (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleDeleteAll}
              disabled={deletingId === "all"}
              className="h-9 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white gap-1.5 shadow"
            >
              <Trash2 className="size-3.5" />
              <span>Clear All</span>
            </Button>
          )}
        </div>
      </div>

      {/* Voice Notes Grid */}
      {loading ? (
        <Card className="p-16 text-center border-dashed bg-zinc-950/40 border-zinc-800">
          <Loader2 className="size-8 animate-spin text-emerald-400 mx-auto mb-3" />
          <p className="text-sm text-zinc-400">Loading voice notes…</p>
        </Card>
      ) : calls.length === 0 ? (
        <Card className="p-16 text-center border-dashed bg-zinc-950/40 border-zinc-800">
          <div className="size-16 rounded-3xl bg-zinc-900 text-zinc-500 flex items-center justify-center mx-auto mb-4">
            <Headphones className="size-8" />
          </div>
          <h2 className="text-lg font-bold text-white">No Voice Notes Yet</h2>
          <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto">
            When customers make phone calls or send voice notes, they will appear here so you can play and delete them.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {calls.map((call) => {
            const phoneDigits = (call.customer_phone || "").replace(/\D/g, "");
            const waLink = phoneDigits
              ? `https://wa.me/${phoneDigits.startsWith("0") ? "233" + phoneDigits.slice(1) : phoneDigits}?text=${encodeURIComponent(
                  `Hello from Data One! Regarding your voice note:`
                )}`
              : null;

            return (
              <Card
                key={call.id}
                className="p-4 rounded-3xl bg-zinc-950/90 border border-emerald-500/30 text-white shadow-xl flex flex-col justify-between gap-3 hover:border-emerald-400/50 transition-all"
              >
                {/* Caller Info Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-bold text-sm text-white flex items-center gap-1.5">
                      <Phone className="size-3.5 text-emerald-400 shrink-0" />
                      {call.customer_phone ? (
                        <PhoneLink value={call.customer_phone} />
                      ) : (
                        <span className="text-zinc-300">Customer (Direct Call)</span>
                      )}
                    </div>
                    <div className="text-[11px] text-zinc-400 mt-0.5 flex items-center gap-2">
                      <span className="font-mono text-zinc-300">
                        {new Date(call.created_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
                      </span>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(call.id)}
                    disabled={deletingId === call.id}
                    className="size-8 rounded-xl text-rose-400 hover:text-white hover:bg-rose-600/80 shrink-0"
                    title="Delete voice note"
                  >
                    {deletingId === call.id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Trash2 className="size-4" />
                    )}
                  </Button>
                </div>

                {/* Voice Note Audio Player with Play and Delete */}
                <AudioPlayer
                  src={call.audio_url || "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA="}
                  durationSeconds={call.duration_seconds || 10}
                  onDelete={() => handleDelete(call.id)}
                  isDeleting={deletingId === call.id}
                  showTranscript={false}
                />

                {/* Quick Contact Actions */}
                <div className="flex items-center gap-2 pt-1 border-t border-zinc-800/80">
                  {waLink && (
                    <Button asChild size="sm" variant="outline" className="h-8 text-xs font-bold gap-1.5 flex-1 border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-emerald-400">
                      <a href={waLink} target="_blank" rel="noreferrer">
                        <MessageSquare className="size-3.5 text-emerald-400" />
                        <span>WhatsApp</span>
                      </a>
                    </Button>
                  )}
                  {call.customer_phone && (
                    <Button asChild size="sm" variant="outline" className="h-8 text-xs font-bold gap-1.5 flex-1 border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-sky-400">
                      <a href={`tel:${call.customer_phone}`}>
                        <Phone className="size-3.5 text-sky-400" />
                        <span>Call Customer</span>
                      </a>
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
