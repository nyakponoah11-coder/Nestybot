import { createClient } from "@supabase/supabase-js";
import { verifyAdminUser, getEnvVar, cleanApiKey, getSupabase as getSharedSupabase, getRemoteSupabaseClient, data1db } from "./_supabase.js";
import { detectAndBlockIntrusion } from "./_firewall.js";
import { checkAndAlertLowDatamartBalance, sendAdminSpinWinnerAlert } from "./_notifications.js";

function mapScratchToSpinWin(row: any) {
  if (!row || !row.code) return null;
  const code = String(row.code).trim().toUpperCase();
  const prizeCap = String(row.prize_capacity || row.prize || "1").replace(/[^\d]/g, "") || "1";
  const ordersCount = Number(row.orders_count ?? row.orders_completed ?? 0);
  const rewardSent = Boolean(row.reward_sent || row.status === "used" || row.delivered_at);
  return {
    id: String(row.id || `scratch_${code}`),
    code,
    owner_phone: cleanGhanaPhone(row.owner_phone || row.assigned_to || ""),
    prize_capacity: prizeCap,
    orders_count: ordersCount,
    reward_sent: rewardSent,
    reward_reference: row.reward_reference || row.datamart_reference || null,
    reward_sent_at: row.reward_sent_at || row.delivered_at || null,
    created_at: row.created_at || new Date().toISOString(),
  };
}

async function persistSpinBackup(admin: any, remote: any) {
  try {
    const wins = data1db.loadTable("spin_wins").slice(0, 150);
    const reds = data1db.loadTable("spin_redemptions").slice(0, 250);
    const payload = JSON.stringify({ wins, redemptions: reds });
    await admin.from("settings").upsert({ key: "spin_wins_backup", value: payload }, { onConflict: "key" });
    if (remote) {
      await remote.from("settings").upsert({ key: "spin_wins_backup", value: payload }, { onConflict: "key" });
    }
  } catch (_) {}
}

async function hydrateSpinData(admin: any, force = false) {
  const remote = getRemoteSupabaseClient(true);
  if (remote && (force || !data1db.isTableHydrated("spin_wins", 120000))) {
    try {
      const [winsRes, redsRes, scratchRes, countsRes, settingsRes] = await Promise.all([
        remote.from("spin_wins").select("code, phone, prize, reward_sent, created_at").order("created_at", { ascending: false }).limit(40),
        remote.from("spin_redemptions").select("id, code, phone, network, status, created_at").order("created_at", { ascending: false }).limit(40),
        remote.from("scratch_codes").select("code, prize, status, used_by_phone, created_at").order("created_at", { ascending: false }).limit(40),
        remote.from("scratch_order_counts").select("phone, order_count, updated_at").order("created_at", { ascending: false }).limit(40),
        remote.from("settings").select("key,value").in("key", ["spin_game_enabled", "spin_wins_backup"]),
      ]);

      for (const s of settingsRes?.data || []) {
        if (s?.key === "spin_game_enabled") {
          data1db.upsert("settings", { key: "spin_game_enabled", value: s.value }, "key");
        } else if (s?.key === "spin_wins_backup" && s.value) {
          try {
            const parsed = JSON.parse(s.value);
            if (Array.isArray(parsed?.wins)) {
              for (const w of parsed.wins) {
                if (w?.code) data1db.upsert("spin_wins", w, "code");
              }
            }
            if (Array.isArray(parsed?.redemptions)) {
              for (const r of parsed.redemptions) {
                if (r?.id) data1db.upsert("spin_redemptions", r, "id");
              }
            }
          } catch (_) {}
        }
      }

      for (const w of winsRes?.data || []) {
        const mapped = mapScratchToSpinWin(w);
        if (mapped) data1db.upsert("spin_wins", mapped, "code");
      }
      for (const sc of scratchRes?.data || []) {
        const mapped = mapScratchToSpinWin(sc);
        if (mapped) data1db.upsert("spin_wins", mapped, "code");
      }
      for (const r of redsRes?.data || []) {
        if (r?.id) data1db.upsert("spin_redemptions", r, "id");
      }
      for (const c of countsRes?.data || []) {
        if (c?.scratch_code && c?.order_reference) {
          const matchWin = data1db.loadTable("spin_wins").find((w) => String(w.code).toUpperCase() === String(c.scratch_code).toUpperCase());
          const spinId = matchWin?.id || `scratch_${String(c.scratch_code).toUpperCase()}`;
          data1db.upsert(
            "spin_redemptions",
            {
              id: c.id || `sc_red_${c.scratch_code}_${c.order_reference}`,
              spin_id: spinId,
              order_reference: c.order_reference,
              buyer_phone: cleanGhanaPhone(c.customer_phone || ""),
              created_at: c.created_at || new Date().toISOString(),
            },
            "id"
          );
        }
      }
      data1db.markTableHydrated("spin_wins");
    } catch (_) {}
  }

  for (const sc of data1db.loadTable("scratch_codes")) {
    const mapped = mapScratchToSpinWin(sc);
    if (mapped) data1db.upsert("spin_wins", mapped, "code");
  }

  try {
    const { data: localBackup } = await admin.from("settings").select("value").eq("key", "spin_wins_backup").maybeSingle();
    if (localBackup?.value) {
      const parsed = JSON.parse(localBackup.value);
      if (Array.isArray(parsed?.wins)) {
        for (const w of parsed.wins) {
          if (w?.code) data1db.upsert("spin_wins", w, "code");
        }
      }
      if (Array.isArray(parsed?.redemptions)) {
        for (const r of parsed.redemptions) {
          if (r?.id) data1db.upsert("spin_redemptions", r, "id");
        }
      }
    }
  } catch (_) {}

  const wins = data1db.loadTable("spin_wins");
  const redemptions = data1db.loadTable("spin_redemptions");
  const { data: spinSetting } = await admin.from("settings").select("value").eq("key", "spin_game_enabled").maybeSingle();
  return {
    spin_wins: wins,
    spin_redemptions: redemptions,
    spin_game_enabled: (spinSetting?.value ?? "true") !== "false",
  };
}

