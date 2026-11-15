import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { fetchShopDataCached, getCachedShopData } from "@/lib/storeCache";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Download,
  Smartphone,
  CheckCircle2,
  ShieldCheck,
  Zap,
  Sparkles,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Share2,
  Copy,
  Receipt,
  MessageCircle,
  HelpCircle,
  Apple,
  PlusSquare
} from "lucide-react";
import { toast } from "sonner";
import { supabase, invokeApiFunction } from "@/integrations/supabase/client";
import { isAppInstalled, markAppInstalled } from "@/utils/appInstall";

export default function DownloadApp() {
  const cached = getCachedShopData();
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [shopName, setShopName] = useState(cached?.settings?.shop_name || "DATA 1 GH");
  const [apkUrl, setApkUrl] = useState(cached?.settings?.apk_download_url || "");
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"android" | "ios">("android");

  useEffect(() => {
    document.title = `Download ${shopName} Mobile App (Android & iPhone)`;

    // Detect OS
    const ua = navigator.userAgent || "";
    if (/iphone|ipad|ipod/i.test(ua)) {
      setActiveTab("ios");
    } else {
      setActiveTab("android");
    }

    setIsInstalled(isAppInstalled());

    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      markAppInstalled("installed");
      setDeferredPrompt(null);
      toast.success("App installed successfully on your device!");
    };

    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", handleAppInstalled);
    window.addEventListener("data1gh-app-installed", () => setIsInstalled(true));

    // Load settings from device cache (avoids egress)
    (async () => {
      try {
        const { settings: m } = await fetchShopDataCached();
        if (m.shop_name) setShopName(m.shop_name);
        if (m.apk_download_url) setApkUrl(m.apk_download_url);
      } catch (_) {}
    })();

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
          toast.success("Installing Data One to home screen...");
        }
        setDeferredPrompt(null);
      } catch (e: any) {
        toast.error("Install prompt error: " + (e?.message || "Please try again"));
      } finally {
        setInstalling(false);
      }
    } else {
      toast.info("Tap the menu icon (⋮) in your mobile browser and select 'Install app' or 'Add to Home Screen'.");
    }
  };

  const directApkLink = (apkUrl || "").trim() || "/downloads/data1gh.apk";

  const handleDownloadApk = () => {
    toast.success("Starting APK download...");
    markAppInstalled("downloaded");
    setIsInstalled(true);
    const a = document.createElement("a");
    a.href = directApkLink;
    a.download = "DataOne.apk";
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleConfirmIosAdded = () => {
    markAppInstalled("ios_added");
    setIsInstalled(true);
    toast.success("Awesome! Data One is saved to your iPhone home screen.");
  };

  const handleConfirmAndroidAdded = () => {
    markAppInstalled("installed");
    setIsInstalled(true);
    toast.success("Great! App is marked as installed on your phone.");
  };

  const copyShare = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      toast.success("Download link copied!");
    });
  };

  const faqs = [
    {
      q: "How do I install on iPhone or iPad (iOS)?",
      a: "Open this site in Safari, tap the Share button (or the three dots ••• at the bottom right), tap Share / View More, scroll down and tap 'Add to Home Screen', then tap 'Add' in the top-right corner. The app icon will appear instantly on your iPhone screen!"
    },
    {
      q: "How do I install the app on Android?",
      a: "Simply tap 'Install App (1-Click)' at the top of this page! Your browser will immediately add the official Data One app to your Android home screen with zero file download required. Alternatively, you can tap 'Download Direct Android APK' to install the APK file."
    },
    {
      q: "My Android phone says 'File might be harmful' when downloading APK. What should I do?",
      a: "This is a standard Android security notice whenever downloading an app outside the Google Play Store. It is 100% safe. Tap 'Download anyway', open the file, and tap 'Install'."
    },
    {
      q: "Can I use the app to buy MTN, Telecel, and AirtelTigo data?",
      a: "Yes! The mobile app gives you 1-tap access to all network bundles, instant MoMo checkout, real-time order tracking, and live customer support."
    }
  ];

  return (
    <div className="dark min-h-screen bg-[#0a0d14] text-foreground flex flex-col">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border/50 px-4 py-3.5 flex items-center justify-between">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
          <span>Back to Store</span>
        </Link>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={copyShare} className="text-xs gap-1.5 h-8">
            <Share2 className="size-3.5" />
            <span className="hidden sm:inline">Share</span>
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-xl mx-auto w-full px-4 py-8 space-y-6">
        {/* Hero Section */}
        <div className="text-center space-y-3">
          <div className="relative mx-auto size-24 rounded-3xl bg-white p-2.5 shadow-glow flex items-center justify-center border-2 border-amber-400">
            <img
              src="/logo.png"
              alt={shopName}
              className="size-full object-contain rounded-2xl"
            />
            <span className="absolute -top-2 -right-2 px-2.5 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-black uppercase tracking-wider shadow">
              OFFICIAL
            </span>
          </div>

          <div>
            <h1 className="text-3xl font-black text-foreground">
              {shopName} Mobile App
            </h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
              Get the ultra-fast mobile shopping experience for Android & iPhone. Enjoy zero delay checkout, real-time delivery status, and automatic receipts.
            </p>
          </div>

          <div className="flex items-center justify-center gap-3 text-xs font-semibold text-muted-foreground pt-1">
            <span className="flex items-center gap-1 text-amber-400">
              <Sparkles className="size-4 fill-amber-400" /> 4.9 Rating
            </span>
            <span>•</span>
            <span className="flex items-center gap-1 text-emerald-400">
              <Zap className="size-4" /> Instant Delivery
            </span>
            <span>•</span>
            <span className="flex items-center gap-1 text-blue-400">
              <ShieldCheck className="size-4" /> 100% Secure
            </span>
          </div>
        </div>

        {/* Operating System Selector Tabs */}
        <div className="grid grid-cols-2 p-1.5 rounded-2xl bg-muted/60 border border-border/60">
          <button
            type="button"
            onClick={() => setActiveTab("android")}
            className={`py-2.5 px-4 rounded-xl font-bold text-xs md:text-sm flex items-center justify-center gap-2 transition-all ${
              activeTab === "android"
                ? "bg-amber-500 text-black shadow-md"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Smartphone className="size-4.5" />
            <span>Android (APK)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("ios")}
            className={`py-2.5 px-4 rounded-xl font-bold text-xs md:text-sm flex items-center justify-center gap-2 transition-all ${
              activeTab === "ios"
                ? "bg-amber-500 text-black shadow-md"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Apple className="size-4.5" />
            <span>iPhone / iOS</span>
          </button>
        </div>

        {/* Download / Install Buttons Card */}
        <Card className="p-6 bg-gradient-card border-border/70 rounded-3xl shadow-xl space-y-4">
          {isInstalled ? (
            <div className="p-5 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-center space-y-2">
              <div className="flex items-center justify-center gap-2 text-emerald-400 font-bold text-base">
                <CheckCircle2 className="size-5" /> App is Installed on Your Device!
              </div>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                You have added {shopName} to your home screen. The download banners on the store are now hidden for you.
              </p>
              <Button asChild size="sm" className="mt-2 text-xs rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white">
                <Link to="/">Open Storefront</Link>
              </Button>
            </div>
          ) : activeTab === "android" ? (
            /* ANDROID OPTIONS */
            <div className="space-y-3">
              <Button
                onClick={handlePwaInstall}
                disabled={installing}
                className="w-full h-14 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-extrabold text-base shadow-glow transition-all hover:scale-[1.01] active:scale-[0.99] gap-2.5"
              >
                <Smartphone className="size-5" />
                {deferredPrompt ? "Install App (1-Click Instant)" : "Install App to Home Screen"}
              </Button>

              <Button
                variant="outline"
                onClick={handleDownloadApk}
                className="w-full h-13 rounded-2xl border-2 border-border/80 bg-muted/30 hover:bg-muted/60 font-bold text-sm text-foreground gap-2 transition-all hover:border-amber-500/50"
              >
                <Download className="size-4 text-amber-400" />
                Download Direct Android APK (.apk)
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleConfirmAndroidAdded}
                className="w-full text-xs text-muted-foreground hover:text-emerald-400"
              >
                ✓ I've already installed / downloaded it
              </Button>

              <div className="text-center pt-1">
                <span className="text-xs text-muted-foreground">
                  Compatible with all Android devices (Samsung, Tecno, Infinix, Xiaomi, etc.)
                </span>
              </div>
            </div>
          ) : (
            /* IOS SAFARI INSTRUCTIONS */
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
                        In Safari, look at the bottom bar and tap the <strong>Share icon</strong> (box with arrow pointing up 📤) or the <strong>three dots</strong> at the bottom-right corner.
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
                        In the menu options, select <strong>Share</strong> or <strong>View More</strong> to see all available actions.
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
        </Card>

        {/* Features Grid */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="p-4 bg-gradient-card border-border/50 rounded-2xl space-y-1.5">
            <div className="size-9 rounded-xl bg-amber-500/15 text-amber-400 grid place-items-center mb-2">
              <Zap className="size-5" />
            </div>
            <div className="font-bold text-sm text-foreground">Faster Ordering</div>
            <div className="text-xs text-muted-foreground">1-tap checkout with auto-saved recipient number.</div>
          </Card>

          <Card className="p-4 bg-gradient-card border-border/50 rounded-2xl space-y-1.5">
            <div className="size-9 rounded-xl bg-emerald-500/15 text-emerald-400 grid place-items-center mb-2">
              <Receipt className="size-5" />
            </div>
            <div className="font-bold text-sm text-foreground">Live Tracking</div>
            <div className="text-xs text-muted-foreground">Real-time status updates and order history receipts.</div>
          </Card>

          <Card className="p-4 bg-gradient-card border-border/50 rounded-2xl space-y-1.5">
            <div className="size-9 rounded-xl bg-blue-500/15 text-blue-400 grid place-items-center mb-2">
              <ShieldCheck className="size-5" />
            </div>
            <div className="font-bold text-sm text-foreground">Bank Grade Security</div>
            <div className="text-xs text-muted-foreground">Safe Paystack MoMo payments with instant receipts.</div>
          </Card>

          <Card className="p-4 bg-gradient-card border-border/50 rounded-2xl space-y-1.5">
            <div className="size-9 rounded-xl bg-purple-500/15 text-purple-400 grid place-items-center mb-2">
              <MessageCircle className="size-5" />
            </div>
            <div className="font-bold text-sm text-foreground">Instant Support</div>
            <div className="text-xs text-muted-foreground">Direct chat with Stony & live human support 24/7.</div>
          </Card>
        </div>

        {/* FAQs */}
        <div className="space-y-3 pt-2">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <HelpCircle className="size-5 text-accent" /> Frequently Asked Questions
          </h2>

          <div className="space-y-2">
            {faqs.map((faq, i) => (
              <Card key={i} className="bg-gradient-card border-border/50 rounded-2xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full p-4 text-left font-bold text-sm flex items-center justify-between gap-3 hover:text-accent transition-colors"
                >
                  <span>{faq.q}</span>
                  {openFaq === i ? <ChevronUp className="size-4 shrink-0" /> : <ChevronDown className="size-4 shrink-0" />}
                </button>
                {openFaq === i && (
                  <div className="px-4 pb-4 text-xs text-muted-foreground border-t border-border/30 pt-3 leading-relaxed">
                    {faq.a}
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/40 py-6 text-center text-xs text-muted-foreground">
        <p>© {new Date().getFullYear()} {shopName}. All rights reserved.</p>
      </footer>
    </div>
  );
}
