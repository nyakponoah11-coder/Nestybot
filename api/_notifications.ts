import { getSupabase, cleanApiKey, getEnvVar, getCachedSettings, data1db } from "./_supabase.js";

// In-memory set to prevent duplicate SMS/WhatsApp notifications for the same order reference
const notifiedReferences = new Set<string>();

function normalizePhone(raw: string): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("233") && digits.length === 12) return digits;
  if (digits.startsWith("0") && digits.length === 10) return `233${digits.slice(1)}`;
  if (digits.length === 9) return `233${digits}`;
  if (digits.length >= 10 && digits.length <= 15) return digits;
  return null;
}

function formatPhoneForArkesel(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("2330") && digits.length === 13) return "233" + digits.slice(4);
  if (digits.startsWith("233") && digits.length === 12) return digits;
  if (digits.startsWith("0") && digits.length === 10) return "233" + digits.slice(1);
  if (digits.length === 9) return "233" + digits;
  return digits;
}

function formatPhoneForWhatsApp(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("0") && digits.length === 10) return "233" + digits.slice(1);
  if (digits.length === 9) return "233" + digits;
  return digits;
}

// Owner instruction:
// 1. All Admin SMS alerts are BLOCKED per owner instruction.
// 2. WhatsApp order alerts go to 0547100951 (normalized: 233547100951)
export const ADMIN_PRIMARY_SMS_PHONE = "0592753424";
export const ADMIN_WHATSAPP_ONLY_PHONE = "233547100951";

export function isBlockedFromAdminSms(raw: string): boolean {
  if (!raw) return true;
  return false;
}

export interface PaymentNotificationParams {
  reference: string;
  amount: number | string;
  itemDescription: string;
  recipientPhone?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  network?: string | null;
  channel?: string | null;
  orderType?: "data" | "netflix" | "afa" | "mashup" | "checker" | "service";
  isTest?: boolean;
  onlyWhatsApp?: boolean;
  onlySms?: boolean;
  adminWhatsAppNumber?: string | null;
  whatsappAccessToken?: string | null;
  whatsappPhoneId?: string | null;
  agentId?: string | null;
  agentStoreName?: string | null;
  storeName?: string | null;
  shopName?: string | null;
  deliveryStatus?: string | null;
  datamartStatus?: string | null;
  errorMessage?: string | null;
}

/**
 * Formats the real-time delivery status for WhatsApp notifications
 * directly reflecting authoritative DataMart / supplier responses.
 */
export function formatRealDeliveryStatus(
  deliveryStatus?: string | null,
  datamartStatus?: string | null,
  errorMessage?: string | null,
  orderType?: string | null
): { emoji: string; text: string; fullLine: string } {
  const ds = (deliveryStatus || "").toLowerCase().trim();
  const dms = (datamartStatus || "").toLowerCase().trim();
  const err = (errorMessage || "").trim();

  // 1. Manual Flash Sale Tagging
  if (dms === "manual_flash_sale" || ds === "manual_flash_sale") {
    return {
      emoji: "⚡",
      text: "Flash Sale (Manual Processing)",
      fullLine: "⚡ *Delivery Status:* Flash Sale (Manual Processing)",
    };
  }

  // 2. Result Checker Cards
  if (orderType === "checker") {
    if (ds === "delivered" || dms === "completed" || dms === "delivered") {
      return {
        emoji: "✅",
        text: "Delivered / PIN Generated",
        fullLine: "✅ *Delivery Status:* Delivered / PIN Generated",
      };
    }
    if (ds === "failed" || dms === "failed") {
      const reason = err ? ` (${err.slice(0, 30)})` : "";
      return {
        emoji: "❌",
        text: `Generation Failed${reason}`,
        fullLine: `❌ *Delivery Status:* Generation Failed${reason}`,
      };
    }
    return {
      emoji: "⏳",
      text: "Processing",
      fullLine: "⏳ *Delivery Status:* Processing",
    };
  }

  // 3. Digital Services (Netflix, AFA, Mashup)
  if (orderType === "netflix" || orderType === "afa" || orderType === "mashup" || orderType === "service") {
    if (ds === "delivered" || dms === "completed" || dms === "delivered") {
      return {
        emoji: "✅",
        text: "Fulfilled / Active",
        fullLine: "✅ *Delivery Status:* Fulfilled / Active",
      };
    }
    if (ds === "failed") {
      const reason = err ? ` (${err.slice(0, 30)})` : "";
      return {
        emoji: "❌",
        text: `Failed${reason}`,
        fullLine: `❌ *Delivery Status:* Failed${reason}`,
      };
    }
    return {
      emoji: "⏳",
      text: "Processing",
      fullLine: "⏳ *Delivery Status:* Processing",
    };
  }

  // 4. Live Telecom Delivery Status (Customer/Agent facing — No provider branding)
  if (
    ds === "delivered" ||
    dms === "delivered" ||
    dms === "completed" ||
    dms === "fulfilled" ||
    dms === "successful" ||
    dms === "success"
  ) {
    return {
      emoji: "✅",
      text: "Delivered to Phone",
      fullLine: "✅ *Delivery Status:* Delivered to Phone",
    };
  }

  if (
    ds === "failed" ||
    dms === "failed" ||
    dms === "failure" ||
    dms === "rejected" ||
    dms === "declined"
  ) {
    const reason = err ? `: ${err.slice(0, 40)}` : "";
    return {
      emoji: "❌",
      text: `Delivery Failed${reason}`,
      fullLine: `❌ *Delivery Status:* Delivery Failed${reason}`,
    };
  }

  if (ds === "waiting" || dms === "waiting" || dms === "queued" || dms === "pending") {
    return {
      emoji: "⏳",
      text: "Queued in Gateway",
      fullLine: "⏳ *Delivery Status:* Queued in Gateway",
    };
  }

  if (
    ds === "processing" ||
    dms === "processing" ||
    dms === "in_progress" ||
    dms === "in-progress" ||
    dms === "sent"
  ) {
    return {
      emoji: "⏳",
      text: "Processing in FastLane",
      fullLine: "⏳ *Delivery Status:* Processing in FastLane",
    };
  }

  if (dms) {
    const titled = dms.charAt(0).toUpperCase() + dms.slice(1);
    return {
      emoji: "⚡",
      text: titled,
      fullLine: `⚡ *Delivery Status:* ${titled}`,
    };
  }

  if (ds) {
    const titled = ds.charAt(0).toUpperCase() + ds.slice(1);
    return {
      emoji: "⚡",
      text: titled,
      fullLine: `⚡ *Delivery Status:* ${titled}`,
    };
  }

  return {
    emoji: "⏳",
    text: "Processing in FastLane",
    fullLine: "⏳ *Delivery Status:* Processing in FastLane",
  };
}

/**
 * Sends an automatic SMS and WhatsApp notification when a payment is received.
 * Notifies the Admin (instant alert) and the Customer (receipt & confirmation).
 */
export async function sendPaymentReceivedNotification(
  params: PaymentNotificationParams,
  customSupabase?: any
) {
  const {
    reference,
    amount,
    itemDescription,
    recipientPhone,
    customerPhone,
    network,
    channel,
    isTest = false,
    onlyWhatsApp = false,
    onlySms = false,
  } = params;

  if (!reference) return { ok: false, error: "Missing reference" };

  // Guard against duplicate alerts for same order reference (except explicit test runs)
  if (!isTest && notifiedReferences.has(reference)) {
    return { ok: true, alreadyNotified: true };
  }
  if (!isTest) {
    notifiedReferences.add(reference);
    if (notifiedReferences.size > 1000) {
      const first = notifiedReferences.values().next().value;
      if (first) notifiedReferences.delete(first);
    }
  }

  try {
    const supabase = customSupabase || getSupabase();

    // 1. Fetch settings from Supabase
    let sMap: Record<string, string> = {};
    if (supabase) {
      try {
        const { data: sRows } = await supabase
          .from("settings")
          .select("key, value")
          .in("key", [
            "admin_alert_phone",
            "support_phone",
            "admin_payment_alert_phone",
            "admin_whatsapp_number",
            "auto_payment_sms_enabled",
            "customer_payment_sms_enabled",
            "arkesel_api_key",
            "ARKESEL_API_KEY",
            "arkesel_sender_id",
            "ARKESEL_SENDER_ID",
            "shop_name",
            "whatsapp_access_token",
            "whatsapp_phone_id",
            "ACCESS_TOKEN",
            "PHONE_ID",
            "whatsapp_token",
            "whatsapp_phone_number_id",
            "meta_whatsapp_token",
            "META_WHATSAPP_TOKEN",
            "META_ACCESS_TOKEN",
            "meta_access_token",
            "WHATSAPP_ACCESS_TOKEN",
            "WHATSAPP_PHONE_NUMBER_ID",
            "WHATSAPP_PHONE_ID",
          ]);
        if (sRows) {
          sMap = Object.fromEntries(sRows.map((r: any) => [r.key, r.value]));
        }
      } catch (err) {
        console.warn("Could not query settings for payment notification:", err);
      }
    }

    // 2. Resolve Admin Alert Phones
    const candidatePhones: string[] = [
      params.adminWhatsAppNumber,
      isTest ? (recipientPhone || customerPhone) : null,
      sMap.admin_whatsapp_number,
      sMap.admin_payment_alert_phone,
      sMap.admin_alert_phone,
      sMap.support_phone,
      process.env.ADMIN_ALERT_PHONE,
      process.env.ADMIN_WHATSAPP_NUMBER,
      ADMIN_PRIMARY_SMS_PHONE,
    ].filter(Boolean) as string[];

    const adminSmsPhones = Array.from(
      new Set(
        [
          ADMIN_PRIMARY_SMS_PHONE,
          ...candidatePhones.map(formatPhoneForArkesel),
        ]
          .filter(Boolean)
          .filter((p) => !isBlockedFromAdminSms(p))
      )
    );
    const adminWhatsAppPhones = Array.from(
      new Set(
        [ADMIN_WHATSAPP_ONLY_PHONE, ...candidatePhones]
          .map(formatPhoneForWhatsApp)
          .filter(Boolean)
      )
    );

    // Database deduplication across serverless lambdas so only ONE WhatsApp alert is ever sent
    let existingNotes = "";
    if (!isTest && reference && supabase) {
      try {
        const { data: existingOrd } = await supabase
          .from("orders")
          .select("id, notes")
          .eq("reference", reference)
          .maybeSingle();
        if (existingOrd && String(existingOrd.notes || "").includes("[wa_alert_sent]")) {
          return { ok: true, alreadyNotified: true };
        }
        existingNotes = existingOrd?.notes || "";
      } catch (_) {}
    }

    // 3. Resolve Arkesel Credentials
    let arkeselKey = cleanApiKey(
      getEnvVar([
        "ARKESEL_API_KEY",
        "VITE_ARKESEL_API_KEY",
        "ARKESEL_KEY",
        "arkesel_api_key",
      ])
    );
    if (!arkeselKey && sMap.arkesel_api_key) arkeselKey = cleanApiKey(sMap.arkesel_api_key);
    if (!arkeselKey && sMap.ARKESEL_API_KEY) arkeselKey = cleanApiKey(sMap.ARKESEL_API_KEY);

    let senderId = (
      sMap.arkesel_sender_id ||
      sMap.ARKESEL_SENDER_ID ||
      process.env.ARKESEL_SENDER_ID ||
      "D_1Gh"
    ).trim();
    if (!senderId) { senderId = "D_1Gh"; }
    senderId = senderId.slice(0, 11);

    const dateStr = new Date().toLocaleDateString("en-GB", {
      timeZone: "Africa/Accra",
    });
    const timeStr = new Date().toLocaleTimeString("en-GB", {
      timeZone: "Africa/Accra",
      hour: "2-digit",
      minute: "2-digit",
    });

    const numAmount = Number(amount) || 0;
    const formattedAmount = numAmount.toFixed(2);

    const targetPhone = recipientPhone || customerPhone || "";
    const cleanPhone = targetPhone.startsWith("233")
      ? `0${targetPhone.slice(3)}`
      : targetPhone || "N/A";

    // -----------------------------------------------------------------
    // Originating Shop Identification & Authoritative Delivery Status
    // -----------------------------------------------------------------
    let resolvedAgentId = params.agentId || null;
    let agentStoreName = (params.agentStoreName || params.storeName || "").trim();
    let resolvedDeliveryStatus = params.deliveryStatus || null;
    let resolvedDatamartStatus = params.datamartStatus || null;
    let resolvedError = params.errorMessage || null;
    let resolvedBasePrice = 0;

    if (reference && supabase && (!resolvedDeliveryStatus || !agentStoreName || !resolvedAgentId)) {
      try {
        const { data: ordRow } = await supabase
          .from("orders")
          .select("delivery_status, datamart_status, error_message, agent_id, notes, base_price, amount")
          .eq("reference", reference)
          .maybeSingle();
        if (ordRow) {
          if (!resolvedDeliveryStatus || resolvedDeliveryStatus === "pending") {
            resolvedDeliveryStatus = ordRow.delivery_status || resolvedDeliveryStatus;
          }
          if (!resolvedDatamartStatus) {
            resolvedDatamartStatus = ordRow.datamart_status;
          }
          if (!resolvedError && ordRow.error_message) {
            resolvedError = ordRow.error_message;
          }
          if (!resolvedAgentId && ordRow.agent_id) {
            resolvedAgentId = ordRow.agent_id;
          }
          if (ordRow.base_price) {
            resolvedBasePrice = Number(ordRow.base_price);
          }
          const notesStr = String(ordRow.notes || existingNotes || "");
          if (!resolvedAgentId) {
            const agMatch = notesStr.match(/\[agent:([^\]]+)\]/i);
            if (agMatch) resolvedAgentId = agMatch[1].trim();
          }
          if (!agentStoreName) {
            const stMatch = notesStr.match(/\[store:([^\]]+)\]/i);
            if (stMatch) agentStoreName = stMatch[1].trim();
          }
        }
      } catch (_) {}
    }

    if (resolvedAgentId && !agentStoreName && supabase) {
      try {
        const { data: agRow } = await supabase
          .from("agents")
          .select("id, name, store_name, store_slug")
          .or(`id.eq.${resolvedAgentId},store_slug.ilike.${resolvedAgentId}`)
          .maybeSingle();
        if (agRow) {
          agentStoreName = (agRow.store_name || agRow.name || "").trim();
        } else {
          const { data: regRow } = await supabase
            .from("settings")
            .select("value")
            .eq("key", "agents_registry")
            .maybeSingle();
          if (regRow?.value) {
            const parsed = JSON.parse(regRow.value);
            if (Array.isArray(parsed)) {
              const matchedAg = parsed.find((a: any) => a.id === resolvedAgentId || a.store_slug === resolvedAgentId);
              if (matchedAg) {
                agentStoreName = (matchedAg.store_name || matchedAg.name || "").trim();
              }
            }
          }
        }
      } catch (_) {}
    }

    const isAgentOrder = Boolean(resolvedAgentId || agentStoreName);
    let displayShopName = "DataOne GH";

    if (isAgentOrder) {
      if (agentStoreName) {
        displayShopName = /agent/i.test(agentStoreName)
          ? agentStoreName
          : `${agentStoreName} (Agent Store)`;
      } else {
        displayShopName = "Agent Store";
      }
    } else {
      const explicitShop = (params.shopName || sMap.shop_name || "").trim();
      if (explicitShop && !/big jay/i.test(explicitShop)) {
        displayShopName = explicitShop;
      } else {
        displayShopName = "DataOne GH";
      }
    }

    // -----------------------------------------------------------------
    // A. Admin SMS Alert: BLOCKED per owner instruction!
    // ("for the admin, we are blocking all SMS notification")
    // -----------------------------------------------------------------
    const adminSmsSent = false;
    const smsDetails = "Admin SMS alerts are blocked per owner instruction.";

    // -----------------------------------------------------------------
    // B. Send WhatsApp Alert to Admin (WhatsApp Meta Cloud API)
    // Runs independently of auto SMS settings!
    // -----------------------------------------------------------------
    const waToken =
      cleanApiKey(params.whatsappAccessToken) ||
      cleanApiKey(process.env.ACCESS_TOKEN) ||
      cleanApiKey(process.env.WHATSAPP_ACCESS_TOKEN) ||
      cleanApiKey(process.env.META_ACCESS_TOKEN) ||
      cleanApiKey(process.env.META_WHATSAPP_TOKEN) ||
      cleanApiKey(sMap.whatsapp_access_token) ||
      cleanApiKey(sMap.ACCESS_TOKEN) ||
      cleanApiKey(sMap.whatsapp_token) ||
      cleanApiKey(sMap.meta_whatsapp_token) ||
      cleanApiKey(sMap.META_ACCESS_TOKEN);

    const waPhoneId =
      cleanApiKey(params.whatsappPhoneId) ||
      cleanApiKey(process.env.PHONE_ID) ||
      cleanApiKey(process.env.WHATSAPP_PHONE_NUMBER_ID) ||
      cleanApiKey(process.env.WHATSAPP_PHONE_ID) ||
      cleanApiKey(sMap.whatsapp_phone_id) ||
      cleanApiKey(sMap.PHONE_ID) ||
      cleanApiKey(sMap.whatsapp_phone_number_id) ||
      cleanApiKey(sMap.WHATSAPP_PHONE_NUMBER_ID) ||
      cleanApiKey(sMap.WHATSAPP_PHONE_ID);

    let adminWhatsAppSent = false;
    let whatsappDetails = "";

    if (!onlySms) {
      const deliveryStatusObj = formatRealDeliveryStatus(
        resolvedDeliveryStatus,
        resolvedDatamartStatus,
        resolvedError,
        params.orderType
      );

      const waAlertText =
`🛍️ *NEW ORDER PAYMENT RECEIVED!* 🎉
━━━━━━━━━━━━━━━━━━━━━
🏪 *Shop:* ${displayShopName}
🆔 *Ref:* ${reference}
📶 *Item:* ${itemDescription || "Data Bundle"}
📱 *Customer Phone:* ${cleanPhone}
💰 *Amount:* GHS ${formattedAmount}
💳 *Channel:* ${channel || "MoMo / Paystack"}
${deliveryStatusObj.fullLine}
⏰ *Time:* ${dateStr} ${timeStr}`;

      if (!waToken || !waPhoneId) {
        whatsappDetails = "Meta WhatsApp credentials not set. Using live Render bot fallback.";
      } else if (adminWhatsAppPhones.length === 0) {
        whatsappDetails = "No admin WhatsApp phone number configured.";
      } else {
        await Promise.allSettled(
          adminWhatsAppPhones.map(async (waPhone) => {
            try {
              const waRes = await fetch(`https://graph.facebook.com/v20.0/${waPhoneId}/messages`, {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${waToken}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  messaging_product: "whatsapp",
                  to: waPhone,
                  type: "text",
                  text: {
                    body: waAlertText,
                  },
                }),
                signal: AbortSignal.timeout(6000),
              });
              const waJson = await waRes.json().catch(() => ({}));
              if (waRes.ok && waJson?.messages) {
                adminWhatsAppSent = true;
                whatsappDetails = `WhatsApp alert sent to +${waPhone}.`;
              } else {
                const errCode = waJson?.error?.code ? ` (Code ${waJson.error.code})` : "";
                const errMsg = waJson?.error?.message || waJson?.message || `HTTP ${waRes.status}`;
                whatsappDetails = `Meta API error${errCode}: ${errMsg}`;
                console.warn("WhatsApp payment notification response note:", waJson);
              }
            } catch (waErr: any) {
              whatsappDetails = `WhatsApp network exception: ${waErr?.message || "Failed to connect"}`;
              console.warn("WhatsApp payment notification fetch error:", waErr);
            }
          })
        );
      }

      // Fallback to live Render WhatsApp bot if Meta Cloud API failed (e.g. 24h window closed)
      if (!adminWhatsAppSent) {
        try {
          const botUrl = process.env.WHATSAPP_BOT_SERVER_URL || "https://nestybot.onrender.com";
          const fbRes = await fetch(`${botUrl.replace(/\/+$/, "")}/api/send-admin-alert`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: waAlertText }),
            signal: AbortSignal.timeout(6000),
          });
          if (fbRes.ok) {
            adminWhatsAppSent = true;
            whatsappDetails = "WhatsApp alert sent via Render Bot.";
          }
        } catch (_) {}
      }

      // Stamp [wa_alert_sent] ONLY after successful delivery
      if (adminWhatsAppSent && !isTest && reference && supabase) {
        try {
          await supabase
            .from("orders")
            .update({
              notes: `${existingNotes || ""} [wa_alert_sent]`.trim(),
            })
            .eq("reference", reference);
        } catch (_) {}
      }

      // Also notify the respective Agent on WhatsApp if this order belongs to an Agent Store
      if (resolvedAgentId && !isTest && reference) {
        try {
          const sellAmt = Number(amount || 0);
          const estProfit = resolvedBasePrice > 0 ? Math.max(0, sellAmt - resolvedBasePrice) : 0;
          await sendAgentOrderWhatsAppAlert(
            {
              agentId: resolvedAgentId,
              orderReference: reference,
              itemDescription: itemDescription || "Data Bundle",
              recipientPhone: cleanPhone,
              sellingPrice: sellAmt,
              agentProfit: estProfit,
              deliveryStatus: resolvedDeliveryStatus || "processing",
              agentStoreName: agentStoreName || undefined,
            },
            supabase
          );
        } catch (_) {}
      }
    }

    // -----------------------------------------------------------------
    // C. Customer Receipt SMS: CANCELLED per owner instructions!
    // ("And the SMS alert to the numbers that bought the data, cancel it.
    //   The SMS alert should come to only admin.")
    // -----------------------------------------------------------------
    const customerSmsSent = false;

    return {
      ok: adminSmsSent || adminWhatsAppSent || (isTest && false),
      adminSmsSent,
      adminWhatsAppSent,
      smsDetails,
      whatsappDetails,
      customerSmsSent,
      reference,
    };
  } catch (err: any) {
    console.error("sendPaymentReceivedNotification error:", err);
    return { ok: false, error: err?.message };
  }
}

