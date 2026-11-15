import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Download,
  Smartphone,
  CheckCircle2,
  ShieldCheck,
  Zap,
  Sparkles,
  Share2,
  Copy,
  Apple,
  PlusSquare,
  MoreHorizontal,
  ExternalLink
} from "lucide-react";
import { toast } from "sonner";
import { isAppInstalled, markAppInstalled } from "@/utils/appInstall";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  apkUrl?: string;
  shopName?: string;
}

export const InstallAppModal = ({ open, onOpenChange, apkUrl, shopName = "DATA 1 GH" }: Props) => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [activeTab, setActiveTab] = useState<"android" | "ios">("android");

  useEffect(() => {
    // Detect OS
    const ua = navigator.userAgent || "";
    const isIosDevice = /iphone|ipad|ipod/i.test(ua);
    if (isIosDevice) {
      setActiveTab("ios");
    } else {
      setActiveTab("android");
    }

    setIsInstalled(isAppInstalled());

    // Capture PWA install prompt
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      markAppInstalled("installed");
      setDeferredPrompt(null);
      toast.success(`${shopName} App installed successfully on your device!`);
    };

    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", handleAppInstalled);
    window.addEventListener("data1gh-app-installed", () => setIsInstalled(true));

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, [shopName]);

  const handlePwaInstall = async () => {
    if (deferredPrompt) {
      try {
        setInstalling(true);
        deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === "accepted") {
          setIsInstalled(true);
          markAppInstalled("installed");
          toast.success(`Installing ${shopName} app to your home screen...`);
          setTimeout(() => onOpenChange(false), 1200);
        }
        setDeferredPrompt(null);
      } catch (e: any) {
        toast.error("Install prompt error: " + (e?.message || "Please try again"));
      } finally {
        setInstalling(false);
      }
    } else {
      toast.info("Tip: Tap your browser's menu (⋮) and select 'Install app' or 'Add to Home screen'.");
    }
  };

  const directApkLink = (apkUrl || "").trim() || "/downloads/bigjaydata.apk";

  const handleDownloadApk = () => {
    toast.success("Starting Android APK download...");
    markAppInstalled("downloaded");
    const a = document.createElement("a");
    a.href = directApkLink;
    a.download = "BigJayData.apk";
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setTimeout(() => {
      onOpenChange(false);
    }, 1500);
  };

  const handleConfirmIosAdded = () => {
    markAppInstalled("ios_added");
    setIsInstalled(true);
    toast.success("Awesome! DATA 1 GH is saved to your home screen.");
    onOpenChange(false);
  };

  const handleConfirmAndroidAdded = () => {
    markAppInstalled("installed");
    setIsInstalled(true);
    toast.success("Great! App is marked as installed.");
    onOpenChange(false);
  };

  const copyAppShareLink = () => {
    const shareUrl = `${window.location.origin}/download-app`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      toast.success("App download link copied to clipboard!");
    }).catch(() => {
      toast.error("Could not copy link");
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-[94vw] p-0 overflow-hidden bg-card border-border/60 rounded-3xl shadow-2xl">
        {/* Header Hero Banner */}
        <div className="relative p-6 bg-gradient-to-br from-amber-500/20 via-primary/30 to-purple-500/20 border-b border-border/50 text-center">
          <div className="relative mx-auto size-20 rounded-2xl bg-white p-2 shadow-glow mb-3 flex items-center justify-center border-2 border-amber-400">
            <img
              src="/logo.png"
              alt={shopName}
              className="size-full object-contain rounded-xl"
            />
            <span className="absolute -top-2 -right-2 px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-black uppercase tracking-wider shadow">
              APP
            </span>
          </div>

          <DialogTitle className="text-xl md:text-2xl font-black text-foreground">
            {shopName} Mobile App
          </DialogTitle>
          <DialogDescription className="text-xs md:text-sm text-muted-foreground mt-1">
            Install the official mobile app for instant bundle purchases, real-time tracking, and exclusive discounts.
          </DialogDescription>

          <div className="mt-3 flex items-center justify-center gap-3 text-[11px] font-semibold text-muted-foreground">
            <span className="flex items-center gap-1 text-amber-400">
              <Sparkles className="size-3.5 fill-amber-400" /> 4.9 Rating
            </span>
            <span>•</span>
            <span className="flex items-center gap-1 text-emerald-400">
              <Zap className="size-3.5" /> Instant Delivery
            </span>
            <span>•</span>
            <span className="flex items-center gap-1 text-blue-400">
              <ShieldCheck className="size-3.5" /> 100% Safe
            </span>
          </div>
        </div>

        {/* Operating System Selector Tabs */}
        <div className="px-6 pt-4">
          <div className="grid grid-cols-2 p-1 rounded-2xl bg-muted/70 border border-border/60">
            <button
              type="button"
              onClick={() => setActiveTab("android")}
              className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
                activeTab === "android"
                  ? "bg-amber-500 text-black shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Smartphone className="size-4" />
              <span>Android (APK)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("ios")}
              className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
                activeTab === "ios"
                  ? "bg-amber-500 text-black shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Apple className="size-4" />
              <span>iPhone / iOS</span>
            </button>
          </div>
        </div>

        {/* Body Content */}
        <div className="p-6 pt-4 space-y-4 max-h-[65vh] overflow-y-auto">
          {isInstalled ? (
            <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-center space-y-2">
              <div className="flex items-center justify-center gap-2 text-emerald-400 font-bold text-sm">
                <CheckCircle2 className="size-5" /> App is Installed on Your Device!
              </div>
              <p className="text-xs text-muted-foreground">
                You can open {shopName} directly from your phone's home screen. The download prompt has been hidden.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="mt-2 text-xs rounded-xl"
              >
                Close
              </Button>
            </div>
          ) : activeTab === "android" ? (
            /* ANDROID TAB */
            <div className="space-y-4">
              <div className="space-y-2.5">
                {/* 1-Click Native App Install */}
                <Button
                  onClick={handlePwaInstall}
                  disabled={installing}
                  className="w-full h-12 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-extrabold text-sm shadow-glow transition-all hover:scale-[1.01] active:scale-[0.99] gap-2"
                >
                  <Smartphone className="size-4.5" />
                  {deferredPrompt ? "Install App (1-Click Instant)" : "Install App to Home Screen"}
                </Button>

                {/* Direct APK File Download Option */}
                <Button
                  variant="outline"
                  onClick={handleDownloadApk}
                  className="w-full h-11 rounded-2xl border-2 border-border/80 bg-muted/30 hover:bg-muted/60 font-bold text-xs text-foreground gap-2 transition-all hover:border-amber-500/50"
                >
                  <Download className="size-4 text-amber-400" />
                  Download Direct Android APK (.apk)
                </Button>
              </div>

              {/* Quick 3-Step Guide */}
              <div className="p-4 rounded-2xl bg-muted/40 border border-border/40 space-y-2">
                <div className="text-xs font-bold text-foreground flex items-center justify-between">
                  <span>How to install on Android:</span>
                  <span className="text-[10px] text-amber-400 font-mono">100% Free</span>
                </div>

                <div className="space-y-1.5 text-xs text-muted-foreground">
                  <div className="flex items-start gap-2">
                    <span className="size-4 rounded-full bg-amber-500/20 text-amber-400 font-bold grid place-items-center text-[10px] shrink-0 mt-0.5">1</span>
                    <span>Tap <strong>Install App</strong> or <strong>Download Direct APK</strong> above.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="size-4 rounded-full bg-amber-500/20 text-amber-400 font-bold grid place-items-center text-[10px] shrink-0 mt-0.5">2</span>
                    <span>Tap <strong>Confirm / Install</strong> when prompted by your phone.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="size-4 rounded-full bg-amber-500/20 text-amber-400 font-bold grid place-items-center text-[10px] shrink-0 mt-0.5">3</span>
                    <span>Launch from your home screen and buy data with zero wait time!</span>
                  </div>
                </div>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleConfirmAndroidAdded}
                className="w-full text-xs text-muted-foreground hover:text-emerald-400"
              >
                ✓ I've already installed / downloaded it
              </Button>
            </div>
          ) : (
            /* IOS TAB (Matching User's Exact Voice Instructions) */
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-500/10 via-amber-500/10 to-purple-500/10 border-2 border-amber-500/30 space-y-3">
                <div className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                  <Apple className="size-4 text-amber-400" />
                  <span>How to Add to Home Screen in Safari:</span>
                </div>

                <div className="space-y-3 text-xs text-foreground/90">
                  {/* Step 1 */}
                  <div className="flex items-start gap-2.5">
                    <span className="size-5 rounded-full bg-amber-500 text-black font-black grid place-items-center text-[11px] shrink-0 mt-0.5">
                      1
                    </span>
                    <div>
                      <p className="font-semibold text-foreground">
                        Tap the <strong>Share</strong> button or <strong>three dots (•••)</strong>
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        In Safari, look at the bottom bar and tap the <strong>Share icon</strong> (a box with an arrow pointing up 📤) or the <strong>three dots</strong> at the bottom-right corner.
                      </p>
                    </div>
                  </div>

                  {/* Step 2 */}
                  <div className="flex items-start gap-2.5">
                    <span className="size-5 rounded-full bg-amber-500 text-black font-black grid place-items-center text-[11px] shrink-0 mt-0.5">
                      2
                    </span>
                    <div>
                      <p className="font-semibold text-foreground">
                        Tap <strong>Share</strong> (or <strong>View More</strong>)
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        If using the menu, select <strong>Share</strong> or <strong>View More</strong> to see all actions.
                      </p>
                    </div>
                  </div>

                  {/* Step 3 */}
                  <div className="flex items-start gap-2.5">
                    <span className="size-5 rounded-full bg-amber-500 text-black font-black grid place-items-center text-[11px] shrink-0 mt-0.5">
                      3
                    </span>
                    <div>
                      <p className="font-semibold text-foreground">
                        Scroll down and tap <strong>"Add to Home Screen"</strong>
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Look for the option with the plus icon <PlusSquare className="inline size-3.5 text-amber-400" /> labeled <strong>"Add to Home Screen"</strong>.
                      </p>
                    </div>
                  </div>

                  {/* Step 4 */}
                  <div className="flex items-start gap-2.5">
                    <span className="size-5 rounded-full bg-amber-500 text-black font-black grid place-items-center text-[11px] shrink-0 mt-0.5">
                      4
                    </span>
                    <div>
                      <p className="font-semibold text-foreground">
                        Tap <strong>"Add"</strong> at the top right
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Confirm by tapping <strong>Add</strong> in the top-right corner. The {shopName} icon will appear directly on your iPhone home screen!
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Confirmation Button */}
              <Button
                onClick={handleConfirmIosAdded}
                className="w-full h-12 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-extrabold text-sm shadow-md gap-2"
              >
                <CheckCircle2 className="size-4.5" />
                ✓ I've Added It to My Home Screen
              </Button>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-2 border-t border-border/40">
            <button
              type="button"
              onClick={copyAppShareLink}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors font-medium"
            >
              <Copy className="size-3.5" /> Share App Link
            </button>

            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
