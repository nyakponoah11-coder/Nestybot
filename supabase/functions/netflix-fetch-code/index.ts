// Fetches the most recent Netflix sign-in code from the connected Gmail inbox
// (stillmoving11@gmail.com). Public: caller passes a paid Netflix service_orders
// reference. Enforces 30-day login expiry.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GMAIL_BASE = "https://gmail.googleapis.com/gmail/v1";

function b64urlDecode(input: string): string {
  const s = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  try {
    const bin = atob(s + pad);
    // Decode UTF-8
    const bytes = new Uint8Array([...bin].map(c => c.charCodeAt(0)));
    return new TextDecoder("utf-8").decode(bytes);
  } catch {
    return "";
  }
}

function walkParts(payload: any, out: string[]) {
  if (!payload) return;
  if (payload.body?.data) out.push(b64urlDecode(payload.body.data));
  if (Array.isArray(payload.parts)) payload.parts.forEach((p: any) => walkParts(p, out));
}

function extractCode(text: string, subject = ""): string | null {
  const combined = `${subject}\n${text}`;
  const cleaned = combined.replace(/\r/g, "");

  if (subject) {
    const subjMatch =
      subject.match(/(?:code|sign[- ]in|access|código)[^\d]{0,25}(\d{4,6})/i) ||
      subject.match(/^(\d{4,6})\s+is your/i);
    if (subjMatch && !["2024", "2025", "2026", "2027"].includes(subjMatch[1])) {
      return subjMatch[1];
    }
  }

  const spacedMatch = cleaned.match(
    /(?:temporary\s+(?:sign[- ]in|access)\s+code|sign[- ]in\s+code|access\s+code|verification\s+code|your\s+code\s+is|enter\s+this\s+code)[^\d]{0,50}(\d\s+\d\s+\d\s+\d(?:\s+\d\s+\d)?)/i
  );
  if (spacedMatch) {
    const compact = spacedMatch[1].replace(/\s+/g, "");
    if (compact.length >= 4 && compact.length <= 6 && !["2024", "2025", "2026", "2027"].includes(compact)) {
      return compact;
    }
  }

  const patterns = [
    /(?:temporary\s+(?:sign[- ]in|access)\s+code)[^\d]{0,40}(\d{4,6})/i,
    /(?:sign[- ]in\s+code)[^\d]{0,40}(\d{4,6})/i,
    /(?:verification\s+code)[^\d]{0,40}(\d{4,6})/i,
    /(?:temporary\s+code)[^\d]{0,40}(\d{4,6})/i,
    /(?:your\s+code\s+is)[^\d]{0,40}(\d{4,6})/i,
    /(?:enter\s+this\s+code)[^\d]{0,40}(\d{4,6})/i,
    /(?:access\s+code)[^\d]{0,40}(\d{4,6})/i,
    /(?:code\s*:\s*)(\d{4,6})/i,
    /\b(\d{4})\b/,
    /\b(\d{6})\b/,
  ];
  for (const p of patterns) {
    const m = cleaned.match(p);
    if (m && !["2024", "2025", "2026", "2027"].includes(m[1])) return m[1];
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let accessToken = Deno.env.get("GMAIL_ACCESS_TOKEN") || Deno.env.get("GOOGLE_ACCESS_TOKEN") || "";
    let refreshToken = Deno.env.get("GMAIL_REFRESH_TOKEN") || "";
    let clientId = Deno.env.get("GMAIL_CLIENT_ID") || "695163322385-grjddchnib6ambq30ojrc1581ck6s180.apps.googleusercontent.com";
    let clientSecret = Deno.env.get("GMAIL_CLIENT_SECRET") || "";

    if (!accessToken) {
      const { data: sRows } = await admin.from("settings").select("key, value")
        .in("key", ["gmail_access_token", "gmail_refresh_token", "gmail_client_id", "gmail_client_secret"]);
      for (const r of sRows || []) {
        if (r.key === "gmail_access_token" && r.value) accessToken = r.value;
        if (r.key === "gmail_refresh_token" && r.value) refreshToken = r.value;
        if (r.key === "gmail_client_id" && r.value) clientId = r.value;
        if (r.key === "gmail_client_secret" && r.value) clientSecret = r.value;
      }
    }

    if (!accessToken && !refreshToken) {
      return json({ error: "Gmail is not connected. Admin needs to link Gmail in settings." }, 500);
    }

    const requestHeaders: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
    };

    const { reference } = await req.json();
    if (!reference) return json({ error: "Missing reference" }, 400);

    const { data: order } = await admin
      .from("service_orders").select("*").eq("reference", reference).maybeSingle();
    if (!order) return json({ error: "Order not found" }, 404);
    if (order.service !== "netflix") return json({ error: "Not a Netflix order" }, 400);
    if (order.payment_status !== "paid") return json({ error: "Payment not confirmed yet" }, 402);
    if (order.netflix_login_expires_at && new Date(order.netflix_login_expires_at) < new Date()) {
      return json({ error: "Your 30-day access has expired. Please purchase again." }, 410);
    }
    // Return delivered code cleanly
    if (order.netflix_last_code) {
      return json({
        code: order.netflix_last_code,
        email_at: order.netflix_last_code_at || new Date().toISOString(),
        already_used: true,
        message: "Sign-in code retrieved successfully.",
      }, 200);
    }

    // Query recent Netflix email (last 2 days)
    const q = "(from:netflix OR from:account.netflix.com OR subject:netflix OR netflix) newer_than:2d";
    let listRes = await fetch(`${GMAIL_BASE}/users/me/messages?maxResults=10&q=${encodeURIComponent(q)}`, {
      headers: requestHeaders,
    });
    if (!listRes.ok && listRes.status === 401 && refreshToken && clientId && clientSecret) {
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" }),
      });
      const tokenData = await tokenRes.json().catch(() => ({}));
      if (tokenData.access_token) {
        requestHeaders.Authorization = `Bearer ${tokenData.access_token}`;
        listRes = await fetch(`${GMAIL_BASE}/users/me/messages?maxResults=10&q=${encodeURIComponent(q)}`, {
          headers: requestHeaders,
        });
      }
    }
    if (!listRes.ok) {
      const t = await listRes.text();
      return json({ error: `Gmail list failed: ${listRes.status}`, detail: t }, 502);
    }
    const list = await listRes.json();
    const msgs = list.messages || [];
    if (!msgs.length) return json({ error: "No recent Netflix email found. Please request a new code on Netflix, then try again." }, 404);

    let bestCode: string | null = null;
    let bestDate = 0;
    let bestSubject = "";

    for (const m of msgs.slice(0, 5)) {
      const gRes = await fetch(`${baseUrl}/users/me/messages/${m.id}?format=full`, {
        headers: requestHeaders,
      });
      if (!gRes.ok) continue;
      const g = await gRes.json();
      const internalDate = Number(g.internalDate || 0);
      // Ignore emails older than 60 min
      if (internalDate && Date.now() - internalDate > 60 * 60 * 1000) continue;

      const headers = g.payload?.headers || [];
      const subject = headers.find((h: any) => h.name?.toLowerCase() === "subject")?.value || "";
      const snippet = g.snippet || "";

      const parts: string[] = [];
      walkParts(g.payload, parts);
      const bodyText = [subject, snippet, ...parts].join("\n");
      const code = extractCode(bodyText);
      if (code && internalDate > bestDate) {
        bestCode = code;
        bestDate = internalDate;
        bestSubject = subject;
      }
    }

    if (!bestCode) {
      return json({ error: "No sign-in code found in the last hour. On Netflix, tap 'Send sign-in code' again, wait about 30 seconds, then try here." }, 404);
    }

    await admin.from("service_orders").update({
      netflix_last_code: bestCode,
      netflix_last_code_at: new Date(bestDate).toISOString(),
    }).eq("reference", reference);

    if (order.customer_phone) {
      try {
        const rawPhone = String(order.customer_phone || "").replace(/\D/g, "");
        const formatted = rawPhone.startsWith("233") && rawPhone.length === 12
          ? rawPhone
          : rawPhone.startsWith("0") && rawPhone.length === 10
          ? `233${rawPhone.slice(1)}`
          : rawPhone.length === 9
          ? `233${rawPhone}`
          : rawPhone;

        let arkeselKey = Deno.env.get("ARKESEL_API_KEY");
        let sender = (Deno.env.get("ARKESEL_SENDER_ID") || "Data1gh").slice(0, 11);
        if (!arkeselKey) {
          const { data: sRows } = await admin.from("settings").select("key,value")
            .in("key", ["arkesel_api_key", "ARKESEL_API_KEY", "arkesel_key", "arkesel_sender_id", "ARKESEL_SENDER_ID"]);
          for (const row of sRows || []) {
            const k = (row?.key || "").toLowerCase();
            if (k.includes("key") && !arkeselKey && row?.value) arkeselKey = String(row.value).trim();
            if (k.includes("sender") && row?.value) sender = String(row.value).trim().slice(0, 11);
          }
        }

        // Automatic SMS blocked per owner instruction.
        const AUTO_SMS_ENABLED = false;
        if (AUTO_SMS_ENABLED && arkeselKey && formatted) {
          const emailToUse = creds?.netflixEmail || "Netflix";
          const smsMsg = `Data1gh: Your Netflix sign-in code is: ${bestCode}\nAccount: ${emailToUse}\nEnter this code on Netflix to complete sign-in. Valid for 15 minutes.`;
          await fetch("https://sms.arkesel.com/api/v2/sms/send", {
            method: "POST",
            headers: { "api-key": arkeselKey, "Content-Type": "application/json" },
            body: JSON.stringify({ sender: sender || "Data1gh", message: smsMsg, recipients: [formatted] }),
          }).catch(() => {});
        }
      } catch (_) {}
    }

    return json({
      code: bestCode,
      subject: bestSubject,
      email_at: new Date(bestDate).toISOString(),
      expires_at: new Date(bestDate + 15 * 60 * 1000).toISOString(),
      login_expires_at: order.netflix_login_expires_at,
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unknown" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
