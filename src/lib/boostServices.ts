export interface BoostServiceItem {
  service: number | string;
  name: string;
  category: string;
  platform: string;
  rate: number; // in GHS per 1,000 OR flat package price if is_package
  wholesale_rate?: number;
  min: number;
  max: number;
  type?: string;
  is_package?: boolean;
  refill?: boolean;
  cancel?: boolean;
  description?: string;
}

export function isFixedPackage(service?: BoostServiceItem | null): boolean {
  if (!service) return false;
  return Boolean(
    service.is_package ||
    service.type?.toLowerCase() === "package" ||
    (service.min === service.max && service.min > 0)
  );
}

export type ActionCategory = "followers" | "likes" | "views" | "comments" | "shares" | "other";

export function detectActionCategory(name: string, category: string): ActionCategory {
  const s = `${category || ""} ${name || ""}`.toLowerCase();
  if (s.includes("follower") || s.includes("subscriber") || s.includes("member")) return "followers";
  if (s.includes("like") || s.includes("reaction") || s.includes("heart") || s.includes("upvote")) return "likes";
  if (s.includes("view") || s.includes("play") || s.includes("impression") || s.includes("watch time")) return "views";
  if (s.includes("comment")) return "comments";
  if (s.includes("share") || s.includes("retweet") || s.includes("save") || s.includes("repost")) return "shares";
  return "other";
}

export interface DropQualityInfo {
  isNonDrop: boolean;
  isFixed: boolean;
  badgeLabel: string;
  badgeColor: string;
  borderColor: string;
  tagline: string;
  badgeVariant: "emerald" | "teal" | "cyan" | "amber";
}

export function detectDropQuality(
  name: string,
  category: string,
  service?: BoostServiceItem | null
): DropQualityInfo {
  const isFixed = isFixedPackage(service);
  const text = `${category || ""} ${name || ""}`.toLowerCase();

  const isGuaranteedNonDrop =
    text.includes("no drop") ||
    text.includes("non drop") ||
    text.includes("permanent") ||
    text.includes("0% drop") ||
    text.includes("0-5 %") ||
    text.includes("0-5%") ||
    text.includes("lifetime") ||
    text.includes("100% no drop") ||
    text.includes("100% non drop") ||
    (isFixed && !text.includes("high drop"));

  if (isGuaranteedNonDrop) {
    return {
      isNonDrop: true,
      isFixed,
      badgeLabel: isFixed ? `🛡️ 100% Non-Drop (${service?.min || 1000} Pack)` : "🛡️ 100% Non-Drop Permanent",
      badgeColor: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
      borderColor: "border-emerald-500/40 hover:border-emerald-400 hover:shadow-[0_0_20px_rgba(16,185,129,0.2)]",
      tagline: "Guaranteed 100% Permanent Retention • Fixed Package",
      badgeVariant: "emerald",
    };
  }

  if (text.includes("low drop")) {
    return {
      isNonDrop: false,
      isFixed,
      badgeLabel: "🛡️ Low Drop (0-5%)",
      badgeColor: "bg-teal-500/20 text-teal-300 border-teal-500/40",
      borderColor: "border-teal-500/40 hover:border-teal-400 hover:shadow-[0_0_20px_rgba(20,184,166,0.2)]",
      tagline: "High retention with minimal natural drop (0-5%)",
      badgeVariant: "teal",
    };
  }

  if (service?.refill || text.includes("refill") || text.includes("30 days refill")) {
    return {
      isNonDrop: false,
      isFixed,
      badgeLabel: "🔄 30-Day Refill Guarantee",
      badgeColor: "bg-cyan-500/20 text-cyan-300 border-cyan-500/40",
      borderColor: "border-cyan-500/40 hover:border-cyan-400 hover:shadow-[0_0_20px_rgba(6,182,212,0.2)]",
      tagline: "Automatic 30-day refill included if drop occurs",
      badgeVariant: "cyan",
    };
  }

  return {
    isNonDrop: false,
    isFixed,
    badgeLabel: "⚡ Standard (May Drop)",
    badgeColor: "bg-amber-500/20 text-amber-300 border-amber-500/40",
    borderColor: "border-zinc-800 hover:border-amber-500/50 hover:shadow-[0_0_20px_rgba(245,158,11,0.2)]",
    tagline: `Standard Speed • Variable Range (Min ${service?.min || 50} - Max ${service?.max || 10000})`,
    badgeVariant: "amber",
  };
}


/**
 * Calculates customer selling price for a boost service given:
 * - baseRate: Admin wholesale rate to agent (in GHS per 1,000 or flat package)
 * - agentMarkupPercent: Agent's profit margin percentage (e.g. 25%)
 * - quantity: Order units
 * - isPackage: Whether service is flat package
 */
export function calculateBoostPrice(
  baseRate: number,
  agentMarkupPercent: number = 0,
  quantity?: number,
  isPackage: boolean = false
): { sellingRate: number; totalPrice: number; agentProfit: number; baseCost: number } {
  const markupMultiplier = 1 + Math.max(0, agentMarkupPercent) / 100;
  const sellingRate = Number((baseRate * markupMultiplier).toFixed(2));

  if (isPackage) {
    const totalPrice = Math.max(1, sellingRate);
    const baseCost = Math.max(0.5, Number(baseRate.toFixed(2)));
    const agentProfit = Math.max(0, Number((totalPrice - baseCost).toFixed(2)));
    return { sellingRate, totalPrice, agentProfit, baseCost };
  }

  const q = Number(quantity) || 1000;
  const rawTotal = (q * sellingRate) / 1000;
  const totalPrice = Math.max(1, Math.round(rawTotal * 100) / 100);

  const rawBase = (q * baseRate) / 1000;
  const baseCost = Math.max(0.5, Math.round(rawBase * 100) / 100);
  const agentProfit = Math.max(0, Number((totalPrice - baseCost).toFixed(2)));

  return { sellingRate, totalPrice, agentProfit, baseCost };
}