/**
 * Strips all emojis and non-standard symbols to ensure 100% clean GSM SMS delivery.
 */
function stripEmojis(str: string): string {
  if (!str) return "";
  return str
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/\u200D/g, "")
    .replace(/\uFE0E/g, "")
    .replace(/\uFE0F/g, "")
    .trim();
}

/**
 * Dispatches an SMS using Arkesel v2 API with v1 fallback.
 */
async function dispatchArkeselSms(
  apiKey: string,
  sender: string,
  recipient: string,
  message: string
): Promise<{ ok: boolean; error?: string }> {
  let target = String(recipient || "").replace(/\D/g, "");
  if (target.startsWith("2330") && target.length === 13) target = "233" + target.slice(4);
  else if (target.startsWith("0") && target.length === 10) target = "233" + target.slice(1);
  else if (target.length === 9) target = "233" + target;

  if (!target || target.length < 10) {
    console.warn("[Arkesel SMS] Recipient phone number invalid:", recipient);
    return { ok: false, error: "Invalid recipient phone number" };
  }

  const cleanMessage = stripEmojis(message);

  // Method 1: Arkesel v2 POST
  try {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 8000);
    const res = await fetch("https://sms.arkesel.com/api/v2/sms/send", {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        sender,
        message: cleanMessage,
        recipients: [target],
      }),
      signal: ac.signal,
    });
    clearTimeout(timer);
    const data = await res.json().catch(() => ({}));
    if (res.ok && (data?.status === "success" || data?.code === "100" || data?.status === 100)) {
      console.log(`[Arkesel SMS] v2 successfully delivered to ${target} via ${sender}`);
      return { ok: true };
    }
    const errMsg = data?.message || data?.error || (typeof data === "string" ? data : "");
    if (errMsg) {
      console.warn(`[Arkesel SMS] v2 returned status ${res.status}:`, errMsg, data);
    }
  } catch (err: any) {
    console.warn("Arkesel v2 send error, falling back to v1:", err?.message || err);
  }

  // Method 2: Arkesel v1 GET fallback
  try {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 8000);
    const url = `https://sms.arkesel.com/sms/api?action=send-sms&api_key=${encodeURIComponent(
      apiKey
    )}&to=${encodeURIComponent(target)}&from=${encodeURIComponent(
      sender
    )}&sms=${encodeURIComponent(cleanMessage)}&response=json`;

    const res = await fetch(url, { signal: ac.signal });
    clearTimeout(timer);
    const text = await res.text().catch(() => "");
    if (res.ok && (text.includes("100") || text.includes("success") || text.includes("Successful"))) {
      console.log(`[Arkesel SMS] v1 successfully delivered to ${target} via ${sender}`);
      return { ok: true };
    }
    console.warn(`[Arkesel SMS] v1 fallback response for ${target}:`, text);
    return { ok: false, error: text.slice(0, 150) || "Arkesel rejected SMS message" };
  } catch (err: any) {
    return { ok: false, error: err?.message || "Could not connect to Arkesel SMS" };
  }
}

/**
 * Logs an SMS notification attempt with automatic 24-hour retention.
 * Automatically deletes records older than 24 hours.
 */
