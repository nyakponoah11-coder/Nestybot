import { useEffect, useMemo, useState, useRef } from "react";
import { Loader2, MessageSquareText, RefreshCw, Save, Send, Users, ShieldAlert, Filter, Sparkles, Trash2, CheckCircle2, Store, Briefcase, ShieldCheck, Check } from "lucide-react";
import { invokeApiFunction, supabase as typedSupabase } from "@/integrations/supabase/client";
import { getCacheMeta, setCache, invalidateCache } from "@/lib/localCache";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = typedSupabase as any;
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

// Normalizes and extracts unique valid Ghana numbers (formatted as 0XXXXXXXXX)
const splitNumbers = (value: string): string[] => {
  return Array.from(new Set(
    value.split(/[\s,;]+/)
      .map(number => number.trim())
      .filter(number => /^(?:0\d{9}|233\d{9}|\+233\d{9})$/.test(number))
      .map(number => number.startsWith("+233") ? "0" + number.slice(4) : number.startsWith("233") ? "0" + number.slice(3) : number)
  ));
};

const readSavedNumbers = (value: unknown): string[] => {
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return splitNumbers(Array.isArray(parsed) ? parsed.map(String).join("\n") : value);
  } catch {
    return splitNumbers(value);
  }
};

const AdminBulkSms = () => {
  const [savedNumbers, setSavedNumbers] = useState<string[]>([]);
  const [directCustomerNumbers, setDirectCustomerNumbers] = useState<string[]>([]);
  const [agentNumbers, setAgentNumbers] = useState<string[]>([]);
  const [agentCustomerNumbers, setAgentCustomerNumbers] = useState<string[]>([]);
  const [audienceFilter, setAudienceFilter] = useState<"direct" | "agents" | "agent_customers" | "saved" | "all">("direct");
  const [excludeAgentsFromDirect, setExcludeAgentsFromDirect] = useState(true);

  const [newNumber, setNewNumber] = useState("");
  const [savingNumber, setSavingNumber] = useState(false);
  const [recipients, setRecipients] = useState("");
  const [senderId, setSenderId] = useState(() => {
    const saved = localStorage.getItem("arkesel_sender_id");
    if (!saved || saved.toLowerCase() === "data1gh") {
      return "D_1Gh";
    }
    return saved;
  });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);

  // Raw non-empty entries entered into the textarea
  const rawEntries = useMemo(() => {
    return recipients
      .split(/[\r\n,;]+/)
      .map(n => n.trim())
      .filter(Boolean);
  }, [recipients]);

  // Unique valid phone numbers
  const recipientList = useMemo(() => splitNumbers(recipients), [recipients]);

  // Number of repeaters / duplicates detected
  const duplicateCount = useMemo(() => {
    return Math.max(0, rawEntries.length - recipientList.length);
  }, [rawEntries.length, recipientList.length]);

  const loadNumbers = async (force = false) => {
    setLoading(true);
    let finalSaved: string[] = [];
    let finalSender = senderId;

    try {
      const [ordersResponse, whatsappResponse, settingsResponse, agentsResponse, agentOrdersResponse] = await Promise.all([
        invokeApiFunction("admin-data", { body: { action: "listOrders" } }),
        invokeApiFunction("whatsapp-orders").catch(() => ({ data: { orders: [] } })),
        invokeApiFunction("admin-data", { body: { action: "getSettings" } }),
        invokeApiFunction("admin-agents", { body: { action: "adminGetAgents" } }).catch(() => ({ data: { agents: [] } })),
        invokeApiFunction("admin-agents", { body: { action: "adminGetOrders" } }).catch(() => ({ data: { orders: [] } })),
      ]);

      const sMap: Record<string, string> = {};
      (settingsResponse.data?.settings || []).forEach((r: any) => (sMap[r.key] = r.value || ""));
      const saved = readSavedNumbers(sMap.bulk_sms_saved_numbers);
      finalSaved = saved;
      setSavedNumbers(saved);

      const savedSender = sMap["arkesel_sender_id"] || sMap["ARKESEL_SENDER_ID"];
      if (savedSender && savedSender.trim()) {
        finalSender = savedSender;
        setSenderId(savedSender);
        localStorage.setItem("arkesel_sender_id", savedSender);
      } else {
        finalSender = "D_1Gh";
        setSenderId("D_1Gh");
        localStorage.setItem("arkesel_sender_id", "D_1Gh");
      }

      // 1. Extract Agent Phone Numbers (The Reseller Owners)
      const rawAgentPhones: string[] = [];
      const agentsList = agentsResponse.data?.agents || [];
      if (Array.isArray(agentsList)) {
        agentsList.forEach((ag: any) => {
          if (ag.phone) rawAgentPhones.push(String(ag.phone));
          if (ag.whatsapp_phone) rawAgentPhones.push(String(ag.whatsapp_phone));
        });
      }
      const pureAgentPhones = splitNumbers(rawAgentPhones.join("\n"));
      setAgentNumbers(pureAgentPhones);

      // 2. Extract Agent Customers (Customers who bought from agent stores)
      const rawAgentCustomerPhones: string[] = [];
      const agentOrdersList = agentOrdersResponse.data?.orders || [];
      if (Array.isArray(agentOrdersList)) {
        agentOrdersList.forEach((o: any) => {
          const p = o.recipient_phone || o.customer_phone || o.phone;
          if (p) rawAgentCustomerPhones.push(String(p));
        });
      }

      // Also check main orders for any tagged with agent_id or [agent:
      const allOrders = ordersResponse.data?.orders || [];
      const rawDirectPhones: string[] = [];
      allOrders.forEach((o: any) => {
        const phone = o.recipient_phone || o.phone_number || o.whatsapp_phone || o.customer_phone || o.phone;
        if (!phone) return;
        const isAgentOrder = Boolean(
          o.agent_id ||
          String(o.notes || "").includes("[agent:") ||
          String(o.reference || "").startsWith("agord-") ||
          String(o.ref || "").startsWith("agord-")
        );
        if (isAgentOrder) {
          rawAgentCustomerPhones.push(String(phone));
        } else {
          rawDirectPhones.push(String(phone));
        }
      });

      const pureAgentCustomerPhones = splitNumbers(rawAgentCustomerPhones.join("\n"));
      setAgentCustomerNumbers(pureAgentCustomerPhones);

      // 3. Extract Direct Store Customers (Exclude any agent or agent customer!)
      const fromWhatsApp = (whatsappResponse.data?.orders || []).map((o: any) => o.phone).filter(Boolean);
      rawDirectPhones.push(...fromWhatsApp);

      // Fallback queries for service orders, checkers, free data
      try {
        const [sRes, cRes, fRes] = await Promise.all([
          supabase.from("service_orders").select("customer_phone").limit(300).catch(() => ({ data: [] })),
          supabase.from("checker_orders").select("customer_phone").limit(300).catch(() => ({ data: [] })),
          supabase.from("free_data_codes").select("claimed_by_phone").limit(200).catch(() => ({ data: [] })),
        ]);
        (sRes?.data || []).forEach((s: any) => s.customer_phone && rawDirectPhones.push(s.customer_phone));
        (cRes?.data || []).forEach((c: any) => c.customer_phone && rawDirectPhones.push(c.customer_phone));
        (fRes?.data || []).forEach((f: any) => f.claimed_by_phone && rawDirectPhones.push(f.claimed_by_phone));
      } catch (_) {}

      const agentBlacklist = new Set([...pureAgentPhones, ...pureAgentCustomerPhones]);
      const pureDirectPhones = splitNumbers(rawDirectPhones.join("\n")).filter(p => !agentBlacklist.has(p));
      setDirectCustomerNumbers(pureDirectPhones);

      // Default active recipients based on current audience filter
      if (audienceFilter === "direct") {
        setRecipients(pureDirectPhones.join("\n"));
      } else if (audienceFilter === "agents") {
        setRecipients(pureAgentPhones.join("\n"));
      } else if (audienceFilter === "agent_customers") {
        setRecipients(pureAgentCustomerPhones.join("\n"));
      } else if (audienceFilter === "saved") {
        setRecipients(saved.join("\n"));
      } else {
        const allCombined = splitNumbers([...pureDirectPhones, ...pureAgentPhones, ...pureAgentCustomerPhones, ...saved].join("\n"));
        setRecipients(allCombined.join("\n"));
      }

    } catch (err) {
      console.warn("Error loading contact segments:", err);
    } finally {
      setLoading(false);
    }
  };

  const selectAudience = (type: "direct" | "agents" | "agent_customers" | "saved" | "all") => {
    setAudienceFilter(type);
    if (type === "direct") {
      setRecipients(directCustomerNumbers.join("\n"));
      toast.info(`Switched to Direct Store Customers (${directCustomerNumbers.length} numbers). Agents & their customers excluded.`);
    } else if (type === "agents") {
      setRecipients(agentNumbers.join("\n"));
      toast.info(`Switched to Registered Agents only (${agentNumbers.length} numbers).`);
    } else if (type === "agent_customers") {
      setRecipients(agentCustomerNumbers.join("\n"));
      toast.info(`Switched to Agent Customers (${agentCustomerNumbers.length} numbers).`);
    } else if (type === "saved") {
      setRecipients(savedNumbers.join("\n"));
      toast.info(`Switched to Saved Contacts (${savedNumbers.length} numbers).`);
    } else if (type === "all") {
      const combined = splitNumbers([...directCustomerNumbers, ...agentNumbers, ...agentCustomerNumbers, ...savedNumbers].join("\n"));
      setRecipients(combined.join("\n"));
      toast.info(`Switched to All Contacts (${combined.length} numbers).`);
    }
  };

  useEffect(() => { loadNumbers(false); }, []);

  const handleSenderChange = (val: string) => {
    const trimmed = val.slice(0, 11);
    setSenderId(trimmed);
    localStorage.setItem("arkesel_sender_id", trimmed);
  };

  // Filter repeaters action: merges all duplicated numbers into unique numbers
  const filterRepeaters = () => {
    const unique = splitNumbers(recipients);
    if (!recipients.trim() || unique.length === 0) {
      toast.info("No numbers to filter");
      return;
    }
    const removedCount = rawEntries.length - unique.length;
    setRecipients(unique.join("\n"));
    if (removedCount > 0) {
      toast.success(`Repeaters filtered! Merged ${removedCount} duplicate${removedCount === 1 ? "" : "s"} into 1. Total: ${unique.length} unique numbers.`);
    } else {
      toast.success(`All ${unique.length} numbers are already 100% unique! No repeaters found.`);
    }
  };

  // Bulk save numbers: accepts single number OR multiple numbers at once
  const saveBulkNumbers = async () => {
    const parsed = splitNumbers(newNumber);
    if (parsed.length === 0) {
      toast.error("Please enter or paste at least one valid Ghana phone number (e.g. 0241234567)");
      return;
    }

    setSavingNumber(true);
    try {
      // Merge with existing saved contacts
      const nextSaved = Array.from(new Set([...savedNumbers, ...parsed]));
      const newlyAdded = nextSaved.length - savedNumbers.length;

      const { data, error } = await invokeApiFunction("admin-data", {
        body: {
          action: "saveSettings",
          settings: [{ key: "bulk_sms_saved_numbers", value: JSON.stringify(nextSaved) }],
        },
      });
      if (error || data?.error) throw new Error(error?.message || data?.error || "Could not save numbers");

      setSavedNumbers(nextSaved);
      // Append to active recipients
      setRecipients(current => splitNumbers(`${current}\n${parsed.join("\n")}`).join("\n"));
      setNewNumber("");

      if (newlyAdded > 0) {
        toast.success(`Successfully saved ${newlyAdded} new number${newlyAdded === 1 ? "" : "s"}! (${nextSaved.length} total saved contacts)`);
      } else {
        toast.info(`All ${parsed.length} numbers are already saved in contacts and added to recipients.`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save numbers");
    } finally {
      setSavingNumber(false);
    }
  };

  // Send SMS strictly ONCE with in-flight protection and clean reload
  const sendBulkSms = async () => {
    if (sendingRef.current || sending) return;
    if (!recipientList.length) { toast.error("Add at least one recipient"); return; }
    if (!message.trim()) { toast.error("Write a message first"); return; }
    if (!senderId.trim()) { toast.error("Please enter a Sender ID (max 11 characters)"); return; }

    // Deduplicate recipients strictly before sending
    let finalRecipients = Array.from(new Set(recipientList));

    // Shield: If on Direct mode and excludeAgentsFromDirect is checked, strictly strip any agent or agent customer
    if (audienceFilter === "direct" && excludeAgentsFromDirect) {
      const forbidden = new Set([...agentNumbers, ...agentCustomerNumbers]);
      const beforeCount = finalRecipients.length;
      finalRecipients = finalRecipients.filter(p => !forbidden.has(p));
      const removed = beforeCount - finalRecipients.length;
      if (removed > 0) {
        toast.info(`Shield active: ${removed} agent / agent customer numbers were automatically excluded.`);
      }
    }

    if (finalRecipients.length === 0) {
      toast.error("No valid recipients remain after filtering.");
      return;
    }

    sendingRef.current = true;
    setSending(true);

    try {
      const res = await invokeApiFunction("bulk-sms", {
        body: {
          recipients: finalRecipients,
          message: message.trim(),
          sender_id: senderId.trim(),
        },
      });

      if (res.error || res.data?.error) {
        throw new Error(res.data?.error || res.error?.message || "SMS sending failed");
      }

      const sentCount = res.data?.sent ?? finalRecipients.length;
      toast.success(`SMS successfully sent to ${sentCount} recipient${sentCount === 1 ? "" : "s"}!`);

      // Immediately clear everything as requested
      setRecipients("");
      setMessage("");
      setNewNumber("");

      // Reload the page cleanly after 1.5 seconds
      setTimeout(() => {
        window.location.reload();
      }, 1500);

    } catch (e: any) {
      toast.error(e?.message || "Failed to send bulk SMS");
      sendingRef.current = false;
      setSending(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black flex items-center gap-2">
            <MessageSquareText className="size-7 text-accent-foreground" /> Bulk SMS
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Send marketing or update SMS directly to your customers via Arkesel.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => loadNumbers(true)} disabled={loading || sending}>
          <RefreshCw className={`size-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh numbers
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        {/* Left Column: Recipients & Contact Management */}
        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <Label htmlFor="sms-recipients" className="font-bold flex items-center gap-2">
              <Users className="size-4" /> Recipients
            </Label>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                {recipientList.length} unique numbers
              </span>
              {/* Filter Repeaters Button */}
              <Button
                type="button"
                variant={duplicateCount > 0 ? "default" : "outline"}
                size="sm"
                onClick={filterRepeaters}
                disabled={loading || sending || recipientList.length === 0}
                className={`h-8 px-2.5 text-xs font-bold gap-1.5 shadow-sm active:scale-95 transition-all ${
                  duplicateCount > 0
                    ? "bg-amber-500 hover:bg-amber-600 text-black border-amber-600 animate-pulse"
                    : "border-border/60 hover:bg-accent/10"
                }`}
                title="Merge duplicate numbers into one"
              >
                <Filter className="size-3.5" />
                <span>Filter Repeaters</span>
                {duplicateCount > 0 && (
                  <span className="ml-1 px-1.5 py-0.2 rounded-full bg-black/80 text-amber-300 text-[10px] font-black">
                    {duplicateCount}
                  </span>
                )}
              </Button>
            </div>
          </div>

          {/* Audience Filter Selector */}
          <div className="space-y-2 p-3 rounded-xl bg-muted/20 border border-border/60">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                Target Audience:
              </span>
              {audienceFilter === "direct" && (
                <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer select-none text-emerald-500">
                  <input
                    type="checkbox"
                    checked={excludeAgentsFromDirect}
                    onChange={(e) => setExcludeAgentsFromDirect(e.target.checked)}
                    className="rounded border-border size-3.5 accent-emerald-500"
                  />
                  <span>Exclude Agent Numbers</span>
                </label>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 pt-1">
              {/* Option 1: Direct Store Customers */}
              <button
                type="button"
                onClick={() => selectAudience("direct")}
                className={`p-2.5 rounded-xl text-left border transition-all flex flex-col justify-between ${
                  audienceFilter === "direct"
                    ? "bg-emerald-500/15 border-emerald-500/50 text-foreground ring-1 ring-emerald-500/50 shadow-sm"
                    : "bg-muted/40 border-border/60 hover:bg-muted/70 text-muted-foreground"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold flex items-center gap-1">
                    <ShieldCheck className="size-3.5 text-emerald-500" /> Direct Store
                  </span>
                  {audienceFilter === "direct" && <Check className="size-3 text-emerald-500" />}
                </div>
                <span className="text-sm font-black font-mono mt-1 text-emerald-400">
                  {directCustomerNumbers.length} <span className="text-[10px] font-normal text-muted-foreground">customers</span>
                </span>
              </button>

              {/* Option 2: Registered Agents */}
              <button
                type="button"
                onClick={() => selectAudience("agents")}
                className={`p-2.5 rounded-xl text-left border transition-all flex flex-col justify-between ${
                  audienceFilter === "agents"
                    ? "bg-purple-500/15 border-purple-500/50 text-foreground ring-1 ring-purple-500/50 shadow-sm"
                    : "bg-muted/40 border-border/60 hover:bg-muted/70 text-muted-foreground"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold flex items-center gap-1">
                    <Briefcase className="size-3.5 text-purple-400" /> Agents Only
                  </span>
                  {audienceFilter === "agents" && <Check className="size-3 text-purple-400" />}
                </div>
                <span className="text-sm font-black font-mono mt-1 text-purple-400">
                  {agentNumbers.length} <span className="text-[10px] font-normal text-muted-foreground">resellers</span>
                </span>
              </button>

              {/* Option 3: Agent Customers */}
              <button
                type="button"
                onClick={() => selectAudience("agent_customers")}
                className={`p-2.5 rounded-xl text-left border transition-all flex flex-col justify-between ${
                  audienceFilter === "agent_customers"
                    ? "bg-blue-500/15 border-blue-500/50 text-foreground ring-1 ring-blue-500/50 shadow-sm"
                    : "bg-muted/40 border-border/60 hover:bg-muted/70 text-muted-foreground"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold flex items-center gap-1">
                    <Store className="size-3.5 text-blue-400" /> Agent Customers
                  </span>
                  {audienceFilter === "agent_customers" && <Check className="size-3 text-blue-400" />}
                </div>
                <span className="text-sm font-black font-mono mt-1 text-blue-400">
                  {agentCustomerNumbers.length} <span className="text-[10px] font-normal text-muted-foreground">buyers</span>
                </span>
              </button>

              {/* Option 4: Saved Numbers */}
              <button
                type="button"
                onClick={() => selectAudience("saved")}
                className={`p-2.5 rounded-xl text-left border transition-all flex flex-col justify-between ${
                  audienceFilter === "saved"
                    ? "bg-amber-500/15 border-amber-500/50 text-foreground ring-1 ring-amber-500/50 shadow-sm"
                    : "bg-muted/40 border-border/60 hover:bg-muted/70 text-muted-foreground"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold flex items-center gap-1">
                    <Save className="size-3.5 text-amber-400" /> Saved Contacts
                  </span>
                  {audienceFilter === "saved" && <Check className="size-3 text-amber-400" />}
                </div>
                <span className="text-sm font-black font-mono mt-1 text-amber-400">
                  {savedNumbers.length} <span className="text-[10px] font-normal text-muted-foreground">contacts</span>
                </span>
              </button>

              {/* Option 5: All Contacts */}
              <button
                type="button"
                onClick={() => selectAudience("all")}
                className={`p-2.5 rounded-xl text-left border transition-all flex flex-col justify-between col-span-2 sm:col-span-1 ${
                  audienceFilter === "all"
                    ? "bg-accent/20 border-accent text-foreground ring-1 ring-accent shadow-sm"
                    : "bg-muted/40 border-border/60 hover:bg-muted/70 text-muted-foreground"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold flex items-center gap-1">
                    <Users className="size-3.5 text-accent" /> All Combined
                  </span>
                  {audienceFilter === "all" && <Check className="size-3 text-accent" />}
                </div>
                <span className="text-sm font-black font-mono mt-1 text-accent">
                  {directCustomerNumbers.length + agentNumbers.length + agentCustomerNumbers.length + savedNumbers.length} <span className="text-[10px] font-normal text-muted-foreground">total</span>
                </span>
              </button>
            </div>

            {/* Audience Context Alert */}
            {audienceFilter === "direct" && (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-[11px] text-emerald-400 font-medium">
                <CheckCircle2 className="size-3.5 shrink-0 text-emerald-400" />
                <span>
                  <b>Direct Store Customers:</b> Agent phone numbers and agent customers are <b>100% excluded</b>.
                </span>
              </div>
            )}
            {audienceFilter === "agents" && (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-purple-500/10 border border-purple-500/30 text-[11px] text-purple-400 font-medium">
                <Briefcase className="size-3.5 shrink-0 text-purple-400" />
                <span>
                  <b>Agents Only:</b> Sending exclusively to your registered agent store owners.
                </span>
              </div>
            )}
            {audienceFilter === "agent_customers" && (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-blue-500/10 border border-blue-500/30 text-[11px] text-blue-400 font-medium">
                <Store className="size-3.5 shrink-0 text-blue-400" />
                <span>
                  <b>Agent Customers:</b> Sending exclusively to customers who bought through your agents&rsquo; stores.
                </span>
              </div>
            )}
          </div>

          {/* Repeaters detected alert if any */}
          {duplicateCount > 0 && (
            <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-400">
              <span className="flex items-center gap-1.5 font-medium">
                <Sparkles className="size-3.5 shrink-0" />
                {duplicateCount} repeater{duplicateCount === 1 ? "" : "s"} detected in recipient list.
              </span>
              <button
                type="button"
                onClick={filterRepeaters}
                className="font-bold underline hover:opacity-80 shrink-0"
              >
                Merge now
              </button>
            </div>
          )}

          <Textarea
            id="sms-recipients"
            value={recipients}
            onChange={event => setRecipients(event.target.value)}
            onBlur={() => setRecipients(recipientList.join("\n"))}
            rows={12}
            placeholder="Paste or enter phone numbers (separated by lines, commas, or spaces)&#10;e.g.&#10;0241234567&#10;0559876543"
            className="font-mono text-sm"
          />

          {/* Bulk Number Saver Box */}
          <div className="space-y-2 pt-2 border-t border-border/50">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-muted-foreground">
                Save Numbers to Saved Contacts (Single or Bulk)
              </Label>
              {savedNumbers.length > 0 && (
                <span className="text-[11px] text-muted-foreground font-mono">
                  {savedNumbers.length} saved
                </span>
              )}
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Textarea
                value={newNumber}
                onChange={event => setNewNumber(event.target.value)}
                placeholder="Paste 1 or 10+ numbers to save at once (comma, space or line separated)..."
                rows={2}
                className="font-mono text-xs resize-none"
                aria-label="Numbers to save"
              />
              <Button
                variant="outline"
                onClick={saveBulkNumbers}
                disabled={savingNumber || loading || !newNumber.trim()}
                className="sm:self-stretch font-bold text-xs gap-1.5 shrink-0"
              >
                {savingNumber ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                <span>Save Numbers</span>
              </Button>
            </div>
          </div>

          {savedNumbers.length > 0 && (
            <div className="max-h-24 overflow-y-auto rounded-xl border border-border/50 bg-muted/20 p-2.5 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">Saved contacts ({savedNumbers.length}):</span>{" "}
              {savedNumbers.join(", ")}
            </div>
          )}

          <p className="text-[11px] text-muted-foreground">
            Auto-loaded from past shop orders and WhatsApp chats. You can paste more numbers, save bulk contacts, or click <strong>Filter Repeaters</strong> to remove duplicates.
          </p>
        </Card>

        {/* Right Column: Sender ID, Message & Send Button */}
        <Card className="p-5 space-y-4">
          <div>
            <div className="flex items-center justify-between gap-2 mb-1">
              <Label htmlFor="sms-sender-id" className="font-bold">Sender ID</Label>
              <span className="text-xs text-muted-foreground">{senderId.length}/11 chars</span>
            </div>
            <Input
              id="sms-sender-id"
              value={senderId}
              onChange={e => handleSenderChange(e.target.value)}
              placeholder="e.g. D_1GH"
              maxLength={11}
              className="font-semibold uppercase tracking-wider"
            />
            <p className="text-xs text-muted-foreground mt-1">
              The name shown as the SMS sender on customers&apos; phones (max 11 characters approved in your Arkesel dashboard).
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between gap-3 mb-1">
              <Label htmlFor="sms-message" className="font-bold">Message</Label>
              <span className={`text-xs ${message.length > 1600 ? "text-destructive font-bold" : "text-muted-foreground"}`}>
                {message.length} chars ({Math.ceil(message.length / 160) || 1} SMS)
              </span>
            </div>
            <Textarea
              id="sms-message"
              value={message}
              onChange={event => setMessage(event.target.value.slice(0, 1600))}
              rows={8}
              maxLength={1600}
              placeholder="Type your message here... e.g. Exclusive MTN and Telecel data discounts now live at Data One! Visit data1gh.com"
            />
          </div>

          <div className="rounded-xl border border-border/60 bg-muted/40 p-3 text-xs text-muted-foreground flex items-start gap-2">
            <ShieldAlert className="size-4 shrink-0 text-amber-500 mt-0.5" />
            <div>
              Requires <strong className="text-foreground font-mono">ARKESEL_API_KEY</strong> set in Supabase Secrets or Vercel.
            </div>
          </div>

          <Button
            className="w-full bg-gradient-gold text-accent-foreground font-bold hover:opacity-90 shadow-md h-11"
            onClick={sendBulkSms}
            disabled={sending || loading || !recipientList.length || !message.trim()}
          >
            {sending ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Send className="size-4 mr-2" />}
            {sending ? "Sending SMS via Arkesel..." : `Send SMS to ${recipientList.length} numbers`}
          </Button>
        </Card>
      </div>
    </div>
  );
};

export default AdminBulkSms;
