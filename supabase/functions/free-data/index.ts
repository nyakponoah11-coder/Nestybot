import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-function-name",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function cleanGhanaPhone(p: string): string {
  let clean = String(p || "").replace(/\D/g, "");
  if (clean.startsWith("233") && clean.length === 12) {
    clean = "0" + clean.slice(3);
  } else if (clean.length === 9) {
    clean = "0" + clean;
  }
  return clean;
}

function mapNetworkToDatamart(net: string): string {
  const upper = String(net || "MTN").toUpperCase().trim();
  if (upper.includes("TELECEL") || upper.includes("VODA")) return "TELECEL";
  if (upper.includes("AIRTEL") || upper.includes("TIGO") || upper.includes("AT")) return "AT_PREMIUM";
  return "YELLO";
}

function extractCapacityValue(cap: string): string {
  const match = String(cap || "1").match(/\d+(\.\d+)?/);
  return match ? match[0] : "1";
}

function generateVoucherCode(prefix = "FD"): string {
  let res = prefix;
  for (let i = 0; i < 8; i++) {
    res += CODE_CHARS.charAt(Math.floor(Math.random() * CODE_CHARS.length));
  }
  return res;
}

async function getAllDatamartKeys(admin: any): Promise<string[]> {
  const keys: string[] = [];
  const add = (v: any) => {
    if (typeof v === "string") {
      const c = v.trim().replace(/^["']|["']$/g, "");
      if (c && c.length > 5 && !keys.includes(c)) keys.push(c);
    }
  };

  [
    Deno.env.get("DATA_API_KEY"),
    Deno.env.get("DATAMART_API_KEY"),
    Deno.env.get("DATAMART_KEY"),
    Deno.env.get("DM_API_KEY"),
    Deno.env.get("SUPPLIER_API_KEY"),
  ].forEach(add);

  try {
    const { data: rows } = await admin
      .from("settings")
      .select("key, value")
      .in("key", ["datamart_api_key", "DATA_API_KEY", "datamart_key", "dm_api_key", "data_api_key"]);
    for (const r of rows || []) {
      add(r?.value);
    }
  } catch {}

  return keys;
}

async function fetchDatamartBalance(apiKey: string): Promise<number | null> {
  if (!apiKey) return null;
  const urls = [
    "https://api.datamartgh.shop/api/developer/wallet-balance",
    "https://api.datamartgh.shop/api/developer/balance",
    "https://api.datamartgh.shop/api/balance",
    "https://api.datamartgh.shop/api/developer/user/balance",
  ];
  for (const url of urls) {
    try {
      let res = await fetch(url, {
        headers: { "X-API-Key": apiKey, Accept: "application/json" },
      });
      if (!res.ok) {
        res = await fetch(url, {
          headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
        });
      }
      if (res.ok) {
        const j = await res.json();
        const bal = j.balance ?? j.data?.balance ?? j.wallet?.balance ?? j.data?.wallet_balance;
        if (typeof bal === "number") return bal;
        if (typeof bal === "string" && !isNaN(Number(bal))) return Number(bal);
      }
    } catch (_) {}
  }
  return null;
}

async function getAllDatamartSecrets(admin: any): Promise<string[]> {
  const secrets: string[] = [];
  const add = (v: any) => {
    if (typeof v === "string") {
      const c = v.trim().replace(/^["']|["']$/g, "");
      if (c && c.length > 2 && !secrets.includes(c)) secrets.push(c);
    }
  };

  [
    Deno.env.get("DATAMART_API_SECRET"),
    Deno.env.get("DATAMART_SECRET"),
    Deno.env.get("DATAMART_SECRET_KEY"),
    Deno.env.get("DATAMART_API_SECRET_KEY"),
    Deno.env.get("DM_API_SECRET"),
    Deno.env.get("DM_SECRET"),
    Deno.env.get("DM_SECRET_KEY"),
    Deno.env.get("VITE_DATAMART_API_SECRET"),
    Deno.env.get("VITE_DATAMART_SECRET"),
    Deno.env.get("NEXT_PUBLIC_DATAMART_API_SECRET"),
    Deno.env.get("datamart_api_secret"),
    Deno.env.get("datamart_secret"),
    Deno.env.get("X_API_SECRET"),
    Deno.env.get("x_api_secret"),
  ].forEach(add);

  try {
    const { data: rows } = await admin
      .from("settings")
      .select("key, value")
      .in("key", [
        "datamart_api_secret",
        "DATAMART_API_SECRET",
        "datamart_secret",
        "DATAMART_SECRET",
        "datamart_secret_key",
        "DATAMART_SECRET_KEY",
        "dm_api_secret",
        "DM_API_SECRET",
        "dm_secret",
        "DM_SECRET",
      ]);
    for (const r of rows || []) {
      add(r?.value);
    }
  } catch {}

  return secrets;
}

async function getDatamartSecretKey(admin: any): Promise<string> {
  const all = await getAllDatamartSecrets(admin);
  return all[0] || "";
}

async function deliverViaDatamart(
  admin: any,
  phone: string,
  network: string,
  capacity: string,
  reference: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  const cleanPhone = cleanGhanaPhone(phone);
  const dmNetwork = mapNetworkToDatamart(network);
  const dmCapacity = extractCapacityValue(capacity);

  // Reference going to DataMart MUST strictly start with WS-
  const rawRef = String(reference || "").trim();
  const cleanRef = rawRef.replace(/^WS[-_]?/i, "");
  const dmRef = `WS-${cleanRef || Math.random().toString(36).slice(2, 10).toUpperCase()}`;

  const payload = {
    phoneNumber: cleanPhone,
    network: dmNetwork,
    capacity: dmCapacity,
    gateway: "wallet",
    delivery: "fast",
    ref: dmRef,
  };

  const keys = await getAllDatamartKeys(admin);
  if (keys.length === 0) {
    return { success: false, error: "No DataMart API key configured in settings or environment." };
  }

  const secrets = await getAllDatamartSecrets(admin);
  let lastError = "DataMart delivery failed";
  const url = "https://api.datamartgh.shop/api/developer/purchase";

  for (const key of keys) {
    const secretCandidates = secrets.length > 0 ? secrets : [""];

    for (const secret of secretCandidates) {
      const headers: Record<string, string> = {
        "x-api-key": key,
        "X-Idempotency-Key": dmRef,
        "Content-Type": "application/json",
        Accept: "application/json",
      };
      if (secret) {
        headers["x-api-secret"] = secret;
      }

      try {
        let dmRes = await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
        });

        let dmData = await dmRes.json().catch(() => ({}));
        let isSuccess =
          dmRes.ok &&
          (dmData.status === "success" ||
            dmData.success === true ||
            dmData.data?.orderStatus === "completed" ||
            dmData.data?.purchaseId);

        if (!isSuccess && (dmRes.status === 401 || String(dmData?.message || "").toLowerCase().includes("token") || String(dmData?.message || "").toLowerCase().includes("key"))) {
          const retryHeaders: Record<string, string> = {
            Authorization: `Bearer ${key}`,
            "x-api-key": key,
            "X-Idempotency-Key": dmRef,
            "Content-Type": "application/json",
            Accept: "application/json",
          };
          if (secret) {
            retryHeaders["x-api-secret"] = secret;
          }

          const retryRes = await fetch(url, {
            method: "POST",
            headers: retryHeaders,
            body: JSON.stringify(payload),
          });
          const retryData = await retryRes.json().catch(() => ({}));
          if (
            retryRes.ok &&
            (retryData.status === "success" ||
              retryData.success === true ||
              retryData.data?.orderStatus === "completed" ||
              retryData.data?.purchaseId)
          ) {
            return { success: true, data: retryData };
          }
          if (retryData.message || retryData.error) {
            dmData = retryData;
          }
        }

        if (isSuccess) return { success: true, data: dmData };
        const msg = dmData.message || dmData.error || dmData.data?.message;
        if (msg) {
          const lower = String(msg).toLowerCase();
          if (lower.includes("secret header did not match")) {
            lastError = "The DataMart API Secret did not match. Please verify your DataMart API Secret in Admin Settings.";
          } else if (lower.includes("requires a second secret")) {
            lastError = "This DataMart key requires an API Secret. Please enter your DataMart API Secret in Admin Settings.";
          } else {
            lastError = msg;
          }
        } else if (dmRes.status === 400 || dmRes.status === 401 || dmRes.status === 403 || dmRes.status === 500) {
          lastError = `DataMart request failed with status ${dmRes.status}`;
        }
      } catch (err: any) {
        lastError = err?.message || "DataMart connection failed";
      }
    }
  }

      if (isSuccess) return { success: true, data: dmData };
      const msg = dmData.message || dmData.error || dmData.data?.message;
      if (msg) {
        const lower = String(msg).toLowerCase();
        if (lower.includes("secret header did not match")) {
          lastError = "The DataMart API Secret did not match. Please verify your DataMart API Secret in Admin Settings.";
        } else if (lower.includes("requires a second secret")) {
          lastError = "This DataMart key requires an API Secret. Please enter your DataMart API Secret in Admin Settings.";
        } else {
          lastError = msg;
        }
      } else if (dmRes.status === 400 || dmRes.status === 401 || dmRes.status === 403 || dmRes.status === 500) {
        lastError = `DataMart request failed with status ${dmRes.status}`;
      }
    } catch (err: any) {
      lastError = err?.message || "DataMart connection failed";
    }
  }

  return { success: false, error: lastError };
}

