import { createClient } from "@supabase/supabase-js";
import { getCachedSettings, getSupabase, verifyAdminUser } from "./_supabase.js";
import { detectAndBlockIntrusion } from "./_firewall.js";
import { sendPaymentReceivedNotification, sendWithdrawalAlertNotification, sendAgentRegistrationNotification } from "./_notifications.js";

function cleanApiKey(raw: any): string {
  if (!raw || typeof raw !== "string") return "";
  let k = raw.trim();
  k = k.replace(/^["'`]+|["'`]+$/g, "").trim();
  k = k.replace(/^[A-Za-z0-9_]+=\s*/, "").trim();
  k = k.replace(/^["'`]+|["'`]+$/g, "").trim();
  if (k.toLowerCase().startsWith("bearer ")) k = k.slice(7).trim();
  return k;
}

function normalizePhone(raw: string): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("233") && digits.length === 12) return digits;
  if (digits.startsWith("0") && digits.length === 10) return `233${digits.slice(1)}`;
  if (digits.length === 9) return `233${digits}`;
  if (digits.length >= 10 && digits.length <= 15) return digits;
  return null;
}

function stripEmojis(str: string): string {
  if (!str) return "";
  return str
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/\u200D/g, "")
    .replace(/\uFE0E/g, "")
    .replace(/\uFE0F/g, "")
    .trim();
}

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "authorization, x-client-info, apikey, content-type, x-function-name");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    let body: any = {};
    if (req.body && typeof req.body === "object") {
      body = req.body;
    } else if (typeof req.body === "string" && req.body.trim()) {
      try { body = JSON.parse(req.body); } catch (_) {}
    }

    const authSupabase = getSupabase();
    if (authSupabase && (await detectAndBlockIntrusion(req, res, authSupabase))) return;

    const auth = await verifyAdminUser(req, authSupabase);
    if (!auth.authorized) {
      return res.status(401).json({ ok: false, error: auth.error || "Unauthorized: Administrator privileges required." });
    }

    // Handle Balance Check & API Key Testing
    if (
      body?.action === "testArkesel" ||
      body?.action === "checkBalance" ||
      req.query?.action === "testArkesel" ||
      req.query?.action === "checkBalance" ||
      req.query?.fn === "test-arkesel" ||
      req.headers?.["x-function-name"] === "test-arkesel"
    ) {
      const supabase = getSupabase();
      let arkeselKey = cleanApiKey(body?.api_key || body?.arkesel_api_key);
      if (!arkeselKey) {
        arkeselKey = cleanApiKey(
          process.env.ARKESEL_API_KEY ||
          process.env.ARKESEL_KEY ||
          process.env.VITE_ARKESEL_API_KEY ||
          process.env.VITE_ARKESEL_KEY ||
          process.env.ARKESEL_SMS_KEY ||
          process.env.ARKESEL_SMS_API_KEY
        );
      }
      if (!arkeselKey && supabase) {
        try {
          const { data: sRows } = await supabase
            .from("settings")
            .select("key, value");
          for (const row of sRows || []) {
            const k = String(row?.key || "").toLowerCase();
            if (k.includes("arkesel") && k.includes("key")) {
              const c = cleanApiKey(row?.value);
              if (c && c.length > 5) { arkeselKey = c; break; }
            }
          }
        } catch (_) {}
      }

      if (!arkeselKey) {
        return res.status(200).json({
          ok: false,
          configured: false,
          error: "Arkesel API Key is missing. Please enter your API key in Settings.",
        });
      }

      let foundSms: number | null = null;
      let foundMain: string | null = null;
      let v2Error = "";
      let v1Error = "";

      // 1. Try V2 with safe AbortController
      try {
        const ac = new AbortController();
        const to = setTimeout(() => ac.abort(), 3500);
        const res2 = await fetch("https://sms.arkesel.com/api/v2/clients/balance-details", {
          headers: {
            "api-key": arkeselKey,
            "apiKey": arkeselKey,
            Accept: "application/json",
          },
          signal: ac.signal,
        });
        clearTimeout(to);
        const d2 = await res2.json().catch(() => null);
        if (res2.ok && d2) {
          const payload = d2.data || d2;
          const s = payload.sms_balance ?? payload.smsBalance ?? payload.sms ?? payload.balance;
          if (s !== undefined && s !== null && !isNaN(Number(s))) foundSms = Number(s);
          const m = payload.main_balance ?? payload.mainBalance ?? payload.account_balance;
          if (m !== undefined && m !== null) {
            const strM = String(m).trim();
            if (strM && strM !== "undefined") {
              foundMain = !isNaN(Number(strM)) ? Number(strM).toFixed(2) : strM;
            }
          }
        } else {
          v2Error = d2?.message || `HTTP ${res2.status}`;
        }
      } catch (e: any) {
        v2Error = e.message;
      }

      // 2. Try V1 fallback
      if (foundSms === null || foundMain === null) {
        try {
          const ac1 = new AbortController();
          const to1 = setTimeout(() => ac1.abort(), 3500);
          const res1 = await fetch(`https://sms.arkesel.com/sms/api?action=check-balance&api_key=${encodeURIComponent(arkeselKey)}&response=json`, {
            signal: ac1.signal,
          });
          clearTimeout(to1);
          const text = await res1.text().catch(() => "");
          if (res1.ok && text) {
            try {
              const d1 = JSON.parse(text);
              const payload = d1.data || d1;
              const s = payload.balance ?? payload.sms_balance ?? payload.smsBalance;
              if (s !== undefined && s !== null && !isNaN(Number(s)) && foundSms === null) {
                foundSms = Number(s);
              }
              const m = payload.main_balance ?? payload.mainBalance ?? payload.account_balance;
              if (m !== undefined && m !== null && foundMain === null) {
                const strM = String(m).trim();
                if (strM && strM !== "undefined") {
                  foundMain = !isNaN(Number(strM)) ? Number(strM).toFixed(2) : strM;
                }
              }
            } catch {
              const numMatch = text.match(/\b\d+(\.\d+)?\b/);
              if (numMatch && !text.toLowerCase().includes("invalid") && !text.toLowerCase().includes("error")) {
                if (foundSms === null) foundSms = Number(numMatch[0]);
              } else if (text.toLowerCase().includes("invalid") || text.toLowerCase().includes("error")) {
                v1Error = text.trim().slice(0, 100);
              }
            }
          } else {
            v1Error = `HTTP ${res1.status}`;
          }
        } catch (e: any) {
          v1Error = e.message;
        }
      }

      if (foundSms !== null || foundMain !== null) {
        if (supabase) {
          const toUpsert = [
            { key: "arkesel_api_key", value: arkeselKey },
            { key: "ARKESEL_API_KEY", value: arkeselKey },
          ];
          if (foundSms !== null) toUpsert.push({ key: "arkesel_last_balance", value: String(foundSms) });
          if (foundMain !== null) toUpsert.push({ key: "arkesel_main_balance", value: String(foundMain) });
          try {
            await supabase.from("settings").upsert(toUpsert, { onConflict: "key" });
          } catch (_) {}
        }
        return res.status(200).json({
          ok: true,
          configured: true,
          sms_balance: foundSms,
          main_balance: foundMain,
          message: `Arkesel connected! Balance: ${foundMain ? `GH₵ ${foundMain}` : ""} ${foundSms !== null ? `(${foundSms} SMS)` : ""}`.trim(),
        });
      }

      return res.status(200).json({
        ok: false,
        configured: true,
        error: v2Error || v1Error || "Could not retrieve balance from Arkesel. Verify your API key in Arkesel console.",
      });
    }

    // Handle Payment Alert Test Action (SMS + WhatsApp)
    if (body?.action === "testPaymentAlert" || req.query?.action === "testPaymentAlert") {
      const supabase = getSupabase();
      const testPhone = body?.phone || body?.admin_phone || null;
      const waPhone = body?.whatsapp_phone || body?.admin_whatsapp_number || testPhone;
      const testRef = `TEST-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

      const alertResult = await sendPaymentReceivedNotification(
        {
          reference: testRef,
          amount: "15.00",
          itemDescription: "1GB MTN Non-Expiry Data (Test Alert)",
          recipientPhone: testPhone || "0547100951",
          customerPhone: testPhone || "0547100951",
          adminWhatsAppNumber: waPhone || "0547100951",
          whatsappAccessToken: body?.whatsapp_access_token,
          whatsappPhoneId: body?.whatsapp_phone_id,
          network: "MTN",
          channel: "Mobile Money (Test)",
          orderType: "data",
          isTest: true,
        },
        supabase
      );

      const isSuccess = Boolean(alertResult.adminSmsSent || alertResult.adminWhatsAppSent);
      let feedbackMsg = "";
      if (alertResult.adminSmsSent && alertResult.adminWhatsAppSent) {
        feedbackMsg = "✅ Both SMS and WhatsApp test alerts were dispatched to your phone!";
      } else if (alertResult.adminWhatsAppSent) {
        feedbackMsg = `✅ WhatsApp alert delivered! (SMS: ${alertResult.smsDetails || "not sent"})`;
      } else if (alertResult.adminSmsSent) {
        feedbackMsg = `✅ SMS alert sent! (WhatsApp: ${alertResult.whatsappDetails || "not sent"})`;
      } else {
        feedbackMsg = `❌ Test alerts failed. SMS: ${alertResult.smsDetails || "Failed"}. WhatsApp: ${alertResult.whatsappDetails || "Failed"}`;
      }

      return res.status(200).json({
        ok: isSuccess,
        adminSmsSent: alertResult.adminSmsSent,
        adminWhatsAppSent: alertResult.adminWhatsAppSent,
        message: feedbackMsg,
        smsDetails: alertResult.smsDetails,
        whatsappDetails: alertResult.whatsappDetails,
        details: alertResult,
      });
    }

    // Handle Dedicated WhatsApp Alert Test Action
    if (body?.action === "testWhatsAppAlert" || req.query?.action === "testWhatsAppAlert") {
      const supabase = getSupabase();
      const testPhone = body?.whatsapp_phone || body?.admin_whatsapp_number || body?.phone || body?.admin_phone || null;
      const testRef = `WA-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

      const alertResult = await sendPaymentReceivedNotification(
        {
          reference: testRef,
          amount: "25.00",
          itemDescription: "5GB MTN Non-Expiry Data (WhatsApp Test)",
          recipientPhone: testPhone || "0547100951",
          customerPhone: testPhone || "0547100951",
          adminWhatsAppNumber: testPhone || "0547100951",
          whatsappAccessToken: body?.whatsapp_access_token,
          whatsappPhoneId: body?.whatsapp_phone_id,
          network: "MTN",
          channel: "Mobile Money (Test)",
          orderType: "data",
          isTest: true,
          onlyWhatsApp: true,
        },
        supabase
      );

      return res.status(200).json({
        ok: alertResult.adminWhatsAppSent,
        adminWhatsAppSent: alertResult.adminWhatsAppSent,
        message: alertResult.adminWhatsAppSent
          ? "✅ Test WhatsApp payment alert delivered to your WhatsApp!"
          : `❌ WhatsApp test failed: ${alertResult.whatsappDetails || "Could not deliver message to WhatsApp"}`,
        whatsappDetails: alertResult.whatsappDetails,
        details: alertResult,
      });
    }

    // Handle Dedicated WhatsApp Withdrawal Alert Test Action
    if (body?.action === "testWithdrawalAlert" || req.query?.action === "testWithdrawalAlert") {
      const supabase = getSupabase();
      const testPhone = body?.whatsapp_phone || body?.admin_whatsapp_number || body?.phone || body?.admin_phone || "0547100951";
      const testId = `TEST-WTH-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

      const alertResult = await sendWithdrawalAlertNotification(
        {
          withdrawalId: testId,
          amount: body?.amount || "50.00",
          storeName: body?.store_name || "Alpha Data Hub (Demo Store)",
          agentName: body?.agent_name || "Kwame Mensah",
          agentPhone: testPhone,
          agentEmail: "agent@demo.com",
          momoName: body?.momo_name || "Kwame Mensah MoMo",
          momoNumber: testPhone,
          momoNetwork: body?.momo_network || "MTN",
          walletBalance: "150.00",
          adminWhatsAppNumber: testPhone,
          whatsappAccessToken: body?.whatsapp_access_token,
          whatsappPhoneId: body?.whatsapp_phone_id,
          isTest: true,
        },
        supabase
      );

      return res.status(200).json({
        ok: Boolean(alertResult.adminWhatsAppSent || alertResult.adminSmsSent),
        adminWhatsAppSent: alertResult.adminWhatsAppSent,
        adminSmsSent: alertResult.adminSmsSent,
        message: alertResult.adminWhatsAppSent
          ? "✅ Test WhatsApp withdrawal alert delivered to your WhatsApp!"
          : alertResult.adminSmsSent
          ? `✅ SMS withdrawal alert delivered! (WhatsApp note: ${alertResult.whatsappDetails})`
          : `❌ WhatsApp test failed: ${alertResult.whatsappDetails || "Could not deliver alert"}`,
        whatsappDetails: alertResult.whatsappDetails,
        smsDetails: alertResult.smsDetails,
        directWhatsAppUrl: alertResult.directWhatsAppUrl,
        details: alertResult,
      });
    }

    // Handle Dedicated WhatsApp & Welcome SMS Agent Registration Test Action
    if (body?.action === "testAgentRegistrationAlert" || req.query?.action === "testAgentRegistrationAlert") {
      const supabase = getSupabase();
      const testPhone = body?.whatsapp_phone || body?.admin_whatsapp_number || body?.phone || body?.admin_phone || "0547100951";
      const testStoreSlug = String(body?.store_slug || "pretty-express-data").trim();
      const testStoreName = String(body?.store_name || "Pretty Express Data").trim();
      const testAgentName = String(body?.agent_name || "Pretty Owner").trim();

      const regResult = await sendAgentRegistrationNotification(
        {
          agentId: `test-${Date.now()}`,
          name: testAgentName,
          email: body?.email || "agent@demo.com",
          phone: testPhone,
          storeName: testStoreName,
          storeSlug: testStoreSlug,
          adminWhatsAppNumber: testPhone,
          whatsappAccessToken: body?.whatsapp_access_token,
          whatsappPhoneId: body?.whatsapp_phone_id,
          isTest: true,
        },
        supabase
      );

      return res.status(200).json({
        ok: Boolean(regResult.agentSmsSent || regResult.adminWhatsAppSent || regResult.adminSmsSent),
        agentSmsSent: regResult.agentSmsSent,
        adminWhatsAppSent: regResult.adminWhatsAppSent,
        adminSmsSent: regResult.adminSmsSent,
        message: regResult.adminWhatsAppSent && regResult.agentSmsSent
          ? "✅ Agent Welcome SMS sent and Admin WhatsApp alert delivered!"
          : regResult.agentSmsSent
          ? `✅ Agent Welcome SMS sent! (WhatsApp note: ${regResult.adminWhatsAppDetails})`
          : regResult.adminWhatsAppSent
          ? `✅ Admin WhatsApp alert delivered! (Agent SMS note: ${regResult.agentSmsDetails})`
          : `❌ Delivery issue: WhatsApp: ${regResult.adminWhatsAppDetails}. SMS: ${regResult.agentSmsDetails}`,
        agentSmsDetails: regResult.agentSmsDetails,
        adminWhatsAppDetails: regResult.adminWhatsAppDetails,
        adminSmsDetails: regResult.adminSmsDetails,
        storeUrl: regResult.storeUrl,
        directWhatsAppUrl: regResult.directWhatsAppUrl,
        details: regResult,
      });
    }

    const rawMessage = String(body?.message || "").trim();
    const message = stripEmojis(rawMessage);
    if (!message) {
      return res.status(400).json({ ok: false, error: "SMS message body cannot be empty" });
    }
    if (message.length > 1600) {
      return res.status(400).json({ ok: false, error: "Message must be 1600 characters or fewer" });
    }

    let rawRecipients = body?.recipients;
    if (typeof rawRecipients === "string") {
      rawRecipients = rawRecipients.split(/[\r\n,;]+/);
    }
    if (!Array.isArray(rawRecipients) || rawRecipients.length === 0) {
      return res.status(400).json({ ok: false, error: "At least one recipient phone number is required" });
    }

    const recipients = Array.from(
      new Set(rawRecipients.map((r: any) => normalizePhone(String(r || ""))).filter(Boolean))
    ) as string[];

    if (recipients.length === 0) {
      return res.status(400).json({ ok: false, error: "Please enter a valid Ghana phone number (e.g. 0541234567 or 0592753424)" });
    }

    const supabase = getSupabase();

    // 1. Resolve Arkesel Key
    let arkeselKey = cleanApiKey(
      process.env.ARKESEL_API_KEY ||
      process.env.ARKESEL_KEY ||
      process.env.VITE_ARKESEL_API_KEY ||
      process.env.VITE_ARKESEL_KEY ||
      process.env.ARKESEL_SMS_KEY ||
      process.env.ARKESEL_SMS_API_KEY
    );

    let sender = String(body?.sender_id || "").trim();
    if (!sender) {
      sender = (process.env.ARKESEL_SENDER_ID || "D_1Gh").trim();
    }
    if (!sender) sender = "D_1Gh";
    sender = sender.slice(0, 11);

    if ((!arkeselKey || !sender) && supabase) {
      try {
        const { data: sRows } = await supabase
          .from("settings")
          .select("key, value")
          .in("key", ["arkesel_api_key", "ARKESEL_API_KEY", "arkesel_key", "arkesel_sender_id", "ARKESEL_SENDER_ID"]);

        for (const row of sRows || []) {
          const k = (row?.key || "").toLowerCase();
          if (k.includes("key") && !arkeselKey) {
            const c = cleanApiKey(row?.value);
            if (c) arkeselKey = c;
          }
          if (k.includes("sender")) {
            const s = String(row?.value || "").trim();
            if (s) {
              sender = s.slice(0, 11);
            }
          }
        }
      } catch (_) {}
    }
    if (!sender) sender = "D_1Gh";
    sender = sender.slice(0, 11);

    if (!arkeselKey) {
      return res.status(400).json({
        ok: false,
        error: "Arkesel API Key is missing. Please save it in Admin Settings or add ARKESEL_API_KEY to your environment.",
      });
    }

    // 2. Dispatch in batches of 50 with AbortController timeout to guarantee no hangs
    const BATCH_SIZE = 50;
    let totalSent = 0;
    let totalFailed = 0;
    let lastGatewayError = "";
    let lastDetails: any = null;

    for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
      const chunk = recipients.slice(i, i + BATCH_SIZE);
      let batchSuccess = false;

      // Method A: Arkesel v2 endpoint
      try {
        const ac = new AbortController();
        const timer = setTimeout(() => ac.abort(), 7000);

        const v2Res = await fetch("https://sms.arkesel.com/api/v2/sms/send", {
          method: "POST",
          headers: {
            "api-key": arkeselKey,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            sender,
            message,
            recipients: chunk,
          }),
          signal: ac.signal,
        });

        clearTimeout(timer);
        const v2Data = await v2Res.json().catch(() => ({}));
        lastDetails = v2Data;

        if (
          v2Res.ok &&
          (v2Data?.status === "success" ||
            v2Data?.code === "100" ||
            v2Data?.code === "1000" ||
            v2Data?.code === 1000 ||
            v2Data?.status === 100 ||
            v2Data?.data ||
            v2Data?.status === "OK" ||
            !v2Data?.error)
        ) {
          batchSuccess = true;
          totalSent += chunk.length;
        } else {
          lastGatewayError = v2Data?.message || v2Data?.error || `Arkesel status ${v2Res.status}`;
        }

      } catch (err: any) {
        lastGatewayError = err?.name === "AbortError" ? "Arkesel v2 timed out" : err?.message || "v2 connection failed";
      }

      // Method B: Arkesel v1 fallback
      if (!batchSuccess) {
        try {
          const ac1 = new AbortController();
          const timer1 = setTimeout(() => ac1.abort(), 7000);

          const v1Url = `https://sms.arkesel.com/sms/api?action=send-sms&api_key=${encodeURIComponent(
            arkeselKey
          )}&to=${encodeURIComponent(chunk.join(","))}&from=${encodeURIComponent(
            sender
          )}&sms=${encodeURIComponent(message)}&response=json`;

          const v1Res = await fetch(v1Url, {
            method: "GET",
            headers: { Accept: "application/json" },
            signal: ac1.signal,
          });

          clearTimeout(timer1);
          const v1Data = await v1Res.json().catch(() => ({}));
          lastDetails = v1Data;

          if (
            v1Res.ok &&
            (v1Data?.code === "ok" ||
              v1Data?.status === "success" ||
              v1Data?.code === 100 ||
              v1Data?.status === "OK")
          ) {
            batchSuccess = true;
            totalSent += chunk.length;
          } else {
            lastGatewayError = v1Data?.message || v1Data?.error || lastGatewayError;
          }
        } catch (err1: any) {
          if (!lastGatewayError) {
            lastGatewayError = err1?.name === "AbortError" ? "Arkesel v1 timed out" : err1?.message || "v1 connection failed";
          }
        }
      }

      if (!batchSuccess) {
        totalFailed += chunk.length;
      }
    }

    if (totalSent === 0 && totalFailed > 0) {
      return res.status(400).json({
        ok: false,
        error:
          lastGatewayError ||
          `Arkesel rejected the message. Check that Sender ID '${sender}' is registered and approved on your Arkesel account.`,
        details: lastDetails,
      });
    }

    return res.status(200).json({
      ok: true,
      sent: totalSent,
      total: recipients.length,
      failed: totalFailed,
      details: lastDetails,
    });
  } catch (err: any) {
    console.error("bulk-sms handler catch:", err);
    return res.status(500).json({ ok: false, error: err?.message || "Internal server error" });
  }
}
