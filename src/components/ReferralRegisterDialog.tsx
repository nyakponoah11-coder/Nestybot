import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { validateGhanaPhone } from "@/lib/networks";
import { Loader2, Copy, Share2, Gift, Sparkles } from "lucide-react";
import { toast } from "sonner";

interface Referral {
  code: string;
  owner_phone: string;
  redemptions_count: number;
  reward_sent: boolean;
}

const STORAGE_KEY = "referral_owner";

export const getStoredReferral = (): Referral | null => {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v ? JSON.parse(v) : null;
  } catch { return null; }
};

export const ReferralRegisterDialog = ({
  open, onOpenChange,
}: { open: boolean; onOpenChange: (o: boolean) => void }) => {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [referral, setReferral] = useState<Referral | null>(getStoredReferral());

  const handleRegister = async () => {
    if (!validateGhanaPhone(phone)) {
      toast.error("Enter a valid Ghana phone number (e.g. 0541234567)");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("referral-register", {
        body: { phone: phone.replace(/\s+/g, "") },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const r = data.referral as Referral;
      setReferral(r);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(r));
      toast.success("Your referral code is ready!");
    } catch (e: any) {
      toast.error(e.message || "Could not create code");
    } finally {
      setLoading(false);
    }
  };

  const shareUrl = referral ? `${window.location.origin}/?ref=${referral.code}` : "";
  const shareText = referral
    ? `🎁 Get fast & cheap data bundles at this shop. Use my code ${referral.code} on your first order! ${shareUrl}`
    : "";

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied`);
    } catch { toast.error("Copy failed"); }
  };

  const share = async () => {
    if (navigator.share && referral) {
      try {
        await navigator.share({ title: "Get cheap data", text: shareText, url: shareUrl });
      } catch {}
    } else {
      copy(shareText, "Share message");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="size-5 text-accent" />
            Invite friends, win 5GB MTN
          </DialogTitle>
          <DialogDescription>
            Share your unique code. When 5 different friends buy their first bundle with it, we'll send 5GB free to your number.
          </DialogDescription>
        </DialogHeader>

        {!referral ? (
          <>
            <div>
              <Label htmlFor="ref-phone">Your phone number (where 5GB will be sent)</Label>
              <Input
                id="ref-phone" type="tel" placeholder="0541234567"
                value={phone} onChange={e => setPhone(e.target.value)}
                inputMode="numeric" maxLength={13}
              />
              <p className="text-xs text-muted-foreground mt-1">Must be an MTN number to receive the 5GB reward.</p>
            </div>
            <Button
              onClick={handleRegister}
              disabled={loading}
              className="w-full h-11 bg-gradient-gold text-accent-foreground hover:opacity-90 font-semibold"
            >
              {loading ? <Loader2 className="size-4 animate-spin" /> : "Get my code"}
            </Button>
          </>
        ) : (
          <>
            <div className="rounded-2xl border-2 border-accent/40 bg-gradient-to-br from-amber-200 via-yellow-300 to-orange-300 p-5 text-center">
              <div className="text-xs font-bold uppercase tracking-wider text-amber-900">Your referral code</div>
              <div className="text-4xl font-black tracking-[0.3em] text-zinc-900 mt-1">{referral.code}</div>
              <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-900/10 text-zinc-900 text-xs font-semibold">
                <Sparkles className="size-3.5" />
                {referral.redemptions_count}/5 friends so far
                {referral.reward_sent ? " · Reward sent ✓" : ""}
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => copy(referral.code, "Code")}>
                <Copy className="size-4 mr-2" /> Copy code
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => copy(shareUrl, "Link")}>
                <Copy className="size-4 mr-2" /> Copy link
              </Button>
            </div>
            <Button onClick={share} className="w-full h-11 bg-gradient-gold text-accent-foreground hover:opacity-90 font-semibold">
              <Share2 className="size-4 mr-2" /> Share with friends
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Only counts when a friend's phone number is brand new on this shop.
            </p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
