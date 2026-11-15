import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { X, Sparkles, TrendingUp, Zap, Wallet, Store, ArrowRight, ShieldCheck, CheckCircle2 } from "lucide-react";

interface AgentPromoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AgentPromoModal: React.FC<AgentPromoModalProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();

  if (!isOpen) return null;

  const handleRegister = () => {
    onClose();
    navigate("/agent/register");
  };

  const handleLogin = () => {
    onClose();
    navigate("/agent/login");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
      <div 
        className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-cyan-500/40 bg-gradient-to-b from-zinc-950 via-zinc-900 to-black text-white shadow-[0_0_50px_rgba(6,182,212,0.25)]"
        role="dialog"
        aria-modal="true"
      >
        {/* Top vibrant glowing neon bar */}
        <div className="h-2 w-full bg-gradient-to-r from-cyan-400 via-emerald-400 to-blue-500" />

        {/* Ambient background glow */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 size-60 rounded-full bg-cyan-500/15 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 size-60 rounded-full bg-emerald-500/15 blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 z-10 size-9 rounded-full bg-white/10 hover:bg-white/20 text-zinc-300 hover:text-white flex items-center justify-center transition-all active:scale-95"
          aria-label="Close"
        >
          <X className="size-4" />
        </button>

        <div className="p-6 md:p-8 space-y-5">
          {/* Badge & Title */}
          <div className="space-y-2 text-center">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 text-xs font-black uppercase tracking-wider shadow-sm">
              <Sparkles className="size-3.5 text-cyan-400" />
              <span>Reseller / Agent Opportunity</span>
            </div>

            <h2 className="text-2xl md:text-3xl font-black tracking-tight text-white">
              Become a <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-emerald-300 to-teal-200">Data1gh Agent</span>
            </h2>

            <p className="text-xs md:text-sm text-zinc-300 max-w-md mx-auto leading-relaxed">
              Start your own automated data business in seconds. Sell MTN, Telecel &amp; AT data bundles at your own chosen prices and keep 100% of the profits!
            </p>
          </div>

          {/* Benefits Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            <div className="p-3 rounded-2xl bg-white/[0.04] border border-white/10 flex items-start gap-2.5">
              <div className="size-8 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0 mt-0.5">
                <TrendingUp className="size-4" />
              </div>
              <div className="text-left">
                <div className="text-xs font-bold text-white">Set Your Own Prices</div>
                <div className="text-[11px] text-zinc-400">Control your profit margins on every single gigabyte sold.</div>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-white/[0.04] border border-white/10 flex items-start gap-2.5">
              <div className="size-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
                <Zap className="size-4" />
              </div>
              <div className="text-left">
                <div className="text-xs font-bold text-white">100% Auto-Fulfillment</div>
                <div className="text-[11px] text-zinc-400">Bundles deliver instantly via Data1gh infrastructure.</div>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-white/[0.04] border border-white/10 flex items-start gap-2.5">
              <div className="size-8 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
                <Wallet className="size-4" />
              </div>
              <div className="text-left">
                <div className="text-xs font-bold text-white">Instant MoMo Payouts</div>
                <div className="text-[11px] text-zinc-400">Withdraw your profits anytime directly to your Mobile Money.</div>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-white/[0.04] border border-white/10 flex items-start gap-2.5">
              <div className="size-8 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0 mt-0.5">
                <Store className="size-4" />
              </div>
              <div className="text-left">
                <div className="text-xs font-bold text-white">Your Branded Storefront</div>
                <div className="text-[11px] text-zinc-400">Get a free shareable link (e.g. gooddata1.vercel.app/s/yourname).</div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2.5 pt-2">
            <Button
              type="button"
              onClick={handleRegister}
              className="w-full h-12 rounded-2xl bg-gradient-to-r from-cyan-500 via-teal-500 to-emerald-500 hover:opacity-95 text-black font-black text-sm tracking-wide shadow-[0_0_25px_rgba(6,182,212,0.35)] flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
            >
              <span>Create Free Agent Account</span>
              <ArrowRight className="size-4" />
            </Button>

            <div className="flex items-center justify-between gap-3 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleLogin}
                className="flex-1 h-9 rounded-xl border-white/15 bg-white/5 hover:bg-white/10 text-xs font-bold text-zinc-200"
              >
                Already an Agent? Sign In
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="h-9 px-3 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white hover:bg-white/5"
              >
                Skip for now
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