export async function logSmsNotification(
  supabase: any,
  entry: {
    recipient: string;
    message: string;
    senderId?: string;
    reference?: string | null;
    status: "sent" | "failed";
    error?: string | null;
    type?: string;
  }
) {
  try {
    const logItem = {
      id: `sms_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      recipient: entry.recipient,
      message: entry.message,
      sender_id: entry.senderId || "D_1Gh",
      reference: entry.reference || null,
      status: entry.status,
      error: entry.error || null,
      type: entry.type || "payment_issue",
      created_at: new Date().toISOString(),
    };

    // Always record into data1db in-memory sms_logs first (0 egress)
    try {
      data1db.insert("sms_logs", logItem);
    } catch (_) {}

    let client = supabase;
    if (!client) {
      try {
        client = getSupabase();
      } catch (_) {}
    }

    if (client) {
      // 1. Insert into sms_logs table
      try {
        const { error: insErr } = await client.from("sms_logs").insert(logItem);
        if (!insErr) {
          return;
        }
      } catch (_) {}

      // 2. Fallback to data1db settings "recent_sms_logs" (avoid reading/writing large JSON blobs to PostgREST)
      try {
        const localSettings = data1db.loadTable("settings");
        const existingRow = localSettings.find((s: any) => s.key === "recent_sms_logs");
        let list: any[] = [];
        if (existingRow?.value) {
          try { list = JSON.parse(existingRow.value); } catch (_) {}
        }
        if (!Array.isArray(list)) list = [];
        const cutoffMs = Date.now() - 24 * 60 * 60 * 1000;
        list = [logItem, ...list]
          .filter((item: any) => new Date(item.created_at || 0).getTime() > cutoffMs)
          .slice(0, 150);
        data1db.upsert("settings", { key: "recent_sms_logs", value: JSON.stringify(list) }, "key");
      } catch (_) {}
    }
  } catch (err: any) {
    console.warn("logSmsNotification warning:", err?.message);
  }
}

export interface WithdrawalNotificationParams {
  withdrawalId: string;
  amount: number | string;
  storeName?: string | null;
  agentName?: string | null;
  agentPhone?: string | null;
  agentEmail?: string | null;
  momoName?: string | null;
  momoNumber?: string | null;
  momoNetwork?: string | null;
  walletBalance?: number | string;
  adminWhatsAppNumber?: string | null;
  whatsappAccessToken?: string | null;
  whatsappPhoneId?: string | null;
  isTest?: boolean;
}

/**
 * Sends an instant WhatsApp and SMS alert to the store owner / admin
 * whenever an agent requests a withdrawal, including the store name,
 * momo name, and all vital payout details.
 */
export async function sendWithdrawalAlertNotification(
  params: WithdrawalNotificationParams,
  customSupabase?: any
): Promise<{
  ok: boolean;
  adminWhatsAppSent: boolean;
  adminSmsSent: boolean;
  whatsappDetails: string;
  smsDetails: string;
  directWhatsAppUrl: string;
  withdrawalId: string;
  error?: string;
}> {
  const {
    withdrawalId,
    amount,
    storeName = "Agent Store",
    agentName = "Agent",
    agentPhone = "",
    agentEmail = "",
    momoName = "Agent",
    momoNumber = "",
    momoNetwork = "MTN",
    walletBalance = 0,
    isTest = false,
  } = params;

  if (!withdrawalId) {
    return {
      ok: false,
      adminWhatsAppSent: false,
      adminSmsSent: false,
      whatsappDetails: "Missing withdrawal ID",
      smsDetails: "",
      directWhatsAppUrl: "",
      withdrawalId: "",
      error: "Missing withdrawal ID",
    };
  }

  try {
    const supabase = customSupabase || getSupabase();

    // 1. Fetch settings from Supabase
    let sMap: Record<string, string> = {};
    if (supabase) {
      try {
        const { data: sRows } = await supabase
          .from("settings")
          .select("key, value")
          .in("key", [
            "admin_alert_phone",
            "support_phone",
            "admin_payment_alert_phone",
            "admin_whatsapp_number",
            "arkesel_api_key",
            "ARKESEL_API_KEY",
            "arkesel_sender_id",
            "ARKESEL_SENDER_ID",
            "shop_name",
            "whatsapp_access_token",
            "whatsapp_phone_id",
            "ACCESS_TOKEN",
            "PHONE_ID",
            "whatsapp_token",
            "whatsapp_phone_number_id",
            "meta_whatsapp_token",
            "META_WHATSAPP_TOKEN",
            "META_ACCESS_TOKEN",
            "meta_access_token",
            "WHATSAPP_ACCESS_TOKEN",
            "WHATSAPP_PHONE_NUMBER_ID",
            "WHATSAPP_PHONE_ID",
          ]);
        if (sRows) {
          sMap = Object.fromEntries(sRows.map((r: any) => [r.key, r.value]));
        }
      } catch (err) {
        console.warn("Could not query settings for withdrawal notification:", err);
      }
    }

    // 2. Resolve Admin Alert Phones
    const candidatePhones: string[] = [
      params.adminWhatsAppNumber,
      isTest ? (params.momoNumber || params.agentPhone) : null,
      sMap.admin_whatsapp_number,
      sMap.admin_payment_alert_phone,
      sMap.admin_alert_phone,
      sMap.support_phone,
      process.env.ADMIN_ALERT_PHONE,
      process.env.ADMIN_WHATSAPP_NUMBER,
      ADMIN_PRIMARY_SMS_PHONE,
    ].filter(Boolean) as string[];

    const adminWhatsAppPhones = Array.from(
      new Set(
        [ADMIN_WHATSAPP_ONLY_PHONE, ...candidatePhones]
          .map(formatPhoneForWhatsApp)
          .filter(Boolean)
      )
    );
    const adminSmsPhones = Array.from(
      new Set(
        [
          ADMIN_PRIMARY_SMS_PHONE,
          ...candidatePhones.map(formatPhoneForArkesel),
        ]
          .filter(Boolean)
          .filter((p) => !isBlockedFromAdminSms(p))
      )
    );

    // 3. Resolve Arkesel Credentials for SMS backup
    let arkeselKey = cleanApiKey(
      getEnvVar([
        "ARKESEL_API_KEY",
        "VITE_ARKESEL_API_KEY",
        "ARKESEL_KEY",
        "arkesel_api_key",
      ])
    );
    if (!arkeselKey && sMap.arkesel_api_key) arkeselKey = cleanApiKey(sMap.arkesel_api_key);
    if (!arkeselKey && sMap.ARKESEL_API_KEY) arkeselKey = cleanApiKey(sMap.ARKESEL_API_KEY);

    let senderId = (
      sMap.arkesel_sender_id ||
      sMap.ARKESEL_SENDER_ID ||
      process.env.ARKESEL_SENDER_ID ||
      "D_1Gh"
    ).trim();
    if (!senderId) { senderId = "D_1Gh"; }
    senderId = senderId.slice(0, 11);

    // 4. Resolve Meta WhatsApp Credentials
    const waToken =
      cleanApiKey(params.whatsappAccessToken) ||
      cleanApiKey(process.env.ACCESS_TOKEN) ||
      cleanApiKey(process.env.WHATSAPP_ACCESS_TOKEN) ||
      cleanApiKey(process.env.META_ACCESS_TOKEN) ||
      cleanApiKey(process.env.META_WHATSAPP_TOKEN) ||
      cleanApiKey(sMap.whatsapp_access_token) ||
      cleanApiKey(sMap.ACCESS_TOKEN) ||
      cleanApiKey(sMap.whatsapp_token) ||
      cleanApiKey(sMap.meta_whatsapp_token) ||
      cleanApiKey(sMap.META_ACCESS_TOKEN);

    const waPhoneId =
      cleanApiKey(params.whatsappPhoneId) ||
      cleanApiKey(process.env.PHONE_ID) ||
      cleanApiKey(process.env.WHATSAPP_PHONE_NUMBER_ID) ||
      cleanApiKey(process.env.WHATSAPP_PHONE_ID) ||
      cleanApiKey(sMap.whatsapp_phone_id) ||
      cleanApiKey(sMap.PHONE_ID) ||
      cleanApiKey(sMap.whatsapp_phone_number_id) ||
      cleanApiKey(sMap.WHATSAPP_PHONE_NUMBER_ID) ||
      cleanApiKey(sMap.WHATSAPP_PHONE_ID);

    // Date & Time
    const dateStr = new Date().toLocaleDateString("en-GB", {
      timeZone: "Africa/Accra",
    });
    const timeStr = new Date().toLocaleTimeString("en-GB", {
      timeZone: "Africa/Accra",
      hour: "2-digit",
      minute: "2-digit",
    });

    const numAmount = Number(amount) || 0;
    const formattedAmount = numAmount.toFixed(2);
    const numBalance = Number(walletBalance) || 0;
    const formattedBalance = numBalance.toFixed(2);

    const cleanStoreName = (storeName || "Agent Store").trim();
    const cleanAgentName = (agentName || "Agent").trim();
    const cleanMomoName = (momoName || cleanAgentName).trim();
    const cleanMomoNumber = (momoNumber || agentPhone || "N/A").trim();
    const cleanMomoNetwork = (momoNetwork || "MTN").toUpperCase().trim();
    const cleanAgentPhone = agentPhone ? (agentPhone.startsWith("233") ? `0${agentPhone.slice(3)}` : agentPhone) : "N/A";

    // 5. Prepare WhatsApp Alert Body
    const waAlertText =
`🔔 *NEW AGENT WITHDRAWAL REQUEST!* 💰
━━━━━━━━━━━━━━━━━━━━━
🏪 *Store Name:* ${cleanStoreName}
👤 *Agent Name:* ${cleanAgentName}
📞 *Agent Phone:* ${cleanAgentPhone}

📱 *MoMo Account Details:*
• *MoMo Name:* ${cleanMomoName}
• *MoMo Number:* ${cleanMomoNumber}
• *Network:* ${cleanMomoNetwork}

💵 *Payout Details:*
• *Requested Amount:* GH₵ ${formattedAmount}
• *Remaining Balance:* GH₵ ${formattedBalance}
• *Withdrawal ID:* ${withdrawalId}
• *Status:* Pending Approval ⏳
• *Time:* ${dateStr} ${timeStr}

⚡ *Action Required:*
Please log in to your Admin Dashboard to review and disburse:
👉 https://www.data1gh.com/admin/agents`;

    let adminWhatsAppSent = false;
    let whatsappDetails = "";

    if (!waToken || !waPhoneId) {
      whatsappDetails = "Meta WhatsApp credentials not set. Please add WhatsApp Access Token & Phone Number ID in Admin Settings.";
    } else if (adminWhatsAppPhones.length === 0) {
      whatsappDetails = "No admin WhatsApp phone number configured.";
    } else {
      for (const waPhone of adminWhatsAppPhones) {
        try {
          const waRes = await fetch(`https://graph.facebook.com/v20.0/${waPhoneId}/messages`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${waToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              messaging_product: "whatsapp",
              to: waPhone,
              type: "text",
              text: {
                body: waAlertText,
              },
            }),
          });
          const waJson = await waRes.json().catch(() => ({}));
          if (waRes.ok && waJson?.messages) {
            adminWhatsAppSent = true;
            whatsappDetails = `WhatsApp alert sent to +${waPhone}.`;
          } else {
            const errCode = waJson?.error?.code ? ` (Code ${waJson.error.code})` : "";
            const errMsg = waJson?.error?.message || waJson?.message || `HTTP ${waRes.status}`;
            whatsappDetails = `Meta API error${errCode}: ${errMsg}`;
            console.warn("WhatsApp withdrawal notification response note:", waJson);
          }
        } catch (waErr: any) {
          whatsappDetails = `WhatsApp network exception: ${waErr?.message || "Failed to connect"}`;
          console.warn("WhatsApp withdrawal notification fetch error:", waErr);
        }
      }
    }

    // 6. Send SMS Alert Backup to Admin via Arkesel
    let adminSmsSent = false;
    let smsDetails = "";

    if (arkeselKey && adminSmsPhones.length > 0) {
      const smsMessage =
`NEW WITHDRAWAL ALERT!
Store: ${cleanStoreName}
MoMo Name: ${cleanMomoName}
Amount: GHS ${formattedAmount}
MoMo: ${cleanMomoNetwork} ${cleanMomoNumber}
Agent: ${cleanAgentName} (${cleanAgentPhone})
ID: ${withdrawalId}
Time: ${dateStr} ${timeStr}`;

      for (const aPhone of adminSmsPhones) {
        const res = await dispatchArkeselSms(arkeselKey, senderId, aPhone, smsMessage);
        if (res.ok) {
          adminSmsSent = true;
          smsDetails = `SMS alert sent to ${aPhone}.`;
        } else {
          smsDetails = res.error || "Arkesel failed to deliver SMS.";
        }
      }
    } else if (!arkeselKey) {
      smsDetails = "No Arkesel key configured for SMS backup.";
    }

    const primaryAdminWhatsApp = adminWhatsAppPhones[0] || "233547100951";
    const directWhatsAppUrl = `https://wa.me/${primaryAdminWhatsApp}?text=${encodeURIComponent(waAlertText)}`;

    return {
      ok: adminWhatsAppSent || adminSmsSent,
      adminWhatsAppSent,
      adminSmsSent,
      whatsappDetails,
      smsDetails,
      directWhatsAppUrl,
      withdrawalId,
    };
  } catch (err: any) {
    console.error("sendWithdrawalAlertNotification error:", err);
    return {
      ok: false,
      adminWhatsAppSent: false,
      adminSmsSent: false,
      whatsappDetails: err?.message || "Internal error",
      smsDetails: "",
      directWhatsAppUrl: "",
      withdrawalId: params.withdrawalId,
      error: err?.message,
    };
  }
}

export interface AgentRegistrationNotificationParams {
  agentId?: string;
  name: string;
  email: string;
  phone: string;
  storeName: string;
  storeSlug: string;
  customDomain?: string;
  adminWhatsAppNumber?: string | null;
  whatsappAccessToken?: string | null;
  whatsappPhoneId?: string | null;
  isTest?: boolean;
}

/**
 * Dispatches:
 * 1. Welcome SMS to the newly registered agent with their unique store link:
 *    "Congrats! Welcome on board as an agent under Data1gh. You can now sell and earn your profits. Your earnings are saved. Glad to have you!
 *    https://gooddata1.vercel.app/s/<slug>"
 * 2. Instant WhatsApp Alert to Store Owner / Admin about the new agent registration with all store & agent details.
 * 3. SMS backup alert to Store Owner / Admin.
 */
export async function sendAgentRegistrationNotification(
  params: AgentRegistrationNotificationParams,
  customSupabase?: any
): Promise<{
  ok: boolean;
  agentSmsSent: boolean;
  adminWhatsAppSent: boolean;
  adminSmsSent: boolean;
  agentSmsDetails: string;
  adminWhatsAppDetails: string;
  adminSmsDetails: string;
  storeUrl: string;
  directWhatsAppUrl: string;
  error?: string;
}> {
  const {
    name = "Agent",
    email = "",
    phone = "",
    storeName = "Agent Store",
    storeSlug = "",
    customDomain = "",
    isTest = false,
  } = params;

  const rawSlug = String(storeSlug || "").toLowerCase().trim();
  const cleanStoreName = (storeName || `${name}'s Store`).trim();
  const cleanName = (name || "Agent").trim();
  const cleanPhone = phone ? (phone.startsWith("233") ? `0${phone.slice(3)}` : phone) : "N/A";
  const cleanEmail = (email || "N/A").trim();

  // Resolve store URL: Default to https://gooddata1.vercel.app/s/<slug> (agent link)
  const storeUrl = customDomain
    ? (customDomain.startsWith("http") ? customDomain : `https://${customDomain}`)
    : `https://gooddata1.vercel.app/s/${rawSlug}`;

  // Agent Welcome SMS text (exact message requested by user)
  const welcomeSms = 
`Congrats! Welcome on board as an agent under Data1gh. You can now sell and earn your profits. Your earnings are saved. Glad to have you!
${storeUrl}`;

  try {
    const supabase = customSupabase || getSupabase();

    // 1. Fetch settings from Supabase
    let sMap: Record<string, string> = {};
    if (supabase) {
      try {
        const { data: sRows } = await supabase
          .from("settings")
          .select("key, value")
          .in("key", [
            "admin_alert_phone",
            "support_phone",
            "admin_payment_alert_phone",
            "admin_whatsapp_number",
            "arkesel_api_key",
            "ARKESEL_API_KEY",
            "arkesel_sender_id",
            "ARKESEL_SENDER_ID",
            "shop_name",
            "whatsapp_access_token",
            "whatsapp_phone_id",
            "ACCESS_TOKEN",
            "PHONE_ID",
            "whatsapp_token",
            "whatsapp_phone_number_id",
            "meta_whatsapp_token",
            "META_WHATSAPP_TOKEN",
            "META_ACCESS_TOKEN",
            "meta_access_token",
            "WHATSAPP_ACCESS_TOKEN",
            "WHATSAPP_PHONE_NUMBER_ID",
            "WHATSAPP_PHONE_ID",
          ]);
        if (sRows) {
          sMap = Object.fromEntries(sRows.map((r: any) => [r.key, r.value]));
        }
      } catch (err) {
        console.warn("Could not query settings for agent registration notification:", err);
      }
    }

    // 2. Resolve Admin Alert Phones
    const candidatePhones: string[] = [
      params.adminWhatsAppNumber,
      isTest ? phone : null,
      sMap.admin_whatsapp_number,
      sMap.admin_payment_alert_phone,
      sMap.admin_alert_phone,
      sMap.support_phone,
      process.env.ADMIN_ALERT_PHONE,
      process.env.ADMIN_WHATSAPP_NUMBER,
      ADMIN_PRIMARY_SMS_PHONE,
    ].filter(Boolean) as string[];

    const adminWhatsAppPhones = Array.from(
      new Set([ADMIN_WHATSAPP_ONLY_PHONE, ...candidatePhones.map(formatPhoneForWhatsApp)].filter(Boolean))
    );
    const adminSmsPhones = Array.from(
      new Set(
        [
          ADMIN_PRIMARY_SMS_PHONE,
          ...candidatePhones.map(formatPhoneForArkesel),
        ]
          .filter(Boolean)
          .filter((p) => !isBlockedFromAdminSms(p))
      )
    );

    // 3. Resolve Arkesel Credentials
    let arkeselKey = cleanApiKey(
      getEnvVar([
        "ARKESEL_API_KEY",
        "VITE_ARKESEL_API_KEY",
        "ARKESEL_KEY",
        "arkesel_api_key",
      ])
    );
    if (!arkeselKey && sMap.arkesel_api_key) arkeselKey = cleanApiKey(sMap.arkesel_api_key);
    if (!arkeselKey && sMap.ARKESEL_API_KEY) arkeselKey = cleanApiKey(sMap.ARKESEL_API_KEY);

    let senderId = (
      sMap.arkesel_sender_id ||
      sMap.ARKESEL_SENDER_ID ||
      process.env.ARKESEL_SENDER_ID ||
      "D_1Gh"
    ).trim();
    if (!senderId) { senderId = "D_1Gh"; }
    senderId = senderId.slice(0, 11);

    // 4. Resolve Meta WhatsApp Credentials
    const waToken =
      cleanApiKey(params.whatsappAccessToken) ||
      cleanApiKey(process.env.ACCESS_TOKEN) ||
      cleanApiKey(process.env.WHATSAPP_ACCESS_TOKEN) ||
      cleanApiKey(process.env.META_ACCESS_TOKEN) ||
      cleanApiKey(process.env.META_WHATSAPP_TOKEN) ||
      cleanApiKey(sMap.whatsapp_access_token) ||
      cleanApiKey(sMap.ACCESS_TOKEN) ||
      cleanApiKey(sMap.whatsapp_token) ||
      cleanApiKey(sMap.meta_whatsapp_token) ||
      cleanApiKey(sMap.META_ACCESS_TOKEN);

    const waPhoneId =
      cleanApiKey(params.whatsappPhoneId) ||
      cleanApiKey(process.env.PHONE_ID) ||
      cleanApiKey(process.env.WHATSAPP_PHONE_NUMBER_ID) ||
      cleanApiKey(process.env.WHATSAPP_PHONE_ID) ||
      cleanApiKey(sMap.whatsapp_phone_id) ||
      cleanApiKey(sMap.PHONE_ID) ||
      cleanApiKey(sMap.whatsapp_phone_number_id) ||
      cleanApiKey(sMap.WHATSAPP_PHONE_NUMBER_ID) ||
      cleanApiKey(sMap.WHATSAPP_PHONE_ID);

    const dateStr = new Date().toLocaleDateString("en-GB", {
      timeZone: "Africa/Accra",
    });
    const timeStr = new Date().toLocaleTimeString("en-GB", {
      timeZone: "Africa/Accra",
      hour: "2-digit",
      minute: "2-digit",
    });

    // A. Dispatch Welcome SMS to the newly registered Agent
    let agentSmsSent = false;
    let agentSmsDetails = "";
    const agentFormattedPhone = formatPhoneForArkesel(phone);

    if (arkeselKey && agentFormattedPhone) {
      try {
        const smsRes = await dispatchArkeselSms(arkeselKey, senderId, agentFormattedPhone, welcomeSms);
        if (smsRes.ok) {
          agentSmsSent = true;
          agentSmsDetails = `Welcome SMS delivered to ${agentFormattedPhone} (Sender: ${senderId}).`;
        } else {
          agentSmsDetails = smsRes.error || "Arkesel failed to deliver welcome SMS to agent.";
        }
      } catch (agentSmsErr: any) {
        agentSmsDetails = agentSmsErr?.message || "Failed to contact SMS gateway for agent.";
      }
    } else if (!arkeselKey) {
      agentSmsDetails = "No Arkesel key configured for welcome SMS.";
    } else {
      agentSmsDetails = "Invalid agent phone number for SMS.";
    }

    // B. Dispatch WhatsApp Alert to Admin
    let adminWhatsAppSent = false;
    let adminWhatsAppDetails = "";

    const adminWaAlertText = 
`🎉 *NEW AGENT REGISTRATION!* 🏪
━━━━━━━━━━━━━━━━━━━━━
🏪 *Store Name:* ${cleanStoreName}
👤 *Agent Name:* ${cleanName}
📱 *Phone:* ${cleanPhone}
✉️ *Email:* ${cleanEmail}
🌐 *Store Link:* ${storeUrl}
⏰ *Time:* ${dateStr} ${timeStr}

⚡ *Action:*
The agent's online shop is live! They can now customize prices and start selling.
View all agents: https://www.data1gh.com/admin/agents`;

    if (!waToken || !waPhoneId) {
      adminWhatsAppDetails = "Meta WhatsApp credentials not set. Please add WhatsApp Access Token & Phone Number ID in Admin Settings.";
    } else if (adminWhatsAppPhones.length === 0) {
      adminWhatsAppDetails = "No admin WhatsApp phone number configured.";
    } else {
      for (const waPhone of adminWhatsAppPhones) {
        try {
          const waRes = await fetch(`https://graph.facebook.com/v20.0/${waPhoneId}/messages`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${waToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              messaging_product: "whatsapp",
              to: waPhone,
              type: "text",
              text: {
                body: adminWaAlertText,
              },
            }),
          });
          const waJson = await waRes.json().catch(() => ({}));
          if (waRes.ok && waJson?.messages) {
            adminWhatsAppSent = true;
            adminWhatsAppDetails = `WhatsApp alert sent to +${waPhone}.`;
          } else {
            const errCode = waJson?.error?.code ? ` (Code ${waJson.error.code})` : "";
            const errMsg = waJson?.error?.message || waJson?.message || `HTTP ${waRes.status}`;
            adminWhatsAppDetails = `Meta API error${errCode}: ${errMsg}`;
            console.warn("WhatsApp agent registration notification response note:", waJson);
          }
        } catch (waErr: any) {
          adminWhatsAppDetails = `WhatsApp network exception: ${waErr?.message || "Failed to connect"}`;
          console.warn("WhatsApp agent registration notification fetch error:", waErr);
        }
      }
    }

    // C. Dispatch SMS Backup to Admin
    let adminSmsSent = false;
    let adminSmsDetails = "";

    if (arkeselKey && adminSmsPhones.length > 0) {
      const adminSmsText = 
`NEW AGENT REGISTRATION!
Store: ${cleanStoreName}
Agent: ${cleanName} (${cleanPhone})
Link: ${storeUrl}
Time: ${dateStr} ${timeStr}`;

      for (const aPhone of adminSmsPhones) {
        const res = await dispatchArkeselSms(arkeselKey, senderId, aPhone, adminSmsText);
        if (res.ok) {
          adminSmsSent = true;
          adminSmsDetails = `SMS alert sent to admin at ${aPhone}.`;
        } else {
          adminSmsDetails = res.error || "Arkesel failed to deliver SMS to admin.";
        }
      }
    }

    const primaryAdminWhatsApp = adminWhatsAppPhones[0] || "233547100951";
    const directWhatsAppUrl = `https://wa.me/${primaryAdminWhatsApp}?text=${encodeURIComponent(adminWaAlertText)}`;

    return {
      ok: agentSmsSent || adminWhatsAppSent || adminSmsSent,
      agentSmsSent,
      adminWhatsAppSent,
      adminSmsSent,
      agentSmsDetails,
      adminWhatsAppDetails,
      adminSmsDetails,
      storeUrl,
      directWhatsAppUrl,
    };
  } catch (err: any) {
    console.error("sendAgentRegistrationNotification error:", err);
    return {
      ok: false,
      agentSmsSent: false,
      adminWhatsAppSent: false,
      adminSmsSent: false,
      agentSmsDetails: "",
      adminWhatsAppDetails: err?.message || "Internal error",
      adminSmsDetails: "",
      storeUrl,
      directWhatsAppUrl: "",
      error: err?.message,
    };
  }
}

