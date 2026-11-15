import { useState, useEffect, useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Rocket,
  ArrowLeft,
  CheckCircle2,
  Users,
  Heart,
  Eye,
  MessageSquare,
  Share2,
  Sparkles,
  ShieldCheck,
  Zap,
  Flame,
  Check,
  ChevronRight,
  ExternalLink,
  Loader2,
  Copy,
  HelpCircle,
} from "lucide-react";
import { invokeApiFunction } from "@/integrations/supabase/client";
import { getSavedPhone, saveOrderToHistory } from "@/lib/orderHistory";
import { SocialPlatformIcon } from "@/components/SocialPlatformIcon";
import {
  type BoostServiceItem,
  type ActionCategory,
  type DropQualityInfo,
  isFixedPackage,
  detectActionCategory,
  detectDropQuality,
} from "@/lib/boostServices";

export type { BoostServiceItem, ActionCategory, DropQualityInfo };
export { isFixedPackage, detectActionCategory, detectDropQuality };

const PLATFORMS = [
  {
    id: "tiktok",
    name: "TikTok",
    badge: "Popular 🔥",
    tagline: "Followers, Likes, Views, Shares & Saves",
    description: "Grow your TikTok viral presence with genuine active engagement.",
    iconColor: "from-cyan-400 via-pink-500 to-rose-600",
    borderGlow: "border-cyan-500/30 hover:border-cyan-400 hover:shadow-[0_0_25px_rgba(6,182,212,0.3)]",
    bgGradient: "from-zinc-900 via-zinc-950 to-black",
  },
  {
    id: "instagram",
    name: "Instagram",
    badge: "Trending ⚡",
    tagline: "Followers, Likes, Reel Views, Comments",
    description: "Boost your Instagram profile credibility and explore page reach.",
    iconColor: "from-amber-500 via-pink-500 to-purple-600",
    borderGlow: "border-pink-500/30 hover:border-pink-400 hover:shadow-[0_0_25px_rgba(236,72,153,0.3)]",
    bgGradient: "from-pink-950/40 via-zinc-950 to-black",
  },
  {
    id: "facebook",
    name: "Facebook",
    badge: "High Retention 👥",
    tagline: "Page Followers, Likes, Reel Views",
    description: "Build an active community for your Facebook page, group or post.",
    iconColor: "from-blue-400 to-indigo-600",
    borderGlow: "border-blue-500/30 hover:border-blue-400 hover:shadow-[0_0_25px_rgba(59,130,246,0.3)]",
    bgGradient: "from-blue-950/40 via-zinc-950 to-black",
  },
  {
    id: "youtube",
    name: "YouTube",
    badge: "Monetizable 🎬",
    tagline: "Subscribers, Watch-Time Views, Likes",
    description: "Hit monetization goals with high watch-time views and subscribers.",
    iconColor: "from-red-500 to-rose-700",
    borderGlow: "border-red-500/30 hover:border-red-400 hover:shadow-[0_0_25px_rgba(239,68,68,0.3)]",
    bgGradient: "from-red-950/40 via-zinc-950 to-black",
  },
  {
    id: "twitter",
    name: "Twitter (X)",
    badge: "Fast ⚡",
    tagline: "Followers, Retweets, Likes, Quotes",
    description: "Spark trending discussions and increase your Twitter/X authority.",
    iconColor: "from-zinc-200 to-zinc-400",
    borderGlow: "border-zinc-500/30 hover:border-zinc-400 hover:shadow-[0_0_25px_rgba(255,255,255,0.2)]",
    bgGradient: "from-zinc-900 via-zinc-950 to-black",
  },
  {
    id: "telegram",
    name: "Telegram",
    badge: "Non-Drop 🛡️",
    tagline: "Channel Members, Group Members, Post Views",
    description: "Increase subscriber counts for your public or private Telegram channels.",
    iconColor: "from-sky-400 to-blue-500",
    borderGlow: "border-sky-500/30 hover:border-sky-400 hover:shadow-[0_0_25px_rgba(14,165,233,0.3)]",
    bgGradient: "from-sky-950/40 via-zinc-950 to-black",
  },
  {
    id: "whatsapp",
    name: "WhatsApp",
    badge: "Active 📱",
    tagline: "Channel Followers, Post Reactions",
    description: "Grow your WhatsApp channel audience and build daily engagement.",
    iconColor: "from-emerald-400 to-teal-600",
    borderGlow: "border-emerald-500/30 hover:border-emerald-400 hover:shadow-[0_0_25px_rgba(16,185,129,0.3)]",
    bgGradient: "from-emerald-950/40 via-zinc-950 to-black",
  },
];

