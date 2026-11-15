import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  Clock,
  AlertTriangle,
  Search,
  CreditCard,
  Gift,
  HelpCircle,
  MessageCircle,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Info,
  ShieldCheck,
  Gamepad2,
  Share2,
  CheckCircle2,
  ExternalLink,
  PhoneCall,
  Smartphone,
  BookOpen
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface StoreGuideNoteProps {
  storeName?: string;
  supportPhone?: string;
  whatsappLink?: string;
  isAgentStore?: boolean;
  className?: string;
}

export const StoreGuideNote: React.FC<StoreGuideNoteProps> = ({
  storeName = "DATA 1 GH",
  supportPhone,
  whatsappLink,
  isAgentStore = false,
  className = "",
}) => {
  const [isPointsDropBoxOpen, setIsPointsDropBoxOpen] = useState(false);
  const [activePointId, setActivePointId] = useState<string>("orders");

  const sections = [
    {
      id: "orders",
      number: 1,
      icon: Smartphone,
      title: "Point 1: How to Place an Order (Step-by-Step)",
      shortDesc: "Choose network, bundle package, enter number, and pay via Mobile Money.",
      badge: "Quick Guide",
      badgeColor: "bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/30",
      content: (
        <div className="space-y-2.5 text-xs md:text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
          <p className="font-semibold text-zinc-900 dark:text-zinc-100">Buying data bundles takes less than 60 seconds:</p>
          <ol className="list-decimal list-inside space-y-1.5 pl-1">
            <li><strong>Select Network:</strong> Click on your preferred carrier (MTN, Telecel, or AT / AirtelTigo).</li>
            <li><strong>Choose Package:</strong> Select the bundle size you want (e.g. 1GB, 5GB, 10GB, 50GB, etc.).</li>
            <li><strong>Enter Recipient Number:</strong> Type the active phone number that should receive the bundle.</li>
            <li><strong>Pay Securely:</strong> Approve the instant Mobile Money prompt (MTN MoMo, Telecel Cash, or Card).</li>
            <li><strong>Instant Confirmation:</strong> You will immediately receive an order receipt and automated SMS.</li>
          </ol>
        </div>
      ),
    },
    {
      id: "delivery",
      number: 2,
      icon: Clock,
      title: "Point 2: Delivery Timeline (Within 30 Minutes Max)",
      shortDesc: "Automated fulfillment. Most orders arrive in 1-5 mins, max 30 mins during network load.",
      badge: "Crucial Notice",
      badgeColor: "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/30",
      content: (
        <div className="space-y-2.5 text-xs md:text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
          <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-300 dark:border-amber-500/40 text-amber-950 dark:text-amber-100 flex items-start gap-2.5">
            <Info className="size-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
            <div>
              <strong className="text-zinc-900 dark:text-white font-bold">Automated Telecom Fulfillment:</strong>
              <p className="text-xs text-amber-900 dark:text-amber-200 mt-0.5">
                Delivery varies depending on telecom network load. Most orders are credited within <strong>1 to 5 minutes</strong>. During high network congestion or maintenance on telecom servers, delivery completes within <strong>30 minutes</strong>.
              </p>
            </div>
          </div>
          <p>
            Please allow up to 30 minutes before reaching out to support. If a network downtime causes any rare order to fail, our system automatically triggers a refund or resends the bundle once the telecom queue clears.
          </p>
        </div>
      ),
    },
    {
      id: "wrong-numbers",
      number: 3,
      icon: AlertTriangle,
      title: "Point 3: Verify Numbers & Wrong Number Policy",
      shortDesc: "Always double-check recipient phone numbers before payment. Telecoms cannot reverse credited bundles.",
      badge: "Strict Policy",
      badgeColor: "bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/30",
      content: (
        <div className="space-y-2.5 text-xs md:text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
          <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border-2 border-rose-300 dark:border-rose-500/40 text-rose-950 dark:text-rose-100 flex items-start gap-2.5">
            <AlertTriangle className="size-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
            <div>
              <strong className="text-zinc-900 dark:text-white font-bold">Important Carrier Restriction:</strong>
              <p className="text-xs text-rose-900 dark:text-rose-200 mt-0.5">
                Telecom carriers (MTN, Telecel, AT) <strong>cannot reverse, recall, or transfer data bundles</strong> once successfully delivered to an active phone number.
              </p>
            </div>
          </div>
          <ul className="list-disc list-inside space-y-1 pl-1">
            <li><strong>Match Network:</strong> Ensure the recipient number matches the chosen telecom provider.</li>
            <li><strong>Check Digits:</strong> Double check your 10 digits before approving the payment prompt.</li>
            <li><strong>Wrong Number Help:</strong> If you realize you entered the wrong number before the payment completes, cancel and start fresh. If paid and already delivered by the network, we cannot reclaim the data from the third party.</li>
          </ul>
        </div>
      ),
    },
    {
      id: "tracking",
      number: 4,
      icon: Search,
      title: "Point 4: How to Track Order & Real-Time Status",
      shortDesc: "Use your Order Reference or phone number to check live delivery telemetry anytime.",
      badge: "Self-Service",
      badgeColor: "bg-cyan-100 text-cyan-900 border-cyan-300 dark:bg-cyan-500/20 dark:text-cyan-300 dark:border-cyan-500/30",
      content: (
        <div className="space-y-2.5 text-xs md:text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
          <p>
            Every order generates a unique Order Reference (e.g. <code className="bg-zinc-200 dark:bg-zinc-800 px-1.5 py-0.5 rounded font-mono text-xs text-zinc-900 dark:text-zinc-100 font-bold">ORD-...</code> or Paystack reference).
          </p>
          <ul className="list-disc list-inside space-y-1 pl-1">
            <li>Go to the <Link to="/track" className="text-blue-600 dark:text-cyan-400 font-bold hover:underline">Track Order</Link> page.</li>
            <li>Enter your <strong>Order Reference ID</strong> or your <strong>Recipient Phone Number</strong>.</li>
            <li>You will see live status badges: 
              <span className="inline-block ml-1 px-1.5 py-0.5 rounded text-[11px] bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-500/20 dark:text-amber-300 font-bold">Pending</span>,
              <span className="inline-block ml-1 px-1.5 py-0.5 rounded text-[11px] bg-blue-100 text-blue-900 border border-blue-300 dark:bg-blue-500/20 dark:text-blue-300 font-bold">Processing</span>,
              <span className="inline-block ml-1 px-1.5 py-0.5 rounded text-[11px] bg-emerald-100 text-emerald-900 border border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-300 font-bold">Delivered</span>, or
              <span className="inline-block ml-1 px-1.5 py-0.5 rounded text-[11px] bg-rose-100 text-rose-900 border border-rose-300 dark:bg-rose-500/20 dark:text-rose-300 font-bold">Failed</span>.
            </li>
          </ul>
        </div>
      ),
    },
    {
      id: "payments",
      number: 5,
      icon: CreditCard,
      title: "Point 5: Payment Verification & Auto-Recovery",
      shortDesc: "Automatic webhook confirmation. If you approved MOMO but got interrupted, auto-verify recovers it.",
      badge: "Payment Protection",
      badgeColor: "bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30",
      content: (
        <div className="space-y-2.5 text-xs md:text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
          <p>
            Payments made via Paystack or direct MoMo are automatically verified in real time. If your network fluctuated or you closed the browser before redirection:
          </p>
          <ul className="list-disc list-inside space-y-1 pl-1">
            <li><strong>Automated SMS Recovery:</strong> Our background system scans pending payments and sends an automated SMS recovery link.</li>
            <li><strong>Self-Verification:</strong> Open the <Link to="/track" className="text-blue-600 dark:text-cyan-400 font-bold hover:underline">Track Order</Link> page and click <strong>Verify Payment</strong> to sync with Paystack.</li>
            <li><strong>Zero Double Charges:</strong> If payment deducted but order didn't log, our webhook reconciles and dispatches your data automatically.</li>
          </ul>
        </div>
      ),
    },
    {
      id: "rewards",
      number: 6,
      icon: Gift,
      title: "Point 6: Spin & Win, Referrals & Reward Games",
      shortDesc: "Earn free data bundles, discounts, and cash bonuses by spinning the wheel, referring friends, and playing.",
      badge: "Bonuses & Gifts",
      badgeColor: "bg-purple-100 text-purple-900 border-purple-300 dark:bg-purple-500/20 dark:text-purple-300 dark:border-purple-500/30",
      content: (
        <div className="space-y-2.5 text-xs md:text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 my-1">
            <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-500/30">
              <div className="flex items-center gap-1.5 font-bold text-zinc-900 dark:text-white text-xs">
                <Sparkles className="size-3.5 text-purple-600 dark:text-purple-400" />
                <span>Spin & Win Wheel</span>
              </div>
              <p className="text-[11px] text-zinc-600 dark:text-zinc-300 mt-1">
                Spin the daily lucky wheel on the shop to win instant bundle discounts or free data codes.
              </p>
            </div>
            <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-500/30">
              <div className="flex items-center gap-1.5 font-bold text-zinc-900 dark:text-white text-xs">
                <Share2 className="size-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>Refer & Earn</span>
              </div>
              <p className="text-[11px] text-zinc-600 dark:text-zinc-300 mt-1">
                Share your referral link with friends. Whenever they place an order, you earn store credits and cashback.
              </p>
            </div>
            <div className="p-3 rounded-xl bg-pink-50 dark:bg-pink-950/30 border border-pink-200 dark:border-pink-500/30">
              <div className="flex items-center gap-1.5 font-bold text-zinc-900 dark:text-white text-xs">
                <Gamepad2 className="size-3.5 text-pink-600 dark:text-pink-400" />
                <span>Play Games</span>
              </div>
              <p className="text-[11px] text-zinc-600 dark:text-zinc-300 mt-1">
                Try out our interactive mini-games (tap games & speed rush) to unlock exclusive voucher discounts.
              </p>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "support",
      number: 7,
      icon: MessageCircle,
      title: "Point 7: 24/7 Customer Support & Assistance",
      shortDesc: "Reach our dedicated human & AI agents anytime on WhatsApp or live chat.",
      badge: "24/7 Available",
      badgeColor: "bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30",
      content: (
        <div className="space-y-2.5 text-xs md:text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
          <p>
            Need quick assistance or have an inquiry about a pending order? We are here 24 hours a day, 7 days a week.
          </p>
          <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-1.5">
            <div className="font-bold text-zinc-900 dark:text-white text-xs">Tips for Fastest Support Resolution:</div>
            <ol className="list-decimal list-inside text-xs space-y-0.5 text-zinc-700 dark:text-zinc-300">
              <li>Always provide your <strong>Order ID / Reference</strong>.</li>
              <li>Provide the <strong>Recipient Phone Number</strong>.</li>
              <li>Attach a screenshot of the MoMo debit SMS if payment verification is required.</li>
            </ol>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              type="button"
              size="sm"
              onClick={() => window.dispatchEvent(new CustomEvent("open-support-chat"))}
              className="text-xs font-bold gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-xs"
            >
              <MessageCircle className="size-3.5" /> Open Live Chat
            </Button>
            {whatsappLink && (
              <a
                href={whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 bg-green-100 hover:bg-green-200 text-green-900 border border-green-300 dark:bg-green-500/20 dark:hover:bg-green-500/30 dark:text-green-300 dark:border-green-500/30 rounded-xl transition-all"
              >
                <PhoneCall className="size-3.5" /> WhatsApp Support <ExternalLink className="size-3" />
              </a>
            )}
            <Link
              to="/track"
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 bg-zinc-200 hover:bg-zinc-300 text-zinc-900 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-100 rounded-xl transition-all"
            >
              <Search className="size-3.5" /> Track Order Page
            </Link>
          </div>
        </div>
      ),
    },
  ];

  return (
    <section className={`w-full my-8 ${className}`} aria-label="Store Guide and Important Notices">
      <Card className="overflow-hidden border-2 border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 rounded-3xl shadow-xl">
        {/* Header Notice Banner */}
        <div className="bg-zinc-100/80 dark:bg-zinc-900/80 border-b border-zinc-200 dark:border-zinc-800 px-5 py-4 md:px-7 md:py-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="flex size-9 items-center justify-center rounded-2xl bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/30">
                <Info className="size-5" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base md:text-lg font-black tracking-tight text-zinc-900 dark:text-white">
                    IMPORTANT STORE NOTICE &amp; GUIDE
                  </h3>
                  <span className="hidden sm:inline-flex text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/30">
                    Must Read
                  </span>
                </div>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
                  How our system works, delivery timeframes, tracking, games &amp; support policies for {storeName}.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 dark:bg-emerald-500/15 dark:border-emerald-500/30 dark:text-emerald-300 font-bold">
                <CheckCircle2 className="size-3.5" /> 24/7 Automated Fulfillment
              </span>
            </div>
          </div>
        </div>

        {/* Important Broadcast Alert: MTN 24h Verification Notice */}
        <div className="mx-4 md:mx-6 mt-4 p-4 md:p-5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-300 dark:border-amber-500/40 text-amber-950 dark:text-amber-100 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="flex size-8 items-center justify-center rounded-xl bg-amber-500 text-slate-950 font-black shrink-0 shadow-sm mt-0.5">
              📢
            </span>
            <div className="space-y-2 text-xs md:text-sm">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-black text-amber-900 dark:text-amber-300 text-sm tracking-wide uppercase">
                  IMPORTANT UPDATE 📢
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200 text-amber-950 border border-amber-400 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/40">
                  MTN New Number Verification Notice
                </span>
              </div>
              <p className="text-zinc-800 dark:text-zinc-200 leading-relaxed font-medium">
                If you track your order (<Link to="/track?tab=search" className="text-blue-700 dark:text-amber-400 underline font-bold hover:opacity-80">track order</Link>) and your delivery status shows <strong className="text-amber-950 dark:text-amber-200 font-black bg-amber-200/90 dark:bg-amber-500/30 px-1.5 py-0.5 rounded border border-amber-300 dark:border-amber-500/40">PENDING</strong> after 24 hours of payment confirmation, please note:
              </p>
              <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
                This happens when the recipient number is new to the system and is placing an order for the first time. Such numbers require verification by MTN.
              </p>
              <div className="p-3 rounded-xl bg-amber-100/90 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-500/30 text-amber-950 dark:text-amber-200 text-xs leading-relaxed">
                <strong className="text-zinc-950 dark:text-white font-black">Kindly note that your money is safe.</strong> Your order will be processed successfully after the verification. Our biggest challenge is that MTN does not provide a specific time frame for this verification, but we expect it to be completed within 7 days.
              </div>
              <p className="text-[11px] text-zinc-600 dark:text-zinc-400 italic">
                We sincerely apologize for the inconvenience and kindly ask you to bear with us. Thank you for your understanding.
              </p>
            </div>
          </div>
        </div>

        {/* Points 1 to 7 Minimized Into a Single Drop Box */}
        <div className="p-4 md:p-6">
          <div className="rounded-2xl border-2 border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden transition-all">
            {/* The Clickable Minimized Drop Box Header */}
            <button
              type="button"
              onClick={() => setIsPointsDropBoxOpen(!isPointsDropBoxOpen)}
              className="w-full text-left p-4 md:p-5 flex items-center justify-between gap-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 transition-colors focus:outline-hidden"
              title="Click to drop down or minimize the store guide"
            >
              <div className="flex items-center gap-3.5 min-w-0 flex-1">
                <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <BookOpen className="size-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-black text-xs md:text-sm text-zinc-900 dark:text-white">
                      Store Guide &amp; Policies (Points 1 to 7)
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-900 border border-blue-300 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/30">
                      {isPointsDropBoxOpen ? "Tap to Minimize" : "Tap to Drop Down"}
                    </span>
                  </div>
                  <p className="text-[11px] md:text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    1. Ordering &bull; 2. 30m Delivery &bull; 3. Wrong Numbers &bull; 4. Tracking &bull; 5. Payments &bull; 6. Games &bull; 7. Support
                  </p>
                </div>
              </div>
              <div className="size-8 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                {isPointsDropBoxOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
              </div>
            </button>

            {/* Dropped Down Content */}
            {isPointsDropBoxOpen && (
              <div className="p-4 md:p-5 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/40 space-y-4 animate-in fade-in duration-200">
                {/* Point Selector Inside the Drop Box */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <label htmlFor="inner-point-select" className="text-xs font-bold text-zinc-700 dark:text-zinc-300 shrink-0">
                    Select Point:
                  </label>
                  <div className="relative flex-1">
                    <select
                      id="inner-point-select"
                      value={activePointId}
                      onChange={(e) => setActivePointId(e.target.value)}
                      className="w-full appearance-none rounded-xl bg-white dark:bg-zinc-900 border-2 border-zinc-300 dark:border-zinc-700 py-2 pl-3.5 pr-9 text-xs md:text-sm font-bold text-zinc-900 dark:text-zinc-100 shadow-sm focus:outline-hidden cursor-pointer"
                    >
                      <option value="orders">Point 1: How to Place an Order (Step-by-Step)</option>
                      <option value="delivery">Point 2: Delivery Timeline (Within 30 Minutes Max)</option>
                      <option value="wrong-numbers">Point 3: Verify Numbers &amp; Wrong Number Policy</option>
                      <option value="tracking">Point 4: How to Track Order &amp; Real-Time Status</option>
                      <option value="payments">Point 5: Payment Verification &amp; Auto-Recovery</option>
                      <option value="rewards">Point 6: Spin &amp; Win, Referrals &amp; Reward Games</option>
                      <option value="support">Point 7: 24/7 Customer Support &amp; Assistance</option>
                      <option value="all">📚 View All 7 Points at Once</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-zinc-500">
                      <ChevronDown className="size-4" />
                    </div>
                  </div>
                </div>

                {/* Selected Point Content */}
                <div className="space-y-3 pt-1">
                  {(activePointId === "all" ? sections : sections.filter((s) => s.id === activePointId)).map((item) => {
                    const Icon = item.icon;
                    return (
                      <div
                        key={item.id}
                        className="rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4 shadow-xs"
                      >
                        <div className="flex items-center gap-3 mb-2.5 pb-2.5 border-b border-zinc-200 dark:border-zinc-800">
                          <div className="size-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 flex items-center justify-center shrink-0 border border-zinc-200 dark:border-zinc-700">
                            <Icon className="size-4" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-xs md:text-sm text-zinc-900 dark:text-zinc-100">
                                {item.title}
                              </span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${item.badgeColor}`}>
                                {item.badge}
                              </span>
                            </div>
                          </div>
                        </div>
                        {item.content}
                      </div>
                    );
                  })}
                </div>

                {/* Bottom Close Button */}
                <div className="pt-2 text-center">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsPointsDropBoxOpen(false)}
                    className="text-xs font-semibold rounded-xl"
                  >
                    <ChevronUp className="size-3.5 mr-1" /> Minimize Drop Box
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Quick Action Bar */}
        <div className="bg-zinc-50 dark:bg-zinc-900/60 border-t border-zinc-200 dark:border-zinc-800 px-5 py-3 md:px-6 flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-600 dark:text-zinc-400">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
            <span className="font-medium">Always check recipient numbers before completing payment.</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/track" className="font-bold text-blue-600 dark:text-cyan-400 hover:underline flex items-center gap-1">
              <Search className="size-3.5" /> Track Order
            </Link>
            <span>&bull;</span>
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent("open-support-chat"))}
              className="font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
            >
              <MessageCircle className="size-3.5" /> 24/7 Support
            </button>
          </div>
        </div>
      </Card>
    </section>
  );
};