/**
 * Checks if the DataMart Telecom API wallet balance is at or below GH₵ 50.
 * If low, dispatches an urgent WhatsApp alert (and SMS fallback) to the admin.
 * Includes a 3-hour cooldown to prevent spamming while guaranteeing timely alerts.
 */
export async function checkAndAlertLowDatamartBalance(
  balance: number | string | null | undefined,
  customSupabase?: any
): Promise<{ alerted: boolean; balance?: number; reason?: string }> {
  if (balance === null || balance === undefined) {
    return { alerted: false, reason: "No balance provided" };
  }

  const num = Number(balance);
  if (isNaN(num)) {
    return { alerted: false, reason: "Invalid balance format" };
  }

  // Threshold: 50 Ghana Cedis
  if (num > 50) {
    return { alerted: false, balance: num, reason: "Balance above threshold" };
  }

  const supabase = customSupabase || getSupabase();
  if (!supabase) return { alerted: false, reason: "No database client" };

  try {
    // 3-hour cooldown check via Supabase settings
    const { data: lastAlertRow } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "last_datamart_low_balance_alert")
      .maybeSingle();

    const lastAlertTime = lastAlertRow?.value ? Number(lastAlertRow.value) : 0;
    const now = Date.now();
    const COOLDOWN_MS = 3 * 60 * 60 * 1000; // 3 hours

    if (now - lastAlertTime < COOLDOWN_MS) {
      return { alerted: false, balance: num, reason: "Alerted recently within cooldown" };
    }

    // Save alert timestamp immediately
    await supabase.from("settings").upsert(
      { key: "last_datamart_low_balance_alert", value: String(now) },
      { onConflict: "key" }
    );

    // Fetch contact details from settings
    const { data: sRows } = await supabase
      .from("settings")
      .select("key, value")
      .in("key", [
        "admin_alert_phone",
        "support_phone",
        "whatsapp_access_token",
        "whatsapp_phone_id",
        "ACCESS_TOKEN",
        "PHONE_ID",
        "arkesel_api_key",
        "arkesel_sender_id",
        "shop_name",
      ]);

    const sMap = Object.fromEntries((sRows || []).map((s: any) => [s.key, s.value]));
    const targetAdminWhatsApp = ADMIN_WHATSAPP_ONLY_PHONE; // "0547100951" - WhatsApp only
    const targetAdminSms = ADMIN_PRIMARY_SMS_PHONE; // "0592753424" - SMS only
    const formattedAdminPhone = formatPhoneForWhatsApp(targetAdminWhatsApp);
    const shopName = sMap.shop_name || "Data 1 GH";

    const waToken =
      process.env.ACCESS_TOKEN ||
      process.env.WHATSAPP_ACCESS_TOKEN ||
      sMap.whatsapp_access_token ||
      sMap.ACCESS_TOKEN;

    const waPhoneId =
      process.env.PHONE_ID ||
      process.env.WHATSAPP_PHONE_NUMBER_ID ||
      sMap.whatsapp_phone_id ||
      sMap.PHONE_ID;

    const arkeselKey = sMap.arkesel_api_key || getEnvVar(["ARKESEL_API_KEY", "VITE_ARKESEL_API_KEY"]);
    const senderId = sMap.arkesel_sender_id || "Data1GH";

    const timeStr = new Date().toLocaleString("en-GB", { timeZone: "Africa/Accra" });

    const alertMessage =
`⚠️ *${shopName.toUpperCase()} — LOW WALLET ALERT* ⚠️
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Your DataMart Telecom API wallet balance has reached the critical threshold!

💰 *Current Balance:* GH₵ ${num.toFixed(2)}
📉 *Threshold Alert:* GH₵ 50.00
⏰ *Time:* ${timeStr}

🚨 *Immediate Action Needed:*
Please log in to DataMart (datamartgh.shop) and top up your developer wallet right away.
If your balance hits GH₵ 0.00, customer data bundle orders and free data promotions will fail to deliver!`;

    // 1. WhatsApp Meta Cloud API (Sent to 0547100951)
    if (waToken && waPhoneId && formattedAdminPhone) {
      try {
        await fetch(`https://graph.facebook.com/v20.0/${waPhoneId}/messages`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${waToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: formattedAdminPhone,
            type: "text",
            text: { body: alertMessage },
          }),
        });
      } catch (waErr) {
        console.warn("Low balance WhatsApp alert error:", waErr);
      }
    }

    // 2. Arkesel SMS Fallback / Dual Alert (0547100951 blocked - SMS strictly to 0592753424 only!)
    if (arkeselKey && targetAdminSms && !isBlockedFromAdminSms(targetAdminSms)) {
      const smsPhone = formatPhoneForArkesel(targetAdminSms);
      const smsText = `LOW WALLET ALERT: Your DataMart balance is GH₵ ${num.toFixed(2)} (below GH₵ 50 threshold). Please top up now to avoid order dispatch failures. - ${shopName}`;
      await dispatchArkeselSms(arkeselKey, senderId, smsPhone, smsText).catch(() => null);
    }

    return { alerted: true, balance: num };
  } catch (err: any) {
    console.error("checkAndAlertLowDatamartBalance error:", err);
    return { alerted: false, reason: err?.message };
  }
}

/**
 * Checks whether an API error message or HTTP status indicates insufficient
 * or low provider wallet balance from DataMart.
 */
export function isDatamartLowBalanceError(errMsg?: string | null, status?: number | null): boolean {
  if (status === 402) return true;
  if (!errMsg) return false;
  const s = String(errMsg).toLowerCase();
  return (
    s.includes("insufficient") ||
    s.includes("low balance") ||
    s.includes("wallet balance") ||
    s.includes("not enough balance") ||
    s.includes("balance too low") ||
    s.includes("insufficient funds") ||
    s.includes("insufficient wallet") ||
    s.includes("please top up") ||
    s.includes("topup your wallet") ||
    s.includes("wallet is empty") ||
    s.includes("balance is low") ||
    (s.includes("balance") &&
      (s.includes("low") ||
        s.includes("fund") ||
        s.includes("credit") ||
        s.includes("empty") ||
        s.includes("zero") ||
        s.includes("short") ||
        s.includes("recharge")))
  );
}

export interface LowBalanceOrderFailedParams {
  reference: string;
  recipientPhone: string;
  network?: string | null;
  capacity?: string | null;
  amount?: number | string | null;
  errorMessage?: string | null;
  orderId?: string | number | null;
}

const notifiedLowBalanceOrders = new Set<string>();

/**
 * Dispatches an instant, urgent SMS alarm (and WhatsApp dual alert) to the admin
 * (specifically sending SMS to 0547100951 and configured admin phones) when an order
 * fails dispatch due to low provider balance on DataMart.
 * This ensures the admin is alerted immediately so they can top up and process manually.
 */
