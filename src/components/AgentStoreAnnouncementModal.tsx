import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Sparkles, Megaphone, ArrowRight, X, ExternalLink, Flame } from "lucide-react";

export interface AgentAnnouncementPopupData {
  enabled?: boolean;
  title?: string;
  message?: string;
  badge?: string;
  ctaText?: string;
  ctaUrl?: string;
}

interface AgentStoreAnnouncementModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  message?: string;
  badge?: string;
  ctaText?: string;
  ctaUrl?: string;
  storeName?: string;
  logoUrl?: string;
  themeId?: string;
  onCtaClick?: () => void;
  isDashboardPreview?: boolean;
}

export const AgentStoreAnnouncementModal: React.FC<AgentStoreAnnouncementModalProps> = ({
  open,
  onOpenChange,
  title,
  message,
  badge,
  ctaText,
  ctaUrl,
  storeName = "Special Store Update",
  logoUrl,
  onCtaClick,
  isDashboardPreview = false,
}) => {
  const displayTitle = title?.trim() || "Exclusive Store Offer & Announcement";
  const displayBadge = badge?.trim() || "⚡ Special Offer";
  const displayMessage =
    message?.trim() ||
    "Welcome to our official data bundle store! Enjoy instant 24/7 delivery on MTN, Telecel, and AT bundles.";
  const displayCta = ctaText?.trim() || "Shop Bundles Now";

  const handleCta = () => {
    onOpenChange(false);
    if (onCtaClick) {
      onCtaClick();
      return;
    }
    if (ctaUrl && ctaUrl.trim()) {
      const target = ctaUrl.trim();
      if (target.startsWith("#")) {
        const el = document.querySelector(target);
        if (el) {
          el.scrollIntoView({ behavior: "smooth" });
          return;
        }
      } else if (target.startsWith("http://") || target.startsWith("https://")) {
        window.open(target, "_blank", "noopener,noreferrer");
        return;
      }
    }
    // Default fallback: scroll to data bundles section
    const bundleEl = document.getElementById("data-bundles") || document.getElementById("store-products");
    if (bundleEl) {
      bundleEl.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[92vw] max-w-md sm:max-w-lg p-0 border border-cyan-500/30 bg-gradient-to-b from-zinc-950 via-zinc-900 to-black text-white shadow-[0_20px_70px_-15px_rgba(6,182,212,0.35)] rounded-3xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Glow ambient background effects */}
        <div className="absolute -top-24 -left-24 size-48 rounded-full bg-cyan-500/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 size-48 rounded-full bg-teal-500/20 blur-3xl pointer-events-none" />

        {/* Header Ribbon / Banner */}
        <div className="relative pt-6 px-6 pb-2">
          {isDashboardPreview && (
            <div className="mb-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
              <Flame className="size-3.5 animate-pulse" />
              <span>Dashboard Test Preview (What customers see)</span>
            </div>
          )}

          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-gradient-to-r from-cyan-500/25 to-teal-500/25 text-cyan-300 border border-cyan-400/40 shadow-sm">
              <Sparkles className="size-3.5 text-cyan-400 animate-spin" />
              <span>{displayBadge}</span>
            </div>

            {logoUrl && (
              <img
                src={logoUrl}
                alt={storeName}
                className="size-8 rounded-full object-cover border border-cyan-500/40 shadow-sm"
              />
            )}
          </div>

          <DialogHeader className="text-left space-y-1.5">
            <DialogTitle className="text-xl sm:text-2xl font-black tracking-tight leading-snug bg-gradient-to-r from-white via-cyan-100 to-cyan-300 bg-clip-text text-transparent">
              {displayTitle}
            </DialogTitle>
            <p className="text-[11px] font-semibold text-zinc-400 flex items-center gap-1">
              <Megaphone className="size-3 text-cyan-400" />
              <span>Announcement from {storeName}</span>
            </p>
          </DialogHeader>
        </div>

        {/* Body Content */}
        <div className="px-6 py-3">
          <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10 text-zinc-200 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap max-h-56 overflow-y-auto">
            {displayMessage}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-6 pt-2 space-y-2.5 bg-black/40 border-t border-white/5">
          <button
            type="button"
            onClick={handleCta}
            className="w-full py-3.5 px-5 rounded-2xl font-black text-sm bg-gradient-to-r from-cyan-500 via-teal-500 to-cyan-600 hover:from-cyan-400 hover:to-teal-400 text-slate-950 shadow-[0_0_25px_rgba(6,182,212,0.5)] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            <span>{displayCta}</span>
            {ctaUrl && (ctaUrl.startsWith("http://") || ctaUrl.startsWith("https://")) ? (
              <ExternalLink className="size-4" />
            ) : (
              <ArrowRight className="size-4" />
            )}
          </button>

          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="w-full py-2 text-center text-xs font-semibold text-zinc-400 hover:text-white transition-colors"
          >
            Dismiss &amp; continue browsing
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

