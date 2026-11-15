import React, { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  X,
  Home,
  Film,
  PhoneCall,
  Headphones,
  MessageCircle,
  Gift,
  Sparkles,
  Search,
  Radio,
  Download,
  ChevronRight,
  ExternalLink,
  ShieldCheck,
  Zap,
  Store,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export interface SiteMenuDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  shopName: string;
  botHref: string;
  channelHref: string;
  onPlayIntro: () => void;
  onOpenCall: () => void;
  onOpenSupport: () => void;
  onOpenReferral: () => void;
  onOpenSpin?: () => void;
  spinEnabled?: boolean;
  onOpenFreeData?: () => void;
  freeDataEnabled?: boolean;
  onOpenAppDownload?: () => void;
  appInstalled?: boolean;
}

export const SiteMenuDrawer: React.FC<SiteMenuDrawerProps> = ({
  isOpen,
  onClose,
  shopName,
  botHref,
  channelHref,
  onPlayIntro,
  onOpenCall,
  onOpenSupport,
  onOpenReferral,
  onOpenSpin,
  spinEnabled,
  onOpenFreeData,
  freeDataEnabled,
  onOpenAppDownload,
  appInstalled,
}) => {
  const navigate = useNavigate();

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const handleNavigate = (path: string) => {
    onClose();
    if (window.location.pathname === path) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      navigate(path);
    }
  };

  return (
    <>
      {/* Dimmed backdrop */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Close menu backdrop"
        onClick={onClose}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") onClose();
        }}
        className={`fixed inset-0 z-50 bg-black/75 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      />

      {/* Slide-out Drawer */}
      <aside
        aria-label="Site Navigation Menu"
        aria-hidden={!isOpen}
        className={`fixed inset-y-0 right-0 z-50 w-full sm:w-[390px] bg-zinc-950/95 border-l border-white/10 text-white shadow-2xl flex flex-col transition-transform duration-300 ease-out backdrop-blur-2xl ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-zinc-900/40">
          <div className="flex items-center gap-2.5">
            <img
              src="/logo.png"
              alt={shopName}
              className="size-9 rounded-xl object-contain bg-white p-1 border border-white/10 shadow-sm"
            />
            <div>
              <div className="font-black text-base tracking-tight leading-tight">{shopName}</div>
              <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-semibold">
                <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>24/7 Automated Shop</span>
              </div>
            </div>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="size-9 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 active:scale-95 transition-all"
            aria-label="Close menu"
          >
            <X className="size-5" />
          </Button>
        </div>

        {/* Drawer Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 overscroll-contain">
          {/* Main Navigation Links */}
          <div className="space-y-1.5">
            {/* 1. Home Page */}
            <button
              type="button"
              onClick={() => handleNavigate("/")}
              className="w-full flex items-center justify-between p-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 hover:border-white/15 transition-all group text-left"
            >
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform">
                  <Home className="size-5" />
                </div>
                <div>
                  <div className="font-bold text-sm text-white group-hover:text-emerald-400 transition-colors">
                    Home Page
                  </div>
                  <div className="text-xs text-zinc-400">Browse all network data bundles</div>
                </div>
              </div>
              <ChevronRight className="size-4 text-zinc-500 group-hover:text-white transition-colors" />
            </button>

            {/* Agent / Reseller Portal */}
            <button
              type="button"
              onClick={() => handleNavigate("/agent")}
              className="w-full flex items-center justify-between p-3 rounded-2xl bg-cyan-500/[0.08] hover:bg-cyan-500/[0.14] border border-cyan-500/25 hover:border-cyan-500/45 transition-all group text-left"
            >
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-300 group-hover:scale-105 transition-transform shadow-[0_0_15px_rgba(6,182,212,0.25)]">
                  <Store className="size-5" />
                </div>
                <div>
                  <div className="font-bold text-sm text-cyan-200 group-hover:text-cyan-100 transition-colors flex items-center gap-1.5">
                    Agent / Reseller Portal
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      Earn Profit
                    </span>
                  </div>
                  <div className="text-xs text-cyan-200/70">Start your data business &amp; earn daily</div>
                </div>
              </div>
              <ChevronRight className="size-4 text-cyan-400/60 group-hover:text-cyan-300 transition-colors" />
            </button>

            {/* 2. Play Intro Video */}
            <button
              type="button"
              onClick={() => {
                onClose();
                onPlayIntro();
              }}
              className="w-full flex items-center justify-between p-3 rounded-2xl bg-amber-500/[0.06] hover:bg-amber-500/[0.12] border border-amber-500/20 hover:border-amber-500/40 transition-all group text-left"
            >
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 group-hover:scale-105 transition-transform">
                  <Film className="size-5" />
                </div>
                <div>
                  <div className="font-bold text-sm text-amber-300 group-hover:text-amber-200 transition-colors flex items-center gap-1.5">
                    Play Intro Video
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-black uppercase bg-amber-500/20 text-amber-400 border border-amber-500/30">
                      Watch
                    </span>
                  </div>
                  <div className="text-xs text-amber-200/70">Watch our welcome video & overview</div>
                </div>
              </div>
              <ChevronRight className="size-4 text-amber-400/60 group-hover:text-amber-300 transition-colors" />
            </button>

            {/* 3. Customer Support */}
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenSupport();
              }}
              className="w-full flex items-center justify-between p-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 hover:border-white/15 transition-all group text-left"
            >
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400 group-hover:scale-105 transition-transform">
                  <Headphones className="size-5" />
                </div>
                <div>
                  <div className="font-bold text-sm text-white group-hover:text-sky-400 transition-colors">
                    Customer Support
                  </div>
                  <div className="text-xs text-zinc-400">24/7 Live chat & instant help desk</div>
                </div>
              </div>
              <ChevronRight className="size-4 text-zinc-500 group-hover:text-white transition-colors" />
            </button>

            {/* 4. Phone Call / Voice Call Assistant */}
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenCall();
              }}
              className="w-full flex items-center justify-between p-3 rounded-2xl bg-emerald-500/[0.06] hover:bg-emerald-500/[0.12] border border-emerald-500/20 hover:border-emerald-500/40 transition-all group text-left"
            >
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform animate-pulse">
                  <PhoneCall className="size-5" />
                </div>
                <div>
                  <div className="font-bold text-sm text-emerald-300 group-hover:text-emerald-200 transition-colors flex items-center gap-1.5">
                    Phone Call / Voice Agent
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      Live
                    </span>
                  </div>
                  <div className="text-xs text-emerald-200/70">Direct call & AI phone order agent</div>
                </div>
              </div>
              <ChevronRight className="size-4 text-emerald-400/60 group-hover:text-emerald-300 transition-colors" />
            </button>

            {/* 5. WhatsApp Bot */}
            <a
              href={botHref}
              target="_blank"
              rel="noreferrer"
              onClick={onClose}
              className="w-full flex items-center justify-between p-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 hover:border-white/15 transition-all group text-left"
            >
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform">
                  <MessageCircle className="size-5" />
                </div>
                <div>
                  <div className="font-bold text-sm text-white group-hover:text-emerald-400 transition-colors flex items-center gap-1.5">
                    WhatsApp Bot
                    <ExternalLink className="size-3 text-zinc-500" />
                  </div>
                  <div className="text-xs text-zinc-400">Order directly with minimal data usage</div>
                </div>
              </div>
              <ChevronRight className="size-4 text-zinc-500 group-hover:text-white transition-colors" />
            </a>

            {/* 6. Invite Friends & Win */}
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenReferral();
              }}
              className="w-full flex items-center justify-between p-3 rounded-2xl bg-purple-500/[0.06] hover:bg-purple-500/[0.12] border border-purple-500/20 hover:border-purple-500/40 transition-all group text-left"
            >
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400 group-hover:scale-105 transition-transform">
                  <Gift className="size-5" />
                </div>
                <div>
                  <div className="font-bold text-sm text-purple-300 group-hover:text-purple-200 transition-colors flex items-center gap-1.5">
                    Invite Friends & Win
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-black uppercase bg-purple-500/20 text-purple-400 border border-purple-500/30">
                      Rewards
                    </span>
                  </div>
                  <div className="text-xs text-purple-200/70">Share your link to earn instant commissions</div>
                </div>
              </div>
              <ChevronRight className="size-4 text-purple-400/60 group-hover:text-purple-300 transition-colors" />
            </button>

            {/* 7. Other Services */}
            <button
              type="button"
              onClick={() => handleNavigate("/services")}
              className="w-full flex items-center justify-between p-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 hover:border-white/15 transition-all group text-left"
            >
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-pink-500/15 border border-pink-500/30 flex items-center justify-center text-pink-400 group-hover:scale-105 transition-transform">
                  <Sparkles className="size-5" />
                </div>
                <div>
                  <div className="font-bold text-sm text-white group-hover:text-pink-400 transition-colors">
                    Other Services
                  </div>
                  <div className="text-xs text-zinc-400">Netflix, Result Checkers, AFA, Mashup</div>
                </div>
              </div>
              <ChevronRight className="size-4 text-zinc-500 group-hover:text-white transition-colors" />
            </button>

            {/* 8. Track Order */}
            <button
              type="button"
              onClick={() => handleNavigate("/track")}
              className="w-full flex items-center justify-between p-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 hover:border-white/15 transition-all group text-left"
            >
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 group-hover:scale-105 transition-transform">
                  <Search className="size-5" />
                </div>
                <div>
                  <div className="font-bold text-sm text-white group-hover:text-amber-400 transition-colors">
                    Track My Order
                  </div>
                  <div className="text-xs text-zinc-400">Check delivery status with reference or phone</div>
                </div>
              </div>
              <ChevronRight className="size-4 text-zinc-500 group-hover:text-white transition-colors" />
            </button>

            {/* Spin Game (if enabled) */}
            {spinEnabled && onOpenSpin && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenSpin();
                }}
                className="w-full flex items-center justify-between p-3 rounded-2xl bg-accent/10 hover:bg-accent/20 border border-accent/30 hover:border-accent/50 transition-all group text-left animate-pulse"
              >
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-accent/20 border border-accent/40 flex items-center justify-center text-accent">
                    <Sparkles className="size-5" />
                  </div>
                  <div>
                    <div className="font-bold text-sm text-accent">Spin & Win Lucky Wheel</div>
                    <div className="text-xs text-zinc-400">Win free gigabytes instantly</div>
                  </div>
                </div>
                <ChevronRight className="size-4 text-accent" />
              </button>
            )}

            {/* Free Data (if enabled) */}
            {freeDataEnabled && onOpenFreeData && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenFreeData();
                }}
                className="w-full flex items-center justify-between p-3 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 hover:border-amber-500/50 transition-all group text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                    <Gift className="size-5" />
                  </div>
                  <div>
                    <div className="font-bold text-sm text-amber-300">Free Data Voucher</div>
                    <div className="text-xs text-zinc-400">Claim your free promotional package</div>
                  </div>
                </div>
                <ChevronRight className="size-4 text-amber-400" />
              </button>
            )}

            {/* Download App (if not installed) */}
            {!appInstalled && onOpenAppDownload && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenAppDownload();
                }}
                className="w-full flex items-center justify-between p-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 hover:border-white/15 transition-all group text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-white">
                    <Download className="size-5 text-amber-400" />
                  </div>
                  <div>
                    <div className="font-bold text-sm text-white">Download Android / iOS App</div>
                    <div className="text-xs text-zinc-400">Fast 1-tap home screen access</div>
                  </div>
                </div>
                <ChevronRight className="size-4 text-zinc-500 group-hover:text-white transition-colors" />
              </button>
            )}
          </div>

          {/* Join WhatsApp Channel Featured Banner in Menu */}
          <div className="pt-2">
            <a
              href={channelHref}
              target="_blank"
              rel="noreferrer"
              onClick={onClose}
              className="block p-4 rounded-2xl bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 text-white shadow-xl hover:shadow-emerald-900/40 border border-emerald-500/40 hover:scale-[1.01] active:scale-[0.99] transition-all group text-left"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="flex items-center gap-2 font-black text-sm uppercase tracking-wider text-emerald-200">
                  <Radio className="size-4 text-white animate-pulse" /> Official Channel
                </span>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-white/20 text-white">
                  Join
                </span>
              </div>
              <div className="font-black text-base leading-tight mb-1">
                Join our WhatsApp Channel
              </div>
              <div className="text-xs text-emerald-100/80 leading-relaxed">
                Stay updated with instant delivery notifications, promos, and restock alerts.
              </div>
            </a>
          </div>
        </div>

        {/* Drawer Footer */}
        <div className="p-4 border-t border-white/10 bg-zinc-900/40 text-center">
          <div className="flex items-center justify-center gap-1.5 text-xs text-zinc-400 font-medium">
            <ShieldCheck className="size-4 text-emerald-400" />
            <span>Instant & Secure Telecom Dispatch</span>
          </div>
        </div>
      </aside>
    </>
  );
};