export async function sendAdminLowBalanceOrderFailedAlert(
  params: LowBalanceOrderFailedParams,
  customSupabase?: any
): Promise<{ ok: boolean; smsSent: boolean; whatsappSent: boolean; details?: string }> {
  const { reference, recipientPhone, network = "Data", capacity = "", amount, errorMessage } = params;

  if (!reference) return { ok: false, smsSent: false, whatsappSent: false, details: "Missing reference" };

  // Guard against sending duplicate SMS alerts for the same order reference
  if (notifiedLowBalanceOrders.has(reference)) {
    return { ok: true, smsSent: false, whatsappSent: false, details: "Already alerted for this reference" };
  }
  notifiedLowBalanceOrders.add(reference);
  if (notifiedLowBalanceOrders.size > 500) {
    const first = notifiedLowBalanceOrders.values().next().value;
    if (first) notifiedLowBalanceOrders.delete(first);
  }

  try {
    const supabase = customSupabase || getSupabase();
    let sMap: Record<string, string> = {};
    if (supabase) {
      try {
        const { data: sRows } = await supabase
          .from("settings")
          .select("key, value")
          .in("key", [
            "admin_alert_phone",
            "support_phone",
            "admin_payment_alert_phone",
            "admin_whatsapp_number",
            "arkesel_api_key",
            "ARKESEL_API_KEY",
            "arkesel_sender_id",
            "ARKESEL_SENDER_ID",
            "shop_name",
            "whatsapp_access_token",
            "whatsapp_phone_id",
            "ACCESS_TOKEN",
            "PHONE_ID",
          ]);
        if (sRows) {
          sMap = Object.fromEntries(sRows.map((r: any) => [r.key, r.value]));
        }
      } catch (err) {
        console.warn("Could not query settings for low-balance failure alert:", err);
      }
    }

    // Owner instruction:
    // 1. NO SMS to 0547100951 under any circumstance (WhatsApp alerts ONLY to 0547100951!)
    // 2. Admin SMS alarms go ONLY to 0592753424
    const adminSmsPhones = [formatPhoneForArkesel(ADMIN_PRIMARY_SMS_PHONE)].filter(
      (p) => !isBlockedFromAdminSms(p)
    );

    const candidateWhatsAppPhones = [
      params.adminWhatsAppNumber,
      sMap.admin_whatsapp_number,
      sMap.admin_payment_alert_phone,
      sMap.admin_alert_phone,
      sMap.support_phone,
      ADMIN_WHATSAPP_ONLY_PHONE, // "0547100951"
    ].filter(Boolean) as string[];

    const adminWhatsAppPhones = Array.from(
      new Set(candidateWhatsAppPhones.map(formatPhoneForWhatsApp).filter(Boolean))
    );

    let arkeselKey = cleanApiKey(
      getEnvVar([
        "ARKESEL_API_KEY",
        "VITE_ARKESEL_API_KEY",
        "ARKESEL_KEY",
        "arkesel_api_key",
      ])
    );
    if (!arkeselKey && sMap.arkesel_api_key) arkeselKey = cleanApiKey(sMap.arkesel_api_key);
    if (!arkeselKey && sMap.ARKESEL_API_KEY) arkeselKey = cleanApiKey(sMap.ARKESEL_API_KEY);

    let senderId = (
      sMap.arkesel_sender_id ||
      sMap.ARKESEL_SENDER_ID ||
      process.env.ARKESEL_SENDER_ID ||
      "D_1Gh"
    ).trim();
    if (!senderId) { senderId = "D_1Gh"; }
    senderId = senderId.slice(0, 11);

    const cleanRecipient = recipientPhone
      ? recipientPhone.startsWith("233")
        ? `0${recipientPhone.slice(3)}`
        : recipientPhone
      : "N/A";
    const pkg = `${network || ""} ${capacity || ""}`.trim() || "Data Bundle";
    const numAmount = Number(amount) || 0;
    const formattedAmount = numAmount.toFixed(2);
    const timeStr = new Date().toLocaleTimeString("en-GB", {
      timeZone: "Africa/Accra",
      hour: "2-digit",
      minute: "2-digit",
    });

    // 1. Dispatch SMS directly to Admin (ONLY to 0592753424, never 0547100951)
    let smsSent = false;
    let smsErr: string | undefined;
    if (arkeselKey && adminSmsPhones.length > 0) {
      const smsMessage = `URGENT: Order ${reference} (${pkg} for ${cleanRecipient}) FAILED due to LOW PROVIDER BALANCE on DataMart. Please top up wallet & process manually. - Data1GH`;
      for (const aPhone of adminSmsPhones) {
        const res = await dispatchArkeselSms(arkeselKey, senderId, aPhone, smsMessage);
        if (res.ok) smsSent = true;
        else smsErr = res.error;
      }
    }

    // 2. Dispatch WhatsApp Dual Alert
    const waToken =
      cleanApiKey(process.env.ACCESS_TOKEN) ||
      cleanApiKey(process.env.WHATSAPP_ACCESS_TOKEN) ||
      cleanApiKey(sMap.whatsapp_access_token) ||
      cleanApiKey(sMap.ACCESS_TOKEN);

    const waPhoneId =
      cleanApiKey(process.env.PHONE_ID) ||
      cleanApiKey(process.env.WHATSAPP_PHONE_NUMBER_ID) ||
      cleanApiKey(sMap.whatsapp_phone_id) ||
      cleanApiKey(sMap.PHONE_ID);

    let whatsappSent = false;
    if (waToken && waPhoneId && adminWhatsAppPhones.length > 0) {
      const waAlertText =
`🚨 *URGENT: FAILED ORDER — LOW PROVIDER BALANCE* 🚨
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ An order could NOT be dispatched to DataMart because your provider wallet balance is insufficient!

🆔 *Order Ref:* ${reference}
📱 *Recipient:* ${cleanRecipient}
📶 *Package:* ${pkg}
💰 *Amount:* GH₵ ${formattedAmount}
⚠️ *Reason:* ${errorMessage || "Insufficient Provider Balance"}
⏰ *Time:* ${timeStr}

👉 *Action Required:*
1. Log in to DataMart (datamartgh.shop) & top up your developer wallet.
2. Go to Admin Dashboard > Orders to process this order manually!`;

      for (const waPhone of adminWhatsAppPhones) {
        try {
          const waRes = await fetch(`https://graph.facebook.com/v20.0/${waPhoneId}/messages`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${waToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              messaging_product: "whatsapp",
              to: waPhone,
              type: "text",
              text: { body: waAlertText },
            }),
          });
          if (waRes.ok) whatsappSent = true;
        } catch (waErr) {
          console.warn("Low balance failed order WhatsApp alert error:", waErr);
        }
      }
    }

    return {
      ok: smsSent || whatsappSent,
      smsSent,
      whatsappSent,
      details: smsSent ? "SMS alert sent to admin" : smsErr || "Alert dispatched",
    };
  } catch (err: any) {
    console.error("sendAdminLowBalanceOrderFailedAlert error:", err);
    return { ok: false, smsSent: false, whatsappSent: false, details: err?.message };
  }
}

// In-memory set to deduplicate incomplete payment customer SMS
const customerIncompleteNotifiedRefs = new Set<string>();

export interface PaymentIncompleteCustomerParams {
  reference: string;
  momoPhone?: string | null;
  customerPhone?: string | null;
  recipientPhone?: string | null;
  amount?: number | string;
  itemDescription?: string;
  network?: string | null;
  capacity?: string | null;
  reason?: "low_balance" | "abandoned" | "failed" | string;
  gatewayResponse?: string | null;
  storeName?: string | null;
  shopUrl?: string | null;
  agentId?: string | null;
  storeSlug?: string | null;
}

export function extractPaystackMomoPhone(psTxData: any, order?: any): string {
  const candidates = [
    psTxData?.authorization?.mobile_money_number,
    psTxData?.authorization?.bin && /^0\d{9}$|^233\d{9}$/.test(String(psTxData.authorization.bin)) ? psTxData.authorization.bin : "",
    psTxData?.authorization?.account_name && /^0\d{9}$|^233\d{9}$/.test(String(psTxData.authorization.account_name)) ? psTxData.authorization.account_name : "",
    psTxData?.customer?.phone,
    psTxData?.metadata?.momo_number,
    psTxData?.metadata?.customer_phone,
    psTxData?.metadata?.recipient_phone,
    order?.momo_number,
    order?.customer_phone,
    order?.recipient_phone,
    order?.phone_number,
    order?.phone,
    order?.whatsapp_phone,
  ];
  for (const c of candidates) {
    if (!c) continue;
    const digits = String(c).replace(/\D/g, "");
    if (digits.length >= 9 && digits.length <= 15) {
      return String(c).trim();
    }
  }
  return "";
}

/**
 * Dispatches an automated SMS to the customer's phone when a Paystack MoMo payment
 * is incomplete, declined, has low balance, or was abandoned/interrupted.
 * Includes explanation and direct link to complete payment on the tracking page.
 */
export async function sendPaymentIncompleteCustomerSms(
  params: PaymentIncompleteCustomerParams,
  customSupabase?: any
): Promise<{ ok: boolean; error?: string; message?: string }> {
  try {
    const {
      reference,
      momoPhone,
      customerPhone,
      amount,
      itemDescription,
      network,
      capacity,
      reason,
      gatewayResponse,
      storeName,
      shopUrl,
    } = params;

    if (!reference) return { ok: false, error: "Missing reference" };

    let supabase = customSupabase;
    if (!supabase) {
      try {
        supabase = getSupabase();
      } catch (_) {}
    }

    // Database lookup for fallback details and deduplication check
    let ord: any = null;
    if (supabase) {
      try {
        const { data: ordRow } = await supabase
          .from("orders")
          .select("id, notes, payment_status, agent_id, store_name, customer_phone, recipient_phone, amount, capacity, network")
          .eq("reference", reference)
          .maybeSingle();
        ord = ordRow;

        // If order is already paid, do not send incomplete SMS!
        if (ord?.payment_status === "paid") {
          return { ok: false, error: "Order is already paid" };
        }

        if (ord?.notes && ord.notes.includes("[incomplete_sms_sent]")) {
          return { ok: false, error: "Customer already received incomplete SMS for this order" };
        }
      } catch (e: any) {
        console.warn("Deduplication check note for incomplete SMS:", e?.message);
      }
    }

    // Resolve target phone number: MoMo / payer number first, then order recipient phone
    const targetPhone = momoPhone || customerPhone || params.recipientPhone || ord?.recipient_phone || ord?.customer_phone;
    if (!targetPhone) return { ok: false, error: "Missing customer phone number" };

    const cleanRecipient = formatPhoneForArkesel(targetPhone);
    if (!cleanRecipient || cleanRecipient.length < 10) {
      return { ok: false, error: "Invalid customer phone number" };
    }

    // In-memory deduplication check
    if (customerIncompleteNotifiedRefs.has(reference)) {
      return { ok: false, error: "Customer already notified for this transaction reference" };
    }

    // Resolve Arkesel API key & Sender ID
    let sMap: Record<string, string> = {};
    if (supabase) {
      try {
        const { data: sRows } = await supabase
          .from("settings")
          .select("key, value")
          .in("key", [
            "arkesel_api_key",
            "ARKESEL_API_KEY",
            "arkesel_key",
            "ARKESEL_KEY",
            "arkesel_sender_id",
            "ARKESEL_SENDER_ID",
            "shop_name",
            "site_url",
          ]);
        for (const row of sRows || []) {
          if (row?.key && row?.value) sMap[row.key] = row.value;
        }
      } catch (_) {}
    }

    let arkeselKey = cleanApiKey(
      getEnvVar([
        "ARKESEL_API_KEY",
        "VITE_ARKESEL_API_KEY",
        "ARKESEL_KEY",
        "arkesel_api_key",
        "arkesel_key",
      ])
    );
    if (!arkeselKey && sMap.arkesel_api_key) arkeselKey = cleanApiKey(sMap.arkesel_api_key);
    if (!arkeselKey && sMap.ARKESEL_API_KEY) arkeselKey = cleanApiKey(sMap.ARKESEL_API_KEY);
    if (!arkeselKey && sMap.arkesel_key) arkeselKey = cleanApiKey(sMap.arkesel_key);
    if (!arkeselKey && sMap.ARKESEL_KEY) arkeselKey = cleanApiKey(sMap.ARKESEL_KEY);

    // Fallback: check Data1DB local memory store if remote Supabase RLS blocked key read
    if (!arkeselKey) {
      try {
        const { data1db } = await import("./_supabase.js");
        const localSettings = data1db.loadTable("settings");
        for (const s of localSettings || []) {
          const lk = String(s.key || "").toLowerCase();
          if ((lk === "arkesel_api_key" || lk === "arkesel_key") && s.value) {
            const c = cleanApiKey(s.value);
            if (c) { arkeselKey = c; break; }
          }
        }
      } catch (_) {}
    }

    let senderId = (
      sMap.arkesel_sender_id ||
      sMap.ARKESEL_SENDER_ID ||
      process.env.ARKESEL_SENDER_ID ||
      "D_1Gh"
    ).trim();
    if (!senderId) { senderId = "D_1Gh"; }
    senderId = senderId.slice(0, 11);

    // Extract agent identifier and store name from order row or notes
    let resolvedAgentId = (params.agentId || ord?.agent_id || "").trim();
    let rawStoreName = (storeName || ord?.store_name || "").trim();

    if (ord?.notes) {
      if (!resolvedAgentId) {
        const m = String(ord.notes).match(/\[agent:([^\]]+)\]/);
        if (m) resolvedAgentId = m[1].trim();
      }
      if (!rawStoreName) {
        const sm = String(ord.notes).match(/\[store:([^\]]+)\]/);
        if (sm) rawStoreName = sm[1].trim();
      }
    }

    const isAgent = Boolean(
      resolvedAgentId ||
      (rawStoreName &&
        rawStoreName.toLowerCase() !== "data1gh" &&
        rawStoreName.toLowerCase() !== "dataone gh" &&
        rawStoreName.toLowerCase() !== "data 1 gh")
    );

    let resolvedSlug = (params.storeSlug || "").trim();
    let agentCustomDomain = "";

    if (isAgent && supabase) {
      try {
        // 1. Look up in agents table by ID or store_slug
        if (resolvedAgentId && !resolvedSlug) {
          const { data: ag } = await supabase
            .from("agents")
            .select("store_slug, custom_domain, store_name")
            .or(`id.eq.${resolvedAgentId},store_slug.eq.${resolvedAgentId}`)
            .maybeSingle();
          if (ag) {
            if (ag.store_slug) resolvedSlug = ag.store_slug;
            if (ag.custom_domain) agentCustomDomain = ag.custom_domain;
            if (!rawStoreName && ag.store_name) rawStoreName = ag.store_name;
          }
        }

        // 2. Look up in agents table by store_name
        if (!resolvedSlug && rawStoreName) {
          const { data: agByName } = await supabase
            .from("agents")
            .select("store_slug, custom_domain, store_name")
            .ilike("store_name", rawStoreName)
            .maybeSingle();
          if (agByName) {
            if (agByName.store_slug) resolvedSlug = agByName.store_slug;
            if (agByName.custom_domain) agentCustomDomain = agByName.custom_domain;
          }
        }

        // 3. Check settings agents_registry JSON
        if (!resolvedSlug) {
          const { data: regRow } = await supabase
            .from("settings")
            .select("value")
            .eq("key", "agents_registry")
            .maybeSingle();
          if (regRow?.value) {
            const list = JSON.parse(regRow.value);
            if (Array.isArray(list)) {
              const matchedAgent = list.find((a: any) =>
                (resolvedAgentId && (a.id === resolvedAgentId || a.store_slug === resolvedAgentId)) ||
                (rawStoreName && a.store_name && a.store_name.toLowerCase().trim() === rawStoreName.toLowerCase().trim())
              );
              if (matchedAgent) {
                if (matchedAgent.store_slug) resolvedSlug = matchedAgent.store_slug;
                if (matchedAgent.custom_domain) agentCustomDomain = matchedAgent.custom_domain;
                if (!rawStoreName && matchedAgent.store_name) rawStoreName = matchedAgent.store_name;
              }
            }
          }
        }
      } catch (err) {
        console.warn("Agent slug resolution warning:", err);
      }
    }

    // Fallback slug generation from store name if not found in DB
    if (isAgent && !resolvedSlug && rawStoreName) {
      resolvedSlug = rawStoreName
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, "")
        .replace(/[\s_-]+/g, "-")
        .replace(/^-+|-+$/g, "");
    }

    let trackUrl = "";
    if (isAgent) {
      const baseDomain = (
        agentCustomDomain ||
        shopUrl ||
        "https://gooddata1.vercel.app"
      ).trim().replace(/\/+$/, "");

      // For agent orders, link to their dedicated store: https://gooddata1.vercel.app/s/<slug>?ref=...
      if (resolvedSlug) {
        trackUrl = `${baseDomain}/s/${resolvedSlug}?ref=${encodeURIComponent(reference)}`;
      } else {
        trackUrl = `https://www.data1gh.com/track?ref=${encodeURIComponent(reference)}`;
      }
    } else {
      // Main site orders always use official tracking page https://www.data1gh.com/track
      trackUrl = `https://www.data1gh.com/track?ref=${encodeURIComponent(reference)}`;
    }

    const brand = isAgent
      ? (rawStoreName || "Agent Store").trim()
      : (sMap.shop_name || "Data1GH").trim();

    const numAmount = Number(amount || ord?.amount) || 0;
    const formattedAmount = numAmount > 0 ? numAmount.toFixed(2) : "";

    const respLower = String(gatewayResponse || "").toLowerCase();
    const reasonLower = String(reason || "").toLowerCase();

    const isLowBalance =
      reasonLower === "low_balance" ||
      respLower.includes("low balance") ||
      respLower.includes("insufficient") ||
      respLower.includes("not enough") ||
      respLower.includes("balance is not sufficient");

    const isAbandoned =
      reasonLower === "abandoned" ||
      respLower.includes("abandon") ||
      respLower.includes("cancel") ||
      respLower.includes("timeout") ||
      respLower.includes("declined");

    let smsBody = "";
    if (isLowBalance) {
      smsBody = formattedAmount
        ? `Dear customer, your payment of GHS ${formattedAmount} (Ref: ${reference}) could not complete due to low MoMo wallet balance. Top up your wallet & complete here: ${trackUrl} - ${brand}`
        : `Dear customer, your payment (Ref: ${reference}) could not complete due to low MoMo wallet balance. Top up your wallet & complete here: ${trackUrl} - ${brand}`;
    } else if (isAbandoned) {
      smsBody = formattedAmount
        ? `Dear customer, your payment of GHS ${formattedAmount} (Ref: ${reference}) was not completed. Tap here to complete your order: ${trackUrl} - ${brand}`
        : `Dear customer, your payment (Ref: ${reference}) was not completed. Tap here to complete: ${trackUrl} - ${brand}`;
    } else {
      smsBody = formattedAmount
        ? `Dear customer, your payment of GHS ${formattedAmount} (Ref: ${reference}) was not completed. Tap here to retry and complete: ${trackUrl} - ${brand}`
        : `Dear customer, your payment (Ref: ${reference}) was not completed. Tap here to complete: ${trackUrl} - ${brand}`;
    }

    if (!arkeselKey) {
      const configErr = "Arkesel SMS API key not configured in settings or environment";
      logSmsNotification(supabase, {
        recipient: cleanRecipient,
        message: smsBody,
        senderId,
        reference,
        status: "failed",
        error: configErr,
        type: "payment_issue",
      }).catch(() => {});
      return { ok: false, error: configErr };
    }

    const res = await dispatchArkeselSms(arkeselKey, senderId, cleanRecipient, smsBody);

    // Log the notification to sms_logs with 24-hr retention
    logSmsNotification(supabase, {
      recipient: cleanRecipient,
      message: smsBody,
      senderId,
      reference,
      status: res.ok ? "sent" : "failed",
      error: res.ok ? null : (res.error || "Arkesel rejected SMS message"),
      type: "payment_issue",
    }).catch(() => {});

    if (res.ok) {
      customerIncompleteNotifiedRefs.add(reference);
      if (supabase && ord?.id) {
        try {
          const updatedNotes = `${ord.notes || ""} [incomplete_sms_sent]`.trim();
          await supabase.from("orders").update({ notes: updatedNotes }).eq("id", ord.id);
        } catch (_) {}
      }
    }
    return { ok: res.ok, error: res.error, message: smsBody };
  } catch (err: any) {
    console.error("sendPaymentIncompleteCustomerSms error:", err);
    return { ok: false, error: err?.message };
  }
}