// CRITICAL: DataMart "orderStatus": "completed" only means DataMart received and
// debited the order — it does NOT mean data was delivered to the SIM.
// Only "delivered" means the data has actually arrived on the recipient's line.
function mapDatamartDeliveryStatus(rawStatus: string): string {
  const v = (rawStatus || "").toLowerCase().trim();
  if (v === "delivered") return "delivered";
  if (v === "failed" || v === "failure" || v === "cancelled" || v === "canceled" || v === "rejected" || v === "declined") return "failed";
  if (v === "refunded") return "refunded";
  if (v === "waiting") return "waiting";
  return "processing";
}

// Queries Datamart's order-status endpoint for the REAL delivery status.
// 200 OK / "completed" on the purchase response only means payment was accepted
// by DataMart, NOT that data was delivered. This function checks the actual
// order-status endpoint to get the true delivery status.
async function checkRealDeliveryStatus(
  orderId: string,
  apiKey: string
): Promise<{ deliveryStatus: string; rawStatus: string | null; datamart_reference: string | null; error: string | null }> {
  if (!apiKey || !orderId) {
    return { deliveryStatus: "processing", rawStatus: null, datamart_reference: orderId || null, error: null };
  }

  const urls = [
    `${DATAMART_BASE}/order-status/${encodeURIComponent(orderId)}`,
    `https://api.datamartgh.shop/api/order-status/${encodeURIComponent(orderId)}`,
    `${DATAMART_BASE}/orders/${encodeURIComponent(orderId)}`,
    `https://api.datamartgh.shop/api/orders/${encodeURIComponent(orderId)}`,
  ];

  for (const url of urls) {
    try {
      let res = await fetch(url, {
        headers: { "X-API-Key": apiKey, Accept: "application/json" },
      });
      if (!res.ok && res.status === 401) {
        res = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" } });
      }
      if (res.ok) {
        const j = await res.json().catch(() => null);
        const d = j?.data && typeof j.data === "object" ? j.data : j;
        let rawStatus = d?.orderStatus || d?.order_status || d?.deliveryStatus || d?.delivery_status || d?.relatedPurchase?.orderStatus || d?.status;
        if (rawStatus && !["success", "ok", "true", "false"].includes(String(rawStatus).toLowerCase().trim())) {
          const dmRef = d?.orderReference || d?.reference || d?.orderId || d?.purchaseId || d?.trackingId || orderId;
          const dmStatus = String(rawStatus).toLowerCase().trim();
          return {
            deliveryStatus: mapDatamartDeliveryStatus(dmStatus),
            rawStatus: dmStatus,
            datamart_reference: dmRef,
            error: d?.failureReason || d?.message || j?.message || null,
          };
        }
      }
    } catch {}
  }

  return { deliveryStatus: "processing", rawStatus: null, datamart_reference: orderId, error: "Could not query DataMart status" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json().catch(() => ({}));
    const action = body?.action || "getOverview";

    // 1. Customer Action: Claim a code
    if (action === "claimCode") {
      const inputCode = String(body.code || "").trim().toUpperCase();
      const phone = cleanGhanaPhone(body.phone || "");

      if (!inputCode) return json({ error: "Please enter your Free Data code" }, 400);
      if (!/^(0\d{9}|233\d{9})$/.test(phone)) return json({ error: "Please enter a valid Ghana phone number" }, 400);

      const { data: voucher } = await admin
        .from("free_data_codes")
        .select("*")
        .eq("code", inputCode)
        .maybeSingle();

      if (!voucher) {
        return json({ error: "Invalid Free Data code." }, 404);
      }

      if (voucher.is_claimed || voucher.claimed) {
        return json({ error: "This Free Data code has already been claimed!", isClaimed: true }, 400);
      }

      if (voucher.expires_at && new Date(voucher.expires_at).getTime() < Date.now()) {
        return json({ error: "This Free Data code has expired." }, 400);
      }

      const nowStr = new Date().toISOString();
      const { data: updated } = await admin
        .from("free_data_codes")
        .update({
          is_claimed: true,
          claimed: true,
          claimed_by_phone: phone,
          claimed_at: nowStr,
          delivery_status: "pending",
        })
        .eq("id", voucher.id)
        .select("*")
        .maybeSingle();

      return json({ ok: true, message: "Free data successfully claimed!", voucher: updated });
    }

    // --- Admin Authentication Check ---
    const authHeader = req.headers.get("Authorization");
    let isAuthorized = false;
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const userClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const { data: userData } = await userClient.auth.getUser(token);
      if (userData?.user) {
        const isOwner = userData.user.email?.toLowerCase() === "stillmoving11@gmail.com";
        if (isOwner) {
          isAuthorized = true;
        } else {
          const { data: roleRow } = await admin.from("user_roles")
            .select("id").eq("user_id", userData.user.id).eq("role", "admin").maybeSingle();
          if (roleRow) isAuthorized = true;
        }
        if (isAuthorized) {
          await admin.from("user_roles").upsert({ user_id: userData.user.id, role: "admin" }, { onConflict: "user_id,role" }).catch(() => {});
        }
      }
    }

    if (!isAuthorized) {
      return json({ error: "Unauthorized: Admin access required" }, 401);
    }

    // 2. Admin Action: Overview
    if (action === "getOverview") {
      let codes: any[] = [];
      const [codesRes, settingRes] = await Promise.all([
        admin.from("free_data_codes").select("*").order("created_at", { ascending: false }).limit(2000),
        admin.from("settings").select("value").eq("key", "free_data_enabled").maybeSingle(),
      ]);

      if (codesRes.data) {
        codes = codesRes.data;
      } else {
        const { data: scratchData } = await admin.from("scratch_codes").select("*").order("id", { ascending: false }).limit(1000);
        if (scratchData) codes = scratchData;
      }

      const keys = await getAllDatamartKeys(admin);
      const balance = keys[0] ? await fetchDatamartBalance(keys[0]) : null;

      const normalizedCodes = codes.map((c: any) => {
        const isClaimed = !!(
          c.is_claimed ??
          c.claimed ??
          c.scratched ??
          (c.status === "claimed" || c.status === "used" || c.status === "processing" || !!c.claimed_by_phone || !!c.assigned_to)
        );
        return {
          id: String(c.id || c.code),
          code: String(c.code || "").toUpperCase(),
          capacity: String(c.capacity || (c.prize ? `${c.prize}GB` : "1GB")),
          network: String(c.network || c.prize_network || "MTN").toUpperCase(),
          expires_at: c.expires_at || null,
          is_claimed: isClaimed,
          claimed_by_phone: c.claimed_by_phone || c.assigned_to || c.phone || c.customer_phone || null,
          claimed_at: c.claimed_at || c.scratched_at || (isClaimed ? c.created_at : null),
          delivery_status: c.delivery_status || (c.status === "used" || c.datamart_ref ? "delivered" : "pending"),
          datamart_ref: c.datamart_ref || c.datamart_reference || null,
          notes: c.notes || null,
          created_at: c.created_at || new Date().toISOString(),
        };
      });

      return json({
        enabled: settingRes.data?.value === "true",
        codes: normalizedCodes,
        balance,
        hasApiKey: keys.length > 0,
        tableExists: true,
      });
    }

    // 3. Admin Action: Toggle Storefront
    if (action === "toggleStorefront") {
      const enabled = !!body.enabled;
      await admin.from("settings").upsert({ key: "free_data_enabled", value: enabled ? "true" : "false" }, { onConflict: "key" });
      return json({ ok: true, enabled });
    }

    // 4. Admin Action: Generate Codes
    if (action === "generateCodes") {
      const capacity = String(body.capacity || "1GB").trim().toUpperCase();
      const network = String(body.network || "MTN").trim().toUpperCase();
      const count = Math.min(Math.max(Number(body.count) || 1, 1), 100);
      const expiresInHours = Number(body.expires_in_hours);

      let expiresAt: string | null = null;
      if (Number.isFinite(expiresInHours) && expiresInHours > 0) {
        expiresAt = new Date(Date.now() + expiresInHours * 3600 * 1000).toISOString();
      }

      const rows: any[] = [];
      const codeSet = new Set<string>();
      while (rows.length < count) {
        const code = generateVoucherCode("FD");
        if (!codeSet.has(code)) {
          codeSet.add(code);
          rows.push({
            code,
            capacity,
            network,
            expires_at: expiresAt,
            is_claimed: false,
            delivery_status: "pending",
            created_at: new Date().toISOString(),
          });
        }
      }

      let insertedRows: any[] = [];
      const { data: insData, error: insErr } = await admin.from("free_data_codes").insert(rows).select("*");
      if (!insErr && insData) {
        insertedRows = insData;
      } else {
        const altRows = rows.map((r) => ({ ...r, claimed: false }));
        const { data: altData } = await admin.from("free_data_codes").insert(altRows).select("*");
        insertedRows = altData || rows;
      }

      return json({ ok: true, generatedCount: insertedRows.length, codes: insertedRows });
    }

    // 5. Admin Action: Direct Purchase
    if (action === "directPurchase") {
      const phone = cleanGhanaPhone(body.phoneNumber || body.phone || "");
      const network = String(body.network || "MTN").toUpperCase();
      const capacity = String(body.capacity || "1GB");

      if (!/^(0\d{9}|233\d{9})$/.test(phone)) return json({ error: "Invalid phone number" }, 400);

      const ref = `WS-DIR-${Date.now().toString(36).slice(-4)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
      const outcome = await deliverViaDatamart(admin, phone, network, capacity, ref);

      if (outcome.success) {
        return json({
          ok: true,
          message: `Successfully sent ${capacity} ${network} to ${phone}`,
          data: outcome.data,
          ref,
        });
      }

      return json({ error: outcome.error || "Direct purchase failed on DataMart" }, 400);
    }

    // 6. Admin Action: Bulk Deliver
    if (action === "bulkDeliverDataMart") {
      const ids = Array.isArray(body.ids) ? body.ids : null;
      let { data: allVouchers } = await admin.from("free_data_codes").select("*");
      if (!allVouchers) allVouchers = [];

      let pending = allVouchers.filter((v: any) => (v.is_claimed || v.claimed) && v.delivery_status === "pending");
      if (ids && ids.length > 0) {
        const idSet = new Set(ids);
        pending = pending.filter((v: any) => idSet.has(v.id));
      }

      const results: any[] = [];
      const keys = await getAllDatamartKeys(admin);
      const apiKey = keys[0] || "";
      for (const v of pending) {
        const ref = `WS-FD-${Date.now().toString(36).slice(-4)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
        const outcome = await deliverViaDatamart(admin, v.claimed_by_phone, v.network || "MTN", v.capacity || "1GB", ref);
        if (outcome.success) {
          // DataMart 200/completed only means the order was accepted — NOT delivered.
          // Set to "processing" and verify the real delivery status.
          const dmRef = outcome.data?.data?.purchaseId || outcome.data?.orderId || ref;
          let deliveryStatus = "processing";
          if (dmRef && apiKey) {
            const realStatus = await checkRealDeliveryStatus(String(dmRef), apiKey);
            if (realStatus.rawStatus) {
              deliveryStatus = realStatus.deliveryStatus;
            }
          }
          await admin.from("free_data_codes").update({
            delivery_status: deliveryStatus,
            datamart_ref: dmRef,
          }).eq("id", v.id);
          results.push({ id: v.id, status: deliveryStatus, ref });
        } else {
          await admin.from("free_data_codes").update({
            delivery_status: "failed",
            notes: outcome.error || "DataMart dispatch error",
          }).eq("id", v.id);
          results.push({ id: v.id, status: "failed", error: outcome.error });
        }
      }

      const deliveredCount = results.filter((r) => r.status === "delivered").length;
      return json({ ok: true, delivered: deliveredCount, failed: results.length - deliveredCount, results });
    }

    // 7. Admin Action: Delete code
    if (action === "deleteCode") {
      await admin.from("free_data_codes").delete().eq("id", body.id);
      return json({ ok: true });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (err: any) {
    return json({ error: err?.message || "Internal server error" }, 500);
  }
});
