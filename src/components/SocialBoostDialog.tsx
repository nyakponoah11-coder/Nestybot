import { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
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
  ShieldCheck,
  Zap,
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

export interface BoostServiceItem {
  service: number | string;
  name: string;
  category: string;
  platform: string;
  rate: number; // in GHS per 1,000
  min: number;
  max: number;
  type?: string;
  refill?: boolean;
  cancel?: boolean;
  description?: string;
}

export type ActionCategory = "followers" | "likes" | "views" | "comments" | "shares" | "other";

export function detectActionCategory(name: string, category: string): ActionCategory {
  const s = `${category || ""} ${name || ""}`.toLowerCase();
  if (s.includes("follower") || s.includes("subscriber") || s.includes("member")) return "followers";
  if (s.includes("like") || s.includes("reaction") || s.includes("heart") || s.includes("upvote")) return "likes";
  if (s.includes("view") || s.includes("play") || s.includes("impression") || s.includes("watch time")) return "views";
  if (s.includes("comment")) return "comments";
  if (s.includes("share") || s.includes("retweet") || s.includes("save") || s.includes("repost")) return "shares";
  return "other";
}

const PLATFORMS = [
  {
    id: "tiktok",
    name: "TikTok",
    badge: "Popular 🔥",
    tagline: "Followers, Likes, Views, Shares & Saves",
    iconColor: "from-cyan-400 via-pink-500 to-rose-600",
    borderGlow: "border-cyan-500/30 hover:border-cyan-400",
    bgGradient: "from-zinc-900 via-zinc-950 to-black",
  },
  {
    id: "instagram",
    name: "Instagram",
    badge: "Trending ⚡",
    tagline: "Followers, Likes, Reel Views, Comments",
    iconColor: "from-amber-500 via-pink-500 to-purple-600",
    borderGlow: "border-pink-500/30 hover:border-pink-400",
    bgGradient: "from-pink-950/40 via-zinc-950 to-black",
  },
  {
    id: "facebook",
    name: "Facebook",
    badge: "High Retention 👥",
    tagline: "Page Followers, Likes, Reel Views",
    iconColor: "from-blue-400 to-indigo-600",
    borderGlow: "border-blue-500/30 hover:border-blue-400",
    bgGradient: "from-blue-950/40 via-zinc-950 to-black",
  },
  {
    id: "youtube",
    name: "YouTube",
    badge: "Monetizable 🎬",
    tagline: "Subscribers, Watch-Time Views, Likes",
    iconColor: "from-red-500 to-rose-700",
    borderGlow: "border-red-500/30 hover:border-red-400",
    bgGradient: "from-red-950/40 via-zinc-950 to-black",
  },
  {
    id: "twitter",
    name: "Twitter (X)",
    badge: "Fast ⚡",
    tagline: "Followers, Retweets, Likes, Quotes",
    iconColor: "from-zinc-200 to-zinc-400",
    borderGlow: "border-zinc-500/30 hover:border-zinc-400",
    bgGradient: "from-zinc-900 via-zinc-950 to-black",
  },
  {
    id: "telegram",
    name: "Telegram",
    badge: "Non-Drop 🛡️",
    tagline: "Channel Members, Group Members, Post Views",
    iconColor: "from-sky-400 to-blue-500",
    borderGlow: "border-sky-500/30 hover:border-sky-400",
    bgGradient: "from-sky-950/40 via-zinc-950 to-black",
  },
  {
    id: "whatsapp",
    name: "WhatsApp",
    badge: "Active 📱",
    tagline: "Channel Followers, Post Reactions",
    iconColor: "from-emerald-400 to-teal-600",
    borderGlow: "border-emerald-500/30 hover:border-emerald-400",
    bgGradient: "from-emerald-950/40 via-zinc-950 to-black",
  },
];

const ACTION_TABS: { id: ActionCategory; label: string; icon: any }[] = [
  { id: "followers", label: "Followers", icon: Users },
  { id: "likes", label: "Likes / Reactions", icon: Heart },
  { id: "views", label: "Views / Plays", icon: Eye },
  { id: "comments", label: "Comments", icon: MessageSquare },
  { id: "shares", label: "Shares / Retweets", icon: Share2 },
];

export const SocialBoostDialog = ({
  open,
  onOpenChange,
  agentId,
  agentSlug,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId?: string;
  agentSlug?: string;
}) => {
  const navigate = useNavigate();

  // Wizard step: 1 = Platform, 2 = Service, 3 = Quantity & Pay
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedPlatform, setSelectedPlatform] = useState("tiktok");
  const [selectedActionCategory, setSelectedActionCategory] = useState<ActionCategory>("followers");
  const [selectedService, setSelectedService] = useState<BoostServiceItem | null>(null);

  const [services, setServices] = useState<BoostServiceItem[]>([]);
  const [loadingServices, setLoadingServices] = useState(false);

  // Form inputs
  const [link, setLink] = useState("");
  const [quantity, setQuantity] = useState<number>(1000);
  const [phone, setPhone] = useState(() => getSavedPhone());
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Reset to step 1 when dialog is freshly opened
  useEffect(() => {
    if (open) {
      setStep(1);
    }
  }, [open]);

  // Load services from API
  useEffect(() => {
    if (!open) return;
    let isMounted = true;
    const fetchServices = async () => {
      setLoadingServices(true);
      try {
        const { data, error } = await invokeApiFunction("boost-services");
        if (!error && Array.isArray(data?.services) && isMounted) {
          setServices(data.services);
        }
      } catch (err) {
        console.warn("Failed to load live boost services:", err);
      } finally {
        if (isMounted) setLoadingServices(false);
      }
    };

    fetchServices();
    return () => {
      isMounted = false;
    };
  }, [open]);

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

  // Services matching current platform + category
  const filteredServices = useMemo(() => {
    return platformServices.filter(
      (s) => detectActionCategory(s.name, s.category) === selectedActionCategory
    );
  }, [platformServices, selectedActionCategory]);

  // Live Price calculation
  const currentRate = selectedService?.rate || 10;
  const totalPrice = useMemo(() => {
    const q = Number(quantity) || 0;
    const raw = (q * currentRate) / 1000;
    return Math.max(1, Math.round(raw * 100) / 100);
  }, [quantity, currentRate]);

  // Handlers
  const handleSelectPlatform = (platformId: string) => {
    setSelectedPlatform(platformId);
    setSelectedService(null);
    setStep(2);
  };

  const handleSelectService = (service: BoostServiceItem) => {
    setSelectedService(service);
    setQuantity(service.min || 1000);
    setStep(3);
  };

  const handleAdjustQuantity = (delta: number) => {
    if (!selectedService) return;
    const min = selectedService.min || 100;
    const max = selectedService.max || 50000;
    setQuantity((prev) => Math.max(min, Math.min(max, (prev || min) + delta)));
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
    if (quantity < min || quantity > max) {
      toast.error(`Quantity must be between ${min.toLocaleString()} and ${max.toLocaleString()}`);
      return;
    }

    if (!validateGhanaPhone(phone)) {
      toast.error("Please enter a valid Ghana phone number (e.g. 054XXXXXXX)");
      return;
    }

    setSubmitting(true);
    try {
      const callback_url = agentSlug
        ? `${window.location.origin}/s/${agentSlug}`
        : `${window.location.origin}/payment/callback`;

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
          boost_quantity: quantity,
          notes: `${selectedService.name} | Qty: ${quantity.toLocaleString()} | Link: ${link.trim()}`,
          agent_id: agentId || undefined,
          agent_slug: agentSlug || undefined,
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-zinc-950 border-zinc-800 text-white p-0 overflow-hidden max-h-[92vh] flex flex-col">
        {/* Dialog Header */}
        <div className="p-4 md:p-5 bg-gradient-to-r from-violet-900/60 via-fuchsia-900/40 to-black border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 grid place-items-center shadow">
              <Rocket className="size-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-base md:text-lg font-black text-white">
                Social Media Boost
              </DialogTitle>
              <DialogDescription className="text-xs text-zinc-400">
                Automated High-Retention Followers, Likes & Views
              </DialogDescription>
            </div>
          </div>

          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              onOpenChange(false);
              navigate("/boost");
            }}
            className="text-xs text-fuchsia-400 hover:text-fuchsia-300 hover:bg-zinc-800"
          >
            Full Page <ExternalLink className="size-3 ml-1" />
          </Button>
        </div>

        {/* Wizard Stepper */}
        <div className="px-4 py-2 bg-zinc-900/90 border-b border-zinc-800 flex items-center justify-between text-xs font-bold">
          <button
            onClick={() => setStep(1)}
            className={`flex items-center gap-1.5 transition ${
              step === 1 ? "text-fuchsia-400" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <span className={`size-5 rounded-full grid place-items-center text-[10px] ${
              step === 1 ? "bg-fuchsia-600 text-white" : "bg-zinc-800 text-zinc-400"
            }`}>1</span>
            <span>Platform</span>
          </button>

          <ChevronRight className="size-3.5 text-zinc-600" />

          <button
            onClick={() => step >= 2 && setStep(2)}
            disabled={step < 2}
            className={`flex items-center gap-1.5 transition ${
              step === 2
                ? "text-fuchsia-400"
                : step > 2
                ? "text-emerald-400"
                : "text-zinc-600 cursor-not-allowed"
            }`}
          >
            <span className={`size-5 rounded-full grid place-items-center text-[10px] ${
              step === 2
                ? "bg-fuchsia-600 text-white"
                : step > 2
                ? "bg-emerald-500/20 text-emerald-400"
                : "bg-zinc-800 text-zinc-500"
            }`}>{step > 2 ? <Check className="size-2.5" /> : "2"}</span>
            <span>Service</span>
          </button>

          <ChevronRight className="size-3.5 text-zinc-600" />

          <button
            onClick={() => selectedService && setStep(3)}
            disabled={!selectedService}
            className={`flex items-center gap-1.5 transition ${
              step === 3 ? "text-fuchsia-400" : "text-zinc-600 cursor-not-allowed"
            }`}
          >
            <span className={`size-5 rounded-full grid place-items-center text-[10px] ${
              step === 3 ? "bg-fuchsia-600 text-white" : "bg-zinc-800 text-zinc-500"
            }`}>3</span>
            <span>Quantity & Pay</span>
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-4 md:p-6 overflow-y-auto space-y-4 flex-1">
          {/* STEP 1: SELECT PLATFORM */}
          {step === 1 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="text-center space-y-1">
                <h3 className="text-lg font-bold">Select Your Platform</h3>
                <p className="text-xs text-zinc-400">
                  Tap the social network you want to grow:
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {PLATFORMS.map((platform) => (
                  <Card
                    key={platform.id}
                    onClick={() => handleSelectPlatform(platform.id)}
                    className={`cursor-pointer p-4 rounded-xl bg-gradient-to-br ${platform.bgGradient} border ${platform.borderGlow} hover:-translate-y-0.5 transition-all flex items-center justify-between group shadow`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`size-10 rounded-lg bg-gradient-to-br ${platform.iconColor} p-2 grid place-items-center shadow`}>
                        <SocialPlatformIcon platform={platform.id} className="size-5 text-white" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-white group-hover:text-fuchsia-300 transition-colors">
                            {platform.name}
                          </span>
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-white/10 text-zinc-300">
                            {platform.badge}
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-400 mt-0.5 line-clamp-1">
                          {platform.tagline}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="size-4 text-zinc-500 group-hover:text-fuchsia-400 group-hover:translate-x-1 transition-all" />
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* STEP 2: SELECT SERVICE / ACTION TYPE */}
          {step === 2 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setStep(1)}
                  className="bg-zinc-900 border-zinc-700 text-xs text-zinc-300 h-8"
                >
                  <ArrowLeft className="size-3 mr-1" /> Platforms
                </Button>

                <Badge variant="secondary" className="capitalize text-xs font-bold bg-zinc-800 text-white flex items-center gap-1.5 py-1 px-2.5">
                  <SocialPlatformIcon platform={currentPlatformObj.id} className="size-3.5 text-fuchsia-400" />
                  <span>{currentPlatformObj.name}</span>
                </Badge>
              </div>

              {/* Action Category Filter Pills */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                {availableActionCategories.map((cat) => {
                  const IconComponent = cat.icon;
                  const active = selectedActionCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedActionCategory(cat.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                        active
                          ? "bg-fuchsia-600 text-white shadow"
                          : "bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white"
                      }`}
                    >
                      <IconComponent className="size-3.5" />
                      <span>{cat.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Service packages list */}
              {loadingServices ? (
                <div className="py-8 text-center text-zinc-400 space-y-2">
                  <Loader2 className="size-6 animate-spin mx-auto text-fuchsia-500" />
                  <p className="text-xs">Loading packages…</p>
                </div>
              ) : filteredServices.length === 0 ? (
                <div className="p-6 text-center text-zinc-400 bg-zinc-900/50 rounded-xl">
                  <HelpCircle className="size-6 mx-auto text-zinc-500 mb-1" />
                  <p className="text-xs">No packages found for this category.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filteredServices.map((service) => (
                    <Card
                      key={service.service}
                      onClick={() => handleSelectService(service)}
                      className="cursor-pointer p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800 hover:border-fuchsia-500/50 transition-all flex items-center justify-between group"
                    >
                      <div className="space-y-1 pr-3">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-white group-hover:text-fuchsia-300 transition-colors">
                            {service.name}
                          </span>
                          {service.refill && (
                            <Badge className="bg-emerald-500/20 text-emerald-400 text-[9px] py-0">
                              30d Refill
                            </Badge>
                          )}
                        </div>
                        <div className="text-[11px] text-zinc-400">
                          Min: <b>{service.min.toLocaleString()}</b> • Max: <b>{service.max.toLocaleString()}</b>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="font-black text-sm text-fuchsia-400">
                          GH₵ {Number(service.rate).toFixed(2)}
                        </div>
                        <div className="text-[10px] text-zinc-500">per 1K</div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* STEP 3: QUANTITY, LINK & PAY */}
          {step === 3 && selectedService && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setStep(2)}
                  className="bg-zinc-900 border-zinc-700 text-xs text-zinc-300 h-8"
                >
                  <ArrowLeft className="size-3 mr-1" /> Packages
                </Button>

                <div className="text-xs text-zinc-400">
                  <span className="capitalize font-bold text-white">{selectedPlatform}</span>:{" "}
                  <span className="text-fuchsia-400">{selectedService.name}</span>
                </div>
              </div>

              {/* Target Link */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="dlg-link" className="text-xs font-bold text-zinc-200">
                    {selectedActionCategory === "followers" ? "Profile Link or @username" : "Post or Video Link"} *
                  </Label>
                  <button
                    type="button"
                    onClick={handlePasteLink}
                    className="text-[11px] text-fuchsia-400 hover:underline flex items-center gap-1 font-semibold"
                  >
                    <Copy className="size-2.5" /> Paste
                  </button>
                </div>
                <Input
                  id="dlg-link"
                  placeholder={
                    selectedActionCategory === "followers"
                      ? `e.g. https://${selectedPlatform}.com/@username or @username`
                      : `e.g. https://${selectedPlatform}.com/p/your-post-id`
                  }
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  className="bg-black/60 border-zinc-700 h-10 text-xs font-mono text-white"
                />
              </div>

              {/* Quantity Selector */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="dlg-qty" className="text-xs font-bold text-zinc-200">
                    Quantity Needed
                  </Label>
                  <span className="text-[11px] font-mono text-zinc-400">
                    Min: {selectedService.min} • Max: {selectedService.max}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleAdjustQuantity(-100)}
                    className="h-10 w-10 text-base font-black bg-zinc-800 border-zinc-700 text-white"
                  >
                    -
                  </Button>
                  <Input
                    id="dlg-qty"
                    type="number"
                    min={selectedService.min}
                    max={selectedService.max}
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                    className="bg-black/60 border-zinc-700 h-10 text-center text-lg font-mono font-black text-white"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleAdjustQuantity(100)}
                    className="h-10 w-10 text-base font-black bg-zinc-800 border-zinc-700 text-white"
                  >
                    +
                  </Button>
                </div>

                {/* Quick Presets */}
                <div className="flex flex-wrap items-center gap-1 pt-1">
                  {[500, 1000, 2500, 5000].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => handleSetExactPreset(preset)}
                      className={`text-[11px] px-2 py-0.5 rounded font-semibold ${
                        quantity === preset
                          ? "bg-fuchsia-600 text-white"
                          : "bg-zinc-800 text-zinc-400 hover:text-white"
                      }`}
                    >
                      {preset >= 1000 ? `${preset / 1000}K` : preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Phone Input */}
              <div className="space-y-1.5">
                <Label htmlFor="dlg-phone" className="text-xs font-bold text-zinc-200">
                  Mobile Money Phone Number *
                </Label>
                <Input
                  id="dlg-phone"
                  type="tel"
                  placeholder="054XXXXXXX"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="bg-black/60 border-zinc-700 h-10 text-xs font-mono text-white"
                />
              </div>

              {/* Price & Summary */}
              <div className="p-3.5 rounded-xl bg-black/60 border border-zinc-800 flex items-center justify-between">
                <div>
                  <div className="text-[11px] text-zinc-400">Total Price:</div>
                  <div className="text-xl font-black text-fuchsia-400">
                    GH₵ {totalPrice.toFixed(2)}
                  </div>
                </div>
                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs font-bold">
                  Instant Auto-Delivery
                </Badge>
              </div>

              {/* Pay Button */}
              <Button
                type="button"
                onClick={handleCheckout}
                disabled={submitting}
                className="w-full h-12 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-bold text-sm shadow-lg shadow-fuchsia-600/30"
              >
                {submitting ? (
                  <>
                    <Loader2 className="size-4 mr-2 animate-spin" />
                    Starting Payment…
                  </>
                ) : (
                  <>
                    <Rocket className="size-4 mr-2" />
                    Pay GH₵ {totalPrice.toFixed(2)} via Paystack
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SocialBoostDialog;
