import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchShopDataCached, getCachedShopData, setCachedShopData } from "@/lib/storeCache";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { OtherServicesSection } from "@/components/OtherServicesSection";
import { ResultCheckerSection } from "@/components/ResultCheckerSection";
import { ArrowLeft, Search, Sparkles } from "lucide-react";

const Services = () => {
  const cached = getCachedShopData();
  const initNetflix = Number(cached?.settings?.netflix_price);
  const initAfa = Number(cached?.settings?.afa_price);
  const initMashup = Number(cached?.settings?.mashup_price);

  const [netflixPrice, setNetflixPrice] = useState(!isNaN(initNetflix) && initNetflix > 0 ? initNetflix : 30);
  const [afaPrice, setAfaPrice] = useState(!isNaN(initAfa) && initAfa > 0 ? initAfa : 20);
  const [mashupPrice, setMashupPrice] = useState(!isNaN(initMashup) && initMashup > 0 ? initMashup : 25);

  const loadFreshPrices = async () => {
    // 1. Direct query to Supabase settings for guaranteed live prices
    try {
      const { data: sRows } = await supabase
        .from("settings")
        .select("key, value")
        .in("key", ["netflix_price", "afa_price", "mashup_price"]);

      if (sRows && sRows.length > 0) {
        const map: Record<string, string> = {};
        sRows.forEach((r: any) => { if (r?.key) map[r.key] = r.value; });

        const np = Number(map.netflix_price);
        if (!isNaN(np) && np > 0) setNetflixPrice(np);

        const ap = Number(map.afa_price);
        if (!isNaN(ap) && ap > 0) setAfaPrice(ap);

        const mp = Number(map.mashup_price);
        if (!isNaN(mp) && mp > 0) setMashupPrice(mp);

        const currentCached = getCachedShopData();
        if (currentCached) {
          setCachedShopData({
            products: currentCached.products,
            settings: { ...currentCached.settings, ...map },
          });
        }
        return;
      }
    } catch (err) {
      console.warn("Direct settings fetch fallback:", err);
    }

    // 2. Fallback to API endpoint with forceRefresh=true
    try {
      const { settings: map } = await fetchShopDataCached({ forceRefresh: true });
      const np = Number(map.netflix_price);
      if (!isNaN(np) && np > 0) setNetflixPrice(np);

      const ap = Number(map.afa_price);
      if (!isNaN(ap) && ap > 0) setAfaPrice(ap);

      const mp = Number(map.mashup_price);
      if (!isNaN(mp) && mp > 0) setMashupPrice(mp);
    } catch {}
  };

  useEffect(() => {
    document.title = "Other services";
    loadFreshPrices();

    const handleInvalidate = () => loadFreshPrices();
    window.addEventListener("shop-cache-invalidated", handleInvalidate);
    return () => window.removeEventListener("shop-cache-invalidated", handleInvalidate);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-gradient-hero text-primary-foreground">
        <div className="container py-4 flex items-center justify-between">
          <Button asChild variant="ghost" size="sm" className="text-primary-foreground hover:bg-white/10">
            <Link to="/"><ArrowLeft className="size-4 mr-1" /> Back to shop</Link>
          </Button>
          <div className="flex items-center gap-2">
            <Sparkles className="size-5 text-accent" />
            <span className="font-bold">Other services</span>
          </div>
        </div>
      </header>

      <main className="container py-6 max-w-3xl">
        <div className="rounded-2xl p-5 mb-5 bg-gradient-to-r from-red-600 via-pink-600 to-emerald-600 text-white shadow-lg">
          <h1 className="text-2xl md:text-3xl font-black">More than data</h1>
          <p className="text-sm opacity-90 mt-1">Netflix sign-ins, MTN Mashup, AFA registrations & more — all in one place.</p>
        </div>

        <OtherServicesSection netflixPrice={netflixPrice} afaPrice={afaPrice} mashupPrice={mashupPrice} />

        <ResultCheckerSection />

        <Button asChild variant="outline" className="w-full mt-6 h-11 rounded-xl border-2 border-accent/40 bg-gradient-card font-semibold">
          <Link to="/track"><Search className="size-4 mr-2" /> View my service history</Link>
        </Button>
      </main>
    </div>
  );
};

export default Services;
