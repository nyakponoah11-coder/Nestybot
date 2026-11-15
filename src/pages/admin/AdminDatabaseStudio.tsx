import React, { useState, useEffect } from "react";
import { invokeApiFunction } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Database,
  RefreshCw,
  Download,
  Upload,
  Search,
  Plus,
  Trash2,
  Edit3,
  Server,
  HardDrive,
  Cpu,
  Layers,
  Copy,
  Loader2,
  Zap,
  ArrowRightLeft,
  Send,
} from "lucide-react";
import { toast } from "sonner";

interface TableMeta {
  name: string;
  count: number;
  sizeBytes: number;
}

interface DatabaseStats {
  engine: string;
  version: string;
  dataPath: string;
  tablesCount: number;
  totalRecords: number;
  diskSizeBytes: number;
  uptimeSeconds: number;
  mode: "standalone" | "hybrid";
  tables: Record<string, { count: number; sizeBytes: number }>;
}

export const AdminDatabaseStudio: React.FC = () => {
  const [stats, setStats] = useState<DatabaseStats | null>(null);
  const [tables, setTables] = useState<TableMeta[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>("orders");
  const [records, setRecords] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [search, setSearch] = useState<string>("");
  const [page, setPage] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [tableLoading, setTableLoading] = useState<boolean>(false);
  const [syncing, setSyncing] = useState<boolean>(false);

  // Record Editor Modal
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<any>(null);
  const [editorJson, setEditorJson] = useState("");
  const [savingRecord, setSavingRecord] = useState(false);

  // Restore Modal
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [restoreJson, setRestoreJson] = useState("");
  const [restoring, setRestoring] = useState(false);

  // 1-Click Migration Modal
  const [migrateOpen, setMigrateOpen] = useState(false);
  const [targetUrl, setTargetUrl] = useState("");
  const [targetKey, setTargetKey] = useState("");
  const [migrating, setMigrating] = useState(false);

  // Load Database Stats and Tables
  const loadStatsAndTables = async () => {
    setLoading(true);
    try {
      const res = await invokeApiFunction("db", {
        body: { action: "stats" },
      });
      if (res?.data?.ok && res.data.stats) {
        setStats(res.data.stats);
        const tblList: TableMeta[] = Object.entries(res.data.stats.tables || {}).map(([name, meta]: any) => ({
          name,
          count: meta.count || 0,
          sizeBytes: meta.sizeBytes || 0,
        })).sort((a, b) => b.count - a.count);

        setTables(tblList);
        if (tblList.length > 0 && !selectedTable) {
          setSelectedTable(tblList[0].name);
        }
      }
    } catch (err: any) {
      console.warn("Could not load Data1DB stats:", err);
      toast.error("Could not connect to Data1DB engine.");
    } finally {
      setLoading(false);
    }
  };

  // Load Table Data
  const loadTableData = async (tableName: string, targetPage = 1, searchQuery = search) => {
    if (!tableName) return;
    setTableLoading(true);
    try {
      const res = await invokeApiFunction("db", {
        body: {
          action: "getTableData",
          table: tableName,
          page: targetPage,
          pageSize: 40,
          search: searchQuery.trim(),
        },
      });
      if (res?.data?.ok) {
        setRecords(res.data.records || []);
        setTotalCount(res.data.totalCount || 0);
        setPage(res.data.page || 1);
      }
    } catch (err: any) {
      toast.error(err?.message || `Failed to load records for ${tableName}`);
    } finally {
      setTableLoading(false);
    }
  };

  useEffect(() => {
    loadStatsAndTables();
  }, []);

  useEffect(() => {
    if (selectedTable) {
      loadTableData(selectedTable, 1, search);
    }
  }, [selectedTable]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedTable) {
      loadTableData(selectedTable, 1, search);
    }
  };

  // 1-Click Sync from Supabase into Data1DB
  const handleSyncFromSupabase = async () => {
    if (!confirm("Pull all data from Supabase into Data1DB? Existing records will be safely merged and updated.")) return;
    setSyncing(true);
    try {
      const res = await invokeApiFunction("db", {
        body: { action: "syncFromSupabase" },
      });
      if (res?.data?.ok) {
        toast.success(res.data.message || "All collections synced into Data1DB!");
        await loadStatsAndTables();
        if (selectedTable) loadTableData(selectedTable, 1, search);
      } else {
        const errorMsg = res?.data?.error || res?.error?.message || "Sync failed.";
        toast.error(errorMsg, { duration: 6000 });
      }
    } catch (e: any) {
      toast.error(e?.message || "Sync connection error");
    } finally {
      setSyncing(false);
    }
  };

  // Export Database Snapshot JSON
  const handleExportBackup = async () => {
    try {
      toast.loading("Generating full database snapshot...", { id: "db-export" });
      const res = await invokeApiFunction("db", {
        body: { action: "exportBackup" },
      });
      if (res?.data?.ok && res.data.data) {
        const jsonStr = JSON.stringify(res.data.data, null, 2);
        const blob = new Blob([jsonStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `data1db_snapshot_${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success("Database snapshot downloaded successfully!", { id: "db-export" });
      } else {
        toast.error("Failed to generate backup.", { id: "db-export" });
      }
    } catch (e: any) {
      toast.error("Export error: " + e?.message, { id: "db-export" });
    }
  };

  // 1-Click Live Migration
  const handleMigrateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUrl.trim() || !targetKey.trim()) {
      toast.error("Please enter both the New Supabase URL and Service Role Key");
      return;
    }
    setMigrating(true);
    try {
      const res = await invokeApiFunction("db", {
        body: {
          action: "migrateToNewSupabase",
          targetUrl: targetUrl.trim(),
          targetKey: targetKey.trim(),
        },
      });
      if (res?.data?.ok) {
        toast.success(res.data.message || "Migration complete! All records pushed to your new Supabase project!", { duration: 10000 });
        setMigrateOpen(false);
        setTargetUrl("");
        setTargetKey("");
      } else {
        toast.error(res?.data?.error || "Migration failed");
      }
    } catch (err: any) {
      toast.error("Migration error: " + err?.message);
    } finally {
      setMigrating(false);
    }
  };

  // Restore Database Backup
  const handleRestoreSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restoreJson.trim()) {
      toast.error("Please paste your backup JSON payload");
      return;
    }
    let parsed: any = null;
    try {
      parsed = JSON.parse(restoreJson);
    } catch {
      toast.error("Invalid JSON format. Please check your backup file content.");
      return;
    }

    setRestoring(true);
    try {
      const res = await invokeApiFunction("db", {
        body: { action: "restoreBackup", data: parsed },
      });
      if (res?.data?.ok) {
        toast.success(`Successfully restored ${res.data.tablesRestored?.length || 0} tables!`);
        setRestoreOpen(false);
        setRestoreJson("");
        await loadStatsAndTables();
        if (selectedTable) loadTableData(selectedTable, 1, search);
      } else {
        toast.error(res?.data?.error || "Restore failed");
      }
    } catch (e: any) {
      toast.error("Restore error: " + e?.message);
    } finally {
      setRestoring(false);
    }
  };

  // Switch Database Mode (Standalone vs Hybrid)
  const handleModeToggle = async () => {
    const nextMode = stats?.mode === "standalone" ? "hybrid" : "standalone";
    try {
      const res = await invokeApiFunction("db", {
        body: { action: "setMode", mode: nextMode },
      });
      if (res?.data?.ok) {
        toast.success(`Switched to ${nextMode.toUpperCase()} mode!`);
        setStats((prev) => (prev ? { ...prev, mode: nextMode as any } : prev));
      }
    } catch (e: any) {
      toast.error("Failed to toggle mode: " + e?.message);
    }
  };

  // Edit / Insert Record
  const openEditor = (record?: any) => {
    if (record) {
      setEditingRecord(record);
      setEditorJson(JSON.stringify(record, null, 2));
    } else {
      setEditingRecord(null);
      setEditorJson(JSON.stringify({ id: `rec_${Date.now()}` }, null, 2));
    }
    setEditorOpen(true);
  };

  const handleSaveRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    let parsed: any = null;
    try {
      parsed = JSON.parse(editorJson);
    } catch {
      toast.error("Invalid JSON syntax. Please check formatting.");
      return;
    }

    setSavingRecord(true);
    try {
      const res = await invokeApiFunction("db", {
        body: { action: "saveRecord", table: selectedTable, record: parsed },
      });
      if (res?.data?.ok) {
        toast.success("Record saved successfully to Data1DB!");
        setEditorOpen(false);
        loadTableData(selectedTable, page, search);
        loadStatsAndTables();
      } else {
        toast.error(res?.data?.error || "Failed to save record.");
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed to connect to database");
    } finally {
      setSavingRecord(false);
    }
  };

  // Delete Record
  const handleDeleteRecord = async (row: any) => {
    const keyVal = row.id || row.key || row.reference;
    if (!confirm(`Are you sure you want to delete this record (${keyVal})?`)) return;

    try {
      const res = await invokeApiFunction("db", {
        body: {
          action: "deleteRecord",
          table: selectedTable,
          id: row.id,
          key: row.key,
        },
      });
      if (res?.data?.ok) {
        toast.success("Record deleted.");
        loadTableData(selectedTable, page, search);
        loadStatsAndTables();
      } else {
        toast.error(res?.data?.error || "Delete failed");
      }
    } catch (e: any) {
      toast.error(e?.message || "Delete error");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* 1. Header & Engine Telemetry */}
      <div className="relative overflow-hidden flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5 p-6 md:p-8 rounded-3xl bg-gradient-to-r from-slate-950 via-indigo-950 to-blue-900 text-white border border-slate-800 shadow-xl">
        <div className="absolute -right-16 -top-16 w-64 h-64 bg-amber-400/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="space-y-1 relative z-10">
          <div className="flex items-center gap-3.5">
            <div className="size-12 rounded-2xl bg-white/10 border border-white/20 grid place-items-center text-amber-400 shadow-md">
              <Database className="size-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl md:text-2xl font-black text-white tracking-tight">
                  Data1DB Studio
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {stats?.mode === "hybrid" ? "Hybrid Active" : "Standalone Active"}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Zero external dependencies • Zero egress fees • 100% autonomous in-memory database engine
              </p>
            </div>
          </div>
        </div>

        {/* Global Control Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 relative z-10">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleModeToggle}
            className="text-xs font-semibold gap-1.5 bg-white/10 border-white/20 hover:bg-white/20 text-white rounded-xl"
          >
            <ArrowRightLeft className="size-3.5 text-amber-300" />
            Mode: <span className="uppercase text-amber-300 font-mono font-bold">{stats?.mode || "STANDALONE"}</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={syncing}
            onClick={handleSyncFromSupabase}
            className="text-xs font-semibold gap-1.5 bg-white/10 border-white/20 hover:bg-white/20 text-white rounded-xl"
          >
            {syncing ? <Loader2 className="size-3.5 animate-spin" /> : <Zap className="size-3.5 text-cyan-300" />}
            Sync Supabase &rarr; Local
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExportBackup}
            className="text-xs font-semibold gap-1.5 bg-white/10 border-white/20 hover:bg-white/20 text-white rounded-xl"
          >
            <Download className="size-3.5" /> Snapshot JSON
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setMigrateOpen(true)}
            className="text-xs font-bold gap-1.5 bg-emerald-500/20 border-emerald-500/40 hover:bg-emerald-500/30 text-emerald-300 rounded-xl shadow-xs"
            title="1-Click push all agents, balances, prices, and orders directly to a new Supabase project"
          >
            <Send className="size-3.5 text-emerald-400" /> 1-Click Push to New Supabase
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setRestoreOpen(true)}
            className="text-xs font-semibold gap-1.5 bg-white/10 border-white/20 hover:bg-white/20 text-white rounded-xl"
          >
            <Upload className="size-3.5" /> Restore
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={() => {
              loadStatsAndTables();
              if (selectedTable) loadTableData(selectedTable, page, search);
            }}
            className="text-xs font-black gap-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl shadow-md"
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
      </div>

      {/* 2. Telemetry Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 rounded-2xl bg-card border border-border shadow-xs hover:shadow-md transition-all space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span>Total Tables</span>
            <div className="size-7 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 grid place-items-center">
              <Layers className="size-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-foreground">{stats?.tablesCount || tables.length || 0}</div>
          <div className="text-[11px] text-muted-foreground">Active collections on disk</div>
        </Card>

        <Card className="p-4 rounded-2xl bg-card border border-border shadow-xs hover:shadow-md transition-all space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span>Total Records</span>
            <div className="size-7 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 grid place-items-center">
              <HardDrive className="size-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-foreground">{(stats?.totalRecords || 0).toLocaleString()}</div>
          <div className="text-[11px] text-muted-foreground">Across all collections</div>
        </Card>

        <Card className="p-4 rounded-2xl bg-card border border-border shadow-xs hover:shadow-md transition-all space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span>Storage Size</span>
            <div className="size-7 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 grid place-items-center">
              <Server className="size-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-foreground">{formatBytes(stats?.diskSizeBytes || 0)}</div>
          <div className="text-[11px] text-muted-foreground">Atomic JSON database</div>
        </Card>

        <Card className="p-4 rounded-2xl bg-card border border-border shadow-xs hover:shadow-md transition-all space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span>Read Latency</span>
            <div className="size-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 grid place-items-center">
              <Cpu className="size-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">~0.1 ms</div>
          <div className="text-[11px] text-muted-foreground">In-memory indexed lookup</div>
        </Card>
      </div>

      {/* 3. Main Studio Workspace (Left: Table Selector | Right: Table Records) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left: Collections / Tables List */}
        <Card className="lg:col-span-1 p-4 rounded-2xl bg-card border border-border shadow-xs space-y-3 h-fit">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <span className="text-xs font-black text-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="size-4 text-primary" /> Collections
            </span>
            <span className="text-[11px] text-muted-foreground font-mono font-medium">{tables.length} tables</span>
          </div>

          <div className="space-y-1 max-h-[520px] overflow-y-auto pr-1">
            {tables.map((t) => {
              const isSelected = selectedTable === t.name;
              return (
                <button
                  key={t.name}
                  type="button"
                  onClick={() => {
                    setSelectedTable(t.name);
                    setSearch("");
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-left text-xs transition-all ${
                    isSelected
                      ? "bg-primary text-primary-foreground font-black shadow-sm"
                      : "text-foreground/80 hover:bg-muted hover:text-foreground font-medium"
                  }`}
                >
                  <span className="truncate">{t.name}</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                      isSelected ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {t.count}
                  </span>
                </button>
              );
            })}
          </div>
        </Card>

        {/* Right: Table Data Explorer */}
        <Card className="lg:col-span-3 p-6 rounded-2xl bg-card border border-border shadow-xs space-y-4">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-3 border-b border-border">
            <div>
              <h2 className="text-base font-black text-foreground flex items-center gap-2">
                <span className="text-primary">{selectedTable}</span>
                <span className="text-xs text-muted-foreground font-normal">
                  ({totalCount} {totalCount === 1 ? "record" : "records"})
                </span>
              </h2>
              <p className="text-xs text-muted-foreground">
                Browsing collection records in Data1DB
              </p>
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
              {/* Search input */}
              <form onSubmit={handleSearchSubmit} className="relative flex-1 md:w-64">
                <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filter records..."
                  className="pl-8 h-9 text-xs bg-background border-border text-foreground rounded-xl"
                />
              </form>

              <Button
                type="button"
                size="sm"
                onClick={() => openEditor()}
                className="h-9 px-3.5 text-xs font-bold gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl shrink-0 shadow-xs"
              >
                <Plus className="size-3.5" /> Add Record
              </Button>
            </div>
          </div>

          {/* Records Table */}
          {tableLoading ? (
            <div className="py-20 text-center space-y-3">
              <Loader2 className="size-8 text-primary animate-spin mx-auto" />
              <p className="text-xs text-muted-foreground">Loading {selectedTable}...</p>
            </div>
          ) : records.length === 0 ? (
            <div className="py-16 text-center space-y-2 border border-dashed border-border rounded-2xl bg-muted/20">
              <Database className="size-8 text-muted-foreground/50 mx-auto" />
              <p className="text-sm font-bold text-foreground">No records found</p>
              <p className="text-xs text-muted-foreground">
                {search ? "No records match your query." : "This collection is currently empty."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-muted/60 border-b border-border text-muted-foreground font-bold uppercase tracking-wider text-[10px]">
                    <th className="p-3">Primary Key / ID</th>
                    <th className="p-3">Summary / Details</th>
                    <th className="p-3">Updated / Created</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {records.map((r, idx) => {
                    const rowKey = r.id || r.key || r.reference || `row-${idx}`;
                    const previewText = Object.entries(r)
                      .filter(([k]) => k !== "id" && k !== "created_at" && k !== "updated_at")
                      .slice(0, 3)
                      .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`)
                      .join(" • ");

                    return (
                      <tr key={rowKey} className="hover:bg-muted/40 transition-colors">
                        <td className="p-3 font-mono font-bold text-primary whitespace-nowrap">
                          <span className="bg-muted/80 border border-border/80 px-2 py-0.5 rounded-md text-xs">
                            {r.key || r.id || r.reference || "—"}
                          </span>
                        </td>
                        <td className="p-3 text-foreground/80 max-w-md truncate">
                          <span className="font-mono text-[11px] text-muted-foreground">{previewText || JSON.stringify(r)}</span>
                        </td>
                        <td className="p-3 text-muted-foreground text-[11px] whitespace-nowrap">
                          {r.updated_at || r.created_at ? new Date(r.updated_at || r.created_at).toLocaleString("en-GB") : "—"}
                        </td>
                        <td className="p-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => copyToClipboard(JSON.stringify(r, null, 2))}
                              className="size-7 rounded-lg hover:bg-muted grid place-items-center text-muted-foreground hover:text-foreground"
                              title="Copy JSON"
                            >
                              <Copy className="size-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditor(r)}
                              className="size-7 rounded-lg hover:bg-muted grid place-items-center text-blue-600 hover:text-blue-700"
                              title="Edit Record"
                            >
                              <Edit3 className="size-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteRecord(r)}
                              className="size-7 rounded-lg hover:bg-rose-500/10 grid place-items-center text-rose-500 hover:text-rose-600"
                              title="Delete Record"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* 4. Edit / Create Record Modal */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-2xl bg-card border border-border text-foreground rounded-2xl p-6 shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-foreground">
              <Database className="size-4 text-primary" />
              {editingRecord ? `Edit Record in ${selectedTable}` : `Add Record to ${selectedTable}`}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Edit the raw JSON representation. Changes persist atomically to disk.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveRecord} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">Record JSON</Label>
              <textarea
                value={editorJson}
                onChange={(e) => setEditorJson(e.target.value)}
                rows={12}
                required
                className="w-full bg-slate-950 text-emerald-400 border border-border focus:border-primary rounded-xl p-3 font-mono text-xs focus:outline-hidden"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditorOpen(false)}
                className="text-xs rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={savingRecord}
                className="text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl"
              >
                {savingRecord ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : null}
                Save Record
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* 5. Restore Database Modal */}
      <Dialog open={restoreOpen} onOpenChange={setRestoreOpen}>
        <DialogContent className="max-w-2xl bg-card border border-border text-foreground rounded-2xl p-6 shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-foreground">
              <Upload className="size-4 text-primary" />
              Restore Database Snapshot
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Paste a previously exported snapshot JSON payload to restore all tables.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleRestoreSubmit} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">Backup JSON Dump</Label>
              <textarea
                value={restoreJson}
                onChange={(e) => setRestoreJson(e.target.value)}
                placeholder='{"settings": [...], "orders": [...]}'
                rows={12}
                required
                className="w-full bg-slate-950 text-cyan-300 border border-border focus:border-primary rounded-xl p-3 font-mono text-xs focus:outline-hidden"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setRestoreOpen(false)}
                className="text-xs rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={restoring}
                className="text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl"
              >
                {restoring ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : null}
                Restore Database
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* 6. Live Migration to New Supabase Modal */}
      <Dialog open={migrateOpen} onOpenChange={setMigrateOpen}>
        <DialogContent className="max-w-xl bg-card border border-border text-foreground rounded-2xl p-6 shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-foreground">
              <Send className="size-4 text-emerald-400" />
              1-Click Live Push to New Supabase
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Directly transfer all agents, wallet balances, store prices, orders, and settings into your new Supabase project over the network.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleMigrateSubmit} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">Target Supabase Project URL</Label>
              <Input
                type="url"
                placeholder="https://xyzcompany.supabase.co"
                value={targetUrl}
                onChange={(e) => setTargetUrl(e.target.value)}
                required
                className="bg-slate-950 font-mono text-xs rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">Target Service Role Key (secret)</Label>
              <Input
                type="password"
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6..."
                value={targetKey}
                onChange={(e) => setTargetKey(e.target.value)}
                required
                className="bg-slate-950 font-mono text-xs rounded-xl"
              />
              <p className="text-[11px] text-muted-foreground">
                Found in your new Supabase dashboard under <b>Project Settings &rarr; API &rarr; service_role (secret)</b>.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setMigrateOpen(false)}
                className="text-xs rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={migrating}
                className="text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl gap-1.5"
              >
                {migrating ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
                {migrating ? "Migrating Data..." : "Migrate Everything Now"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDatabaseStudio;
