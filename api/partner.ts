import { getSupabase, parseBody, setCorsHeaders, cleanApiKey } from "./_supabase.js";
import { detectAndBlockIntrusion } from "./_firewall.js";
import {
  GMAIL_BASE,
  walkParts,
  extractCode,
  resolveGmailCredentials,
  enrichServiceOrder,
  setNoteTag,
} from "./services.js";

// Helper to generate a clean order reference
function generatePartnerReference(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  for (let i = 0; i < 6; i++) {
    suffix += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `NF-P-${Date.now().toString(36).slice(-4).toUpperCase()}${suffix}`;
}

export default async function handler(req: any, res: any) {
  try {
    setCorsHeaders(res);
    if (req.method === "OPTIONS") {
      return res.status(200).end();
    }

    const body = parseBody(req);
    const url = String(req.url || "");

    // 1. Determine requested action
    let action = (
      req.query?.action ||
      body?.action ||
      req.headers?.["x-action"] ||
      (url.includes("/netflix/fetch-code") || url.includes("/netflix/code")
        ? "fetch-code"
        : url.includes("/netflix/order") || url.includes("/netflix/create")
        ? "create-order"
        : url.includes("/netflix/status")
        ? "status"
        : url.includes("/netflix/stock") || url.includes("/stock") || url.includes("/products") || url.includes("/availability")
        ? "stock"
        : url.includes("/info")
        ? "info"
        : "")
    ).toLowerCase();

    let supabase: any;
    try {
      supabase = getSupabase();
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "Missing Supabase credentials." });
    }

    // Active Intrusion Firewall: Blocks PowerShell, shell commands, SQLi, and alerts admin
    if (await detectAndBlockIntrusion(req, res, supabase)) {
      return;
    }

    // 2. Authenticate Partner via API Key
    const rawApiKey =
      req.headers?.["x-api-key"] ||
      req.headers?.["x-partner-key"] ||
      req.headers?.["authorization"] ||
      req.query?.api_key ||
      body?.api_key ||
      "";

    const providedKey = cleanApiKey(rawApiKey);
    if (!providedKey) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Missing API Key. Please provide your partner API key in the 'x-api-key' header or '?api_key=' parameter.",
      });
    }

    // Load authorized partner keys & wallet settings from settings
    const { data: sRows } = await supabase
      .from("settings")
      .select("key, value")
      .in("key", [
        "netflix_partner_api_key",
        "partner_api_key",
        "partner_keys",
        "netflix_partners",
        "netflix_partner_price",
        "netflix_price",
        "netflix_partner_wallet",
        "netflix_partner_require_wallet",
      ]);

    const sMap: Record<string, string> = {};
    (sRows || []).forEach((r: any) => {
      if (r?.key && r?.value) sMap[r.key.toLowerCase()] = String(r.value).trim();
    });

    const envKeys = [
      cleanApiKey(process.env.NETFLIX_PARTNER_API_KEY),
      cleanApiKey(process.env.PARTNER_API_KEY),
      cleanApiKey(process.env.ADMIN_API_KEY),
      cleanApiKey(process.env.INTERNAL_API_SECRET),
    ].filter(Boolean);

    let isAuthorized = false;
    let partnerId = "default";
    let partnerName = "Authorized Partner";
    let partnerPrice = Number(sMap["netflix_partner_price"]) || 25;
    let partnerWallet = Number(sMap["netflix_partner_wallet"]) || 0;

    // 1. Check multi-partner list
    let partnersList: any[] = [];
    try {
      if (sMap["netflix_partners"]) partnersList = JSON.parse(sMap["netflix_partners"]);
    } catch (_) {}
    if (!partnersList.length && sMap["partner_keys"]) {
      try { partnersList = JSON.parse(sMap["partner_keys"]); } catch (_) {}
    }

    if (Array.isArray(partnersList)) {
      const match = partnersList.find(
        (p: any) => p && cleanApiKey(p.api_key || p.key) === providedKey && p.status !== "disabled" && p.active !== false
      );
      if (match) {
        isAuthorized = true;
        partnerId = match.id || "partner";
        if (match.name) partnerName = match.name;
        if (match.wholesale_price !== undefined) partnerPrice = Number(match.wholesale_price);
        else if (match.netflix_price !== undefined) partnerPrice = Number(match.netflix_price);
        if (match.wallet_balance !== undefined) partnerWallet = Number(match.wallet_balance);
      }
    }

    // 2. Check direct master partner keys
    if (!isAuthorized) {
      const validConfigKeys = [
        sMap["netflix_partner_api_key"],
        sMap["partner_api_key"],
        ...envKeys,
      ].filter(Boolean);

      if (validConfigKeys.includes(providedKey)) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Invalid API Key. Access denied.",
      });
    }

    // Rule: Partner is in stock ONLY if their balance is greater than 0 and sufficient for the order
    const hasSufficientBalance = partnerWallet > 0 && partnerWallet >= partnerPrice;
    const isOutOfStock = !hasSufficientBalance;

    // 3. ACTION: CHECK STOCK & PRODUCT CATALOG AVAILABILITY
    if (
      action === "stock" ||
      action === "check-stock" ||
      action === "products" ||
      action === "product" ||
      action === "catalog" ||
      action === "availability"
    ) {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      if (isOutOfStock) {
        return res.status(200).json({
          status: "out_of_stock",
          in_stock: false,
          out_of_stock: true,
          service: "netflix",
          message: "Out of stock. Partner wallet balance is zero or insufficient. Please contact your admin.",
          error: "Out of stock. Partner wallet balance is zero or insufficient. Please contact your admin.",
          customer_message: "Out of stock. Please contact your admin.",
          partner: {
            id: partnerId,
            name: partnerName,
            wallet_balance: partnerWallet,
            wholesale_price: partnerPrice,
            currency: "GHS",
            in_stock: false,
            stock_status: "out_of_stock",
          },
          products: [
            {
              id: "netflix-30-days",
              name: "Netflix 30-Day Access",
              service: "netflix",
              duration_days: 30,
              price: partnerPrice,
              currency: "GHS",
              in_stock: false,
              stock_status: "out_of_stock",
            },
          ],
        });
      }

      return res.status(200).json({
        status: "success",
        in_stock: true,
        out_of_stock: false,
        service: "netflix",
        message: "In stock. Partner has active wallet balance.",
        partner: {
          id: partnerId,
          name: partnerName,
          wallet_balance: partnerWallet,
          wholesale_price: partnerPrice,
          currency: "GHS",
          in_stock: true,
          stock_status: "in_stock",
        },
        products: [
          {
            id: "netflix-30-days",
            name: "Netflix 30-Day Access",
            service: "netflix",
            duration_days: 30,
            price: partnerPrice,
            currency: "GHS",
            in_stock: true,
            stock_status: "in_stock",
          },
        ],
      });
    }

    // 4. ACTION: INFO / API DOCS OVERVIEW
    if (!action || action === "info" || action === "docs") {
      res.setHeader("Cache-Control", "public, max-age=15, s-maxage=30, stale-while-revalidate=60");
      const creds = await resolveGmailCredentials(supabase);
      return res.status(200).json({
        status: isOutOfStock ? "out_of_stock" : "success",
        in_stock: !isOutOfStock,
        out_of_stock: isOutOfStock,
        stock_status: isOutOfStock ? "out_of_stock" : "in_stock",
        stock_message: isOutOfStock
          ? "Out of stock: Partner balance is zero or insufficient. Please fund your account to resume sales."
          : "In stock: Account ready to process orders.",
        service: "Data1 Netflix Reseller API",
        version: "1.0",
        partner: {
          id: partnerId,
          name: partnerName,
          authenticated: true,
          wholesale_price: partnerPrice,
          currency: "GHS",
          wallet_balance: partnerWallet,
          in_stock: !isOutOfStock,
          stock_status: isOutOfStock ? "out_of_stock" : "in_stock",
        },
        netflix: {
          account_email: creds.netflixEmail,
          gmail_connected: creds.isConfigured,
          duration_days: 30,
          in_stock: !isOutOfStock,
          out_of_stock: isOutOfStock,
          stock_status: isOutOfStock ? "out_of_stock" : "in_stock",
        },
        endpoints: {
          stock: {
            method: "GET",
            path: "/api/partner/netflix/stock",
            description: "Checks if Netflix is in stock for this partner API key based on wallet balance.",
            headers: { "x-api-key": "YOUR_PARTNER_API_KEY" },
          },
          create_order: {
            method: "POST",
            path: "/api/partner/netflix/order",
            description: "Creates an active 30-day Netflix access for a customer (requires positive partner balance).",
            headers: { "x-api-key": "YOUR_PARTNER_API_KEY", "Content-Type": "application/json" },
            body: {
              customer_name: "John Doe (optional)",
              customer_phone: "0541234567 (optional)",
              customer_email: "customer@example.com (optional)",
              partner_reference: "YOUR_ORDER_ID (optional)",
              duration_days: 30,
            },
          },
          fetch_code: {
            method: "POST",
            path: "/api/partner/netflix/fetch-code",
            description: "Fetches the latest Netflix OTP sign-in code from Gmail.",
            headers: { "x-api-key": "YOUR_PARTNER_API_KEY", "Content-Type": "application/json" },
            body: {
              reference: "ORDER_REFERENCE_FROM_CREATE_ORDER",
              force: false,
            },
          },
          status: {
            method: "GET",
            path: "/api/partner/netflix/status?reference=ORDER_REFERENCE",
            description: "Checks remaining days and validity of a Netflix order.",
            headers: { "x-api-key": "YOUR_PARTNER_API_KEY" },
          },
        },
      });
    }

    // 5. ACTION: CREATE NETFLIX ORDER
    if (action === "create-order" || action === "create" || action === "order") {
      const customerName = String(body?.customer_name || body?.name || "Partner Customer").trim();
      const customerPhone = String(body?.customer_phone || body?.phone || "").trim();
      const customerEmail = String(body?.customer_email || body?.email || "").trim();
      const partnerReference = String(body?.partner_reference || body?.custom_ref || "").trim();
      const durationDays = Number(body?.duration_days) || 30;

      // Immediately return OUT OF STOCK if partner balance is 0 or less than wholesale price
      if (isOutOfStock) {
        return res.status(400).json({
          status: "out_of_stock",
          in_stock: false,
          out_of_stock: true,
          error: "Out of stock. Partner wallet balance is zero or insufficient to create this Netflix order. Please contact your admin.",
          message: "Out of stock. Please contact your admin.",
          customer_message: "Out of stock. Please contact your admin.",
          wallet_balance: partnerWallet,
          required_amount: partnerPrice,
          currency: "GHS",
        });
      }

      const creds = await resolveGmailCredentials(supabase);
      const emailToUse = creds.netflixEmail || "stillmoving11@gmail.com";

      const reference = generatePartnerReference();
      const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();

      let orderNotes = `[partner:${partnerId}:${partnerName}]`;
      if (partnerReference) orderNotes += ` PartnerRef: ${partnerReference}`;
      if (customerName) orderNotes = `[name:${customerName}] ${orderNotes}`;
      if (expiresAt) orderNotes = `[netflix_login_expires_at:${expiresAt}] ${orderNotes}`;
      if (body?.notes) orderNotes += ` Notes: ${String(body.notes).slice(0, 100)}`;

      const { data: newOrder, error: insertErr } = await supabase
        .from("service_orders")
        .insert({
          service: "netflix",
          service_type: "netflix",
          reference,
          amount: partnerPrice,
          status: "paid",
          delivery_status: "active",
          customer_phone: customerPhone || null,
          customer_email: customerEmail || null,
          notes: orderNotes.trim(),
          created_at: new Date().toISOString(),
        })
        .select("*")
        .single();

      if (insertErr) {
        return res.status(500).json({
          status: "error",
          error: insertErr.message || "Failed to create Netflix access order.",
        });
      }

      // Deduct from partner wallet balance
      const remainingBalance = Math.max(0, Number((partnerWallet - partnerPrice).toFixed(2)));
      if (partnerId !== "default" && Array.isArray(partnersList) && partnersList.length > 0) {
        const idx = partnersList.findIndex((p: any) => p && (p.id === partnerId || cleanApiKey(p.api_key || p.key) === providedKey));
        if (idx !== -1) {
          partnersList[idx].wallet_balance = remainingBalance;
          partnersList[idx].total_orders = (partnersList[idx].total_orders || 0) + 1;
          await supabase
            .from("settings")
            .upsert({ key: "netflix_partners", value: JSON.stringify(partnersList) }, { onConflict: "key" });
          if (cleanApiKey(sMap["netflix_partner_api_key"]) === providedKey || partnersList[idx].id === "partner_1") {
            await supabase
              .from("settings")
              .upsert({ key: "netflix_partner_wallet", value: String(remainingBalance) }, { onConflict: "key" });
          }
        }
      } else {
        await supabase
          .from("settings")
          .upsert({ key: "netflix_partner_wallet", value: String(remainingBalance) }, { onConflict: "key" });
      }

      return res.status(201).json({
        status: "success",
        message: "Netflix 30-Day access created successfully.",
        order: {
          reference: newOrder.reference,
          partner_reference: partnerReference || null,
          netflix_email: emailToUse,
          status: "active",
          duration_days: durationDays,
          expires_at: expiresAt,
          remaining_wallet_balance: remainingBalance,
          created_at: newOrder.created_at,
          instructions: [
            `1. Go to Netflix app or visit https://netflix.com`,
            `2. Sign in with the account email: ${emailToUse}`,
            `3. Click 'Send sign-in code'`,
            `4. Call the fetch-code endpoint using reference "${newOrder.reference}" to retrieve the sign-in code.`,
          ],
        },
      });
    }

    // 5. ACTION: FETCH NETFLIX SIGN-IN CODE
    if (action === "fetch-code" || action === "code") {
      const reference = String(body?.reference || req.query?.reference || "").trim();
      if (!reference) {
        return res.status(400).json({
          status: "error",
          error: "Missing required 'reference' parameter.",
        });
      }

      // Query order
      const { data: order } = await supabase
        .from("service_orders")
        .select("*")
        .eq("reference", reference)
        .maybeSingle();

      if (!order) {
        return res.status(404).json({
          status: "error",
          error: `Order with reference '${reference}' not found.`,
        });
      }

      if (order.service !== "netflix") {
        return res.status(400).json({
          status: "error",
          error: "The provided reference is not a Netflix order.",
        });
      }

      // Verify payment status
      const isConfirmed =
        ["paid", "success", "completed"].includes(String(order.payment_status || "").toLowerCase()) ||
        ["active", "delivered", "completed"].includes(String(order.delivery_status || "").toLowerCase()) ||
        Boolean(order.netflix_last_code);

      if (!isConfirmed) {
        return res.status(402).json({
          status: "error",
          error: "Payment has not been confirmed for this order.",
        });
      }

      // Check 30-day expiration
      if (order.netflix_login_expires_at && new Date(order.netflix_login_expires_at) < new Date()) {
        return res.status(410).json({
          status: "expired",
          error: "Your 30-day Netflix access has expired. Please create a new order.",
          expires_at: order.netflix_login_expires_at,
        });
      }

      const forceRefresh = body?.force === true || req.query?.force === "true";
      const creds = await resolveGmailCredentials(supabase);
      const emailToUse = creds.netflixEmail || "stillmoving11@gmail.com";

      // If code was recently fetched (within last 15 minutes) and not forcing refresh, return immediately
      if (order.netflix_last_code && !forceRefresh) {
        const lastCodeTime = order.netflix_last_code_at ? new Date(order.netflix_last_code_at).getTime() : 0;
        const isFresh = Date.now() - lastCodeTime < 15 * 60 * 1000;
        if (isFresh) {
          return res.status(200).json({
            status: "success",
            code: order.netflix_last_code,
            netflix_email: emailToUse,
            reference: order.reference,
            retrieved_at: order.netflix_last_code_at,
            cached: true,
            expires_in: "15 minutes",
            message: "Sign-in code retrieved successfully. Enter this code on Netflix.",
          });
        }
      }

      // Check if Gmail is linked
      if (!creds.accessToken) {
        if (order.netflix_last_code) {
          return res.status(200).json({
            status: "success",
            code: order.netflix_last_code,
            netflix_email: emailToUse,
            reference: order.reference,
            retrieved_at: order.netflix_last_code_at,
            cached: true,
            message: "Sign-in code retrieved successfully.",
          });
        }
        return res.status(503).json({
          status: "unavailable",
          code: null,
          error: "Gmail reader is currently not connected by the provider. Please contact support.",
          retryable: false,
        });
      }

      // Query Gmail messages for Netflix emails from last 1 day
      const requestHeaders = {
        Authorization: `Bearer ${creds.accessToken}`,
        Accept: "application/json",
      };

      const q = "from:netflix.com newer_than:1d";
      const listRes = await fetch(
        `${GMAIL_BASE}/users/me/messages?maxResults=8&q=${encodeURIComponent(q)}`,
        { headers: requestHeaders }
      );

      if (!listRes.ok) {
        if (order.netflix_last_code) {
          return res.status(200).json({
            status: "success",
            code: order.netflix_last_code,
            netflix_email: emailToUse,
            reference: order.reference,
            retrieved_at: order.netflix_last_code_at,
            cached: true,
            message: "Sign-in code retrieved successfully.",
          });
        }
        return res.status(502).json({
          status: "error",
          code: null,
          error: "Unable to query Netflix mailbox at this moment. Please try again in 30 seconds.",
          retryable: true,
        });
      }

      const listData = await listRes.json().catch(() => ({}));
      const msgs = listData.messages || [];

      if (!msgs.length) {
        if (order.netflix_last_code) {
          return res.status(200).json({
            status: "success",
            code: order.netflix_last_code,
            netflix_email: emailToUse,
            reference: order.reference,
            retrieved_at: order.netflix_last_code_at,
            cached: true,
            message: "Sign-in code retrieved successfully.",
          });
        }
        return res.status(200).json({
          status: "pending",
          code: null,
          error: `No recent sign-in code email found in mailbox. Enter "${emailToUse}" on Netflix, click 'Send sign-in code', wait 20 seconds, and request again.`,
          retryable: true,
          netflix_email: emailToUse,
        });
      }

      let bestCode: string | null = null;
      let bestDate = 0;

      for (const m of msgs.slice(0, 6)) {
        const gRes = await fetch(`${GMAIL_BASE}/users/me/messages/${m.id}?format=full`, {
          headers: requestHeaders,
        });
        if (!gRes.ok) continue;
        const g = await gRes.json().catch(() => null);
        if (!g) continue;

        const internalDate = Number(g.internalDate || 0);
        // Look within the last 2 hours
        if (internalDate && Date.now() - internalDate > 2 * 60 * 60 * 1000) continue;

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
        }
      }

      if (!bestCode) {
        if (order.netflix_last_code) {
          return res.status(200).json({
            status: "success",
            code: order.netflix_last_code,
            netflix_email: emailToUse,
            reference: order.reference,
            retrieved_at: order.netflix_last_code_at,
            cached: true,
            message: "Sign-in code retrieved successfully.",
          });
        }
        return res.status(200).json({
          status: "pending",
          code: null,
          error: `Sign-in code not found in recent emails. Click 'Send code' on Netflix with ${emailToUse}, wait 25 seconds, and try again.`,
          retryable: true,
          netflix_email: emailToUse,
        });
      }

      // Save the latest code
      const codeTimestamp = new Date().toISOString();
      let pNotes = setNoteTag(order.notes, "netflix_code", bestCode);
      pNotes = setNoteTag(pNotes, "netflix_code_at", codeTimestamp);
      await supabase
        .from("service_orders")
        .update({
          delivery_status: "active",
          notes: pNotes,
        })
        .eq("reference", reference);

      return res.status(200).json({
        status: "success",
        code: bestCode,
        netflix_email: emailToUse,
        reference: order.reference,
        retrieved_at: codeTimestamp,
        expires_in: "15 minutes",
        message: "Sign-in code retrieved successfully. Enter this code on Netflix to complete sign-in.",
      });
    }

    // 6. ACTION: CHECK STATUS OF NETFLIX ACCESS
    if (action === "status" || action === "order-status") {
      const reference = String(body?.reference || req.query?.reference || "").trim();
      if (!reference) {
        return res.status(400).json({ status: "error", error: "Missing required 'reference' parameter." });
      }

      const { data: rawOrder } = await supabase
        .from("service_orders")
        .select("*")
        .eq("reference", reference)
        .maybeSingle();

      const order = enrichServiceOrder(rawOrder);

      if (!order) {
        return res.status(404).json({ status: "error", error: "Order not found." });
      }

      const isExpired = order.netflix_login_expires_at && new Date(order.netflix_login_expires_at) < new Date();
      let daysRemaining = 0;
      if (order.netflix_login_expires_at && !isExpired) {
        const diffMs = new Date(order.netflix_login_expires_at).getTime() - Date.now();
        daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
      }

      return res.status(200).json({
        status: "success",
        reference: order.reference,
        service: order.service,
        is_active: !isExpired && (order.payment_status === "paid" || order.delivery_status === "active"),
        is_expired: isExpired,
        expires_at: order.netflix_login_expires_at,
        days_remaining: daysRemaining,
        last_code_at: order.netflix_last_code_at || null,
        created_at: order.created_at,
      });
    }

    return res.status(400).json({
      status: "error",
      error: `Unknown action '${action}'. Supported actions: 'info', 'create-order', 'fetch-code', 'status'.`,
    });
  } catch (err: any) {
    console.error("Partner API error:", err);
    return res.status(500).json({
      status: "error",
      error: err?.message || "Internal server error occurred.",
    });
  }
}