const ACTION_TABS: { id: ActionCategory; label: string; icon: any; hint: string }[] = [
  { id: "followers", label: "Followers", icon: Users, hint: "Profile or Channel URL" },
  { id: "likes", label: "Likes / Reactions", icon: Heart, hint: "Post or Video URL" },
  { id: "views", label: "Views / Plays", icon: Eye, hint: "Video, Reel or Post URL" },
  { id: "comments", label: "Comments", icon: MessageSquare, hint: "Post or Video URL" },
  { id: "shares", label: "Shares / Retweets", icon: Share2, hint: "Post URL" },
];

export const SocialBoost = () => {
  const navigate = useNavigate();
  const { platform: urlPlatform } = useParams<{ platform?: string }>();

  // Steps: 1 = Choose Platform, 2 = Choose Service, 3 = Quantity & Pay
  const [step, setStep] = useState<1 | 2 | 3>(() => (urlPlatform ? 2 : 1));
  const [selectedPlatform, setSelectedPlatform] = useState<string>(urlPlatform || "tiktok");
  const [selectedActionCategory, setSelectedActionCategory] = useState<ActionCategory>("followers");
  const [selectedService, setSelectedService] = useState<BoostServiceItem | null>(null);

  const [services, setServices] = useState<BoostServiceItem[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);

  // Form inputs
  const [link, setLink] = useState("");
  const [quantity, setQuantity] = useState<number>(1000);
  const [comments, setComments] = useState("");
  const [phone, setPhone] = useState(() => getSavedPhone());
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.title = "Social Media Boost – Followers, Likes & Views | DATA 1 GH";
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  // Fetch live services from backend
  useEffect(() => {
    let active = true;
    const fetchServices = async () => {
      setLoadingServices(true);
      try {
        const { data, error } = await invokeApiFunction("boost-services");
        if (!error && Array.isArray(data?.services) && active) {
          setServices(data.services);
        }
      } catch (e) {
        console.warn("Failed to load boost services:", e);
      } finally {
        if (active) setLoadingServices(false);
      }
    };
    fetchServices();
    return () => {
      active = false;
    };
  }, []);

  // Sync url param if present
  useEffect(() => {
    if (urlPlatform) {
      const match = PLATFORMS.find((p) => p.id === urlPlatform.toLowerCase());
      if (match) {
        setSelectedPlatform(match.id);
        setStep(2);
      }
    }
  }, [urlPlatform]);

  // Services available for currently selected platform
  const platformServices = useMemo(() => {
    return services.filter(
      (s) => s.platform.toLowerCase() === selectedPlatform.toLowerCase()
    );
  }, [services, selectedPlatform]);

  // Categories available for currently selected platform
  const availableActionCategories = useMemo(() => {
    const categoriesSet = new Set<ActionCategory>();
    platformServices.forEach((s) => {
      categoriesSet.add(detectActionCategory(s.name, s.category));
    });
    return ACTION_TABS.filter((cat) => categoriesSet.has(cat.id));
  }, [platformServices]);

  // Whenever platform changes, reset category to first available
  useEffect(() => {
    if (availableActionCategories.length > 0) {
      if (!availableActionCategories.some((c) => c.id === selectedActionCategory)) {
        setSelectedActionCategory(availableActionCategories[0].id);
      }
    }
  }, [selectedPlatform, availableActionCategories]);

  // Quality filter tab: "all" | "non_drop" | "standard"
  const [qualityFilter, setQualityFilter] = useState<"all" | "non_drop" | "standard">("all");

  // All services in currently selected platform + category
  const categoryServices = useMemo(() => {
    return platformServices.filter(
      (s) => detectActionCategory(s.name, s.category) === selectedActionCategory
    );
  }, [platformServices, selectedActionCategory]);

  // Counts of Non-Drop vs Standard
  const nonDropCount = useMemo(() => {
    return categoryServices.filter((s) => detectDropQuality(s.name, s.category, s).isNonDrop).length;
  }, [categoryServices]);

  const standardCount = useMemo(() => {
    return categoryServices.filter((s) => !detectDropQuality(s.name, s.category, s).isNonDrop).length;
  }, [categoryServices]);

  // Filtered services applied with quality tab
  const filteredServices = useMemo(() => {
    return categoryServices.filter((s) => {
      if (qualityFilter === "all") return true;
      const q = detectDropQuality(s.name, s.category, s);
      if (qualityFilter === "non_drop") return q.isNonDrop;
      if (qualityFilter === "standard") return !q.isNonDrop;
      return true;
    });
  }, [categoryServices, qualityFilter]);

  // Whether currently selected service is a fixed package
  const isSelectedPackage = useMemo(() => isFixedPackage(selectedService), [selectedService]);

  // Selected service drop quality info
  const selectedQualityInfo = useMemo(() => {
    if (!selectedService) return null;
    return detectDropQuality(selectedService.name, selectedService.category, selectedService);
  }, [selectedService]);

  // Live Price calculation
  const totalPrice = useMemo(() => {
    if (!selectedService) return 0;
    if (isSelectedPackage) {
      // Fixed package rate IS the flat total price
      return Math.max(1, Math.round(selectedService.rate * 100) / 100);
    }
    const q = Number(quantity) || selectedService.min || 0;
    const raw = (q * selectedService.rate) / 1000;
    return Math.max(1, Math.round(raw * 100) / 100);
  }, [selectedService, isSelectedPackage, quantity]);

  // Fixed preset quantities for variable packages
  const presetQuantities = useMemo(() => {
    if (!selectedService || isSelectedPackage) return [];
    const min = selectedService.min || 10;
    const max = selectedService.max || 100000;
    const candidates = [50, 100, 250, 500, 1000, 2500, 5000, 10000, 20000, 50000];
    const filtered = candidates.filter((c) => c >= min && c <= max);
    if (!filtered.includes(min)) filtered.unshift(min);
    return Array.from(new Set(filtered)).slice(0, 6);
  }, [selectedService, isSelectedPackage]);

  // Choose platform handler
  const handleSelectPlatform = (platformId: string) => {
    setSelectedPlatform(platformId);
    setSelectedService(null);
    setStep(2);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Choose service package handler
  const handleSelectService = (service: BoostServiceItem) => {
    setSelectedService(service);
    setQuantity(service.min || 100);
    setStep(3);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Quantity presets
  const handleAdjustQuantity = (delta: number) => {
    if (!selectedService) return;
    const min = selectedService.min || 100;
    const max = selectedService.max || 50000;
    setQuantity((prev) => Math.max(min, Math.min(max, (prev || min) + delta)));
  };

  const handleAddPreset = (amount: number) => {
    if (!selectedService) return;
    const min = selectedService.min || 100;
    const max = selectedService.max || 50000;
    setQuantity((prev) => Math.max(min, Math.min(max, (prev || 0) + amount)));
  };

  const handleSetExactPreset = (exact: number) => {
    if (!selectedService) return;
    const min = selectedService.min || 100;
    const max = selectedService.max || 50000;
    setQuantity(Math.max(min, Math.min(max, exact)));
  };

  const handlePasteLink = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setLink(text.trim());
        toast.success("Link pasted from clipboard!");
      }
    } catch {
      toast.info("Please paste your link manually into the box");
    }
  };

  const validateGhanaPhone = (num: string): boolean => {
    const clean = num.replace(/\D/g, "");
    return (
      (clean.startsWith("0") && clean.length === 10) ||
      (clean.startsWith("233") && clean.length === 12)
    );
  };

  const handleCheckout = async () => {
    if (!selectedService) {
      toast.error("Please select a boost package first");
      setStep(2);
      return;
    }

    if (!link.trim() || link.trim().length < 3) {
      toast.error("Please enter your account username or post link");
      return;
    }

    const min = selectedService.min || 100;
    const max = selectedService.max || 50000;
    const orderQuantity = isSelectedPackage ? min : quantity;

    if (!isSelectedPackage && (orderQuantity < min || orderQuantity > max)) {
      toast.error(`Quantity must be between ${min.toLocaleString()} and ${max.toLocaleString()}`);
      return;
    }

    if (!validateGhanaPhone(phone)) {
      toast.error("Please enter a valid Ghana phone number (e.g. 054XXXXXXX)");
      return;
    }

    setSubmitting(true);
    try {
      const callback_url = `${window.location.origin}/payment/callback`;

      const { data, error } = await invokeApiFunction("service-init", {
        body: {
          service: "boost",
          amount: totalPrice,
          customer_phone: phone,
          customer_name: name || undefined,
          callback_url,
          boost_service_id: selectedService.service,
          boost_service_name: selectedService.name,
          boost_platform: selectedPlatform,
          boost_link: link.trim(),
          boost_quantity: orderQuantity,
          notes: `${selectedService.name} | Qty: ${orderQuantity.toLocaleString()} | Link: ${link.trim()}`,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.reference) {
        saveOrderToHistory({
          reference: data.reference,
          recipient_phone: phone,
          amount: totalPrice,
          payment_status: "pending",
          delivery_status: "pending",
          type: "service",
        });
      }

      if (data?.authorization_url) {
        window.location.href = data.authorization_url;
      } else {
        throw new Error("Could not redirect to payment. Please try again.");
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed to initialize payment");
      setSubmitting(false);
    }
  };

  const currentPlatformObj = PLATFORMS.find(
    (p) => p.id === selectedPlatform.toLowerCase()
  ) || PLATFORMS[0];

  return (
    <div className="min-h-screen bg-black text-white selection:bg-fuchsia-500 selection:text-white pb-20">
      {/* Top Header */}
      <header className="sticky top-0 z-40 backdrop-blur-md bg-black/80 border-b border-zinc-800">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 transition text-zinc-300 hover:text-white"
              title="Return to Home"
            >
              <ArrowLeft className="size-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-base md:text-lg tracking-tight bg-gradient-to-r from-violet-400 via-fuchsia-400 to-pink-400 bg-clip-text text-transparent">
                  Social Media Boost
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30">
                  Instant
                </span>
              </div>
              <p className="text-xs text-zinc-400 hidden sm:block">
                Automated High-Retention Followers, Likes, Views & Engagement
              </p>
            </div>
          </div>

          <Link
            to="/track"
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300"
          >
            Track Order
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-4xl mx-auto px-4 pt-6 space-y-6">
        {/* Step Progress Stepper */}
        <div className="rounded-2xl p-4 bg-zinc-900/80 border border-zinc-800 shadow-xl backdrop-blur flex items-center justify-between gap-2 overflow-x-auto">
          {/* Step 1 Pill */}
          <button
            onClick={() => setStep(1)}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs md:text-sm font-bold transition shrink-0 ${
              step === 1
                ? "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-violet-600/30"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <span
              className={`size-6 rounded-full grid place-items-center text-xs font-black ${
                step === 1 ? "bg-white text-violet-700" : "bg-zinc-800 text-zinc-300"
              }`}
            >
              1
            </span>
            <span>Select Platform</span>
          </button>

          <ChevronRight className="size-4 text-zinc-600 shrink-0" />

          {/* Step 2 Pill */}
          <button
            onClick={() => step >= 2 && setStep(2)}
            disabled={step < 2}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs md:text-sm font-bold transition shrink-0 ${
              step === 2
                ? "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-violet-600/30"
                : step > 2
                ? "text-emerald-400 hover:underline"
                : "text-zinc-600 cursor-not-allowed"
            }`}
          >
            <span
              className={`size-6 rounded-full grid place-items-center text-xs font-black ${
                step === 2
                  ? "bg-white text-violet-700"
                  : step > 2
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : "bg-zinc-800 text-zinc-500"
              }`}
            >
              {step > 2 ? <Check className="size-3.5" /> : "2"}
            </span>
            <span>Choose Service</span>
          </button>

          <ChevronRight className="size-4 text-zinc-600 shrink-0" />

          {/* Step 3 Pill */}
          <button
            onClick={() => selectedService && setStep(3)}
            disabled={!selectedService}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs md:text-sm font-bold transition shrink-0 ${
              step === 3
                ? "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-violet-600/30"
                : "text-zinc-600 cursor-not-allowed"
            }`}
          >
            <span
              className={`size-6 rounded-full grid place-items-center text-xs font-black ${
                step === 3 ? "bg-white text-violet-700" : "bg-zinc-800 text-zinc-500"
              }`}
            >
              3
            </span>
            <span>Quantity & Pay</span>
          </button>
        </div>

        {/* STEP 1: CHOOSE PLATFORM */}
        {step === 1 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-300">
            <div className="text-center max-w-xl mx-auto space-y-2 pt-2">
              <span className="text-xs uppercase font-extrabold tracking-widest px-3 py-1 rounded-full bg-violet-500/15 text-violet-400 border border-violet-500/30">
                Step 1 of 3
              </span>
              <h1 className="text-2xl md:text-4xl font-black tracking-tight">
                Choose Your Platform
              </h1>
              <p className="text-xs md:text-sm text-zinc-400">
                Select which social network or channel you want to boost. Instant start, high-retention engagement.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {PLATFORMS.map((platform) => (
                <Card
                  key={platform.id}
                  onClick={() => handleSelectPlatform(platform.id)}
                  className={`cursor-pointer p-5 rounded-2xl bg-gradient-to-br ${platform.bgGradient} border ${platform.borderGlow} transition-all duration-300 hover:-translate-y-1 relative group overflow-hidden shadow-lg`}
                >
                  <div className="flex items-start justify-between">
                    <SocialPlatformIcon platform={platform.id} className="size-12 shrink-0 drop-shadow-lg group-hover:scale-110 transition-transform" />
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-white/10 text-zinc-200 border border-white/10">
                      {platform.badge}
                    </span>
                  </div>

                  <div className="mt-4">
                    <h3 className="text-xl font-black text-white group-hover:text-fuchsia-300 transition-colors">
                      {platform.name}
                    </h3>
                    <p className="text-xs font-semibold text-zinc-300 mt-1 line-clamp-1">
                      {platform.tagline}
                    </p>
                    <p className="text-[11px] text-zinc-400 mt-2 leading-relaxed">
                      {platform.description}
                    </p>
                  </div>

                  <div className="mt-5 pt-3 border-t border-zinc-800/80 flex items-center justify-between text-xs font-bold text-fuchsia-400 group-hover:text-fuchsia-300">
                    <span>Select {platform.name}</span>
                    <ChevronRight className="size-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </Card>
              ))}
            </div>

            {/* Quality & Trust Badges */}
            <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
              <div className="flex items-center justify-center gap-2 text-xs text-zinc-300">
                <ShieldCheck className="size-4 text-emerald-400 shrink-0" />
                <span>100% Safe (No Password Needed)</span>
              </div>
              <div className="flex items-center justify-center gap-2 text-xs text-zinc-300">
                <Zap className="size-4 text-amber-400 shrink-0" />
                <span>Instant Auto-Fulfillment</span>
              </div>
              <div className="flex items-center justify-center gap-2 text-xs text-zinc-300">
                <CheckCircle2 className="size-4 text-cyan-400 shrink-0" />
                <span>Refill Guarantees Included</span>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: CHOOSE ACTION TYPE / SERVICE */}
        {step === 2 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-300">
            {/* Top Navigation & Selected Platform Banner */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStep(1)}
                className="bg-zinc-900 border-zinc-700 hover:bg-zinc-800 text-zinc-200"
              >
                <ArrowLeft className="size-3.5 mr-1.5" /> Back to Platforms
              </Button>

              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900 border border-zinc-700">
                <SocialPlatformIcon platform={currentPlatformObj.id} className="size-4 text-fuchsia-400" />
                <span className="text-xs text-zinc-400">Selected Platform:</span>
                <span className="text-xs font-bold text-white capitalize">
                  {currentPlatformObj.name}
                </span>
              </div>
            </div>

            <div className="text-center max-w-xl mx-auto space-y-1.5 pt-1">
              <span className="text-xs uppercase font-extrabold tracking-widest px-3 py-1 rounded-full bg-violet-500/15 text-violet-400 border border-violet-500/30">
                Step 2 of 3
              </span>
              <h2 className="text-2xl md:text-3xl font-black tracking-tight">
                What do you want to boost on {currentPlatformObj.name}?
              </h2>
              <p className="text-xs md:text-sm text-zinc-400">
                Tap the type of engagement you need, then choose your preferred quality package.
              </p>
            </div>

            {/* Engagement Action Type Pills */}
            <div className="flex flex-wrap items-center justify-center gap-2">
              {availableActionCategories.map((cat) => {
                const IconComponent = cat.icon;
                const active = selectedActionCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => {
                      setSelectedActionCategory(cat.id);
                      setQualityFilter("all");
                    }}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs md:text-sm font-bold transition-all shadow-sm ${
                      active
                        ? "bg-gradient-to-r from-violet-600 via-fuchsia-600 to-pink-600 text-white shadow-violet-600/30 scale-105"
                        : "bg-zinc-900 border border-zinc-800 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-800"
                    }`}
                  >
                    <IconComponent className="size-4" />
                    <span>{cat.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Quality Filter Tabs (Non-Drop Permanent vs Standard Range) */}
            <div className="flex items-center justify-center gap-2 flex-wrap pt-2">
              <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mr-1">Quality:</span>
              <button
                type="button"
                onClick={() => setQualityFilter("all")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  qualityFilter === "all"
                    ? "bg-white text-zinc-950 shadow-md"
                    : "bg-zinc-900/90 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700"
                }`}
              >
                All Packages ({categoryServices.length})
              </button>
              <button
                type="button"
                onClick={() => setQualityFilter("non_drop")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  qualityFilter === "non_drop"
                    ? "bg-emerald-500 text-white shadow-emerald-500/30 shadow-md"
                    : "bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/40 hover:border-emerald-400"
                }`}
              >
                <ShieldCheck className="size-3.5" /> 🛡️ Non-Drop Only ({nonDropCount})
              </button>
              <button
                type="button"
                onClick={() => setQualityFilter("standard")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  qualityFilter === "standard"
                    ? "bg-amber-500 text-zinc-950 shadow-amber-500/30 shadow-md font-extrabold"
                    : "bg-amber-950/40 border border-amber-500/40 text-amber-300 hover:bg-amber-900/40 hover:border-amber-400"
                }`}
              >
                <Zap className="size-3.5" /> ⚡ Standard Range ({standardCount})
              </button>
            </div>

            {/* Packages List */}
            {loadingServices ? (
              <div className="p-12 text-center text-zinc-400 space-y-3">
                <Loader2 className="size-8 animate-spin mx-auto text-fuchsia-500" />
                <p className="text-sm">Loading live boost packages…</p>
              </div>
            ) : filteredServices.length === 0 ? (
              <Card className="p-8 text-center text-zinc-400 bg-zinc-900/50 border-zinc-800 space-y-3">
                <HelpCircle className="size-8 mx-auto text-zinc-500" />
                <p className="text-sm">No packages match the selected quality filter.</p>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setQualityFilter("all")}
                >
                  Show All Packages ({categoryServices.length})
                </Button>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredServices.map((service) => {
                  const isPkg = isFixedPackage(service);
                  const quality = detectDropQuality(service.name, service.category, service);
                  return (
                    <Card
                      key={service.service}
                      onClick={() => handleSelectService(service)}
                      className={`cursor-pointer p-5 rounded-2xl bg-zinc-900/90 border transition-all duration-200 group relative flex flex-col justify-between shadow-lg ${
                        quality.isNonDrop
                          ? "border-emerald-500/40 hover:border-emerald-400 hover:shadow-[0_0_25px_rgba(16,185,129,0.25)] bg-gradient-to-br from-zinc-900 via-zinc-900 to-emerald-950/20"
                          : "border-zinc-800 hover:border-amber-500/50 hover:shadow-[0_0_25px_rgba(245,158,11,0.2)] hover:bg-zinc-800/80"
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                            {service.category}
                          </span>
                          <Badge className={`${quality.badgeColor} text-[10px] font-bold`}>
                            {quality.badgeLabel}
                          </Badge>
                        </div>

                        <h4 className="text-base font-bold text-white mt-3 group-hover:text-fuchsia-300 transition-colors leading-snug">
                          {service.name}
                        </h4>

                        <div className="mt-3">
                          {quality.isNonDrop ? (
                            <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold bg-emerald-500/10 px-2.5 py-1.5 rounded-lg border border-emerald-500/20">
                              <ShieldCheck className="size-3.5 shrink-0 text-emerald-400" />
                              <span>100% Guaranteed Package: <b>{service.min.toLocaleString()}</b> units (0% Drop Retention)</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-xs text-amber-300 font-medium bg-amber-500/10 px-2.5 py-1.5 rounded-lg border border-amber-500/20">
                              <Zap className="size-3.5 shrink-0 text-amber-400" />
                              <span>Standard Range: Min <b>{service.min.toLocaleString()}</b> — Max <b>{service.max.toLocaleString()}</b> units</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="mt-5 pt-3 border-t border-zinc-800 flex items-center justify-between">
                        <div>
                          <div className="text-lg font-black text-fuchsia-400">
                            GH₵ {Number(service.rate).toFixed(2)}
                          </div>
                          <div className="text-[10px] text-zinc-500 font-medium">
                            {isPkg ? `Total for ${service.min.toLocaleString()} units` : "per 1,000 units"}
                          </div>
                        </div>

                        <Button
                          size="sm"
                          className={`font-bold text-xs shadow ${
                            quality.isNonDrop
                              ? "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white"
                              : "bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white"
                          }`}
                        >
                          Select Package <ChevronRight className="size-3.5 ml-1" />
                        </Button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* STEP 3: QUANTITY, LINK & PAY */}
        {step === 3 && selectedService && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-300">
            {/* Top Back Navigation */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStep(2)}
                className="bg-zinc-900 border-zinc-700 hover:bg-zinc-800 text-zinc-200"
              >
                <ArrowLeft className="size-3.5 mr-1.5" /> Back to Packages
              </Button>

              <div className="flex items-center gap-2 text-xs text-zinc-400">
                <span className="capitalize text-zinc-200 font-bold">{selectedPlatform}</span>
                <span>/</span>
                <span className="truncate max-w-[200px] text-fuchsia-400 font-medium">
                  {selectedService.name}
                </span>
              </div>
            </div>

            {/* Selected Package Banner */}
            <Card className="p-4 rounded-2xl bg-gradient-to-r from-violet-950/60 via-fuchsia-950/40 to-black border border-violet-500/30 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className={`size-11 rounded-xl bg-gradient-to-br ${currentPlatformObj.iconColor} p-2.5 grid place-items-center shadow shrink-0`}>
                  <SocialPlatformIcon platform={currentPlatformObj.id} className="size-6 text-white" />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-violet-400">
                    Active Package • {currentPlatformObj.name}
                  </span>
                  <h3 className="text-base font-bold text-white mt-0.5">
                    {selectedService.name}
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    {isSelectedPackage ? (
                      <>Fixed Package: <b className="text-zinc-200">{selectedService.min.toLocaleString()} units</b> for <b className="text-fuchsia-400">GH₵ {totalPrice.toFixed(2)}</b></>
                    ) : (
                      <>Rate: <b className="text-zinc-200">GH₵ {Number(selectedService.rate).toFixed(2)}</b> per 1,000 units</>
                    )}
                    {selectedService.refill && <span className="ml-2 text-emerald-400 font-bold">• 30d Refill</span>}
                  </p>
                </div>
              </div>

              <div className="text-right">
                <div className="text-xs text-zinc-400">Calculated Total</div>
                <div className="text-2xl font-black text-fuchsia-400">
                  GH₵ {totalPrice.toFixed(2)}
                </div>
              </div>
            </Card>

            {/* Order Form */}
            <Card className="p-5 md:p-6 rounded-2xl bg-zinc-900/90 border border-zinc-800 space-y-6 shadow-xl">
              {/* Target Link Input */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="target-link" className="text-sm font-bold text-zinc-200 flex items-center gap-1.5">
                    <span>
                      {selectedActionCategory === "followers"
                        ? `${currentPlatformObj.name} Profile Link or Username`
                        : `${currentPlatformObj.name} Post, Video or Reel Link`}
                    </span>
                    <span className="text-red-400">*</span>
                  </Label>
                  <button
                    type="button"
                    onClick={handlePasteLink}
                    className="text-xs text-fuchsia-400 hover:text-fuchsia-300 font-semibold flex items-center gap-1 hover:underline"
                  >
                    <Copy className="size-3" /> Paste Link
                  </button>
                </div>

                <div className="relative">
                  <Input
                    id="target-link"
                    type="text"
                    placeholder={
                      selectedActionCategory === "followers"
                        ? `e.g. https://${selectedPlatform}.com/@yourusername or @yourusername`
                        : `e.g. https://${selectedPlatform}.com/p/your-post-id`
                    }
                    value={link}
                    onChange={(e) => setLink(e.target.value)}
                    className="bg-black/60 border-zinc-700 h-12 text-sm text-white font-mono placeholder:text-zinc-600 focus:border-fuchsia-500"
                  />
                </div>
                <p className="text-[11px] text-zinc-500">
                  Make sure your account or post is <b>Public</b> before placing an order.
                </p>
              </div>

              {/* Quantity Input / Fixed Package Display */}
              {isSelectedPackage ? (
                <div className="p-4 rounded-xl bg-zinc-800/60 border border-zinc-700/80 flex items-center justify-between gap-4">
                  <div>
                    <Label className="text-xs font-bold text-zinc-300">
                      Package Quantity (Fixed Guaranteed Package)
                    </Label>
                    <div className="text-2xl font-black text-white mt-1">
                      {selectedService.min.toLocaleString()} units
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-1">
                      This package delivers exactly {selectedService.min.toLocaleString()} {selectedActionCategory} for a flat total price of GH₵ {totalPrice.toFixed(2)}.
                    </p>
                  </div>
                  <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-xs px-3 py-1 font-bold shrink-0">
                    Fixed Pack
                  </Badge>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="qty" className="text-sm font-bold text-zinc-200">
                      Quantity Needed
                    </Label>
                    <span className="text-xs font-mono text-zinc-400">
                      Min: <b>{selectedService.min.toLocaleString()}</b> • Max: <b>{selectedService.max.toLocaleString()}</b>
                    </span>
                  </div>

                  {/* Fixed Preset Quantities with Prices */}
                  <div className="space-y-1.5">
                    <div className="text-[11px] text-zinc-400 font-semibold">Choose Quantity Package:</div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {presetQuantities.map((preset) => {
                        const cost = (preset * selectedService.rate) / 1000;
                        const active = quantity === preset;
                        return (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => handleSetExactPreset(preset)}
                            className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between ${
                              active
                                ? "bg-fuchsia-600/20 border-fuchsia-500 text-white shadow-sm ring-1 ring-fuchsia-500"
                                : "bg-zinc-800/80 border-zinc-700 text-zinc-300 hover:bg-zinc-700/80 hover:border-zinc-600"
                            }`}
                          >
                            <span className="font-extrabold text-sm text-white">
                              {preset >= 1000 ? `${(preset / 1000).toLocaleString()}K` : preset.toLocaleString()}
                            </span>
                            <span className="text-[11px] text-fuchsia-300 font-bold mt-0.5">
                              GH₵ {cost.toFixed(2)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Custom Quantity Stepper */}
                  <div className="pt-2">
                    <div className="text-[11px] text-zinc-500 mb-1.5">Or enter custom quantity:</div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => handleAdjustQuantity(-100)}
                        className="h-11 w-11 text-lg font-black bg-zinc-800 border-zinc-700 hover:bg-zinc-700 shrink-0 text-white"
                      >
                        -
                      </Button>
                      <Input
                        id="qty"
                        type="number"
                        min={selectedService.min}
                        max={selectedService.max}
                        value={quantity}
                        onChange={(e) => setQuantity(Number(e.target.value))}
                        className="bg-black/60 border-zinc-700 h-11 text-center text-lg font-mono font-black text-white focus:border-fuchsia-500"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => handleAdjustQuantity(100)}
                        className="h-11 w-11 text-lg font-black bg-zinc-800 border-zinc-700 hover:bg-zinc-700 shrink-0 text-white"
                      >
                        +
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Customer Contact */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-zinc-800">
                <div className="space-y-1.5">
                  <Label htmlFor="cust-phone" className="text-xs font-bold text-zinc-300 flex items-center gap-1">
                    <span>Mobile Money Phone Number</span>
                    <span className="text-red-400">*</span>
                  </Label>
                  <Input
                    id="cust-phone"
                    type="tel"
                    placeholder="054XXXXXXX"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="bg-black/60 border-zinc-700 h-11 text-sm font-mono text-white focus:border-fuchsia-500"
                  />
                  <p className="text-[10px] text-zinc-500">
                    Payment prompt and order confirmation SMS will be sent here.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="cust-name" className="text-xs font-bold text-zinc-300">
                    Your Name (Optional)
                  </Label>
                  <Input
                    id="cust-name"
                    type="text"
                    placeholder="e.g. Kwame Mensah"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="bg-black/60 border-zinc-700 h-11 text-sm text-white focus:border-fuchsia-500"
                  />
                </div>
              </div>

              {/* Order Summary & Pay */}
              <div className="rounded-xl p-4 bg-black/80 border border-zinc-800 space-y-3">
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <span>Selected Service:</span>
                  <span className="font-bold text-zinc-200 capitalize">{currentPlatformObj.name} {selectedActionCategory}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <span>Order Quantity:</span>
                  <span className="font-mono font-bold text-white">{quantity.toLocaleString()} units</span>
                </div>
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <span>Delivery Speed:</span>
                  <span className="font-medium text-emerald-400">Instant (Within 5–60 mins)</span>
                </div>
                <div className="pt-2 border-t border-zinc-800 flex items-center justify-between">
                  <span className="text-sm font-bold text-white">Total to Pay:</span>
                  <span className="text-2xl font-black text-fuchsia-400">
                    GH₵ {totalPrice.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Submit Button */}
              <Button
                type="button"
                onClick={handleCheckout}
                disabled={submitting}
                className="w-full h-14 rounded-xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 text-white font-black text-base shadow-lg shadow-fuchsia-600/30 transition-all hover:scale-[1.01]"
              >
                {submitting ? (
                  <>
                    <Loader2 className="size-5 mr-2 animate-spin" />
                    Starting Payment…
                  </>
                ) : (
                  <>
                    <Rocket className="size-5 mr-2" />
                    Pay GH₵ {totalPrice.toFixed(2)} with Paystack / Mobile Money
                  </>
                )}
              </Button>

              <div className="flex items-center justify-center gap-4 text-[11px] text-zinc-500 pt-1">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="size-3.5 text-emerald-400" /> Paystack Secured
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Zap className="size-3.5 text-amber-400" /> Automated API Fulfillment
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="size-3.5 text-blue-400" /> 100% Safe
                </span>
              </div>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
};

export default SocialBoost;

