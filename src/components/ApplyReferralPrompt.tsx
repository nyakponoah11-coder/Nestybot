import { useEffect, useState, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { invokeApiFunction } from "@/integrations/supabase/client";
import { Gift, Loader2, CheckCircle2, Sparkles } from "lucide-react";
import { toast } from "sonner";

const SEEN_KEY = "referral_applied_for_";

export const ApplyReferralPrompt = ({ orderReference }: { orderReference: string }) => {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [autoApplied, setAutoApplied] = useState(false);
  const autoAppliedRef = useRef(false);

  const executeApply = async (targetCode: string, isAuto = false) => {
    const c = targetCode.trim().toUpperCase();
    if (c.length < 4) {
      if (!isAuto) toast.error("Please enter a valid referral code");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await invokeApiFunction("referral-apply", {
        body: { code: c, order_reference: orderReference },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setDone(true);
      if (isAuto) setAutoApplied(true);
      localStorage.setItem(SEEN_KEY + orderReference, "1");
      localStorage.removeItem("incoming_ref");

      if (data.reward_sent || data.orders_count >= 5) {
        toast.success(
          data.kind === "spin"
            ? `🎉 Spin & Win 5/5 completed! The ${data.prize || "data"} reward alert was sent to admin.`
            : "🎉 Referral reward 5/5 reached! Reward is being processed."
        );
      } else {
        toast.success(
          `🎉 Referral code ${c} applied! (${data.orders_count || 1}/5 orders completed).`
        );
      }
    } catch (e: any) {
      if (!isAuto) {
        toast.error(e.message || "Could not apply referral code");
      } else {
        console.warn("Auto referral-apply notice:", e?.message);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!orderReference) return;

    // Prefill from ?ref= or stored visit code
    const url = new URL(window.location.href);
    const fromUrl = url.searchParams.get("ref");
    const fromStorage = localStorage.getItem("incoming_ref");
    const v = (fromUrl || fromStorage || "").trim().toUpperCase();

    if (v) setCode(v);

    if (localStorage.getItem(SEEN_KEY + orderReference)) {
      setDone(true);
      return;
    }

    // Automatically apply referral code if buyer came from a referral link!
    if (v && v.length >= 4 && !autoAppliedRef.current) {
      autoAppliedRef.current = true;
      executeApply(v, true);
    }
  }, [orderReference]);

  if (hidden) return null;

  return (
    <Card className="mt-4 p-4 text-left border-2 border-accent/40 bg-gradient-to-br from-amber-500/10 via-background to-orange-500/10 shadow-sm">
      {done ? (
        <div className="flex items-center gap-2 text-emerald-500 font-bold text-sm">
          <CheckCircle2 className="size-5 shrink-0" />
          <span>
            {autoApplied ? "Referral link applied automatically! ✓" : "Referral code applied successfully! ✓"}
          </span>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 mb-1.5">
            <Gift className="size-4 text-accent" />
            <span className="text-sm font-bold">Have a referral or spin code?</span>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Enter a friend's referral link code or a Spin &amp; Win code to credit them with this order.
          </p>
          <div className="flex gap-2">
            <Input
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              placeholder="SP123456"
              maxLength={12}
              className="font-mono tracking-widest uppercase h-10"
            />
            <Button
              onClick={() => executeApply(code, false)}
              disabled={loading}
              className="bg-gradient-gold text-accent-foreground font-bold h-10 px-5"
            >
              {loading ? <Loader2 className="size-4 animate-spin" /> : "Apply"}
            </Button>
          </div>
          <button
            type="button"
            onClick={() => setHidden(true)}
            className="text-xs text-muted-foreground mt-2 hover:underline"
          >
            Skip
          </button>
        </>
      )}
    </Card>
  );
};
