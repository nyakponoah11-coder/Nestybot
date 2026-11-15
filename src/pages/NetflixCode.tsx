import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { invokeApiFunction } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  Copy,
  RefreshCw,
  Play,
  Mail,
  CheckCircle2,
  AlertTriangle,
  Lock,
  MessageSquare,
  HelpCircle,
} from "lucide-react";
import { toast } from "sonner";
import { DEFAULT_WHATSAPP_BOT_URL, formatWhatsAppBotUrl } from "@/lib/whatsapp";

const NetflixCode = () => {
  const { reference } = useParams<{ reference: string }>();
  const [order, setOrder] = useState<any>(null);
  const [netflixEmail, setNetflixEmail] = useState("stillmoving11@gmail.com");
  const [loadingOrder, setLoadingOrder] = useState(true);
  const [code, setCode] = useState<string | null>(null);
  const [codeAt, setCodeAt] = useState<string | null>(null);
  const [alreadyUsed, setAlreadyUsed] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [sendingSms, setSendingSms] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    document.title = "Netflix sign-in code";
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const loadOrder = async () => {
    if (!reference) return;
    const { data } = await invokeApiFunction("service-verify", { body: { reference } });
    if (data?.netflix_email) setNetflixEmail(data.netflix_email);
    setOrder(data?.order || null);
    if (data?.order?.netflix_last_code) {
      setCode(data.order.netflix_last_code);
      setCodeAt(data.order.netflix_last_code_at);
      setAlreadyUsed(true);
      setFetchError(null);
    }
    setLoadingOrder(false);
  };

  useEffect(() => {
    loadOrder();
  }, [reference]);

  const fetchCode = async (force = false) => {
    if (!reference) return;
    setFetching(true);
    setFetchError(null);
    try {
      const { data, error } = await invokeApiFunction("netflix-fetch-code", { body: { reference, force } });
      const payload: any = data;

      if (payload?.netflix_email) {
        setNetflixEmail(payload.netflix_email);
      }

      if (payload?.code) {
        setCode(payload.code);
        setCodeAt(payload.email_at || new Date().toISOString());
        setAlreadyUsed(true);
        setFetchError(null);
        toast.success("Code received and sent to your phone via SMS!");
        return;
      }

      const explicitError =
        payload?.error ||
        error?.message ||
        (payload?.message && payload.message !== "Sign-in code retrieved successfully." ? payload.message : null);

      if (explicitError) {
        setFetchError(explicitError);
        return;
      }

      setFetchError(
        `No Netflix code detected in inbox yet. Please open Netflix, tap "Send sign-in code" using ${netflixEmail || "the account email"}, wait 20 seconds, and tap Check Again.`
      );
    } catch (e: any) {
      setFetchError(e.message || "Could not fetch code");
      toast.error(e.message || "Could not fetch code");
    } finally {
      setFetching(false);
    }
  };

  const resendCodeSms = async () => {
    if (!reference) return;
    setSendingSms(true);
    try {
      const { data, error } = await invokeApiFunction("netflix-fetch-code", {
        body: { reference, resend_sms: true },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message || "SMS failed");
      toast.success("Code re-sent to your phone via SMS!");
    } catch (e: any) {
      toast.error(e.message || "Failed to resend SMS");
    } finally {
      setSendingSms(false);
    }
  };

  const loginExpiresAt = order?.netflix_login_expires_at ? new Date(order.netflix_login_expires_at) : null;
  const loginExpired = loginExpiresAt ? loginExpiresAt.getTime() < now : false;
  const daysLeft = loginExpiresAt ? Math.max(0, Math.ceil((loginExpiresAt.getTime() - now) / 86400000)) : 0;

  const copy = (v: string) => {
    navigator.clipboard.writeText(v);
    toast.success("Copied to clipboard");
  };

  const waSupportUrl = () => {
    const text = encodeURIComponent(
      `Hello Admin, I have paid for Netflix 1-month sign-in (Reference: ${reference}). Please send me my Netflix sign-in code.`
    );
    const base = formatWhatsAppBotUrl(DEFAULT_WHATSAPP_BOT_URL);
    return base.includes("?") ? `${base}&text=${text}` : `${base}?text=${text}`;
  };

  if (loadingOrder) {
    return (
      <div className="min-h-screen bg-black grid place-items-center">
        <Loader2 className="size-8 animate-spin text-red-500" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-black grid place-items-center p-6">
        <Card className="max-w-md p-6 text-center bg-zinc-900 border-zinc-800 text-white">
          <AlertTriangle className="size-10 mx-auto text-destructive" />
          <h1 className="mt-3 text-xl font-bold">Order not found</h1>
          <p className="text-sm text-zinc-400 mt-2">
            We could not locate this order reference. Please check your link or contact support.
          </p>
          <Button asChild className="mt-4 bg-red-600 hover:bg-red-700">
            <Link to="/">Back to shop</Link>
          </Button>
        </Card>
      </div>
    );
  }

  if (order.payment_status !== "paid") {
    return (
      <div className="min-h-screen bg-black grid place-items-center p-6">
        <Card className="max-w-md p-6 text-center bg-zinc-900 border-zinc-800 text-white">
          <AlertTriangle className="size-10 mx-auto text-amber-500" />
          <h1 className="mt-3 text-xl font-bold">Payment not confirmed yet</h1>
          <p className="text-sm text-zinc-400 mt-2">
            Please complete payment and refresh this page.
          </p>
          <div className="mt-4 flex gap-2 justify-center">
            <Button onClick={loadOrder} variant="secondary">
              <RefreshCw className="size-4 mr-2" /> Refresh Status
            </Button>
            <Button asChild variant="outline">
              <Link to="/">Back to shop</Link>
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-zinc-950 to-black text-white">
      <header className="container py-5 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <Play className="size-5 fill-red-500 text-red-500" />
          <span className="font-black text-red-500 tracking-widest text-lg">NETFLIX ACCESS</span>
        </Link>
        {loginExpired ? (
          <span className="text-xs font-bold bg-red-600 px-3 py-1 rounded-full">EXPIRED</span>
        ) : (
          <span className="text-xs font-bold bg-emerald-600 px-3 py-1 rounded-full">
            {daysLeft} day{daysLeft === 1 ? "" : "s"} left
          </span>
        )}
      </header>

      <main className="container pb-12 max-w-2xl px-4">
        {/* Reference card */}
        <Card className="p-4 mb-4 bg-zinc-900/90 border-zinc-800 text-white shadow-xl">
          <div className="text-xs uppercase tracking-wider text-red-400 font-bold">Your Order Reference</div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="font-mono text-lg md:text-xl font-bold truncate text-zinc-100">{order.reference}</span>
            <Button size="sm" variant="secondary" onClick={() => copy(order.reference)} className="shrink-0 bg-zinc-800 hover:bg-zinc-700 text-white">
              <Copy className="size-3 mr-1" /> Copy
            </Button>
          </div>
          <p className="text-xs text-zinc-400 mt-2">Save this reference to view your sign-in details at any time.</p>
        </Card>

        {loginExpired && (
          <Card className="p-4 mb-4 border-red-500/50 bg-red-950/40 text-red-100">
            <div className="font-bold">Your 30-day access has expired</div>
            <div className="text-sm opacity-90 mt-1">Please buy again to keep watching.</div>
            <Button asChild className="mt-3 bg-red-600 hover:bg-red-500">
              <Link to="/">Buy again</Link>
            </Button>
          </Card>
        )}

        {/* Step 1: Netflix Email */}
        <Card className="p-5 bg-zinc-900/90 border-zinc-800 text-white shadow-xl">
          <div className="flex items-center justify-between">
            <div className="text-xs uppercase tracking-wider text-red-400 font-bold">Step 1</div>
            <span className="text-[11px] text-zinc-400">Account login</span>
          </div>
          <h2 className="text-lg font-bold mt-1">Sign in to Netflix with this email</h2>
          <div className="mt-3 rounded-xl bg-black/60 border border-zinc-700 p-3.5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <Mail className="size-4 text-red-400 shrink-0" />
              <span className="font-mono text-sm md:text-base font-semibold truncate text-zinc-100">
                {netflixEmail}
              </span>
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => copy(netflixEmail)}
              className="shrink-0 bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/30"
            >
              <Copy className="size-3 mr-1" /> Copy
            </Button>
          </div>
          <ol className="mt-4 text-xs md:text-sm space-y-2 text-zinc-300 list-decimal list-inside leading-relaxed">
            <li>Open Netflix on your TV, phone, or laptop.</li>
            <li>Choose <b>Sign in</b> and paste the email above.</li>
            <li>Netflix will send a 4-digit temporary sign-in code to this email.</li>
            <li>Tap <b>Get sign-in code</b> in Step 2 below to receive your code.</li>
          </ol>
        </Card>

        {/* Step 2: Code Display & Fetching */}
        <Card className="p-5 mt-4 bg-zinc-900/90 border-zinc-800 text-white shadow-xl">
          <div className="flex items-center justify-between">
            <div className="text-xs uppercase tracking-wider text-red-400 font-bold">Step 2</div>
            <span className="text-[11px] text-zinc-400">Sign-in code</span>
          </div>
          <h2 className="text-lg font-bold mt-1">Get your sign-in code</h2>
          <p className="text-xs md:text-sm text-zinc-400 mt-1">
            Tap the button below once Netflix sends the code. Your code will appear here and is also sent to your phone via SMS.
          </p>

          {code ? (
            <div className="mt-5 rounded-2xl bg-gradient-to-br from-red-600 via-red-700 to-red-900 p-6 text-center shadow-2xl border border-red-500/40">
              <div className="text-xs uppercase tracking-widest text-red-200 font-semibold">Your Netflix Sign-in Code</div>
              <div className="text-5xl md:text-6xl font-black tracking-[0.35em] my-3 font-mono text-white drop-shadow">
                {code}
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => copy(code)}
                  className="bg-white text-black hover:bg-zinc-200 font-bold px-4"
                >
                  <Copy className="size-3.5 mr-1.5" /> Copy Code
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={sendingSms}
                  onClick={resendCodeSms}
                  className="bg-red-950/80 text-white hover:bg-red-900 font-medium px-3 border border-red-400/30"
                >
                  {sendingSms ? (
                    <Loader2 className="size-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <Mail className="size-3.5 mr-1.5" />
                  )}
                  Resend SMS
                </Button>
              </div>
              <div className="mt-3 flex flex-col sm:flex-row items-center justify-center gap-2 text-xs text-red-200/90">
                <span className="inline-flex items-center gap-1 bg-black/30 px-2.5 py-1 rounded-full border border-red-400/20">
                  <CheckCircle2 className="size-3 text-emerald-400" />
                  Sent via SMS to {order?.customer_phone || "your phone"}
                </span>
                {codeAt && (
                  <span className="text-[11px] text-red-200/70">
                    Delivered {new Date(codeAt).toLocaleTimeString()}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-dashed border-zinc-700 p-6 text-center text-zinc-400 bg-black/30">
              <CheckCircle2 className="size-7 mx-auto text-emerald-400" />
              <div className="mt-2 text-sm font-medium text-zinc-300">Ready to retrieve your code</div>
              <p className="text-xs text-zinc-500 mt-0.5">
                Make sure you tapped &ldquo;Send code&rdquo; on Netflix first
              </p>
            </div>
          )}

          {alreadyUsed && code ? (
            <div className="mt-4 flex flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={fetching || loginExpired}
                onClick={() => fetchCode(true)}
                className="w-full bg-zinc-900 border-zinc-700 hover:bg-zinc-800 text-xs text-zinc-300"
              >
                {fetching ? (
                  <Loader2 className="size-3.5 mr-1.5 animate-spin" />
                ) : (
                  <RefreshCw className="size-3.5 mr-1.5" />
                )}
                Request fresh code from Netflix
              </Button>
            </div>
          ) : (
            <Button
              disabled={fetching || loginExpired}
              onClick={() => fetchCode(false)}
              className="mt-4 w-full h-12 bg-red-600 hover:bg-red-500 text-white font-bold text-base shadow-lg transition-all"
            >
              {fetching ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" /> Checking inbox for code…
                </>
              ) : (
                <>
                  <RefreshCw className="size-4 mr-2" /> Get sign-in code
                </>
              )}
            </Button>
          )}

          {/* Fetch error / delay notice */}
          {fetchError && !code && (
            <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs md:text-sm text-amber-200 space-y-2">
              <div className="flex gap-2 items-start">
                <AlertTriangle className="size-4 shrink-0 text-amber-400 mt-0.5" />
                <span>{fetchError}</span>
              </div>
              <div className="pt-2 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() => fetchCode()}
                  disabled={fetching}
                  className="bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs h-8"
                >
                  <RefreshCw className={`size-3 mr-1 ${fetching ? "animate-spin" : ""}`} /> Check Again
                </Button>
                <a
                  href={waSupportUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition"
                >
                  <MessageSquare className="size-3.5" /> Chat on WhatsApp for Code
                </a>
              </div>
            </div>
          )}

          {/* Direct WhatsApp help backup button */}
          <div className="mt-5 pt-4 border-t border-zinc-800 flex items-center justify-between flex-wrap gap-2">
            <span className="text-xs text-zinc-400 flex items-center gap-1">
              <HelpCircle className="size-3.5" /> Need immediate assistance?
            </span>
            <a
              href={waSupportUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold inline-flex items-center gap-1 transition"
            >
              <MessageSquare className="size-3.5" /> WhatsApp Support
            </a>
          </div>
        </Card>
      </main>
    </div>
  );
};

export default NetflixCode;