function cleanGhanaPhone(raw: string): string {
  if (!raw) return "";
  let d = String(raw).replace(/\D/g, "");
  if (d.startsWith("233") && d.length === 12) d = "0" + d.slice(3);
  if (d.length === 9) d = "0" + d;
  return d;
}

function getSupabase() {
  return getSharedSupabase();
}

function setCorsHeaders(res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "authorization, x-client-info, apikey, content-type, x-function-name"
  );
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
}

function parseBody(req: any) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string" && req.body.trim()) {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return {};
}

// 10-character alphanumeric code generator (avoids ambiguous chars O, 0, I, 1)
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function generateVoucherCode(prefix = "FD"): string {
  let res = prefix;
  for (let i = 0; i < 8; i++) {
    res += CODE_CHARS.charAt(Math.floor(Math.random() * CODE_CHARS.length));
  }
  return res;
}

function mapNetworkToDatamart(net: string): string {
  const upper = String(net || "MTN").toUpperCase().trim();
  if (upper.includes("TELECEL") || upper.includes("VODA")) return "TELECEL";
  if (upper.includes("AIRTEL") || upper.includes("TIGO") || upper.includes("AT")) return "AT_PREMIUM";
  return "YELLO"; // MTN default on DataMart
}

function extractCapacityValue(cap: string): string {
  const match = String(cap || "1").match(/\d+(\.\d+)?/);
  return match ? match[0] : "1";
}

async function getAllDatamartKeys(admin: any): Promise<string[]> {
  const keys: string[] = [];
  const add = (v: any) => {
    const c = cleanApiKey(v);
    if (c && c.length > 5 && !keys.includes(c)) keys.push(c);
  };

  [
    process.env.DATA_API_KEY,
    process.env.DATAMART_API_KEY,
    process.env.DATAMART_KEY,
    process.env.DM_API_KEY,
    process.env.VITE_DATAMART_API_KEY,
    process.env.VITE_DATA_API_KEY,
    process.env.VITE_DM_API_KEY,
    process.env.SUPPLIER_API_KEY,
  ].forEach(add);

  try {
    const { data: rows } = await admin
      .from("settings")
      .select("key, value")
      .in("key", ["datamart_api_key", "DATA_API_KEY", "datamart_key", "dm_api_key", "data_api_key", "supplier_api_key"]);
    for (const r of rows || []) {
      add(r?.value);
    }
  } catch {}

  return keys;
}

async function getAllDatamartSecrets(admin: any): Promise<string[]> {
  const secrets: string[] = [];
  const add = (v: any) => {
    const c = cleanApiKey(v);
    if (c && c.length > 2 && !secrets.includes(c)) secrets.push(c);
  };

  [
    process.env.DATAMART_API_SECRET,
    process.env.DATAMART_SECRET,
    process.env.DATAMART_SECRET_KEY,
    process.env.DATAMART_API_SECRET_KEY,
    process.env.DM_API_SECRET,
    process.env.DM_SECRET,
    process.env.DM_SECRET_KEY,
    process.env.VITE_DATAMART_API_SECRET,
    process.env.VITE_DATAMART_SECRET,
    process.env.NEXT_PUBLIC_DATAMART_API_SECRET,
    process.env.datamart_api_secret,
    process.env.datamart_secret,
    process.env.datamart_secret_key,
    process.env.X_API_SECRET,
    process.env.x_api_secret,
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

async function getDatamartApiKey(admin: any): Promise<string> {
  const all = await getAllDatamartKeys(admin);
  return all[0] || "";
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
        const json = await res.json();
        const bal = json.balance ?? json.data?.balance ?? json.wallet?.balance ?? json.data?.wallet_balance;
        if (typeof bal === "number") return bal;
        if (typeof bal === "string" && !isNaN(Number(bal))) return Number(bal);
      }
    } catch (_) {}
  }
  return null;
}

