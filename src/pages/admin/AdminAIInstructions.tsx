import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  BrainCircuit,
  Save,
  Sparkles,
  Bot,
  Send,
  Loader2,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Copy,
  RefreshCw,
  Zap,
  ArrowRight,
  ShieldAlert,
  Sliders,
  MessageSquare,
  Plus,
  Trash2,
  Edit3,
  Check,
  Clock,
  Smartphone,
  ListOrdered,
  Users,
  Wallet,
  Play,
  Layers,
} from "lucide-react";
import { invokeApiFunction, supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface TriggerRule {
  id: string;
  trigger: string;
  matchType: "contains" | "exact" | "regex";
  responseType: "reply" | "action";
  replyText: string;
  actionType?: "query_delivery_times" | "query_top_customers" | "check_balances" | "list_recent_orders" | "lookup_phone";
  active: boolean;
}

export const DEFAULT_EXAMPLE_RULES: TriggerRule[] = [
  {
    id: "rule-delivery-time",
    trigger: "delivery time",
    matchType: "contains",
    responseType: "action",
    actionType: "query_delivery_times",
    replyText: "",
    active: true,
  },
  {
    id: "rule-most-orders",
    trigger: "most orders",
    matchType: "contains",
    responseType: "action",
    actionType: "query_top_customers",
    replyText: "",
    active: true,
  },
  {
    id: "rule-recent-orders",
    trigger: "recent orders",
    matchType: "contains",
    responseType: "action",
    actionType: "list_recent_orders",
    replyText: "",
    active: true,
  },
  {
    id: "rule-live-balance",
    trigger: "balance",
    matchType: "contains",
    responseType: "action",
    actionType: "check_balances",
    replyText: "",
    active: true,
  },
  {
    id: "rule-how-to-buy",
    trigger: "how to buy",
    matchType: "contains",
    responseType: "reply",
    actionType: "query_delivery_times",
    replyText: "🛒 *HOW TO BUY DATA ON DATA ONE:*\n\n1. Visit our store: https://www.data1gh.com\n2. Select your network (MTN, Telecel, or AT)\n3. Choose your bundle package\n4. Enter recipient phone number & complete Mobile Money payment\n\n⚡ Data bundle is dispatched automatically within 60 seconds!",
    active: true,
  },
  {
    id: "rule-payment-momo",
    trigger: "payment",
    matchType: "contains",
    responseType: "reply",
    actionType: "query_delivery_times",
    replyText: "💳 *OFFICIAL PAYMENT METHODS AT DATA ONE:*\n\n• Automated Instant Checkout: MTN MoMo, Telecel Cash & Cards directly on https://www.data1gh.com\n• Manual MoMo Support: 0547100951 (DATA ONE)\n\nAll payments are 100% automated and safe! ✅",
    active: true,
  },
];

export default function AdminAIInstructions() {
  const [activeTab, setActiveTab] = useState<"copilot" | "storefront">("copilot");

  // Storefront Instructions State
  const [instructions, setInstructions] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  // Connected providers overview
  const [aiStatus, setAiStatus] = useState<{
    gemini: boolean;
    groq: boolean;
    openai: boolean;
  }>({ gemini: false, groq: false, openai: false });

  // Co-Pilot & WhatsApp Trigger Training State
  const [copilotCustomDirectives, setCopilotCustomDirectives] = useState("");
  const [copilotTriggerRules, setCopilotTriggerRules] = useState<TriggerRule[]>(DEFAULT_EXAMPLE_RULES);
  const [savingCopilot, setSavingCopilot] = useState(false);

  // Trigger Rule Modal / Form State
  const [ruleModalOpen, setRuleModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<TriggerRule>({
    id: "",
    trigger: "",
    matchType: "contains",
    responseType: "action",
    replyText: "",
    actionType: "query_delivery_times",
    active: true,
  });

  // WhatsApp Sandbox Simulator State
  const [waTestQuery, setWaTestQuery] = useState("what is live delivery time from the site?");
  const [waTestResult, setWaTestResult] = useState<{ matched?: boolean; rule?: string; reply: string; source: string } | null>(null);
  const [testingWa, setTestingWa] = useState(false);

  // Storefront Chat Simulator State
  const [testQuestion, setTestQuestion] = useState("how is delivery on your site?");
  const [testReply, setTestReply] = useState<string | null>(null);
  const [testProvider, setTestProvider] = useState<string | null>(null);
  const [testingAI, setTestingAI] = useState(false);

  useEffect(() => {
    fetchAllTraining();
  }, []);

  const fetchAllTraining = async () => {
    setLoading(true);
    setError("");

    try {
      const cached = localStorage.getItem("dataease_ai_instructions");
      if (cached) setInstructions(cached);
    } catch {}

    try {
      const { data: rows } = await supabase
        .from("settings")
        .select("key,value")
        .in("key", [
          "ai_system_instructions",
          "copilot_custom_instructions",
          "copilot_trigger_rules",
          "gemini_api_key",
          "groq_api_key",
          "grok_api_key",
          "openai_api_key",
        ]);

      const sMap: Record<string, string> = {};
      for (const r of rows || []) {
        if (r.key) sMap[r.key] = r.value ?? "";
      }

      if (sMap.ai_system_instructions !== undefined) {
        setInstructions(sMap.ai_system_instructions);
        try {
          localStorage.setItem("dataease_ai_instructions", sMap.ai_system_instructions);
        } catch {}
      }

      if (sMap.copilot_custom_instructions) {
        setCopilotCustomDirectives(sMap.copilot_custom_instructions);
      }

      if (sMap.copilot_trigger_rules) {
        try {
          const parsed = JSON.parse(sMap.copilot_trigger_rules);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setCopilotTriggerRules(parsed);
          } else {
            setCopilotTriggerRules(DEFAULT_EXAMPLE_RULES);
          }
        } catch (_) {
          setCopilotTriggerRules(DEFAULT_EXAMPLE_RULES);
        }
      } else {
        setCopilotTriggerRules(DEFAULT_EXAMPLE_RULES);
      }

      setAiStatus({
        gemini: Boolean(sMap.gemini_api_key),
        groq: Boolean(sMap.groq_api_key || sMap.grok_api_key),
        openai: Boolean(sMap.openai_api_key),
      });
    } catch (e: any) {
      setError(e?.message || "Failed to load instructions");
    } finally {
      setLoading(false);
    }
  };

  // Save Storefront Instructions
  const handleSaveStorefront = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setNotice("");
    setError("");

    try {
      localStorage.setItem("dataease_ai_instructions", instructions);
    } catch {}

    try {
      const res = await invokeApiFunction("admin-ai-settings", {
        body: {
          action: "saveAiSettings",
          ai_system_instructions: instructions,
        },
      });

      if (res?.data?.success) {
        setNotice("AI training directives saved successfully! All customer chats now reflect this updated logic.");
        toast.success("AI instructions saved successfully!");
        setSaving(false);
        return;
      }
    } catch (_) {}

    try {
      const { error: dbErr } = await supabase.from("settings").upsert(
        [{ key: "ai_system_instructions", value: instructions }],
        { onConflict: "key" }
      );
      if (dbErr) throw dbErr;

      setNotice("AI training directives saved successfully! All customer chats now reflect this updated logic.");
      toast.success("AI instructions saved successfully!");
    } catch (err: any) {
      setError(err?.message || "Failed to save AI training instructions");
      toast.error(err?.message || "Failed to save AI instructions");
    } finally {
      setSaving(false);
    }
  };

  // Save Co-Pilot & WhatsApp Rules
  const handleSaveCopilotTraining = async () => {
    setSavingCopilot(true);
    try {
      const rows = [
        { key: "copilot_custom_instructions", value: copilotCustomDirectives },
        { key: "copilot_trigger_rules", value: JSON.stringify(copilotTriggerRules) },
      ];
      await supabase.from("settings").upsert(rows, { onConflict: "key" });
      toast.success("Co-Pilot & WhatsApp training rules saved live! Bot is ready.");
    } catch (e: any) {
      toast.error("Failed to save rules: " + (e?.message || "Error"));
    } finally {
      setSavingCopilot(false);
    }
  };

  const handleSaveRule = () => {
    if (!editingRule.trigger.trim()) {
      toast.error("Please provide what the WhatsApp request phrase is (e.g. 'delivery time')");
      return;
    }
    if (editingRule.responseType === "reply" && !editingRule.replyText.trim()) {
      toast.error("Please enter the response Stony should give for this request");
      return;
    }

    if (editingRule.id) {
      setCopilotTriggerRules((prev) =>
        prev.map((r) => (r.id === editingRule.id ? { ...editingRule, id: editingRule.id } : r))
      );
      toast.success("Rule updated! Tap 'Save All Training' to apply.");
    } else {
      const newId = `rule-${Date.now()}`;
      setCopilotTriggerRules((prev) => [...prev, { ...editingRule, id: newId }]);
      toast.success("New rule added! Tap 'Save All Training' to apply.");
    }
    setRuleModalOpen(false);
  };

  const handleDeleteRule = (id: string) => {
    setCopilotTriggerRules((prev) => prev.filter((r) => r.id !== id));
    toast.success("Rule removed. Remember to tap 'Save All Training'.");
  };

  const handleToggleRule = (id: string) => {
    setCopilotTriggerRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, active: !r.active } : r))
    );
  };

  const handleLoadExamples = () => {
    setCopilotTriggerRules(DEFAULT_EXAMPLE_RULES);
    toast.success("Loaded 6 ready-to-use example trigger rules! Tap 'Save All Training' to save them live.");
  };

  const handleApplyPreset = (preset: {
    trigger: string;
    responseType: "action" | "reply";
    actionType?: TriggerRule["actionType"];
    replyText?: string;
  }) => {
    const exists = copilotTriggerRules.some(
      (r) => r.trigger.toLowerCase() === preset.trigger.toLowerCase()
    );
    if (exists) {
      toast.info(`"${preset.trigger}" rule is already in your rules list!`);
      return;
    }
    const newRule: TriggerRule = {
      id: `rule-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      trigger: preset.trigger,
      matchType: "contains",
      responseType: preset.responseType,
      actionType: preset.actionType,
      replyText: preset.replyText || "",
      active: true,
    };
    setCopilotTriggerRules((prev) => [...prev, newRule]);
    toast.success(`Preset "${preset.trigger}" added! Tap "Save All Training" to apply.`);
  };

  // WhatsApp Test Playground
  const handleTestWhatsApp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const q = waTestQuery.trim();
    if (!q || testingWa) return;
    setTestingWa(true);
    setWaTestResult(null);

    // 1. Check local trigger rules first
    const matched = copilotTriggerRules.find((r) => {
      if (!r.active || !r.trigger) return false;
      const t = r.trigger.trim().toLowerCase();
      const text = q.toLowerCase();
      if (r.matchType === "exact") return text === t;
      if (r.matchType === "regex") {
        try {
          return new RegExp(t, "i").test(q);
        } catch (_) {
          return false;
        }
      }
      return text.includes(t);
    });

    if (matched && matched.responseType === "reply") {
      setWaTestResult({
        matched: true,
        rule: matched.trigger,
        reply: matched.replyText,
        source: "Custom Trained Response",
      });
      setTestingWa(false);
      return;
    }

    // 2. Query backend to test real site Co-Pilot execution
    try {
      const res = await invokeApiFunction("admin-ai", {
        body: {
          action: "aiCoPilotChat",
          message: q,
          history: [],
          source: "playground_test",
        },
      });

      if (res.data?.ok && res.data.reply) {
        setWaTestResult({
          matched: Boolean(res.data.executed || matched),
          rule: res.data.action_type || (matched ? matched.trigger : undefined),
          reply: res.data.reply,
          source: res.data.executed ? "Real-time Live Data Action" : `Co-Pilot AI (${res.data.provider || "Gemini"})`,
        });
      } else {
        // Direct call fallback to whatsapp-bot endpoint
        const botRes = await fetch("/api/whatsapp-bot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: q, phone: "233547100951" }),
        });
        const bData = await botRes.json();
        setWaTestResult({
          matched: Boolean(bData.matched_rule),
          rule: bData.matched_rule,
          reply: bData.reply || bData.text || "No reply",
          source: "WhatsApp Bot Engine",
        });
      }
    } catch (err: any) {
      setWaTestResult({
        matched: false,
        reply: "Error executing test: " + err?.message,
        source: "Error",
      });
    } finally {
      setTestingWa(false);
    }
  };

  // Test Customer Care AI Prompt
  const handleTestPrompt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testQuestion.trim() || testingAI) return;

    setTestingAI(true);
    setTestReply(null);
    setTestProvider(null);

    try {
      const res = await invokeApiFunction("ai-chat", {
        body: {
          message: testQuestion.trim(),
          history: [],
        },
      });

      const data = res?.data || {};
      setTestReply(data.reply || "No reply generated");
      setTestProvider(
        data.provider
          ? `${data.provider.toUpperCase()} (${data.modelUsed || "active model"})`
          : "System Fallback"
      );
    } catch (err: any) {
      setTestReply(`Test request failed: ${err?.message || "Unknown error"}`);
      setTestProvider("Error Handler");
    } finally {
      setTestingAI(false);
    }
  };

  const DEFAULT_MASTER_TRAINING = `=== DATA ONE OFFICIAL AI MASTER TRAINING & BEHAVIOR DIRECTIVES ===

1. TALK LIKE A REAL HUMAN BEING & NEVER LOOP:
   - You represent Data One as Kofi (or Stony), a warm, intelligent Ghanaian customer support executive and advisor.
   - NEVER sound like a canned robot or an automated menu. Never say "As an AI language model" or repeat robotic bulleted scripts.
   - Every reply must be uniquely crafted, responsive to the user's emotions, and fresh.

2. ANSWER ANY QUESTION AT THE FRONT END (OPEN-MINDED WISDOM):
   - Answer ANY question the visitor asks — general life, advice, tech, football, Ghanaian news, weather, study tips, or casual banter.
   - Speak thoughtfully, politely, and warmly like a real person. Never say "I only answer data questions". Engage genuinely!

3. THE GOLDEN BUSINESS BRIDGE (ALWAYS COME BACK TO STORE):
   - After answering whatever question the visitor asked, gracefully, warmly, and naturally transition the conversation back to the business!
   - Examples:
     • "Chale, that match was intense! By the way bossu, make sure your data doesn't finish while watching the highlights — we've got super fast MTN, Telecel and AT data that delivers in 60 seconds!"
     • "Haha that's very true bossu! Are you looking to top up any non-expiry data for your phone today too?"
     • "Glad I could assist! Let me know if you want to check our data bundle rates or track an order while you're here."

4. EMOTION ATTUNEMENT & ANTI-SCAM REASSURANCE:
   - If a customer is anxious, panicked, or asking "is this real or scam": Immediately reassure them warmly that Data One is a 100% verified, registered, and legitimate automated platform. Assure them their money is completely safe and their transaction is protected.
   - If a customer is upset about delay: Acknowledge their frustration with genuine empathy. Never blame the customer. Explain calmly that automated telecom queues occasionally experience brief network spikes (5 to 15 mins) and guide them to track their order.

5. SPEED & DELIVERY EXPECTATION:
   - Normal delivery is fully automated: 15 to 60 seconds once payment is verified.
   - Peak hours / telecom maintenance: Can take 5 to 15 minutes.
   - Always encourage customers to dial telecom balance shortcodes directly (*138# for MTN, *126# for Telecel, *124# for AT) because telecom SMS notifications often lag behind actual delivery!

6. PRICING & NETWORKS:
   - You sell MTN Non-Expiry Turbo Data, Telecel Fast Data, and AT (AirtelTigo) Data.
   - Bundles are non-expiry and work on all 4G/5G/3G devices, modems, and routers.

7. WRONG NUMBER & REFUND PROTOCOL:
   - If a customer provided the wrong recipient number during checkout: Explain politely that telecom systems credit the entered number instantly and permanently, so transferred data cannot be pulled back or reversed once delivered. Urge customers to always double-check the recipient number before paying.
   - If a payment succeeds but telecom delivery fails permanently, reassure them that our system flags it for administrative review or automatic retry.

8. TONE & PRIVACY:
   - Strictly avoid rigid, robotic, repetitive canned responses. Every answer must feel natural, smart, and Ghanaian-friendly ("Hello bossu!", "Chief, no worries at all!").
   - Always protect user privacy: mask phone numbers (e.g., 024***1234).`;

  return (
    <div className="space-y-6 max-w-5xl pb-16">
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500">
              <BrainCircuit className="w-6 h-6" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
              AI Training &amp; Prompts
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Directly shape and train how the AI Co-Pilot (on WhatsApp &amp; Admin) and Customer Care AI think, fetch, and respond.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/admin/ai-agent"
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-secondary hover:bg-secondary/80 text-foreground font-black text-xs sm:text-sm border border-border transition-all"
          >
            <Bot className="w-4 h-4" />
            <span>AI Keys &amp; Models</span>
          </Link>
        </div>
      </div>

      {/* CONNECTED PROVIDERS STATUS BADGES */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3.5 rounded-2xl bg-card border border-border flex items-center gap-3">
          <div className={`p-2 rounded-xl ${aiStatus.gemini ? "bg-blue-500/20 text-blue-400" : "bg-muted text-muted-foreground"}`}>
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-foreground">Google Gemini</div>
            <div className="text-[11px] text-muted-foreground">
              {aiStatus.gemini ? "Connected & Active" : "Key Not Configured"}
            </div>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-card border border-border flex items-center gap-3">
          <div className={`p-2 rounded-xl ${aiStatus.groq ? "bg-amber-500/20 text-amber-400" : "bg-muted text-muted-foreground"}`}>
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-foreground">Groq Cloud / xAI</div>
            <div className="text-[11px] text-muted-foreground">
              {aiStatus.groq ? "Connected & Active" : "Key Not Configured"}
            </div>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-card border border-border flex items-center gap-3">
          <div className={`p-2 rounded-xl ${aiStatus.openai ? "bg-emerald-500/20 text-emerald-400" : "bg-muted text-muted-foreground"}`}>
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-foreground">OpenAI ChatGPT</div>
            <div className="text-[11px] text-muted-foreground">
              {aiStatus.openai ? "Connected & Active" : "Key Not Configured"}
            </div>
          </div>
        </div>
      </div>

      {/* NAVIGATION TABS */}
      <div className="flex border-b border-border gap-2 p-1 bg-muted/40 rounded-2xl">
        <button
          type="button"
          onClick={() => setActiveTab("copilot")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer ${
            activeTab === "copilot"
              ? "bg-amber-500 text-black shadow-md"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Smartphone className="w-4 h-4" />
          <span>WhatsApp &amp; Co-Pilot Rules</span>
          {copilotTriggerRules.filter((r) => r.active).length > 0 && (
            <span className="bg-black/20 text-[10px] px-2 py-0.5 rounded-full font-black">
              {copilotTriggerRules.filter((r) => r.active).length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("storefront")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer ${
            activeTab === "storefront"
              ? "bg-primary text-primary-foreground shadow-md"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>Storefront Live Chat Prompts</span>
        </button>
      </div>

      {/* ──────────────────────────────────────────────────────── */}
      {/* TAB 1: WHATSAPP BOT & CO-PILOT TRAINING RULES */}
      {/* ──────────────────────────────────────────────────────── */}
      {activeTab === "copilot" && (
        <div className="space-y-6">
          {/* Top Banner / Explanation */}
          <div className="p-5 rounded-3xl bg-amber-500/10 border border-amber-500/20 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-sm sm:text-base font-extrabold text-amber-400 flex items-center gap-2">
                  <Smartphone className="w-4 h-4" />
                  Train What WhatsApp &amp; Co-Pilot Should Give or Send
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Configure custom if-then triggers: If someone asks on WhatsApp for <strong>delivery time</strong>, <strong>most orders</strong>, or <strong>custom questions</strong>, specify exactly what Stony should fetch and send!
                </p>
              </div>
              <button
                type="button"
                onClick={handleSaveCopilotTraining}
                disabled={savingCopilot}
                className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs transition-all shadow-md shrink-0 cursor-pointer disabled:opacity-50"
              >
                {savingCopilot ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Save All Training</span>
                  </>
                )}
              </button>
            </div>

            {/* Quick Presets */}
            <div className="pt-2">
              <span className="text-[11px] font-bold text-muted-foreground block mb-2">
                ⚡ Quick 1-Click Preset Training (Tap to Add):
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    handleApplyPreset({
                      trigger: "delivery time",
                      responseType: "action",
                      actionType: "query_delivery_times",
                    })
                  }
                  className="p-2.5 rounded-xl bg-card/60 hover:bg-card border border-border hover:border-amber-500/40 text-left transition-all group cursor-pointer"
                >
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span>Live Delivery Time</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    If asked for delivery time, fetch live site &amp; gateway speed
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleApplyPreset({
                      trigger: "most orders",
                      responseType: "action",
                      actionType: "query_top_customers",
                    })
                  }
                  className="p-2.5 rounded-xl bg-card/60 hover:bg-card border border-border hover:border-amber-500/40 text-left transition-all group cursor-pointer"
                >
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                    <ListOrdered className="w-3.5 h-3.5 text-amber-400" />
                    <span>Most Orders / Top Customers</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    If asked for numbers with most orders, fetch rankings
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleApplyPreset({
                      trigger: "balance",
                      responseType: "action",
                      actionType: "check_balances",
                    })
                  }
                  className="p-2.5 rounded-xl bg-card/60 hover:bg-card border border-border hover:border-amber-500/40 text-left transition-all group cursor-pointer"
                >
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                    <Wallet className="w-3.5 h-3.5 text-amber-400" />
                    <span>Live Wallet Balance</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    If asked for balance, check DataMart &amp; Arkesel SMS live
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleApplyPreset({
                      trigger: "recent orders",
                      responseType: "action",
                      actionType: "list_recent_orders",
                    })
                  }
                  className="p-2.5 rounded-xl bg-card/60 hover:bg-card border border-border hover:border-amber-500/40 text-left transition-all group cursor-pointer"
                >
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                    <Users className="w-3.5 h-3.5 text-amber-400" />
                    <span>Latest Store Orders</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    If asked to fetch orders, return latest transactions list
                  </p>
                </button>
              </div>
            </div>
          </div>

          {/* Trigger Rules List */}
          <div className="rounded-3xl bg-card border border-border p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div>
                <h3 className="text-base font-extrabold text-foreground flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-amber-400" />
                  Configured WhatsApp Triggers ({copilotTriggerRules.length})
                </h3>
                <p className="text-xs text-muted-foreground">
                  The bot evaluates these rules first on incoming WhatsApp messages.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleLoadExamples}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground text-xs font-bold transition-all cursor-pointer border border-border"
                  title="Populate recommended starter example rules"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Load Example Rules</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingRule({
                      id: "",
                      trigger: "",
                      matchType: "contains",
                      responseType: "action",
                      actionType: "query_delivery_times",
                      replyText: "",
                      active: true,
                    });
                    setRuleModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition-all shadow-sm cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Trigger Rule</span>
                </button>
              </div>
            </div>

            {copilotTriggerRules.length === 0 ? (
              <div className="text-center py-10 space-y-3 text-muted-foreground">
                <p className="text-sm font-semibold">No custom trigger rules active right now.</p>
                <p className="text-xs max-w-md mx-auto">
                  Click the button below to load 6 ready-to-use example rules for live delivery time, most orders rankings, balances, and how to buy!
                </p>
                <button
                  type="button"
                  onClick={handleLoadExamples}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-black shadow-md cursor-pointer transition-all"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Load 6 Example Rules</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {copilotTriggerRules.map((rule, idx) => (
                  <div
                    key={rule.id || idx}
                    className={`p-4 rounded-2xl border transition-all ${
                      rule.active
                        ? "bg-muted/30 border-border hover:border-amber-500/40"
                        : "bg-muted/10 border-border/50 opacity-60"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-extrabold text-foreground">
                            When WhatsApp asks:
                          </span>
                          <span className="px-2.5 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 font-mono text-xs font-bold border border-amber-500/30">
                            "{rule.trigger}"
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground font-semibold uppercase">
                            {rule.matchType}
                          </span>
                          {!rule.active && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 font-bold">
                              Disabled
                            </span>
                          )}
                        </div>

                        <div className="text-xs text-muted-foreground flex items-center gap-1.5 pt-1">
                          <ArrowRight className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span className="font-semibold text-foreground">Give / Send:</span>
                          {rule.responseType === "action" ? (
                            <span className="text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                              ⚡ Live Dynamic Action:{" "}
                              {rule.actionType === "query_delivery_times"
                                ? "Live Accurate Delivery Time from Site"
                                : rule.actionType === "query_top_customers"
                                ? "Customer Numbers with Most Orders"
                                : rule.actionType === "check_balances"
                                ? "Live Wallet & SMS Balance"
                                : rule.actionType === "list_recent_orders"
                                ? "Latest Store Orders List"
                                : rule.actionType || "System Action"}
                            </span>
                          ) : (
                            <span className="text-zinc-300 italic line-clamp-1">
                              "{rule.replyText}"
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                        <button
                          type="button"
                          onClick={() => handleToggleRule(rule.id)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            rule.active
                              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25"
                              : "bg-muted text-muted-foreground hover:bg-muted/80"
                          }`}
                        >
                          {rule.active ? "Active" : "Paused"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingRule({ ...rule });
                            setRuleModalOpen(true);
                          }}
                          className="p-2 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground text-xs cursor-pointer"
                          title="Edit rule"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteRule(rule.id)}
                          className="p-2 rounded-xl bg-destructive/10 hover:bg-destructive/20 text-destructive text-xs cursor-pointer"
                          title="Delete rule"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* General Co-Pilot Custom Instructions */}
          <div className="rounded-3xl bg-card border border-border p-5 sm:p-6 space-y-3">
            <div>
              <h3 className="text-base font-extrabold text-foreground flex items-center gap-2">
                <BrainCircuit className="w-4 h-4 text-amber-400" />
                Additional Co-Pilot Directives &amp; Tone (Optional)
              </h3>
              <p className="text-xs text-muted-foreground">
                High-level business guidance on how Stony should partner with you on WhatsApp (e.g. "Always remind me when SMS balance is below 50", "Talk in sharp Ghanaian English").
              </p>
            </div>
            <textarea
              rows={3}
              value={copilotCustomDirectives}
              onChange={(e) => setCopilotCustomDirectives(e.target.value)}
              placeholder="e.g. When I ask about sales, always highlight high volume hours. Talk sharply as my partner bossu."
              className="w-full px-4 py-3 bg-background border border-border rounded-2xl text-foreground text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
            />
          </div>

          {/* INTERACTIVE WHATSAPP SANDBOX SIMULATOR */}
          <div className="rounded-3xl bg-card border border-amber-500/30 p-5 sm:p-7 space-y-4 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
                  <Smartphone className="w-5 h-5" />
                </span>
                <div>
                  <h2 className="text-base font-extrabold text-foreground">
                    WhatsApp Live Response Simulator
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Test what WhatsApp will reply to any request (e.g. delivery time, most orders, or custom triggers)!
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={handleTestWhatsApp} className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={waTestQuery}
                onChange={(e) => setWaTestQuery(e.target.value)}
                placeholder="Type what you would send on WhatsApp (e.g. what is live delivery time? or who has most orders?)"
                className="flex-1 px-4 py-3 bg-background border border-border rounded-2xl text-foreground text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
              />
              <button
                type="submit"
                disabled={testingWa || !waTestQuery.trim()}
                className="flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs sm:text-sm transition-all shadow-sm disabled:opacity-50 cursor-pointer shrink-0"
              >
                {testingWa ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Testing...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Test WhatsApp Reply</span>
                  </>
                )}
              </button>
            </form>

            {/* Test WhatsApp Output Display */}
            {waTestResult && (
              <div className="p-4 sm:p-5 rounded-2xl bg-muted/40 border border-amber-500/40 space-y-2 animate-in fade-in">
                <div className="flex items-center justify-between text-[11px] font-bold pb-2 border-b border-border">
                  <span className="text-amber-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    WhatsApp Bot Live Reply:
                  </span>
                  <span className="text-muted-foreground font-mono bg-card px-2 py-0.5 rounded-md border border-border">
                    Source: {waTestResult.source} {waTestResult.rule ? `(${waTestResult.rule})` : ""}
                  </span>
                </div>
                <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-500/20 text-xs sm:text-sm text-foreground whitespace-pre-wrap leading-relaxed font-sans font-medium">
                  {waTestResult.reply}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────── */}
      {/* TAB 2: STOREFRONT LIVE CHAT CUSTOMER INSTRUCTIONS */}
      {/* ──────────────────────────────────────────────────────── */}
      {activeTab === "storefront" && (
        <form onSubmit={handleSaveStorefront} className="space-y-6">
          {/* NOTICE & ALERTS */}
          {notice && (
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs sm:text-sm font-semibold flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{notice}</span>
            </div>
          )}
          {error && (
            <div className="p-3.5 rounded-2xl bg-destructive/10 border border-destructive/30 text-destructive text-xs sm:text-sm font-semibold flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* MAIN INSTRUCTIONS TEXTAREA CARD */}
          <div className="rounded-3xl bg-card border border-border p-5 sm:p-7 space-y-4 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-border">
              <div>
                <h2 className="text-base font-extrabold text-foreground flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-primary" />
                  Storefront Customer Care Directives
                </h2>
                <p className="text-xs text-muted-foreground">
                  Controls how the AI interacts with visitors and customers on the website live chat.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setInstructions(DEFAULT_MASTER_TRAINING);
                  toast.success("Loaded full Data One master training template!");
                }}
                className="text-xs text-primary font-bold hover:underline flex items-center gap-1 self-start sm:self-auto cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Load Master Ghanaian Template</span>
              </button>
            </div>

            <textarea
              rows={14}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder={DEFAULT_MASTER_TRAINING}
              disabled={loading}
              className="w-full px-4 py-3.5 bg-background border border-border rounded-2xl text-foreground text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary font-mono leading-relaxed"
            />

            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
              <span className="text-[11px] text-muted-foreground">
                Character count: {instructions.length}
              </span>

              <div className="flex items-center gap-2.5 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={fetchAllTraining}
                  disabled={loading}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-secondary hover:bg-secondary/80 text-foreground font-black text-xs sm:text-sm border border-border transition-all cursor-pointer"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                  <span>Reload</span>
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-7 py-3 rounded-2xl bg-primary text-primary-foreground font-black text-xs sm:text-sm shadow-md transition-all hover:opacity-90 disabled:opacity-50 cursor-pointer"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving Instructions...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Save AI Instructions</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* STOREFRONT CHAT TEST SIMULATOR */}
          <div className="rounded-3xl bg-card border border-border p-5 sm:p-7 space-y-4 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-primary/10 text-primary">
                  <Bot className="w-5 h-5" />
                </span>
                <div>
                  <h2 className="text-base font-extrabold text-foreground">
                    Storefront Live Chat Simulator
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Test what website visitors receive when asking questions on your live chat!
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={testQuestion}
                onChange={(e) => setTestQuestion(e.target.value)}
                placeholder="Type a test question (e.g. how fast is delivery? or is this a scam?)"
                className="flex-1 px-4 py-3 bg-background border border-border rounded-2xl text-foreground text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary font-medium"
              />
              <button
                type="button"
                onClick={handleTestPrompt}
                disabled={testingAI || !testQuestion.trim()}
                className="flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-primary hover:opacity-90 text-primary-foreground font-black text-xs sm:text-sm transition-all shadow-sm disabled:opacity-50 cursor-pointer shrink-0"
              >
                {testingAI ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Thinking...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Test Response</span>
                  </>
                )}
              </button>
            </div>

            {testReply && (
              <div className="p-4 sm:p-5 rounded-2xl bg-muted/40 border border-primary/30 space-y-2 animate-in fade-in">
                <div className="flex items-center justify-between text-[11px] font-bold pb-2 border-b border-border">
                  <span className="text-primary flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Storefront Live Output
                  </span>
                  {testProvider && (
                    <span className="text-muted-foreground font-mono bg-card px-2 py-0.5 rounded-md border border-border">
                      Engine: {testProvider}
                    </span>
                  )}
                </div>
                <p className="text-xs sm:text-sm text-foreground whitespace-pre-wrap leading-relaxed font-sans pt-1">
                  {testReply}
                </p>
              </div>
            )}
          </div>
        </form>
      )}

      {/* ──────────────────────────────────────────────────────── */}
      {/* ADD / EDIT TRIGGER RULE MODAL */}
      {/* ──────────────────────────────────────────────────────── */}
      {ruleModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-card border border-border rounded-3xl p-6 sm:p-8 max-w-lg w-full space-y-5 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="text-lg font-black text-foreground flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-400" />
                {editingRule.id ? "Edit WhatsApp Trigger Rule" : "Add New WhatsApp Trigger Rule"}
              </h3>
              <button
                type="button"
                onClick={() => setRuleModalOpen(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-foreground block mb-1.5">
                  1. What does the WhatsApp message say or ask?
                </label>
                <input
                  type="text"
                  value={editingRule.trigger}
                  onChange={(e) => setEditingRule({ ...editingRule, trigger: e.target.value })}
                  placeholder="e.g. delivery time, most orders, discount, refund policy"
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl text-foreground text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-foreground block mb-1.5">
                  2. Matching Method
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(["contains", "exact", "regex"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setEditingRule({ ...editingRule, matchType: m })}
                      className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        editingRule.matchType === m
                          ? "bg-amber-500 text-black border-amber-500 font-black shadow-sm"
                          : "bg-muted/40 border-border text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {m === "contains" ? "Contains Word" : m === "exact" ? "Exact Match" : "Regex Pattern"}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-foreground block mb-1.5">
                  3. What should the bot give or send?
                </label>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => setEditingRule({ ...editingRule, responseType: "action" })}
                    className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      editingRule.responseType === "action"
                        ? "bg-emerald-500 text-black border-emerald-500 font-black shadow-sm"
                        : "bg-muted/40 border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    ⚡ Live Dynamic Action
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingRule({ ...editingRule, responseType: "reply" })}
                    className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      editingRule.responseType === "reply"
                        ? "bg-amber-500 text-black border-amber-500 font-black shadow-sm"
                        : "bg-muted/40 border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    💬 Custom Text Reply
                  </button>
                </div>

                {editingRule.responseType === "action" ? (
                  <div>
                    <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                      Select Action to Execute Live:
                    </label>
                    <select
                      value={editingRule.actionType || "query_delivery_times"}
                      onChange={(e) =>
                        setEditingRule({ ...editingRule, actionType: e.target.value as any })
                      }
                      className="w-full px-4 py-3 bg-background border border-border rounded-xl text-foreground text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                    >
                      <option value="query_delivery_times">
                        ⚡ Accurate Live Delivery Time from Site &amp; Gateway
                      </option>
                      <option value="query_top_customers">
                        🏆 Customer Numbers with Most Orders (Rankings)
                      </option>
                      <option value="check_balances">
                        💳 Live DataMart Wallet &amp; Arkesel SMS Balances
                      </option>
                      <option value="list_recent_orders">
                        📦 Fetch Latest Store Orders List
                      </option>
                      <option value="lookup_phone">
                        🔍 Customer Phone Order History Lookup
                      </option>
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                      Write the exact message to reply:
                    </label>
                    <textarea
                      rows={4}
                      value={editingRule.replyText}
                      onChange={(e) => setEditingRule({ ...editingRule, replyText: e.target.value })}
                      placeholder="Type the exact message Stony will send back..."
                      className="w-full px-4 py-3 bg-background border border-border rounded-xl text-foreground text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 font-sans"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => setRuleModalOpen(false)}
                className="px-5 py-2.5 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveRule}
                className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-black shadow-md cursor-pointer"
              >
                {editingRule.id ? "Update Rule" : "Save Rule"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
