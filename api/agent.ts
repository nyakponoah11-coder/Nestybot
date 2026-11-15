import { getSupabase, parseBody, setCorsHeaders, cleanApiKey, verifyAdminUser, data1db } from "./_supabase.js";
import { detectAndBlockIntrusion } from "./_firewall.js";
import { DEFAULT_PRODUCTS, type ProductItem } from "../src/lib/networks.js";
import { sendWithdrawalAlertNotification, sendAgentRegistrationNotification } from "./_notifications.js";

function sanitizeAgentRecord(agent: any, includeCredentials = false) {
  if (!agent || typeof agent !== "object") return agent;
  if (includeCredentials) {
    return {
      ...agent,
      raw_password: agent.password_hash || agent.password || "",
    };
  }
  const { password_hash, password, ...safe } = agent;
  return safe;
}

// In-memory cache with TTL to slash Supabase Database & Storage Egress
let memoryAgents: any[] | null = null;
let memoryAgentsLoadedAt = 0;
const AGENTS_CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes

let memoryBasePrices: Record<string, number> | null = null;
let memoryBasePricesLoadedAt = 0;
const BASE_PRICES_TTL_MS = 5 * 60 * 1000; // 5 minutes

let memoryProductsCatalog: any[] | null = null;
let memoryProductsLoadedAt = 0;
const PRODUCTS_TTL_MS = 10 * 60 * 1000; // 10 minutes

let memoryAgentOrders: any[] | null = null;
let memoryWithdrawals: any[] | null = null;

function getGhanaToday(): string {
  try {
    return new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Accra" }); // YYYY-MM-DD
  } catch {
    return new Date().toISOString().split("T")[0];
  }
}

function getGhanaTimestamp(): string {
  return new Date().toISOString();
}

function getEnvVar(patterns: string[]): string {
  for (const p of patterns) {
    if (process.env[p]) {
      const c = cleanApiKey(process.env[p]);
      if (c && c.length > 3) return c;
    }
  }
  return "";
}

function cleanGhanaPhone(raw: any): string {
  if (!raw) return "";
  let digits = String(raw).replace(/\D/g, "");
  if (digits.startsWith("233") && digits.length === 12) {
    digits = "0" + digits.slice(3);
  }
  if (digits.length === 9) {
    digits = "0" + digits;
  }
  return digits;
}

// In-memory OTP storage with Supabase fallback
const otpRegistry = new Map<string, { code: string; expires_at: number }>();

async function saveOtp(supabase: any, key: string, code: string, ttlMs: number) {
  const expires_at = Date.now() + ttlMs;
  otpRegistry.set(key, { code, expires_at });
  try {
    await supabase.from("settings").upsert({
      key: `otp_${key}`,
      value: JSON.stringify({ code, expires_at }),
    }, { onConflict: "key" });
  } catch (_) { }
}

async function verifyAndConsumeOtp(supabase: any, key: string, inputCode: string): Promise<boolean> {
  const cleanInput = String(inputCode || "").trim();
  if (!cleanInput) return false;

  let record = otpRegistry.get(key);
  if (!record) {
    try {
      const { data } = await supabase.from("settings").select("value").eq("key", `otp_${key}`).maybeSingle();
      if (data?.value) record = JSON.parse(data.value);
    } catch (_) { }
  }

  if (!record) return false;
  if (Date.now() > record.expires_at) {
    otpRegistry.delete(key);
    return false;
  }

  if (record.code === cleanInput) {
    otpRegistry.delete(key);
    try {
      await supabase.from("settings").delete().eq("key", `otp_${key}`);
    } catch (_) { }
    return true;
  }

  return false;
}

