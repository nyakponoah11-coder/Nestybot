import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { invokeApiFunction } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Zap, Phone, Wifi } from "lucide-react";
import { validateGhanaPhone } from "@/lib/networks";
import { saveOrderToHistory, getSavedPhone } from "@/lib/orderHistory";

type Service = "netflix" | "afa" | "mashup";

export const MASHUP_PRESETS = [
  { price: 1, data: "50 MB", voice: "5 Mins" },
  { price: 2, data: "120 MB", voice: "10 Mins" },
  { price: 3, data: "200 MB", voice: "15 Mins" },
  { price: 4, data: "300 MB", voice: "20 Mins" },
  { price: 5, data: "500 MB", voice: "30 Mins" },
  { price: 10, data: "1.2 GB", voice: "60 Mins" },
  { price: 15, data: "2.0 GB", voice: "90 Mins" },
  { price: 20, data: "3.0 GB", voice: "120 Mins" },
  { price: 25, data: "4.0 GB", voice: "150 Mins" },
  { price: 30, data: "5.5 GB", voice: "180 Mins" },
  { price: 50, data: "10.0 GB", voice: "300 Mins" },
];

const META: Record<Service, { title: string; note: string; accent: string }> = {
  netflix: {
    title: "Netflix — 1 month sign-in",
    note: "This is a 1-month subscription. After payment you'll receive your sign-in details and sign-in code via SMS automatically.",
    accent: "from-red-600 to-red-800",
  },
  afa: {
    title: "AFA registration",
    note: "After payment, WhatsApp will open so you can send your details for registration.",
    accent: "from-emerald-600 to-emerald-800",
  },
  mashup: {
    title: "MTN Mashup (Data + Voice)",
    note: "Select your preferred combo package from 1 Cedi upwards. Delivered straight to your MTN number.",
    accent: "from-amber-500 via-amber-600 to-yellow-600",
  },
};

