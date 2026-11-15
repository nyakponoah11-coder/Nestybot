import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { fetchShopDataCached, getCachedShopData } from "@/lib/storeCache";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { NETWORK_LABEL, NETWORK_ORDER, networkClass, formatGHS, DEFAULT_PRODUCTS } from "@/lib/networks";
import { NetworkLogo } from "@/components/NetworkLogo";
import { CheckoutDialog } from "@/components/CheckoutDialog";
import { VoiceCallAssistant } from "@/components/VoiceCallAssistant";
import { DeliveryTracker } from "@/components/DeliveryTracker";
import { Loader2, ArrowLeft, PhoneCall } from "lucide-react";

interface Product {
  id: string; network: string; capacity: string; mb: number;
  price: number; name: string | null; in_stock: boolean; sort_order: number;
}

const NetworkBundles = () => {
  const { network = "" } = useParams();
  const navigate = useNavigate();
  const net = network.toUpperCase().trim();
  const valid = (NETWORK_ORDER as readonly string[]).includes(net);

  const initialCached = getCachedShopData();
  const initialProducts = (initialCached?.products as Product[] || DEFAULT_PRODUCTS as Product[])
    .filter(p => String(p.network || "").toUpperCase().trim() === net);

  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [loading, setLoading] = useState(initialProducts.length === 0);
  const [selected, setSelected] = useState<Product | null>(null);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [ordersPaused, setOrdersPaused] = useState<boolean>(() => {
    return getCachedShopData()?.settings?.orders_paused === "true";
  });
  const [ordersPauseMessage, setOrdersPauseMessage] = useState<string>(() => {
    return getCachedShopData()?.settings?.orders_pause_message || "";
  });
  const [voicePhone, setVoicePhone] = useState("");

  useEffect(() => {
    if (!valid) navigate("/", { replace: true });
  }, [valid, navigate]);

  useEffect(() => {
    document.title = `${NETWORK_LABEL[net] || "Data"} Bundles – Buy Data Online`;
  }, [net]);

  useEffect(() => {
    let cancelled = false;

    const load = async (force = false) => {
      try {
        const { products: allProducts, settings: m } = await fetchShopDataCached({ forceRefresh: force });
        if (cancelled) return;
        if (m?.orders_paused !== undefined) setOrdersPaused(m.orders_paused === "true");
        if (m?.orders_pause_message !== undefined) setOrdersPauseMessage(m.orders_pause_message);

        const filtered = (allProducts as Product[]).filter(
          p => String(p.network || "").toUpperCase().trim() === net
        );
        setProducts(filtered);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load(false);

    const handleInvalidate = () => load(true);
    window.addEventListener("shop-cache-invalidated", handleInvalidate);

    return () => {
      cancelled = true;
      window.removeEventListener("shop-cache-invalidated", handleInvalidate);
    };
  }, [net]);

  if (!valid) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-gradient-hero text-primary-foreground">
        <div className="container py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="icon" className="text-primary-foreground hover:bg-white/10">
              <Link to="/" aria-label="Back to shop"><ArrowLeft className="size-5" /></Link>
            </Button>
            <NetworkLogo network={net} className="size-10 text-xl" />
            <h1 className="font-bold text-lg">{NETWORK_LABEL[net]} bundles</h1>
          </div>

          <Button
            type="button"
            size="icon"
            onClick={() => setVoiceOpen(true)}
            className="size-9 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black shadow animate-pulse"
            title="Call"
            aria-label="Call"
          >
            <PhoneCall className="size-4" />
          </Button>
        </div>
      </header>

      <main className="container py-6">
        {ordersPaused && (
          <div className="mb-6 p-4 rounded-2xl bg-amber-500/15 border-2 border-amber-500/50 text-amber-200 shadow-lg flex items-center gap-3">
            <span className="text-2xl shrink-0">⏸️</span>
            <div>
              <h3 className="font-bold text-sm md:text-base text-amber-300">Orders Temporarily Paused</h3>
              <p className="text-xs text-amber-200/90 mt-0.5">
                {ordersPauseMessage || "We are currently restocking our data wallet and undergoing brief maintenance. New orders will resume shortly!"}
              </p>
            </div>
          </div>
        )}

        {net === "MTN" && (
          <div className="mb-6">
            <DeliveryTracker />
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="size-6 animate-spin" /></div>
        ) : products.length === 0 ? (
          <p className="text-muted-foreground py-10 text-center">No bundles available for {NETWORK_LABEL[net]} yet.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
            {products.map(p => {
              const cardTheme =
                p.network === "MTN"
                  ? "border-yellow-400/60 hover:border-yellow-300 bg-gradient-to-br from-yellow-300 to-yellow-500 text-zinc-900"
                  : p.network === "TELECEL"
                  ? "border-red-500/60 hover:border-red-400 bg-gradient-to-br from-red-600 to-red-800 text-white"
                  : "border-purple-500/60 hover:border-purple-400 bg-gradient-to-br from-purple-600 to-purple-800 text-white";
              const subText = p.network === "MTN" ? "text-zinc-900/70" : "text-white/70";
              return (
                <Card
                  key={p.id}
                  onClick={() => setSelected(p)}
                  className={`cursor-pointer p-4 hover:shadow-glow hover:-translate-y-0.5 transition-all border-2 ${cardTheme}`}
                >
                  <div className={`inline-flex px-2 py-0.5 rounded-md text-xs font-semibold ${networkClass(p.network)}`}>
                    {NETWORK_LABEL[p.network]}
                  </div>
                  <div className="mt-3 text-3xl md:text-4xl font-black">
                    {p.capacity}<span className={`text-base font-bold ${subText}`}>GB</span>
                  </div>
                  <div className={`text-xs mt-1 ${subText}`}>{p.name || "Non-expiry"}</div>
                  <div className="mt-3 flex items-end justify-between">
                    <div className="font-bold text-lg">{formatGHS(p.price)}</div>
                    <span className={`text-xs font-medium px-2 py-1 rounded ${ordersPaused ? "bg-amber-950/80 text-amber-300 border border-amber-500/40" : "text-accent-foreground bg-accent"}`}>
                      {ordersPaused ? "Paused" : "Buy"}
                    </span>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      <VoiceCallAssistant
        open={voiceOpen}
        onOpenChange={setVoiceOpen}
        initialNetwork={net}
        onSelectProductAndPhone={(prod, ph) => {
          setSelected(prod as Product);
          setVoicePhone(ph);
        }}
      />

      <CheckoutDialog
        product={selected}
        initialPhone={voicePhone}
        onOpenChange={(o) => {
          if (!o) {
            setSelected(null);
            setVoicePhone("");
          }
        }}
      />
    </div>
  );
};

export default NetworkBundles;