async function sendAgentNotification(
  supabase: any,
  params: {
    email?: string;
    phone?: string;
    subject: string;
    message: string;
    apiKey?: string;
    fromSender?: string;
    brevoApiKey?: string;
    brevoSenderEmail?: string;
    code?: string;
  }
): Promise<{ emailSent: boolean; smsSent: boolean; deliveredEmail?: string; error?: string }> {
  let emailSent = false;
  let smsSent = false;
  let emailError = "";
  let deliveredEmail: string | undefined = undefined;

  // 1. Try sending email via Brevo API (primary, no domain restriction) or Resend API / Gmail
  if (params.email) {
    try {
      const { data: rows } = await supabase
        .from("settings")
        .select("key, value")
        .in("key", [
          "brevo_api_key",
          "BREVO_API_KEY",
          "brevo_sender_email",
          "sender_email",
          "resend_api_key",
          "RESEND_API_KEY",
          "resend_key",
          "resend_from_email",
          "gmail_access_token",
          "GMAIL_ACCESS_TOKEN",
          "gmail_refresh_token",
          "GMAIL_REFRESH_TOKEN",
          "gmail_client_id",
          "GMAIL_CLIENT_ID",
          "gmail_client_secret",
          "GMAIL_CLIENT_SECRET",
          "gmail_account_email",
          "GMAIL_ACCOUNT_EMAIL",
          "gmail_token_expires_at",
        ]);

      const map: Record<string, string> = {};
      (rows || []).forEach((r: any) => {
        if (r.key && r.value) map[r.key.toLowerCase()] = String(r.value).trim();
      });

      const otpMatch = (params.code || params.message).match(/\b\d{6}\b/);
      const otpDigits = params.code || (otpMatch ? otpMatch[0] : "");

      const htmlBody = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 28px 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff; color: #1e293b;">
          <div style="text-align: center; margin-bottom: 20px;">
            <div style="display: inline-block; padding: 6px 14px; background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 9999px; font-size: 12px; font-weight: 700; color: #065f46;">
              Data1gh Reseller Network
            </div>
          </div>
          <h2 style="font-size: 20px; font-weight: 800; color: #0f172a; margin: 0 0 12px 0; text-align: center;">
            Verification Code
          </h2>
          <p style="font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 16px 0; text-align: center;">
            ${params.message.split("\n\n")[0]}
          </p>
          ${otpDigits ? `
          <div style="background-color: #f8fafc; border: 2px dashed #0284c7; border-radius: 12px; padding: 18px; text-align: center; margin: 20px 0;">
            <div style="font-size: 32px; font-weight: 900; letter-spacing: 8px; color: #0284c7; font-family: monospace;">
              ${otpDigits}
            </div>
            <div style="font-size: 11px; color: #64748b; margin-top: 6px; font-weight: 600; text-transform: uppercase;">
              Valid for 15 minutes
            </div>
          </div>
          ` : ""}
          <p style="font-size: 12px; color: #64748b; line-height: 1.5; margin: 16px 0 0 0; text-align: center;">
            Do not share this verification code with anyone. If you did not request this, please ignore this email.
          </p>
          <div style="border-top: 1px solid #f1f5f9; margin-top: 24px; padding-top: 16px; text-align: center; font-size: 11px; color: #94a3b8;">
            &copy; ${new Date().getFullYear()} Data1gh &bull; Automated Reseller Delivery Platform
          </div>
        </div>
      `;

      // A. Try Brevo (Sendinblue) API FIRST - Can deliver to ANY registered email without domain restrictions!
      const brevoKey = cleanApiKey(
        params.brevoApiKey ||
        (params.apiKey?.startsWith("xkeysib-") ? params.apiKey : "") ||
        map["brevo_api_key"] ||
        map["brevo_key"] ||
        map["BREVO_API_KEY"] ||
        process.env.BREVO_API_KEY ||
        ""
      );

      if (brevoKey) {
        try {
          let fromBrevoEmail = cleanApiKey(
            params.brevoSenderEmail ||
            map["brevo_sender_email"] ||
            map["support_email"] ||
            map["admin_email"] ||
            "stillmoving11@gmail.com"
          );
          if (!fromBrevoEmail || !fromBrevoEmail.includes("@")) fromBrevoEmail = "stillmoving11@gmail.com";

          const brevoRes = await fetch("https://api.brevo.com/v3/smtp/email", {
            method: "POST",
            headers: {
              "api-key": brevoKey,
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify({
              sender: { name: "Data1gh", email: fromBrevoEmail },
              to: [{ email: params.email }],
              subject: params.subject,
              htmlContent: htmlBody,
              textContent: params.message,
            }),
          });
          const brevoJson = await brevoRes.json().catch(() => ({}));
          if (brevoRes.ok && (brevoJson?.messageId || brevoJson?.id)) {
            emailSent = true;
            deliveredEmail = params.email;
          } else {
            emailError = brevoJson?.message || `Brevo returned HTTP ${brevoRes.status}`;
            console.warn("Brevo email dispatch error:", brevoJson);
          }
        } catch (bErr: any) {
          emailError = bErr?.message || "Error contacting Brevo API";
          console.warn("Brevo email dispatch error:", bErr);
        }
      }

      // B. Fallback: Try Resend API if Brevo didn't send
      const resendKey = cleanApiKey(
        (!params.apiKey?.startsWith("xkeysib-") ? params.apiKey : "") ||
        map["resend_api_key"] ||
        map["resend_key"] ||
        process.env.RESEND_API_KEY ||
        process.env.VITE_RESEND_API_KEY ||
        ""
      );

      if (resendKey && !emailSent) {
        try {
          let fromSender = (
            params.fromSender ||
            map["resend_from_email"] ||
            map["sender_email"] ||
            process.env.RESEND_FROM_EMAIL ||
            "Data1gh <onboarding@resend.dev>"
          ).replace(/Good Data/gi, "Data1gh");

          if (!fromSender.includes("<") && fromSender.includes("@")) {
            fromSender = `Data1gh <${fromSender}>`;
          }

          const resendRes = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${resendKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: fromSender,
              to: [params.email],
              subject: params.subject,
              text: params.message,
              html: htmlBody,
            }),
          });
          const resendJson = await resendRes.json().catch(() => ({}));
          if (resendRes.ok && resendJson?.id) {
            emailSent = true;
            deliveredEmail = params.email;
          } else {
            emailError = emailError || resendJson?.message || resendJson?.error || `Resend returned HTTP ${resendRes.status}`;
            console.warn("Resend email delivery error:", resendJson);
          }
        } catch (resendErr: any) {
          emailError = emailError || resendErr?.message || "Network connection error while contacting Resend";
          console.warn("Resend email dispatch error:", resendErr);
        }
      }

      // C. Fallback: Gmail OAuth API if configured and Resend not sent
      if (!emailSent) {
        let accessToken = map["gmail_access_token"] || process.env.GMAIL_ACCESS_TOKEN || "";
        const refreshToken = map["gmail_refresh_token"] || process.env.GMAIL_REFRESH_TOKEN || "";
        const clientId = map["gmail_client_id"] || process.env.GMAIL_CLIENT_ID || "695163322385-grjddchnib6ambq30ojrc1581ck6s180.apps.googleusercontent.com";
        const clientSecret = map["gmail_client_secret"] || process.env.GMAIL_CLIENT_SECRET || "";
        const tokenExpiresAt = Number(map["gmail_token_expires_at"] || 0);

        if ((!accessToken || (tokenExpiresAt > 0 && Date.now() > tokenExpiresAt - 120000)) && refreshToken && clientId && clientSecret) {
          try {
            const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
              method: "POST",
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              body: new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
                refresh_token: refreshToken,
                grant_type: "refresh_token",
              }),
            });
            const tokenData = await tokenRes.json().catch(() => ({}));
            if (tokenData.access_token) {
              accessToken = tokenData.access_token;
              await supabase.from("settings").upsert([
                { key: "gmail_access_token", value: accessToken },
                { key: "gmail_token_expires_at", value: String(Date.now() + (Number(tokenData.expires_in) || 3600) * 1000) },
              ], { onConflict: "key" });
            }
          } catch (tokErr) {
            console.warn("Failed to refresh Gmail OAuth token:", tokErr);
          }
        }

        if (accessToken) {
          let fromEmail = map["gmail_account_email"] || "";
          if (!fromEmail) {
            try {
              const pRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
                headers: { Authorization: `Bearer ${accessToken}` },
              });
              if (pRes.ok) {
                const pData = await pRes.json();
                if (pData.emailAddress) fromEmail = pData.emailAddress;
              }
            } catch { }
          }
          if (!fromEmail) fromEmail = "admin@data1gh.com";

          const emailContent = [
            `From: Data1gh <${fromEmail}>\r\n`,
            `To: ${params.email}\r\n`,
            `Subject: =?utf-8?B?${Buffer.from(params.subject, "utf-8").toString("base64")}?=\r\n`,
            "MIME-Version: 1.0\r\n",
            "Content-Type: text/plain; charset=UTF-8\r\n\r\n",
            params.message,
          ].join("");

          const raw = Buffer.from(emailContent, "utf-8")
            .toString("base64")
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=+$/, "");

          const sendRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ raw }),
          });
          emailSent = sendRes.ok;
          if (emailSent) {
            deliveredEmail = params.email;
          } else {
            const errDetail = await sendRes.text().catch(() => "");
            console.warn("Gmail API send failed:", sendRes.status, errDetail);
          }
        }
      }
    } catch (e) {
      console.warn("Email sending error:", e);
    }
  }

  // 2. Also send SMS via Arkesel to guarantee immediate receipt!
  if (params.phone) {
    try {
      const smsText = params.code
        ? `Data1gh Password Reset: Your verification code is ${params.code}. Valid for 15 mins.`
        : params.message;
      const smsRes = await sendArkeselSmsDirect(supabase, params.phone, smsText);
      smsSent = smsRes.smsSent;
    } catch (e) {
      console.warn("Arkesel send error:", e);
    }
  }

  return { emailSent, smsSent, deliveredEmail: emailSent ? (deliveredEmail || params.email) : undefined, error: emailError };
}

/**
 * Direct Arkesel SMS sender with v2 POST and v1 GET fallback
 */
async function sendArkeselSmsDirect(
  supabase: any,
  phone: string,
  message: string
): Promise<{ smsSent: boolean; error?: string }> {
  try {
    const digits = (phone || "").replace(/\D/g, "");
    let formattedPhone = digits;
    if (formattedPhone.startsWith("0") && formattedPhone.length === 10) formattedPhone = `233${formattedPhone.slice(1)}`;
    else if (formattedPhone.length === 9) formattedPhone = `233${formattedPhone}`;

    if (!formattedPhone || formattedPhone.length < 9) {
      return { smsSent: false, error: "Invalid phone number format." };
    }

    let arkeselKey = cleanApiKey(getEnvVar(["ARKESEL_API_KEY", "VITE_ARKESEL_API_KEY", "arkesel_api_key"]));
    let senderId = "D_1Gh";

    if (!arkeselKey) {
      const { data: sRows } = await supabase
        .from("settings")
        .select("key, value")
        .in("key", ["arkesel_api_key", "ARKESEL_API_KEY", "arkesel_sender_id", "ARKESEL_SENDER_ID"]);
      (sRows || []).forEach((r: any) => {
        if (r.key.toLowerCase().includes("key")) arkeselKey = cleanApiKey(r.value);
        if (r.key.toLowerCase().includes("sender")) senderId = String(r.value || "D_1Gh").trim().slice(0, 11);
      });
    }

    if (!arkeselKey) {
      return { smsSent: false, error: "Arkesel SMS API key not found in Settings. Please configure Arkesel SMS key in Admin Settings." };
    }

    const cleanMsg = message.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}]/gu, "").trim();

    // 1. Try Arkesel v2 POST
    try {
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), 8000);
      const res = await fetch("https://sms.arkesel.com/api/v2/sms/send", {
        method: "POST",
        headers: { "api-key": arkeselKey, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          sender: senderId,
          message: cleanMsg,
          recipients: [formattedPhone],
        }),
        signal: ac.signal,
      });
      clearTimeout(timer);
      const data = await res.json().catch(() => ({}));
      if (res.ok && (data?.status === "success" || data?.code === "100" || data?.status === 100)) {
        return { smsSent: true };
      }
      const v2Err = data?.message || data?.error || "";
      if (v2Err) {
        console.warn("Arkesel v2 returned error:", v2Err);
      }
    } catch (e: any) {
      console.warn("Arkesel v2 send error, trying v1:", e?.message);
    }

    // 2. Try Arkesel v1 GET fallback
    try {
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), 8000);
      const v1Url = `https://sms.arkesel.com/sms/api?action=send-sms&api_key=${encodeURIComponent(
        arkeselKey
      )}&to=${encodeURIComponent(formattedPhone)}&from=${encodeURIComponent(
        senderId
      )}&sms=${encodeURIComponent(cleanMsg)}&response=json`;

      const res = await fetch(v1Url, { signal: ac.signal });
      clearTimeout(timer);
      const text = await res.text().catch(() => "");
      if (res.ok && (text.includes("100") || text.includes("success") || text.includes("Successful"))) {
        return { smsSent: true };
      }
      return { smsSent: false, error: text.slice(0, 150) || "Arkesel rejected SMS message." };
    } catch (e: any) {
      return { smsSent: false, error: e?.message || "Failed to reach Arkesel SMS gateway." };
    }
  } catch (err: any) {
    return { smsSent: false, error: err?.message || "Error processing SMS dispatch." };
  }
}

/**
 * Retrieves the Paystack Secret Key from environment or database settings
 */
async function getPaystackSecretKey(supabase: any): Promise<string> {
  let key = cleanApiKey(
    getEnvVar([
      "PAYSTACK_SECRET_KEY",
      "VITE_PAYSTACK_SECRET_KEY",
      "PAYSTACK_KEY",
      "paystack_secret_key",
      "paystack_secret",
      "PAYSTACK_SECRET",
      "paystack_live_secret_key",
    ])
  );

  if (!key) {
    try {
      const { data } = await supabase
        .from("settings")
        .select("key, value")
        .in("key", [
          "paystack_secret_key",
          "PAYSTACK_SECRET_KEY",
          "paystack_secret",
          "PAYSTACK_SECRET",
          "paystack_key",
          "PAYSTACK_KEY",
          "paystack_live_secret_key",
        ]);
      if (Array.isArray(data)) {
        for (const row of data) {
          const cleaned = cleanApiKey(row.value);
          if (cleaned.startsWith("sk_live_")) {
            key = cleaned;
            break;
          } else if (cleaned && !key) {
            key = cleaned;
          }
        }
      }
    } catch (_) { }
  }

  return key;
}

/**
 * Initiates an automatic MoMo Payout via Paystack Transfers API
 */
async function disburseViaPaystack(params: {
  paystackKey: string;
  amount: number;
  momoNumber: string;
  momoNetwork: string;
  momoName: string;
  reason: string;
}): Promise<{ ok: boolean; transferCode?: string; reference?: string; status?: string; error?: string }> {
  const { paystackKey, amount, momoNumber, momoNetwork, momoName, reason } = params;

  let cleanNumber = (momoNumber || "").replace(/\D/g, "");
  if (cleanNumber.startsWith("233") && cleanNumber.length === 12) {
    cleanNumber = "0" + cleanNumber.slice(3);
  } else if (cleanNumber.length === 9) {
    cleanNumber = "0" + cleanNumber;
  }

  if (!cleanNumber || cleanNumber.length < 10) {
    return {
      ok: false,
      error: `Invalid MoMo phone number: "${momoNumber || "empty"}". Expected 10 digits (e.g. 0541234567).`,
    };
  }

  let bankCode = "MTN";
  const netUpper = (momoNetwork || "").toUpperCase();
  if (netUpper.includes("VOD") || netUpper.includes("TEL") || netUpper.includes("TELECEL")) {
    bankCode = "VOD";
  } else if (netUpper.includes("AT") || netUpper.includes("AIRTEL") || netUpper.includes("TIGO")) {
    bankCode = "ATL";
  }

  // 1. Create Paystack Transfer Recipient
  let recipientCode = "";
  try {
    let recRes = await fetch("https://api.paystack.co/transferrecipient", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${paystackKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "mobile_money",
        name: momoName || "Data1gh Agent",
        account_number: cleanNumber,
        bank_code: bankCode,
        currency: "GHS",
      }),
    });
    let recJson = await recRes.json().catch(() => ({}));

    // If initial creation failed on bank code, try alternate network codes
    if ((!recRes.ok || !recJson?.status) && (bankCode === "VOD" || bankCode === "TEL")) {
      const altCode = bankCode === "VOD" ? "TEL" : "VOD";
      const retryRes = await fetch("https://api.paystack.co/transferrecipient", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${paystackKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "mobile_money",
          name: momoName || "Data1gh Agent",
          account_number: cleanNumber,
          bank_code: altCode,
          currency: "GHS",
        }),
      });
      const retryJson = await retryRes.json().catch(() => ({}));
      if (retryRes.ok && retryJson?.status && retryJson?.data?.recipient_code) {
        recRes = retryRes;
        recJson = retryJson;
      }
    } else if ((!recRes.ok || !recJson?.status) && (bankCode === "ATL" || bankCode === "TGO")) {
      const altCode = bankCode === "ATL" ? "TGO" : "ATL";
      const retryRes = await fetch("https://api.paystack.co/transferrecipient", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${paystackKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "mobile_money",
          name: momoName || "Data1gh Agent",
          account_number: cleanNumber,
          bank_code: altCode,
          currency: "GHS",
        }),
      });
      const retryJson = await retryRes.json().catch(() => ({}));
      if (retryRes.ok && retryJson?.status && retryJson?.data?.recipient_code) {
        recRes = retryRes;
        recJson = retryJson;
      }
    }

    if (!recRes.ok || !recJson?.status || !recJson?.data?.recipient_code) {
      let errMsg = recJson?.message || `Failed to create recipient on Paystack (HTTP ${recRes.status})`;
      if (errMsg.toLowerCase().includes("starter")) {
        errMsg += " (Paystack Starter Accounts do not support automated Transfers. Upgrade to Registered Business or Mark Paid Manually).";
      }
      return { ok: false, error: `Paystack Recipient Error: ${errMsg}` };
    }
    recipientCode = recJson.data.recipient_code;
  } catch (err: any) {
    return { ok: false, error: `Network error connecting to Paystack recipient endpoint: ${err?.message || err}` };
  }

  // 2. Initiate Transfer
  try {
    const amountInPesewas = Math.round(amount * 100);
    const trfRes = await fetch("https://api.paystack.co/transfer", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${paystackKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source: "balance",
        amount: amountInPesewas,
        recipient: recipientCode,
        reason: reason || "Data1gh Agent Profit Withdrawal",
        currency: "GHS",
      }),
    });
    const trfJson = await trfRes.json().catch(() => ({}));
    if (!trfRes.ok || !trfJson?.status) {
      let errMsg = trfJson?.message || `Paystack transfer initiation failed (HTTP ${trfRes.status})`;
      if (errMsg.toLowerCase().includes("balance")) {
        errMsg += ` (Requires GH₵ ${amount.toFixed(2)} + GHS 1 transfer fee). Please top up your Paystack balance, or use 'Mark Paid Manually'.`;
      } else if (errMsg.toLowerCase().includes("otp")) {
        errMsg += ` (Paystack requires Transfer OTP. You can disable OTP under Paystack Dashboard > Settings > Preferences > Transfers for 1-click payouts, or use 'Mark Paid Manually').`;
      } else if (errMsg.toLowerCase().includes("starter")) {
        errMsg += " (Paystack Starter Accounts do not support automated Transfers. You can use 'Mark Paid Manually').";
      }
      return { ok: false, error: `Paystack Transfer Error: ${errMsg}` };
    }

    const tData = trfJson.data || {};
    return {
      ok: true,
      transferCode: tData.transfer_code || "",
      reference: tData.reference || tData.transfer_code || `PAYSTACK_${Date.now()}`,
      status: tData.status || "completed",
    };
  } catch (err: any) {
    return { ok: false, error: `Network error connecting to Paystack transfer endpoint: ${err?.message || err}` };
  }
}

/**
 * Checks Paystack account balance and connection status
 */
async function checkPaystackStatus(paystackKey: string): Promise<{
  ok: boolean;
  balanceGHS?: number;
  currencies?: any[];
  error?: string;
  message?: string;
}> {
  if (!paystackKey) {
    return { ok: false, error: "No Paystack secret key provided." };
  }
  try {
    const res = await fetch("https://api.paystack.co/balance", {
      headers: {
        Authorization: `Bearer ${paystackKey}`,
      },
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json?.status) {
      return { ok: false, error: json?.message || `Paystack responded with HTTP ${res.status}` };
    }
    const data = Array.isArray(json.data) ? json.data : [];
    const ghs = data.find((b: any) => (b.currency || "").toUpperCase() === "GHS");
    const balanceGHS = ghs ? Number(ghs.balance) / 100 : 0;
    return {
      ok: true,
      balanceGHS,
      currencies: data,
      message: `Connected! Available Paystack Balance: GH₵ ${balanceGHS.toFixed(2)}`,
    };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Network error checking Paystack balance" };
  }
}

/**
 * Loads agents from Supabase `agents` table or fallback `settings.key='agents_registry'`,
 * and ALWAYS merges custom fields (logo_url, whatsapp_group_url, custom_domain, store_theme)
 * from `settings.key='agent_branding_<id>'` and `settings.key='agents_registry'`.
 */
/**
 * Loads agents from Supabase `agents` table and `settings.key='agents_registry'`.
 * Merges both sources so no registered agents are missed, and includes password_hash.
 */
async function loadAgents(supabase: any, forceRefresh = false): Promise<any[]> {
  const now = Date.now();
  if (!forceRefresh && memoryAgents && Array.isArray(memoryAgents) && memoryAgents.length > 0 && now - memoryAgentsLoadedAt < AGENTS_CACHE_TTL_MS) {
    return memoryAgents;
  }

  let baseAgents: any[] = [];

  // 1. Try reading from agents table with select("*") so missing schema columns never cause 0 results
  try {
    let { data, error } = await supabase.from("agents").select("*");
    if (error) {
      console.warn("agents select(*) warning:", error.message);
      const res = await supabase.from("agents").select("id, name, email, phone, store_name, store_slug");
      data = res.data;
    }
    if (Array.isArray(data) && data.length > 0) {
      baseAgents = data;
    }
  } catch (err: any) {
    console.warn("agents table read error:", err?.message);
  }

  // 2. Read settings agents_registry ALSO and merge any agents that were registered in registry
  try {
    const { data } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "agents_registry")
      .maybeSingle();
    if (data?.value) {
      const parsed = typeof data.value === "string" ? JSON.parse(data.value) : data.value;
      if (Array.isArray(parsed) && parsed.length > 0) {
        if (baseAgents.length === 0) {
          baseAgents = parsed;
        } else {
          const existingIds = new Set(baseAgents.map((a: any) => String(a.id || "").trim().toLowerCase()));
          const existingEmails = new Set(baseAgents.map((a: any) => String(a.email || "").trim().toLowerCase()).filter(Boolean));
          for (const regAgent of parsed) {
            const rId = String(regAgent?.id || "").trim().toLowerCase();
            const rEmail = String(regAgent?.email || "").trim().toLowerCase();
            if ((!rId || !existingIds.has(rId)) && (!rEmail || !existingEmails.has(rEmail))) {
              baseAgents.push(regAgent);
              if (rId) existingIds.add(rId);
              if (rEmail) existingEmails.add(rEmail);
            } else if (rId && existingIds.has(rId)) {
              // Merge missing password_hash or contact fields if present in registry
              const existingIdx = baseAgents.findIndex((a: any) => String(a.id || "").trim().toLowerCase() === rId);
              if (existingIdx !== -1) {
                if (!baseAgents[existingIdx].password_hash && regAgent.password_hash) {
                  baseAgents[existingIdx].password_hash = regAgent.password_hash;
                }
                if (!baseAgents[existingIdx].email && regAgent.email) {
                  baseAgents[existingIdx].email = regAgent.email;
                }
                if (!baseAgents[existingIdx].phone && regAgent.phone) {
                  baseAgents[existingIdx].phone = regAgent.phone;
                }
              }
            }
          }
        }
      }
    }
  } catch (_) { }

  // 3. Normalize agents with default styling values
  const merged = baseAgents.map((a: any) => ({
    ...a,
    email: String(a.email || "").trim(),
    phone: String(a.phone || "").trim(),
    password_hash: a.password_hash || a.password || "",
    logo_url: a.logo_url || "",
    whatsapp_group_url: a.whatsapp_group_url || a.whatsapp_channel_url || "",
    custom_domain: a.custom_domain || "",
    store_theme: a.store_theme || "cyber",
  }));

  if (merged.length > 0) {
    try {
      data1db.setTableRecords("agents", merged);
      data1db.upsert("settings", { key: "agents_registry", value: JSON.stringify(merged) }, "key");
    } catch (_) { }
  } else {
    // If query returned 0, check local data1db backup cache
    try {
      const d1Agents = data1db.loadTable("agents");
      if (Array.isArray(d1Agents) && d1Agents.length > 0) {
        memoryAgents = d1Agents;
        memoryAgentsLoadedAt = Date.now();
        return memoryAgents;
      }
    } catch (_) { }
  }

  memoryAgents = merged;
  memoryAgentsLoadedAt = Date.now();
  return memoryAgents;
}

/**
 * Resilient lookup helper across memory agents array.
 * Searches safely by email, phone/whatsapp/momo digits, ID, or store slug.
 */
function findAgentByIdentifier(agents: any[], rawIdentifier: string): any {
  if (!Array.isArray(agents) || !rawIdentifier) return null;
  const ident = String(rawIdentifier).trim().toLowerCase();
  if (!ident) return null;

  const isEmail = ident.includes("@");
  const cleanIdent = ident.replace(/[^0-9a-z@._+-]/g, "");
  const cleanDigits = ident.replace(/\D/g, "");
  const last8 = cleanDigits.length >= 8 ? cleanDigits.slice(-8) : "";
  const last9 = cleanDigits.length >= 9 ? cleanDigits.slice(-9) : cleanDigits;

  return agents.find((a: any) => {
    if (!a) return false;
    // 1. Direct ID match
    if (a.id && String(a.id).trim().toLowerCase() === ident) return true;

    // 2. Email match (case-insensitive & trimmed)
    if (isEmail && a.email) {
      const aEmail = String(a.email).trim().toLowerCase();
      if (aEmail === ident || aEmail === cleanIdent) return true;
    }

    // 3. Phone / WhatsApp / MoMo digits match (last 8-9 digits to handle country code 233 vs 0)
    if (last8) {
      const pDigits = String(a.phone || "").replace(/\D/g, "");
      const wDigits = String(a.whatsapp_number || "").replace(/\D/g, "");
      const mDigits = String(a.momo_number || "").replace(/\D/g, "");
      if (pDigits && (pDigits.endsWith(last8) || (last9 && pDigits.endsWith(last9)))) return true;
      if (wDigits && (wDigits.endsWith(last8) || (last9 && wDigits.endsWith(last9)))) return true;
      if (mDigits && (mDigits.endsWith(last8) || (last9 && mDigits.endsWith(last9)))) return true;
    }

    // 4. Store slug match
    if (a.store_slug && String(a.store_slug).trim().toLowerCase() === ident) return true;

    // 5. Fallback email match without @ check
    if (a.email && String(a.email).trim().toLowerCase() === cleanIdent) return true;

    return false;
  }) || null;
}

/**
 * Direct database fallback query when an agent is not found in memory cache.
 */
async function queryAgentFromDb(supabase: any, rawIdentifier: string): Promise<any> {
  const ident = String(rawIdentifier || "").trim();
  if (!ident) return null;

  const isEmail = ident.includes("@");
  const cleanDigits = ident.replace(/\D/g, "");
  const last8 = cleanDigits.length >= 8 ? cleanDigits.slice(-8) : "";
  const last9 = cleanDigits.length >= 9 ? cleanDigits.slice(-9) : cleanDigits;

  // 1. Check agents table
  try {
    if (isEmail) {
      const { data, error } = await supabase
        .from("agents")
        .select("*")
        .ilike("email", ident.toLowerCase())
        .maybeSingle();
      if (!error && data) return data;
    }

    if (ident.startsWith("ag_")) {
      const { data, error } = await supabase
        .from("agents")
        .select("*")
        .eq("id", ident)
        .maybeSingle();
      if (!error && data) return data;
    }

    // Try matching store_slug
    const { data: slugData } = await supabase
      .from("agents")
      .select("*")
      .eq("store_slug", ident.toLowerCase())
      .maybeSingle();
    if (slugData) return slugData;

    // Scan table for matching phone/whatsapp/momo digits
    if (last8) {
      const { data: allTableAgents } = await supabase
        .from("agents")
        .select("id, full_name, store_slug, phone, whatsapp_number, momo_number, is_approved, is_active")
        .limit(40);
      if (Array.isArray(allTableAgents)) {
        const found = allTableAgents.find((a: any) => {
          const p = String(a.phone || "").replace(/\D/g, "");
          const w = String(a.whatsapp_number || "").replace(/\D/g, "");
          const m = String(a.momo_number || "").replace(/\D/g, "");
          return (p && (p.endsWith(last8) || (last9 && p.endsWith(last9)))) ||
            (w && (w.endsWith(last8) || (last9 && w.endsWith(last9)))) ||
            (m && (m.endsWith(last8) || (last9 && m.endsWith(last9))));
        });
        if (found) return found;
      }
    }
  } catch (_) { }

  // 2. Check settings agents_registry
  try {
    const { data: regData } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "agents_registry")
      .maybeSingle();
    if (regData?.value) {
      const parsed = JSON.parse(regData.value);
      if (Array.isArray(parsed)) {
        const found = findAgentByIdentifier(parsed, ident);
        if (found) return found;
      }
    }
  } catch (_) { }

  return null;
}

/**
 * Resilient resolver for agent custom data bundle pricing.
 * Checks all possible key aliases (p-mtn-1, p-tel-10, p-telecel-10, p-at-1, mtn-1, telecel-10, at-1, etc.)
 */
export function resolveProductCustomPrice(
  p: { network: string; capacity: string | number; id?: string; price?: number },
  customPrices: Record<string, any>,
  baseCost: number
): number {
  if (!customPrices || typeof customPrices !== "object") {
    const defaultMarkup = (p.price && p.price >= 20) || baseCost >= 20 ? 3.00 : 1.50;
    return Number((baseCost + defaultMarkup).toFixed(2));
  }

  const net = String(p.network || "").toUpperCase().trim();
  const cap = String(p.capacity || "").replace(/[^0-9.]/g, "").trim();
  const netLower = net.toLowerCase();

  const candidateKeys: string[] = [];
  if (p.id) candidateKeys.push(p.id);

  // Common standard format
  candidateKeys.push(`p-${netLower}-${cap}`);
  candidateKeys.push(`${netLower}-${cap}`);
  candidateKeys.push(`${netLower}_${cap}`);
  candidateKeys.push(`${netLower}-${cap}gb`);
  candidateKeys.push(`${netLower}_${cap}gb`);

  if (net === "TELECEL" || net.includes("TEL") || net.includes("VODAFONE")) {
    candidateKeys.push(
      `p-tel-${cap}`,
      `p-telecel-${cap}`,
      `tel-${cap}`,
      `tel_${cap}`,
      `telecel-${cap}`,
      `telecel_${cap}`,
      `tel-${cap}gb`,
      `telecel-${cap}gb`
    );
  } else if (net === "AT" || net.includes("AIRTEL") || net.includes("TIGO")) {
    candidateKeys.push(
      `p-at-${cap}`,
      `p-airteltigo-${cap}`,
      `at-${cap}`,
      `at_${cap}`,
      `airteltigo-${cap}`,
      `airteltigo_${cap}`,
      `at-${cap}gb`,
      `airteltigo-${cap}gb`
    );
  } else if (net === "MTN") {
    candidateKeys.push(
      `p-mtn-${cap}`,
      `mtn-${cap}`,
      `mtn_${cap}`,
      `mtn-${cap}gb`,
      `mtn_${cap}gb`
    );
  }

  for (const k of candidateKeys) {
    if (k && customPrices[k] !== undefined && customPrices[k] !== null && customPrices[k] !== "") {
      const val = Number(customPrices[k]);
      if (!isNaN(val) && val > 0) {
        return Number(val.toFixed(2));
      }
    }
  }

  const defaultMarkup = (p.price && p.price >= 20) || baseCost >= 20 ? 3.00 : 1.50;
  return Number((baseCost + defaultMarkup).toFixed(2));
}

/**
 * Resilient resolver for agent custom services and checkers pricing.
 * Checks all aliases for Netflix, AFA, MTN Mashup, WAEC, and BECE.
 */
export function resolveServiceCustomPrice(
  serviceKey: string,
  customPrices: Record<string, any>,
  fallbackDefault: number
): number {
  if (!customPrices || typeof customPrices !== "object") return fallbackDefault;

  const keyMap: Record<string, string[]> = {
    netflix: ["service-netflix", "netflix", "service_netflix", "netflix_1month", "netflix-1month"],
    afa: ["service-afa", "afa", "service_afa", "afa_registration", "afa-registration"],
    mashup: ["service-mashup", "mashup", "service_mashup", "mtn_mashup", "mtn-mashup"],
    waec: ["checker-waec", "waec", "checker_waec", "wassce", "waec_checker", "waec-checker"],
    bece: ["checker-bece", "bece", "checker_bece", "bece_checker", "bece-checker"],
  };

  const cleanKey = serviceKey.toLowerCase().replace(/^(service|checker)[-_]/, "");
  const aliases = keyMap[cleanKey] || [serviceKey, cleanKey];

  for (const k of aliases) {
    if (customPrices[k] !== undefined && customPrices[k] !== null && customPrices[k] !== "") {
      const val = Number(customPrices[k]);
      if (!isNaN(val) && val > 0) return Number(val.toFixed(2));
    }
  }

  return fallbackDefault;
}

/**
 * Loads dedicated agent pricing from settings table by agentId and/or store_slug.
 */
async function loadAgentPricing(supabase: any, agentId?: string, slug?: string): Promise<Record<string, number>> {
  if (!agentId && !slug) return {};
  try {
    const keysToCheck = [
      agentId ? `agent_pricing_${agentId}` : "",
      slug ? `agent_pricing_${slug.toLowerCase()}` : "",
    ].filter(Boolean);

    for (const key of keysToCheck) {
      const { data } = await supabase
        .from("settings")
        .select("value")
        .eq("key", key)
        .maybeSingle();
      if (data?.value) {
        try {
          const parsed = JSON.parse(data.value);
          if (parsed && typeof parsed === "object" && Object.keys(parsed).length > 0) {
            return parsed;
          }
        } catch (_) { }
      }
    }
  } catch (_) { }
  return {};
}

/**
 * Saves agents to Supabase table and settings registry.
 * Guarantees custom prices are persisted both in settings table and registry so they never revert.
 */
async function saveAgents(supabase: any, agents: any[], specificAgentId?: string): Promise<void> {
  memoryAgents = agents;
  memoryAgentsLoadedAt = Date.now();

  const targetAgent = specificAgentId ? agents.find((a: any) => a.id === specificAgentId) : null;

  // 1. Save agent branding AND dedicated pricing individually in settings table (guaranteed persistence)
  try {
    const agentsToBrand = targetAgent ? [targetAgent] : agents;
    for (const a of agentsToBrand) {
      if (a?.id) {
        await supabase.from("settings").upsert({
          key: `agent_branding_${a.id}`,
          value: JSON.stringify({
            logo_url: a.logo_url || "",
            whatsapp_group_url: a.whatsapp_group_url || a.whatsapp_channel_url || "",
            custom_domain: a.custom_domain || "",
            store_theme: a.store_theme || "cyber",
          }),
        }, { onConflict: "key" });

        if (a.custom_prices && typeof a.custom_prices === "object" && Object.keys(a.custom_prices).length > 0) {
          const recordsToUpsert = [
            {
              key: `agent_pricing_${a.id}`,
              value: JSON.stringify(a.custom_prices),
            },
          ];
          if (a.store_slug) {
            recordsToUpsert.push({
              key: `agent_pricing_${String(a.store_slug).toLowerCase().trim()}`,
              value: JSON.stringify(a.custom_prices),
            });
          }
          await supabase.from("settings").upsert(recordsToUpsert, { onConflict: "key" });
        }
      }
    }
  } catch (err) {
    console.warn("Failed saving agent settings individual records:", err);
  }

  // 2. Upsert into agents table with sanitized core fields
  try {
    const listToUpsert = targetAgent ? [targetAgent] : agents;
    const sanitized = listToUpsert.map((a: any) => ({
      id: a.id,
      name: a.name || "",
      email: a.email || "",
      phone: a.phone || "",
      password_hash: a.password_hash || "",
      store_name: a.store_name || "",
      store_slug: a.store_slug || "",
      description: a.description || "",
      whatsapp_number: a.whatsapp_number || "",
      momo_number: a.momo_number || "",
      momo_network: a.momo_network || "MTN",
      momo_name: a.momo_name || "",
      custom_prices: a.custom_prices || {},
      status: a.status || "active",
      created_at: a.created_at || getGhanaTimestamp(),
    }));
    await supabase.from("agents").upsert(sanitized, { onConflict: "id" });
  } catch (err) {
    console.warn("Notice: agents table upsert encountered an issue:", err);
  }

  // 3. Always update agents_registry in settings table so registry NEVER has stale custom_prices!
  try {
    const { data: regRow } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "agents_registry")
      .maybeSingle();

    let registryList: any[] = [];
    if (regRow?.value) {
      try {
        const parsed = JSON.parse(regRow.value);
        if (Array.isArray(parsed)) registryList = parsed;
      } catch (_) { }
    }
    if (registryList.length === 0) {
      registryList = agents;
    }

    if (targetAgent) {
      const idx = registryList.findIndex((r: any) => r.id === targetAgent.id);
      const cleanTarget = {
        ...targetAgent,
        logo_url: targetAgent.logo_url?.startsWith("data:") ? "" : targetAgent.logo_url,
      };
      if (idx !== -1) {
        registryList[idx] = { ...registryList[idx], ...cleanTarget };
      } else {
        registryList.unshift(cleanTarget);
      }
    } else {
      registryList = agents.map((a: any) => ({
        ...a,
        logo_url: a.logo_url?.startsWith("data:") ? "" : a.logo_url,
      }));
    }

    await supabase.from("settings").upsert({
      key: "agents_registry",
      value: JSON.stringify(registryList),
    }, { onConflict: "key" });
  } catch (err) {
    console.warn("Failed updating agents_registry:", err);
  }
}

/**
 * Loads Admin Base Prices for agents
 */
export async function loadBasePrices(supabase: any, forceRefresh = false): Promise<Record<string, number>> {
  const now = Date.now();
  if (!forceRefresh && memoryBasePrices && now - memoryBasePricesLoadedAt < BASE_PRICES_TTL_MS) {
    return memoryBasePrices;
  }

  const defaultMap: Record<string, number> = {
    // Default Wholesale Base Prices for Other Services & Result Checkers
    "service-netflix": 25.00,
    "service-afa": 15.00,
    "service-mashup": 22.00,
    "checker-waec": 16.00,
    "checker-bece": 14.00,
  };
  DEFAULT_PRODUCTS.forEach((p) => {
    // Default base price is standard price minus discount margin
    const discount = p.price >= 20 ? 1.50 : (p.price >= 10 ? 0.80 : 0.40);
    defaultMap[p.id] = Math.max(1, Number((p.price - discount).toFixed(2)));
  });

  try {
    const { data } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "agent_base_prices")
      .maybeSingle();
    if (data?.value) {
      const parsed = JSON.parse(data.value);
      if (parsed && typeof parsed === "object") {
        const merged = { ...defaultMap, ...parsed };
        memoryBasePrices = merged;
        memoryBasePricesLoadedAt = Date.now();
        return merged;
      }
    }
  } catch (_) { }

  memoryBasePrices = defaultMap;
  memoryBasePricesLoadedAt = Date.now();
  return defaultMap;
}

/**
 * Resolves the exact wholesale base price set by Admin for an order
 */
export function resolveOrderBasePrice(ord: any, basePrices: Record<string, number>): number {
  if (!ord) return 0;
  if (String(ord.network || "").toUpperCase() === "ADMIN") return 0;

  // 1. Direct match on product_id
  if (ord.product_id && basePrices[ord.product_id] !== undefined) {
    return Number(basePrices[ord.product_id]);
  }

  const ref = String(ord.reference || ord.paystack_ref || ord.id || "").toUpperCase();
  const netRaw = String(ord.network || "").toUpperCase();
  const pkg = String(ord.package_size || ord.bundle || ord.capacity || "").toLowerCase();
  const serviceKey = String(ord.service || "").toLowerCase();

  // 1b. Check if order is a Service (Netflix, AFA, Mashup), Boost, or Result Checker
  if (ref.startsWith("SB") || netRaw === "BOOST" || pkg.includes("boost") || serviceKey === "boost") {
    const taggedBase = parseNoteTag(ord.notes, "base_price");
    if (taggedBase && Number(taggedBase) > 0) {
      return Number(taggedBase);
    }
    const taggedProfit = parseNoteTag(ord.notes, "agent_profit");
    if (taggedProfit && Number(taggedProfit) >= 0) {
      const amt = Number(ord.amount || ord.selling_price || 0);
      return Math.max(0, Number((amt - Number(taggedProfit)).toFixed(2)));
    }
    // Default fallback: assume 20% margin if untagged
    const amt = Number(ord.amount || ord.selling_price || 0);
    return Math.max(0.5, Number((amt * 0.8).toFixed(2)));
  }
  if (ref.startsWith("NF") || netRaw === "NETFLIX" || pkg.includes("netflix") || serviceKey === "netflix") {
    return Number(basePrices["service-netflix"] ?? 25.00);
  }
  if (ref.startsWith("AF") || netRaw === "AFA" || pkg.includes("afa") || serviceKey === "afa") {
    return Number(basePrices["service-afa"] ?? 15.00);
  }
  if (ref.startsWith("MU") || netRaw === "MASHUP" || pkg.includes("mashup") || serviceKey === "mashup") {
    const baseMashup = Number(basePrices["service-mashup"] ?? 22.00);
    const orderAmt = Number(ord.amount || ord.selling_price || 25);
    const ratio = baseMashup / 25;
    return Math.max(0.5, Number((orderAmt * ratio).toFixed(2)));
  }
  if (ref.startsWith("CK") || netRaw.includes("CHECKER") || pkg.includes("checker") || ord.checker_type) {
    const isBece = String(ord.checker_type || pkg).toUpperCase().includes("BECE");
    if (isBece) {
      return Number(basePrices["checker-bece"] ?? 14.00);
    }
    return Number(basePrices["checker-waec"] ?? 16.00);
  }

  // 2. Parse network and numeric capacity
  const netKey = netRaw.includes("MTN") ? "mtn" : netRaw.includes("TEL") ? "tel" : "at";
  const capDigits = String(ord.capacity || ord.package_size || "").replace(/[^0-9.]/g, "");

  const candidateKeys = [
    `p-${netKey}-${capDigits}`,
    `p-${netRaw.toLowerCase()}-${capDigits}`,
  ];
  for (const k of candidateKeys) {
    if (basePrices[k] !== undefined) {
      return Number(basePrices[k]);
    }
  }

  // 3. Match against DEFAULT_PRODUCTS catalogue
  const defaultProd = DEFAULT_PRODUCTS.find((p) => {
    const pNet = p.network.toUpperCase();
    const pCap = p.capacity.replace(/[^0-9.]/g, "");
    const matchesNet =
      (netKey === "mtn" && pNet === "MTN") ||
      (netKey === "tel" && pNet === "TELECEL") ||
      (netKey === "at" && (pNet === "AT" || pNet === "AIRTELTIGO"));
    return matchesNet && pCap === capDigits;
  });

  if (defaultProd) {
    if (basePrices[defaultProd.id] !== undefined) {
      return Number(basePrices[defaultProd.id]);
    }
    const discount = defaultProd.price >= 20 ? 1.50 : (defaultProd.price >= 10 ? 0.80 : 0.40);
    return Math.max(1, Number((defaultProd.price - discount).toFixed(2)));
  }

  // 4. Stored base_price on order
  if (Number(ord.base_price) > 0) {
    return Number(ord.base_price);
  }

  // 5. Fallback safety
  return Math.max(1, Number(ord.amount) - 2.50);
}

/**
 * Normalizes an order reference to prevent duplicates across tables and registries
 */
function getCanonicalOrderKey(o: any): string {
  const ref = String(o?.reference || o?.paystack_ref || o?.id || "").trim();
  const clean = ref.replace(/^agord-/, "").trim().toLowerCase();
  return clean || ref.toLowerCase();
}

/**
 * Loads agent orders and dynamically reconciles base_price and agent_profit with Admin Base Prices.
 * Strict deduplication by order reference ensures no order is ever repeated!
 */
export async function loadAgentOrders(supabase: any, agentId?: string, providedBasePrices?: Record<string, number>): Promise<any[]> {
  const basePrices = providedBasePrices || await loadBasePrices(supabase);
  const orderMap = new Map<string, any>();

  const normalizeOrder = (o: any) => {
    // If the order already has an explicitly recorded agent_profit from when the purchase occurred,
    // NEVER overwrite it with new base prices! This preserves past profits when admin changes prices.
    const hasRecordedProfit = o.agent_profit !== undefined && o.agent_profit !== null && !isNaN(Number(o.agent_profit));
    const sellingPrice = Number(o.amount) || Number(o.selling_price) || 0;
    const baseCost = (o.base_price !== undefined && o.base_price !== null && Number(o.base_price) > 0)
      ? Number(o.base_price)
      : resolveOrderBasePrice(o, basePrices);
    const profit = hasRecordedProfit
      ? Number(Number(o.agent_profit).toFixed(2))
      : Math.max(0, Number((sellingPrice - baseCost).toFixed(2)));
    return {
      ...o,
      reference: o.reference || o.id,
      amount: sellingPrice,
      base_price: baseCost,
      agent_profit: profit,
    };
  };

  const mergeIntoOrderMap = (rawOrder: any) => {
    if (!rawOrder) return;
    if (agentId && rawOrder.agent_id && rawOrder.agent_id !== agentId) return;

    // ⚡ FLASH SALE RULE: Flash sale orders never award agent profit or show in agent history
    if (
      rawOrder.is_flash_sale === true ||
      rawOrder.is_flash_sale === "true" ||
      (typeof rawOrder.notes === "string" && (rawOrder.notes.includes("FLASH_SALE") || rawOrder.notes.includes("FLASH SALE"))) ||
      (typeof rawOrder.product_id === "string" && rawOrder.product_id.startsWith("fs-"))
    ) {
      return;
    }

    // ⚡ ONLY SUCCESSFUL ORDERS COUNT: Never include pending, unpaid, or abandoned checkout attempts
    const payStatus = String(rawOrder.payment_status || rawOrder.status || "").toLowerCase();
    const isPaid = payStatus === "paid" || payStatus === "success" || payStatus === "completed";
    if (!isPaid) {
      return;
    }

    const norm = normalizeOrder(rawOrder);
    const key = getCanonicalOrderKey(norm);
    if (!key) return;

    if (!orderMap.has(key)) {
      orderMap.set(key, norm);
      return;
    }

    // Merge with existing record
    const existing = orderMap.get(key);

    // Keep the most accurate / latest status
    const allStatuses = [
      String(existing.delivery_status || ""),
      String(existing.status || ""),
      String(norm.delivery_status || ""),
      String(norm.status || ""),
    ].map((s) => s.toLowerCase());

    let finalStatus = existing.status || norm.status || "processing";
    if (allStatuses.includes("delivered") || allStatuses.includes("completed")) {
      finalStatus = "delivered";
    } else if (allStatuses.includes("failed")) {
      finalStatus = "failed";
    }

    const allPayStatuses = [
      String(existing.payment_status || ""),
      String(norm.payment_status || ""),
    ].map((s) => s.toLowerCase());

    let finalPayStatus = existing.payment_status || norm.payment_status || "pending";
    if (allPayStatuses.includes("paid") || allPayStatuses.includes("success") || allPayStatuses.includes("completed")) {
      finalPayStatus = "paid";
    }

    const existingProfit = (existing.agent_profit !== undefined && existing.agent_profit !== null && !isNaN(Number(existing.agent_profit)))
      ? Number(existing.agent_profit)
      : undefined;
    const finalProfit = existingProfit !== undefined
      ? existingProfit
      : (norm.agent_profit !== undefined && !isNaN(Number(norm.agent_profit)) ? Number(norm.agent_profit) : undefined);

    const existingBase = (existing.base_price !== undefined && existing.base_price !== null && Number(existing.base_price) > 0)
      ? Number(existing.base_price)
      : undefined;
    const finalBase = existingBase !== undefined
      ? existingBase
      : (norm.base_price !== undefined && Number(norm.base_price) > 0 ? Number(norm.base_price) : undefined);

    // Always preserve the earliest (original) creation timestamp so re-syncing never jumps an old order to the top
    const existingTime = existing.created_at ? new Date(existing.created_at).getTime() : NaN;
    const normTime = norm.created_at ? new Date(norm.created_at).getTime() : NaN;
    let resolvedCreatedAt = existing.created_at || norm.created_at || "2026-01-01T00:00:00.000Z";
    if (!isNaN(existingTime) && !isNaN(normTime)) {
      resolvedCreatedAt = existingTime <= normTime ? existing.created_at : norm.created_at;
    }

    orderMap.set(key, {
      ...norm,
      ...existing,
      id: existing.id || norm.id || key,
      reference: existing.reference || norm.reference || key,
      phone: norm.phone || existing.phone || "",
      network: norm.network || existing.network || "MTN",
      package_size: norm.package_size || existing.package_size || "",
      amount: Math.max(Number(existing.amount) || 0, Number(norm.amount) || 0),
      base_price: finalBase ?? norm.base_price,
      agent_profit: finalProfit ?? norm.agent_profit,
      payment_status: finalPayStatus,
      delivery_status: finalStatus,
      status: finalStatus,
      notes: existing.notes || norm.notes || undefined,
      netflix_last_code: norm.netflix_last_code || existing.netflix_last_code || null,
      netflix_last_code_at: norm.netflix_last_code_at || existing.netflix_last_code_at || null,
      created_at: resolvedCreatedAt,
    });
  };

  // 1. Load from agent_orders table with fallback
  try {
    let query = supabase
      .from("agent_orders")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(agentId ? 200 : 500);
    if (agentId) query = query.eq("agent_id", agentId);
    const { data, error } = await query;
    if (!error && Array.isArray(data)) {
      data.forEach(mergeIntoOrderMap);
    }
  } catch (_) { }

  // 2. Load from settings agent_orders_registry
  let hadRegistryDuplicates = false;
  try {
    const { data } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "agent_orders_registry")
      .maybeSingle();
    if (data?.value) {
      const list = JSON.parse(data.value);
      if (Array.isArray(list)) {
        const seenRegistryKeys = new Set<string>();
        list.forEach((o: any) => {
          const k = getCanonicalOrderKey(o);
          if (seenRegistryKeys.has(k)) {
            hadRegistryDuplicates = true;
          } else {
            seenRegistryKeys.add(k);
          }
          mergeIntoOrderMap(o);
        });

        // Clean registry if it contained duplicates
        if (hadRegistryDuplicates && !agentId) {
          const cleanedRegistry = Array.from(orderMap.values()).slice(0, 300);
          supabase.from("settings").upsert({
            key: "agent_orders_registry",
            value: JSON.stringify(cleanedRegistry),
          }, { onConflict: "key" }).then(() => { }).catch(() => { });
        }
      }
    }
  } catch (_) { }

  // 3. Load from core orders table (matching agent_id or notes containing [agent:...])
  try {
    let ordRows: any[] = [];
    const agentObj = memoryAgents?.find((a: any) => a.id === agentId || a.store_slug === agentId);
    const agentSlug = agentObj?.store_slug;

    try {
      let q = supabase
        .from("orders")
        .select("id, reference, ref, network, capacity, recipient_phone, phone_number, whatsapp_phone, amount, payment_status, delivery_status, status, created_at, datamart_reference, datamart_status, error_message, notes, agent_id")
        .order("created_at", { ascending: false })
        .limit(agentId ? 300 : 800);

      if (agentId) {
        if (agentSlug && agentSlug !== agentId) {
          q = q.or(`notes.ilike.%[agent:${agentId}]%,notes.ilike.%[agent:${agentSlug}]%,agent_id.eq.${agentId}`);
        } else {
          q = q.or(`notes.ilike.%[agent:${agentId}]%,agent_id.eq.${agentId}`);
        }
      }

      const { data, error } = await q;
      if (!error && Array.isArray(data)) {
        ordRows = data;
      } else {
        const { data: fallbackData } = await supabase
          .from("orders")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(agentId ? 300 : 800);
        if (Array.isArray(fallbackData)) ordRows = fallbackData;
      }
    } catch (_) {
      try {
        const { data: fallbackData } = await supabase
          .from("orders")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(agentId ? 300 : 800);
        if (Array.isArray(fallbackData)) ordRows = fallbackData;
      } catch (_) { }
    }

    if (Array.isArray(ordRows)) {
      ordRows.forEach((ord: any) => {
        const agMatch = ord.notes?.match(/\[agent:([^\]]+)\]/);
        const resolvedAgentId = ord.agent_id || (agMatch ? agMatch[1] : null);
        if (!resolvedAgentId) return; // Ignore non-agent orders
        if (agentId && resolvedAgentId !== agentId && resolvedAgentId !== agentSlug) return;

        const baseCost = resolveOrderBasePrice(ord, basePrices);
        const sellingPrice = Number(ord.amount) || 0;
        const profit = Math.max(0, Number((sellingPrice - baseCost).toFixed(2)));
        mergeIntoOrderMap({
          id: ord.id,
          agent_id: resolvedAgentId,
          reference: ord.reference || ord.ref || ord.id,
          network: ord.network || "MTN",
          package_size: `${ord.capacity || ""}GB`,
          phone: ord.recipient_phone || ord.phone_number || ord.whatsapp_phone || ord.phone || "",
          amount: sellingPrice,
          base_price: baseCost,
          agent_profit: profit,
          payment_status: ord.payment_status || "pending",
          delivery_status: ord.delivery_status || ord.status || "processing",
          status: ord.delivery_status || ord.status || "processing",
          notes: ord.notes || undefined,
          created_at: ord.created_at || "2026-01-01T00:00:00.000Z",
        });
      });
    }
  } catch (_) { }

  // 4. Load from service_orders (Netflix, AFA, Mashup)
  try {
    let sq = supabase
      .from("service_orders")
      .select("id, service, reference, customer_phone, customer_email, amount, status, delivery_status, notes, created_at")
      .order("created_at", { ascending: false })
      .limit(agentId ? 150 : 350);
    const agentObj = memoryAgents?.find((a: any) => a.id === agentId || a.store_slug === agentId);
    const agentSlug = agentObj?.store_slug;
    if (agentId) {
      if (agentSlug && agentSlug !== agentId) {
        sq = sq.or(`notes.ilike.%[agent:${agentId}]%,notes.ilike.%[agent:${agentSlug}]%`);
      } else {
        sq = sq.ilike("notes", `%[agent:${agentId}]%`);
      }
    } else {
      sq = sq.ilike("notes", "%[agent:%");
    }

    const { data: sData, error: sErr } = await sq;
    if (!sErr && Array.isArray(sData)) {
      sData.forEach((sOrd: any) => {
        const sAgMatch = sOrd.notes?.match(/\[agent:([^\]]+)\]/);
        const foundAgentId = sAgMatch ? sAgMatch[1] : undefined;
        if (!foundAgentId) return;
        if (agentId && foundAgentId !== agentId && foundAgentId !== agentSlug) return;

        const baseCost = resolveOrderBasePrice(sOrd, basePrices);
        const sellingPrice = Number(sOrd.amount) || 0;
        const profit = Math.max(0, Number((sellingPrice - baseCost).toFixed(2)));
        const serviceName =
          sOrd.service === "netflix"
            ? "Netflix 1 Month"
            : sOrd.service === "afa"
              ? "AFA Registration"
              : sOrd.service === "mashup"
                ? (sOrd.notes?.replace(/\[agent:[^\]]+\]\s*/, "") || "MTN Mashup")
                : sOrd.service === "boost"
                  ? (parseNoteTag(sOrd.notes, "boost_service_name") || "Social Media Boost")
                  : `${sOrd.service || "Service"}`;

        const codeMatch = sOrd.notes?.match(/\[netflix_code:([^\]]+)\]/) || sOrd.notes?.match(/\[code:([^\]]+)\]/);
        const codeAtMatch = sOrd.notes?.match(/\[netflix_code_at:([^\]]+)\]/);

        const paymentStatus = sOrd.status || "pending";
        mergeIntoOrderMap({
          id: sOrd.id,
          agent_id: foundAgentId,
          reference: sOrd.reference || sOrd.id,
          network: sOrd.service === "netflix" ? "NETFLIX" : sOrd.service === "boost" ? "BOOST" : "SERVICE",
          package_size: serviceName,
          phone: sOrd.customer_phone || "",
          amount: sellingPrice,
          base_price: baseCost,
          agent_profit: profit,
          payment_status: paymentStatus,
          delivery_status: sOrd.delivery_status || (paymentStatus === "paid" ? "delivered" : "pending"),
          status: sOrd.delivery_status || (paymentStatus === "paid" ? "delivered" : "pending"),
          netflix_last_code: codeMatch ? codeMatch[1].trim() : null,
          netflix_last_code_at: codeAtMatch ? codeAtMatch[1].trim() : null,
          created_at: sOrd.created_at || new Date().toISOString(),
        });
      });
    }
  } catch (_) { }

  // 5. Load from checker_orders (WAEC, BECE)
  try {
    let cq = supabase
      .from("checker_orders")
      .select("id, checker_type, reference, customer_phone, amount, status, delivery_status, notes, created_at")
      .order("created_at", { ascending: false })
      .limit(agentId ? 150 : 350);
    const agentObj = memoryAgents?.find((a: any) => a.id === agentId || a.store_slug === agentId);
    const agentSlug = agentObj?.store_slug;
    if (agentId) {
      if (agentSlug && agentSlug !== agentId) {
        cq = cq.or(`notes.ilike.%[agent:${agentId}]%,notes.ilike.%[agent:${agentSlug}]%`);
      } else {
        cq = cq.ilike("notes", `%[agent:${agentId}]%`);
      }
    } else {
      cq = cq.ilike("notes", "%[agent:%");
    }

    const { data: cData, error: cErr } = await cq;
    if (!cErr && Array.isArray(cData)) {
      cData.forEach((cOrd: any) => {
        const cAgMatch = cOrd.notes?.match(/\[agent:([^\]]+)\]/);
        const foundAgentId = cAgMatch ? cAgMatch[1] : undefined;
        if (!foundAgentId) return;
        if (agentId && foundAgentId !== agentId && foundAgentId !== agentSlug) return;

        const baseCost = resolveOrderBasePrice(cOrd, basePrices);
        const sellingPrice = Number(cOrd.amount) || 0;
        const profit = Math.max(0, Number((sellingPrice - baseCost).toFixed(2)));

        const paymentStatus = cOrd.status || "pending";
        mergeIntoOrderMap({
          id: cOrd.id,
          agent_id: foundAgentId,
          reference: cOrd.reference || cOrd.id,
          network: "CHECKER",
          package_size: `${cOrd.checker_type || "WAEC"} Result Checker`,
          phone: cOrd.customer_phone || "",
          amount: sellingPrice,
          base_price: baseCost,
          agent_profit: profit,
          payment_status: paymentStatus,
          delivery_status: cOrd.delivery_status || (paymentStatus === "paid" ? "delivered" : "pending"),
          status: cOrd.delivery_status || (paymentStatus === "paid" ? "delivered" : "pending"),
          created_at: cOrd.created_at || new Date().toISOString(),
        });
      });
    }
  } catch (_) { }

  // 6. Direct live synchronization for all Netflix / Service orders to ensure live code reflection
  try {
    const netflixOrders = Array.from(orderMap.values()).filter(
      (o) =>
        String(o.reference || "").startsWith("NF") ||
        String(o.network || "").toUpperCase() === "NETFLIX" ||
        String(o.package_size || "").toLowerCase().includes("netflix")
    );
    if (netflixOrders.length > 0) {
      const refs = netflixOrders.map((o) => o.reference).filter(Boolean);
      if (refs.length > 0) {
        const { data: sRows } = await supabase
          .from("service_orders")
          .select("reference, delivery_status, status, notes")
          .in("reference", refs);

        if (Array.isArray(sRows)) {
          sRows.forEach((sr: any) => {
            const k = getCanonicalOrderKey(sr);
            const current = orderMap.get(k);
            if (current) {
              const codeMatch = sr.notes?.match(/\[netflix_code:([^\]]+)\]/) || sr.notes?.match(/\[code:([^\]]+)\]/);
              const codeAtMatch = sr.notes?.match(/\[netflix_code_at:([^\]]+)\]/);
              if (codeMatch) current.netflix_last_code = codeMatch[1].trim();
              if (codeAtMatch) current.netflix_last_code_at = codeAtMatch[1].trim();
              if (sr.delivery_status) current.delivery_status = sr.delivery_status;
              if (sr.status) current.payment_status = sr.status;
            }
          });
        }
      }
    }
  } catch (_) { }

  return Array.from(orderMap.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

/**
 * Saves an agent order with strict deduplication by reference
 */
export async function recordAgentOrder(supabase: any, orderData: {
  agent_id: string;
  reference: string;
  network: string;
  package_size: string;
  phone: string;
  amount: number;
  base_price: number;
  agent_profit: number;
  paystack_ref?: string;
  status?: string;
  created_at?: string;
  notes?: string;
}) {
  // ⚡ SAFETY: Never record Flash Sale orders into agent history or wallet
  if (
    (orderData as any)?.is_flash_sale === true ||
    (typeof (orderData as any)?.notes === "string" && ((orderData as any).notes.includes("FLASH_SALE") || (orderData as any).notes.includes("FLASH SALE")))
  ) {
    return;
  }

  const cleanRef = String(orderData.reference || "").trim();
  const canonicalKey = cleanRef.replace(/^agord-/, "").trim().toLowerCase();
  const orderId = `agord-${cleanRef.replace(/[^a-zA-Z0-9_-]/g, "")}`;

  let resolvedCreatedAt = orderData.created_at || "";

  // 1. Check if order already exists in agent_orders or orders table before inserting so we never overwrite its original created_at
  let existingRow: any = null;
  try {
    const { data: existing } = await supabase
      .from("agent_orders")
      .select("id, reference, created_at")
      .or(`reference.eq.${cleanRef},id.eq.${orderId}`)
      .maybeSingle();
    if (existing) {
      existingRow = existing;
      if (!resolvedCreatedAt && existing.created_at) {
        resolvedCreatedAt = existing.created_at;
      }
    }
  } catch (_) { }

  if (!resolvedCreatedAt) {
    try {
      const { data: ordRow } = await supabase
        .from("orders")
        .select("created_at")
        .eq("reference", cleanRef)
        .maybeSingle();
      if (ordRow?.created_at) {
        resolvedCreatedAt = ordRow.created_at;
      }
    } catch (_) { }
  }

  const newOrder = {
    id: orderId,
    ...orderData,
    reference: cleanRef,
    payment_status: "paid",
    delivery_status: orderData.status || "processing",
    status: orderData.status || "processing",
    created_at: resolvedCreatedAt || getGhanaTimestamp(),
  };

  try {
    if (existingRow) {
      // Update existing record rather than creating a duplicate or overwriting created_at!
      await supabase.from("agent_orders").update({
        delivery_status: newOrder.delivery_status,
        status: newOrder.status,
        payment_status: "paid",
        agent_profit: newOrder.agent_profit,
      }).eq("id", existingRow.id);
    } else {
      await supabase.from("agent_orders").insert(newOrder);
    }
  } catch (_) {
    try {
      await supabase.from("agent_orders").upsert(newOrder, { onConflict: "id" });
    } catch (_) { }
  }

  // 2. Update in settings registry with deduplication and preserve original created_at
  try {
    const { data } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "agent_orders_registry")
      .maybeSingle();
    let current: any[] = [];
    if (data?.value) {
      try { current = JSON.parse(data.value); } catch { }
    }
    const existingInReg = current.find((o: any) => {
      const k = String(o.reference || o.id || "").replace(/^agord-/, "").trim().toLowerCase();
      return k === canonicalKey;
    });
    if (existingInReg?.created_at && !resolvedCreatedAt) {
      newOrder.created_at = existingInReg.created_at;
    } else if (existingInReg?.created_at && newOrder.created_at) {
      // Always keep the earlier timestamp
      const t1 = new Date(existingInReg.created_at).getTime();
      const t2 = new Date(newOrder.created_at).getTime();
      if (!isNaN(t1) && !isNaN(t2) && t1 < t2) {
        newOrder.created_at = existingInReg.created_at;
      }
    }
    // Remove any existing copy with the same reference or ID
    current = current.filter((o: any) => {
      const k = String(o.reference || o.id || "").replace(/^agord-/, "").trim().toLowerCase();
      return k !== canonicalKey;
    });
    current.unshift(newOrder);
    // Keep strictly sorted newest-first by real created_at so re-synced historical orders never sit at the top
    current.sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
    if (current.length > 500) current = current.slice(0, 500);
    await supabase.from("settings").upsert({
      key: "agent_orders_registry",
      value: JSON.stringify(current),
    }, { onConflict: "key" });
  } catch (_) { }

  return newOrder;
}

/**
 * Generates clean alphanumeric referral code (e.g. WIN5-7K9M)
 */
export function generateReferralCode(): string {
  const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  let rand = "";
  for (let i = 0; i < 5; i++) {
    rand += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `WIN5-${rand}`;
}

/**
 * Records customer referral order for an agent and notifies admin if 5 reached
 */
export async function recordAgentReferralReward(supabase: any, params: {
  agent_id: string;
  agent_name?: string;
  agent_slug?: string;
  referral_code: string;
  buyer_phone: string;
  order_ref: string;
  amount: number;
}) {
  const { agent_id, referral_code, buyer_phone, order_ref, amount } = params;
  if (!agent_id || !referral_code || !buyer_phone) return;

  const cleanAgentId = String(agent_id).trim();
  const cleanRefCode = String(referral_code).trim().toLowerCase();
  const cleanBuyerPhone = cleanGhanaPhone(buyer_phone);

  try {
    const settingKey = `agent_referrals_${cleanAgentId}`;
    const { data } = await supabase
      .from("settings")
      .select("value")
      .eq("key", settingKey)
      .maybeSingle();

    let referralsList: any[] = [];
    if (data?.value) {
      try {
        referralsList = typeof data.value === "string" ? JSON.parse(data.value) : data.value;
      } catch (_) { }
    }

    // Match by referral_code or customer_phone
    const matchedIdx = referralsList.findIndex((r: any) => {
      const code = String(r.referral_code || "").trim().toLowerCase();
      const phone = cleanGhanaPhone(r.customer_phone || "").toLowerCase();
      return code === cleanRefCode || phone === cleanRefCode;
    });

    if (matchedIdx === -1) return;
    const targetRef = referralsList[matchedIdx];

    // Disallow self-referral
    if (cleanGhanaPhone(targetRef.customer_phone) === cleanBuyerPhone) {
      return;
    }

    targetRef.referred_buyers = Array.isArray(targetRef.referred_buyers) ? targetRef.referred_buyers : [];
    const alreadyCounted = targetRef.referred_buyers.some((b: any) =>
      b.order_reference === order_ref || cleanGhanaPhone(b.buyer_phone) === cleanBuyerPhone
    );
    if (alreadyCounted) return;

    targetRef.referred_buyers.push({
      buyer_phone: cleanBuyerPhone,
      order_reference: order_ref,
      amount: Number(amount || 0),
      created_at: getGhanaTimestamp(),
    });

    targetRef.total_qualified_orders = targetRef.referred_buyers.length;
    targetRef.updated_at = getGhanaTimestamp();

    // Check if 5 referrals reached!
    if (targetRef.total_qualified_orders >= 5) {
      targetRef.reward_claimed = true;
      targetRef.reward_status = "pending_fulfillment";

      if (!targetRef.notified_admin) {
        targetRef.notified_admin = true;
        try {
          const { sendAdminAgentReferralWinnerAlert } = await import("./_notifications.js");
          await sendAdminAgentReferralWinnerAlert({
            customerPhone: targetRef.customer_phone,
            agentName: params.agent_name || targetRef.agent_name || "Agent Store",
            agentSlug: params.agent_slug || targetRef.agent_slug,
            referralCode: targetRef.referral_code,
            referralsCount: targetRef.total_qualified_orders,
          }, supabase);
        } catch (notifErr) {
          console.warn("Failed sending agent referral admin alert:", notifErr);
        }
      }
    }

    referralsList[matchedIdx] = targetRef;

    await supabase.from("settings").upsert({
      key: settingKey,
      value: JSON.stringify(referralsList),
    }, { onConflict: "key" });
  } catch (err: any) {
    console.warn("recordAgentReferralReward error:", err?.message);
  }
}


/**
 * Loads agent withdrawals
 */
async function loadWithdrawals(supabase: any, agentId?: string): Promise<any[]> {
  const withdrawalMap = new Map<string, any>();

  try {
    let q = supabase.from("agent_withdrawals").select("*").order("created_at", { ascending: false });
    if (agentId) q = q.eq("agent_id", agentId);
    const { data, error } = await q;
    if (!error && Array.isArray(data)) {
      data.forEach((w: any) => {
        if (w.id) withdrawalMap.set(w.id, w);
      });
    }
  } catch (_) { }

  try {
    const { data } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "agent_withdrawals_registry")
      .maybeSingle();
    if (data?.value) {
      const list = JSON.parse(data.value);
      if (Array.isArray(list)) {
        list.forEach((w: any) => {
          if (!agentId || w.agent_id === agentId) {
            if (w.id && !withdrawalMap.has(w.id)) {
              withdrawalMap.set(w.id, w);
            }
          }
        });
      }
    }
  } catch (_) { }

  return Array.from(withdrawalMap.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

/**
 * Calculates current financials for an agent
 */
async function getAgentFinancials(supabase: any, agentId: string) {
  const basePrices = await loadBasePrices(supabase);
  const orders = await loadAgentOrders(supabase, agentId, basePrices);
  const withdrawals = await loadWithdrawals(supabase, agentId);

  const ghanaToday = getGhanaToday();

  let todayOrdersCount = 0;
  let todayProfit = 0;
  let totalProfit = 0;

  for (const o of orders) {
    const sellingPrice = Number(o.amount) || Number(o.selling_price) || 0;
    // CRITICAL FIX: Always use the order's actual recorded profit from when the purchase occurred!
    // Never recalculate past order profit using current basePrices, because changing wholesale prices
    // would retroactively deduct from the agent's wallet balance!
    const profit = (o.agent_profit !== undefined && o.agent_profit !== null && !isNaN(Number(o.agent_profit)))
      ? Number(Number(o.agent_profit).toFixed(2))
      : Math.max(0, Number((sellingPrice - resolveOrderBasePrice(o, basePrices)).toFixed(2)));

    const statusLower = String(o.status || o.delivery_status || "").toLowerCase();
    const payStatusLower = String(o.payment_status || "").toLowerCase();

    // The profit must ONLY be added when payment is successful!
    const isPaymentSuccessful =
      payStatusLower === "paid" ||
      payStatusLower === "success" ||
      payStatusLower === "completed" ||
      (
        (statusLower === "paid" || statusLower === "delivered" || statusLower === "completed") &&
        payStatusLower !== "pending" &&
        payStatusLower !== "failed" &&
        payStatusLower !== "unpaid" &&
        payStatusLower !== "cancelled"
      );

    if (isPaymentSuccessful) {
      totalProfit += profit;
      const orderDate = (o.created_at || "").split("T")[0];
      if (orderDate === ghanaToday) {
        todayOrdersCount += 1;
        todayProfit += profit;
      }
    }
  }

  let totalWithdrawn = 0;
  let pendingWithdrawal = 0;

  for (const w of withdrawals) {
    const amt = Number(w.amount) || 0;
    const statusLower = String(w.status || "").toLowerCase();
    if (statusLower === "completed" || statusLower === "approved" || statusLower === "paid" || statusLower === "disbursed") {
      totalWithdrawn += amt;
    } else if (statusLower === "pending" || statusLower === "processing") {
      pendingWithdrawal += amt;
    }
  }

  const walletBalance = Math.max(0, Number((totalProfit - totalWithdrawn - pendingWithdrawal).toFixed(2)));

  return {
    // Camel case
    todayOrdersCount,
    todayProfit: Number(todayProfit.toFixed(2)),
    totalProfit: Number(totalProfit.toFixed(2)),
    totalWithdrawn: Number(totalWithdrawn.toFixed(2)),
    pendingWithdrawal: Number(pendingWithdrawal.toFixed(2)),
    walletBalance,

    // Snake case (for AgentProfile and Admin frontend)
    today_orders_count: todayOrdersCount,
    today_profit: Number(todayProfit.toFixed(2)),
    total_profit: Number(totalProfit.toFixed(2)),
    total_withdrawn: Number(totalWithdrawn.toFixed(2)),
    pending_withdrawal: Number(pendingWithdrawal.toFixed(2)),
    wallet_balance: walletBalance,
  };
}

export default async function handler(req: any, res: any) {
  setCorsHeaders(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  const supabase = getSupabase();
  if (supabase && (await detectAndBlockIntrusion(req, res, supabase))) return;
  const body = parseBody(req);
  const action = body?.action || req.query?.action;

  const ADMIN_ONLY_ACTIONS = new Set([
    "adminGetAgents",
    "adminToggleSuspendAgent",
    "adminDeleteAgent",
    "adminCreditAgent",
    "adminResetAgentStats",
    "adminGetBasePrices",
    "adminUpdateBasePrices",
    "adminGetWithdrawals",
    "testPaystack",
    "adminApproveWithdrawal",
    "adminRejectWithdrawal",
    "adminGetOrders",
    "testEmail",
    "testWithdrawalAlert",
    "testAgentRegistrationAlert",
    "adminUpdateAgentCredentials",
    "setAllAgentsBoostMarkup",
    "adminSetAllAgentsBoostMarkup",
  ]);

  if (ADMIN_ONLY_ACTIONS.has(String(action || ""))) {
    const auth = await verifyAdminUser(req, supabase);
    if (!auth.authorized) {
      return res.status(401).json({ ok: false, error: auth.error || "Unauthorized: Administrator privileges required." });
    }
  }

  try {
    // -------------------------------------------------------------
    // 1. REGISTER NEW AGENT
    // -------------------------------------------------------------
    if (action === "register") {
      const name = String(body?.name || "").trim();
      const email = String(body?.email || "").toLowerCase().trim();
      const phone = String(body?.phone || "").replace(/\s+/g, "").trim();
      const password = String(body?.password || "").trim();
      const storeName = String(body?.store_name || `${name}'s Data Hub`).trim();
      const rawSlug = String(body?.store_slug || name || "").toLowerCase().trim();
      const storeSlug = rawSlug.replace(/[^a-z0-9_-]/g, "-").replace(/^-+|-+$/g, "") || `agent-${Math.random().toString(36).slice(2, 7)}`;

      if (!name || !email || !phone || !password) {
        return res.status(400).json({ ok: false, error: "Please fill in all required fields (Name, Email, Phone, Password)." });
      }

      if (password.length < 6) {
        return res.status(400).json({ ok: false, error: "Password must be at least 6 characters." });
      }

      const agents = await loadAgents(supabase);
      if (agents.some((a) => a.email === email)) {
        return res.status(400).json({ ok: false, error: "An agent account with this email already exists. Please log in." });
      }
      if (agents.some((a) => a.store_slug === storeSlug)) {
        return res.status(400).json({ ok: false, error: `Store handle "/${storeSlug}" is already taken. Please choose another.` });
      }

      const agentId = `ag_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const basePrices = await loadBasePrices(supabase);

      // Initialize default custom prices with a 2 GHS markup for the agent
      const customPrices: Record<string, number> = {};
      DEFAULT_PRODUCTS.forEach((p) => {
        const base = basePrices[p.id] || p.price;
        customPrices[p.id] = Number((base + (p.price >= 20 ? 3.00 : 1.50)).toFixed(2));
      });

      const newAgent = {
        id: agentId,
        name,
        email,
        phone,
        password_hash: password, // In production, agent password comparison
        store_name: storeName,
        store_slug: storeSlug,
        description: `Instant, automatic data bundles powered by ${storeName}. Non-expiry & fast delivery.`,
        whatsapp_number: phone,
        momo_number: phone,
        momo_network: "MTN",
        momo_name: name,
        logo_url: "",
        custom_prices: customPrices,
        status: "active",
        created_at: getGhanaTimestamp(),
      };

      agents.unshift(newAgent);
      // Persist specific new agent directly for instant (<300ms) database writes
      await saveAgents(supabase, agents, newAgent.id);

      const storeLink = `https://gooddata1.vercel.app/s/${newAgent.store_slug}`;
      const emailMsg =
        `Congrats ${newAgent.name}! Welcome on board as an agent under Data1gh.

You can now sell and earn your profits. Your earnings are saved.

Your Official Storefront Link:
${storeLink}

Glad to have you!`;

      // Dispatch notifications concurrently with a 2-second safety timeout
      // so slow SMS/WhatsApp/Email gateways never delay registration or cause client timeouts!
      let regNotif: any = null;
      try {
        const notifPromise = Promise.allSettled([
          sendAgentRegistrationNotification(
            {
              agentId: newAgent.id,
              name: newAgent.name,
              email: newAgent.email,
              phone: newAgent.phone,
              storeName: newAgent.store_name,
              storeSlug: newAgent.store_slug,
            },
            supabase
          ).then((res) => { regNotif = res; return res; }),
          sendAgentNotification(supabase, {
            email: newAgent.email,
            subject: "Welcome to Data1gh - Your Agent Store is Live!",
            message: emailMsg,
          }),
        ]);

        await Promise.race([
          notifPromise,
          new Promise((resolve) => setTimeout(resolve, 2000)),
        ]);
      } catch (notifErr) {
        console.warn("Notice: background registration notification dispatch:", notifErr);
      }

      return res.status(200).json({
        ok: true,
        message: "Agent account created successfully!",
        store_url: regNotif?.storeUrl || storeLink,
        agent_sms_sent: Boolean(regNotif?.agentSmsSent),
        admin_whatsapp_sent: Boolean(regNotif?.adminWhatsAppSent),
        agent: {
          id: newAgent.id,
          name: newAgent.name,
          email: newAgent.email,
          phone: newAgent.phone,
          store_name: newAgent.store_name,
          store_slug: newAgent.store_slug,
          description: newAgent.description,
          whatsapp_number: newAgent.whatsapp_number,
          momo_number: newAgent.momo_number,
          momo_network: newAgent.momo_network,
          momo_name: newAgent.momo_name,
          wallet_balance: 0,
          today_orders_count: 0,
          today_profit: 0,
          total_profit: 0,
        },
      });
    }

    // -------------------------------------------------------------
    // 2. LOGIN AGENT
    // -------------------------------------------------------------
    if (action === "login") {
      const identifier = String(body?.identifier || body?.email || body?.phone || "").trim();
      const password = String(body?.password || "").trim();

      if (!identifier || !password) {
        return res.status(400).json({ ok: false, error: "Please enter your email or phone and password." });
      }

      let agents = await loadAgents(supabase);
      let matched = findAgentByIdentifier(agents, identifier);

      // If not matched from memory cache, force-refresh from Supabase
      if (!matched) {
        agents = await loadAgents(supabase, true);
        matched = findAgentByIdentifier(agents, identifier);
      }

      // If still not matched, perform direct database query fallback
      if (!matched) {
        matched = await queryAgentFromDb(supabase, identifier);
        if (matched) {
          agents.unshift(matched);
        }
      }

      if (!matched) {
        return res.status(401).json({ ok: false, error: "Invalid email/phone or password." });
      }

      // Ensure password_hash is verified
      let storedPassword = matched.password_hash || matched.password || "";
      if (!storedPassword && matched.id) {
        try {
          const { data: dbRow } = await supabase.from("agents").select("password_hash").eq("id", matched.id).maybeSingle();
          if (dbRow?.password_hash) {
            storedPassword = dbRow.password_hash;
            matched.password_hash = dbRow.password_hash;
          }
        } catch (_) { }
      }

      if (!storedPassword || storedPassword !== password) {
        return res.status(401).json({ ok: false, error: "Invalid email/phone or password." });
      }

      if (matched.status === "suspended") {
        return res.status(403).json({ ok: false, error: "Your agent account has been suspended. Please contact administrator support." });
      }

      const financials = await getAgentFinancials(supabase, matched.id);

      return res.status(200).json({
        ok: true,
        message: "Login successful!",
        agent: {
          id: matched.id,
          name: matched.name,
          email: matched.email,
          phone: matched.phone,
          store_name: matched.store_name,
          store_slug: matched.store_slug,
          description: matched.description || "",
          whatsapp_number: matched.whatsapp_number || matched.phone,
          momo_number: matched.momo_number || matched.phone,
          momo_network: matched.momo_network || "MTN",
          momo_name: matched.momo_name || matched.name,
          custom_prices: matched.custom_prices || {},
          logo_url: matched.logo_url || "",
          whatsapp_group_url: matched.whatsapp_group_url || matched.whatsapp_channel_url || "",
          custom_domain: matched.custom_domain || "",
          store_theme: matched.store_theme || "cyber",
          announcement: matched.announcement || "",
          announcement_enabled: matched.announcement_enabled ?? false,
          announcement_type: matched.announcement_type || "promo",
          ...financials,
        },
      });
    }

    // -------------------------------------------------------------
    // 2B. FORGOT PASSWORD (REQUEST RESET CODE TO EMAIL & PHONE)
    // -------------------------------------------------------------
    if (action === "forgotPassword") {
      const identifier = String(body?.identifier || body?.email || body?.phone || "").trim();
      if (!identifier) {
        return res.status(400).json({ ok: false, error: "Please enter your registered email or phone number." });
      }

      let agents = await loadAgents(supabase);
      let matched = findAgentByIdentifier(agents, identifier);

      // If not found in cache, force refresh from database
      if (!matched) {
        agents = await loadAgents(supabase, true);
        matched = findAgentByIdentifier(agents, identifier);
      }

      // If still not found, execute direct DB lookup
      if (!matched) {
        matched = await queryAgentFromDb(supabase, identifier);
      }

      if (!matched) {
        return res.status(404).json({ ok: false, error: "No agent account found with that email or phone number." });
      }

      const code = Math.floor(100000 + Math.random() * 900000).toString();
      await saveOtp(supabase, `reset_${matched.id}`, code, 15 * 60 * 1000); // 15 mins

      const subject = "Data1gh - Password Reset Verification Code";
      const message = `Hello ${matched.name},\n\nYour Data1gh password reset verification code is: ${code}\n\nThis code expires in 15 minutes. Enter this code to set a new password for your account.\n\nData1gh Reseller Network`;

      const recipientPhone = matched.phone || matched.whatsapp_number || matched.momo_number || "";
      const { emailSent, smsSent, deliveredEmail, error } = await sendAgentNotification(supabase, {
        email: matched.email,
        phone: recipientPhone,
        code,
        subject,
        message,
      });

      if (!emailSent && !smsSent) {
        return res.status(400).json({
          ok: false,
          error: error || "Failed to deliver reset code. Please ensure your registered email or phone number is active.",
        });
      }

      const targetEmail = deliveredEmail || matched.email || "";
      const maskedEmail = targetEmail.includes("@")
        ? `${targetEmail.slice(0, 3)}***@${targetEmail.split("@")[1]}`
        : targetEmail;
      const maskedPhone = recipientPhone.length > 4 ? `***${recipientPhone.slice(-4)}` : recipientPhone;

      let notifMsg = `Verification code sent to your email (${maskedEmail}) and SMS (${maskedPhone})!`;
      if (emailSent && !smsSent) notifMsg = `Verification code sent to your email (${maskedEmail})!`;
      if (!emailSent && smsSent) notifMsg = `Verification code sent via SMS to your phone (${maskedPhone})!`;

      return res.status(200).json({
        ok: true,
        agent_id: matched.id,
        message: notifMsg,
        email_sent: emailSent,
        sms_sent: smsSent,
      });
    }

    // -------------------------------------------------------------
    // 2C. RESET PASSWORD (VERIFY CODE & UPDATE PASSWORD)
    // -------------------------------------------------------------
    if (action === "resetPassword") {
      const agentId = String(body?.agent_id || "").trim();
      const identifier = String(body?.identifier || "").trim();
      const code = String(body?.code || "").trim();
      const newPassword = String(body?.new_password || "").trim();

      if (!code || !newPassword) {
        return res.status(400).json({ ok: false, error: "Verification code and new password are required." });
      }
      if (newPassword.length < 6) {
        return res.status(400).json({ ok: false, error: "New password must be at least 6 characters long." });
      }

      let agents = await loadAgents(supabase, true);
      let matched = agentId ? agents.find((a) => a.id === agentId) : null;
      if (!matched && identifier) {
        matched = findAgentByIdentifier(agents, identifier);
      }
      if (!matched && identifier) {
        matched = await queryAgentFromDb(supabase, identifier);
      }

      if (!matched) {
        return res.status(404).json({ ok: false, error: "Agent account not found." });
      }

      const isValid = await verifyAndConsumeOtp(supabase, `reset_${matched.id}`, code);
      if (!isValid) {
        return res.status(400).json({ ok: false, error: "Invalid or expired reset code. Please request a new one." });
      }

      matched.password_hash = newPassword;
      await saveAgents(supabase, agents, matched.id);

      // Direct update to agents table as extra safety
      try {
        await supabase.from("agents").update({ password_hash: newPassword }).eq("id", matched.id);
      } catch (_) { }

      return res.status(200).json({
        ok: true,
        message: "Password reset successfully! You can now log in with your new password.",
      });
    }

    // -------------------------------------------------------------
    // 3. GET AGENT PROFILE & LIVE FINANCIALS
    // -------------------------------------------------------------
    if (action === "getProfile") {
      const agentId = String(body?.agent_id || req.query?.agent_id || "").trim();
      if (!agentId) return res.status(400).json({ ok: false, error: "Agent ID required" });

      let matched: any = null;
      if (memoryAgents && Array.isArray(memoryAgents)) {
        matched = memoryAgents.find((a: any) => a.id === agentId || a.store_slug === agentId);
      }
      if (!matched) {
        try {
          const { data, error } = await supabase
            .from("agents")
            .select("id, name, email, phone, store_name, store_slug, description, whatsapp_number, momo_number, momo_network, momo_name, custom_prices, status, created_at, wallet_balance, logo_url, store_theme, custom_domain, whatsapp_group_url")
            .or(`id.eq.${agentId},store_slug.ilike.${agentId}`)
            .maybeSingle();
          if (!error && data) {
            matched = data;
          }
        } catch (_) { }
      }
      if (!matched) {
        const agents = await loadAgents(supabase);
        matched = agents.find((a) => a.id === agentId || a.store_slug === agentId);
      }
      if (!matched) return res.status(404).json({ ok: false, error: "Agent not found" });

      const financials = await getAgentFinancials(supabase, matched.id);
      const basePrices = await loadBasePrices(supabase);
      const dedicatedPricing = await loadAgentPricing(supabase, matched.id);
      const resolvedCustomPrices = {
        ...(matched.custom_prices || {}),
        ...dedicatedPricing,
      };

      let resolvedLogo = matched.logo_url || "";
      let resolvedTheme = matched.store_theme || "cyber";
      let resolvedWaGroup = matched.whatsapp_group_url || matched.whatsapp_channel_url || "";
      let resolvedDomain = matched.custom_domain || "";
      let resolvedAnnouncement = matched.announcement || "";
      let resolvedAnnouncementEnabled = matched.announcement_enabled ?? false;
      let resolvedAnnouncementType = matched.announcement_type || "promo";
      let resolvedPopupEnabled = matched.announcement_popup_enabled ?? false;
      let resolvedPopupTitle = matched.announcement_popup_title || "";
      let resolvedPopupMessage = matched.announcement_popup_message || "";
      let resolvedPopupBadge = matched.announcement_popup_badge || "";
      let resolvedPopupCtaText = matched.announcement_popup_cta_text || "";
      let resolvedPopupCtaUrl = matched.announcement_popup_cta_url || "";

      if (!resolvedLogo || !resolvedWaGroup || matched.announcement === undefined || matched.announcement_popup_enabled === undefined) {
        try {
          const { data: bData } = await supabase.from("settings").select("value").eq("key", `agent_branding_${matched.id}`).maybeSingle();
          if (bData?.value) {
            const parsed = JSON.parse(bData.value);
            if (parsed.logo_url && !resolvedLogo) resolvedLogo = parsed.logo_url;
            if (parsed.store_theme && !resolvedTheme) resolvedTheme = parsed.store_theme;
            if (parsed.whatsapp_group_url && !resolvedWaGroup) resolvedWaGroup = parsed.whatsapp_group_url;
            if (parsed.custom_domain && !resolvedDomain) resolvedDomain = parsed.custom_domain;
            if (parsed.announcement !== undefined && !resolvedAnnouncement) resolvedAnnouncement = parsed.announcement;
            if (parsed.announcement_enabled !== undefined && matched.announcement_enabled === undefined) resolvedAnnouncementEnabled = parsed.announcement_enabled;
            if (parsed.announcement_type && !matched.announcement_type) resolvedAnnouncementType = parsed.announcement_type;
            if (parsed.announcement_popup_enabled !== undefined && matched.announcement_popup_enabled === undefined) resolvedPopupEnabled = parsed.announcement_popup_enabled;
            if (parsed.announcement_popup_title && !resolvedPopupTitle) resolvedPopupTitle = parsed.announcement_popup_title;
            if (parsed.announcement_popup_message && !resolvedPopupMessage) resolvedPopupMessage = parsed.announcement_popup_message;
            if (parsed.announcement_popup_badge && !resolvedPopupBadge) resolvedPopupBadge = parsed.announcement_popup_badge;
            if (parsed.announcement_popup_cta_text && !resolvedPopupCtaText) resolvedPopupCtaText = parsed.announcement_popup_cta_text;
            if (parsed.announcement_popup_cta_url && !resolvedPopupCtaUrl) resolvedPopupCtaUrl = parsed.announcement_popup_cta_url;
          }
        } catch (_) { }
      }

      return res.status(200).json({
        ok: true,
        agent: {
          id: matched.id,
          name: matched.name,
          email: matched.email,
          phone: matched.phone,
          store_name: matched.store_name,
          store_slug: matched.store_slug,
          description: matched.description || "",
          whatsapp_number: matched.whatsapp_number || matched.phone,
          momo_number: matched.momo_number || matched.phone,
          momo_network: matched.momo_network || "MTN",
          momo_name: matched.momo_name || matched.name,
          custom_prices: resolvedCustomPrices,
          logo_url: resolvedLogo,
          whatsapp_group_url: resolvedWaGroup,
          custom_domain: resolvedDomain,
          store_theme: resolvedTheme,
          announcement: resolvedAnnouncement,
          announcement_enabled: Boolean(resolvedAnnouncementEnabled),
          announcement_type: resolvedAnnouncementType,
          announcement_popup_enabled: Boolean(resolvedPopupEnabled),
          announcement_popup_title: resolvedPopupTitle,
          announcement_popup_message: resolvedPopupMessage,
          announcement_popup_badge: resolvedPopupBadge,
          announcement_popup_cta_text: resolvedPopupCtaText,
          announcement_popup_cta_url: resolvedPopupCtaUrl,
          ...financials,
        },
        base_prices: basePrices,
      });
    }

    // -------------------------------------------------------------
    // 4. UPDATE STORE PROFILE / SETTINGS
    // -------------------------------------------------------------
    if (action === "updateProfile") {
      const agentId = String(body?.agent_id || "").trim();
      if (!agentId) return res.status(400).json({ ok: false, error: "Agent ID required" });

      const agents = await loadAgents(supabase);
      const index = agents.findIndex((a) => a.id === agentId);
      if (index === -1) return res.status(404).json({ ok: false, error: "Agent not found" });

      const target = agents[index];

      if (body?.store_slug) {
        const cleanSlug = String(body.store_slug).toLowerCase().trim().replace(/[^a-z0-9_-]/g, "-").replace(/^-+|-+$/g, "");
        if (cleanSlug && cleanSlug !== target.store_slug) {
          if (agents.some((a) => a.id !== target.id && a.store_slug === cleanSlug)) {
            return res.status(400).json({ ok: false, error: `The store handle "/${cleanSlug}" is already taken.` });
          }
          target.store_slug = cleanSlug;
        }
      }

      if (body?.store_name !== undefined) target.store_name = String(body.store_name).trim();
      if (body?.description !== undefined) target.description = String(body.description).trim();
      if (body?.whatsapp_number !== undefined) target.whatsapp_number = String(body.whatsapp_number).trim();
      if (body?.momo_number !== undefined) target.momo_number = String(body.momo_number).trim();
      if (body?.momo_network !== undefined) target.momo_network = String(body.momo_network).trim();
      if (body?.momo_name !== undefined) target.momo_name = String(body.momo_name).trim();
      if (body?.logo_url !== undefined) target.logo_url = String(body.logo_url).trim();
      if (body?.whatsapp_group_url !== undefined) target.whatsapp_group_url = String(body.whatsapp_group_url).trim();
      if (body?.whatsapp_channel_url !== undefined) target.whatsapp_group_url = String(body.whatsapp_channel_url).trim();
      if (body?.custom_domain !== undefined) target.custom_domain = String(body.custom_domain).trim();
      if (body?.store_theme !== undefined) target.store_theme = String(body.store_theme).trim();
      if (body?.theme !== undefined) target.store_theme = String(body.theme).trim();
      if (body?.announcement !== undefined) target.announcement = String(body.announcement).trim();
      if (body?.announcement_enabled !== undefined) target.announcement_enabled = Boolean(body.announcement_enabled);
      if (body?.announcement_type !== undefined) target.announcement_type = String(body.announcement_type).trim();
      if (body?.announcement_popup_enabled !== undefined) target.announcement_popup_enabled = Boolean(body.announcement_popup_enabled);
      if (body?.announcement_popup_title !== undefined) target.announcement_popup_title = String(body.announcement_popup_title).trim();
      if (body?.announcement_popup_message !== undefined) target.announcement_popup_message = String(body.announcement_popup_message).trim();
      if (body?.announcement_popup_badge !== undefined) target.announcement_popup_badge = String(body.announcement_popup_badge).trim();
      if (body?.announcement_popup_cta_text !== undefined) target.announcement_popup_cta_text = String(body.announcement_popup_cta_text).trim();
      if (body?.announcement_popup_cta_url !== undefined) target.announcement_popup_cta_url = String(body.announcement_popup_cta_url).trim();

      agents[index] = target;
      await saveAgents(supabase, agents, target.id);

      // Force-clear memoryAgents cache timestamp so any subsequent call gets immediate fresh data
      memoryAgentsLoadedAt = 0;

      // Direct fallback upsert to ensure branding and announcement persistence never fails
      try {
        const brandingPayload = {
          logo_url: target.logo_url || "",
          whatsapp_group_url: target.whatsapp_group_url || "",
          custom_domain: target.custom_domain || "",
          store_theme: target.store_theme || "cyber",
          announcement: target.announcement || "",
          announcement_enabled: target.announcement_enabled ?? false,
          announcement_type: target.announcement_type || "promo",
          announcement_popup_enabled: target.announcement_popup_enabled ?? false,
          announcement_popup_title: target.announcement_popup_title || "",
          announcement_popup_message: target.announcement_popup_message || "",
          announcement_popup_badge: target.announcement_popup_badge || "",
          announcement_popup_cta_text: target.announcement_popup_cta_text || "",
          announcement_popup_cta_url: target.announcement_popup_cta_url || "",
        };
        const recordsToSave = [
          {
            key: `agent_branding_${target.id}`,
            value: JSON.stringify(brandingPayload),
          },
        ];
        if (target.store_slug) {
          recordsToSave.push({
            key: `agent_branding_${String(target.store_slug).toLowerCase().trim()}`,
            value: JSON.stringify(brandingPayload),
          });
        }
        await supabase.from("settings").upsert(recordsToSave, { onConflict: "key" });
      } catch (_) { }

      return res.status(200).json({ ok: true, message: "Profile updated successfully!", agent: sanitizeAgentRecord(target) });
    }

    // -------------------------------------------------------------
    // 5. GET PRODUCTS & PRICING
    // -------------------------------------------------------------
    if (action === "getProducts") {
      const agentId = String(body?.agent_id || req.query?.agent_id || "").trim();
      let agent = memoryAgents?.find((a: any) => a.id === agentId || a.store_slug === agentId);
      if (!agent) {
        try {
          const { data } = await supabase
            .from("agents")
            .select("id, custom_prices")
            .or(`id.eq.${agentId},store_slug.ilike.${agentId}`)
            .maybeSingle();
          if (data) agent = data;
        } catch (_) { }
      }
      if (!agent) {
        const agents = await loadAgents(supabase);
        agent = agents.find((a) => a.id === agentId || a.store_slug === agentId);
      }
      const basePrices = await loadBasePrices(supabase);
      const dedicatedPricing = await loadAgentPricing(supabase, agent?.id);
      const agentCustomPrices = {
        ...(agent?.custom_prices || {}),
        ...dedicatedPricing,
      };

      const productsWithPrices = DEFAULT_PRODUCTS.map((p) => {
        const baseCost = basePrices[p.id] ?? p.price;
        const sellingPrice = resolveProductCustomPrice(p, agentCustomPrices, baseCost);
        const profit = Math.max(0, Number((sellingPrice - baseCost).toFixed(2)));

        return {
          id: p.id,
          network: p.network,
          capacity: p.capacity,
          mb: p.mb,
          name: p.name,
          base_price: baseCost,
          selling_price: sellingPrice,
          profit,
          in_stock: p.in_stock,
          sort_order: p.sort_order,
        };
      });

      const netflixPrice = resolveServiceCustomPrice("netflix", agentCustomPrices, 30.00);
      const afaPrice = resolveServiceCustomPrice("afa", agentCustomPrices, 20.00);
      const mashupPrice = resolveServiceCustomPrice("mashup", agentCustomPrices, 25.00);
      const waecPrice = resolveServiceCustomPrice("waec", agentCustomPrices, 20.00);
      const becePrice = resolveServiceCustomPrice("bece", agentCustomPrices, 18.00);

      // Load Admin's wholesale increment from provider (settings.boost_markup_percent)
      let adminBoostMarkup = 10;
      try {
        const { data: sRow } = await supabase
          .from("settings")
          .select("value")
          .eq("key", "boost_markup_percent")
          .maybeSingle();
        if (sRow?.value && Number.isFinite(Number(sRow.value))) {
          adminBoostMarkup = Math.max(0, Number(sRow.value));
        }
      } catch (_) {}

      const otherServices = [
        {
          id: "service-netflix",
          service: "netflix",
          category: "Streaming",
          name: "Netflix 1-Month Sign-In",
          description: "1-month shared sign-in with instant temporary login code delivery.",
          default_price: 30.00,
          base_price: basePrices["service-netflix"] ?? 25.00,
          selling_price: netflixPrice,
          profit: Math.max(0, Number((netflixPrice - (basePrices["service-netflix"] ?? 25.00)).toFixed(2))),
        },
        {
          id: "service-afa",
          service: "afa",
          category: "Registration",
          name: "AFA Registration",
          description: "Verified registration with fast processing via WhatsApp support.",
          default_price: 20.00,
          base_price: basePrices["service-afa"] ?? 15.00,
          selling_price: afaPrice,
          profit: Math.max(0, Number((afaPrice - (basePrices["service-afa"] ?? 15.00)).toFixed(2))),
        },
        {
          id: "service-mashup",
          service: "mashup",
          category: "MTN Pulse",
          name: "MTN Mashup (Data + Voice)",
          description: "Custom Data + Voice combo packages from 1 Cedi upwards.",
          default_price: 25.00,
          base_price: basePrices["service-mashup"] ?? 22.00,
          selling_price: mashupPrice,
          profit: Math.max(0, Number((mashupPrice - (basePrices["service-mashup"] ?? 22.00)).toFixed(2))),
        },
        {
          id: "checker-waec",
          checker_type: "WAEC",
          category: "Result Checkers",
          name: "WAEC Result Checker",
          description: "Instant WAEC result checking card with Serial and PIN.",
          default_price: 20.00,
          base_price: basePrices["checker-waec"] ?? 16.00,
          selling_price: waecPrice,
          profit: Math.max(0, Number((waecPrice - (basePrices["checker-waec"] ?? 16.00)).toFixed(2))),
        },
        {
          id: "checker-bece",
          checker_type: "BECE",
          category: "Result Checkers",
          name: "BECE Result Checker",
          description: "Instant BECE result checking card with Serial and PIN.",
          default_price: 18.00,
          base_price: basePrices["checker-bece"] ?? 14.00,
          selling_price: becePrice,
          profit: Math.max(0, Number((becePrice - (basePrices["checker-bece"] ?? 14.00)).toFixed(2))),
        },
      ];

      return res.status(200).json({
        ok: true,
        products: productsWithPrices,
        services: otherServices,
        base_prices: basePrices,
        custom_prices: agentCustomPrices,
        admin_boost_markup_percent: adminBoostMarkup,
        min_boost_markup_percent: adminBoostMarkup,
      });
    }

    // -------------------------------------------------------------
    // 6. UPDATE PRODUCTS / PRICING
    // -------------------------------------------------------------
    if (action === "updateProducts") {
      const agentId = String(body?.agent_id || "").trim();
      const customPrices = body?.custom_prices;
      if (!agentId || !customPrices || typeof customPrices !== "object") {
        return res.status(400).json({ ok: false, error: "Agent ID and valid custom_prices map are required." });
      }

      let agents = await loadAgents(supabase, true);
      let index = agents.findIndex((a) => a.id === agentId);
      if (index === -1) {
        const dbAgent = await queryAgentFromDb(supabase, agentId);
        if (dbAgent) {
          agents.unshift(dbAgent);
          index = 0;
        }
      }
      if (index === -1) return res.status(404).json({ ok: false, error: "Agent not found" });

      // Automatically cross-populate aliases for all data bundles and services
      const expandedPrices: Record<string, number> = {
        ...(agents[index].custom_prices || {}),
      };

      for (const [rawKey, rawVal] of Object.entries(customPrices)) {
        const numVal = Number(rawVal);
        if (rawKey === "boost_markup_percent") {
          if (!isNaN(numVal) && numVal >= 0) {
            // Load admin minimum markup from provider (settings.boost_markup_percent)
            let adminMin = 10;
            try {
              const { data: sRow } = await supabase
                .from("settings")
                .select("value")
                .eq("key", "boost_markup_percent")
                .maybeSingle();
              if (sRow?.value && Number.isFinite(Number(sRow.value))) {
                adminMin = Math.max(0, Number(sRow.value));
              }
            } catch (_) {}

            if (numVal < adminMin) {
              return res.status(400).json({
                ok: false,
                error: `Your Social Boost selling profit margin (+${numVal}%) cannot be lower than the platform base increment rate of +${adminMin}%.`,
              });
            }
            expandedPrices["boost_markup_percent"] = Math.round(numVal * 10) / 10;
          }
          continue;
        }
        if (isNaN(numVal) || numVal <= 0) continue;
        const val = Number(numVal.toFixed(2));
        expandedPrices[rawKey] = val;

        // Telecel bundle aliases
        const telMatch = rawKey.match(/^(?:p-)?(?:tel|telecel)-?(\d+)$/i);
        if (telMatch) {
          const cap = telMatch[1];
          expandedPrices[`p-tel-${cap}`] = val;
          expandedPrices[`p-telecel-${cap}`] = val;
          expandedPrices[`tel-${cap}`] = val;
          expandedPrices[`telecel-${cap}`] = val;
          expandedPrices[`tel_${cap}`] = val;
          expandedPrices[`telecel_${cap}`] = val;
        }

        // MTN bundle aliases
        const mtnMatch = rawKey.match(/^(?:p-)?mtn-?(\d+)$/i);
        if (mtnMatch) {
          const cap = mtnMatch[1];
          expandedPrices[`p-mtn-${cap}`] = val;
          expandedPrices[`mtn-${cap}`] = val;
          expandedPrices[`mtn_${cap}`] = val;
        }

        // AT bundle aliases
        const atMatch = rawKey.match(/^(?:p-)?(?:at|airteltigo)-?(\d+)$/i);
        if (atMatch) {
          const cap = atMatch[1];
          expandedPrices[`p-at-${cap}`] = val;
          expandedPrices[`p-airteltigo-${cap}`] = val;
          expandedPrices[`at-${cap}`] = val;
          expandedPrices[`airteltigo-${cap}`] = val;
          expandedPrices[`at_${cap}`] = val;
          expandedPrices[`airteltigo_${cap}`] = val;
        }

        // Services aliases
        if (rawKey === "service-netflix" || rawKey === "netflix") {
          expandedPrices["service-netflix"] = val;
          expandedPrices["netflix"] = val;
        }
        if (rawKey === "service-afa" || rawKey === "afa") {
          expandedPrices["service-afa"] = val;
          expandedPrices["afa"] = val;
        }
        if (rawKey === "service-mashup" || rawKey === "mashup") {
          expandedPrices["service-mashup"] = val;
          expandedPrices["mashup"] = val;
        }
        if (rawKey === "checker-waec" || rawKey === "waec") {
          expandedPrices["checker-waec"] = val;
          expandedPrices["waec"] = val;
          expandedPrices["wassce"] = val;
        }
        if (rawKey === "checker-bece" || rawKey === "bece") {
          expandedPrices["checker-bece"] = val;
          expandedPrices["bece"] = val;
        }
      }

      agents[index].custom_prices = expandedPrices;

      await saveAgents(supabase, agents, agentId);

      // Force-clear memoryAgents cache timestamp so any subsequent call gets immediate fresh data
      memoryAgentsLoadedAt = 0;

      // Dedicated settings upsert to guarantee 100% instant persistence across all instances (both ID and store_slug)
      try {
        const recordsToSave = [
          {
            key: `agent_pricing_${agentId}`,
            value: JSON.stringify(expandedPrices),
          },
        ];
        if (agents[index].store_slug) {
          recordsToSave.push({
            key: `agent_pricing_${String(agents[index].store_slug).toLowerCase().trim()}`,
            value: JSON.stringify(expandedPrices),
          });
        }
        await supabase.from("settings").upsert(recordsToSave, { onConflict: "key" });
      } catch (_) { }

      return res.status(200).json({ ok: true, message: "Your custom pricing has been saved!", custom_prices: expandedPrices });
    }

    // -------------------------------------------------------------
    // 6b. APPLY BOOST PROFIT MARGIN TO ALL AGENTS (ONE PLACE TO SET FOR ALL)
    // -------------------------------------------------------------
    if (action === "setAllAgentsBoostMarkup" || action === "adminSetAllAgentsBoostMarkup") {
      const auth = await verifyAdminUser(req, supabase);
      if (!auth.authorized) {
        return res.status(401).json({ ok: false, error: auth.error || "Unauthorized: Administrator privileges required." });
      }

      const rawPct = Number(body?.boost_markup_percent);
      if (isNaN(rawPct) || rawPct < 0 || rawPct > 500) {
        return res.status(400).json({ ok: false, error: "Please enter a valid percentage between 0% and 500%." });
      }
      const pct = Math.round(rawPct * 10) / 10;

      // 1. Resolve Admin wholesale increment from provider (settings.boost_markup_percent)
      let adminMarkup = 10;
      if (body?.admin_boost_markup_percent !== undefined && !isNaN(Number(body.admin_boost_markup_percent))) {
        adminMarkup = Math.max(0, Math.min(500, Math.round(Number(body.admin_boost_markup_percent) * 10) / 10));
      } else {
        try {
          const { data: sRow } = await supabase.from("settings").select("value").eq("key", "boost_markup_percent").maybeSingle();
          if (sRow?.value && Number.isFinite(Number(sRow.value))) {
            adminMarkup = Math.max(0, Number(sRow.value));
          }
        } catch (_) {}
      }

      // Rule: Agent selling margin cannot be less than Admin wholesale increment from provider
      if (pct < adminMarkup) {
        return res.status(400).json({
          ok: false,
          error: `Agent selling margin (+${pct}%) cannot be less than your increment from provider (+${adminMarkup}%).`,
        });
      }

      // 2. Settings batch rows
      const settingsBatch: Array<{ key: string; value: string }> = [
        { key: "boost_markup_percent", value: String(adminMarkup) },
        { key: "default_agent_boost_markup_percent", value: String(pct) },
        { key: "agent_boost_default_markup_percent", value: String(pct) },
      ];

      // 2. Load all agents fast
      let agents = await loadAgents(supabase, true);
      let updatedCount = 0;

      const sanitizedAgents: any[] = [];
      for (const ag of agents) {
        if (!ag || !ag.id) continue;
        const currentCustom = ag.custom_prices && typeof ag.custom_prices === "object" ? ag.custom_prices : {};
        ag.custom_prices = {
          ...currentCustom,
          boost_markup_percent: pct,
        };
        updatedCount++;

        sanitizedAgents.push({
          id: ag.id,
          name: ag.name || "",
          email: ag.email || "",
          phone: ag.phone || "",
          password_hash: ag.password_hash || "",
          store_name: ag.store_name || "",
          store_slug: ag.store_slug || "",
          description: ag.description || "",
          whatsapp_number: ag.whatsapp_number || "",
          momo_number: ag.momo_number || "",
          momo_network: ag.momo_network || "MTN",
          momo_name: ag.momo_name || "",
          custom_prices: ag.custom_prices,
          status: ag.status || "active",
          created_at: ag.created_at || getGhanaTimestamp(),
        });

        settingsBatch.push({
          key: `agent_pricing_${ag.id}`,
          value: JSON.stringify(ag.custom_prices),
        });
        if (ag.store_slug) {
          settingsBatch.push({
            key: `agent_pricing_${String(ag.store_slug).toLowerCase().trim()}`,
            value: JSON.stringify(ag.custom_prices),
          });
        }
      }

      // 3. Update in-memory cache instantly
      memoryAgents = agents;
      memoryAgentsLoadedAt = Date.now();

      // 4. Update agents_registry in settings batch
      const registryList = agents.map((a: any) => ({
        ...a,
        logo_url: a.logo_url?.startsWith("data:") ? "" : a.logo_url,
      }));
      settingsBatch.push({
        key: "agents_registry",
        value: JSON.stringify(registryList),
      });

      // 5. Fast parallel batch persistence (completes in ~200ms)
      const dbPromises: Promise<any>[] = [];
      if (sanitizedAgents.length > 0) {
        dbPromises.push(
          supabase.from("agents").upsert(sanitizedAgents, { onConflict: "id" }).catch((e: any) => {
            console.warn("Notice: agents table batch upsert warning:", e?.message);
          })
        );
      }
      if (settingsBatch.length > 0) {
        dbPromises.push(
          supabase.from("settings").upsert(settingsBatch, { onConflict: "key" }).catch((e: any) => {
            console.warn("Notice: settings batch upsert warning:", e?.message);
          })
        );
      }
      await Promise.all(dbPromises);

      return res.status(200).json({
        ok: true,
        message: `Successfully updated Social Boost margins! Admin Wholesale Increment: +${adminMarkup}%, Agent Selling Margin: +${pct}% across all ${updatedCount} agents!`,
        admin_boost_markup_percent: adminMarkup,
        boost_markup_percent: pct,
        updated_count: updatedCount,
      });
    }

    // -------------------------------------------------------------
    // 7. GET AGENT ORDERS (WITH TODAY STATS & DATE FILTER)
    // -------------------------------------------------------------
    if (action === "getOrders") {
      const agentId = String(body?.agent_id || req.query?.agent_id || "").trim();
      const dateFilter = String(body?.date || req.query?.date || "").trim(); // YYYY-MM-DD
      if (!agentId) return res.status(400).json({ ok: false, error: "Agent ID required" });

      const basePrices = await loadBasePrices(supabase);
      const allOrders = await loadAgentOrders(supabase, agentId, basePrices);

      // ⚡ ONLY SUCCESSFUL ORDERS: Count and return strictly orders where payment went through!
      const isPaidOrder = (o: any) => {
        const payStatus = String(o.payment_status || o.status || "").toLowerCase();
        return payStatus === "paid" || payStatus === "success" || payStatus === "completed";
      };

      const paidOrders = allOrders.filter(isPaidOrder);
      const ghanaToday = getGhanaToday();

      let todayOrdersCount = 0;
      let todayProfit = 0;

      paidOrders.forEach((o) => {
        const orderDate = (o.created_at || "").slice(0, 10);
        const profit = Number(o.agent_profit) || 0;
        if (orderDate === ghanaToday) {
          todayOrdersCount += 1;
          todayProfit += profit;
        }
      });

      let filteredOrders = paidOrders;
      if (dateFilter) {
        filteredOrders = paidOrders.filter((o) => {
          const d = (o.created_at || "").slice(0, 10);
          return d === dateFilter;
        });
      }

      let filteredProfit = filteredOrders.reduce((sum, o) => sum + (Number(o.agent_profit) || 0), 0);

      return res.status(200).json({
        ok: true,
        orders: filteredOrders,
        all_orders: paidOrders.slice(0, 100),
        today_orders_count: todayOrdersCount,
        today_profit: Number(todayProfit.toFixed(2)),
        total_orders_count: paidOrders.length,
        filtered_orders_count: filteredOrders.length,
        filtered_profit: Number(filteredProfit.toFixed(2)),
        ghana_today: ghanaToday,
      });
    }

    // -------------------------------------------------------------
    // 7B. SEND WITHDRAWAL VERIFICATION CODE (EMAIL & SMS)
    // -------------------------------------------------------------
    if (action === "sendWithdrawalOtp") {
      const agentId = String(body?.agent_id || "").trim();
      if (!agentId) return res.status(400).json({ ok: false, error: "agent_id is required." });

      const agents = await loadAgents(supabase);
      const agent = agents.find((a) => a.id === agentId);
      if (!agent) return res.status(404).json({ ok: false, error: "Agent not found." });

      const code = Math.floor(100000 + Math.random() * 900000).toString();
      await saveOtp(supabase, `withdrawal_${agent.id}`, code, 10 * 60 * 1000); // 10 minutes

      const subject = "Data1gh - MoMo Withdrawal Verification Code";
      const message = `Hello ${agent.name},\n\nYour Data1gh withdrawal verification code is: ${code}\n\nThis code is valid for 10 minutes. If you did not request this withdrawal, please secure your account immediately.\n\nData1gh Reseller Network`;

      const { emailSent, smsSent, deliveredEmail, error } = await sendAgentNotification(supabase, {
        email: agent.email,
        phone: agent.phone,
        subject,
        message,
      });

      if (!emailSent && !smsSent) {
        return res.status(400).json({
          ok: false,
          error: error || "Failed to deliver verification code. Please check that your email is valid.",
        });
      }

      const targetEmail = deliveredEmail || agent.email;
      const maskedEmail = targetEmail.includes("@")
        ? `${targetEmail.slice(0, 3)}***@${targetEmail.split("@")[1]}`
        : targetEmail;
      const maskedPhone = agent.phone.length > 4 ? `***${agent.phone.slice(-4)}` : agent.phone;

      let notifMsg = `Verification code sent to your email (${maskedEmail}) and SMS (${maskedPhone})!`;
      if (emailSent && !smsSent) notifMsg = `Verification code sent to your email (${maskedEmail})!`;
      if (!emailSent && smsSent) notifMsg = `Verification code sent via SMS to your phone (${maskedPhone})!`;

      return res.status(200).json({
        ok: true,
        message: notifMsg,
        email_sent: emailSent,
        sms_sent: smsSent,
      });
    }

    // -------------------------------------------------------------
    // 8. REQUEST WITHDRAWAL (PROTECTED BY VERIFICATION CODE & ALERTS ADMIN ON WHATSAPP)
    // -------------------------------------------------------------
    if (action === "requestWithdrawal") {
      const agentId = String(body?.agent_id || "").trim();
      const amount = Number(body?.amount);
      const momoNumber = String(body?.momo_number || "").trim();
      const momoNetwork = String(body?.momo_network || "MTN").trim();
      const momoName = String(body?.momo_name || "").trim();
      const verificationCode = String(body?.verification_code || body?.code || "").trim();

      if (!agentId || isNaN(amount) || amount <= 0) {
        return res.status(400).json({ ok: false, error: "Valid agent ID and withdrawal amount are required." });
      }

      if (!verificationCode) {
        return res.status(400).json({ ok: false, error: "Please enter the 6-digit verification code sent to your email." });
      }

      const isValidCode = await verifyAndConsumeOtp(supabase, `withdrawal_${agentId}`, verificationCode);
      if (!isValidCode) {
        return res.status(400).json({ ok: false, error: "Invalid or expired verification code. Please request a new code." });
      }

      const MIN_WITHDRAWAL = 5.00;
      if (amount < MIN_WITHDRAWAL) {
        return res.status(400).json({ ok: false, error: `Minimum withdrawal amount is GH₵ ${MIN_WITHDRAWAL.toFixed(2)}.` });
      }

      const financials = await getAgentFinancials(supabase, agentId);
      if (amount > financials.walletBalance) {
        return res.status(400).json({
          ok: false,
          error: `Insufficient balance. Available to withdraw: GH₵ ${financials.walletBalance.toFixed(2)}.`,
        });
      }

      const agents = await loadAgents(supabase);
      const agent = agents.find((a) => a.id === agentId);

      const resolvedMomoName = momoName || agent?.momo_name || agent?.name || "Agent";
      const resolvedMomoNumber = momoNumber || agent?.momo_number || agent?.phone || "";
      const resolvedMomoNetwork = (momoNetwork || agent?.momo_network || "MTN").toUpperCase();
      const resolvedStoreName = agent?.store_name || agent?.business_name || agent?.name || "Agent Store";
      const resolvedAgentPhone = agent?.phone || agent?.whatsapp_number || "";

      // Save updated MoMo details onto the agent's profile if provided
      if (agent && (momoName || momoNumber || momoNetwork)) {
        let profileChanged = false;
        if (momoName && agent.momo_name !== momoName) {
          agent.momo_name = momoName;
          profileChanged = true;
        }
        if (momoNumber && agent.momo_number !== momoNumber) {
          agent.momo_number = momoNumber;
          profileChanged = true;
        }
        if (momoNetwork && agent.momo_network !== momoNetwork) {
          agent.momo_network = momoNetwork;
          profileChanged = true;
        }
        if (profileChanged) {
          try {
            await saveAgents(supabase, agents, agentId);
          } catch (_) { }
        }
      }

      const newWithdrawal = {
        id: `wth-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        agent_id: agentId,
        amount: Number(amount.toFixed(2)),
        momo_number: resolvedMomoNumber,
        momo_network: resolvedMomoNetwork,
        momo_name: resolvedMomoName,
        agent_name: agent?.name || "Agent",
        agent_phone: resolvedAgentPhone,
        agent_email: agent?.email || "",
        store_name: resolvedStoreName,
        store_slug: agent?.store_slug || "",
        status: "pending", // "pending" | "completed" | "rejected"
        created_at: getGhanaTimestamp(),
      };

      try {
        await supabase.from("agent_withdrawals").insert(newWithdrawal);
      } catch (_) { }

      try {
        const { data } = await supabase
          .from("settings")
          .select("value")
          .eq("key", "agent_withdrawals_registry")
          .maybeSingle();
        let list: any[] = [];
        if (data?.value) {
          try { list = JSON.parse(data.value); } catch { }
        }
        list.unshift(newWithdrawal);
        await supabase.from("settings").upsert({
          key: "agent_withdrawals_registry",
          value: JSON.stringify(list),
        }, { onConflict: "key" });
      } catch (_) { }

      const updatedFinancials = await getAgentFinancials(supabase, agentId);

      // Trigger automatic WhatsApp alert to Owner/Admin with Store Name, MoMo Name, Amount & Details
      let alertResult: any = null;
      try {
        alertResult = await sendWithdrawalAlertNotification(
          {
            withdrawalId: newWithdrawal.id,
            amount: newWithdrawal.amount,
            storeName: resolvedStoreName,
            agentName: agent?.name || "Agent",
            agentPhone: resolvedAgentPhone,
            agentEmail: agent?.email || "",
            momoName: resolvedMomoName,
            momoNumber: resolvedMomoNumber,
            momoNetwork: resolvedMomoNetwork,
            walletBalance: updatedFinancials.walletBalance,
          },
          supabase
        );
      } catch (alertErr) {
        console.warn("Failed to dispatch withdrawal alert to admin:", alertErr);
      }

      return res.status(200).json({
        ok: true,
        message: `Withdrawal request for GH₵ ${amount.toFixed(2)} submitted! Admin alerted on WhatsApp and will disburse to ${resolvedMomoName} (${resolvedMomoNumber}) shortly.`,
        withdrawal: newWithdrawal,
        financials: updatedFinancials,
        whatsapp_sent: Boolean(alertResult?.adminWhatsAppSent),
        sms_sent: Boolean(alertResult?.adminSmsSent),
        whatsapp_details: alertResult?.whatsappDetails || null,
        direct_whatsapp_url: alertResult?.directWhatsAppUrl || null,
      });
    }

    // -------------------------------------------------------------
    // TEST WITHDRAWAL ALERT (SMS + WHATSAPP) FOR ADMIN
    // -------------------------------------------------------------
    if (action === "testWithdrawalAlert") {
      const waPhone = String(body?.whatsapp_phone || body?.admin_whatsapp_number || body?.phone || "0547100951").trim();
      const testId = `TEST-WTH-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

      const alertResult = await sendWithdrawalAlertNotification(
        {
          withdrawalId: testId,
          amount: body?.amount || "50.00",
          storeName: body?.store_name || "Alpha Data Hub (Test Store)",
          agentName: body?.agent_name || "Kwame Mensah",
          agentPhone: waPhone || "0547100951",
          agentEmail: "agent@test.com",
          momoName: body?.momo_name || "Kwame Mensah MoMo",
          momoNumber: waPhone || "0547100951",
          momoNetwork: body?.momo_network || "MTN",
          walletBalance: "120.00",
          adminWhatsAppNumber: waPhone,
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
        whatsappDetails: alertResult.whatsappDetails,
        smsDetails: alertResult.smsDetails,
        directWhatsAppUrl: alertResult.directWhatsAppUrl,
        message: alertResult.adminWhatsAppSent
          ? "✅ WhatsApp withdrawal alert delivered to your phone!"
          : alertResult.adminSmsSent
            ? `✅ SMS withdrawal alert delivered! (WhatsApp note: ${alertResult.whatsappDetails})`
            : `❌ Alert failed. WhatsApp: ${alertResult.whatsappDetails}. SMS: ${alertResult.smsDetails}`,
      });
    }

    // -------------------------------------------------------------
    // TEST AGENT REGISTRATION ALERT (WELCOME SMS + ADMIN WHATSAPP)
    // -------------------------------------------------------------
    if (action === "testAgentRegistrationAlert") {
      const waPhone = String(body?.whatsapp_phone || body?.admin_whatsapp_number || body?.phone || "0547100951").trim();
      const testStoreSlug = String(body?.store_slug || "pretty-express-data").trim();
      const testStoreName = String(body?.store_name || "Pretty Express Data").trim();
      const testAgentName = String(body?.agent_name || "Pretty Owner").trim();

      const regResult = await sendAgentRegistrationNotification(
        {
          agentId: `test-${Date.now()}`,
          name: testAgentName,
          email: body?.email || "agent@demo.com",
          phone: waPhone,
          storeName: testStoreName,
          storeSlug: testStoreSlug,
          adminWhatsAppNumber: waPhone,
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
        agentSmsDetails: regResult.agentSmsDetails,
        adminWhatsAppDetails: regResult.adminWhatsAppDetails,
        adminSmsDetails: regResult.adminSmsDetails,
        storeUrl: regResult.storeUrl,
        directWhatsAppUrl: regResult.directWhatsAppUrl,
        message: regResult.adminWhatsAppSent && regResult.agentSmsSent
          ? "✅ Welcome SMS sent to agent and WhatsApp alert delivered to Admin!"
          : regResult.agentSmsSent
            ? `✅ Agent Welcome SMS delivered! (WhatsApp note: ${regResult.adminWhatsAppDetails})`
            : regResult.adminWhatsAppSent
              ? `✅ Admin WhatsApp alert delivered! (Agent SMS note: ${regResult.agentSmsDetails})`
              : `❌ Delivery issue. WhatsApp: ${regResult.adminWhatsAppDetails}. SMS: ${regResult.agentSmsDetails}`,
      });
    }

    // -------------------------------------------------------------
    // 9. GET WITHDRAWALS
    // -------------------------------------------------------------
    if (action === "getWithdrawals") {
      const agentId = String(body?.agent_id || req.query?.agent_id || "").trim();
      if (!agentId) return res.status(400).json({ ok: false, error: "Agent ID required" });

      const withdrawals = await loadWithdrawals(supabase, agentId);
      return res.status(200).json({ ok: true, withdrawals });
    }

    // -------------------------------------------------------------
    // 10. GET PUBLIC STOREFRONT BY SLUG
    // -------------------------------------------------------------
    if (action === "getPublicStore") {
      const slug = String(body?.slug || req.query?.slug || "").toLowerCase().trim();
      if (!slug) return res.status(400).json({ ok: false, error: "Store slug required" });

      // 1. Check in-memory agents cache first (0 database egress)
      let agent: any = null;
      if (memoryAgents && Array.isArray(memoryAgents)) {
        agent = memoryAgents.find((a: any) => a.store_slug?.toLowerCase() === slug || a.id === slug);
      }

      // 2. Query single agent directly by slug or id (minimal egress)
      if (!agent) {
        try {
          const { data, error } = await supabase
            .from("agents")
            .select("id, name, email, phone, store_name, store_slug, description, whatsapp_number, custom_prices, status, logo_url, store_theme, custom_domain, whatsapp_group_url")
            .or(`store_slug.ilike.${slug},id.eq.${slug}`)
            .maybeSingle();
          if (!error && data) {
            agent = data;
          }
        } catch (_) { }
      }

      // 3. Fallback to loadAgents if not found
      if (!agent) {
        const agents = await loadAgents(supabase);
        agent = agents.find((a: any) => a.store_slug?.toLowerCase() === slug || a.id === slug);
      }

      if (!agent) {
        return res.status(404).json({ ok: false, error: `Store "${slug}" not found.` });
      }

      if (agent.status === "suspended") {
        return res.status(403).json({ ok: false, error: "This agent store is currently inactive or suspended by administration." });
      }

      // Always use DEFAULT_PRODUCTS as the complete 36-bundle base catalog
      let catalog = DEFAULT_PRODUCTS;
      const now = Date.now();
      if (memoryProductsCatalog && now - memoryProductsLoadedAt < PRODUCTS_TTL_MS) {
        // Merge memoryProductsCatalog with DEFAULT_PRODUCTS so no bundles are omitted
        const mergedMap = new Map<string, any>();
        DEFAULT_PRODUCTS.forEach((p) => mergedMap.set(`${p.network.toUpperCase()}_${p.capacity}`, p));
        (memoryProductsCatalog || []).forEach((p: any) => {
          const key = `${String(p.network || "").toUpperCase()}_${p.capacity}`;
          if (mergedMap.has(key)) {
            mergedMap.set(key, { ...mergedMap.get(key), ...p, id: mergedMap.get(key).id || p.id });
          } else {
            mergedMap.set(key, p);
          }
        });
        catalog = Array.from(mergedMap.values());
      } else {
        try {
          const { data: dbProds } = await supabase
            .from("products")
            .select("id, network, capacity, mb, price, name, in_stock, sort_order")
            .eq("in_stock", true)
            .order("network")
            .order("sort_order");
          if (dbProds && dbProds.length > 0) {
            const mergedMap = new Map<string, any>();
            DEFAULT_PRODUCTS.forEach((p) => mergedMap.set(`${p.network.toUpperCase()}_${p.capacity}`, p));
            dbProds.forEach((p: any) => {
              const key = `${String(p.network || "").toUpperCase()}_${p.capacity}`;
              if (mergedMap.has(key)) {
                mergedMap.set(key, { ...mergedMap.get(key), ...p, id: mergedMap.get(key).id || p.id });
              } else {
                mergedMap.set(key, p);
              }
            });
            catalog = Array.from(mergedMap.values());
            memoryProductsCatalog = dbProds;
            memoryProductsLoadedAt = now;
          }
        } catch (_) { }
      }

      const basePrices = await loadBasePrices(supabase);
      const dedicatedPricing = await loadAgentPricing(supabase, agent.id, agent.store_slug || slug);
      const customPrices = {
        ...(agent.custom_prices || {}),
        ...dedicatedPricing,
      };

      const storeProducts = catalog.map((p) => {
        const code = `p-${p.network.toLowerCase()}-${p.capacity}`;
        const baseCost = basePrices[p.id] ?? basePrices[code] ?? p.price;
        const sellingPrice = resolveProductCustomPrice(p, customPrices, baseCost);
        return {
          id: p.id,
          network: p.network,
          capacity: p.capacity,
          mb: p.mb,
          name: p.name || `${p.network} ${p.capacity}GB Data`,
          price: sellingPrice,
          base_price: baseCost,
          in_stock: p.in_stock !== false,
          sort_order: p.sort_order ?? 0,
        };
      });

      let publicLogo = agent.logo_url || "";
      let publicTheme = agent.store_theme || "cyber";
      let publicWaGroup = agent.whatsapp_group_url || agent.whatsapp_channel_url || "";
      let publicWaNumber = agent.whatsapp_number || agent.phone || "";
      let announcement = agent.announcement || "";
      let announcementEnabled = agent.announcement_enabled ?? false;
      let announcementType = agent.announcement_type || "promo";
      let popupEnabled = agent.announcement_popup_enabled ?? false;
      let popupTitle = agent.announcement_popup_title || "";
      let popupMessage = agent.announcement_popup_message || "";
      let popupBadge = agent.announcement_popup_badge || "";
      let popupCtaText = agent.announcement_popup_cta_text || "";
      let popupCtaUrl = agent.announcement_popup_cta_url || "";

      try {
        const { data: bData } = await supabase
          .from("settings")
          .select("value")
          .or(`key.eq.agent_branding_${agent.id},key.eq.agent_branding_${String(agent.store_slug || slug).toLowerCase().trim()}`)
          .maybeSingle();
        if (bData?.value) {
          const parsed = JSON.parse(bData.value);
          if (parsed.logo_url && !publicLogo) publicLogo = parsed.logo_url;
          if (parsed.store_theme && !publicTheme) publicTheme = parsed.store_theme;
          if (parsed.whatsapp_group_url && !publicWaGroup) publicWaGroup = parsed.whatsapp_group_url;
          if (parsed.whatsapp_number && !publicWaNumber) publicWaNumber = parsed.whatsapp_number;
          if (parsed.announcement !== undefined && (!announcement || announcement === "")) announcement = parsed.announcement;
          if (parsed.announcement_enabled !== undefined) announcementEnabled = parsed.announcement_enabled;
          if (parsed.announcement_type) announcementType = parsed.announcement_type;
          if (parsed.announcement_popup_enabled !== undefined) popupEnabled = parsed.announcement_popup_enabled;
          if (parsed.announcement_popup_title) popupTitle = parsed.announcement_popup_title;
          if (parsed.announcement_popup_message) popupMessage = parsed.announcement_popup_message;
          if (parsed.announcement_popup_badge) popupBadge = parsed.announcement_popup_badge;
          if (parsed.announcement_popup_cta_text) popupCtaText = parsed.announcement_popup_cta_text;
          if (parsed.announcement_popup_cta_url) popupCtaUrl = parsed.announcement_popup_cta_url;
        }
      } catch (_) { }

      const netflixPrice = resolveServiceCustomPrice("netflix", customPrices, 30.00);
      const afaPrice = resolveServiceCustomPrice("afa", customPrices, 20.00);
      const mashupPrice = resolveServiceCustomPrice("mashup", customPrices, 25.00);
      const waecPrice = resolveServiceCustomPrice("waec", customPrices, 20.00);
      const becePrice = resolveServiceCustomPrice("bece", customPrices, 18.00);

      const flatServicesMap: Record<string, number> = {
        "service-netflix": netflixPrice,
        netflix: netflixPrice,
        "service-afa": afaPrice,
        afa: afaPrice,
        "service-mashup": mashupPrice,
        mashup: mashupPrice,
        "checker-waec": waecPrice,
        waec: waecPrice,
        "checker-bece": becePrice,
        bece: becePrice,
      };

      const otherServices = {
        netflix: {
          id: "service-netflix",
          service: "netflix",
          title: "Netflix 1-Month Sign-In",
          category: "Streaming",
          price: netflixPrice,
          base_price: basePrices["service-netflix"] ?? 25.00,
          description: "1-month shared sign-in with instant code delivery.",
        },
        afa: {
          id: "service-afa",
          service: "afa",
          title: "AFA Registration",
          category: "Registration",
          price: afaPrice,
          base_price: basePrices["service-afa"] ?? 15.00,
          description: "Verified registration with fast processing via WhatsApp support.",
        },
        mashup: {
          id: "service-mashup",
          service: "mashup",
          title: "MTN Mashup",
          category: "MTN Pulse",
          price: mashupPrice,
          base_price: basePrices["service-mashup"] ?? 22.00,
          description: "Custom Data + Voice combo packages from 1 Cedi upwards.",
        },
        waec: {
          id: "checker-waec",
          type: "WAEC",
          title: "WAEC Result Checker",
          category: "Result Checkers",
          price: waecPrice,
          base_price: basePrices["checker-waec"] ?? 16.00,
          description: "Instant WAEC result card with Serial and PIN.",
        },
        bece: {
          id: "checker-bece",
          type: "BECE",
          title: "BECE Result Checker",
          category: "Result Checkers",
          price: becePrice,
          base_price: basePrices["checker-bece"] ?? 14.00,
          description: "Instant BECE result card with Serial and PIN.",
        },
      };

      // Load Live Flash Sale configuration from settings
      let flashSale = {
        enabled: false,
        end_time: "",
        title: "⚡ LIMITED TIME MTN FLASH SALE ⚡",
        notice: "Exclusive discounted MTN bundles! Grab yours before time runs out.",
        products: [] as any[],
      };
      try {
        const { data: fsSettings } = await supabase
          .from("settings")
          .select("key, value")
          .in("key", [
            "flash_sale_enabled",
            "flash_sale_end_time",
            "flash_sale_title",
            "flash_sale_notice",
            "flash_sale_products",
          ]);
        if (fsSettings && Array.isArray(fsSettings)) {
          const fsMap: Record<string, string> = {};
          fsSettings.forEach((r: any) => { fsMap[r.key] = r.value; });
          flashSale.enabled = fsMap.flash_sale_enabled === "true";
          flashSale.end_time = fsMap.flash_sale_end_time || "";
          if (fsMap.flash_sale_title) flashSale.title = fsMap.flash_sale_title;
          if (fsMap.flash_sale_notice) flashSale.notice = fsMap.flash_sale_notice;
          if (fsMap.flash_sale_products) {
            try {
              const prods = JSON.parse(fsMap.flash_sale_products);
              if (Array.isArray(prods)) flashSale.products = prods;
            } catch (_) { }
          }
        }
      } catch (_) { }

      res.setHeader("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=600");
      return res.status(200).json({
        ok: true,
        store: {
          id: agent.id,
          store_name: agent.store_name,
          store_slug: agent.store_slug,
          description: agent.description,
          phone: agent.phone || publicWaNumber,
          whatsapp_number: publicWaNumber,
          whatsapp_group_url: publicWaGroup,
          logo_url: publicLogo,
          store_theme: publicTheme,
          custom_prices: customPrices,
          other_services: flatServicesMap,
          announcement: announcement,
          announcement_enabled: Boolean(announcementEnabled),
          announcement_type: announcementType,
          announcement_popup_enabled: Boolean(popupEnabled),
          announcement_popup_title: popupTitle,
          announcement_popup_message: popupMessage,
          announcement_popup_badge: popupBadge,
          announcement_popup_cta_text: popupCtaText,
          announcement_popup_cta_url: popupCtaUrl,
        },
        products: storeProducts,
        other_services: flatServicesMap,
        services_detail: otherServices,
        flash_sale: flashSale,
      });
    }

    // -------------------------------------------------------------
    // 10B. DYNAMIC STOREFRONT PREVIEW FOR CRAWLERS & WHATSAPP
    // -------------------------------------------------------------
    if (action === "storePreview") {
      const rawSlug = String(req.query?.slug || body?.slug || "").toLowerCase().trim();
      const slug = rawSlug.replace(/^\/s\//, "").replace(/\/+$/, "").trim();

      let matched: any = null;
      if (memoryAgents && Array.isArray(memoryAgents)) {
        matched = memoryAgents.find((a: any) => a.store_slug?.toLowerCase() === slug || a.id === slug);
      }
      if (!matched) {
        try {
          const { data } = await supabase
            .from("agents")
            .select("id, store_name, store_slug, description")
            .or(`store_slug.ilike.${slug},id.eq.${slug}`)
            .maybeSingle();
          if (data) matched = data;
        } catch (_) { }
      }
      if (!matched) {
        const agents = await loadAgents(supabase);
        matched = agents.find((a: any) => a.store_slug?.toLowerCase() === slug || a.id === slug);
      }

      const proto = req.headers["x-forwarded-proto"] || "https";
      const host = req.headers["x-forwarded-host"] || req.headers.host || "gooddata1.vercel.app";
      const baseUrl = `${proto}://${host}`;

      const storeName = matched?.store_name || "Data Store";
      const storeDesc =
        matched?.description ||
        "Buy cheap MTN, Telecel and AT data bundles online with instant 24/7 automated delivery.";
      const storeUrl = `${baseUrl}/s/${matched?.store_slug || slug}`;
      const storeTitle = `${storeName} · Buy MTN, Telecel & AT Data Bundles`;
      // Dedicated absolute image URL for WhatsApp / Facebook / Twitter link preview
      const storeLogo = `${baseUrl}/api/agent?action=storeLogo&slug=${matched?.store_slug || slug}`;

      function escapeHtml(str: string): string {
        return String(str || "")
          .replace(/&/g, "&amp;")
          .replace(/"/g, "&quot;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");
      }

      let baseHtml = "";
      try {
        const fs = await import("fs");
        const path = await import("path");
        const possiblePaths = [
          path.join(process.cwd(), "dist", "index.html"),
          path.join(process.cwd(), "index.html"),
        ];
        for (const p of possiblePaths) {
          if (fs.existsSync(p)) {
            baseHtml = fs.readFileSync(p, "utf-8");
            break;
          }
        }
      } catch (_) { }

      if (!baseHtml) {
        try {
          const resLive = await fetch(`${baseUrl}/index.html`);
          if (resLive.ok) baseHtml = await resLive.text();
        } catch (_) { }
      }

      if (baseHtml) {
        let finalHtml = baseHtml
          .replace(/<title>.*?<\/title>/i, `<title>${escapeHtml(storeTitle)}</title>`)
          .replace(/<meta\s+property=["']og:title["'].*?>/i, `<meta property="og:title" content="${escapeHtml(storeTitle)}" />`)
          .replace(/<meta\s+name=["']twitter:title["'].*?>/i, `<meta name="twitter:title" content="${escapeHtml(storeTitle)}" />`)
          .replace(/<meta\s+property=["']og:description["'].*?>/i, `<meta property="og:description" content="${escapeHtml(storeDesc)}" />`)
          .replace(/<meta\s+name=["']twitter:description["'].*?>/i, `<meta name="twitter:description" content="${escapeHtml(storeDesc)}" />`)
          .replace(/<meta\s+property=["']og:image["'].*?>/i, `<meta property="og:image" content="${escapeHtml(storeLogo)}" /><meta property="og:image:secure_url" content="${escapeHtml(storeLogo)}" /><meta property="og:image:type" content="image/png" /><meta property="og:image:width" content="1200" /><meta property="og:image:height" content="630" />`)
          .replace(/<meta\s+name=["']twitter:image["'].*?>/i, `<meta name="twitter:image" content="${escapeHtml(storeLogo)}" />`)
          .replace(/<meta\s+property=["']og:url["'].*?>/i, `<meta property="og:url" content="${escapeHtml(storeUrl)}" />`)
          .replace(/<link\s+rel=["']canonical["'].*?>/i, `<link rel="canonical" href="${escapeHtml(storeUrl)}" />`)
          .replace(/<link\s+rel=["'](?:apple-touch-icon|shortcut icon|icon)["'][^>]*>/gi, "")
          .replace(/<meta\s+name=["']apple-mobile-web-app-title["'].*?>/i, `<meta name="apple-mobile-web-app-title" content="${escapeHtml(storeName)}" />`);

        // Eliminate any stray data1 / logo.png references on agent store previews
        finalHtml = finalHtml.replace(/https?:\/\/[^/]+\/logo\.png/gi, storeLogo);

        // Inject agent custom favicon and apple-touch-icon
        finalHtml = finalHtml.replace(
          /<\/head>/i,
          `  <link rel="icon" href="${escapeHtml(storeLogo)}" />\n    <link rel="apple-touch-icon" href="${escapeHtml(storeLogo)}" />\n  </head>`
        );

        res.setHeader("Content-Type", "text/html; charset=utf-8");
        return res.status(200).send(finalHtml);
      }

      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.status(200).send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(storeTitle)}</title>
    <meta name="description" content="${escapeHtml(storeDesc)}" />
    <meta property="og:title" content="${escapeHtml(storeTitle)}" />
    <meta property="og:description" content="${escapeHtml(storeDesc)}" />
    <meta property="og:image" content="${escapeHtml(storeLogo)}" />
    <meta property="og:image:secure_url" content="${escapeHtml(storeLogo)}" />
    <meta property="og:image:type" content="image/png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:url" content="${escapeHtml(storeUrl)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(storeTitle)}" />
    <meta name="twitter:description" content="${escapeHtml(storeDesc)}" />
    <meta name="twitter:image" content="${escapeHtml(storeLogo)}" />
    <link rel="icon" href="${escapeHtml(storeLogo)}" />
    <link rel="apple-touch-icon" href="${escapeHtml(storeLogo)}" />
  </head>
  <body>
    <script>window.location.replace("${storeUrl}");</script>
  </body>
</html>`);
    }

    // -------------------------------------------------------------
    // 10C. DYNAMIC STORE LOGO & PREVIEW IMAGE ENDPOINT FOR CRAWLERS
    // -------------------------------------------------------------
    if (action === "storeLogo" || action === "storeImage") {
      const rawSlug = String(req.query?.slug || body?.slug || "").toLowerCase().trim();
      const slug = rawSlug.replace(/^\/s\//, "").replace(/\/+$/, "").trim();

      let matched: any = null;
      if (memoryAgents && Array.isArray(memoryAgents)) {
        matched = memoryAgents.find((a: any) => a.store_slug?.toLowerCase() === slug || a.id === slug);
      }
      if (!matched) {
        try {
          const { data } = await supabase
            .from("agents")
            .select("id, logo_url")
            .or(`store_slug.ilike.${slug},id.eq.${slug}`)
            .maybeSingle();
          if (data) matched = data;
        } catch (_) { }
      }
      if (!matched) {
        const agents = await loadAgents(supabase);
        matched = agents.find((a: any) => a.store_slug?.toLowerCase() === slug || a.id === slug);
      }

      const logo = matched?.logo_url;
      if (logo && typeof logo === "string") {
        // A. If base64 data URI (uploaded by agent in settings)
        const dataMatch = logo.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
        if (dataMatch) {
          const ext = dataMatch[1].toLowerCase();
          const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : ext === "webp" ? "image/webp" : "image/png";
          const buffer = Buffer.from(dataMatch[2], "base64");
          res.setHeader("Content-Type", mime);
          res.setHeader("Content-Length", buffer.length);
          res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=86400, stale-while-revalidate=86400");
          return res.status(200).send(buffer);
        }

        // B. If external HTTP/HTTPS URL that is NOT data1 logo
        if ((logo.startsWith("http://") || logo.startsWith("https://")) && !logo.includes("logo.png")) {
          return res.redirect(302, logo);
        }
      }

      // C. Fallback: Serve the clean, high-tech neutral store banner (ZERO Data1 branding)
      try {
        const fs = await import("fs");
        const path = await import("path");
        const bannerPath = path.join(process.cwd(), "public", "store-banner.jpg");
        if (fs.existsSync(bannerPath)) {
          const buf = fs.readFileSync(bannerPath);
          res.setHeader("Content-Type", "image/jpeg");
          res.setHeader("Content-Length", buf.length);
          res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=86400");
          return res.status(200).send(buf);
        }
      } catch (_) { }

      const proto = req.headers["x-forwarded-proto"] || "https";
      const host = req.headers["x-forwarded-host"] || req.headers.host || "gooddata1.vercel.app";
      return res.redirect(302, `${proto}://${host}/store-banner.jpg`);
    }

    // -------------------------------------------------------------

    // 10.3 AGENT CUSTOMER REFERRALS
    if (action === "getAgentReferralProgress" || action === "registerAgentReferral") {
      const slugOrId = String(body?.agent_id || body?.agent_slug || req.query?.slug || req.query?.agent_id || "").toLowerCase().trim();
      const phoneInput = String(body?.customer_phone || req.query?.customer_phone || "").trim();
      const cleanPhone = cleanGhanaPhone(phoneInput);

      if (!slugOrId) return res.status(400).json({ ok: false, error: "Agent ID or Store slug required" });
      if (!cleanPhone || cleanPhone.length < 9) return res.status(400).json({ ok: false, error: "Valid 10-digit phone number required" });

      const agents = await loadAgents(supabase);
      const agent = agents.find((a: any) => a.id === slugOrId || a.store_slug?.toLowerCase() === slugOrId);
      if (!agent) return res.status(404).json({ ok: false, error: "Agent store not found" });

      const settingKey = `agent_referrals_${agent.id}`;
      const { data } = await supabase.from("settings").select("value").eq("key", settingKey).maybeSingle();
      let referralsList: any[] = [];
      if (data?.value) {
        try { referralsList = typeof data.value === "string" ? JSON.parse(data.value) : data.value; } catch (_) { }
      }

      let referral = referralsList.find((r: any) => cleanGhanaPhone(r.customer_phone) === cleanPhone);

      // Upgrade numeric codes to generated code format WIN5-XXXX
      if (referral && (!referral.referral_code || referral.referral_code === cleanPhone || /^\d+$/.test(referral.referral_code))) {
        referral.referral_code = generateReferralCode();
        referral.updated_at = getGhanaTimestamp();
        await supabase.from("settings").upsert({
          key: settingKey,
          value: JSON.stringify(referralsList),
        }, { onConflict: "key" });
      }

      if (!referral && action === "registerAgentReferral") {
        referral = {
          id: `agref_${cleanPhone}_${Date.now()}`,
          agent_id: agent.id,
          agent_name: agent.store_name,
          agent_slug: agent.store_slug,
          customer_phone: cleanPhone,
          referral_code: generateReferralCode(),
          referred_buyers: [],
          total_qualified_orders: 0,
          reward_claimed: false,
          reward_status: "in_progress",
          notified_admin: false,
          created_at: getGhanaTimestamp(),
          updated_at: getGhanaTimestamp(),
        };
        referralsList.unshift(referral);
        await supabase.from("settings").upsert({
          key: settingKey,
          value: JSON.stringify(referralsList),
        }, { onConflict: "key" });
      }

      return res.status(200).json({
        ok: true,
        referral: referral ? {
          customer_phone: referral.customer_phone,
          referral_code: referral.referral_code,
          total_qualified_orders: referral.total_qualified_orders || 0,
          target: 5,
          is_completed: (referral.total_qualified_orders || 0) >= 5,
          reward_status: referral.reward_status || "in_progress",
          referred_buyers_count: (referral.referred_buyers || []).length,
          agent_slug: agent.store_slug,
          agent_store_name: agent.store_name,
        } : null,
      });
    }

    if (action === "getAgentCustomerReferrals") {
      const agentId = String(body?.agent_id || req.query?.agent_id || "").trim();
      const agentSlug = String(body?.agent_slug || req.query?.agent_slug || "").trim();

      let resolvedAgentId = agentId;
      if (!resolvedAgentId && agentSlug) {
        const { data: ag } = await supabase.from("agents").select("id").eq("store_slug", agentSlug).maybeSingle();
        if (ag?.id) resolvedAgentId = ag.id;
      }

      if (!resolvedAgentId) {
        return res.status(400).json({ ok: false, error: "Agent ID or slug required." });
      }

      const keysToTry = [`agent_referrals_${resolvedAgentId}`];
      if (agentSlug && agentSlug !== resolvedAgentId) {
        keysToTry.push(`agent_referrals_${agentSlug}`);
      }

      let referralsList: any[] = [];
      for (const settingKey of keysToTry) {
        const { data } = await supabase.from("settings").select("value").eq("key", settingKey).maybeSingle();
        if (data?.value) {
          try {
            const parsed = typeof data.value === "string" ? JSON.parse(data.value) : data.value;
            if (Array.isArray(parsed) && parsed.length > 0) {
              referralsList = parsed;
              break;
            }
          } catch (_) { }
        }
      }

      const totalPromoters = referralsList.length;
      const totalReferredOrders = referralsList.reduce((sum, r) => sum + (r.total_qualified_orders || 0), 0);
      const totalCompletedRewards = referralsList.filter((r) => (r.total_qualified_orders || 0) >= 5).length;

      return res.status(200).json({
        ok: true,
        referrals: referralsList,
        stats: {
          total_promoters: totalPromoters,
          total_referred_orders: totalReferredOrders,
          total_completed_rewards: totalCompletedRewards,
        },
      });
    }

    if (action === "adminGetAgentCustomerReferrals") {
      try {
        const { data: rows, error } = await supabase
          .from("settings")
          .select("key, value")
          .like("key", "agent_referrals_%");

        if (error) throw error;

        let allPromoters: any[] = [];
        (rows || []).forEach((row: any) => {
          if (!row.value) return;
          try {
            const parsed = typeof row.value === "string" ? JSON.parse(row.value) : row.value;
            if (Array.isArray(parsed)) {
              allPromoters.push(...parsed);
            }
          } catch (_) { }
        });

        // Sort: completed (>= 5) first, then pending, then latest
        allPromoters.sort((a, b) => {
          const aComp = (a.total_qualified_orders || 0) >= 5 ? 1 : 0;
          const bComp = (b.total_qualified_orders || 0) >= 5 ? 1 : 0;
          if (aComp !== bComp) return bComp - aComp;
          return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
        });

        const completed = allPromoters.filter((p) => (p.total_qualified_orders || 0) >= 5);
        const pendingManual = completed.filter((p) => !p.reward_sent && p.reward_status !== "fulfilled");
        const fulfilled = completed.filter((p) => p.reward_sent || p.reward_status === "fulfilled");

        return res.status(200).json({
          ok: true,
          promoters: allPromoters,
          completed,
          stats: {
            total_promoters: allPromoters.length,
            total_completed: completed.length,
            pending_manual: pendingManual.length,
            fulfilled: fulfilled.length,
            total_referred_orders: allPromoters.reduce((s, p) => s + (p.total_qualified_orders || 0), 0),
          },
        });
      } catch (err: any) {
        return res.status(500).json({ ok: false, error: err?.message || "Failed to load agent referrals" });
      }
    }

    if (action === "adminFulfillAgentReferral") {
      const agentId = String(body?.agent_id || "").trim();
      const customerPhone = cleanGhanaPhone(String(body?.customer_phone || ""));
      const isFulfilled = body?.fulfilled !== false;

      if (!agentId || !customerPhone) {
        return res.status(400).json({ ok: false, error: "agent_id and customer_phone are required" });
      }

      try {
        const settingKey = `agent_referrals_${agentId}`;
        const { data: row } = await supabase.from("settings").select("value").eq("key", settingKey).maybeSingle();
        if (!row?.value) {
          return res.status(404).json({ ok: false, error: "Referrals record not found" });
        }

        let list: any[] = typeof row.value === "string" ? JSON.parse(row.value) : row.value;
        const targetIdx = list.findIndex((p: any) => cleanGhanaPhone(p.customer_phone) === customerPhone);
        if (targetIdx === -1) {
          return res.status(404).json({ ok: false, error: "Promoter not found" });
        }

        list[targetIdx].reward_sent = isFulfilled;
        list[targetIdx].reward_status = isFulfilled ? "fulfilled" : "pending_fulfillment";
        list[targetIdx].reward_sent_at = isFulfilled ? getGhanaTimestamp() : null;
        list[targetIdx].updated_at = getGhanaTimestamp();

        await supabase.from("settings").upsert({
          key: settingKey,
          value: JSON.stringify(list),
        }, { onConflict: "key" });

        return res.status(200).json({
          ok: true,
          promoter: list[targetIdx],
        });
      } catch (err: any) {
        return res.status(500).json({ ok: false, error: err?.message || "Failed to update reward status" });
      }
    }

    // 10.4 AGENT NOTIFICATION CENTER (WHATSAPP ORDER ALERTS)
    // -------------------------------------------------------------
    if (action === "getAgentNotificationSettings") {
      const agentId = String(body?.agent_id || req.query?.agent_id || "").trim();
      if (!agentId) return res.status(400).json({ ok: false, error: "Agent ID required" });

      const agents = await loadAgents(supabase);
      const agent = agents.find((a: any) => a.id === agentId || a.store_slug === agentId);
      if (!agent) return res.status(404).json({ ok: false, error: "Agent not found" });

      let notifSettings = {
        whatsapp_number: agent.whatsapp_number || agent.phone || "",
        enabled: true,
      };

      try {
        const { data: nSet } = await supabase
          .from("settings")
          .select("value")
          .eq("key", `agent_notifications_${agent.id}`)
          .maybeSingle();
        if (nSet?.value) {
          const parsed = typeof nSet.value === "string" ? JSON.parse(nSet.value) : nSet.value;
          notifSettings = { ...notifSettings, ...parsed };
        }
      } catch (_) { }

      let logs: any[] = [];
      try {
        const { data: nLogs } = await supabase
          .from("settings")
          .select("value")
          .eq("key", `agent_notif_log_${agent.id}`)
          .maybeSingle();
        if (nLogs?.value) {
          logs = typeof nLogs.value === "string" ? JSON.parse(nLogs.value) : nLogs.value;
        }
      } catch (_) { }

      return res.status(200).json({
        ok: true,
        settings: notifSettings,
        logs: Array.isArray(logs) ? logs.slice(0, 30) : [],
      });
    }

    if (action === "updateAgentNotificationSettings") {
      const agentId = String(body?.agent_id || "").trim();
      const whatsappNumber = cleanGhanaPhone(String(body?.whatsapp_number || ""));
      const enabled = body?.enabled !== false;

      if (!agentId) return res.status(400).json({ ok: false, error: "Agent ID required" });

      const agents = await loadAgents(supabase);
      const index = agents.findIndex((a: any) => a.id === agentId || a.store_slug === agentId);
      if (index === -1) return res.status(404).json({ ok: false, error: "Agent not found" });

      if (whatsappNumber) {
        agents[index].whatsapp_number = whatsappNumber;
        await saveAgents(supabase, agents, agents[index].id);
      }

      const notifData = {
        whatsapp_number: whatsappNumber || agents[index].whatsapp_number || agents[index].phone,
        enabled,
        updated_at: getGhanaTimestamp(),
      };

      await supabase.from("settings").upsert({
        key: `agent_notifications_${agents[index].id}`,
        value: JSON.stringify(notifData),
      }, { onConflict: "key" });

      return res.status(200).json({
        ok: true,
        settings: notifData,
      });
    }

    if (action === "testAgentNotification") {
      const agentId = String(body?.agent_id || "").trim();
      const targetPhone = cleanGhanaPhone(String(body?.whatsapp_number || ""));

      if (!agentId) return res.status(400).json({ ok: false, error: "Agent ID required" });

      const agents = await loadAgents(supabase);
      const agent = agents.find((a: any) => a.id === agentId || a.store_slug === agentId);
      if (!agent) return res.status(404).json({ ok: false, error: "Agent not found" });

      const finalPhone = targetPhone || agent.whatsapp_number || agent.phone;
      if (!finalPhone) {
        return res.status(400).json({ ok: false, error: "Please enter a valid WhatsApp phone number" });
      }

      try {
        const { sendAgentOrderWhatsAppAlert } = await import("./_notifications.js");
        const result = await sendAgentOrderWhatsAppAlert({
          agentId: agent.id,
          orderReference: "TEST-NOTIF",
          itemDescription: "5GB MTN Data (Sample)",
          recipientPhone: finalPhone,
          sellingPrice: 24.50,
          agentProfit: 4.50,
          deliveryStatus: "processing",
          agentStoreName: agent.store_name,
          agentWhatsAppNumber: finalPhone,
          isTest: true,
        }, supabase);

        if (result.ok && result.whatsappSent) {
          return res.status(200).json({
            ok: true,
            message: `Test WhatsApp notification sent to ${result.targetPhone || finalPhone}! Check your WhatsApp now.`,
          });
        } else {
          return res.status(400).json({
            ok: false,
            error: result.details || "Could not dispatch WhatsApp message. Please verify your number format.",
          });
        }
      } catch (err: any) {
        return res.status(500).json({ ok: false, error: err?.message || "Failed to send test notification" });
      }
    }

    // 11. ADMIN ACTIONS FOR AGENTS
    // -------------------------------------------------------------
    if (action === "adminGetAgents") {
      const force = Boolean(body?.force || body?.refresh || req.query?.refresh);
      const [agents, basePrices, allOrders, allWithdrawals] = await Promise.all([
        loadAgents(supabase, force),
        loadBasePrices(supabase, force),
        loadAgentOrders(supabase),
        loadWithdrawals(supabase),
      ]);
      const ghanaToday = getGhanaToday();
      const enriched = agents.map((a) => {
        const agentOrders = allOrders.filter((o: any) => o.agent_id === a.id || o.agent_id === a.store_slug);
        const agentWithdrawals = allWithdrawals.filter((w: any) => w.agent_id === a.id);
        let todayOrdersCount = 0;
        let todayProfit = 0;
        let totalProfit = 0;
        for (const o of agentOrders) {
          const sellingPrice = Number(o.amount) || Number(o.selling_price) || 0;
          const profit = o.agent_profit !== undefined && o.agent_profit !== null && !isNaN(Number(o.agent_profit))
            ? Number(Number(o.agent_profit).toFixed(2))
            : Math.max(0, Number((sellingPrice - resolveOrderBasePrice(o, basePrices)).toFixed(2)));
          const statusLower = String(o.status || o.delivery_status || "").toLowerCase();
          const payStatusLower = String(o.payment_status || "").toLowerCase();
          const isPaid =
            payStatusLower === "paid" ||
            payStatusLower === "success" ||
            payStatusLower === "completed" ||
            ((statusLower === "paid" || statusLower === "delivered" || statusLower === "completed") &&
              payStatusLower !== "pending" &&
              payStatusLower !== "failed" &&
              payStatusLower !== "unpaid" &&
              payStatusLower !== "cancelled");
          if (isPaid && statusLower !== "failed" && statusLower !== "cancelled") {
            totalProfit += profit;
            if (String(o.created_at || "").startsWith(ghanaToday)) {
              todayOrdersCount++;
              todayProfit += profit;
            }
          }
        }
        const paidAgentOrders = agentOrders.filter((o: any) => {
          const payStatus = String(o.payment_status || o.status || "").toLowerCase();
          return payStatus === "paid" || payStatus === "success" || payStatus === "completed";
        });
        const totalWithdrawn = agentWithdrawals
          .filter((w: any) => w.status === "approved" || w.status === "paid" || w.status === "pending")
          .reduce((sum: number, w: any) => sum + (Number(w.amount) || 0), 0);
        const walletBalance = Math.max(0, Number((totalProfit - totalWithdrawn).toFixed(2)));
        return sanitizeAgentRecord({
          ...a,
          wallet_balance: walletBalance,
          total_profit: Number(totalProfit.toFixed(2)),
          today_profit: Number(todayProfit.toFixed(2)),
          today_orders: todayOrdersCount,
          total_orders: paidAgentOrders.length,
          recent_orders: paidAgentOrders.slice(0, 20),
          withdrawals: agentWithdrawals.slice(0, 20),
        }, true);
      });
      return res.status(200).json({ ok: true, agents: enriched });
    }

    if (action === "adminToggleSuspendAgent") {
      const agentId = String(body?.agent_id || "").trim();
      const targetStatus = String(body?.status || "").trim();
      if (!agentId) return res.status(400).json({ ok: false, error: "agent_id required" });

      const agents = await loadAgents(supabase);
      const index = agents.findIndex((a) => a.id === agentId);
      if (index === -1) return res.status(404).json({ ok: false, error: "Agent not found" });

      const nextStatus = targetStatus || (agents[index].status === "suspended" ? "active" : "suspended");
      agents[index].status = nextStatus;
      await saveAgents(supabase, agents, agentId);

      return res.status(200).json({
        ok: true,
        message: `Agent account ${nextStatus === "suspended" ? "suspended" : "reactivated"} successfully!`,
        agent: sanitizeAgentRecord(agents[index]),
      });
    }

    if (action === "adminDeleteAgent") {
      const agentId = String(body?.agent_id || "").trim();
      if (!agentId) return res.status(400).json({ ok: false, error: "agent_id required" });

      const agents = await loadAgents(supabase);
      const filtered = agents.filter((a) => a.id !== agentId);

      // 1. Update in-memory cache immediately
      memoryAgents = filtered;
      memoryAgentsLoadedAt = Date.now();

      // 2. Delete row from agents table directly
      try {
        await supabase.from("agents").delete().eq("id", agentId);
      } catch (err: any) {
        console.warn("agents table delete issue:", err?.message);
      }

      // 3. Fast direct update of agents_registry without re-upserting other agents' branding
      try {
        const { data: regRow } = await supabase
          .from("settings")
          .select("value")
          .eq("key", "agents_registry")
          .maybeSingle();

        let registryList: any[] = [];
        if (regRow?.value) {
          try {
            const parsed = typeof regRow.value === "string" ? JSON.parse(regRow.value) : regRow.value;
            if (Array.isArray(parsed)) registryList = parsed;
          } catch (_) { }
        }
        if (registryList.length === 0) {
          registryList = agents;
        }
        const updatedRegistry = registryList.filter((a: any) => a.id !== agentId);
        await supabase.from("settings").upsert({
          key: "agents_registry",
          value: JSON.stringify(updatedRegistry),
        }, { onConflict: "key" });
      } catch (err: any) {
        console.warn("agents_registry delete update warning:", err?.message);
      }

      // 4. Clean up any leftover branding or pricing keys for this agent
      try {
        await supabase
          .from("settings")
          .delete()
          .in("key", [`agent_branding_${agentId}`, `agent_pricing_${agentId}`]);
      } catch (_) { }

      return res.status(200).json({ ok: true, message: "Agent account deleted successfully!" });
    }

    if (action === "adminCreditAgent") {
      const agentId = String(body?.agent_id || "").trim();
      const amount = Number(body?.amount);
      const note = String(body?.note || "Admin Wallet Credit").trim();
      if (!agentId || isNaN(amount) || amount === 0) {
        return res.status(400).json({ ok: false, error: "Valid agent_id and non-zero numeric amount are required." });
      }

      const agents = await loadAgents(supabase);
      const target = agents.find((a) => a.id === agentId);
      if (!target) return res.status(404).json({ ok: false, error: "Agent not found" });

      await recordAgentOrder(supabase, {
        agent_id: agentId,
        reference: `ADJ-${Date.now()}`,
        network: "WALLET",
        package_size: note,
        phone: target.phone,
        amount: Math.abs(amount),
        base_price: 0,
        selling_price: Math.abs(amount),
        agent_profit: amount,
      });

      return res.status(200).json({
        ok: true,
        message: `Agent wallet successfully ${amount > 0 ? "credited with" : "debited by"} GH₵ ${Math.abs(amount).toFixed(2)}!`,
      });
    }

    // -------------------------------------------------------------
    // ADMIN: EDIT AGENT LOGIN CREDENTIALS & PROFILE
    // -------------------------------------------------------------
    if (action === "adminUpdateAgentCredentials") {
      const agentId = String(body?.agent_id || "").trim();
      if (!agentId) return res.status(400).json({ ok: false, error: "agent_id is required." });

      const agents = await loadAgents(supabase, true);
      const index = agents.findIndex((a) => a.id === agentId);
      if (index === -1) return res.status(404).json({ ok: false, error: "Agent not found." });

      const target = agents[index];

      const newName = body?.name !== undefined ? String(body.name).trim() : target.name;
      const newEmail = body?.email !== undefined ? String(body.email).trim().toLowerCase() : target.email;
      const newPhone = body?.phone !== undefined ? String(body.phone).replace(/\D/g, "") : target.phone;
      const newPassword = body?.password !== undefined ? String(body.password).trim() : "";
      const newStoreName = body?.store_name !== undefined ? String(body.store_name).trim() : target.store_name;
      const newStoreSlug = body?.store_slug !== undefined
        ? String(body.store_slug).toLowerCase().trim().replace(/[^a-z0-9_-]/g, "")
        : target.store_slug;
      const newWhatsapp = body?.whatsapp_number !== undefined ? String(body.whatsapp_number).replace(/\D/g, "") : target.whatsapp_number;
      const newMomoNumber = body?.momo_number !== undefined ? String(body.momo_number).replace(/\D/g, "") : target.momo_number;
      const newMomoName = body?.momo_name !== undefined ? String(body.momo_name).trim() : target.momo_name;
      const newMomoNetwork = body?.momo_network !== undefined ? String(body.momo_network).trim() : target.momo_network;

      // Validate email uniqueness if changed
      if (newEmail && newEmail !== target.email?.toLowerCase()) {
        const emailCollision = agents.find((a) => a.id !== agentId && a.email?.toLowerCase() === newEmail);
        if (emailCollision) {
          return res.status(400).json({ ok: false, error: `Email "${newEmail}" is already used by another agent (${emailCollision.name}).` });
        }
      }

      // Validate phone uniqueness if changed
      if (newPhone && newPhone !== target.phone?.replace(/\D/g, "")) {
        const phoneCollision = agents.find((a) => a.id !== agentId && a.phone?.replace(/\D/g, "") === newPhone);
        if (phoneCollision) {
          return res.status(400).json({ ok: false, error: `Phone number "${newPhone}" is already used by another agent (${phoneCollision.name}).` });
        }
      }

      // Validate slug uniqueness if changed
      if (newStoreSlug && newStoreSlug !== target.store_slug) {
        const slugCollision = agents.find((a) => a.id !== agentId && a.store_slug === newStoreSlug);
        if (slugCollision) {
          return res.status(400).json({ ok: false, error: `Store slug "${newStoreSlug}" is already taken by another agent.` });
        }
      }

      if (newName) target.name = newName;
      if (newEmail) target.email = newEmail;
      if (newPhone) target.phone = newPhone;
      if (newStoreName) target.store_name = newStoreName;
      if (newStoreSlug) target.store_slug = newStoreSlug;
      if (newWhatsapp !== undefined) target.whatsapp_number = newWhatsapp;
      if (newMomoNumber !== undefined) target.momo_number = newMomoNumber;
      if (newMomoName !== undefined) target.momo_name = newMomoName;
      if (newMomoNetwork !== undefined) target.momo_network = newMomoNetwork;

      if (newPassword) {
        target.password_hash = newPassword;
        target.password = newPassword;
      }

      // Persist across memory and database
      agents[index] = target;
      await saveAgents(supabase, agents, agentId);

      try {
        const dbUpdates: Record<string, any> = {
          name: target.name,
          email: target.email,
          phone: target.phone,
          store_name: target.store_name,
          store_slug: target.store_slug,
          whatsapp_number: target.whatsapp_number,
          momo_number: target.momo_number,
          momo_name: target.momo_name,
          momo_network: target.momo_network,
          updated_at: new Date().toISOString(),
        };
        if (newPassword) {
          dbUpdates.password_hash = newPassword;
        }
        await supabase.from("agents").update(dbUpdates).eq("id", agentId);
      } catch (dbErr) {
        console.warn("Direct agent table update notice:", dbErr);
      }

      return res.status(200).json({
        ok: true,
        message: `Agent "${target.name}" credentials updated successfully!`,
        agent: sanitizeAgentRecord(target, true),
      });
    }

    // -------------------------------------------------------------
    // RESET AGENT STATS / CLEAR TEST DATA (MAKE DASHBOARD 0.00)
    // -------------------------------------------------------------
    if (action === "adminResetAgentStats" || action === "resetMyStats") {
      const rawId = body?.agent_id || req.query?.agent_id || req.query?.agentId || body?.id || req.query?.id || "";
      const agentId = String(rawId).trim();
      if (action === "resetMyStats" && (!agentId || agentId === "all")) {
        return res.status(400).json({ ok: false, error: "Valid agent_id is required to reset your stats." });
      }
      const resetAll = action === "adminResetAgentStats" && (!agentId || agentId === "all");

      // 1. Delete from agent_orders table
      try {
        if (resetAll) {
          await supabase.from("agent_orders").delete().neq("id", "_none_");
        } else {
          await supabase.from("agent_orders").delete().eq("agent_id", agentId);
        }
      } catch (_) { }

      // 2. Clear from settings.agent_orders_registry
      try {
        if (resetAll) {
          await supabase.from("settings").upsert({ key: "agent_orders_registry", value: JSON.stringify([]) }, { onConflict: "key" });
        } else {
          const { data } = await supabase.from("settings").select("value").eq("key", "agent_orders_registry").maybeSingle();
          if (data?.value) {
            let list = JSON.parse(data.value);
            if (Array.isArray(list)) {
              list = list.filter((o: any) => o.agent_id !== agentId);
              await supabase.from("settings").upsert({ key: "agent_orders_registry", value: JSON.stringify(list) }, { onConflict: "key" });
            }
          }
        }
      } catch (_) { }

      // 3. Delete from agent_withdrawals table
      try {
        if (resetAll) {
          await supabase.from("agent_withdrawals").delete().neq("id", "_none_");
        } else {
          await supabase.from("agent_withdrawals").delete().eq("agent_id", agentId);
        }
      } catch (_) { }

      // 4. Clear from settings.agent_withdrawals_registry
      try {
        if (resetAll) {
          await supabase.from("settings").upsert({ key: "agent_withdrawals_registry", value: JSON.stringify([]) }, { onConflict: "key" });
        } else {
          const { data } = await supabase.from("settings").select("value").eq("key", "agent_withdrawals_registry").maybeSingle();
          if (data?.value) {
            let list = JSON.parse(data.value);
            if (Array.isArray(list)) {
              list = list.filter((w: any) => w.agent_id !== agentId);
              await supabase.from("settings").upsert({ key: "agent_withdrawals_registry", value: JSON.stringify(list) }, { onConflict: "key" });
            }
          }
        }
      } catch (_) { }

      // 5. Clear agent_id on core orders table
      try {
        if (resetAll) {
          await supabase.from("orders").update({ agent_id: null }).not("agent_id", "is", null);
        } else {
          await supabase.from("orders").update({ agent_id: null }).eq("agent_id", agentId);
        }
      } catch (_) { }

      // 6. Zero out static balance fields on agents registry
      try {
        const loadedAgents = await loadAgents(supabase);
        let changed = false;
        const updatedAgents = loadedAgents.map((a: any) => {
          if (resetAll || a.id === agentId) {
            changed = true;
            return {
              ...a,
              wallet_balance: 0,
              walletBalance: 0,
              today_orders_count: 0,
              todayOrdersCount: 0,
              today_profit: 0,
              todayProfit: 0,
              total_profit: 0,
              totalProfit: 0,
              total_withdrawn: 0,
              totalWithdrawn: 0,
              pending_withdrawal: 0,
              pendingWithdrawal: 0,
            };
          }
          return a;
        });
        if (changed) {
          await saveAgents(supabase, updatedAgents);
        }
      } catch (_) { }

      // Clear all in-memory caches
      memoryAgentOrders = null;
      memoryWithdrawals = null;
      memoryAgents = null;

      return res.status(200).json({
        ok: true,
        message: resetAll
          ? "All agent metrics, orders, and withdrawals reset to GH₵ 0.00 successfully!"
          : "Agent metrics, orders, and withdrawals reset to GH₵ 0.00 successfully!",
      });
    }

    if (action === "adminGetBasePrices") {
      const basePrices = await loadBasePrices(supabase);
      return res.status(200).json({ ok: true, base_prices: basePrices, products: DEFAULT_PRODUCTS });
    }

    if (action === "adminUpdateBasePrices") {
      const prices = body?.base_prices;
      if (!prices || typeof prices !== "object") {
        return res.status(400).json({ ok: false, error: "base_prices map is required." });
      }

      // Check previous base prices to determine differences
      const oldBasePrices = await loadBasePrices(supabase, true);
      const preserveProfit = body?.preserve_agent_profit !== false; // Default: true

      let adjustedAgentsCount = 0;
      if (preserveProfit) {
        // Calculate difference for each product: diff = newPrice - oldPrice
        const diffs: Record<string, number> = {};
        for (const [key, newPriceVal] of Object.entries(prices)) {
          const newPrice = Number(newPriceVal);
          const oldPrice = Number(oldBasePrices[key]);
          if (!isNaN(newPrice) && !isNaN(oldPrice)) {
            const diff = Number((newPrice - oldPrice).toFixed(2));
            if (diff !== 0) {
              diffs[key] = diff;
            }
          }
        }

        // If base prices changed, shift every agent's custom selling price by the exact same amount
        // so (Customer Price - New Base Price) yields the exact same profit margin!
        if (Object.keys(diffs).length > 0) {
          const agents = await loadAgents(supabase, true);
          let modified = false;

          agents.forEach((ag) => {
            if (ag && ag.custom_prices && typeof ag.custom_prices === "object") {
              let agentPricesUpdated = false;
              for (const [prodKey, diff] of Object.entries(diffs)) {
                if (ag.custom_prices[prodKey] !== undefined) {
                  const currentCustom = Number(ag.custom_prices[prodKey]);
                  if (!isNaN(currentCustom)) {
                    ag.custom_prices[prodKey] = Number((currentCustom + diff).toFixed(2));
                    agentPricesUpdated = true;
                    modified = true;
                  }
                }
              }
              if (agentPricesUpdated) {
                adjustedAgentsCount++;
              }
            }
          });

          if (modified) {
            await saveAgents(supabase, agents);
          }
        }
      }

      await supabase.from("settings").upsert({
        key: "agent_base_prices",
        value: JSON.stringify(prices),
      }, { onConflict: "key" });

      memoryBasePrices = prices;
      memoryBasePricesLoadedAt = Date.now();

      return res.status(200).json({
        ok: true,
        message: preserveProfit && adjustedAgentsCount > 0
          ? `Agent base prices updated! Storefront selling prices automatically adjusted across ${adjustedAgentsCount} agent(s) to protect their profits.`
          : "Agent base prices updated successfully!",
        adjusted_agents_count: adjustedAgentsCount,
      });
    }

    if (action === "adminGetWithdrawals") {
      const withdrawals = await loadWithdrawals(supabase);
      const agents = await loadAgents(supabase);
      const agentMap = new Map(agents.map((a) => [a.id, a]));

      const enriched = withdrawals.map((w: any) => ({
        ...w,
        agent_name: agentMap.get(w.agent_id)?.name || "Agent",
        agent_email: agentMap.get(w.agent_id)?.email || "",
        agent_phone: agentMap.get(w.agent_id)?.phone || "",
        store_name: agentMap.get(w.agent_id)?.store_name || "",
      }));

      return res.status(200).json({ ok: true, withdrawals: enriched });
    }

    if (action === "testPaystack") {
      const explicitKey = cleanApiKey(body?.paystack_secret_key);
      const paystackKey = explicitKey || (await getPaystackSecretKey(supabase));
      if (!paystackKey) {
        return res.status(400).json({
          ok: false,
          error: "Paystack Secret Key is not configured. Please enter your Paystack Secret Key (starts with sk_live_ or sk_test_).",
        });
      }
      const result = await checkPaystackStatus(paystackKey);
      if (!result.ok) {
        return res.status(400).json(result);
      }
      return res.status(200).json(result);
    }

    if (action === "adminApproveWithdrawal") {
      const withdrawalId = String(body?.withdrawal_id || "").trim();
      const manual = body?.manual === true || body?.payment_method === "manual";
      let manualReference = String(body?.reference || "").trim();

      if (!withdrawalId) return res.status(400).json({ ok: false, error: "withdrawal_id is required." });

      // Fetch the withdrawal record
      let withdrawal: any = null;
      try {
        const { data: dbW } = await supabase.from("agent_withdrawals").select("*").eq("id", withdrawalId).maybeSingle();
        if (dbW) withdrawal = dbW;
      } catch (_) { }

      if (!withdrawal) {
        const { data: sData } = await supabase.from("settings").select("value").eq("key", "agent_withdrawals_registry").maybeSingle();
        if (sData?.value) {
          try {
            const list = JSON.parse(sData.value);
            withdrawal = list.find((w: any) => w.id === withdrawalId);
          } catch (_) { }
        }
      }

      if (!withdrawal) {
        return res.status(404).json({ ok: false, error: "Withdrawal request not found." });
      }

      if (withdrawal.status === "completed") {
        return res.status(400).json({ ok: false, error: "This withdrawal request has already been marked as completed." });
      }

      const now = getGhanaTimestamp();
      let paymentRef = manualReference;
      let paystackTransferCode = "";

      // Disburse through Paystack unless manual is explicitly chosen
      if (!manual) {
        const paystackKey = await getPaystackSecretKey(supabase);
        if (!paystackKey) {
          return res.status(400).json({
            ok: false,
            error: "Paystack Secret Key is not configured. Please enter and save your Paystack Secret Key in Admin Settings > Payment Gateway.",
            suggest_manual: true,
          });
        }

        const agents = await loadAgents(supabase);
        const agent = agents.find((a) => a.id === withdrawal.agent_id);

        const momoNumber = withdrawal.momo_number || agent?.momo_number || agent?.phone || "";
        const momoNetwork = withdrawal.momo_network || agent?.momo_network || "MTN";
        const momoName = withdrawal.momo_name || agent?.momo_name || agent?.name || "Agent";

        const disburseResult = await disburseViaPaystack({
          paystackKey,
          amount: Number(withdrawal.amount),
          momoNumber,
          momoNetwork,
          momoName,
          reason: `Data1gh Withdrawal - ${momoName} (${withdrawal.id})`,
        });

        if (!disburseResult.ok) {
          return res.status(400).json({
            ok: false,
            error: disburseResult.error,
            paystack_error: true,
            suggest_manual: true,
          });
        }

        paymentRef = disburseResult.reference || disburseResult.transferCode || `TRF_${Date.now()}`;
        paystackTransferCode = disburseResult.transferCode || "";
      }

      // 1. Update SQL agent_withdrawals table
      try {
        await supabase.from("agent_withdrawals").update({
          status: "completed",
          completed_at: now,
          payment_reference: paymentRef || null,
          paystack_transfer_code: paystackTransferCode || null,
        }).eq("id", withdrawalId);
      } catch (_) { }

      // 2. Update settings fallback registry
      try {
        const { data } = await supabase.from("settings").select("value").eq("key", "agent_withdrawals_registry").maybeSingle();
        if (data?.value) {
          let list = JSON.parse(data.value);
          if (Array.isArray(list)) {
            list = list.map((w: any) => (w.id === withdrawalId ? {
              ...w,
              status: "completed",
              completed_at: now,
              payment_reference: paymentRef || null,
              paystack_transfer_code: paystackTransferCode || null,
            } : w));
            await supabase.from("settings").upsert({ key: "agent_withdrawals_registry", value: JSON.stringify(list) }, { onConflict: "key" });
          }
        }
      } catch (_) { }

      // 3. Dispatch confirmation notification to Agent via SMS and Email (Brevo)
      try {
        const agents = await loadAgents(supabase);
        const agent = agents.find((a) => a.id === withdrawal.agent_id);
        const notifyPhone = agent?.phone || withdrawal.momo_number;
        const notifyEmail = agent?.email || "";

        const notifMsg = `Hello ${withdrawal.momo_name || agent?.name || "Agent"},\n\nYour withdrawal of GH₵ ${Number(withdrawal.amount).toFixed(2)} to ${withdrawal.momo_network} (${withdrawal.momo_number}) has been disbursed successfully via Paystack!\n\nReference: ${paymentRef}\nStatus: Completed\n\nThank you for partnering with Data1gh!`;

        await sendAgentNotification(supabase, {
          email: notifyEmail,
          phone: notifyPhone,
          subject: "Data1gh - Withdrawal Disbursed Successfully",
          message: notifMsg,
        });
      } catch (_) { }

      return res.status(200).json({
        ok: true,
        message: manual
          ? `Withdrawal of GH₵ ${Number(withdrawal.amount).toFixed(2)} marked as completed manually!`
          : `Withdrawal of GH₵ ${Number(withdrawal.amount).toFixed(2)} successfully disbursed via Paystack! (Ref: ${paymentRef})`,
        reference: paymentRef,
        paystack_code: paystackTransferCode,
      });
    }

    if (action === "adminRejectWithdrawal") {
      const withdrawalId = String(body?.withdrawal_id || "").trim();
      const reason = String(body?.reason || "Rejected by administrator").trim();
      if (!withdrawalId) return res.status(400).json({ ok: false, error: "withdrawal_id required" });

      const now = getGhanaTimestamp();
      try {
        await supabase.from("agent_withdrawals").update({
          status: "rejected",
          reject_reason: reason,
          completed_at: now,
        }).eq("id", withdrawalId);
      } catch (_) { }

      try {
        const { data } = await supabase.from("settings").select("value").eq("key", "agent_withdrawals_registry").maybeSingle();
        if (data?.value) {
          let list = JSON.parse(data.value);
          if (Array.isArray(list)) {
            list = list.map((w: any) => (w.id === withdrawalId ? { ...w, status: "rejected", reject_reason: reason, completed_at: now } : w));
            await supabase.from("settings").upsert({ key: "agent_withdrawals_registry", value: JSON.stringify(list) }, { onConflict: "key" });
          }
        }
      } catch (_) { }

      return res.status(200).json({ ok: true, message: "Withdrawal rejected and funds refunded to agent wallet!" });
    }

    // -------------------------------------------------------------
    // 12. ADMIN GET ALL AGENT ORDERS (WITH AGENT DETAILS)
    // -------------------------------------------------------------
    if (action === "adminGetOrders") {
      const agentId = String(body?.agent_id || req.query?.agent_id || "").trim();
      const allOrders = await loadAgentOrders(supabase, agentId || undefined);
      const agents = await loadAgents(supabase);
      const agentMap = new Map(agents.map((a) => [a.id, a]));

      const enriched = allOrders.map((o: any) => {
        const ag = agentMap.get(o.agent_id);
        return {
          ...o,
          agent_name: ag?.name || "Agent",
          agent_email: ag?.email || "",
          agent_phone: ag?.phone || "",
          store_name: ag?.store_name || "Agent Store",
          store_slug: ag?.store_slug || "",
        };
      });

      return res.status(200).json({ ok: true, orders: enriched });
    }

    // -------------------------------------------------------------
    // 13. TEST EMAIL DISPATCH (BREVO / RESEND / GMAIL)
    // -------------------------------------------------------------
    if (action === "testEmail") {
      const recipient = String(body?.email || req.query?.email || "").trim();
      const directKey = String(body?.api_key || body?.resend_api_key || "").trim();
      const directBrevoKey = String(body?.brevo_api_key || "").trim();
      const directBrevoSender = String(body?.brevo_sender_email || "").trim();
      const directFrom = String(body?.from_email || body?.resend_from_email || "").trim();

      if (!recipient || !recipient.includes("@")) {
        return res.status(400).json({ ok: false, error: "A valid recipient email address is required." });
      }

      const { emailSent, deliveredEmail, error } = await sendAgentNotification(supabase, {
        email: recipient,
        subject: "Data1gh - Live Email Delivery Test",
        message: "Hello!\n\nThis is a live test notification from Data1gh to confirm that your Email Delivery API (Brevo / Resend) is successfully connected and operational!\n\nIf you see this in your inbox, email delivery is working perfectly.\n\nData1gh Reseller Platform",
        apiKey: directKey || undefined,
        brevoApiKey: directBrevoKey || undefined,
        brevoSenderEmail: directBrevoSender || undefined,
        fromSender: directFrom || undefined,
      });

      if (!emailSent) {
        return res.status(400).json({
          ok: false,
          error: error || "Failed to deliver email. Please check your Brevo API Key or Resend Key in Settings.",
        });
      }

      return res.status(200).json({
        ok: true,
        message: `Test email successfully sent to ${deliveredEmail || recipient}!`,
      });
    }

    return res.status(400).json({ ok: false, error: `Unknown action: "${action}"` });
  } catch (err: any) {
    console.error("Agent API error:", err);
    return res.status(500).json({ ok: false, error: err?.message || "Internal server error" });
  }
}
