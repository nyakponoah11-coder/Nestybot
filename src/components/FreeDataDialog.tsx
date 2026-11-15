import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { invokeApiFunction } from "@/integrations/supabase/client";
import { validateGhanaPhone } from "@/lib/networks";
import { Gift, Loader2, Sparkles, PartyPopper, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface FreeDataDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const FreeDataDialog = ({ open, onOpenChange }: FreeDataDialogProps) => {
  const [code, setCode] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [claimedVoucher, setClaimedVoucher] = useState<any | null>(null);

  const phoneValid = validateGhanaPhone(phone.replace(/\s+/g, ""));
  const codeValid = code.trim().length >= 6;

  const handleClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanPhone = phone.replace(/\s+/g, "");
    const cleanCode = code.trim().toUpperCase();

    if (!cleanCode) {
      setErrorMsg("Please enter your 10-character Free Data code.");
      return;
    }

    if (!phoneValid) {
      setErrorMsg("Please enter a valid Ghana phone number (e.g. 0541234567).");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await invokeApiFunction("free-data", {
        body: {
          action: "claimCode",
          code: cleanCode,
          phone: cleanPhone,
        },
      });

      if (error || data?.error) {
        throw new Error(data?.error || error?.message || "Could not claim this code.");
      }

      setClaimedVoucher(data.voucher);
      toast.success("Free data successfully claimed!");
    } catch (err: any) {
      const msg = err.message || "Could not claim free data. Please check your code.";
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const resetDialog = () => {
    setCode("");
    setPhone("");
    setErrorMsg(null);
    setClaimedVoucher(null);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) resetDialog();
        onOpenChange(o);
      }}
    >
      <DialogContent className="dark max-w-md bg-slate-900 text-white backdrop-blur-2xl border-2 border-amber-500/40 shadow-2xl p-6 sm:p-7 rounded-2xl">
        <DialogHeader className="text-left space-y-2">
          <DialogTitle className="flex items-center gap-2.5 text-xl sm:text-2xl font-black text-white">
            <Gift className="size-6 text-amber-400 animate-bounce" /> Claim Your Free Data
          </DialogTitle>
          <DialogDescription className="text-slate-300 text-xs sm:text-sm leading-relaxed">
            Got a promo voucher code? Enter your phone number and type your 10-character code below to claim your free bundle.
          </DialogDescription>
        </DialogHeader>

        {!claimedVoucher ? (
          <form onSubmit={handleClaim} className="space-y-4 mt-3">
            {errorMsg && (
              <div className="rounded-xl border border-destructive/50 bg-destructive/15 p-3 flex items-start gap-2.5 text-xs text-rose-300">
                <AlertCircle className="size-4 shrink-0 mt-0.5 text-rose-400" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="free-data-phone" className="text-sm font-bold text-white tracking-wide flex items-center justify-between">
                <span>Recipient Phone Number</span>
                {phone.length > 0 && (
                  <span className={`text-xs font-semibold ${phoneValid ? "text-emerald-400" : "text-rose-400"}`}>
                    {phoneValid ? "✓ Valid number" : "10-digits (0XXXXXXXXX)"}
                  </span>
                )}
              </Label>
              <Input
                id="free-data-phone"
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                maxLength={15}
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/[^\d+ ]/g, "").slice(0, 15))}
                placeholder="0541234567"
                className={`h-12 rounded-xl text-center text-lg sm:text-xl font-bold tracking-widest bg-slate-950 text-white placeholder:text-slate-500 border-2 ${
                  phone.length === 0
                    ? "border-slate-700"
                    : phoneValid
                    ? "border-emerald-500 shadow-sm shadow-emerald-500/20"
                    : "border-destructive"
                } focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:border-amber-400`}
              />
              <p className="text-xs text-slate-300">
                Enter the phone number that should receive the free data bundle.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="free-data-code" className="text-sm font-bold text-white tracking-wide flex items-center justify-between">
                <span>Free Data Voucher Code</span>
                <span className="text-xs text-amber-300 font-mono">10 Characters</span>
              </Label>
              <Input
                id="free-data-code"
                type="text"
                autoCapitalize="characters"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                maxLength={12}
                value={code}
                onPaste={(e) => {
                  e.preventDefault();
                  toast.error("Copy and paste is blocked! You must type each character manually.");
                }}
                onCopy={(e) => e.preventDefault()}
                onCut={(e) => e.preventDefault()}
                onDrop={(e) => e.preventDefault()}
                onContextMenu={(e) => e.preventDefault()}
                onChange={(e) => {
                  const raw = e.target.value.toUpperCase();
                  // Detect multi-character insertion (mobile clipboard, autofill, paste)
                  if (raw.length > code.length + 1) {
                    toast.error("Copy and paste is blocked! You must type each character manually.");
                    return;
                  }
                  setCode(raw);
                }}
                placeholder="e.g. FD8X2M9P3K"
                className="h-12 rounded-xl text-center text-lg sm:text-xl font-mono font-black tracking-[0.25em] bg-slate-950 text-amber-300 placeholder:text-slate-600 border-2 border-slate-700 focus-visible:border-amber-400 focus-visible:ring-2 focus-visible:ring-amber-400 select-none"
              />
              <div className="text-xs text-amber-200/90 font-medium bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex items-start gap-2">
                <span className="text-amber-400 shrink-0">⚠️</span>
                <span>Type the code manually (paste is blocked). Each voucher code can only be claimed once before it expires.</span>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading || !phoneValid || !codeValid}
              className="w-full h-12 rounded-xl font-bold bg-gradient-gold text-accent-foreground shadow-glow hover:opacity-95 text-base mt-2"
            >
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-2" /> Verifying Code…
                </>
              ) : (
                <>
                  <Sparkles className="size-4 mr-2" /> Claim Free Data
                </>
              )}
            </Button>
          </form>
        ) : (
          <div className="space-y-4 py-4 text-center text-white">
            <div className="size-16 rounded-full bg-emerald-500/20 text-emerald-400 border-2 border-emerald-500/40 grid place-items-center mx-auto shadow-glow">
              <PartyPopper className="size-8" />
            </div>

            <div className="space-y-1">
              <h3 className="text-xl font-black text-white">Free Data Claimed! 🎉</h3>
              <p className="text-xs text-slate-300">
                Your <strong className="text-amber-400">{claimedVoucher.capacity} {claimedVoucher.network}</strong> bundle code has been successfully verified for{" "}
                <strong className="text-white">{claimedVoucher.claimed_by_phone}</strong>.
              </p>
            </div>

            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/15 p-3.5 text-xs text-emerald-200 flex items-center justify-center gap-2">
              <CheckCircle2 className="size-4 shrink-0 text-emerald-400" />
              <span>Your request is queued and will be credited to your phone line shortly.</span>
            </div>

            <Button
              onClick={() => {
                resetDialog();
                onOpenChange(false);
              }}
              className="w-full h-11 rounded-xl font-bold bg-accent text-accent-foreground hover:opacity-90"
            >
              Done & Return to Shop
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
