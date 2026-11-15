import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { invokeApiFunction } from "@/integrations/supabase/client";
import { validateGhanaPhone } from "@/lib/networks";
import { Loader2, Copy, PartyPopper, Sparkles, Volume2, VolumeX, Clock, Share2, Check } from "lucide-react";
import { toast } from "sonner";
import { gameAudio } from "@/lib/gameAudio";

// Slices prominently displayed on the wheel
const PRIZES = ["Try Again", "2GB", "5GB", "10GB", "15GB", "50GB"];
const SEG = 360 / PRIZES.length;
const COLORS = [
  "hsl(340 82% 52%)", // Rose for Try Again
  "hsl(45 100% 50%)",  // Gold for 2GB
  "hsl(150 70% 42%)", // Emerald for 5GB
  "hsl(215 80% 48%)", // Blue for 10GB
  "hsl(262 83% 58%)", // Purple for 15GB
  "hsl(24 95% 53%)",  // Orange for 50GB
];

// Secret winnable indices: 0 (Try Again), 1 (2GB), 2 (5GB)
const WINNABLE_INDICES = [0, 1, 2];
const COOLDOWN_HOURS = 4;
const COOLDOWN_MS = COOLDOWN_HOURS * 60 * 60 * 1000;

function formatCountdown(ms: number): string {
  if (ms <= 0) return "00:00:00";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export const SpinGameDialog = ({
  open, onOpenChange, onClaimSuccess,
}: { open: boolean; onOpenChange: (o: boolean) => void; onClaimSuccess?: () => void }) => {
  const [angle, setAngle] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [prizeIndex, setPrizeIndex] = useState<number | null>(null);
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [muted, setMuted] = useState(() => gameAudio.getMuted());
  const [cooldownRemaining, setCooldownRemaining] = useState<number>(0);
  const tickIntervalsRef = useRef<number[]>([]);

  const phoneValid = validateGhanaPhone(phone.replace(/\s+/g, ""));

  const gradient = `conic-gradient(${PRIZES.map((_, i) =>
    `${COLORS[i]} ${i * SEG}deg ${(i + 1) * SEG}deg`).join(", ")})`;

  // Check 4-hour cooldown timer
  useEffect(() => {
    const updateCooldown = () => {
      const nextTime = Number(localStorage.getItem("spin_next_available") || 0);
      const diff = nextTime - Date.now();
      setCooldownRemaining(diff > 0 ? diff : 0);
    };

    updateCooldown();
    const interval = setInterval(updateCooldown, 1000);
    return () => clearInterval(interval);
  }, [open]);

  useEffect(() => {
    return () => {
      tickIntervalsRef.current.forEach(t => clearTimeout(t));
      tickIntervalsRef.current = [];
    };
  }, []);

  const toggleSound = () => {
    const nextMuted = gameAudio.toggleMute();
    setMuted(nextMuted);
  };

  const spin = () => {
    if (spinning || cooldownRemaining > 0) return;
    setPrizeIndex(null);
    gameAudio.resume();
    setSpinning(true);

    // Pick among winnable indices: 0 (Try Again), 1 (2GB), 2 (5GB)
    const idx = WINNABLE_INDICES[Math.floor(Math.random() * WINNABLE_INDICES.length)];
    // Align wheel so top pointer lands precisely on slice idx
    const target = (360 * 6) + (360 - (idx * SEG + SEG / 2));
    setAngle(target);

    // Schedule decelerating ticks
    tickIntervalsRef.current.forEach(t => clearTimeout(t));
    tickIntervalsRef.current = [];

    let elapsed = 0;
    let delay = 60;
    while (elapsed < 4000) {
      const currentDelay = delay;
      const tid = window.setTimeout(() => {
        gameAudio.playSpinTick(Math.max(0.8, 1.3 - elapsed / 5000));
      }, elapsed);
      tickIntervalsRef.current.push(tid);
      elapsed += currentDelay;
      delay = Math.floor(delay * 1.08 + 3);
    }

    setTimeout(() => {
      setSpinning(false);
      setPrizeIndex(idx);

      if (idx === 0) {
        // "Try Again": Set 4-hour cooldown
        const nextTime = Date.now() + COOLDOWN_MS;
        localStorage.setItem("spin_next_available", String(nextTime));
        setCooldownRemaining(COOLDOWN_MS);
      } else {
        gameAudio.playCelebration();
      }
    }, 4200);
  };

  const wonPrize = prizeIndex !== null ? PRIZES[prizeIndex] : null;
  const isTryAgain = wonPrize === "Try Again";
  const prizeGigValue = wonPrize === "5GB" ? "5" : "2";

  const claim = async () => {
    if (!validateGhanaPhone(phone)) {
      toast.error("Enter a valid Ghana phone number (e.g. 0541234567)");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await invokeApiFunction("spin-claim", {
        body: { phone: phone.replace(/\s+/g, ""), prize: prizeGigValue },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const generatedCode = data?.spin?.code;
      if (!generatedCode) throw new Error("Could not generate referral link");
      setCode(generatedCode);
      localStorage.setItem("spin_code", generatedCode);
      try {
        const cleanP = phone.replace(/\s+/g, "");
        const spinRecord = {
          id: data?.spin?.id || `local_${generatedCode}`,
          code: generatedCode,
          owner_phone: data?.spin?.owner_phone || cleanP,
          prize_capacity: String(data?.spin?.prize_capacity || prizeGigValue),
          orders_count: Number(data?.spin?.orders_count ?? 0),
          reward_sent: Boolean(data?.spin?.reward_sent),
          reward_reference: data?.spin?.reward_reference || null,
          reward_sent_at: data?.spin?.reward_sent_at || null,
          created_at: data?.spin?.created_at || new Date().toISOString(),
        };
        const rawList = localStorage.getItem("data1_local_spin_wins");
        const existingList: any[] = rawList ? JSON.parse(rawList) : [];
        const filtered = existingList.filter((w) => String(w?.code).toUpperCase() !== String(generatedCode).toUpperCase());
        localStorage.setItem("data1_local_spin_wins", JSON.stringify([spinRecord, ...filtered].slice(0, 100)));
        localStorage.removeItem("data1_cache_admin_spin_report");
      } catch (_) {}
      onClaimSuccess?.();
      toast.success("Your referral link is ready!");
    } catch (e: any) {
      toast.error(e.message || "Could not generate referral link");
    } finally {
      setLoading(false);
    }
  };

  const referralUrl = typeof window !== "undefined" && code
    ? `${window.location.origin}/?ref=${code}`
    : "";

  const copyReferralLink = async () => {
    if (!referralUrl) return;
    try {
      await navigator.clipboard.writeText(referralUrl);
      setCopied(true);
      toast.success("Referral link copied to clipboard!");
      setTimeout(() => setCopied(false), 2500);
    } catch (_) {
      toast.error("Failed to copy link");
    }
  };

  const shareOnWhatsApp = () => {
    if (!referralUrl) return;
    const msg = `🎉 Buy cheap, instant data bundles on Data1GH! Click here to order: ${referralUrl}`;
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, "_blank");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="dark max-w-md bg-card/95 backdrop-blur-xl border-accent/40 shadow-2xl">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-xl font-black">
              <Sparkles className="size-5 text-accent" /> Spin &amp; Win Free Data
            </DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleSound}
              title={muted ? "Unmute sound" : "Mute sound"}
              className="size-8 p-0 text-muted-foreground hover:text-foreground"
            >
              {muted ? <VolumeX className="size-4 text-muted-foreground" /> : <Volume2 className="size-4 text-accent" />}
            </Button>
          </div>
          <DialogDescription>
            Spin the wheel to win free data! Share your exclusive link to receive your gift.
          </DialogDescription>
        </DialogHeader>

        {/* Active 4-Hour Cooldown Display */}
        {cooldownRemaining > 0 && prizeIndex === null && !code && (
          <div className="py-6 px-4 text-center space-y-4">
            <div className="inline-flex size-16 rounded-2xl bg-amber-500/20 text-amber-400 items-center justify-center">
              <Clock className="size-8 animate-pulse" />
            </div>
            <div>
              <div className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
                Next Spin Available In
              </div>
              <div className="mt-1 font-mono text-3xl font-black text-amber-400 tracking-wider">
                {formatCountdown(cooldownRemaining)}
              </div>
            </div>
            <p className="text-xs text-muted-foreground max-w-xs mx-auto">
              You can spin once every 4 hours. Keep checking back for your next free spin!
            </p>
            <Button
              className="w-full h-11 rounded-xl font-bold bg-accent text-accent-foreground"
              onClick={() => onOpenChange(false)}
            >
              Back to Shop
            </Button>
          </div>
        )}

        {/* Wheel & Gameplay Screen */}
        {(!cooldownRemaining || prizeIndex !== null) && !code && (
          <div className="flex flex-col items-center gap-4 py-2">
            <div className="relative size-64">
              {/* Top pointer indicator */}
              <div
                className="absolute left-1/2 -top-1.5 z-20 -translate-x-1/2 size-0 border-x-[12px] border-x-transparent border-t-[20px]"
                style={{ borderTopColor: "hsl(var(--accent))" }}
              />
              <div
                className="size-64 rounded-full border-4 border-accent shadow-glow relative overflow-hidden"
                style={{
                  background: gradient,
                  transform: `rotate(${angle}deg)`,
                  transition: spinning ? "transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)" : undefined,
                }}
              >
                {PRIZES.map((p, i) => (
                  <span
                    key={`${p}-${i}`}
                    className="absolute left-1/2 top-1/2 text-xs font-black text-white drop-shadow-md select-none"
                    style={{
                      transform: `rotate(${i * SEG + SEG / 2}deg) translateY(-88px) rotate(180deg)`,
                      transformOrigin: "0 0",
                    }}
                  >
                    {p}
                  </span>
                ))}
              </div>
              <div className="absolute left-1/2 top-1/2 z-10 size-11 -translate-x-1/2 -translate-y-1/2 rounded-full bg-background border-4 border-accent shadow-md flex items-center justify-center">
                <Sparkles className="size-4 text-accent" />
              </div>
            </div>

            {prizeIndex === null ? (
              <div className="w-full space-y-2">
                <Button
                  onClick={spin}
                  disabled={spinning}
                  className="w-full h-12 rounded-xl bg-gradient-gold text-accent-foreground font-black text-base shadow-lg"
                >
                  {spinning ? "Spinning…" : "SPIN NOW"}
                </Button>
                <Button
                  variant="ghost"
                  disabled={spinning}
                  onClick={() => onOpenChange(false)}
                  className="w-full h-9 rounded-xl text-muted-foreground text-xs"
                >
                  No thanks, maybe later
                </Button>
              </div>
            ) : isTryAgain ? (
              <div className="w-full space-y-3 text-center">
                <div className="rounded-xl border-2 border-amber-500/40 bg-amber-500/10 p-4">
                  <Clock className="mx-auto size-7 text-amber-500 mb-1" />
                  <div className="font-black text-lg text-amber-400">
                    Try Again in 4 Hours! ⏳
                  </div>
                  <div className="mt-1 font-mono text-xl font-bold text-foreground">
                    {formatCountdown(cooldownRemaining)}
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    You can spin again every 4 hours. The wheel will be ready for you soon!
                  </p>
                </div>
                <Button
                  onClick={() => onOpenChange(false)}
                  className="w-full h-11 rounded-xl bg-gradient-gold text-accent-foreground font-bold text-sm"
                >
                  Continue Shopping
                </Button>
              </div>
            ) : (
              <div className="w-full space-y-3">
                <div className="rounded-xl border-2 border-success/50 bg-success/10 p-4 text-center">
                  <PartyPopper className="mx-auto size-7 text-success mb-1" />
                  <div className="font-black text-lg text-success">
                    Congratulations! You won {wonPrize} 🎉
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Enter your phone number to get your exclusive referral link.
                    When 5 orders are placed through your link, our team will review and send your {wonPrize} gift to your number!
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="spin-phone" className="text-sm font-semibold">
                    Phone number to receive the {wonPrize} data
                  </Label>
                  <Input
                    id="spin-phone"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    maxLength={15}
                    value={phone}
                    onChange={e => setPhone(e.target.value.replace(/[^\d+ ]/g, "").slice(0, 15))}
                    placeholder="0541234567"
                    className={`h-13 rounded-xl text-center text-lg font-bold tracking-[0.15em] bg-background/70 border-2 ${
                      phone.length === 0
                        ? "border-accent/40"
                        : phoneValid ? "border-success" : "border-destructive"
                    }`}
                  />
                  <p className={`text-xs ${phone.length === 0 || phoneValid ? "text-muted-foreground" : "text-destructive"}`}>
                    {phone.length === 0
                      ? "10 digits, e.g. 0541234567"
                      : phoneValid ? "Looks good ✓" : "Please enter a valid Ghana phone number"}
                  </p>
                </div>

                <Button
                  onClick={claim}
                  disabled={loading || !phoneValid}
                  className="w-full h-12 rounded-xl font-black bg-gradient-gold text-accent-foreground shadow-md"
                >
                  {loading ? <Loader2 className="size-4 animate-spin mr-2" /> : <Sparkles className="size-4 mr-1.5 text-accent-foreground" />}
                  {loading ? "Generating Link…" : "Get My Referral Link"}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Winning Link Screen */}
        {code && (
          <div className="space-y-4 py-2 text-center">
            <div className="inline-flex size-14 rounded-2xl bg-emerald-500/20 text-emerald-400 items-center justify-center mx-auto">
              <PartyPopper className="size-8" />
            </div>

            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground font-bold">
                Your Exclusive Referral Link
              </div>
              <div className="mt-1 text-xl font-black text-foreground">
                You won {wonPrize || "Free Data"}! 🎁
              </div>
            </div>

            {/* Referral Link Box */}
            <div className="p-3.5 rounded-xl border border-accent/40 bg-background/80 text-left space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Share this link with customers/friends:</span>
                <span className="font-mono font-bold text-accent">{code}</span>
              </div>
              <div className="font-mono text-xs font-bold text-foreground bg-muted/60 p-2.5 rounded-lg break-all border border-border">
                {referralUrl}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                className="h-11 rounded-xl border-accent/50 hover:bg-accent/10 font-bold text-xs"
                onClick={copyReferralLink}
              >
                {copied ? <Check className="size-4 mr-1.5 text-success" /> : <Copy className="size-4 mr-1.5 text-accent" />}
                {copied ? "Link Copied!" : "Copy Link"}
              </Button>

              <Button
                className="h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md"
                onClick={shareOnWhatsApp}
              >
                <Share2 className="size-4 mr-1.5" /> Share on WhatsApp
              </Button>
            </div>

            {/* How it works info */}
            <div className="rounded-xl border border-border bg-muted/30 p-3 text-left space-y-1.5 text-xs">
              <div className="font-bold flex items-center gap-1.5 text-accent">
                <Sparkles className="size-3.5" /> How it works:
              </div>
              <ul className="list-disc list-inside text-muted-foreground space-y-1">
                <li>Send your link to friends or customers.</li>
                <li>When they place an order, your code applies automatically.</li>
                <li>Once 5 orders are completed, our team will review and send your {wonPrize || "free data"} gift to your number!</li>
              </ul>
              <div className="text-[11px] font-semibold text-emerald-400 mt-1">
                Current progress: 0/5 orders completed
              </div>
            </div>

            <Button
              className="w-full h-10 rounded-xl"
              onClick={() => onOpenChange(false)}
            >
              Start Shopping
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