export const ServiceCheckoutDialog = ({
  service,
  netflixPrice = 30,
  afaPrice = 20,
  mashupPrice = 25,
  agentId,
  agentSlug,
  onOpenChange,
}: {
  service: Service | null;
  netflixPrice?: number;
  afaPrice?: number;
  mashupPrice?: number;
  agentId?: string;
  agentSlug?: string;
  onOpenChange: (open: boolean) => void;
}) => {
  const [phone, setPhone] = useState(() => getSavedPhone());
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [selectedMashup, setSelectedMashup] = useState(2);
  const [isCustomMashup, setIsCustomMashup] = useState(false);
  const [customAmount, setCustomAmount] = useState("");
  const [loading, setLoading] = useState(false);

  const meta = service ? META[service] : null;

  const currentPrice =
    service === "netflix"
      ? netflixPrice
      : service === "afa"
      ? afaPrice
      : service === "mashup"
      ? isCustomMashup
        ? Number(customAmount) > 0
          ? Number(customAmount)
          : 1
        : selectedMashup
      : 0;

  const selectedPreset = MASHUP_PRESETS.find((p) => p.price === selectedMashup);
  const mashupPackageDesc =
    service === "mashup"
      ? isCustomMashup
        ? `GH₵ ${currentPrice} Custom Mashup Combo`
        : `GH₵ ${selectedMashup} Mashup (${selectedPreset?.data} + ${selectedPreset?.voice})`
      : undefined;

  const submit = async () => {
    if (!service) return;
    if (!validateGhanaPhone(phone)) {
      toast.error("Enter a valid Ghana phone number");
      return;
    }
    if (service === "mashup" && currentPrice < 1) {
      toast.error("Minimum Mashup order is GH₵ 1");
      return;
    }

    setLoading(true);
    try {
      const callback_url = agentSlug
        ? `${window.location.origin}/s/${agentSlug}`
        : `${window.location.origin}/payment/callback`;

      const { data, error } = await invokeApiFunction("service-init", {
        body: {
          service,
          amount: currentPrice,
          mashup_package: mashupPackageDesc,
          customer_phone: phone,
          customer_email: email || undefined,
          customer_name: name || undefined,
          callback_url,
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
          amount: currentPrice,
          payment_status: "pending",
          delivery_status: "pending",
          type: "service",
        });
      }
      window.location.href = data.authorization_url;
    } catch (e: any) {
      toast.error(e.message || "Could not start payment");
      setLoading(false);
    }
  };

  return (
    <Dialog open={!!service} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        {meta && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {service === "mashup" && <Zap className="size-5 text-amber-500" />}
                {meta.title}
              </DialogTitle>
              <DialogDescription>{meta.note}</DialogDescription>
            </DialogHeader>

            {/* Total / Package Summary */}
            <div className={`rounded-xl p-4 bg-gradient-to-br ${meta.accent} text-white shadow-md`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs opacity-85 uppercase tracking-wider font-semibold">Total to Pay</div>
                  <div className="text-3xl font-black mt-0.5">GH₵ {Number(currentPrice).toFixed(2)}</div>
                </div>
                {service === "mashup" && (
                  <div className="text-right text-xs bg-black/25 backdrop-blur px-3 py-1.5 rounded-lg border border-white/20">
                    <div className="font-bold flex items-center gap-1 justify-end">
                      <Wifi className="size-3" /> {isCustomMashup ? "Custom Combo" : selectedPreset?.data}
                    </div>
                    <div className="opacity-90 flex items-center gap-1 justify-end">
                      <Phone className="size-3" /> {isCustomMashup ? "Airtime + Data" : selectedPreset?.voice}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Mashup Package Selection */}
            {service === "mashup" && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Choose Combo Package
                  </Label>
                  <span className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold">
                    1 Cedi upwards
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {MASHUP_PRESETS.map((p) => {
                    const active = !isCustomMashup && selectedMashup === p.price;
                    return (
                      <button
                        key={p.price}
                        type="button"
                        onClick={() => {
                          setSelectedMashup(p.price);
                          setIsCustomMashup(false);
                        }}
                        className={`p-2.5 rounded-xl border text-left transition-all ${
                          active
                            ? "border-amber-500 bg-amber-500/15 text-foreground ring-2 ring-amber-500/30 font-bold"
                            : "border-border bg-card/60 hover:bg-muted text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <div className="text-sm font-extrabold text-amber-600 dark:text-amber-400">
                          GH₵ {p.price}
                        </div>
                        <div className="text-[11px] font-semibold text-foreground/90 mt-0.5 truncate">
                          {p.data}
                        </div>
                        <div className="text-[10px] text-muted-foreground truncate">{p.voice}</div>
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => setIsCustomMashup(true)}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      isCustomMashup
                        ? "border-amber-500 bg-amber-500/15 text-foreground ring-2 ring-amber-500/30 font-bold"
                        : "border-border bg-card/60 hover:bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <div className="text-sm font-extrabold text-amber-600 dark:text-amber-400">Custom</div>
                    <div className="text-[11px] text-foreground/90 mt-0.5">Enter Cedis</div>
                    <div className="text-[10px] text-muted-foreground">1+ Cedi</div>
                  </button>
                </div>

                {isCustomMashup && (
                  <div className="p-3 rounded-xl border border-amber-500/40 bg-amber-500/10 space-y-1.5 mt-2">
                    <Label htmlFor="custom-cedis" className="text-xs font-semibold">
                      Enter Amount in Cedis (GH₵)
                    </Label>
                    <Input
                      id="custom-cedis"
                      type="number"
                      inputMode="decimal"
                      min="1"
                      step="1"
                      placeholder="e.g. 7, 12, 40"
                      value={customAmount}
                      onChange={(e) => setCustomAmount(e.target.value)}
                      className="bg-background"
                      autoFocus
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Minimum GH₵ 1.00. Your combo will be delivered based on this amount.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Customer Inputs */}
            <div className="space-y-3 pt-1">
              <div>
                <Label htmlFor="sph">
                  {service === "mashup" ? "MTN Ghana Phone Number" : "Your Phone Number (Ghana)"}
                </Label>
                <Input
                  id="sph"
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0244123456"
                  className="mt-1"
                />
                {service === "mashup" && (
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Mashup will be credited directly to this MTN number.
                  </p>
                )}
              </div>
            </div>

            <Button
              className="w-full h-11 bg-gradient-gold text-accent-foreground hover:opacity-90 font-bold text-sm shadow-md mt-2"
              disabled={loading}
              onClick={submit}
            >
              {loading ? <Loader2 className="size-4 mr-2 animate-spin" /> : null}
              Pay GH₵ {Number(currentPrice).toFixed(2)} with Paystack
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
