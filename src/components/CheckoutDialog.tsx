import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase, invokeApiFunction } from "@/integrations/supabase/client";
import { NETWORK_LABEL, networkClass, formatGHS, validateGhanaPhone } from "@/lib/networks";
import { saveOrderToHistory, getSavedPhone } from "@/lib/orderHistory";
import { getCachedShopData } from "@/lib/storeCache";
import { NetworkLogo } from "@/components/NetworkLogo";
import { Loader2, AlertTriangle, ShieldCheck, ShieldAlert, BadgeCheck, ChevronDown } from "lucide-react";
import { toast } from "sonner";

interface Product {
  id: string; network: string; capacity: string; mb: number; price: number;
}

export const CheckoutDialog = ({
  product, onOpenChange, initialPhone, agentId, storeName, isFlashSale,
}: { product: Product | null; onOpenChange: (o: boolean) => void; initialPhone?: string; agentId?: string; storeName?: string; isFlashSale?: boolean }) => {
  const [phone, setPhone] = useState(() => initialPhone || getSavedPhone());

  useEffect(() => {
    if (initialPhone) setPhone(initialPhone);
  }, [initialPhone]);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{
    servable: boolean; recommendation: string; message: string; network?: string;
  } | null>(null);
  const [verifiedPhone, setVerifiedPhone] = useState("");
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [referralCode, setReferralCode] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem("data1_agent_ref") || "";
    }
    return "";
  });
  const [showPromoInput, setShowPromoInput] = useState(false);

  const cachedSettings = getCachedShopData()?.settings || {};
  const ordersPaused = cachedSettings.orders_paused === "true" || (typeof window !== "undefined" && localStorage.getItem("data1gh_orders_paused") === "true");
  const pauseMessage = (typeof window !== "undefined" && localStorage.getItem("data1gh_orders_pause_message")) || cachedSettings.orders_pause_message || "Store orders are temporarily paused for brief maintenance. Please check back shortly!";

  const reset = () => {
    setPhone("");
    setConfirming(false);
    setLoading(false);
    setVerifying(false);
    setVerifyResult(null);
    setVerifiedPhone("");
    setNoticeOpen(false);
  };

  const handleVerify = async () => {
    if (!validateGhanaPhone(phone)) {
      toast.error("Enter a valid Ghana phone number (e.g. 0541234567)");
      return;
    }
    setVerifying(true);
    setVerifyResult(null);
    try {
      const { data, error } = await invokeApiFunction("verify-number", {
        body: { phoneNumber: phone.replace(/\s+/g, "") },
      });
      if (error) throw error;
      if (data?.status !== "success") {
        const code = data?.code;
        if (code === "RATE_LIMIT_EXCEEDED") {
          throw new Error(`Too many checks right now. Try again in ${data?.retryAfter ?? 60}s.`);
        }
        if (code === "VERIFY_UNAVAILABLE") {
          throw new Error("Network is busy — please tap Verify again.");
        }
        throw new Error(data?.message || "Could not verify this number");
      }
      setVerifyResult({
        servable: !!data.data?.servable,
        recommendation: data.data?.recommendation || "",
        message: data.data?.message || "",
        network: data.data?.network,
      });
      setVerifiedPhone(phone.replace(/\s+/g, ""));
    } catch (e: any) {
      toast.error(e.message || "Verification failed");
    } finally {
      setVerifying(false);
    }
  };

  const handleContinue = () => {
    if (ordersPaused) {
      toast.error(pauseMessage);
      return;
    }
    if (!validateGhanaPhone(phone)) {
      toast.error("Enter a valid Ghana phone number (e.g. 0541234567)");
      return;
    }
    setConfirming(true);
  };

  const handlePay = async () => {
    if (ordersPaused) {
      toast.error(pauseMessage);
      return;
    }
    if (!product) return;
    setLoading(true);
    try {
      const cleanPhone = phone.replace(/\s+/g, "");
      const callbackUrl = agentId 
        ? `${window.location.origin}${window.location.pathname}`
        : `${window.location.origin}/payment/callback`;
      const { data, error } = await invokeApiFunction("paystack-init", {
        body: {
          product_id: product.id,
          network: product.network,
          capacity: product.capacity,
          mb: product.mb,
          recipient_phone: cleanPhone,
          callback_url: callbackUrl,
          agent_id: agentId || undefined,
          store_name: storeName || undefined,
          referral_code: referralCode.trim() || undefined,
          agent_referral_code: referralCode.trim() || undefined,
          amount: product.price,
          is_flash_sale: Boolean(isFlashSale || (product as any)?.is_flash_sale),
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.authorization_url) {
        if (data.reference) {
          saveOrderToHistory({
            reference: data.reference,
            recipient_phone: cleanPhone,
            network: product.network,
            capacity: product.capacity,
            mb: product.mb,
            amount: product.price,
            payment_status: "pending",
            delivery_status: "pending",
            type: "data",
            is_flash_sale: Boolean(isFlashSale),
            notes: isFlashSale ? "[FLASH_SALE]" : undefined,
          });
        }
        window.location.href = data.authorization_url;
      } else {
        throw new Error("No payment URL");
      }
    } catch (e: any) {
      toast.error(e.message || "Could not start payment");
      setLoading(false);
    }
  };

  const formatPhone = (p: string) => {
    const c = p.replace(/\s+/g, "");
    if (c.length === 10) return `${c.slice(0, 3)} ${c.slice(3, 6)} ${c.slice(6)}`;
    return c;
  };

  return (
    <Dialog
      open={!!product}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent>
        {product && (
          <>
            <DialogHeader>
              <DialogTitle>{confirming ? "Confirm recipient number" : "Confirm purchase"}</DialogTitle>
              <DialogDescription>
                {confirming
                  ? "Double check the number — data will be sent here and we cannot reverse it."
                  : "You'll be redirected to Paystack to complete payment."}
              </DialogDescription>
            </DialogHeader>

            <div className="rounded-xl border p-4 bg-gradient-card flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <NetworkLogo network={product.network} className="size-14 text-2xl" />
                <div className="min-w-0">
                  <div className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${networkClass(product.network)}`}>
                    {NETWORK_LABEL[product.network]}
                  </div>
                  <div className="text-2xl font-black mt-1">{product.capacity}GB</div>
                </div>
              </div>
              <div className="text-xl font-bold">{formatGHS(product.price)}</div>
            </div>

            {!confirming ? (
              <>
                {ordersPaused && (
                  <div className="rounded-xl border-2 border-amber-500/50 bg-amber-500/15 p-3.5 flex items-center gap-3 text-amber-200">
                    <AlertTriangle className="size-5 text-amber-400 shrink-0" />
                    <div className="text-xs">
                      <span className="font-bold block text-amber-300">Orders Temporarily Paused</span>
                      <span>{pauseMessage}</span>
                    </div>
                  </div>
                )}
                <div>
                  <Label htmlFor="phone">Recipient phone number</Label>
                  <Input
                    id="phone" type="tel" placeholder="0541234567"
                    value={phone}
                    onChange={e => { setPhone(e.target.value); setVerifyResult(null); }}
                    inputMode="numeric" maxLength={13}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Enter the {NETWORK_LABEL[product.network]} number that should receive the data.
                  </p>
                </div>

                {/* Referral Promo Code Input */}
                {referralCode ? (
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs">
                    <div className="flex items-center gap-1.5 font-bold text-amber-500">
                      <span>🎟️ Referral Code:</span>
                      <span className="font-mono bg-amber-500/20 px-2 py-0.5 rounded font-black text-foreground">
                        {referralCode}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setReferralCode("");
                        sessionStorage.removeItem("data1_agent_ref");
                      }}
                      className="text-[11px] text-muted-foreground hover:text-foreground underline"
                    >
                      Remove
                    </button>
                  </div>
                ) : showPromoInput ? (
                  <div className="space-y-1">
                    <Label htmlFor="promo-code" className="text-xs font-bold text-foreground">
                      Referral / Promo Code (optional)
                    </Label>
                    <div className="flex items-center gap-1.5">
                      <Input
                        id="promo-code"
                        placeholder="e.g. WIN5-XXXX"
                        value={referralCode}
                        onChange={(e) => {
                          const val = e.target.value.toUpperCase();
                          setReferralCode(val);
                          sessionStorage.setItem("data1_agent_ref", val);
                        }}
                        className="rounded-xl font-mono uppercase text-xs"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="text-right">
                    <button
                      type="button"
                      onClick={() => setShowPromoInput(true)}
                      className="text-xs text-amber-500 hover:text-amber-400 font-bold underline"
                    >
                      + Have a friend's referral code?
                    </button>
                  </div>
                )}

                <Button
                  variant="outline"
                  onClick={handleVerify}
                  disabled={verifying}
                  className="w-full h-11 font-semibold"
                >
                  {verifying
                    ? <><Loader2 className="size-4 animate-spin mr-2" /> Verifying number… (a few seconds)</>
                    : <><ShieldCheck className="size-4 mr-2" /> Verify order number (optional)</>}
                </Button>
                <p className="text-xs text-muted-foreground -mt-2">
                  Optional free pre-check against the delivery network — nothing is charged and no data is sent.
                  You can skip it and continue straight to payment. The check can take a few seconds.
                </p>

                {verifyResult && (
                  <div className={`rounded-xl border-2 p-4 flex gap-3 ${verifyResult.servable ? "border-success/40 bg-success/10" : "border-warning/40 bg-warning/10"}`}>
                    {verifyResult.servable
                      ? <BadgeCheck className="size-5 text-success shrink-0 mt-0.5" />
                      : <ShieldAlert className="size-5 text-warning shrink-0 mt-0.5" />}
                    <div className="text-sm space-y-1">
                      <p className="font-bold">
                        {verifyResult.servable
                          ? `Verified — ${verifyResult.network || "number"} can be served`
                          : "New number — activation needed"}
                      </p>
                      <p className="text-foreground/90">{verifyResult.message}</p>
                      {!verifyResult.servable && (
                        <p className="text-foreground/90 font-medium">
                          Tip: buy a 1GB bundle first, allow up to 72 hours for activation, then any size delivers instantly.
                        </p>
                      )}
                    </div>
                  </div>
                )}

                <div className="rounded-xl border-2 border-warning/40 bg-warning/10 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setNoticeOpen(v => !v)}
                    className="w-full flex items-center gap-3 p-4 text-left"
                  >
                    <AlertTriangle className="size-5 text-warning shrink-0" />
                    <span className="font-bold text-sm flex-1">Verification notice — new numbers</span>
                    <ChevronDown className={`size-4 text-warning shrink-0 transition-transform ${noticeOpen ? "rotate-180" : ""}`} />
                  </button>
                  {noticeOpen && (
                    <div className="px-4 pb-4 text-sm space-y-1">
                      <p className="text-foreground/90">
                        Every order goes through verification on the network portal. If the number is
                        new to the system (first time buying data on it), it must be verified before the
                        data can be sent, and there is no fixed time frame for this.
                      </p>
                      <p className="text-foreground/90">
                        Your payment is safe — nothing is lost. The bundle delivers automatically once the
                        number clears verification. No need to re-order or pay again.
                      </p>
                    </div>
                  )}
                </div>

                <Button
                  onClick={handleContinue}
                  disabled={verifying || ordersPaused}
                  className="w-full bg-gradient-gold text-accent-foreground hover:opacity-90 h-11 font-semibold disabled:opacity-50"
                >
                  {ordersPaused ? "⏸️ Orders Temporarily Paused" : "Continue"}
                </Button>
              </>
            ) : (
              <>
                <div className="rounded-xl border-2 border-accent/40 bg-accent/10 p-4 flex gap-3">
                  <AlertTriangle className="size-5 text-accent shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-semibold">Is this the correct number?</p>
                    <p className="text-2xl font-black tracking-wider mt-1">{formatPhone(phone)}</p>
                    <p className="text-muted-foreground mt-2">
                    Once payment is made, the {product.capacity}GB bundle will be sent to this number.</p>
                     <p>1. Wrong numbers cannot be refunded.</p>
                     <p>2. Avoid duplicate orders: Wait 5 minutes after the first order is received before placing another order on the same number.</p>
                    <p>3. Order Rules – Do NOT place orders on:</p>
                     <ul>
                       <li>Turbonet SIMs</li>
                       <li>Broadband SIMs</li>
                       <li>Agent SIMs</li>
                       <li>Invalid SIMs</li>
                       <li>Ported numbers</li>
                      </ul>
                  </div>
                </div>

                <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setConfirming(false)}
                    disabled={loading}
                    className="w-full sm:w-auto"
                  >
                    Edit number
                  </Button>
                  <Button
                    onClick={handlePay}
                    disabled={loading || ordersPaused}
                    className="w-full sm:flex-1 bg-gradient-gold text-accent-foreground hover:opacity-90 h-11 font-semibold disabled:opacity-50"
                  >
                    {ordersPaused ? "⏸️ Orders Temporarily Paused" : loading ? <Loader2 className="size-4 animate-spin" /> : `Yes, pay ${formatGHS(product.price)}`}
                  </Button>
                </DialogFooter>
              </>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
