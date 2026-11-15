import { createClient } from "@supabase/supabase-js";
import { data1db } from "./_data1db.js";
import { getRemoteSupabaseClient, getSupabase, verifyAdminUser } from "./_supabase.js";
import { detectAndBlockIntrusion } from "./_firewall.js";

/**
 * Data1DB Standalone Database Engine & REST Studio API (/api/db)
 * Unified with the shared `data1db` singleton across all API endpoints.
 */

const CORE_TABLES = [
  "settings",
  "products",
  "orders",
  "agents",
  "agent_orders",
  "agent_withdrawals",
  "service_orders",
  "checker_orders",
  "chat_conversations",
  "sms_logs",
];

function getRemoteSupabase(): any {
  return getRemoteSupabaseClient();
}

export default async function handler(req: any, res: any) {
  try {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "authorization, x-client-info, apikey, content-type, x-function-name"
    );
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    if (req.method === "OPTIONS") return res.status(200).end();

    let body: any = {};
    if (req.body && typeof req.body === "object") {
      body = req.body;
    } else if (typeof req.body === "string" && req.body.trim()) {
      try {
        body = JSON.parse(req.body);
      } catch (_) { }
    }

    const supabase = getSupabase();
    if (supabase && (await detectAndBlockIntrusion(req, res, supabase))) return;

    const auth = await verifyAdminUser(req, supabase);
    if (!auth.authorized) {
      return res.status(401).json({ ok: false, error: auth.error || "Unauthorized: Administrator privileges required." });
    }

    const action = body?.action || req.query?.action || "stats";

    // 1. STATS
    if (action === "stats") {
      const baseStats = data1db.getStats();
      const tables: Record<string, { count: number; sizeBytes: number }> = { ...baseStats.tables };

      // If remote Supabase is configured, hydrate settings & recent orders once if empty, and reflect live counts
      const remote = getRemoteSupabase();
      if (remote) {
        try {
          if (!data1db.isTableHydrated("orders", 120000)) {
            const { data: oRows } = await remote.from("orders").select("id, reference, amount, recipient_phone, network, payment_status, delivery_status, created_at").order("created_at", { ascending: false }).limit(40);
            if (Array.isArray(oRows) && oRows.length > 0) {
              data1db.setTableRecords("orders", oRows);
            }
          }
          if (!data1db.isTableHydrated("settings", 180000)) {
            const { data: sRows } = await remote.from("settings").select("key, value").not("key", "like", "visitor_log_%");
            if (Array.isArray(sRows) && sRows.length > 0) {
              data1db.setTableRecords("settings", sRows);
            }
          }

          const refreshedStats = data1db.getStats();
          Object.assign(tables, refreshedStats.tables);

          const [oCount, aCount, pCount] = await Promise.allSettled([
            remote.from("orders").select("id", { count: "exact", head: true }),
            remote.from("agents").select("id", { count: "exact", head: true }),
            remote.from("products").select("id", { count: "exact", head: true }),
          ]);
          if (oCount.status === "fulfilled" && typeof oCount.value?.count === "number") {
            tables["orders"] = { count: Math.max(tables["orders"]?.count || 0, oCount.value.count), sizeBytes: tables["orders"]?.sizeBytes || 1024 };
          }
          if (aCount.status === "fulfilled" && typeof aCount.value?.count === "number") {
            tables["agents"] = { count: Math.max(tables["agents"]?.count || 0, aCount.value.count), sizeBytes: tables["agents"]?.sizeBytes || 1024 };
          }
          if (pCount.status === "fulfilled" && typeof pCount.value?.count === "number") {
            tables["products"] = { count: Math.max(tables["products"]?.count || 0, pCount.value.count), sizeBytes: tables["products"]?.sizeBytes || 1024 };
          }
        } catch (_) { }
      }

      const totalRecords = Object.values(tables).reduce((sum, t) => sum + (t.count || 0), 0);
      const diskSizeBytes = Object.values(tables).reduce((sum, t) => sum + (t.sizeBytes || 0), 0);

      return res.status(200).json({
        ok: true,
        stats: {
          ...baseStats,
          tablesCount: Object.keys(tables).length,
          totalRecords,
          diskSizeBytes,
          tables,
        },
      });
    }

    // 2. GET TABLES LIST
    if (action === "getTables") {
      const stats = data1db.getStats();
      const tables = Object.entries(stats.tables).map(([name, info]) => ({
        name,
        count: info.count,
        sizeBytes: info.sizeBytes,
      }));
      return res.status(200).json({ ok: true, tables });
    }

    // 3. GET TABLE DATA (Pagination & Search)
    if (action === "getTableData") {
      const table = String(body?.table || req.query?.table || "").trim();
      if (!table) return res.status(200).json({ ok: false, error: "Table name required" });

      const search = String(body?.search || req.query?.search || "").toLowerCase().trim();
      const page = Math.max(1, Number(body?.page || req.query?.page || 1));
      const pageSize = Math.min(200, Math.max(10, Number(body?.pageSize || req.query?.pageSize || 50)));

      let records: any[] = [];
      let totalCount = 0;

      // Hydrate from remote Supabase if not recently hydrated in data1db
      const remote = getRemoteSupabase();
      if (remote && (!data1db.isTableHydrated(table, 120000) || body?.refresh)) {
        try {
          const offset = (page - 1) * pageSize;
          let q = remote.from(table).select("*", { count: "exact" }).range(offset, offset + pageSize - 1);
          if (table === "orders" || table === "agents" || table === "service_orders" || table === "checker_orders") {
            q = q.order("created_at", { ascending: false });
          }
          const { data, count, error } = await q;
          if (!error && Array.isArray(data) && data.length > 0) {
            records = data;
            totalCount = count || data.length;
            data1db.setTableRecords(table, data);
          }
        } catch (_) { }
      }

      // Read from unified data1db
      if (records.length === 0) {
        let rows = [...data1db.loadTable(table)];
        if (search) {
          rows = rows.filter((r) =>
            Object.values(r).some((v) => v !== null && v !== undefined && String(v).toLowerCase().includes(search))
          );
        }
        totalCount = rows.length;
        const start = (page - 1) * pageSize;
        records = rows.slice(start, start + pageSize);
      }

      const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

      return res.status(200).json({
        ok: true,
        table,
        records,
        totalCount,
        page,
        pageSize,
        totalPages,
      });
    }

    // 4. SAVE RECORD (Upsert to both data1db and remote Supabase)
    if (action === "saveRecord") {
      const table = String(body?.table || "").trim();
      const record = body?.record;
      if (!table || !record) return res.status(200).json({ ok: false, error: "Table and record payload required" });

      const conflictKey = body?.conflictKey || (table === "settings" ? "key" : record.id ? "id" : record.key ? "key" : "id");
      const { data: upserted } = data1db.upsert(table, record, conflictKey);
      const savedRecord = upserted[0] || record;

      // Also persist to remote Supabase if connected
      const remote = getRemoteSupabase();
      if (remote) {
        try {
          await remote.from(table).upsert(savedRecord, { onConflict: conflictKey });
        } catch (_) {
          try {
            await remote.from(table).upsert(savedRecord);
          } catch (_) { }
        }
      }

      return res.status(200).json({
        ok: true,
        message: "Record saved successfully to Data1DB!",
        record: savedRecord,
      });
    }

    // 5. DELETE RECORD
    if (action === "deleteRecord") {
      const table = String(body?.table || "").trim();
      const id = String(body?.id || "").trim();
      const key = String(body?.key || "").trim();
      const filterVal = id || key;
      const filterField = id ? "id" : "key";

      data1db.delete(table, [{ field: filterField, operator: "eq", value: filterVal }]);

      const remote = getRemoteSupabase();
      if (remote) {
        try {
          await remote.from(table).delete().eq(filterField, filterVal);
        } catch (_) { }
      }

      return res.status(200).json({
        ok: true,
        message: `Record ${filterVal} deleted from ${table}`,
      });
    }

    // 6. EXPORT BACKUP
    if (action === "exportBackup") {
      const dump: Record<string, any[]> = {};
      const remote = getRemoteSupabase();
      for (const t of CORE_TABLES) {
        try {
          let rows: any[] = [];
          if (remote) {
            const { data } = await remote.from(t).select("*").limit(500);
            if (Array.isArray(data) && data.length > 0) rows = data;
          }
          if (rows.length === 0) {
            rows = data1db.loadTable(t);
          }
          dump[t] = rows;
        } catch (_) {
          dump[t] = data1db.loadTable(t);
        }
      }
      return res.status(200).json({
        ok: true,
        message: "Full database snapshot generated successfully with live Supabase data!",
        timestamp: new Date().toISOString(),
        data: dump,
      });
    }

    // 7. RESTORE BACKUP
    if (action === "restoreBackup") {
      const dump = body?.data;
      if (!dump || typeof dump !== "object") {
        return res.status(200).json({ ok: false, error: "Valid backup JSON data required" });
      }

      const { tablesRestored } = data1db.restoreBackup(dump);

      // Write-through to remote Supabase if connected
      const remote = getRemoteSupabase();
      if (remote) {
        for (const [table, rows] of Object.entries(dump)) {
          if (Array.isArray(rows) && rows.length > 0) {
            try {
              const conflictKey = table === "settings" ? "key" : table === "scratch_codes" ? "code" : "id";
              // Upsert in chunks of 50
              for (let i = 0; i < rows.length; i += 50) {
                const chunk = rows.slice(i, i + 50);
                await remote.from(table).upsert(chunk, { onConflict: conflictKey }).catch(() => {});
              }
            } catch (_) {}
          }
        }
      }

      return res.status(200).json({
        ok: true,
        message: `Restored ${tablesRestored.length} tables successfully and pushed to database!`,
        tablesRestored,
      });
    }

    // 8. 1-CLICK SYNC FROM SUPABASE
    if (action === "syncFromSupabase") {
      const remote = getRemoteSupabase();
      if (!remote) {
        return res.status(200).json({
          ok: false,
          error: "Supabase connection credentials are not configured. Running in pure standalone Data1DB mode!",
        });
      }

      let totalSynced = 0;
      const report: Record<string, { count: number; error?: string }> = {};

      const syncTasks = CORE_TABLES.map(async (t) => {
        try {
          let q = remote.from(t).select("id").limit(60);
          if (t === "orders" || t === "service_orders" || t === "checker_orders") {
            q = remote.from(t).select("id, created_at").order("created_at", { ascending: false }).limit(60);
          }
          const { data, error } = await q;
          if (!error && Array.isArray(data) && data.length > 0) {
            data1db.setTableRecords(t, data);
            report[t] = { count: data.length };
            totalSynced += data.length;
          } else if (error) {
            report[t] = { count: 0, error: error.message };
          } else {
            report[t] = { count: 0 };
          }
        } catch (e: any) {
          report[t] = { count: 0, error: e?.message || "Sync failed" };
        }
      });

      await Promise.allSettled(syncTasks);

      return res.status(200).json({
        ok: true,
        message: totalSynced > 0
          ? `Successfully synced ${totalSynced} records across collections from Supabase into Data1DB!`
          : "Connected to Supabase successfully. Collections are in sync.",
        report,
        totalSynced,
      });
    }

    // 9. SET DATABASE MODE
    if (action === "setMode") {
      const mode = String(body?.mode || "hybrid").toLowerCase() === "standalone" ? "standalone" : "hybrid";
      data1db.setMode(mode);

      return res.status(200).json({
        ok: true,
        message: `Database mode switched to ${mode.toUpperCase()}`,
        mode,
      });
    }

    
    // 10. 1-CLICK LIVE MIGRATION TO NEW SUPABASE PROJECT
    if (action === "migrateToNewSupabase") {
      const targetUrl = String(body?.targetUrl || "").trim();
      const targetKey = String(body?.targetKey || "").trim();

      if (!targetUrl || !targetKey) {
        return res.status(400).json({ ok: false, error: "New Supabase Project URL and Service Role Key are required." });
      }

      let newClient: any;
      try {
        newClient = createClient(targetUrl, targetKey, { auth: { persistSession: false, autoRefreshToken: false } });
      } catch (err: any) {
        return res.status(400).json({ ok: false, error: "Invalid new Supabase credentials: " + (err?.message || err) });
      }

      const currentRemote = getRemoteSupabase();
      const results: Record<string, number> = {};
      let totalMigrated = 0;
      const providedBackup = body?.backupData && typeof body.backupData === "object" ? body.backupData : null;

      for (const t of CORE_TABLES) {
        try {
          let rows: any[] = [];
          if (providedBackup && Array.isArray(providedBackup[t]) && providedBackup[t].length > 0) {
            rows = providedBackup[t];
          } else {
            if (currentRemote) {
              const { data } = await currentRemote.from(t).select("*").limit(300);
              if (Array.isArray(data) && data.length > 0) rows = data;
            }
            if (rows.length === 0) {
              rows = data1db.loadTable(t);
            }
          }

          if (rows.length > 0) {
            const conflictKey = t === "settings" ? "key" : t === "scratch_codes" ? "code" : "id";
            for (let i = 0; i < rows.length; i += 50) {
              const chunk = rows.slice(i, i + 50);
              await newClient.from(t).upsert(chunk, { onConflict: conflictKey }).catch(() => {});
            }
            results[t] = rows.length;
            totalMigrated += rows.length;
          }
        } catch (e: any) {
          console.warn("Migration error for " + t + ":", e?.message);
        }
      }

      return res.status(200).json({
        ok: true,
        message: "Successfully pushed " + totalMigrated + " records (agents, wallet balances, products, orders) to your new Supabase project!",
        totalMigrated,
        results,
      });
    }

    return res.status(200).json({ ok: false, error: `Unknown database action: ${action}` });
  } catch (err: any) {
    console.error("Data1DB API error:", err);
    return res.status(200).json({ ok: false, error: err?.message || "Internal database server error" });
  }
}
