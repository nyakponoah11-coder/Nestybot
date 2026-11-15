import { useState, useEffect, useMemo } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Rocket,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Sparkles,
  Zap,
  ShieldCheck,
  Search,
  Layers,
} from "lucide-react";
import { invokeApiFunction } from "@/integrations/supabase/client";
import { getSavedPhone, saveOrderToHistory } from "@/lib/orderHistory";

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

const PLATFORMS = [
  { id: "all", label: "All Platforms", icon: Layers, color: "from-zinc-500 to-zinc-700" },
  { id: "tiktok", label: "TikTok", color: "from-slate-900 via-zinc-800 to-black" },
  { id: "instagram", label: "Instagram", color: "from-pink-600 via-rose-500 to-amber-500" },
  { id: "facebook", label: "Facebook", color: "from-blue-600 to-indigo-700" },
  { id: "youtube", label: "YouTube", color: "from-red-600 to-rose-700" },
  { id: "twitter", label: "Twitter (X)", color: "from-zinc-800 to-black" },
  { id: "telegram", label: "Telegram", color: "from-sky-500 to-blue-600" },
  { id: "whatsapp", label: "WhatsApp", color: "from-emerald-500 to-teal-700" },
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
  const [services, setServices] = useState<BoostServiceItem[]>([]);
  const [loadingServices, setLoadingServices] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedServiceId, setSelectedServiceId] = useState<number | string | null>(null);

  const [link, setLink] = useState("");
  const [quantity, setQuantity] = useState<number>(1000);
  const [comments, setComments] = useState("");
  const [phone, setPhone] = useState(() => getSavedPhone());
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
          if (!selectedServiceId && data.services.length > 0) {
            setSelectedServiceId(data.services[0].service);
            setQuantity(data.services[0].min || 100);
          }
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

  // Filtered services by platform & search
  const filteredServices = useMemo(() => {
    return services.filter((s) => {
      const matchPlatform =
        selectedPlatform === "all" ||
        s.platform?.toLowerCase() === selectedPlatform.toLowerCase() ||
        s.category?.toLowerCase().includes(selectedPlatform.toLowerCase());

      const matchSearch =
        !searchQuery.trim() ||
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.category.toLowerCase().includes(searchQuery.toLowerCase());

      return matchPlatform && matchSearch;
    });
  }, [services, selectedPlatform, searchQuery]);

  // Selected service details
  const selectedService = useMemo(() => {
    return (
      services.find((s) => String(s.service) === String(selectedServiceId)) ||
      filteredServices[0] ||
      null
    );
  }, [services, selectedServiceId, filteredServices]);

  // Keep quantity valid within min/max bounds when service changes
  useEffect(() => {
    if (selectedService) {
      if (!selectedServiceId || String(selectedService.service) !== String(selectedServiceId)) {
        setSelectedServiceId(selectedService.service);
      }
      if (quantity < selectedService.min) {
        setQuantity(selectedService.min);
      } else if (selectedService.max > 0 && quantity > selectedService.max) {
        setQuantity(selectedService.max);
      }
    }
  }, [selectedService]);

  // Calculated Price in GHS
  const calculatedPrice = useMemo(() => {
    if (!selectedService || !quantity || quantity <= 0) return 0;
    const ratePerUnit = (Number(selectedService.rate) || 0) / 1000;
    const raw = quantity * ratePerUnit;
    return Math.max(1, Math.round(raw * 100) / 100);
  }, [selectedService, quantity]);

  const requiresComments = useMemo(() => {
    const t = (selectedService?.type || "").toLowerCase();
    const n = (selectedService?.name || "").toLowerCase();
    return t.includes("custom comments") || n.includes("custom comment");
  }, [selectedService]);

  const linkPlaceholder = useMemo(() => {
    const p = (selectedService?.platform || selectedPlatform || "").toLowerCase();
    const n = (selectedService?.name || "").toLowerCase();
    const isFollower = n.includes("follower") || n.includes("subscriber") || n.includes("member");

    if (p.includes("tiktok")) {
      return isFollower
        ? "https://www.tiktok.com/@yourusername"
        : "https://www.tiktok.com/@user/video/1234567890";
    }
    if (p.includes("instagram")) {
      return isFollower
        ? "https://www.instagram.com/yourusername"
        : "https://www.instagram.com/p/CXXXXXXXXXX/ or reel link";
    }
    if (p.includes("facebook")) {
      return isFollower
        ? "https://www.facebook.com/yourpage"
        : "https://www.facebook.com/watch/?v=... or post link";
    }
    if (p.includes("youtube")) {
      return isFollower
        ? "https://www.youtube.com/@channel or channel link"
        : "https://www.youtube.com/watch?v=... video link";
    }
    if (p.includes("twitter") || p.includes("x")) {
      return isFollower
        ? "https://x.com/yourusername"
        : "https://x.com/username/status/1234567890";
    }
    if (p.includes("telegram")) {
      return "https://t.me/channel_or_group";
    }
    return "https://... target profile or post link";
  }, [selectedService, selectedPlatform]);

  const handleQuickAdd = (amountToAdd: number) => {
    if (!selectedService) return;
    const next = Math.min(selectedService.max || 1000000, quantity + amountToAdd);
    setQuantity(next);
  };

  const submit = async () => {
    if (!selectedService) {
      toast.error("Please select a boost service");
      return;
    }

    const cleanPhone = phone.replace(/\s+/g, "");
    if (!/^0\d{9}$/.test(cleanPhone) && !/^\+?233\d{9}$/.test(cleanPhone)) {
      toast.error("Please enter a valid 10-digit Ghana phone number starting with 0");
      return;
    }

    const cleanLink = link.trim();
    if (!cleanLink || !cleanLink.startsWith("http")) {
      toast.error("Please enter a valid link starting with http:// or https://");
      return;
    }

    if (quantity < selectedService.min) {
      toast.error(`Minimum quantity for this service is ${selectedService.min.toLocaleString()}`);
      return;
    }
    if (selectedService.max > 0 && quantity > selectedService.max) {
      toast.error(`Maximum quantity for this service is ${selectedService.max.toLocaleString()}`);
      return;
    }

    if (requiresComments && !comments.trim()) {
      toast.error("Please enter your custom comments list");
      return;
    }

    setSubmitting(true);
    try {
      const callback_url = agentSlug
        ? `${window.location.origin}/s/${agentSlug}`
        : `${window.location.origin}/payment/callback`;

      const boostNotes = [
        `[boost_service_id:${selectedService.service}]`,
        `[boost_service_name:${selectedService.name.slice(0, 100)}]`,
        `[boost_platform:${selectedService.platform || selectedPlatform}]`,
        `[boost_link:${cleanLink}]`,
        `[boost_quantity:${quantity}]`,
        requiresComments ? `[boost_comments:${comments.trim()}]` : "",
        name ? `[name:${name.trim()}]` : "",
      ]
        .filter(Boolean)
        .join(" ");

      const { data, error } = await invokeApiFunction("service-init", {
        body: {
          service: "boost",
          amount: calculatedPrice,
          customer_phone: cleanPhone,
          customer_email: email || undefined,
          customer_name: name || undefined,
          callback_url,
          notes: boostNotes,
          boost_service_id: selectedService.service,
          boost_link: cleanLink,
          boost_quantity: quantity,
          agent_id: agentId || undefined,
          agent_slug: agentSlug || undefined,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.reference) {
        saveOrderToHistory({
          reference: data.reference,
          recipient_phone: cleanPhone,
          amount: calculatedPrice,
          payment_status: "pending",
          delivery_status: "pending",
          type: "service",
        });
      }

      if (data?.authorization_url) {
        window.location.href = data.authorization_url;
      } else {
        throw new Error("Missing payment authorization URL");
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to initialize boost payment");
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[92vh] overflow-y-auto p-4 sm:p-6 bg-background">
        <DialogHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="size-9 rounded-xl bg-gradient-to-tr from-violet-600 via-fuchsia-600 to-pink-500 text-white grid place-items-center shadow-md">
              <Rocket className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-black">Social Media Boost</DialogTitle>
              <DialogDescription className="text-xs">
                Instant Followers, Likes, Views & Engagement powered by BoostUpGH
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Platform Selector Chips */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Select Platform
            </Label>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {PLATFORMS.map((p) => {
                const isSelected = selectedPlatform === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setSelectedPlatform(p.id);
                      setSearchQuery("");
                    }}
                    className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 border ${
                      isSelected
                        ? "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white border-transparent shadow-sm"
                        : "bg-muted/70 text-muted-foreground hover:bg-muted border-border"
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Search Bar & Service Dropdown */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="service_select" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Select Package / Service
              </Label>
              <span className="text-[11px] text-muted-foreground font-medium">
                {filteredServices.length} options available
              </span>
            </div>

            {/* Quick search input */}
            <div className="relative">
              <Search className="size-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search service (e.g. Followers, Likes, Views)..."
                className="h-8 pl-8 text-xs bg-muted/40"
              />
            </div>

            {loadingServices ? (
              <div className="p-6 border rounded-xl flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="size-4 animate-spin text-fuchsia-600" />
                Loading packages...
              </div>
            ) : filteredServices.length === 0 ? (
              <div className="p-4 border rounded-xl text-center text-xs text-muted-foreground">
                No services found matching this filter. Try selecting &quot;All Platforms&quot;.
              </div>
            ) : (
              <select
                id="service_select"
                value={selectedService?.service || ""}
                onChange={(e) => setSelectedServiceId(e.target.value)}
                className="w-full h-11 px-3 rounded-xl border border-input bg-background text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-fuchsia-500"
              >
                {filteredServices.map((s) => (
                  <option key={s.service} value={s.service}>
                    {s.name} — GH₵ {Number(s.rate).toFixed(2)}/1K
                  </option>
                ))}
              </select>
            )}

            {/* Selected Service Badge Strip */}
            {selectedService && (
              <div className="p-3 rounded-xl bg-gradient-to-br from-fuchsia-500/10 via-purple-500/5 to-transparent border border-fuchsia-500/20 text-xs space-y-1.5">
                <div className="flex items-center justify-between font-bold">
                  <span className="text-fuchsia-600 dark:text-fuchsia-400 truncate pr-2">
                    {selectedService.name}
                  </span>
                  <Badge variant="outline" className="border-fuchsia-500/40 text-fuchsia-600 dark:text-fuchsia-400 shrink-0 font-bold">
                    GH₵ {Number(selectedService.rate).toFixed(2)} / 1,000
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                  <span>Min: <strong>{selectedService.min.toLocaleString()}</strong></span>
                  <span>Max: <strong>{selectedService.max ? selectedService.max.toLocaleString() : "Unlimited"}</strong></span>
                  {selectedService.refill && (
                    <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                      <ShieldCheck className="size-3" /> Guaranteed Refill
                    </span>
                  )}
                  <span className="text-indigo-600 dark:text-indigo-400 flex items-center gap-0.5">
                    <Zap className="size-3" /> Fast Delivery
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Target Link Input */}
          <div className="space-y-1.5">
            <Label htmlFor="boost_link" className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              <span>Account or Post Link</span>
              <span className="text-[10px] text-fuchsia-600 font-semibold lowercase">Required</span>
            </Label>
            <Input
              id="boost_link"
              type="url"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder={linkPlaceholder}
              className="h-10 text-xs sm:text-sm font-mono"
            />
            <p className="text-[11px] text-muted-foreground">
              Make sure your account or post is <strong>Public</strong> before boosting.
            </p>
          </div>

          {/* Quantity Selector + Quick Chips */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="boost_quantity" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Quantity
              </Label>
              {selectedService && (
                <span className="text-[11px] text-muted-foreground">
                  Limits: {selectedService.min.toLocaleString()} - {selectedService.max?.toLocaleString() || "1M"}
                </span>
              )}
            </div>

            <Input
              id="boost_quantity"
              type="number"
              min={selectedService?.min || 50}
              max={selectedService?.max || 1000000}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value) || 0)}
              className="h-11 text-base font-bold text-center"
            />

            {/* Quick Increment Buttons */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {[100, 500, 1000, 2500, 5000, 10000].map((inc) => (
                <button
                  key={inc}
                  type="button"
                  onClick={() => setQuantity(inc)}
                  className={`shrink-0 px-2.5 py-1 rounded-lg text-xs font-semibold border transition ${
                    quantity === inc
                      ? "bg-fuchsia-600 text-white border-transparent"
                      : "bg-muted/60 text-muted-foreground hover:bg-muted border-border"
                  }`}
                >
                  {inc >= 1000 ? `${inc / 1000}K` : inc}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Comments (if applicable) */}
          {requiresComments && (
            <div className="space-y-1.5">
              <Label htmlFor="boost_comments" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Custom Comments (one per line)
              </Label>
              <Textarea
                id="boost_comments"
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="Awesome!&#10;Love this!&#10;Great work!"
                rows={3}
                className="text-xs"
              />
            </div>
          )}

          {/* Recipient Details (Phone + Name) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="space-y-1.5">
              <Label htmlFor="boost_phone" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Ghana Phone (MoMo / SMS)
              </Label>
              <Input
                id="boost_phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="054XXXXXXX"
                className="h-10 text-xs sm:text-sm font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="boost_name" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Your Name <span className="opacity-70">(optional)</span>
              </Label>
              <Input
                id="boost_name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Kwame Mensah"
                className="h-10 text-xs sm:text-sm"
              />
            </div>
          </div>

          {/* Live Price Summary Box */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-violet-600 via-fuchsia-600 to-pink-600 text-white shadow-lg space-y-1">
            <div className="flex items-center justify-between text-xs opacity-90 font-medium uppercase tracking-wider">
              <span>Total Payable</span>
              <span>Instant Paystack Checkout</span>
            </div>
            <div className="flex items-baseline justify-between">
              <div className="text-3xl font-black tracking-tight">
                GH₵ {calculatedPrice.toFixed(2)}
              </div>
              <div className="text-xs opacity-90">
                {quantity.toLocaleString()} {selectedService?.name?.split("[")[0]?.trim() || "Units"}
              </div>
            </div>
          </div>

          {/* Submit Paystack Checkout Button */}
          <Button
            type="button"
            onClick={submit}
            disabled={submitting || !selectedService || calculatedPrice < 1}
            className="w-full h-12 rounded-xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-pink-600 text-white font-black text-base hover:opacity-95 shadow-md flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="size-5 animate-spin" />
                Connecting to Paystack...
              </>
            ) : (
              <>
                <Zap className="size-5" />
                Boost Now • GH₵ {calculatedPrice.toFixed(2)}
              </>
            )}
          </Button>

          <p className="text-[11px] text-center text-muted-foreground flex items-center justify-center gap-1">
            <ShieldCheck className="size-3.5 text-emerald-500" />
            100% Safe &amp; Secure. Track your boost live anytime on our tracking page.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
