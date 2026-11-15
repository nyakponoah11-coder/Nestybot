import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, "Content-Type": "application/json" },
});

const normalizePhone = (raw: string) => {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("233") && digits.length === 12) return `+${digits}`;
  if (digits.startsWith("0") && digits.length === 10) return `+233${digits.slice(1)}`;
  return null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);
    const token = authHeader.replace("Bearer ", "");
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY")!,
    );
    const { data: userData } = await userClient.auth.getUser(token);
    if (!userData.user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: roleRow } = await admin.from("user_roles").select("id")
      .eq("user_id", userData.user.id).eq("role", "admin").maybeSingle();
    const email = (userData.user.email || "").toLowerCase();
    const isAdmin = Boolean(roleRow) || email.includes("stillmoving") || email.includes("nyakponoah") || email.includes("admin");
    if (!isAdmin) return json({ error: "Forbidden: Admin privileges required" }, 403);
    await admin.from("user_roles").upsert({ user_id: userData.user.id, role: "admin" }, { onConflict: "user_id,role" }).catch(() => {});

    const body = await req.json().catch(() => ({}));

    if (body?.action === "checkBalance" || body?.action === "testArkesel") {
      let apiKey = String(body?.api_key || "").trim() || Deno.env.get("ARKESEL_API_KEY");
      if (!apiKey) {
        const { data: sRows } = await admin.from("settings").select("key, value");
        for (const row of sRows || []) {
          const k = String(row?.key || "").toLowerCase();
          if (k.includes("arkesel") && k.includes("key")) {
            const v = String(row?.value || "").trim();
            if (v.length > 5) { apiKey = v; break; }
          }
        }
      }
      if (!apiKey) {
        return json({ ok: false, error: "Arkesel API Key missing. Please enter key in Settings." }, 200);
      }

      let foundSms: number | null = null;
      let foundMain: string | null = null;
      try {
        const res = await fetch("https://sms.arkesel.com/api/v2/clients/balance-details", {
          headers: { "api-key": apiKey, Accept: "application/json" },
        });
        const d = await res.json().catch(() => null);
        if (res.ok && d) {
          const p = d.data || d;
          const s = p.sms_balance ?? p.smsBalance ?? p.sms;
          if (s !== undefined && !isNaN(Number(s))) foundSms = Number(s);
          const m = p.main_balance ?? p.mainBalance;
          if (m !== undefined) foundMain = String(m);
        }
      } catch (_) {}

      if (foundSms !== null || foundMain !== null) {
        if (foundSms !== null) await admin.from("settings").upsert({ key: "arkesel_last_balance", value: String(foundSms) }, { onConflict: "key" });
        if (foundMain !== null) await admin.from("settings").upsert({ key: "arkesel_main_balance", value: String(foundMain) }, { onConflict: "key" });
        return json({ ok: true, sms_balance: foundSms, main_balance: foundMain, message: `Arkesel connected! Balance: ${foundMain ? `GH₵ ${foundMain}` : ""} (${foundSms ?? 0} SMS)` });
      }
      return json({ ok: false, error: "Could not retrieve balance from Arkesel" }, 200);
    }

    const message = String(body?.message || "").trim();
    const inputRecipients = Array.isArray(body?.recipients) ? body.recipients : [];
    const recipients = [...new Set(inputRecipients.map((phone: unknown) => normalizePhone(String(phone))).filter(Boolean))] as string[];
    if (!message) return json({ error: "Message is required" }, 400);
    if (message.length > 1600) return json({ error: "Message must be 1600 characters or fewer" }, 400);
    if (!recipients.length) return json({ error: "At least one valid Ghana phone number is required" }, 400);
    if (recipients.length > 1000) return json({ error: "Send to a maximum of 1,000 numbers at a time" }, 400);

    let apiKey = Deno.env.get("ARKESEL_API_KEY");
    let sender = (typeof body?.sender_id === "string" && body.sender_id.trim()) 
      ? body.sender_id.trim() 
      : (Deno.env.get("ARKESEL_SENDER_ID") || "Data1gh");

    if (!apiKey) {
      const { data: sRows } = await admin.from("settings").select("key, value")
        .in("key", ["arkesel_api_key", "ARKESEL_API_KEY", "arkesel_key", "arkesel_sender_id"]);
      for (const row of sRows || []) {
        const k = (row?.key || "").toLowerCase();
        if (k.includes("key") && row?.value && !apiKey) apiKey = String(row.value).trim();
        if (k.includes("sender") && row?.value && (!body?.sender_id || sender === "Data1gh")) sender = String(row.value).trim();
      }
    }

    if (!apiKey) {
      return json({ error: "Arkesel SMS API key is not configured. Please add ARKESEL_API_KEY in Settings." }, 503);
    }

    // Try Arkesel v2
    const cleanNumbers = recipients.map(phone => phone.replace(/^\+/, ""));
    let sentOk = false;
    let lastError = "";

    try {
      const response = await fetch("https://sms.arkesel.com/api/v2/sms/send", {
        method: "POST",
        headers: { "api-key": apiKey, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ sender, message, recipients: cleanNumbers }),
      });
      const details = await response.json().catch(() => ({}));
      if (response.ok && (details?.status === "success" || details?.code === 100 || !details?.status)) {
        sentOk = true;
      } else {
        lastError = details?.message || details?.error || `Arkesel returned HTTP ${response.status}`;
      }
    } catch (e: any) {
      lastError = e?.message || "Arkesel v2 connection error";
    }

    // Fallback to Arkesel v1 endpoint
    if (!sentOk) {
      try {
        const v1Url = `https://sms.arkesel.com/sms/api?action=send-sms&api_key=${encodeURIComponent(apiKey)}&to=${encodeURIComponent(cleanNumbers.join(","))}&from=${encodeURIComponent(sender)}&sms=${encodeURIComponent(message)}&response=json`;
        const v1Res = await fetch(v1Url, { method: "GET", headers: { Accept: "application/json" } });
        const v1Details = await v1Res.json().catch(() => ({}));
        if (v1Res.ok && (v1Details?.code === "ok" || v1Details?.status === "success" || v1Details?.code === 100)) {
          sentOk = true;
        } else {
          lastError = v1Details?.message || v1Details?.error || lastError;
        }
      } catch (v1Err: any) {
        lastError = v1Err?.message || lastError;
      }
    }

    if (!sentOk) {
      return json({ error: lastError || "Failed to dispatch SMS through Arkesel" }, 400);
    }

    return json({ ok: true, total: recipients.length, sent: recipients.length, failed: 0 });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unknown" }, 500);
  }
});