// In-memory set to deduplicate spin winner alerts to admin
const notifiedSpinWinners = new Set<string>();

export interface SpinWinnerAlertParams {
  winnerPhone: string;
  prizeCapacity: string;
  code: string;
  referralsCount: number;
}

export async function sendAdminSpinWinnerAlert(
  params: SpinWinnerAlertParams,
  customSupabase?: any
): Promise<{ ok: boolean; smsSent: boolean; whatsappSent: boolean; details?: string }> {
  const { winnerPhone, prizeCapacity, code, referralsCount } = params;
  if (!code || !winnerPhone) {
    return { ok: false, smsSent: false, whatsappSent: false, details: "Missing code or winner phone" };
  }

  // Prevent duplicate alerts for the same winning code
  if (notifiedSpinWinners.has(code)) {
    return { ok: true, smsSent: false, whatsappSent: false, details: "Already alerted for this winner" };
  }
  notifiedSpinWinners.add(code);
  if (notifiedSpinWinners.size > 500) {
    const first = notifiedSpinWinners.values().next().value;
    if (first) notifiedSpinWinners.delete(first);
  }

  try {
    const supabase = customSupabase || getSupabase();
    let sMap: Record<string, string> = {};
    if (supabase) {
      try {
        const { data: sRows } = await supabase
          .from("settings")
          .select("key, value")
          .in("key", [
            "admin_alert_phone",
            "support_phone",
            "admin_payment_alert_phone",
            "admin_whatsapp_number",
            "arkesel_api_key",
            "ARKESEL_API_KEY",
            "arkesel_sender_id",
            "ARKESEL_SENDER_ID",
            "whatsapp_access_token",
            "whatsapp_phone_id",
            "ACCESS_TOKEN",
            "PHONE_ID",
            "whatsapp_token",
            "whatsapp_phone_number_id",
            "meta_whatsapp_token",
            "META_WHATSAPP_TOKEN",
            "META_ACCESS_TOKEN",
            "meta_access_token",
            "WHATSAPP_ACCESS_TOKEN",
            "WHATSAPP_PHONE_NUMBER_ID",
            "WHATSAPP_PHONE_ID",
          ]);
        if (sRows) {
          sMap = Object.fromEntries(sRows.map((r: any) => [r.key, r.value]));
        }
      } catch (err) {
        console.warn("Could not query settings for spin winner alert:", err);
      }
    }

    const candidateWhatsAppPhones = [
      process.env.ADMIN_WHATSAPP_NUMBER,
      process.env.ADMIN_ALERT_PHONE,
      sMap.admin_whatsapp_number,
      sMap.admin_payment_alert_phone,
      sMap.admin_alert_phone,
      sMap.support_phone,
      ADMIN_WHATSAPP_ONLY_PHONE,
      "0547100951",
      "0599599254",
    ].filter(Boolean) as string[];

    const adminWhatsAppPhones = Array.from(
      new Set(candidateWhatsAppPhones.map(formatPhoneForWhatsApp).filter(Boolean))
    );

    const adminSmsPhones = [
      sMap.admin_alert_phone ? formatPhoneForArkesel(sMap.admin_alert_phone) : null,
      formatPhoneForArkesel(ADMIN_PRIMARY_SMS_PHONE),
    ].filter(Boolean).filter((p) => !isBlockedFromAdminSms(p as string)) as string[];

    let arkeselKey = cleanApiKey(
      getEnvVar([
        "ARKESEL_API_KEY",
        "VITE_ARKESEL_API_KEY",
        "ARKESEL_KEY",
        "arkesel_api_key",
      ])
    );
    if (!arkeselKey && sMap.arkesel_api_key) arkeselKey = cleanApiKey(sMap.arkesel_api_key);
    if (!arkeselKey && sMap.ARKESEL_API_KEY) arkeselKey = cleanApiKey(sMap.ARKESEL_API_KEY);

    let senderId = (
      sMap.arkesel_sender_id ||
      sMap.ARKESEL_SENDER_ID ||
      process.env.ARKESEL_SENDER_ID ||
      "D_1Gh"
    ).trim();
    if (!senderId) { senderId = "D_1Gh"; }
    senderId = senderId.slice(0, 11);

    const cleanWinner = winnerPhone.startsWith("233") ? ("0" + winnerPhone.slice(3)) : winnerPhone;
    const gigStr = `${prizeCapacity}GB`;

    // 1. Dispatch SMS alert
    let smsSent = false;
    let smsErr: string | undefined;
    if (arkeselKey && adminSmsPhones.length > 0) {
      const smsMessage = `DATA1GH ALERT: Spin & Win winner! ${cleanWinner} won ${gigStr} (${referralsCount}/5 orders completed). Code: ${code}. Please deliver manually!`;
      for (const aPhone of adminSmsPhones) {
        try {
          const res = await dispatchArkeselSms(arkeselKey, senderId, aPhone, smsMessage);
          if (res.ok) smsSent = true;
          else smsErr = res.error;
        } catch (e: any) {
          smsErr = e?.message;
        }
      }
    }

    // 2. Dispatch WhatsApp Alert
    const waToken =
      cleanApiKey(process.env.ACCESS_TOKEN) ||
      cleanApiKey(process.env.WHATSAPP_ACCESS_TOKEN) ||
      cleanApiKey(process.env.META_ACCESS_TOKEN) ||
      cleanApiKey(process.env.META_WHATSAPP_TOKEN) ||
      cleanApiKey(sMap.whatsapp_access_token) ||
      cleanApiKey(sMap.ACCESS_TOKEN) ||
      cleanApiKey(sMap.whatsapp_token) ||
      cleanApiKey(sMap.meta_whatsapp_token) ||
      cleanApiKey(sMap.META_ACCESS_TOKEN);

    const waPhoneId =
      cleanApiKey(process.env.PHONE_ID) ||
      cleanApiKey(process.env.WHATSAPP_PHONE_NUMBER_ID) ||
      cleanApiKey(process.env.WHATSAPP_PHONE_ID) ||
      cleanApiKey(sMap.whatsapp_phone_id) ||
      cleanApiKey(sMap.PHONE_ID) ||
      cleanApiKey(sMap.whatsapp_phone_number_id) ||
      cleanApiKey(sMap.WHATSAPP_PHONE_NUMBER_ID) ||
      cleanApiKey(sMap.WHATSAPP_PHONE_ID);

    let whatsappSent = false;
    if (waToken && waPhoneId && adminWhatsAppPhones.length > 0) {
      const waAlertText =
`🎉 *SPIN & WIN COMPLETED! (5/5 REFERRALS)* 🎉
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
A customer has reached *5/5* referral orders on Spin & Win!

📱 *Winner Phone:* ${cleanWinner}
🎁 *Prize Won:* *${gigStr}*
🎟️ *Spin Code:* ${code}
👥 *Referrals:* ${referralsCount}/5 completed

⚠️ *Automatic data delivery is STOPPED.*
👉 Please manually send the *${gigStr}* data bundle to *${cleanWinner}*.
👉 Then open Admin Dashboard > Spin & Win Report to mark it as sent!`;

      for (const waPhone of adminWhatsAppPhones) {
        try {
          const waRes = await fetch(`https://graph.facebook.com/v20.0/${waPhoneId}/messages`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${waToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              messaging_product: "whatsapp",
              to: waPhone,
              type: "text",
              text: { body: waAlertText },
            }),
          });
          if (waRes.ok) {
            whatsappSent = true;
          } else {
            const errText = await waRes.text().catch(() => "");
            console.warn("Spin winner WhatsApp alert failed:", waRes.status, errText);
          }
        } catch (waErr) {
          console.warn("Spin winner WhatsApp alert error:", waErr);
        }
      }
    }

    return { ok: smsSent || whatsappSent, smsSent, whatsappSent, details: smsErr };
  } catch (err: any) {
    console.error("sendAdminSpinWinnerAlert error:", err);
    return { ok: false, smsSent: false, whatsappSent: false, details: err?.message };
  }
}


export interface AgentReferralWinnerAlertParams {
  customerPhone: string;
  agentName: string;
  agentSlug?: string;
  referralCode?: string;
  referralsCount: number;
}

export async function sendAdminAgentReferralWinnerAlert(
  params: AgentReferralWinnerAlertParams,
  customSupabase?: any
): Promise<{ ok: boolean; smsSent: boolean; whatsappSent: boolean; details?: string }> {
  const { customerPhone, agentName, agentSlug, referralCode, referralsCount } = params;
  if (!customerPhone) {
    return { ok: false, smsSent: false, whatsappSent: false, details: "Missing customer phone" };
  }

  try {
    const supabase = customSupabase || getSupabase();
    let sMap: Record<string, string> = {};
    if (supabase) {
      try {
        const { data: sRows } = await supabase
          .from("settings")
          .select("key, value")
          .in("key", [
            "admin_alert_phone",
            "support_phone",
            "admin_payment_alert_phone",
            "admin_whatsapp_number",
            "arkesel_api_key",
            "ARKESEL_API_KEY",
            "arkesel_sender_id",
            "ARKESEL_SENDER_ID",
            "whatsapp_access_token",
            "whatsapp_phone_id",
            "ACCESS_TOKEN",
            "PHONE_ID",
            "whatsapp_token",
            "whatsapp_phone_number_id",
            "meta_whatsapp_token",
            "META_WHATSAPP_TOKEN",
            "META_ACCESS_TOKEN",
            "meta_access_token",
            "WHATSAPP_ACCESS_TOKEN",
            "WHATSAPP_PHONE_NUMBER_ID",
            "WHATSAPP_PHONE_ID",
          ]);
        if (sRows) {
          sMap = Object.fromEntries(sRows.map((r: any) => [r.key, r.value]));
        }
      } catch (err) {
        console.warn("Could not query settings for agent referral winner alert:", err);
      }
    }

    const candidateWhatsAppPhones = [
      process.env.ADMIN_WHATSAPP_NUMBER,
      process.env.ADMIN_ALERT_PHONE,
      sMap.admin_whatsapp_number,
      sMap.admin_payment_alert_phone,
      sMap.admin_alert_phone,
      sMap.support_phone,
      ADMIN_WHATSAPP_ONLY_PHONE,
      "0547100951",
      "0599599254",
    ].filter(Boolean) as string[];

    const adminWhatsAppPhones = Array.from(
      new Set(candidateWhatsAppPhones.map(formatPhoneForWhatsApp).filter(Boolean))
    );

    const adminSmsPhones = [
      sMap.admin_alert_phone ? formatPhoneForArkesel(sMap.admin_alert_phone) : null,
      formatPhoneForArkesel(ADMIN_PRIMARY_SMS_PHONE),
    ].filter(Boolean).filter((p) => !isBlockedFromAdminSms(p as string)) as string[];

    let arkeselKey = cleanApiKey(
      getEnvVar([
        "ARKESEL_API_KEY",
        "VITE_ARKESEL_API_KEY",
        "ARKESEL_KEY",
        "arkesel_api_key",
      ])
    );
    if (!arkeselKey && sMap.arkesel_api_key) arkeselKey = cleanApiKey(sMap.arkesel_api_key);
    if (!arkeselKey && sMap.ARKESEL_API_KEY) arkeselKey = cleanApiKey(sMap.ARKESEL_API_KEY);

    let senderId = (
      sMap.arkesel_sender_id ||
      sMap.ARKESEL_SENDER_ID ||
      process.env.ARKESEL_SENDER_ID ||
      "D_1Gh"
    ).trim();
    if (!senderId) { senderId = "D_1Gh"; }
    senderId = senderId.slice(0, 11);

    const cleanCustomer = customerPhone.startsWith("233") ? ("0" + customerPhone.slice(3)) : customerPhone;

    // 1. Dispatch SMS alert
    let smsSent = false;
    let smsErr: string | undefined;
    if (arkeselKey && adminSmsPhones.length > 0) {
      const smsMessage = `DATA1GH ALERT: 5GB Agent Referral Reward! Customer ${cleanCustomer} referred ${referralsCount}/5 buyers on agent ${agentName}. Please send 5GB data manually!`;
      for (const aPhone of adminSmsPhones) {
        try {
          const res = await dispatchArkeselSms(arkeselKey, senderId, aPhone, smsMessage);
          if (res.ok) smsSent = true;
          else smsErr = res.error;
        } catch (e: any) {
          smsErr = e?.message;
        }
      }
    }

    // 2. Dispatch WhatsApp Alert
    const waToken =
      cleanApiKey(process.env.ACCESS_TOKEN) ||
      cleanApiKey(process.env.WHATSAPP_ACCESS_TOKEN) ||
      cleanApiKey(process.env.META_ACCESS_TOKEN) ||
      cleanApiKey(process.env.META_WHATSAPP_TOKEN) ||
      cleanApiKey(sMap.whatsapp_access_token) ||
      cleanApiKey(sMap.ACCESS_TOKEN) ||
      cleanApiKey(sMap.whatsapp_token) ||
      cleanApiKey(sMap.meta_whatsapp_token) ||
      cleanApiKey(sMap.META_ACCESS_TOKEN);

    const waPhoneId =
      cleanApiKey(process.env.PHONE_ID) ||
      cleanApiKey(process.env.WHATSAPP_PHONE_NUMBER_ID) ||
      cleanApiKey(process.env.WHATSAPP_PHONE_ID) ||
      cleanApiKey(sMap.whatsapp_phone_id) ||
      cleanApiKey(sMap.PHONE_ID) ||
      cleanApiKey(sMap.whatsapp_phone_number_id) ||
      cleanApiKey(sMap.WHATSAPP_PHONE_NUMBER_ID) ||
      cleanApiKey(sMap.WHATSAPP_PHONE_ID);

    let whatsappSent = false;
    if (waToken && waPhoneId && adminWhatsAppPhones.length > 0) {
      const waAlertText =
`🎁 *NEW 5GB REFERRAL REWARD COMPLETED!* 🎁
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
A customer has reached *5/5* referred buyers on an Agent Storefront!

📱 *Customer Phone:* ${cleanCustomer}
🏪 *Agent Store:* ${agentName} (${agentSlug ? "@" + agentSlug : "N/A"})
👥 *Referrals Completed:* ${referralsCount}/5 buyers
🎟️ *Referral Code:* ${referralCode || cleanCustomer}

⚠️ *Note: Automatic fulfillment is NOT enabled.*
👉 Please manually send *5GB* data to ${cleanCustomer}.
👉 The record has also been logged in the Agent's Dashboard!`;

      for (const waPhone of adminWhatsAppPhones) {
        try {
          const waRes = await fetch(`https://graph.facebook.com/v20.0/${waPhoneId}/messages`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${waToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              messaging_product: "whatsapp",
              to: waPhone,
              type: "text",
              text: { body: waAlertText },
            }),
          });
          if (waRes.ok) {
            whatsappSent = true;
          } else {
            const errText = await waRes.text().catch(() => "");
            console.warn("Agent referral WhatsApp alert failed:", waRes.status, errText);
          }
        } catch (waErr) {
          console.warn("Agent referral WhatsApp alert error:", waErr);
        }
      }
    }

    return { ok: smsSent || whatsappSent, smsSent, whatsappSent, details: smsErr };
  } catch (err: any) {
    console.error("sendAdminAgentReferralWinnerAlert error:", err);
    return { ok: false, smsSent: false, whatsappSent: false, details: err?.message };
  }
}

