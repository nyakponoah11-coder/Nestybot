import { useEffect, useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { supabase, invokeApiFunction } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Loader2, Clock, Play, Sparkles, RefreshCw, Copy, Check } from "lucide-react";
import { NETWORK_LABEL, formatGHS } from "@/lib/networks";
import { ApplyReferralPrompt } from "@/components/ApplyReferralPrompt";
import { AfaWhatsAppPrompt } from "@/components/AfaWhatsAppPrompt";
import { DeliveryTracker } from "@/components/DeliveryTracker";
import { updateOrderInHistory } from "@/lib/orderHistory";
import { brandText } from "@/lib/brand";

const PaymentCallback = () => {
  const [params] = useSearchParams();
  const reference = params.get("reference") || params.get("trxref");
  const [order, setOrder] = useState<any>(null);
  const [kind, setKind] = useState<"data" | "netflix" | "afa" | "mashup" | "checker">("data");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [copiedRef, setCopiedRef] = useState(false);
  const navigate = useNavigate();

  const handleCopyRef = (ref: string) => {
    navigator.clipboard.writeText(ref);
    setCopiedRef(true);
    setTimeout(() => setCopiedRef(false), 2000);
  };

  const checkStatus = async (silent = false, retry = false) => {
    if (!reference) return;
    if (!silent) setVerifying(true);
    const isChecker = reference.startsWith("CK");
    const isService = reference.startsWith("NF") || reference.startsWith("AF") || reference.startsWith("MU");
    const fn = isChecker ? "checker-verify" : isService ? "service-verify" : "paystack-verify";

    try {
      const { data, error } = await invokeApiFunction(fn, { body: { reference, retry } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const curOrder = data?.order;
      if (curOrder) {
        setOrder(curOrder);
        updateOrderInHistory(reference, {
          payment_status: curOrder.payment_status,
          delivery_status: curOrder.delivery_status,
          datamart_reference: curOrder.datamart_reference,
          amount: curOrder.amount,
          recipient_phone: curOrder.recipient_phone || curOrder.customer_phone,
          network: curOrder.network,
          capacity: curOrder.capacity,
          error_message: curOrder.error_message,
          type: isChecker ? "checker" : isService ? "service" : "data",
        });

        if (isChecker) setKind("checker");
        else if (isService) {
          setKind(
            reference.startsWith("NF")
              ? "netflix"
              : reference.startsWith("MU")
              ? "mashup"
              : "afa"
          );
        }

        if (reference.startsWith("NF") && curOrder.payment_status === "paid") {
          navigate(`/netflix/${reference}`, { replace: true });
        }
      }
      return curOrder;
    } catch (e: any) {
      // Direct Supabase lookup fallback to prevent false "unavailable" errors
      try {
        const { data: dbOrder } = await supabase
          .from("orders")
          .select("*")
          .or(`reference.eq.${reference},datamart_reference.eq.${reference}`)
          .maybeSingle();
        if (dbOrder) {
          setOrder(dbOrder);
          setError(null);
          return dbOrder;
        }
      } catch (_) {}

      if (!silent) setError(e.message || "Verification failed");
      return null;
    } finally {
      if (!silent) setVerifying(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    document.title = "Payment Confirmation";
    if (!reference) {
      setError("Missing reference");
      setLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      // First check immediately
      let cur = await checkStatus(true);
      if (cancelled) return;

      // If failed, stop loading
      if (cur?.payment_status === "failed") {
        setLoading(false);
        return;
      }

      // If already paid, stop full-screen loading immediately so the customer sees PAID instantly!
      if (cur?.payment_status === "paid") {
        setLoading(false);
      }

      // Poll up to 8 times every 2.5s for MoMo confirmation or delivery status updates
      for (let i = 0; i < 8; i++) {
        if (cancelled) break;
        const ds = (cur?.delivery_status || "").toLowerCase();
        if (cur?.payment_status === "paid" && (ds === "delivered" || ds === "completed" || ds === "failed" || ds === "cancelled")) {
          break;
        }
        await new Promise((r) => setTimeout(r, 2500));
        if (cancelled) break;

        cur = await checkStatus(true);
        if (cur?.payment_status === "paid") {
          setLoading(false);
        }
        if (cur?.payment_status === "failed") break;
      }

      if (!cancelled) setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [reference, navigate]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 grid place-items-center p-4">
      <Card className="w-full max-w-md p-6 bg-slate-900/95 border border-amber-500/30 text-center shadow-2xl backdrop-blur-md">
        {loading ? (
          <>
            <Loader2 className="size-10 mx-auto animate-spin text-accent" />
            <h1 className="mt-4 text-xl font-bold">Confirming payment…</h1>
            <p className="text-muted-foreground text-sm mt-1">Checking with Paystack & telecom provider.</p>
          </>
        ) : error ? (
          <>
            <XCircle className="size-10 mx-auto text-destructive" />
            <h1 className="mt-4 text-xl font-bold">Something went wrong</h1>
            <p className="text-muted-foreground text-sm mt-1">{error}</p>
            <Button className="mt-4" onClick={() => navigate("/")}>Back to shop</Button>
          </>
        ) : order && kind === "checker" ? (
          <>
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-black uppercase tracking-wider shadow-[0_0_20px_rgba(16,185,129,0.25)]">
                <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
                Payment Received
              </div>

              <div className="space-y-1">
                <h1 className="text-2xl md:text-3xl font-black text-foreground tracking-tight flex items-center justify-center gap-2">
                  Payment Received!
                </h1>
                <p className="text-sm font-medium text-muted-foreground">
                  {order.delivery_status === "delivered" ? "Your Result Checker Card is Ready!" : "Your order is in processing to issue your card."}
                </p>
              </div>

              {order.delivery_status !== "delivered" && order.payment_status === "paid" && (
                <div className="p-3.5 rounded-2xl border-2 border-amber-500/40 bg-gradient-to-br from-amber-950/40 via-card to-orange-950/20 text-left space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-amber-400 animate-ping" />
                      Order is in Processing
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/35">
                      Issuing PIN &amp; Serial
                    </span>
                  </div>
                  <p className="text-xs text-foreground/80">
                    Payment of GH₵ {Number(order.amount).toFixed(2)} received. Generating your {order.checker_type || "WAEC"} checker card now.
                  </p>
                </div>
              )}
            </div>

            {order.delivery_status === "delivered" || order.delivery_status === "completed" ? (
              <div className="mt-4 rounded-xl border-2 border-emerald-500/50 bg-emerald-500/10 p-4 text-left space-y-2">
                <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Card Ready</div>
                <div>
                  <div className="text-xs text-muted-foreground">Serial number</div>
                  <div className="font-mono text-lg font-bold break-all text-foreground">{order.serial_number}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">PIN</div>
                  <div className="font-mono text-lg font-bold break-all text-foreground">{order.pin}</div>
                </div>
                <Button
                  variant="outline"
                  className="w-full border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/20"
                  onClick={() => {
                    navigator.clipboard.writeText(`Serial: ${order.serial_number}  PIN: ${order.pin}`);
                  }}
                >
                  Copy serial &amp; PIN
                </Button>
              </div>
            ) : null}

            <div className="mt-4 text-left rounded-lg border p-4 space-y-2 text-sm bg-card/60">
              <Row label="Reference" value={order.reference} />
              <Row label="Type" value={order.checker_type} />
              <Row label="Phone" value={order.customer_phone} />
              <Row label="Amount" value={`GH₵ ${Number(order.amount).toFixed(2)}`} />
              <Row
                label="Payment"
                value={
                  <span className="font-bold text-emerald-400 uppercase flex items-center gap-1">
                    <CheckCircle2 className="size-3.5 inline text-emerald-400" /> Payment Received
                  </span>
                }
              />
              <Row label="Delivery" value={order.delivery_status === "delivered" ? "Delivered" : "Order is in Processing"} />
            </div>
            <Button className="mt-4 w-full" variant="outline" onClick={() => navigate("/")}>Back to shop</Button>
          </>
        ) : order && kind === "netflix" ? (
          <>
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-black uppercase tracking-wider shadow-[0_0_20px_rgba(16,185,129,0.25)]">
                <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
                Payment Received
              </div>
              <Play className="size-12 mx-auto text-red-600 fill-red-600" />
              <h1 className="text-2xl font-bold">Netflix Access Ready</h1>
              <p className="text-sm text-muted-foreground">Payment received. Directing you to your account…</p>
            </div>
            <Button asChild className="mt-4 w-full bg-red-600 hover:bg-red-500 text-white">
              <Link to={`/netflix/${order.reference}`}>Open Netflix sign-in</Link>
            </Button>
          </>
        ) : order && kind === "afa" ? (
          <>
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-black uppercase tracking-wider shadow-[0_0_20px_rgba(16,185,129,0.25)]">
                <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
                Payment Received
              </div>
              <h1 className="text-2xl font-bold">Payment Received!</h1>
              <p className="text-sm text-muted-foreground">Your AFA Registration order is in processing.</p>

              <div className="p-3.5 rounded-2xl border-2 border-amber-500/40 bg-gradient-to-br from-amber-950/40 via-card to-orange-950/20 text-left space-y-1.5">
                <div className="text-xs font-black uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-amber-400 animate-ping" />
                  Order is in Processing
                </div>
                <p className="text-xs text-foreground/80">
                  Payment of GH₵ {Number(order.amount).toFixed(2)} confirmed. Please submit your details below to finalize registration.
                </p>
              </div>
            </div>

            <div className="mt-4 text-left rounded-lg border p-4 space-y-2 text-sm bg-card/60">
              <Row label="Reference" value={order.reference} />
              <Row label="Phone" value={order.customer_phone} />
              <Row label="Amount" value={`GH₵ ${Number(order.amount).toFixed(2)}`} />
              <Row
                label="Payment"
                value={
                  <span className="font-bold text-emerald-400 uppercase flex items-center gap-1">
                    <CheckCircle2 className="size-3.5 inline text-emerald-400" /> Payment Received
                  </span>
                }
              />
            </div>
            <div className="mt-3">
              <AfaWhatsAppPrompt phone={order.customer_phone} reference={order.reference} />
            </div>
            <Button className="mt-4 w-full" variant="outline" onClick={() => navigate("/")}>Back to shop</Button>
          </>
        ) : order && kind === "mashup" ? (
          <>
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-black uppercase tracking-wider shadow-[0_0_20px_rgba(16,185,129,0.25)]">
                <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
                Payment Received
              </div>
              <h1 className="text-2xl font-bold">Payment Received!</h1>
              <p className="text-sm text-muted-foreground">Your MTN Mashup order is in processing.</p>

              <div className="p-3.5 rounded-2xl border-2 border-amber-500/40 bg-gradient-to-br from-amber-950/40 via-card to-orange-950/20 text-left space-y-1.5">
                <div className="text-xs font-black uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-amber-400 animate-ping" />
                  Order is in Processing
                </div>
                <p className="text-xs text-foreground/80">
                  Payment of GH₵ {Number(order.amount).toFixed(2)} received. Order is queued for fast dispatch to {order.customer_phone}.
                </p>
              </div>
            </div>

            <div className="mt-4 text-left rounded-lg border p-4 space-y-2 text-sm bg-card/60">
              <Row label="Reference" value={order.reference} />
              <Row label="Service" value="MTN Mashup" />
              <Row label="Phone" value={order.customer_phone} />
              <Row label="Amount" value={`GH₵ ${Number(order.amount).toFixed(2)}`} />
              <Row
                label="Payment"
                value={
                  <span className="font-bold text-emerald-400 uppercase flex items-center gap-1">
                    <CheckCircle2 className="size-3.5 inline text-emerald-400" /> Payment Received
                  </span>
                }
              />
              <Row label="Delivery" value={(order.delivery_status === "delivered" || order.delivery_status === "completed") ? "Delivered" : order.delivery_status === "refunded" ? "Refunded" : "Order is in Processing"} />
            </div>
            <Button className="mt-4 w-full" variant="outline" onClick={() => navigate("/")}>Back to shop</Button>
          </>
        ) : order ? (
          <>
            {/* Header & Payment Confirmation */}
            {order.payment_status === "paid" ? (
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-black uppercase tracking-wider shadow-[0_0_20px_rgba(16,185,129,0.25)]">
                  <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
                  Payment Received
                </div>

                <div className="space-y-1">
                  <h1 className="text-2xl md:text-3xl font-black text-foreground tracking-tight flex items-center justify-center gap-2">
                    Payment Received!
                  </h1>
                  <p className="text-sm font-medium text-muted-foreground">
                    Amount: <strong className="text-emerald-400 font-bold">{formatGHS(order.amount)}</strong> confirmed via Mobile Money
                  </p>
                </div>

                {/* Nice Order Status & Processing Flow */}
                {(() => {
                  const isDelivered = order.delivery_status === "delivered" || order.delivery_status === "completed";
                  const isFailed = order.delivery_status === "failed" || order.delivery_status === "cancelled";
                  const isRefunded = order.delivery_status === "refunded";

                  return (
                    <div className="mt-3 p-4 rounded-2xl border-2 border-amber-500/40 bg-gradient-to-br from-amber-950/40 via-card to-orange-950/20 shadow-[0_4px_24px_rgba(245,158,11,0.15)] text-left space-y-3.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`size-2.5 rounded-full ${
                            isDelivered
                              ? "bg-emerald-400"
                              : isRefunded
                              ? "bg-orange-400"
                              : isFailed
                              ? "bg-destructive animate-pulse"
                              : "bg-amber-400 animate-ping"
                          }`} />
                          <span className={`text-xs font-black uppercase tracking-wider ${
                            isDelivered
                              ? "text-emerald-300"
                              : isRefunded
                              ? "text-orange-400"
                              : isFailed
                              ? "text-destructive"
                              : "text-amber-300"
                          }`}>
                            {isDelivered
                              ? "Order Completed"
                              : isRefunded
                              ? "Order Refunded"
                              : isFailed
                              ? "Delivery Queue Delay"
                              : "Order is in Processing"}
                          </span>
                        </div>
                        <span className={`text-[11px] font-bold uppercase px-2.5 py-0.5 rounded-full ${
                          isDelivered
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                            : isRefunded
                            ? "bg-orange-500/20 text-orange-400 border border-orange-500/40"
                            : isFailed
                            ? "bg-destructive/20 text-destructive border border-destructive/40"
                            : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                        }`}>
                          {isDelivered
                            ? "Delivered"
                            : isRefunded
                            ? "Refunded"
                            : isFailed
                            ? "Assistance Needed"
                            : "In Processing"}
                        </span>
                      </div>

                      {/* 3-Step Visual Progress Stepper */}
                      <div className="grid grid-cols-3 gap-2 pt-1 pb-1">
                        <div className="flex flex-col items-center text-center">
                          <div className="size-8 rounded-full bg-emerald-500/25 border-2 border-emerald-400 text-emerald-300 flex items-center justify-center mb-1.5 shadow-[0_0_10px_rgba(16,185,129,0.3)]">
                            <CheckCircle2 className="size-4" />
                          </div>
                          <span className="text-[11px] font-bold text-emerald-300">Payment</span>
                          <span className="text-[9px] text-muted-foreground">Received</span>
                        </div>

                        <div className="flex flex-col items-center text-center relative">
                          <div className={`size-8 rounded-full flex items-center justify-center mb-1.5 ${
                            isDelivered
                              ? "bg-emerald-500/25 border-2 border-emerald-400 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                              : isRefunded
                              ? "bg-orange-500/25 border-2 border-orange-400 text-orange-400"
                              : isFailed
                              ? "bg-destructive/25 border-2 border-destructive text-destructive"
                              : "bg-amber-500/25 border-2 border-amber-400 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.35)] animate-pulse"
                          }`}>
                            {isDelivered ? (
                              <CheckCircle2 className="size-4" />
                            ) : (isFailed || isRefunded) ? (
                              <Clock className="size-4 text-destructive" />
                            ) : (
                              <Loader2 className="size-4 animate-spin text-amber-300" />
                            )}
                          </div>
                          <span className={`text-[11px] font-bold ${
                            isDelivered
                              ? "text-emerald-300"
                              : isRefunded
                              ? "text-orange-400"
                              : isFailed
                              ? "text-destructive"
                              : "text-amber-300"
                          }`}>
                            Order
                          </span>
                          <span className="text-[9px] text-muted-foreground">
                            {isRefunded ? "Refunded" : isFailed ? "Queued" : "In Processing"}
                          </span>
                        </div>

                        <div className="flex flex-col items-center text-center">
                          <div className={`size-8 rounded-full flex items-center justify-center mb-1.5 ${
                            isDelivered
                              ? "bg-emerald-500/25 border-2 border-emerald-400 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                              : "bg-muted border border-border text-muted-foreground"
                          }`}>
                            {isDelivered ? (
                              <CheckCircle2 className="size-4" />
                            ) : (
                              <Clock className="size-4" />
                            )}
                          </div>
                          <span className={`text-[11px] font-bold ${isDelivered ? "text-emerald-300" : "text-muted-foreground"}`}>
                            Delivery
                          </span>
                          <span className="text-[9px] text-muted-foreground">
                            {isDelivered ? "Delivered" : "~2-5 min"}
                          </span>
                        </div>
                      </div>

                      <p className="text-xs text-foreground/90 font-medium pt-1.5 border-t border-border/40">
                        {isDelivered
                          ? `Your ${order.capacity}GB bundle has been credited to ${order.recipient_phone}!`
                          : isRefunded
                          ? `This order has been refunded. If you have questions, please contact support.`
                          : isFailed
                          ? `Payment of GH₵ ${Number(order.amount).toFixed(2)} received. The telecom gateway experienced a temporary dispatch delay to ${order.recipient_phone}. Tap Retry Delivery below or contact Support for instant completion.`
                          : `Your order is currently in processing. The telecom gateway is actively dispatching your ${order.capacity}GB to ${order.recipient_phone}. Arrives within ~2 to 5 minutes.`}
                      </p>

                      {!isDelivered && !isRefunded && (
                        <div className="space-y-2 pt-1">
                          <Button
                            onClick={() => checkStatus(false, isFailed)}
                            disabled={verifying}
                            variant="outline"
                            size="sm"
                            className="w-full text-xs font-semibold h-8 border-amber-500/40 text-amber-300 hover:bg-amber-500/20"
                          >
                            {verifying ? (
                              <>
                                <Loader2 className="size-3.5 animate-spin mr-1.5" /> Updating order status…
                              </>
                            ) : isFailed ? (
                              <>
                                <RefreshCw className="size-3.5 mr-1.5" /> Retry Delivery Now
                              </>
                            ) : (
                              <>
                                <RefreshCw className="size-3.5 mr-1.5" /> Refresh Live Status
                              </>
                            )}
                          </Button>

                          {isFailed && (
                            <Button
                              asChild
                              size="sm"
                              className="w-full text-xs font-semibold h-8 bg-emerald-600 hover:bg-emerald-500 text-white"
                            >
                              <a
                                href={`https://wa.me/233547100951?text=${encodeURIComponent(
                                  `Hello Data One! Payment received for order ${order.reference} (Amount: GHS ${Number(order.amount).toFixed(2)}, Phone: ${order.recipient_phone}), but delivery encountered a delay. Kindly help complete delivery.`
                                )}`}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                Chat with Support on WhatsApp (0547100951)
                              </a>
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            ) : order.payment_status === "failed" ? (
              <div className="space-y-2">
                <XCircle className="size-12 mx-auto text-destructive" />
                <h1 className="text-2xl font-bold text-destructive">Payment Failed</h1>
                <p className="text-sm text-muted-foreground">The transaction was not completed.</p>
              </div>
            ) : (
              <div className="space-y-2">
                <Clock className="size-12 mx-auto text-warning animate-pulse" />
                <h1 className="text-2xl font-bold">Confirming payment…</h1>
                <p className="text-sm text-muted-foreground">Awaiting Mobile Money authorization.</p>
              </div>
            )}

            {/* MoMo Approval Prompt Refresh Button */}
            {order.payment_status === "pending" && (
              <div className="my-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-left space-y-2.5">
                <p className="text-xs text-amber-400 font-medium">
                  If you just approved the MoMo prompt on your phone, click below to confirm your payment and start delivery.
                </p>
                <Button
                  onClick={() => checkStatus(false)}
                  disabled={verifying}
                  className="w-full bg-accent text-accent-foreground font-semibold h-10"
                >
                  {verifying ? (
                    <>
                      <Loader2 className="size-4 animate-spin mr-2" /> Checking confirmation…
                    </>
                  ) : (
                    "Check / Refresh Payment Now"
                  )}
                </Button>
              </div>
            )}

            {/* Real Delivery Tracker */}
            <div className="my-3 text-left">
              <DeliveryTracker />
            </div>

            {/* Order Details Table */}
            <div className="mt-4 text-left rounded-lg border p-4 space-y-2 text-sm bg-card/60">
              <div className="flex justify-between items-center gap-3">
                <span className="text-muted-foreground">Reference</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono font-bold">{order.reference}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6 text-muted-foreground hover:text-foreground"
                    onClick={() => handleCopyRef(order.reference)}
                    title="Copy reference"
                  >
                    {copiedRef ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
                  </Button>
                </div>
              </div>
              <Row label="Network" value={NETWORK_LABEL[order.network] || order.network} />
              <Row label="Bundle" value={`${order.capacity}GB`} />
              <Row label="Recipient" value={order.recipient_phone} />
              <Row label="Amount" value={formatGHS(order.amount)} />
              <Row
                label="Payment Status"
                value={
                  order.payment_status === "paid" ? (
                    <span className="font-bold text-emerald-400 uppercase flex items-center gap-1">
                      <CheckCircle2 className="size-3.5 inline text-emerald-400" /> Payment Received
                    </span>
                  ) : order.payment_status === "failed" ? (
                    <span className="font-bold text-destructive uppercase">FAILED</span>
                  ) : (
                    <span className="font-semibold text-amber-400 capitalize">{order.payment_status || "Pending"}</span>
                  )
                }
              />
              <Row
                label="Delivery Status"
                value={
                  order.delivery_status === "delivered" || order.delivery_status === "completed"
                    ? "Delivered"
                    : (order.delivery_status === "failed" || order.delivery_status === "cancelled")
                    ? "Failed"
                    : order.delivery_status === "refunded"
                    ? "Refunded"
                    : (order.delivery_status === "waiting" || order.delivery_status === "pending")
                    ? "Queued for delivery"
                    : "Order is in Processing"
                }
              />
              {order.error_message && (order.payment_status !== "paid" || order.delivery_status === "failed") && (
                <Row label="Note" value={brandText(order.error_message)} />
              )}
            </div>

            {order.payment_status === "paid" && (
              <ApplyReferralPrompt orderReference={order.reference} />
            )}

            <p className="text-xs text-muted-foreground mt-3">Save your reference to track this order any time.</p>
            <div className="flex gap-2 mt-4">
              <Button variant="outline" className="flex-1" asChild>
                <Link to={`/track?ref=${encodeURIComponent(order.reference)}&phone=${encodeURIComponent(order.recipient_phone)}`}>Track order</Link>
              </Button>
              <Button
                className="flex-1 bg-gradient-gold text-accent-foreground hover:opacity-90"
                onClick={() => {
                  if (order?.agent_id) {
                    if (window.history.length > 1) {
                      navigate(-1);
                    } else {
                      navigate("/");
                    }
                  } else {
                    navigate("/");
                  }
                }}
              >
                {order?.agent_id ? "Back to store" : "Back to shop"}
              </Button>
            </div>
          </>
        ) : (
          <div className="space-y-4 py-4">
            <div className="size-12 rounded-full bg-amber-500/20 text-amber-400 mx-auto flex items-center justify-center font-bold">
              <Clock className="size-6 animate-pulse" />
            </div>
            <div className="space-y-1">
              <h1 className="text-xl font-bold text-foreground">Verifying Payment...</h1>
              <p className="text-sm text-muted-foreground">
                Payment reference: <strong className="font-mono text-foreground">{reference}</strong>
              </p>
            </div>
            <div className="p-3 bg-muted/50 rounded-xl text-xs text-muted-foreground">
              Your payment was received and your bundle is processing. Save your reference code to track it anytime.
            </div>
            <div className="flex flex-col gap-2 pt-2">
              <Button
                onClick={() => checkStatus(false)}
                disabled={verifying}
                className="w-full bg-gradient-gold text-slate-950 font-bold"
              >
                {verifying ? <Loader2 className="size-4 animate-spin mr-2" /> : <RefreshCw className="size-4 mr-2" />}
                Refresh Order Status
              </Button>
              <Button variant="outline" className="w-full" asChild>
                <a
                  href={`https://wa.me/233547100951?text=${encodeURIComponent(
                    `Hello Data 1 GH! I completed payment for order ${reference}, kindly confirm my delivery.`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Contact Support on WhatsApp (0547100951)
                </a>
              </Button>
              <Button variant="ghost" className="w-full text-xs" onClick={() => navigate("/")}>
                Back to Shop
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex justify-between items-center gap-3">
    <span className="text-muted-foreground">{label}</span>
    <span className="font-medium text-right break-all">{value}</span>
  </div>
);

export default PaymentCallback;
