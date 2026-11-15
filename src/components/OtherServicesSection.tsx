import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Play, IdCard, Sparkles, Zap, Rocket } from "lucide-react";
import { ServiceCheckoutDialog } from "./ServiceCheckoutDialog";
import { SocialBoostDialog } from "./SocialBoostDialog";

export const OtherServicesSection = ({
  netflixPrice = 30,
  afaPrice = 20,
  mashupPrice = 25,
}: {
  netflixPrice?: number;
  afaPrice?: number;
  mashupPrice?: number;
}) => {
  const [open, setOpen] = useState<"netflix" | "afa" | "mashup" | null>(null);
  const [boostOpen, setBoostOpen] = useState(false);

  return (
    <section className="mt-8">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="size-5 text-accent" />
        <h2 className="text-xl md:text-2xl font-bold">Other services</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
        {/* Netflix */}
        <Card
          onClick={() => setOpen("netflix")}
          className="cursor-pointer p-5 border-0 text-white bg-gradient-to-br from-red-600 via-red-700 to-black shadow-[0_20px_50px_-15px_rgba(220,38,38,0.6)] hover:-translate-y-0.5 transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="size-12 rounded-xl bg-white/15 grid place-items-center backdrop-blur">
              <Play className="size-6 fill-white" />
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider opacity-80">Streaming</div>
              <div className="text-xl font-black">Netflix</div>
            </div>
          </div>
          <p className="mt-4 text-sm opacity-90">1-month shared sign-in. Enjoy any movie at anytime.</p>
          <div className="mt-4 flex items-end justify-between">
            <div>
              <div className="text-3xl font-black">GH₵ {netflixPrice}</div>
              <div className="text-[11px] opacity-80">One-month subscription</div>
            </div>
            <span className="px-3 py-1.5 rounded-full bg-white text-red-700 text-xs font-bold">Buy</span>
          </div>
        </Card>

        {/* MTN Mashup */}
        <Card
          onClick={() => setOpen("mashup")}
          className="cursor-pointer p-5 border-0 text-amber-950 dark:text-amber-100 bg-gradient-to-br from-amber-400 via-amber-500 to-yellow-600 shadow-[0_20px_50px_-15px_rgba(245,158,11,0.6)] hover:-translate-y-0.5 transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="size-12 rounded-xl bg-black/10 dark:bg-white/15 grid place-items-center backdrop-blur">
              <Zap className="size-6 text-amber-950 dark:text-amber-100" />
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider opacity-80">MTN Pulse</div>
              <div className="text-xl font-black">MTN Mashup</div>
            </div>
          </div>
          <p className="mt-4 text-sm opacity-90">Custom Data + Voice combo packages from 1 Cedi upwards.</p>
          <div className="mt-4 flex items-end justify-between">
            <div>
              <div className="text-3xl font-black">From GH₵ 1</div>
              <div className="text-[11px] opacity-80">Data & Voice Combos</div>
            </div>
            <span className="px-3 py-1.5 rounded-full bg-black/90 text-amber-400 dark:bg-white dark:text-amber-800 text-xs font-bold">Choose</span>
          </div>
        </Card>

        {/* AFA Registration */}
        <Card
          onClick={() => setOpen("afa")}
          className="cursor-pointer p-5 border-0 text-white bg-gradient-to-br from-emerald-500 via-emerald-700 to-teal-900 shadow-[0_20px_50px_-15px_rgba(16,185,129,0.6)] hover:-translate-y-0.5 transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="size-12 rounded-xl bg-white/15 grid place-items-center backdrop-blur">
              <IdCard className="size-6" />
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider opacity-80">Registration</div>
              <div className="text-xl font-black">AFA</div>
            </div>
          </div>
          <p className="mt-4 text-sm opacity-90"> Register Today and Enjoy.</p>
          <div className="mt-4 flex items-end justify-between">
            <div>
              <div className="text-3xl font-black">GH₵ {afaPrice}</div>
              <div className="text-[11px] opacity-80">Fast processing</div>
            </div>
            <span className="px-3 py-1.5 rounded-full bg-white text-emerald-700 text-xs font-bold">Buy</span>
          </div>
        </Card>

        {/* Evd - Coming Soon */}
        <Card className="p-5 border-0 text-white bg-gradient-to-br from-zinc-700 via-zinc-800 to-black opacity-75 relative overflow-hidden">
          <div className="absolute top-3 right-3 text-[10px] font-bold uppercase tracking-widest bg-white/15 px-2 py-0.5 rounded-full">Coming soon</div>
          <div className="flex items-center gap-3">
            <div className="size-12 rounded-xl bg-white/15 grid place-items-center backdrop-blur">
              <Play className="size-6 fill-white" />
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider opacity-80">Registration</div>
              <div className="text-xl font-black">Evd</div>
            </div>
          </div>
          <p className="mt-4 text-sm opacity-90">Sell Data and Airtime instantly with commission on every transaction (using your personal SIM).</p>
        </Card>

        {/* Social Media Boost - Live */}
        <Card
          onClick={() => setBoostOpen(true)}
          className="cursor-pointer p-5 border-0 text-white bg-gradient-to-br from-violet-600 via-fuchsia-600 to-pink-600 shadow-[0_20px_50px_-15px_rgba(192,38,211,0.6)] hover:-translate-y-0.5 transition-all relative overflow-hidden group"
        >
          <div className="absolute top-3 right-3 text-[10px] font-bold uppercase tracking-wider bg-white/20 backdrop-blur px-2.5 py-0.5 rounded-full flex items-center gap-1">
            <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" /> Instant
          </div>
          <div className="flex items-center gap-3">
            <div className="size-12 rounded-xl bg-white/15 grid place-items-center backdrop-blur group-hover:scale-105 transition-transform">
              <Rocket className="size-6 text-white" />
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider opacity-85">Growth & Engagement</div>
              <div className="text-xl font-black">Social Media Boost</div>
            </div>
          </div>
          <p className="mt-4 text-sm opacity-95">Followers, Likes, Views & Comments for TikTok, Instagram, Facebook, YouTube & more.</p>
          <div className="mt-4 flex items-end justify-between">
            <div>
              <div className="text-2xl font-black">From GH₵ 2</div>
              <div className="text-[11px] opacity-85">Real & active engagement</div>
            </div>
            <span className="px-3.5 py-1.5 rounded-full bg-white text-fuchsia-700 text-xs font-black shadow group-hover:bg-fuchsia-50 transition-colors">
              Boost Now
            </span>
          </div>
        </Card>
      </div>

      <ServiceCheckoutDialog
        service={open}
        netflixPrice={netflixPrice}
        afaPrice={afaPrice}
        mashupPrice={mashupPrice}
        onOpenChange={(o) => !o && setOpen(null)}
      />

      <SocialBoostDialog
        open={boostOpen}
        onOpenChange={setBoostOpen}
      />
    </section>
  );
};