export interface AgentOrderAlertParams {
  agentId: string;
  orderReference: string;
  itemDescription: string;
  recipientPhone: string;
  sellingPrice: number;
  agentProfit: number;
  deliveryStatus?: string;
  agentStoreName?: string;
  agentWhatsAppNumber?: string;
  isTest?: boolean;
}

const agentNewOrderNotifiedRefs = new Set<string>();

/**
 * Sends an instant WhatsApp order notification directly to the Agent
 * whenever a customer purchases from their storefront.
 */
export async function sendAgentOrderWhatsAppAlert(
  params: AgentOrderAlertParams,
  customSupabase?: any
): Promise<{ ok: boolean; whatsappSent: boolean; details?: string; targetPhone?: string }> {
  const {
    agentId,
    orderReference = "TEST-REF",
    itemDescription = "Data Bundle",
    recipientPhone = "",
    sellingPrice = 0,
    agentProfit = 0,
    deliveryStatus = "processing",
    agentStoreName = "",
    agentWhatsAppNumber = "",
    isTest = false,
  } = params;

  if (!agentId) {
    return { ok: false, whatsappSent: false, details: "Agent ID required" };
  }

  const refKey = String(orderReference || "").trim().toUpperCase();
  if (!isTest && refKey && refKey !== "TEST-REF") {
    if (agentNewOrderNotifiedRefs.has(refKey)) {
      return { ok: true, whatsappSent: false, details: "Agent already notified for this reference" };
    }
    agentNewOrderNotifiedRefs.add(refKey);
    if (agentNewOrderNotifiedRefs.size > 1000) {
      const first = agentNewOrderNotifiedRefs.values().next().value;
      if (first) agentNewOrderNotifiedRefs.delete(first);
    }
  }

  try {
    const supabase = customSupabase || getSupabase();
    if (!supabase) {
      return { ok: false, whatsappSent: false, details: "Supabase client not available" };
    }

    // Atomic deduplication check on orders.notes ([agent_wa_alert_sent]) and profit resolution
    let resolvedProfit = Number(agentProfit || 0);
    if (!isTest && refKey && refKey !== "TEST-REF") {
      try {
        const { data: ordRow } = await supabase
          .from("orders")
          .select("id, notes, amount, base_price")
          .eq("reference", orderReference)
          .maybeSingle();
        if (ordRow) {
          const curNotes = String(ordRow.notes || "");
          if (curNotes.includes("[agent_wa_alert_sent]")) {
            return { ok: true, whatsappSent: false, details: "Agent already notified ([agent_wa_alert_sent])" };
          }
          if (!resolvedProfit && ordRow.base_price && Number(ordRow.amount) > Number(ordRow.base_price)) {
            resolvedProfit = Math.max(0, Number(ordRow.amount) - Number(ordRow.base_price));
          }
          const nextNotes = `${curNotes} [agent_wa_alert_sent]`.trim();
          await supabase.from("orders").update({ notes: nextNotes }).eq("id", ordRow.id);
        }
        if (!resolvedProfit) {
          const { data: aoRow } = await supabase
            .from("agent_orders")
            .select("profit")
            .eq("reference", orderReference)
            .maybeSingle();
          if (aoRow?.profit !== undefined && Number(aoRow.profit) > 0) {
            resolvedProfit = Number(aoRow.profit);
          }
        }
      } catch (_) {}
    }

    // 1. Fetch Agent details
    let targetPhone = agentWhatsAppNumber ? String(agentWhatsAppNumber).trim() : "";
    let storeName = agentStoreName || "Agent Store";
    let storeSlug = "";

    try {
      const { data: ag } = await supabase
        .from("agents")
        .select("id, name, phone, whatsapp_number, momo_number, store_name, store_slug, status")
        .or(`id.eq.${agentId},store_slug.ilike.${agentId}`)
        .maybeSingle();

      if (ag) {
        if (!targetPhone) {
          targetPhone = String(ag.whatsapp_number || ag.phone || ag.momo_number || "").trim();
        }
        if (!storeName || storeName === "Agent Store") {
          storeName = ag.store_name || ag.name || "Agent Store";
        }
        storeSlug = ag.store_slug || "";
      }
      if (!targetPhone) {
        const { data: regRow } = await supabase
          .from("settings")
          .select("value")
          .eq("key", "agents_registry")
          .maybeSingle();
        if (regRow?.value) {
          const parsed = typeof regRow.value === "string" ? JSON.parse(regRow.value) : regRow.value;
          if (Array.isArray(parsed)) {
            const matchedAg = parsed.find(
              (a: any) =>
                a.id === agentId ||
                (a.store_slug && String(a.store_slug).toLowerCase() === String(agentId).toLowerCase())
            );
            if (matchedAg) {
              targetPhone = String(matchedAg.whatsapp_number || matchedAg.phone || matchedAg.momo_number || "").trim();
              if (!storeName || storeName === "Agent Store") {
                storeName = matchedAg.store_name || matchedAg.name || "Agent Store";
              }
              storeSlug = matchedAg.store_slug || storeSlug;
            }
          }
        }
      }
    } catch (err) {
      console.warn("Could not load agent for WhatsApp order alert:", err);
    }

    // Check agent notification settings override if present
    try {
      const { data: nSet } = await supabase
        .from("settings")
        .select("value")
        .eq("key", `agent_notifications_${agentId}`)
        .maybeSingle();
      if (nSet?.value) {
        const parsed = typeof nSet.value === "string" ? JSON.parse(nSet.value) : nSet.value;
        if (parsed?.whatsapp_number) targetPhone = String(parsed.whatsapp_number).trim();
        if (parsed?.enabled === false && !isTest) {
          return { ok: true, whatsappSent: false, details: "Agent disabled WhatsApp alerts" };
        }
      }
    } catch (_) {}

    if (!targetPhone) {
      return { ok: false, whatsappSent: false, details: "No WhatsApp number configured for agent" };
    }

    const cleanRecipient = recipientPhone
      ? recipientPhone.startsWith("233")
        ? `0${recipientPhone.slice(3)}`
        : recipientPhone
      : "N/A";
    const waPhone = formatPhoneForWhatsApp(targetPhone);

    // 2. Resolve WhatsApp Meta Cloud API credentials
    let sMap: Record<string, string> = {};
    try {
      const { data: sRows } = await supabase
        .from("settings")
        .select("key, value")
        .in("key", [
          "whatsapp_access_token",
          "whatsapp_phone_id",
          "ACCESS_TOKEN",
          "PHONE_ID",
          "whatsapp_token",
          "whatsapp_phone_number_id",
          "meta_whatsapp_token",
          "META_WHATSAPP_TOKEN",
          "META_ACCESS_TOKEN",
          "meta_access_token",
          "WHATSAPP_ACCESS_TOKEN",
          "WHATSAPP_PHONE_NUMBER_ID",
          "WHATSAPP_PHONE_ID",
        ]);
      if (sRows) {
        sMap = Object.fromEntries(sRows.map((r: any) => [r.key, r.value]));
      }
    } catch (_) {}

    const waToken =
      cleanApiKey(process.env.ACCESS_TOKEN) ||
      cleanApiKey(process.env.WHATSAPP_ACCESS_TOKEN) ||
      cleanApiKey(process.env.META_ACCESS_TOKEN) ||
      cleanApiKey(process.env.META_WHATSAPP_TOKEN) ||
      cleanApiKey(sMap.whatsapp_access_token) ||
      cleanApiKey(sMap.ACCESS_TOKEN) ||
      cleanApiKey(sMap.whatsapp_token) ||
      cleanApiKey(sMap.meta_whatsapp_token) ||
      cleanApiKey(sMap.META_ACCESS_TOKEN);

    const waPhoneId =
      cleanApiKey(process.env.PHONE_ID) ||
      cleanApiKey(process.env.WHATSAPP_PHONE_NUMBER_ID) ||
      cleanApiKey(process.env.WHATSAPP_PHONE_ID) ||
      cleanApiKey(sMap.whatsapp_phone_id) ||
      cleanApiKey(sMap.PHONE_ID) ||
      cleanApiKey(sMap.whatsapp_phone_number_id) ||
      cleanApiKey(sMap.WHATSAPP_PHONE_NUMBER_ID) ||
      cleanApiKey(sMap.WHATSAPP_PHONE_ID);

    const dateStr = new Date().toLocaleDateString("en-GB", { timeZone: "Africa/Accra" });
    const timeStr = new Date().toLocaleTimeString("en-GB", { timeZone: "Africa/Accra" });

    let alertText = "";
    if (isTest) {
      alertText =
`🔔 *WHATSAPP ORDER ALERTS CONNECTED!* 🎉
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Hello *${storeName}*! Your WhatsApp bot order notifications are successfully connected and active!

✅ You will receive an instant notification here every time a customer completes an order on your storefront (*${storeName}*).
📈 Each alert includes the customer's bundle, recipient number, and your *profit*!

👉 Store: https://gooddata1.vercel.app/s/${storeSlug || agentId}
👉 Dashboard: https://www.data1gh.com/agent/dashboard`;
    } else {
      const profitDisplay = resolvedProfit > 0
        ? `💵 *Your Profit:* GH₵ ${resolvedProfit.toFixed(2)}`
        : `💵 *Your Profit:* Recorded in Wallet`;

      const agentDeliveryStatusObj = formatRealDeliveryStatus(deliveryStatus, null, null, "data");

      alertText =
`🎉 *NEW ORDER FROM YOUR STORE!* 🛍️
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Congratulations! A customer just placed an order on *${storeName}*!

🆔 *Order Ref:* ${orderReference}
📶 *Item:* ${itemDescription || "Data Bundle"}
📱 *Recipient:* ${cleanRecipient}
💰 *Customer Paid:* GH₵ ${Number(sellingPrice || 0).toFixed(2)}
${profitDisplay}
⚡ *Status:* ${agentDeliveryStatusObj.text}
⏰ *Time:* ${dateStr} ${timeStr}

Keep sharing your store link to grow your daily sales!
👉 View Dashboard: https://www.data1gh.com/agent/dashboard`;
    }

    let sentOk = false;
    let errText = "";

    if (waToken && waPhoneId) {
      try {
        const waRes = await fetch(`https://graph.facebook.com/v20.0/${waPhoneId}/messages`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${waToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: waPhone,
            type: "text",
            text: { body: alertText },
          }),
          signal: AbortSignal.timeout(6000),
        });
        if (waRes.ok) {
          sentOk = true;
        } else {
          errText = await waRes.text().catch(() => "");
        }
      } catch (e: any) {
        errText = e?.message || "Meta fetch failed";
      }
    }

    // Fallback to live Render WhatsApp bot if Meta Cloud API failed or credentials were not configured
    if (!sentOk) {
      try {
        const botUrl = process.env.WHATSAPP_BOT_SERVER_URL || "https://nestybot.onrender.com";
        const fbRes = await fetch(`${botUrl.replace(/\/+$/, "")}/api/send-admin-alert`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to: waPhone, text: alertText }),
          signal: AbortSignal.timeout(6000),
        });
        if (fbRes.ok) {
          sentOk = true;
        }
      } catch (_) {}
    }

    // Record in recent notifications log (deduplicated by order_ref)
    try {
      const notifKey = `agent_notif_log_${agentId}`;
      const { data: nLog } = await supabase.from("settings").select("value").eq("key", notifKey).maybeSingle();
      let logList: any[] = [];
      if (nLog?.value) {
        try {
          logList = typeof nLog.value === "string" ? JSON.parse(nLog.value) : nLog.value;
        } catch (_) {}
      }
      if (!Array.isArray(logList)) logList = [];
      logList = logList.filter((x: any) => isTest || x?.order_ref !== orderReference || x?.type === "order_delivered");
      logList.unshift({
        id: `notif_${Date.now()}`,
        type: "new_order",
        title: "🎉 NEW ORDER FROM YOUR STORE! 🛍️",
        order_ref: orderReference,
        reference: orderReference,
        item: itemDescription,
        recipient: cleanRecipient,
        profit: resolvedProfit,
        phone: targetPhone,
        is_test: Boolean(isTest),
        status: sentOk ? "delivered" : "logged",
        created_at: new Date().toISOString(),
      });
      if (logList.length > 50) logList = logList.slice(0, 50);
      await supabase.from("settings").upsert(
        {
          key: notifKey,
          value: JSON.stringify(logList),
        },
        { onConflict: "key" }
      );
    } catch (_) {}

    if (sentOk) {
      return { ok: true, whatsappSent: true, targetPhone };
    } else {
      console.warn("sendAgentOrderWhatsAppAlert failed:", errText);
      return { ok: false, whatsappSent: false, details: `WhatsApp API error: ${errText}` };
    }
  } catch (err: any) {
    console.error("sendAgentOrderWhatsAppAlert error:", err);
    return { ok: false, whatsappSent: false, details: err?.message };
  }
}

export interface OrderDeliveredNotificationParams {
  reference: string;
  amount?: number | string;
  itemDescription?: string;
  capacity?: string;
  network?: string;
  recipientPhone?: string | null;
  agentId?: string | null;
  agentStoreName?: string | null;
  storeName?: string | null;
  whatsappPhone?: string | null;
  isTest?: boolean;
}

