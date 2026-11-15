import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Store, ArrowRight, ShieldCheck, Search, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const AgentDomainGate: React.FC = () => {
  const [storeHandle, setStoreHandle] = useState("");
  const navigate = useNavigate();

  const handleGoToStore = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = storeHandle.trim().toLowerCase().replace(/^https?:\/\/[^/]+\/(s\/)?/i, "").replace(/^\/+/, "");
    if (clean) {
      navigate(`/s/${clean}`);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden flex flex-col items-center justify-center p-4 sm:p-6 selection:bg-cyan-500 selection:text-black">
      {/* Ambient background glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 size-[500px] rounded-full bg-cyan-500/10 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 size-[400px] rounded-full bg-emerald-500/10 blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md space-y-6 relative z-10 text-center">
        {/* Brand Badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/15 border border-cyan-400/30 text-cyan-300 text-xs font-black uppercase tracking-wider shadow-sm">
          <ShieldCheck className="size-3.5 text-cyan-400" />
          <span>Data1gh Network</span>
        </div>

        {/* Card */}
        <div className="p-6 sm:p-8 rounded-3xl border border-cyan-500/20 bg-zinc-950/90 backdrop-blur-2xl text-white shadow-[0_8px_40px_rgba(6,182,212,0.15)] space-y-5">
          <div className="size-14 rounded-2xl bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 flex items-center justify-center mx-auto shadow-[0_0_20px_rgba(6,182,212,0.25)]">
            <Lock className="size-7" />
          </div>

          <div className="space-y-2">
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
              Agent Store Link Required
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
              This portal hosts independent, verified telecom reseller storefronts. To browse packages and purchase data bundles, please access via your agent&apos;s direct store link.
            </p>
          </div>

          {/* Enter Store Name Form */}
          <form onSubmit={handleGoToStore} className="space-y-3 pt-2 text-left">
            <label htmlFor="store_handle" className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
              <Search className="size-3.5 text-cyan-400" />
              <span>Know your agent&apos;s store handle?</span>
            </label>
            <div className="flex gap-2">
              <Input
                id="store_handle"
                type="text"
                placeholder="e.g. km-express"
                value={storeHandle}
                onChange={(e) => setStoreHandle(e.target.value)}
                className="bg-white/[0.05] border-white/15 focus-visible:ring-cyan-500 text-white placeholder:text-zinc-600 rounded-xl text-xs font-mono"
              />
              <Button
                type="submit"
                disabled={!storeHandle.trim()}
                className="bg-gradient-to-r from-cyan-500 to-emerald-500 text-black font-black text-xs rounded-xl px-4 hover:opacity-90 transition-all shrink-0"
              >
                <span>Go</span>
                <ArrowRight className="size-3.5 ml-1" />
              </Button>
            </div>
            <p className="text-[11px] text-zinc-500">
              Format: <code>gooddata1.vercel.app/s/store-name</code>
            </p>
          </form>

          {/* Divider */}
          <div className="border-t border-white/10 pt-4 flex flex-col gap-2">
            <div className="text-xs text-zinc-400">
              Are you an authorized agent?
            </div>
            <Button
              asChild
              variant="outline"
              className="w-full h-10 rounded-xl border-white/15 bg-white/5 hover:bg-white/10 text-white text-xs font-bold transition-all"
            >
              <Link to="/agent/login" className="flex items-center justify-center gap-2">
                <Store className="size-3.5 text-cyan-400" />
                <span>Log in to Agent Dashboard</span>
              </Link>
            </Button>
          </div>
        </div>

        {/* Footer */}
        <p className="text-[11px] text-zinc-600 font-mono">
          Powered by Data1gh Infrastructure
        </p>
      </div>
    </div>
  );
};

export default AgentDomainGate;