async function deliverViaDatamart(
  apiKey: string,
  phone: string,
  network: string,
  capacity: string,
  reference: string,
  admin?: any
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

  const keys = admin ? await getAllDatamartKeys(admin) : [apiKey].filter(Boolean);
  if (apiKey && !keys.includes(apiKey)) keys.unshift(apiKey);

  if (keys.length === 0) {
    return { success: false, error: "No DataMart API key configured in settings or environment." };
  }

  const secrets = admin ? await getAllDatamartSecrets(admin) : [];
  let lastError = "DataMart delivery failed";
  const url = "https://api.datamartgh.shop/api/developer/purchase";

  for (const key of keys) {
    const secretCandidates = secrets.length > 0 ? secrets : [""];

    for (const secret of secretCandidates) {
      // NOTE: Only set 'x-api-secret' once to prevent Node fetch from joining them into comma-separated strings!
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

        // If 401 or token error, retry with Bearer token
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

        if (isSuccess) {
          return { success: true, data: dmData };
        }

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

  return { success: false, error: lastError };
}

// -------------------------------------------------------------
// Resilient Database Storage Adapter
// -------------------------------------------------------------

function isTableMissingError(err: any): boolean {
  if (!err) return false;
  const msg = String(err.message || "").toLowerCase();
  const code = String(err.code || "").toUpperCase();
  return (
    code === "PGRST205" ||
    code === "42P01" ||
    msg.includes("free_data_codes") ||
    msg.includes("schema cache") ||
    msg.includes("relation") ||
    msg.includes("not find the table")
  );
}

async function getStoredCodesFromSettings(admin: any): Promise<any[]> {
  try {
    const { data } = await admin
      .from("settings")
      .select("value")
      .eq("key", "free_data_codes_store")
      .maybeSingle();

    if (!data?.value) return [];
    const parsed = JSON.parse(data.value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveStoredCodesToSettings(admin: any, codes: any[]): Promise<void> {
  await admin
    .from("settings")
    .upsert(
      { key: "free_data_codes_store", value: JSON.stringify(codes.slice(0, 1000)) },
      { onConflict: "key" }
    );
}

async function fetchAllVouchers(admin: any): Promise<{ codes: any[]; tableExists: boolean }> {
  let tableCodes: any[] = [];
  let tableExists = false;
  try {
    const { data, error } = await admin
      .from("free_data_codes")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(80);

    if (!error && Array.isArray(data)) {
      tableCodes = data;
      tableExists = true;
    }
  } catch {}

  // If tableCodes has few/no rows, also check legacy scratch_codes
  let scratchRows: any[] = [];
  try {
    const { data } = await admin
      .from("scratch_codes")
      .select("*")
      .order("id", { ascending: false })
      .limit(60);
    if (data && Array.isArray(data)) {
      scratchRows = data;
    }
  } catch {}

  const fallback = await getStoredCodesFromSettings(admin);

  const normalizeRow = (c: any) => {
    const isClaimed = !!(
      c.is_claimed ??
      c.claimed ??
      c.scratched ??
      (c.status === "claimed" || c.status === "used" || c.status === "processing" || !!c.claimed_by_phone || !!c.assigned_to)
    );
    const claimedPhone = c.claimed_by_phone || c.assigned_to || c.phone || c.customer_phone || c.prize_phone || null;
    let delivStatus = c.delivery_status || (c.status === "used" || c.datamart_ref || c.datamart_reference ? "delivered" : isClaimed ? "pending" : "pending");
    return {
      id: String(c.id || c.code),
      code: String(c.code || "").toUpperCase(),
      capacity: String(c.capacity || (c.prize ? `${c.prize}GB` : "1GB")),
      network: String(c.network || c.prize_network || "MTN").toUpperCase(),
      expires_at: c.expires_at || null,
      is_claimed: isClaimed,
      claimed_by_phone: claimedPhone,
      claimed_at: c.claimed_at || c.scratched_at || (isClaimed ? c.created_at : null),
      delivery_status: delivStatus,
      datamart_ref: c.datamart_ref || c.datamart_reference || null,
      notes: c.notes || null,
      created_at: c.created_at || new Date().toISOString(),
    };
  };

  function mergeVouchers(a: any, b: any) {
    const isClaimed = Boolean(a.is_claimed || b.is_claimed);
    const claimedByPhone = a.claimed_by_phone || b.claimed_by_phone || null;
    const claimedAt = a.claimed_at || b.claimed_at || (isClaimed ? (a.created_at || b.created_at) : null);
    const delivStatus =
      a.delivery_status === "delivered" || b.delivery_status === "delivered"
        ? "delivered"
        : a.delivery_status === "failed" || b.delivery_status === "failed"
        ? "failed"
        : isClaimed
        ? (a.delivery_status || b.delivery_status || "pending")
        : "pending";

    return {
      ...b,
      ...a,
      is_claimed: isClaimed,
      claimed_by_phone: claimedByPhone,
      claimed_at: claimedAt,
      delivery_status: delivStatus,
      datamart_ref: a.datamart_ref || b.datamart_ref || null,
      notes: a.notes || b.notes || null,
    };
  }

  const codeMap = new Map<string, any>();
  const addOrMerge = (c: any) => {
    if (!c?.code) return;
    const key = String(c.code).trim().toUpperCase();
    const row = normalizeRow(c);
    const existing = codeMap.get(key);
    if (existing) {
      codeMap.set(key, mergeVouchers(existing, row));
    } else {
      codeMap.set(key, row);
    }
  };

  for (const c of scratchRows) addOrMerge(c);
  for (const c of fallback) addOrMerge(c);
  for (const c of tableCodes) addOrMerge(c);

  const merged = Array.from(codeMap.values()).sort(
    (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
  );

  return { codes: merged, tableExists: tableExists || merged.length > 0 };
}

async function insertVouchers(admin: any, rows: any[]): Promise<any[]> {
  const now = new Date().toISOString();
  const prepared = rows.map((r) => ({
    id: r.id || crypto.randomUUID(),
    created_at: r.created_at || now,
    ...r,
  }));

  try {
    const { data, error } = await admin
      .from("free_data_codes")
      .insert(prepared)
      .select("*");

    if (!error && data) {
      return data;
    }
    // If error mentions column issues (e.g. is_claimed vs claimed), retry with claimed
    if (error && (String(error.message).includes("is_claimed") || String(error.message).includes("column"))) {
      const altPrepared = prepared.map((p) => {
        const copy: any = { ...p, claimed: p.is_claimed };
        delete copy.is_claimed;
        return copy;
      });
      const { data: altData, error: altErr } = await admin
        .from("free_data_codes")
        .insert(altPrepared)
        .select("*");
      if (!altErr && altData) {
        return altData;
      }
    }
  } catch (err: any) {
    console.warn("insertVouchers table insert notice:", err);
  }

  // Fallback to settings storage
  const existing = await getStoredCodesFromSettings(admin);
  const combined = [...prepared, ...existing];
  await saveStoredCodesToSettings(admin, combined);
  return prepared;
}

async function findVoucherByCode(admin: any, code: string): Promise<any | null> {
  const upper = String(code || "").toUpperCase().trim();
  try {
    const { data, error } = await admin
      .from("free_data_codes")
      .select("*")
      .ilike("code", upper)
      .maybeSingle();

    if (!error && data) return data;
  } catch {}

  try {
    const { data: sData } = await admin
      .from("scratch_codes")
      .select("*")
      .ilike("code", upper)
      .maybeSingle();
    if (sData) return sData;
  } catch {}

  const list = await getStoredCodesFromSettings(admin);
  return list.find((v: any) => String(v.code || "").toUpperCase().trim() === upper) || null;
}

async function updateVoucher(admin: any, id: string, updates: any, codeStr?: string): Promise<any> {
  const code = String(codeStr || updates?.code || (id && !id.includes("-") ? id : "")).toUpperCase().trim();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

  // 1. Try updating free_data_codes table by code or UUID
  try {
    let q = admin.from("free_data_codes").update(updates);
    if (code) {
      q = q.ilike("code", code);
    } else if (isUuid) {
      q = q.eq("id", id);
    }
    const { data, error } = await q.select("*").maybeSingle();
    if (!error && data) return data;

    // Retry with alternate column names if column differences exist
    const altUpdates: any = { ...updates };
    if ("is_claimed" in altUpdates) {
      altUpdates.claimed = altUpdates.is_claimed;
    }
    if ("claimed_by_phone" in altUpdates) {
      altUpdates.phone = altUpdates.claimed_by_phone;
      altUpdates.customer_phone = altUpdates.claimed_by_phone;
    }
    let altQ = admin.from("free_data_codes").update(altUpdates);
    if (code) altQ = altQ.ilike("code", code);
    else if (isUuid) altQ = altQ.eq("id", id);
    const { data: altData } = await altQ.select("*").maybeSingle();
    if (altData) return altData;
  } catch {}

  // 2. Also update scratch_codes if code exists there
  if (code) {
    try {
      const scratchUpdates: any = {};
      if (updates.is_claimed !== undefined) scratchUpdates.scratched = !!updates.is_claimed;
      if (updates.claimed_by_phone) scratchUpdates.phone = updates.claimed_by_phone;
      if (updates.delivery_status) scratchUpdates.delivery_status = updates.delivery_status;
      if (updates.datamart_ref) scratchUpdates.datamart_ref = updates.datamart_ref;
      await admin.from("scratch_codes").update(scratchUpdates).ilike("code", code);
    } catch {}
  }

  // 3. Update settings.free_data_codes_store
  try {
    const list = await getStoredCodesFromSettings(admin);
    const idx = list.findIndex((v: any) => (id && v.id === id) || (code && String(v.code).toUpperCase().trim() === code));
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...updates };
      await saveStoredCodesToSettings(admin, list);
      return list[idx];
    }
  } catch {}

  return { id, code, ...updates };
}

async function deleteVoucher(admin: any, idOrCode: string, codeStr?: string): Promise<void> {
  const targetId = String(idOrCode || "").trim();
  const targetCode = String(codeStr || idOrCode || "").trim().toUpperCase();

  // 1. Delete from free_data_codes table by code
  if (targetCode) {
    try {
      await admin.from("free_data_codes").delete().eq("code", targetCode);
    } catch (_) {}
  }
  // Delete by UUID if targetId is a UUID
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetId)) {
    try {
      await admin.from("free_data_codes").delete().eq("id", targetId);
    } catch (_) {}
  }

  // 2. Delete from scratch_codes table by code and id
  if (targetCode) {
    try {
      await admin.from("scratch_codes").delete().eq("code", targetCode);
    } catch (_) {}
  }
  if (/^\d+$/.test(targetId)) {
    try {
      await admin.from("scratch_codes").delete().eq("id", Number(targetId));
    } catch (_) {}
  } else if (/^[0-9a-f-]{36}$/i.test(targetId)) {
    try {
      await admin.from("scratch_codes").delete().eq("id", targetId);
    } catch (_) {}
  }

  // 3. Delete from settings.free_data_codes_store (ALWAYS filter both by id and by code!)
  try {
    const list = await getStoredCodesFromSettings(admin);
    const filtered = list.filter((v: any) => {
      const vId = String(v.id || "").trim();
      const vCode = String(v.code || "").trim().toUpperCase();
      if (targetId && vId === targetId) return false;
      if (targetCode && vCode === targetCode) return false;
      return true;
    });
    if (filtered.length !== list.length) {
      await saveStoredCodesToSettings(admin, filtered);
    }
  } catch (_) {}
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
async function checkRealDeliveryStatus(orderId: string, apiKey: string): Promise<{ deliveryStatus: string; rawStatus: string | null; datamart_reference: string | null; error: string | null }> {
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
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok && res.status === 401) {
        res = await fetch(url, {
          headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
          signal: AbortSignal.timeout(5000),
        });
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

// -------------------------------------------------------------
// Main Handler
// -------------------------------------------------------------

export default async function handler(req: any, res: any) {
  setCorsHeaders(res);
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const admin = getSupabase();
    if (await detectAndBlockIntrusion(req, res, admin)) return;

    const body = parseBody(req);
    const action = body?.action || req.query?.action || (req.query?.fn === "spin-claim" ? "spin-claim" : "getOverview");

    // 0. Spin & Win Prize Claim (consolidated)
    if (action === "spin-claim" || req.query?.fn === "spin-claim" || (body?.prize && !body?.action)) {
      const phone = body?.phone;
      const prize = body?.prize;
      const rawPhone = String(phone || "").replace(/\s+/g, "");
      const p = cleanGhanaPhone(rawPhone);
      const prizeCapacity = String(prize || "");

      if (!/^(0\d{9}|233\d{9})$/.test(rawPhone)) {
        return res.status(400).json({ error: "Invalid Ghana phone number" });
      }
      if (!["1", "2", "5"].includes(prizeCapacity)) {
        return res.status(400).json({ error: "Invalid prize" });
      }

      await hydrateSpinData(admin, false);

      const { data: spinSetting } = await admin
        .from("settings")
        .select("value")
        .eq("key", "spin_game_enabled")
        .maybeSingle();

      if (spinSetting && spinSetting.value === "false") {
        return res.status(400).json({ error: "Spin & Win is currently disabled" });
      }

      const { data: existing } = await admin
        .from("spin_wins")
        .select("*")
        .eq("owner_phone", p)
        .eq("reward_sent", false)
        .order("created_at", { ascending: false })
        .maybeSingle();

      if (existing) {
        return res.status(200).json({ spin: existing, existing: true });
      }

      const remote = getRemoteSupabaseClient(true);
      for (let attempt = 0; attempt < 6; attempt++) {
        let spinCode = "SP";
        for (let i = 0; i < 6; i++) spinCode += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
        const newWin = {
          code: spinCode,
          owner_phone: p,
          prize_capacity: prizeCapacity,
          orders_count: 0,
          reward_sent: false,
          reward_reference: null,
          reward_sent_at: null,
          created_at: new Date().toISOString(),
        };
        const { data, error } = await admin
          .from("spin_wins")
          .insert(newWin)
          .select("*")
          .maybeSingle();

        if (!error && data) {
          if (remote) {
            try {
              await remote.from("spin_wins").insert({ code: spinCode, owner_phone: p, prize_capacity: prizeCapacity });
            } catch (_) {}
          }
          await persistSpinBackup(admin, remote);
          return res.status(200).json({ spin: data });
        }
      }

      return res.status(500).json({ error: "Could not generate a unique code, please try again" });
    }

    // 0.05 Sync Scratch & Win code from WhatsApp Bot
    if (action === "syncScratchCode") {
      const scratch = body?.scratch;
      const redemption = body?.redemption;
      const remote = getRemoteSupabaseClient(true);
      if (scratch && scratch.code) {
        data1db.upsert("scratch_codes", scratch, "code");
        const mapped = mapScratchToSpinWin(scratch);
        if (mapped) {
          data1db.upsert("spin_wins", mapped, "code");
        }
        if (remote) {
          try {
            await remote.from("scratch_codes").upsert(scratch, { onConflict: "code" });
          } catch (_) {}
        }
      }
      if (redemption && redemption.order_reference) {
        const codeStr = String(redemption.scratch_code || scratch?.code || "").toUpperCase();
        const matchWin = data1db.loadTable("spin_wins").find((w) => String(w.code).toUpperCase() === codeStr);
        const spinId = matchWin?.id || `scratch_${codeStr}`;
        data1db.upsert(
          "spin_redemptions",
          {
            id: redemption.id || `sc_red_${codeStr}_${redemption.order_reference}`,
            spin_id: spinId,
            order_reference: redemption.order_reference,
            buyer_phone: cleanGhanaPhone(redemption.customer_phone || redemption.buyer_phone || ""),
            created_at: redemption.created_at || new Date().toISOString(),
          },
          "id"
        );
      }
      await persistSpinBackup(admin, remote);
      return res.status(200).json({ ok: true });
    }

    // 0.1 Referral Apply (Spin referral or general referral)
    if (action === "referral-apply" || req.query?.fn === "referral-apply") {
      const code = String(body?.code || req.query?.code || "").trim().toUpperCase();
      const ref = String(body?.order_reference || body?.reference || req.query?.order_reference || "").trim();

      if (!code || !ref) {
        return res.status(400).json({ error: "Missing code or order reference" });
      }

      // Check order in orders table
      const { data: order, error: ordErr } = await admin
        .from("orders")
        .select("id, reference, recipient_phone, payment_status")
        .eq("reference", ref)
        .maybeSingle();

      if (ordErr || !order) {
        return res.status(404).json({ error: "Order not found" });
      }

      if (order.payment_status !== "paid") {
        return res.status(400).json({ error: "Order has not been paid yet" });
      }

      const buyerPhoneClean = cleanGhanaPhone(order.recipient_phone);

      // A. Try finding spin winning code
      const { data: spin } = await admin
        .from("spin_wins")
        .select("*")
        .eq("code", code)
        .maybeSingle();

      if (spin) {
        const ownerPhoneClean = cleanGhanaPhone(spin.owner_phone);
        if (buyerPhoneClean && ownerPhoneClean && buyerPhoneClean === ownerPhoneClean) {
          return res.status(400).json({ error: "You cannot use your own referral link or code" });
        }

        // Check if this order was already used for a spin code
        const { data: alreadyUsed } = await admin
          .from("spin_redemptions")
          .select("id")
          .eq("order_reference", ref)
          .maybeSingle();

        if (alreadyUsed) {
          return res.status(400).json({ error: "This order has already applied a referral code" });
        }

        // Record spin redemption
        const { error: insErr } = await admin.from("spin_redemptions").insert({
          spin_id: spin.id,
          order_reference: ref,
          buyer_phone: String(order.recipient_phone),
        });

        if (insErr) {
          console.warn("spin_redemptions insert error:", insErr);
        }

        const newCount = (spin.orders_count ?? 0) + 1;
        await admin
          .from("spin_wins")
          .update({ orders_count: newCount })
          .eq("id", spin.id);

        const remote = getRemoteSupabaseClient(true);
        if (remote) {
          try {
            await remote.from("spin_wins").update({ orders_count: newCount }).eq("id", spin.id);
          } catch (_) {}
        }
        data1db.upsert("spin_wins", { ...spin, orders_count: newCount }, "id");
        await persistSpinBackup(admin, remote);

        // If reached 5 referrals, DO NOT send data automatically! Send WhatsApp alert to admin for manual fulfillment.
        if (newCount >= 5 && !spin.reward_sent) {
          try {
            await sendAdminSpinWinnerAlert({
              winnerPhone: spin.owner_phone,
              prizeCapacity: spin.prize_capacity,
              code: spin.code,
              referralsCount: newCount,
            }, admin);
          } catch (alertErr) {
            console.error("sendAdminSpinWinnerAlert trigger error:", alertErr);
          }
        }

        return res.status(200).json({
          ok: true,
          kind: "spin",
          prize: `${spin.prize_capacity}GB`,
          orders_count: newCount,
          threshold: 5,
          remaining: Math.max(0, 5 - newCount),
          reward_sent: spin.reward_sent,
        });
      }

      // B. Try finding general referral code
      const { data: referral } = await admin
        .from("referrals")
        .select("*")
        .eq("code", code)
        .maybeSingle();

      if (referral) {
        const ownerPhoneClean = cleanGhanaPhone(referral.owner_phone);
        if (buyerPhoneClean && ownerPhoneClean && buyerPhoneClean === ownerPhoneClean) {
          return res.status(400).json({ error: "You cannot use your own referral code" });
        }

        const { data: alreadyUsed } = await admin
          .from("referral_redemptions")
          .select("id")
          .eq("order_reference", ref)
          .maybeSingle();

        if (alreadyUsed) {
          return res.status(400).json({ error: "This order has already applied a referral code" });
        }

        await admin.from("referral_redemptions").insert({
          referral_id: referral.id,
          friend_phone: String(order.recipient_phone),
          order_reference: ref,
        });

        const newCount = (referral.redemptions_count ?? 0) + 1;
        await admin.from("referrals").update({ redemptions_count: newCount }).eq("id", referral.id);

        return res.status(200).json({
          ok: true,
          kind: "referral",
          redemptions_count: newCount,
          threshold: 5,
          remaining: Math.max(0, 5 - newCount),
          reward_sent: referral.reward_sent,
        });
      }

      return res.status(404).json({ error: "Invalid referral or spin code" });
    }

    // 0.2 Admin action to mark spin win reward as sent manually
    if (action === "markSpinSent") {
      const auth = await verifyAdminUser(req, admin);
      if (!auth.authorized) {
        return res.status(401).json({ error: auth.error || "Unauthorized: Administrator privileges required." });
      }

      const winId = body.id || body.winId;
      const code = body.code;
      if (!winId && !code) {
        return res.status(400).json({ error: "Missing spin ID or code" });
      }

      const nowStr = new Date().toISOString();
      let q = admin.from("spin_wins").update({
        reward_sent: true,
        reward_sent_at: nowStr,
        reward_reference: "MANUAL",
      });

      if (winId) q = q.eq("id", winId);
      else if (code) q = q.eq("code", code);

      const { data: updData, error: updErr } = await q.select("*").maybeSingle();
      if (updErr) {
        return res.status(500).json({ error: updErr.message });
      }

      const remote = getRemoteSupabaseClient(true);
      if (remote) {
        try {
          let rq = remote.from("spin_wins").update({ reward_sent: true, reward_sent_at: nowStr, reward_reference: "MANUAL" });
          if (code) rq = rq.eq("code", code);
          else if (winId) rq = rq.eq("id", winId);
          await rq;
        } catch (_) {}
        if (code && /^DATA1/i.test(String(code))) {
          try {
            await remote.from("scratch_codes").update({ status: "used", delivered_at: nowStr, datamart_reference: "MANUAL" }).eq("code", String(code).toUpperCase());
          } catch (_) {}
        }
      }
      await persistSpinBackup(admin, remote);

      return res.status(200).json({ ok: true, message: "Marked as sent successfully", spin: updData });
    }

    // 0.3 Admin action to fetch Spin & Win report
    if (action === "getSpinReport") {
      const auth = await verifyAdminUser(req, admin);
      if (!auth.authorized) {
        return res.status(401).json({ error: auth.error || "Unauthorized: Administrator privileges required." });
      }
      const report = await hydrateSpinData(admin, Boolean(body?.force));
      return res.status(200).json({ ok: true, ...report });
    }

    // 0.4 Admin action to toggle Spin & Win storefront switch
    if (action === "toggleSpin") {
      const auth = await verifyAdminUser(req, admin);
      if (!auth.authorized) {
        return res.status(401).json({ error: auth.error || "Unauthorized: Administrator privileges required." });
      }
      const enabled = Boolean(body?.enabled);
      await admin.from("settings").upsert({ key: "spin_game_enabled", value: enabled ? "true" : "false" }, { onConflict: "key" });
      const remote = getRemoteSupabaseClient(true);
      if (remote) {
        try {
          await remote.from("settings").upsert({ key: "spin_game_enabled", value: enabled ? "true" : "false" }, { onConflict: "key" });
        } catch (_) {}
      }
      return res.status(200).json({ ok: true, spin_game_enabled: enabled });
    }

    // 1. Customer Action: Claim a code
    if (action === "claimCode") {
      const inputCode = String(body.code || "").trim().toUpperCase();
      let phone = String(body.phone || "").replace(/\s+/g, "");

      if (!inputCode) {
        return res.status(400).json({ error: "Please enter your Free Data code" });
      }

      if (!/^(0\d{9}|233\d{9})$/.test(phone)) {
        return res.status(400).json({ error: "Please enter a valid Ghana phone number (e.g. 0541234567)" });
      }

      // Check if Free Data is enabled on storefront
      const { data: settingRow } = await admin
        .from("settings")
        .select("value")
        .eq("key", "free_data_enabled")
        .maybeSingle();

      if (settingRow && settingRow.value === "false") {
        return res.status(400).json({ error: "Free Data promotion is currently paused." });
      }

      // Find code
      const voucher = await findVoucherByCode(admin, inputCode);

      if (!voucher) {
        return res.status(404).json({
          error: "Invalid Free Data code. Please check that you typed all 10 characters correctly.",
        });
      }

      if (voucher.is_claimed) {
        const dateStr = voucher.claimed_at
          ? ` on ${new Date(voucher.claimed_at).toLocaleDateString()}`
          : "";
        return res.status(400).json({
          error: `This Free Data code has already been claimed${dateStr}! Each voucher code can only be claimed once.`,
          isClaimed: true,
        });
      }

      if (voucher.expires_at && new Date(voucher.expires_at).getTime() < Date.now()) {
        return res.status(400).json({
          error: "This Free Data code has expired.",
        });
      }

      // ENFORCE RULE: Only ONE code per phone number within the generated batch or generation time
      const cleanTargetPhone = cleanGhanaPhone(phone);
      const { codes: allExistingCodes } = await fetchAllVouchers(admin);
      const voucherCreatedAt = voucher.created_at ? new Date(voucher.created_at).getTime() : 0;
      const voucherBatchId = voucher.batch_id;

      const alreadyClaimed = allExistingCodes.some((v: any) => {
        if (!v.is_claimed || !v.claimed_by_phone) return false;
        const vPhone = cleanGhanaPhone(v.claimed_by_phone);
        if (!vPhone || vPhone !== cleanTargetPhone) return false;

        // 1. Same explicit batch
        if (voucherBatchId && v.batch_id && v.batch_id === voucherBatchId) {
          return true;
        }

        // 2. Generated in the same session (within 10 minutes of this voucher creation)
        if (voucherCreatedAt > 0 && v.created_at) {
          const diffMs = Math.abs(new Date(v.created_at).getTime() - voucherCreatedAt);
          if (diffMs <= 10 * 60 * 1000) {
            return true;
          }
        }

        // 3. Or claimed within the past 1 hour (same active promotion run)
        if (v.claimed_at) {
          const claimedMs = new Date(v.claimed_at).getTime();
          if (Date.now() - claimedMs <= 60 * 60 * 1000) {
            return true;
          }
        }

        return false;
      });

      if (alreadyClaimed) {
        return res.status(400).json({
          error: "This phone number has already claimed a Free Data code! Only one code per phone number is allowed.",
          alreadyClaimed: true,
        });
      }

      // Mark code as claimed
      const nowStr = new Date().toISOString();
      const updated = await updateVoucher(
        admin,
        voucher.id,
        {
          is_claimed: true,
          claimed_by_phone: phone,
          claimed_at: nowStr,
          delivery_status: "pending",
        },
        inputCode
      );

      return res.status(200).json({
        ok: true,
        message: "Free data successfully claimed!",
        voucher: updated,
      });
    }

    // --- Admin Actions (Security Protected) ---
    const auth = await verifyAdminUser(req, admin);
    if (!auth.authorized) {
      return res.status(401).json({ error: auth.error || "Unauthorized: Administrator privileges required." });
    }

    // 2. Admin Action: Overview (list codes, settings, stats, balance)
    if (action === "getOverview") {
      const [vouchersData, settingRes] = await Promise.all([
        fetchAllVouchers(admin),
        admin.from("settings").select("value").eq("key", "free_data_enabled").maybeSingle(),
      ]);

      const codes = vouchersData.codes || [];
      const isEnabled = settingRes.data?.value === "true";

      const apiKey = await getDatamartApiKey(admin);
      const balance = await fetchDatamartBalance(apiKey);
      if (balance !== null) {
        checkAndAlertLowDatamartBalance(balance, admin).catch(() => null);
      }

      const stats = {
        totalGenerated: codes.length,
        totalClaimed: codes.filter((c: any) => c.is_claimed).length,
        pendingDelivery: codes.filter((c: any) => c.is_claimed && c.delivery_status === "pending").length,
        delivered: codes.filter((c: any) => c.delivery_status === "delivered").length,
      };

      return res.status(200).json({
        enabled: isEnabled,
        stats,
        balance,
        hasApiKey: !!apiKey,
        codes,
        tableExists: vouchersData.tableExists,
      });
    }

    // 3. Admin Action: Toggle Storefront Button
    if (action === "toggleStorefront") {
      const enabled = !!body.enabled;
      await admin
        .from("settings")
        .upsert({ key: "free_data_enabled", value: enabled ? "true" : "false" }, { onConflict: "key" });
      return res.status(200).json({ ok: true, enabled });
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
      const batchId = `batch_${Date.now()}`;

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
            batch_id: batchId,
          });
        }
      }

      const inserted = await insertVouchers(admin, rows);

      return res.status(200).json({
        ok: true,
        generatedCount: inserted?.length || rows.length,
        codes: inserted || rows,
      });
    }

    // 5. Admin Action: Bulk Deliver via DataMart (Direct wallet purchase, no Paystack)
    if (action === "bulkDeliverDataMart") {
      const apiKey = await getDatamartApiKey(admin);
      if (!apiKey) {
        return res.status(400).json({
          error: "DATAMART_API_KEY is not configured in environment or settings.",
        });
      }

      const ids = Array.isArray(body.ids) ? body.ids : null;
      const { codes: allCodes } = await fetchAllVouchers(admin);

      let pendingVouchers = allCodes.filter(
        (c: any) => c.is_claimed && c.delivery_status === "pending"
      );

      if (ids && ids.length > 0) {
        const idSet = new Set(ids);
        pendingVouchers = pendingVouchers.filter((c: any) => idSet.has(c.id));
      }

      if (!pendingVouchers || pendingVouchers.length === 0) {
        return res.status(200).json({ ok: true, message: "No pending claimed vouchers to deliver.", processed: [] });
      }

      const results: any[] = [];
      for (const v of pendingVouchers) {
        const ref = `WS-FD-${Date.now().toString(36).slice(-4)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
        const outcome = await deliverViaDatamart(
          apiKey,
          v.claimed_by_phone,
          v.network || "MTN",
          v.capacity || "1GB",
          ref,
          admin
        );

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

          const updated = await updateVoucher(admin, v.id, {
            delivery_status: deliveryStatus,
            datamart_ref: dmRef,
          });
          results.push({ id: v.id, phone: v.claimed_by_phone, status: deliveryStatus, ref });
        } else {
          await updateVoucher(admin, v.id, {
            delivery_status: "failed",
            notes: outcome.error || "DataMart dispatch error",
          });
          results.push({ id: v.id, phone: v.claimed_by_phone, status: "failed", error: outcome.error });
        }
      }

      const successCount = results.filter((r) => r.status === "delivered").length;
      return res.status(200).json({
        ok: true,
        total: results.length,
        delivered: successCount,
        failed: results.length - successCount,
        results,
      });
    }

    // 6. Admin Action: Direct DataMart Purchase (Send data direct without paying)
    if (action === "directPurchase") {
      const apiKey = await getDatamartApiKey(admin);
      if (!apiKey) {
        return res.status(400).json({ error: "DATAMART_API_KEY is not configured" });
      }

      const phone = String(body.phoneNumber || body.phone || "").replace(/\s+/g, "");
      const network = String(body.network || "MTN").toUpperCase();
      const capacity = String(body.capacity || "1GB");

      if (!/^(0\d{9}|233\d{9})$/.test(phone)) {
        return res.status(400).json({ error: "Invalid phone number" });
      }

      const ref = `WS-DIR-${Date.now().toString(36).slice(-4)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
      const outcome = await deliverViaDatamart(apiKey, phone, network, capacity, ref, admin);

      if (outcome.success) {
        return res.status(200).json({
          ok: true,
          message: `Successfully sent ${capacity} ${network} to ${phone}`,
          data: outcome.data,
          ref,
        });
      }

      return res.status(400).json({
        error: outcome.error || "Direct purchase failed on DataMart",
      });
    }

    // 7. Admin Action: Delete code (single or bulk)
    if (action === "deleteCode" || action === "deleteCodes") {
      const items: any[] = Array.isArray(body.codes)
        ? body.codes
        : Array.isArray(body.ids)
        ? body.ids
        : [body.id || body.code].filter(Boolean);

      if (items.length === 0) {
        return res.status(400).json({ error: "Missing code or id to delete" });
      }

      for (const item of items) {
        const idVal = typeof item === "object" ? item.id : item;
        const codeVal = typeof item === "object" ? item.code : (body.code || item);
        await deleteVoucher(admin, idVal, codeVal);
      }
      return res.status(200).json({ ok: true, deletedCount: items.length });
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });
  } catch (err: any) {
    console.error("api/free-data error:", err);
    return res.status(500).json({ error: err?.message || "Internal server error" });
  }
}
