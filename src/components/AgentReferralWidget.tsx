import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { invokeApiFunction } from "@/integrations/supabase/client";
import { getSavedPhone } from "@/lib/orderHistory";
import {
  Gift,
  Share2,
  Copy,
  Check,
  Sparkles,
  Users,
  ExternalLink,
  Loader2,
  CheckCircle2,
  ArrowRight,
  PartyPopper
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface AgentReferralWidgetProps {
  agentSlug: string;
  agentStoreName: string;
  agentId?: string;
  theme?: any;
  className?: string;
}

export const AgentReferralWidget: React.FC<AgentReferralWidgetProps> = ({
  agentSlug,
  agentStoreName,
  agentId,
  theme,
  className = "",
}) => {
  const [params] = useSearchParams();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [referralData, setReferralData] = useState<{
    customer_phone: string;
    referral_code: string;
    total_qualified_orders: number;
    target: number;
    is_completed: boolean;
    reward_status: string;
  } | null>(null);

  // 1. Capture ?ref= from URL and save into sessionStorage
  useEffect(() => {
    const refParam = params.get("ref") || params.get("referral");
    if (refParam && typeof window !== "undefined") {
      sessionStorage.setItem("data1_agent_ref", refParam.trim());
    }
  }, [params]);

  // 2. Prefill phone from cache if available
  useEffect(() => {
    const saved = getSavedPhone();
    if (saved) {
      setPhone(saved);
      fetchProgress(saved);
    }
  }, [agentSlug]);

  const fetchProgress = async (phoneToQuery: string) => {
    const clean = phoneToQuery.replace(/\D/g, "");
    if (clean.length < 9) return;
    try {
      const res = await invokeApiFunction("agent", {
        body: {
          action: "getAgentReferralProgress",
          agent_slug: agentSlug,
          agent_id: agentId,
          customer_phone: clean,
        },
      });
      if (res?.data?.ok && res.data.referral) {
        setReferralData(res.data.referral);
      }
    } catch (_) { }
  };

  const handleGenerateLink = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = phone.replace(/\D/g, "");
    if (clean.length < 9) {
      toast.error("Please enter a valid 10-digit MTN phone number.");
      return;
    }

    const formatted = clean.startsWith("233") ? "0" + clean.slice(3) : (clean.startsWith("0") ? clean : "0" + clean);
    const mtnPrefixes = ["024", "025", "053", "054", "055", "059"];
    const isMTN = mtnPrefixes.some(prefix => formatted.startsWith(prefix));
    if (!isMTN) {
      toast.error("Only MTN numbers are accepted (024, 054, 055, 059, 025, 053). The 5GB reward is only for MTN.");
      return;
    }

    setLoading(true);
    try {
      const res = await invokeApiFunction("agent", {
        body: {
          action: "registerAgentReferral",
          agent_slug: agentSlug,
          agent_id: agentId,
          customer_phone: clean,
        },
      });
      if (res?.data?.ok && res.data.referral) {
        setReferralData(res.data.referral);
        toast.success("Your personal referral link is ready!");
      } else {
        toast.error(res?.data?.error || "Could not generate link");
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to generate link");
    } finally {
      setLoading(false);
    }
  };

  const currentOrigin = typeof window !== "undefined" ? window.location.origin : "https://data1gh.com";
  const referralCode = referralData?.referral_code || "";
  const referralLink = `${currentOrigin}/s/${agentSlug}?ref=${referralCode || phone.replace(/\D/g, "")}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast.success("Referral link copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyCode = () => {
    if (!referralCode) return;
    navigator.clipboard.writeText(referralCode);
    setCopied(true);
    toast.success(`Referral code ${referralCode} copied!`);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareText = encodeURIComponent(
    `Hey! Buy cheap MTN, Telecel & AT data bundles on ${agentStoreName}. Use my promo code *${referralCode}* or click below for instant delivery:\n${referralLink}`
  );
  const whatsappShareUrl = `https://wa.me/?text=${shareText}`;

  const completedCount = referralData?.total_qualified_orders || 0;
  const isGoalReached = completedCount >= 5;
  const percentage = Math.min(100, Math.round((completedCount / 5) * 100));

  return (
    <>
      {/* Visual Trigger Banner on Agent Storefront */}
      <div className={`w-full my-4 ${className}`}>
        <div
          onClick={() => setDialogOpen(true)}
          className="group relative cursor-pointer overflow-hidden rounded-2xl border-2 border-amber-500/40 bg-gradient-to-r from-amber-500/15 via-purple-500/15 to-emerald-500/15 p-4 hover:border-amber-400 hover:shadow-lg transition-all"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-slate-950 flex items-center justify-center font-black shadow-md shrink-0 group-hover:scale-105 transition-transform">
                <Gift className="size-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-black text-xs md:text-sm text-foreground">
                    🎁 Refer 5 Friends &amp; Get 5GB Free Data!
                  </span>
                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500 text-slate-950">
                    5GB Reward
                  </span>
                </div>
                <p className="text-[11px] md:text-xs text-muted-foreground mt-0.5">
                  Invite friends to buy from {agentStoreName}. Once 5 friends buy, you unlock a 5GB reward!
                </p>
              </div>
            </div>

            <Button
              type="button"
              size="sm"
              className="shrink-0 text-xs font-bold gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl shadow-xs"
            >
              <span>Get Link</span>
              <ArrowRight className="size-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Button>
          </div>
        </div>
      </div>

      {/* Referral Dialog Modal */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md bg-card border border-border text-foreground rounded-3xl p-5 md:p-6 shadow-2xl">
          <DialogHeader>
            <div className="flex items-center gap-2.5">
              <div className="size-9 rounded-xl bg-amber-500/20 text-amber-500 flex items-center justify-center shrink-0">
                <Gift className="size-5" />
              </div>
              <div>
                <DialogTitle className="text-base md:text-lg font-black text-foreground">
                  Refer 5 Friends &bull; Get 5GB Free Data
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Exclusive customer reward for {agentStoreName}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {!referralData ? (
            /* Step 1: Input Phone to Generate Link */
            <form onSubmit={handleGenerateLink} className="space-y-4 mt-3">
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-800 dark:text-amber-200">
                <strong>How it works:</strong> Enter your <strong>MTN phone number</strong> where you want to receive your 5GB Free Data. Share your personal link with friends. Once 5 friends complete a purchase from this store using your link, your 5GB Free Data bundle will be sent to this MTN number!
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ref-phone" className="text-xs font-bold text-foreground">
                  MTN Number to Receive 5GB Free Data
                </Label>
                <Input
                  id="ref-phone"
                  type="tel"
                  placeholder="054 / 024 / 055 / 059 / 025 / 053 XXXXXXX"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  className="rounded-xl font-mono text-sm"
                />
                <p className="text-[11px] text-muted-foreground">
                  Only MTN numbers accepted (024, 054, 055, 059, 025, 053). Your 5GB bundle will be delivered to this MTN line.
                </p>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 text-xs font-bold gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:opacity-95 text-slate-950 rounded-xl shadow-md"
              >
                {loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                <span>Get My Referral Link</span>
              </Button>
            </form>
          ) : (
            /* Step 2: Show Link & Progress */
            <div className="space-y-4 mt-3">
              {/* Reward Status Banner */}
              {isGoalReached ? (
                <div className="p-4 rounded-2xl bg-emerald-500/15 border-2 border-emerald-500/40 text-emerald-800 dark:text-emerald-200 text-center space-y-1 animate-in zoom-in-95 duration-200">
                  <div className="flex items-center justify-center gap-1.5 font-black text-sm">
                    <PartyPopper className="size-4 text-emerald-500" />
                    <span>🎉 5 OF 5 REFERRALS COMPLETED!</span>
                  </div>
                  <p className="text-xs font-medium">
                    Congratulations! Your 5GB Free Data reward has been submitted and is currently in the fulfillment queue.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-foreground flex items-center gap-1.5">
                      <Users className="size-3.5 text-amber-500" />
                      <span>Referral Progress</span>
                    </span>
                    <span className="font-black text-amber-600 dark:text-amber-400 font-mono">
                      {completedCount} / 5 Friends Bought ({percentage}%)
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full h-3 rounded-full bg-muted overflow-hidden border border-border/80">
                    <div
                      className="h-full bg-gradient-to-r from-amber-500 via-orange-500 to-emerald-500 transition-all duration-500 rounded-full"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>

                  <p className="text-[11px] text-muted-foreground text-center">
                    Refer <strong>{Math.max(0, 5 - completedCount)} more</strong> friend{5 - completedCount !== 1 ? "s" : ""} who purchase from {agentStoreName} to unlock your 5GB!
                  </p>
                </div>
              )}

              {/* Promo Code Box */}
              {referralCode && (
                <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/15 via-orange-500/15 to-amber-500/15 border-2 border-amber-500/40 text-center space-y-1.5">
                  <span className="text-[11px] font-black uppercase tracking-wider text-amber-500 dark:text-amber-400">
                    Your Personal Promo Code
                  </span>
                  <div className="flex items-center justify-center gap-2">
                    <span className="font-mono text-2xl font-black text-foreground tracking-wider px-3.5 py-1 bg-background rounded-xl border border-border shadow-xs">
                      {referralCode}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleCopyCode}
                      className="h-9 px-3 rounded-xl text-xs font-bold gap-1 border-amber-500/40 text-amber-500 hover:bg-amber-500/10"
                    >
                      {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                      <span>{copied ? "Copied" : "Copy Code"}</span>
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Friends can enter this code at checkout or open your link below.
                  </p>
                </div>
              )}

              {/* Shareable Link Box */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">Your Referral Link:</Label>
                <div className="flex items-center gap-1.5">
                  <Input
                    readOnly
                    value={referralLink}
                    className="font-mono text-xs rounded-xl bg-muted/50 select-all"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCopyLink}
                    className="shrink-0 rounded-xl gap-1.5 text-xs font-bold"
                  >
                    {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                    <span>{copied ? "Copied" : "Copy"}</span>
                  </Button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <a
                  href={whatsappShareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-1.5 h-10 px-3 rounded-xl bg-green-600 hover:bg-green-500 text-white font-bold text-xs shadow-md transition-all"
                >
                  <Share2 className="size-3.5" />
                  <span>WhatsApp Share</span>
                </a>

                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCopyLink}
                  className="h-10 text-xs font-bold gap-1.5 rounded-xl border-border"
                >
                  <Copy className="size-3.5" />
                  <span>Copy Link</span>
                </Button>
              </div>

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => setReferralData(null)}
                  className="text-[11px] text-muted-foreground hover:text-foreground underline"
                >
                  Change MTN recipient number ({referralData.customer_phone})
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

