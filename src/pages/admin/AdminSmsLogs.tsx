import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { invokeApiFunction } from "@/integrations/supabase/client";
import { createSmartInterval } from "@/lib/localCache";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  MessageSquareText,
  Send,
  AlertCircle,
  CheckCircle2,
  Clock,
  RefreshCw,
  Trash2,
  Copy,
  ExternalLink,
  Search,
  Filter,
  ShieldCheck,
  AlertTriangle,
  SendHorizonal,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

export interface SmsLogItem {
  id: string;
  recipient: string;
  message: string;
  sender_id?: string;
  reference?: string | null;
  status: "sent" | "failed";
  error?: string | null;
  type?: string;
  created_at: string;
}

export default function AdminSmsLogs() {
  const [logs, setLogs] = useState<SmsLogItem[]>([]);
  const [balance, setBalance] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [search, setSearch] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [resendingId, setResendingId] = useState<string | null>(null);

  // Test SMS Modal state
  const [testModalOpen, setTestModalOpen] = useState<boolean>(false);
  const [testPhone, setTestPhone] = useState<string>("0547100951");
  const [testMode, setTestMode] = useState<"agent" | "main">("agent");
  const [testSending, setTestSending] = useState<boolean>(false);

  // Clear confirmation modal state
  const [clearModalOpen, setClearModalOpen] = useState<boolean>(false);
  const [clearing, setClearing] = useState<boolean>(false);

  // Selected Log preview modal state
  const [selectedLog, setSelectedLog] = useState<SmsLogItem | null>(null);

  const fetchLogs = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);

    try {
      const { data, error } = await invokeApiFunction("admin-data", {
        body: { action: "getSmsLogs" },
      });

      if (error) throw error;
      if (data?.logs && Array.isArray(data.logs)) {
        setLogs(data.logs);
      }
      if (data?.arkeselBalance !== undefined) {
        setBalance(data.arkeselBalance);
      }
    } catch (err: any) {
      console.error("Failed to load SMS logs:", err);
      toast.error(err?.message || "Failed to load SMS notification logs");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    document.title = "SMS Notifications Log · Admin";
    fetchLogs();

    // Auto-refresh every 3 minutes via smart interval (pauses when tab is hidden)
    const stopPolling = createSmartInterval(() => {
      fetchLogs(true);
    }, 180000);

    return () => stopPolling();
  }, []);

  const handleResend = async (item: SmsLogItem) => {
    setResendingId(item.id);
    try {
      const { data, error } = await invokeApiFunction("admin-data", {
        body: {
          action: "resendCustomerSms",
          recipient: item.recipient,
          message: item.message,
          reference: item.reference,
          type: item.type,
        },
      });

      if (error || !data?.ok) {
        throw new Error(error?.message || data?.error || "Arkesel rejected resend");
      }

      toast.success(`SMS successfully resent to ${item.recipient}!`);
      fetchLogs(true);
    } catch (e: any) {
      toast.error(e?.message || "Failed to resend SMS");
    } finally {
      setResendingId(null);
    }
  };

  const handleTestSms = async () => {
    if (!testPhone.trim()) {
      toast.error("Please enter a destination phone number");
      return;
    }

    setTestSending(true);
    try {
      const isAgent = testMode === "agent";
      const { data, error } = await invokeApiFunction("admin-data", {
        body: {
          action: "testPaymentIssueSms",
          recipient: testPhone.trim(),
          is_agent: isAgent,
          store_name: isAgent ? "Senerity Data" : "Data1GH",
          store_slug: isAgent ? "senerity-data" : "",
        },
      });

      if (error || !data?.ok) {
        throw new Error(error?.message || data?.error || "Arkesel test dispatch failed");
      }

      toast.success(`Test payment issue SMS sent successfully to ${testPhone}!`);
      setTestModalOpen(false);
      fetchLogs(true);
    } catch (e: any) {
      toast.error(e?.message || "Test dispatch failed. Check Arkesel key.");
    } finally {
      setTestSending(false);
    }
  };

  const handleClearLogs = async () => {
    setClearing(true);
    try {
      const { data, error } = await invokeApiFunction("admin-data", {
        body: { action: "clearSmsLogs" },
      });

      if (error) throw error;
      setLogs([]);
      setClearModalOpen(false);
      toast.success(data?.message || "All SMS notification logs cleared");
    } catch (e: any) {
      toast.error(e?.message || "Failed to clear SMS logs");
    } finally {
      setClearing(false);
    }
  };

  const copyToClipboard = (text: string, label = "Copied to clipboard") => {
    navigator.clipboard.writeText(text);
    toast.success(label);
  };

  const formatGhanaTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleString("en-GB", {
        timeZone: "Africa/Accra",
        dateStyle: "medium",
        timeStyle: "short",
      });
    } catch {
      return isoString;
    }
  };

  const getRelativeTime = (isoString: string) => {
    try {
      const ms = Date.now() - new Date(isoString).getTime();
      const mins = Math.floor(ms / 60000);
      if (mins < 1) return "Just now";
      if (mins === 1) return "1 min ago";
      if (mins < 60) return `${mins} mins ago`;
      const hrs = Math.floor(mins / 60);
      if (hrs === 1) return "1 hr ago";
      return `${hrs} hrs ago`;
    } catch {
      return "";
    }
  };

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (statusFilter !== "all" && log.status !== statusFilter) return false;
      if (typeFilter !== "all" && log.type !== typeFilter) return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        const matchRecip = log.recipient.toLowerCase().includes(q);
        const matchRef = (log.reference || "").toLowerCase().includes(q);
        const matchMsg = log.message.toLowerCase().includes(q);
        const matchErr = (log.error || "").toLowerCase().includes(q);
        return matchRecip || matchRef || matchMsg || matchErr;
      }
      return true;
    });
  }, [logs, search, statusFilter, typeFilter]);

  const stats = useMemo(() => {
    const total = logs.length;
    const sent = logs.filter((l) => l.status === "sent").length;
    const failed = logs.filter((l) => l.status === "failed").length;
    const paymentIssues = logs.filter((l) => l.type === "payment_issue" || l.type === "test_payment_issue").length;
    return { total, sent, failed, paymentIssues };
  }, [logs]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
              <MessageSquareText className="size-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">SMS Notifications</h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Live 24-hour log of automated customer alerts, payment issue recoveries, and system SMS via Arkesel.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2.5">
          <Badge variant="outline" className="px-3 py-1.5 gap-1.5 border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium">
            <Clock className="size-3.5" />
            Auto-deletes after 24 hrs
          </Badge>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setTestModalOpen(true)}
            className="gap-2 border-primary/30 text-primary hover:bg-primary/10"
          >
            <Send className="size-3.5" />
            Test SMS
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchLogs(true)}
            disabled={refreshing}
            className="gap-1.5"
          >
            <RefreshCw className={`size-3.5 ${refreshing ? "animate-spin text-primary" : ""}`} />
            Refresh
          </Button>

          {logs.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setClearModalOpen(true)}
              className="gap-1.5 text-rose-600 border-rose-500/20 hover:bg-rose-500/10 hover:text-rose-700"
            >
              <Trash2 className="size-3.5" />
              Clear All
            </Button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-card/50 backdrop-blur border-border/70">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium">Total (Last 24h)</CardDescription>
            <CardTitle className="text-2xl font-extrabold">{stats.total}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-muted-foreground flex items-center gap-1.5">
            <Clock className="size-3.5 text-primary" /> Auto-purged after 24h
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur border-emerald-500/20">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
              Successfully Delivered
            </CardDescription>
            <CardTitle className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
              {stats.sent}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-muted-foreground flex items-center gap-1.5">
            <CheckCircle2 className="size-3.5 text-emerald-500" />
            Sender ID: <span className="font-semibold text-foreground">D_1Gh</span>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur border-rose-500/20">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium text-rose-600 dark:text-rose-400">
              Failed / Blocked
            </CardDescription>
            <CardTitle className="text-2xl font-extrabold text-rose-600 dark:text-rose-400">
              {stats.failed}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-muted-foreground flex items-center gap-1.5">
            {stats.failed > 0 ? (
              <span className="text-rose-500 flex items-center gap-1">
                <AlertCircle className="size-3.5" /> Click Resend on failed rows
              </span>
            ) : (
              <span className="text-emerald-500 flex items-center gap-1">
                <ShieldCheck className="size-3.5" /> 100% Delivery Success
              </span>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur border-border/70">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium">Arkesel SMS Balance</CardDescription>
            <CardTitle className="text-2xl font-extrabold text-primary">
              {balance !== null ? `${balance} units` : "Checking..."}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-muted-foreground flex items-center justify-between">
            <span>Approved Sender: D_1Gh</span>
            <a
              href="https://sms.arkesel.com"
              target="_blank"
              rel="noreferrer"
              className="text-primary hover:underline flex items-center gap-1"
            >
              Top up <ExternalLink className="size-3" />
            </a>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-4 bg-card/40 border-border/60">
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="relative w-full md:w-96">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by phone, order reference, or text..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 text-xs h-9 bg-background/60"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mr-1">
              <Filter className="size-3.5" />
              <span>Status:</span>
            </div>
            <div className="flex rounded-lg border bg-background/50 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setStatusFilter("all")}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  statusFilter === "all" ? "bg-primary text-primary-foreground font-semibold" : "hover:text-foreground"
                }`}
              >
                All ({stats.total})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("sent")}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  statusFilter === "sent" ? "bg-emerald-600 text-white font-semibold" : "hover:text-foreground"
                }`}
              >
                Delivered ({stats.sent})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("failed")}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  statusFilter === "failed" ? "bg-rose-600 text-white font-semibold" : "hover:text-foreground"
                }`}
              >
                Failed ({stats.failed})
              </button>
            </div>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="h-9 px-2.5 text-xs rounded-lg border bg-background/60 text-foreground"
            >
              <option value="all">All Notification Types</option>
              <option value="payment_issue">Payment Issues (Low Balance / Abandoned)</option>
              <option value="payment_received">Payment Received</option>
              <option value="order_status">Order Status</option>
              <option value="bulk_sms">Bulk SMS</option>
              <option value="test_payment_issue">Test SMS</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Main Logs Table */}
      <Card className="border-border/70 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-muted/40 uppercase tracking-wider text-[11px] text-muted-foreground border-b font-semibold">
              <tr>
                <th className="py-3 px-4">Time</th>
                <th className="py-3 px-4">Recipient</th>
                <th className="py-3 px-4">Reference</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4 min-w-[280px]">SMS Message</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {loading && logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-foreground">
                    <Loader2 className="size-6 animate-spin mx-auto text-primary mb-2" />
                    Loading SMS notification logs...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center">
                    <div className="max-w-sm mx-auto space-y-2">
                      <div className="size-12 rounded-2xl bg-muted/60 flex items-center justify-center mx-auto text-muted-foreground">
                        <MessageSquareText className="size-6" />
                      </div>
                      <p className="font-semibold text-sm">No SMS records found</p>
                      <p className="text-xs text-muted-foreground">
                        {search || statusFilter !== "all" || typeFilter !== "all"
                          ? "No SMS logs match the current filters. Clear search to see all entries."
                          : "No SMS notifications have been dispatched in the last 24 hours. When a payment issue or order alert occurs, it will display here automatically."}
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setTestModalOpen(true)}
                        className="mt-3 gap-2 border-primary/30 text-primary"
                      >
                        <Send className="size-3.5" />
                        Send Test Recovery SMS
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredLogs.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="font-medium">{getRelativeTime(item.created_at)}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {formatGhanaTime(item.created_at)}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 font-mono font-medium">
                        <span>{item.recipient}</span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(item.recipient, "Phone copied")}
                          className="text-muted-foreground hover:text-foreground"
                          title="Copy phone"
                        >
                          <Copy className="size-3" />
                        </button>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {item.reference ? (
                        <div className="flex items-center gap-1.5">
                          <Link
                            to={`/track?ref=${encodeURIComponent(item.reference)}`}
                            target="_blank"
                            className="font-mono font-semibold text-primary hover:underline flex items-center gap-1"
                          >
                            {item.reference}
                            <ExternalLink className="size-2.5 opacity-70" />
                          </Link>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(item.reference || "", "Reference copied")}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <Copy className="size-3" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-2 py-0.5 uppercase font-semibold ${
                          item.type === "payment_issue" || item.type === "test_payment_issue"
                            ? "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                            : item.type === "payment_received"
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : "border-border bg-muted/30 text-muted-foreground"
                        }`}
                      >
                        {item.type === "payment_issue"
                          ? "Payment Issue"
                          : item.type === "test_payment_issue"
                          ? "Test Recovery"
                          : item.type === "payment_received"
                          ? "Payment Received"
                          : item.type || "SMS"}
                      </Badge>
                    </td>

                    <td className="py-3.5 px-4">
                      <div
                        onClick={() => setSelectedLog(item)}
                        className="cursor-pointer max-w-md line-clamp-2 text-xs hover:text-primary transition-colors"
                        title="Click to view full message"
                      >
                        {item.message}
                      </div>
                      {item.error && (
                        <div className="mt-1 text-[11px] text-rose-500 flex items-center gap-1 font-medium">
                          <AlertCircle className="size-3 shrink-0" />
                          <span>Error: {item.error}</span>
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {item.status === "sent" ? (
                        <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 gap-1 hover:bg-emerald-500/20 font-medium text-[11px]">
                          <CheckCircle2 className="size-3" />
                          Sent
                        </Badge>
                      ) : (
                        <Badge className="bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 gap-1 hover:bg-rose-500/20 font-medium text-[11px]">
                          <AlertTriangle className="size-3" />
                          Failed
                        </Badge>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleResend(item)}
                          disabled={resendingId === item.id}
                          className="h-7 px-2.5 text-xs gap-1 hover:bg-primary/10 hover:text-primary"
                        >
                          {resendingId === item.id ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : (
                            <SendHorizonal className="size-3" />
                          )}
                          Resend
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Selected Log Preview Modal */}
      {selectedLog && (
        <Dialog open={Boolean(selectedLog)} onOpenChange={() => setSelectedLog(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <span>SMS Notification Details</span>
                <Badge
                  className={
                    selectedLog.status === "sent"
                      ? "bg-emerald-500/15 text-emerald-600 border border-emerald-500/30"
                      : "bg-rose-500/15 text-rose-600 border border-rose-500/30"
                  }
                >
                  {selectedLog.status === "sent" ? "Sent / Delivered" : "Delivery Failed"}
                </Badge>
              </DialogTitle>
              <DialogDescription>
                Dispatched at {formatGhanaTime(selectedLog.created_at)}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3.5 py-2 text-xs">
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground uppercase">Recipient</label>
                <div className="font-mono text-sm font-bold flex items-center justify-between mt-0.5">
                  <span>{selectedLog.recipient}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(selectedLog.recipient, "Phone copied")}
                    className="h-6 px-2 text-xs"
                  >
                    <Copy className="size-3 mr-1" /> Copy
                  </Button>
                </div>
              </div>

              {selectedLog.reference && (
                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground uppercase">Order Reference</label>
                  <div className="font-mono text-sm font-semibold text-primary mt-0.5 flex items-center justify-between">
                    <span>{selectedLog.reference}</span>
                    <Button asChild variant="outline" size="sm" className="h-6 px-2 text-xs">
                      <Link to={`/track?ref=${encodeURIComponent(selectedLog.reference)}`} target="_blank">
                        Track Order <ExternalLink className="size-2.5 ml-1" />
                      </Link>
                    </Button>
                  </div>
                </div>
              )}

              <div>
                <label className="text-[11px] font-semibold text-muted-foreground uppercase">
                  Message Content ({selectedLog.message.length} chars)
                </label>
                <div className="mt-1 p-3 rounded-lg bg-muted/60 border text-foreground leading-relaxed whitespace-pre-wrap font-sans">
                  {selectedLog.message}
                </div>
              </div>

              {selectedLog.error && (
                <div className="p-2.5 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400">
                  <div className="font-bold flex items-center gap-1.5 mb-1">
                    <AlertCircle className="size-3.5" /> Gateway Rejection Reason:
                  </div>
                  <div className="font-mono text-[11px] break-all">{selectedLog.error}</div>
                </div>
              )}
            </div>

            <DialogFooter className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => copyToClipboard(selectedLog.message, "Message copied to clipboard")}
                className="gap-1.5 text-xs flex-1"
              >
                <Copy className="size-3.5" /> Copy Message
              </Button>
              <Button
                onClick={() => handleResend(selectedLog)}
                disabled={resendingId === selectedLog.id}
                className="gap-1.5 text-xs flex-1 bg-gradient-gold text-accent-foreground font-bold hover:opacity-90"
              >
                {resendingId === selectedLog.id ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
                Resend to Customer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Test SMS Modal */}
      <Dialog open={testModalOpen} onOpenChange={setTestModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Send Test Payment Recovery SMS</DialogTitle>
            <DialogDescription>
              Sends a live test notification to verify Arkesel delivery and test your SMS credits immediately.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div>
              <label className="font-semibold text-foreground">Destination Phone Number</label>
              <Input
                placeholder="e.g. 0547100951 or 0241234567"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                className="mt-1 font-mono text-sm"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Enter your Ghana phone number to receive the test SMS. Sender ID used: <strong>D_1Gh</strong>.
              </p>
            </div>

            <div>
              <label className="font-semibold text-foreground mb-1 block">Store / Brand Format</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTestMode("agent")}
                  className={`p-2.5 rounded-lg border text-left transition-all ${
                    testMode === "agent"
                      ? "border-primary bg-primary/10 font-bold text-primary"
                      : "border-border bg-muted/30 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <div className="text-xs font-semibold">Agent Store (GoodData)</div>
                  <div className="text-[10px] opacity-75 font-mono">gooddata1.vercel.app/s/...</div>
                </button>
                <button
                  type="button"
                  onClick={() => setTestMode("main")}
                  className={`p-2.5 rounded-lg border text-left transition-all ${
                    testMode === "main"
                      ? "border-primary bg-primary/10 font-bold text-primary"
                      : "border-border bg-muted/30 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <div className="text-xs font-semibold">Data1GH Direct</div>
                  <div className="text-[10px] opacity-75 font-mono">www.data1gh.com/track</div>
                </button>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-muted/60 border text-[11px] text-muted-foreground space-y-1">
              <div className="font-semibold text-foreground flex items-center justify-between">
                <span>Sample Message Preview:</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-background border font-mono">
                  {testMode === "agent" ? "Agent Storefront Link" : "Direct Main Link"}
                </span>
              </div>
              <p className="italic leading-relaxed">
                {testMode === "agent"
                  ? `"Dear customer, your payment of GHS 4.30 for 1GB MTN Data could not complete due to low MoMo wallet balance. Top up your wallet & complete here: https://gooddata1.vercel.app/s/senerity-data?ref=TEST-XXXX - Senerity Data"`
                  : `"Dear customer, your payment of GHS 4.30 for 1GB MTN Data could not complete due to low MoMo wallet balance. Top up your wallet & complete here: https://www.data1gh.com/track?ref=TEST-XXXX - Data1GH"`}
              </p>
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setTestModalOpen(false)} className="text-xs">
              Cancel
            </Button>
            <Button
              onClick={handleTestSms}
              disabled={testSending}
              className="text-xs bg-gradient-gold text-accent-foreground font-bold hover:opacity-90"
            >
              {testSending ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : <Send className="size-3.5 mr-1.5" />}
              Send Test SMS Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clear All Confirmation Modal */}
      <Dialog open={clearModalOpen} onOpenChange={setClearModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-rose-600 flex items-center gap-2">
              <Trash2 className="size-5" /> Clear SMS Logs
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to clear all SMS notification records? Note that logs are automatically purged after 24 hours regardless.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setClearModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleClearLogs}
              disabled={clearing}
              className="gap-1.5"
            >
              {clearing ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
              Yes, Clear Logs
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
