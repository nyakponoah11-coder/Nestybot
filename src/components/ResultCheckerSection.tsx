import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase, invokeApiFunction } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { GraduationCap, Loader2, ScrollText } from "lucide-react";
import { validateGhanaPhone } from "@/lib/networks";
import { saveOrderToHistory, getSavedPhone } from "@/lib/orderHistory";

interface Checker {
  type: "WAEC" | "BECE";
  price: number;
  inStock: boolean;
  stockCount: number | null;
}

export const ResultCheckerSection = () => {
  const [checkers, setCheckers] = useState<Checker[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Checker | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase.functions.invoke("checker-products");
        if (cancelled) return;
        if (data?.checkers && Array.isArray(data.checkers) && data.checkers.length > 0) {
          setCheckers(data.checkers as Checker[]);
        } else {
          setCheckers([
            { type: "WAEC", price: 20, inStock: true, stockCount: 50 },
            { type: "BECE", price: 18, inStock: true, stockCount: 50 },
          ]);
        }
      } catch {
        if (!cancelled) {
          setCheckers([
            { type: "WAEC", price: 20, inStock: true, stockCount: 50 },
            { type: "BECE", price: 18, inStock: true, stockCount: 50 },
          ]);
        }
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <section className="mt-8">
      <div className="flex items-center gap-2 mb-3">
        <GraduationCap className="size-5 text-accent" />
        <h2 className="text-xl md:text-2xl font-bold">Result checkers</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-3">
        Buy a WAEC or BECE result checker card. Your serial number and PIN show up right after payment.
      </p>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="size-5 animate-spin" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
          {checkers.map(c => (
            <Card
              key={c.type}
              onClick={() => c.inStock && setSelected(c)}
              className={`p-5 border-0 text-white shadow-[0_20px_50px_-15px_rgba(59,130,246,0.5)] transition-all ${
                c.type === "WAEC"
                  ? "bg-gradient-to-br from-blue-600 via-indigo-700 to-slate-900"
                  : "bg-gradient-to-br from-amber-500 via-orange-600 to-stone-900"
              } ${c.inStock ? "cursor-pointer hover:-translate-y-0.5" : "opacity-60"}`}
            >
              <div className="flex items-center gap-3">
                <div className="size-12 rounded-xl bg-white/15 grid place-items-center backdrop-blur">
                  <ScrollText className="size-6" />
                </div>
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider opacity-80">Result checker</div>
                  <div className="text-xl font-black">{c.type}</div>
                </div>
              </div>
              <p className="mt-4 text-sm opacity-90">
                Instant card — serial number and PIN delivered immediately.
              </p>
              <div className="mt-4 flex items-end justify-between">
                <div>
                  <div className="text-3xl font-black">GH₵ {Number(c.price).toFixed(2)}</div>
                  <div className="text-[11px] opacity-80">
                    {c.inStock ? "In stock" : "Out of stock"}
                  </div>
                </div>
                <span className="px-3 py-1.5 rounded-full bg-white text-slate-800 text-xs font-bold">
                  {c.inStock ? "Buy" : "Sold out"}
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}

      <CheckerCheckoutDialog checker={selected} onOpenChange={(o) => !o && setSelected(null)} />
    </section>
  );
};

export const CheckerCheckoutDialog = ({
  checker,
  agentId,
  agentSlug,
  onOpenChange,
}: {
  checker: Checker | null;
  agentId?: string;
  agentSlug?: string;
  onOpenChange: (open: boolean) => void;
}) => {
  const [phone, setPhone] = useState(() => getSavedPhone());
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!checker) return;
    if (!validateGhanaPhone(phone)) { toast.error("Enter a valid Ghana phone"); return; }
    setLoading(true);
    try {
      const callback_url = agentSlug
        ? `${window.location.origin}/s/${agentSlug}`
        : `${window.location.origin}/payment/callback`;

      const { data, error } = await invokeApiFunction("checker-init", {
        body: {
          checker_type: checker.type,
          customer_phone: phone,
          customer_name: name || undefined,
          amount: checker.price,
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
          amount: checker.price,
          payment_status: "pending",
          delivery_status: "pending",
          type: "checker",
        });
      }
      window.location.href = data.authorization_url;
    } catch (e: any) {
      toast.error(e.message || "Could not start payment");
      setLoading(false);
    }
  };

  return (
    <Dialog open={!!checker} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {checker && (
          <>
            <DialogHeader>
              <DialogTitle>{checker.type} result checker</DialogTitle>
              <DialogDescription>
                After payment your serial number and PIN appear on screen and are also sent by SMS to the number below.
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-xl p-4 bg-gradient-to-br from-blue-600 to-indigo-800 text-white">
              <div className="text-xs opacity-80">Total</div>
              <div className="text-3xl font-black">GH₵ {Number(checker.price).toFixed(2)}</div>
            </div>
            <div className="space-y-3">
              <div>
                <Label htmlFor="ckname">Your name (optional)</Label>
                <Input id="ckname" value={name} onChange={e => setName(e.target.value)} placeholder="Ama Mensah" maxLength={120} />
              </div>
              <div>
                <Label htmlFor="ckph">Your phone (Ghana)</Label>
                <Input
                  id="ckph"
                  inputMode="numeric"
                  value={phone}
                  onChange={e => setPhone(e.target.value.replace(/\D/g, "").slice(0, 12))}
                  placeholder="0244123456"
                />
              </div>
            </div>
            <Button
              className="w-full h-11 bg-gradient-gold text-accent-foreground hover:opacity-90 font-bold"
              disabled={loading}
              onClick={submit}
            >
              {loading ? <Loader2 className="size-4 mr-2 animate-spin" /> : null}
              Pay GH₵ {Number(checker.price).toFixed(2)} with Paystack
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
