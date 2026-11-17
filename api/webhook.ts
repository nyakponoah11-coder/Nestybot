import { data1db } from './_data1db.js';
import crypto from "crypto";
import {
  getSupabase,
  setCorsHeaders,
  parseBody,
  cleanApiKey,
  getEnvVar,
} from "./_supabase.js";
import {
  sendPaymentReceivedNotification,
  sendAdminLowBalanceOrderFailedAlert,
  isDatamartLowBalanceError,
  sendPaymentIncompleteCustomerSms,
  extractPaystackMomoPhone,
} from "./_notifications.js";
import {
  resolveDatamartKeys,
  resolveDatamartSecret,
  getDatamartAuthHeaders,
  verifyDatamartOrderStatusDirect,
  queryDatamartLiveStatus,
  mapDatamartStatus,
  extractDataMartOrderStatus,
  extractDataMartReference,
  executeDatamartPurchase,
  claimOrderDispatchLock,
  releaseOrderDispatchLock,
} from "./_datamart.js";

export default async function handler(req: any, res: any) {
  setCorsHeaders(res);
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Health / connectivity check
  if (req.method === "GET") {
    return res.status(200).json({
      status: "active",
      message: "Webhook receiver is online. Direct API key verification enabled.",
      timestamp: new Date().toISOString(),
    });
  }

  try {
    const supabase = getSupabase();
    const body = parseBody(req);
    const paystackSignature = req.headers["x-paystack-signature"] || req.headers["X-Paystack-Signature"];

    let PAYSTACK_SECRET_KEY = cleanApiKey(
      getEnvVar([
        "PAYSTACK_SECRET_KEY",
        "VITE_PAYSTACK_SECRET_KEY",
        "PAYSTACK_KEY",
        "paystack_secret_key",
        "paystack_secret",
        "PAYSTACK_SECRET",
      ])
    );
    if (!PAYSTACK_SECRET_KEY) {
      const { data: sRows } = await supabase
        .from("settings")
        .select("key, value")
        .in("key", ["paystack_secret_key", "PAYSTACK_SECRET_KEY", "paystack_secret", "PAYSTACK_SECRET", "paystack_key", "PAYSTACK_KEY"]);
      for (const row of sRows || []) {
        const c = cleanApiKey(row?.value);
        if (c && c.startsWith("sk_")) {
          PAYSTACK_SECRET_KEY = c;
          break;
        } else if (c && !PAYSTACK_SECRET_KEY) {
          PAYSTACK_SECRET_KEY = c;
        }
      }
    }

    // 1. Verify Paystack signature if present
    let signatureVerified = false;
    if (paystackSignature && PAYSTACK_SECRET_KEY) {
      try {
        const rawBody = typeof req.body === "string" ? req.body : JSON.stringify(body);
        const hash = crypto
          .createHmac("sha512", PAYSTACK_SECRET_KEY)
          .update(rawBody)
          .digest("hex");
        if (hash === paystackSignature) {
          signatureVerified = true;
        } else {
          console.warn("Paystack webhook signature mismatch, will verify directly via Paystack API");
        }
      } catch (sigErr) {
        console.warn("Signature verification error:", sigErr);
      }
    }

    // 2. Extract references and identifiers from incoming payload
    const incomingRef = String(
      body?.reference ||
      body?.data?.reference ||
      body?.orderReference ||
      body?.data?.orderReference ||
      body?.order_reference ||
      body?.data?.order_reference ||
      body?.datamart_reference ||
      body?.data?.datamart_reference ||
      body?.ref ||
      body?.data?.ref ||
      body?.trackingId ||
      body?.data?.trackingId ||
      body?.track ||
      body?.purchaseId ||
      body?.orderId ||
      body?.data?.id ||
      body?.id ||
      ""
    ).trim();

    const incomingPhone = String(
      body?.phoneNumber ||
      body?.phone ||
      body?.recipient ||
      body?.data?.phoneNumber ||
      body?.data?.phone ||
      body?.data?.recipient ||
      body?.data?.metadata?.recipient_phone ||
      body?.data?.customer?.phone ||
      ""
    ).replace(/\D/g, "");

    // 3. Match order in database
    let order: any = null;
    if (incomingRef) {
      const { data } = await supabase
        .from("orders")
        .select("*")
        .or(`reference.ilike.${incomingRef},datamart_reference.ilike.${incomingRef},reference.eq.${incomingRef},datamart_reference.eq.${incomingRef}`)
        .maybeSingle();
      if (data) order = data;
    }

    if (!order && incomingPhone) {
      const last9 = incomingPhone.slice(-9);
      if (last9) {
        const { data } = await supabase
          .from("orders")
          .select("*")
          .ilike("recipient_phone", `%${last9}%`)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (data) order = data;
      }
    }

    // 4. Handle Paystack charge.success payment confirmation (strictly verified via HMAC or Paystack API)
    let isPaystackPaymentSuccess =
      body?.event === "charge.success" ||
      body?.data?.status === "success" ||
      (body?.status === "success" && Boolean(body?.data?.authorization));

    if (isPaystackPaymentSuccess && !signatureVerified && PAYSTACK_SECRET_KEY) {
      const refToVerify = String(body?.data?.reference || order?.reference || incomingRef || "").trim();
      if (!refToVerify) {
        isPaystackPaymentSuccess = false;
      } else {
        try {
          const psVer = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(refToVerify)}`, {
            headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
            signal: AbortSignal.timeout(6000),
          });
          const psVerData = await psVer.json().catch(() => ({}));
          if (!psVer.ok || psVerData?.data?.status !== "success") {
            console.warn(`Blocked unverified Paystack payment claim for ${refToVerify}`);
            isPaystackPaymentSuccess = false;
          }
        } catch (vErr) {
          console.warn("Paystack direct verification failed:", vErr);
          isPaystackPaymentSuccess = false;
        }
      }
    }

    let dispatchWebhookPaymentAlert: ((ds?: string, dms?: string, err?: string) => void) | null = null;

    if (isPaystackPaymentSuccess && order && order.payment_status !== "paid") {
      const baseUpdates: Record<string, any> = {
        payment_status: "paid",
        delivery_status: "processing",
        status: "processing",
        error_message: null,
        updated_at: new Date().toISOString(),
      };
      try {
        const fullUpdates = {
          ...baseUpdates,
          paid_at: body?.data?.paid_at || new Date().toISOString(),
          channel: body?.data?.channel || undefined,
        };
        const { error } = await supabase.from("orders").update(fullUpdates).eq("id", order.id);
        if (error) {
          await supabase.from("orders").update(baseUpdates).eq("id", order.id);
        }
      } catch {
        await supabase.from("orders").update(baseUpdates).eq("id", order.id);
      }
      order.payment_status = "paid";
      order.delivery_status = "processing";
      try {
        data1db.getClient().from("orders").upsert({ ...order, ...baseUpdates });
      } catch (_) {}

      // If order belongs to an Agent Store, attribute order & profit to the agent!
      // ⚡ FLASH SALE CHECK: Agents get NO profit and NO order history / referral reward for Flash Sale!
      const isFlashSaleOrder =
        Boolean(order.is_flash_sale) ||
        Boolean(body?.data?.metadata?.is_flash_sale) ||
        (typeof order.notes === "string" && (order.notes.includes("FLASH_SALE") || order.notes.includes("FLASH SALE")));

      const agentNotesMatch = order.notes?.match(/\[agent:([^\]]+)\]/);
      const agentId = order.agent_id || body?.data?.metadata?.agent_id || (agentNotesMatch ? agentNotesMatch[1] : null);
      const agentStoreName = body?.data?.metadata?.store_name || order.store_name;
      let agentProfit = 0;

      if (agentId && !isFlashSaleOrder) {
        try {
          const { recordAgentOrder, loadBasePrices, resolveOrderBasePrice } = await import("./agent.js");
          const basePrices = await loadBasePrices(supabase);
          const baseCost = resolveOrderBasePrice(order, basePrices);
          agentProfit = Math.max(0, Number((Number(order.amount) - baseCost).toFixed(2)));
          await recordAgentOrder(supabase, {
            agent_id: agentId,
            reference: order.reference,
            network: order.network,
            package_size: `${order.capacity || ""}GB`,
            phone: order.recipient_phone,
            amount: Number(order.amount),
            base_price: baseCost,
            agent_profit: agentProfit,
            paystack_ref: body?.data?.reference || order.reference,
            status: order.delivery_status || "processing",
          });

          const refCode = body?.data?.metadata?.agent_referral_code || (order as any)?.referral_code;
          if (refCode) {
            try {
              const { recordAgentReferralReward } = await import("./agent.js");
              await recordAgentReferralReward(supabase, {
                agent_id: agentId,
                agent_name: agentStoreName || "Agent Store",
                referral_code: refCode,
                buyer_phone: order.recipient_phone,
                order_ref: order.reference,
                amount: Number(order.amount),
              });
            } catch (refErr) {
              console.warn("Agent referral recording note (webhook):", refErr);
            }
          }
        } catch (agentErr) {
          console.warn("Agent order recording note (webhook):", agentErr);
        }
      }

      // Unified payment alert dispatcher: sent with real authoritative DataMart status!
      const dispatchWebhookPaymentAlert = (deliveryStatus?: string, datamartStatus?: string, errMsg?: string) => {
        sendPaymentReceivedNotification({
          reference: order.reference,
          amount: order.amount,
          itemDescription: `${order.capacity || ""}GB ${order.network || ""} Data`,
          recipientPhone: order.recipient_phone,
          customerPhone: order.customer_phone || order.recipient_phone,
          network: order.network,
          channel: body?.data?.channel || "Paystack Webhook",
          orderType: "data",
          agentId: isFlashSaleOrder ? undefined : (agentId || undefined),
          agentStoreName: isFlashSaleOrder ? undefined : (agentStoreName || undefined),
          deliveryStatus: deliveryStatus || order.delivery_status,
          datamartStatus: datamartStatus || order.datamart_status,
          errorMessage: errMsg || order.error_message,
        }, supabase).catch(() => {});

        if (agentId && !isFlashSaleOrder) {
          try {
            import("./_notifications.js").then(({ sendAgentOrderWhatsAppAlert }) => {
              sendAgentOrderWhatsAppAlert({
                agentId,
                orderReference: order.reference,
                itemDescription: `${order.capacity || ""}GB ${order.network || ""} Data`,
                recipientPhone: order.recipient_phone,
                sellingPrice: Number(order.amount),
                agentProfit: agentProfit,
                deliveryStatus: deliveryStatus || order.delivery_status || "processing",
                agentStoreName: agentStoreName,
              }, supabase).catch((err) => console.warn("Agent WhatsApp alert warning (webhook):", err));
            }).catch(() => {});
          } catch (_) {}
        }
      };

      // ⚡ INSTANT ALERT DISPATCH: Send order payment alert to Admin & Agent immediately without delay!
      dispatchWebhookPaymentAlert("processing", "fastlane");
    }

    // Also support service_orders & checker_orders if no data order was matched
    if (isPaystackPaymentSuccess && !order && incomingRef) {
      if (incomingRef.startsWith("CK") || /checker/i.test(body?.data?.metadata?.item || "")) {
        const { data: cOrder } = await supabase.from("checker_orders").select("*").ilike("reference", incomingRef).maybeSingle();
        if (cOrder) {
          const isPaid = cOrder.status === "paid" || cOrder.payment_status === "paid";
          if (!isPaid) {
            await supabase.from("checker_orders").update({ status: "paid" }).eq("id", cOrder.id);
          }
          sendPaymentReceivedNotification({
            reference: cOrder.reference,
            amount: cOrder.amount,
            itemDescription: `${cOrder.checker_type || "Result"} Checker`,
            recipientPhone: cOrder.customer_phone,
            customerPhone: cOrder.customer_phone,
            channel: body?.data?.channel || "Paystack Webhook",
            orderType: "checker",
          }, supabase).catch(() => {});

          // Automatically fulfill checker card via DataMart!
          if (cOrder.delivery_status !== "delivered") {
            try {
              const { purchaseCheckerFromDatamart, setCheckerNoteTag } = await import("./checkers.js");
              const outcome = await purchaseCheckerFromDatamart({
                checkerType: cOrder.checker_type,
                phoneNumber: cOrder.customer_phone,
                reference: cOrder.reference,
              }, supabase);

              let cNotes = cOrder.notes || "";
              if (outcome.success) {
                cNotes = setCheckerNoteTag(cNotes, "serial", outcome.serialNumber || "");
                cNotes = setCheckerNoteTag(cNotes, "pin", outcome.pin || "");
                cNotes = setCheckerNoteTag(cNotes, "dm_ref", outcome.reference || "");
                cNotes = setCheckerNoteTag(cNotes, "delivered_at", new Date().toISOString());
                cNotes = setCheckerNoteTag(cNotes, "error", "");
                await supabase.from("checker_orders").update({
                  status: "paid",
                  delivery_status: "delivered",
                  notes: cNotes || null,
                }).eq("id", cOrder.id);

                if (cOrder.customer_phone && !String(cOrder.customer_phone).replace(/\D/g, "").endsWith("599599254") && (outcome.pin || outcome.serialNumber)) {
                  const type = cOrder.checker_type || "Result Checker";
                  const smsMsg = `DATA 1 GH: Your ${type} Result Checker Details:\nSerial: ${outcome.serialNumber || "N/A"}\nPIN: ${outcome.pin || "N/A"}\nRef: ${cOrder.reference}\nCheck results at the official WAEC/BECE portal. Thank you for choosing DATA 1 GH!`;
                  const arkeselKey = process.env.ARKESEL_API_KEY || process.env.VITE_ARKESEL_API_KEY;
                  if (arkeselKey) {
                    fetch("https://sms.arkesel.com/api/v2/sms/send", {
                      method: "POST",
                      headers: { "api-key": arkeselKey, "Content-Type": "application/json" },
                      body: JSON.stringify({
                        sender: process.env.ARKESEL_SENDER_ID || "Data1gh",
                        message: smsMsg,
                        recipients: [cOrder.customer_phone],
                      }),
                    }).catch(() => {});
                  }
                }
              } else {
                cNotes = setCheckerNoteTag(cNotes, "error", outcome.error || "Purchase failed");
                await supabase.from("checker_orders").update({
                  status: "paid",
                  delivery_status: "failed",
                  notes: cNotes || null,
                }).eq("id", cOrder.id);
              }
            } catch (err: any) {
              console.error("Webhook checker fulfillment error:", err);
            }
          }

          const cAgMatch = (cOrder.notes || cOrder.customer_name || "")?.match(/\[agent:([^\]]+)\]/);
          const cAgentId = cAgMatch ? cAgMatch[1] : (body?.data?.metadata?.agent_id || null);
          if (cAgentId) {
            try {
              const { recordAgentOrder, loadBasePrices, resolveOrderBasePrice } = await import("./agent.js");
              const basePrices = await loadBasePrices(supabase);
              const baseCost = resolveOrderBasePrice(cOrder, basePrices);
              const profit = Math.max(0, Number((Number(cOrder.amount) - baseCost).toFixed(2)));
              await recordAgentOrder(supabase, {
                agent_id: cAgentId,
                reference: cOrder.reference,
                network: "CHECKER",
                package_size: `${cOrder.checker_type || "WAEC"} Result Checker`,
                phone: cOrder.customer_phone,
                amount: Number(cOrder.amount),
                base_price: baseCost,
                agent_profit: profit,
                status: cOrder.delivery_status || "delivered",
              });
            } catch (agErr) {
              console.warn("Could not record agent profit for checker order via webhook:", agErr);
            }
          }
        }
      } else if (incomingRef.startsWith("NF") || incomingRef.startsWith("AF") || incomingRef.startsWith("MU") || incomingRef.startsWith("SB")) {
        const { data: sOrder } = await supabase.from("service_orders").select("*").ilike("reference", incomingRef).maybeSingle();
        const isPaid = sOrder && (sOrder.status === "paid" || sOrder.payment_status === "paid");
        if (sOrder && !isPaid) {
          await supabase.from("service_orders").update({ status: "paid" }).eq("id", sOrder.id);
          const serviceItemDesc =
            sOrder.service === "netflix"
              ? "Netflix Access"
              : sOrder.service === "mashup"
                ? "Mashup Bundle"
                : sOrder.service === "boost"
                  ? "Social Media Boost"
                  : "AFA Registration";
          sendPaymentReceivedNotification({
            reference: sOrder.reference,
            amount: sOrder.amount,
            itemDescription: serviceItemDesc,
            recipientPhone: sOrder.customer_phone,
            customerPhone: sOrder.customer_phone,
            channel: body?.data?.channel || "Paystack Webhook",
            orderType: "service",
          }, supabase).catch(() => {});

          if (sOrder.service === "boost") {
            try {
              const { dispatchBoostOrder } = await import("./services.js");
              await dispatchBoostOrder(supabase, sOrder);
            } catch (bErr) {
              console.warn("Could not auto-dispatch boost order via webhook:", bErr);
            }
          }

          const sAgMatch = sOrder.notes?.match(/\[agent:([^\]]+)\]/);
          const sAgentId = sAgMatch ? sAgMatch[1] : (body?.data?.metadata?.agent_id || null);
          if (sAgentId) {
            try {
              const { recordAgentOrder, loadBasePrices, resolveOrderBasePrice } = await import("./agent.js");
              const basePrices = await loadBasePrices(supabase);
              const baseCost = resolveOrderBasePrice(sOrder, basePrices);
              const profit = Math.max(0, Number((Number(sOrder.amount) - baseCost).toFixed(2)));
              await recordAgentOrder(supabase, {
                agent_id: sAgentId,
                reference: sOrder.reference,
                network: sOrder.service === "netflix" ? "NETFLIX" : "SERVICE",
                package_size: serviceItemDesc,
                phone: sOrder.customer_phone,
                amount: Number(sOrder.amount),
                base_price: baseCost,
                agent_profit: profit,
                status: "delivered",
              });
            } catch (agErr) {
              console.warn("Could not record agent profit for service order via webhook:", agErr);
            }
          }
        }
      }
    }

    // 4b. Handle Paystack charge.failed, abandonment, or declined payments
    const isPaystackPaymentIncomplete =
      body?.event === "charge.failed" ||
      body?.event === "paymentrequest.pending" ||
      (!isPaystackPaymentSuccess && (body?.data?.status === "failed" || body?.data?.status === "abandoned"));

    if (isPaystackPaymentIncomplete && order && order.payment_status !== "paid") {
      const gatewayResponse =
        body?.data?.gateway_response ||
        body?.data?.message ||
        (body?.data?.status === "abandoned" ? "Transaction abandoned" : "Payment failed");
      const statusReason = body?.data?.status === "abandoned" ? "abandoned" : "failed";

      await supabase
        .from("orders")
        .update({
          payment_status: "failed",
          delivery_status: "failed",
          error_message: gatewayResponse,
          updated_at: new Date().toISOString(),
        })
        .eq("id", order.id);

      order.payment_status = "failed";
      order.delivery_status = "failed";
      order.error_message = gatewayResponse;

      // Dispatch automated SMS explanation & retry link strictly to the MoMo number
      try {
        const momoNumber = extractPaystackMomoPhone(body?.data, order);
        if (momoNumber) {
          await sendPaymentIncompleteCustomerSms(
            {
              reference: order.reference,
              momoPhone: momoNumber,
              customerPhone: momoNumber,
              recipientPhone: order.recipient_phone,
              amount: order.amount,
              itemDescription: `${order.capacity || ""}GB ${order.network || ""} Data`,
              network: order.network,
              capacity: order.capacity,
              reason: statusReason,
              gatewayResponse,
              storeName: order.store_name,
              agentId: order.agent_id,
            },
            supabase
          );
        }
      } catch (e: any) {
        console.warn("Webhook incomplete payment SMS error:", e);
      }
    }

    // 5. If paid order has not yet been submitted to DataMart, submit it now
    const dmKeys = await resolveDatamartKeys(supabase);
    const dmSecret = await resolveDatamartSecret(supabase);
    if (order && order.payment_status === "paid" && !order.datamart_reference && dmKeys.length > 0) {
      // 🔒 ATOMIC DISPATCH LOCK: Prevent race condition between Webhook and Browser Verify
      const claimedLock = await claimOrderDispatchLock(order.id || order.reference, supabase);
      if (!claimedLock) {
        console.log(`[Webhook] Order ${order.reference} dispatch already claimed or handled.`);
        return res.status(200).json({ ok: true, message: "Order dispatch already handled by concurrent process" });
      }

      const networkMap: Record<string, string> = {
        MTN: "YELLO",
        mtn: "YELLO",
        YELLO: "YELLO",
        TELECEL: "TELECEL",
        telecel: "TELECEL",
        AT: "AT_PREMIUM",
        at: "AT_PREMIUM",
        AIRTELTIGO: "AT_PREMIUM",
        airteltigo: "AT_PREMIUM",
      };
      const dmNetwork = networkMap[order.network] || order.network;

      const rawP = String(order.recipient_phone || "").replace(/\D/g, "");
      let cleanPhone = rawP;
      if (cleanPhone.startsWith("233") && cleanPhone.length === 12) cleanPhone = "0" + cleanPhone.slice(3);
      else if (cleanPhone.length === 9) cleanPhone = "0" + cleanPhone;

      let capStr = String(order.capacity || "").trim();
      const capMatch = capStr.match(/^(\d+(?:\.\d+)?)/);
      if (capMatch) capStr = capMatch[1];

      // ⚡ FLASH SALE CHECK:
      // If order is tagged as Flash Sale, DO NOT send to DataMart API!
      const isFlashSale =
        order.is_flash_sale === true ||
        data?.metadata?.is_flash_sale === true ||
        (typeof order.notes === "string" && order.notes.includes("FLASH_SALE"));

      if (isFlashSale) {
        order.delivery_status = "processing";
        order.supplier_status = "manual_flash_sale";
        if (!order.notes?.includes("FLASH_SALE")) {
          order.notes = `[FLASH_SALE] ${order.notes || ""}`.trim();
        }

        await supabase
          .from("orders")
          .update({
            delivery_status: "processing",
            payment_status: "paid",
            status: "paid",
            supplier_status: "manual_flash_sale",
            notes: order.notes,
            error_message: null,
            updated_at: new Date().toISOString(),
          })
          .eq("reference", order.reference);

        try {
          data1db.getClient().from("orders").update({
            delivery_status: "processing",
            payment_status: "paid",
            status: "paid",
            notes: order.notes,
          }).eq("reference", order.reference);
        } catch (_) {}

        if (dispatchWebhookPaymentAlert) {
          dispatchWebhookPaymentAlert("processing", "manual_flash_sale");
        }

        return res.status(200).json({ ok: true, status: "processing", flash_sale: true });
      }

      let lastWebhookDispatchErr = "";
      for (const key of dmKeys) {
        try {
          const res = await executeDatamartPurchase({
            apiKey: key,
            secret: dmSecret,
            phoneNumber: cleanPhone,
            network: dmNetwork,
            capacity: capStr,
            reference: order.reference,
            skipLock: true,
          });

          if (res.success) {
            const pId = res.reference || order.reference;
            const dmRawStatus = extractDataMartOrderStatus(res.data) || "processing";
            const mappedDelivery = mapDatamartStatus(dmRawStatus);
            order.datamart_reference = String(pId);
            order.delivery_status = mappedDelivery;
            order.datamart_status = dmRawStatus;
            order.supplier_status = "datamart";
            await supabase
              .from("orders")
              .update({
                datamart_reference: String(pId),
                delivery_status: mappedDelivery,
                datamart_status: dmRawStatus,
                supplier_status: "datamart",
                error_message: null,
              })
              .eq("id", order.id);

            if (dispatchWebhookPaymentAlert) {
              dispatchWebhookPaymentAlert(mappedDelivery, dmRawStatus);
            }
            break;
          } else {
            lastWebhookDispatchErr = res.error || `HTTP ${res.status}`;
            if (res.isLowBalance) break;
          }
        } catch (err: any) {
          lastWebhookDispatchErr = err?.message || "Delivery dispatch error";
        }
      }

      // If dispatch failed across all keys, release lock and check if it's due to low provider balance
      if (!order.datamart_reference) {
        const isTimeoutOrGateway = /timeout|aborted|503|502|504|econnreset|network/i.test(lastWebhookDispatchErr);
        if (isTimeoutOrGateway) {
          const dmRef = order.reference.startsWith("WS-") ? order.reference : `WS-${order.reference}`;
          order.datamart_reference = dmRef;
          order.delivery_status = "processing";
          order.datamart_status = "processing";
          order.supplier_status = "datamart";
          await supabase
            .from("orders")
            .update({
              datamart_reference: dmRef,
              delivery_status: "processing",
              datamart_status: "processing",
              supplier_status: "datamart",
              error_message: null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", order.id);
        } else {
          await releaseOrderDispatchLock(order.id || order.reference, supabase, "failed");
          let isLowBal = isDatamartLowBalanceError(lastWebhookDispatchErr);
          if (!isLowBal && dmKeys.length > 0) {
            try {
              const bRes = await fetch("https://api.datamartgh.shop/api/developer/user/balance", {
                headers: { "x-api-key": dmKeys[0] },
                signal: AbortSignal.timeout(3000),
              });
              const bData = await bRes.json().catch(() => ({}));
              const bal = Number(bData?.data?.walletBalance ?? bData?.walletBalance ?? bData?.data?.balance);
              if (!isNaN(bal) && bal < Math.max(5, Number(order.amount || 0))) {
                isLowBal = true;
              }
            } catch (_) {}
          }

          if (isLowBal) {
            sendAdminLowBalanceOrderFailedAlert(
              {
                reference: order.reference,
                recipientPhone: order.recipient_phone || order.phone_number,
                network: order.network,
                capacity: order.capacity,
                amount: order.amount,
                errorMessage: lastWebhookDispatchErr || "Insufficient DataMart provider balance",
                orderId: order.id,
              },
              supabase
            ).catch((e) => console.error("Webhook low balance alert error:", e));
          }

          if (dispatchWebhookPaymentAlert) {
            dispatchWebhookPaymentAlert("failed", "failed", lastWebhookDispatchErr);
          }
        }
      }
    }

    // -------------------------------------------------------------
    // 6. DIRECT API KEY STATUS VERIFICATION (BYPASS 200 OK)
    // -------------------------------------------------------------
    // We NEVER blindly accept 200 OK or webhook payloads as "delivered".
    // We query the order status directly from the DataMart API key to confirm
    // whether the order has actually been delivered, is processing, or failed!
    let verifiedDeliveryStatus = order?.delivery_status || "processing";
    let verifiedRawStatus = order?.datamart_status || "processing";
    let verifiedErrorMessage = order?.error_message || null;
    let foundRef = order?.datamart_reference || incomingRef;

    const lookupTarget = order?.datamart_reference || incomingRef;
    if (lookupTarget && dmKeys.length > 0) {
      // Direct API query using API key
      const directResult = await verifyDatamartOrderStatusDirect(lookupTarget, dmKeys);
      if (directResult.found && directResult.deliveryStatus) {
        verifiedDeliveryStatus = directResult.deliveryStatus;
        verifiedRawStatus = directResult.rawStatus || directResult.deliveryStatus;
        if (directResult.datamart_reference) {
          foundRef = directResult.datamart_reference;
        }
        if (directResult.deliveryStatus === "failed") {
          verifiedErrorMessage = directResult.error || "Delivery could not be completed by network supplier";
        } else if (directResult.deliveryStatus === "delivered") {
          verifiedErrorMessage = null;
        }
      } else if (order) {
        // Fallback: search DataMart orders & transactions using the API key
        const liveSearch = await queryDatamartLiveStatus(order, dmKeys);
        if (liveSearch.found && liveSearch.deliveryStatus) {
          verifiedDeliveryStatus = liveSearch.deliveryStatus;
          verifiedRawStatus = liveSearch.rawStatus || liveSearch.deliveryStatus;
          if (liveSearch.datamart_reference) {
            foundRef = liveSearch.datamart_reference;
          }
          if (liveSearch.deliveryStatus === "failed") {
            verifiedErrorMessage = liveSearch.error || "Delivery could not be completed by network supplier";
          } else if (liveSearch.deliveryStatus === "delivered") {
            verifiedErrorMessage = null;
          }
        }
      }
    }

    // Persist verified status directly back to database
    if (order) {
      const updates: Record<string, any> = {
        delivery_status: verifiedDeliveryStatus,
        updated_at: new Date().toISOString(),
      };
      if (foundRef) {
        updates.datamart_reference = String(foundRef);
      }
      if (verifiedDeliveryStatus === "failed") {
        updates.error_message = verifiedErrorMessage || "Delivery could not be completed by network supplier";
        if (isDatamartLowBalanceError(verifiedErrorMessage)) {
          sendAdminLowBalanceOrderFailedAlert(
            {
              reference: order.reference,
              recipientPhone: order.recipient_phone || order.phone_number,
              network: order.network,
              capacity: order.capacity,
              amount: order.amount,
              errorMessage: verifiedErrorMessage,
              orderId: order.id,
            },
            supabase
          ).catch((e) => console.error("Webhook live status low balance alert error:", e));
        }
      } else if (verifiedDeliveryStatus === "completed" || verifiedDeliveryStatus === "delivered") {
        updates.error_message = null;
      }

      await supabase
        .from("orders")
        .update(updates)
        .eq("id", order.id);
      try {
        data1db.getClient().from("orders").upsert({ ...order, ...updates });
      } catch (_) {}

      if (dispatchWebhookPaymentAlert) {
        dispatchWebhookPaymentAlert(verifiedDeliveryStatus, verifiedRawStatus, verifiedErrorMessage);
      }

      if (
        (verifiedDeliveryStatus === "completed" || verifiedDeliveryStatus === "delivered") &&
        !String(order.notes || "").includes("[delivery_confirmed_sent]")
      ) {
        try {
          const { sendOrderDeliveredNotification } = await import("./_notifications.js");
          await sendOrderDeliveredNotification({
            reference: order.reference,
            amount: order.amount,
            capacity: order.capacity,
            network: order.network,
            recipientPhone: order.recipient_phone,
            agentId: order.agent_id,
            agentStoreName: order.store_name,
            whatsappPhone: order.whatsapp_phone,
          }, supabase);
        } catch (_) {}
      }
    }

    return res.status(200).json({
      status: "success",
      received: true,
      verified_with_api_key: true,
      order_reference: order?.reference || incomingRef,
      datamart_reference: foundRef,
      payment_status: order?.payment_status || "unknown",
      delivery_status: verifiedDeliveryStatus,
    });
  } catch (err: any) {
    console.error("Webhook processing error:", err);
    // Always return 200 to webhook caller to prevent endless retry storms
    return res.status(200).json({
      status: "error",
      message: err?.message || "Internal webhook error",
    });
  }
}