const deliveredNotifiedReferences = new Set<string>();

/**
 * Sends a real-time WhatsApp delivery alert to Admin (and Agent) when an order
 * has been confirmed delivered to the recipient's phone by DataMart.
 */
export async function sendOrderDeliveredNotification(
  params: OrderDeliveredNotificationParams,
  customSupabase?: any
): Promise<{ ok: boolean; alreadyNotified?: boolean; adminWhatsAppSent?: boolean; error?: string }> {
  const { reference, isTest = false } = params;
  if (!reference) return { ok: false, error: "Missing reference" };

  const cleanRefKey = String(reference).trim().toUpperCase();
  if (!isTest && deliveredNotifiedReferences.has(cleanRefKey)) {
    return { ok: true, alreadyNotified: true };
  }
  if (!isTest) {
    deliveredNotifiedReferences.add(cleanRefKey);
    if (deliveredNotifiedReferences.size > 1000) {
      const first = deliveredNotifiedReferences.values().next().value;
      if (first) deliveredNotifiedReferences.delete(first);
    }
  }

  const supabase = customSupabase || getSupabase();
  let ordData: any = null;

  if (!isTest && supabase) {
    try {
      const { data: existingOrd } = await supabase
        .from("orders")
        .select("id, reference, notes, agent_id, capacity, network, amount, base_price, recipient_phone, phone_number, phone")
        .eq("reference", reference)
        .maybeSingle();

      if (existingOrd) {
        ordData = existingOrd;
        const currentNotes = existingOrd.notes;
        if (String(currentNotes || "").includes("[delivery_confirmed_sent]")) {
          return { ok: true, alreadyNotified: true };
        }
        // Atomic PostgreSQL Compare-And-Swap lock so concurrent Vercel + Render workers can NEVER both win
        const nextNotes = `${currentNotes || ""} [delivery_confirmed_sent]`.trim();
        let claimQuery = supabase
          .from("orders")
          .update({ notes: nextNotes })
          .eq("id", existingOrd.id);
        if (currentNotes === null || currentNotes === undefined) {
          claimQuery = claimQuery.is("notes", null);
        } else {
          claimQuery = claimQuery.eq("notes", currentNotes);
        }
        const { data: claimedRows, error: claimErr } = await claimQuery.select("id");
        if (claimErr || !claimedRows || claimedRows.length === 0) {
          return { ok: true, alreadyNotified: true };
        }
      }
    } catch (_) {}
  }

  try {
    let sMap: Record<string, string> = {};
    if (supabase) {
      try {
        const { data: sRows } = await supabase
          .from("settings")
          .select("key, value")
          .in("key", [
            "admin_alert_phone",
            "admin_whatsapp_number",
            "whatsapp_access_token",
            "whatsapp_phone_id",
            "ACCESS_TOKEN",
            "PHONE_ID",
            "whatsapp_token",
            "whatsapp_phone_number_id",
            "shop_name",
          ]);
        if (sRows) {
          sMap = Object.fromEntries(sRows.map((r: any) => [r.key, r.value]));
        }
      } catch (_) {}
    }

    const waToken =
      cleanApiKey(process.env.ACCESS_TOKEN) ||
      cleanApiKey(process.env.WHATSAPP_ACCESS_TOKEN) ||
      cleanApiKey(process.env.META_ACCESS_TOKEN) ||
      cleanApiKey(sMap.whatsapp_access_token) ||
      cleanApiKey(sMap.ACCESS_TOKEN) ||
      cleanApiKey(sMap.whatsapp_token);

    const waPhoneId =
      cleanApiKey(process.env.PHONE_ID) ||
      cleanApiKey(process.env.WHATSAPP_PHONE_NUMBER_ID) ||
      cleanApiKey(process.env.WHATSAPP_PHONE_ID) ||
      cleanApiKey(sMap.whatsapp_phone_id) ||
      cleanApiKey(sMap.PHONE_ID) ||
      cleanApiKey(sMap.whatsapp_phone_number_id);

    const adminWhatsAppPhones = Array.from(
      new Set(
        [
          ADMIN_WHATSAPP_ONLY_PHONE,
          sMap.admin_whatsapp_number,
          sMap.admin_alert_phone,
          process.env.ADMIN_WHATSAPP_NUMBER,
          process.env.ADMIN_ALERT_PHONE,
          ADMIN_PRIMARY_SMS_PHONE,
        ]
          .map(formatPhoneForWhatsApp)
          .filter(Boolean)
      )
    );

    const resolvedPhone = params.recipientPhone || ordData?.recipient_phone || "";
    const cleanPhone = resolvedPhone.startsWith("233")
      ? `0${resolvedPhone.slice(3)}`
      : resolvedPhone || "N/A";

    const resolvedAmount = params.amount ?? ordData?.amount ?? 0;
    const formattedAmount = Number(resolvedAmount).toFixed(2);

    const resolvedCap = params.capacity || ordData?.capacity || "";
    const resolvedNet = params.network || ordData?.network || "";
    const itemDesc = params.itemDescription || `${resolvedCap}GB ${resolvedNet} Data`.trim() || "Data Bundle";

    const notesStr = String(ordData?.notes || "");
    const noteAgentMatch = notesStr.match(/\[agent:([^\]]+)\]/);
    const noteStoreMatch = notesStr.match(/\[store:([^\]]+)\]/);

    let resolvedAgentId = params.agentId || ordData?.agent_id || (noteAgentMatch ? noteAgentMatch[1].trim() : null);
    let agentStoreName = (
      params.agentStoreName ||
      params.storeName ||
      ordData?.store_name ||
      (noteStoreMatch ? noteStoreMatch[1].trim() : "")
    ).trim();
    if (agentStoreName.toLowerCase() === "main store" || agentStoreName.toLowerCase() === "data1gh") {
      if (!resolvedAgentId) agentStoreName = "";
    }

    let agRecord: any = null;
    if ((resolvedAgentId || agentStoreName) && supabase) {
      try {
        if (resolvedAgentId) {
          const { data: agRow } = await supabase
            .from("agents")
            .select("id, name, phone, whatsapp_number, momo_number, store_name, store_slug")
            .or(`id.eq.${resolvedAgentId},store_slug.ilike.${resolvedAgentId}`)
            .maybeSingle();
          if (agRow) agRecord = agRow;
        }
        if (!agRecord) {
          const { data: regRow } = await supabase
            .from("settings")
            .select("value")
            .eq("key", "agents_registry")
            .maybeSingle();
          if (regRow?.value) {
            const parsed = typeof regRow.value === "string" ? JSON.parse(regRow.value) : regRow.value;
            if (Array.isArray(parsed)) {
              agRecord = parsed.find(
                (a: any) =>
                  (resolvedAgentId && (a.id === resolvedAgentId || String(a.store_slug || "").toLowerCase() === String(resolvedAgentId).toLowerCase())) ||
                  (agentStoreName && (String(a.store_name || "").toLowerCase() === agentStoreName.toLowerCase() || String(a.store_slug || "").toLowerCase() === agentStoreName.toLowerCase()))
              );
            }
          }
        }
        if (agRecord) {
          if (!resolvedAgentId && agRecord.id) resolvedAgentId = agRecord.id;
          if (!agentStoreName || agentStoreName === "store") {
            agentStoreName = (agRecord.store_name || agRecord.name || "").trim();
          }
        }
      } catch (_) {}
    }

    const isAgentOrder = Boolean(resolvedAgentId || agentStoreName);
    let displayShopName = "DataOne GH";
    if (isAgentOrder) {
      displayShopName = agentStoreName
        ? (/agent/i.test(agentStoreName) ? agentStoreName : `${agentStoreName} (Agent Store)`)
        : "Agent Store";
    } else {
      const explicitShop = (sMap.shop_name || "").trim();
      if (explicitShop && !/big jay/i.test(explicitShop)) {
        displayShopName = explicitShop;
      }
    }

    const dateStr = new Date().toLocaleDateString("en-GB", { timeZone: "Africa/Accra" });
    const timeStr = new Date().toLocaleTimeString("en-GB", { timeZone: "Africa/Accra", hour: "2-digit", minute: "2-digit" });

    let adminWhatsAppSent = false;

    const deliveredAlertText =
`📦 *DATA ORDER DELIVERED!* ✅
━━━━━━━━━━━━━━━━━━━━━
🏪 *Shop:* ${displayShopName}
🆔 *Ref:* ${reference}
📶 *Item:* ${itemDesc}
📱 *Recipient:* ${cleanPhone}
💰 *Amount:* GHS ${formattedAmount}
⚡ *Status:* ✅ Delivered to Phone
⏰ *Delivered At:* ${dateStr} ${timeStr}`;

    if (waToken && waPhoneId && adminWhatsAppPhones.length > 0) {
      for (const waPhone of adminWhatsAppPhones) {
        try {
          const res = await fetch(`https://graph.facebook.com/v20.0/${waPhoneId}/messages`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${waToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              messaging_product: "whatsapp",
              to: waPhone,
              type: "text",
              text: { body: deliveredAlertText },
            }),
          });
          if (res.ok) adminWhatsAppSent = true;
        } catch (_) {}
      }
    }

    if (!adminWhatsAppSent) {
      try {
        const botUrl = process.env.WHATSAPP_BOT_SERVER_URL || "https://nestybot.onrender.com";
        const fbRes = await fetch(`${botUrl.replace(/\/+$/, "")}/api/send-admin-alert`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: deliveredAlertText }),
          signal: AbortSignal.timeout(6000),
        });
        if (fbRes.ok) adminWhatsAppSent = true;
      } catch (_) {}
    }

    // Also send DATA ORDER DELIVERED! ✅ to the Reseller Agent's WhatsApp & log in their Agent Account!
    if (resolvedAgentId && supabase) {
      try {
        let agTargetPhone = String(agRecord?.whatsapp_number || agRecord?.phone || agRecord?.momo_number || "").trim();
        let alertsEnabled = true;

        // Check if agent configured a custom notification WhatsApp number in their dashboard
        try {
          const { data: nSet } = await supabase
            .from("settings")
            .select("value")
            .eq("key", `agent_notifications_${resolvedAgentId}`)
            .maybeSingle();
          if (nSet?.value) {
            const parsed = typeof nSet.value === "string" ? JSON.parse(nSet.value) : nSet.value;
            if (parsed?.whatsapp_number) agTargetPhone = String(parsed.whatsapp_number).trim();
            if (parsed?.enabled === false) alertsEnabled = false;
          }
        } catch (_) {}

        // Look up agent profit and update agent_orders + agent_orders_registry status to "delivered"
        let agentProfit = 0;
        try {
          const { data: aoRow } = await supabase
            .from("agent_orders")
            .select("id, agent_profit")
            .or(`reference.eq.${reference},id.eq.agord-${reference}`)
            .maybeSingle();
          if (aoRow) {
            if (aoRow.agent_profit !== undefined && aoRow.agent_profit !== null) {
              agentProfit = Number(aoRow.agent_profit) || 0;
            }
            await supabase
              .from("agent_orders")
              .update({ delivery_status: "delivered", status: "delivered" })
              .eq("id", aoRow.id);
          }
        } catch (_) {}

        try {
          const { data: regData } = await supabase
            .from("settings")
            .select("value")
            .eq("key", "agent_orders_registry")
            .maybeSingle();
          if (regData?.value) {
            const list = typeof regData.value === "string" ? JSON.parse(regData.value) : regData.value;
            if (Array.isArray(list)) {
              let modified = false;
              for (const item of list) {
                if (item.reference === reference || item.id === `agord-${reference}`) {
                  if (!agentProfit && item.agent_profit) agentProfit = Number(item.agent_profit) || 0;
                  if (item.delivery_status !== "delivered" || item.status !== "delivered") {
                    item.delivery_status = "delivered";
                    item.status = "delivered";
                    modified = true;
                  }
                }
              }
              if (modified) {
                await supabase
                  .from("settings")
                  .upsert({ key: "agent_orders_registry", value: JSON.stringify(list) }, { onConflict: "key" });
              }
            }
          }
        } catch (_) {}

        const agentStoreDisplay = agRecord?.store_name || agentStoreName || "Your Store";
        const profitLine = agentProfit > 0 ? `\n💵 *Your Profit:* +GHS ${agentProfit.toFixed(2)}` : "";
        const agentDeliveredText =
`📦 *DATA ORDER DELIVERED!* ✅
━━━━━━━━━━━━━━━━━━━━━
🏪 *Shop:* ${agentStoreDisplay}
🆔 *Ref:* ${reference}
📶 *Item:* ${itemDesc}
📱 *Recipient:* ${cleanPhone}
💰 *Amount:* GHS ${formattedAmount}${profitLine}
⚡ *Status:* ✅ Delivered to Phone
⏰ *Delivered At:* ${dateStr} ${timeStr}

👉 *Dashboard:* https://www.data1gh.com/agent/dashboard`;

        // Record in Agent Account recent notifications log (agent_notif_log_<agentId>)
        try {
          const notifKey = `agent_notif_log_${resolvedAgentId}`;
          const { data: nLog } = await supabase.from("settings").select("value").eq("key", notifKey).maybeSingle();
          let logList: any[] = [];
          if (nLog?.value) {
            try {
              logList = typeof nLog.value === "string" ? JSON.parse(nLog.value) : nLog.value;
            } catch (_) {}
          }
          const alreadyInLog = logList.some((l: any) => l.order_ref === reference && l.status === "delivered");
          if (!alreadyInLog) {
            logList.unshift({
              id: `notif_del_${Date.now()}`,
              order_ref: reference,
              item: `${itemDesc} (Delivered ✅)`,
              recipient: cleanPhone,
              profit: Number(agentProfit || 0),
              phone: agTargetPhone,
              is_test: false,
              status: "delivered",
              created_at: new Date().toISOString(),
            });
            if (logList.length > 50) logList = logList.slice(0, 50);
            await supabase.from("settings").upsert(
              { key: notifKey, value: JSON.stringify(logList) },
              { onConflict: "key" }
            );
          }
        } catch (_) {}

        const agWaPhone = formatPhoneForWhatsApp(agTargetPhone);
        // Avoid sending a second copy if the agent's WhatsApp number is already in adminWhatsAppPhones
        if (alertsEnabled && agWaPhone && !adminWhatsAppPhones.includes(agWaPhone)) {
          let sentToAgent = false;
          if (waToken && waPhoneId) {
            try {
              const agRes = await fetch(`https://graph.facebook.com/v20.0/${waPhoneId}/messages`, {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${waToken}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  messaging_product: "whatsapp",
                  to: agWaPhone,
                  type: "text",
                  text: { body: agentDeliveredText },
                }),
              });
              if (agRes.ok) sentToAgent = true;
            } catch (_) {}
          }
          if (!sentToAgent) {
            try {
              const botUrl = process.env.WHATSAPP_BOT_SERVER_URL || "https://nestybot.onrender.com";
              await fetch(`${botUrl.replace(/\/+$/, "")}/api/send-admin-alert`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ to: agWaPhone, text: agentDeliveredText }),
                signal: AbortSignal.timeout(6000),
              });
            } catch (_) {}
          }
        }
      } catch (_) {}
    }

    return { ok: true, adminWhatsAppSent };
  } catch (err: any) {
    console.error("sendOrderDeliveredNotification error:", err);
    return { ok: false, error: err?.message };
  }
}
